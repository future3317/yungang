#!/usr/bin/env node
/**
 * Move unreferenced image files out of frontend/static/ui-assets/ into
 * assets-source/unreferenced/ while preserving subdirectory structure.
 *
 * Reference detection mirrors frontend/src/shared/assetUrl.ts:
 * - /ui-assets/<path> and url('/ui-assets/<path>') literals
 * - assetUrl(...) string/template arguments
 * - data JSON fields ending in _asset and fields named image/asset/portrait/badge
 * - Plain string literals that look like logical asset paths
 * - Dynamic template literals keep every file in the referenced directory
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const STATIC_DIR = path.join(ROOT, 'frontend', 'static', 'ui-assets');
const UNREFERENCED_DIR = path.join(ROOT, 'assets-source', 'unreferenced');

const IMAGE_EXT = /\.(webp|avif|png)$/i;
const generatedPrefixes = ['icon_', 'scene_', 'card_', 'ui_', 'effect_'];

function toLogicalPath(value) {
  if (typeof value !== 'string') return null;
  let v = value.trim();
  if (!v) return null;
  if (v.startsWith('/ui-assets/')) v = v.slice('/ui-assets/'.length);
  else if (v.startsWith('ui-assets/')) v = v.slice('ui-assets/'.length);
  if (v.startsWith('/')) return null; // external absolute path
  if (
    v.startsWith('generated/') ||
    v.startsWith('game-ui/') ||
    v.startsWith('interaction/') ||
    v.startsWith('ornaments/')
  )
    return v;
  if (generatedPrefixes.some((p) => v.startsWith(p))) return `generated/${v}`;
  return v;
}

function addReference(referenced, value, allPaths) {
  const lp = toLogicalPath(value);
  if (!lp || lp.startsWith('/')) return;
  if (IMAGE_EXT.test(lp)) referenced.add(lp);

}

function* walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) yield* walk(full);
    else yield full;
  }
}

function removeEmptyDirs(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      removeEmptyDirs(full);
      try {
        fs.rmdirSync(full);
      } catch {
        // not empty
      }
    }
  }
}

// --- Collect every static file (image + any metadata files like JSON) ---
const allFiles = [...walk(STATIC_DIR)];
const allPaths = new Set(allFiles.map((f) => path.relative(STATIC_DIR, f).replace(/\\/g, '/')));
const referenced = new Set();

// Always keep the assetUrl default fallback.
referenced.add('generated/icon_card_scroll.webp');

// --- Scan data JSON files ---
const DATA_DIR = path.join(ROOT, 'data');
function scanData(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      scanData(full);
      continue;
    }
    if (!entry.name.endsWith('.json')) continue;
    let obj;
    try {
      obj = JSON.parse(fs.readFileSync(full, 'utf8'));
    } catch {
      continue;
    }
    function visit(o) {
      if (Array.isArray(o)) o.forEach(visit);
      else if (o && typeof o === 'object') {
        for (const [k, v] of Object.entries(o)) {
          if (typeof v === 'string' && (k.endsWith('_asset') || ['image', 'asset', 'portrait', 'badge'].includes(k))) {
            addReference(referenced, v, allPaths);
          } else if (typeof v === 'object') visit(v);
        }
      }
    }
    visit(obj);
  }
}
scanData(DATA_DIR);

// --- Scan frontend source ---
const SRC_DIR = path.join(ROOT, 'frontend', 'src');
const srcFiles = [...walk(SRC_DIR)].filter((f) => /\.(tsx?|css|m?css)$/i.test(f));

for (const file of srcFiles) {
  const text = fs.readFileSync(file, 'utf8');

  // url('/ui-assets/...')
  for (const m of text.matchAll(/url\(\s*['"]?\/ui-assets\/([^'"\)]+)['"]?\s*\)/g)) {
    addReference(referenced, m[1], allPaths);
  }

  // assetUrl('...') and assetUrl("...")
  for (const m of text.matchAll(/assetUrl\(\s*(['"])([^'"]*?)\1/g)) {
    addReference(referenced, m[2], allPaths);
  }

  // assetUrl(`...`) template literals
  for (const m of text.matchAll(/assetUrl\(\s*`([^`]*?)`/g)) {
    const inner = m[1];
    if (inner.includes('${')) {
      // Dynamic construction: keep every file in the referenced directory.
      // The directory prefix is everything up to the last '/' before the first '${'.
      const dollarIdx = inner.indexOf('${');
      const slashIdx = inner.lastIndexOf('/', dollarIdx);
      if (slashIdx !== -1) {
        const dir = inner.slice(0, slashIdx);
        for (const p of allPaths) {
          if (p.startsWith(dir + '/')) referenced.add(p);
        }
      }
    } else {
      addReference(referenced, inner, allPaths);
    }
  }

  // Plain logical-path string literals (e.g. 'ornaments/role-badge-artisan.webp')
  const logicalRe = /['"]((?:generated|game-ui|interaction|ornaments)\/[^'"]+\.(webp|avif|png))['"]/gi;
  for (const m of text.matchAll(logicalRe)) {
    addReference(referenced, m[1], allPaths);
  }

  // Plain generated-prefixed filenames (e.g. 'icon_role_scribe.webp')
  const prefixRe = new RegExp(`['"]((?:${generatedPrefixes.join('|')})[^'"]+\\.(webp|avif|png))['"]`, 'gi');
  for (const m of text.matchAll(prefixRe)) {
    addReference(referenced, m[1], allPaths);
  }
}

// --- Move unreferenced files ---
let movedCount = 0;
let movedBytes = 0;
const moved = [];

for (const file of allFiles) {
  const rel = path.relative(STATIC_DIR, file).replace(/\\/g, '/');
  if (referenced.has(rel)) continue;

  const dest = path.join(UNREFERENCED_DIR, rel);
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.renameSync(file, dest);
  const size = fs.statSync(dest).size;
  movedCount += 1;
  movedBytes += size;
  moved.push({ from: rel, size });
}

// Remove empty directories left behind in the static tree.
removeEmptyDirs(STATIC_DIR);

// Report
const initialCount = allFiles.length;
const remainingCount = initialCount - movedCount;
const remainingBytes = [...allPaths].filter((p) => !moved.some((m) => m.from === p)).reduce((sum, p) => {
  try {
    return sum + fs.statSync(path.join(STATIC_DIR, p)).size;
  } catch {
    return sum;
  }
}, 0);

console.log(`Pruned unreferenced static assets.`);
console.log(`  Initial files: ${initialCount}`);
console.log(`  Moved: ${movedCount} files (${formatBytes(movedBytes)})`);
console.log(`  Remaining: ${remainingCount} files (${formatBytes(remainingBytes)})`);
if (moved.length > 0) {
  console.log('\nLargest moved files:');
  moved
    .sort((a, b) => b.size - a.size)
    .slice(0, 20)
    .forEach((m) => console.log(`  - ${m.from}: ${formatBytes(m.size)}`));
}

function formatBytes(n) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(2)} MB`;
}
