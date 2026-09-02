import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const providerDir = path.resolve(process.cwd(), 'server/services/propertyProviders');
const providerFiles = fs.readdirSync(providerDir).filter((file) => file.endsWith('Provider.ts'));

for (const file of providerFiles) {
  const source = fs.readFileSync(path.join(providerDir, file), 'utf8');
  assert.equal(
    source.includes('generateSyntheticCountyParcels'),
    false,
    `${file} must not return synthetic parcels in a production provider path`,
  );
}

const unifiedProvider = fs.readFileSync(path.join(providerDir, 'PropertyDataProvider.ts'), 'utf8');
assert.equal(
  /Tertiary fallback: Match in-memory store properties/.test(unifiedProvider),
  false,
  'PropertyDataProvider must not substitute in-memory records for unavailable live providers',
);

console.log('provider production-boundary checks passed');
