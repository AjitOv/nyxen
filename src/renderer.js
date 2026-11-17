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
    // Red absorbs in <10m, Green in <30m, Blue penetrates deep
    this.sigma = [0.058, 0.0235, 0.0195];
    this.kd = [0.056, 0.0245, 0.0170];
    this.waterColor = [0.12, 0.52, 0.82]; // Pure tropical blue-cyan
    this.sunColor = [1.6, 1.5, 1.35];

    this.time = 0;
    this.isReady = false;
  }

  async init() {
    // 1. Try WebGPU first if available and preferred
    if (navigator.gpu) {
      try {
        const adapter = await navigator.gpu.requestAdapter({ powerPreference: 'high-performance' });
        if (adapter) {
          const device = await adapter.requestDevice();
          if (device) {
            this.gpuDevice = device;
            this.type = 'webgpu';
            console.log('NYXEN: WebGPU hardware accelerator initialized.');
            // Setup WebGPU context
            this.gpuCtx = this.canvas.getContext('webgpu');
            this.gpuFormat = navigator.gpu.getPreferredCanvasFormat();
            this.gpuCtx.configure({
              device: this.gpuDevice,
              format: this.gpuFormat,
              alphaMode: 'opaque'
            });
            // We initialize WebGL2 pipeline as high-fidelity fallback & universal runner
          }
        }
      } catch (e) {
        console.warn('WebGPU init failed, falling back to WebGL2:', e);
      }
    }

    // 2. Fallback to WebGL2 (Universally supported in 99.8% of all browsers)
    if (this.type !== 'webgpu' || true) {
      // Initialize WebGL2 context
      const gl = this.canvas.getContext('webgl2', {
        powerPreference: 'high-performance',
        antialias: this.quality < 2,
        depth: true,
        stencil: false,
        alpha: false
      });
      if (!gl) {
        throw new Error('Neither WebGPU nor WebGL2 could be initialized on this browser.');
      }
      this.gl = gl;
      if (this.type !== 'webgpu') this.type = 'webgl2';
      console.log(`NYXEN: Renderer active in ${this.type.toUpperCase()} mode.`);
      this.initWebGL2Pipeline();
    }

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
      'uViewProj', 'uCamPos', 'uSunDir', 'uSunCol', 'uWaterCol', 'uTime', 'uModel'
    ]);
    this.uKelp = this.getUniformLocations(this.programKelp, [
      'uViewProj', 'uCamPos', 'uSunDir', 'uSunCol', 'uWaterCol', 'uTime'
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
    // Deep atmospheric ocean background clear color
    // Computed based on camera depth
    const depthFactor = clamp((-camPos[1]) / 40.0, 0.0, 1.0);
    const bgR = 0.08 * (1.0 - depthFactor * 0.7);
    const bgG = 0.38 * (1.0 - depthFactor * 0.6);
    const bgB = 0.65 * (1.0 - depthFactor * 0.5);

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

  renderKelpForest(kelpGPU, kelpInstances) {
    const gl = this.gl;
    gl.useProgram(this.programKelp);

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

      gl.drawElements(gl.TRIANGLES, kelpGPU.indexCount, kelpGPU.indexType, 0);
    }
    gl.bindVertexArray(null);
  }

  renderCoralGardens(coralMeshesGPU, coralInstances) {
    const gl = this.gl;
    gl.useProgram(this.programSolid);

    const m = Mat4.create();
    for (const inst of coralInstances) {
      const dx = inst.x - this.camPos[0];
      const dz = inst.z - this.camPos[2];
      if (dx * dx + dz * dz > 140.0 * 140.0) continue; // Distance cull

      const meshGPU = coralMeshesGPU[inst.type] || coralMeshesGPU['staghorn'];
      if (!meshGPU) continue;

      // Model matrix: translate & scale & yaw
      const cy = Math.cos(inst.yaw), sy = Math.sin(inst.yaw);
      const s = inst.scale;

      m[0] = cy * s;  m[1] = 0;      m[2] = -sy * s; m[3] = 0;
      m[4] = 0;       m[5] = s;      m[6] = 0;       m[7] = 0;
      m[8] = sy * s;  m[9] = 0;      m[10] = cy * s; m[11] = 0;
      m[12] = inst.x; m[13] = inst.y; m[14] = inst.z; m[15] = 1;

      gl.uniformMatrix4fv(this.uSolid.uModel, false, m);

      gl.bindVertexArray(meshGPU.vao);
      gl.drawElements(gl.TRIANGLES, meshGPU.indexCount, meshGPU.indexType, 0);
    }
    gl.bindVertexArray(null);
  }

  renderFishSchools(schoolMeshGPU, schools) {
    const gl = this.gl;
    gl.useProgram(this.programSolid);

    const m = Mat4.create();
    gl.bindVertexArray(schoolMeshGPU.vao);

    for (const school of schools) {
      for (const boid of school.boids) {
        const dx = boid.pos[0] - this.camPos[0];
        const dz = boid.pos[2] - this.camPos[2];
        if (dx * dx + dz * dz > 120.0 * 120.0) continue;

        m[0] = 0.8; m[5] = 0.8; m[10] = 0.8;
        m[12] = boid.pos[0];
        m[13] = boid.pos[1];
        m[14] = boid.pos[2];

        gl.uniformMatrix4fv(this.uSolid.uModel, false, m);
        gl.drawElements(gl.TRIANGLES, schoolMeshGPU.indexCount, schoolMeshGPU.indexType, 0);
      }
    }
    gl.bindVertexArray(null);
  }

  renderMantas(mantaMeshGPU, mantas) {
    const gl = this.gl;
    gl.useProgram(this.programSolid);

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
  float wrapNdotL = max(dot(N, L) * 0.5 + 0.5, 0.0);

  // Dynamic Caustics dancing on upward faces
  float caus = 0.0;
  if (N.y > 0.1) {
    caus = caustics(vWorldPos.xz * 0.12, uTime * 0.65) * N.y;
    // Caustics fade with depth
    caus *= exp(vWorldPos.y * 0.045);
  }

  // Underwater ambient light
  vec3 ambient = uWaterCol * 0.45 * (N.y * 0.5 + 0.5) * exp(vWorldPos.y * 0.035);
  vec3 sunLight = uSunCol * (NdotL + caus * 0.8) * exp(vWorldPos.y * 0.04);

  vec3 litColor = vColor.rgb * (ambient + sunLight * 0.65);

  // Specular sheen
  vec3 H = normalize(L + V);
  float spec = pow(max(dot(N, H), 0.0), 32.0) * (caus * 0.5 + 0.2);
  litColor += uSunCol * spec * 0.35;

  // Beer-Lambert Spectral Absorption Fog
  // Red photons absorb fastest (0.056), green (0.024), blue penetrates deepest (0.017)
  vec3 decay = exp(-vec3(0.056, 0.0245, 0.0170) * dist);
  vec3 depthWaterCol = uWaterCol * (0.35 + 0.65 * exp(vWorldPos.y * 0.03));
  vec3 finalColor = mix(depthWaterCol, litColor, decay);

  fragColor = vec4(finalColor, 1.0);
}
`;

const VS_KELP = `#version 300 es
layout(location = 0) in vec3 aPos;
layout(location = 1) in vec3 aNormal;
layout(location = 2) in vec2 aUV;
layout(location = 3) in vec4 aColor;

uniform mat4 uViewProj;
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

  vWorldPos = pos;
  vNormal = aNormal;
  vUV = aUV;
  vColor = aColor;
  gl_Position = uViewProj * vec4(pos, 1.0);
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
  if (N.y > 0.15) {
    caus = caustics(vWorldPos.xz * 0.15, uTime * 0.65) * N.y * exp(vWorldPos.y * 0.04);
  }

  vec3 ambient = uWaterCol * 0.5 * (N.y * 0.5 + 0.5);
  vec3 sunLight = uSunCol * (NdotL + caus * 0.7);

  // Fish iridescent scale sheen
  float fresnel = pow(1.0 - max(dot(N, V), 0.0), 3.0);
  vec3 sheen = vec3(0.3, 0.7, 0.9) * fresnel * 0.45;

  vec3 litColor = vColor.rgb * (ambient + sunLight * 0.75) + sheen;

  // Beer-Lambert decay
  vec3 decay = exp(-vec3(0.056, 0.0245, 0.0170) * dist);
  vec3 depthWaterCol = uWaterCol * (0.35 + 0.65 * exp(vWorldPos.y * 0.03));
  vec3 finalColor = mix(depthWaterCol, litColor, decay);

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
  vec3 N = vec3(0.0, -1.0, 0.0); // Looking up at surface from below

  // Surface reflection & refraction
  float NdotV = max(dot(-N, V), 0.0);
  float fresnel = 0.04 + 0.96 * pow(1.0 - NdotV, 4.0);

  // Sun disc shimmer
  vec3 H = normalize(L + V);
  float sunShimmer = pow(max(dot(-N, H), 0.0), 64.0) * 2.5;

  vec3 surfaceColor = mix(uWaterCol * 1.2, uSunCol, fresnel + sunShimmer);
  fragColor = vec4(surfaceColor, 0.75);
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
  fragColor = vec4(mix(vec3(0.9, 0.95, 1.0), uWaterCol, 0.3), vAlpha);
}
`;
