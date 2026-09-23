#!/usr/bin/env bash
set -euo pipefail

APP_DIR="${VORTEX_APP_DIR:-/opt/vortex-one}"
REPO_URL="${VORTEX_REPO_URL:-https://github.com/kristinavirtualassistant-coder/Pre-Production-Vortex-One.git}"
BRANCH="${VORTEX_BRANCH:-main}"

if [[ "$EUID" -ne 0 ]]; then
  echo "Run with sudo."
  exit 1
fi

if [[ ! -d "$APP_DIR/.git" ]]; then
  git clone --branch "$BRANCH" "$REPO_URL" "$APP_DIR"
else
  git -C "$APP_DIR" fetch origin "$BRANCH"
  git -C "$APP_DIR" reset --hard "origin/$BRANCH"
fi

chown -R vortex:vortex "$APP_DIR"
cd "$APP_DIR"

sudo -u vortex npm ci
sudo -u vortex npm run build

install -m 0644 deploy/systemd/vortex-one.service /etc/systemd/system/vortex-one.service
install -m 0644 deploy/systemd/vortex-one-backup.service /etc/systemd/system/vortex-one-backup.service
install -m 0644 deploy/systemd/vortex-one-backup.timer /etc/systemd/system/vortex-one-backup.timer

systemctl daemon-reload
systemctl enable --now vortex-one.service
systemctl enable --now vortex-one-backup.timer

systemctl --no-pager --full status vortex-one.service || true
systemctl --no-pager --full status vortex-one-backup.timer || true

echo "Vortex One production service installed."
