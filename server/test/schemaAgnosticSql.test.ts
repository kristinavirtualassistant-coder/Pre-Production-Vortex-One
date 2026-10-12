/**
 * The app must work when its tables live outside `public` (e.g. a dedicated schema selected by the role's search_path,
 * as on the shared Supabase project). Catalog lookups therefore use current_schema(), never a hard-coded 'public'.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const walk = (dir: string): string[] => fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(path.join(dir, e.name)) : [path.join(dir, e.name)]));

const files = walk('server').concat(['server.ts']).filter((f) => f.endsWith('.ts') && !f.includes(`${path.sep}test${path.sep}`));
const offenders: string[] = [];
for (const file of files) {
  const source = fs.readFileSync(file, 'utf8');
  if (/table_schema\s*=\s*'public'|schemaname\s*=\s*'public'|to_regclass\('public\./i.test(source)) offenders.push(file);
}
assert.deepEqual(offenders, [], `catalog lookups must use current_schema(), not 'public': ${offenders.join(', ')}`);

const auth = fs.readFileSync('server/db/postgresqlAuthSchema.ts', 'utf8');
assert.match(auth, /current_schema\(\)/, 'auth schema check resolves tables in the current schema');
console.log('Schema-agnostic SQL guard passed.');
