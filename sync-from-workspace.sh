#!/bin/sh
set -eu

APP_DIR="$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)"
DEPLOY_DIR="$(CDPATH= cd -- "$APP_DIR/.." && pwd)"
STATIC_DIR="$DEPLOY_DIR/backend/static"

cp "$STATIC_DIR/index.html" "$APP_DIR/index.html"
cp "$STATIC_DIR/app.js" "$APP_DIR/app.js"
cp "$STATIC_DIR/styles.css" "$APP_DIR/styles.css"
cp "$STATIC_DIR/_headers" "$APP_DIR/_headers"
cp "$STATIC_DIR/robots.txt" "$APP_DIR/robots.txt"

printf '%s\n' "Synced Health Platform static app."
