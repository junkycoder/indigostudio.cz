# Whitelabel Scaffold

One brand config. One command. Fully rebranded Capacitor app + browser extension.

---

## What it does

Edit a single `brand.json` file, run `./scripts/rebrand.sh <brand>`, and every output file updates automatically:

| Target | What gets patched |
|--------|-------------------|
| **Capacitor app** | `capacitor.config.json` (appId, appName), CSS custom properties, capability flags |
| **Chrome extension** | Manifest v3 (name, version, permissions, host patterns) |
| **Firefox extension** | Manifest v2 (merged permissions, gecko ID) |
| **Popup UI** | `:root` color block in `popup.css` |

Build the extension for distribution with one more command:

```bash
./scripts/build-extension.sh <brand> both
# → dist/extension-<brand>-chrome/   (load unpacked in chrome://extensions)
# → dist/extension-<brand>-firefox/  (load in about:debugging)
```

---

## Directory structure

```
whitelabel/
├── brands/
│   ├── default/brand.json      ← base template (green, minimal permissions)
│   └── acme/brand.json         ← example client (red, camera + location)
│
├── app/                        ← Capacitor 6 web app
│   ├── package.json
│   ├── capacitor.config.json   ← PATCHED by rebrand
│   └── www/
│       ├── index.html
│       ├── css/
│       │   ├── main.css        ← structural styles (uses CSS vars)
│       │   └── brand.css       ← GENERATED: CSS custom properties
│       └── js/
│           ├── brand-config.js ← GENERATED: window.__BRAND_CAPABILITIES__
│           └── app.js          ← feature-guarded Capacitor plugin calls
│
├── extension/                  ← browser extension source
│   ├── manifest.v3.json        ← PATCHED: Chrome / Edge
│   ├── manifest.v2.json        ← PATCHED: Firefox
│   ├── background.js           ← service worker (MV3) / background page (MV2)
│   ├── content.js              ← injected into matching pages
│   └── popup/
│       ├── popup.html
│       ├── popup.css           ← PATCHED: :root color block
│       └── popup.js            ← cross-browser (API = browser || chrome)
│
├── scripts/
│   ├── rebrand.sh              ← entry point: validate → call Node helper
│   ├── build-extension.sh      ← entry point: rebrand → assemble dist/
│   ├── new-brand.sh            ← scaffold new brand from default template
│   ├── gen-icons.py            ← generates solid-color PNGs (stdlib only)
│   └── lib/
│       ├── rebrand.js          ← patches all configs (Node built-ins only)
│       └── build-extension.js  ← assembles dist/ (Node built-ins only)
│
└── dist/                       ← built extension packages (gitignored)
    ├── extension-<brand>-chrome/
    └── extension-<brand>-firefox/
```

---

## Quick start

**1. Create a brand**

```bash
./scripts/new-brand.sh myco
# → edit brands/myco/brand.json
```

**2. Apply the brand**

```bash
./scripts/rebrand.sh myco
```

**3. Preview the app**

```bash
cd app && npm install && npm run serve
# open http://localhost:8080
```

**4. Build the extension**

```bash
cd .. && ./scripts/build-extension.sh myco both
```

---

## Brand config

All branding lives in `brands/<name>/brand.json`. See [`brands/README.md`](brands/README.md) for the full schema.

Key fields at a glance:

```json
{
  "name": "AcmeApp",
  "bundleId": "com.acme.app",
  "colors": { "accent": "#ef4444" },
  "capabilities": { "camera": true, "location": true },
  "extension": { "host_permissions": ["https://acme.com/*"] }
}
```

---

## Capability flags

The `capabilities` block controls which feature cards appear in the app UI and which Capacitor plugins are invoked. Disabled features are hidden — no dead code paths at runtime.

| Flag | App feature | Android permission | iOS plist key |
|------|-------------|-------------------|---------------|
| `camera` | Photo capture | `CAMERA` | `NSCameraUsageDescription` |
| `location` | Current position | `ACCESS_FINE_LOCATION` | `NSLocationWhenInUseUsageDescription` |
| `microphone` | _(reserved)_ | `RECORD_AUDIO` | `NSMicrophoneUsageDescription` |
| `notifications` | Local notifications | _(auto)_ | _(auto)_ |
| `storage` | Key-value store | _(auto)_ | _(auto)_ |

After rebranding, the script prints the exact manifest lines needed for Android and iOS.

---

## Extension dual-target

| | Chrome / Edge | Firefox |
|--|--------------|---------|
| Manifest | v3 | v2 |
| Background | service worker | background page |
| Action key | `action` | `browser_action` |
| Host permissions | separate `host_permissions` | merged into `permissions` |
| Firefox ID | — | `applications.gecko.id` |

Cross-browser JS uses a one-line shim at the top of every script:

```javascript
var API = (typeof browser !== 'undefined') ? browser : chrome;
```

---

## Custom icon assets

Place PNG files in `brands/<name>/assets/` to use real icons. Without them, `gen-icons.py` generates solid-color placeholder squares from the brand's accent color.

```
brands/myco/
├── brand.json
└── assets/
    ├── icon16.png
    ├── icon48.png
    └── icon128.png
```

---

## Scripts reference

See [`scripts/README.md`](scripts/README.md) for full usage.

| Script | Usage |
|--------|-------|
| `new-brand.sh` | `./scripts/new-brand.sh <brand>` |
| `rebrand.sh` | `./scripts/rebrand.sh <brand>` |
| `build-extension.sh` | `./scripts/build-extension.sh <brand> [chrome\|firefox\|both]` |

---

## Dependencies

- **Node.js** ≥ 18 (built-in modules only — no npm install needed for scripts)
- **Python 3** (stdlib only — no Pillow needed for icon generation)
- **npm** (only for the Capacitor app in `app/`)
