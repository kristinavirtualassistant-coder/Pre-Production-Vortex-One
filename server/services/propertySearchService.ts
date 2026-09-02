import type { Pool, QueryResultRow } from 'pg';
import { requireOrganizationId } from './organizationContext';

export interface PropertySearchQuery {
  searchText?: string;
  address?: string;
  apn?: string;
  ownerName?: string;
  city?: string;
  county?: string;
  state?: string;
  zip?: string;
  propertyType?: string;
  minUnits?: number;
  maxUnits?: number;
  minSquareFeet?: number;
  maxSquareFeet?: number;
  minYearBuilt?: number;
  maxYearBuilt?: number;
  minValue?: number;
  maxValue?: number;
  minEquity?: number;
  maxMortgage?: number;
  freeAndClear?: boolean;
  absenteeOnly?: boolean;
  corporateOwnedOnly?: boolean;
  taxDelinquentOnly?: boolean;
  ownershipDurationYearsMin?: number;
  minPortfolioProperties?: number;
  ownerMailingState?: string;
  page?: number;
  pageSize?: number;
  sortBy?: 'estimated_value' | 'estimated_equity' | 'year_built' | 'square_feet' | 'created_at';
  sortDirection?: 'asc' | 'desc';
}

export interface PropertySearchRow extends QueryResultRow {
  id: string;
  organization_id: string;
  owner_id: string | null;
  address: string;
  city: string;
  state: string;
  zip: string;
  county: string;
  apn: string;
  property_type: string;
  units_count: number;
  square_feet: number;
  year_built: number | null;
  estimated_value: string | number;
  assessed_tax_value: string | number;
  estimated_equity: string | number;
  mortgage_balance: string | number;
  is_absentee_owner: boolean;
  is_corporate_owned: boolean;
  tax_delinquent: boolean;
  last_sale_date: string | null;
  last_sale_price: string | number | null;
  provenance: Record<string, unknown>;
  owner_name: string | null;
  owner_entity_type: string | null;
  owner_mailing_state: string | null;
  portfolio_properties: number;
  total_count: string | number;
}

export interface BuiltPropertySearchQuery {
  text: string;
  values: unknown[];
}

const SORT_COLUMNS: Record<NonNullable<PropertySearchQuery['sortBy']>, string> = {
  estimated_value: 'p.estimated_value',
  estimated_equity: 'p.estimated_equity',
  year_built: 'p.year_built',
  square_feet: 'p.square_feet',
  created_at: 'p.created_at',
};

function addCondition(conditions: string[], values: unknown[], sql: string, value: unknown): void {
  values.push(value);
  conditions.push(`${sql} $${values.length}`);
}

export function buildPropertySearchQuery(organizationId: string, query: PropertySearchQuery = {}): BuiltPropertySearchQuery {
  const orgId = requireOrganizationId(organizationId);
  const values: unknown[] = [orgId];
  const conditions: string[] = ['p.organization_id = $1'];

  if (query.searchText?.trim()) {
    const term = `%${query.searchText.trim()}%`;
    values.push(term);
    const param = `$${values.length}`;
    conditions.push(`(p.address ILIKE ${param} OR p.apn ILIKE ${param} OR p.city ILIKE ${param} OR p.zip ILIKE ${param} OR o.name ILIKE ${param})`);
  }
  if (query.address?.trim()) addCondition(conditions, values, 'p.address ILIKE', `%${query.address.trim()}%`);
  if (query.apn?.trim()) addCondition(conditions, values, 'p.apn ILIKE', `%${query.apn.trim()}%`);
  if (query.ownerName?.trim()) addCondition(conditions, values, 'o.name ILIKE', `%${query.ownerName.trim()}%`);
  if (query.city?.trim()) addCondition(conditions, values, 'p.city ILIKE', `%${query.city.trim()}%`);
  if (query.county?.trim()) addCondition(conditions, values, 'p.county ILIKE', `%${query.county.trim()}%`);
  if (query.state?.trim()) addCondition(conditions, values, 'p.state ILIKE', query.state.trim());
  if (query.zip?.trim()) addCondition(conditions, values, 'p.zip ILIKE', `${query.zip.trim()}%`);
  if (query.propertyType?.trim()) addCondition(conditions, values, 'p.property_type =', query.propertyType.trim());
  if (query.minUnits !== undefined) addCondition(conditions, values, 'p.units_count >=', query.minUnits);
  if (query.maxUnits !== undefined) addCondition(conditions, values, 'p.units_count <=', query.maxUnits);
  if (query.minSquareFeet !== undefined) addCondition(conditions, values, 'p.square_feet >=', query.minSquareFeet);
  if (query.maxSquareFeet !== undefined) addCondition(conditions, values, 'p.square_feet <=', query.maxSquareFeet);
  if (query.minYearBuilt !== undefined) addCondition(conditions, values, 'p.year_built >=', query.minYearBuilt);
  if (query.maxYearBuilt !== undefined) addCondition(conditions, values, 'p.year_built <=', query.maxYearBuilt);
  if (query.minValue !== undefined) addCondition(conditions, values, 'p.estimated_value >=', query.minValue);
  if (query.maxValue !== undefined) addCondition(conditions, values, 'p.estimated_value <=', query.maxValue);
  if (query.minEquity !== undefined) addCondition(conditions, values, 'p.estimated_equity >=', query.minEquity);
  if (query.maxMortgage !== undefined) addCondition(conditions, values, 'p.mortgage_balance <=', query.maxMortgage);
  if (query.freeAndClear) conditions.push('p.mortgage_balance = 0');
  if (query.absenteeOnly) conditions.push('p.is_absentee_owner = TRUE');
  if (query.corporateOwnedOnly) conditions.push('p.is_corporate_owned = TRUE');
  if (query.taxDelinquentOnly) conditions.push('p.tax_delinquent = TRUE');
  if (query.ownerMailingState?.trim()) addCondition(conditions, values, 'o.mailing_state ILIKE', query.ownerMailingState.trim());
  if (query.minPortfolioProperties !== undefined) addCondition(conditions, values, 'COALESCE(o.properties_owned_count, 0) >=', query.minPortfolioProperties);
  if (query.ownershipDurationYearsMin !== undefined) {
    addCondition(conditions, values, "p.last_sale_date <= CURRENT_DATE - ($", Math.max(0, query.ownershipDurationYearsMin));
    // Replace the placeholder generated above with a valid interval expression.
    const idx = values.length;
    conditions[conditions.length - 1] = `p.last_sale_date <= CURRENT_DATE - ($${idx} * INTERVAL '1 year')`;
  }

  const pageSize = Math.min(200, Math.max(1, Math.floor(query.pageSize ?? 50)));
  const page = Math.max(1, Math.floor(query.page ?? 1));
  values.push(pageSize);
  const limitParam = `$${values.length}`;
  values.push((page - 1) * pageSize);
  const offsetParam = `$${values.length}`;
  const sortColumn = SORT_COLUMNS[query.sortBy ?? 'created_at'];
  const sortDirection = query.sortDirection === 'asc' ? 'ASC' : 'DESC';

  const text = `
    SELECT
      p.id, p.organization_id, p.owner_id, p.address, p.city, p.state, p.zip, p.county,
      p.apn, p.property_type, p.units_count, p.square_feet, p.year_built,
      p.estimated_value, p.assessed_tax_value, p.estimated_equity, p.mortgage_balance,
      p.is_absentee_owner, p.is_corporate_owned, p.tax_delinquent,
      p.last_sale_date, p.last_sale_price, p.provenance,
      o.name AS owner_name,
      o.entity_type AS owner_entity_type,
      o.mailing_state AS owner_mailing_state,
      COALESCE(o.properties_owned_count, 0) AS portfolio_properties,
      COUNT(*) OVER() AS total_count
    FROM properties p
    LEFT JOIN property_owners o
      ON o.id = p.owner_id AND o.organization_id = p.organization_id
    WHERE ${conditions.join('\n      AND ')}
    ORDER BY ${sortColumn} ${sortDirection}, p.id ASC
    LIMIT ${limitParam} OFFSET ${offsetParam}
  `;

  return { text, values };
}

export async function searchProperties(
  pool: Pool,
  organizationId: string,
  query: PropertySearchQuery = {},
): Promise<{ rows: PropertySearchRow[]; total: number; page: number; pageSize: number }> {
  const built = buildPropertySearchQuery(organizationId, query);
  const result = await pool.query<PropertySearchRow>(built.text, built.values);
  const pageSize = Math.min(200, Math.max(1, Math.floor(query.pageSize ?? 50)));
  const page = Math.max(1, Math.floor(query.page ?? 1));
  const total = result.rows.length > 0 ? Number(result.rows[0].total_count) : 0;
  return { rows: result.rows, total, page, pageSize };
}
