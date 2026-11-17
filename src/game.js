// ============================================================================
// NYXEN — Main Game Orchestrator
// Coordinates Physics, Procedural Coral Eden World, Multi-Species Switching,
// Shared WebGPU/WebGL2 Rendering, Audio, Discovery Objectives, and Persistent Save.
// ============================================================================

import { SharedRenderer } from './renderer.js';
import { FishPhysics, CAMERA_MODES } from './fish_physics.js';
import { CoralEdenWorld, LANDMARKS } from './world.js';
import { SPECIES, SPECIES_DATA, buildFishMesh } from './species.js';
import { MarineAudio } from './audio.js';
import { InputManager } from './controls.js';
import { clamp, floor } from './math.js';

export class NyxenGame {
  constructor(canvas) {
    this.canvas = canvas;
    this.quality = this.loadQualitySetting();

    // Core Systems
    this.renderer = new SharedRenderer(canvas, { quality: this.quality });
    this.physics = new FishPhysics(SPECIES.CLOWNFISH);
    this.world = new CoralEdenWorld(this.quality);
    this.audio = new MarineAudio();
    this.input = new InputManager(canvas);

    // GPU Meshes Cache for all 8 Species
    this.speciesGPU = {};
    this.setPiecesGPU = [];
    this.terrainGPU = null;
    this.coralMeshesGPU = {};
    this.kelpGPU = null;
    this.mantaGPU = null;
    this.schoolFishGPU = null;
    this.pearlGPU = null;

    // Game State
    this.activeSpeciesId = SPECIES.CLOWNFISH;
    this.totalPearlsCollected = 0;
    this.discoveredLandmarks = new Set();
    this.time = 0;
    this.lastFrameTime = performance.now();
    this.fps = 60;
    this.frameCount = 0;
    this.fpsUpdateTime = 0;

    // Notification toast timer
    this.toastTimer = 0;

    this.loadSavedProgress();
    this.bindEvents();
  }

  loadQualitySetting() {
    try {
      const saved = localStorage.getItem('nyxen_quality');
      if (saved !== null) return parseInt(saved, 10);
      // Auto-detect mobile / low memory
      const isMobile = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0);
      const mem = navigator.deviceMemory || 8;
      if (isMobile || mem <= 4) return 1; // Medium
      return 0; // High
    } catch (e) {
      return 0;
    }
  }

  saveQualitySetting(q) {
    this.quality = q;
    try {
      localStorage.setItem('nyxen_quality', q.toString());
    } catch (e) {}
  }

  loadSavedProgress() {
    try {
      const saved = localStorage.getItem('nyxen_save');
      if (saved) {
        const data = JSON.parse(saved);
        if (data.discoveredLandmarks) {
          this.discoveredLandmarks = new Set(data.discoveredLandmarks);
          for (const lm of this.world.landmarks) {
            if (this.discoveredLandmarks.has(lm.id)) {
              lm.discovered = true;
            }
          }
        }
        if (data.collectedPearls) {
          const colSet = new Set(data.collectedPearls);
          for (const p of this.world.collectibles) {
            if (colSet.has(p.id)) {
              p.collected = true;
              this.totalPearlsCollected++;
            }
          }
        }
        if (data.activeSpeciesId && SPECIES_DATA[data.activeSpeciesId]) {
          this.activeSpeciesId = data.activeSpeciesId;
          this.physics.setSpecies(this.activeSpeciesId);
        }
      }
    } catch (e) {
      console.warn('Could not load saved progress:', e);
    }
  }

  saveProgress() {
    try {
      const data = {
        discoveredLandmarks: Array.from(this.discoveredLandmarks),
        collectedPearls: this.world.collectibles.filter(p => p.collected).map(p => p.id),
        activeSpeciesId: this.activeSpeciesId
      };
      localStorage.setItem('nyxen_save', JSON.stringify(data));
    } catch (e) {}
  }

  async start() {
    await this.renderer.init();

    // 1. Upload Terrain
    this.terrainGPU = this.renderer.uploadMesh(this.world.terrainMesh);

    // 2. Upload Set Pieces
    for (const piece of this.world.setPieceMeshes) {
      this.setPiecesGPU.push({
        gpu: this.renderer.uploadMesh(piece.mesh),
        pos: piece.pos,
        scale: piece.scale,
        yaw: piece.yaw
      });
    }

    // 3. Pre-upload all 8 fish species to GPU so character switching is 100% instant!
    console.log('NYXEN: Pre-building & uploading all 8 biological fish models to GPU...');
    for (const specKey of Object.values(SPECIES)) {
      const meshData = buildFishMesh(specKey);
      this.speciesGPU[specKey] = this.renderer.uploadMesh(meshData);
    }
    console.log('NYXEN: All 8 fish character models compiled into GPU memory.');

    // 4. Upload Flora & Fauna GPU Meshes
    this.kelpGPU = this.renderer.uploadMesh(this.world.buildKelpColumnMesh());
    this.coralMeshesGPU = {
      staghorn: this.renderer.uploadMesh(this.world.buildStaghornMesh()),
      brain: this.renderer.uploadMesh(this.world.buildBrainCoralMesh()),
      table: this.renderer.uploadMesh(this.world.buildTableCoralMesh()),
      fan: this.renderer.uploadMesh(this.world.buildSeaFanMesh()),
      anemone: this.renderer.uploadMesh(this.world.buildAnemoneMesh()),
      sponge: this.renderer.uploadMesh(this.world.buildBrainCoralMesh()),
      magenta_coral: this.renderer.uploadMesh(this.world.buildSeaFanMesh())
    };
    this.mantaGPU = this.renderer.uploadMesh(this.world.buildMantaMesh());
    this.schoolFishGPU = this.renderer.uploadMesh(this.world.buildSchoolFishMesh());
    this.pearlGPU = this.renderer.uploadMesh(this.world.buildPearlMesh());

    // Start Animation Loop
    requestAnimationFrame((t) => this.loop(t));
  }

  bindEvents() {
    window.addEventListener('resize', () => {
      this.renderer.resize();
    });

    // Input callbacks
    this.input.onToggleCamera = () => {
      const mode = this.physics.toggleCameraMode();
      this.showToast(`Camera: ${mode === CAMERA_MODES.FIRST_PERSON ? 'First-Person Snout Cam' : 'Third-Person Chase Cam'}`);
    };

    this.input.onToggleMute = () => {
      const muted = this.audio.toggleMute();
      this.showToast(muted ? 'Sound Muted' : 'Sound On');
      const soundBtn = document.getElementById('sound-toggle');
      if (soundBtn) soundBtn.textContent = muted ? '🔇' : '🔊';
    };

    this.input.onSelectSpecies = (index) => {
      const speciesList = Object.values(SPECIES);
      if (index >= 0 && index < speciesList.length) {
        this.selectSpecies(speciesList[index]);
      }
    };

    // User first interaction starts Audio Context
    const resumeAudio = () => {
      this.audio.resume();
      window.removeEventListener('click', resumeAudio);
      window.removeEventListener('keydown', resumeAudio);
      window.removeEventListener('touchstart', resumeAudio);
    };
    window.addEventListener('click', resumeAudio);
    window.addEventListener('keydown', resumeAudio);
    window.addEventListener('touchstart', resumeAudio);
  }

  selectSpecies(speciesId) {
    if (!SPECIES_DATA[speciesId]) return;
    this.activeSpeciesId = speciesId;
    this.physics.setSpecies(speciesId);
    this.saveProgress();

    const spec = SPECIES_DATA[speciesId];
    this.showToast(`Switched species to: ${spec.name}`);

    // Update UI HUD badge & selected fish tab
    const badge = document.getElementById('hud-species-name');
    if (badge) badge.textContent = spec.name;

    document.querySelectorAll('.fish-selector-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.species === speciesId);
    });
  }

  showToast(text, duration = 3000) {
    const toast = document.getElementById('notification-toast');
    if (!toast) return;
    toast.textContent = text;
    toast.classList.add('visible');
    clearTimeout(this.toastTimeout);
    this.toastTimeout = setTimeout(() => {
      toast.classList.remove('visible');
    }, duration);
  }

  loop(timestamp) {
    const now = performance.now();
    const dt = (now - this.lastFrameTime) * 0.001;
    this.lastFrameTime = now;
    this.time += dt;

    // FPS Meter
    this.frameCount++;
    if (now - this.fpsUpdateTime > 500) {
      this.fps = Math.round((this.frameCount * 1000) / (now - this.fpsUpdateTime));
      this.frameCount = 0;
      this.fpsUpdateTime = now;
      const fpsEl = document.getElementById('hud-fps');
      if (fpsEl) fpsEl.textContent = `${this.fps} FPS (${this.renderer.type.toUpperCase()})`;
    }

    // 1. Process Input
    const frameInput = this.input.getFrameInput();

    // 2. Physics & Player Fish Update
    this.physics.update(dt, frameInput, (x, z) => this.world.getSeabedHeight(x, z));

    // 3. World & Ecosystem Update
    const worldEvents = this.world.update(dt, this.physics.position);

    // Process Discoveries
    if (worldEvents.newDiscoveries.length > 0) {
      for (const lm of worldEvents.newDiscoveries) {
        this.discoveredLandmarks.add(lm.id);
        this.showToast(`✨ Landmark Discovered: ${lm.name}!`, 5000);
        this.audio.playDiscoveryJingle();
      }
      this.saveProgress();
    }

    // Process Collectible Pearls
    if (worldEvents.collectedPearls.length > 0) {
      for (const p of worldEvents.collectedPearls) {
        this.totalPearlsCollected++;
        this.showToast(`💎 Luminous Pearl Collected! (${this.totalPearlsCollected}/20)`, 3000);
        this.audio.playPearlCollect();
      }
      this.saveProgress();
    }

    // 4. Audio Simulation
    this.audio.update(dt, this.physics.currentSpeed, this.physics.position[1], this.physics.isBursting);

    // 5. Render Scene
    this.renderer.beginFrame(this.time, this.physics.camPos, this.physics.viewMatrix);

    // Render Terrain
    this.renderer.renderTerrain(this.terrainGPU);

    // Render Set Pieces (Sunken ship, whale fluke, arch)
    this.renderer.renderSetPieces(this.setPiecesGPU);

    // Render Kelp Forests
    if (this.kelpGPU) {
      this.renderer.renderKelpForest(this.kelpGPU, this.world.kelpInstances);
    }

    // Render Coral Gardens & Sponges
    if (this.coralMeshesGPU.staghorn) {
      this.renderer.renderCoralGardens(this.coralMeshesGPU, this.world.coralInstances);
    }

    // Render Schooling Fish Boids
    if (this.schoolFishGPU) {
      this.renderer.renderFishSchools(this.schoolFishGPU, this.world.fishSchools);
    }

    // Render Manta Rays
    if (this.mantaGPU) {
      this.renderer.renderMantas(this.mantaGPU, this.world.mantaRays);
    }

    // Render Collectible Luminous Pearls
    if (this.pearlGPU) {
      this.renderer.renderPearls(this.pearlGPU, this.world.collectibles, this.time);
    }

    // Render Player Fish (in chase cam or first person snout view)
    const activeMesh = this.speciesGPU[this.activeSpeciesId];
    if (activeMesh) {
      // In first person view, fish is slightly offset forward so snout/fins scull in lower view
      this.renderer.renderFish(
        activeMesh,
        this.physics.position,
        this.physics.orientation,
        this.physics.tailPhase,
        this.physics.tailAmplitude,
        this.physics.pectoralPhase,
        this.physics.spec.scale,
        true
      );
    }

    // Render Water Surface
    this.renderer.renderWaterSurface();

    // 6. Update HTML HUD Elements
    this.updateHUD();

    requestAnimationFrame((t) => this.loop(t));
  }

  updateHUD() {
    const depth = Math.max(0, -this.physics.position[1]).toFixed(1);
    const speedKnots = (this.physics.currentSpeed * 1.94384).toFixed(1);
    const staminaPct = Math.round(this.physics.stamina * 100);

    const depthEl = document.getElementById('hud-depth');
    if (depthEl) depthEl.textContent = `${depth}m`;

    const speedEl = document.getElementById('hud-speed');
    if (speedEl) speedEl.textContent = `${speedKnots} kts`;

    const staminaBar = document.getElementById('hud-stamina-bar');
    if (staminaBar) staminaBar.style.width = `${staminaPct}%`;

    const pearlsEl = document.getElementById('hud-pearls');
    if (pearlsEl) pearlsEl.textContent = `${this.totalPearlsCollected}/20`;

    const camBadge = document.getElementById('hud-cam-mode');
    if (camBadge) camBadge.textContent = this.physics.cameraMode === CAMERA_MODES.FIRST_PERSON ? 'FIRST PERSON' : 'CHASE CAM';
  }
}
