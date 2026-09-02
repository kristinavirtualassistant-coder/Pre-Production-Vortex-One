import assert from 'node:assert/strict';
import { shouldBypassApiAuth } from '../middleware/auth';

function testPublicApiBoundary() {
  assert.equal(shouldBypassApiAuth('/health'), true);
  assert.equal(shouldBypassApiAuth('/telephony/webhook/ringcentral'), true);
  assert.equal(shouldBypassApiAuth('/db/status'), false);
  assert.equal(shouldBypassApiAuth('/property-search'), false);
  assert.equal(shouldBypassApiAuth('/leads'), false);
  assert.equal(shouldBypassApiAuth('/webhooks'), false);
}

testPublicApiBoundary();
console.log('API auth boundary tests passed.');
