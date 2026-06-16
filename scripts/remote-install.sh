#!/usr/bin/env bash
# Выполняется на сервере после распаковки архива деплоя.
set -euo pipefail

APP_DIR="${1:-$(cd "$(dirname "$0")/.." && pwd)}"
SERVICE_NAME="${DEPLOY_SERVICE:-utility-jkh}"
PYTHON="${PYTHON:-python3}"

cd "$APP_DIR"

if [[ ! -f requirements.txt ]]; then
  echo "ERROR: requirements.txt not found in $APP_DIR" >&2
  exit 1
fi

if [[ ! -d venv ]]; then
  echo "Creating virtual environment..."
  "$PYTHON" -m venv venv
fi

echo "Installing dependencies..."
./venv/bin/pip install --upgrade pip
./venv/bin/pip install -r requirements.txt

if [[ ! -f .env ]]; then
  if [[ -f deploy/app.env.example ]]; then
    cp deploy/app.env.example .env
    echo "Created .env from deploy/app.env.example — edit YANDEX_MAPS_API_KEY on server."
  else
    echo "WARNING: .env missing. Create it before production use."
  fi
fi

chown -R www-data:www-data "$APP_DIR" 2>/dev/null || true

if systemctl is-active --quiet "$SERVICE_NAME" 2>/dev/null; then
  echo "Restarting $SERVICE_NAME..."
  sudo systemctl restart "$SERVICE_NAME"
elif systemctl list-unit-files "$SERVICE_NAME.service" 2>/dev/null | grep -q "$SERVICE_NAME"; then
  echo "Starting $SERVICE_NAME..."
  sudo systemctl start "$SERVICE_NAME"
else
  echo "Service $SERVICE_NAME not registered. Run scripts/server-bootstrap.sh once on the server."
  echo "Manual start: cd $APP_DIR && ./venv/bin/uvicorn app.main:app --host 0.0.0.0 --port 8000"
fi

echo "Remote install finished."
