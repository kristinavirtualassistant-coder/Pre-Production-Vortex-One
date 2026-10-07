import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const route = fs.readFileSync(path.join(process.cwd(), 'server/routes/analytics.ts'), 'utf8');
assert.ok(route.includes("analyticsRouter.post('/value-events'"), 'Analytics value event endpoint exists');
assert.ok(route.includes("requireRole(['admin','executive','manager'])"), 'Value events require management-level RBAC');
assert.ok(route.includes("organization_id=$2"), 'Value event references are tenant-scoped');
assert.ok(route.includes("'revenue','acquisition_value','management_value','other'"), 'Value event types are explicit');

console.log('Analytics value event boundary tests passed');
