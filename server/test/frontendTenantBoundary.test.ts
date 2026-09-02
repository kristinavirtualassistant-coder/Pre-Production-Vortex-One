import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const projectRoot = process.cwd();
const appSource = fs.readFileSync(path.join(projectRoot, 'src/App.tsx'), 'utf8');
assert.equal(/\|\|\s*['"]org_cmc_realty['"]/.test(appSource), false, 'App must not fall back to CMC tenant');

const componentDir = path.join(projectRoot, 'src/components');
for (const file of fs.readdirSync(componentDir).filter((name) => /\.(tsx|ts)$/.test(name))) {
  const source = fs.readFileSync(path.join(componentDir, file), 'utf8');
  assert.equal(
    /organization(?:_id|Id)\s*[:=]\s*['"]org_cmc_realty['"]/.test(source),
    false,
    `${file} contains a hard-coded runtime tenant assignment`,
  );
  assert.equal(
    /[?&]organizationId=org_cmc_realty/.test(source),
    false,
    `${file} contains a hard-coded tenant query parameter`,
  );
}

const importService = fs.readFileSync(path.join(projectRoot, 'src/services/dataImportService.ts'), 'utf8');
assert.equal(/organizationId\s*=\s*TEST_ORG_ID/.test(importService), false);
assert.equal(/organizationId\s*=\s*DEFAULT_ORG_ID/.test(importService), false);

console.log('frontend tenant-boundary checks passed');
