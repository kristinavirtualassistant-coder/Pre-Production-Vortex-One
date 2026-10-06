import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes, randomUUID, timingSafeEqual } from 'node:crypto';
import type { Request, Response } from 'express';
import type { Pool } from 'pg';
import { sendEmail } from './emailService';
import { hashSessionToken } from './postgresqlAuth';

const SESSION_COOKIE = process.env.NODE_ENV === 'production' ? '__Host-vortex_session' : 'vortex_session';
const SESSION_DAYS = 7;
const TOKEN_BYTES = 32;

function envKey(name: string): Buffer {
  const raw = process.env[name]?.trim();
  if (!raw) throw new Error(`${name} is not configured`);
  const key = Buffer.from(raw, 'base64');
  if (key.length !== 32) throw new Error(`${name} must be a base64-encoded 32-byte key`);
  return key;
}

export function hashOneTimeToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export function createOneTimeToken(): string {
  return randomBytes(TOKEN_BYTES).toString('base64url');
}

export function parseCookies(header: string | undefined): Record<string, string> {
  const result: Record<string, string> = {};
  for (const part of (header || '').split(';')) {
    const index = part.indexOf('=');
    if (index <= 0) continue;
    const key = part.slice(0, index).trim();
    const value = part.slice(index + 1).trim();
    try { result[key] = decodeURIComponent(value); } catch { result[key] = value; }
  }
  return result;
}

export function getSessionToken(req: Request): string | null {
  const bearer = req.headers.authorization;
  if (bearer?.startsWith('Bearer ')) return bearer.slice(7).trim() || null;
  return parseCookies(req.headers.cookie)[SESSION_COOKIE] || null;
}

export function setSessionCookie(res: Response, token: string): void {
  const secure = process.env.NODE_ENV === 'production';
  const maxAge = SESSION_DAYS * 24 * 60 * 60 * 1000;
  res.setHeader('Set-Cookie', `${SESSION_COOKIE}=${encodeURIComponent(token)}; Max-Age=${Math.floor(maxAge / 1000)}; Path=/; HttpOnly; SameSite=Lax${secure ? '; Secure' : ''}`);
}

export function clearSessionCookie(res: Response): void {
  const secure = process.env.NODE_ENV === 'production';
  res.setHeader('Set-Cookie', `${SESSION_COOKIE}=; Max-Age=0; Path=/; HttpOnly; SameSite=Lax${secure ? '; Secure' : ''}`);
}

export async function issueSession(
  pool: Pool,
  userId: string,
  req: Request,
  res: Response,
  options: { mfaVerified?: boolean } = {},
): Promise<string> {
  const token = createOneTimeToken();
  await pool.query(
    `INSERT INTO auth_sessions
      (id, user_id, token_hash, expires_at, user_agent, ip_address, mfa_verified_at)
     VALUES ($1, $2, $3, CURRENT_TIMESTAMP + INTERVAL '7 days', $4, $5, CASE WHEN $6 THEN CURRENT_TIMESTAMP ELSE NULL END)`,
    [
      `sess_${randomUUID()}`,
      userId,
      hashSessionToken(token),
      String(req.headers['user-agent'] || '').slice(0, 500),
      req.ip || null,
      options.mfaVerified === true,
    ],
  );
  setSessionCookie(res, token);
  return token;
}

export function revokeSessionCookie(res: Response): void {
  clearSessionCookie(res);
}

const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

export function base32Encode(input: Buffer): string {
  let bits = 0;
  let value = 0;
  let output = '';
  for (const byte of input) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      output += BASE32_ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) output += BASE32_ALPHABET[(value << (5 - bits)) & 31];
  return output;
}

export function base32Decode(value: string): Buffer {
  const normalized = value.toUpperCase().replace(/=+$/g, '').replace(/\s+/g, '');
  let bits = 0;
  let current = 0;
  const bytes: number[] = [];
  for (const char of normalized) {
    const index = BASE32_ALPHABET.indexOf(char);
    if (index < 0) throw new Error('Invalid base32 value');
    current = (current << 5) | index;
    bits += 5;
    if (bits >= 8) {
      bytes.push((current >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Buffer.from(bytes);
}

export function createTotpSecret(): string {
  return base32Encode(randomBytes(20));
}

export function createTotpUri(secret: string, email: string): string {
  const issuer = encodeURIComponent(process.env.TOTP_ISSUER || 'Vortex One');
  return `otpauth://totp/${issuer}:${encodeURIComponent(email)}?secret=${secret}&issuer=${issuer}&algorithm=SHA1&digits=6&period=30`;
}

export function encryptMfaSecret(secret: string): string {
  const key = envKey('AUTH_ENCRYPTION_KEY');
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const ciphertext = Buffer.concat([cipher.update(secret, 'utf8'), cipher.final()]);
  return [iv, cipher.getAuthTag(), ciphertext].map((part) => part.toString('base64url')).join('.');
}

export function decryptMfaSecret(value: string): string {
  const [ivRaw, tagRaw, ciphertextRaw] = value.split('.');
  if (!ivRaw || !tagRaw || !ciphertextRaw) throw new Error('Invalid encrypted MFA secret');
  const decipher = createDecipheriv('aes-256-gcm', envKey('AUTH_ENCRYPTION_KEY'), Buffer.from(ivRaw, 'base64url'));
  decipher.setAuthTag(Buffer.from(tagRaw, 'base64url'));
  return Buffer.concat([
    decipher.update(Buffer.from(ciphertextRaw, 'base64url')),
    decipher.final(),
  ]).toString('utf8');
}

export function totpCode(secret: string, timestamp = Date.now()): string {
  const counter = Math.floor(timestamp / 1000 / 30);
  const secretBytes = base32Decode(secret);
  const buffer = Buffer.alloc(8);
  buffer.writeBigUInt64BE(BigInt(counter));
  const digest = createHmac('sha1', secretBytes).update(buffer).digest();
  const offset = digest[digest.length - 1] & 0x0f;
  const binary = ((digest[offset] & 0x7f) << 24)
    | ((digest[offset + 1] & 0xff) << 16)
    | ((digest[offset + 2] & 0xff) << 8)
    | (digest[offset + 3] & 0xff);
  return String(binary % 1_000_000).padStart(6, '0');
}

export function verifyTotp(secret: string, code: string, timestamp = Date.now()): boolean {
  if (!/^\d{6}$/.test(code)) return false;
  const current = Number(code);
  for (let drift = -1; drift <= 1; drift += 1) {
    const expected = Number(totpCode(secret, timestamp + drift * 30_000));
    if (current === expected) return true;
  }
  return false;
}

export function generateBackupCodes(count = 10): string[] {
  return Array.from({ length: count }, () => randomBytes(6).toString('hex').toUpperCase());
}

export async function hashBackupCodes(codes: string[]): Promise<string[]> {
  return codes.map((code) => hashOneTimeToken(code.replace(/-/g, '').toUpperCase()));
}

export function secureEqual(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

export async function sendSecurityEmail(args: {
  to: string;
  subject: string;
  text: string;
}): Promise<void> {
  await sendEmail({
    to: args.to,
    subject: args.subject,
    text: args.text,
    from: process.env.SECURITY_EMAIL_FROM?.trim() || process.env.SMTP_FROM?.trim(),
  });
}

export function appUrl(): string {
  return (process.env.APP_URL || 'http://localhost:8080').replace(/\/$/, '');
}
