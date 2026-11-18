// ============================================================================
// NYXEN — Production Bundle & Compression Analyzer
// Measures exact network transfer size (raw, gzip, and brotli)
// ============================================================================

import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';

const FILES = [
  'index.html',
  'manifest.json',
  'sw.js',
  'src/math.js',
  'src/species.js',
  'src/fish_physics.js',
  'src/world.js',
  'src/renderer.js',
  'src/audio.js',
  'src/controls.js',
  'src/game.js',
  'src/royale.js'
];

console.log('---------------------------------------------------------');
console.log('NYXEN — Network Transfer & Bundle Size Audit');
console.log('Target: Below 2.0 MB initial compressed transfer');
console.log('---------------------------------------------------------');

let totalRaw = 0;
let totalGzip = 0;
let totalBrotli = 0;

for (const f of FILES) {
  const content = fs.readFileSync(f);
  const rawSize = content.length;
  const gzipSize = zlib.gzipSync(content, { level: 9 }).length;
  const brotliSize = zlib.brotliCompressSync(content).length;

  totalRaw += rawSize;
  totalGzip += gzipSize;
  totalBrotli += brotliSize;

  console.log(`[FILE] ${f.padEnd(22)} | Raw: ${(rawSize / 1024).toFixed(1)} KB | Gzip: ${(gzipSize / 1024).toFixed(1)} KB | Brotli: ${(brotliSize / 1024).toFixed(1)} KB`);
}

console.log('---------------------------------------------------------');
console.log(`TOTAL BASE EXPERIENCE (Uncompressed): ${(totalRaw / 1024).toFixed(1)} KB (${(totalRaw / (1024 * 1024)).toFixed(3)} MB)`);
console.log(`TOTAL BASE EXPERIENCE (Gzip compressed):   ${(totalGzip / 1024).toFixed(1)} KB (${(totalGzip / (1024 * 1024)).toFixed(3)} MB)`);
console.log(`TOTAL BASE EXPERIENCE (Brotli compressed): ${(totalBrotli / 1024).toFixed(1)} KB (${(totalBrotli / (1024 * 1024)).toFixed(3)} MB)`);
console.log('---------------------------------------------------------');
const targetMB = 2.0;
const actualGzipMB = totalGzip / (1024 * 1024);
if (actualGzipMB < targetMB) {
  console.log(`✓ PERFORMANCE TARGET MET! ${(actualGzipMB).toFixed(3)} MB is ${(100 - (actualGzipMB / targetMB * 100)).toFixed(1)}% BELOW the 2.0 MB budget limit.`);
} else {
  console.error(`✗ Performance budget exceeded: ${actualGzipMB.toFixed(3)} MB > 2.0 MB`);
}
console.log('---------------------------------------------------------');
