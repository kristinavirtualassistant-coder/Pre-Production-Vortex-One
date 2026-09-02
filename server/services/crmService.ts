import type { Pool } from 'pg';
import { requireOrganizationId } from './organizationContext';

export interface CanonicalLeadInput {
  organizationId: string;
  ownerId: string;
  propertyId: string;
  ownerName: string;
  propertyAddress: string;
  phoneNumber?: string;
  email?: string;
}

export async function upsertCanonicalLead(pool: Pool, input: CanonicalLeadInput): Promise<{ leadId: string; created: boolean }> {
  const organizationId = requireOrganizationId(input.organizationId);
  const existing = await pool.query(
    `SELECT id FROM leads WHERE organization_id = $1 AND owner_id = $2 AND primary_property_id = $3 LIMIT 1`,
    [organizationId, input.ownerId, input.propertyId],
  );
  if (existing.rows.length) return { leadId: existing.rows[0].id, created: false };
  const leadId = `lead_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  await pool.query(
    `INSERT INTO leads (id, organization_id, owner_id, primary_property_id, lead_score, classification, factors, stage, assigned_agent, dnc_compliant, last_activity_date, next_recommended_action, created_at, updated_at)\n     VALUES ($1,$2,$3,$4,0,'nurture','[]'::jsonb,'identified','agent_1',TRUE,CURRENT_TIMESTAMP,'enrich_and_review',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)`,
    [leadId, organizationId, input.ownerId, input.propertyId],
  );
  return { leadId, created: true };
}
