/**
 * Named rate-limit policies. All limiters share the same store (PostgreSQL by default) so limits hold across
 * instances. Windows/maximums can be tuned per environment through RATE_LIMIT_MULTIPLIER (default 1).
 */
import { Router, type Request } from 'express';
import { createRateLimiter } from './rateLimit';

const multiplier = () => {
  const m = Number(process.env.RATE_LIMIT_MULTIPLIER);
  return Number.isFinite(m) && m > 0 ? m : 1;
};
const scaled = (n: number) => Math.max(1, Math.round(n * multiplier()));

function bodyEmail(req: Request): string | null {
  const email = (req.body as any)?.email;
  return typeof email === 'string' && email.trim() ? email.trim().toLowerCase().slice(0, 200) : null;
}

const MIN = 60_000;
const HOUR = 60 * MIN;

/** Per-IP guard for every public auth endpoint. */
export const authIpLimiter = () => createRateLimiter({ keyPrefix: 'auth-ip', windowMs: 15 * MIN, max: scaled(60), message: 'Too many authentication attempts. Please try again later.' });
/** Credential stuffing guard: attempts against one account regardless of source address. */
export const loginAccountLimiter = () => createRateLimiter({ keyPrefix: 'login-acct', windowMs: 15 * MIN, max: scaled(10), perIp: false, keyFn: bodyEmail, message: 'Too many sign-in attempts for this account. Please try again later.' });
export const loginIpLimiter = () => createRateLimiter({ keyPrefix: 'login-ip', windowMs: 15 * MIN, max: scaled(20), message: 'Too many sign-in attempts. Please try again later.' });
export const signupIpLimiter = () => createRateLimiter({ keyPrefix: 'signup-ip', windowMs: HOUR, max: scaled(5), message: 'Too many sign-up attempts. Please try again later.' });
export const signupDailyLimiter = () => createRateLimiter({ keyPrefix: 'signup-day', windowMs: 24 * HOUR, max: scaled(20), message: 'Daily sign-up limit reached for this network.' });
export const passwordResetLimiter = () => createRateLimiter({ keyPrefix: 'pwreset-ip', windowMs: HOUR, max: scaled(10), message: 'Too many password reset attempts. Please try again later.' });
export const passwordResetAccountLimiter = () => createRateLimiter({ keyPrefix: 'pwreset-acct', windowMs: HOUR, max: scaled(3), perIp: false, keyFn: bodyEmail, message: 'Too many password reset attempts. Please try again later.' });
export const mfaVerifyLimiter = () => createRateLimiter({ keyPrefix: 'mfa', windowMs: 15 * MIN, max: scaled(10), message: 'Too many verification attempts. Please try again later.' });

/** Authenticated, cost-bearing routes (AI, enrichment, outbound messaging, dialing). Keyed by tenant + IP. */
export const expensiveLimiter = (keyPrefix: string, max: number, windowMs = MIN) => createRateLimiter({ keyPrefix, windowMs, max: scaled(max) });
export const webhookIngressLimiter = () => createRateLimiter({ keyPrefix: 'webhook-in', windowMs: MIN, max: scaled(600), message: 'Too many webhook requests.' });

/**
 * All public authentication endpoint limits, mounted at /api/auth BEFORE authentication and before any
 * credential is checked. The handlers themselves live in the auth middleware; these only throttle.
 */
export function authAbuseProtection(): Router {
  const router = Router();
  router.use(authIpLimiter());
  router.post('/login', loginIpLimiter(), loginAccountLimiter());
  router.post('/signup', signupIpLimiter(), signupDailyLimiter());
  router.post('/password-reset/request', passwordResetLimiter(), passwordResetAccountLimiter());
  router.post('/password-reset/confirm', passwordResetLimiter());
  router.post('/verify-email', passwordResetLimiter());
  router.post('/mfa/verify', mfaVerifyLimiter());
  return router;
}
