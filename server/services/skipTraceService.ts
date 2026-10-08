import { getPgPool } from '../db/db';
import { requireOrganizationId } from './organizationContext';
import { OwnerEnrichmentService } from './ownerEnrichmentService';
import { enforceUsageLimit } from './billingService';
import { backupContact } from './googleBackupService';

/** Compatibility facade for the existing skip-trace UI. */
export class SkipTraceService {
  public static async execute5StepSkipTrace(params?: any): Promise<any> {
    const organizationId = requireOrganizationId(params?.organizationId);
    if (!params?.ownerId) return { status: 'partial', reason: 'ownerId is required', contacts: { phones: [], emails: [] } };
    const pool = getPgPool();
    if (pool) await enforceUsageLimit(pool, organizationId, 'enrichment_credits_month', 1);
    const result = await OwnerEnrichmentService.enrichOwner({
      organizationId, ownerId: params.ownerId, propertyId: params.propertyId,
      provider: params.provider || 'public_records', capabilities: params.capabilities, supplied: params.supplied,
    });
    return {
      ...result,
      address: params?.address || '',
      step1_gis: { apn: params?.apn || '' },
      step2_assessor_owner: { legal_owner_name: undefined },
      step3_mailing_analysis: { absentee_tier: result.signals.some((s: any) => s.type === 'ABSENTEE_OWNER') ? 'absentee' : 'unknown' },
      step4_corporate_trace: { entity_name: undefined },
      step5_contact_discovery: { lookup_links: [], provider: result.provider, source_status: result.status },
    };
  }

  public static async executeAutomatedPipeline(params?: any): Promise<any> {
    const organizationId = requireOrganizationId(params?.organizationId);
    if (!params?.ownerId) return { status: 'partial', reason: 'ownerId is required', results: [], contacts: [] };
    const result = await OwnerEnrichmentService.enrichOwner({
      organizationId, ownerId: params.ownerId, propertyId: params.propertyId,
      provider: params.provider || 'public_records', capabilities: params.capabilities, supplied: params.supplied,
    });
    return { ...result, results: result.signals, contacts: result.contacts };
  }

  public static async batchSkipTrace(propertyIds: string[] = [], organizationId?: string): Promise<any> {
    const orgId = requireOrganizationId(organizationId);
    const pool = getPgPool();
    if (!pool) throw new Error('PostgreSQL is required for owner enrichment');
    const properties = await pool.query(
      `SELECT DISTINCT owner_id, id AS property_id FROM properties
       WHERE organization_id = $1 AND id = ANY($2::varchar[]) AND owner_id IS NOT NULL`,
      [orgId, propertyIds],
    );
    if (properties.rowCount) await enforceUsageLimit(pool, orgId, 'enrichment_credits_month', properties.rowCount);
    const results = [];
    for (const row of properties.rows) {
      results.push(await OwnerEnrichmentService.enrichOwner({
        organizationId: orgId, ownerId: row.owner_id, propertyId: row.property_id, provider: 'public_records',
      }));
    }
    return { status: 'completed', requested: propertyIds.length, enriched: results.length, results };
  }

  public static async autoEnrichContactsForOwner(params?: any): Promise<any> {
    const organizationId = requireOrganizationId(params?.organizationId);
    if (!params?.ownerId) return { status: 'partial', reason: 'ownerId is required', contacts: [] };
    const result = await OwnerEnrichmentService.enrichOwner({
      organizationId, ownerId: params.ownerId, propertyId: params.propertyId,
      provider: params.provider || 'public_records',
      capabilities: ['PHONE', 'EMAIL', 'ADDRESS', 'PORTFOLIO'], supplied: params.supplied,
    });
    return { status: result.status, contacts: result.contacts, job_id: result.job_id, provider: result.provider };
  }

  public static async getOwnerProfile(params: { ownerId: string; organizationId: string }) {
    return OwnerEnrichmentService.getOwnerProfile(params.organizationId, params.ownerId);
  }

  public static async listProviders(organizationId: string) {
    return OwnerEnrichmentService.listProviders(organizationId);
  }

  public static async getEnrichmentJob(jobId: string, organizationId: string) {
    return OwnerEnrichmentService.getJob(organizationId, jobId);
  }

  public static getAutomationStats(organizationId?: string) {
    return {
      organization_id: organizationId || null,
      status: 'provider_neutral',
      providers: ['public_records', 'manual_import', 'provider_a', 'provider_b', 'provider_c'],
      default_provider: 'public_records',
      synthetic_data: false,
    };
  }

  public static async saveDiscoveredContacts(params: {
    ownerId: string; propertyId?: string; organizationId: string;
    phoneNumbers?: Array<any>; emailAddresses?: Array<any>; notes?: string;
  }): Promise<any> {
    const pool = getPgPool();
    if (!pool) throw new Error('PostgreSQL is required to persist discovered contacts');
    const organizationId = requireOrganizationId(params.organizationId);
    const client = await pool.connect();

    try {
      await client.query('BEGIN');
      const ownerResult = await client.query(
        'SELECT id, name, phone_numbers, email_addresses, notes FROM property_owners WHERE id = $1 AND organization_id = $2 LIMIT 1 FOR UPDATE',
        [params.ownerId, organizationId],
      );
      const owner = ownerResult.rows[0];
      if (!owner) throw new Error('Owner record not found for organization');

      const normalizePhone = (value: unknown) => String(value ?? '').replace(/\D/g, '');
      const validPhones = (params.phoneNumbers || [])
        .map((entry: any) => ({ ...entry, number: normalizePhone(entry?.number ?? entry?.phone_number ?? entry) }))
        .filter((entry: any) => entry.number.length >= 10);
      const validEmails = (params.emailAddresses || [])
        .map((entry: any) => typeof entry === 'string' ? { email: entry } : entry)
        .filter((entry: any) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(entry?.email || '').trim()))
        .map((entry: any) => ({ ...entry, email: String(entry.email).trim().toLowerCase() }));

      const existingPhones = Array.isArray(owner.phone_numbers) ? owner.phone_numbers : [];
      const existingEmails = Array.isArray(owner.email_addresses) ? owner.email_addresses : [];
      const phones = [...existingPhones, ...validPhones].filter((item, index, all) =>
        all.findIndex((x: any) => x?.number === item?.number) === index,
      );
      const emails = [...existingEmails, ...validEmails].filter((item, index, all) =>
        all.findIndex((x: any) => x?.email === item?.email) === index,
      );
      const notes = params.notes === undefined ? owner.notes : params.notes;

      await client.query(
        `UPDATE property_owners
            SET phone_numbers = $1::jsonb, email_addresses = $2::jsonb, notes = $3, updated_at = CURRENT_TIMESTAMP
          WHERE id = $4 AND organization_id = $5`,
        [JSON.stringify(phones), JSON.stringify(emails), notes, params.ownerId, organizationId],
      );

      const contactId = `contact_${params.ownerId}`;
      const contactResult = await client.query(
        `INSERT INTO contacts
          (id, organization_id, owner_id, full_name, phone_numbers, email_addresses, created_at, updated_at)
         VALUES ($1,$2,$3,$4,$5::jsonb,$6::jsonb,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)
         ON CONFLICT (organization_id, full_name)
         DO UPDATE SET
           owner_id=COALESCE(EXCLUDED.owner_id,contacts.owner_id),
           phone_numbers=EXCLUDED.phone_numbers,
           email_addresses=EXCLUDED.email_addresses,
           updated_at=CURRENT_TIMESTAMP
         RETURNING id, organization_id, owner_id, full_name, phone_numbers, email_addresses, created_at, updated_at`,
        [
          contactId, organizationId, params.ownerId, owner.name || 'Property Owner',
          JSON.stringify(phones), JSON.stringify(emails),
        ],
      );

      await client.query('COMMIT');

      const contact = contactResult.rows[0];
      const backup = await backupContact(contact).catch((error: any) => ({
        sheets: 'failed' as const,
        drive: 'failed' as const,
        error: error?.message || String(error),
      }));

      return {
        success: true,
        owner: { ...owner, phone_numbers: phones, email_addresses: emails, notes },
        contact,
        property_id: params.propertyId || null,
        source_status: 'supplied_data_persisted',
        backup,
      };
    } catch (error) {
      try { await client.query('ROLLBACK'); } catch {}
      throw error;
    } finally {
      client.release();
    }
  }}
