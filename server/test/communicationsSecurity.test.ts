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


import { suppressBounceRecipient } from '../services/communicationsService';

function fakePool(rows: Array<{to_address: string}>) {
  const calls: any[] = [];
  return {
    calls,
    async query(sql: string, params: any[]) {
      calls.push({ sql, params });
      if (sql.includes('SELECT DISTINCT to_address')) return { rowCount: rows.length, rows };
      return { rowCount: 1, rows: [] };
    },
  } as any;
}

const uniqueBouncePool = fakePool([{ to_address: 'Target@Example.com' }]);
assert.equal(
  await suppressBounceRecipient(
    uniqueBouncePool,
    'org_test',
    'Delivery failed for Target@Example.com',
    'Mail delivery failed',
    'mailer-daemon@example.com',
  ),
  'target@example.com',
);
assert.equal(uniqueBouncePool.calls.length, 2);
assert.equal(uniqueBouncePool.calls[1].params.slice(1), ['target@example.com', 'hard bounce', 'provider-bounce']);

const ambiguousBouncePool = fakePool([
  { to_address: 'one@example.com' },
  { to_address: 'two@example.com' },
]);
assert.equal(
  await suppressBounceRecipient(
    ambiguousBouncePool,
    'org_test',
    'Failed recipients: one@example.com, two@example.com',
    'Delivery Status Notification',
    'mailer-daemon@example.com',
  ),
  null,
);
assert.equal(ambiguousBouncePool.calls.length, 1);

const selfBouncePool = fakePool([{ to_address: 'mailer-daemon@example.com' }]);
assert.equal(
  await suppressBounceRecipient(
    selfBouncePool,
    'org_test',
    'mailer-daemon@example.com',
    'Undeliverable',
    'mailer-daemon@example.com',
  ),
  null,
);
assert.equal(selfBouncePool.calls.length, 1);

console.log('  ✓ PASS: bounce suppression only suppresses one previously contacted recipient and ignores ambiguous/self addresses');
