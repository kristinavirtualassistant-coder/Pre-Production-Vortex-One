import type { NextFunction, Request, Response } from 'express';
import { getRawPgPool } from '../db/db';

export interface RateLimitHit { count: number; resetAt: number }

/**
 * Storage abstraction for the limiter. The default is PostgreSQL (shared across instances); a Redis/KV store
 * can be swapped in with setRateLimitStore() without touching any route.
 */
export interface RateLimitStore {
  /** Atomically increments the bucket for the current fixed window and returns the new count. */
  hit(key: string, windowMs: number, now: number): Promise<RateLimitHit>;
}

export class PostgresRateLimitStore implements RateLimitStore {
  async hit(key: string, windowMs: number, now: number): Promise<RateLimitHit> {
    // Raw pool: the counter must commit even when the request's own tenant transaction rolls back (4xx/5xx).
    const pool = getRawPgPool();
    if (!pool) throw new Error('PostgreSQL unavailable');
    const windowSeconds = Math.max(Math.ceil(windowMs / 1000), 1);
    const currentWindow = Math.floor(now / 1000 / windowSeconds) * windowSeconds;
    const result = await pool.query<{ request_count: number; window_start: number }>(
      `INSERT INTO rate_limit_buckets (bucket_key, window_start, request_count)
       VALUES ($1, $2, 1)
       ON CONFLICT (bucket_key) DO UPDATE SET
         window_start = CASE
           WHEN rate_limit_buckets.window_start < EXCLUDED.window_start THEN EXCLUDED.window_start
           ELSE rate_limit_buckets.window_start
         END,
         request_count = CASE
           WHEN rate_limit_buckets.window_start < EXCLUDED.window_start THEN 1
           ELSE rate_limit_buckets.request_count + 1
         END,
         updated_at = CURRENT_TIMESTAMP
       RETURNING request_count, window_start`,
      [key, currentWindow],
    );
    const windowStart = Number(result.rows[0]?.window_start || currentWindow);
    // Opportunistic cleanup keeps the shared table bounded without a separate cron.
    if (Math.random() < 0.01) {
      void pool.query("DELETE FROM rate_limit_buckets WHERE updated_at < CURRENT_TIMESTAMP - INTERVAL '1 day'").catch(() => {});
    }
    return { count: Number(result.rows[0]?.request_count || 1), resetAt: (windowStart + windowSeconds) * 1000 };
  }
}

/** Process-local store for development/tests when PostgreSQL is intentionally unavailable. */
export class MemoryRateLimitStore implements RateLimitStore {
  private buckets = new Map<string, { count: number; resetAt: number }>();
  async hit(key: string, windowMs: number, now: number): Promise<RateLimitHit> {
    const current = this.buckets.get(key);
    if (!current || current.resetAt <= now) {
      const fresh = { count: 1, resetAt: now + windowMs };
      this.buckets.set(key, fresh);
      this.evict(now);
      return fresh;
    }
    current.count += 1;
    return current;
  }
  private evict(now: number) {
    if (this.buckets.size <= 10_000) return;
    for (const [key, bucket] of this.buckets) {
      if (bucket.resetAt <= now) this.buckets.delete(key);
      if (this.buckets.size <= 8_000) break;
    }
  }
}

let configuredStore: RateLimitStore | null = null;
const memoryStore = new MemoryRateLimitStore();
const postgresStore = new PostgresRateLimitStore();

/** Swap the shared store (e.g. a Redis implementation). Pass null to restore the default. */
export function setRateLimitStore(store: RateLimitStore | null) { configuredStore = store; }

function activeStore(): RateLimitStore {
  return configuredStore ?? (getRawPgPool() ? postgresStore : memoryStore);
}

export interface RateLimitOptions {
  windowMs: number;
  max: number;
  message?: string;
  keyPrefix?: string;
  /**
   * Extra identity for the bucket (e.g. the login email). Return null to skip this limiter for the request.
   * Always combined with the keyPrefix; when `perIp` is false the client address is not part of the key.
   */
  keyFn?: (req: Request) => string | null;
  perIp?: boolean;
}

export function clientAddress(req: Request): string {
  return req.ip || req.socket.remoteAddress || 'unknown';
}

export function createRateLimiter(options: RateLimitOptions) {
  const { windowMs, max } = options;
  const message = options.message || 'Too many requests. Please try again later.';
  const keyPrefix = options.keyPrefix || 'api';
  const perIp = options.perIp !== false;

  return async (req: Request, res: Response, next: NextFunction) => {
    const now = Date.now();
    const extra = options.keyFn ? options.keyFn(req) : '';
    if (extra === null) return next();
    const tenantId = (req as Request & { dbUser?: { organization_id?: string } }).dbUser?.organization_id;
    // Scope authenticated buckets to the tenant so one customer cannot exhaust another customer's quota.
    const parts = [keyPrefix];
    if (tenantId) parts.push(`org:${tenantId}`);
    if (perIp) parts.push(`ip:${clientAddress(req)}`);
    if (extra) parts.push(`k:${extra}`);
    const key = parts.join(':').slice(0, 300);

    try {
      const { count, resetAt } = await activeStore().hit(key, windowMs, now);
      res.setHeader('X-RateLimit-Limit', String(max));
      res.setHeader('X-RateLimit-Remaining', String(Math.max(max - count, 0)));
      res.setHeader('X-RateLimit-Reset', String(Math.ceil(resetAt / 1000)));
      if (count > max) {
        res.setHeader('Retry-After', String(Math.max(Math.ceil((resetAt - now) / 1000), 1)));
        return res.status(429).json({ error: message });
      }
      return next();
    } catch (error) {
      // Fail closed: silently disabling protection when the store is down would be worse than a 503.
      console.error('[RateLimit] store failed:', (error as Error)?.message);
      return res.status(503).json({ error: 'Rate limiting service temporarily unavailable' });
    }
  };
}
