#!/usr/bin/env bash
# Деплой на удалённый Linux-сервер (bash / Git Bash / WSL).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

ENV_FILE="$ROOT/.deploy.env"
if [[ ! -f "$ENV_FILE" ]]; then
  echo "Create .deploy.env from .deploy.env.example" >&2
  exit 1
fi

# shellcheck disable=SC1090
source "$ENV_FILE"

: "${DEPLOY_HOST:?DEPLOY_HOST required}"
: "${DEPLOY_USER:?DEPLOY_USER required}"
DEPLOY_PORT="${DEPLOY_PORT:-22}"
DEPLOY_PATH="${DEPLOY_PATH:-/opt/utility-jkh}"
DEPLOY_SERVICE="${DEPLOY_SERVICE:-utility-jkh}"

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
