#!/bin/zsh
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
PGDATA="${VORTEX_LOCAL_PGDATA:-$HOME/.vortex-one-postgres}"
PGPORT="${VORTEX_LOCAL_PGPORT:-5433}" # isolated local port 5433
PGSOCKET="${VORTEX_LOCAL_PGSOCKET:-/tmp}"
PGDATABASE="${SQL_DATABASE:-vortex-one-database}"
PGUSER="${SQL_USER:-postgres}"

if ! command -v initdb >/dev/null 2>&1 || ! command -v pg_ctl >/dev/null 2>&1 || ! command -v psql >/dev/null 2>&1; then
  echo "Local PostgreSQL tools are required (initdb, pg_ctl, psql)."
  exit 1
fi

if [ ! -f "$PGDATA/PG_VERSION" ]; then
  mkdir -p "$PGDATA"
  initdb -D "$PGDATA" --auth=trust >/dev/null
fi

if ! pg_ctl -D "$PGDATA" status >/dev/null 2>&1; then
  pg_ctl -D "$PGDATA" -o "-p $PGPORT -k $PGSOCKET" -l "$PGDATA/server.log" start >/dev/null
fi

if ! psql -h "$PGSOCKET" -p "$PGPORT" -U postgres -tAc "SELECT 1 FROM pg_roles WHERE rolname='$PGUSER'" | grep -q 1; then
  psql -h "$PGSOCKET" -p "$PGPORT" -U postgres -v ON_ERROR_STOP=1 -c "CREATE ROLE \"$PGUSER\" LOGIN" >/dev/null
fi

if ! psql -h "$PGSOCKET" -p "$PGPORT" -U postgres -tAc "SELECT 1 FROM pg_database WHERE datname='$PGDATABASE'" | grep -q 1; then
  createdb -h "$PGSOCKET" -p "$PGPORT" -U postgres "$PGDATABASE"
fi

psql -h "$PGSOCKET" -p "$PGPORT" -U postgres -v ON_ERROR_STOP=1 -c "ALTER DATABASE \"$PGDATABASE\" OWNER TO \"$PGUSER\"" >/dev/null

existing_pid="$(lsof -ti :3000 | head -n1 || true)"
if [ -n "$existing_pid" ]; then
  existing_command="$(ps -p "$existing_pid" -o command= || true)"
  case "$existing_command" in
    *"$ROOT_DIR"*"server.ts"*)
      echo "Local Vortex One server is already running on http://127.0.0.1:3000 (PID $existing_pid)."
      exit 0
      ;;
    *)
      echo "Port 3000 is already in use by another process (PID $existing_pid)."
      echo "Stop that process or set the Vortex One server to a different port before starting locally."
      exit 1
      ;;
  esac
fi

cd "$ROOT_DIR"
export VORTEX_LOCAL_DEV_AUTH=true
export SQL_HOST="$PGSOCKET"
export SQL_PORT="$PGPORT"
export SQL_USER="$PGUSER"
export SQL_DATABASE="$PGDATABASE"

npm run dev
