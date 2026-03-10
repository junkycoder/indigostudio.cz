# Brand Configuration

Each brand lives in its own directory under `brands/` and is defined by a single `brand.json` file.

```
brands/
├── default/brand.json   ← base template, always kept at defaults
├── acme/brand.json      ← example client brand
└── <name>/brand.json    ← your brand (created by new-brand.sh)
```

---

## Full schema

```jsonc
{
  // ── App identity ──────────────────────────────────────────
  "name": "WhiteApp",               // App display name (Capacitor + extension)
  "bundleId": "cz.fakan.whiteapp",  // Reverse-DNS bundle/package ID
  "version": "1.0.0",               // Semver — written to all manifests
  "description": "...",             // Short description (extension store listing)

  // ── Colors ───────────────────────────────────────────────
  "colors": {
    "accent":     "#22c55e",   // Primary interactive color (buttons, links, header)
    "background": "#0d0d0d",   // Page / app background
    "surface":    "#1a1a1a",   // Cards, inputs, elevated surfaces
    "border":     "#2a2a2a",   // Dividers and input outlines
    "text":       "#f0f0f0",   // Primary text
    "textMuted":  "#888888"    // Secondary / placeholder text
  },

  // ── Capability flags ─────────────────────────────────────
  // Controls which feature cards appear in the app UI.
  // Only enabled capabilities trigger native plugin calls.
  "capabilities": {
    "camera":        false,
    "location":      false,
    "microphone":    false,
    "notifications": true,
    "storage":       true
  },

  // ── Native permissions ───────────────────────────────────
  // Printed by rebrand.sh as a reference — paste into native project files.
  "permissions": {
    "android": [
      "android.permission.INTERNET",
      "android.permission.ACCESS_NETWORK_STATE"
      // Add when capabilities are enabled:
      // "android.permission.CAMERA"
      // "android.permission.ACCESS_FINE_LOCATION"
      // "android.permission.ACCESS_COARSE_LOCATION"
      // "android.permission.RECORD_AUDIO"
    ],
    "ios": [
      // Add when capabilities are enabled:
      // "NSCameraUsageDescription"
      // "NSLocationWhenInUseUsageDescription"
      // "NSMicrophoneUsageDescription"
    ]
  },

  // ── Extension settings ───────────────────────────────────
  "extension": {
    "permissions": ["storage", "notifications"],
    // ^ Standard WebExtension permissions.
    // Common additions: "tabs", "activeTab", "contextMenus", "cookies"

    "host_permissions": [],
    // ^ Domains the extension can access.
    // Example: ["https://acme.com/*", "https://*.acme.com/*"]
    // MV2 (Firefox): automatically merged into permissions[] by the build script.

    "content_scripts_match": [],
    // ^ Pages where content.js is injected.
    // Usually mirrors host_permissions. Leave empty for popup-only extensions.
    // Example: ["https://acme.com/*"]

    "description": "Default browser extension",
    // ^ Shown in browser extension stores / management pages.

    "firefox_id": "whiteapp@fakan.cz"
    // ^ Gecko application ID. Must be unique per Firefox listing.
    // Convention: <appname>@<domain>
  }
}
```

---

## What gets written where

| `brand.json` field | Output file | Key |
|--------------------|-------------|-----|
| `name` | `capacitor.config.json` | `appName` |
| `bundleId` | `capacitor.config.json` | `appId` |
| `colors.*` | `app/www/css/brand.css` | `--color-*` CSS vars |
| `colors.accent` | `capacitor.config.json` | `plugins.LocalNotifications.iconColor` |
| `name`, `bundleId`, `version` | `app/www/js/brand-config.js` | `window.__BRAND__` |
| `capabilities` | `app/www/js/brand-config.js` | `window.__BRAND_CAPABILITIES__` |
| `name`, `version`, `description` | `extension/manifest.v3.json` | top-level fields |
| `extension.permissions` | `extension/manifest.v3.json` | `permissions` |
| `extension.host_permissions` | `extension/manifest.v3.json` | `host_permissions` |
| `extension.content_scripts_match` | `extension/manifest.v3.json` | `content_scripts[].matches` |
| `name`, `version`, `description` | `extension/manifest.v2.json` | top-level fields |
| `extension.permissions` + `host_permissions` | `extension/manifest.v2.json` | `permissions` (merged) |
| `extension.firefox_id` | `extension/manifest.v2.json` | `applications.gecko.id` |
| `colors.*` | `extension/popup/popup.css` | `:root { --color-* }` |

---

## Example: acme brand

```json
{
  "name": "AcmeApp",
  "bundleId": "com.acme.app",
  "version": "1.0.0",
  "description": "Acme Corp mobile application",
  "colors": {
    "accent": "#ef4444"
  },
  "capabilities": {
    "camera": true,
    "location": true,
    "notifications": true,
    "storage": true
  },
  "extension": {
    "permissions": ["storage", "notifications", "tabs"],
    "host_permissions": ["https://acme.com/*", "https://*.acme.com/*"],
    "content_scripts_match": ["https://acme.com/*"],
    "firefox_id": "acmeapp@acme.com"
  }
}
```

---

## Adding icon assets

Place icons in `brands/<name>/assets/` to override the auto-generated placeholders:

```
brands/acme/
├── brand.json
└── assets/
    ├── icon16.png    (16×16 px)
    ├── icon48.png    (48×48 px)
    └── icon128.png   (128×128 px)
```

If no `assets/` directory is found, `build-extension.sh` generates solid-color squares from the accent color using `scripts/gen-icons.py`.
