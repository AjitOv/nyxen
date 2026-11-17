// ============================================================================
// NYXEN — Real Biological Fish Species System
// Detailed anatomical geometries, fin structures, procedural color patterns,
// swimming kinematics and biological encyclopedia data for 8 marine species.
// ============================================================================

import { Mesh, sin, cos, abs, max, min, sqrt, PI, TAU, clamp, sstep } from './math.js';

export const SPECIES = {
  CLOWNFISH: 'clownfish',
  BLUE_TANG: 'blue_tang',
  YELLOW_TANG: 'yellow_tang',
  LIONFISH: 'lionfish',
  EMPEROR_ANGELFISH: 'emperor_angelfish',
  LONGNOSE_BUTTERFLY: 'longnose_butterfly',
  MOORISH_IDOL: 'moorish_idol',
  ROYAL_GRAMMA: 'royal_gramma'
};

export const SPECIES_DATA = {
  [SPECIES.CLOWNFISH]: {
    id: SPECIES.CLOWNFISH,
    name: 'Ocellaris Clownfish',
    scientificName: 'Amphiprion ocellaris',
    family: 'Pomacentridae (Damselfishes)',
    habitat: 'Shallow coral reefs & Sea Anemone hosts',
    lengthCm: 8,
    swimmingStyle: 'Subcarangiform / Labriform hybrid',
    description: 'Iconic reef fish with brilliant orange coloration and three vivid white vertical bars outlined in deep black. Possesses a protective mucus coating allowing full symbiosis within stinging sea anemones.',
    speed: 5.5,
    burstSpeed: 12.0,
    turnRate: 3.2,
    buoyancy: 0.98,
    mass: 0.25,
    drag: 0.85,
    eyeOffset: [0.08, 0.05, 0.22],
    scale: 0.65,
    staminaRegen: 1.2
  },
  [SPECIES.BLUE_TANG]: {
    id: SPECIES.BLUE_TANG,
    name: 'Blue Tang',
    scientificName: 'Paracanthurus hepatus',
    family: 'Acanthuridae (Surgeonfishes)',
    habitat: 'Clear offshore coral reefs & outer slopes',
    lengthCm: 25,
    swimmingStyle: 'Labriform (pectoral rowing)',
    description: 'Vibrant royal-blue surgeonfish with a distinctive black painter-palette swirl along its flank and a bright canary-yellow triangular caudal fin. Agile browser of macroalgae.',
    speed: 7.5,
    burstSpeed: 16.5,
    turnRate: 2.8,
    buoyancy: 1.0,
    mass: 0.6,
    drag: 0.72,
    eyeOffset: [0.09, 0.08, 0.32],
    scale: 0.85,
    staminaRegen: 1.0
  },
  [SPECIES.YELLOW_TANG]: {
    id: SPECIES.YELLOW_TANG,
    name: 'Yellow Tang',
    scientificName: 'Zebrasoma flavescens',
    family: 'Acanthuridae (Surgeonfishes)',
    habitat: 'Sunlit shallow reef flats & lagoon corals',
    lengthCm: 20,
    swimmingStyle: 'Labriform / Balistiform',
    description: 'Radiant lemon-yellow disc-shaped body with high dorsal and anal fins creating a striking diamond profile. Features a razor-sharp white defense scalpel spine at the base of the tail.',
    speed: 6.2,
    burstSpeed: 14.0,
    turnRate: 3.5,
    buoyancy: 1.02,
    mass: 0.5,
    drag: 0.8,
    eyeOffset: [0.07, 0.12, 0.30],
    scale: 0.8,
    staminaRegen: 1.1
  },
  [SPECIES.LIONFISH]: {
    id: SPECIES.LIONFISH,
    name: 'Red Lionfish',
    scientificName: 'Pterois volitans',
    family: 'Scorpaenidae (Scorpionfishes)',
    habitat: 'Rocky overhangs, caverns & reef slopes',
    lengthCm: 38,
    swimmingStyle: 'Stately hovering & Undulatory fins',
    description: 'Spectacular apex predator characterized by 13 venomous elongated dorsal needle spines and immense, wing-like fan pectoral fins with alternating maroon and ivory zebra stripes.',
    speed: 3.8,
    burstSpeed: 10.0,
    turnRate: 2.1,
    buoyancy: 1.0,
    mass: 1.2,
    drag: 1.1,
    eyeOffset: [0.12, 0.08, 0.38],
    scale: 1.05,
    staminaRegen: 0.85
  },
  [SPECIES.EMPEROR_ANGELFISH]: {
    id: SPECIES.EMPEROR_ANGELFISH,
    name: 'Emperor Angelfish',
    scientificName: 'Pomacanthus imperator',
    family: 'Pomacanthidae (Angelfishes)',
    habitat: 'Submerged ledges, shipwrecks & deep channels',
    lengthCm: 40,
    swimmingStyle: 'Carangiform (authoritative cruiser)',
    description: 'Majestic reef guardian covered in roughly 25 horizontal electric-blue and yellow stripes, a midnight-blue bandit mask trimmed in cyan neon, and a radiant orange tail.',
    speed: 6.8,
    burstSpeed: 15.5,
    turnRate: 2.4,
    buoyancy: 0.99,
    mass: 1.4,
    drag: 0.78,
    eyeOffset: [0.11, 0.10, 0.42],
    scale: 1.0,
    staminaRegen: 0.95
  },
  [SPECIES.LONGNOSE_BUTTERFLY]: {
    id: SPECIES.LONGNOSE_BUTTERFLY,
    name: 'Yellow Longnose Butterflyfish',
    scientificName: 'Forcipiger flavissimus',
    family: 'Chaetodontidae (Butterflyfishes)',
    habitat: 'Coral reef drop-offs & intricate crevices',
    lengthCm: 22,
    swimmingStyle: 'Micro-thrust hovering & Acute yaw',
    description: 'Distinguished by an extraordinarily elongated forceps beak adapted for plucking small invertebrates from deep reef fissures. Bright yellow body, silvery-white chest, and false eye-spot.',
    speed: 5.8,
    burstSpeed: 13.0,
    turnRate: 4.0,
    buoyancy: 1.01,
    mass: 0.45,
    drag: 0.76,
    eyeOffset: [0.06, 0.08, 0.45],
    scale: 0.78,
    staminaRegen: 1.3
  },
  [SPECIES.MOORISH_IDOL]: {
    id: SPECIES.MOORISH_IDOL,
    name: 'Moorish Idol',
    scientificName: 'Zanclus cornutus',
    family: 'Zanclidae',
    habitat: 'Surge channels, seaward reefs & rocky passes',
    lengthCm: 23,
    swimmingStyle: 'Balistiform gliding',
    description: 'One of the most famous tropical marine fishes. Features a dramatic disc profile with a long white sickle dorsal filament, vertical black and yellow bands, and a lemon snout saddle.',
    speed: 6.5,
    burstSpeed: 14.8,
    turnRate: 3.1,
    buoyancy: 1.0,
    mass: 0.55,
    drag: 0.82,
    eyeOffset: [0.07, 0.14, 0.32],
    scale: 0.88,
    staminaRegen: 1.05
  },
  [SPECIES.ROYAL_GRAMMA]: {
    id: SPECIES.ROYAL_GRAMMA,
    name: 'Royal Gramma',
    scientificName: 'Gramma loreto',
    family: 'Grammatidae (Basslets)',
    habitat: 'Deep reef caves, overhangs & shadowed ceilings',
    lengthCm: 8,
    swimmingStyle: 'Subcarangiform acrobat',
    description: 'Electric two-tone coloration with radiant royal violet-magenta on the anterior half and blazing canary yellow on the posterior half. Renowned for swimming upside down along cave roofs.',
    speed: 5.2,
    burstSpeed: 11.5,
    turnRate: 3.8,
    buoyancy: 0.97,
    mass: 0.22,
    drag: 0.88,
    eyeOffset: [0.07, 0.04, 0.20],
    scale: 0.6,
    staminaRegen: 1.25
  }
};

// ----------------------------------------------------------------
// Species Mesh Builders
// Builds unique 3D vertex geometry, fins, eyes and species colors
// ----------------------------------------------------------------

export function buildFishMesh(speciesId) {
  const mesh = new Mesh();
  const spec = SPECIES_DATA[speciesId];
  if (!spec) return mesh.toBuffers();

  switch (speciesId) {
    case SPECIES.CLOWNFISH:
      buildClownfish(mesh);
      break;
    case SPECIES.BLUE_TANG:
      buildBlueTang(mesh);
      break;
    case SPECIES.YELLOW_TANG:
      buildYellowTang(mesh);
      break;
    case SPECIES.LIONFISH:
      buildLionfish(mesh);
      break;
    case SPECIES.EMPEROR_ANGELFISH:
      buildEmperorAngelfish(mesh);
      break;
    case SPECIES.LONGNOSE_BUTTERFLY:
      buildLongnoseButterfly(mesh);
      break;
    case SPECIES.MOORISH_IDOL:
      buildMoorishIdol(mesh);
      break;
    case SPECIES.ROYAL_GRAMMA:
      buildRoyalGramma(mesh);
      break;
    default:
      buildClownfish(mesh);
  }

  mesh.computeVertexNormals();
  return mesh.toBuffers();
}

// ----------------------------------------------------------------
// 1. Ocellaris Clownfish
// ----------------------------------------------------------------
function buildClownfish(mesh) {
  const rings = 18;
  const segments = 16;
  const length = 0.8;
  const ringIndices = [];

  for (let r = 0; r <= rings; r++) {
    const t = r / rings;
    const z = (0.5 - t) * length;

    // Body profile
    let height = 0.28 * sin(t * PI);
    let width = 0.14 * sin(t * PI);
    if (t < 0.2) {
      // Blunt snout
      height = 0.28 * Math.pow(sin(t * 2.5 * PI * 0.5), 0.6);
      width = 0.14 * Math.pow(sin(t * 2.5 * PI * 0.5), 0.6);
    } else if (t > 0.8) {
      // Caudal peduncle taper
      height *= 0.55;
      width *= 0.45;
    }

    const ring = [];
    for (let s = 0; s < segments; s++) {
      const angle = (s / segments) * TAU;
      const cosA = cos(angle), sinA = sin(angle);
      const x = cosA * width;
      const y = sinA * height;

      // Color pattern: 3 white bars outlined in black on bright orange
      let cr = 0.96, cg = 0.42, cb = 0.08; // Deep vibrant orange
      const zNorm = t; // 0 (snout) to 1 (tail)

      // Bar 1 (Head bar: t ~ 0.22 - 0.32)
      // Bar 2 (Mid body bar: t ~ 0.48 - 0.60)
      // Bar 3 (Caudal bar: t ~ 0.78 - 0.86)
      const d1 = abs(zNorm - 0.27);
      const d2 = abs(zNorm - 0.54);
      const d3 = abs(zNorm - 0.82);

      if (d1 < 0.04 || d2 < 0.045 || d3 < 0.035) {
        // Bright white
        cr = 0.98; cg = 0.98; cb = 0.98;
      } else if (d1 < 0.055 || d2 < 0.06 || d3 < 0.048) {
        // Thin black border
        cr = 0.06; cg = 0.06; cb = 0.06;
      }

      // Belly slightly lighter
      if (sinA < -0.3) {
        cg = min(1.0, cg + 0.1);
        cb = min(1.0, cb + 0.05);
      }

      const idx = mesh.vertex(x, y, z, cosA, sinA, 0, s / segments, t, cr, cg, cb, 1);
      ring.push(idx);
    }
    ringIndices.push(ring);
  }

  // Connect rings
  for (let r = 0; r < rings; r++) {
    for (let s = 0; s < segments; s++) {
      const nextS = (s + 1) % segments;
      mesh.quad(ringIndices[r][s], ringIndices[r][nextS], ringIndices[r + 1][nextS], ringIndices[r + 1][s]);
    }
  }

  // Rounded paddle caudal fin
  buildFin(mesh, [0, 0, -0.4], [0, 0, -0.62], 0.22, 0.015, [0.96, 0.45, 0.08], [0.98, 0.98, 0.98], [0.05, 0.05, 0.05]);

  // Dorsal fin (rounded with black margin)
  buildDorsalFin(mesh, 0.1, -0.32, 0.14, 0.012, [0.96, 0.45, 0.08], [0.05, 0.05, 0.05]);

  // Anal fin
  buildAnalFin(mesh, -0.05, -0.28, -0.11, 0.012, [0.96, 0.45, 0.08], [0.05, 0.05, 0.05]);

  // Pectoral fins (left & right)
  buildPectoralFin(mesh, 0.11, -0.02, 0.12, 1, 0.14, [0.96, 0.5, 0.1]);
  buildPectoralFin(mesh, -0.11, -0.02, 0.12, -1, 0.14, [0.96, 0.5, 0.1]);

  // Eyes (left & right)
  buildFishEye(mesh, 0.08, 0.05, 0.22, 0.032);
  buildFishEye(mesh, -0.08, 0.05, 0.22, 0.032);
}

// ----------------------------------------------------------------
// 2. Blue Tang (Paracanthurus hepatus)
// ----------------------------------------------------------------
function buildBlueTang(mesh) {
  const rings = 20;
  const segments = 16;
  const length = 0.95;
  const ringIndices = [];

  for (let r = 0; r <= rings; r++) {
    const t = r / rings;
    const z = (0.5 - t) * length;

    // Compressed oval disc
    let height = 0.36 * sin(t * PI);
    let width = 0.12 * sin(t * PI);
    if (t > 0.8) {
      height *= 0.5;
      width *= 0.4;
    }

    const ring = [];
    for (let s = 0; s < segments; s++) {
      const angle = (s / segments) * TAU;
      const cosA = cos(angle), sinA = sin(angle);
      const x = cosA * width;
      const y = sinA * height;

      // Color pattern: Royal blue with black palette swoop and yellow tail
      let cr = 0.08, cg = 0.25, cb = 0.92; // Deep royal blue

      // Black palette pattern on flanks
      const isSide = abs(cosA) > 0.6;
      if (isSide && t > 0.15 && t < 0.78) {
        const yNorm = sinA;
        // Oval swoop loop
        const loopDist = abs(yNorm - 0.2 * sin(t * PI * 1.5));
        if (loopDist < 0.35 && (t < 0.35 || t > 0.6 || abs(yNorm) > 0.4)) {
          cr = 0.03; cg = 0.03; cb = 0.05; // Velvet black
        }
      }

      // Yellow tail transition near peduncle
      if (t > 0.82) {
        cr = 0.98; cg = 0.85; cb = 0.05; // Canary yellow
      }

      const idx = mesh.vertex(x, y, z, cosA, sinA, 0, s / segments, t, cr, cg, cb, 1);
      ring.push(idx);
    }
    ringIndices.push(ring);
  }

  for (let r = 0; r < rings; r++) {
    for (let s = 0; s < segments; s++) {
      const nextS = (s + 1) % segments;
      mesh.quad(ringIndices[r][s], ringIndices[r][nextS], ringIndices[r + 1][nextS], ringIndices[r + 1][s]);
    }
  }

  // Triangular canary-yellow tail with black margins
  buildFin(mesh, [0, 0, -0.47], [0, 0, -0.72], 0.26, 0.015, [0.98, 0.88, 0.05], [0.98, 0.88, 0.05], [0.05, 0.05, 0.08]);

  // Continuous dorsal crest
  buildDorsalFin(mesh, 0.16, -0.38, 0.13, 0.012, [0.06, 0.18, 0.85], [0.05, 0.05, 0.08]);

  // Continuous anal fin
  buildAnalFin(mesh, -0.05, -0.36, -0.12, 0.012, [0.06, 0.18, 0.85], [0.05, 0.05, 0.08]);

  // Pectoral fins
  buildPectoralFin(mesh, 0.10, -0.02, 0.16, 1, 0.16, [0.95, 0.85, 0.1]);
  buildPectoralFin(mesh, -0.10, -0.02, 0.16, -1, 0.16, [0.95, 0.85, 0.1]);

  // Eyes
  buildFishEye(mesh, 0.09, 0.08, 0.32, 0.034);
  buildFishEye(mesh, -0.09, 0.08, 0.32, 0.034);
}

// ----------------------------------------------------------------
// 3. Yellow Tang (Zebrasoma flavescens)
// ----------------------------------------------------------------
function buildYellowTang(mesh) {
  const rings = 20;
  const segments = 16;
  const length = 0.85;
  const ringIndices = [];

  for (let r = 0; r <= rings; r++) {
    const t = r / rings;
    const z = (0.5 - t) * length;

    // Very tall, laterally compressed disc body
    let height = 0.42 * sin(t * PI);
    let width = 0.10 * sin(t * PI);
    if (t < 0.22) {
      // Elongated snout
      height = 0.12 + 0.30 * t / 0.22;
      width = 0.05 + 0.05 * t / 0.22;
    } else if (t > 0.8) {
      height *= 0.52;
      width *= 0.42;
    }

    const ring = [];
    for (let s = 0; s < segments; s++) {
      const angle = (s / segments) * TAU;
      const cosA = cos(angle), sinA = sin(angle);
      const x = cosA * width;
      const y = sinA * height;

      // Pure radiant lemon yellow
      let cr = 0.98, cg = 0.88, cb = 0.06;

      // White caudal spine "scalpel" near tail base (t ~ 0.78)
      if (t > 0.75 && t < 0.82 && abs(cosA) > 0.7 && abs(sinA) < 0.2) {
        cr = 0.99; cg = 0.99; cb = 0.99; // White scalpel
      }

      const idx = mesh.vertex(x, y, z, cosA, sinA, 0, s / segments, t, cr, cg, cb, 1);
      ring.push(idx);
    }
    ringIndices.push(ring);
  }

  for (let r = 0; r < rings; r++) {
    for (let s = 0; s < segments; s++) {
      const nextS = (s + 1) % segments;
      mesh.quad(ringIndices[r][s], ringIndices[r][nextS], ringIndices[r + 1][nextS], ringIndices[r + 1][s]);
    }
  }

  // Yellow caudal fin
  buildFin(mesh, [0, 0, -0.42], [0, 0, -0.65], 0.28, 0.012, [0.98, 0.88, 0.06], [0.99, 0.95, 0.3], [0.9, 0.75, 0.05]);

  // High sail-like dorsal fin
  buildDorsalFin(mesh, 0.12, -0.35, 0.22, 0.012, [0.98, 0.9, 0.06], [0.99, 0.95, 0.2]);

  // High anal fin
  buildAnalFin(mesh, -0.06, -0.34, -0.19, 0.012, [0.98, 0.9, 0.06], [0.99, 0.95, 0.2]);

  // Pectoral fins
  buildPectoralFin(mesh, 0.08, -0.04, 0.15, 1, 0.14, [0.98, 0.92, 0.3]);
  buildPectoralFin(mesh, -0.08, -0.04, 0.15, -1, 0.14, [0.98, 0.92, 0.3]);

  // Eyes
  buildFishEye(mesh, 0.07, 0.12, 0.30, 0.032);
  buildFishEye(mesh, -0.07, 0.12, 0.30, 0.032);
}

// ----------------------------------------------------------------
// 4. Red Lionfish (Pterois volitans)
// ----------------------------------------------------------------
function buildLionfish(mesh) {
  const rings = 20;
  const segments = 16;
  const length = 1.1;
  const ringIndices = [];

  for (let r = 0; r <= rings; r++) {
    const t = r / rings;
    const z = (0.5 - t) * length;

    let height = 0.32 * sin(t * PI);
    let width = 0.20 * sin(t * PI);
    if (t < 0.2) {
      height = 0.26 * Math.pow(sin(t * 2.5 * PI * 0.5), 0.7);
      width = 0.18 * Math.pow(sin(t * 2.5 * PI * 0.5), 0.7);
    }

    const ring = [];
    for (let s = 0; s < segments; s++) {
      const angle = (s / segments) * TAU;
      const cosA = cos(angle), sinA = sin(angle);
      const x = cosA * width;
      const y = sinA * height;

      // Alternating reddish-brown / maroon and white zebra stripes
      const stripePhase = (t * 14.0 + sinA * 1.5) % 1.0;
      let cr = 0.55, cg = 0.12, cb = 0.08; // Deep maroon / burgundy
      if (stripePhase > 0.45 && stripePhase < 0.85) {
        cr = 0.95; cg = 0.92; cb = 0.88; // Ivory white stripe
      }

      const idx = mesh.vertex(x, y, z, cosA, sinA, 0, s / segments, t, cr, cg, cb, 1);
      ring.push(idx);
    }
    ringIndices.push(ring);
  }

  for (let r = 0; r < rings; r++) {
    for (let s = 0; s < segments; s++) {
      const nextS = (s + 1) % segments;
      mesh.quad(ringIndices[r][s], ringIndices[r][nextS], ringIndices[r + 1][nextS], ringIndices[r + 1][s]);
    }
  }

  // 13 Venomous elongated dorsal needle spines!
  for (let i = 0; i < 12; i++) {
    const zSpine = 0.25 - i * 0.055;
    const spineHeight = 0.28 + 0.22 * sin((i / 11) * PI);
    buildNeedleSpine(mesh, 0, 0.18, zSpine, spineHeight, [0.85, 0.85, 0.85], [0.45, 0.1, 0.08]);
  }

  // Immense wing-like fan pectoral fins with zebra rays!
  buildLionfishPectoralFan(mesh, 1);
  buildLionfishPectoralFan(mesh, -1);

  // Large translucent rounded caudal fin with dark spots
  buildFin(mesh, [0, 0, -0.55], [0, 0, -0.88], 0.32, 0.015, [0.95, 0.92, 0.85], [0.55, 0.15, 0.1], [0.95, 0.92, 0.85]);

  // Anal fin with spines
  buildAnalFin(mesh, -0.1, -0.42, -0.18, 0.015, [0.55, 0.15, 0.1], [0.95, 0.92, 0.85]);

  // Eyes and head tentacles
  buildFishEye(mesh, 0.12, 0.08, 0.38, 0.038);
  buildFishEye(mesh, -0.12, 0.08, 0.38, 0.038);

  // Supraocular tentacles
  buildNeedleSpine(mesh, 0.08, 0.14, 0.40, 0.12, [0.55, 0.15, 0.1], [0.9, 0.9, 0.8]);
  buildNeedleSpine(mesh, -0.08, 0.14, 0.40, 0.12, [0.55, 0.15, 0.1], [0.9, 0.9, 0.8]);
}

// ----------------------------------------------------------------
// 5. Emperor Angelfish (Pomacanthus imperator)
// ----------------------------------------------------------------
function buildEmperorAngelfish(mesh) {
  const rings = 22;
  const segments = 16;
  const length = 1.05;
  const ringIndices = [];

  for (let r = 0; r <= rings; r++) {
    const t = r / rings;
    const z = (0.5 - t) * length;

    // Muscular high diamond body
    let height = 0.40 * sin(t * PI);
    let width = 0.16 * sin(t * PI);
    if (t > 0.82) {
      height *= 0.5;
      width *= 0.4;
    }

    const ring = [];
    for (let s = 0; s < segments; s++) {
      const angle = (s / segments) * TAU;
      const cosA = cos(angle), sinA = sin(angle);
      const x = cosA * width;
      const y = sinA * height;

      // Color pattern:
      // Head: Midnight blue eye mask with neon cyan border
      // Body: Horizontal electric blue and vibrant yellow stripes
      // Tail: Golden orange
      let cr = 0.05, cg = 0.45, cb = 0.95; // Electric blue

      if (t < 0.28) {
        // Head region with black eye mask
        const eyeZone = abs(sinA - 0.15) < 0.35 && abs(z - 0.34) < 0.12;
        const neonBorder = abs(sinA - 0.15) < 0.42 && abs(z - 0.34) < 0.15;
        if (eyeZone) {
          cr = 0.04; cg = 0.04; cb = 0.08; // Midnight black mask
        } else if (neonBorder) {
          cr = 0.10; cg = 0.90; cb = 0.98; // Cyan neon trim
        } else {
          cr = 0.12; cg = 0.35; cb = 0.85;
        }
      } else if (t > 0.85) {
        // Caudal peduncle
        cr = 0.98; cg = 0.72; cb = 0.06; // Golden yellow
      } else {
        // Horizontal stripes (y-based)
        const stripeY = (sinA * height * 12.0 + t * 4.0) % 1.0;
        if (stripeY > 0.45) {
          cr = 0.98; cg = 0.88; cb = 0.08; // Vivid yellow stripe
        } else {
          cr = 0.06; cg = 0.38; cb = 0.92; // Electric blue stripe
        }
      }

      const idx = mesh.vertex(x, y, z, cosA, sinA, 0, s / segments, t, cr, cg, cb, 1);
      ring.push(idx);
    }
    ringIndices.push(ring);
  }

  for (let r = 0; r < rings; r++) {
    for (let s = 0; s < segments; s++) {
      const nextS = (s + 1) % segments;
      mesh.quad(ringIndices[r][s], ringIndices[r][nextS], ringIndices[r + 1][nextS], ringIndices[r + 1][s]);
    }
  }

  // Golden-yellow caudal fin
  buildFin(mesh, [0, 0, -0.52], [0, 0, -0.78], 0.28, 0.015, [0.98, 0.72, 0.06], [0.98, 0.85, 0.15], [0.1, 0.4, 0.9]);

  // Continuous dorsal crest with white rim
  buildDorsalFin(mesh, 0.2, -0.44, 0.18, 0.015, [0.1, 0.35, 0.85], [0.98, 0.98, 0.98]);

  // Anal fin
  buildAnalFin(mesh, -0.05, -0.42, -0.16, 0.015, [0.08, 0.25, 0.75], [0.1, 0.8, 0.95]);

  // Pectoral fins
  buildPectoralFin(mesh, 0.12, -0.04, 0.2, 1, 0.18, [0.15, 0.2, 0.3]);
  buildPectoralFin(mesh, -0.12, -0.04, 0.2, -1, 0.18, [0.15, 0.2, 0.3]);

  // Eyes
  buildFishEye(mesh, 0.11, 0.10, 0.42, 0.036);
  buildFishEye(mesh, -0.11, 0.10, 0.42, 0.036);
}

// ----------------------------------------------------------------
// 6. Yellow Longnose Butterflyfish (Forcipiger flavissimus)
// ----------------------------------------------------------------
function buildLongnoseButterfly(mesh) {
  const rings = 22;
  const segments = 16;
  const length = 0.92;
  const ringIndices = [];

  for (let r = 0; r <= rings; r++) {
    const t = r / rings;
    const z = (0.5 - t) * length;

    // Extremely elongated forceps snout (t < 0.3)
    let height = 0.38 * sin(t * PI);
    let width = 0.10 * sin(t * PI);
    if (t < 0.3) {
      const snoutT = t / 0.3;
      height = 0.04 + 0.30 * snoutT * snoutT;
      width = 0.03 + 0.07 * snoutT * snoutT;
    } else if (t > 0.82) {
      height *= 0.48;
      width *= 0.42;
    }

    const ring = [];
    for (let s = 0; s < segments; s++) {
      const angle = (s / segments) * TAU;
      const cosA = cos(angle), sinA = sin(angle);
      const x = cosA * width;
      const y = sinA * height;

      // Color pattern:
      // Forceps & upper head: Dark charcoal cap
      // Chest/throat: Silvery white
      // Main body: Brilliant lemon yellow
      // Rear anal fin: Black false eye-spot (ocellus)
      let cr = 0.98, cg = 0.88, cb = 0.05; // Yellow body

      if (t < 0.35) {
        if (sinA > -0.1) {
          cr = 0.12; cg = 0.12; cb = 0.14; // Black head cap
        } else {
          cr = 0.92; cg = 0.92; cb = 0.95; // Pure silvery white chest
        }
      }

      // False eye-spot (ocellus) near anal fin (t ~ 0.72, lower flank)
      if (t > 0.68 && t < 0.78 && sinA < -0.4 && abs(cosA) > 0.5) {
        cr = 0.04; cg = 0.04; cb = 0.04; // Black ocellus
      }

      const idx = mesh.vertex(x, y, z, cosA, sinA, 0, s / segments, t, cr, cg, cb, 1);
      ring.push(idx);
    }
    ringIndices.push(ring);
  }

  for (let r = 0; r < rings; r++) {
    for (let s = 0; s < segments; s++) {
      const nextS = (s + 1) % segments;
      mesh.quad(ringIndices[r][s], ringIndices[r][nextS], ringIndices[r + 1][nextS], ringIndices[r + 1][s]);
    }
  }

  // Translucent tail with pale blue border
  buildFin(mesh, [0, 0, -0.46], [0, 0, -0.68], 0.24, 0.012, [0.92, 0.92, 0.95], [0.8, 0.9, 0.98], [0.1, 0.1, 0.1]);

  // Spiny dorsal fin
  buildDorsalFin(mesh, 0.14, -0.38, 0.17, 0.012, [0.98, 0.88, 0.05], [0.1, 0.8, 0.95]);

  // Anal fin with ocellus trim
  buildAnalFin(mesh, -0.04, -0.38, -0.16, 0.012, [0.98, 0.88, 0.05], [0.1, 0.8, 0.95]);

  // Pectoral fins
  buildPectoralFin(mesh, 0.07, -0.03, 0.12, 1, 0.13, [0.95, 0.95, 0.98]);
  buildPectoralFin(mesh, -0.07, -0.03, 0.12, -1, 0.13, [0.95, 0.95, 0.98]);

  // Eyes (inside dark head cap)
  buildFishEye(mesh, 0.06, 0.08, 0.45, 0.030);
  buildFishEye(mesh, -0.06, 0.08, 0.45, 0.030);
}

// ----------------------------------------------------------------
// 7. Moorish Idol (Zanclus cornutus)
// ----------------------------------------------------------------
function buildMoorishIdol(mesh) {
  const rings = 22;
  const segments = 16;
  const length = 0.95;
  const ringIndices = [];

  for (let r = 0; r <= rings; r++) {
    const t = r / rings;
    const z = (0.5 - t) * length;

    // Very tall, razor-thin disc
    let height = 0.45 * sin(t * PI);
    let width = 0.09 * sin(t * PI);
    if (t < 0.2) {
      height = 0.12 + 0.28 * t / 0.2;
      width = 0.04 + 0.05 * t / 0.2;
    } else if (t > 0.8) {
      height *= 0.45;
      width *= 0.4;
    }

    const ring = [];
    for (let s = 0; s < segments; s++) {
      const angle = (s / segments) * TAU;
      const cosA = cos(angle), sinA = sin(angle);
      const x = cosA * width;
      const y = sinA * height;

      // Vertical bold bands:
      // Snout: Yellow saddle (t < 0.15)
      // Front Band: Wide velvety black (t ~ 0.18 - 0.42)
      // Mid Body: Bright white & yellow gradient (t ~ 0.42 - 0.65)
      // Rear Band: Black band (t ~ 0.65 - 0.80)
      // Caudal: Black caudal with white margin
      let cr = 0.98, cg = 0.98, cb = 0.98; // White base

      if (t < 0.15) {
        // Yellow saddle over snout
        cr = 0.98; cg = 0.78; cb = 0.08;
      } else if (t >= 0.18 && t <= 0.44) {
        cr = 0.04; cg = 0.04; cb = 0.06; // Broad front black band
      } else if (t > 0.44 && t < 0.64) {
        // Bright white transitioning to yellow upper flank
        if (sinA > 0.1) {
          cr = 0.98; cg = 0.86; cb = 0.12;
        } else {
          cr = 0.98; cg = 0.98; cb = 0.98;
        }
      } else if (t >= 0.64 && t <= 0.82) {
        cr = 0.04; cg = 0.04; cb = 0.06; // Rear black band
      }

      const idx = mesh.vertex(x, y, z, cosA, sinA, 0, s / segments, t, cr, cg, cb, 1);
      ring.push(idx);
    }
    ringIndices.push(ring);
  }

  for (let r = 0; r < rings; r++) {
    for (let s = 0; s < segments; s++) {
      const nextS = (s + 1) % segments;
      mesh.quad(ringIndices[r][s], ringIndices[r][nextS], ringIndices[r + 1][nextS], ringIndices[r + 1][s]);
    }
  }

  // Dramatic trailing sickle dorsal filament!
  buildMoorishIdolFilament(mesh);

  // Black caudal fin with white trailing margin
  buildFin(mesh, [0, 0, -0.47], [0, 0, -0.72], 0.25, 0.012, [0.05, 0.05, 0.07], [0.95, 0.95, 0.98], [0.05, 0.05, 0.07]);

  // Anal fin
  buildAnalFin(mesh, -0.06, -0.38, -0.22, 0.012, [0.05, 0.05, 0.07], [0.1, 0.7, 0.9]);

  // Pectoral fins
  buildPectoralFin(mesh, 0.07, -0.04, 0.16, 1, 0.14, [0.95, 0.95, 0.98]);
  buildPectoralFin(mesh, -0.07, -0.04, 0.16, -1, 0.14, [0.95, 0.95, 0.98]);

  // Eyes & supraocular horn bumps
  buildFishEye(mesh, 0.07, 0.14, 0.32, 0.032);
  buildFishEye(mesh, -0.07, 0.14, 0.32, 0.032);
}

// ----------------------------------------------------------------
// 8. Royal Gramma (Gramma loreto)
// ----------------------------------------------------------------
function buildRoyalGramma(mesh) {
  const rings = 20;
  const segments = 16;
  const length = 0.75;
  const ringIndices = [];

  for (let r = 0; r <= rings; r++) {
    const t = r / rings;
    const z = (0.5 - t) * length;

    // Slender cylindrical reef basslet
    let height = 0.24 * sin(t * PI);
    let width = 0.15 * sin(t * PI);
    if (t < 0.2) {
      height = 0.22 * Math.pow(sin(t * 2.5 * PI * 0.5), 0.65);
      width = 0.14 * Math.pow(sin(t * 2.5 * PI * 0.5), 0.65);
    } else if (t > 0.8) {
      height *= 0.6;
      width *= 0.5;
    }

    const ring = [];
    for (let s = 0; s < segments; s++) {
      const angle = (s / segments) * TAU;
      const cosA = cos(angle), sinA = sin(angle);
      const x = cosA * width;
      const y = sinA * height;

      // Color pattern:
      // Front half (t < 0.5): Intense iridescent violet / purple / magenta
      // Rear half (t >= 0.5): Blazing canary yellow
      // Eye streak: Dark line through eye
      let cr, cg, cb;
      if (t < 0.44) {
        // Royal violet-magenta
        cr = 0.78; cg = 0.08; cb = 0.88;
      } else if (t > 0.54) {
        // Canary yellow
        cr = 0.98; cg = 0.88; cb = 0.06;
      } else {
        // Crisp blend / transition
        const blend = (t - 0.44) / 0.10;
        cr = 0.78 * (1 - blend) + 0.98 * blend;
        cg = 0.08 * (1 - blend) + 0.88 * blend;
        cb = 0.88 * (1 - blend) + 0.06 * blend;
      }

      // Dark eye streak across anterior head
      if (t < 0.28 && abs(sinA - 0.12) < 0.15) {
        cr *= 0.3; cg *= 0.3; cb *= 0.3;
      }

      const idx = mesh.vertex(x, y, z, cosA, sinA, 0, s / segments, t, cr, cg, cb, 1);
      ring.push(idx);
    }
    ringIndices.push(ring);
  }

  for (let r = 0; r < rings; r++) {
    for (let s = 0; s < segments; s++) {
      const nextS = (s + 1) % segments;
      mesh.quad(ringIndices[r][s], ringIndices[r][nextS], ringIndices[r + 1][nextS], ringIndices[r + 1][s]);
    }
  }

  // Yellow caudal fin
  buildFin(mesh, [0, 0, -0.37], [0, 0, -0.58], 0.20, 0.012, [0.98, 0.88, 0.06], [0.99, 0.92, 0.3], [0.9, 0.8, 0.05]);

  // Continuous dorsal fin (violet front with black spot, yellow rear)
  buildDorsalFin(mesh, 0.14, -0.32, 0.12, 0.012, [0.75, 0.08, 0.85], [0.98, 0.88, 0.06]);

  // Anal fin (yellow)
  buildAnalFin(mesh, -0.04, -0.30, -0.10, 0.012, [0.98, 0.88, 0.06], [0.98, 0.88, 0.06]);

  // Pectoral fins
  buildPectoralFin(mesh, 0.09, -0.02, 0.12, 1, 0.12, [0.85, 0.2, 0.85]);
  buildPectoralFin(mesh, -0.09, -0.02, 0.12, -1, 0.12, [0.85, 0.2, 0.85]);

  // Eyes
  buildFishEye(mesh, 0.07, 0.04, 0.20, 0.028);
  buildFishEye(mesh, -0.07, 0.04, 0.20, 0.028);
}

// ----------------------------------------------------------------
// Shared Fin & Anatomy Builders
// ----------------------------------------------------------------

function buildFishEye(mesh, x, y, z, radius) {
  const segs = 10;
  // White/gold iris base
  for (let i = 0; i < segs; i++) {
    const a1 = (i / segs) * TAU;
    const a2 = ((i + 1) / segs) * TAU;
    // Iris
    mesh.tri(
      mesh.vertex(x, y, z, 0, 0, 1, 0.5, 0.5, 0.95, 0.85, 0.2),
      mesh.vertex(x + cos(a1) * radius, y + sin(a1) * radius, z + 0.005, 0, 0, 1, 0, 0, 0.8, 0.7, 0.1),
      mesh.vertex(x + cos(a2) * radius, y + sin(a2) * radius, z + 0.005, 0, 0, 1, 0, 0, 0.8, 0.7, 0.1)
    );
    // Dark pupil
    const pRad = radius * 0.55;
    mesh.tri(
      mesh.vertex(x, y, z + 0.008, 0, 0, 1, 0.5, 0.5, 0.02, 0.02, 0.03),
      mesh.vertex(x + cos(a1) * pRad, y + sin(a1) * pRad, z + 0.008, 0, 0, 1, 0, 0, 0.02, 0.02, 0.03),
      mesh.vertex(x + cos(a2) * pRad, y + sin(a2) * pRad, z + 0.008, 0, 0, 1, 0, 0, 0.02, 0.02, 0.03)
    );
  }
}

function buildFin(mesh, root, tip, spread, thick, baseColor, midColor, tipColor) {
  const steps = 6;
  for (let i = 0; i < steps; i++) {
    const t0 = i / steps;
    const t1 = (i + 1) / steps;
    const y0_t = (t0 - 0.5) * spread;
    const y1_t = (t1 - 0.5) * spread;

    const z0 = root[2] + (tip[2] - root[2]);
    const z1 = root[2] + (tip[2] - root[2]);

    const v0 = mesh.vertex(0, root[1], root[2], 0, 0, -1, 0, t0, baseColor[0], baseColor[1], baseColor[2], 1);
    const v1 = mesh.vertex(thick, root[1] + y0_t, z0, 1, 0, 0, 1, t0, midColor[0], midColor[1], midColor[2], 1);
    const v2 = mesh.vertex(thick, root[1] + y1_t, z1, 1, 0, 0, 1, t1, tipColor[0], tipColor[1], tipColor[2], 1);
    mesh.tri(v0, v1, v2);

    const v1_b = mesh.vertex(-thick, root[1] + y0_t, z0, -1, 0, 0, 1, t0, midColor[0], midColor[1], midColor[2], 1);
    const v2_b = mesh.vertex(-thick, root[1] + y1_t, z1, -1, 0, 0, 1, t1, tipColor[0], tipColor[1], tipColor[2], 1);
    mesh.tri(v0, v2_b, v1_b);
  }
}

function buildDorsalFin(mesh, zStart, zEnd, height, thick, baseColor, tipColor) {
  const steps = 10;
  for (let i = 0; i < steps; i++) {
    const t0 = i / steps;
    const t1 = (i + 1) / steps;
    const z0 = zStart + (zEnd - zStart) * t0;
    const z1 = zStart + (zEnd - zStart) * t1;
    const h0 = height * sin(t0 * PI * 0.85 + 0.15);
    const h1 = height * sin(t1 * PI * 0.85 + 0.15);

    // Fin blade
    const a0 = mesh.vertex(0, 0.15, z0, 0, 1, 0, 0, t0, baseColor[0], baseColor[1], baseColor[2], 1);
    const a1 = mesh.vertex(0, 0.15, z1, 0, 1, 0, 0, t1, baseColor[0], baseColor[1], baseColor[2], 1);
    const b0 = mesh.vertex(0, 0.15 + h0, z0 - 0.03, 0, 1, 0, 1, t0, tipColor[0], tipColor[1], tipColor[2], 1);
    const b1 = mesh.vertex(0, 0.15 + h1, z1 - 0.03, 0, 1, 0, 1, t1, tipColor[0], tipColor[1], tipColor[2], 1);

    mesh.quad(a0, a1, b1, b0);
    mesh.quad(a0, b0, b1, a1); // double sided
  }
}

function buildAnalFin(mesh, zStart, zEnd, depth, thick, baseColor, tipColor) {
  const steps = 8;
  for (let i = 0; i < steps; i++) {
    const t0 = i / steps;
    const t1 = (i + 1) / steps;
    const z0 = zStart + (zEnd - zStart) * t0;
    const z1 = zStart + (zEnd - zStart) * t1;
    const d0 = depth * sin(t0 * PI * 0.8 + 0.2);
    const d1 = depth * sin(t1 * PI * 0.8 + 0.2);

    const a0 = mesh.vertex(0, -0.15, z0, 0, -1, 0, 0, t0, baseColor[0], baseColor[1], baseColor[2], 1);
    const a1 = mesh.vertex(0, -0.15, z1, 0, -1, 0, 0, t1, baseColor[0], baseColor[1], baseColor[2], 1);
    const b0 = mesh.vertex(0, -0.15 + d0, z0 - 0.02, 0, -1, 0, 1, t0, tipColor[0], tipColor[1], tipColor[2], 1);
    const b1 = mesh.vertex(0, -0.15 + d1, z1 - 0.02, 0, -1, 0, 1, t1, tipColor[0], tipColor[1], tipColor[2], 1);

    mesh.quad(a0, b0, b1, a1);
    mesh.quad(a0, a1, b1, b0);
  }
}

function buildPectoralFin(mesh, x, y, z, side, length, color) {
  const angle = side * 0.45;
  const steps = 6;
  const spread = 0.08;

  for (let i = 0; i < steps; i++) {
    const t0 = i / steps;
    const t1 = (i + 1) / steps;

    const px0 = x + side * (length * t0 * 0.9);
    const py0 = y - t0 * 0.05 + (t0 - 0.5) * spread;
    const pz0 = z - length * t0 * 0.4;

    const px1 = x + side * (length * t1 * 0.9);
    const py1 = y - t1 * 0.05 + (t1 - 0.5) * spread;
    const pz1 = z - length * t1 * 0.4;

    const r0 = mesh.vertex(x, y, z, side, 0, 0, 0, 0, color[0], color[1], color[2], 0.9);
    const r1 = mesh.vertex(px0, py0, pz0, side, 0, 0, 1, t0, color[0], color[1], color[2], 0.8);
    const r2 = mesh.vertex(px1, py1, pz1, side, 0, 0, 1, t1, color[0], color[1], color[2], 0.8);

    mesh.tri(r0, r1, r2);
    mesh.tri(r0, r2, r1);
  }
}

function buildNeedleSpine(mesh, x, y, z, height, colBase, colTip) {
  const pts = [
    [x, y, z],
    [x, y + height * 0.5, z - 0.03],
    [x, y + height, z - 0.08]
  ];
  mesh.tube(pts, (t) => 0.008 * (1 - t * 0.8), 5, true, true, (t) => [
    colBase[0] * (1 - t) + colTip[0] * t,
    colBase[1] * (1 - t) + colTip[1] * t,
    colBase[2] * (1 - t) + colTip[2] * t,
    1.0
  ]);
}

function buildLionfishPectoralFan(mesh, side) {
  const numRays = 14;
  const maxLen = 0.52;
  const x0 = side * 0.14, y0 = -0.04, z0 = 0.22;

  for (let r = 0; r < numRays; r++) {
    const frac = r / (numRays - 1);
    const fanAngle = (frac - 0.5) * 1.5;
    const len = maxLen * (0.65 + 0.35 * sin(frac * PI));

    const dx = side * cos(fanAngle) * len;
    const dy = sin(fanAngle) * len * 0.7 - 0.08;
    const dz = -len * 0.5;

    const pts = [
      [x0, y0, z0],
      [x0 + dx * 0.5, y0 + dy * 0.5, z0 + dz * 0.5],
      [x0 + dx, y0 + dy, z0 + dz]
    ];

    const zebraCol = (r % 2 === 0) ? [0.6, 0.15, 0.1] : [0.95, 0.92, 0.85];
    mesh.tube(pts, (t) => 0.006 * (1 - t * 0.7), 4, true, true, () => zebraCol);

    // Webbing between rays
    if (r < numRays - 1) {
      const nextFrac = (r + 1) / (numRays - 1);
      const nextAngle = (nextFrac - 0.5) * 1.5;
      const nextLen = maxLen * (0.65 + 0.35 * sin(nextFrac * PI));
      const ndx = side * cos(nextAngle) * nextLen;
      const ndy = sin(nextAngle) * nextLen * 0.7 - 0.08;
      const ndz = -nextLen * 0.5;

      const webCol = [0.85, 0.8, 0.7, 0.45];
      const a = mesh.vertex(x0, y0, z0, 0, 1, 0, 0, 0, webCol[0], webCol[1], webCol[2], webCol[3]);
      const b = mesh.vertex(x0 + dx * 0.7, y0 + dy * 0.7, z0 + dz * 0.7, 0, 1, 0, 1, 0, webCol[0], webCol[1], webCol[2], webCol[3]);
      const c = mesh.vertex(x0 + ndx * 0.7, y0 + ndy * 0.7, z0 + ndz * 0.7, 0, 1, 0, 1, 1, webCol[0], webCol[1], webCol[2], webCol[3]);

      mesh.tri(a, b, c);
      mesh.tri(a, c, b);
    }
  }
}

function buildMoorishIdolFilament(mesh) {
  // Dramatic trailing white filament rising high and arching back
  const numPts = 16;
  const pts = [];
  const startX = 0, startY = 0.28, startZ = 0.15;

  for (let i = 0; i <= numPts; i++) {
    const t = i / numPts;
    // Arch high above the fish and curve gracefully back
    const archY = startY + 0.55 * sin(t * PI * 0.6) - t * 0.2;
    const archZ = startZ - t * 0.85;
    const archX = 0.015 * sin(t * 8.0);
    pts.push([archX, archY, archZ]);
  }

  mesh.tube(pts, (t) => 0.012 * (1 - t * 0.85) + 0.002, 5, true, true, () => [0.99, 0.99, 0.99, 1.0]);
}
