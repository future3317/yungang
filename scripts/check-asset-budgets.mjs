#!/usr/bin/env node
/**
 * Scan frontend/static/ and enforce asset budgets.
 *
 * Budgets:
 * - Single file: 300 KB
 * - Total static/: 5 MB
 * - First-screen critical bundle: 1.5 MB
 *
 * First-screen heuristic includes files commonly needed for the initial paint:
 *   ui-assets/scene_*, ui-assets/ui_banner*, ui-assets/ui_mural*,
 *   ui-assets/ornaments/*, ui-assets/game-ui/seals/*,
 *   ui-assets/game-ui/cards/*, ui-assets/icon_badge_sheet*,
 *   ui-assets/ui_card_back*, ui-assets/ui_card_frame_sheet*,
 *   ui-assets/effect_victory_ring*
 *
 * Source PNGs and asset packs must not be checked into frontend/static/.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const STATIC_DIR = path.join(ROOT, 'frontend', 'static');

const SINGLE_BUDGET = 300 * 1024;
const TOTAL_BUDGET = 5 * 1024 * 1024;
const FIRST_SCREEN_BUDGET = 1.5 * 1024 * 1024;

const FIRST_SCREEN_PATTERNS = [
  /^ui-assets\/scene_/,
  /^ui-assets\/ui_banner/,
  /^ui-assets\/ui_mural/,
  /^ui-assets\/ornaments\//,
  /^ui-assets\/game-ui\/seals\//,
  /^ui-assets\/game-ui\/cards\//,
  /^ui-assets\/icon_badge_sheet/,
  /^ui-assets\/ui_card_back/,
  /^ui-assets\/ui_card_frame_sheet/,
  /^ui-assets\/effect_victory_ring/,
];

const PROHIBITED_PATTERNS = [
  { re: /\.png$/i, name: 'PNG source' },
  { re: /\.zip$/i, name: 'ZIP asset pack' },
  { re: /\.tar\.gz$/i, name: 'TAR.GZ asset pack' },
  { re: /\.rar$/i, name: 'RAR asset pack' },
  { re: /\.7z$/i, name: '7Z asset pack' },
];

function* walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) yield* walk(full);
    else yield full;
  }
}

function formatBytes(n) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(2)} MB`;
}

const files = [...walk(STATIC_DIR)].map((full) => {
  const rel = path.relative(STATIC_DIR, full).replace(/\\/g, '/');
  const size = fs.statSync(full).size;
  const isFirstScreen = FIRST_SCREEN_PATTERNS.some((re) => re.test(rel));
  return { rel, full, size, isFirstScreen };
});

const totalSize = files.reduce((sum, f) => sum + f.size, 0);
const firstScreenSize = files.filter((f) => f.isFirstScreen).reduce((sum, f) => sum + f.size, 0);
const oversized = files.filter((f) => f.size > SINGLE_BUDGET).sort((a, b) => b.size - a.size);
const largest = [...files].sort((a, b) => b.size - a.size).slice(0, 20);
const prohibited = files.filter((f) => PROHIBITED_PATTERNS.some((p) => p.re.test(f.rel)));

const totalOk = totalSize <= TOTAL_BUDGET;
const firstScreenOk = firstScreenSize <= FIRST_SCREEN_BUDGET;
const singleOk = oversized.length === 0;
const prohibitedOk = prohibited.length === 0;

console.log(`Asset budget report for ${path.relative(ROOT, STATIC_DIR)}`);
console.log(`  Total size:      ${formatBytes(totalSize)} (budget ${formatBytes(TOTAL_BUDGET)}) ${totalOk ? 'OK' : 'EXCEEDED'}`);
console.log(`  First-screen:    ${formatBytes(firstScreenSize)} (budget ${formatBytes(FIRST_SCREEN_BUDGET)}) ${firstScreenOk ? 'OK' : 'EXCEEDED'}`);
console.log(`  File count:      ${files.length}`);
console.log(`  Oversized files: ${oversized.length} (> ${formatBytes(SINGLE_BUDGET)})`);

if (prohibited.length > 0) {
  console.log('\nProhibited source/asset-pack files found:');
  prohibited.forEach((f) => {
    const match = PROHIBITED_PATTERNS.find((p) => p.re.test(f.rel));
    console.log(`  - ${f.rel}: ${match?.name || 'prohibited'}`);
  });
}

if (oversized.length > 0) {
  console.log('\nOversized files:');
  oversized.forEach((f) => console.log(`  - ${f.rel}: ${formatBytes(f.size)}`));
}

console.log('\nLargest files:');
largest.forEach((f) => console.log(`  - ${f.rel}: ${formatBytes(f.size)}`));

if (!totalOk || !firstScreenOk || !singleOk || !prohibitedOk) {
  process.exitCode = 1;
}
