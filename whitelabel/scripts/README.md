# Scripts

All scripts live in `scripts/`. The bash entry points validate input and delegate to Node.js helpers in `scripts/lib/` (Node built-ins only — no npm install required).

---

## new-brand.sh

Scaffold a new brand directory from the default template.

```bash
./scripts/new-brand.sh <brand>
```

**What it does:**
1. Validates the brand name (`[a-z0-9][a-z0-9_-]*`)
2. Creates `brands/<brand>/`
3. Copies `brands/default/brand.json` as the starting point
4. Prints next steps

**Example:**

```bash
./scripts/new-brand.sh acme-eu
# Created: brands/acme-eu/brand.json
# Edit the file, then run: ./scripts/rebrand.sh acme-eu
```

---

## rebrand.sh

Apply a brand config to all targets in one step.

```bash
./scripts/rebrand.sh <brand>
```

**What it patches:**

| File | Change |
|------|--------|
| `app/capacitor.config.json` | `appId`, `appName`, notification icon color |
| `app/www/css/brand.css` | Full `:root { --color-* }` block |
| `app/www/js/brand-config.js` | `window.__BRAND__`, `window.__BRAND_CAPABILITIES__` |
| `extension/manifest.v3.json` | name, version, description, permissions, host_permissions, content_scripts |
| `extension/manifest.v2.json` | same + merged permissions + gecko ID |
| `extension/popup/popup.css` | `:root { --color-* }` block |

**Output also includes** a copy-pasteable list of Android `<uses-permission>` lines and iOS plist keys for the brand's enabled capabilities.

**Example:**

```bash
./scripts/rebrand.sh acme

# [rebrand] Patched app/capacitor.config.json
# [rebrand] Wrote app/www/css/brand.css
# [rebrand] Wrote app/www/js/brand-config.js
# [rebrand] Patched extension/manifest.v3.json
# [rebrand] Patched extension/manifest.v2.json
# [rebrand] Patched extension/popup/popup.css :root
#
# [rebrand] Done — brand: AcmeApp (acme)
#
# Android permissions to add to AndroidManifest.xml:
#   <uses-permission android:name="android.permission.CAMERA" />
#   <uses-permission android:name="android.permission.ACCESS_FINE_LOCATION" />
```

---

## build-extension.sh

Rebrand and assemble a distribution-ready extension package.

```bash
./scripts/build-extension.sh <brand> [chrome|firefox|both]
```

**Default target:** `both`

**What it does:**
1. Runs `rebrand.sh` for the brand
2. Creates `dist/extension-<brand>-<target>/`
3. Copies all extension source files
4. Writes the appropriate `manifest.json` (MV3 for Chrome, MV2 for Firefox)
5. Generates placeholder icons from the accent color — or copies from `brands/<brand>/assets/` if present
6. Prints load instructions for each target browser

**Output:**

```
dist/
├── extension-acme-chrome/
│   ├── manifest.json
│   ├── background.js
│   ├── content.js
│   ├── icons/
│   │   ├── icon16.png
│   │   ├── icon48.png
│   │   └── icon128.png
│   └── popup/
│       ├── popup.html
│       ├── popup.css
│       └── popup.js
└── extension-acme-firefox/
    └── ...
```

**Load in Chrome:**
1. Open `chrome://extensions`
2. Enable "Developer mode"
3. Click "Load unpacked" → select `dist/extension-<brand>-chrome/`

**Load in Firefox:**
1. Open `about:debugging#/runtime/this-firefox`
2. Click "Load Temporary Add-on…"
3. Select `dist/extension-<brand>-firefox/manifest.json`

**Example:**

```bash
./scripts/build-extension.sh acme chrome
./scripts/build-extension.sh acme firefox
./scripts/build-extension.sh acme both   # shorthand
```

---

## gen-icons.py

Generate solid-color PNG icons. Called automatically by `build-extension.sh` when no brand assets are found. Can also be run directly.

```bash
python3 scripts/gen-icons.py <hex_color> <output_dir>
```

**Generates:** `icon16.png`, `icon48.png`, `icon128.png`

**Requirements:** Python 3 standard library only (no Pillow or other packages).

**Example:**

```bash
python3 scripts/gen-icons.py "#ef4444" /tmp/icons
# [gen-icons] Wrote /tmp/icons/icon16.png  (16×16 px, color=#ef4444)
# [gen-icons] Wrote /tmp/icons/icon48.png  (48×48 px, color=#ef4444)
# [gen-icons] Wrote /tmp/icons/icon128.png (128×128 px, color=#ef4444)
```

---

## lib/rebrand.js

Node.js implementation of the rebrand pipeline. Called by `rebrand.sh`. Uses only `fs` and `path` from the Node standard library.

## lib/build-extension.js

Node.js implementation of the extension build pipeline. Called by `build-extension.sh`. Uses `fs`, `path`, and `child_process` from the Node standard library.
