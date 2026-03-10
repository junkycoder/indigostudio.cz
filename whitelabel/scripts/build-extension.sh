#!/usr/bin/env bash
# build-extension.sh — build browser extension dist for a brand
# Usage: ./scripts/build-extension.sh <brand> [chrome|firefox|both]
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

if [[ $# -lt 1 ]]; then
  echo "Usage: $0 <brand> [chrome|firefox|both]" >&2
  exit 1
fi

BRAND="$1"
TARGET="${2:-both}"

BRAND_FILE="$ROOT/brands/$BRAND/brand.json"

if [[ ! -f "$BRAND_FILE" ]]; then
  echo "Error: brand file not found: $BRAND_FILE" >&2
  echo "Available brands:" >&2
  ls "$ROOT/brands/" >&2
  exit 1
fi

# Validate JSON
if ! node -e "JSON.parse(require('fs').readFileSync('$BRAND_FILE','utf8'))" 2>/dev/null; then
  echo "Error: $BRAND_FILE is not valid JSON" >&2
  exit 1
fi

case "$TARGET" in
  chrome|firefox|both) ;;
  *)
    echo "Error: target must be chrome, firefox, or both (got: $TARGET)" >&2
    exit 1
    ;;
esac

echo "Building extension — brand: $BRAND, target: $TARGET"
node "$ROOT/scripts/lib/build-extension.js" "$BRAND" "$TARGET"
