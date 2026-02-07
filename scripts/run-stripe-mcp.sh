#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
ENV_FILE="$ROOT_DIR/server/.env"

if [[ -z "${STRIPE_SECRET_KEY:-}" ]]; then
  if [[ -f "$ENV_FILE" ]]; then
    # shellcheck disable=SC1090
    source "$ENV_FILE"
  fi
fi

if [[ -z "${STRIPE_SECRET_KEY:-}" ]]; then
  echo "STRIPE_SECRET_KEY が未設定です。server/.env か環境変数に設定してください。" >&2
  exit 1
fi

TOOLS="${STRIPE_MCP_TOOLS:-all}"

exec npx -y @stripe/mcp --tools="$TOOLS" --api-key="$STRIPE_SECRET_KEY"
