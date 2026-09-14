import assert from 'node:assert/strict';
import { isLocalDevelopmentAuthEnabled, shouldBypassApiAuth } from '../middleware/auth';

assert.equal(isLocalDevelopmentAuthEnabled(), false, 'local development authentication must remain disabled');
assert.equal(shouldBypassApiAuth('/health'), true, 'health must remain publicly reachable');
assert.equal(shouldBypassApiAuth('/ready'), true, 'readiness must remain publicly reachable');
assert.equal(shouldBypassApiAuth('/tasks'), false, 'application routes must require PostgreSQL authentication');
assert.equal(shouldBypassApiAuth('/telephony/webhook/ringcentral'), true, 'telephony webhooks must remain publicly reachable for provider delivery');

console.log('local development auth retirement checks passed');
