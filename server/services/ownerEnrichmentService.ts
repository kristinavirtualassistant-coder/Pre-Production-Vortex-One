import crypto from 'node:crypto';
import { Pool } from 'pg';
import { getPgPool } from '../db/db';
import { requireOrganizationId } from './organizationContext';
import { recordCostEvent } from './analyticsService';

export type EnrichmentCapability =
  | 'OWNER_IDENTITY'
  | 'PHONE'
  | 'EMAIL'
  | 'ADDRESS'
  | 'PORTFOLIO'
  | 'ENTITY'
  | 'RELATIONSHIPS'
  | 'PUBLIC_RECORDS';

export interface OwnerEnrichmentRequest {
  organizationId: string;
  ownerId: string;
  propertyId?: string;
  provider?: string;
  capabilities?: EnrichmentCapability[];
  supplied?: {
    phones?: Array<Record<string, unknown>>;
    emails?: Array<Record<string, unknown>>;
    addresses?: Array<Record<string, unknown>>;
    entities?: Array<Record<string, unknown>>;
    relationships?: Array<Record<string, unknown>>;
  };
}

export interface OwnerEnrichmentProvider {
  name: string;
  capabilities: EnrichmentCapability[];
  enrich(pool: Pool, request: OwnerEnrichmentRequest): Promise<ProviderResult>;
}

interface ProviderResult {
  status: 'completed' | 'partial' | 'no_match' | 'unavailable';
  records: Array<Record<string, unknown>>;
  contacts: {
    phones: Array<Record<string, unknown>>;
    emails: Array<Record<string, unknown>>;
    addresses: Array<Record<string, unknown>>;
  };
  entities: Array<Record<string, unknown>>;
  relationships: Array<Record<string, unknown>>;
  signals: Array<Record<string, unknown>>;
  source: Record<string, unknown>;
  reason?: string;
}

const now = () => new Date().toISOString();
const id = (prefix: string) => `${prefix}_${crypto.randomUUID().replace(/-/g, '')}`;
const hash = (value: unknown) => crypto.createHash('sha256').update(JSON.stringify(value ?? null)).digest('hex');

function normalizePhone(value: unknown): string {
  return String(value ?? '').replace(/[^0-9+]/g, '');
}

function normalizeEmail(value: unknown): string {
  return String(value ?? '').trim().toLowerCase();
}

function jsonArray(value: unknown): any[] {
  return Array.isArray(value) ? value : [];
}

async function ensureSchema(pool: Pool): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS owner_enrichment_providers (
      id VARCHAR(64) PRIMARY KEY,
      organization_id VARCHAR(64) NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
      provider_key VARCHAR(100) NOT NULL,
      display_name VARCHAR(255) NOT NULL,
      enabled BOOLEAN NOT NULL DEFAULT true,
      priority INTEGER NOT NULL DEFAULT 100,
      capabilities JSONB NOT NULL DEFAULT '[]'::jsonb,
      created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(organization_id, provider_key)
    );
    CREATE TABLE IF NOT EXISTS owner_enrichment_jobs (
      id VARCHAR(64) PRIMARY KEY,
      organization_id VARCHAR(64) NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
      owner_id VARCHAR(64) NOT NULL REFERENCES property_owners(id) ON DELETE CASCADE,
      property_id VARCHAR(64) REFERENCES properties(id) ON DELETE SET NULL,
      provider_key VARCHAR(100),
      job_type VARCHAR(50) NOT NULL DEFAULT 'FULL_ENRICHMENT',
      status VARCHAR(30) NOT NULL DEFAULT 'queued',
      requested_capabilities JSONB NOT NULL DEFAULT '[]'::jsonb,
      records_found INTEGER NOT NULL DEFAULT 0,
      records_added INTEGER NOT NULL DEFAULT 0,
      records_updated INTEGER NOT NULL DEFAULT 0,
      error_message TEXT,
      started_at TIMESTAMPTZ,
      completed_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_owner_enrichment_jobs_org_owner
      ON owner_enrichment_jobs(organization_id, owner_id, created_at DESC);

    CREATE TABLE IF NOT EXISTS owner_source_records (
      id VARCHAR(64) PRIMARY KEY,
      organization_id VARCHAR(64) NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
      owner_id VARCHAR(64) REFERENCES property_owners(id) ON DELETE CASCADE,
      property_id VARCHAR(64) REFERENCES properties(id) ON DELETE SET NULL,
      enrichment_job_id VARCHAR(64) REFERENCES owner_enrichment_jobs(id) ON DELETE SET NULL,
      source_type VARCHAR(100) NOT NULL,
      provider_key VARCHAR(100),
      external_record_id VARCHAR(255),
      source_url TEXT,
      raw_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
      raw_hash VARCHAR(64) NOT NULL,
      retrieved_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
      created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_owner_source_records_org_owner
      ON owner_source_records(organization_id, owner_id, retrieved_at DESC);
    CREATE UNIQUE INDEX IF NOT EXISTS uq_owner_source_records_org_provider_hash
      ON owner_source_records(organization_id, provider_key, raw_hash);

    CREATE TABLE IF NOT EXISTS owner_contact_points (
      id VARCHAR(64) PRIMARY KEY,
      organization_id VARCHAR(64) NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
      owner_id VARCHAR(64) NOT NULL REFERENCES property_owners(id) ON DELETE CASCADE,
      type VARCHAR(20) NOT NULL,
      value TEXT NOT NULL,
      normalized_value TEXT NOT NULL,
      contact_subtype VARCHAR(30),
      is_primary BOOLEAN NOT NULL DEFAULT false,
      is_verified BOOLEAN NOT NULL DEFAULT false,
      confidence_score NUMERIC(5,4),
      source_record_id VARCHAR(64) REFERENCES owner_source_records(id) ON DELETE SET NULL,
      first_seen_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
      last_seen_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(organization_id, owner_id, type, normalized_value)
    );
    CREATE INDEX IF NOT EXISTS idx_owner_contact_points_org_owner
      ON owner_contact_points(organization_id, owner_id, type);

    CREATE TABLE IF NOT EXISTS owner_ownerships (
      id VARCHAR(64) PRIMARY KEY,
      organization_id VARCHAR(64) NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
      owner_id VARCHAR(64) NOT NULL REFERENCES property_owners(id) ON DELETE CASCADE,
      property_id VARCHAR(64) NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
      ownership_type VARCHAR(50) NOT NULL DEFAULT 'record_owner',
      ownership_percentage NUMERIC(7,4),
      start_date DATE,
      end_date DATE,
      recorded_date DATE,
      source_record_id VARCHAR(64) REFERENCES owner_source_records(id) ON DELETE SET NULL,
      confidence_score NUMERIC(5,4) NOT NULL DEFAULT 1,
      UNIQUE(organization_id, owner_id, property_id, ownership_type)
    );
    CREATE INDEX IF NOT EXISTS idx_owner_ownerships_org_owner
      ON owner_ownerships(organization_id, owner_id);

    CREATE TABLE IF NOT EXISTS owner_relationships (
      id VARCHAR(64) PRIMARY KEY,
      organization_id VARCHAR(64) NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
      owner_id VARCHAR(64) NOT NULL REFERENCES property_owners(id) ON DELETE CASCADE,
      related_entity_type VARCHAR(50) NOT NULL,
      related_entity_id VARCHAR(64),
      related_name VARCHAR(255) NOT NULL,
      relationship_type VARCHAR(50) NOT NULL,
      confidence_score NUMERIC(5,4) NOT NULL DEFAULT 0.5,
      source_record_id VARCHAR(64) REFERENCES owner_source_records(id) ON DELETE SET NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(organization_id, owner_id, related_entity_type, related_name, relationship_type)
    );

    CREATE TABLE IF NOT EXISTS owner_lead_signals (
      id VARCHAR(64) PRIMARY KEY,
      organization_id VARCHAR(64) NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
      owner_id VARCHAR(64) NOT NULL REFERENCES property_owners(id) ON DELETE CASCADE,
      property_id VARCHAR(64) REFERENCES properties(id) ON DELETE CASCADE,
      signal_type VARCHAR(80) NOT NULL,
      signal_value JSONB NOT NULL DEFAULT '{}'::jsonb,
      score NUMERIC(6,2) NOT NULL DEFAULT 0,
      confidence_score NUMERIC(5,4) NOT NULL DEFAULT 0.5,
      source_record_id VARCHAR(64) REFERENCES owner_source_records(id) ON DELETE SET NULL,
      observed_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
      expires_at TIMESTAMPTZ
    );
    CREATE UNIQUE INDEX IF NOT EXISTS uq_owner_lead_signals_property
      ON owner_lead_signals(organization_id, owner_id, property_id, signal_type)
      WHERE property_id IS NOT NULL;
    CREATE UNIQUE INDEX IF NOT EXISTS uq_owner_lead_signals_portfolio
      ON owner_lead_signals(organization_id, owner_id, signal_type)
      WHERE property_id IS NULL;
    CREATE INDEX IF NOT EXISTS idx_owner_lead_signals_org_owner
      ON owner_lead_signals(organization_id, owner_id, score DESC);

    CREATE TABLE IF NOT EXISTS owner_identity_matches (
      id VARCHAR(64) PRIMARY KEY,
      organization_id VARCHAR(64) NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
      owner_id VARCHAR(64) NOT NULL REFERENCES property_owners(id) ON DELETE CASCADE,
      candidate_owner_id VARCHAR(64) REFERENCES property_owners(id) ON DELETE SET NULL,
      candidate_name VARCHAR(255) NOT NULL,
      match_score NUMERIC(5,4) NOT NULL,
      match_status VARCHAR(30) NOT NULL DEFAULT 'candidate',
      evidence JSONB NOT NULL DEFAULT '{}'::jsonb,
      source_record_id VARCHAR(64) REFERENCES owner_source_records(id) ON DELETE SET NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `);
}

const publicRecordsProvider: OwnerEnrichmentProvider = {
  name: 'public_records',
  capabilities: ['OWNER_IDENTITY', 'PHONE', 'EMAIL', 'ADDRESS', 'PORTFOLIO', 'ENTITY', 'RELATIONSHIPS', 'PUBLIC_RECORDS'],
  async enrich(pool, request) {
    const orgId = requireOrganizationId(request.organizationId);
    const owner = await pool.query(
      'SELECT * FROM property_owners WHERE id = $1 AND organization_id = $2 LIMIT 1',
      [request.ownerId, orgId],
    );
    if (!owner.rows[0]) throw new Error('Owner record not found for organization');

    const properties = await pool.query(
      `SELECT id, address, city, state, zip, county, apn, units_count, estimated_value,
              assessed_tax_value, estimated_equity, is_absentee_owner, is_corporate_owned,
              tax_delinquent, last_sale_date
         FROM properties
        WHERE owner_id = $1 AND organization_id = $2
        ORDER BY estimated_value DESC NULLS LAST`,
      [request.ownerId, orgId],
    );

    const row = owner.rows[0];
    const phones = jsonArray(row.phone_numbers)
      .map((p) => typeof p === 'string' ? { number: p } : p)
      .filter((p) => normalizePhone(p?.number ?? p?.phone_number).length >= 10)
      .map((p) => ({ ...p, number: normalizePhone(p?.number ?? p?.phone_number) }));
    const emails = jsonArray(row.email_addresses)
      .map((e) => typeof e === 'string' ? { email: e } : e)
      .filter((e) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizeEmail(e?.email)))
      .map((e) => ({ ...e, email: normalizeEmail(e.email) }));

    // Relationship evidence is accepted only from explicit normalized source fields.
    // Shared addresses, similar names, or proximity are not sufficient to claim a relationship.
    // Public-record providers only expose relationships when an upstream adapter explicitly
    // supplies them. Canonical property_owners rows do not contain relationship JSON.
    const relationships: Array<Record<string, unknown>> = [];

    const signals: Array<Record<string, unknown>> = [];
    for (const p of properties.rows) {
      const equityRatio = Number(p.estimated_value) > 0
        ? Number(p.estimated_equity || 0) / Number(p.estimated_value)
        : 0;
      if (p.is_absentee_owner) signals.push({ type: 'ABSENTEE_OWNER', propertyId: p.id, score: 25, value: { present: true } });
      if (p.tax_delinquent) signals.push({ type: 'TAX_DELINQUENCY', propertyId: p.id, score: 35, value: { present: true } });
      if (equityRatio >= 0.5) signals.push({ type: 'HIGH_EQUITY', propertyId: p.id, score: Math.min(40, equityRatio * 40), value: { ratio: equityRatio } });
      if (p.last_sale_date) {
        const years = (Date.now() - new Date(p.last_sale_date).getTime()) / (365.25 * 24 * 3600 * 1000);
        if (years >= 10) signals.push({ type: 'LONG_OWNERSHIP', propertyId: p.id, score: 20, value: { years: Number(years.toFixed(1)) } });
      }
      if (p.is_corporate_owned) signals.push({ type: 'ENTITY_OWNERSHIP', propertyId: p.id, score: 15, value: { entityType: row.entity_type } });
    }
    if (properties.rows.length >= 3) {
      signals.push({ type: 'MULTIPLE_PROPERTIES', propertyId: null, score: Math.min(50, properties.rows.length * 5), value: { propertyCount: properties.rows.length } });
    }
    const totalValue = properties.rows.reduce((sum: number, p: any) => sum + Number(p.estimated_value || 0), 0);
    const totalEquity = properties.rows.reduce((sum: number, p: any) => sum + Number(p.estimated_equity || 0), 0);
    const delinquentCount = properties.rows.filter((p: any) => p.tax_delinquent).length;
    const absenteeCount = properties.rows.filter((p: any) => p.is_absentee_owner).length;
    const entityCount = properties.rows.filter((p: any) => p.is_corporate_owned).length;
    const stateCount = new Set(properties.rows.map((p: any) => p.state).filter(Boolean)).size;
    if (stateCount >= 2) {
      signals.push({ type: 'MULTI_STATE_PORTFOLIO', propertyId: null, score: 25, value: { stateCount } });
    }
    if (delinquentCount > 0) {
      signals.push({ type: 'PORTFOLIO_TAX_DELINQUENCY', propertyId: null, score: Math.min(60, delinquentCount * 20), value: { delinquentProperties: delinquentCount } });
    }
    if (absenteeCount > 0) {
      signals.push({ type: 'ABSENTEE_PORTFOLIO', propertyId: null, score: Math.min(50, absenteeCount * 10), value: { absenteeProperties: absenteeCount } });
    }
    if (entityCount > 0) {
      signals.push({ type: 'ENTITY_PORTFOLIO', propertyId: null, score: Math.min(40, entityCount * 10), value: { entityOwnedProperties: entityCount } });
    }
    if (totalValue > 0) {
      signals.push({ type: 'PORTFOLIO_VALUE', propertyId: null, score: 10, value: { estimatedValue: totalValue, estimatedEquity: totalEquity } });
    }

    return {
      status: properties.rows.length || phones.length || emails.length ? 'completed' : 'partial',
      records: properties.rows,
      contacts: {
        phones,
        emails,
        addresses: row.mailing_address ? [{
          address: row.mailing_address,
          city: row.mailing_city,
          state: row.mailing_state,
          zip: row.mailing_zip,
          type: 'mailing',
        }] : [],
      },
      entities: row.entity_type && row.entity_type !== 'individual'
        ? [{ name: row.name, entityType: row.entity_type }]
        : [],
      relationships,
      signals,
      source: {
        sourceType: 'public_records',
        providerKey: 'public_records',
        retrievedAt: now(),
        ownerId: request.ownerId,
      },
    };
  },
};

const manualImportProvider: OwnerEnrichmentProvider = {
  name: 'manual_import',
  capabilities: ['PHONE', 'EMAIL', 'ADDRESS', 'ENTITY', 'RELATIONSHIPS'],
  async enrich(_pool, request) {
    const supplied = request.supplied || {};
    const contacts = {
      phones: jsonArray(supplied.phones).map((p) => ({ ...p, number: normalizePhone(p.number ?? p.phone_number) })).filter((p) => p.number),
      emails: jsonArray(supplied.emails).map((e) => ({ ...e, email: normalizeEmail(e.email) })).filter((e) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(e.email))),
      addresses: jsonArray(supplied.addresses),
    };
    return {
      status: contacts.phones.length || contacts.emails.length || contacts.addresses.length ||
        jsonArray(supplied.entities).length || jsonArray(supplied.relationships).length ? 'completed' : 'no_match',
      records: [],
      contacts,
      entities: jsonArray(supplied.entities),
      relationships: jsonArray(supplied.relationships),
      signals: [],
      source: { sourceType: 'manual_import', providerKey: 'manual_import', retrievedAt: now() },
    };
  },
};

const unavailableProvider = (name: string): OwnerEnrichmentProvider => ({
  name,
  capabilities: ['PHONE', 'EMAIL', 'ADDRESS', 'ENTITY', 'RELATIONSHIPS'],
  async enrich() {
    return {
      status: 'unavailable',
      reason: `Provider ${name} is not configured. Vortex One will not fabricate enrichment results.`,
      records: [],
      contacts: { phones: [], emails: [], addresses: [] },
      entities: [],
      relationships: [],
      signals: [],
      source: { sourceType: 'provider', providerKey: name, retrievedAt: now() },
    };
  },
});

const PROVIDERS: OwnerEnrichmentProvider[] = [
  publicRecordsProvider,
  manualImportProvider,
  unavailableProvider('provider_a'),
  unavailableProvider('provider_b'),
  unavailableProvider('provider_c'),
];

export class OwnerEnrichmentService {
  static async listProviders(organizationId: string) {
    const pool = getPgPool();
    if (!pool) throw new Error('PostgreSQL is required for owner enrichment');
    const orgId = requireOrganizationId(organizationId);
    await ensureSchema(pool);
    const result = await pool.query(
      'SELECT provider_key, display_name, enabled, priority, capabilities FROM owner_enrichment_providers WHERE organization_id = $1 ORDER BY priority, provider_key',
      [orgId],
    );
    const configured = new Map(result.rows.map((r) => [r.provider_key, r]));
    for (const provider of PROVIDERS) {
      if (!configured.has(provider.name)) {
        await pool.query(
          `INSERT INTO owner_enrichment_providers
             (id, organization_id, provider_key, display_name, capabilities)
           VALUES ($1,$2,$3,$4,$5::jsonb)
           ON CONFLICT (organization_id, provider_key) DO NOTHING`,
          [id('prov'), orgId, provider.name, provider.name === 'public_records' ? 'Public Records' : provider.name === 'manual_import' ? 'Manual Import' : provider.name, JSON.stringify(provider.capabilities)],
        );
      }
    }
    return (await pool.query(
      'SELECT provider_key, display_name, enabled, priority, capabilities FROM owner_enrichment_providers WHERE organization_id = $1 ORDER BY priority, provider_key',
      [orgId],
    )).rows;
  }

  static async enrichOwner(request: OwnerEnrichmentRequest) {
    const pool = getPgPool();
    if (!pool) throw new Error('PostgreSQL is required for owner enrichment');
    const orgId = requireOrganizationId(request.organizationId);
    await ensureSchema(pool);

    const provider = PROVIDERS.find((p) => p.name === (request.provider || 'public_records')) || publicRecordsProvider;
    const jobId = id('enrich');
    await pool.query(
      `INSERT INTO owner_enrichment_jobs
        (id, organization_id, owner_id, property_id, provider_key, job_type, status, requested_capabilities, started_at)
       VALUES ($1,$2,$3,$4,$5,'FULL_ENRICHMENT','running',$6::jsonb,CURRENT_TIMESTAMP)`,
      [jobId, orgId, request.ownerId, request.propertyId || null, provider.name, JSON.stringify(request.capabilities || provider.capabilities)],
    );

    try {
      const enrichmentStartedAt = Date.now();
      const result = await provider.enrich(pool, { ...request, organizationId: orgId });
      await recordCostEvent(pool, {
        organizationId: orgId,
        id: `cost_enrich_${jobId}`,
        category: 'owner_enrichment',
        provider: provider.name,
        quantity: 1,
        totalCostUsd: 0,
        referenceType: 'owner_enrichment_job',
        referenceId: jobId,
        metadata: { status: result.status, durationMs: Date.now() - enrichmentStartedAt, records: result.records.length },
      });
      const sourceId = id('src');
      await pool.query(
        `INSERT INTO owner_source_records
          (id, organization_id, owner_id, property_id, enrichment_job_id, source_type, provider_key, raw_payload, raw_hash)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9)`,
        [sourceId, orgId, request.ownerId, request.propertyId || null, jobId, String(result.source.sourceType), String(result.source.providerKey || provider.name), JSON.stringify(result), hash(result)],
      );

      let added = 0;
      let updated = 0;
      for (const phone of result.contacts.phones) {
        const value = normalizePhone(phone.number ?? phone.phone_number);
        if (value.length < 10) continue;
        const r = await pool.query(
          `INSERT INTO owner_contact_points
            (id, organization_id, owner_id, type, value, normalized_value, contact_subtype, is_primary, is_verified, confidence_score, source_record_id)
           VALUES ($1,$2,$3,'PHONE',$4,$4,$5,$6,$7,$8,$9)
           ON CONFLICT (organization_id, owner_id, type, normalized_value)
           DO UPDATE SET last_seen_at=CURRENT_TIMESTAMP, source_record_id=EXCLUDED.source_record_id`,
          [id('cp'), orgId, request.ownerId, value, phone.type || phone.phone_type || 'UNKNOWN', Boolean(phone.is_primary), Boolean(phone.is_verified), Number(phone.confidence_score ?? 0.8), sourceId],
        );
        if (r.rowCount) added += r.rowCount;
      }
      for (const email of result.contacts.emails) {
        const value = normalizeEmail(email.email);
        if (!value) continue;
        const r = await pool.query(
          `INSERT INTO owner_contact_points
            (id, organization_id, owner_id, type, value, normalized_value, contact_subtype, is_primary, is_verified, confidence_score, source_record_id)
           VALUES ($1,$2,$3,'EMAIL',$4,$4,$5,$6,$7,$8,$9)
           ON CONFLICT (organization_id, owner_id, type, normalized_value)
           DO UPDATE SET last_seen_at=CURRENT_TIMESTAMP, source_record_id=EXCLUDED.source_record_id`,
          [id('cp'), orgId, request.ownerId, value, email.type || 'EMAIL', Boolean(email.is_primary), Boolean(email.is_verified), Number(email.confidence_score ?? 0.8), sourceId],
        );
        if (r.rowCount) added += r.rowCount;
      }

      for (const property of result.records) {
        await pool.query(
          `INSERT INTO owner_ownerships
            (id, organization_id, owner_id, property_id, ownership_type, ownership_percentage, confidence_score, source_record_id)
           VALUES ($1,$2,$3,$4,'record_owner',100,1,$5)
           ON CONFLICT (organization_id, owner_id, property_id, ownership_type)
           DO UPDATE SET confidence_score=EXCLUDED.confidence_score, source_record_id=EXCLUDED.source_record_id`,
          [id('own'), orgId, request.ownerId, property.id, sourceId],
        );
      }

      for (const relationship of result.relationships) {
        await pool.query(
          `INSERT INTO owner_relationships
            (id, organization_id, owner_id, related_entity_type, related_entity_id, related_name, relationship_type, confidence_score, source_record_id)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
           ON CONFLICT (organization_id, owner_id, related_entity_type, related_name, relationship_type)
           DO UPDATE SET confidence_score=EXCLUDED.confidence_score, source_record_id=EXCLUDED.source_record_id`,
          [id('rel'), orgId, request.ownerId, String(relationship.related_entity_type || 'entity'), relationship.related_entity_id || null, String(relationship.related_name || relationship.name || 'Unknown'), String(relationship.relationship_type || 'ASSOCIATED_WITH'), Number(relationship.confidence_score ?? 0.5), sourceId],
        );
      }

      for (const signal of result.signals) {
        await pool.query(
          `INSERT INTO owner_lead_signals
            (id, organization_id, owner_id, property_id, signal_type, signal_value, score, confidence_score, source_record_id)
           VALUES ($1,$2,$3,$4,$5,$6::jsonb,$7,$8,$9)
           ON CONFLICT (organization_id, owner_id, property_id, signal_type)
           DO UPDATE SET signal_value=EXCLUDED.signal_value, score=EXCLUDED.score, confidence_score=EXCLUDED.confidence_score, source_record_id=EXCLUDED.source_record_id, observed_at=CURRENT_TIMESTAMP`,
          [id('sig'), orgId, request.ownerId, signal.propertyId || null, String(signal.type), JSON.stringify(signal.value || {}), Number(signal.score || 0), 0.95, sourceId],
        );
      }

      const portfolio = await pool.query(
        `SELECT COUNT(*)::int AS property_count,
                COALESCE(SUM(estimated_value),0)::numeric AS total_value,
                COALESCE(SUM(assessed_tax_value),0)::numeric AS total_assessed,
                COALESCE(SUM(estimated_equity),0)::numeric AS total_equity,
                COALESCE(SUM(units_count),0)::int AS total_units,
                COUNT(DISTINCT state)::int AS state_count,
                COUNT(DISTINCT county)::int AS county_count
           FROM properties
          WHERE owner_id = $1 AND organization_id = $2`,
        [request.ownerId, orgId],
      );
      const summary = portfolio.rows[0];
      await pool.query(
        `UPDATE property_owners
            SET properties_owned_count=$1, total_portfolio_value=$2, total_portfolio_equity=$3, updated_at=CURRENT_TIMESTAMP
          WHERE id=$4 AND organization_id=$5`,
        [summary.property_count, summary.total_value, summary.total_equity, request.ownerId, orgId],
      );

      await pool.query(
        `UPDATE owner_enrichment_jobs
            SET status=$1, records_found=$2, records_added=$3, records_updated=$4, completed_at=CURRENT_TIMESTAMP
          WHERE id=$5 AND organization_id=$6`,
        [result.status, result.records.length + result.contacts.phones.length + result.contacts.emails.length, added, updated, jobId, orgId],
      );

      return {
        job_id: jobId,
        status: result.status,
        provider: provider.name,
        owner_id: request.ownerId,
        portfolio: {
          properties: Number(summary.property_count),
          estimated_value: Number(summary.total_value),
          assessed_value: Number(summary.total_assessed),
          equity: Number(summary.total_equity),
          units: Number(summary.total_units),
          states: Number(summary.state_count),
          counties: Number(summary.county_count),
        },
        contacts: result.contacts,
        signals: result.signals,
        provenance: {
          source_record_id: sourceId,
          source_type: result.source.sourceType,
          retrieved_at: result.source.retrievedAt,
          confidence: result.status === 'completed' ? 0.95 : 0.6,
        },
      };
    } catch (error: any) {
      await pool.query(
        `UPDATE owner_enrichment_jobs
            SET status='failed', error_message=$1, completed_at=CURRENT_TIMESTAMP
          WHERE id=$2 AND organization_id=$3`,
        [String(error?.message || error), jobId, orgId],
      );
      throw error;
    }
  }

  static async getOwnerProfile(organizationId: string, ownerId: string) {
    const pool = getPgPool();
    if (!pool) throw new Error('PostgreSQL is required for owner enrichment');
    const orgId = requireOrganizationId(organizationId);
    await ensureSchema(pool);
    const [owner, contacts, ownerships, signals, relationships, identityMatches, jobs] = await Promise.all([
      pool.query('SELECT * FROM property_owners WHERE id=$1 AND organization_id=$2 LIMIT 1', [ownerId, orgId]),
      pool.query('SELECT * FROM owner_contact_points WHERE owner_id=$1 AND organization_id=$2 ORDER BY is_primary DESC, last_seen_at DESC', [ownerId, orgId]),
      pool.query(`SELECT oo.*, p.address, p.city, p.state, p.zip, p.apn, p.estimated_value, p.assessed_tax_value, p.estimated_equity, p.units_count
                    FROM owner_ownerships oo JOIN properties p ON p.id=oo.property_id AND p.organization_id=oo.organization_id
                   WHERE oo.owner_id=$1 AND oo.organization_id=$2 ORDER BY p.estimated_value DESC`, [ownerId, orgId]),
      pool.query('SELECT * FROM owner_lead_signals WHERE owner_id=$1 AND organization_id=$2 ORDER BY score DESC, observed_at DESC', [ownerId, orgId]),
      pool.query('SELECT * FROM owner_relationships WHERE owner_id=$1 AND organization_id=$2 ORDER BY confidence_score DESC, created_at DESC', [ownerId, orgId]),
      pool.query('SELECT * FROM owner_identity_matches WHERE owner_id=$1 AND organization_id=$2 ORDER BY match_score DESC, created_at DESC', [ownerId, orgId]),
      pool.query('SELECT * FROM owner_enrichment_jobs WHERE owner_id=$1 AND organization_id=$2 ORDER BY created_at DESC LIMIT 20', [ownerId, orgId]),
    ]);
    if (!owner.rows[0]) throw new Error('Owner record not found for organization');
    return {
      owner: owner.rows[0],
      contacts: contacts.rows,
      ownerships: ownerships.rows,
      signals: signals.rows,
      relationships: relationships.rows,
      identity_matches: identityMatches.rows,
      enrichment_jobs: jobs.rows,
    };
  }

  static async getJob(organizationId: string, jobId: string) {
    const pool = getPgPool();
    if (!pool) throw new Error('PostgreSQL is required for owner enrichment');
    const orgId = requireOrganizationId(organizationId);
    await ensureSchema(pool);
    const result = await pool.query('SELECT * FROM owner_enrichment_jobs WHERE id=$1 AND organization_id=$2 LIMIT 1', [jobId, orgId]);
    return result.rows[0] || null;
  }
}
