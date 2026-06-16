#!/usr/bin/env bash
# Однократная настройка сервера (Ubuntu/Debian). Запускать НА СЕРВЕРЕ с sudo.
set -euo pipefail

APP_DIR="${1:-/opt/utility-jkh}"
SERVICE_NAME="${2:-utility-jkh}"
DOMAIN="${3:-}"

echo "==> Installing system packages..."
apt-get update -qq
apt-get install -y python3 python3-venv python3-pip nginx curl

echo "==> Creating app directory: $APP_DIR"
mkdir -p "$APP_DIR"
chown -R www-data:www-data "$APP_DIR"

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
UNIT_SRC="$SCRIPT_DIR/../deploy/utility-jkh.service"
NGINX_SRC="$SCRIPT_DIR/../deploy/nginx-utility-jkh.conf"

if [[ -f "$UNIT_SRC" ]]; then
  sed "s|/opt/utility-jkh|$APP_DIR|g" "$UNIT_SRC" > "/etc/systemd/system/${SERVICE_NAME}.service"
  systemctl daemon-reload
  systemctl enable "$SERVICE_NAME"
  echo "Systemd unit installed: ${SERVICE_NAME}.service"
fi

if [[ -f "$NGINX_SRC" && -n "$DOMAIN" ]]; then
  sed "s|example.com|$DOMAIN|g" "$NGINX_SRC" > "/etc/nginx/sites-available/${SERVICE_NAME}"
  ln -sf "/etc/nginx/sites-available/${SERVICE_NAME}" "/etc/nginx/sites-enabled/${SERVICE_NAME}"
  rm -f /etc/nginx/sites-enabled/default
  nginx -t
  systemctl reload nginx
  echo "Nginx configured for $DOMAIN"
fi

echo ""
echo "Bootstrap complete. Next steps:"
echo "  1) Deploy code from your machine: .\\scripts\\deploy.ps1"
echo "  2) Edit $APP_DIR/.env (YANDEX_MAPS_API_KEY)"
echo "  3) systemctl status $SERVICE_NAME"
