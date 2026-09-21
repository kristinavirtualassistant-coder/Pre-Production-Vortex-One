/**
 * Vortex One - DNC & Suppression List Management Service
 * PostgreSQL is the authoritative store for suppression records.
 */

import { getPgPool } from '../db/db';
import { SuppressionTableRecord } from './types';

export function normalizePhoneNumber(phone: string): string {
  const digits = (phone || '').replace(/\D/g, '');
  if (digits.length === 11 && digits.startsWith('1')) return digits.slice(1);
  return digits;
}

export function formatPhoneNumber(phone: string): string {
  const digits = normalizePhoneNumber(phone);
  if (digits.length === 10) return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  return phone;
}

function requireSuppressionPool() {
  const pool = getPgPool();
  if (!pool) throw new Error('PostgreSQL is required for suppression data');
  return pool;
}

export class SuppressionService {
  public static async isSuppressed(
    organizationId: string,
    phoneNumber: string,
  ): Promise<{ isSuppressed: boolean; reason?: string; suppressedAt?: string }> {
    const cleanPhone = normalizePhoneNumber(phoneNumber);
    if (!cleanPhone) return { isSuppressed: false };

    const pool = requireSuppressionPool();
    const res = await pool.query(
      `SELECT reason, suppressed_at, expires_at FROM suppression_record
       WHERE organization_id = $1 AND (
         phone_number = $2 OR
         phone_number = $3 OR
         regexp_replace(phone_number, '[^0-9]', '', 'g') = $4
       ) LIMIT 1`,
      [organizationId, phoneNumber, formatPhoneNumber(phoneNumber), cleanPhone],
    );

    if (res.rows.length === 0) return { isSuppressed: false };

    const row = res.rows[0];
    if (row.expires_at && new Date(row.expires_at) < new Date()) return { isSuppressed: false };

    return {
      isSuppressed: true,
      reason: row.reason || 'DNC Suppression Record',
      suppressedAt: row.suppressed_at,
    };
  }

  public static async addSuppression(
    organizationId: string,
    phoneNumber: string,
    reason: string = 'Requested DNC Removal',
    source: string = 'internal_agent',
  ): Promise<SuppressionTableRecord> {
    const pool = requireSuppressionPool();
    const formatted = formatPhoneNumber(phoneNumber);
    const id = `supp_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const now = new Date().toISOString();

    const record: SuppressionTableRecord = {
      id,
      organization_id: organizationId,
      phone_number: formatted,
      reason,
      source,
      suppressed_at: now,
    };

    await pool.query(
      `INSERT INTO suppression_record (id, organization_id, phone_number, reason, source, suppressed_at)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (organization_id, phone_number)
       DO UPDATE SET reason = EXCLUDED.reason, source = EXCLUDED.source, suppressed_at = EXCLUDED.suppressed_at`,
      [id, organizationId, formatted, reason, source, now],
    );

    return record;
  }

  public static async listSuppressions(organizationId: string): Promise<SuppressionTableRecord[]> {
    const pool = requireSuppressionPool();
    const res = await pool.query(
      `SELECT id, organization_id, phone_number, reason, source, suppressed_at, expires_at
       FROM suppression_record
       WHERE organization_id = $1
       ORDER BY suppressed_at DESC`,
      [organizationId],
    );
    return res.rows;
  }

  public static async removeSuppression(organizationId: string, idOrPhone: string): Promise<boolean> {
    const pool = requireSuppressionPool();
    const res = await pool.query(
      `DELETE FROM suppression_record
       WHERE organization_id = $1 AND (id = $2 OR phone_number = $2)`,
      [organizationId, idOrPhone],
    );
    return (res.rowCount || 0) > 0;
  }
}
