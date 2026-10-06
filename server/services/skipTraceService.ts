import { getPgPool } from '../db/db';
import { requireOrganizationId } from './organizationContext';
import { OwnerEnrichmentService } from './ownerEnrichmentService';

/** Compatibility facade for the existing skip-trace UI. */
export class SkipTraceService {
  public static async execute5StepSkipTrace(params?: any): Promise<any> {
    const organizationId = requireOrganizationId(params?.organizationId);
    if (!params?.ownerId) return { status: 'partial', reason: 'ownerId is required', contacts: { phones: [], emails: [] } };
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
    const ownerResult = await pool.query(
      'SELECT id, phone_numbers, email_addresses, notes FROM property_owners WHERE id = $1 AND organization_id = $2 LIMIT 1',
      [params.ownerId, organizationId],
    );
    if (!ownerResult.rows[0]) throw new Error('Owner record not found for organization');
    const normalizePhone = (value: unknown) => String(value ?? '').replace(/\D/g, '');
    const validPhones = (params.phoneNumbers || [])
      .map((entry: any) => ({ ...entry, number: normalizePhone(entry?.number ?? entry?.phone_number ?? entry) }))
      .filter((entry: any) => entry.number.length >= 10);
    const validEmails = (params.emailAddresses || [])
      .map((entry: any) => typeof entry === 'string' ? { email: entry } : entry)
      .filter((entry: any) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(entry?.email || '').trim()))
      .map((entry: any) => ({ ...entry, email: String(entry.email).trim().toLowerCase() }));
    const existingPhones = Array.isArray(ownerResult.rows[0].phone_numbers) ? ownerResult.rows[0].phone_numbers : [];
    const existingEmails = Array.isArray(ownerResult.rows[0].email_addresses) ? ownerResult.rows[0].email_addresses : [];
    const phones = [...existingPhones, ...validPhones].filter((item, index, all) => all.findIndex((x: any) => x?.number === item?.number) === index);
    const emails = [...existingEmails, ...validEmails].filter((item, index, all) => all.findIndex((x: any) => x?.email === item?.email) === index);
    const notes = params.notes === undefined ? ownerResult.rows[0].notes : params.notes;
    const result = await pool.query(
      `UPDATE property_owners SET phone_numbers = $1::jsonb, email_addresses = $2::jsonb, notes = $3, updated_at = CURRENT_TIMESTAMP
       WHERE id = $4 AND organization_id = $5 RETURNING id, phone_numbers, email_addresses, notes, updated_at`,
      [JSON.stringify(phones), JSON.stringify(emails), notes, params.ownerId, organizationId],
    );
    return { success: true, owner: result.rows[0], property_id: params.propertyId || null, source_status: 'supplied_data_persisted' };
  }
}
