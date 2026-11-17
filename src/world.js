// ============================================================================
// NYXEN — Procedural Coral Eden World Generator
// Terrain, Kelp Forests, Coral Reef Gardens, Sunken Galleon, Whale Fluke,
// Bubble Vents, Schooling Fish Boids, Manta Rays, and Landmark Discoveries.
// Inspired by & building upon technical references from Abyssal Garden.
// ============================================================================

import { Mesh, vnoise, fbm, worley, sstep, rnd, rseed, rr, clamp, sin, cos, abs, max, min, sqrt, PI, TAU, hypot } from './math.js';

export const LANDMARKS = [
  { id: 'sunken_galleon', name: "The Sunken Galleon ('The Siren's Rest')", pos: [58, -25, 12], radius: 24, discovered: false, desc: "A 17th-century wooden frigate resting peacefully on the seabed, now overgrown with staghorn corals and sea fans." },
  { id: 'whale_fluke', name: 'The Whale Fluke Monolith', pos: [-6, -42, -5], radius: 18, discovered: false, desc: "An ancient, colossal stone carving of a breaching whale fluke, sacred to the deep ocean." },
  { id: 'purple_grotto', name: 'The Luminescent Purple Grotto', pos: [12, -38, 92], radius: 26, discovered: false, desc: "A vaulted submerged cavern bathed in mysterious violet bioluminescence with glowing sea moss and giant barrel sponges." },
  { id: 'kelp_cathedral', name: 'The Kelp Forest Cathedral', pos: [-2, -28, -78], radius: 32, discovered: false, desc: "Towering Macrocystis giant kelp soaring 40 meters towards the dancing surface sunbeams." },
  { id: 'coral_arch', name: 'The Grand Coral Archway', pos: [-24, -18, -18], radius: 16, discovered: false, desc: "A massive natural limestone arch encrusted with vibrant rainbow corals and sea anemones." },
  { id: 'anemone_sanctuary', name: 'The Giant Anemone Sanctuary', pos: [22, -16, -26], radius: 15, discovered: false, desc: "A lush garden of undulating sea anemones providing safe haven for clownfish families." },
  { id: 'hydrothermal_vents', name: 'The Hydrothermal Chimneys', pos: [42, -40, -32], radius: 18, discovered: false, desc: "Volcanic mineral spires discharging warm mineral waters and continuous streams of sparkling bubbles." },
  { id: 'sunlit_atoll', name: 'The Shallow Sunlit Atoll', pos: [-38, -6, 28], radius: 22, discovered: false, desc: "A warm, sun-drenched reef crest where turquoise waves break and baby fish learn to swim." }
];

export class CoralEdenWorld {
  constructor(quality = 0) { // 0: High, 1: Medium, 2: Low
    this.quality = quality;
    this.terrainMesh = null;
    this.kelpInstances = [];
    this.coralInstances = [];
    this.bubbleVents = [];
    this.marineSnow = [];
    this.fishSchools = [];
    this.mantaRays = [];
    this.collectibles = [];
    this.landmarks = JSON.parse(JSON.stringify(LANDMARKS));
    this.discoveredCount = 0;

    this.init();
  }

  // Fast analytical terrain heightfield query
  getSeabedHeight(x, z) {
    // Base ocean bed rolling depth between -48 and -36
    let y = -44.0 + 8.0 * (fbm(x * 0.012, 1.5, z * 0.012, 3) - 0.5);

    // Coral atoll shallow plateau around [-38, 28]
    const dAtoll = hypot(x - (-38), z - 28);
    if (dAtoll < 30.0) {
      const atollBlend = sstep(30.0, 8.0, dAtoll);
      y = max(y, -7.5 + atollBlend * 3.5 + 1.2 * fbm(x * 0.08, 2.0, z * 0.08, 2));
    }

    // Canyon cutting between main reef and kelp basin
    const dCanyon = abs(x * 0.7 - z * 0.7 + 10.0);
    if (dCanyon < 18.0) {
      const canyonDepth = (1.0 - dCanyon / 18.0) * 8.0;
      y -= canyonDepth;
    }

    // Mesa mounds
    const dMesa1 = hypot(x - 28, z - (-15));
    if (dMesa1 < 22.0) {
      y = max(y, -18.0 + (1.0 - dMesa1 / 22.0) * 12.0);
    }

    const dMesa2 = hypot(x - (-65), z - (-12));
    if (dMesa2 < 24.0) {
      y = max(y, -16.0 + (1.0 - dMesa2 / 24.0) * 14.0);
    }

    // Purple grotto depression
    const dGrotto = hypot(x - 12, z - 92);
    if (dGrotto < 28.0) {
      y = min(y, -36.0 - (1.0 - dGrotto / 28.0) * 8.0);
    }

    return y;
  }

  init() {
    rseed(42);

    // 1. Generate Terrain Mesh
    this.generateTerrain();

    // 2. Generate Kelp Forests
    this.generateKelpForests();

    // 3. Generate Coral Gardens & Marine Flora
    this.generateCoralGardens();

    // 4. Generate Set Pieces (Sunken Ship, Whale Fluke, Arches)
    this.generateSetPieces();

    // 5. Generate Bubble Vents & Marine Snow
    this.generateBubblesAndParticles();

    // 6. Generate Fish Schools (Boids) & Manta Rays
    this.generateMarineLife();

    // 7. Place Collectible Bio-Pearls
    this.generateCollectibles();
  }

  generateTerrain() {
    const mesh = new Mesh();
    // Grid density based on quality
    const gridRes = this.quality === 2 ? 64 : this.quality === 1 ? 96 : 128;
    const worldSize = 340.0;
    const halfSize = worldSize * 0.5;
    const step = worldSize / gridRes;

    const heights = new Float32Array((gridRes + 1) * (gridRes + 1));
    const normals = new Float32Array((gridRes + 1) * (gridRes + 1) * 3);

    // Precalculate heights
    for (let j = 0; j <= gridRes; j++) {
      const z = -halfSize + j * step;
      for (let i = 0; i <= gridRes; i++) {
        const x = -halfSize + i * step;
        heights[i + j * (gridRes + 1)] = this.getSeabedHeight(x, z);
      }
    }

    // Compute normals & add vertices
    for (let j = 0; j <= gridRes; j++) {
      const z = -halfSize + j * step;
      for (let i = 0; i <= gridRes; i++) {
        const x = -halfSize + i * step;
        const y = heights[i + j * (gridRes + 1)];

        // Normal gradient
        const hL = i > 0 ? heights[(i - 1) + j * (gridRes + 1)] : y;
        const hR = i < gridRes ? heights[(i + 1) + j * (gridRes + 1)] : y;
        const hD = j > 0 ? heights[i + (j - 1) * (gridRes + 1)] : y;
        const hU = j < gridRes ? heights[i + (j + 1) * (gridRes + 1)] : y;

        let nx = hL - hR;
        let ny = 2.0 * step;
        let nz = hD - hU;
        const nl = hypot(nx, ny, nz) || 1;
        nx /= nl; ny /= nl; nz /= nl;

        // Terrain color: Sandy gold, reef limestone, olive algae, and purple bioluminescent moss
        let cr = 0.82, cg = 0.74, cb = 0.55; // Warm sand base

        // Reef limestone rock on slopes
        if (ny < 0.85) {
          cr = 0.42; cg = 0.40; cb = 0.38; // Coral limestone rock
        }

        // Shallow sunlit sand
        if (y > -12.0) {
          cr = 0.92; cg = 0.86; cb = 0.68; // Golden shallow sunlit sand
        }

        // Purple grotto zone
        const dGrotto = hypot(x - 12, z - 92);
        if (dGrotto < 32.0) {
          const grottoFactor = 1.0 - dGrotto / 32.0;
          cr = cr * (1 - grottoFactor) + 0.48 * grottoFactor;
          cg = cg * (1 - grottoFactor) + 0.15 * grottoFactor;
          cb = cb * (1 - grottoFactor) + 0.72 * grottoFactor; // Luminescent magenta/purple
        }

        mesh.vertex(x, y, z, nx, ny, nz, i / gridRes * 16.0, j / gridRes * 16.0, cr, cg, cb, 1);
      }
    }

    // Indices
    for (let j = 0; j < gridRes; j++) {
      for (let i = 0; i < gridRes; i++) {
        const a = i + j * (gridRes + 1);
        const b = (i + 1) + j * (gridRes + 1);
        const c = (i + 1) + (j + 1) * (gridRes + 1);
        const d = i + (j + 1) * (gridRes + 1);
        mesh.quad(a, d, c, b);
      }
    }

    this.terrainMesh = mesh.toBuffers();
  }

  generateKelpForests() {
    const numColumns = this.quality === 2 ? 60 : this.quality === 1 ? 120 : 200;
    this.kelpInstances = [];

    // Kelp centers around Kelp Cathedral [-2, -78] and secondary groves
    const GROVES = [
      { x: -2, z: -78, rad: 36, density: 1.0 },
      { x: 48, z: -35, rad: 22, density: 0.8 },
      { x: -70, z: 20, rad: 25, density: 0.7 }
    ];

    for (const grove of GROVES) {
      const count = Math.floor(numColumns * (grove.rad / 60));
      for (let k = 0; k < count; k++) {
        const angle = rnd() * TAU;
        const dist = sqrt(rnd()) * grove.rad;
        const x = grove.x + cos(angle) * dist;
        const z = grove.z + sin(angle) * dist;
        const seabedY = this.getSeabedHeight(x, z);

        // Height of kelp (reaches within 3-6m of surface)
        const height = min(42.0, max(14.0, -seabedY - rr(3.0, 7.0)));
        const swayPhase = rnd() * TAU;
        const swayFreq = rr(0.8, 1.4);
        const kelpScale = rr(0.85, 1.3);

        this.kelpInstances.push({
          x, y: seabedY, z,
          height,
          swayPhase,
          swayFreq,
          scale: kelpScale,
          strands: 2 + (rnd() < 0.5 ? 1 : 0)
        });
      }
    }
  }

  generateCoralGardens() {
    const numCorals = this.quality === 2 ? 180 : this.quality === 1 ? 380 : 650;
    this.coralInstances = [];

    // Coral hotspots
    const REEFS = [
      { x: -38, z: 28, rad: 25, types: ['staghorn', 'brain', 'table', 'anemone'] },
      { x: -24, z: -18, rad: 20, types: ['fan', 'staghorn', 'sponge'] },
      { x: 22, z: -26, rad: 18, types: ['anemone', 'brain', 'table'] },
      { x: 12, z: 92, rad: 24, types: ['sponge', 'fan', 'magenta_coral'] }
    ];

    for (const reef of REEFS) {
      const count = Math.floor(numCorals * 0.25);
      for (let i = 0; i < count; i++) {
        const a = rnd() * TAU;
        const r = sqrt(rnd()) * reef.rad;
        const x = reef.x + cos(a) * r;
        const z = reef.z + sin(a) * r;
        const y = this.getSeabedHeight(x, z);

        const type = reef.types[Math.floor(rnd() * reef.types.length)];
        const scale = rr(0.6, 1.6);
        const yaw = rnd() * TAU;

        this.coralInstances.push({
          type,
          x, y, z,
          scale,
          yaw,
          colorIndex: Math.floor(rnd() * 6)
        });
      }
    }
  }

  // Procedural Coral & Marine Vegetation Meshes
  buildKelpColumnMesh() {
    const mesh = new Mesh();
    const pts = [];
    const height = 32.0;
    const segs = 16;
    for (let i = 0; i <= segs; i++) {
      const t = i / segs;
      pts.push([sin(t * 4.0) * 0.4, t * height, cos(t * 3.5) * 0.4]);
    }
    // Main stipe
    mesh.tube(pts, (t) => 0.16 * (1.0 - t * 0.5), 6, true, true, () => [0.18, 0.42, 0.12, 1.0]);

    // Alternating kelp blades / fronds
    for (let i = 2; i < segs; i++) {
      const p = pts[i];
      const bladeSide = (i % 2 === 0) ? 1 : -1;
      const bLen = 2.2 * (1.0 - (i / segs) * 0.4);
      const bladePts = [
        [p[0], p[1], p[2]],
        [p[0] + bladeSide * bLen * 0.5, p[1] + 0.4, p[2] + 0.3],
        [p[0] + bladeSide * bLen, p[1] + 0.8, p[2] + 0.5]
      ];
      mesh.tube(bladePts, (t) => 0.35 * (1.0 - t * 0.8), 4, true, true, () => [0.22, 0.52, 0.15, 0.95]);
    }
    mesh.computeVertexNormals();
    return mesh.toBuffers();
  }

  buildStaghornMesh() {
    const mesh = new Mesh();
    const col = [0.85, 0.45, 0.35, 1.0]; // Coral pink / peach
    const trunk = [[0, 0, 0], [0, 0.8, 0], [0.1, 1.6, 0.05]];
    mesh.tube(trunk, (t) => 0.18 * (1 - t * 0.4), 6, true, true, () => col);

    // Branches
    const b1 = [[0.1, 1.6, 0.05], [0.6, 2.4, 0.2], [0.9, 3.2, 0.4]];
    mesh.tube(b1, (t) => 0.12 * (1 - t * 0.5), 5, false, true, () => [0.95, 0.55, 0.45, 1.0]);

    const b2 = [[0.1, 1.6, 0.05], [-0.5, 2.3, -0.3], [-0.8, 3.1, -0.5]];
    mesh.tube(b2, (t) => 0.12 * (1 - t * 0.5), 5, false, true, () => [0.95, 0.55, 0.45, 1.0]);

    const b3 = [[0.6, 2.4, 0.2], [1.1, 2.9, -0.1], [1.4, 3.6, -0.2]];
    mesh.tube(b3, (t) => 0.09 * (1 - t * 0.5), 4, false, true, () => [0.98, 0.65, 0.55, 1.0]);

    mesh.computeVertexNormals();
    return mesh.toBuffers();
  }

  buildBrainCoralMesh() {
    const mesh = new Mesh();
    const segsH = 12, segsV = 8;
    const rad = 1.2;
    const ringIndices = [];

    for (let v = 0; v <= segsV; v++) {
      const phi = (v / segsV) * (PI * 0.5); // Hemisphere dome
      const cosP = cos(phi), sinP = sin(phi);
      const ring = [];

      for (let h = 0; h < segsH; h++) {
        const theta = (h / segsH) * TAU;
        // Corrugated convolutions
        const corrugation = 1.0 + 0.12 * sin(theta * 8.0) * cosP;
        const r = rad * corrugation;
        const x = cos(theta) * cosP * r;
        const y = sinP * r;
        const z = sin(theta) * cosP * r;

        // Warm yellow-green brain coral color
        const col = [0.72, 0.78, 0.25, 1.0];
        ring.push(mesh.vertex(x, y, z, x / r, y / r, z / r, h / segsH, v / segsV, col[0], col[1], col[2], 1));
      }
      ringIndices.push(ring);
    }

    for (let v = 0; v < segsV; v++) {
      for (let h = 0; h < segsH; h++) {
        const nextH = (h + 1) % segsH;
        mesh.quad(ringIndices[v][h], ringIndices[v][nextH], ringIndices[v + 1][nextH], ringIndices[v + 1][h]);
      }
    }
    mesh.computeVertexNormals();
    return mesh.toBuffers();
  }

  buildTableCoralMesh() {
    const mesh = new Mesh();
    // Sturdy stem
    const stem = [[0, 0, 0], [0, 0.7, 0], [0, 1.3, 0]];
    mesh.tube(stem, 0.35, 6, true, false, () => [0.65, 0.45, 0.35, 1.0]);

    // Flat wide table disc
    const segs = 14;
    const tableRadius = 2.4;
    const centerTop = mesh.vertex(0, 1.45, 0, 0, 1, 0, 0.5, 0.5, 0.82, 0.58, 0.38, 1);
    const rimIndices = [];

    for (let i = 0; i < segs; i++) {
      const a = (i / segs) * TAU;
      const r = tableRadius * (0.85 + 0.15 * sin(a * 4.0));
      const x = cos(a) * r;
      const z = sin(a) * r;
      rimIndices.push(mesh.vertex(x, 1.35, z, cos(a), 0.2, sin(a), 0, 0, 0.88, 0.65, 0.45, 1));
    }

    for (let i = 0; i < segs; i++) {
      mesh.tri(centerTop, rimIndices[i], rimIndices[(i + 1) % segs]);
      mesh.tri(centerTop, rimIndices[(i + 1) % segs], rimIndices[i]); // Double sided
    }

    mesh.computeVertexNormals();
    return mesh.toBuffers();
  }

  buildSeaFanMesh() {
    const mesh = new Mesh();
    // Vertical fan lattice
    const rays = 11;
    const fanCol = [0.95, 0.22, 0.35, 1.0]; // Brilliant crimson-magenta gorgonian
    for (let r = 0; r < rays; r++) {
      const frac = r / (rays - 1);
      const angle = (frac - 0.5) * 1.6;
      const len = 2.2 * (0.7 + 0.3 * sin(frac * PI));
      const pts = [
        [0, 0, 0],
        [sin(angle) * len * 0.5, cos(angle) * len * 0.5, 0],
        [sin(angle) * len, cos(angle) * len, 0]
      ];
      mesh.tube(pts, (t) => 0.04 * (1 - t * 0.6), 4, true, true, () => fanCol);
    }
    mesh.computeVertexNormals();
    return mesh.toBuffers();
  }

  buildAnemoneMesh() {
    const mesh = new Mesh();
    const tentacleCount = 24;
    const anemoneCol = [0.96, 0.55, 0.75, 1.0]; // Sea anemone soft rose-pink
    const tipCol = [0.98, 0.92, 0.98, 1.0];

    for (let i = 0; i < tentacleCount; i++) {
      const angle = (i / tentacleCount) * TAU;
      const rBase = 0.25 + 0.15 * (i % 3);
      const x0 = cos(angle) * rBase;
      const z0 = sin(angle) * rBase;
      const len = rr(0.8, 1.3);

      const pts = [
        [x0, 0, z0],
        [x0 * 1.3, len * 0.5, z0 * 1.3],
        [x0 * 1.6, len, z0 * 1.6]
      ];
      mesh.tube(pts, (t) => 0.045 * (1 - t * 0.7), 4, true, true, (t) => [
        anemoneCol[0] * (1 - t) + tipCol[0] * t,
        anemoneCol[1] * (1 - t) + tipCol[1] * t,
        anemoneCol[2] * (1 - t) + tipCol[2] * t,
        1.0
      ]);
    }
    mesh.computeVertexNormals();
    return mesh.toBuffers();
  }

  buildMantaMesh() {
    const mesh = new Mesh();
    // Manta Ray wide wingspan & sleek cephalic lobes
    const wingspan = 4.8;
    const bodyLen = 3.6;

    const vNose = mesh.vertex(0, 0.05, bodyLen * 0.5, 0, 1, 0, 0.5, 1, 0.12, 0.15, 0.18, 1);
    const vTail = mesh.vertex(0, 0.0, -bodyLen * 0.5, 0, 0, -1, 0.5, 0, 0.12, 0.15, 0.18, 1);
    const vLeftWing = mesh.vertex(-wingspan * 0.5, 0.1, 0.0, 0, 1, 0, 0, 0.5, 0.08, 0.10, 0.14, 1);
    const vRightWing = mesh.vertex(wingspan * 0.5, 0.1, 0.0, 0, 1, 0, 1, 0.5, 0.08, 0.10, 0.14, 1);
    const vBelly = mesh.vertex(0, -0.25, 0.1, 0, -1, 0, 0.5, 0.5, 0.95, 0.95, 0.98, 1); // Pure white belly!

    // Top surface
    mesh.tri(vNose, vRightWing, vTail);
    mesh.tri(vNose, vTail, vLeftWing);

    // Belly surface
    mesh.tri(vNose, vBelly, vRightWing);
    mesh.tri(vNose, vLeftWing, vBelly);
    mesh.tri(vTail, vRightWing, vBelly);
    mesh.tri(vTail, vBelly, vLeftWing);

    // Thin whip tail
    const tailPts = [
      [0, 0, -bodyLen * 0.5],
      [0, 0.05, -bodyLen * 0.8],
      [0, 0.1, -bodyLen * 1.2]
    ];
    mesh.tube(tailPts, 0.05, 4, true, true, () => [0.1, 0.1, 0.12, 1.0]);

    mesh.computeVertexNormals();
    return mesh.toBuffers();
  }

  buildSchoolFishMesh() {
    const mesh = new Mesh();
    // Fast streamlined schooling fish
    const pts = [
      [0, 0, 0.22],  // Nose
      [0, 0.06, 0.08], // Mid
      [0, 0, -0.15]  // Tail
    ];
    mesh.tube(pts, (t) => 0.045 * sin(t * PI), 4, true, true, (t) => [
      0.35 + t * 0.5,
      0.65 + t * 0.2,
      0.95,
      1.0
    ]);
    mesh.computeVertexNormals();
    return mesh.toBuffers();
  }

  buildPearlMesh() {
    const mesh = new Mesh();
    const segs = 8;
    const r = 0.45;
    const center = mesh.vertex(0, 0, 0, 0, 1, 0, 0.5, 0.5, 0.98, 0.98, 0.99, 1.0);
    const rings = [];

    for (let i = 0; i < segs; i++) {
      const a = (i / segs) * TAU;
      rings.push(mesh.vertex(cos(a) * r, sin(a) * r, 0, cos(a), sin(a), 0, 0, 0, 0.95, 0.85, 0.45, 1.0));
    }
    for (let i = 0; i < segs; i++) {
      mesh.tri(center, rings[i], rings[(i + 1) % segs]);
      mesh.tri(center, rings[(i + 1) % segs], rings[i]);
    }
    mesh.computeVertexNormals();
    return mesh.toBuffers();
  }

  generateSetPieces() {
    this.setPieceMeshes = [];

    // A. Sunken Galleon ("The Siren's Rest") at [58, -25, 12]
    const shipMesh = this.buildShipwreckMesh();
    this.setPieceMeshes.push({
      mesh: shipMesh,
      pos: [58, this.getSeabedHeight(58, 12) + 2.5, 12],
      yaw: -0.85,
      pitch: 0.12,
      roll: -0.25,
      scale: 1.35
    });

    // B. Ancient Whale Fluke Monolith at [-6, -42, -5]
    const flukeMesh = this.buildWhaleFlukeMesh();
    this.setPieceMeshes.push({
      mesh: flukeMesh,
      pos: [-6, this.getSeabedHeight(-6, -5) - 1.0, -5],
      yaw: 1.15,
      pitch: -0.22,
      roll: 0.15,
      scale: 1.8
    });

    // C. Grand Coral Archway at [-24, -18, -18]
    const archMesh = this.buildArchMesh();
    this.setPieceMeshes.push({
      mesh: archMesh,
      pos: [-24, this.getSeabedHeight(-24, -18), -18],
      yaw: 0.45,
      pitch: 0,
      roll: 0,
      scale: 2.2
    });
  }

  buildShipwreckMesh() {
    const mesh = new Mesh();
    const length = 28.0;
    const beam = 7.5;
    const depth = 5.5;

    // Wood colors: Weathered dark oak, barnacle patina
    const woodDark = [0.22, 0.16, 0.11, 1.0];
    const woodPlank = [0.32, 0.24, 0.16, 1.0];
    const algaeWood = [0.18, 0.22, 0.14, 1.0];

    // Keel polyline
    const keelPts = [
      [length * 0.5, 3.2, 0],      // Bowsprit / Stem post
      [length * 0.4, 0.5, 0],
      [0, -depth * 0.5, 0],
      [-length * 0.4, -depth * 0.45, 0],
      [-length * 0.5, 2.5, 0]      // Stern post
    ];
    mesh.tube(keelPts, 0.45, 6, true, true, () => woodDark);

    // Ribs (hull frames)
    const numRibs = 14;
    for (let r = 0; r < numRibs; r++) {
      const frac = r / (numRibs - 1);
      const x = (frac - 0.5) * length * 0.85;
      const bWidth = beam * sin(frac * PI);
      const bDepth = depth * (0.6 + 0.4 * sin(frac * PI));

      // Leave a breach on port side (r = 5, 6, 7) for swimming inside!
      const hasBreach = (r >= 5 && r <= 7);

      const ribPts = [
        [x, bDepth * 0.5, hasBreach ? bWidth * 0.2 : bWidth],
        [x, -bDepth * 0.3, bWidth * 0.8],
        [x, -bDepth * 0.5, 0],
        [x, -bDepth * 0.3, -bWidth * 0.8],
        [x, bDepth * 0.5, -bWidth]
      ];
      mesh.tube(ribPts, 0.25, 5, true, true, () => woodPlank);
    }

    // Broken main mast & fallen yardarm
    const mastPts = [
      [2.0, -depth * 0.4, 0],
      [2.0, 8.5, 0],
      [3.5, 12.0, 1.5] // Snapped top
    ];
    mesh.tube(mastPts, (t) => 0.55 * (1 - t * 0.5), 6, true, true, () => algaeWood);

    const yardarmPts = [
      [1.5, 7.5, -5.0],
      [2.0, 7.8, 0],
      [2.5, 5.2, 6.0] // Fallen slanted yardarm
    ];
    mesh.tube(yardarmPts, 0.22, 5, true, true, () => woodDark);

    mesh.computeVertexNormals();
    return mesh.toBuffers();
  }

  buildWhaleFlukeMesh() {
    const mesh = new Mesh();
    // Colossal stone fluke rising from ocean bed
    const stemPts = [
      [0, -6.0, 0],
      [0, 0.0, 0],
      [0, 5.0, 0.2],
      [0, 9.5, 0.5]
    ];
    mesh.tube(stemPts, (t) => 1.8 * (1 - t * 0.35) + 0.8, 8, true, false, () => [0.45, 0.45, 0.46, 1.0]);

    // Fluke left blade
    const leftBlade = [
      [0, 9.5, 0.5],
      [2.5, 12.0, 0.2],
      [5.5, 14.5, -0.4],
      [8.0, 16.5, -0.8],
      [9.5, 17.2, -1.1] // Tip
    ];
    mesh.tube(leftBlade, (t) => 1.5 * (1 - t * 0.85) + 0.15, 6, true, true, () => [0.42, 0.44, 0.45, 1.0]);

    // Fluke right blade
    const rightBlade = [
      [0, 9.5, 0.5],
      [-2.5, 12.0, 0.2],
      [-5.5, 14.5, -0.4],
      [-8.0, 16.5, -0.8],
      [-9.5, 17.2, -1.1] // Tip
    ];
    mesh.tube(rightBlade, (t) => 1.5 * (1 - t * 0.85) + 0.15, 6, true, true, () => [0.42, 0.44, 0.45, 1.0]);

    mesh.computeVertexNormals();
    return mesh.toBuffers();
  }

  buildArchMesh() {
    const mesh = new Mesh();
    const radius = 8.0;
    const thickness = 2.4;
    const archPts = [];
    const steps = 18;

    for (let i = 0; i <= steps; i++) {
      const angle = (i / steps) * PI;
      const x = cos(angle) * radius;
      const y = sin(angle) * radius * 1.25;
      const z = sin(angle * 2.0) * 1.5;
      archPts.push([x, y, z]);
    }

    mesh.tube(archPts, (t) => thickness * (0.8 + 0.4 * sin(t * PI)), 8, true, true, () => [0.48, 0.46, 0.42, 1.0]);
    mesh.computeVertexNormals();
    return mesh.toBuffers();
  }

  generateBubblesAndParticles() {
    // Hydrothermal Bubble Vents
    this.bubbleVents = [
      { x: 42, y: this.getSeabedHeight(42, -32), z: -32, rate: 85 },
      { x: 44, y: this.getSeabedHeight(44, -30), z: -30, rate: 65 },
      { x: 14, y: this.getSeabedHeight(14, 94), z: 94, rate: 45 },
      { x: -5, y: this.getSeabedHeight(-5, -6), z: -6, rate: 50 }
    ];

    // Marine snow particles (ambient drifting suspended plankton)
    const count = this.quality === 2 ? 800 : this.quality === 1 ? 1600 : 2800;
    this.marineSnow = new Float32Array(count * 4); // x, y, z, size

    for (let i = 0; i < count; i++) {
      this.marineSnow[i * 4 + 0] = rr(-150, 150);
      this.marineSnow[i * 4 + 1] = rr(-45, -2);
      this.marineSnow[i * 4 + 2] = rr(-150, 150);
      this.marineSnow[i * 4 + 3] = rr(0.03, 0.12);
    }
  }

  generateMarineLife() {
    // Autonomous Schooling Fish (Boids)
    this.fishSchools = [
      {
        center: [-2, -26, -10],
        count: 240,
        radius: 12.0,
        speed: 4.5,
        color: [0.35, 0.75, 0.95], // Silvery blue reef minnows
        boids: []
      },
      {
        center: [48, -22, 14],
        count: 180,
        radius: 9.0,
        speed: 5.2,
        color: [0.95, 0.85, 0.25], // Yellow tail fusiliers
        boids: []
      },
      {
        center: [12, -32, 86],
        count: 140,
        radius: 8.0,
        speed: 3.8,
        color: [0.85, 0.35, 0.85], // Purple anthias
        boids: []
      }
    ];

    // Initialize individual boid positions inside schools
    for (const school of this.fishSchools) {
      for (let i = 0; i < school.count; i++) {
        const u = rnd() * TAU;
        const v = (rnd() - 0.5) * PI;
        const r = Math.pow(rnd(), 0.6) * school.radius;
        school.boids.push({
          pos: [
            school.center[0] + cos(u) * cos(v) * r,
            school.center[1] + sin(v) * (r * 0.4),
            school.center[2] + sin(u) * cos(v) * r
          ],
          vel: [rr(-1, 1), rr(-0.2, 0.2), rr(-1, 1)],
          phase: rnd() * TAU
        });
      }
    }

    // Manta Rays gliding in sweeping circular paths
    this.mantaRays = [
      {
        center: [0, -22, -15],
        radius: 38.0,
        speed: 0.08, // Rad/s
        phase: 0.0,
        scale: 4.8,
        wingspan: 6.2
      },
      {
        center: [45, -16, 25],
        radius: 30.0,
        speed: -0.09,
        phase: 2.1,
        scale: 4.2,
        wingspan: 5.5
      },
      {
        center: [-40, -14, 40],
        radius: 35.0,
        speed: 0.075,
        phase: 4.2,
        scale: 5.0,
        wingspan: 6.5
      }
    ];
  }

  generateCollectibles() {
    this.collectibles = [];
    const positions = [
      // Inside & around shipwreck
      [58, -22, 12], [54, -24, 16], [62, -23, 8],
      // Near whale fluke monolith
      [-6, -38, -5], [-4, -32, -4],
      // Inside Luminescent Grotto
      [12, -40, 92], [16, -37, 88], [8, -42, 96],
      // In the Kelp Cathedral canopy & floor
      [-2, -12, -78], [-6, -36, -82], [4, -24, -72],
      // Through Grand Coral Arch
      [-24, -16, -18], [-22, -14, -20],
      // Around Anemone Sanctuary
      [22, -15, -26], [25, -17, -24],
      // Over Hydrothermal Vents
      [42, -34, -32], [45, -36, -30],
      // Shallow Sunlit Atoll
      [-38, -5, 28], [-35, -4, 32], [-42, -6, 25]
    ];

    for (let i = 0; i < positions.length; i++) {
      this.collectibles.push({
        id: `pearl_${i + 1}`,
        name: `Luminous Pearl #${i + 1}`,
        pos: positions[i],
        collected: false,
        pulsePhase: rnd() * TAU
      });
    }
  }

  update(dt, playerFishPos) {
    // 1. Update Fish Schools (Boids algorithm + Player avoidance!)
    for (const school of this.fishSchools) {
      for (const boid of school.boids) {
        boid.phase += dt * 6.0;

        // Player avoidance: scatter if player swims within 6 meters!
        const dx = boid.pos[0] - playerFishPos[0];
        const dy = boid.pos[1] - playerFishPos[1];
        const dz = boid.pos[2] - playerFishPos[2];
        const playerDist = hypot(dx, dy, dz);

        if (playerDist < 7.5) {
          const repel = (7.5 - playerDist) * 8.0;
          boid.vel[0] += (dx / playerDist) * repel * dt;
          boid.vel[1] += (dy / playerDist) * repel * dt;
          boid.vel[2] += (dz / playerDist) * repel * dt;
        }

        // Orbit toward school center
        const cx = school.center[0] - boid.pos[0];
        const cy = school.center[1] - boid.pos[1];
        const cz = school.center[2] - boid.pos[2];
        boid.vel[0] += cx * 0.4 * dt;
        boid.vel[1] += cy * 0.4 * dt;
        boid.vel[2] += cz * 0.4 * dt;

        // Drag & integrate
        const vLen = hypot(boid.vel[0], boid.vel[1], boid.vel[2]) || 1;
        const curSpd = min(vLen, school.speed * 1.8);
        boid.pos[0] += (boid.vel[0] / vLen) * curSpd * dt;
        boid.pos[1] += (boid.vel[1] / vLen) * curSpd * dt;
        boid.pos[2] += (boid.vel[2] / vLen) * curSpd * dt;
      }
    }

    // 2. Update Manta Rays
    for (const manta of this.mantaRays) {
      manta.phase += manta.speed * dt;
      manta.pos = [
        manta.center[0] + cos(manta.phase) * manta.radius,
        manta.center[1] + sin(manta.phase * 2.0) * 2.2,
        manta.center[2] + sin(manta.phase) * manta.radius
      ];
      // Heading tangent
      manta.tangent = [
        -sin(manta.phase) * Math.sign(manta.speed),
        cos(manta.phase * 2.0) * 0.2,
        cos(manta.phase) * Math.sign(manta.speed)
      ];
    }

    // 3. Check Landmark Discoveries
    const newDiscoveries = [];
    for (const landmark of this.landmarks) {
      if (!landmark.discovered) {
        const d = hypot(
          playerFishPos[0] - landmark.pos[0],
          playerFishPos[1] - landmark.pos[1],
          playerFishPos[2] - landmark.pos[2]
        );
        if (d <= landmark.radius) {
          landmark.discovered = true;
          this.discoveredCount++;
          newDiscoveries.push(landmark);
        }
      }
    }

    // 4. Check Collectible Pearl Pickups
    const collectedPearls = [];
    for (const pearl of this.collectibles) {
      if (!pearl.collected) {
        pearl.pulsePhase += dt * 3.5;
        const d = hypot(
          playerFishPos[0] - pearl.pos[0],
          playerFishPos[1] - pearl.pos[1],
          playerFishPos[2] - pearl.pos[2]
        );
        if (d <= 2.2) {
          pearl.collected = true;
          collectedPearls.push(pearl);
        }
      }
    }

    return {
      newDiscoveries,
      collectedPearls
    };
  }
}
