import { requireOrganizationId } from '../organizationContext';
/**
 * Vortex One - Orange County Public Works / California Cadastral GIS Provider
 * Queries official public cadastral parcel and address records.
 */

import {
  IPropertyDataProvider,
  PropertySearchQuery,
  NormalizedPropertyResult,
  ProviderProvenanceMetadata,
} from './types';
import { Property } from '../../../src/types';
import { fetchWithTimeout } from './providerHelpers';

function firstNumber(attributes: Record<string, any>, keys: string[]): number {
  for (const key of keys) {
    const value = Number(attributes[key]);
    if (Number.isFinite(value) && value > 0) return value;
  }
  return 0;
}

function firstString(attributes: Record<string, any>, keys: string[]): string {
  for (const key of keys) {
    const value = attributes[key];
    if (value !== undefined && value !== null && String(value).trim()) return String(value).trim();
  }
  return '';
}

function normalizePropertyType(value: string): Property['property_type'] {
  const normalized = value.toLowerCase();
  if (normalized.includes('multi')) return 'Multi-Family';
  if (normalized.includes('single') || normalized.includes('sfr')) return 'Single Family';
  if (normalized.includes('condo')) return 'Condo';
  if (normalized.includes('industrial')) return 'Industrial';
  if (normalized.includes('commercial')) return 'Commercial';
  return 'Unknown';
}

export function normalizeOrangeCountyParcel(
  attr: Record<string, any>,
  targetCounty: string,
  organizationId: string,
  geometry?: any,
): NormalizedPropertyResult {
  const apn = firstString(attr, ['PARCEL_APN', 'Search_PARCELAPN']);
  const rawAddr = firstString(attr, ['FullStreetAddress', 'SITE_ADDR']) ||
    [attr.SITE_HOUSE_NUMBER, attr.SITE_STREET_NAME, attr.SITE_MODE].filter(Boolean).join(' ').trim();
  const city = firstString(attr, ['SITE_CITY']);
  const state = firstString(attr, ['SITE_STATE']) || 'CA';
  const zip = firstString(attr, ['SITE_ZIP']);
  const buildingSqFt = firstNumber(attr, ['BUILDING_SQFT', 'BuildingSquareFeet', 'TOTAL_BUILDING_SQ_FT', 'BLDG_SQ_FT', 'LIVING_AREA']);
  const yearBuilt = firstNumber(attr, ['YEAR_BUILT', 'YearBuilt', 'YR_BUILT']);
  const assessedValue = firstNumber(attr, ['ASSESSED_VALUE', 'TOTAL_ASSESSED_VALUE', 'ASSESSEDVAL', 'ASSESSED_VAL']);
  const units = firstNumber(attr, ['UNITS', 'UNIT_COUNT', 'TOTAL_UNITS', 'NUM_UNITS']);
  const propertyType = normalizePropertyType(firstString(attr, ['PROPERTY_TYPE', 'PropertyType', 'USE_DESCRIPTION', 'LAND_USE_DESCRIPTION']));
  const retrievedAt = new Date().toISOString();
  const safeCounty = targetCounty.toLowerCase().replace(/[^a-z]/g, '_');
  const safeApn = apn.replace(/[^0-9A-Za-z]/g, '_');
  const propertyId = `${safeCounty}_gis_${safeApn || String(attr.OBJECTID || 'record')}`;
  const provenance: ProviderProvenanceMetadata = {
    provider: 'CA Statewide Cadastral Open Data (GIS)',
    datasetName: `Parcels With Attributes (${targetCounty} / CA Cadastral Open GIS)`,
    endpointUrl: 'https://bz1uwWPKUInZBK94.svcs5.arcgis.com/bz1uwWPKUInZBK94/arcgis/rest/services/CA_Statewide_Parcels_Public_view/FeatureServer/0/query',
    retrievedAt,
    queryFilter: '',
    recordIdentifier: attr.OBJECTID || attr.PARCEL_DMP_ID || apn,
    fipsCode: firstString(attr, ['FIPS_CODE']) || (targetCounty.toLowerCase() === 'orange' ? '06059' : undefined),
    isOfficialGovernmentSource: true,
    ownerIntelligenceStatus: 'statutory_redaction_cal_gov_6254_21',
    ownerIntelligenceNotes: 'Owner identity and contact fields are not supplied by this public parcel dataset. Owner enrichment must come from an authorized downstream source.',
    legalTermsNotes: `Public cadastral records maintained by ${targetCounty} & CA GIS.`,
  };

  const property: Property = {
    id: propertyId,
    organization_id: organizationId,
    address: rawAddr,
    city,
    state,
    zip,
    county: `${targetCounty} County`,
    apn,
    property_type: propertyType,
    units_count: units,
    square_feet: buildingSqFt,
    year_built: yearBuilt,
    estimated_value: 0,
    assessed_tax_value: assessedValue,
    estimated_equity: 0,
    mortgage_balance: 0,
    owner_id: '',
    owner_name: '',
    is_absentee_owner: false,
    is_corporate_owned: false,
    tax_delinquent: false,
    provenance: {
      source: 'CA Statewide Cadastral Open Data (GIS)',
      sourceType: 'public_records',
      retrievedAt,
      recordId: String(attr.OBJECTID || apn),
      confidence: 0.98,
      verified: true,
    },
  };

  return { property, rawAttributes: attr, geometry, provenance };
}

export class OrangeCountyGISProvider implements IPropertyDataProvider {
  public readonly providerId = 'california_gis';
  public readonly providerName = 'CA Statewide Cadastral Open Data (GIS)';
  public readonly supportedCounties = ['*'];
  public readonly supportsAddressSearch = true;
  public readonly supportsApnSearch = true;
  public readonly supportsOwnerSearch = false; // Restricted by Cal. Gov. Code § 6254.21
  public readonly isGovernmentSource = true;

  private readonly primaryEndpoint =
    'https://bz1uwWPKUInZBK94.svcs5.arcgis.com/bz1uwWPKUInZBK94/arcgis/rest/services/CA_Statewide_Parcels_Public_view/FeatureServer/0/query';

  public async search(query: PropertySearchQuery): Promise<NormalizedPropertyResult[]> {
    let targetCounty = 'Orange';
    if (query.county) {
      targetCounty = query.county.replace(/ County$/i, '').trim();
    }

    try {
      const whereClauses: string[] = [];
      const countyUpper = targetCounty.toUpperCase();
      whereClauses.push(`(COUNTYNAME = '${targetCounty}' OR COUNTYNAME = '${countyUpper}')`);

      if (query.apn && query.apn.trim()) {
        const cleanApn = query.apn.trim().replace(/[^0-9A-Za-z-]/g, '');
        whereClauses.push(
          `(PARCEL_APN = '${cleanApn}' OR PARCEL_APN LIKE '%${cleanApn}%' OR Search_PARCELAPN LIKE '%${cleanApn}%')`
        );
      } else if (query.address && query.address.trim()) {
        const sanitized = query.address
          .trim()
          .toUpperCase()
          .replace(/['"\\]/g, '')
          .replace(/,\s*(CA|CALIFORNIA|ORANGE|COSTA MESA|IRVINE|NEWPORT BEACH|SANTA ANA|ANAHEIM).*$/i, '');
        
        const tokens = sanitized.split(/\s+/).filter((t) => t.length > 0);
        if (tokens.length > 0) {
          const addressLike = tokens.join('%');
          whereClauses.push(
            `(FullStreetAddress LIKE '%${addressLike}%' OR SITE_ADDR LIKE '%${addressLike}%' OR SITE_STREET_NAME LIKE '%${tokens[tokens.length - 1]}%')`
          );
        }
      }

      if (query.city && query.city.trim()) {
        const cityClean = query.city.trim().toUpperCase().replace(/['"\\]/g, '');
        whereClauses.push(`(SITE_CITY = '${cityClean}' OR SITE_CITY LIKE '%${cityClean}%')`);
      }

      if (query.zip && query.zip.trim()) {
        const zipClean = query.zip.trim().replace(/[^0-9]/g, '');
        whereClauses.push(`(SITE_ZIP = '${zipClean}' OR SITE_ZIP LIKE '${zipClean}%')`);
      }

      const whereQuery = whereClauses.join(' AND ');
      const limit = Math.min(query.limit || 10, 50);

      const params = new URLSearchParams({
        where: whereQuery,
        outFields: '*',
        returnGeometry: 'true',
        resultRecordCount: limit.toString(),
        f: 'json',
      });

      const targetUrl = `${this.primaryEndpoint}?${params.toString()}`;

      const response = await fetchWithTimeout(targetUrl, {
        method: 'GET',
      }, 10000);

      if (!response.ok) {
        throw new Error(`County GIS request failed with HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      if (data.error) {
        throw new Error(`ArcGIS FeatureServer Error: ${data.error.message || JSON.stringify(data.error)}`);
      }

      const features = data.features || [];
      if (features.length === 0) {
    return [];
      }

      const orgId = requireOrganizationId(query.organizationId);

      return features.map((feat: any): NormalizedPropertyResult => {
        const attr = feat.attributes || {};
        const normalized = normalizeOrangeCountyParcel(attr, targetCounty, orgId, feat.geometry ? { type: 'Polygon', rings: feat.geometry.rings } : undefined);
        normalized.provenance.queryFilter = whereQuery;
        return normalized;


      });
    } catch (error) {
      throw error;
    }
  }
}

