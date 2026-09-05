import assert from 'node:assert/strict';
import { validateDialRequest } from '../dialer/dialRequestValidation';

assert.deepEqual(
  validateDialRequest({ phone_number: '+15625551234' }),
  { ok: true, phoneNumber: '+15625551234' },
);

assert.deepEqual(
  validateDialRequest({ phone_number: '  +1 (562) 555-1234  ' }),
  { ok: true, phoneNumber: '+1 (562) 555-1234' },
);

assert.equal(validateDialRequest({}).ok, false);
assert.equal(validateDialRequest({ phone_number: '' }).ok, false);
assert.equal(validateDialRequest({ phone_number: '   ' }).ok, false);
assert.equal(validateDialRequest({ phone_number: null }).ok, false);
assert.equal(validateDialRequest({ phone_number: 123 }).ok, false);

console.log('dial request validation tests passed');
