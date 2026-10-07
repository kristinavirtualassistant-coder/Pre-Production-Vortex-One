import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { validTwilio } from '../services/communicationsService';

const url = 'https://example.test/api/communications/webhooks/twilio/inbound';
const body = {
  MessageSid: 'SM123',
  From: '+19495550101',
  To: '+19495550102',
  Body: 'Hello',
};
const token = 'test-auth-token';
const payload = url + Object.keys(body).sort().map((key) => key + body[key]).join('');
const signature = createHmac('sha1', token).update(payload).digest('base64');

assert.equal(validTwilio(url, body, signature, token), true);
assert.equal(validTwilio(url, body, signature.slice(0, -1) + 'x', token), false);
assert.equal(validTwilio(url, { ...body, Body: 'Tampered' }, signature, token), false);
assert.equal(validTwilio(url + '/', body, signature, token), false);
assert.equal(validTwilio(url, body, signature, 'wrong-token'), false);
assert.equal(validTwilio(url, body, '', token), false);

console.log('  ✓ PASS: Twilio webhook signatures validate exact URL, parameters, and auth token');
