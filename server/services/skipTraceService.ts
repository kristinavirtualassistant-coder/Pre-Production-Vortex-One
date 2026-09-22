import { getPgPool } from '../db/db';
import { requireOrganizationId } from './organizationContext';

/** Source-safe enrichment boundary. No owner/contact data is generated. */
export class SkipTraceService {
  public static async execute5StepSkipTrace(_params?: any): Promise<any> {
    return { status:'unavailable', reason:'Verified owner/contact enrichment source is not configured.', address:_params?.address||'', step1_gis:{apn:_params?.apn||''}, step2_assessor_owner:{legal_owner_name:null}, step3_mailing_analysis:{absentee_tier:'unknown'}, step4_corporate_trace:{entity_name:null}, step5_contact_discovery:{lookup_links:[]}, contacts:{phones:[],emails:[]} };
  }

  public static async executeAutomatedPipeline(_params?: any): Promise<any> {
    return { status:'unavailable', reason:'Verified owner/contact enrichment source is not configured.', results:[], contacts:[] };
  }

  public static async batchSkipTrace(_propertyIds?: string[], _organizationId?: string): Promise<any> {
    return { status:'unavailable', reason:'Verified owner/contact enrichment source is not configured.', results:[] };
  }

  public static async autoEnrichContactsForOwner(_params?: any): Promise<any> {
    return { status:'unavailable', reason:'Verified owner/contact enrichment source is not configured.', contacts:[] };
  }

  public static getAutomationStats(organizationId?: string) {
    return { organization_id:organizationId||null, status:'disabled', reason:'Verified owner/contact source required' };
  }

  public static async saveDiscoveredContacts(params: {
    ownerId: string;
    propertyId?: string;
    organizationId: string;
    phoneNumbers?: Array<any>;
    emailAddresses?: Array<any>;
    notes?: string;
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
      .map((entry: any) => ({
        ...entry,
        number: normalizePhone(entry?.number ?? entry?.phone_number ?? entry),
      }))
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
