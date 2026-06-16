#!/usr/bin/env bash
# Деплой на ТОМ ЖЕ сервере, где лежит проект (без SSH).
# Запуск из корня репозитория: bash scripts/deploy-local.sh
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

export DEPLOY_SERVICE="${DEPLOY_SERVICE:-utility-jkh}"
bash "$ROOT/scripts/remote-install.sh" "$ROOT"

echo "==> Local deploy finished."
