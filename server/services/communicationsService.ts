import { createHash, createHmac, randomUUID, timingSafeEqual } from 'node:crypto';
import type { Pool } from 'pg';
import { enforceUsageLimit } from './billingService';
import { decryptSecret, encryptSecret } from './integrationOAuth';
import { enqueueJob } from './jobService';
import { recordCostEvent } from './analyticsService';

export type CommunicationChannel = 'email' | 'sms';
export type EmailProvider = 'google-workspace' | 'microsoft-365';

export const COMMUNICATION_JOB_TYPES = {
  EMAIL_SEND: 'communication.email.send',
  SMS_SEND: 'communication.sms.send',
  SEQUENCE_STEP: 'communication.sequence.step',
} as const;

const EMAIL_RE = /^\S+@\S+\.\S+$/;
const PHONE_RE = /^\+?[1-9]\d{7,14}$/;

/**
 * Return a trimmed environment setting, throwing when it is empty or missing.
 */
function env(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(name + ' is not configured');
  return value;
}

/**
 * Trim and lowercase an email address for storage and comparison.
 */
export function normalizeEmail(value: string): string {
  return String(value || '').trim().toLowerCase();
}

/**
 * Strip phone formatting and add a leading plus, using +1 for ten-digit numbers.
 * This normalizes the input without validating the resulting phone number.
 */
export function normalizePhone(value: string): string {
  const raw = String(value || '').trim();
  if (!raw) return '';
  const digits = raw.replace(/[^\d+]/g, '');
  if (digits.startsWith('+')) return digits;
  if (digits.length === 10) return '+1' + digits;
  return '+' + digits;
}

/**
 * Encode a username and password as the credential portion of HTTP Basic auth.
 */
function basicAuth(user: string, password: string): string {
  return Buffer.from(user + ':' + password).toString('base64');
}

/**
 * Fetch a provider response as JSON, falling back to raw text when parsing fails.
 * Throw a provider error for unsuccessful HTTP responses.
 */
async function requestJson(url: string, init: RequestInit = {}): Promise<any> {
  const response = await fetch(url, {
    ...init,
    headers: { Accept: 'application/json', ...(init.headers || {}) },
  });
  const text = await response.text();
  let data: any = {};
  try { data = text ? JSON.parse(text) : {}; } catch { data = { raw: text }; }
  if (!response.ok) {
    throw new Error(data?.error?.message || data?.error_description || data?.message || 'Provider request failed: ' + response.status);
  }
  return data;
}

/**
 * Find a connected email account for the given organization, user, and provider.
 * Throw when no matching connection exists.
 */
async function connection(pool: Pool, organizationId: string, userId: string, provider: EmailProvider) {
  const result = await pool.query(
    "SELECT * FROM integration_connections WHERE organization_id=$1 AND user_id=$2 AND provider=$3 AND status='connected' LIMIT 1",
    [organizationId, userId, provider],
  );
  if (!result.rowCount) {
    throw new Error('No connected ' + (provider === 'google-workspace' ? 'Gmail' : 'Outlook') + ' account for this user');
  }
  return result.rows[0];
}

/**
 * Decrypt an access token, refreshing and persisting it when near expiry.
 * Use the existing token when no refresh token is available; mark failed refreshes as errors.
 */
async function accessToken(pool: Pool, row: any): Promise<string> {
  const expires = row.token_expires_at ? new Date(row.token_expires_at).getTime() : 0;
  if (expires > Date.now() + 120000) return decryptSecret(row.access_token);
  if (!row.refresh_token) return decryptSecret(row.access_token);

  const google = row.provider === 'google-workspace';
  const tokenUrl = google ? 'https://oauth2.googleapis.com/token' : 'https://login.microsoftonline.com/common/oauth2/v2.0/token';
  const form = new URLSearchParams({
    client_id: env(google ? 'GOOGLE_INTEGRATION_CLIENT_ID' : 'MICROSOFT_INTEGRATION_CLIENT_ID'),
    client_secret: env(google ? 'GOOGLE_INTEGRATION_CLIENT_SECRET' : 'MICROSOFT_INTEGRATION_CLIENT_SECRET'),
    refresh_token: decryptSecret(row.refresh_token),
    grant_type: 'refresh_token',
  });
  const response = await fetch(tokenUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: form,
  });
  const token = await response.json() as Record<string, any>;
  if (!response.ok || !token.access_token) {
    await pool.query("UPDATE integration_connections SET status='error',updated_at=CURRENT_TIMESTAMP WHERE id=$1", [row.id]);
    throw new Error(token.error_description || token.error || 'Provider token refresh failed');
  }
  const expiresAt = token.expires_in ? new Date(Date.now() + Number(token.expires_in) * 1000).toISOString() : row.token_expires_at;
  await pool.query(
    "UPDATE integration_connections SET access_token=$1,refresh_token=$2,token_expires_at=$3,status='connected',updated_at=CURRENT_TIMESTAMP WHERE id=$4",
    [encryptSecret(String(token.access_token)), token.refresh_token ? encryptSecret(String(token.refresh_token)) : row.refresh_token, expiresAt, row.id],
  );
  return String(token.access_token);
}

/**
 * Encode UTF-8 text as unpadded URL-safe Base64 for Gmail message payloads.
 */
function b64url(value: string): string {
  return Buffer.from(value).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

/**
 * Escape ampersands, angle brackets, and quotes for HTML text.
 */
function escapeHtml(value: string): string {
  return String(value || '').replace(/[&<>"']/g, function (c) {
    return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' } as Record<string,string>)[c] || c;
  });
}

/**
 * Return the configured integration key or the local fallback for tracking signatures.
 */
function trackingSecret(): string {
  return process.env.INTEGRATION_ENCRYPTION_KEY || 'vortex-one-local-tracking-secret';
}

/**
 * Sign a tracking token and destination URL together using HMAC-SHA256.
 */
function trackingSignature(token: string, url: string): string {
  return createHmac('sha256', trackingSecret()).update(token + '\n' + url).digest('base64url');
}

/**
 * Convert plain text to HTML as needed and rewrite HTTP links for signed click tracking.
 * Append an unsubscribe link and an open-tracking pixel.
 */
function trackedHtml(body: string, token: string): string {
  const base = (process.env.APP_URL || 'http://localhost:8080').replace(/\/$/, '') + '/api/communications/tracking';
  const source = /<[^>]+>/.test(body) ? body : escapeHtml(body).replace(/\r?\n/g, '<br>');
  const links = source.replace(/href=["'](https?:\/\/[^"']+)["']/gi, function (_m, url) {
    const sig = trackingSignature(token, url);
    return 'href="' + base + '/click/' + encodeURIComponent(token) + '?url=' + encodeURIComponent(url) + '&sig=' + encodeURIComponent(sig) + '"';
  });
  return links + '<p style="font-size:11px;color:#64748b"><a href="' + base + '/unsubscribe/' + encodeURIComponent(token) + '">Unsubscribe</a></p><img src="' + base + '/open/' + encodeURIComponent(token) + '.gif" width="1" height="1" alt="" style="display:none" />';
}

/**
 * Build HTML email headers and content with optional reply references.
 * Remove line breaks from the subject before including it in the headers.
 */
function mime(from: string, to: string, subject: string, html: string, messageId: string, inReplyTo?: string): string {
  return [
    'From: ' + from,
    'To: ' + to,
    'Subject: ' + subject.replace(/[\r\n]/g, ' '),
    'Message-ID: <' + messageId + '>',
    inReplyTo ? 'In-Reply-To: ' + inReplyTo : '',
    inReplyTo ? 'References: ' + inReplyTo : '',
    'MIME-Version: 1.0',
    'Content-Type: text/html; charset=UTF-8',
    'Content-Transfer-Encoding: 8bit',
    '',
    html,
  ].filter(Boolean).join('\r\n');
}

/**
 * Resolve lead, owner, and property links from supplied IDs or a contact address.
 * Lookups are scoped to the organization; a supplied lead must exist there.
 */
async function resolveLink(pool: Pool, organizationId: string, args: { leadId?: string; ownerId?: string; propertyId?: string; channel: CommunicationChannel; contactKey: string }) {
  let leadId = args.leadId || null;
  let ownerId = args.ownerId || null;
  let propertyId = args.propertyId || null;

  if (leadId) {
    const lead = await pool.query('SELECT id,owner_id,primary_property_id FROM leads WHERE id=$1 AND organization_id=$2 LIMIT 1', [leadId, organizationId]);
    if (!lead.rowCount) throw new Error('Lead not found');
    ownerId = ownerId || lead.rows[0].owner_id;
    propertyId = propertyId || lead.rows[0].primary_property_id;
  }

  if (!ownerId && args.channel === 'email') {
    const owner = await pool.query(
      "SELECT id FROM property_owners WHERE organization_id=$1 AND EXISTS (SELECT 1 FROM jsonb_array_elements(COALESCE(email_addresses,'[]'::jsonb)) e WHERE lower(COALESCE(e->>'email',''))=lower($2)) LIMIT 1",
      [organizationId, args.contactKey],
    );
    ownerId = owner.rows[0]?.id || null;
  }

  if (!ownerId && args.channel === 'sms') {
    const owner = await pool.query(
      "SELECT id FROM property_owners WHERE organization_id=$1 AND EXISTS (SELECT 1 FROM jsonb_array_elements(COALESCE(phone_numbers,'[]'::jsonb)) p WHERE regexp_replace(COALESCE(p->>'number',''),'[^0-9+]','','g')=regexp_replace($2,'[^0-9+]','','g')) LIMIT 1",
      [organizationId, args.contactKey],
    );
    ownerId = owner.rows[0]?.id || null;
  }

  if (!leadId && ownerId) {
    const lead = await pool.query(
      'SELECT id,primary_property_id FROM leads WHERE organization_id=$1 AND owner_id=$2 ORDER BY updated_at DESC NULLS LAST LIMIT 1',
      [organizationId, ownerId],
    );
    leadId = lead.rows[0]?.id || null;
    propertyId = propertyId || lead.rows[0]?.primary_property_id || null;
  }

  if (!propertyId && ownerId) {
    const property = await pool.query(
      'SELECT id FROM properties WHERE organization_id=$1 AND owner_id=$2 ORDER BY updated_at DESC NULLS LAST LIMIT 1',
      [organizationId, ownerId],
    );
    propertyId = property.rows[0]?.id || null;
  }

  return { leadId, ownerId, propertyId };
}

/**
 * Throw if the normalized recipient has a channel-specific or all-channel suppression
 * within the organization.
 */
export async function assertNotSuppressed(pool: Pool, organizationId: string, channel: CommunicationChannel, contactKey: string) {
  const key = channel === 'email' ? normalizeEmail(contactKey) : normalizePhone(contactKey);
  const result = await pool.query(
    "SELECT reason FROM communication_suppressions WHERE organization_id=$1 AND contact_key=$2 AND channel IN ($3,'all') LIMIT 1",
    [organizationId, key, channel],
  );
  if (result.rowCount) throw new Error(channel.toUpperCase() + ' recipient is suppressed: ' + result.rows[0].reason);
}

/**
 * Find and update an organization conversation by external thread ID or contact key,
 * or create a new thread with the supplied CRM links.
 */
async function thread(pool: Pool, args: any) {
  const key = args.channel === 'email' ? normalizeEmail(args.contactKey) : normalizePhone(args.contactKey);
  const existing = await pool.query(
    'SELECT * FROM communication_threads WHERE organization_id=$1 AND channel=$2 AND ((external_thread_id IS NOT NULL AND external_thread_id=$3) OR contact_key=$4) ORDER BY updated_at DESC LIMIT 1',
    [args.organizationId, args.channel, args.externalThreadId || null, key],
  );
  if (existing.rowCount) {
    const updated = await pool.query(
      'UPDATE communication_threads SET external_thread_id=COALESCE($1,external_thread_id),subject=COALESCE($2,subject),lead_id=COALESCE($3,lead_id),owner_id=COALESCE($4,owner_id),property_id=COALESCE($5,property_id),last_message_at=CURRENT_TIMESTAMP,updated_at=CURRENT_TIMESTAMP WHERE id=$6 AND organization_id=$7 RETURNING *',
      [args.externalThreadId || null,args.subject || null,args.leadId || null,args.ownerId || null,args.propertyId || null,existing.rows[0].id,args.organizationId],
    );
    return updated.rows[0];
  }
  const inserted = await pool.query(
    'INSERT INTO communication_threads (id,organization_id,channel,provider,contact_key,external_thread_id,subject,lead_id,owner_id,property_id,last_message_at,created_by) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,CURRENT_TIMESTAMP,$11) RETURNING *',
    ['ct_' + randomUUID(),args.organizationId,args.channel,args.provider,key,args.externalThreadId || null,args.subject || null,args.leadId || null,args.ownerId || null,args.propertyId || null,args.userId || null],
  );
  return inserted.rows[0];
}

/**
 * Insert a communication message and update its thread timestamp on success.
 * On a uniqueness conflict, look up the existing message by provider and external ID.
 */
async function record(pool: Pool, args: any) {
  const result = await pool.query(
    "INSERT INTO communication_messages (id,organization_id,thread_id,channel,provider,direction,external_message_id,from_address,to_address,subject,body,html_body,status,tracking_token,idempotency_key,lead_id,owner_id,property_id,created_by,sent_at,received_at,metadata) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,CASE WHEN $6='outbound' AND $13 IN ('sent','delivered','read','replied') THEN CURRENT_TIMESTAMP ELSE NULL END,CASE WHEN $6='inbound' THEN CURRENT_TIMESTAMP ELSE NULL END,$20) ON CONFLICT DO NOTHING RETURNING *",
    ['cm_' + randomUUID(),args.organizationId,args.threadId,args.channel,args.provider,args.direction,args.externalMessageId || null,args.fromAddress || null,args.toAddress || null,args.subject || null,args.body,args.htmlBody || null,args.status,args.trackingToken || null,args.idempotencyKey || null,args.leadId || null,args.ownerId || null,args.propertyId || null,args.userId || null,JSON.stringify(args.metadata || {})],
  );
  if (result.rowCount) {
    await pool.query('UPDATE communication_threads SET last_message_at=CURRENT_TIMESTAMP,updated_at=CURRENT_TIMESTAMP WHERE id=$1 AND organization_id=$2', [args.threadId, args.organizationId]);
    return result.rows[0];
  }
  const existing = await pool.query('SELECT * FROM communication_messages WHERE organization_id=$1 AND provider=$2 AND external_message_id=$3 LIMIT 1', [args.organizationId,args.provider,args.externalMessageId]);
  return existing.rows[0];
}

/**
 * Send tracked HTML through the user's connected Gmail account.
 * Return provider message and thread IDs with the sender account address.
 */
async function sendGmail(pool: Pool, organizationId: string, userId: string, args: any) {
  const row = await connection(pool, organizationId, userId, 'google-workspace');
  const token = await accessToken(pool, row);
  const internalId = randomUUID() + '@vortex-one';
  const raw = b64url(mime(row.account_email,args.to,args.subject,trackedHtml(args.body,args.trackingToken),internalId,args.inReplyTo));
  const data = await requestJson('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
    method:'POST',
    headers:{Authorization:'Bearer ' + token,'Content-Type':'application/json'},
    body:JSON.stringify({raw}),
  });
  return { externalMessageId:data.id, externalThreadId:data.threadId || args.externalThreadId || null, accountEmail:row.account_email, provider:'gmail' };
}

/**
 * Create and send a tracked HTML draft through the user's connected Outlook account.
 * Return the draft ID, conversation ID, and sender account address.
 */
async function sendOutlook(pool: Pool, organizationId: string, userId: string, args: any) {
  const row = await connection(pool, organizationId, userId, 'microsoft-365');
  const token = await accessToken(pool, row);
  const draft = await requestJson('https://graph.microsoft.com/v1.0/me/messages', {
    method:'POST',
    headers:{Authorization:'Bearer ' + token,'Content-Type':'application/json'},
    body:JSON.stringify({
      subject:args.subject,
      body:{contentType:'HTML',content:trackedHtml(args.body,args.trackingToken)},
      toRecipients:[{emailAddress:{address:args.to}}],
      internetMessageHeaders:[{name:'X-Vortex-One-Tracking',value:args.trackingToken}],
    }),
  });
  await requestJson('https://graph.microsoft.com/v1.0/me/messages/' + encodeURIComponent(draft.id) + '/send', {
    method:'POST',headers:{Authorization:'Bearer ' + token,'Content-Length':'0'},
  });
  return { externalMessageId:draft.id, externalThreadId:draft.conversationId || args.externalThreadId || null, accountEmail:row.account_email, provider:'outlook' };
}

/**
 * Validate the recipient and suppressions, link CRM records, and send a tracked email.
 * Reuse successfully sent records for the idempotency key and reject queued records with
 * a previous provider attempt; persist the send result or failure and return the message.
 */
export async function sendEmailNow(pool: Pool, args: any) {
  const to = normalizeEmail(args.to);
  if (!EMAIL_RE.test(to)) throw new Error('A valid recipient email is required');
  await assertNotSuppressed(pool,args.organizationId,'email',to);
  const links = await resolveLink(pool,args.organizationId,{...args,channel:'email',contactKey:to});
  const providerName = args.provider === 'microsoft-365' ? 'outlook' : 'gmail';
  const t = await thread(pool,{organizationId:args.organizationId,userId:args.userId,channel:'email',provider:providerName,contactKey:to,externalThreadId:args.externalThreadId,subject:args.subject,...links});
  const idempotencyKey = args.idempotencyKey || 'email:' + args.organizationId + ':' + to + ':' + createHash('sha256').update(args.subject + '\n' + args.body).digest('hex');
  const existing = await pool.query('SELECT * FROM communication_messages WHERE organization_id=$1 AND idempotency_key=$2 LIMIT 1',[args.organizationId,idempotencyKey]);
  if (existing.rowCount && ['sent','delivered','read','replied'].includes(existing.rows[0].status)) return existing.rows[0];
  if (existing.rowCount && existing.rows[0].status === 'queued' && existing.rows[0].metadata?.provider_attempted) {
    throw new Error('A provider attempt is already recorded for this idempotency key; manual recovery is required');
  }
  const row = await connection(pool,args.organizationId,args.userId,args.provider);
  const trackingToken = existing.rows[0]?.tracking_token || randomUUID().replace(/-/g,'');
  let pending = existing.rows[0];
  if (pending?.status === 'failed') {
    const reset = await pool.query("UPDATE communication_messages SET status='queued',error_message=NULL,metadata=metadata - 'provider_attempted' WHERE id=$1 AND organization_id=$2 RETURNING *",[pending.id,args.organizationId]);
    pending = reset.rows[0];
  } else if (!pending) {
    pending = await record(pool,{organizationId:args.organizationId,threadId:t.id,channel:'email',provider:providerName,direction:'outbound',fromAddress:row.account_email,toAddress:to,subject:args.subject,body:args.body,status:'queued',trackingToken,idempotencyKey,leadId:links.leadId,ownerId:links.ownerId,propertyId:links.propertyId,userId:args.userId});
  }
  await pool.query("UPDATE communication_messages SET metadata=metadata || '{\"provider_attempted\":true}'::jsonb WHERE id=$1 AND organization_id=$2",[pending.id,args.organizationId]);
  await enforceUsageLimit(pool, args.organizationId, 'emails_month', 1);
  try {
    const sent = args.provider === 'microsoft-365'
      ? await sendOutlook(pool,args.organizationId,args.userId,{...args,to,trackingToken,externalThreadId:t.external_thread_id})
      : await sendGmail(pool,args.organizationId,args.userId,{...args,to,trackingToken,externalThreadId:t.external_thread_id});
    const updated = await pool.query("UPDATE communication_messages SET external_message_id=$1,status='sent',sent_at=CURRENT_TIMESTAMP,metadata=metadata || $2::jsonb WHERE id=$3 RETURNING *", [sent.externalMessageId,JSON.stringify({provider:sent.provider,external_thread_id:sent.externalThreadId}),pending.id]);
    const emailUnitCostUsd = Math.max(0, Number(process.env.ANALYTICS_EMAIL_UNIT_COST_USD || 0));
    await recordCostEvent(pool, {
      organizationId: args.organizationId,
      id: 'cost_email_' + pending.id,
      userId: args.userId,
      category: 'email',
      provider: providerName,
      quantity: 1,
      unitCostUsd: emailUnitCostUsd,
      totalCostUsd: emailUnitCostUsd,
      referenceType: 'communication_message',
      referenceId: pending.id,
      metadata: { externalMessageId: sent.externalMessageId, pricingConfigured: emailUnitCostUsd > 0 },
    });
    await pool.query('UPDATE communication_threads SET external_thread_id=COALESCE($1,external_thread_id),last_message_at=CURRENT_TIMESTAMP,updated_at=CURRENT_TIMESTAMP WHERE id=$2 AND organization_id=$3',[sent.externalThreadId,t.id,args.organizationId]);
    return updated.rows[0];
  } catch (error: any) {
    await pool.query("UPDATE communication_messages SET status='failed',error_message=$1 WHERE id=$2", [error.message || 'Email send failed',pending.id]);
    throw error;
  }
}

/**
 * Load the required Twilio account SID and authentication token from the environment.
 */
async function twilio() {
  return { sid:env('TWILIO_ACCOUNT_SID'), token:env('TWILIO_AUTH_TOKEN') };
}

/**
 * Fetch up to 100 Twilio numbers and upsert them for the supplied organization.
 * In production, require and apply the configured phone-number allowlist.
 */
export async function listTwilioNumbers(pool: Pool, organizationId: string) {
  const cfg = await twilio();
  const data = await requestJson('https://api.twilio.com/2010-04-01/Accounts/' + cfg.sid + '/IncomingPhoneNumbers.json?PageSize=100',{headers:{Authorization:'Basic ' + basicAuth(cfg.sid,cfg.token)}});
  const allowed = String(process.env.TWILIO_ALLOWED_NUMBERS || '').split(',').map((v)=>normalizePhone(v)).filter(Boolean);
  const remoteNumbers = (data.incoming_phone_numbers || []).filter((n:any)=>{
    const normalized=normalizePhone(n.phone_number);
    return process.env.NODE_ENV !== 'production' || allowed.includes(normalized);
  });
  if(process.env.NODE_ENV === 'production' && !allowed.length) throw new Error('TWILIO_ALLOWED_NUMBERS must map Twilio numbers to an organization in production');
  const numbers = remoteNumbers.map((n:any)=>({phone_number:n.phone_number,friendly_name:n.friendly_name,sid:n.sid,capabilities:n.capabilities || {}}));
  for (const n of numbers) {
    await pool.query(
      "INSERT INTO messaging_numbers (id,organization_id,provider,phone_number,friendly_name,capabilities,status,metadata) VALUES ($1,$2,'twilio',$3,$4,$5,'active',$6) ON CONFLICT (organization_id,provider,phone_number) DO UPDATE SET friendly_name=EXCLUDED.friendly_name,capabilities=EXCLUDED.capabilities,metadata=EXCLUDED.metadata,updated_at=CURRENT_TIMESTAMP",
      ['num_' + randomUUID(),organizationId,n.phone_number,n.friendly_name,JSON.stringify(n.capabilities),JSON.stringify({sid:n.sid})],
    );
  }
  return numbers;
}

/**
 * Validate the recipient and suppressions, send an SMS through Twilio, and record it.
 * Return an existing message when the organization and idempotency key already match.
 */
export async function sendSmsNow(pool: Pool, args: any) {
  const to = normalizePhone(args.to);
  if (!PHONE_RE.test(to)) throw new Error('A valid E.164 phone number is required');
  await assertNotSuppressed(pool,args.organizationId,'sms',to);
  const links = await resolveLink(pool,args.organizationId,{...args,channel:'sms',contactKey:to});
  const t = await thread(pool,{organizationId:args.organizationId,userId:args.userId,channel:'sms',provider:'twilio',contactKey:to,subject:'SMS conversation',...links});
  const idempotencyKey = args.idempotencyKey || 'sms:' + args.organizationId + ':' + to + ':' + createHash('sha256').update(args.body).digest('hex');
  const existing = await pool.query('SELECT * FROM communication_messages WHERE organization_id=$1 AND idempotency_key=$2 LIMIT 1',[args.organizationId,idempotencyKey]);
  if (existing.rowCount) return existing.rows[0];
  await enforceUsageLimit(pool, args.organizationId, 'sms_month', 1);
  const cfg = await twilio();
  // The sender must be an active messaging number registered to THIS organization. A caller-supplied `from`
  // is only honored when it is one of those numbers, and the platform-wide TWILIO_FROM_NUMBER is never used
  // as an implicit fallback (that would let any tenant send, and bill, as the platform or another tenant).
  const ownedNumbers = await pool.query(
    "SELECT phone_number FROM messaging_numbers WHERE organization_id=$1 AND provider='twilio' AND status='active' ORDER BY phone_number LIMIT 50",
    [args.organizationId],
  );
  const ownedFromNumbers = ownedNumbers.rows.map((row: any) => normalizePhone(row.phone_number));
  const requestedFrom = normalizePhone(args.from || '');
  const from = requestedFrom || ownedFromNumbers[0] || '';
  if (!from || !ownedFromNumbers.includes(from)) {
    throw Object.assign(new Error('No active messaging number registered to this organization is available to send from'), { statusCode: 403 });
  }
  const form = new URLSearchParams({To:to,From:from,Body:String(args.body)});
  const callback = (process.env.APP_URL || '').replace(/\/$/,'') + '/api/communications/webhooks/twilio/status';
  if (callback.startsWith('http')) form.set('StatusCallback',callback);
  const data = await requestJson('https://api.twilio.com/2010-04-01/Accounts/' + cfg.sid + '/Messages.json',{
    method:'POST',headers:{Authorization:'Basic ' + basicAuth(cfg.sid,cfg.token),'Content-Type':'application/x-www-form-urlencoded'},body:form,
  });
  const message = await record(pool,{organizationId:args.organizationId,threadId:t.id,channel:'sms',provider:'twilio',direction:'outbound',externalMessageId:data.sid,fromAddress:from,toAddress:to,subject:'SMS conversation',body:args.body,status:data.status === 'delivered' ? 'delivered' : 'sent',idempotencyKey,leadId:links.leadId,ownerId:links.ownerId,propertyId:links.propertyId,userId:args.userId,metadata:{twilio_status:data.status}});
  const smsUnitCostUsd = Math.max(0, Number(process.env.ANALYTICS_SMS_UNIT_COST_USD || 0));
  try { await recordCostEvent(pool, {
    organizationId: args.organizationId,
    id: 'cost_sms_' + message.id,
    userId: args.userId,
    category: 'sms',
    provider: 'twilio',
    quantity: 1,
    unitCostUsd: smsUnitCostUsd,
    totalCostUsd: smsUnitCostUsd,
    referenceType: 'communication_message',
    referenceId: message.id,
    metadata: { externalMessageId: data.sid, pricingConfigured: smsUnitCostUsd > 0 },
  }); } catch (analyticsError) { console.warn('[Analytics] SMS cost recording failed:', analyticsError); }
  return message;
}

/**
 * Compare a Twilio webhook signature with the HMAC-SHA1 of its URL and sorted parameters.
 */
export function validTwilio(reqUrl: string, params: Record<string,string>, signature: string, token: string): boolean {
  const payload = reqUrl + Object.keys(params).sort().map((key)=>key + params[key]).join('');
  const expected = Buffer.from(createHmac('sha1',token).update(payload).digest('base64'));
  const actual = Buffer.from(String(signature || ''));
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

/**
 * Verify an inbound Twilio callback and record it for the destination number's organization.
 * Require exactly one active organization mapping and record suppressions for STOP keywords.
 * Unsigned callbacks are allowed only with the explicit development override.
 */
export async function handleTwilioInbound(pool: Pool, reqUrl: string, body: Record<string,string>, signature?: string) {
  const cfg = await twilio();
  const localUnsigned = process.env.NODE_ENV === 'development' && process.env.ALLOW_UNSIGNED_TWILIO_WEBHOOKS === 'true';
  if (!signature || !validTwilio(reqUrl,body,signature,cfg.token)) {
    if (!localUnsigned) throw new Error('Invalid Twilio webhook signature');
  }
  const from = normalizePhone(body.From);
  const to = normalizePhone(body.To);
  const text = String(body.Body || '').trim();
  if (!PHONE_RE.test(from) || !PHONE_RE.test(to) || !text) return;
  const numberResult = await pool.query(
    "SELECT organization_id FROM messaging_numbers WHERE provider='twilio' AND phone_number=$1 AND status='active' LIMIT 2",
    [to],
  );
  if (numberResult.rowCount !== 1) throw new Error('Twilio destination number is not mapped to exactly one organization');
  const organizationId = numberResult.rows[0].organization_id;
  if (body.MessageSid) {
    const dedupe = await pool.query(
      "INSERT INTO processed_events (event_id,organization_id,provider,event_type,processed_at) VALUES ($1,$2,'twilio','sms.inbound',CURRENT_TIMESTAMP) ON CONFLICT (event_id) DO NOTHING RETURNING event_id",
      ['twilio:inbound:' + body.MessageSid, organizationId],
    );
    if (!dedupe.rowCount) return;
  }
  const links = await resolveLink(pool,organizationId,{channel:'sms',contactKey:from});
  const t = await thread(pool,{organizationId,channel:'sms',provider:'twilio',contactKey:from,externalThreadId:body.MessageSid,subject:'SMS conversation',...links});
  const message = await record(pool,{organizationId,threadId:t.id,channel:'sms',provider:'twilio',direction:'inbound',externalMessageId:body.MessageSid,fromAddress:from,toAddress:to,subject:'SMS conversation',body:text,status:'received',leadId:links.leadId,ownerId:links.ownerId,propertyId:links.propertyId,metadata:{twilio:body}});
  if (/^(stop|stopall|unsubscribe|cancel|end|quit|remove)$/i.test(text)) {
    await pool.query("INSERT INTO communication_suppressions (id,organization_id,channel,contact_key,reason,source) VALUES ($1,$2,'sms',$3,'STOP','twilio') ON CONFLICT (organization_id,channel,contact_key) DO NOTHING", ['sup_' + randomUUID(),organizationId,from]);
    await pool.query("INSERT INTO communication_events (id,organization_id,message_id,event_type,metadata) VALUES ($1,$2,$3,'opted_out',$4)", ['ce_' + randomUUID(),organizationId,message.id,JSON.stringify({source:'twilio'})]);
  }
}

/**
 * Verify a Twilio status callback and update the uniquely mapped message's status.
 * Record delivery events; unsigned callbacks require the explicit development override.
 */
export async function handleTwilioStatus(pool: Pool, reqUrl: string, body: Record<string,string>, signature?: string) {
  const cfg = await twilio();
  const localUnsigned = process.env.NODE_ENV === 'development' && process.env.ALLOW_UNSIGNED_TWILIO_WEBHOOKS === 'true';
  if (!signature || !validTwilio(reqUrl,body,signature,cfg.token)) {
    if (!localUnsigned) throw new Error('Invalid Twilio webhook signature');
  }
  const sid = body.MessageSid || body.SmsSid;
  if (!sid) return;
  const messageOrg = await pool.query('SELECT organization_id,id FROM communication_messages WHERE provider=\'twilio\' AND external_message_id=$1 LIMIT 2',[sid]);
  if (messageOrg.rowCount !== 1) throw new Error('Twilio message is not mapped to exactly one organization');
  const organizationId = messageOrg.rows[0].organization_id;
  const status = String(body.MessageStatus || body.SmsStatus || '').toLowerCase();
  const dedupe = await pool.query(
    "INSERT INTO processed_events (event_id,organization_id,provider,event_type,processed_at) VALUES ($1,$2,'twilio','sms.status',CURRENT_TIMESTAMP) ON CONFLICT (event_id) DO NOTHING RETURNING event_id",
    ['twilio:status:' + sid + ':' + status, organizationId],
  );
  if (!dedupe.rowCount) return;
  const mapped = status === 'delivered' ? 'delivered' : status === 'failed' || status === 'undelivered' ? 'failed' : status === 'read' ? 'read' : 'sent';
  await pool.query("UPDATE communication_messages SET status=$1,error_message=CASE WHEN $1='failed' THEN $2 ELSE error_message END WHERE organization_id=$3 AND external_message_id=$4", [mapped,body.ErrorMessage || body.ErrorCode || null,organizationId,sid]);
  if (mapped === 'delivered') {
    const message = await pool.query('SELECT id FROM communication_messages WHERE organization_id=$1 AND external_message_id=$2 LIMIT 1',[organizationId,sid]);
    if (message.rowCount) await pool.query("INSERT INTO communication_events (id,organization_id,message_id,event_type,metadata) VALUES ($1,$2,$3,'delivered',$4)", ['ce_' + randomUUID(),organizationId,message.rows[0].id,JSON.stringify(body)]);
  }
}

/**
 * Return the first case-insensitive email header match, or an empty string.
 */
function header(headers:any[], name:string):string {
  return String((headers || []).find((h:any)=>String(h.name).toLowerCase() === name.toLowerCase())?.value || '');
}

/**
 * Decode a Gmail MIME part body, recursively selecting the first nonempty child body.
 */
function gmailBody(part:any):string {
  if (part?.body?.data) return Buffer.from(String(part.body.data).replace(/-/g,'+').replace(/_/g,'/'),'base64').toString('utf8');
  if (Array.isArray(part?.parts)) return part.parts.map(gmailBody).find(Boolean) || '';
  return '';
}

/**
 * Suppress a bounce recipient only when exactly one address in the bounce
 * matches a recipient previously contacted by this organization.
 */
export async function suppressBounceRecipient(pool: Pool, organizationId: string, body: string, subject: string, sender: string) {
  const candidates = Array.from(new Set(
    (String(body || '') + '\n' + String(subject || ''))
      .match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi) || []
  )).map(normalizeEmail).filter((email) => EMAIL_RE.test(email) && email !== normalizeEmail(sender));
  if (!candidates.length) return null;
  const result = await pool.query(
    "SELECT DISTINCT to_address FROM communication_messages WHERE organization_id=$1 AND channel='email' AND direction='outbound' AND lower(to_address)=ANY($2::text[]) LIMIT 2",
    [organizationId, candidates],
  );
  const matched = Array.from(new Set(result.rows.map((row:any)=>normalizeEmail(row.to_address)).filter(Boolean)));
  if (matched.length !== 1) return null;
  await suppress(pool, organizationId, 'email', matched[0], 'hard bounce', 'provider-bounce');
  return matched[0];
}

/**
 * Fetch up to 25 Gmail messages from the last seven days and record them as inbound.
 * Link CRM records, classify likely bounces, and count messages returned by persistence.
 */
async function syncGmail(pool: Pool, organizationId: string, userId: string) {
  const row = await connection(pool,organizationId,userId,'google-workspace');
  const token = await accessToken(pool,row);
  const after = Math.floor((Date.now()-7*24*3600*1000)/1000);
  const maxPages = Math.min(Math.max(Number(process.env.EMAIL_SYNC_MAX_PAGES || 5),1),20);
  let pageToken = '';
  let imported = 0;
  for (let page = 0; page < maxPages; page += 1) {
    const query = new URL('https://gmail.googleapis.com/gmail/v1/users/me/messages');
    query.searchParams.set('maxResults','25');
    query.searchParams.set('q','after:' + after);
    if (pageToken) query.searchParams.set('pageToken',pageToken);
    const list = await requestJson(query.toString(),{headers:{Authorization:'Bearer ' + token}});
    for (const item of list.messages || []) {
      const message = await requestJson('https://gmail.googleapis.com/gmail/v1/users/me/messages/' + encodeURIComponent(item.id) + '?format=full',{headers:{Authorization:'Bearer ' + token}});
      const headers = message.payload?.headers || [];
      const fromRaw = header(headers,'From');
      const from = (fromRaw.match(/<([^>]+)>/)?.[1] || fromRaw).trim().toLowerCase();
      if (!EMAIL_RE.test(from)) continue;
      const subject = header(headers,'Subject');
      const body = gmailBody(message.payload);
      const bounce = /mailer-daemon|postmaster|delivery status notification|undeliverable/i.test(fromRaw + ' ' + subject);
      const links = await resolveLink(pool,organizationId,{channel:'email',contactKey:from});
      const t = await thread(pool,{organizationId,userId,channel:'email',provider:'gmail',contactKey:from,externalThreadId:message.threadId,subject,...links});
      const recorded = await record(pool,{organizationId,threadId:t.id,channel:'email',provider:'gmail',direction:'inbound',externalMessageId:item.id,fromAddress:from,toAddress:header(headers,'To'),subject,body:body.replace(/<[^>]+>/g,' '),htmlBody:body,status:bounce?'bounced':'received',leadId:links.leadId,ownerId:links.ownerId,propertyId:links.propertyId,metadata:{gmail_thread_id:message.threadId,message_id:header(headers,'Message-ID'),in_reply_to:header(headers,'In-Reply-To'),labels:message.labelIds || []}});
      if (bounce) await suppressBounceRecipient(pool, organizationId, body, subject, from);
      if (recorded) imported += 1;
    }
    pageToken = String(list.nextPageToken || '');
    if (!pageToken) break;
  }
  return imported;
}

/**
 * Fetch the latest 25 Outlook inbox messages and record them as inbound.
 * Link CRM records, classify likely bounces, and count messages returned by persistence.
 */
async function syncOutlook(pool: Pool, organizationId: string, userId: string) {
  const row = await connection(pool,organizationId,userId,'microsoft-365');
  const token = await accessToken(pool,row);
  const maxPages = Math.min(Math.max(Number(process.env.EMAIL_SYNC_MAX_PAGES || 5),1),20);
  let nextUrl = 'https://graph.microsoft.com/v1.0/me/mailFolders/inbox/messages?$top=25&$orderby=receivedDateTime%20desc&$select=id,conversationId,subject,from,toRecipients,body,receivedDateTime,internetMessageId,inReplyTo';
  let imported = 0;
  for (let page = 0; page < maxPages && nextUrl; page += 1) {
    const data = await requestJson(nextUrl,{headers:{Authorization:'Bearer ' + token,Prefer:'outlook.body-content-type="html"'}});
    for (const message of data.value || []) {
      const from = String(message.from?.emailAddress?.address || '').toLowerCase();
      if (!EMAIL_RE.test(from)) continue;
      const subject = String(message.subject || '');
      const html = String(message.body?.content || '');
      const bounce = /mailer-daemon|postmaster|delivery status notification|undeliverable/i.test(from + ' ' + subject);
      const links = await resolveLink(pool,organizationId,{channel:'email',contactKey:from});
      const t = await thread(pool,{organizationId,userId,channel:'email',provider:'outlook',contactKey:from,externalThreadId:message.conversationId,subject,...links});
      const recorded = await record(pool,{organizationId,threadId:t.id,channel:'email',provider:'outlook',direction:'inbound',externalMessageId:message.id,fromAddress:from,toAddress:String(message.toRecipients?.[0]?.emailAddress?.address || ''),subject,body:html.replace(/<[^>]+>/g,' '),htmlBody:html,status:bounce?'bounced':'received',leadId:links.leadId,ownerId:links.ownerId,propertyId:links.propertyId,metadata:{conversation_id:message.conversationId,internet_message_id:message.internetMessageId,in_reply_to:message.inReplyTo,received_at:message.receivedDateTime}});
      if (bounce) await suppressBounceRecipient(pool, organizationId, html.replace(/<[^>]+>/g,' '), subject, from);
      if (recorded) imported += 1;
    }
    nextUrl = String(data['@odata.nextLink'] || '');
  }
  return imported;
}

/**
 * Import messages from the selected connected email provider and return the processed count.
 */
export async function syncEmail(pool: Pool, organizationId: string, userId: string, provider: EmailProvider) {
  return provider === 'microsoft-365' ? syncOutlook(pool,organizationId,userId) : syncGmail(pool,organizationId,userId);
}

/**
 * Enqueue an organization communication job with three allowed attempts.
 * Optionally set its availability time and return the job ID.
 */
export async function queueCommunicationJob(pool: Pool, organizationId: string, jobType: string, payload: Record<string,unknown>, availableAt?: Date) {
  const jobId = await enqueueJob(pool,organizationId,jobType,payload,3);
  if (availableAt) await pool.query('UPDATE jobs SET available_at=$1 WHERE id=$2 AND organization_id=$3',[availableAt.toISOString(),jobId,organizationId]);
  return jobId;
}

/**
 * Normalize a contact key and upsert its organization/channel suppression reason and source.
 * Use email normalization for email, and phone normalization for other channels.
 */
export async function suppress(pool: Pool, organizationId: string, channel: string, contactKey: string, reason: string, source: string) {
  const key = channel === 'email' ? normalizeEmail(contactKey) : normalizePhone(contactKey);
  await pool.query(
    'INSERT INTO communication_suppressions (id,organization_id,channel,contact_key,reason,source) VALUES ($1,$2,$3,$4,$5,$6) ON CONFLICT (organization_id,channel,contact_key) DO UPDATE SET reason=EXCLUDED.reason,source=EXCLUDED.source',
    ['sup_' + randomUUID(),organizationId,channel,key,reason,source],
  );
  return {channel,contactKey:key,reason,source};
}

/**
 * Return up to 250 organization threads, optionally filtered by channel,
 * with message counts ordered by most recent activity.
 */
export async function listThreads(pool: Pool, organizationId: string, channel?: CommunicationChannel) {
  const params:any[]=[organizationId];
  const where=['organization_id=$1'];
  if (channel) { params.push(channel); where.push('channel=$' + params.length); }
  const result=await pool.query(
    'SELECT t.*,(SELECT COUNT(*) FROM communication_messages m WHERE m.thread_id=t.id) AS message_count FROM communication_threads t WHERE ' + where.join(' AND ') + ' ORDER BY COALESCE(last_message_at,created_at) DESC LIMIT 250',
    params,
  );
  return result.rows;
}

/**
 * Return a thread's messages in creation order, requiring both messages and thread
 * to belong to the supplied organization.
 */
export async function listThreadMessages(pool: Pool, organizationId: string, threadId: string) {
  const result=await pool.query(
    'SELECT m.*,t.contact_key,t.subject AS thread_subject FROM communication_messages m JOIN communication_threads t ON t.id=m.thread_id WHERE m.organization_id=$1 AND t.organization_id=$1 AND t.id=$2 ORDER BY m.created_at ASC',
    [organizationId,threadId],
  );
  return result.rows;
}

/**
 * Return recent organization messages filtered by lead, owner, or property IDs.
 * Default to 100 results and clamp the requested limit to between 1 and 250.
 */
export async function listTimeline(pool: Pool, organizationId: string, filters: any) {
  const params:any[]=[organizationId];
  const where=['m.organization_id=$1'];
  if (filters.leadId) { params.push(filters.leadId); where.push('m.lead_id=$' + params.length); }
  if (filters.ownerId) { params.push(filters.ownerId); where.push('m.owner_id=$' + params.length); }
  if (filters.propertyId) { params.push(filters.propertyId); where.push('m.property_id=$' + params.length); }
  params.push(Math.min(Math.max(Number(filters.limit || 100),1),250));
  const result=await pool.query(
    'SELECT m.id,m.thread_id,m.channel,m.provider,m.direction,m.from_address,m.to_address,m.subject,m.body,m.status,m.metadata,m.sent_at,m.received_at,m.created_at,t.contact_key,t.subject AS thread_subject FROM communication_messages m JOIN communication_threads t ON t.id=m.thread_id WHERE ' + where.join(' AND ') + ' ORDER BY m.created_at DESC LIMIT $' + params.length,
    params,
  );
  return result.rows;
}

/**
 * Record an open or click event for a known tracking token and update read status.
 * For known tokens, require a signed HTTP(S) destination for clicks; ignore unknown tokens.
 */
export async function recordTrackingEvent(pool: Pool, token: string, type:'opened'|'clicked', url?:string, signature?:string) {
  const result=await pool.query('SELECT id,organization_id FROM communication_messages WHERE tracking_token=$1 LIMIT 1',[token]);
  if (!result.rowCount) return;
  const message=result.rows[0];
  if (type === 'clicked') {
    if (!url || !/^https?:\/\//i.test(url) || !signature || trackingSignature(token,url) !== signature) throw new Error('Invalid tracking destination');
  }
  await pool.query('INSERT INTO communication_events (id,organization_id,message_id,event_type,event_url) VALUES ($1,$2,$3,$4,$5)',['ce_' + randomUUID(),message.organization_id,message.id,type,url || null]);
  await pool.query("UPDATE communication_messages SET status=CASE WHEN $1='opened' AND status='sent' THEN 'read' WHEN $1='clicked' THEN 'read' ELSE status END WHERE id=$2", [type,message.id]);
}

/**
 * Create a sequence and its ordered steps in one transaction, returning its ID.
 * Roll back all inserts if any step fails.
 */
export async function createSequence(pool: Pool, organizationId: string, userId: string, input:any) {
  const client=await pool.connect();
  try {
    await client.query('BEGIN');
    const sequenceId='seq_' + randomUUID();
    await client.query('INSERT INTO communication_sequences (id,organization_id,name,description,status,created_by) VALUES ($1,$2,$3,$4,$5,$6)',[sequenceId,organizationId,input.name,input.description || null,input.status || 'draft',userId]);
    for (let i=0;i<(input.steps || []).length;i++) {
      const step=input.steps[i];
      await client.query('INSERT INTO communication_sequence_steps (id,sequence_id,step_order,channel,template_id,delay_minutes) VALUES ($1,$2,$3,$4,$5,$6)',['seqstep_' + randomUUID(),sequenceId,i+1,step.channel,step.template_id,Math.max(0,Number(step.delay_minutes || 0))]);
    }
    await client.query('COMMIT');
    return sequenceId;
  } catch(error) {
    await client.query('ROLLBACK'); throw error;
  } finally { client.release(); }
}

/**
 * Verify that the sequence and lead belong to the organization, then enroll or restart the lead.
 * Replace queued sequence jobs with the first delayed step and return the enrollment ID.
 */
export async function enrollSequence(pool: Pool, organizationId: string, userId: string, sequenceId: string, leadId: string) {
  const ownership=await pool.query(
    "SELECT s.id AS sequence_id,l.id AS lead_id FROM communication_sequences s CROSS JOIN leads l WHERE s.id=$1 AND s.organization_id=$3 AND l.id=$2 AND l.organization_id=$3 LIMIT 1",
    [sequenceId,leadId,organizationId],
  );
  if(!ownership.rowCount) throw new Error('Sequence or lead does not belong to this organization');
  const first=await pool.query('SELECT step_order,delay_minutes FROM communication_sequence_steps WHERE sequence_id=$1 ORDER BY step_order ASC LIMIT 1',[sequenceId]);
  if(!first.rowCount) throw new Error('Sequence has no steps');
  const delay=Number(first.rows[0].delay_minutes || 0);
  const nextAt=new Date(Date.now()+delay*60000);
  const id='enroll_' + randomUUID();
  await pool.query(
    "INSERT INTO communication_sequence_enrollments (id,organization_id,sequence_id,lead_id,status,current_step_order,next_run_at,created_by) VALUES ($1,$2,$3,$4,'active',$5,$6,$7) ON CONFLICT (sequence_id,lead_id) DO UPDATE SET status='active',current_step_order=$5,next_run_at=$6,updated_at=CURRENT_TIMESTAMP",
    [id,organizationId,sequenceId,leadId,first.rows[0].step_order,nextAt.toISOString(),userId],
  );
  const row=await pool.query('SELECT id FROM communication_sequence_enrollments WHERE organization_id=$1 AND sequence_id=$2 AND lead_id=$3',[organizationId,sequenceId,leadId]);
  await pool.query(
    "DELETE FROM jobs WHERE organization_id=$1 AND job_type=$2 AND status='queued' AND payload->>'enrollmentId'=$3",
    [organizationId,COMMUNICATION_JOB_TYPES.SEQUENCE_STEP,row.rows[0].id],
  );
  await queueCommunicationJob(pool,organizationId,COMMUNICATION_JOB_TYPES.SEQUENCE_STEP,{enrollmentId:row.rows[0].id},nextAt);
  return row.rows[0].id;
}

/**
 * Send the active enrollment's current template through its email or SMS channel.
 * Complete the enrollment or schedule its next delayed step and return its progress.
 */
export async function runSequenceStep(pool: Pool, organizationId: string, enrollmentId: string) {
  const result=await pool.query(
    "SELECT e.*,s.channel,s.template_id,s.step_order,l.owner_id,l.primary_property_id,o.name AS owner_name,o.email_addresses,o.phone_numbers FROM communication_sequence_enrollments e JOIN communication_sequence_steps s ON s.sequence_id=e.sequence_id AND s.step_order=e.current_step_order JOIN leads l ON l.id=e.lead_id AND l.organization_id=e.organization_id LEFT JOIN property_owners o ON o.id=l.owner_id AND o.organization_id=l.organization_id WHERE e.id=$1 AND e.organization_id=$2 AND e.status='active' LIMIT 1",
    [enrollmentId,organizationId],
  );
  if (!result.rowCount) return {done:true};
  const row=result.rows[0];
  const tpl=await pool.query('SELECT id,channel,subject,body FROM outreach_templates WHERE id=$1 AND organization_id=$2 LIMIT 1',[row.template_id,organizationId]);
  if (!tpl.rowCount) throw new Error('Sequence template not found');
  const context:any={owner_name:row.owner_name || 'Property Owner',first_name:String(row.owner_name || 'Property Owner').split(' ')[0]};
  /**
   * Substitute known owner-context template variables, preserving unknown placeholders.
   */
  const render=(value:string)=>String(value || '').replace(/{{\s*([a-zA-Z0-9_]+)\s*}}/g,(_m,k)=>context[k] || _m);
  const email=Array.isArray(row.email_addresses) ? row.email_addresses.find((x:any)=>EMAIL_RE.test(String(x?.email || '')))?.email : '';
  const phone=Array.isArray(row.phone_numbers) ? row.phone_numbers.find((x:any)=>PHONE_RE.test(normalizePhone(String(x?.number || ''))) && !x?.dnc_status)?.number : '';
  const userId=row.created_by || process.env.SEQUENCE_FALLBACK_USER_ID || '';
  if (!userId) throw new Error('SEQUENCE_FALLBACK_USER_ID is required for sequence execution');
  if (tpl.rows[0].channel === 'email') {
    if (!email) throw new Error('Sequence lead has no email address');
    const provider=(process.env.DEFAULT_EMAIL_PROVIDER === 'microsoft-365' ? 'microsoft-365' : 'google-workspace') as EmailProvider;
    await sendEmailNow(pool,{organizationId,userId,provider,to:email,subject:render(tpl.rows[0].subject),body:render(tpl.rows[0].body),leadId:row.lead_id,ownerId:row.owner_id,propertyId:row.primary_property_id,idempotencyKey:'sequence:' + enrollmentId + ':' + row.step_order});
  } else {
    if (!phone) throw new Error('Sequence lead has no SMS number');
    await sendSmsNow(pool,{organizationId,userId,to:phone,body:render(tpl.rows[0].body),leadId:row.lead_id,ownerId:row.owner_id,propertyId:row.primary_property_id,idempotencyKey:'sequence:' + enrollmentId + ':' + row.step_order});
  }
  const next=await pool.query('SELECT step_order,delay_minutes FROM communication_sequence_steps WHERE sequence_id=$1 AND step_order>$2 ORDER BY step_order ASC LIMIT 1',[row.sequence_id,row.step_order]);
  if (!next.rowCount) {
    await pool.query("UPDATE communication_sequence_enrollments SET status='completed',next_run_at=NULL,updated_at=CURRENT_TIMESTAMP WHERE id=$1 AND organization_id=$2", [enrollmentId,organizationId]);
    return {done:true};
  }
  const nextAt=new Date(Date.now()+Number(next.rows[0].delay_minutes || 0)*60000);
  await pool.query('UPDATE communication_sequence_enrollments SET current_step_order=$1,next_run_at=$2,updated_at=CURRENT_TIMESTAMP WHERE id=$3 AND organization_id=$4',[next.rows[0].step_order,nextAt.toISOString(),enrollmentId,organizationId]);
  await queueCommunicationJob(pool,organizationId,COMMUNICATION_JOB_TYPES.SEQUENCE_STEP,{enrollmentId},nextAt);
  return {done:false,nextRunAt:nextAt.toISOString()};
}

