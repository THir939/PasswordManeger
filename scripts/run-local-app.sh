#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
SERVER_LOG="/tmp/passwordmaneger-server.log"
SERVER_PID=""

cleanup() {
  if [ -n "$SERVER_PID" ]; then
    kill "$SERVER_PID" >/dev/null 2>&1 || true
  fi
}
trap cleanup EXIT

npm --prefix "$ROOT_DIR/server" run dev >"$SERVER_LOG" 2>&1 &
SERVER_PID=$!

for _ in {1..30}; do
  if curl -sf http://localhost:8787/api/health >/dev/null; then
    break
  fi
  sleep 1
done

export PM_WEB_BASE_URL="${PM_WEB_BASE_URL:-http://localhost:8787}"

npm --prefix "$ROOT_DIR/apps/desktop" run dev
