import assert from 'node:assert/strict';
import { isLocalDevelopmentAuthEnabled, shouldBypassApiAuth } from '../middleware/auth';

const original = process.env.VORTEX_LOCAL_DEV_AUTH;

process.env.VORTEX_LOCAL_DEV_AUTH = 'true';
assert.equal(
  shouldBypassApiAuth('/health'),
  true,
  'health must remain publicly reachable in local development',
);
assert.equal(
  isLocalDevelopmentAuthEnabled(),
  true,
  'local development auth must be explicitly enabled',
);

process.env.VORTEX_LOCAL_DEV_AUTH = 'false';
assert.equal(
  shouldBypassApiAuth('/tasks'),
  false,
  'local development auth must be disabled unless explicitly enabled',
);

if (original === undefined) delete process.env.VORTEX_LOCAL_DEV_AUTH;
else process.env.VORTEX_LOCAL_DEV_AUTH = original;

console.log('local development auth checks passed');
