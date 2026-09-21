import { requireOrganizationId } from '../organizationContext';
/**
 * Vortex One - NETR Online Public Records & Title Roll Provider
 * Direct portal search for county recorder deeds, tax rolls, and property ownership history.
 */

import {
  IPropertyDataProvider,
  PropertySearchQuery,
  NormalizedPropertyResult,
  ProviderProvenanceMetadata,
} from './types';
import { Property, PropertyOwner } from '../../../src/types';

export class NetrOnlineProvider implements IPropertyDataProvider {
  public readonly providerId = 'netr_online';
  public readonly providerName = 'NETR Online Public Records & Title Roll';
  public readonly supportedCounties = ['*']; // Nationwide coverage
  public readonly supportsAddressSearch = true;
  public readonly supportsApnSearch = true;
  public readonly supportsOwnerSearch = true;
  public readonly isGovernmentSource = false;

  private readonly endpoint = 'https://api.netronline.com/v1/public-records/search';

  public async search(query: PropertySearchQuery): Promise<NormalizedPropertyResult[]> {
    const apiKey = process.env.NETR_ONLINE_API_KEY;
    if (!apiKey) {
      throw new Error(
        'NETR Online API Key is not configured (NETR_ONLINE_API_KEY missing). Please set NETR_ONLINE_API_KEY in environment or use County GIS services.'
      );
    }

    const params = new URLSearchParams();
    if (query.address) params.append('address', query.address);
    if (query.city) params.append('city', query.city);
    if (query.state) params.append('state', query.state || 'CA');
    if (query.county) params.append('county', query.county);
    if (query.apn) params.append('apn', query.apn);

    const targetUrl = `${this.endpoint}?${params.toString()}`;
    const retrievedAt = new Date().toISOString();

    const response = await fetch(targetUrl, {
      headers: {
        'Accept': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
        'X-API-Key': apiKey,
      },
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`NETR Online API returned HTTP ${response.status}: ${errText}`);
    }

    const data = await response.json();
    const records = Array.isArray(data.records) ? data.records : (Array.isArray(data) ? data : [data]);
    const orgId = requireOrganizationId(query.organizationId);

    return records.map((item: any, idx: number): NormalizedPropertyResult => {
      const rawId = item.id || item.recordId;
      if (!rawId) throw new Error('NETR record is missing a source record identifier');
      const apn = item.apn || item.parcelNumber || '';
      const ownerName = item.grantee || item.ownerName || item.taxpayerName || 'Owner information not available';

      const estVal = Number(item.assessedValue ?? item.marketValue ?? 0);
      const assessedVal = Number(item.assessedValue ?? 0);
      const equity = 0;

      const propId = `netr_prop_${rawId}`;
      const ownerId = `netr_owner_${rawId}`;

      const provenance: ProviderProvenanceMetadata = {
        provider: this.providerName,
        datasetName: 'NETR Online Real Estate Public Records Portal v1',
        endpointUrl: this.endpoint,
        retrievedAt,
        queryFilter: params.toString(),
        recordIdentifier: rawId,
        isOfficialGovernmentSource: false,
        ownerIntelligenceStatus: ownerName ? 'available' : 'unlisted',
        ownerIntelligenceNotes: 'NETR Online deed recorder and tax assessor index match.',
        legalTermsNotes: 'NETR Online public records search API. Permitted for internal owner research.',
      };

      const property: Property = {
        id: propId,
        organization_id: orgId,
        address: item.situsAddress || item.address || '',
        city: item.city || '',
        state: item.state || '',
        zip: item.zip || '',
        county: item.county || '',
        apn,
        property_type: (item.propertyUseCode as any) || 'Unknown',
        units_count: Number(item.buildingUnits ?? item.unitCount ?? 0),
        square_feet: Number(item.buildingArea ?? 0),
        year_built: Number(item.yearBuilt ?? 0),
        estimated_value: estVal,
        assessed_tax_value: assessedVal,
        estimated_equity: equity,
        mortgage_balance: 0,
        owner_id: ownerId,
        owner_name: ownerName,
        is_absentee_owner: Boolean(item.isAbsentee === true),
        is_corporate_owned: Boolean(item.isCorporate || ownerName.includes('LLC') || ownerName.includes('INC')),
        last_sale_date: item.recordingDate || item.deedDate,
        last_sale_price: item.documentAmount,
        tax_delinquent: item.taxStatus === 'DELINQUENT',
        provenance: {
          source: this.providerName,
          sourceType: 'public_records',
          retrievedAt,
          recordId: rawId,
          confidence: 0.94,
          verified: true,
        },
      };

      const owner: PropertyOwner = {
        id: ownerId,
        organization_id: orgId,
        name: ownerName,
        entity_type: ownerName.includes('LLC') ? 'llc' : ownerName.includes('TRUST') ? 'trust' : 'individual',
        mailing_address: item.mailingAddress || '',
        mailing_city: item.mailingCity || '',
        mailing_state: item.mailingState || '',
        mailing_zip: item.mailingZip || '',
        phone_numbers: [],
        email_addresses: [],
        properties_owned_count: 1,
        total_portfolio_value: estVal,
        total_portfolio_equity: equity,
        notes: `Enriched via NETR Online Deed Search on ${retrievedAt}.`,
      };

      return {
        property,
        owner,
        rawAttributes: item,
        provenance,
      };
    });
  }
}
