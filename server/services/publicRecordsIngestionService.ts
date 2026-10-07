import crypto from 'node:crypto';
import { Pool } from 'pg';
import { NormalizedPropertyResult } from './propertyProviders/types';
import { requireOrganizationId } from './organizationContext';

const id = (prefix: string) => `${prefix}_${crypto.randomUUID().replace(/-/g, '')}`;

function normalizeOwnerName(value: string): string {
  return value.trim().replace(/\\s+/g, ' ').toLowerCase();
}

function similarity(a: string, b: string): number {
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
      const sourceId = id('src');

      await pool.query(
        `INSERT INTO owner_source_records
          (id, organization_id, owner_id, property_id, enrichment_job_id, source_type, provider_key,
           external_record_id, source_url, raw_payload, raw_hash, retrieved_at)
         VALUES ($1,$2,$3,$4,$5,'public_records',$6,$7,$8,$9::jsonb,$10,$11)
         ON CONFLICT DO NOTHING`,
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

      const candidateOwners = await pool.query(
        `SELECT id, name
           FROM property_owners
          WHERE organization_id=$1
            AND name IS NOT NULL
            AND TRIM(name) <> ''
          LIMIT 250`,
        [orgId],
      );
      const best = candidateOwners.rows
        .map((row) => ({ ...row, score: similarity(ownerName, String(row.name)) }))
        .filter((row) => row.score >= 0.75)
        .sort((a, b) => b.score - a.score)[0];

      if (best && best.id !== ownerId) {
        await pool.query(
          `INSERT INTO owner_identity_matches
            (id, organization_id, owner_id, candidate_name, match_score, match_status, evidence, source_record_id)
           VALUES ($1,$2,$3,$4,$5,'candidate',$6::jsonb,$7)`,
          [
            id('match'),
            orgId,
            ownerId,
            String(best.name),
            best.score,
            JSON.stringify({
              sourceOwnerName: ownerName,
              candidateOwnerId: best.id,
              provider: result.provenance.provider,
              recordIdentifier: result.provenance.recordIdentifier,
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
