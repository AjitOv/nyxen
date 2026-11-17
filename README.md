# NYXEN — Underwater Exploration & Fish Character Experience

**NYXEN** is a browser-based, first-person underwater exploration game where players become real, biologically recognizable fish species and explore a living, procedurally generated ocean world.

Inspired by and building upon technical references from **[Abyssal Garden](https://github.com/Noniv/abyssal-garden)** (MIT License - Noniv), NYXEN transforms procedural ocean rendering into a playable biological character simulation.

---

## Key Features

### 1. Real Biological Fish Characters
Play as 8 distinct tropical reef species, each crafted with species-specific 3D anatomical geometry, authentic fin structures, distinctive coloration, and unique swimming physics:
1. **Ocellaris Clownfish (*Amphiprion ocellaris*)**: Vibrant orange body with 3 black-outlined white bars, rounded paddle fins, and sea anemone symbiosis.
2. **Blue Tang (*Paracanthurus hepatus*)**: Deep royal blue disc-oval body, bold black palette pattern, and bright canary-yellow triangular caudal fin.
3. **Yellow Tang (*Zebrasoma flavescens*)**: Brilliant lemon-yellow disc body, high dorsal/anal sail fins, and defensive white caudal scalpel spine.
4. **Red Lionfish (*Pterois volitans*)**: Dramatic predatory silhouette with 13 venomous elongated dorsal needle spines, massive fan-like pectoral wings, and maroon/ivory zebra stripes.
5. **Emperor Angelfish (*Pomacanthus imperator*)**: Horizontal electric blue and radiant yellow stripes, midnight-blue bandit mask with cyan neon border, and golden caudal fin.
6. **Yellow Longnose Butterflyfish (*Forcipiger flavissimus*)**: Elongated forceps beak for probing coral crevices, silvery chest, and false eye-spot (ocellus).
7. **Moorish Idol (*Zanclus cornutus*)**: Tall sickle-shaped dorsal filament trailing overhead, contrasting black, white, and yellow vertical bands.
8. **Royal Gramma (*Gramma loreto*)**: Two-tone split of deep royal violet-magenta on the anterior and canary yellow on the posterior.

### 2. First-Person Fish Experience & Locomotion
- **Dual Perspective System**:
  - **First-Person Eye / Snout Cam**: Eye-level camera locked to the biological eye coordinates of each species. See the fish's snout cutting through the water and pectoral fins fluttering in the lower peripheral view.
  - **Third-Person Dynamic Chase Cam**: Silky-smooth spring-damper camera tracking behind and above the fish to observe its undulating spine, fin waving, and banking.
- **Hydrodynamic Physics**:
  - Inertia, quadratic water resistance (drag), neutral buoyancy with vertical fin balancing.
  - Spine undulation traveling wave equation: $y_{\text{wave}}(z, t) = A \cdot \left(\frac{-z}{L}\right)^{1.4} \cdot \sin(\omega t - k z)$, with frequency and amplitude scaling dynamically with speed.
  - Biological banking roll into yaw turns.
  - High-speed stamina sprint burst with hydrophone whoosh audio feedback.
  - Soft collision repulsion from ocean floor and cavern ceilings.

### 3. Procedural Coral Eden Environment
- **Rolling Seabed & Valleys**: Procedural 3D noise terrain ranging from shallow sunlit atolls ($-5\text{m}$) to abyssal basins ($-45\text{m}$).
- **The Sunken Galleon ("The Siren's Rest")**: 17th-century wooden shipwreck with curved keel, ribs, fallen masts, and a hull breach you can swim through.
- **The Whale Fluke Monolith**: Ancient colossal stone whale tail carving emerging from the sand.
- **The Luminescent Purple Grotto**: Deep cavern system with glowing magenta ground cover and barrel sponges.
- **The Kelp Forest Cathedral**: Towering *Macrocystis* giant kelp swaying with current-dependent vertex deformation.
- **The Grand Coral Archway & Anemone Gardens**: Natural limestone arches, staghorn branching corals, brain coral domes, table corals, sea fans, and waving anemone tentacles.
- **Atmospheric Lighting**:
  - Beer-Lambert spectral absorption depth fog (red wavelengths absorbed at 5m, green at 20m, blue penetrating past 50m).
  - Dynamic optical caustics dancing on the seabed, rocks, and fish scales.
  - Volumetric surface sunbeams and undulating water surface reflections.
- **Living Ecosystem**:
  - Autonomous schools of reef fish (Boids flocking simulation) that scatter when approached.
  - Manta rays cruising in sweeping thermal circles with flapping pectoral wings.
  - Suspended marine snow particles and rising hydrothermal vent bubbles.

### 4. 100% Procedural Web Audio Soundscape
- Live synthesis via the Web Audio API with zero sample file downloads:
  - Deep oceanic bed rumble (filtered brown noise).
  - Dynamic swimming velocity rush (bandpass filter and gain tracking fish velocity).
  - Surface wash modulated by depth.
  - Natural bubble pop bursts and hydrothermal vent sizzling.
  - Distant whale vocalizations and pentatonic reef chimes.
  - Discovery jingles for landmarks and collectible pearls.

### 5. Objectives & Exploration
- **8 Landmark Discoveries**: Explore Coral Eden to discover and register all 8 points of interest in your Marine Logbook.
- **20 Luminous Pearls**: Hidden throughout caverns, shipwreck breaches, and kelp groves.
- **Species Encyclopedia**: Interactive modal with biological classifications, Latin names, natural habitats, swimming styles, and stats.
- **Automatic Save**: Saves your discoveries, collected pearls, quality settings, and selected species in `localStorage`.

---

## Technical Architecture & Performance

NYXEN features a shared rendering pipeline:
- **Preferred WebGPU acceleration** on supporting browsers.
- **High-performance WebGL2 fallback** with GLSL 3.0 shaders for universal compatibility across desktop and mobile devices.
- **Adaptive Resolution & Dynamic Quality**: Automatically balances pixel ratio, geometry density, and particle counts to maintain 60 FPS.

### Production Network Transfer Audit
Measured via Node `zlib` compression analyzer (`node build.js`):

| File | Raw Size | Gzip Size | Brotli Size |
|---|---|---|---|
| `index.html` | 22.4 KB | 5.5 KB | 4.6 KB |
| `src/math.js` | 14.1 KB | 4.0 KB | 3.4 KB |
| `src/species.js` | 35.4 KB | 7.9 KB | 6.7 KB |
| `src/fish_physics.js` | 9.8 KB | 3.0 KB | 2.6 KB |
| `src/world.js` | 27.7 KB | 8.0 KB | 6.9 KB |
| `src/renderer.js` | 25.8 KB | 6.6 KB | 5.7 KB |
| `src/audio.js` | 9.2 KB | 2.4 KB | 2.1 KB |
| `src/controls.js` | 8.0 KB | 1.7 KB | 1.5 KB |
| `src/game.js` | 11.8 KB | 3.5 KB | 3.1 KB |
| **TOTAL BASE EXPERIENCE** | **164.2 KB (0.16 MB)** | **42.6 KB (0.042 MB)** | **36.6 KB (0.036 MB)** |

> **Target Budget**: Below 2.0 MB  
> **Actual Transfer**: **0.042 MB (Gzip)** — **97.9% below budget limit!**  
> Zero external texture images, 3D model files, or audio recordings are required; everything is generated procedurally in real time.

---

## Controls

### Desktop
- **Click Canvas**: Lock mouse pointer for smooth analog pitch and yaw steering.
- **W / S**: Swim forward / reverse drag.
- **A / D**: Strafe left / right with biological banking roll.
- **Space / E**: Ascend towards the surface.
- **Q**: Descend into the depths.
- **Shift**: Burst swim (consumes stamina).
- **V**: Toggle First-Person Eye Cam vs Third-Person Chase Cam.
- **1 – 8**: Instant fish species quick-switch.
- **Tab / J**: Open Marine Logbook & Species Encyclopedia.
- **M**: Toggle audio on / off.

### Mobile Touch
- **Left Screen Touch & Drag**: Virtual joystick for forward/backward/strafe swimming.
- **Right Screen Touch & Drag**: Virtual joystick for pitch and yaw steering.
- **BURST Button**: Sprint boost.
- **CAM Button**: View mode toggle.
- **LOG Button**: Open encyclopedia and discovery log.

---

## Getting Started

To run locally:

```bash
# Using Python 3's built-in HTTP server:
python3 -m http.server 8000

# Or using Node:
npm start
```

Then open `http://localhost:8000` in any modern web browser (Chrome, Edge, Safari, Firefox).

---

## Attribution & License

- **License**: MIT License ([LICENSE](LICENSE))
- **Technical Reference & Procedural Attribution**: Procedural noise algorithms, caustics mathematics, and lighting formulas adapted and evolved from **[Abyssal Garden](https://github.com/Noniv/abyssal-garden)** by Noniv.
