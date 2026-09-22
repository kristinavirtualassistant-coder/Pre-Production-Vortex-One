import assert from 'node:assert/strict';
import { buildAuthenticatedUserLookupSql } from '../middleware/auth';
import { buildCallPersistencePlan } from '../db/legacySchemaCompatibility';

assert.match(buildAuthenticatedUserLookupSql(), /JOIN memberships m ON m\.user_id = u\.id/);
assert.doesNotMatch(buildAuthenticatedUserLookupSql(), /u\.organization_id/);

const plan = buildCallPersistencePlan([
  { column_name: 'id', is_nullable: 'NO', column_default: null },
  { column_name: 'started_at', is_nullable: 'NO', column_default: null },
  { column_name: 'provider', is_nullable: 'YES', column_default: null },
  { column_name: 'provider_call_id', is_nullable: 'YES', column_default: null },
  { column_name: 'connection_status', is_nullable: 'YES', column_default: null },
  { column_name: 'created_at', is_nullable: 'NO', column_default: 'now()' },
]);
assert.equal(plan.ready, true);
assert.deepEqual(plan.columns, ['id', 'started_at', 'connection_status', 'provider', 'provider_call_id', 'created_at']);

const blocked = buildCallPersistencePlan([
  { column_name: 'id', is_nullable: 'NO', column_default: null },
  { column_name: 'prospect_id', is_nullable: 'NO', column_default: null },
  { column_name: 'started_at', is_nullable: 'NO', column_default: null },
]);
assert.equal(blocked.ready, false);
assert.deepEqual(blocked.missingRequiredColumns, ['prospect_id']);

console.log('Legacy schema compatibility tests passed.');
