import assert from 'node:assert/strict';
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
assert.equal(req.query.organizationId, 'org_cmc_realty');
assert.equal(req.headers['x-organization-id'], 'org_cmc_realty');

console.log('local development auth middleware checks passed');
