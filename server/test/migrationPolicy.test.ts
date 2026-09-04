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

console.log('migration policy tests passed');
