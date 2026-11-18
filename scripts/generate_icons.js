// ============================================================================
// NYXEN — Procedural PWA Icon Generator
// Creates high-resolution 192x192, 512x512, and maskable PNG icons + SVG
// Zero external dependencies (uses Node built-in zlib)
// ============================================================================

import fs from 'fs';
import path from 'path';
import zlib from 'zlib';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 1. Generate Master Vector SVG
const SVG_ICON = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <defs>
    <radialGradient id="oceanBg" cx="50%" cy="40%" r="65%">
      <stop offset="0%" stop-color="#0284c7" />
      <stop offset="60%" stop-color="#034574" />
      <stop offset="100%" stop-color="#04121f" />
    </radialGradient>
    <radialGradient id="biolumGlow" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="#22d3ee" stop-opacity="0.45" />
      <stop offset="100%" stop-color="#0284c7" stop-opacity="0" />
    </radialGradient>
    <linearGradient id="clownOrange" x1="0%" y1="0%" x2="100%" y2="80%">
      <stop offset="0%" stop-color="#fb923c" />
      <stop offset="60%" stop-color="#ea580c" />
      <stop offset="100%" stop-color="#9a3412" />
    </linearGradient>
    <linearGradient id="finGlow" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#f97316" stop-opacity="0.9" />
      <stop offset="100%" stop-color="#0f172a" stop-opacity="0.7" />
    </linearGradient>
    <filter id="softGlow" x="-20%" y="-20%" width="140%" height="140%">
      <feGaussianBlur stdDeviation="8" result="blur" />
      <feComposite in="SourceGraphic" in2="blur" operator="over" />
    </filter>
  </defs>

  <!-- Deep Ocean Circular Background -->
  <rect width="512" height="512" rx="108" fill="url(#oceanBg)" />

  <!-- Bioluminescent Ambient Ring -->
  <circle cx="256" cy="256" r="210" fill="none" stroke="#22d3ee" stroke-width="3" stroke-dasharray="14 10" opacity="0.3" />
  <circle cx="256" cy="256" r="180" fill="url(#biolumGlow)" />

  <!-- Sun Shaft Caustic Highlights -->
  <path d="M120 40 L190 260 L140 260 Z" fill="#ffffff" opacity="0.06" />
  <path d="M220 30 L310 320 L260 320 Z" fill="#ffffff" opacity="0.08" />
  <path d="M340 30 L410 240 L370 240 Z" fill="#ffffff" opacity="0.05" />

  <!-- Fish Body Group (Scaled & Centered in Safe Area) -->
  <g transform="translate(256, 256) scale(1.15)">
    <!-- Caudal Fin (Tail) -->
    <path d="M-90 -10 C-145 -55, -165 -60, -150 -10 C-165 40, -145 35, -90 -10 Z" fill="url(#finGlow)" stroke="#0f172a" stroke-width="4" />
    <path d="M-150 -10 C-160 -35, -155 -38, -145 -10" stroke="#ffffff" stroke-width="3" fill="none" opacity="0.8" />

    <!-- Dorsal Fin -->
    <path d="M-40 -40 C-30 -90, 40 -85, 50 -35 Z" fill="url(#finGlow)" stroke="#0f172a" stroke-width="4" />
    <path d="M-30 -55 C5 -80, 35 -75, 45 -45" stroke="#ffffff" stroke-width="3" fill="none" opacity="0.8" />

    <!-- Ventral / Anal Fin -->
    <path d="M-35 35 C-20 75, 30 70, 40 30 Z" fill="url(#finGlow)" stroke="#0f172a" stroke-width="4" />

    <!-- Main Fish Body (Ocellaris Clownfish) -->
    <ellipse cx="0" cy="-5" rx="100" ry="52" fill="url(#clownOrange)" stroke="#0f172a" stroke-width="5" />

    <!-- White Biological Bar Stripes with Jet-Black Outlines -->
    <!-- Tail Stripe -->
    <path d="M-65 -30 C-68 0, -68 0, -65 25" stroke="#0f172a" stroke-width="15" stroke-linecap="round" fill="none" />
    <path d="M-65 -30 C-68 0, -68 0, -65 25" stroke="#ffffff" stroke-width="9" stroke-linecap="round" fill="none" />

    <!-- Middle Curved Saddle Stripe -->
    <path d="M-5 -49 C12 -20, 10 15, -8 44" stroke="#0f172a" stroke-width="22" stroke-linecap="round" fill="none" />
    <path d="M-5 -49 C12 -20, 10 15, -8 44" stroke="#ffffff" stroke-width="14" stroke-linecap="round" fill="none" />

    <!-- Head Crescent Stripe -->
    <path d="M52 -40 C65 -15, 62 10, 48 30" stroke="#0f172a" stroke-width="20" stroke-linecap="round" fill="none" />
    <path d="M52 -40 C65 -15, 62 10, 48 30" stroke="#ffffff" stroke-width="13" stroke-linecap="round" fill="none" />

    <!-- Pectoral Fin -->
    <path d="M15 -5 C25 -25, 45 -15, 35 15 C20 22, 10 10, 15 -5 Z" fill="#ea580c" stroke="#0f172a" stroke-width="3" opacity="0.95" />
    <ellipse cx="28" cy="0" rx="6" ry="12" fill="#ffffff" opacity="0.75" />

    <!-- Eye: Deep Black with Golden/Cyan Ring -->
    <circle cx="72" cy="-14" r="10" fill="#0f172a" />
    <circle cx="72" cy="-14" r="8" fill="#fbbf24" opacity="0.85" />
    <circle cx="73" cy="-14" r="5" fill="#000000" />
    <circle cx="75" cy="-16" r="2.5" fill="#ffffff" />

    <!-- Mouth -->
    <path d="M96 -6 C98 -3, 95 2, 91 4" stroke="#0f172a" stroke-width="3" fill="none" stroke-linecap="round" />
  </g>

  <!-- Water Bubble Accents -->
  <circle cx="395" cy="180" r="12" fill="none" stroke="#22d3ee" stroke-width="2" opacity="0.6" />
  <circle cx="398" cy="177" r="3" fill="#ffffff" opacity="0.8" />

  <circle cx="420" cy="140" r="7" fill="none" stroke="#22d3ee" stroke-width="1.5" opacity="0.5" />
  <circle cx="380" cy="130" r="5" fill="none" stroke="#22d3ee" stroke-width="1.2" opacity="0.4" />
</svg>`;

// 2. Pure Node PNG Encoder with CRC32
function crc32(buf) {
  let table = [];
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) {
      c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
    }
    table[i] = c;
  }
  let crc = 0 ^ (-1);
  for (let i = 0; i < buf.length; i++) {
    crc = (crc >>> 8) ^ table[(crc ^ buf[i]) & 0xff];
  }
  return (crc ^ (-1)) >>> 0;
}

function makeChunk(type, data) {
  const len = data.length;
  const chunk = Buffer.alloc(12 + len);
  chunk.writeUInt32BE(len, 0);
  chunk.write(type, 4, 4, 'ascii');
  data.copy(chunk, 8);
  const typeAndData = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  chunk.writeUInt32BE(crc32(typeAndData), 8 + len);
  return chunk;
}

function createPng(width, height, pixelFn) {
  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6; // RGBA
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;
  const ihdrChunk = makeChunk('IHDR', ihdr);

  const raw = Buffer.alloc(height * (1 + width * 4));
  let offset = 0;
  for (let y = 0; y < height; y++) {
    raw[offset++] = 0; // Filter None
    for (let x = 0; x < width; x++) {
      const [r, g, b, a] = pixelFn(x, y, width, height);
      raw[offset++] = r;
      raw[offset++] = g;
      raw[offset++] = b;
      raw[offset++] = a;
    }
  }

  const compressed = zlib.deflateSync(raw, { level: 9 });
  const idatChunk = makeChunk('IDAT', compressed);
  const iendChunk = makeChunk('IEND', Buffer.alloc(0));

  return Buffer.concat([sig, ihdrChunk, idatChunk, iendChunk]);
}

// 3. Mathematical Renderer for High-Resolution Raster Icons
function renderIconPixel(x, y, size, isMaskable = false) {
  const nx = (x / size) * 2 - 1; // -1 to +1
  const ny = (y / size) * 2 - 1; // -1 to +1
  const dist = Math.hypot(nx, ny);

  // Background ocean gradient
  const gradT = Math.min(1.0, Math.max(0.0, (ny + 0.9) * 0.55));
  let bgR = Math.round(2 + gradT * (4 - 2));
  let bgG = Math.round(132 - gradT * (132 - 18));
  let bgB = Math.round(199 - gradT * (199 - 31));
  let alpha = 255;

  // Maskable or standard rounded corner check
  if (!isMaskable) {
    // Rounded rect mask
    const cornerR = 0.42;
    const qx = Math.max(0, Math.abs(nx) - (1.0 - cornerR));
    const qy = Math.max(0, Math.abs(ny) - (1.0 - cornerR));
    const cDist = Math.hypot(qx, qy);
    if (cDist > cornerR) {
      return [0, 0, 0, 0];
    }
  }

  // Radial bioluminescent glow
  const glow = Math.max(0, 1.0 - dist * 1.25);
  bgR = Math.min(255, Math.round(bgR + glow * 34));
  bgG = Math.min(255, Math.round(bgG + glow * 110));
  bgB = Math.min(255, Math.round(bgB + glow * 140));

  // Fish coordinate transform
  const fx = (nx - 0.02) * 1.25;
  const fy = (ny + 0.03) * 1.25;

  // Body Ellipse check: ((fx / 0.55)^2 + (fy / 0.32)^2) <= 1.0
  const bodyDist = Math.pow(fx / 0.58, 2) + Math.pow(fy / 0.33, 2);

  // Tail Fin: triangle / cone from fx ~ -0.4 to -0.9
  const isTail = (fx < -0.42 && fx > -0.88 && Math.abs(fy) < (-(fx + 0.42) * 0.75 + 0.08));
  // Dorsal Fin: top arc
  const isDorsal = (fx > -0.25 && fx < 0.28 && fy < 0 && fy > -0.48 && Math.abs(fx - 0.02) < 0.28);
  // Ventral Fin: bottom arc
  const isVentral = (fx > -0.22 && fx < 0.22 && fy > 0 && fy < 0.44 && Math.abs(fx) < 0.22);

  if (bodyDist <= 1.0 || isTail || isDorsal || isVentral) {
    // Body coloring: Vivid Clownfish Orange
    let r = 249, g = 115, b = 22;

    // Body shading
    if (fy > 0.15) {
      r = 217; g = 70; b = 12; // underside shadow
    } else if (fy < -0.15) {
      r = 251; g = 146; b = 60; // dorsal highlight
    }

    // Fin edge darkening
    if (isTail || isDorsal || isVentral) {
      if (Math.abs(fx) > 0.78 || fy < -0.38 || fy > 0.35) {
        r = 15; g = 23; b = 42; // black fin border
      } else {
        r = 234; g = 88; b = 12;
      }
    }

    // White biological bar stripes
    // Stripe 1: Tail bar
    const isTailBar = Math.abs(fx + 0.38) < 0.055 && bodyDist <= 0.95;
    // Stripe 2: Middle saddle bar
    const midCurve = -0.05 + fy * 0.18;
    const isMidBar = Math.abs(fx - midCurve) < 0.075 && bodyDist <= 0.98;
    // Stripe 3: Head crescent bar
    const headCurve = 0.30 - fy * 0.15;
    const isHeadBar = Math.abs(fx - headCurve) < 0.065 && bodyDist <= 0.96;

    // Black margins around white bars
    const isTailBorder = Math.abs(fx + 0.38) < 0.085;
    const isMidBorder = Math.abs(fx - midCurve) < 0.105;
    const isHeadBorder = Math.abs(fx - headCurve) < 0.095;

    if (isTailBar || isMidBar || isHeadBar) {
      r = 255; g = 255; b = 255;
    } else if (isTailBorder || isMidBorder || isHeadBorder) {
      r = 15; g = 23; b = 42;
    }

    // Eye
    const eyeDist = Math.hypot(fx - 0.42, fy + 0.08);
    if (eyeDist < 0.065) {
      if (eyeDist < 0.02) {
        r = 255; g = 255; b = 255; // highlight
      } else if (eyeDist < 0.04) {
        r = 0; g = 0; b = 0; // pupil
      } else {
        r = 251; g = 191; b = 36; // golden iris
      }
    }

    return [r, g, b, alpha];
  }

  // Cyan Water Bubbles
  const bubble1 = Math.hypot(nx - 0.62, ny + 0.32);
  const bubble2 = Math.hypot(nx - 0.70, ny + 0.50);
  if (Math.abs(bubble1 - 0.05) < 0.012 || Math.abs(bubble2 - 0.03) < 0.009) {
    return [34, 211, 238, 220];
  }

  return [bgR, bgG, bgB, alpha];
}

// 4. Execute Build
console.log('Generating NYXEN PWA Icon Suite...');
const baseDir = path.resolve(__dirname, '..');
const iconsDir = path.join(baseDir, 'icons');
if (!fs.existsSync(iconsDir)) fs.mkdirSync(iconsDir, { recursive: true });

// Write SVG
fs.writeFileSync(path.join(iconsDir, 'icon.svg'), SVG_ICON, 'utf8');
console.log('✓ Created icons/icon.svg');

// Write Standard & Maskable PNGs (192 & 512)
const configs = [
  { name: 'icon-192.png', size: 192, maskable: false },
  { name: 'icon-512.png', size: 512, maskable: false },
  { name: 'icon-maskable-192.png', size: 192, maskable: true },
  { name: 'icon-maskable-512.png', size: 512, maskable: true },
];

for (const cfg of configs) {
  const buf = createPng(cfg.size, cfg.size, (x, y, w, h) => renderIconPixel(x, y, w, cfg.maskable));
  const outPath = path.join(iconsDir, cfg.name);
  fs.writeFileSync(outPath, buf);
  console.log(`✓ Created icons/${cfg.name} (${buf.length} bytes, ${cfg.size}x${cfg.size})`);
}

// 5. Generate 1024x500 Google Play Store Feature Graphic Banner
console.log('Generating Google Play Store Feature Graphic (1024x500)...');
function renderFeatureGraphic(x, y, w, h) {
  const nx = (x / w) * 2 - 1; // -1 to 1
  const ny = (y / h) * 2 - 1; // -1 to 1

  // Deep oceanic gradient
  const gradT = Math.min(1.0, Math.max(0.0, (ny + 0.8) * 0.6));
  let bgR = Math.round(3 + gradT * (4 - 3));
  let bgG = Math.round(130 - gradT * (130 - 18));
  let bgB = Math.round(200 - gradT * (200 - 31));

  // Sun shafts
  const shaft1 = Math.sin((nx * 1.5 - ny * 0.8) * 12.0);
  if (shaft1 > 0.8 && ny < 0.2) {
    bgR = Math.min(255, bgR + 15);
    bgG = Math.min(255, bgG + 25);
    bgB = Math.min(255, bgB + 35);
  }

  // Centered fish motif (scaled down horizontally to fit 16:9 banner)
  const fx = (nx - 0.25) * 2.2;
  const fy = (ny - 0.0) * 1.6;
  const bodyDist = Math.pow(fx / 0.58, 2) + Math.pow(fy / 0.33, 2);

  const isTail = (fx < -0.42 && fx > -0.88 && Math.abs(fy) < (-(fx + 0.42) * 0.75 + 0.08));
  const isDorsal = (fx > -0.25 && fx < 0.28 && fy < 0 && fy > -0.48 && Math.abs(fx - 0.02) < 0.28);
  const isVentral = (fx > -0.22 && fx < 0.22 && fy > 0 && fy < 0.44 && Math.abs(fx) < 0.22);

  if (bodyDist <= 1.0 || isTail || isDorsal || isVentral) {
    let r = 249, g = 115, b = 22;
    if (fy > 0.15) { r = 217; g = 70; b = 12; }
    else if (fy < -0.15) { r = 251; g = 146; b = 60; }

    const midCurve = -0.05 + fy * 0.18;
    const isTailBar = Math.abs(fx + 0.38) < 0.055 && bodyDist <= 0.95;
    const isMidBar = Math.abs(fx - midCurve) < 0.075 && bodyDist <= 0.98;
    const isHeadBar = Math.abs(fx - (0.30 - fy * 0.15)) < 0.065 && bodyDist <= 0.96;

    if (isTailBar || isMidBar || isHeadBar) {
      r = 255; g = 255; b = 255;
    } else if (Math.abs(fx + 0.38) < 0.085 || Math.abs(fx - midCurve) < 0.105 || Math.abs(fx - (0.30 - fy * 0.15)) < 0.095) {
      r = 15; g = 23; b = 42;
    }

    const eyeDist = Math.hypot(fx - 0.42, fy + 0.08);
    if (eyeDist < 0.065) {
      if (eyeDist < 0.02) { r = 255; g = 255; b = 255; }
      else if (eyeDist < 0.04) { r = 0; g = 0; b = 0; }
      else { r = 251; g = 191; b = 36; }
    }

    return [r, g, b, 255];
  }

  // Cyan bioluminescent accent ring around fish
  const ringDist = Math.hypot(nx - 0.25, ny);
  if (Math.abs(ringDist - 0.6) < 0.015) {
    return [34, 211, 238, 180];
  }

  return [bgR, bgG, bgB, 255];
}

const bannerBuf = createPng(1024, 500, renderFeatureGraphic);
fs.writeFileSync(path.join(iconsDir, 'feature-graphic-1024x500.png'), bannerBuf);
console.log(`✓ Created icons/feature-graphic-1024x500.png (${bannerBuf.length} bytes, 1024x500)`);

console.log('All PWA & Google Play Store Assets generated successfully!');
