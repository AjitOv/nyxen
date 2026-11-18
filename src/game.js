// ============================================================================
// NYXEN — Main Game Orchestrator
// Coordinates Physics, Procedural Coral Eden World, Multi-Species Switching,
// Shared WebGPU/WebGL2 Rendering, Audio, Discovery Objectives, and Persistent Save.
// ============================================================================

import { SharedRenderer } from './renderer.js';
import { FishPhysics, CAMERA_MODES } from './fish_physics.js';
import { InfiniteOceanWorld, CORE_LANDMARKS } from './world.js';
import { SPECIES, SPECIES_DATA, buildFishMesh } from './species.js';
import { MarineAudio } from './audio.js';
import { InputManager } from './controls.js';
import { BattleRoyaleManager, MATCH_STATES } from './royale.js';
import { clamp, floor, atan2, PI } from './math.js';

export class NyxenGame {
  constructor(canvas) {
    this.canvas = canvas;
    this.quality = this.loadQualitySetting();

    // Core Systems
    this.renderer = new SharedRenderer(canvas, { quality: this.quality });
    this.physics = new FishPhysics(SPECIES.CLOWNFISH);
    this.world = new InfiniteOceanWorld(this.quality);
    this.audio = new MarineAudio();
    this.input = new InputManager(canvas);

    // Battle Royale Engine ("Apex Predator / Fish PUBG")
    this.royale = new BattleRoyaleManager(this.world, this.physics, this.audio, (t, d) => this.showToast(t, d));

    // GPU Meshes Cache for all Species
    this.speciesGPU = {};
    this.setPiecesGPU = [];
    this.coralMeshesGPU = {};
    this.kelpGPU = null;
    this.mantaGPU = null;
    this.schoolFishGPU = null;
    this.pearlGPU = null;
    this.superpowerGPU = null;

    // Superpowers State Machine
    this.activeSuperpower = { type: null, timer: 0.0, maxDuration: 0.0 };

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

    // Photo Mode & Transitions
    this.isPhotoMode = false;
    this.switchFadeAlpha = 0.0;

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

    // 1. Upload Set Pieces
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
    this.superpowerGPU = this.renderer.uploadMesh(this.world.buildSuperpowerRelicMesh());

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

    // Photo Mode Toggle (P key)
    this.input.onPhotoMode = () => {
      this.isPhotoMode = !this.isPhotoMode;
      const hud = document.querySelector('.hud-layer');
      const mobile = document.querySelector('.mobile-controls');
      const photoLabel = document.getElementById('photo-mode-label');

      if (this.isPhotoMode) {
        if (hud) hud.style.opacity = '0';
        if (mobile) mobile.style.opacity = '0';
        if (photoLabel) photoLabel.style.display = 'block';
        this.showToast('📷 Photo Mode Enabled — Press P to capture snapshot', 2500);

        // Capture snapshot after HUD hides
        setTimeout(() => {
          try {
            const dataUrl = this.canvas.toDataURL('image/png');
            const link = document.createElement('a');
            link.download = `nyxen-snapshot-${Date.now()}.png`;
            link.href = dataUrl;
            link.click();
            this.showToast('📸 Photo saved to downloads!', 3000);
          } catch (e) {
            console.warn('Snapshot capture note:', e);
          }
        }, 120);
      } else {
        if (hud) hud.style.opacity = '1';
        if (mobile) mobile.style.opacity = '1';
        if (photoLabel) photoLabel.style.display = 'none';
        this.showToast('Photo Mode Exited', 1500);
      }
    };

    // Battle Royale Mode Toggle (R key or button)
    this.input.onToggleRoyale = () => {
      if (this.royale.state === MATCH_STATES.EXPLORATION) {
        this.royale.startMatch();
      } else {
        this.royale.state = MATCH_STATES.EXPLORATION;
        this.showToast('Returned to Free Ocean Exploration', 2500);
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
    this.switchFadeAlpha = 0.85; // Trigger smooth oceanic blue transition
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
    this.physics.hasLightning = (this.activeSuperpower && this.activeSuperpower.type && this.activeSuperpower.type.id === 'lightning_surge');
    this.physics.update(dt, frameInput, (x, z) => this.world.getSeabedHeight(x, z));

    // 2.2 Superpower Active State & Countdown
    if (this.activeSuperpower.timer > 0) {
      this.activeSuperpower.timer -= dt;
      if (this.activeSuperpower.timer <= 0) {
        this.activeSuperpower.type = null;
        this.activeSuperpower.timer = 0;
        this.showToast('Superpower duration expired', 2000);
      }
    }

    // 2.5 Battle Royale Engine Update ("Apex Predator / Fish PUBG")
    this.royale.update(dt, this.physics.position, this.physics.forward, frameInput.fire, frameInput.fireSecondary, this.activeSuperpower);

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

    // Process Collectible Superpowers
    if (worldEvents.collectedSuperpowers && worldEvents.collectedSuperpowers.length > 0) {
      for (const relic of worldEvents.collectedSuperpowers) {
        this.activeSuperpower.type = relic.type;
        this.activeSuperpower.timer = relic.type.duration || 25.0;
        this.activeSuperpower.maxDuration = relic.type.duration || 25.0;
        this.showToast(`⚡ ${relic.type.name.toUpperCase()} ACTIVATED! (${Math.ceil(this.activeSuperpower.timer)}s)`, 4000);
        if (this.audio && this.audio.playPowerupPickup) {
          this.audio.playPowerupPickup(relic.type);
        }
      }
    }

    // 4. Audio Simulation
    this.audio.update(dt, this.physics.currentSpeed, this.physics.position[1], this.physics.isBursting);

    // Free GPU resources for any chunks evicted this frame (Memory leak prevention)
    if (this.world.evictedChunks && this.world.evictedChunks.length > 0) {
      for (const chunk of this.world.evictedChunks) {
        this.renderer.freeChunkGPU(chunk);
      }
    }

    // Dynamic Day/Night Cycle Sun Tracking
    const sunDir = this.world.getSunDirection();
    this.renderer.updateSunDirection(sunDir);

    // 5. Render Scene
    this.renderer.beginFrame(this.time, this.physics.camPos, this.physics.viewMatrix);

    // Render Infinite Streaming Terrain Chunks
    this.renderer.renderTerrainChunks(this.world.activeChunks);

    // Render Set Pieces (Sunken ship, whale fluke, arch)
    this.renderer.renderSetPieces(this.setPiecesGPU);

    // Gather active kelp, corals, and bubble vents from active chunks
    const allKelp = [];
    const allCorals = [];
    const allVents = [];
    for (const chunk of this.world.activeChunks.values()) {
      if (chunk.kelpInstances) allKelp.push(...chunk.kelpInstances);
      if (chunk.coralInstances) allCorals.push(...chunk.coralInstances);
      if (chunk.bubbleVents) allVents.push(...chunk.bubbleVents);
    }

    // Render Kelp Forests
    if (this.kelpGPU && allKelp.length > 0) {
      this.renderer.renderKelpForest(this.kelpGPU, allKelp);
    }

    // Render Coral Gardens & Sponges
    if (this.coralMeshesGPU.staghorn && allCorals.length > 0) {
      this.renderer.renderCoralGardens(this.coralMeshesGPU, allCorals);
    }

    // Render Schooling Fish Boids
    if (this.schoolFishGPU) {
      this.renderer.renderFishSchools(this.schoolFishGPU, this.world.fishSchools);
    }

    // Render Manta Rays
    if (this.mantaGPU) {
      this.renderer.renderMantas(this.mantaGPU, this.world.mantaRays);
    }

    // Render Hydrothermal Chimney Bubble Vents
    if (allVents.length > 0) {
      this.renderer.renderBubbleVents(allVents);
    }

    // Render Collectible Luminous Pearls
    if (this.pearlGPU) {
      this.renderer.renderPearls(this.pearlGPU, this.world.collectibles, this.time);
    }

    // Render Procedural Superpower Relics Across Ocean & Landmarks
    if (this.superpowerGPU && this.world.superpowerRelics) {
      this.renderer.renderSuperpowerRelics(this.world.superpowerRelics, this.superpowerGPU, this.time);
    }

    // Render Player Fish (in chase cam or first person snout view)
    const activeMesh = this.speciesGPU[this.activeSpeciesId];
    if (activeMesh) {
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

    // Render Active Superpower 3D Aura / Forcefield Shield
    if (this.activeSuperpower && this.activeSuperpower.type && this.pearlGPU) {
      this.renderer.renderSuperpowerAura(
        this.physics.position,
        this.activeSuperpower,
        this.pearlGPU,
        this.time,
        this.physics.spec.scale
      );
    }

    // Render Infinite Water Surface
    this.renderer.renderWaterSurface();

    // Render Battle Royale Entities (Red Tide Storm Wall, Bot Fishes, Projectiles, Clam Crates)
    if (this.royale.state !== MATCH_STATES.EXPLORATION) {
      // 1. The Red Tide Wall
      this.renderer.renderStormWall(this.royale.zoneCenter, this.royale.zoneRadius, this.time);

      // 2. 19 AI Opponent Fish
      for (const bot of this.royale.bots) {
        if (!bot.alive) continue;
        const botMesh = this.speciesGPU[bot.speciesId] || this.speciesGPU[SPECIES.CLOWNFISH];
        if (botMesh) {
          const sy = Math.sin(bot.yaw * 0.5);
          const cy = Math.cos(bot.yaw * 0.5);
          this.renderer.renderFish(
            botMesh,
            bot.pos,
            [0, sy, 0, cy],
            bot.tailPhase,
            bot.isBursting ? 0.35 : 0.22,
            0.0,
            bot.spec.scale,
            false
          );
        }
      }

      // 3. Combat Water Jets & Venom Needles
      this.renderer.renderProjectiles(this.royale.projectiles);

      // 4. Clam Shell Loot Crates
      if (this.pearlGPU) {
        this.renderer.renderLootCrates(this.royale.lootCrates, this.pearlGPU, this.time);
      }
    }

    // Render Crystalline Marine Snow Particles
    if (this.world.marineSnow) {
      this.renderer.renderParticles(this.world.marineSnow);
    }

    // Render Smooth Species-Switch Oceanic Blue Fade Transition
    if (this.switchFadeAlpha > 0.001) {
      this.switchFadeAlpha = Math.max(0.0, this.switchFadeAlpha - dt * 2.8);
      this.renderer.renderFade(this.switchFadeAlpha);
    }

    // 6. Update HTML HUD Elements
    this.updateHUD();

    requestAnimationFrame((t) => this.loop(t));
  }

  updateHUD() {
    const posX = Math.round(this.physics.position[0]);
    const posZ = Math.round(this.physics.position[2]);
    const depth = Math.max(0, -this.physics.position[1]).toFixed(1);
    const speedKnots = (this.physics.currentSpeed * 1.94384).toFixed(1);
    const staminaPct = Math.round(this.physics.stamina * 100);

    // Current Biome
    const biome = this.world.getBiomeAt(this.physics.position[0], this.physics.position[2]);

    // Compass calculation
    const headingDeg = Math.round((atan2(this.physics.forward[0], this.physics.forward[2]) * 180 / PI + 360) % 360);
    const compassDirs = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
    const compassStr = compassDirs[Math.floor(((headingDeg + 22.5) % 360) / 45)];

    const coordsEl = document.getElementById('hud-coords');
    if (coordsEl) coordsEl.textContent = `X: ${posX > 0 ? '+' : ''}${posX}m, Z: ${posZ > 0 ? '+' : ''}${posZ}m [${compassStr} ${headingDeg}°]`;

    const biomeEl = document.getElementById('hud-biome-name');
    if (biomeEl) biomeEl.textContent = biome.name;

    const depthEl = document.getElementById('hud-depth');
    if (depthEl) depthEl.textContent = `${depth}m`;

    const speedEl = document.getElementById('hud-speed');
    if (speedEl) speedEl.textContent = `${speedKnots} kts`;

    const staminaBar = document.getElementById('hud-stamina-bar');
    if (staminaBar) {
      staminaBar.style.width = `${staminaPct}%`;
      staminaBar.classList.toggle('stamina-warn', staminaPct < 50 && staminaPct >= 20);
      staminaBar.classList.toggle('stamina-crit', staminaPct < 20);
    }

    const timeEl = document.getElementById('hud-time');
    if (timeEl) {
      const isDay = this.world.timeOfDay > 0.18 && this.world.timeOfDay < 0.82;
      timeEl.textContent = isDay ? '☀️ Day' : '🌙 Night';
      timeEl.style.color = isDay ? '#fbbf24' : '#818cf8';
    }

    const pearlsEl = document.getElementById('hud-pearls');
    if (pearlsEl) pearlsEl.textContent = `${this.totalPearlsCollected}`;

    const camBadge = document.getElementById('hud-cam-mode');
    if (camBadge) camBadge.textContent = this.physics.cameraMode === CAMERA_MODES.FIRST_PERSON ? 'FIRST PERSON' : 'CHASE CAM';

    // -------------------------------------------------------------
    // Battle Royale HUD Updates
    // -------------------------------------------------------------
    const healthBar = document.getElementById('hud-health-bar');
    if (healthBar) {
      const hpPct = clamp(this.royale.playerHealth / this.royale.playerMaxHealth * 100, 0, 100);
      healthBar.style.width = `${hpPct}%`;
      const hpVal = document.getElementById('hud-health-val');
      if (hpVal) hpVal.textContent = `${Math.ceil(this.royale.playerHealth)} HP`;
    }

    const shieldBar = document.getElementById('hud-shield-bar');
    if (shieldBar) {
      const shieldPct = clamp(this.royale.playerShield / this.royale.playerMaxShield * 100, 0, 100);
      shieldBar.style.width = `${shieldPct}%`;
      const shieldVal = document.getElementById('hud-shield-val');
      if (shieldVal) shieldVal.textContent = `${Math.ceil(this.royale.playerShield)} ARMOR`;
    }

    const royaleBox = document.getElementById('hud-royale-box');
    if (royaleBox) {
      const inRoyale = this.royale.state !== MATCH_STATES.EXPLORATION;
      royaleBox.style.display = inRoyale ? 'flex' : 'none';

      if (inRoyale) {
        const aliveEl = document.getElementById('hud-royale-alive');
        if (aliveEl) aliveEl.textContent = `${this.royale.getAliveCount()}`;

        const killsEl = document.getElementById('hud-royale-kills');
        if (killsEl) killsEl.textContent = `${this.royale.kills}`;

        const zoneEl = document.getElementById('hud-royale-zone');
        if (zoneEl) {
          const secs = Math.ceil(this.royale.phaseTimer);
          const mins = Math.floor(secs / 60);
          const remSecs = (secs % 60).toString().padStart(2, '0');
          zoneEl.textContent = `${mins}:${remSecs} (${Math.round(this.royale.zoneRadius)}m)`;
        }
      }
    }

    // Damage Vignette Flash
    const dmgVig = document.getElementById('damage-vignette');
    if (dmgVig) {
      dmgVig.style.opacity = this.royale.damageVignetteTimer > 0 ? (this.royale.damageVignetteTimer * 1.6).toFixed(2) : '0';
    }

    // Hit Marker Flash
    const hitMarker = document.getElementById('hit-marker');
    if (hitMarker) {
      hitMarker.style.opacity = this.royale.hitMarkerTimer > 0 ? '1' : '0';
    }

    // Kill Feed Rendering
    const killFeedEl = document.getElementById('kill-feed-container');
    if (killFeedEl && this.royale.killFeed.length > 0) {
      killFeedEl.innerHTML = this.royale.killFeed.map(kf => `
        <div class="kill-feed-item">
          <span class="kf-killer">${kf.killer}</span>
          <span class="kf-action">${kf.action}</span>
          <span class="kf-victim">${kf.victim}</span>
        </div>
      `).join('');
    }

    // Superpower Active HUD Card
    const spCard = document.getElementById('hud-superpower-card');
    if (spCard) {
      if (this.activeSuperpower && this.activeSuperpower.type && this.activeSuperpower.timer > 0) {
        spCard.style.display = 'flex';
        const spIcon = document.getElementById('hud-sp-icon');
        const spName = document.getElementById('hud-sp-name');
        const spTimer = document.getElementById('hud-sp-timer');
        const spFill = document.getElementById('hud-sp-fill');
        if (spIcon) spIcon.textContent = this.activeSuperpower.type.icon;
        if (spName) spName.textContent = this.activeSuperpower.type.name;
        if (spTimer) spTimer.textContent = `${Math.ceil(this.activeSuperpower.timer)}s`;
        if (spFill) {
          const pct = clamp((this.activeSuperpower.timer / this.activeSuperpower.maxDuration) * 100, 0, 100);
          spFill.style.width = `${pct}%`;
        }
      } else {
        spCard.style.display = 'none';
      }
    }
  }
}
