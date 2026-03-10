#!/usr/bin/env node
/**
 * build-extension.js — assembles extension dist for a given brand and target.
 * Usage: node scripts/lib/build-extension.js <brand> [chrome|firefox|both]
 * Dependencies: Node.js built-ins only (fs, path, child_process)
 */
'use strict';

var fs = require('fs');
var path = require('path');
var cp = require('child_process');

var ROOT = path.resolve(__dirname, '..', '..');
var brand = process.argv[2];
var target = process.argv[3] || 'both';

if (!brand) {
  console.error('Usage: node scripts/lib/build-extension.js <brand> [chrome|firefox|both]');
  process.exit(1);
}

var brandFile = path.join(ROOT, 'brands', brand, 'brand.json');
if (!fs.existsSync(brandFile)) {
  console.error('Brand not found: ' + brandFile);
  process.exit(1);
}

if (!['chrome', 'firefox', 'both'].includes(target)) {
  console.error('Target must be chrome, firefox, or both');
  process.exit(1);
}

// Step 1: run rebrand
console.log('[build-ext] Running rebrand for ' + brand + '...');
cp.execFileSync(process.execPath, [path.join(ROOT, 'scripts', 'lib', 'rebrand.js'), brand], {
  stdio: 'inherit'
});

var cfg = JSON.parse(fs.readFileSync(brandFile, 'utf8'));
var distDir = path.join(ROOT, 'dist');

// Utilities
function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function copyRecursive(src, dest) {
  var stat = fs.statSync(src);
  if (stat.isDirectory()) {
    ensureDir(dest);
    fs.readdirSync(src).forEach(function (entry) {
      copyRecursive(path.join(src, entry), path.join(dest, entry));
    });
  } else {
    ensureDir(path.dirname(dest));
    fs.copyFileSync(src, dest);
  }
}

function buildForTarget(tgt) {
  var outDir = path.join(distDir, 'extension-' + brand + '-' + tgt);
  ensureDir(outDir);

  var srcExt = path.join(ROOT, 'extension');

  // Copy all extension source except manifests
  fs.readdirSync(srcExt).forEach(function (entry) {
    if (entry === 'manifest.v3.json' || entry === 'manifest.v2.json') return;
    copyRecursive(path.join(srcExt, entry), path.join(outDir, entry));
  });

  // Select and transform manifest
  var manifestSrc = tgt === 'firefox'
    ? path.join(srcExt, 'manifest.v2.json')
    : path.join(srcExt, 'manifest.v3.json');
  var manifest = JSON.parse(fs.readFileSync(manifestSrc, 'utf8'));

  // Firefox MV2: merge host_permissions into permissions (already done by rebrand, but ensure)
  if (tgt === 'firefox' && manifest.manifest_version === 2) {
    // already merged by rebrand.js — nothing extra needed
  }

  fs.writeFileSync(
    path.join(outDir, 'manifest.json'),
    JSON.stringify(manifest, null, 2) + '\n'
  );

  // Generate icons if brand has no assets dir
  var assetsDir = path.join(ROOT, 'brands', brand, 'assets');
  var iconsOutDir = path.join(outDir, 'icons');
  ensureDir(iconsOutDir);

  if (!fs.existsSync(assetsDir)) {
    console.log('[build-ext] No assets/ for brand "' + brand + '" — generating placeholder icons...');
    var accent = (cfg.colors && cfg.colors.accent) || '#22c55e';
    try {
      cp.execFileSync('python3', [
        path.join(ROOT, 'scripts', 'gen-icons.py'),
        accent,
        iconsOutDir
      ], { stdio: 'inherit' });
    } catch (e) {
      console.warn('[build-ext] gen-icons.py failed — icons directory will be empty. Error: ' + e.message);
    }
  } else {
    // Copy brand assets
    ['icon16.png', 'icon48.png', 'icon128.png'].forEach(function (icon) {
      var iconSrc = path.join(assetsDir, icon);
      if (fs.existsSync(iconSrc)) {
        fs.copyFileSync(iconSrc, path.join(iconsOutDir, icon));
      }
    });
  }

  console.log('[build-ext] Built: dist/extension-' + brand + '-' + tgt + '/');
  console.log('');

  if (tgt === 'chrome') {
    console.log('  Load in Chrome:');
    console.log('  1. Open chrome://extensions');
    console.log('  2. Enable "Developer mode"');
    console.log('  3. Click "Load unpacked" → select: ' + outDir);
  } else {
    console.log('  Load in Firefox:');
    console.log('  1. Open about:debugging#/runtime/this-firefox');
    console.log('  2. Click "Load Temporary Add-on..."');
    console.log('  3. Select: ' + path.join(outDir, 'manifest.json'));
  }
  console.log('');
}

if (target === 'both') {
  buildForTarget('chrome');
  buildForTarget('firefox');
} else {
  buildForTarget(target);
}

console.log('[build-ext] All done.');
