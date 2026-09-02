import assert from 'node:assert/strict';
import { buildPropertySearchQuery, searchProperties } from '../services/propertySearchService';

const built = buildPropertySearchQuery('org_test', {
  searchText: '1420 Newport',
  county: 'Orange',
  city: 'Costa Mesa',
  minValue: 1000000,
  minEquity: 500000,
  absenteeOnly: true,
  corporateOwnedOnly: true,
  taxDelinquentOnly: true,
  freeAndClear: true,
  minPortfolioProperties: 3,
  ownershipDurationYearsMin: 10,
  page: 2,
  pageSize: 25,
  sortBy: 'estimated_equity',
  sortDirection: 'asc',
});

assert.match(built.text, /p\.organization_id = \$1/);
assert.match(built.text, /p\.county ILIKE/);
assert.match(built.text, /p\.address ILIKE \$\d+ OR p\.apn ILIKE/);
assert.match(built.text, /p\.city ILIKE/);
assert.match(built.text, /p\.estimated_value >=/);
assert.match(built.text, /p\.estimated_equity >=/);
assert.match(built.text, /p\.is_absentee_owner = TRUE/);
assert.match(built.text, /p\.is_corporate_owned = TRUE/);
assert.match(built.text, /p\.tax_delinquent = TRUE/);
assert.match(built.text, /p\.mortgage_balance = 0/);
assert.match(built.text, /o\.properties_owned_count/);
assert.match(built.text, /p\.last_sale_date <= CURRENT_DATE/);
assert.match(built.text, /ORDER BY p\.estimated_equity ASC/);
assert.match(built.text, /LIMIT \$\d+ OFFSET \$\d+/);
assert.equal(built.values[0], 'org_test');
assert.equal(built.values.at(-2), 25);
assert.equal(built.values.at(-1), 25);

assert.throws(
  () => buildPropertySearchQuery(''),
  /Organization ID is required/,
);

console.log('property search service tests passed');


const fakePool = {
  async query(text: string, values: unknown[]) {
    assert.match(text, /p\.organization_id = \$1/);
    assert.equal(values[0], 'org_test');
    return {
      rows: [{
        id: 'prop_1', organization_id: 'org_test', owner_id: 'owner_1',
        address: '1 Main St', city: 'Costa Mesa', state: 'CA', zip: '92627', county: 'Orange',
        apn: '123-456-78', property_type: 'Multi-Family', units_count: 4, square_feet: 3000,
        year_built: 1980, estimated_value: '2000000', assessed_tax_value: '1500000',
        estimated_equity: '1200000', mortgage_balance: '800000', is_absentee_owner: true,
        is_corporate_owned: true, tax_delinquent: false, last_sale_date: '2010-01-01',
        last_sale_price: '1000000', provenance: {}, owner_name: 'Test Owner',
        owner_entity_type: 'llc', owner_mailing_state: 'NV', portfolio_properties: 5,
        total_count: '1',
      }],
    };
  },
};

const searchResult = await searchProperties(fakePool as any, 'org_test', { minEquity: 1000000, pageSize: 10 });
assert.equal(searchResult.total, 1);
assert.equal(searchResult.page, 1);
assert.equal(searchResult.pageSize, 10);
assert.equal(searchResult.rows[0].organization_id, 'org_test');
console.log('property search database execution test passed');
