import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  hashPassword,
  verifyPassword,
  createSessionToken,
  hashSessionToken,
} from '../services/postgresqlAuth';

describe('PostgreSQL authentication primitives', () => {
  it('hashes passwords without storing the plaintext', async () => {
    const password = 'Correct-Horse-Battery-Staple-2026!';
    const encoded = await hashPassword(password);

    assert.notEqual(encoded, password);
    assert.match(encoded, /^scrypt\$/);
    assert.equal(await verifyPassword(password, encoded), true);
    assert.equal(await verifyPassword('wrong-password', encoded), false);
  });

  it('creates opaque high-entropy session tokens and stores only a digest', () => {
    const token = createSessionToken();
    const digest = hashSessionToken(token);

    assert.equal(token.length, 64);
    assert.match(token, /^[a-f0-9]+$/);
    assert.equal(digest.length, 64);
    assert.match(digest, /^[a-f0-9]+$/);
    assert.notEqual(digest, token);
  });
});
