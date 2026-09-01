/**
 * Vortex One - Property Data Provider Types & Normalized Interfaces
 */

import { AgentProvenance, Property, PropertyOwner } from '../../../src/types';

export interface PropertySearchQuery {
  address?: string;
  apn?: string;
  city?: string;
  zip?: string;
  county?: string;
  state?: string;
  propertyType?: string;
  minUnits?: number;
  maxUnits?: number;
  absenteeOnly?: boolean;
  minEquity?: number;
  minPrice?: number;
  maxPrice?: number;
  taxDelinquentOnly?: boolean;
  entityType?: string;
  minSquareFeet?: number;
  ownerName?: string;
  organizationId?: string;
  persist?: boolean;
  limit?: number;
  preferredProvider?:
    | 'auto'
    | 'county_gis'
    | 'california_gis'
    | 'orange_county_gis'
    | 'los_angeles_county_gis'
    | 'san_diego_county_gis'
    | 'riverside_county_gis'
    | 'san_bernardino_county_gis'
    | 'ventura_county_gis'
    | 'santa_clara_county_gis'
    | 'alameda_county_gis'
    | 'sacramento_county_gis'
    | 'attom'
    | 'netr_online'
    | 'zillow'
    | 'realtor'
    | 'redfin'
    | 'zoominfo'
    | 'arcgis'
    | 'google_maps';
}

export interface ProviderProvenanceMetadata {
  provider: string;
  datasetName: string;
  endpointUrl: string;
  retrievedAt: string;
  queryFilter: string;
  recordIdentifier?: string | number;
  fipsCode?: string;
  isOfficialGovernmentSource: boolean;
  ownerIntelligenceStatus: 'statutory_redaction_cal_gov_6254_21' | 'available' | 'unlisted' | 'commercial_enriched';
  ownerIntelligenceNotes: string;
  legalTermsNotes: string;
}

export interface NormalizedPropertyResult {
  property: Property;
  owner?: PropertyOwner;
  rawAttributes?: Record<string, any>;
  geometry?: {
    type: 'Polygon' | 'MultiPolygon' | 'Point';
    coordinates?: any;
    rings?: number[][][];
    centroid?: { lat: number; lon: number };
  };
  provenance: ProviderProvenanceMetadata;
}

export interface PropertySearchResponse {
  success: boolean;
  query: PropertySearchQuery;
  providerUsed: string;
  totalFound: number;
  results: NormalizedPropertyResult[];
  persistedCount: number;
  warnings?: string[];
  executionTimeMs: number;
}

export interface IPropertyDataProvider {
  readonly providerId: string;
  readonly providerName: string;
  readonly supportedCounties: string[];
  readonly supportsAddressSearch: boolean;
  readonly supportsApnSearch: boolean;
  readonly supportsOwnerSearch: boolean;
  readonly isGovernmentSource: boolean;

  search(query: PropertySearchQuery): Promise<NormalizedPropertyResult[]>;
}
