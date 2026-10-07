import crypto from 'node:crypto';
import { Pool } from 'pg';
import { NormalizedPropertyResult } from './propertyProviders/types';
import { requireOrganizationId } from './organizationContext';

const id = (prefix: string) => `${prefix}_${crypto.randomUUID().replace(/-/g, '')}`;

function normalizeOwnerName(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/[\\u0300-\\u036f]/g, '')
    .trim()
    .replace(/\\s+/g, ' ')
    .toLowerCase();
}

function normalizeAddress(value: unknown): string {
  return String(value ?? '')
    .normalize('NFKD')
    .replace(/[\\u0300-\\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

function tokenSimilarity(a: string, b: string): number {
  const left = normalizeOwnerName(a);
  const right = normalizeOwnerName(b);
  if (!left || !right) return 0;
  if (left === right) return 1;
  const leftTokens = new Set(left.split(' '));
  const rightTokens = new Set(right.split(' '));
  const intersection = [...leftTokens].filter((token) => rightTokens.has(token)).length;
  const union = new Set([...leftTokens, ...rightTokens]).size;
  return union ? intersection / union : 0;
}

function identityScore(source: {
  name: string;
  mailingAddress?: unknown;
  mailingCity?: unknown;
  mailingState?: unknown;
  mailingZip?: unknown;
}, candidate: {
  name: string;
  mailing_address?: unknown;
  mailing_city?: unknown;
  mailing_state?: unknown;
  mailing_zip?: unknown;
}): { score: number; evidence: Record<string, unknown> } {
  const nameScore = tokenSimilarity(source.name, candidate.name);
  const sourceAddress = normalizeAddress(source.mailingAddress);
  const candidateAddress = normalizeAddress(candidate.mailing_address);
  const addressExact = Boolean(sourceAddress && candidateAddress && sourceAddress === candidateAddress);
  const cityExact = normalizeOwnerName(String(source.mailingCity ?? '')) === normalizeOwnerName(String(candidate.mailing_city ?? ''));
  const stateExact = normalizeOwnerName(String(source.mailingState ?? '')) === normalizeOwnerName(String(candidate.mailing_state ?? ''));
  const zipExact = String(source.mailingZip ?? '').trim() !== '' &&
    String(source.mailingZip ?? '').trim() === String(candidate.mailing_zip ?? '').trim();

  let score = nameScore * 0.7;
  if (addressExact) score += 0.2;
  else if (cityExact && stateExact) score += 0.06;
  if (stateExact) score += 0.04;
  if (zipExact) score += 0.06;
  score = Math.min(1, score);

  return {
    score,
    evidence: { nameScore, addressExact, cityExact, stateExact, zipExact },
  };
}

export interface PublicRecordIngestionSummary {
  sourceRecords: number;
  ownerships: number;
  identityMatches: number;
  linkedOwners: number;
}

/**
 * Persists authoritative public-record provenance produced by county/GIS adapters.
 * It deliberately does not create an owner when the source has no lawful owner identity.
 */
export class PublicRecordsIngestionService {
  static async recordResults(
    pool: Pool,
    organizationId: string,
    results: NormalizedPropertyResult[],
    jobId?: string,
  ): Promise<PublicRecordIngestionSummary> {
    const orgId = requireOrganizationId(organizationId);
    const summary: PublicRecordIngestionSummary = {
      sourceRecords: 0,
      ownerships: 0,
      identityMatches: 0,
      linkedOwners: 0,
    };

    for (const result of results) {
      const propertyId = result.property.id;
      const sourcePayload = {
        provider: result.provenance.provider,
        datasetName: result.provenance.datasetName,
        endpointUrl: result.provenance.endpointUrl,
        queryFilter: result.provenance.queryFilter,
        recordIdentifier: result.provenance.recordIdentifier,
        fipsCode: result.provenance.fipsCode,
        officialGovernmentSource: result.provenance.isOfficialGovernmentSource,
        rawAttributes: result.rawAttributes || {},
      };
      const rawHash = crypto.createHash('sha256').update(JSON.stringify(sourcePayload)).digest('hex');
      let sourceId = id('src');

      const sourceInsert = await pool.query(
        `INSERT INTO owner_source_records
          (id, organization_id, owner_id, property_id, enrichment_job_id, source_type, provider_key,
           external_record_id, source_url, raw_payload, raw_hash, retrieved_at)
         VALUES ($1,$2,$3,$4,$5,'public_records',$6,$7,$8,$9::jsonb,$10,$11)
         ON CONFLICT (organization_id, provider_key, raw_hash)
         DO UPDATE SET retrieved_at=EXCLUDED.retrieved_at, raw_payload=EXCLUDED.raw_payload
         RETURNING id`,
        [
          sourceId,
          orgId,
          result.property.owner_id || null,
          propertyId,
          jobId || null,
          result.provenance.provider,
          result.provenance.recordIdentifier ? String(result.provenance.recordIdentifier) : null,
          result.provenance.endpointUrl || null,
          JSON.stringify(sourcePayload),
          rawHash,
          result.provenance.retrievedAt || new Date().toISOString(),
        ],
      );
      sourceId = sourceInsert.rows[0]?.id || sourceId;
      summary.sourceRecords += 1;

      const ownerName = result.owner?.name?.trim();
      if (!ownerName) continue;

      let ownerId = result.owner?.id || '';
      const existingOwner = await pool.query(
        `SELECT id, name
           FROM property_owners
          WHERE organization_id=$1
            AND (id=$2 OR LOWER(TRIM(name))=LOWER(TRIM($3)))
          ORDER BY CASE WHEN id=$2 THEN 0 ELSE 1 END
          LIMIT 1`,
        [orgId, ownerId || '__none__', ownerName],
      );

      if (existingOwner.rows[0]) {
        ownerId = existingOwner.rows[0].id;
        summary.linkedOwners += 1;
      }

      if (!ownerId) continue;

      const explicitRelationships = [
        ...(Array.isArray((result.rawAttributes as any)?.relatedOwners) ? (result.rawAttributes as any).relatedOwners : []),
        ...(Array.isArray((result.rawAttributes as any)?.relatedEntities) ? (result.rawAttributes as any).relatedEntities : []),
      ];
      for (const relationship of explicitRelationships) {
        if (!relationship?.name || !relationship?.relationshipType) continue;
        await pool.query(
          `INSERT INTO owner_relationships
            (id, organization_id, owner_id, related_entity_type, related_entity_id, related_name, relationship_type, confidence_score, source_record_id)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
           ON CONFLICT (organization_id, owner_id, related_entity_type, related_name, relationship_type)
           DO UPDATE SET confidence_score=EXCLUDED.confidence_score, source_record_id=EXCLUDED.source_record_id`,
          [
            id('rel'),
            orgId,
            ownerId,
            String(relationship.entityType || 'entity'),
            relationship.id || null,
            String(relationship.name),
            String(relationship.relationshipType),
            Number(relationship.confidence ?? 0.75),
            sourceId,
          ],
        );
      }

      const candidateOwners = await pool.query(
        `SELECT id, name
           FROM property_owners
          WHERE organization_id=$1
            AND name IS NOT NULL
            AND TRIM(name) <> ''
          LIMIT 250`,
        [orgId],
      );
      const sourceIdentity = {
        name: ownerName,
        mailingAddress: (result.owner as any)?.mailing_address ?? (result.rawAttributes as any)?.mailing_address,
        mailingCity: (result.owner as any)?.mailing_city ?? (result.rawAttributes as any)?.mailing_city,
        mailingState: (result.owner as any)?.mailing_state ?? (result.rawAttributes as any)?.mailing_state,
        mailingZip: (result.owner as any)?.mailing_zip ?? (result.rawAttributes as any)?.mailing_zip,
      };
      const rankedCandidates = candidateOwners.rows
        .map((row) => ({ ...row, ...identityScore(sourceIdentity, row) }))
        .filter((row) => row.id !== ownerId && row.score >= 0.82)
        .sort((a, b) => b.score - a.score);
      const best = rankedCandidates[0];
      const runnerUp = rankedCandidates[1];

      // Only persist a candidate when there is a meaningful margin over the next match.
      // This prevents common names from becoming misleading identity links.
      if (best && (!runnerUp || best.score - runnerUp.score >= 0.05)) {
        await pool.query(
          `INSERT INTO owner_identity_matches
            (id, organization_id, owner_id, candidate_owner_id, candidate_name, match_score, match_status, evidence, source_record_id)
           VALUES ($1,$2,$3,$4,$5,$6,'candidate',$7::jsonb,$8)`,
          [
            id('match'),
            orgId,
            ownerId,
            best.id,
            String(best.name),
            best.score,
            JSON.stringify({
              sourceOwnerName: ownerName,
              candidateOwnerId: best.id,
              provider: result.provenance.provider,
              recordIdentifier: result.provenance.recordIdentifier,
              ...best.evidence,
              runnerUpScore: runnerUp?.score ?? null,
            }),
            sourceId,
          ],
        );
        summary.identityMatches += 1;
      }

      await pool.query(
        `INSERT INTO owner_ownerships
          (id, organization_id, owner_id, property_id, ownership_type, ownership_percentage,
           recorded_date, confidence_score, source_record_id)
         VALUES ($1,$2,$3,$4,'record_owner',100,CURRENT_DATE,$5,$6)
         ON CONFLICT (organization_id, owner_id, property_id, ownership_type)
         DO UPDATE SET confidence_score=EXCLUDED.confidence_score,
                       recorded_date=EXCLUDED.recorded_date,
                       source_record_id=EXCLUDED.source_record_id`,
        [id('own'), orgId, ownerId, propertyId, result.provenance.isOfficialGovernmentSource ? 0.99 : 0.9, sourceId],
      );
      summary.ownerships += 1;
    }

    return summary;
  }
}
