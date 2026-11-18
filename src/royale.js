// ============================================================================
// NYXEN: APEX PREDATOR — Underwater Battle Royale ("Fish PUBG")
// Match state, shrinking toxic Red Tide zone, 19 AI bot fishes, water jet
// ballistics, clam shell loot, player HP/shield, kill feed, and victory logic.
// ============================================================================

import { Vec3, rnd, rr, clamp, sin, cos, hypot, atan2, PI, TAU, min, max } from './math.js';
import { SPECIES, SPECIES_DATA } from './species.js';

export const MATCH_STATES = {
  EXPLORATION: 'exploration',
  COUNTDOWN: 'countdown',
  ACTIVE: 'active',
  VICTORY: 'victory',
  DEFEAT: 'defeat'
};

const BOT_NAMES = [
  'Apex_Mako', 'Reef_Striker', 'Titan_Turtle', 'Abyssal_Shadow',
  'Coral_Viper', 'Neon_Sting', 'Deep_Current', 'Tide_Hunter',
  'Sunken_Ghost', 'Velvet_Fin', 'Barra_Cuda', 'Hydro_Pulse',
  'Kelp_Stalker', 'Spike_Master', 'Galleon_Raider', 'Phantom_Ray',
  'Atoll_Terror', 'Swift_Dart', 'Bio_Spark'
];

export class BattleRoyaleManager {
  constructor(world, physics, audio, showToast) {
    this.world = world;
    this.physics = physics;
    this.audio = audio;
    this.showToast = showToast;

    // Match State
    this.state = MATCH_STATES.EXPLORATION;
    this.matchTimer = 0;
    this.countdown = 3;
    this.kills = 0;
    this.rank = 20;

    // Player Combat Stats
    this.playerHealth = 100;
    this.playerMaxHealth = 100;
    this.playerShield = 50;
    this.playerMaxShield = 100;
    this.isFiring = false;
    this.fireCooldown = 0;
    this.secondaryCooldown = 0;

    // The Red Tide (Shrinking Zone)
    this.zoneCenter = [10, 0]; // [x, z]
    this.targetZoneCenter = [10, 0];
    this.zoneRadius = 260.0;
    this.targetZoneRadius = 260.0;
    this.zoneShrinkSpeed = 0;
    this.zonePhase = 1;
    this.phaseTimer = 75.0; // Seconds until next contraction
    this.phaseDuration = 75.0;
    this.isShrinking = false;

    // Projectiles: { pos, vel, life, maxLife, fromPlayer, damage, color }
    this.projectiles = [];

    // AI Bots: array of 19 bot fishes
    this.bots = [];

    // Clam Shell Loot Crates
    this.lootCrates = [];

    // Kill feed events: { text, time }
    this.killFeed = [];

    // Hit marker feedback timer
    this.hitMarkerTimer = 0;
    this.damageVignetteTimer = 0;

    this.initLootCrates();
  }

  startMatch() {
    this.state = MATCH_STATES.COUNTDOWN;
    this.countdown = 3.5;
    this.matchTimer = 0;
    this.kills = 0;
    this.killFeed = [];
    this.projectiles = [];

    // Reset Player
    this.playerHealth = 100;
    this.playerShield = 25;
    this.physics.position = Vec3.create(0, -12, 0);
    this.physics.velocity = Vec3.create(0, -2, 0);

    // Initial Zone: 260m centered around Coral Eden
    this.zoneCenter = [0, 0];
    this.targetZoneCenter = [rr(-20, 20), rr(-20, 20)];
    this.zoneRadius = 260.0;
    this.targetZoneRadius = 260.0;
    this.zonePhase = 1;
    this.phaseTimer = 45.0;
    this.isShrinking = false;

    // Spawn 19 AI Opponents
    this.spawnBots();

    this.showToast('⚔️ APEX PREDATOR: DIVE STARTED! 20 FISH REMAINING', 4000);
  }

  spawnBots() {
    this.bots = [];
    const speciesPool = [
      SPECIES.CLOWNFISH, SPECIES.BLUE_TANG, SPECIES.YELLOW_TANG,
      SPECIES.LIONFISH, SPECIES.EMPEROR_ANGELFISH, SPECIES.LONGNOSE_BUTTERFLY,
      SPECIES.MOORISH_IDOL, SPECIES.ROYAL_GRAMMA, SPECIES.JELLYFISH, SPECIES.SEA_TURTLE
    ];

    for (let i = 0; i < 19; i++) {
      const angle = (i / 19) * TAU + rnd() * 0.4;
      const dist = rr(35, 140);
      const bx = this.zoneCenter[0] + cos(angle) * dist;
      const bz = this.zoneCenter[1] + sin(angle) * dist;
      const seabed = this.world.getSeabedHeight(bx, bz);
      const by = clamp(seabed + rr(5, 20), -45, -4);

      const specKey = speciesPool[i % speciesPool.length];
      const spec = SPECIES_DATA[specKey];

      this.bots.push({
        id: `bot_${i}`,
        name: BOT_NAMES[i] || `Reef_Bot_${i + 1}`,
        speciesId: specKey,
        spec,
        pos: Vec3.create(bx, by, bz),
        vel: Vec3.create(rr(-1, 1), rr(-0.5, 0.5), rr(-1, 1)),
        yaw: rnd() * TAU,
        pitch: 0,
        roll: 0,
        health: 100,
        shield: 25,
        alive: true,
        tailPhase: rnd() * TAU,
        shootCooldown: rr(1.2, 3.5),
        burstCooldown: rr(4.0, 8.0),
        isBursting: false,
        targetId: null
      });
    }
  }

  initLootCrates() {
    this.lootCrates = [];
    const crateLocations = [
      [58, 12, 'Sunken Galleon Cargo'],
      [-6, -5, 'Monolith Cache'],
      [-24, -18, 'Archway Chest'],
      [22, -26, 'Anemone Trove'],
      [42, -32, 'Hydrothermal Stash'],
      [-38, 28, 'Atoll Clam'],
      [12, 92, 'Grotto Relic'],
      [-2, -78, 'Cathedral Chest']
    ];

    for (let i = 0; i < crateLocations.length; i++) {
      const [cx, cz, name] = crateLocations[i];
      const cy = this.world.getSeabedHeight(cx, cz) + 1.2;
      this.lootCrates.push({
        id: `crate_${i}`,
        name,
        pos: [cx, cy, cz],
        opened: false,
        type: i % 2 === 0 ? 'shield' : 'medkit',
        scale: 1.6
      });
    }

    // Distribute 12 random clam shells across reef
    for (let j = 0; j < 12; j++) {
      const rx = rr(-110, 110);
      const rz = rr(-110, 110);
      const ry = this.world.getSeabedHeight(rx, rz) + 0.8;
      this.lootCrates.push({
        id: `clam_${j}`,
        name: 'Giant Clam Shell',
        pos: [rx, ry, rz],
        opened: false,
        type: j % 3 === 0 ? 'shield_mega' : 'krill_boost',
        scale: 1.2
      });
    }
  }

  update(dt, playerPos, playerForward, isFiringWaterJet, isFiringVenom, activeSuperpower = null) {
    if (this.state === MATCH_STATES.EXPLORATION) return;

    this.activeSuperpower = activeSuperpower;
    this.matchTimer += dt;
    this.fireCooldown = max(0, this.fireCooldown - dt);
    this.secondaryCooldown = max(0, this.secondaryCooldown - dt);
    this.hitMarkerTimer = max(0, this.hitMarkerTimer - dt);
    this.damageVignetteTimer = max(0, this.damageVignetteTimer - dt);

    // Active Sonic Shockwave pulse generator
    if (this.activeSuperpower && this.activeSuperpower.type && this.activeSuperpower.type.id === 'sonic_shockwave') {
      this.sonicTimer = (this.sonicTimer || 0) + dt;
      if (this.sonicTimer >= 3.5) {
        this.sonicTimer = 0;
        if (this.audio && this.audio.playSonicShockwave) this.audio.playSonicShockwave();
        for (const bot of this.bots) {
          if (!bot.alive) continue;
          const d = hypot(bot.pos[0] - playerPos[0], bot.pos[1] - playerPos[1], bot.pos[2] - playerPos[2]);
          if (d < 40.0) {
            bot.stunTimer = 3.0;
            this.damageBot(bot, 18, 'Bio-Sonic EMP');
          }
        }
        this.showToast('💥 Bio-Sonic EMP Stunned Nearby Fish!', 2000);
      }
    }

    // 1. Countdown Phase
    if (this.state === MATCH_STATES.COUNTDOWN) {
      this.countdown -= dt;
      if (this.countdown <= 0) {
        this.state = MATCH_STATES.ACTIVE;
        this.showToast('🚨 THE RED TIDE IS ADVANCING! SURVIVE AT ALL COSTS!', 4000);
      }
      return;
    }

    if (this.state !== MATCH_STATES.ACTIVE) return;

    // 2. Zone Contraction (The Red Tide)
    this.updateRedTide(dt, playerPos);

    // 3. Player Combat & Weapons
    this.handlePlayerInput(playerPos, playerForward, isFiringWaterJet, isFiringVenom);

    // 4. Update Projectiles
    this.updateProjectiles(dt, playerPos);

    // 5. Update AI Bot Fish
    this.updateBots(dt, playerPos);

    // 6. Loot Pickup Checks
    this.checkLootPickups(playerPos);

    // 7. Check Alive Count & Victory / Defeat Conditions
    this.checkMatchOutcome();
  }

  updateRedTide(dt, playerPos) {
    this.phaseTimer -= dt;

    if (this.phaseTimer <= 0) {
      if (!this.isShrinking) {
        // Start shrinking to next phase
        this.isShrinking = true;
        this.zonePhase++;
        const shrinkTargets = [200.0, 130.0, 70.0, 30.0, 10.0, 0.0];
        const nextRadius = shrinkTargets[min(this.zonePhase - 1, shrinkTargets.length - 1)];
        this.targetZoneRadius = nextRadius;

        // Drift center toward next landmark
        const shiftX = rr(-25, 25);
        const shiftZ = rr(-25, 25);
        this.targetZoneCenter = [this.zoneCenter[0] + shiftX, this.zoneCenter[1] + shiftZ];
        this.phaseTimer = 35.0; // Time to shrink
        this.showToast(`⚠️ WARNING: The Red Tide is closing in! (Phase ${this.zonePhase})`, 4000);
      } else {
        // Reached target, pause before next shrink
        this.isShrinking = false;
        this.phaseTimer = 30.0; // Grace period
      }
    }

    if (this.isShrinking) {
      const shrinkSpeed = (this.zoneRadius - this.targetZoneRadius) / max(1.0, this.phaseTimer);
      this.zoneRadius = max(this.targetZoneRadius, this.zoneRadius - shrinkSpeed * dt);

      // Lerp center
      this.zoneCenter[0] += (this.targetZoneCenter[0] - this.zoneCenter[0]) * dt * 0.1;
      this.zoneCenter[1] += (this.targetZoneCenter[1] - this.zoneCenter[1]) * dt * 0.1;
    }

    // Check if player is outside safe zone
    const dPlayer = hypot(playerPos[0] - this.zoneCenter[0], playerPos[2] - this.zoneCenter[1]);
    if (dPlayer > this.zoneRadius) {
      const toxicDmg = (1.5 + this.zonePhase * 1.5) * dt;
      this.damagePlayer(toxicDmg, 'The Red Tide');
      this.damageVignetteTimer = 0.4;
    }
  }

  handlePlayerInput(playerPos, playerForward, isFiringWaterJet, isFiringVenom) {
    const isVortex = this.activeSuperpower && this.activeSuperpower.type && this.activeSuperpower.type.id === 'vortex_torpedo';
    const isCloaked = this.activeSuperpower && this.activeSuperpower.type && this.activeSuperpower.type.id === 'phantom_cloak';

    // Left-click Water Jet
    if (isFiringWaterJet && this.fireCooldown <= 0) {
      this.fireCooldown = isVortex ? 0.32 : 0.22; // ~4.5 shots per sec

      const spawnPos = [
        playerPos[0] + playerForward[0] * 0.9,
        playerPos[1] + playerForward[1] * 0.9 + 0.05,
        playerPos[2] + playerForward[2] * 0.9
      ];

      const spd = isVortex ? 54.0 : 42.0;
      const vel = [
        playerForward[0] * spd + (rnd() - 0.5) * 0.8,
        playerForward[1] * spd + (rnd() - 0.5) * 0.8,
        playerForward[2] * spd + (rnd() - 0.5) * 0.8
      ];

      const damage = isVortex ? 65 : (isCloaked ? 55 : 24);
      const radius = isVortex ? 1.25 : 0.55;
      const color = isVortex ? [0.15, 0.65, 1.0, 1.0] : (isCloaked ? [0.85, 0.35, 1.0, 0.95] : [0.35, 0.85, 1.0, 0.9]);

      this.projectiles.push({
        pos: spawnPos,
        vel,
        life: isVortex ? 2.0 : 1.5,
        maxLife: isVortex ? 2.0 : 1.5,
        fromPlayer: true,
        damage,
        radius,
        color
      });

      if (isVortex && this.audio && this.audio.playVortexBlast) {
        this.audio.playVortexBlast();
      } else if (this.audio && this.audio.playBubbleBurst) {
        this.audio.playBubbleBurst();
      }
    }

    // Right-click / Secondary: Venom Needle Spread (5 spines)
    if (isFiringVenom && this.secondaryCooldown <= 0) {
      this.secondaryCooldown = 1.6;

      for (let s = -2; s <= 2; s++) {
        const spreadAngle = s * 0.12;
        const cosA = Math.cos(spreadAngle), sinA = Math.sin(spreadAngle);
        const vx = (playerForward[0] * cosA - playerForward[2] * sinA) * 36.0;
        const vz = (playerForward[0] * sinA + playerForward[2] * cosA) * 36.0;
        const vy = playerForward[1] * 36.0 + (rnd() - 0.5) * 0.5;

        this.projectiles.push({
          pos: [playerPos[0], playerPos[1] + 0.1, playerPos[2]],
          vel: [vx, vy, vz],
          life: 1.1,
          maxLife: 1.1,
          fromPlayer: true,
          damage: 14,
          radius: 0.4,
          color: [0.85, 0.25, 1.0, 0.95] // Purple venom
        });
      }
      this.showToast('🟣 Venom Spine Barrage Released!', 1500);
    }
  }

  updateProjectiles(dt, playerPos) {
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const p = this.projectiles[i];
      p.life -= dt;

      // Integrate position
      p.pos[0] += p.vel[0] * dt;
      p.pos[1] += p.vel[1] * dt;
      p.pos[2] += p.vel[2] * dt;

      if (p.life <= 0) {
        this.projectiles.splice(i, 1);
        continue;
      }

      // 1. Player Projectile hitting Bots
      if (p.fromPlayer) {
        for (const bot of this.bots) {
          if (!bot.alive) continue;
          const dist = hypot(p.pos[0] - bot.pos[0], p.pos[1] - bot.pos[1], p.pos[2] - bot.pos[2]);
          if (dist < p.radius + 0.8) {
            this.damageBot(bot, p.damage, 'Player');
            this.hitMarkerTimer = 0.25;
            this.projectiles.splice(i, 1);
            break;
          }
        }
      } else {
        // 2. Bot Projectile hitting Player
        const distToPlayer = hypot(p.pos[0] - playerPos[0], p.pos[1] - playerPos[1], p.pos[2] - playerPos[2]);
        if (distToPlayer < p.radius + 0.75) {
          if (this.activeSuperpower && this.activeSuperpower.type && this.activeSuperpower.type.id === 'titan_aegis') {
            // Reflect projectile back with speed & damage bonus
            p.fromPlayer = true;
            p.vel[0] = -p.vel[0] * 1.35;
            p.vel[1] = -p.vel[1] * 1.35;
            p.vel[2] = -p.vel[2] * 1.35;
            p.color = [0.25, 0.95, 0.75, 1.0];
            p.damage = Math.round(p.damage * 1.5);
            p.life = 1.5;
            if (this.audio && this.audio.playShieldDeflect) {
              this.audio.playShieldDeflect();
            }
            this.showToast('🛡️ Titan Aegis Deflected Projectile!', 1200);
          } else {
            this.damagePlayer(p.damage, p.shooterName || 'Opponent');
            this.projectiles.splice(i, 1);
          }
        }
      }
    }
  }

  updateBots(dt, playerPos) {
    const hasLightning = this.activeSuperpower && this.activeSuperpower.type && this.activeSuperpower.type.id === 'lightning_surge';
    const isCloaked = this.activeSuperpower && this.activeSuperpower.type && this.activeSuperpower.type.id === 'phantom_cloak';

    for (const bot of this.bots) {
      if (!bot.alive) continue;

      if (bot.stunTimer && bot.stunTimer > 0) {
        bot.stunTimer -= dt;
        continue; // Paralyzed by Bio-Sonic EMP!
      }

      // Lightning Surge ramming collision
      if (hasLightning) {
        const dRam = hypot(bot.pos[0] - playerPos[0], bot.pos[1] - playerPos[1], bot.pos[2] - playerPos[2]);
        if (dRam < 2.5) {
          this.damageBot(bot, 140 * dt, 'Lightning Surge');
          if (this.audio && this.audio.playShieldDeflect && rnd() < 0.2) {
            this.audio.playShieldDeflect();
          }
        }
      }

      bot.tailPhase += dt * (bot.isBursting ? 12.0 : 5.0);
      bot.shootCooldown -= dt;
      bot.burstCooldown -= dt;

      // Distance to zone center
      const dToZone = hypot(bot.pos[0] - this.zoneCenter[0], bot.pos[2] - this.zoneCenter[1]);

      // Desired steer vector
      let steerX = 0, steerY = 0, steerZ = 0;

      // Rule A: Safe Zone Urgency (if outside or nearing edge, head inward!)
      if (dToZone > this.zoneRadius * 0.75) {
        const toCenterX = (this.zoneCenter[0] - bot.pos[0]) / (dToZone || 1);
        const toCenterZ = (this.zoneCenter[1] - bot.pos[2]) / (dToZone || 1);
        steerX += toCenterX * 2.2;
        steerZ += toCenterZ * 2.2;
      }

      // Red Tide Damage to Bots
      if (dToZone > this.zoneRadius) {
        bot.health -= (1.5 + this.zonePhase * 1.5) * dt;
        if (bot.health <= 0) {
          this.eliminateBot(bot, 'The Red Tide');
          continue;
        }
      }

      // Rule B: Target Acquisition & Combat (Detect Player or nearest Bot)
      const distToPlayer = hypot(playerPos[0] - bot.pos[0], playerPos[1] - bot.pos[1], playerPos[2] - bot.pos[2]);

      // Phantom Cloak grants stealth: bot only detects if player is very close (within 8m)
      const detectionRadius = isCloaked ? 8.0 : 40.0;
      if (distToPlayer < detectionRadius) {
        // Engage player!
        const toPlayerX = (playerPos[0] - bot.pos[0]) / distToPlayer;
        const toPlayerY = (playerPos[1] - bot.pos[1]) / distToPlayer;
        const toPlayerZ = (playerPos[2] - bot.pos[2]) / distToPlayer;

        // Circle or flank
        if (distToPlayer > 12.0) {
          steerX += toPlayerX * 1.2;
          steerY += toPlayerY * 1.0;
          steerZ += toPlayerZ * 1.2;
        } else {
          // Strafe
          steerX += -toPlayerZ * 0.8;
          steerZ += toPlayerX * 0.8;
        }

        // Fire water jet at player
        if (bot.shootCooldown <= 0 && distToPlayer < 35.0) {
          bot.shootCooldown = rr(1.4, 2.8);
          const pSpeed = 36.0;
          this.projectiles.push({
            pos: [bot.pos[0] + toPlayerX * 0.8, bot.pos[1] + toPlayerY * 0.8, bot.pos[2] + toPlayerZ * 0.8],
            vel: [toPlayerX * pSpeed, toPlayerY * pSpeed, toPlayerZ * pSpeed],
            life: 1.6,
            maxLife: 1.6,
            fromPlayer: false,
            shooterName: bot.name,
            damage: 18,
            radius: 0.5,
            color: [0.95, 0.45, 0.25, 0.9] // Orange hostile jet
          });
        }
      } else {
        // Roam and wander peacefully
        steerX += cos(bot.yaw) * 0.6;
        steerZ += sin(bot.yaw) * 0.6;
      }

      // Burst escape if low health
      if (bot.health < 40 && bot.burstCooldown <= 0) {
        bot.isBursting = true;
        bot.burstCooldown = 6.0;
        setTimeout(() => { bot.isBursting = false; }, 1800);
      }

      // Seabed avoidance
      const seabed = this.world.getSeabedHeight(bot.pos[0], bot.pos[2]);
      if (bot.pos[1] < seabed + 3.0) {
        steerY += 2.0;
      } else if (bot.pos[1] > -2.0) {
        steerY -= 1.5;
      }

      // Integrate velocity & orientation
      const speed = bot.isBursting ? bot.spec.burstSpeed * 0.9 : bot.spec.speed * 0.85;
      bot.vel[0] += steerX * dt * 3.5;
      bot.vel[1] += steerY * dt * 2.5;
      bot.vel[2] += steerZ * dt * 3.5;

      const vLen = hypot(bot.vel[0], bot.vel[1], bot.vel[2]) || 1;
      bot.vel[0] = (bot.vel[0] / vLen) * speed;
      bot.vel[1] = (bot.vel[1] / vLen) * speed;
      bot.vel[2] = (bot.vel[2] / vLen) * speed;

      bot.pos[0] += bot.vel[0] * dt;
      bot.pos[1] += bot.vel[1] * dt;
      bot.pos[2] += bot.vel[2] * dt;

      // Update Euler angles
      bot.yaw = atan2(bot.vel[0], bot.vel[2]);
      bot.pitch = clamp(-bot.vel[1] / speed, -0.7, 0.7);
    }
  }

  damagePlayer(dmg, source) {
    if (this.state !== MATCH_STATES.ACTIVE) return;

    // Titan Aegis Superpower provides 100% invulnerability to all damage
    if (this.activeSuperpower && this.activeSuperpower.type && this.activeSuperpower.type.id === 'titan_aegis') {
      return;
    }

    if (this.playerShield > 0) {
      const shieldDmg = min(this.playerShield, dmg);
      this.playerShield -= shieldDmg;
      dmg -= shieldDmg;
    }

    if (dmg > 0) {
      this.playerHealth -= dmg;
      this.damageVignetteTimer = 0.5;
    }

    if (this.playerHealth <= 0) {
      this.playerHealth = 0;
      this.state = MATCH_STATES.DEFEAT;
      this.addKillFeedEntry(source, 'You', '☠️ eliminated');
      this.showToast(`💀 DEFEATED by ${source}! Ranked #${this.getAliveCount() + 1}`, 6000);
    }
  }

  damageBot(bot, dmg, attacker) {
    if (bot.shield > 0) {
      const shieldDmg = min(bot.shield, dmg);
      bot.shield -= shieldDmg;
      dmg -= shieldDmg;
    }

    if (dmg > 0) {
      bot.health -= dmg;
    }

    if (bot.health <= 0) {
      this.eliminateBot(bot, attacker);
    }
  }

  eliminateBot(bot, attacker) {
    bot.alive = false;
    bot.health = 0;

    if (attacker === 'Player') {
      this.kills++;
      this.showToast(`🎯 ELIMINATED: ${bot.name}! (${this.kills} Kills)`, 3000);
      if (this.audio && this.audio.playPearlCollect) {
        this.audio.playPearlCollect();
      }
    }

    this.addKillFeedEntry(attacker, bot.name, '☠️ eliminated');
  }

  addKillFeedEntry(killer, victim, action = '☠️ eliminated') {
    this.killFeed.unshift({
      killer,
      victim,
      action,
      time: performance.now()
    });
    if (this.killFeed.length > 5) {
      this.killFeed.pop();
    }
  }

  checkLootPickups(playerPos) {
    for (const crate of this.lootCrates) {
      if (crate.opened) continue;
      const dist = hypot(playerPos[0] - crate.pos[0], playerPos[1] - crate.pos[1], playerPos[2] - crate.pos[2]);

      if (dist < 3.2) {
        crate.opened = true;
        if (crate.type === 'shield' || crate.type === 'shield_mega') {
          const boost = crate.type === 'shield_mega' ? 50 : 25;
          this.playerShield = min(this.playerMaxShield, this.playerShield + boost);
          this.showToast(`🛡️ +${boost} Carapace Armor Plating Equipped!`, 2500);
        } else if (crate.type === 'medkit') {
          this.playerHealth = this.playerMaxHealth;
          this.showToast('🌿 Symbiotic Anemone Medkit — HP 100% Restored!', 2500);
        } else {
          this.playerShield = min(this.playerMaxShield, this.playerShield + 20);
          this.showToast('💎 Luminous Sea Gem — Energy & Defense Boosted!', 2500);
        }
        if (this.audio && this.audio.playDiscoveryJingle) {
          this.audio.playDiscoveryJingle();
        }
      }
    }
  }

  checkMatchOutcome() {
    const aliveCount = this.getAliveCount();
    this.rank = aliveCount;

    if (aliveCount === 1 && this.playerHealth > 0) {
      this.state = MATCH_STATES.VICTORY;
      this.showToast('👑 VICTORY ROYALE! YOU ARE THE APEX PREDATOR OF THE REEF!', 8000);
      if (this.audio && this.audio.playDiscoveryJingle) {
        this.audio.playDiscoveryJingle();
      }
    }
  }

  getAliveCount() {
    let count = this.playerHealth > 0 ? 1 : 0;
    for (const bot of this.bots) {
      if (bot.alive) count++;
    }
    return count;
  }
}
