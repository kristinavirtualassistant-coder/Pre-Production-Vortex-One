import { randomUUID } from 'node:crypto';
import type { Pool } from 'pg';
import { enqueueJob } from './jobService';
import { requireOrganizationId } from './organizationContext';
import { ensureDefaultEmailTemplate } from './emailTemplateService';

export const EMAIL_JOB_TYPE = 'email_outreach.send';
const DEFAULT_TEMPLATE_ID = 'tpl_email_absentee_01';

export interface QueueEmailOutreachResult {
  status: 'queued' | 'existing';
  outreachId: string;
  jobId: string | null;
}

export function renderTemplate(text: string, context: Record<string, string | number | undefined>): string {
  return text.replace(/{{\\s*([a-zA-Z0-9_]+)\\s*}}/g, (match, key: string) => {
    const value = context[key];
    return value === undefined || value === null ? match : String(value);
  });
}

export async function queueEmailOutreach(
  pool: Pool,
  organizationId: string,
  leadId: string,
  userId: string,
  templateId = DEFAULT_TEMPLATE_ID,
): Promise<QueueEmailOutreachResult> {
  const orgId = requireOrganizationId(organizationId);
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const lead = await client.query(
      `SELECT l.id, l.organization_id, l.owner_id, l.primary_property_id,
              o.name AS owner_name, o.email_addresses,
              p.address AS property_address, p.city AS property_city, p.state AS property_state,
              p.zip AS property_zip, p.county AS property_county, p.property_type,
              p.units_count, p.estimated_value, p.estimated_equity, p.assessed_tax_value, p.apn,
              l.lead_score, l.classification
       FROM leads l
       LEFT JOIN property_owners o ON o.id = l.owner_id AND o.organization_id = l.organization_id
       LEFT JOIN properties p ON p.id = l.primary_property_id AND p.organization_id = l.organization_id
       WHERE l.id = $1 AND l.organization_id = $2
       FOR SHARE`,
      [leadId, orgId],
    );
    if (!lead.rowCount) {
      await client.query('ROLLBACK');
      throw new Error('Lead not found');
    }

    const leadRow = lead.rows[0];
    const emails = Array.isArray(leadRow.email_addresses) ? leadRow.email_addresses : [];
    const recipient = (emails.find((e: any) => typeof e?.email === 'string' && /@/.test(e.email))?.email || '').trim().toLowerCase();
    if (!/^\\S+@\\S+\\.\\S+$/.test(recipient)) {
      await client.query('ROLLBACK');
      throw new Error('Lead does not have a valid email address');
    }

    await ensureDefaultEmailTemplate(pool, orgId);

    const template = await client.query(
      `SELECT id, name, subject, body, version
       FROM outreach_templates
       WHERE id = COALESCE(
         (SELECT id FROM outreach_templates WHERE id = $1 AND organization_id = $2 AND channel = 'email'),
         (SELECT id FROM outreach_templates
          WHERE organization_id = $2 AND id = $3 AND channel = 'email')
       )`,
      [templateId, orgId, DEFAULT_TEMPLATE_ID],
    );
    if (!template.rowCount) {
      await client.query('ROLLBACK');
      throw new Error('Email outreach template not found');
    }

    const tpl = template.rows[0];
    const context = {
      owner_name: leadRow.owner_name || 'Property Owner',
      first_name: (leadRow.owner_name || 'Property Owner').split(' ')[0],
      property_address: leadRow.property_address || '',
      property_city: leadRow.property_city || '',
      property_state: leadRow.property_state || '',
      property_zip: leadRow.property_zip || '',
      property_county: leadRow.property_county || '',
      property_type: leadRow.property_type || '',
      units_count: leadRow.units_count ?? '',
      estimated_value: leadRow.estimated_value ?? 0,
      estimated_equity: leadRow.estimated_equity ?? 0,
      assessed_tax_value: leadRow.assessed_tax_value ?? 0,
      apn: leadRow.apn || '',
      lead_score: leadRow.lead_score ?? 0,
      lead_classification: leadRow.classification || '',
      company_name: process.env.OUTREACH_COMPANY_NAME || 'Vortex One',
      agent_name: process.env.OUTREACH_AGENT_NAME || 'Vortex One Outreach',
      agent_phone: process.env.OUTREACH_AGENT_PHONE || '',
      agent_email: process.env.OUTREACH_AGENT_EMAIL || process.env.SMTP_FROM || '',
    };

    const subject = renderTemplate(tpl.subject, context);
    const body = renderTemplate(tpl.body, context);
    const idempotencyKey = `qualified-email-v1:${leadId}`;

    const existing = await client.query(
      `SELECT id, status, job_id FROM email_outreach
       WHERE organization_id = $1 AND idempotency_key = $2
       FOR UPDATE`,
      [orgId, idempotencyKey],
    );
    if (existing.rowCount) {
      await client.query('COMMIT');
      return { status: 'existing', outreachId: existing.rows[0].id, jobId: existing.rows[0].job_id || null };
    }

    const outreachId = `email_${randomUUID()}`;
    await client.query(
      `INSERT INTO email_outreach
       (id, organization_id, lead_id, template_id, idempotency_key, recipient_email,
        subject, body, status, attempts, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'queued',0,$9)`,
      [outreachId, orgId, leadId, tpl.id, idempotencyKey, recipient, subject, body, userId],
    );

    const jobId = await enqueueJob(pool, orgId, EMAIL_JOB_TYPE, { outreachId, leadId }, 3);
    await client.query(
      'UPDATE email_outreach SET job_id = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 AND organization_id = $3',
      [jobId, outreachId, orgId],
    );
    await client.query('COMMIT');

    return { status: 'queued', outreachId, jobId };
  } catch (error) {
    try { await client.query('ROLLBACK'); } catch {}
    throw error;
  } finally {
    client.release();
  }
}
