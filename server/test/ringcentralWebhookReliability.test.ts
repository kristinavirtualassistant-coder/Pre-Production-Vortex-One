import assert from 'node:assert/strict';
import {
  verifyRingCentralWebhook,
  handleRingCentralValidation,
  getProviderEventId,
} from '../dialer/webhookHandler';
import { RingCentralTelephonyAdapter } from '../dialer/telephonyAdapter';

process.env.NODE_ENV = 'test';

// RingCentral validation-token authentication must be accepted only when it matches the configured token.
process.env.RINGCENTRAL_WEBHOOK_VALIDATION_TOKEN = 'rc-validation-token';
assert.equal(verifyRingCentralWebhook({ 'validation-token': 'rc-validation-token' }), true);
assert.equal(verifyRingCentralWebhook({ 'validation-token': 'wrong' }), false);
assert.equal(verifyRingCentralWebhook({}), false);

// RingCentral subscription validation must echo the token and must not require an organization ID or event body.
const validation = handleRingCentralValidation({ 'validation-token': 'rc-validation-token' });
assert.deepEqual(validation, {
  statusCode: 200,
  headers: { 'Content-Type': 'application/json', 'Validation-Token': 'rc-validation-token' },
  body: '',
});
assert.equal(handleRingCentralValidation({ 'validation-token': 'wrong' }), null);
assert.equal(handleRingCentralValidation({}), null);

// Provider event identity must come from RingCentral's UUID/eventId; it must never be synthesized.
assert.equal(getProviderEventId({ uuid: 'uuid-1' }), 'uuid-1');
assert.equal(getProviderEventId({ eventId: 'event-1' }), 'event-1');
assert.equal(getProviderEventId({}), null);

const adapter = new RingCentralTelephonyAdapter();
assert.throws(() => adapter.normalizeWebhookPayload({ body: { telephonySessionId: 'sess-1', parties: [{ status: { code: 'Answered' } }] } }), /missing provider event UUID/);
assert.throws(() => adapter.normalizeWebhookPayload({ uuid: 'uuid-1', body: { parties: [{ status: { code: 'Answered' } }] } }), /missing telephonySessionId/);
assert.throws(() => adapter.normalizeWebhookPayload({ uuid: 'uuid-1', body: { telephonySessionId: 'sess-1', parties: [{ status: { code: 'FutureStatus' } }] } }), /Unsupported RingCentral telephony status/);

console.log('ringcentral webhook reliability tests passed');
