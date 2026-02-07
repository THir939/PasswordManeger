#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
APP_DIR="$ROOT_DIR/apps/desktop"
APP_BUNDLE="$APP_DIR/dist/mac-arm64/PasswordManeger.app"
IDENTITY="${PM_MAC_SIGN_IDENTITY:--}"

npm --prefix "$APP_DIR" run dist:mac -- --dir

if [ ! -d "$APP_BUNDLE" ]; then
  echo "Error: app bundle not found: $APP_BUNDLE" >&2
  exit 1
fi

codesign --force --deep --sign "$IDENTITY" "$APP_BUNDLE"
codesign --verify --deep --strict --verbose=2 "$APP_BUNDLE"

if spctl -a -vv "$APP_BUNDLE" >/tmp/pm-spctl.log 2>&1; then
  echo "Gatekeeper check: pass"
else
  echo "Gatekeeper check: warning"
  cat /tmp/pm-spctl.log
fi

echo "Signed app: $APP_BUNDLE"
if [ "$IDENTITY" = "-" ]; then
  echo "Signature type: ad-hoc (local test)"
else
  echo "Signature identity: $IDENTITY"
fi
