import assert from 'node:assert/strict';
import { isLocalDevelopmentAuthEnabled, requireAuth } from '../middleware/auth';

assert.equal(isLocalDevelopmentAuthEnabled(), false, 'local development authentication must remain disabled');

const req: any = {
  path: '/tasks',
  method: 'GET',
  headers: {},
  query: {},
  body: {},
};
let statusCode = 0;
let payload: unknown;
const res: any = {
  status(code: number) { statusCode = code; return this; },
  json(value: unknown) { payload = value; return this; },
};
let nextCalled = false;

const originalDatabaseUrl = process.env.DATABASE_URL;
if (!originalDatabaseUrl) {
  await requireAuth(req, res, () => { nextCalled = true; });
  assert.equal(nextCalled, false);
  assert.equal(statusCode, 503);
  assert.deepEqual(payload, { error: 'Database unavailable' });
}

console.log('PostgreSQL auth middleware retirement checks passed');
