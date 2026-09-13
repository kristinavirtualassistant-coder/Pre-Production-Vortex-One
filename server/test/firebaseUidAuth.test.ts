import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { MIGRATIONS } from '../db/migrations';

const migration = MIGRATIONS.find((entry) => entry.version === 12);
assert.ok(migration, 'Firebase UID identity migration must exist');
assert.match(migration.sql, /ADD COLUMN IF NOT EXISTS uid VARCHAR\(128\)/);
assert.match(migration.sql, /uq_users_uid/);
assert.match(migration.sql, /WHERE uid IS NOT NULL/);

const authSource = readFileSync(path.join(process.cwd(), 'server/middleware/auth.ts'), 'utf8');
assert.match(authSource, /AND \(uid = \$2 OR \(uid IS NULL AND email = \$3\)\)/);
assert.match(authSource, /UPDATE users SET uid = \$1 WHERE id = \$2 AND uid IS NULL/);
assert.ok(!authSource.includes('WHERE email = $1 AND organization_id = $2'), 'Authentication must not use email as the durable identity key');

console.log('firebaseUidAuth.test.ts: PASS');
