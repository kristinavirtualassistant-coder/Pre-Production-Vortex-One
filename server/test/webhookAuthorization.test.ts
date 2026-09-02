import { canonicalizeOrganizationContext, resolveAuthenticatedOrganizationId } from '../middleware/auth';

function assert(condition: boolean, name: string): void {
  if (!condition) throw new Error(`FAIL: ${name}`);
  console.log(`PASS: ${name}`);
}

const user = { organization_id: 'org_alpha' } as any;

assert(
  resolveAuthenticatedOrganizationId(user, undefined) === 'org_alpha',
  'authenticated organization is used when no client organization is supplied'
);

assert(
  resolveAuthenticatedOrganizationId(user, 'org_alpha') === 'org_alpha',
  'matching client organization is accepted'
);

let rejected = false;
try {
  resolveAuthenticatedOrganizationId(user, 'org_beta');
} catch (error: any) {
  rejected = error?.statusCode === 403;
}
assert(rejected, 'cross-organization override is rejected');



const canonicalRequest = {
  headers: { 'x-organization-id': 'org_alpha' },
  query: { organizationId: 'org_alpha' },
  body: { organizationId: 'org_alpha', organization_id: 'org_alpha' },
  dbUser: user,
} as any;

assert(
  canonicalizeOrganizationContext(canonicalRequest) === 'org_alpha' &&
    canonicalRequest.query.organizationId === 'org_alpha' &&
    canonicalRequest.body.organizationId === 'org_alpha' &&
    canonicalRequest.body.organization_id === 'org_alpha',
  'authenticated organization is canonicalized for legacy handlers'
);

for (const field of ['query', 'bodyId', 'body_id']) {
  const request = {
    headers: { 'x-organization-id': 'org_alpha' },
    query: { organizationId: field === 'query' ? 'org_beta' : 'org_alpha' },
    body: {
      organizationId: field === 'bodyId' ? 'org_beta' : 'org_alpha',
      organization_id: field === 'body_id' ? 'org_beta' : 'org_alpha',
    },
    dbUser: user,
  } as any;
  let denied = false;
  try {
    canonicalizeOrganizationContext(request);
  } catch (error: any) {
    denied = error?.statusCode === 403;
  }
  assert(denied, `cross-organization ${field} override is rejected`);
}

console.log('Webhook authorization regression tests passed.');
