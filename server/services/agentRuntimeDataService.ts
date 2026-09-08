import type { Pool } from 'pg';
import { requireOrganizationId } from './organizationContext';
import type { LeadRecord, PropertyOwner } from '../../src/types';

export interface OwnerSearchQuery {
  name?: string;
  entityType?: string;
  minProperties?: number;
  limit?: number;
}

export interface LeadScoreResult {
  lead_score: number;
  classification: 'high_priority' | 'medium_priority' | 'nurture';
  factors: Array<{ factor: string; impact: number; description: string }>;
  calculated_at: string;
}

export async function searchOwners(pool: Pool, organizationId: string, query: OwnerSearchQuery = {}): Promise<PropertyOwner[]> {
  const orgId = requireOrganizationId(organizationId);
  const values: unknown[] = [orgId];
  const conditions = ['o.organization_id = $1'];
  if (query.name?.trim()) {
    values.push(`%${query.name.trim()}%`);
    conditions.push(`o.name ILIKE $${values.length}`);
  }
  if (query.entityType?.trim()) {
    values.push(query.entityType.trim());
    conditions.push(`o.entity_type = $${values.length}`);
  }
  if (query.minProperties !== undefined) {
    values.push(query.minProperties);
    conditions.push(`o.properties_owned_count >= $${values.length}`);
  }
  const limit = Math.min(200, Math.max(1, Math.floor(query.limit ?? 50)));
  values.push(limit);
  const { rows } = await pool.query(`
    SELECT o.id, o.organization_id, o.name, o.entity_type, o.mailing_address,
      o.mailing_city, o.mailing_state, o.mailing_zip, o.phone_numbers,
      o.email_addresses, o.properties_owned_count, o.total_portfolio_value,
      o.total_portfolio_equity, o.notes
    FROM property_owners o
    WHERE ${conditions.join(' AND ')}
    ORDER BY o.properties_owned_count DESC, o.name ASC
    LIMIT $${values.length}
  `, values);
  return rows.map((row: any) => ({
    id: row.id,
    organization_id: row.organization_id,
    name: row.name,
    entity_type: row.entity_type,
    mailing_address: row.mailing_address || '',
    mailing_city: row.mailing_city || '',
    mailing_state: row.mailing_state || '',
    mailing_zip: row.mailing_zip || '',
    phone_numbers: row.phone_numbers || [],
    email_addresses: row.email_addresses || [],
    properties_owned_count: Number(row.properties_owned_count || 0),
    total_portfolio_value: Number(row.total_portfolio_value || 0),
    total_portfolio_equity: Number(row.total_portfolio_equity || 0),
    notes: row.notes || undefined,
  } as PropertyOwner));
}

export async function getLeadScoringInputs(pool: Pool, organizationId: string, ownerId: string, propertyId: string) {
  const orgId = requireOrganizationId(organizationId);
  const { rows } = await pool.query(`
    SELECT
      o.id AS owner_id, o.name AS owner_name, o.properties_owned_count,
      p.id AS property_id, p.address, p.estimated_equity, p.is_absentee_owner
    FROM properties p
    LEFT JOIN property_owners o
      ON o.id = p.owner_id AND o.organization_id = p.organization_id
    WHERE p.organization_id = $1 AND p.id = $2 AND ($3::text IS NULL OR p.owner_id = $3)
    LIMIT 1
  `, [orgId, propertyId, ownerId || null]);
  return rows[0] || null;
}

export async function scoreLead(pool: Pool, organizationId: string, ownerId: string, propertyId: string): Promise<LeadScoreResult | { error: string }> {
  const row = await getLeadScoringInputs(pool, organizationId, ownerId, propertyId);
  if (!row) return { error: 'Owner or property record not found' };

  const factors: LeadScoreResult['factors'] = [];
  let score = 50;
  if (Number(row.properties_owned_count || 0) > 1) {
    const impact = Math.min(25, Number(row.properties_owned_count) * 8);
    score += impact;
    factors.push({ factor: 'multiple_owned_properties', impact, description: `Owns ${row.properties_owned_count} properties in regional portfolio` });
  }
  if (row.is_absentee_owner) {
    score += 20;
    factors.push({ factor: 'absentee_owner', impact: 20, description: 'Owner mailing address is located off-site from the rental asset' });
  }
  if (Number(row.estimated_equity || 0) > 1000000) {
    score += 15;
    factors.push({ factor: 'high_equity_position', impact: 15, description: `Estimated property equity of $${(Number(row.estimated_equity) / 1000000).toFixed(2)}M` });
  }
  score = Math.min(100, score);
  return {
    lead_score: score,
    classification: score >= 80 ? 'high_priority' : score >= 60 ? 'medium_priority' : 'nurture',
    factors,
    calculated_at: new Date().toISOString(),
  };
}

export async function updateLeadRecommendation(pool: Pool, organizationId: string, leadId: string, title: string): Promise<LeadRecord | null> {
  const orgId = requireOrganizationId(organizationId);
  const { rows } = await pool.query(`
    UPDATE leads
    SET next_recommended_action = $1, last_activity_date = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
    WHERE id = $2 AND organization_id = $3
    RETURNING id, organization_id, owner_id, primary_property_id, lead_score, classification,
      factors, stage, assigned_agent, dnc_compliant, last_activity_date,
      next_recommended_action, created_at, updated_at
  `, [title, leadId, orgId]);
  if (!rows.length) return null;
  const row = rows[0];
  const { rows: detail } = await pool.query(`
    SELECT l.*, o.name AS owner_name, p.address AS property_address,
      p.estimated_equity, p.estimated_value, p.units_count, p.property_type, p.city
    FROM leads l
    LEFT JOIN property_owners o ON o.id = l.owner_id AND o.organization_id = l.organization_id
    LEFT JOIN properties p ON p.id = l.primary_property_id AND p.organization_id = l.organization_id
    WHERE l.id = $1 AND l.organization_id = $2
  `, [leadId, orgId]);
  const full = detail[0] || row;
  return {
    id: full.id,
    organization_id: full.organization_id,
    owner_id: full.owner_id,
    primary_property_id: full.primary_property_id,
    property_id: full.primary_property_id,
    owner_name: full.owner_name || '',
    property_address: full.property_address || '',
    lead_score: Number(full.lead_score || 0),
    classification: full.classification,
    priority_tier: full.classification,
    factors: full.factors || [],
    stage: full.stage,
    assigned_agent: full.assigned_agent,
    dnc_compliant: full.dnc_compliant,
    last_activity_date: new Date(full.last_activity_date).toISOString(),
    next_recommended_action: full.next_recommended_action || '',
    created_at: new Date(full.created_at).toISOString(),
    updated_at: full.updated_at ? new Date(full.updated_at).toISOString() : undefined,
    estimated_equity: Number(full.estimated_equity || 0),
    estimated_value: Number(full.estimated_value || 0),
    units_count: Number(full.units_count || 0),
    property_type: full.property_type || undefined,
    city: full.city || undefined,
  } as LeadRecord;
}

export async function getAgentAnalytics(pool: Pool, organizationId: string) {
  const orgId = requireOrganizationId(organizationId);
  const [property, lead, campaign] = await Promise.all([
    pool.query(`SELECT COALESCE(SUM(estimated_value),0) AS valuation, COALESCE(SUM(estimated_equity),0) AS equity FROM properties WHERE organization_id = $1`, [orgId]),
    pool.query(`SELECT COUNT(*)::int AS active, COUNT(*) FILTER (WHERE classification = 'high_priority')::int AS high_priority FROM leads WHERE organization_id = $1`, [orgId]),
    pool.query(`SELECT COALESCE(SUM(converted_count),0)::int AS converted, COALESCE(SUM(connected_count),0)::int AS connected FROM campaign WHERE organization_id = $1`, [orgId]),
  ]);
  const valuation = Number(property.rows[0].valuation || 0);
  const equity = Number(property.rows[0].equity || 0);
  const converted = Number(campaign.rows[0].converted || 0);
  const connected = Number(campaign.rows[0].connected || 0);
  return {
    total_portfolio_valuation: valuation,
    total_portfolio_equity: equity,
    average_equity_ratio_pct: Math.round((equity / (valuation || 1)) * 100),
    active_leads_count: Number(lead.rows[0].active || 0),
    high_priority_leads_count: Number(lead.rows[0].high_priority || 0),
    campaign_conversion_rate_pct: Math.round((converted / (connected || 1)) * 100),
  };
}
