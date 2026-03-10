#!/usr/bin/env bash
# new-brand.sh — scaffold a new brand directory from the default template
# Usage: ./scripts/new-brand.sh <brand>
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

if [[ $# -lt 1 ]]; then
  echo "Usage: $0 <brand>" >&2
  exit 1
fi

BRAND="$1"
DEST="$ROOT/brands/$BRAND"
DEFAULT="$ROOT/brands/default"

# Validate brand name
if [[ ! "$BRAND" =~ ^[a-z0-9][a-z0-9_-]*$ ]]; then
  echo "Error: brand name must be lowercase alphanumeric with optional hyphens/underscores" >&2
  exit 1
fi

if [[ -d "$DEST" ]]; then
  echo "Error: brand '$BRAND' already exists at $DEST" >&2
  exit 1
fi

mkdir -p "$DEST"
cp "$DEFAULT/brand.json" "$DEST/brand.json"

echo "Created: $DEST/brand.json"
echo ""
echo "Next steps:"
echo "  1. Edit $DEST/brand.json (name, bundleId, colors, capabilities)"
echo "  2. Optionally add $DEST/assets/icon16.png, icon48.png, icon128.png"
echo "  3. Run: ./scripts/rebrand.sh $BRAND"
echo "  4. Run: ./scripts/build-extension.sh $BRAND both"
