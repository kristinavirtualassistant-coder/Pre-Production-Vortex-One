import type { NextFunction, Request, Response } from 'express';
import { getPgPool } from '../db/db';

interface Bucket {
  count: number;
  resetAt: number;
}

export interface RateLimitOptions {
  windowMs: number;
  max: number;
  message?: string;
  keyPrefix?: string;
}

export function createRateLimiter(options: RateLimitOptions) {
  const buckets = new Map<string, Bucket>();
  const { windowMs, max } = options;
  const message = options.message || 'Too many requests. Please try again later.';
  const keyPrefix = options.keyPrefix || 'api';

  return async (req: Request, res: Response, next: NextFunction) => {
    const now = Date.now();
    const clientKey = req.ip || req.socket.remoteAddress || 'unknown';
    const key = `${keyPrefix}:${clientKey}`;
    const pool = getPgPool();

    if (pool) {
      try {
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
        const count = Number(result.rows[0]?.request_count || 1);
        const windowStart = Number(result.rows[0]?.window_start || currentWindow);
        const resetAt = (windowStart + windowSeconds) * 1000;

        res.setHeader('X-RateLimit-Limit', String(max));
        res.setHeader('X-RateLimit-Remaining', String(Math.max(max - count, 0)));
        res.setHeader('X-RateLimit-Reset', String(Math.ceil(resetAt / 1000)));

        if (count > max) {
          res.setHeader('Retry-After', String(Math.max(Math.ceil((resetAt - now) / 1000), 1)));
          return res.status(429).json({ error: message });
        }

        // Opportunistic cleanup keeps the shared table bounded without a separate cron.
        if (Math.random() < 0.01) {
          void pool.query(
            'DELETE FROM rate_limit_buckets WHERE updated_at < CURRENT_TIMESTAMP - INTERVAL \'1 hour\'',
          ).catch(() => {});
        }
        return next();
      } catch (error) {
        // The application health/readiness checks already require PostgreSQL in production.
        // If the limiter cannot reach PostgreSQL, fail closed rather than silently disabling protection.
        console.error('[RateLimit] PostgreSQL limiter failed:', error);
        return res.status(503).json({ error: 'Rate limiting service temporarily unavailable' });
      }
    }

    // Test/local fallback when PostgreSQL is intentionally unavailable.
    const current = buckets.get(key);
    if (!current || current.resetAt <= now) {
      buckets.set(key, { count: 1, resetAt: now + windowMs });
      res.setHeader('X-RateLimit-Limit', String(max));
      res.setHeader('X-RateLimit-Remaining', String(Math.max(max - 1, 0)));
      res.setHeader('X-RateLimit-Reset', String(Math.ceil((now + windowMs) / 1000)));
      return next();
    }

    current.count += 1;
    res.setHeader('X-RateLimit-Limit', String(max));
    res.setHeader('X-RateLimit-Remaining', String(Math.max(max - current.count, 0)));
    res.setHeader('X-RateLimit-Reset', String(Math.ceil(current.resetAt / 1000)));

    if (current.count > max) {
      res.setHeader('Retry-After', String(Math.ceil((current.resetAt - now) / 1000)));
      return res.status(429).json({ error: message });
    }

    if (buckets.size > 10000) {
      for (const [bucketKey, bucket] of buckets) {
        if (bucket.resetAt <= now) buckets.delete(bucketKey);
        if (buckets.size <= 8000) break;
      }
    }

    return next();
  };
}
