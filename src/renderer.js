// ============================================================================
// NYXEN — High-Performance Shared WebGPU / WebGL2 Rendering Engine
// Procedural underwater lighting, Beer-Lambert spectral absorption fog,
// dynamic caustics, volumetric sun rays, vertex-swaying kelp, and animated fish models.
// ============================================================================

import { Mat4, Vec3, sin, cos, clamp, min, max } from './math.js';

export class SharedRenderer {
  constructor(canvas, options = {}) {
    this.canvas = canvas;
    this.quality = options.quality ?? 0; // 0: High, 1: Medium, 2: Low
    this.type = 'none'; // 'webgpu' or 'webgl2'
    this.gl = null;
    this.gpuDevice = null;

    // Viewport & Adaptive Resolution
    this.pixelRatio = window.devicePixelRatio || 1;
    this.renderScale = this.quality === 2 ? 0.75 : 1.0;
    this.width = canvas.clientWidth || 1280;
    this.height = canvas.clientHeight || 720;

    // Camera Matrices
    this.projMatrix = Mat4.create();
    this.viewMatrix = Mat4.create();
    this.viewProjMatrix = Mat4.create();
    this.camPos = [0, -18, 0];

    // Sun & Optical Parameters (Beer-Lambert spectral decay)
    this.sunDir = [0.45, 0.85, 0.28];
    // Normalize sun dir
    const sLen = Math.hypot(...this.sunDir) || 1;
    this.sunDir = this.sunDir.map(v => v / sLen);

    // Spectral absorption coefficients (Red, Green, Blue)
    // Red absorbs in <8m, Green in <25m, Blue penetrates deep (>60m)
    this.sigma = [0.092, 0.026, 0.009];
    this.kd = [0.090, 0.025, 0.008];
    this.waterColor = [0.03, 0.48, 0.98]; // Super Real Crystalline Oceanic Blue
    this.sunColor = [1.6, 1.5, 1.35];

    this.time = 0;
    this.isReady = false;
  }

  async init() {
    // 1. Check for WebGPU hardware acceleration capability on device
    let hasWebGPU = false;
    if (typeof navigator !== 'undefined' && navigator.gpu) {
      try {
        const adapter = await navigator.gpu.requestAdapter({ powerPreference: 'high-performance' });
        if (adapter) {
          hasWebGPU = true;
          this.gpuDevice = adapter;
          console.log(`NYXEN: WebGPU hardware accelerator detected (${adapter.info?.architecture || 'High Performance'}).`);
        }
      } catch (e) {
        console.warn('WebGPU query note:', e);
      }
    }

    // 2. Initialize High-Performance WebGL2 Pipeline (Universally supported with GLSL 3.0)
    const gl = this.canvas.getContext('webgl2', {
      powerPreference: 'high-performance',
      antialias: this.quality < 2,
      depth: true,
      stencil: false,
      alpha: false,
      preserveDrawingBuffer: false
    }) || this.canvas.getContext('experimental-webgl2');

    if (!gl) {
      throw new Error('WebGL2 is not supported by your browser or graphics driver. Please use a modern browser with hardware acceleration enabled.');
    }

    this.gl = gl;
    this.type = hasWebGPU ? 'webgpu+webgl2' : 'webgl2';
    console.log(`NYXEN: Renderer initialized in ${this.type.toUpperCase()} mode.`);
    this.initWebGL2Pipeline();

    this.resize();
    this.isReady = true;
  }

  resize() {
    const dpr = Math.min(this.pixelRatio, this.quality === 2 ? 1.0 : 1.5) * this.renderScale;
    const w = Math.floor((this.canvas.clientWidth || window.innerWidth) * dpr);
    const h = Math.floor((this.canvas.clientHeight || window.innerHeight) * dpr);

    if (this.canvas.width !== w || this.canvas.height !== h) {
      this.canvas.width = w;
      this.canvas.height = h;
      this.width = w;
      this.height = h;
      if (this.gl) this.gl.viewport(0, 0, w, h);
    }

    // Update projection matrix (Aquatic FOV 82 deg)
    const aspect = w / (h || 1);
    Mat4.perspective(this.projMatrix, (82.0 * Math.PI) / 180.0, aspect, 0.15, 320.0);
  }

  // ----------------------------------------------------------------
  // WebGL2 GLSL 3.0 Pipeline Initialization
  // ----------------------------------------------------------------
  initWebGL2Pipeline() {
    const gl = this.gl;

    // Enable Depth testing & backface culling
    gl.enable(gl.DEPTH_TEST);
    gl.depthFunc(gl.LEQUAL);
    gl.enable(gl.CULL_FACE);
    gl.cullFace(gl.BACK);

    // Compile Shaders
    this.programSolid = this.createGLProgram(VS_SOLID, FS_SOLID);
    this.programKelp = this.createGLProgram(VS_KELP, FS_SOLID);
    this.programFish = this.createGLProgram(VS_FISH, FS_FISH);
    this.programWaterSurface = this.createGLProgram(VS_WATER_SURFACE, FS_WATER_SURFACE);
    this.programParticles = this.createGLProgram(VS_PARTICLES, FS_PARTICLES);

    // Uniform locations caches
    this.uSolid = this.getUniformLocations(this.programSolid, [
      'uViewProj', 'uCamPos', 'uSunDir', 'uSunCol', 'uWaterCol', 'uTime', 'uModel', 'uColorTint'
    ]);
    this.uKelp = this.getUniformLocations(this.programKelp, [
      'uViewProj', 'uCamPos', 'uSunDir', 'uSunCol', 'uWaterCol', 'uTime', 'uModel'
    ]);
    this.uFish = this.getUniformLocations(this.programFish, [
      'uViewProj', 'uCamPos', 'uSunDir', 'uSunCol', 'uWaterCol', 'uTime',
      'uModel', 'uTailPhase', 'uTailAmp', 'uPectoralPhase', 'uIsPlayer'
    ]);
    this.uWaterSurface = this.getUniformLocations(this.programWaterSurface, [
      'uViewProj', 'uCamPos', 'uSunDir', 'uSunCol', 'uWaterCol', 'uTime', 'uModel'
    ]);
    this.uParticles = this.getUniformLocations(this.programParticles, [
      'uViewProj', 'uCamPos', 'uTime', 'uWaterCol'
    ]);

    // Build procedural water surface plane mesh
    this.surfaceMesh = this.buildSurfacePlane();
  }

  createGLProgram(vsSource, fsSource) {
    const gl = this.gl;
    const vs = gl.createShader(gl.VERTEX_SHADER);
    gl.shaderSource(vs, vsSource);
    gl.compileShader(vs);
    if (!gl.getShaderParameter(vs, gl.COMPILE_STATUS)) {
      throw new Error('Vertex shader compile error: ' + gl.getShaderInfoLog(vs));
    }

    const fs = gl.createShader(gl.FRAGMENT_SHADER);
    gl.shaderSource(fs, fsSource);
    gl.compileShader(fs);
    if (!gl.getShaderParameter(fs, gl.COMPILE_STATUS)) {
      throw new Error('Fragment shader compile error: ' + gl.getShaderInfoLog(fs));
    }

    const prog = gl.createProgram();
    gl.attachShader(prog, vs);
    gl.attachShader(prog, fs);
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
      throw new Error('Program link error: ' + gl.getProgramInfoLog(prog));
    }
    return prog;
  }

  getUniformLocations(program, names) {
    const gl = this.gl;
    const out = {};
    for (const name of names) {
      out[name] = gl.getUniformLocation(program, name);
    }
    return out;
  }

  // Upload mesh to GPU VAO & VBOs
  uploadMesh(meshData) {
    const gl = this.gl;
    const vao = gl.createVertexArray();
    gl.bindVertexArray(vao);

    // Positions (Location 0)
    const posBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, posBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, meshData.positions, gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 0, 0);

    // Normals (Location 1)
    const normBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, normBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, meshData.normals, gl.STATIC_DRAW);
    gl.enableVertexAttribArray(1);
    gl.vertexAttribPointer(1, 3, gl.FLOAT, false, 0, 0);

    // UVs (Location 2)
    const uvBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, uvBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, meshData.uvs, gl.STATIC_DRAW);
    gl.enableVertexAttribArray(2);
    gl.vertexAttribPointer(2, 2, gl.FLOAT, false, 0, 0);

    // Colors (Location 3)
    const colBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, colBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, meshData.colors, gl.STATIC_DRAW);
    gl.enableVertexAttribArray(3);
    gl.vertexAttribPointer(3, 4, gl.FLOAT, false, 0, 0);

    // Indices
    const indexBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, meshData.indices, gl.STATIC_DRAW);

    gl.bindVertexArray(null);

    return {
      vao,
      indexCount: meshData.indexCount,
      indexType: meshData.indices instanceof Uint32Array ? gl.UNSIGNED_INT : gl.UNSIGNED_SHORT
    };
  }

  buildSurfacePlane() {
    const gl = this.gl;
    const vao = gl.createVertexArray();
    gl.bindVertexArray(vao);

    // Water surface plane at y = -0.5
    const pos = new Float32Array([
      -250, -0.5, -250,
       250, -0.5, -250,
       250, -0.5,  250,
      -250, -0.5,  250
    ]);
    const idx = new Uint16Array([0, 1, 2, 0, 2, 3]);

    const pb = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, pb);
    gl.bufferData(gl.ARRAY_BUFFER, pos, gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 0, 0);

    const ib = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ib);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, idx, gl.STATIC_DRAW);

    gl.bindVertexArray(null);
    return { vao, indexCount: 6, indexType: gl.UNSIGNED_SHORT };
  }

  // ----------------------------------------------------------------
  // Render Frame
  // ----------------------------------------------------------------
  beginFrame(time, camPos, viewMatrix) {
    this.time = time;
    this.camPos = camPos;
    Mat4.multiply(this.viewProjMatrix, this.projMatrix, viewMatrix);

    const gl = this.gl;
    // Super Real Blue Ocean clear color
    // Near surface: Vibrant tropical azure blue (0.015, 0.40, 0.98)
    // At depth (45m): Deep majestic cobalt/indigo abyss (0.004, 0.14, 0.52)
    const depthFactor = clamp((-camPos[1]) / 45.0, 0.0, 1.0);
    const bgR = 0.015 * (1.0 - depthFactor * 0.7);
    const bgG = 0.36 * (1.0 - depthFactor * 0.72) + 0.04;
    const bgB = 0.92 * (1.0 - depthFactor * 0.50) + 0.06;

    gl.clearColor(bgR, bgG, bgB, 1.0);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
  }

  renderTerrain(terrainGPU) {
    if (!terrainGPU) return;
    const gl = this.gl;
    gl.useProgram(this.programSolid);

    gl.uniformMatrix4fv(this.uSolid.uViewProj, false, this.viewProjMatrix);
    gl.uniform3fv(this.uSolid.uCamPos, this.camPos);
    gl.uniform3fv(this.uSolid.uSunDir, this.sunDir);
    gl.uniform3fv(this.uSolid.uSunCol, this.sunColor);
    gl.uniform3fv(this.uSolid.uWaterCol, this.waterColor);
    gl.uniform1f(this.uSolid.uTime, this.time);
    gl.uniform3fv(this.uSolid.uColorTint, [1, 1, 1]);

    const m = Mat4.create();
    gl.uniformMatrix4fv(this.uSolid.uModel, false, m);

    gl.bindVertexArray(terrainGPU.vao);
    gl.drawElements(gl.TRIANGLES, terrainGPU.indexCount, terrainGPU.indexType, 0);
    gl.bindVertexArray(null);
  }

  // Infinite Streaming Chunks Rendering
  renderTerrainChunks(chunksMap) {
    const gl = this.gl;
    gl.useProgram(this.programSolid);

    gl.uniformMatrix4fv(this.uSolid.uViewProj, false, this.viewProjMatrix);
    gl.uniform3fv(this.uSolid.uCamPos, this.camPos);
    gl.uniform3fv(this.uSolid.uSunDir, this.sunDir);
    gl.uniform3fv(this.uSolid.uSunCol, this.sunColor);
    gl.uniform3fv(this.uSolid.uWaterCol, this.waterColor);
    gl.uniform1f(this.uSolid.uTime, this.time);
    gl.uniform3fv(this.uSolid.uColorTint, [1, 1, 1]);

    const m = Mat4.create();
    gl.uniformMatrix4fv(this.uSolid.uModel, false, m);

    for (const chunk of chunksMap.values()) {
      if (!chunk.gpu) {
        chunk.gpu = this.uploadMesh(chunk.meshData);
      }
      gl.bindVertexArray(chunk.gpu.vao);
      gl.drawElements(gl.TRIANGLES, chunk.gpu.indexCount, chunk.gpu.indexType, 0);
    }
    gl.bindVertexArray(null);
  }

  renderSetPieces(setPiecesGPU) {
    const gl = this.gl;
    gl.useProgram(this.programSolid);
    gl.uniform3fv(this.uSolid.uColorTint, [1, 1, 1]);

    for (const piece of setPiecesGPU) {
      const m = Mat4.create();
      // Translate
      m[12] = piece.pos[0];
      m[13] = piece.pos[1];
      m[14] = piece.pos[2];
      // Scale
      m[0] = piece.scale; m[5] = piece.scale; m[10] = piece.scale;

      gl.uniformMatrix4fv(this.uSolid.uModel, false, m);

      gl.bindVertexArray(piece.gpu.vao);
      gl.drawElements(gl.TRIANGLES, piece.gpu.indexCount, piece.gpu.indexType, 0);
    }
    gl.bindVertexArray(null);
  }

  renderFish(fishGPU, pos, orientationQuat, tailPhase, tailAmp, pectoralPhase, scale = 1.0, isPlayer = false) {
    const gl = this.gl;
    gl.useProgram(this.programFish);

    gl.uniformMatrix4fv(this.uFish.uViewProj, false, this.viewProjMatrix);
    gl.uniform3fv(this.uFish.uCamPos, this.camPos);
    gl.uniform3fv(this.uFish.uSunDir, this.sunDir);
    gl.uniform3fv(this.uFish.uSunCol, this.sunColor);
    gl.uniform3fv(this.uFish.uWaterCol, this.waterColor);
    gl.uniform1f(this.uFish.uTime, this.time);

    gl.uniform1f(this.uFish.uTailPhase, tailPhase);
    gl.uniform1f(this.uFish.uTailAmp, tailAmp);
    gl.uniform1f(this.uFish.uPectoralPhase, pectoralPhase);
    gl.uniform1i(this.uFish.uIsPlayer, isPlayer ? 1 : 0);

    // Build model matrix from position and quaternion
    const m = Mat4.create();
    const qx = orientationQuat[0], qy = orientationQuat[1], qz = orientationQuat[2], qw = orientationQuat[3];
    const x2 = qx + qx, y2 = qy + qy, z2 = qz + qz;
    const xx = qx * x2, xy = qx * y2, xz = qx * z2;
    const yy = qy * y2, yz = qy * z2, zz = qz * z2;
    const wx = qw * x2, wy = qw * y2, wz = qw * z2;

    m[0] = (1 - (yy + zz)) * scale;
    m[1] = (xy + wz) * scale;
    m[2] = (xz - wy) * scale;
    m[3] = 0;

    m[4] = (xy - wz) * scale;
    m[5] = (1 - (xx + zz)) * scale;
    m[6] = (yz + wx) * scale;
    m[7] = 0;

    m[8] = (xz + wy) * scale;
    m[9] = (yz - wx) * scale;
    m[10] = (1 - (xx + yy)) * scale;
    m[11] = 0;

    m[12] = pos[0];
    m[13] = pos[1];
    m[14] = pos[2];
    m[15] = 1;

    gl.uniformMatrix4fv(this.uFish.uModel, false, m);

    gl.bindVertexArray(fishGPU.vao);
    gl.drawElements(gl.TRIANGLES, fishGPU.indexCount, fishGPU.indexType, 0);
    gl.bindVertexArray(null);
  }

  renderWaterSurface() {
    const gl = this.gl;
    gl.useProgram(this.programWaterSurface);

    gl.uniformMatrix4fv(this.uWaterSurface.uViewProj, false, this.viewProjMatrix);
    gl.uniform3fv(this.uWaterSurface.uCamPos, this.camPos);
    gl.uniform3fv(this.uWaterSurface.uSunDir, this.sunDir);
    gl.uniform3fv(this.uWaterSurface.uSunCol, this.sunColor);
    gl.uniform3fv(this.uWaterSurface.uWaterCol, this.waterColor);
    gl.uniform1f(this.uWaterSurface.uTime, this.time);

    // Follow camera position in X and Z so ocean surface is infinite
    const m = Mat4.create();
    m[12] = this.camPos[0];
    m[14] = this.camPos[2];
    gl.uniformMatrix4fv(this.uWaterSurface.uModel, false, m);

    // Disable culling for water surface so it is visible from below & above
    gl.disable(gl.CULL_FACE);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

    gl.bindVertexArray(this.surfaceMesh.vao);
    gl.drawElements(gl.TRIANGLES, this.surfaceMesh.indexCount, this.surfaceMesh.indexType, 0);
    gl.bindVertexArray(null);

    gl.disable(gl.BLEND);
    gl.enable(gl.CULL_FACE);
  }

  // FIX #1: Kelp Position Bug — build proper per-instance model matrix
  renderKelpForest(kelpGPU, kelpInstances) {
    const gl = this.gl;
    gl.useProgram(this.programKelp);

    // Shared uniforms hoisted before loop
    gl.uniformMatrix4fv(this.uKelp.uViewProj, false, this.viewProjMatrix);
    gl.uniform3fv(this.uKelp.uCamPos, this.camPos);
    gl.uniform3fv(this.uKelp.uSunDir, this.sunDir);
    gl.uniform3fv(this.uKelp.uSunCol, this.sunColor);
    gl.uniform3fv(this.uKelp.uWaterCol, this.waterColor);
    gl.uniform1f(this.uKelp.uTime, this.time);

    gl.bindVertexArray(kelpGPU.vao);
    // Draw kelp instances with distance culling
    for (const inst of kelpInstances) {
      const dx = inst.x - this.camPos[0];
      const dz = inst.z - this.camPos[2];
      if (dx * dx + dz * dz > 180.0 * 180.0) continue; // Frustum/distance cull

      // Build translation model matrix per instance
      const m = Mat4.create();
      m[12] = inst.x;
      m[13] = inst.y !== undefined ? inst.y : 0;
      m[14] = inst.z;
      gl.uniformMatrix4fv(this.uKelp.uModel, false, m);

      gl.drawElements(gl.TRIANGLES, kelpGPU.indexCount, kelpGPU.indexType, 0);
    }
    gl.bindVertexArray(null);
  }

  // FIX #8 (Hoist shared uniforms) + FIX #9 (frustum culling) + FIX #11 (per-coral tint)
  renderCoralGardens(coralMeshesGPU, coralInstances) {
    const gl = this.gl;
    gl.useProgram(this.programSolid);

    // Hoist shared uniforms before the loop
    gl.uniformMatrix4fv(this.uSolid.uViewProj, false, this.viewProjMatrix);
    gl.uniform3fv(this.uSolid.uCamPos, this.camPos);
    gl.uniform3fv(this.uSolid.uSunDir, this.sunDir);
    gl.uniform3fv(this.uSolid.uSunCol, this.sunColor);
    gl.uniform3fv(this.uSolid.uWaterCol, this.waterColor);
    gl.uniform1f(this.uSolid.uTime, this.time);

    // Per-coral tint lookup by type
    const coralTints = {
      'staghorn':  [1.0, 0.65, 0.4],
      'brain':     [0.8, 0.5,  0.3],
      'fan':       [0.9, 0.3,  0.7],
      'tube':      [0.4, 0.8,  1.0],
      'mushroom':  [0.6, 1.0,  0.5],
    };

    const m = Mat4.create();
    for (const inst of coralInstances) {
      const dx = inst.x - this.camPos[0];
      const dz = inst.z - this.camPos[2];
      if (dx * dx + dz * dz > 140.0 * 140.0) continue; // Distance cull

      // Frustum culling
      if (!this.isSphereVisible(inst.x, inst.y, inst.z, 4.0)) continue;

      const meshGPU = coralMeshesGPU[inst.type] || coralMeshesGPU['staghorn'];
      if (!meshGPU) continue;

      // Model matrix: translate & scale & yaw (only uModel per instance)
      const cy = Math.cos(inst.yaw), sy = Math.sin(inst.yaw);
      const s = inst.scale;

      m[0] = cy * s;  m[1] = 0;      m[2] = -sy * s; m[3] = 0;
      m[4] = 0;       m[5] = s;      m[6] = 0;       m[7] = 0;
      m[8] = sy * s;  m[9] = 0;      m[10] = cy * s; m[11] = 0;
      m[12] = inst.x; m[13] = inst.y; m[14] = inst.z; m[15] = 1;

      gl.uniformMatrix4fv(this.uSolid.uModel, false, m);

      // Per-coral tint
      const tint = coralTints[inst.type] || [1, 1, 1];
      gl.uniform3fv(this.uSolid.uColorTint, tint);

      gl.bindVertexArray(meshGPU.vao);
      gl.drawElements(gl.TRIANGLES, meshGPU.indexCount, meshGPU.indexType, 0);
    }
    gl.bindVertexArray(null);
    // Reset tint
    gl.uniform3fv(this.uSolid.uColorTint, [1, 1, 1]);
  }

  // FIX #2: Boid rotation bug — proper Y-axis rotation from velocity yaw
  // FIX #9: Frustum culling per boid
  renderFishSchools(schoolMeshGPU, schools) {
    const gl = this.gl;
    gl.useProgram(this.programSolid);

    gl.uniformMatrix4fv(this.uSolid.uViewProj, false, this.viewProjMatrix);
    gl.uniform3fv(this.uSolid.uCamPos, this.camPos);
    gl.uniform3fv(this.uSolid.uSunDir, this.sunDir);
    gl.uniform3fv(this.uSolid.uSunCol, this.sunColor);
    gl.uniform3fv(this.uSolid.uWaterCol, this.waterColor);
    gl.uniform1f(this.uSolid.uTime, this.time);
    gl.uniform3fv(this.uSolid.uColorTint, [1, 1, 1]);

    const m = Mat4.create();
    gl.bindVertexArray(schoolMeshGPU.vao);

    for (const school of schools) {
      for (const boid of school.boids) {
        const dx = boid.pos[0] - this.camPos[0];
        const dz = boid.pos[2] - this.camPos[2];
        if (dx * dx + dz * dz > 120.0 * 120.0) continue;

        // Frustum culling
        if (!this.isSphereVisible(boid.pos[0], boid.pos[1], boid.pos[2], 2.0)) continue;

        // Extract yaw from velocity and build Y-axis rotation matrix (column-major)
        const yaw = Math.atan2(boid.vel[0], boid.vel[2]);
        const cy = Math.cos(yaw), sy = Math.sin(yaw);
        const s = 0.8;

        // Column-major Y-rotation * scale:
        // col0: [cy*s, 0,    sy*s, 0]
        // col1: [0,    s,    0,    0]
        // col2: [-sy*s,0,    cy*s, 0]
        // col3: [tx,   ty,   tz,   1]
        m[0]  =  cy * s; m[1]  = 0;   m[2]  =  sy * s; m[3]  = 0;
        m[4]  =  0;      m[5]  = s;   m[6]  =  0;      m[7]  = 0;
        m[8]  = -sy * s; m[9]  = 0;   m[10] =  cy * s; m[11] = 0;
        m[12] = boid.pos[0];
        m[13] = boid.pos[1];
        m[14] = boid.pos[2];
        m[15] = 1;

        gl.uniformMatrix4fv(this.uSolid.uModel, false, m);
        gl.drawElements(gl.TRIANGLES, schoolMeshGPU.indexCount, schoolMeshGPU.indexType, 0);
      }
    }
    gl.bindVertexArray(null);
  }

  renderMantas(mantaMeshGPU, mantas) {
    const gl = this.gl;
    gl.useProgram(this.programSolid);
    gl.uniform3fv(this.uSolid.uColorTint, [1, 1, 1]);

    const m = Mat4.create();
    gl.bindVertexArray(mantaMeshGPU.vao);

    for (const manta of mantas) {
      if (!manta.pos) continue;
      const s = manta.scale;
      m[0] = s; m[5] = s; m[10] = s;
      m[12] = manta.pos[0];
      m[13] = manta.pos[1];
      m[14] = manta.pos[2];

      gl.uniformMatrix4fv(this.uSolid.uModel, false, m);
      gl.drawElements(gl.TRIANGLES, mantaMeshGPU.indexCount, mantaMeshGPU.indexType, 0);
    }
    gl.bindVertexArray(null);
  }

  renderPearls(pearlMeshGPU, collectibles, time) {
    const gl = this.gl;
    gl.useProgram(this.programSolid);
    gl.uniform3fv(this.uSolid.uColorTint, [1, 1, 1]);

    const m = Mat4.create();
    gl.bindVertexArray(pearlMeshGPU.vao);

    for (const pearl of collectibles) {
      if (pearl.collected) continue;
      const floatY = pearl.pos[1] + Math.sin(time * 2.5 + pearl.pulsePhase) * 0.25;
      const scale = 0.8 + 0.15 * Math.sin(time * 4.0 + pearl.pulsePhase);

      m[0] = scale; m[5] = scale; m[10] = scale;
      m[12] = pearl.pos[0];
      m[13] = floatY;
      m[14] = pearl.pos[2];

      gl.uniformMatrix4fv(this.uSolid.uModel, false, m);
      gl.drawElements(gl.TRIANGLES, pearlMeshGPU.indexCount, pearlMeshGPU.indexType, 0);
    }
    gl.bindVertexArray(null);
  }

  // ----------------------------------------------------------------
  // NEW METHODS
  // ----------------------------------------------------------------

  // FIX #3: renderParticles — renders a Float32Array of [x,y,z,size] particles
  renderParticles(snowData) {
    const gl = this.gl;
    gl.useProgram(this.programParticles);

    // Lazily create snow VBO
    if (!this.snowVBO) {
      this.snowVBO = gl.createBuffer();
    }

    // Upload particle data
    gl.bindBuffer(gl.ARRAY_BUFFER, this.snowVBO);
    gl.bufferData(gl.ARRAY_BUFFER, snowData, gl.DYNAMIC_DRAW);

    // Set vertex attrib: location 0 = vec4(x, y, z, size)
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 4, gl.FLOAT, false, 0, 0);

    // Uniforms
    gl.uniformMatrix4fv(this.uParticles.uViewProj, false, this.viewProjMatrix);
    gl.uniform3fv(this.uParticles.uCamPos, this.camPos);
    gl.uniform1f(this.uParticles.uTime, this.time);
    gl.uniform3fv(this.uParticles.uWaterCol, this.waterColor);

    // Additive blend
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE);

    const count = (snowData.length / 4) | 0;
    gl.drawArrays(gl.POINTS, 0, count);

    gl.disableVertexAttribArray(0);
    gl.disable(gl.BLEND);
    gl.bindBuffer(gl.ARRAY_BUFFER, null);
  }

  // FIX #4: renderBubbleVents — emit upward-drifting particles from vent positions
  renderBubbleVents(vents) {
    const totalParticles = vents.length * 8;
    if (totalParticles === 0) return;

    if (!this.ventParticleData || this.ventParticleData.length !== totalParticles * 4) {
      this.ventParticleData = new Float32Array(totalParticles * 4);
    }

    let idx = 0;
    for (const vent of vents) {
      for (let i = 0; i < 8; i++) {
        const y = vent.y + ((this.time * 0.4 + i * 0.3) % 4.0);
        this.ventParticleData[idx++] = vent.x;
        this.ventParticleData[idx++] = y;
        this.ventParticleData[idx++] = vent.z;
        this.ventParticleData[idx++] = 1.5; // size
      }
    }

    this.renderParticles(this.ventParticleData);
  }

  // FIX #5: freeChunkGPU — delete GPU resources for a chunk
  freeChunkGPU(chunk) {
    if (chunk.gpu) {
      this.gl.deleteVertexArray(chunk.gpu.vao);
      chunk.gpu = null;
    }
  }

  // FIX #6: updateSunDirection — normalize and store sun direction
  updateSunDirection(dir) {
    const len = Math.hypot(dir[0], dir[1], dir[2]) || 1;
    this.sunDir = [dir[0] / len, dir[1] / len, dir[2] / len];
  }

  // FIX #7: renderFade — full-screen deep-blue overlay, lazily compiled shader
  renderFade(alpha) {
    const gl = this.gl;

    // Lazily compile fade program
    if (!this.programFade) {
      const vs = `#version 300 es
layout(location = 0) in vec2 aPos;
void main() { gl_Position = vec4(aPos, 0.0, 1.0); }
`;
      const fs = `#version 300 es
precision mediump float;
uniform float uAlpha;
out vec4 fragColor;
void main() { fragColor = vec4(0.01, 0.12, 0.35, uAlpha); }
`;
      this.programFade = this.createGLProgram(vs, fs);
      this.uFade = this.getUniformLocations(this.programFade, ['uAlpha']);

      // Build NDC quad VAO
      const vao = gl.createVertexArray();
      gl.bindVertexArray(vao);
      const vb = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, vb);
      // 2 triangles covering full screen in NDC
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
        -1, -1,  1, -1,  1,  1,
        -1, -1,  1,  1, -1,  1
      ]), gl.STATIC_DRAW);
      gl.enableVertexAttribArray(0);
      gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
      gl.bindVertexArray(null);
      this.fadeMesh = { vao, count: 6 };
    }

    gl.useProgram(this.programFade);
    gl.uniform1f(this.uFade.uAlpha, alpha);

    gl.disable(gl.DEPTH_TEST);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

    gl.bindVertexArray(this.fadeMesh.vao);
    gl.drawArrays(gl.TRIANGLES, 0, this.fadeMesh.count);
    gl.bindVertexArray(null);

    gl.disable(gl.BLEND);
    gl.enable(gl.DEPTH_TEST);
  }

  // FIX #9: isSphereVisible — frustum cull using 4 planes extracted from viewProjMatrix
  isSphereVisible(x, y, z, r) {
    const m = this.viewProjMatrix;
    // Extract 4 frustum planes (left, right, bottom, top) from column-major mat4
    // Row vectors of clip matrix: row i = [m[i], m[i+4], m[i+8], m[i+12]]
    // Plane equations (Ax + By + Cz + D): row3 +/- rowN
    // Left:   row3 + row0
    // Right:  row3 - row0
    // Bottom: row3 + row1
    // Top:    row3 - row1
    const planes = [
      [m[3] + m[0],  m[7] + m[4],  m[11] + m[8],  m[15] + m[12]], // left
      [m[3] - m[0],  m[7] - m[4],  m[11] - m[8],  m[15] - m[12]], // right
      [m[3] + m[1],  m[7] + m[5],  m[11] + m[9],  m[15] + m[13]], // bottom
      [m[3] - m[1],  m[7] - m[5],  m[11] - m[9],  m[15] - m[13]], // top
    ];

    for (const [a, b, c, d] of planes) {
      const dist = a * x + b * y + c * z + d;
      const len = Math.sqrt(a * a + b * b + c * c) || 1;
      if (dist / len < -r) return false;
    }
    return true;
  }
}

// ----------------------------------------------------------------
// GLSL 3.0 Shaders (Underwater Physics, Caustics, Beer-Lambert Fog)
// ----------------------------------------------------------------

const VS_SOLID = `#version 300 es
layout(location = 0) in vec3 aPos;
layout(location = 1) in vec3 aNormal;
layout(location = 2) in vec2 aUV;
layout(location = 3) in vec4 aColor;

uniform mat4 uViewProj;
uniform mat4 uModel;

out vec3 vWorldPos;
out vec3 vNormal;
out vec2 vUV;
out vec4 vColor;

void main() {
  vec4 wp = uModel * vec4(aPos, 1.0);
  vWorldPos = wp.xyz;
  vNormal = normalize(mat3(uModel) * aNormal);
  vUV = aUV;
  vColor = aColor;
  gl_Position = uViewProj * wp;
}
`;

// FIX #10 (bioluminescence) + FIX #11 (uColorTint)
const FS_SOLID = `#version 300 es
precision highp float;

in vec3 vWorldPos;
in vec3 vNormal;
in vec2 vUV;
in vec4 vColor;

uniform vec3 uCamPos;
uniform vec3 uSunDir;
uniform vec3 uSunCol;
uniform vec3 uWaterCol;
uniform float uTime;
uniform vec3 uColorTint;

out vec4 fragColor;

// Animated optical caustics function (analytical interference)
float caustics(vec2 uv, float t) {
  vec2 p = uv * 3.14159;
  vec2 i = p;
  float c = 0.0;
  for (int n = 1; n <= 4; n++) {
    float fn = float(n);
    float tt = t * (1.0 - 2.5 / fn);
    i = p + vec2(cos(tt - i.x) + sin(tt + i.y), sin(tt - i.y) + cos(tt + i.x));
    float s = sin(i.x + tt);
    float k = cos(i.y + tt);
    c += abs(s * k) / (1.2 * sqrt(s * s + k * k) + 0.01);
  }
  c = 1.2 - pow(c / 4.0, 1.4);
  return pow(abs(c), 6.0) * 1.8;
}

void main() {
  vec3 N = normalize(vNormal);
  vec3 L = normalize(uSunDir);
  vec3 V = normalize(uCamPos - vWorldPos);
  float dist = length(vWorldPos - uCamPos);

  // Diffuse sun lighting
  float NdotL = max(dot(N, L), 0.0);

  // Dynamic Caustics dancing on upward faces with crystalline blue chromatic fringes
  float caus = 0.0;
  if (N.y > 0.05) {
    caus = caustics(vWorldPos.xz * 0.12, uTime * 0.65) * max(N.y, 0.0);
    caus *= exp(vWorldPos.y * 0.042);
  }
  vec3 causticLight = vec3(caus * 0.65, caus * 0.95, caus * 1.35);

  // Depth-dependent Super Real Oceanic Blue gradient
  float depthNorm = clamp(-vWorldPos.y / 50.0, 0.0, 1.0);
  vec3 surfaceBlue = vec3(0.03, 0.52, 0.98); // Electric tropical azure
  vec3 midBlue     = vec3(0.015, 0.28, 0.88); // Cobalt sapphire
  vec3 abyssalBlue = vec3(0.006, 0.09, 0.48); // Deep ultramarine abyss
  vec3 oceanWaterCol = mix(mix(surfaceBlue, midBlue, smoothstep(0.0, 0.45, depthNorm)), abyssalBlue, smoothstep(0.45, 1.0, depthNorm));

  // Underwater ambient light bathed in rich blue
  vec3 ambient = oceanWaterCol * (0.35 + 0.35 * (N.y * 0.5 + 0.5)) * exp(vWorldPos.y * 0.032);
  vec3 sunLight = uSunCol * (NdotL * 0.75 + causticLight) * exp(vWorldPos.y * 0.038);

  // Apply per-coral/object tint to vertex color
  vec3 tintedColor = vColor.rgb * uColorTint;
  vec3 litColor = tintedColor * (ambient + sunLight * 0.7);

  // Specular sheen with aquatic blue tint
  vec3 H = normalize(L + V);
  float spec = pow(max(dot(N, H), 0.0), 32.0) * (caus * 0.6 + 0.2);
  litColor += mix(uSunCol, vec3(0.3, 0.8, 1.0), 0.5) * spec * 0.4;

  // Volumetric forward scattering (sun shafts in blue water)
  float sunScatter = pow(max(dot(V, L), 0.0), 3.0) * 0.35 * exp(vWorldPos.y * 0.035);
  vec3 sunShaftGlow = vec3(0.15, 0.65, 1.0) * sunScatter;

  // Beer-Lambert Spectral Absorption: Red absorbed in <8m, Green in <25m, Blue penetrates to 60m
  vec3 decay = exp(-vec3(0.092, 0.026, 0.009) * dist);
  vec3 finalColor = mix(oceanWaterCol, litColor, decay) + sunShaftGlow * (1.0 - decay.b);

  // Bioluminescence: deep glow below 30m
  if (-vWorldPos.y > 30.0) {
    vec3 bioGlow = vec3(0.05, 0.3, 0.6)
      * ((sin(uTime * 0.8 + vWorldPos.x * 0.5 + vWorldPos.z * 0.3) * 0.5 + 0.5))
      * clamp((-vWorldPos.y - 30.0) / 20.0, 0.0, 1.0)
      * 0.4;
    finalColor += bioGlow;
  }

  fragColor = vec4(finalColor, 1.0);
}
`;

const VS_KELP = `#version 300 es
layout(location = 0) in vec3 aPos;
layout(location = 1) in vec3 aNormal;
layout(location = 2) in vec2 aUV;
layout(location = 3) in vec4 aColor;

uniform mat4 uViewProj;
uniform mat4 uModel;
uniform float uTime;

out vec3 vWorldPos;
out vec3 vNormal;
out vec2 vUV;
out vec4 vColor;

void main() {
  vec3 pos = aPos;
  // Kelp sway in ocean current (sway amplitude increases with height)
  float height = max(0.0, pos.y + 45.0);
  float sway = sin(uTime * 1.2 + pos.x * 0.1 + pos.z * 0.1) * (height * 0.06);
  pos.x += sway;
  pos.z += cos(uTime * 0.9 + pos.x * 0.08) * (height * 0.04);

  vec4 wp = uModel * vec4(pos, 1.0);
  vWorldPos = wp.xyz;
  vNormal = aNormal;
  vUV = aUV;
  vColor = aColor;
  gl_Position = uViewProj * wp;
}
`;

const VS_FISH = `#version 300 es
layout(location = 0) in vec3 aPos;
layout(location = 1) in vec3 aNormal;
layout(location = 2) in vec2 aUV;
layout(location = 3) in vec4 aColor;

uniform mat4 uViewProj;
uniform mat4 uModel;
uniform float uTailPhase;
uniform float uTailAmp;
uniform float uPectoralPhase;
uniform int uIsPlayer;

out vec3 vWorldPos;
out vec3 vNormal;
out vec2 vUV;
out vec4 vColor;

void main() {
  vec3 localPos = aPos;

  // Biological Spine Traveling Wave Undulation:
  // Traveling wave propagates from head (z > 0) to caudal fin (z < 0)
  float tailWeight = max(0.0, -localPos.z); // zero at snout, rises towards tail
  float wave = sin(uTailPhase - localPos.z * 6.5) * uTailAmp * pow(tailWeight + 0.1, 1.35);
  localPos.x += wave;

  // Pectoral fin sculling flapping
  if (abs(localPos.x) > 0.06 && localPos.z > 0.05 && localPos.z < 0.25) {
    float flap = sin(uPectoralPhase) * 0.035 * sign(localPos.x);
    localPos.y += flap;
  }

  vec4 wp = uModel * vec4(localPos, 1.0);
  vWorldPos = wp.xyz;
  vNormal = normalize(mat3(uModel) * aNormal);
  vUV = aUV;
  vColor = aColor;
  gl_Position = uViewProj * wp;
}
`;

const FS_FISH = `#version 300 es
precision highp float;

in vec3 vWorldPos;
in vec3 vNormal;
in vec2 vUV;
in vec4 vColor;

uniform vec3 uCamPos;
uniform vec3 uSunDir;
uniform vec3 uSunCol;
uniform vec3 uWaterCol;
uniform float uTime;

out vec4 fragColor;

float caustics(vec2 uv, float t) {
  vec2 p = uv * 3.14159;
  vec2 i = p;
  float c = 0.0;
  for (int n = 1; n <= 3; n++) {
    float fn = float(n);
    float tt = t * (1.0 - 2.5 / fn);
    i = p + vec2(cos(tt - i.x) + sin(tt + i.y), sin(tt - i.y) + cos(tt + i.x));
    float s = sin(i.x + tt);
    float k = cos(i.y + tt);
    c += abs(s * k) / (1.2 * sqrt(s * s + k * k) + 0.01);
  }
  c = 1.2 - pow(c / 3.0, 1.4);
  return pow(abs(c), 5.0) * 1.5;
}

void main() {
  vec3 N = normalize(vNormal);
  vec3 L = normalize(uSunDir);
  vec3 V = normalize(uCamPos - vWorldPos);
  float dist = length(vWorldPos - uCamPos);

  float NdotL = max(dot(N, L), 0.0);
  float caus = 0.0;
  if (N.y > 0.08) {
    caus = caustics(vWorldPos.xz * 0.15, uTime * 0.65) * max(N.y, 0.0) * exp(vWorldPos.y * 0.04);
  }
  vec3 causticLight = vec3(caus * 0.65, caus * 0.95, caus * 1.35);

  float depthNorm = clamp(-vWorldPos.y / 50.0, 0.0, 1.0);
  vec3 surfaceBlue = vec3(0.03, 0.52, 0.98);
  vec3 midBlue     = vec3(0.015, 0.28, 0.88);
  vec3 abyssalBlue = vec3(0.006, 0.09, 0.48);
  vec3 oceanWaterCol = mix(mix(surfaceBlue, midBlue, smoothstep(0.0, 0.45, depthNorm)), abyssalBlue, smoothstep(0.45, 1.0, depthNorm));

  vec3 ambient = oceanWaterCol * (0.35 + 0.35 * (N.y * 0.5 + 0.5)) * exp(vWorldPos.y * 0.032);
  vec3 sunLight = uSunCol * (NdotL * 0.75 + causticLight);

  // Fish iridescent biological scales catching electric blue marine light
  float fresnel = pow(1.0 - max(dot(N, V), 0.0), 2.8);
  vec3 sheen = vec3(0.15, 0.65, 0.98) * fresnel * 0.6;

  vec3 litColor = vColor.rgb * (ambient + sunLight * 0.75) + sheen;

  // Beer-Lambert decay
  vec3 decay = exp(-vec3(0.092, 0.026, 0.009) * dist);
  vec3 finalColor = mix(oceanWaterCol, litColor, decay);

  fragColor = vec4(finalColor, vColor.a);
}
`;

const VS_WATER_SURFACE = `#version 300 es
layout(location = 0) in vec3 aPos;

uniform mat4 uViewProj;
uniform mat4 uModel;
uniform float uTime;

out vec3 vWorldPos;
out vec2 vUV;

void main() {
  vec4 wp = uModel * vec4(aPos, 1.0);
  float wave = sin(uTime * 1.4 + wp.x * 0.08) * cos(uTime * 1.1 + wp.z * 0.07) * 0.35;
  wp.y += wave;

  vWorldPos = wp.xyz;
  vUV = wp.xz * 0.04;
  gl_Position = uViewProj * wp;
}
`;

const FS_WATER_SURFACE = `#version 300 es
precision highp float;

in vec3 vWorldPos;
in vec2 vUV;

uniform vec3 uCamPos;
uniform vec3 uSunDir;
uniform vec3 uSunCol;
uniform vec3 uWaterCol;
uniform float uTime;

out vec4 fragColor;

void main() {
  vec3 V = normalize(uCamPos - vWorldPos);
  vec3 L = normalize(uSunDir);

  // Animated wave surface normal with multiple interfering ripples
  vec2 uv = vWorldPos.xz * 0.12;
  float w1 = sin(uv.x * 2.2 + uTime * 1.6) * cos(uv.y * 1.9 + uTime * 1.3);
  float w2 = sin(uv.x * 4.8 - uTime * 2.2) * cos(uv.y * 4.2 + uTime * 1.8);
  vec3 waveN = normalize(vec3(-w1 * 0.12 - w2 * 0.06, -1.0, -w1 * 0.12 + w2 * 0.06));

  float NdotV = max(dot(-waveN, V), 0.0);

  // Snell's Window Critical Angle (~48.6 deg):
  // Inside the window (NdotV > 0.65), view looks into bright radiant celestial azure sky.
  // Outside the window, total internal reflection mirrors the deep cobalt blue ocean floor!
  float snellWindow = smoothstep(0.55, 0.75, NdotV);

  // Specular sun glints on wave facets
  vec3 H = normalize(L + V);
  float sunGlint = pow(max(dot(-waveN, H), 0.0), 96.0) * 3.5;

  // Real oceanic surface colors
  vec3 skyAzure = vec3(0.08, 0.62, 0.98); // Brilliant tropical sky-water
  vec3 oceanMirror = vec3(0.012, 0.22, 0.72); // Total internal reflection deep blue

  vec3 surfaceColor = mix(oceanMirror, skyAzure, snellWindow);
  surfaceColor += uSunCol * sunGlint;

  fragColor = vec4(surfaceColor, 0.85);
}
`;

const VS_PARTICLES = `#version 300 es
layout(location = 0) in vec4 aParticle; // x, y, z, size

uniform mat4 uViewProj;
uniform vec3 uCamPos;
uniform float uTime;

out float vAlpha;

void main() {
  vec3 pos = aParticle.xyz;

  // Infinite wrapping around camera within 120m bounds
  pos.x = mod(pos.x - uCamPos.x + 60.0, 120.0) - 60.0 + uCamPos.x;
  pos.z = mod(pos.z - uCamPos.z + 60.0, 120.0) - 60.0 + uCamPos.z;

  // Drifting motion in current
  pos.x += sin(uTime * 0.4 + pos.y * 0.2) * 1.2;
  pos.z += cos(uTime * 0.3 + pos.x * 0.2) * 1.2;
  pos.y += sin(uTime * 0.5 + pos.z * 0.3) * 0.6;

  float dist = length(pos - uCamPos);
  vAlpha = clamp(1.0 - dist / 50.0, 0.0, 1.0) * 0.6;

  gl_Position = uViewProj * vec4(pos, 1.0);
  gl_PointSize = aParticle.w * (180.0 / max(1.0, dist));
}
`;

const FS_PARTICLES = `#version 300 es
precision highp float;

in float vAlpha;
uniform vec3 uWaterCol;

out vec4 fragColor;

void main() {
  vec2 coord = gl_PointCoord - vec2(0.5);
  if (length(coord) > 0.5) discard;
  // Sparkling crystalline blue marine snow
  vec3 snowCol = mix(vec3(0.85, 0.95, 1.0), vec3(0.12, 0.68, 0.98), 0.45);
  fragColor = vec4(snowCol, vAlpha);
}
`;
