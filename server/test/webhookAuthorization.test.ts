import { resolveAuthenticatedOrganizationId } from '../middleware/auth';

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

console.log('Webhook authorization regression tests passed.');
