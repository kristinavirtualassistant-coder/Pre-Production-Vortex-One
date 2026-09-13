import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { requireAuth } from '../middleware/auth';

process.env.VORTEX_LOCAL_DEV_AUTH = 'true';

const req: any = {
  headers: {
    'x-organization-id': 'org_cmc_realty',
    'x-user-id': 'local_dev_user',
    'x-user-email': 'local@cmcrealty.com',
    'x-user-role': 'executive',
  },
  query: {},
  body: {},
};
const res: any = {
  status: () => res,
  json: () => res,
};
let nextCalled = false;

await requireAuth(req, res, () => { nextCalled = true; });

assert.equal(nextCalled, true);
assert.equal(req.dbUser.id, 'local_dev_user');
assert.equal(req.dbUser.organization_id, 'org_cmc_realty');
assert.equal(req.dbUser.uid, 'local_dev_user');
assert.equal(req.query.organizationId, 'org_cmc_realty');
assert.equal(req.headers['x-organization-id'], 'org_cmc_realty');

const authContextSource = readFileSync(path.join(process.cwd(), 'src/contexts/AuthContext.tsx'), 'utf8');
if (!authContextSource.includes("import.meta.env.VITE_LOCAL_DEV_AUTH === 'true' || ['localhost', '127.0.0.1'].includes(window.location.hostname)")) throw new Error('Frontend auth must have an explicit local development mode');
if (!authContextSource.includes('testFirestoreConnection')) throw new Error('Production Firebase behavior must remain present');
if (!authContextSource.includes('Local development auth')) throw new Error('Frontend local auth branch must be explicit');
if (!authContextSource.includes("if (import.meta.env.VITE_LOCAL_DEV_AUTH === 'true') {\n        setUser(null);\n        setUserProfile(null);")) throw new Error('Local auth must bypass Firebase sign-out');

console.log('local development auth middleware checks passed');
