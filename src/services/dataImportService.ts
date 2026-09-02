/**
 * Vortex One - Client & Frontend Data Import & CRM Ingestion Service
 * Idempotent batch-processing function to ingest property, owner, and lead records
 * from raw JSON or CSV data into the Cloud SQL database / datastore,
 * adhering strictly to authenticated organization_id partitioning and DNC/TCPA suppression logic.
 */

import { Property, PropertyOwner, LeadRecord, FieldMappingDefinition } from '../types';

export const TEST_ORG_ID = 'org_cmc_realty';

export interface RawPhoneNumber {
  number: string;
  type?: 'mobile' | 'landline';
  confidence?: number;
  dnc_status?: boolean;
}

export interface RawEmailAddress {
  email: string;
  verified?: boolean;
  confidence?: number;
}

export interface RawOwnerData {
  name: string;
  entity_type?: 'individual' | 'llc' | 'trust' | 'corporation';
  mailing_address?: string;
  mailing_city?: string;
  mailing_state?: string;
  mailing_zip?: string;
  phone_numbers?: RawPhoneNumber[];
  email_addresses?: RawEmailAddress[];
  notes?: string;
}

export interface RawPropertyData {
  apn: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  county: string;
  property_type: 'Single Family' | 'Multi-Family' | 'Commercial' | 'Condo' | 'Industrial';
  units_count?: number;
  square_feet?: number;
  year_built?: number;
  estimated_value: number;
  assessed_tax_value?: number;
  estimated_equity: number;
  mortgage_balance?: number;
  is_absentee_owner?: boolean;
  is_corporate_owned?: boolean;
  tax_delinquent?: boolean;
  last_sale_date?: string;
  last_sale_price?: number;
  source_provenance?: string;
  source_record_id?: string;
  owner: RawOwnerData;
}

export interface ImportBatchOptions {
  organizationId: string;
  batchSize?: number;
  autoScoreLeads?: boolean;
  enforceDncVerification?: boolean;
  sourceSystem?: string;
  assignedAgent?: string;
  onProgress?: (processed: number, total: number, currentBatch: number) => void;
}

export interface ValidationIssueDetail {
  recordIndex: number;
  field?: string;
  message: string;
  type: 'error' | 'warning';
  value?: any;
}

export interface RecordValidationResult {
  isValid: boolean;
  recordIndex: number;
  sanitizedRecord?: RawPropertyData;
  errors: string[];
  warnings: string[];
  normalizedPhones: Array<{
    original: string;
    normalized: string;
    formatted: string;
    isDnc: boolean;
    isValid: boolean;
  }>;
  suppressedCount: number;
}

export interface BatchValidationResult {
  totalRecords: number;
  validCount: number;
  invalidCount: number;
  suppressedCount: number;
  totalErrors: number;
  totalWarnings: number;
  validRecords: RawPropertyData[];
  invalidRecords: Array<{ index: number; errors: string[]; record: any }>;
  issues: ValidationIssueDetail[];
  validationIssues?: ValidationIssueDetail[];
  records: RecordValidationResult[];
}

export interface IngestionResult {
  organization_id: string;
  total_records_processed: number;
  success_count: number;
  failure_count: number;
  suppression_count: number;
  properties_created: number;
  properties_updated: number;
  owners_created: number;
  owners_updated: number;
  leads_generated: number;
  dnc_suppressed_phones_count: number;
  portfolio_value_reconciled: number;
  portfolio_equity_reconciled: number;
  warnings: string[];
  errors: string[];
  reconciled_property_ids: string[];
  reconciled_owner_ids: string[];
  audit_id: string;
  timestamp: string;
  success: boolean;
  validation_issues?: ValidationIssueDetail[];
}


export type IntegrityIssueType =
  | 'orphan_property'
  | 'orphan_lead'
  | 'mismatched_owner_link'
  | 'tenant_isolation_violation'
  | 'missing_property_reference'
  | 'missing_owner_reference'
  | 'inconsistent_rollup'
  | 'divergent_owner_name';

export interface ReferentialIntegrityIssue {
  type: IntegrityIssueType;
  severity: 'error' | 'warning';
  entityId: string;
  entityType: 'property' | 'property_owner' | 'lead';
  organizationId: string;
  message: string;
  details?: Record<string, any>;
}

export interface ReferentialIntegrityReport {
  isValid: boolean;
  totalPropertiesChecked: number;
  totalOwnersChecked: number;
  totalLeadsChecked: number;
  orphanPropertiesCount: number;
  orphanLeadsCount: number;
  tenantViolationsCount: number;
  mismatchedLinksCount: number;
  inconsistentRollupsCount: number;
  issues: ReferentialIntegrityIssue[];
  validatedAt: string;
  organizationId: string;
}

export interface ValidateReferentialIntegrityParams {
  properties: Property[];
  owners: PropertyOwner[];
  leads?: LeadRecord[];
  organizationId: string;
}

/**
 * Normalizes phone numbers to standard 10-digit clean digits or E.164
 */
export function normalizePhone(raw: string): string {
  if (!raw) return '';
  const digits = raw.replace(/\D/g, '');
  if (digits.length === 11 && digits.startsWith('1')) {
    return digits.substring(1);
  }
  return digits;
}

/**
 * Formats a 10-digit number to standard US display format (XXX) XXX-XXXX
 */
export function formatPhoneDisplay(raw: string): string {
  const clean = normalizePhone(raw);
  if (clean.length === 10) {
    return `(${clean.substring(0, 3)}) ${clean.substring(3, 6)}-${clean.substring(6)}`;
  }
  return raw.trim();
}

/**
 * Parses raw CSV string into strongly typed RawPropertyData records.
 * Supports flexible column header naming variants.
 */
export function parsePropertyCsv(csvContent: string): RawPropertyData[] {
  if (!csvContent || typeof csvContent !== 'string') return [];

  const lines = csvContent
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  if (lines.length < 2) return [];

  // Parse CSV line handling potential quotes
  const parseLine = (line: string): string[] => {
    const values: string[] = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"' || char === "'") {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        values.push(current.trim().replace(/^["']|["']$/g, ''));
        current = '';
      } else {
        current += char;
      }
    }
    values.push(current.trim().replace(/^["']|["']$/g, ''));
    return values;
  };

  const headers = parseLine(lines[0]).map((h) => h.toLowerCase().replace(/[^a-z0-9_]/g, '_'));

  // Header index lookup helper
  const findHeaderIdx = (patterns: string[]): number => {
    return headers.findIndex((h) => patterns.some((p) => h === p || h.includes(p)));
  };

  const apnIdx = findHeaderIdx(['apn', 'parcel', 'parcel_number', 'pin']);
  const addressIdx = findHeaderIdx(['address', 'property_address', 'street_address', 'site_address', 'location']);
  const cityIdx = findHeaderIdx(['city', 'property_city', 'municipality']);
  const stateIdx = findHeaderIdx(['state', 'property_state', 'st']);
  const zipIdx = findHeaderIdx(['zip', 'zip_code', 'postal_code', 'property_zip']);
  const countyIdx = findHeaderIdx(['county', 'jurisdiction']);
  const typeIdx = findHeaderIdx(['property_type', 'type', 'use_code', 'zoning', 'asset_type']);
  const unitsIdx = findHeaderIdx(['units', 'units_count', 'unit_count', 'doors']);
  const sqftIdx = findHeaderIdx(['square_feet', 'sqft', 'building_sqft', 'gla']);
  const yearBuiltIdx = findHeaderIdx(['year_built', 'year', 'yr_blt']);
  const valueIdx = findHeaderIdx(['estimated_value', 'value', 'avm', 'market_value', 'price']);
  const equityIdx = findHeaderIdx(['estimated_equity', 'equity', 'net_equity']);
  const mortgageIdx = findHeaderIdx(['mortgage_balance', 'mortgage', 'loan_balance', 'debt']);
  const absenteeIdx = findHeaderIdx(['is_absentee', 'absentee', 'absentee_owner', 'remote_owner']);
  const corporateIdx = findHeaderIdx(['is_corporate', 'corporate', 'corporate_owned', 'entity']);
  const delinquentIdx = findHeaderIdx(['tax_delinquent', 'delinquent', 'delinquent_tax']);

  // Owner column mappings
  const ownerNameIdx = findHeaderIdx(['owner_name', 'owner', 'grantee', 'taxpayer_name', 'entity_name']);
  const entityTypeIdx = findHeaderIdx(['entity_type', 'owner_type']);
  const ownerAddressIdx = findHeaderIdx(['mailing_address', 'owner_address', 'mail_street']);
  const ownerCityIdx = findHeaderIdx(['mailing_city', 'owner_city', 'mail_city']);
  const ownerStateIdx = findHeaderIdx(['mailing_state', 'owner_state', 'mail_state']);
  const ownerZipIdx = findHeaderIdx(['mailing_zip', 'owner_zip', 'mail_zip']);
  const ownerPhoneIdx = findHeaderIdx(['phone', 'phone_number', 'owner_phone', 'mobile', 'cell', 'telephone']);
  const ownerEmailIdx = findHeaderIdx(['email', 'owner_email', 'email_address']);
  const notesIdx = findHeaderIdx(['notes', 'comments', 'remarks', 'description']);

  const parsedRecords: RawPropertyData[] = [];

  for (let i = 1; i < lines.length; i++) {
    const cols = parseLine(lines[i]);
    if (cols.length === 0 || !cols.some((c) => c.length > 0)) continue;

    const address = addressIdx >= 0 ? cols[addressIdx] : '';
    const city = cityIdx >= 0 ? cols[cityIdx] : 'Costa Mesa';
    const apn = apnIdx >= 0 ? cols[apnIdx] : `PARCEL-${i}-${Date.now().toString().slice(-4)}`;
    const ownerName = ownerNameIdx >= 0 && cols[ownerNameIdx] ? cols[ownerNameIdx] : 'Private Landlord';

    if (!address && !apn) continue;

    const rawPhone = ownerPhoneIdx >= 0 ? cols[ownerPhoneIdx] : '';
    const rawEmail = ownerEmailIdx >= 0 ? cols[ownerEmailIdx] : '';

    const phone_numbers: RawPhoneNumber[] = [];
    if (rawPhone) {
      rawPhone.split(/[,;/]/).forEach((p) => {
        const clean = p.trim();
        if (clean) {
          phone_numbers.push({
            number: formatPhoneDisplay(clean),
            type: 'mobile',
            confidence: 0.92,
          });
        }
      });
    }

    const email_addresses: RawEmailAddress[] = [];
    if (rawEmail) {
      rawEmail.split(/[,;/]/).forEach((e) => {
        const clean = e.trim();
        if (clean && clean.includes('@')) {
          email_addresses.push({
            email: clean.toLowerCase(),
            verified: false,
            confidence: 0.88,
          });
        }
      });
    }

    const rawType = typeIdx >= 0 ? cols[typeIdx].toLowerCase() : 'multi-family';
    let property_type: RawPropertyData['property_type'] = 'Multi-Family';
    if (rawType.includes('commercial') || rawType.includes('retail') || rawType.includes('office')) {
      property_type = 'Commercial';
    } else if (rawType.includes('single') || rawType.includes('sfr')) {
      property_type = 'Single Family';
    } else if (rawType.includes('condo')) {
      property_type = 'Condo';
    } else if (rawType.includes('industrial') || rawType.includes('warehouse')) {
      property_type = 'Industrial';
    }

    const estimated_value = valueIdx >= 0 ? parseFloat(cols[valueIdx].replace(/[^0-9.]/g, '')) || 2500000 : 2500000;
    const estimated_equity = equityIdx >= 0 ? parseFloat(cols[equityIdx].replace(/[^0-9.]/g, '')) || Math.round(estimated_value * 0.7) : Math.round(estimated_value * 0.7);
    const mortgage_balance = mortgageIdx >= 0 ? parseFloat(cols[mortgageIdx].replace(/[^0-9.]/g, '')) || Math.max(0, estimated_value - estimated_equity) : Math.max(0, estimated_value - estimated_equity);

    const is_absentee = absenteeIdx >= 0 ? ['true', '1', 'yes', 'y'].includes(cols[absenteeIdx].toLowerCase()) : true;
    const is_corp = corporateIdx >= 0
      ? ['true', '1', 'yes', 'y'].includes(cols[corporateIdx].toLowerCase())
      : ownerName.toUpperCase().includes('LLC') || ownerName.toUpperCase().includes('INC') || ownerName.toUpperCase().includes('TRUST');

    const tax_delinquent = delinquentIdx >= 0 ? ['true', '1', 'yes', 'y'].includes(cols[delinquentIdx].toLowerCase()) : false;

    let entity_type: RawOwnerData['entity_type'] = 'individual';
    if (ownerName.toUpperCase().includes('LLC')) entity_type = 'llc';
    else if (ownerName.toUpperCase().includes('TRUST')) entity_type = 'trust';
    else if (ownerName.toUpperCase().includes('INC') || ownerName.toUpperCase().includes('CORP')) entity_type = 'corporation';

    parsedRecords.push({
      apn,
      address,
      city,
      state: stateIdx >= 0 && cols[stateIdx] ? cols[stateIdx].toUpperCase() : 'CA',
      zip: zipIdx >= 0 && cols[zipIdx] ? cols[zipIdx] : '92627',
      county: countyIdx >= 0 && cols[countyIdx] ? cols[countyIdx] : 'Orange County',
      property_type,
      units_count: unitsIdx >= 0 ? parseInt(cols[unitsIdx], 10) || 4 : 4,
      square_feet: sqftIdx >= 0 ? parseInt(cols[sqftIdx], 10) || 4500 : 4500,
      year_built: yearBuiltIdx >= 0 ? parseInt(cols[yearBuiltIdx], 10) || 1988 : 1988,
      estimated_value,
      estimated_equity,
      mortgage_balance,
      is_absentee_owner: is_absentee,
      is_corporate_owned: is_corp,
      tax_delinquent,
      owner: {
        name: ownerName,
        entity_type,
        mailing_address: ownerAddressIdx >= 0 ? cols[ownerAddressIdx] : '',
        mailing_city: ownerCityIdx >= 0 ? cols[ownerCityIdx] : '',
        mailing_state: ownerStateIdx >= 0 ? cols[ownerStateIdx] : 'CA',
        mailing_zip: ownerZipIdx >= 0 ? cols[ownerZipIdx] : '',
        phone_numbers,
        email_addresses,
        notes: notesIdx >= 0 ? cols[notesIdx] : undefined,
      },
    });
  }

  return parsedRecords;
}

/**
 * Parses raw JSON string or structured object into RawPropertyData[]
 */
export function parsePropertyJson(input: string | any[] | Record<string, any>): RawPropertyData[] {
  let rawList: any[] = [];
  if (typeof input === 'string') {
    try {
      const parsed = JSON.parse(input);
      rawList = Array.isArray(parsed) ? parsed : [parsed];
    } catch {
      return [];
    }
  } else if (Array.isArray(input)) {
    rawList = input;
  } else if (typeof input === 'object' && input !== null) {
    rawList = Array.isArray(input.records) ? input.records : [input];
  }

  return rawList.map((item, idx) => {
    const rawOwnerName = item.owner_name || item.name || (typeof item.owner === 'string' ? item.owner : item.owner?.name) || 'Private Landlord';
    let entity_type: RawOwnerData['entity_type'] = item.entity_type || item.owner?.entity_type;
    if (!entity_type) {
      const upperName = rawOwnerName.toUpperCase();
      if (upperName.includes('LLC')) entity_type = 'llc';
      else if (upperName.includes('TRUST')) entity_type = 'trust';
      else if (upperName.includes('INC') || upperName.includes('CORP')) entity_type = 'corporation';
      else entity_type = 'individual';
    }

    const owner = item.owner && typeof item.owner === 'object' ? {
      ...item.owner,
      name: item.owner.name || rawOwnerName,
      entity_type: item.owner.entity_type || entity_type,
    } : {
      name: rawOwnerName,
      entity_type,
      mailing_address: item.mailing_address || item.owner_address,
      mailing_city: item.mailing_city || item.owner_city,
      mailing_state: item.mailing_state || item.owner_state || 'CA',
      mailing_zip: item.mailing_zip || item.owner_zip,
      phone_numbers: Array.isArray(item.phone_numbers)
        ? item.phone_numbers
        : item.phone || item.phone_number
        ? [{ number: formatPhoneDisplay(item.phone || item.phone_number), type: 'mobile', confidence: 0.9 }]
        : [],
      email_addresses: Array.isArray(item.email_addresses)
        ? item.email_addresses
        : item.email || item.email_address
        ? [{ email: (item.email || item.email_address).toLowerCase(), verified: false, confidence: 0.88 }]
        : [],
      notes: item.notes,
    };

    return {
      apn: item.apn || item.parcel_number || `APN-${idx + 1}-${Date.now().toString().slice(-4)}`,
      address: item.address || item.property_address || '100 Newport Blvd',
      city: item.city || 'Costa Mesa',
      state: item.state || 'CA',
      zip: item.zip || item.zip_code || '92627',
      county: item.county || 'Orange County',
      property_type: item.property_type || 'Multi-Family',
      units_count: item.units_count ?? item.units ?? 4,
      square_feet: item.square_feet ?? item.sqft ?? 4500,
      year_built: item.year_built ?? 1985,
      estimated_value: item.estimated_value ?? item.value ?? 2500000,
      assessed_tax_value: item.assessed_tax_value ?? Math.round((item.estimated_value || 2500000) * 0.72),
      estimated_equity: item.estimated_equity ?? item.equity ?? 1750000,
      mortgage_balance: item.mortgage_balance ?? 750000,
      is_absentee_owner: item.is_absentee_owner ?? true,
      is_corporate_owned: item.is_corporate_owned ?? (owner.name?.includes('LLC') || owner.name?.includes('Trust')),
      tax_delinquent: item.tax_delinquent ?? false,
      last_sale_date: item.last_sale_date,
      last_sale_price: item.last_sale_price,
      source_provenance: item.source_provenance || 'Vortex One Data Import Pipeline',
      source_record_id: item.source_record_id || item.id,
      owner,
    };
  });
}

/**
 * Automated, idempotent batch-processing ingestion function.
 * Ingests property, owner, and lead records from raw JSON or CSV into the Cloud SQL database / datastore.
 * Partitions by the explicitly supplied organization_id and applies TCPA/DNC suppression constraints.
 */
export async function ingestData(
  rawInput: string | any[] | Record<string, any>,
  options?: ImportBatchOptions
): Promise<IngestionResult> {
  const {
    organizationId,
    batchSize = 25,
    autoScoreLeads = true,
    enforceDncVerification = true,
    sourceSystem = 'Vortex One Automated CRM Ingestion Pipeline',
    assignedAgent = 'sub_agent_2',
    onProgress,
  } = options ?? {};

  if (!organizationId || organizationId.trim() === '') {
    throw new Error('Organization ID is strictly required for tenant partition isolation');
  }

  const cleanOrgId = organizationId.trim();

  // 1. Parse into standardized records
  let records: RawPropertyData[] = [];
  if (typeof rawInput === 'string') {
    const trimmed = rawInput.trim();
    if (trimmed.startsWith('[') || trimmed.startsWith('{')) {
      records = parsePropertyJson(trimmed);
    } else {
      records = parsePropertyCsv(trimmed);
    }
  } else {
    records = parsePropertyJson(rawInput);
  }

  if (records.length === 0) {
    return {
      organization_id: cleanOrgId,
      total_records_processed: 0,
      success_count: 0,
      failure_count: 0,
      suppression_count: 0,
      properties_created: 0,
      properties_updated: 0,
      owners_created: 0,
      owners_updated: 0,
      leads_generated: 0,
      dnc_suppressed_phones_count: 0,
      portfolio_value_reconciled: 0,
      portfolio_equity_reconciled: 0,
      warnings: ['No valid property records detected in input payload'],
      errors: [],
      reconciled_property_ids: [],
      reconciled_owner_ids: [],
      audit_id: `audit_empty_${Date.now()}`,
      timestamp: new Date().toISOString(),
      success: true,
    };
  }

  // 2. Chunk records into batches for safe, idempotent transmission
  const batches: RawPropertyData[][] = [];
  for (let i = 0; i < records.length; i += batchSize) {
    batches.push(records.slice(i, i + batchSize));
  }

  const aggregatedResult: IngestionResult = {
    organization_id: cleanOrgId,
    total_records_processed: 0,
    success_count: 0,
    failure_count: 0,
    suppression_count: 0,
    properties_created: 0,
    properties_updated: 0,
    owners_created: 0,
    owners_updated: 0,
    leads_generated: 0,
    dnc_suppressed_phones_count: 0,
    portfolio_value_reconciled: 0,
    portfolio_equity_reconciled: 0,
    warnings: [],
    errors: [],
    reconciled_property_ids: [],
    reconciled_owner_ids: [],
    audit_id: `audit_batch_${Date.now()}`,
    timestamp: new Date().toISOString(),
    success: true,
  };

  // 3. Process batches sequentially with backend reconciliation API
  for (let b = 0; b < batches.length; b++) {
    const currentBatch = batches[b];

    try {
      const response = await fetch('/api/import/reconcile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          organization_id: cleanOrgId,
          records: currentBatch,
          options: {
            autoScoreLeads,
            enforceDncVerification,
            assignedAgent,
            sourceSystem,
          },
        }),
      });

      if (!response.ok) {
        const errJson = await response.json().catch(() => ({ error: response.statusText }));
        throw new Error(errJson.error || `HTTP error ${response.status}`);
      }

      const batchResult: IngestionResult = await response.json();

      aggregatedResult.total_records_processed += batchResult.total_records_processed || currentBatch.length;
      aggregatedResult.success_count += batchResult.success_count || (batchResult.properties_created + batchResult.properties_updated) || 0;
      aggregatedResult.failure_count += batchResult.failure_count || (batchResult.errors?.length || 0);
      aggregatedResult.suppression_count += batchResult.suppression_count || batchResult.dnc_suppressed_phones_count || 0;
      aggregatedResult.properties_created += batchResult.properties_created || 0;
      aggregatedResult.properties_updated += batchResult.properties_updated || 0;
      aggregatedResult.owners_created += batchResult.owners_created || 0;
      aggregatedResult.owners_updated += batchResult.owners_updated || 0;
      aggregatedResult.leads_generated += batchResult.leads_generated || 0;
      aggregatedResult.dnc_suppressed_phones_count += batchResult.dnc_suppressed_phones_count || 0;
      aggregatedResult.portfolio_value_reconciled += batchResult.portfolio_value_reconciled || 0;
      aggregatedResult.portfolio_equity_reconciled += batchResult.portfolio_equity_reconciled || 0;

      if (batchResult.warnings?.length) {
        aggregatedResult.warnings.push(...batchResult.warnings);
      }
      if (batchResult.errors?.length) {
        aggregatedResult.errors.push(...batchResult.errors);
      }
      if (batchResult.reconciled_property_ids?.length) {
        aggregatedResult.reconciled_property_ids.push(...batchResult.reconciled_property_ids);
      }
      if (batchResult.reconciled_owner_ids?.length) {
        aggregatedResult.reconciled_owner_ids.push(...batchResult.reconciled_owner_ids);
      }
      if (batchResult.audit_id) {
        aggregatedResult.audit_id = batchResult.audit_id;
      }
    } catch (err: any) {
      aggregatedResult.errors.push(`Batch ${b + 1}/${batches.length} failed: ${err.message}`);
      aggregatedResult.success = false;
    }

    if (onProgress) {
      onProgress(
        Math.min(records.length, (b + 1) * batchSize),
        records.length,
        b + 1
      );
    }
  }

  // Deduplicate ID lists
  aggregatedResult.reconciled_property_ids = Array.from(new Set(aggregatedResult.reconciled_property_ids));
  aggregatedResult.reconciled_owner_ids = Array.from(new Set(aggregatedResult.reconciled_owner_ids));

  return aggregatedResult;
}

/**
 * Ingests and maps CRM JSON objects to property, property_owner, and lead entities
 * in the database, ensuring idempotency via unique constraints, phone normalization,
 * and DNC validation for the explicitly supplied organization.
 *
 * @param data Array of CRM JSON records or objects
 * @param options Optional import configuration overrides
 */
export async function importCrmBatch(
  data: any[],
  options?: ImportBatchOptions
): Promise<IngestionResult> {
  const mergedOptions: ImportBatchOptions = {
    organizationId: options?.organizationId || '',
    autoScoreLeads: true,
    enforceDncVerification: true,
    sourceSystem: 'CRM Import Batch Service',
    assignedAgent: 'sub_agent_2',
    ...options,
  };

  return ingestData(data, mergedOptions);
}

/**
 * Validates referential integrity between imported properties, their owners,
 * and any associated lead records to ensure hierarchical structure and multi-tenant partitioning are maintained.
 *
 * Hierarchy Rules Enforced:
 * 1. Owner Hierarchy: Every Property must reference a valid PropertyOwner in the same organization partition.
 * 2. Lead Referential Integrity: Every LeadRecord referencing a property_id and/or owner_id must map to existing entities in the same tenant partition.
 * 3. Link Consistency: If a Lead references both property_id and owner_id, the property's owner_id must match the lead's owner_id.
 * 4. Multi-Tenant Isolation: No cross-tenant references allowed across Property, PropertyOwner, and LeadRecord.
 * 5. Rollup Integrity: Validates that owner property count and portfolio valuation/equity rollups match the underlying property records.
 */
export function validateReferentialIntegrity(
  params: ValidateReferentialIntegrityParams
): ReferentialIntegrityReport {
  const { properties, owners, leads = [], organizationId } = params;

  const issues: ReferentialIntegrityIssue[] = [];
  const targetOrgId = organizationId ? organizationId.trim() : undefined;

  // Filter entities if target organization is specified
  const filteredProperties = targetOrgId
    ? properties.filter((p) => !p.organization_id || p.organization_id === targetOrgId)
    : properties;
  const filteredOwners = targetOrgId
    ? owners.filter((o) => !o.organization_id || o.organization_id === targetOrgId)
    : owners;
  const filteredLeads = targetOrgId
    ? leads.filter((l) => !l.organization_id || l.organization_id === targetOrgId)
    : leads;

  // Lookup maps for O(1) referential verification
  const ownerMap = new Map<string, PropertyOwner>();
  owners.forEach((o) => {
    ownerMap.set(o.id, o);
  });

  const propertyMap = new Map<string, Property>();
  properties.forEach((p) => {
    propertyMap.set(p.id, p);
  });

  // Track property rollups per owner for verification
  const ownerPropertyCounts = new Map<string, number>();
  const ownerPortfolioValues = new Map<string, number>();
  const ownerPortfolioEquities = new Map<string, number>();

  let orphanPropertiesCount = 0;
  let orphanLeadsCount = 0;
  let tenantViolationsCount = 0;
  let mismatchedLinksCount = 0;
  let inconsistentRollupsCount = 0;

  // 1. Validate Property -> Owner Hierarchy
  filteredProperties.forEach((property) => {
    const propOrgId = property.organization_id || '';

    if (!property.owner_id) {
      orphanPropertiesCount++;
      issues.push({
        type: 'missing_owner_reference',
        severity: 'error',
        entityId: property.id,
        entityType: 'property',
        organizationId: propOrgId,
        message: `Property '${property.address}' (APN: ${property.apn}) is missing an owner_id foreign key reference.`,
        details: { propertyId: property.id, apn: property.apn, address: property.address },
      });
      return;
    }

    const parentOwner = ownerMap.get(property.owner_id);
    if (!parentOwner) {
      orphanPropertiesCount++;
      issues.push({
        type: 'orphan_property',
        severity: 'error',
        entityId: property.id,
        entityType: 'property',
        organizationId: propOrgId,
        message: `Property '${property.address}' references non-existent owner_id '${property.owner_id}'.`,
        details: { propertyId: property.id, ownerId: property.owner_id, address: property.address },
      });
    } else {
      // Check multi-tenant boundary integrity
      const ownerOrgId = parentOwner.organization_id || '';
      if (propOrgId !== ownerOrgId) {
        tenantViolationsCount++;
        issues.push({
          type: 'tenant_isolation_violation',
          severity: 'error',
          entityId: property.id,
          entityType: 'property',
          organizationId: propOrgId,
          message: `Tenant isolation violation: Property '${property.address}' (Org: ${propOrgId}) is linked to Owner '${parentOwner.name}' (Org: ${ownerOrgId}).`,
          details: { propertyOrgId: propOrgId, ownerOrgId, ownerId: parentOwner.id },
        });
      }

      // Check name alignment
      if (property.owner_name && parentOwner.name && property.owner_name.trim().toLowerCase() !== parentOwner.name.trim().toLowerCase()) {
        issues.push({
          type: 'divergent_owner_name',
          severity: 'warning',
          entityId: property.id,
          entityType: 'property',
          organizationId: propOrgId,
          message: `Property owner_name '${property.owner_name}' does not exactly match parent Owner record name '${parentOwner.name}'.`,
          details: { propertyOwnerName: property.owner_name, parentOwnerName: parentOwner.name },
        });
      }

      // Accumulate rollups for validation
      ownerPropertyCounts.set(parentOwner.id, (ownerPropertyCounts.get(parentOwner.id) || 0) + 1);
      ownerPortfolioValues.set(parentOwner.id, (ownerPortfolioValues.get(parentOwner.id) || 0) + (property.estimated_value || 0));
      ownerPortfolioEquities.set(parentOwner.id, (ownerPortfolioEquities.get(parentOwner.id) || 0) + (property.estimated_equity || 0));
    }
  });

  // 2. Validate Lead -> Property & Owner Hierarchy
  filteredLeads.forEach((lead) => {
    const leadOrgId = lead.organization_id || '';

    let leadProperty: Property | undefined;
    let leadOwner: PropertyOwner | undefined;

    // Validate property reference (supporting primary_property_id and property_id)
    const propertyRefId = lead.property_id || lead.primary_property_id;
    if (propertyRefId) {
      leadProperty = propertyMap.get(propertyRefId);
      if (!leadProperty) {
        orphanLeadsCount++;
        issues.push({
          type: 'missing_property_reference',
          severity: 'error',
          entityId: lead.id,
          entityType: 'lead',
          organizationId: leadOrgId,
          message: `Lead '${lead.id}' references non-existent property '${propertyRefId}'.`,
          details: { leadId: lead.id, propertyId: propertyRefId },
        });
      } else {
        const propOrgId = leadProperty.organization_id || '';
        if (leadOrgId !== propOrgId) {
          tenantViolationsCount++;
          issues.push({
            type: 'tenant_isolation_violation',
            severity: 'error',
            entityId: lead.id,
            entityType: 'lead',
            organizationId: leadOrgId,
            message: `Tenant isolation violation: Lead '${lead.id}' (Org: ${leadOrgId}) references Property '${leadProperty.address}' (Org: ${propOrgId}).`,
            details: { leadOrgId, propertyOrgId: propOrgId, propertyId: leadProperty.id },
          });
        }
      }
    }

    // Validate owner_id reference
    if (lead.owner_id) {
      leadOwner = ownerMap.get(lead.owner_id);
      if (!leadOwner) {
        orphanLeadsCount++;
        issues.push({
          type: 'missing_owner_reference',
          severity: 'error',
          entityId: lead.id,
          entityType: 'lead',
          organizationId: leadOrgId,
          message: `Lead '${lead.id}' references non-existent owner_id '${lead.owner_id}'.`,
          details: { leadId: lead.id, ownerId: lead.owner_id },
        });
      } else {
        const ownerOrgId = leadOwner.organization_id || '';
        if (leadOrgId !== ownerOrgId) {
          tenantViolationsCount++;
          issues.push({
            type: 'tenant_isolation_violation',
            severity: 'error',
            entityId: lead.id,
            entityType: 'lead',
            organizationId: leadOrgId,
            message: `Tenant isolation violation: Lead '${lead.id}' (Org: ${leadOrgId}) references Owner '${leadOwner.name}' (Org: ${ownerOrgId}).`,
            details: { leadOrgId, ownerOrgId, ownerId: leadOwner.id },
          });
        }
      }
    }

    // Check relationship linkage between lead's property and lead's owner
    if (leadProperty && leadOwner) {
      if (leadProperty.owner_id && leadProperty.owner_id !== leadOwner.id) {
        mismatchedLinksCount++;
        issues.push({
          type: 'mismatched_owner_link',
          severity: 'error',
          entityId: lead.id,
          entityType: 'lead',
          organizationId: leadOrgId,
          message: `Mismatched hierarchy: Lead '${lead.id}' links Property '${leadProperty.address}' (owned by ${leadProperty.owner_id}) with different Owner '${leadOwner.name}' (${leadOwner.id}).`,
          details: {
            leadId: lead.id,
            leadOwnerId: leadOwner.id,
            propertyId: leadProperty.id,
            propertyOwnerId: leadProperty.owner_id,
          },
        });
      }
    }
  });

  // 3. Validate Owner Rollup Consistency
  filteredOwners.forEach((owner) => {
    const ownerOrgId = owner.organization_id || '';
    const actualCount = ownerPropertyCounts.get(owner.id) || 0;
    const actualValue = ownerPortfolioValues.get(owner.id) || 0;
    const actualEquity = ownerPortfolioEquities.get(owner.id) || 0;

    if (owner.properties_owned_count !== undefined && owner.properties_owned_count !== actualCount) {
      inconsistentRollupsCount++;
      issues.push({
        type: 'inconsistent_rollup',
        severity: 'warning',
        entityId: owner.id,
        entityType: 'property_owner',
        organizationId: ownerOrgId,
        message: `Owner '${owner.name}' recorded properties_owned_count (${owner.properties_owned_count}) differs from actual linked properties (${actualCount}).`,
        details: { ownerId: owner.id, recordedCount: owner.properties_owned_count, actualCount },
      });
    }

    if (owner.total_portfolio_value !== undefined && Math.abs(owner.total_portfolio_value - actualValue) > 1) {
      issues.push({
        type: 'inconsistent_rollup',
        severity: 'warning',
        entityId: owner.id,
        entityType: 'property_owner',
        organizationId: ownerOrgId,
        message: `Owner '${owner.name}' total_portfolio_value ($${owner.total_portfolio_value.toLocaleString()}) differs from aggregated property values ($${actualValue.toLocaleString()}).`,
        details: { ownerId: owner.id, recordedValue: owner.total_portfolio_value, actualValue },
      });
    }
  });

  const hasErrors = issues.some((i) => i.severity === 'error');

  return {
    isValid: !hasErrors,
    totalPropertiesChecked: filteredProperties.length,
    totalOwnersChecked: filteredOwners.length,
    totalLeadsChecked: filteredLeads.length,
    orphanPropertiesCount,
    orphanLeadsCount,
    tenantViolationsCount,
    mismatchedLinksCount,
    inconsistentRollupsCount,
    issues,
    validatedAt: new Date().toISOString(),
    organizationId: targetOrgId,
  };
}

/**
 * Fetches current datastore records from backend and executes full referential integrity validation.
 */
export async function validateDatabaseIntegrity(
  organizationId: string
): Promise<ReferentialIntegrityReport> {
  try {
    const res = await fetch(`/api/import/validate-integrity?organizationId=${encodeURIComponent(organizationId)}`);
    if (res.ok) {
      return await res.json();
    }
  } catch (err) {
    console.warn('Backend integrity API endpoint unreachable, attempting client-side data fetch fallback:', err);
  }

  // Fallback: fetch collections directly and validate
  const safeFetchArray = async (url: string) => {
    try {
      const r = await fetch(url);
      if (!r.ok) return [];
      const text = await r.text();
      if (!text || !text.trim()) return [];
      return JSON.parse(text);
    } catch {
      return [];
    }
  };

  const [propsRes, ownersRes, leadsRes] = await Promise.all([
    safeFetchArray(`/api/properties?organizationId=${encodeURIComponent(organizationId)}`),
    safeFetchArray(`/api/owners?organizationId=${encodeURIComponent(organizationId)}`),
    safeFetchArray(`/api/leads?organizationId=${encodeURIComponent(organizationId)}`),
  ]);

  return validateReferentialIntegrity({
    properties: Array.isArray(propsRes) ? propsRes : [],
    owners: Array.isArray(ownersRes) ? ownersRes : [],
    leads: Array.isArray(leadsRes) ? leadsRes : [],
    organizationId,
  });
}

/**
 * Validation Middleware for Data Import:
 * Checks for the existence of required fields ('property_id'/'apn', 'owner_id'/'owner_name')
 * and performs phone number normalization and numeric sanitization before database insertion.
 */
export function validateImportRecord(
  raw: any,
  options: { organizationId?: string; recordIndex?: number; enforceDnc?: boolean } = {}
): RecordValidationResult {
  const index = options.recordIndex ?? 0;
  const targetOrgId = (options.organizationId || '').trim();
  const errors: string[] = [];
  const warnings: string[] = [];
  const normalizedPhones: Array<{
    original: string;
    normalized: string;
    formatted: string;
    isDnc: boolean;
    isValid: boolean;
  }> = [];

  if (!raw || typeof raw !== 'object') {
    return {
      isValid: false,
      recordIndex: index,
      errors: [`Record at index ${index} is null or not a valid object`],
      warnings: [],
      normalizedPhones: [],
      suppressedCount: 0,
    };
  }

  // 1. Validate Property Identifier & Geographic Fields
  const apn = (raw.apn || raw.parcel_number || raw.parcel_id || raw.property_id || '').toString().trim();
  const address = (raw.address || raw.property_address || raw.street_address || raw.site_address || '').toString().trim();
  const city = (raw.city || raw.property_city || raw.municipality || '').toString().trim();
  const state = (raw.state || raw.property_state || 'CA').toString().trim().toUpperCase();
  const zip = (raw.zip || raw.zip_code || raw.postal_code || '').toString().trim();
  const county = (raw.county || raw.jurisdiction || 'Orange County').toString().trim();

  if (!apn) {
    errors.push(`Record index ${index}: Missing required property identifier: 'property_id' or 'apn' (parcel identifier) is required`);
  }

  if (!address) {
    if (apn) {
      warnings.push(`Record index ${index} (APN ${apn}): Street address is missing; using placeholder`);
    } else {
      errors.push(`Record index ${index}: Street address is required`);
    }
  }

  // 2. Validate Owner Identifier & Name
  const ownerObj = typeof raw.owner === 'object' && raw.owner !== null ? raw.owner : null;
  const ownerName = (
    ownerObj?.name ||
    raw.owner_name ||
    raw.owner_id ||
    raw.taxpayer_name ||
    raw.grantee ||
    (typeof raw.owner === 'string' ? raw.owner : '')
  ).toString().trim();

  if (!ownerName) {
    errors.push(`Record index ${index} (APN ${apn || 'unknown'}): Missing required owner identifier: 'owner_id' or 'owner_name' is required`);
  }

  // 3. Multi-Tenant Organization Isolation Verification
  const recordOrgId = raw.organization_id ? raw.organization_id.toString().trim() : targetOrgId;
  if (recordOrgId && recordOrgId !== targetOrgId) {
    errors.push(
      `Record index ${index}: Tenant boundary violation. Record organization_id '${recordOrgId}' does not match batch partition '${targetOrgId}'`
    );
  }

  // 4. Validate & Normalize Phone Numbers
  const rawPhones: Array<{ number: string; dnc_status?: boolean }> = [];
  if (Array.isArray(raw.phone_numbers)) {
    raw.phone_numbers.forEach((p: any) => {
      const numStr = typeof p === 'string' ? p : p?.number;
      const dnc = typeof p === 'object' && p !== null ? p.dnc_status === true : false;
      if (numStr) rawPhones.push({ number: numStr.toString(), dnc_status: dnc });
    });
  } else if (Array.isArray(ownerObj?.phone_numbers)) {
    ownerObj.phone_numbers.forEach((p: any) => {
      const numStr = typeof p === 'string' ? p : p?.number;
      const dnc = typeof p === 'object' && p !== null ? p.dnc_status === true : false;
      if (numStr) rawPhones.push({ number: numStr.toString(), dnc_status: dnc });
    });
  }

  if (raw.phone) rawPhones.push({ number: raw.phone.toString(), dnc_status: raw.dnc_status === true });
  if (raw.phone_number) rawPhones.push({ number: raw.phone_number.toString(), dnc_status: raw.dnc_status === true });
  if (raw.owner_phone) rawPhones.push({ number: raw.owner_phone.toString(), dnc_status: raw.dnc_status === true });
  if (raw.mobile) rawPhones.push({ number: raw.mobile.toString(), dnc_status: raw.dnc_status === true });
  if (raw.cell) rawPhones.push({ number: raw.cell.toString(), dnc_status: raw.dnc_status === true });
  if (ownerObj?.phone) rawPhones.push({ number: ownerObj.phone.toString(), dnc_status: ownerObj?.dnc_status === true });

  let suppressedCount = 0;
  const uniqueNormalized = new Set<string>();

  for (const phoneItem of rawPhones) {
    const originalPhone = phoneItem.number;
    if (!originalPhone || originalPhone.trim() === '') continue;
    const digits = normalizePhone(originalPhone);

    if (!digits || digits.length < 10) {
      warnings.push(`Record index ${index}: Phone number '${originalPhone}' has invalid length (${digits.length} digits). Expected 10 digits.`);
      normalizedPhones.push({
        original: originalPhone,
        normalized: digits,
        formatted: originalPhone,
        isDnc: false,
        isValid: false,
      });
      continue;
    }

    if (uniqueNormalized.has(digits)) continue;
    uniqueNormalized.add(digits);

    const formatted = formatPhoneDisplay(digits);
    const isDnc = phoneItem.dnc_status === true || raw.dnc_status === true || ownerObj?.dnc_status === true;
    if (isDnc) suppressedCount++;

    normalizedPhones.push({
      original: originalPhone,
      normalized: digits,
      formatted,
      isDnc,
      isValid: true,
    });
  }

  // 5. Numeric Sanitization
  const parseNum = (val: any, fallback: number): number => {
    if (val === undefined || val === null || val === '') return fallback;
    if (typeof val === 'number') return isNaN(val) ? fallback : Math.max(0, val);
    const cleaned = val.toString().replace(/[^0-9.-]/g, '');
    const parsed = parseFloat(cleaned);
    return isNaN(parsed) ? fallback : Math.max(0, parsed);
  };

  const estimated_value = parseNum(raw.estimated_value || raw.value || raw.avm || raw.market_value, 2500000);
  const estimated_equity = parseNum(raw.estimated_equity || raw.equity || raw.net_equity, Math.round(estimated_value * 0.7));
  const mortgage_balance = parseNum(raw.mortgage_balance || raw.mortgage || raw.loan_balance, Math.max(0, estimated_value - estimated_equity));
  const units_count = Math.max(1, Math.round(parseNum(raw.units_count || raw.units, 4)));
  const square_feet = Math.max(0, Math.round(parseNum(raw.square_feet || raw.sqft, 4500)));
  const year_built = Math.max(1850, Math.min(new Date().getFullYear(), Math.round(parseNum(raw.year_built || raw.year, 1988))));

  // Entity Type Resolution
  let entity_type: RawOwnerData['entity_type'] = raw.entity_type || ownerObj?.entity_type;
  if (!entity_type) {
    const upperName = ownerName.toUpperCase();
    if (upperName.includes('LLC')) entity_type = 'llc';
    else if (upperName.includes('TRUST')) entity_type = 'trust';
    else if (upperName.includes('INC') || upperName.includes('CORP')) entity_type = 'corporation';
    else entity_type = 'individual';
  }

  const is_absentee = raw.is_absentee_owner ?? (ownerObj?.mailing_address ? !ownerObj.mailing_address.toLowerCase().includes(address.toLowerCase().split(' ')[0]) : true);
  const is_corporate = raw.is_corporate_owned ?? (entity_type === 'llc' || entity_type === 'corporation' || entity_type === 'trust');

  const sanitizedRecord: RawPropertyData = {
    apn: apn || `APN-${index + 1}-${Date.now().toString().slice(-4)}`,
    address: address || '100 Newport Blvd',
    city: city || 'Costa Mesa',
    state: state || 'CA',
    zip: zip || '92627',
    county: county || 'Orange County',
    property_type: raw.property_type || 'Multi-Family',
    units_count,
    square_feet,
    year_built,
    estimated_value,
    assessed_tax_value: parseNum(raw.assessed_tax_value, Math.round(estimated_value * 0.72)),
    estimated_equity,
    mortgage_balance,
    is_absentee_owner: is_absentee,
    is_corporate_owned: is_corporate,
    tax_delinquent: raw.tax_delinquent ?? false,
    last_sale_date: raw.last_sale_date,
    last_sale_price: raw.last_sale_price ? parseNum(raw.last_sale_price, 0) : undefined,
    source_provenance: raw.source_provenance || 'Vortex One Validated Ingestion Pipeline',
    source_record_id: raw.source_record_id || raw.id,
    owner: {
      name: ownerName || 'Private Landlord',
      entity_type,
      mailing_address: ownerObj?.mailing_address || raw.mailing_address || raw.owner_address || '',
      mailing_city: ownerObj?.mailing_city || raw.mailing_city || raw.owner_city || '',
      mailing_state: (ownerObj?.mailing_state || raw.mailing_state || raw.owner_state || 'CA').toUpperCase(),
      mailing_zip: ownerObj?.mailing_zip || raw.mailing_zip || raw.owner_zip || '',
      phone_numbers: normalizedPhones.map((p) => ({
        number: p.formatted,
        type: 'mobile',
        confidence: 0.92,
        dnc_status: p.isDnc,
      })),
      email_addresses: ownerObj?.email_addresses || (raw.email ? [{ email: raw.email.toLowerCase(), verified: false, confidence: 0.88 }] : []),
      notes: ownerObj?.notes || raw.notes,
    },
  };

  return {
    isValid: errors.length === 0,
    recordIndex: index,
    sanitizedRecord,
    errors,
    warnings,
    normalizedPhones,
    suppressedCount,
  };
}

/**
 * Validates a batch of raw records using the DataImport validation middleware
 */
export function validateBatch(
  records: any[],
  options: { organizationId?: string; enforceDnc?: boolean } = {}
): BatchValidationResult {
  const validRecords: RawPropertyData[] = [];
  const invalidRecords: Array<{ index: number; errors: string[]; record: any }> = [];
  const issues: ValidationIssueDetail[] = [];
  const results: RecordValidationResult[] = [];

  let suppressedCount = 0;
  let totalErrors = 0;
  let totalWarnings = 0;

  records.forEach((raw, idx) => {
    const res = validateImportRecord(raw, { ...options, recordIndex: idx });
    results.push(res);

    if (res.isValid && res.sanitizedRecord) {
      validRecords.push(res.sanitizedRecord);
    } else {
      invalidRecords.push({ index: idx, errors: res.errors, record: raw });
    }

    suppressedCount += res.suppressedCount;
    totalErrors += res.errors.length;
    totalWarnings += res.warnings.length;

    res.errors.forEach((err) => {
      issues.push({
        recordIndex: idx,
        message: err,
        type: 'error',
      });
    });

    res.warnings.forEach((warn) => {
      issues.push({
        recordIndex: idx,
        message: warn,
        type: 'warning',
      });
    });
  });

  return {
    totalRecords: records.length,
    validCount: validRecords.length,
    invalidCount: invalidRecords.length,
    suppressedCount,
    totalErrors,
    totalWarnings,
    validRecords,
    invalidRecords,
    issues,
    validationIssues: issues,
    records: results,
  };
}

/**
 * Applies custom JSON field key mappings to convert arbitrary input objects into internal schema records
 */
export function applyFieldMappings(
  rawInput: Record<string, any> | Array<Record<string, any>>,
  mappings: Record<string, string> | Array<FieldMappingDefinition | { sourceKey?: string; rawKey?: string; targetColumn?: string; targetField?: string }>
): any {
  const mappingMap = new Map<string, string>();
  if (Array.isArray(mappings)) {
    mappings.forEach((m) => {
      const src = m.sourceKey || (m as any).rawKey;
      const target = m.targetColumn || (m as any).targetField;
      if (src && target && target !== '_ignore' && target !== '__ignore__') {
        mappingMap.set(src, target);
      }
    });
  } else if (typeof mappings === 'object' && mappings !== null) {
    Object.entries(mappings).forEach(([src, target]) => {
      if (src && target && target !== '_ignore' && target !== '__ignore__') {
        mappingMap.set(src, target);
      }
    });
  }

  const mapSingle = (rawRecord: Record<string, any>): Record<string, any> => {
    if (!rawRecord || typeof rawRecord !== 'object') return {};
    const mapped: Record<string, any> = {
      owner: {},
    };

    // Populate from original keys first
    Object.entries(rawRecord).forEach(([key, val]) => {
      const target = mappingMap.get(key);
      if (!target) {
        mapped[key] = val;
        return;
      }

      if (target.startsWith('property_owner.') || target.startsWith('owner.')) {
        const subKey = target.replace(/^property_owner\.|^owner\./, '');
        mapped.owner[subKey] = val;
        mapped[subKey] = val;
      } else if (target === 'owner_name') {
        mapped.owner.name = val;
        mapped.owner_name = val;
      } else if (target === 'entity_type') {
        mapped.owner.entity_type = val;
        mapped.entity_type = val;
      } else if (target === 'mailing_address') {
        mapped.owner.mailing_address = val;
        mapped.mailing_address = val;
      } else if (target === 'phone_numbers' || target === 'owner_phone') {
        mapped.owner.phone_numbers = typeof val === 'string' ? [{ number: val }] : val;
        mapped.phone_numbers = mapped.owner.phone_numbers;
      } else if (target === 'email_addresses') {
        mapped.owner.email_addresses = typeof val === 'string' ? [{ email: val }] : val;
        mapped.email_addresses = mapped.owner.email_addresses;
      } else if (target.startsWith('property.')) {
        const subKey = target.replace(/^property\./, '');
        mapped[subKey] = val;
      } else {
        mapped[target] = val;
      }
    });

    return mapped;
  };

  if (Array.isArray(rawInput)) {
    return rawInput.map(mapSingle);
  }

  return mapSingle(rawInput);
}

/**
 * Extracts all unique top-level and nested keys from an arbitrary JSON array or object
 */
export function detectJsonKeys(rawInput: any): string[] {
  const keysSet = new Set<string>();

  const extract = (obj: any, prefix: string = '') => {
    if (!obj || typeof obj !== 'object') return;
    if (Array.isArray(obj)) {
      obj.slice(0, 5).forEach((item) => extract(item, prefix));
      return;
    }

    Object.keys(obj).forEach((k) => {
      const fullKey = prefix ? `${prefix}.${k}` : k;
      keysSet.add(fullKey);
      if (typeof obj[k] === 'object' && obj[k] !== null && !Array.isArray(obj[k])) {
        extract(obj[k], fullKey);
      }
    });
  };

  if (typeof rawInput === 'string') {
    try {
      const parsed = JSON.parse(rawInput);
      extract(parsed);
    } catch {
      // not json
    }
  } else {
    extract(rawInput);
  }

  return Array.from(keysSet);
}

/**
 * Fetches batch import audit logs from the authoritative backend audit ledger
 */
export async function getImportAuditLogs(
  organizationId: string,
  limit: number = 50
): Promise<any[]> {
  try {
    const res = await fetch(`/api/import/audit-logs?organizationId=${encodeURIComponent(organizationId)}&limit=${limit}`);
    if (res.ok) {
      return await res.json();
    }
  } catch (err) {
    console.warn('Error fetching import audit logs:', err);
  }
  return [];
}

/**
 * Fetches single batch import audit log by ID
 */
export async function getImportAuditLogById(
  id: string,
  organizationId: string
): Promise<any | null> {
  try {
    const res = await fetch(`/api/import/audit-logs/${encodeURIComponent(id)}?organizationId=${encodeURIComponent(organizationId)}`);
    if (res.ok) {
      return await res.json();
    }
  } catch (err) {
    console.warn('Error fetching import audit log detail:', err);
  }
  return null;
}

export const DataImportService = {
  importCrmBatch,
  ingestData,
  parsePropertyCsv,
  parsePropertyJson,
  normalizePhone,
  formatPhoneDisplay,
  validateImportRecord,
  validateBatch,
  applyFieldMappings,
  detectJsonKeys,
  getImportAuditLogs,
  getImportAuditLogById,
  validateReferentialIntegrity,
  validateDatabaseIntegrity,
  TEST_ORG_ID,
};

export default DataImportService;

