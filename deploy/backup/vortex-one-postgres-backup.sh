#!/usr/bin/env bash
set -euo pipefail

BACKUP_DIR="${VORTEX_BACKUP_DIR:-/var/backups/vortex-one}"
DB_NAME="${VORTEX_DB_NAME:-vortex_one}"
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
mkdir -p "$BACKUP_DIR"
umask 077

# Report the outcome to the Owner Portal (best effort: recording must never mask the backup result).
record() { [ -n "${DATABASE_URL:-}" ] && node "$(dirname "$0")/../../scripts/record-backup-run.mjs" --target postgresql "$@" || true; }

if pg_dump --format=custom --no-owner --dbname="$DB_NAME" > "$BACKUP_DIR/${DB_NAME}_${STAMP}.dump"; then
  record --status success --detail "${DB_NAME}_${STAMP}.dump"
else
  record --status failure --error "pg_dump failed"
  exit 1
fi

find "$BACKUP_DIR" -type f -name '*.dump' -mtime +"${VORTEX_BACKUP_RETENTION_DAYS:-14}" -delete
printf 'Backup created: %s/%s_%s.dump\n' "$BACKUP_DIR" "$DB_NAME" "$STAMP"
