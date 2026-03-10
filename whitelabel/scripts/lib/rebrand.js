#!/usr/bin/env node
/**
 * rebrand.js — patches all configs for a given brand.
 * Usage: node scripts/lib/rebrand.js <brand>
 * Dependencies: Node.js built-ins only (fs, path)
 */
'use strict';

var fs = require('fs');
var path = require('path');

var ROOT = path.resolve(__dirname, '..', '..');
var brand = process.argv[2];

if (!brand) {
  console.error('Usage: node scripts/lib/rebrand.js <brand>');
  process.exit(1);
}

var brandFile = path.join(ROOT, 'brands', brand, 'brand.json');
if (!fs.existsSync(brandFile)) {
  console.error('Brand not found: ' + brandFile);
  process.exit(1);
}

var cfg = JSON.parse(fs.readFileSync(brandFile, 'utf8'));

// ── 1. Capacitor config ──────────────────────────────────────────────────────
var capConfigPath = path.join(ROOT, 'app', 'capacitor.config.json');
var capConfig = JSON.parse(fs.readFileSync(capConfigPath, 'utf8'));
capConfig.appId = cfg.bundleId;
capConfig.appName = cfg.name;
if (cfg.colors && cfg.colors.accent) {
  capConfig.plugins = capConfig.plugins || {};
  capConfig.plugins.LocalNotifications = capConfig.plugins.LocalNotifications || {};
  capConfig.plugins.LocalNotifications.iconColor = cfg.colors.accent;
}
fs.writeFileSync(capConfigPath, JSON.stringify(capConfig, null, 2) + '\n');
console.log('[rebrand] Patched app/capacitor.config.json');

// ── 2. brand.css ─────────────────────────────────────────────────────────────
var c = cfg.colors || {};
var brandCss = [
  '/* GENERATED FILE — do not edit manually. Run: ./scripts/rebrand.sh ' + brand + ' */',
  ':root {',
  '  --color-accent: ' + (c.accent || '#22c55e') + ';',
  '  --color-background: ' + (c.background || '#0d0d0d') + ';',
  '  --color-surface: ' + (c.surface || '#1a1a1a') + ';',
  '  --color-border: ' + (c.border || '#2a2a2a') + ';',
  '  --color-text: ' + (c.text || '#f0f0f0') + ';',
  '  --color-text-muted: ' + (c.textMuted || '#888888') + ';',
  '}',
  ''
].join('\n');
var brandCssPath = path.join(ROOT, 'app', 'www', 'css', 'brand.css');
fs.writeFileSync(brandCssPath, brandCss);
console.log('[rebrand] Wrote app/www/css/brand.css');

// ── 3. brand-config.js ───────────────────────────────────────────────────────
var caps = cfg.capabilities || {};
var brandConfigJs = [
  '/* GENERATED FILE — do not edit manually. Run: ./scripts/rebrand.sh ' + brand + ' */',
  'window.__BRAND__ = ' + JSON.stringify({ name: cfg.name, bundleId: cfg.bundleId, version: cfg.version }, null, 2) + ';',
  '',
  'window.__BRAND_CAPABILITIES__ = ' + JSON.stringify(caps, null, 2) + ';',
  ''
].join('\n');
var brandConfigPath = path.join(ROOT, 'app', 'www', 'js', 'brand-config.js');
fs.writeFileSync(brandConfigPath, brandConfigJs);
console.log('[rebrand] Wrote app/www/js/brand-config.js');

// ── 4. Extension manifests ───────────────────────────────────────────────────
var ext = cfg.extension || {};
var extPerms = ext.permissions || [];
var hostPerms = ext.host_permissions || [];
var contentScriptsMatch = ext.content_scripts_match || [];

// MV3
var mv3Path = path.join(ROOT, 'extension', 'manifest.v3.json');
var mv3 = JSON.parse(fs.readFileSync(mv3Path, 'utf8'));
mv3.name = cfg.name;
mv3.version = cfg.version;
mv3.description = ext.description || cfg.description;
mv3.permissions = extPerms;
mv3.host_permissions = hostPerms;
mv3.content_scripts = contentScriptsMatch.length > 0 ? [{
  matches: contentScriptsMatch,
  js: ['content.js'],
  run_at: 'document_idle'
}] : [];
fs.writeFileSync(mv3Path, JSON.stringify(mv3, null, 2) + '\n');
console.log('[rebrand] Patched extension/manifest.v3.json');

// MV2 — merge host_permissions into permissions
var mv2Path = path.join(ROOT, 'extension', 'manifest.v2.json');
var mv2 = JSON.parse(fs.readFileSync(mv2Path, 'utf8'));
mv2.name = cfg.name;
mv2.version = cfg.version;
mv2.description = ext.description || cfg.description;
var mv2Perms = extPerms.concat(hostPerms);
// deduplicate
mv2.permissions = mv2Perms.filter(function (p, i) { return mv2Perms.indexOf(p) === i; });
mv2.content_scripts = contentScriptsMatch.length > 0 ? [{
  matches: contentScriptsMatch,
  js: ['content.js'],
  run_at: 'document_idle'
}] : [];
mv2.applications = { gecko: { id: ext.firefox_id || (brand + '@fakan.cz'), strict_min_version: '91.0' } };
fs.writeFileSync(mv2Path, JSON.stringify(mv2, null, 2) + '\n');
console.log('[rebrand] Patched extension/manifest.v2.json');

// ── 5. popup.css :root ───────────────────────────────────────────────────────
var popupCssPath = path.join(ROOT, 'extension', 'popup', 'popup.css');
var popupCss = fs.readFileSync(popupCssPath, 'utf8');
var newRoot = [
  ':root {',
  '  --color-accent: ' + (c.accent || '#22c55e') + ';',
  '  --color-background: ' + (c.background || '#0d0d0d') + ';',
  '  --color-surface: ' + (c.surface || '#1a1a1a') + ';',
  '  --color-border: ' + (c.border || '#2a2a2a') + ';',
  '  --color-text: ' + (c.text || '#f0f0f0') + ';',
  '  --color-text-muted: ' + (c.textMuted || '#888888') + ';',
  '}'
].join('\n');
// Replace the :root { ... } block (non-greedy)
popupCss = popupCss.replace(/:root\s*\{[^}]*\}/, newRoot);
fs.writeFileSync(popupCssPath, popupCss);
console.log('[rebrand] Patched extension/popup/popup.css :root');

// ── 6. Print native permissions reference ───────────────────────────────────
console.log('\n[rebrand] Done — brand: ' + cfg.name + ' (' + brand + ')');
console.log('\nAndroid permissions to add to AndroidManifest.xml:');
(cfg.permissions && cfg.permissions.android || []).forEach(function (p) {
  console.log('  <uses-permission android:name="' + p + '" />');
});
if (cfg.permissions && cfg.permissions.ios && cfg.permissions.ios.length > 0) {
  console.log('\niOS Info.plist keys required:');
  cfg.permissions.ios.forEach(function (k) {
    console.log('  ' + k);
  });
}
