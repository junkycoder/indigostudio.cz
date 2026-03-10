#!/usr/bin/env bash
# rebrand.sh — validate and apply a brand config to all targets
# Usage: ./scripts/rebrand.sh <brand>
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

if [[ $# -lt 1 ]]; then
  echo "Usage: $0 <brand>" >&2
  exit 1
fi

BRAND="$1"
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

echo "Rebranding to: $BRAND"
node "$ROOT/scripts/lib/rebrand.js" "$BRAND"
