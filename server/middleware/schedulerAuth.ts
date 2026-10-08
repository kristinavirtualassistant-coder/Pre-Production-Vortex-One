import { createHash, timingSafeEqual } from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';

export const SCHEDULER_SECRET_HEADER = 'x-vortex-scheduler-secret';

function digest(value: string): Buffer {
  return createHash('sha256').update(value, 'utf8').digest();
}

/** Constant-time comparison that does not leak the secret's length. */
export function schedulerSecretMatches(expected: string | undefined, supplied: string | undefined): boolean {
  const expectedValue = (expected ?? '').trim();
  const suppliedValue = (supplied ?? '').trim();
  if (!expectedValue || !suppliedValue) return false;
  return timingSafeEqual(digest(expectedValue), digest(suppliedValue));
}

/**
 * Authenticates machine-to-machine scheduler triggers. Scheduler callers are not users: they have no
 * session and no role, so this middleware is the ONLY authentication for those routes. It fails closed
 * when SCHEDULER_TRIGGER_SECRET is not configured.
 */
export function requireSchedulerSecret(req: Request, res: Response, next: NextFunction) {
  const expected = process.env.SCHEDULER_TRIGGER_SECRET;
  if (!expected?.trim()) {
    return res.status(503).json({ error: 'Scheduler trigger is not configured' });
  }
  if (!schedulerSecretMatches(expected, req.header(SCHEDULER_SECRET_HEADER))) {
    return res.status(401).json({ error: 'Unauthorized scheduler request' });
  }
  return next();
}
