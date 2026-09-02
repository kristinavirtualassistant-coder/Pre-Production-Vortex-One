import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const serverSource = fs.readFileSync(path.resolve(process.cwd(), 'server.ts'), 'utf8');

const forbiddenPatterns = [
  /\|\|\s*['"]org_cmc_realty['"]/g,
  /\?\s*['"]org_cmc_realty['"]\s*:/g,
  /\borganizationId\s*=\s*['"]org_cmc_realty['"]/g,
];

for (const pattern of forbiddenPatterns) {
  assert.equal(
    serverSource.match(pattern),
    null,
    `server.ts contains a runtime tenant fallback matching ${pattern}`,
  );
}

assert.equal(
  /organization_id:\s*['"]org_cmc_realty['"]/.test(serverSource),
  false,
  'server.ts must not stamp runtime audit records with a hard-coded tenant',
);

console.log('tenant fallback regression checks passed');
