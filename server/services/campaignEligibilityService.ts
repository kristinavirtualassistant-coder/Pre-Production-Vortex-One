import { requireOrganizationId } from './organizationContext';

export interface CampaignEligibilityQuery {
  retryLimit?: number;
}

export interface BuiltCampaignEligibilityQuery {
  text: string;
  values: unknown[];
}

export function buildCampaignEligibilityQuery(
  organizationId: string,
  campaignId: string,
  options: CampaignEligibilityQuery = {},
): BuiltCampaignEligibilityQuery {
  const orgId = requireOrganizationId(organizationId);
  if (!campaignId.trim()) throw new Error('Campaign ID is required');
  const retryLimit = Math.max(1, Math.floor(options.retryLimit ?? 3));
  return {
    text: `
      WITH candidate AS (
        SELECT cc.id
        FROM campaign_contact cc
        JOIN campaign c ON c.id = cc.campaign_id AND c.organization_id = cc.organization_id
        LEFT JOIN leads l ON l.id = cc.lead_id AND l.organization_id = cc.organization_id
        WHERE cc.organization_id = $1
          AND cc.campaign_id = $2
          AND cc.dial_status = 'queued'
          AND cc.attempts < $3
          AND c.status = 'active'
          AND NOT EXISTS (
            SELECT 1 FROM suppression_record sr
            WHERE sr.organization_id = cc.organization_id
              AND sr.phone_number = cc.phone_number
              AND (sr.expires_at IS NULL OR sr.expires_at > CURRENT_TIMESTAMP)
          )
          AND (l.dnc_compliant IS NULL OR l.dnc_compliant = TRUE)
        ORDER BY COALESCE(l.lead_score, 0) DESC, cc.priority DESC, cc.created_at ASC
        FOR UPDATE SKIP LOCKED
        LIMIT 1
      )
      UPDATE campaign_contact cc
      SET dial_status = 'dialing', attempts = attempts + 1, last_dialed_at = CURRENT_TIMESTAMP
      FROM candidate
      WHERE cc.id = candidate.id
      RETURNING cc.*
    `,
    values: [orgId, campaignId, retryLimit],
  };
}
