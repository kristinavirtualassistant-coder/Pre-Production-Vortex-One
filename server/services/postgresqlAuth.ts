import { createHash, randomBytes, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';

const scrypt = promisify(scryptCallback);
const PASSWORD_KEY_LENGTH = 64;
const PASSWORD_SALT_LENGTH = 16;
const SESSION_TOKEN_BYTES = 32;
const SESSION_PEPPER = process.env.AUTH_SESSION_PEPPER || '';

if (process.env.NODE_ENV === 'production' && SESSION_PEPPER.length < 32) {
  throw new Error('AUTH_SESSION_PEPPER must be at least 32 characters in production');
}

export async function hashPassword(password: string): Promise<string> {
  if (password.length < 12) {
    throw new Error('Password must be at least 12 characters long');
  }

  const salt = randomBytes(PASSWORD_SALT_LENGTH).toString('hex');
  const derivedKey = (await scrypt(password, salt, PASSWORD_KEY_LENGTH)) as Buffer;
  return `scrypt$${salt}$${derivedKey.toString('hex')}`;
}

export async function verifyPassword(password: string, encoded: string): Promise<boolean> {
  const parts = encoded.split('$');
  if (parts.length !== 3 || parts[0] !== 'scrypt') return false;

  const [, salt, expectedHex] = parts;
  if (!/^[a-f0-9]{32}$/.test(salt) || !/^[a-f0-9]{128}$/.test(expectedHex)) return false;

  const actual = (await scrypt(password, salt, PASSWORD_KEY_LENGTH)) as Buffer;
  const expected = Buffer.from(expectedHex, 'hex');
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

export function createSessionToken(): string {
  return randomBytes(SESSION_TOKEN_BYTES).toString('hex');
}

export function hashSessionToken(token: string): string {
  return createHash('sha256').update(`${SESSION_PEPPER}${token}`).digest('hex');
}
