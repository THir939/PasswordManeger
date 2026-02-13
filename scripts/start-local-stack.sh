#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
SERVER_DIR="$ROOT_DIR/server"
DESKTOP_DIR="$ROOT_DIR/apps/desktop"
ENV_FILE="$SERVER_DIR/.env"
SERVER_LOG="${PM_SERVER_LOG:-/tmp/passwordmaneger-server.log}"
MCP_LOG="${PM_MCP_LOG:-/tmp/passwordmaneger-mcp.log}"
SERVER_PID=""
MCP_PID=""

usage() {
  cat <<USAGE
Usage:
  ./scripts/start-local-stack.sh [--with-mcp]

Options:
  --with-mcp   Start MCP server together.

Environment:
  PM_WEB_BASE_URL            Web base URL for desktop (default: http://localhost:8787)
  PM_SERVER_LOG              Server log path (default: /tmp/passwordmaneger-server.log)
  PM_MCP_LOG                 MCP log path (default: /tmp/passwordmaneger-mcp.log)
  PM_MCP_ALLOW_SECRET_EXPORT MCP secret export opt-in (default: 0)
USAGE
}

WITH_MCP=0

for arg in "$@"; do
  case "$arg" in
    --with-mcp)
      WITH_MCP=1
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "Unknown option: $arg" >&2
      usage >&2
      exit 1
      ;;
  esac
done

cleanup() {
  if [ -n "$MCP_PID" ]; then
    kill "$MCP_PID" >/dev/null 2>&1 || true
  fi

  if [ -n "$SERVER_PID" ]; then
    kill "$SERVER_PID" >/dev/null 2>&1 || true
  fi
}
trap cleanup EXIT INT TERM

if [ ! -f "$ENV_FILE" ]; then
  echo "Error: $ENV_FILE がありません。先に cp server/.env.example server/.env を実行してください。" >&2
  exit 1
fi

if ! grep -q '^JWT_SECRET=' "$ENV_FILE"; then
  echo "Error: server/.env に JWT_SECRET がありません。" >&2
  exit 1
fi

JWT_SECRET_VALUE="$(grep '^JWT_SECRET=' "$ENV_FILE" | head -n1 | cut -d= -f2-)"
if [ -z "$JWT_SECRET_VALUE" ] || [ "$JWT_SECRET_VALUE" = "replace-with-long-random-secret" ]; then
  echo "Error: JWT_SECRET を実運用向けの値に変更してください。" >&2
  exit 1
fi

if [ ! -d "$ROOT_DIR/node_modules" ]; then
  echo "[setup] root dependencies をインストールします..."
  npm --prefix "$ROOT_DIR" install
fi

if [ ! -d "$SERVER_DIR/node_modules" ]; then
  echo "[setup] server dependencies をインストールします..."
  npm --prefix "$SERVER_DIR" install
fi

if [ ! -d "$DESKTOP_DIR/node_modules" ]; then
  echo "[setup] desktop dependencies をインストールします..."
  npm --prefix "$DESKTOP_DIR" install
fi

echo "[start] server"
npm --prefix "$SERVER_DIR" run dev >"$SERVER_LOG" 2>&1 &
SERVER_PID=$!

BASE_URL="${PM_WEB_BASE_URL:-http://localhost:8787}"

for _ in {1..40}; do
  if curl -sf "$BASE_URL/api/health" >/dev/null; then
    break
  fi
  sleep 1
done

if ! curl -sf "$BASE_URL/api/health" >/dev/null; then
  echo "Error: server health check failed: $BASE_URL/api/health" >&2
  echo "---- server log ----" >&2
  tail -n 80 "$SERVER_LOG" >&2 || true
  exit 1
fi

if [ "$WITH_MCP" = "1" ]; then
  echo "[start] mcp"
  PM_MCP_WEB_BASE_URL="$BASE_URL" \
  PM_MCP_ALLOW_SECRET_EXPORT="${PM_MCP_ALLOW_SECRET_EXPORT:-0}" \
  npm --prefix "$ROOT_DIR" run mcp:start >"$MCP_LOG" 2>&1 &
  MCP_PID=$!
fi

echo "[ready]"
echo "- Web: $BASE_URL"
echo "- Server log: $SERVER_LOG"
if [ "$WITH_MCP" = "1" ]; then
  echo "- MCP log: $MCP_LOG"
fi

export PM_WEB_BASE_URL="$BASE_URL"
exec npm --prefix "$DESKTOP_DIR" run dev
