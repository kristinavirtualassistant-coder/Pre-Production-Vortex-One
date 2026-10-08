import { randomUUID } from 'node:crypto';
import { Router, type Response } from 'express';
import { getPgPool } from '../db/db';
import { requireRole, type AuthRequest } from '../middleware/auth';
import {
  COMMUNICATION_JOB_TYPES,
  createSequence,
  enrollSequence,
  handleTwilioInbound,
  handleTwilioStatus,
  listThreadMessages,
  listThreads,
  listTimeline,
  listTwilioNumbers,
  queueCommunicationJob,
  recordTrackingEvent,
  sendEmailNow,
  sendSmsNow,
  suppress,
  syncEmail,
} from './communicationsService';

const router = Router();

/**
 * Return the PostgreSQL pool, or send a 503 response and return null when unavailable.
 */
function poolOrFail(res: Response) {
  const pool = getPgPool();
  if (!pool) {
    res.status(503).json({ error: 'PostgreSQL is required for communications' });
    return null;
  }
  return pool;
}

/**
 * Return the authenticated user's organization ID, throwing when none is associated.
 */
function org(req: AuthRequest): string {
  if (!req.dbUser?.organization_id) throw new Error('No organization associated with authenticated user');
  return req.dbUser.organization_id;
}

/**
 * Return the organization's conversation threads, optionally filtered by channel.
 */
router.get('/threads', async (req: AuthRequest, res) => {
  const pool = poolOrFail(res); if (!pool) return;
  try { res.json({ threads: await listThreads(pool, org(req), req.query.channel as any || undefined) }); }
  catch (e:any) { res.status(500).json({ error:e.message || 'Failed to load threads' }); }
});

/**
 * Return a single thread's messages, scoped to the authenticated organization.
 */
router.get('/threads/:id/messages', async (req: AuthRequest, res) => {
  const pool = poolOrFail(res); if (!pool) return;
  try { res.json({ messages: await listThreadMessages(pool, org(req), req.params.id) }); }
  catch (e:any) { res.status(500).json({ error:e.message || 'Failed to load conversation' }); }
});

/**
 * Return recent organization messages, optionally filtered by lead, owner, property, and limit.
 */
router.get('/timeline', async (req: AuthRequest, res) => {
  const pool = poolOrFail(res); if (!pool) return;
  try {
    res.json({ timeline: await listTimeline(pool, org(req), {
      leadId:req.query.leadId as string || undefined,
      ownerId:req.query.ownerId as string || undefined,
      propertyId:req.query.propertyId as string || undefined,
      limit:req.query.limit === undefined ? undefined : (() => {
        const raw = req.query.limit;
        if (typeof raw !== 'string' || !/^[1-9]\d*$/.test(raw)) throw new Error('limit must be a positive integer');
        return raw;
      })(),
    })});
  } catch (e:any) { const message=e.message || 'Failed to load communications timeline'; res.status(/^limit must be a positive integer$/.test(message) ? 400 : 500).json({ error:message }); }
});

/**
 * Validate and queue an outbound email job for the authenticated organization and user.
 */
router.post('/email/send', requireRole(['admin','executive','manager','agent']), async (req: AuthRequest, res) => {
  const pool = poolOrFail(res); if (!pool) return;
  const body=req.body || {};
  if (!body.provider || !['google-workspace','microsoft-365'].includes(body.provider)) return res.status(400).json({error:'provider must be google-workspace or microsoft-365'});
  if (!body.to || !body.subject || !body.body) return res.status(400).json({error:'to, subject and body are required'});
  try {
    const jobId=await queueCommunicationJob(pool,org(req),COMMUNICATION_JOB_TYPES.EMAIL_SEND,{
      userId:req.dbUser!.id,provider:body.provider,to:body.to,subject:body.subject,body:body.body,
      leadId:body.leadId,ownerId:body.ownerId,propertyId:body.propertyId,externalThreadId:body.externalThreadId,
      inReplyTo:body.inReplyTo,idempotencyKey:body.idempotencyKey,
    });
    res.status(202).json({status:'queued',jobId});
  } catch (e:any) { res.status(400).json({error:e.message || 'Failed to queue email'}); }
});

/**
 * Validate and queue an outbound SMS job for the authenticated organization and user.
 */
router.post('/sms/send', requireRole(['admin','executive','manager','agent']), async (req: AuthRequest, res) => {
  const pool = poolOrFail(res); if (!pool) return;
  const body=req.body || {};
  if (!body.to || !body.body) return res.status(400).json({error:'to and body are required'});
  try {
    const jobId=await queueCommunicationJob(pool,org(req),COMMUNICATION_JOB_TYPES.SMS_SEND,{
      userId:req.dbUser!.id,to:body.to,body:body.body,from:body.from,leadId:body.leadId,ownerId:body.ownerId,propertyId:body.propertyId,idempotencyKey:body.idempotencyKey,
    });
    res.status(202).json({status:'queued',jobId});
  } catch (e:any) { res.status(400).json({error:e.message || 'Failed to queue SMS'}); }
});

/**
 * Trigger an inbox sync for the requested email provider and return the imported count.
 */
router.post('/email/sync', requireRole(['admin','executive','manager','agent']), async (req: AuthRequest, res) => {
  const pool=poolOrFail(res); if(!pool)return;
  const provider=req.body?.provider || req.query.provider;
  if(!['google-workspace','microsoft-365'].includes(provider)) return res.status(400).json({error:'provider is required'});
  try { res.json({imported:await syncEmail(pool,org(req),req.dbUser!.id,provider)}); }
  catch(e:any) { res.status(400).json({error:e.message || 'Email sync failed'}); }
});

/**
 * Return the organization's messaging numbers, syncing from Twilio when none exist and
 * Twilio credentials are configured.
 */
router.get('/numbers', async (req: AuthRequest,res) => {
  const pool=poolOrFail(res); if(!pool)return;
  try {
    let numbers=await pool.query('SELECT * FROM messaging_numbers WHERE organization_id=$1 ORDER BY phone_number',[org(req)]);
    if(!numbers.rowCount && process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN) {
      await listTwilioNumbers(pool,org(req));
      numbers=await pool.query('SELECT * FROM messaging_numbers WHERE organization_id=$1 ORDER BY phone_number',[org(req)]);
    }
    res.json({numbers:numbers.rows});
  } catch(e:any) { res.status(500).json({error:e.message || 'Failed to load messaging numbers'}); }
});

/**
 * Force a Twilio messaging number sync for the authenticated organization.
 */
router.post('/numbers/sync', requireRole(['admin','executive','manager']), async (req: AuthRequest,res) => {
  const pool=poolOrFail(res); if(!pool)return;
  try { res.json({numbers:await listTwilioNumbers(pool,org(req))}); }
  catch(e:any) { res.status(400).json({error:e.message || 'Twilio number sync failed'}); }
});

/**
 * Return the organization's most recent 500 suppression entries.
 */
router.get('/suppressions', async (req: AuthRequest,res) => {
  const pool=poolOrFail(res); if(!pool)return;
  try {
    const result=await pool.query('SELECT id,channel,contact_key,reason,source,created_at FROM communication_suppressions WHERE organization_id=$1 ORDER BY created_at DESC LIMIT 500',[org(req)]);
    res.json({suppressions:result.rows});
  } catch(e:any) { res.status(500).json({error:e.message || 'Failed to load suppressions'}); }
});

/**
 * Validate the channel and contact key, then create or update a suppression entry.
 */
router.post('/suppressions', requireRole(['admin','executive','manager','agent']), async (req: AuthRequest,res) => {
  const pool=poolOrFail(res); if(!pool)return;
  if(!['email','sms','voice','all'].includes(req.body?.channel) || !req.body?.contactKey) return res.status(400).json({error:'channel and contactKey are required'});
  try { res.status(201).json(await suppress(pool,org(req),req.body.channel,req.body.contactKey,req.body.reason || 'manual opt-out',req.body.source || 'user')); }
  catch(e:any) { res.status(400).json({error:e.message || 'Failed to create suppression'}); }
});

/**
 * Return up to 250 organization templates, optionally filtered by channel.
 */
router.get('/templates', async (req: AuthRequest,res) => {
  const pool=poolOrFail(res); if(!pool)return;
  try {
    const channel=req.query.channel as string || undefined;
    const values:any[]=[org(req)];
    const where=['organization_id=$1'];
    if(channel && ['email','sms'].includes(channel)){ values.push(channel); where.push('channel=$' + values.length); }
    const result=await pool.query('SELECT id,name,description,channel,category,subject,body,variables,tags,is_default,version,created_at,updated_at FROM outreach_templates WHERE ' + where.join(' AND ') + ' ORDER BY is_default DESC,updated_at DESC LIMIT 250',values);
    res.json({templates:result.rows});
  } catch(e:any) { res.status(500).json({error:e.message || 'Failed to load templates'}); }
});

/**
 * Validate required fields, extract template variables, and create an outreach template.
 */
router.post('/templates', requireRole(['admin','executive','manager']), async (req: AuthRequest,res) => {
  const pool=poolOrFail(res); if(!pool)return;
  const body=req.body || {};
  if(!body.name || !['email','sms'].includes(body.channel) || !body.body) return res.status(400).json({error:'name, channel and body are required'});
  try {
    const variables=Array.from(new Set(String((body.subject || '') + ' ' + body.body).match(/{{\s*([a-zA-Z0-9_]+)\s*}}/g) || [])).map((v:string)=>v.replace(/[{}\s]/g,''));
    const result=await pool.query(
      'INSERT INTO outreach_templates (id,organization_id,name,description,channel,category,subject,body,variables,tags,is_default,created_by) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING *',
      ['tpl_' + randomUUID(),org(req),String(body.name).trim(),body.description || null,body.channel,body.category || 'custom',body.channel === 'email' ? (body.subject || '') : null,String(body.body),JSON.stringify(variables),JSON.stringify(Array.isArray(body.tags)?body.tags:[]),Boolean(body.is_default),req.dbUser!.id],
    );
    res.status(201).json(result.rows[0]);
  } catch(e:any) { res.status(400).json({error:e.message || 'Failed to create template'}); }
});

/**
 * Return the organization's sequences with their enrollment counts.
 */
router.get('/sequences', async (req: AuthRequest,res) => {
  const pool=poolOrFail(res); if(!pool)return;
  try {
    const result=await pool.query(
      'SELECT s.*,COUNT(DISTINCT e.id)::int AS enrollment_count FROM communication_sequences s LEFT JOIN communication_sequence_enrollments e ON e.sequence_id=s.id WHERE s.organization_id=$1 GROUP BY s.id ORDER BY s.updated_at DESC',
      [org(req)],
    );
    res.json({sequences:result.rows});
  } catch(e:any) { res.status(500).json({error:e.message || 'Failed to load sequences'}); }
});

/**
 * Validate the name and steps, then create a new communication sequence.
 */
router.post('/sequences', requireRole(['admin','executive','manager']), async (req: AuthRequest,res) => {
  const pool=poolOrFail(res); if(!pool)return;
  const input=req.body || {};
  if(!input.name || !Array.isArray(input.steps) || !input.steps.length) return res.status(400).json({error:'name and at least one sequence step are required'});
  try { res.status(201).json({id:await createSequence(pool,org(req),req.dbUser!.id,input)}); }
  catch(e:any) { res.status(400).json({error:e.message || 'Failed to create sequence'}); }
});

/**
 * Enroll the given lead into a sequence, requiring a leadId in the request body.
 */
router.post('/sequences/:id/enroll', requireRole(['admin','executive','manager','agent']), async (req: AuthRequest,res) => {
  const pool=poolOrFail(res); if(!pool)return;
  if(!req.body?.leadId) return res.status(400).json({error:'leadId is required'});
  try { res.status(201).json({enrollmentId:await enrollSequence(pool,org(req),req.dbUser!.id,req.params.id,req.body.leadId)}); }
  catch(e:any) { res.status(400).json({error:e.message || 'Failed to enroll lead'}); }
});

/**
 * Record an open-tracking event for the token and respond with a 1x1 transparent pixel.
 */
router.get('/tracking/open/:token.gif', async (req,res) => {
  const pool=getPgPool();
  if(pool) await recordTrackingEvent(pool,req.params.token,'opened').catch(()=>undefined);
  const pixel=Buffer.from('R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==','base64');
  res.setHeader('Content-Type','image/gif'); res.setHeader('Cache-Control','no-store'); res.status(200).send(pixel);
});

/**
 * Suppress the email address associated with a tracking token and show a confirmation page.
 */
router.get('/tracking/unsubscribe/:token', async (req,res) => {
  const pool=getPgPool();
  if(!pool) return res.status(503).send('Communications unavailable');
  try {
    const message=await pool.query("SELECT organization_id,to_address FROM communication_messages WHERE tracking_token=$1 AND channel='email' LIMIT 1",[req.params.token]);
    if(!message.rowCount || !message.rows[0].to_address) return res.status(404).send('Invalid unsubscribe link');
    const token = encodeURIComponent(req.params.token);
    const action = '/api/communications/tracking/unsubscribe/' + token + '/confirm';
    res.status(200).send('<html><body style="font-family:system-ui;padding:40px"><h2>Unsubscribe</h2><p>Click the button below to stop further email outreach.</p><form method="POST" action="' + action + '"><button type="submit">Confirm unsubscribe</button></form></body></html>');
  } catch(e:any) { res.status(500).send('Unable to process unsubscribe request'); }
});

/**
 * Apply an email unsubscribe only after explicit recipient confirmation.
 */
router.post('/tracking/unsubscribe/:token/confirm', async (req,res) => {
  const pool=getPgPool();
  if(!pool) return res.status(503).send('Communications unavailable');
  try {
    const message=await pool.query("SELECT organization_id,to_address FROM communication_messages WHERE tracking_token=$1 AND channel='email' LIMIT 1",[req.params.token]);
    if(!message.rowCount || !message.rows[0].to_address) return res.status(404).send('Invalid unsubscribe link');
    await suppress(pool,message.rows[0].organization_id,'email',message.rows[0].to_address,'unsubscribe','email-link');
    res.status(200).send('<html><body style="font-family:system-ui;padding:40px"><h2>You have been unsubscribed.</h2><p>You will not receive further Vortex One email outreach at this address.</p></body></html>');
  } catch { res.status(500).send('Unable to process unsubscribe request'); }
});

/**
 * Record a click-tracking event for the token and redirect to the signed destination URL.
 */
router.get('/tracking/click/:token', async (req,res) => {
  const url=typeof req.query.url === 'string' ? req.query.url : '';
  const signature=typeof req.query.sig === 'string' ? req.query.sig : '';
  const pool=getPgPool();
  if(pool) {
    try {
      await recordTrackingEvent(pool,req.params.token,'clicked',url,signature);
      return res.redirect(url);
    } catch {
      return res.status(400).send('Invalid tracking link');
    }
  }
  return res.status(503).send('Communications unavailable');
});

/**
 * Handle an inbound Twilio SMS webhook, verifying its signature and acknowledging with empty TwiML.
 */
router.post('/webhooks/twilio/inbound', async (req,res) => {
  const pool=getPgPool(); if(!pool) return res.status(503).send('Communications unavailable');
  try {
    const callbackUrl = (process.env.APP_URL || (req.protocol + '://' + req.get('host'))).replace(/\/$/,'') + req.originalUrl;
    await handleTwilioInbound(pool,callbackUrl,req.body || {},req.get('X-Twilio-Signature') || undefined);
    res.type('text/xml').send('<Response></Response>');
  } catch(e:any) { res.status(403).type('text/xml').send('<Response><Message>Webhook rejected</Message></Response>'); }
});

/**
 * Handle a Twilio delivery status webhook, verifying its signature before updating the message.
 */
router.post('/webhooks/twilio/status', async (req,res) => {
  const pool=getPgPool(); if(!pool) return res.status(503).send('Communications unavailable');
  try {
    const callbackUrl = (process.env.APP_URL || (req.protocol + '://' + req.get('host'))).replace(/\/$/,'') + req.originalUrl;
    await handleTwilioStatus(pool,callbackUrl,req.body || {},req.get('X-Twilio-Signature') || undefined);
    res.status(204).send();
  } catch(e:any) { res.status(403).json({error:e.message || 'Webhook rejected'}); }
});

export default router;
