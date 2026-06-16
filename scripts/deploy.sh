#!/usr/bin/env bash
# Деплой на удалённый Linux-сервер. Запуск на Ubuntu:
#   bash scripts/deploy.sh
# НЕ запускайте deploy.ps1 — это скрипт только для Windows PowerShell.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

ENV_FILE="$ROOT/.deploy.env"
if [[ ! -f "$ENV_FILE" ]]; then
  echo "Создайте .deploy.env из .deploy.env.example" >&2
  exit 1
fi

# Загрузка .deploy.env (поддержка CRLF из Windows)
load_deploy_env() {
  while IFS= read -r line || [[ -n "$line" ]]; do
    line="${line%$'\r'}"
    [[ -z "$line" || "$line" =~ ^[[:space:]]*# ]] && continue
    [[ "$line" != *=* ]] && continue
    key="${line%%=*}"
    val="${line#*=}"
    key="${key#"${key%%[![:space:]]*}"}"
    key="${key%"${key##*[![:space:]]}"}"
    val="${val#"${val%%[![:space:]]*}"}"
    val="${val%"${val##*[![:space:]]}"}"
    export "$key=$val"
  done < "$ENV_FILE"
}
load_deploy_env

: "${DEPLOY_HOST:?DEPLOY_HOST required in .deploy.env}"
: "${DEPLOY_USER:?DEPLOY_USER required in .deploy.env}"
DEPLOY_PORT="${DEPLOY_PORT:-22}"
DEPLOY_PATH="${DEPLOY_PATH:-/opt/utility-jkh}"
DEPLOY_SERVICE="${DEPLOY_SERVICE:-utility-jkh}"

# Деплой на localhost без SSH
if [[ "$DEPLOY_HOST" == "localhost" || "$DEPLOY_HOST" == "127.0.0.1" ]]; then
  echo "==> Local mode (DEPLOY_HOST=$DEPLOY_HOST)"
  export DEPLOY_SERVICE
  bash "$ROOT/scripts/remote-install.sh" "$DEPLOY_PATH"
  exit 0
fi

SSH_OPTS=(-p "$DEPLOY_PORT" -o StrictHostKeyChecking=accept-new)
[[ -n "${DEPLOY_SSH_KEY:-}" ]] && SSH_OPTS+=(-i "$DEPLOY_SSH_KEY")

REMOTE="${DEPLOY_USER}@${DEPLOY_HOST}"
ARCHIVE="/tmp/utility-jkh-deploy-$$.tar.gz"

cleanup() { rm -f "$ARCHIVE"; }
trap cleanup EXIT

echo "==> Building archive..."
tar -czf "$ARCHIVE" \
  --exclude='venv' \
  --exclude='__pycache__' \
  --exclude='*.pyc' \
  --exclude='.env' \
  --exclude='utility.db' \
  --exclude='.deploy.env' \
  --exclude='*.docx' \
  --exclude='.git' \
  --exclude='deploy.tar.gz' \
  -C "$ROOT" app requirements.txt deploy scripts/remote-install.sh scripts/server-bootstrap.sh

echo "==> Uploading to $REMOTE:$DEPLOY_PATH ..."
ssh "${SSH_OPTS[@]}" "$REMOTE" "mkdir -p '$DEPLOY_PATH'"
scp "${SSH_OPTS[@]}" "$ARCHIVE" "$REMOTE:/tmp/utility-jkh-deploy.tar.gz"

echo "==> Installing on server..."
ssh "${SSH_OPTS[@]}" "$REMOTE" bash -s <<REMOTE_SCRIPT
set -euo pipefail
mkdir -p '$DEPLOY_PATH'
tar -xzf /tmp/utility-jkh-deploy.tar.gz -C '$DEPLOY_PATH'
rm -f /tmp/utility-jkh-deploy.tar.gz
export DEPLOY_SERVICE='$DEPLOY_SERVICE'
bash '$DEPLOY_PATH/scripts/remote-install.sh' '$DEPLOY_PATH'
REMOTE_SCRIPT

if [[ -n "${DEPLOY_HEALTH_URL:-}" ]]; then
  echo "==> Health check: $DEPLOY_HEALTH_URL"
  sleep 2
  curl -fsS "$DEPLOY_HEALTH_URL" >/dev/null && echo "OK" || echo "WARNING: health check failed"
fi

echo "==> Deploy finished: $DEPLOY_HOST"
