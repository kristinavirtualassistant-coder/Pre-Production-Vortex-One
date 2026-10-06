import assert from 'node:assert/strict';
import { createTotpSecret, totpCode, verifyTotp, generateBackupCodes, hashBackupCodes, hashOneTimeToken } from '../services/accountSecurity';

const secret = createTotpSecret();
const timestamp = Date.UTC(2026, 0, 1, 0, 0, 0);
const code = totpCode(secret, timestamp);

assert.match(secret, /^[A-Z2-7]+$/);
assert.match(code, /^\d{6}$/);
assert.equal(verifyTotp(secret, code, timestamp), true);
assert.equal(verifyTotp(secret, code, timestamp + 120_000), false);

const backupCodes = generateBackupCodes();
assert.equal(backupCodes.length, 10);
assert.equal(new Set(backupCodes).size, 10);
const hashes = await hashBackupCodes(backupCodes);
assert.equal(hashes.length, 10);
assert.equal(hashes[0], hashOneTimeToken(backupCodes[0]));

console.log('  ✓ PASS: account security TOTP and backup-code primitives');
