/**
 * Vortex One - DNC & Suppression List Management Service
 * Enforces TCPA and National/Internal Do-Not-Call compliance
 */

import { getPgPool } from '../db/db';
import { SuppressionTableRecord } from './types';

// In-memory fallback for local sandboxing
const inMemorySuppressions: Map<string, SuppressionTableRecord> = new Map();

/**
 * Normalizes phone numbers to standard 10-digit digits for deterministic matching
 */
export function normalizePhoneNumber(phone: string): string {
  const digits = (phone || '').replace(/\D/g, '');
  if (digits.length === 11 && digits.startsWith('1')) {
    return digits.slice(1);
  }
  return digits;
}

/**
 * Formats 10-digit phone to standard readable US format (XXX) XXX-XXXX
 */
export function formatPhoneNumber(phone: string): string {
  const digits = normalizePhoneNumber(phone);
  if (digits.length === 10) {
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  }
  return phone;
}

export class SuppressionService {
  /**
   * Check if a phone number is on the Do-Not-Call / Suppression list for an organization
   */
  public static async isSuppressed(
    organizationId: string,
    phoneNumber: string
  ): Promise<{ isSuppressed: boolean; reason?: string; suppressedAt?: string }> {
    const cleanPhone = normalizePhoneNumber(phoneNumber);
    if (!cleanPhone) {
      return { isSuppressed: false };
    }

    const pool = getPgPool();
    if (pool) {
      try {
        const res = await pool.query(
          `SELECT reason, suppressed_at, expires_at FROM suppression_record 
           WHERE organization_id = $1 AND (
             phone_number = $2 OR 
             phone_number = $3 OR 
             regexp_replace(phone_number, '[^0-9]', '', 'g') = $4
           ) LIMIT 1`,
          [organizationId, phoneNumber, formatPhoneNumber(phoneNumber), cleanPhone]
        );

        if (res.rows.length > 0) {
          const row = res.rows[0];
          if (row.expires_at && new Date(row.expires_at) < new Date()) {
            return { isSuppressed: false }; // Expired
          }
          return {
            isSuppressed: true,
            reason: row.reason || 'DNC Suppression Record',
            suppressedAt: row.suppressed_at,
          };
        }
      } catch (err: any) {
        console.warn('PostgreSQL suppression check fallback:', err.message);
      }
    }

    // Check in-memory suppression
    for (const record of inMemorySuppressions.values()) {
      if (record.organization_id === organizationId) {
        if (normalizePhoneNumber(record.phone_number) === cleanPhone) {
          return {
            isSuppressed: true,
            reason: record.reason,
            suppressedAt: record.suppressed_at,
          };
        }
      }
    }

    return { isSuppressed: false };
  }

  /**
   * Add a phone number to the suppression list
   */
  public static async addSuppression(
    organizationId: string,
    phoneNumber: string,
    reason: string = 'Requested DNC Removal',
    source: string = 'internal_agent'
  ): Promise<SuppressionTableRecord> {
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

    const pool = getPgPool();
    if (pool) {
      try {
        await pool.query(
          `INSERT INTO suppression_record (id, organization_id, phone_number, reason, source, suppressed_at)
           VALUES ($1, $2, $3, $4, $5, $6)
           ON CONFLICT (organization_id, phone_number)
           DO UPDATE SET reason = EXCLUDED.reason, source = EXCLUDED.source, suppressed_at = EXCLUDED.suppressed_at`,
          [id, organizationId, formatted, reason, source, now]
        );
      } catch (err: any) {
        console.warn('PostgreSQL suppression insert fallback:', err.message);
      }
    }

    inMemorySuppressions.set(`${organizationId}:${formatted}`, record);
    return record;
  }

  /**
   * List all suppression records for an organization
   */
  public static async listSuppressions(organizationId: string): Promise<SuppressionTableRecord[]> {
    const pool = getPgPool();
    if (pool) {
      try {
        const res = await pool.query(
          `SELECT id, organization_id, phone_number, reason, source, suppressed_at, expires_at 
           FROM suppression_record 
           WHERE organization_id = $1 
           ORDER BY suppressed_at DESC`,
          [organizationId]
        );
        return res.rows;
      } catch (err: any) {
        console.warn('PostgreSQL list suppressions fallback:', err.message);
      }
    }

    return Array.from(inMemorySuppressions.values()).filter((s) => s.organization_id === organizationId);
  }

  /**
   * Remove a suppression record by ID or phone number
   */
  public static async removeSuppression(organizationId: string, idOrPhone: string): Promise<boolean> {
    const pool = getPgPool();
    if (pool) {
      try {
        const res = await pool.query(
          `DELETE FROM suppression_record WHERE organization_id = $1 AND (id = $2 OR phone_number = $2)`,
          [organizationId, idOrPhone]
        );
        return (res.rowCount || 0) > 0;
      } catch (err: any) {
        console.warn('PostgreSQL delete suppression fallback:', err.message);
      }
    }

    for (const [key, record] of inMemorySuppressions.entries()) {
      if (record.organization_id === organizationId && (record.id === idOrPhone || record.phone_number === idOrPhone)) {
        inMemorySuppressions.delete(key);
        return true;
      }
    }

    return false;
  }
}
