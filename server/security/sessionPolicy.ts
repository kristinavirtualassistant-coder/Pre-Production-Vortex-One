/**
 * Session lifetime policy.
 *  - Absolute lifetime: a session never lives longer than SESSION_ABSOLUTE_DAYS (default 30) from issue,
 *    enforced through auth_sessions.expires_at (set once at issue; never extended).
 *  - Idle timeout: a session unused for SESSION_IDLE_HOURS (default 24) is rejected (auth_sessions.last_seen_at).
 */
import type { Pool } from 'pg';

function positiveNumber(raw: string | undefined, fallback: number, max: number): number {
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? Math.min(n, max) : fallback;
}

export const sessionAbsoluteDays = () => positiveNumber(process.env.SESSION_ABSOLUTE_DAYS, 30, 90);
export const sessionIdleHours = () => positiveNumber(process.env.SESSION_IDLE_HOURS, 24, 24 * 30);

/** Deletes sessions that are expired or have been revoked for over a week. Safe to call from a worker tick. */
export async function purgeExpiredSessions(pool: Pool): Promise<number> {
  const result = await pool.query(
    `DELETE FROM auth_sessions
      WHERE expires_at < CURRENT_TIMESTAMP - INTERVAL '1 day'
         OR (revoked_at IS NOT NULL AND revoked_at < CURRENT_TIMESTAMP - INTERVAL '7 days')`,
  );
  return result.rowCount ?? 0;
}
