import assert from 'node:assert/strict';
import { ensureFirebaseAdminApp } from '../middleware/firebase-admin';

const first = ensureFirebaseAdminApp();
const second = ensureFirebaseAdminApp();
assert.equal(first, second, 'Firebase Admin initialization must be idempotent');
console.log('Firebase Admin initialization tests passed.');
