// ============================================================================
// NYXEN — Infinite Procedural Ocean World & Spatial Chunk Streaming
// Dynamic multi-biome generation, endless seabed terrain, infinite kelp forests,
// coral reef gardens, shipwreck fields, procedural landmarks, boid schools & mantas.
// ============================================================================

import { Mesh, vnoise, fbm, worley, sstep, rnd, rseed, rr, clamp, sin, cos, abs, max, min, sqrt, PI, TAU, hypot, ihash } from './math.js';

export const CHUNK_SIZE = 64.0;

export const BIOMES = {
  CORAL_EDEN: { id: 'coral_eden', name: 'Coral Eden (Sanctuary)', depthRange: [-45, -7] },
  BARRIER_REEF: { id: 'barrier_reef', name: 'Sunlit Barrier Reef & Atoll', depthRange: [-16, -5] },
  KELP_BASIN: { id: 'kelp_basin', name: 'Giant Kelp Cathedral Basin', depthRange: [-34, -18] },
  ABYSSAL_TRENCH: { id: 'abyssal_trench', name: 'Luminescent Abyssal Trench', depthRange: [-65, -36] },
  SEAMOUNTS: { id: 'seamounts', name: 'Volcanic Seamount Pinnacles', depthRange: [-45, -8] },
  SHIPWRECK_GRAVEYARD: { id: 'shipwreck_graveyard', name: 'Shipwreck Relics & Shoals', depthRange: [-38, -22] }
};

export const CORE_LANDMARKS = [
  { id: 'sunken_galleon', name: "The Sunken Galleon ('The Siren's Rest')", pos: [58, -25, 12], radius: 24, discovered: false, desc: "A 17th-century wooden frigate resting peacefully on the seabed, now overgrown with staghorn corals and sea fans." },
  { id: 'whale_fluke', name: 'The Whale Fluke Monolith', pos: [-6, -42, -5], radius: 18, discovered: false, desc: "An ancient, colossal stone carving of a breaching whale fluke, sacred to the deep ocean." },
  { id: 'purple_grotto', name: 'The Luminescent Purple Grotto', pos: [12, -38, 92], radius: 26, discovered: false, desc: "A vaulted submerged cavern bathed in mysterious violet bioluminescence with glowing sea moss and giant barrel sponges." },
  { id: 'kelp_cathedral', name: 'The Kelp Forest Cathedral', pos: [-2, -28, -78], radius: 32, discovered: false, desc: "Towering Macrocystis giant kelp soaring 40 meters towards the dancing surface sunbeams." },
  { id: 'coral_arch', name: 'The Grand Coral Archway', pos: [-24, -18, -18], radius: 16, discovered: false, desc: "A massive natural limestone arch encrusted with vibrant rainbow corals and sea anemones." },
  { id: 'anemone_sanctuary', name: 'The Giant Anemone Sanctuary', pos: [22, -16, -26], radius: 15, discovered: false, desc: "A lush garden of undulating sea anemones providing safe haven for clownfish families." },
  { id: 'hydrothermal_vents', name: 'The Hydrothermal Chimneys', pos: [42, -40, -32], radius: 18, discovered: false, desc: "Volcanic mineral spires discharging warm mineral waters and continuous streams of sparkling bubbles." },
  { id: 'sunlit_atoll', name: 'The Shallow Sunlit Atoll', pos: [-38, -6, 28], radius: 22, discovered: false, desc: "A warm, sun-drenched reef crest where turquoise waves break and baby fish learn to swim." }
];

export const LANDMARKS = CORE_LANDMARKS;

export class InfiniteOceanWorld {
  constructor(quality = 0) { // 0: High, 1: Medium, 2: Low
    this.quality = quality;
    this.chunkSize = CHUNK_SIZE;
    this.viewRadius = quality === 2 ? 2 : quality === 1 ? 2 : 3; // 5x5 to 7x7 chunks

    // Chunk Management
    this.activeChunks = new Map(); // key -> Chunk
    this.chunkCache = new Map();  // key -> cached Chunk
    this.curChunkX = null;
    this.curChunkZ = null;

    // Environmental entities
    this.landmarks = JSON.parse(JSON.stringify(CORE_LANDMARKS));
    this.discoveredCount = 0;
    this.collectibles = [];
    this.fishSchools = [];
    this.mantaRays = [];
    this.marineSnow = [];

    // Set pieces in starting region
    this.setPieceMeshes = [];

    this.init();
  }

  // Fast continuous biome determination at any coordinate (x, z)
  getBiomeAt(x, z) {
    const dOrigin = hypot(x, z);
    if (dOrigin < 130.0) {
      return BIOMES.CORAL_EDEN;
    }
    const b = fbm(x * 0.0022, 11.2, z * 0.0022, 3);
    const m = fbm(x * 0.0035 + 50.0, 7.8, z * 0.0035 + 20.0, 2);

    if (b > 0.60) return BIOMES.BARRIER_REEF;
    if (b > 0.46) return BIOMES.KELP_BASIN;
    if (b < 0.36) return BIOMES.ABYSSAL_TRENCH;
    if (m > 0.65) return BIOMES.SEAMOUNTS;
    return BIOMES.SHIPWRECK_GRAVEYARD;
  }

  // Seamless, infinite heightfield query anywhere in the ocean
  getSeabedHeight(x, z) {
    const dOrigin = hypot(x, z);

    // 1. Handcrafted Coral Eden starting terrain
    let yEden = -44.0 + 8.0 * (fbm(x * 0.012, 1.5, z * 0.012, 3) - 0.5);

    const dAtoll = hypot(x - (-38), z - 28);
    if (dAtoll < 30.0) {
      const atollBlend = sstep(30.0, 8.0, dAtoll);
      yEden = max(yEden, -7.5 + atollBlend * 3.5 + 1.2 * fbm(x * 0.08, 2.0, z * 0.08, 2));
    }

    const dCanyon = abs(x * 0.7 - z * 0.7 + 10.0);
    if (dCanyon < 18.0) {
      yEden -= (1.0 - dCanyon / 18.0) * 8.0;
    }

    const dMesa1 = hypot(x - 28, z - (-15));
    if (dMesa1 < 22.0) {
      yEden = max(yEden, -18.0 + (1.0 - dMesa1 / 22.0) * 12.0);
    }

    const dMesa2 = hypot(x - (-65), z - (-12));
    if (dMesa2 < 24.0) {
      yEden = max(yEden, -16.0 + (1.0 - dMesa2 / 24.0) * 14.0);
    }

    const dGrotto = hypot(x - 12, z - 92);
    if (dGrotto < 28.0) {
      yEden = min(yEden, -36.0 - (1.0 - dGrotto / 28.0) * 8.0);
    }

    if (dOrigin < 110.0) {
      return yEden;
    }

    // 2. Infinite Ocean Procedural Biome Terrain
    let yInf = -36.0 + 12.0 * (fbm(x * 0.005, 1.5, z * 0.005, 3) - 0.5);
    const b = fbm(x * 0.0022, 11.2, z * 0.0022, 3);
    const m = fbm(x * 0.0035 + 50.0, 7.8, z * 0.0035 + 20.0, 2);

    if (b > 0.60) {
      // Barrier Reef: elevated plateaus reaching to -8m
      const plateau = sstep(0.60, 0.75, b) * 22.0;
      yInf = max(yInf, -32.0 + plateau + 2.0 * fbm(x * 0.04, 3.0, z * 0.04, 2));
    } else if (b < 0.36) {
      // Abyssal Trench: deep drops to -58m
      const trenchDrop = sstep(0.36, 0.20, b) * 22.0;
      yInf -= trenchDrop;
    } else if (m > 0.65) {
      // Seamount Pinnacle
      const seamountHeight = sstep(0.65, 0.82, m) * 28.0;
      yInf = max(yInf, -40.0 + seamountHeight);
    }

    // High-frequency sand ripples and rock outcroppings
    yInf += 1.8 * (fbm(x * 0.035, 4.0, z * 0.035, 2) - 0.5);

    if (dOrigin >= 150.0) {
      return yInf;
    }

    // Smooth blend between Coral Eden and Infinite Ocean
    const blend = sstep(110.0, 150.0, dOrigin);
    return yEden * (1.0 - blend) + yInf * blend;
  }

  init() {
    rseed(42);

    // Initial Set Pieces around starting sanctuary
    this.generateSetPieces();

    // Marine Life
    this.generateMarineLife();

    // Marine snow particles
    this.generateMarineSnow();

    // Initial chunk stream around origin (0, 0)
    this.updateChunks(0, 0);
  }

  // ----------------------------------------------------------------
  // Infinite Chunk Streaming
  // ----------------------------------------------------------------
  updateChunks(playerX, playerZ) {
    const cx = Math.floor((playerX + this.chunkSize * 0.5) / this.chunkSize);
    const cz = Math.floor((playerZ + this.chunkSize * 0.5) / this.chunkSize);

    if (cx === this.curChunkX && cz === this.curChunkZ) {
      return; // No chunk boundary crossed
    }

    this.curChunkX = cx;
    this.curChunkZ = cz;

    const R = this.viewRadius;
    const requiredKeys = new Set();
    const newChunks = [];

    // Gather all chunks in view radius
    for (let dx = -R; dx <= R; dx++) {
      for (let dz = -R; dz <= R; dz++) {
        const key = `${cx + dx},${cz + dz}`;
        requiredKeys.add(key);

        if (!this.activeChunks.has(key)) {
          let chunk = this.chunkCache.get(key);
          if (!chunk) {
            chunk = this.generateChunk(cx + dx, cz + dz);
            this.chunkCache.set(key, chunk);
          }
          this.activeChunks.set(key, chunk);
          newChunks.push(chunk);
        }
      }
    }

    // Evict chunks outside view radius
    for (const [key, chunk] of this.activeChunks.entries()) {
      if (!requiredKeys.has(key)) {
        this.activeChunks.delete(key);
      }
    }

    // Keep chunkCache bounded (max 64 chunks)
    if (this.chunkCache.size > 64) {
      for (const [key, chunk] of this.chunkCache.entries()) {
        if (!this.activeChunks.has(key)) {
          this.chunkCache.delete(key);
          if (this.chunkCache.size <= 48) break;
        }
      }
    }

    return newChunks;
  }

  generateChunk(cx, cz) {
    const S = this.chunkSize;
    const x0 = cx * S;
    const z0 = cz * S;
    const biome = this.getBiomeAt(x0 + S * 0.5, z0 + S * 0.5);

    // Grid resolution per chunk
    const N = this.quality === 2 ? 12 : this.quality === 1 ? 16 : 20;
    const step = S / N;

    const mesh = new Mesh();
    const heights = new Float32Array((N + 1) * (N + 1));

    // Precalculate heights for chunk
    for (let j = 0; j <= N; j++) {
      const z = z0 + j * step;
      for (let i = 0; i <= N; i++) {
        const x = x0 + i * step;
        heights[i + j * (N + 1)] = this.getSeabedHeight(x, z);
      }
    }

    // Vertices & Normals
    for (let j = 0; j <= N; j++) {
      const z = z0 + j * step;
      for (let i = 0; i <= N; i++) {
        const x = x0 + i * step;
        const y = heights[i + j * (N + 1)];

        const hL = i > 0 ? heights[(i - 1) + j * (N + 1)] : this.getSeabedHeight(x - step, z);
        const hR = i < N ? heights[(i + 1) + j * (N + 1)] : this.getSeabedHeight(x + step, z);
        const hD = j > 0 ? heights[i + (j - 1) * (N + 1)] : this.getSeabedHeight(x, z - step);
        const hU = j < N ? heights[i + (j + 1) * (N + 1)] : this.getSeabedHeight(x, z + step);

        let nx = hL - hR;
        let ny = 2.0 * step;
        let nz = hD - hU;
        const nl = hypot(nx, ny, nz) || 1;
        nx /= nl; ny /= nl; nz /= nl;

        // Color based on biome, slope & depth
        let cr = 0.82, cg = 0.74, cb = 0.55; // Sand base

        if (biome.id === 'abyssal_trench' || y < -38.0) {
          cr = 0.28; cg = 0.15; cb = 0.48; // Luminescent dark violet
        } else if (biome.id === 'kelp_basin') {
          cr = 0.45; cg = 0.58; cb = 0.35; // Olive algae seabed
        } else if (y > -14.0) {
          cr = 0.94; cg = 0.88; cb = 0.68; // Shallow sunlit golden sand
        }

        // Rocky cliff slopes
        if (ny < 0.82) {
          cr = 0.42; cg = 0.40; cb = 0.38;
        }

        mesh.vertex(x, y, z, nx, ny, nz, (x / S) * 4.0, (z / S) * 4.0, cr, cg, cb, 1);
      }
    }

    // Triangles
    for (let j = 0; j < N; j++) {
      for (let i = 0; i < N; i++) {
        const a = i + j * (N + 1);
        const b = (i + 1) + j * (N + 1);
        const c = (i + 1) + (j + 1) * (N + 1);
        const d = i + (j + 1) * (N + 1);
        mesh.quad(a, d, c, b);
      }
    }

    // Procedural flora & decorations for this chunk
    const kelpInstances = [];
    const coralInstances = [];
    const bubbleVents = [];
    const seed = ihash(cx, 1337, cz);
    rseed(seed);

    // A. Kelp in Kelp Basins & deep ocean
    if (biome.id === 'kelp_basin' || (biome.id === 'coral_eden' && rnd() < 0.3)) {
      const numKelp = Math.floor(rr(6, 14));
      for (let k = 0; k < numKelp; k++) {
        const kx = x0 + rr(4, S - 4);
        const kz = z0 + rr(4, S - 4);
        const ky = this.getSeabedHeight(kx, kz);
        kelpInstances.push({
          x: kx, y: ky, z: kz,
          height: min(42.0, max(14.0, -ky - rr(3.0, 7.0))),
          swayPhase: rnd() * TAU,
          swayFreq: rr(0.8, 1.4),
          scale: rr(0.85, 1.3),
          strands: 2 + (rnd() < 0.5 ? 1 : 0)
        });
      }
    }

    // B. Corals in Barrier Reefs & Shallow Atolls
    if (biome.id === 'barrier_reef' || biome.id === 'coral_eden' || biome.id === 'seamounts') {
      const numCorals = Math.floor(rr(12, 28));
      const types = ['staghorn', 'brain', 'table', 'fan', 'anemone'];
      for (let c = 0; c < numCorals; c++) {
        const cxPos = x0 + rr(2, S - 2);
        const czPos = z0 + rr(2, S - 2);
        const cyPos = this.getSeabedHeight(cxPos, czPos);
        coralInstances.push({
          type: types[Math.floor(rnd() * types.length)],
          x: cxPos, y: cyPos, z: czPos,
          scale: rr(0.6, 1.5),
          yaw: rnd() * TAU,
          colorIndex: Math.floor(rnd() * 6)
        });
      }
    }

    // C. Hydrothermal Bubble Vents in Abyssal Trenches
    if (biome.id === 'abyssal_trench' && rnd() < 0.45) {
      const vx = x0 + rr(8, S - 8);
      const vz = z0 + rr(8, S - 8);
      bubbleVents.push({
        x: vx, y: this.getSeabedHeight(vx, vz), z: vz,
        rate: Math.floor(rr(40, 80))
      });
    }

    // D. Procedural Distant Landmarks (at intervals across the infinite ocean)
    const landmarkSeed = ihash(cx, 999, cz);
    if ((landmarkSeed % 100 > 92) && hypot(x0, z0) > 180.0) {
      const lmX = x0 + S * 0.5;
      const lmZ = z0 + S * 0.5;
      const lmY = this.getSeabedHeight(lmX, lmZ);
      const names = [
        "The Sunken Citadel",
        "Poseidon's Needle",
        "The Deep Blue Hole",
        "The Leviathan Spine",
        "The Emerald Seamount",
        "The Lost Galleon Graveyard",
        "The Bioluminescent Caverns"
      ];
      const lmName = names[landmarkSeed % names.length];
      const lmId = `landmark_${cx}_${cz}`;

      if (!this.landmarks.some(l => l.id === lmId)) {
        this.landmarks.push({
          id: lmId,
          name: `${lmName} [X: ${Math.round(lmX)}m, Z: ${Math.round(lmZ)}m]`,
          pos: [lmX, lmY + 5.0, lmZ],
          radius: 26,
          discovered: false,
          desc: `A breathtaking procedural wonder discovered in the ${biome.name}.`
        });
      }
    }

    // E. Collectible Pearls in distant chunks
    if (rnd() < 0.28) {
      const px = x0 + rr(6, S - 6);
      const pz = z0 + rr(6, S - 6);
      const py = this.getSeabedHeight(px, pz) + rr(1.5, 4.0);
      const pId = `pearl_${cx}_${cz}`;
      if (!this.collectibles.some(p => p.id === pId)) {
        this.collectibles.push({
          id: pId,
          name: `Luminous Pearl (${Math.round(px)}, ${Math.round(pz)})`,
          pos: [px, py, pz],
          collected: false,
          pulsePhase: rnd() * TAU
        });
      }
    }

    return {
      key: `${cx},${cz}`,
      cx, cz,
      biome,
      meshData: mesh.toBuffers(),
      kelpInstances,
      coralInstances,
      bubbleVents,
      gpu: null // Assigned by renderer
    };
  }

  // ----------------------------------------------------------------
  // Set Pieces & Marine Life
  // ----------------------------------------------------------------
  generateSetPieces() {
    this.setPieceMeshes = [];

    // A. Sunken Galleon ("The Siren's Rest") at [58, -25, 12]
    const shipMesh = this.buildShipwreckMesh();
    this.setPieceMeshes.push({
      mesh: shipMesh,
      pos: [58, this.getSeabedHeight(58, 12) + 2.5, 12],
      yaw: -0.85,
      scale: 1.35
    });

    // B. Ancient Whale Fluke Monolith at [-6, -42, -5]
    const flukeMesh = this.buildWhaleFlukeMesh();
    this.setPieceMeshes.push({
      mesh: flukeMesh,
      pos: [-6, this.getSeabedHeight(-6, -5) - 1.0, -5],
      yaw: 1.15,
      scale: 1.8
    });

    // C. Grand Coral Archway at [-24, -18, -18]
    const archMesh = this.buildArchMesh();
    this.setPieceMeshes.push({
      mesh: archMesh,
      pos: [-24, this.getSeabedHeight(-24, -18), -18],
      yaw: 0.45,
      scale: 2.2
    });
  }

  buildShipwreckMesh() {
    const mesh = new Mesh();
    const length = 28.0, beam = 7.5, depth = 5.5;
    const woodDark = [0.22, 0.16, 0.11, 1.0];
    const woodPlank = [0.32, 0.24, 0.16, 1.0];
    const algaeWood = [0.18, 0.22, 0.14, 1.0];

    const keelPts = [
      [length * 0.5, 3.2, 0],
      [length * 0.4, 0.5, 0],
      [0, -depth * 0.5, 0],
      [-length * 0.4, -depth * 0.45, 0],
      [-length * 0.5, 2.5, 0]
    ];
    mesh.tube(keelPts, 0.45, 6, true, true, () => woodDark);

    const numRibs = 14;
    for (let r = 0; r < numRibs; r++) {
      const frac = r / (numRibs - 1);
      const x = (frac - 0.5) * length * 0.85;
      const bWidth = beam * sin(frac * PI);
      const bDepth = depth * (0.6 + 0.4 * sin(frac * PI));
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

    const mastPts = [[2.0, -depth * 0.4, 0], [2.0, 8.5, 0], [3.5, 12.0, 1.5]];
    mesh.tube(mastPts, (t) => 0.55 * (1 - t * 0.5), 6, true, true, () => algaeWood);

    mesh.computeVertexNormals();
    return mesh.toBuffers();
  }

  buildWhaleFlukeMesh() {
    const mesh = new Mesh();
    const stemPts = [[0, -6.0, 0], [0, 0.0, 0], [0, 5.0, 0.2], [0, 9.5, 0.5]];
    mesh.tube(stemPts, (t) => 1.8 * (1 - t * 0.35) + 0.8, 8, true, false, () => [0.45, 0.45, 0.46, 1.0]);

    const leftBlade = [[0, 9.5, 0.5], [2.5, 12.0, 0.2], [5.5, 14.5, -0.4], [8.0, 16.5, -0.8], [9.5, 17.2, -1.1]];
    mesh.tube(leftBlade, (t) => 1.5 * (1 - t * 0.85) + 0.15, 6, true, true, () => [0.42, 0.44, 0.45, 1.0]);

    const rightBlade = [[0, 9.5, 0.5], [-2.5, 12.0, 0.2], [-5.5, 14.5, -0.4], [-8.0, 16.5, -0.8], [-9.5, 17.2, -1.1]];
    mesh.tube(rightBlade, (t) => 1.5 * (1 - t * 0.85) + 0.15, 6, true, true, () => [0.42, 0.44, 0.45, 1.0]);

    mesh.computeVertexNormals();
    return mesh.toBuffers();
  }

  buildArchMesh() {
    const mesh = new Mesh();
    const radius = 8.0;
    const thickness = 2.4;
    const archPts = [];
    for (let i = 0; i <= 18; i++) {
      const angle = (i / 18) * PI;
      archPts.push([cos(angle) * radius, sin(angle) * radius * 1.25, sin(angle * 2.0) * 1.5]);
    }
    mesh.tube(archPts, (t) => thickness * (0.8 + 0.4 * sin(t * PI)), 8, true, true, () => [0.48, 0.46, 0.42, 1.0]);
    mesh.computeVertexNormals();
    return mesh.toBuffers();
  }

  // ----------------------------------------------------------------
  // Procedural Flora & Fauna Prototype Meshes
  // ----------------------------------------------------------------
  buildKelpColumnMesh() {
    const mesh = new Mesh();
    const pts = [];
    const height = 32.0;
    for (let i = 0; i <= 16; i++) {
      const t = i / 16;
      pts.push([sin(t * 4.0) * 0.4, t * height, cos(t * 3.5) * 0.4]);
    }
    mesh.tube(pts, (t) => 0.16 * (1.0 - t * 0.5), 6, true, true, () => [0.18, 0.42, 0.12, 1.0]);

    for (let i = 2; i < 16; i++) {
      const p = pts[i];
      const bladeSide = (i % 2 === 0) ? 1 : -1;
      const bLen = 2.2 * (1.0 - (i / 16) * 0.4);
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
    const col = [0.85, 0.45, 0.35, 1.0];
    mesh.tube([[0, 0, 0], [0, 0.8, 0], [0.1, 1.6, 0.05]], (t) => 0.18 * (1 - t * 0.4), 6, true, true, () => col);
    mesh.tube([[0.1, 1.6, 0.05], [0.6, 2.4, 0.2], [0.9, 3.2, 0.4]], (t) => 0.12 * (1 - t * 0.5), 5, false, true, () => [0.95, 0.55, 0.45, 1.0]);
    mesh.tube([[0.1, 1.6, 0.05], [-0.5, 2.3, -0.3], [-0.8, 3.1, -0.5]], (t) => 0.12 * (1 - t * 0.5), 5, false, true, () => [0.95, 0.55, 0.45, 1.0]);
    mesh.computeVertexNormals();
    return mesh.toBuffers();
  }

  buildBrainCoralMesh() {
    const mesh = new Mesh();
    const segsH = 12, segsV = 8;
    const rad = 1.2;
    const ringIndices = [];
    for (let v = 0; v <= segsV; v++) {
      const phi = (v / segsV) * (PI * 0.5);
      const cosP = cos(phi), sinP = sin(phi);
      const ring = [];
      for (let h = 0; h < segsH; h++) {
        const theta = (h / segsH) * TAU;
        const r = rad * (1.0 + 0.12 * sin(theta * 8.0) * cosP);
        const col = [0.72, 0.78, 0.25, 1.0];
        ring.push(mesh.vertex(cos(theta) * cosP * r, sinP * r, sin(theta) * cosP * r, 0, 1, 0, 0, 0, col[0], col[1], col[2], 1));
      }
      ringIndices.push(ring);
    }
    for (let v = 0; v < segsV; v++) {
      for (let h = 0; h < segsH; h++) {
        mesh.quad(ringIndices[v][h], ringIndices[v][(h + 1) % segsH], ringIndices[v + 1][(h + 1) % segsH], ringIndices[v + 1][h]);
      }
    }
    mesh.computeVertexNormals();
    return mesh.toBuffers();
  }

  buildTableCoralMesh() {
    const mesh = new Mesh();
    mesh.tube([[0, 0, 0], [0, 0.7, 0], [0, 1.3, 0]], 0.35, 6, true, false, () => [0.65, 0.45, 0.35, 1.0]);
    const segs = 14;
    const centerTop = mesh.vertex(0, 1.45, 0, 0, 1, 0, 0.5, 0.5, 0.82, 0.58, 0.38, 1);
    const rimIndices = [];
    for (let i = 0; i < segs; i++) {
      const a = (i / segs) * TAU;
      const r = 2.4 * (0.85 + 0.15 * sin(a * 4.0));
      rimIndices.push(mesh.vertex(cos(a) * r, 1.35, sin(a) * r, cos(a), 0.2, sin(a), 0, 0, 0.88, 0.65, 0.45, 1));
    }
    for (let i = 0; i < segs; i++) {
      mesh.tri(centerTop, rimIndices[i], rimIndices[(i + 1) % segs]);
      mesh.tri(centerTop, rimIndices[(i + 1) % segs], rimIndices[i]);
    }
    mesh.computeVertexNormals();
    return mesh.toBuffers();
  }

  buildSeaFanMesh() {
    const mesh = new Mesh();
    const fanCol = [0.95, 0.22, 0.35, 1.0];
    for (let r = 0; r < 11; r++) {
      const frac = r / 10;
      const angle = (frac - 0.5) * 1.6;
      const len = 2.2 * (0.7 + 0.3 * sin(frac * PI));
      mesh.tube([[0, 0, 0], [sin(angle) * len * 0.5, cos(angle) * len * 0.5, 0], [sin(angle) * len, cos(angle) * len, 0]], (t) => 0.04 * (1 - t * 0.6), 4, true, true, () => fanCol);
    }
    mesh.computeVertexNormals();
    return mesh.toBuffers();
  }

  buildAnemoneMesh() {
    const mesh = new Mesh();
    const anemoneCol = [0.96, 0.55, 0.75, 1.0];
    for (let i = 0; i < 20; i++) {
      const angle = (i / 20) * TAU;
      const rBase = 0.25 + 0.15 * (i % 3);
      const len = rr(0.8, 1.3);
      const x0 = cos(angle) * rBase, z0 = sin(angle) * rBase;
      mesh.tube([[x0, 0, z0], [x0 * 1.3, len * 0.5, z0 * 1.3], [x0 * 1.6, len, z0 * 1.6]], (t) => 0.045 * (1 - t * 0.7), 4, true, true, () => anemoneCol);
    }
    mesh.computeVertexNormals();
    return mesh.toBuffers();
  }

  buildMantaMesh() {
    const mesh = new Mesh();
    const wingspan = 4.8, bodyLen = 3.6;
    const vNose = mesh.vertex(0, 0.05, bodyLen * 0.5, 0, 1, 0, 0.5, 1, 0.12, 0.15, 0.18, 1);
    const vTail = mesh.vertex(0, 0.0, -bodyLen * 0.5, 0, 0, -1, 0.5, 0, 0.12, 0.15, 0.18, 1);
    const vLeftWing = mesh.vertex(-wingspan * 0.5, 0.1, 0.0, 0, 1, 0, 0, 0.5, 0.08, 0.10, 0.14, 1);
    const vRightWing = mesh.vertex(wingspan * 0.5, 0.1, 0.0, 0, 1, 0, 1, 0.5, 0.08, 0.10, 0.14, 1);
    const vBelly = mesh.vertex(0, -0.25, 0.1, 0, -1, 0, 0.5, 0.5, 0.95, 0.95, 0.98, 1);

    mesh.tri(vNose, vRightWing, vTail);
    mesh.tri(vNose, vTail, vLeftWing);
    mesh.tri(vNose, vBelly, vRightWing);
    mesh.tri(vNose, vLeftWing, vBelly);
    mesh.tri(vTail, vRightWing, vBelly);
    mesh.tri(vTail, vBelly, vLeftWing);

    mesh.tube([[0, 0, -bodyLen * 0.5], [0, 0.05, -bodyLen * 0.8], [0, 0.1, -bodyLen * 1.2]], 0.05, 4, true, true, () => [0.1, 0.1, 0.12, 1.0]);
    mesh.computeVertexNormals();
    return mesh.toBuffers();
  }

  buildSchoolFishMesh() {
    const mesh = new Mesh();
    mesh.tube([[0, 0, 0.22], [0, 0.06, 0.08], [0, 0, -0.15]], (t) => 0.045 * sin(t * PI), 4, true, true, (t) => [0.35 + t * 0.5, 0.65 + t * 0.2, 0.95, 1.0]);
    mesh.computeVertexNormals();
    return mesh.toBuffers();
  }

  buildPearlMesh() {
    const mesh = new Mesh();
    const segs = 8, r = 0.45;
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

  // ----------------------------------------------------------------
  // Marine Snow & Schools
  // ----------------------------------------------------------------
  generateMarineSnow() {
    const count = this.quality === 2 ? 800 : this.quality === 1 ? 1600 : 2800;
    this.marineSnow = new Float32Array(count * 4);
    for (let i = 0; i < count; i++) {
      this.marineSnow[i * 4 + 0] = rr(-80, 80);
      this.marineSnow[i * 4 + 1] = rr(-45, -2);
      this.marineSnow[i * 4 + 2] = rr(-80, 80);
      this.marineSnow[i * 4 + 3] = rr(0.03, 0.12);
    }
  }

  generateMarineLife() {
    this.fishSchools = [
      { center: [-2, -26, -10], count: 200, radius: 12.0, speed: 4.5, color: [0.35, 0.75, 0.95], boids: [] },
      { center: [48, -22, 14], count: 160, radius: 9.0, speed: 5.2, color: [0.95, 0.85, 0.25], boids: [] },
      { center: [12, -32, 86], count: 120, radius: 8.0, speed: 3.8, color: [0.85, 0.35, 0.85], boids: [] }
    ];

    for (const school of this.fishSchools) {
      for (let i = 0; i < school.count; i++) {
        const u = rnd() * TAU, v = (rnd() - 0.5) * PI, r = Math.pow(rnd(), 0.6) * school.radius;
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

    this.mantaRays = [
      { center: [0, -22, -15], radius: 38.0, speed: 0.08, phase: 0.0, scale: 4.8 },
      { center: [45, -16, 25], radius: 30.0, speed: -0.09, phase: 2.1, scale: 4.2 },
      { center: [-40, -14, 40], radius: 35.0, speed: 0.075, phase: 4.2, scale: 5.0 }
    ];
  }

  // ----------------------------------------------------------------
  // Frame Update Loop
  // ----------------------------------------------------------------
  update(dt, playerFishPos) {
    // 1. Stream Infinite Chunks
    const newChunks = this.updateChunks(playerFishPos[0], playerFishPos[2]);

    // 2. Update Fish Schools (Boids algorithm + Player avoidance!)
    for (const school of this.fishSchools) {
      for (const boid of school.boids) {
        boid.phase += dt * 6.0;

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

        const cx = school.center[0] - boid.pos[0];
        const cy = school.center[1] - boid.pos[1];
        const cz = school.center[2] - boid.pos[2];
        boid.vel[0] += cx * 0.4 * dt;
        boid.vel[1] += cy * 0.4 * dt;
        boid.vel[2] += cz * 0.4 * dt;

        const vLen = hypot(boid.vel[0], boid.vel[1], boid.vel[2]) || 1;
        const curSpd = min(vLen, school.speed * 1.8);
        boid.pos[0] += (boid.vel[0] / vLen) * curSpd * dt;
        boid.pos[1] += (boid.vel[1] / vLen) * curSpd * dt;
        boid.pos[2] += (boid.vel[2] / vLen) * curSpd * dt;
      }
    }

    // 3. Update Manta Rays (sweep in gentle thermals)
    for (const manta of this.mantaRays) {
      manta.phase += manta.speed * dt;
      manta.pos = [
        manta.center[0] + cos(manta.phase) * manta.radius,
        manta.center[1] + sin(manta.phase * 2.0) * 2.2,
        manta.center[2] + sin(manta.phase) * manta.radius
      ];
    }

    // 4. Check Landmark Discoveries
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

    // 5. Check Collectible Pearl Pickups
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
      collectedPearls,
      newChunks
    };
  }
}
