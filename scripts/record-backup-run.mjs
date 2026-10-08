#!/usr/bin/env node
/**
 * Records the outcome of a backup job so the Owner Portal can report it truthfully.
 *   node scripts/record-backup-run.mjs --target postgresql --status success [--error "..."] [--detail "file.dump"]
 * Targets: postgresql | google_sheets | google_drive. Uses DATABASE_URL. Never claims success on its own.
 */
import pg from 'pg';
import { randomUUID } from 'node:crypto';

const arg = (n) => { const i = process.argv.indexOf(`--${n}`); return i >= 0 ? process.argv[i + 1] : undefined; };
const target = arg('target');
const status = arg('status');
if (!['postgresql', 'google_sheets', 'google_drive'].includes(target) || !['running', 'success', 'failure'].includes(status)) {
  console.error('Usage: record-backup-run.mjs --target postgresql|google_sheets|google_drive --status running|success|failure [--error msg] [--detail text]');
  process.exit(2);
}
if (!process.env.DATABASE_URL) { console.error('DATABASE_URL is required'); process.exit(2); }
const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
await client.connect();
try {
  await client.query(
    `INSERT INTO platform_backup_runs (id, target, status, finished_at, error, details)
     VALUES ($1,$2,$3, CASE WHEN $3 = 'running' THEN NULL ELSE CURRENT_TIMESTAMP END, $4, $5::jsonb)`,
    [`bkp_${randomUUID()}`, target, status, arg('error')?.slice(0, 2000) ?? null, JSON.stringify({ detail: arg('detail')?.slice(0, 500) ?? null })],
  );
} finally { await client.end(); }
