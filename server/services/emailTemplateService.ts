import type { Pool } from 'pg';

export const DEFAULT_EMAIL_TEMPLATE = {
  id: 'tpl_email_absentee_01',
  name: 'Absentee Landlord Multi-Family Management Proposal',
  category: 'absentee_owner',
  subject: 'Management & Rent Roll Optimization for {{property_address}}, {{property_city}}',
  body: `Dear {{owner_name}},

I noticed your {{units_count}}-unit multi-family asset located at {{property_address}} in {{property_city}}. As an out-of-area property owner, managing tenant turnovers, maintenance dispatches, and local municipal compliance from a distance can be demanding.

At {{company_name}}, we specialize in turnkey property management and owner support. We can provide a focused review of your current operating costs, leasing position, and local market comparables.

Would you be open to a brief 10-minute call this week to review the latest information for {{property_address}}?

Best regards,
{{agent_name}}
{{company_name}}
Direct: {{agent_phone}}
Email: {{agent_email}}`,
  variables: ['owner_name','units_count','property_address','property_city','company_name','agent_name','agent_phone','agent_email'],
  tags: ['Absentee','Multi-Family','Owner Outreach'],
};

export async function ensureDefaultEmailTemplate(pool: Pool, organizationId: string): Promise<void> {
  await pool.query(
    `INSERT INTO outreach_templates
      (id, organization_id, name, description, channel, category, subject, body, variables, tags, is_default, version, created_by)
     VALUES ($1,$2,$3,$4,'email',$5,$6,$7,$8::jsonb,$9::jsonb,true,1,'system')
     ON CONFLICT (id) DO UPDATE SET
       organization_id = EXCLUDED.organization_id,
       channel = EXCLUDED.channel
     WHERE outreach_templates.organization_id = EXCLUDED.organization_id`,
    [
      DEFAULT_EMAIL_TEMPLATE.id,
      organizationId,
      DEFAULT_EMAIL_TEMPLATE.name,
      'Default production email outreach template.',
      DEFAULT_EMAIL_TEMPLATE.category,
      DEFAULT_EMAIL_TEMPLATE.subject,
      DEFAULT_EMAIL_TEMPLATE.body,
      JSON.stringify(DEFAULT_EMAIL_TEMPLATE.variables),
      JSON.stringify(DEFAULT_EMAIL_TEMPLATE.tags),
    ],
  );
}
