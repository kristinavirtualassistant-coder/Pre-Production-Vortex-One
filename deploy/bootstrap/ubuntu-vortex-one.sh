#!/usr/bin/env bash
set -euo pipefail

APP_DIR="${VORTEX_APP_DIR:-/opt/vortex-one}"
APP_USER="${VORTEX_APP_USER:-vortex}"
NODE_MAJOR="${VORTEX_NODE_MAJOR:-22}"

if [[ "$EUID" -ne 0 ]]; then
  echo "Run as root: sudo bash deploy/bootstrap/ubuntu-vortex-one.sh"
  exit 1
fi

export DEBIAN_FRONTEND=noninteractive
apt-get update
apt-get install -y ca-certificates curl git postgresql postgresql-contrib ufw

if ! command -v node >/dev/null 2>&1 || [[ "$(node -p 'process.versions.node.split(".")[0]')" -lt "$NODE_MAJOR" ]]; then
  curl -fsSL https://deb.nodesource.com/setup_${NODE_MAJOR}.x | bash -
  apt-get install -y nodejs
fi

id "$APP_USER" >/dev/null 2>&1 || useradd --system --create-home --home-dir "$APP_DIR" --shell /usr/sbin/nologin "$APP_USER"
mkdir -p "$APP_DIR"
chown -R "$APP_USER:$APP_USER" "$APP_DIR"

sudo -u postgres psql -tAc "SELECT 1 FROM pg_roles WHERE rolname='vortex_one_app'" | grep -q 1 ||   sudo -u postgres psql -c "CREATE ROLE vortex_one_app LOGIN;"
sudo -u postgres psql -tAc "SELECT 1 FROM pg_database WHERE datname='vortex_one'" | grep -q 1 ||   sudo -u postgres createdb -O vortex_one_app vortex_one

sudo -u postgres psql -c "ALTER ROLE vortex_one_app SET search_path TO public;"
sudo -u postgres psql -d vortex_one -c "GRANT USAGE, CREATE ON SCHEMA public TO vortex_one_app;"

ufw allow OpenSSH
ufw --force enable

echo "Bootstrap complete."
echo "Next: clone the repository into $APP_DIR, create $APP_DIR/.env, run npm ci && npm run build, then install the systemd and Cloudflare files."
