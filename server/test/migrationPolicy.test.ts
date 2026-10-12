import assert from 'node:assert/strict';
import { shouldSkipPostgresMigrations } from '../db/migrationPolicy';

const original = process.env.VORTEX_ONE_SKIP_MIGRATIONS;

delete process.env.VORTEX_ONE_SKIP_MIGRATIONS;
assert.equal(shouldSkipPostgresMigrations(), false);

process.env.VORTEX_ONE_SKIP_MIGRATIONS = 'true';
assert.equal(shouldSkipPostgresMigrations(), true);

process.env.VORTEX_ONE_SKIP_MIGRATIONS = 'TRUE';
assert.equal(shouldSkipPostgresMigrations(), false);

if (original === undefined) delete process.env.VORTEX_ONE_SKIP_MIGRATIONS;
else process.env.VORTEX_ONE_SKIP_MIGRATIONS = original;

// The migration chain must be unique and applied in ascending order (the runner applies array order).
const { MIGRATIONS } = await import('../db/migrations');
const versions = MIGRATIONS.map((m) => m.version);
assert.equal(new Set(versions).size, versions.length, 'migration versions are unique');
assert.deepEqual(versions, [...versions].sort((a, b) => a - b), 'migrations are declared in ascending version order');
const names = MIGRATIONS.map((m) => m.name);
assert.equal(new Set(names).size, names.length, 'migration names are unique');
for (const m of MIGRATIONS) assert.match(m.name, new RegExp(`^${String(m.version).padStart(3, '0')}_`), `migration ${m.version} name carries its version prefix`);

console.log('migration policy tests passed');
