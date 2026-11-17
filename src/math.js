// ============================================================================
// NYXEN — Procedural Math & Geometry Utilities
// Derived & adapted in part from Abyssal Garden (MIT License - Noniv)
// ============================================================================

export const { sin, cos, tan, sqrt, min, max, abs, floor, ceil, round, PI, pow, atan2, hypot, exp } = Math;
export const TAU = PI * 2;

let _seed = 20261110;
export const rnd = () => {
  _seed = (_seed + 0x6D2B79F5) | 0;
  let t = Math.imul(_seed ^ (_seed >>> 15), 1 | _seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
export const rr = (a, b) => a + (b - a) * rnd();
export const rseed = (s) => { _seed = (20261110 + Math.imul(s, 7919)) | 0; };
export const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);
export const mix = (a, b, t) => a + (b - a) * t;
export const sstep = (a, b, x) => {
  x = clamp((x - a) / (b - a), 0, 1);
  return x * x * (3 - 2 * x);
};
export const fract = (x) => x - floor(x);

// Hash & procedural noise
export const ihash = (x, y, z) => {
  let h = (Math.imul(x, 374761393) + Math.imul(y, 668265263) + Math.imul(z, 1274126177)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
};

export const vnoise = (x, y, z) => {
  const ix = floor(x), iy = floor(y), iz = floor(z);
  let fx = x - ix, fy = y - iy, fz = z - iz;
  fx = fx * fx * (3 - 2 * fx);
  fy = fy * fy * (3 - 2 * fy);
  fz = fz * fz * (3 - 2 * fz);
  const a = mix(
    mix(ihash(ix, iy, iz), ihash(ix + 1, iy, iz), fx),
    mix(ihash(ix, iy + 1, iz), ihash(ix + 1, iy + 1, iz), fx),
    fy
  );
  const b = mix(
    mix(ihash(ix, iy, iz + 1), ihash(ix + 1, iy, iz + 1), fx),
    mix(ihash(ix, iy + 1, iz + 1), ihash(ix + 1, iy + 1, iz + 1), fx),
    fy
  );
  return mix(a, b, fz);
};

export const fbm = (x, y, z, o = 4) => {
  let a = 0.5, s = 0;
  let cx = x, cy = y, cz = z;
  for (let i = 0; i < o; i++) {
    s += a * vnoise(cx, cy, cz);
    cx = cx * 2.03 + 17.1;
    cy = cy * 2.03 + 31.7;
    cz = cz * 2.03 + 5.3;
    a *= 0.5;
  }
  return s / (1 - Math.pow(0.5, o));
};

export const worley = (x, y, z) => {
  const ix = floor(x), iy = floor(y), iz = floor(z);
  const fx = x - ix, fy = y - iy, fz = z - iz;
  let minD = 9.0;
  for (let ox = -1; ox <= 1; ox++) {
    for (let oy = -1; oy <= 1; oy++) {
      for (let oz = -1; oz <= 1; oz++) {
        const h1 = ihash(ix + ox, iy + oy, iz + oz);
        const h2 = ihash(ix + ox + 37, iy + oy + 17, iz + oz + 91);
        const h3 = ihash(ix + ox + 73, iy + oy + 89, iz + oz + 23);
        const dx = ox + h1 - fx;
        const dy = oy + h2 - fy;
        const dz = oz + h3 - fz;
        const d = dx * dx + dy * dy + dz * dz;
        if (d < minD) minD = d;
      }
    }
  }
  return sqrt(minD);
};

// ----------------------------------------------------------------
// 3D Vector Math Helpers (Float32Array friendly)
// ----------------------------------------------------------------
export class Vec3 {
  static create(x = 0, y = 0, z = 0) { return new Float32Array([x, y, z]); }
  static set(out, x, y, z) { out[0] = x; out[1] = y; out[2] = z; return out; }
  static copy(out, a) { out[0] = a[0]; out[1] = a[1]; out[2] = a[2]; return out; }
  static add(out, a, b) { out[0] = a[0] + b[0]; out[1] = a[1] + b[1]; out[2] = a[2] + b[2]; return out; }
  static sub(out, a, b) { out[0] = a[0] - b[0]; out[1] = a[1] - b[1]; out[2] = a[2] - b[2]; return out; }
  static scale(out, a, s) { out[0] = a[0] * s; out[1] = a[1] * s; out[2] = a[2] * s; return out; }
  static dot(a, b) { return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]; }
  static cross(out, a, b) {
    const ax = a[0], ay = a[1], az = a[2];
    const bx = b[0], by = b[1], bz = b[2];
    out[0] = ay * bz - az * by;
    out[1] = az * bx - ax * bz;
    out[2] = ax * by - ay * bx;
    return out;
  }
  static length(a) { return hypot(a[0], a[1], a[2]); }
  static dist(a, b) { return hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]); }
  static normalize(out, a) {
    const l = hypot(a[0], a[1], a[2]) || 1;
    out[0] = a[0] / l; out[1] = a[1] / l; out[2] = a[2] / l;
    return out;
  }
  static lerp(out, a, b, t) {
    out[0] = a[0] + (b[0] - a[0]) * t;
    out[1] = a[1] + (b[1] - a[1]) * t;
    out[2] = a[2] + (b[2] - a[2]) * t;
    return out;
  }
}

// ----------------------------------------------------------------
// Quaternion Helpers [x, y, z, w]
// ----------------------------------------------------------------
export class Quat {
  static create() { return new Float32Array([0, 0, 0, 1]); }
  static set(out, x, y, z, w) { out[0] = x; out[1] = y; out[2] = z; out[3] = w; return out; }
  static fromAxis(out, x, y, z, angle) {
    const l = hypot(x, y, z) || 1;
    const s = sin(angle * 0.5) / l;
    out[0] = x * s; out[1] = y * s; out[2] = z * s; out[3] = cos(angle * 0.5);
    return out;
  }
  static mul(out, a, b) {
    const ax = a[0], ay = a[1], az = a[2], aw = a[3];
    const bx = b[0], by = b[1], bz = b[2], bw = b[3];
    out[0] = aw * bx + ax * bw + ay * bz - az * by;
    out[1] = aw * by - ax * bz + ay * bw + az * bx;
    out[2] = aw * bz + ax * by - ay * bx + az * bw;
    out[3] = aw * bw - ax * bx - ay * by - az * bz;
    return out;
  }
  static rotateVec3(out, q, v) {
    const qx = q[0], qy = q[1], qz = q[2], qw = q[3];
    const vx = v[0], vy = v[1], vz = v[2];
    const ix = qw * vx + qy * vz - qz * vy;
    const iy = qw * vy + qz * vx - qx * vz;
    const iz = qw * vz + qx * vy - qy * vx;
    const iw = -qx * vx - qy * vy - qz * vz;
    out[0] = ix * qw + iw * -qx + iy * -qz - iz * -qy;
    out[1] = iy * qw + iw * -qy + iz * -qx - ix * -qz;
    out[2] = iz * qw + iw * -qz + ix * -qy - iy * -qx;
    return out;
  }
  static slerp(out, a, b, t) {
    let ax = a[0], ay = a[1], az = a[2], aw = a[3];
    let bx = b[0], by = b[1], bz = b[2], bw = b[3];
    let cosOmega = ax * bx + ay * by + az * bz + aw * bw;
    if (cosOmega < 0) {
      cosOmega = -cosOmega;
      bx = -bx; by = -by; bz = -bz; bw = -bw;
    }
    let scale0, scale1;
    if (1.0 - cosOmega > 1e-4) {
      const omega = Math.acos(cosOmega);
      const sinOmega = sin(omega);
      scale0 = sin((1.0 - t) * omega) / sinOmega;
      scale1 = sin(t * omega) / sinOmega;
    } else {
      scale0 = 1.0 - t;
      scale1 = t;
    }
    out[0] = scale0 * ax + scale1 * bx;
    out[1] = scale0 * ay + scale1 * by;
    out[2] = scale0 * az + scale1 * bz;
    out[3] = scale0 * aw + scale1 * bw;
    return out;
  }
  static fromEuler(out, pitch, yaw, roll) {
    const c1 = cos(pitch * 0.5), s1 = sin(pitch * 0.5);
    const c2 = cos(yaw * 0.5), s2 = sin(yaw * 0.5);
    const c3 = cos(roll * 0.5), s3 = sin(roll * 0.5);
    out[0] = s1 * c2 * c3 + c1 * s2 * s3;
    out[1] = c1 * s2 * c3 - s1 * c2 * s3;
    out[2] = c1 * c2 * s3 + s1 * s2 * c3;
    out[3] = c1 * c2 * c3 - s1 * s2 * s3;
    return out;
  }
}

// ----------------------------------------------------------------
// 4x4 Matrix Helpers
// ----------------------------------------------------------------
export class Mat4 {
  static create() {
    const out = new Float32Array(16);
    out[0] = 1; out[5] = 1; out[10] = 1; out[15] = 1;
    return out;
  }
  static identity(out) {
    out.fill(0);
    out[0] = 1; out[5] = 1; out[10] = 1; out[15] = 1;
    return out;
  }
  static perspective(out, fovY, aspect, near, far) {
    const f = 1.0 / tan(fovY * 0.5);
    out.fill(0);
    out[0] = f / aspect;
    out[5] = f;
    out[10] = (far + near) / (near - far);
    out[11] = -1.0;
    out[14] = (2.0 * far * near) / (near - far);
    return out;
  }
  static lookAt(out, eye, target, up) {
    let z0 = eye[0] - target[0], z1 = eye[1] - target[1], z2 = eye[2] - target[2];
    let len = hypot(z0, z1, z2) || 1;
    z0 /= len; z1 /= len; z2 /= len;

    let x0 = up[1] * z2 - up[2] * z1;
    let x1 = up[2] * z0 - up[0] * z2;
    let x2 = up[0] * z1 - up[1] * z0;
    len = hypot(x0, x1, x2) || 1;
    x0 /= len; x1 /= len; x2 /= len;

    let y0 = z1 * x2 - z2 * x1;
    let y1 = z2 * x0 - z0 * x2;
    let y2 = z0 * x1 - z1 * x0;

    out[0] = x0; out[1] = y0; out[2] = z0; out[3] = 0;
    out[4] = x1; out[5] = y1; out[6] = z1; out[7] = 0;
    out[8] = x2; out[9] = y2; out[10] = z2; out[11] = 0;
    out[12] = -(x0 * eye[0] + x1 * eye[1] + x2 * eye[2]);
    out[13] = -(y0 * eye[0] + y1 * eye[1] + y2 * eye[2]);
    out[14] = -(z0 * eye[0] + z1 * eye[1] + z2 * eye[2]);
    out[15] = 1;
    return out;
  }
  static multiply(out, a, b) {
    const a00 = a[0], a01 = a[1], a02 = a[2], a03 = a[3];
    const a10 = a[4], a11 = a[5], a12 = a[6], a13 = a[7];
    const a20 = a[8], a21 = a[9], a22 = a[10], a23 = a[11];
    const a30 = a[12], a31 = a[13], a32 = a[14], a33 = a[15];

    let b0 = b[0], b1 = b[1], b2 = b[2], b3 = b[3];
    out[0] = b0 * a00 + b1 * a10 + b2 * a20 + b3 * a30;
    out[1] = b0 * a01 + b1 * a11 + b2 * a21 + b3 * a31;
    out[2] = b0 * a02 + b1 * a12 + b2 * a22 + b3 * a32;
    out[3] = b0 * a03 + b1 * a13 + b2 * a23 + b3 * a33;

    b0 = b[4]; b1 = b[5]; b2 = b[6]; b3 = b[7];
    out[4] = b0 * a00 + b1 * a10 + b2 * a20 + b3 * a30;
    out[5] = b0 * a01 + b1 * a11 + b2 * a21 + b3 * a31;
    out[6] = b0 * a02 + b1 * a12 + b2 * a22 + b3 * a32;
    out[7] = b0 * a03 + b1 * a13 + b2 * a23 + b3 * a33;

    b0 = b[8]; b1 = b[9]; b2 = b[10]; b3 = b[11];
    out[8] = b0 * a00 + b1 * a10 + b2 * a20 + b3 * a30;
    out[9] = b0 * a01 + b1 * a11 + b2 * a21 + b3 * a31;
    out[10] = b0 * a02 + b1 * a12 + b2 * a22 + b3 * a32;
    out[11] = b0 * a03 + b1 * a13 + b2 * a23 + b3 * a33;

    b0 = b[12]; b1 = b[13]; b2 = b[14]; b3 = b[15];
    out[12] = b0 * a00 + b1 * a10 + b2 * a20 + b3 * a30;
    out[13] = b0 * a01 + b1 * a11 + b2 * a21 + b3 * a31;
    out[14] = b0 * a02 + b1 * a12 + b2 * a22 + b3 * a32;
    out[15] = b0 * a03 + b1 * a13 + b2 * a23 + b3 * a33;
    return out;
  }
}

// ----------------------------------------------------------------
// Procedural Mesh Builder
// ----------------------------------------------------------------
export class Mesh {
  constructor() {
    this.positions = [];
    this.normals = [];
    this.uvs = [];
    this.colors = [];
    this.indices = [];
  }

  vertex(x, y, z, nx = 0, ny = 1, nz = 0, u = 0, v = 0, r = 1, g = 1, b = 1, a = 1) {
    this.positions.push(x, y, z);
    this.normals.push(nx, ny, nz);
    this.uvs.push(u, v);
    this.colors.push(r, g, b, a);
    return this.positions.length / 3 - 1;
  }

  tri(a, b, c) {
    this.indices.push(a, b, c);
  }

  quad(a, b, c, d) {
    this.indices.push(a, b, c, a, c, d);
  }

  // Smooth cylinder/tube along polyline with variable radius and vertex color/uv function
  tube(pts, radiusFn, sides = 8, capStart = true, capEnd = true, colorFn = null) {
    const rings = [];
    let up = [0, 1, 0];
    const nPts = pts.length;

    for (let k = 0; k < nPts; k++) {
      const p = pts[k];
      const prev = pts[max(k - 1, 0)];
      const next = pts[min(k + 1, nPts - 1)];
      let tx = next[0] - prev[0], ty = next[1] - prev[1], tz = next[2] - prev[2];
      const tl = hypot(tx, ty, tz) || 1;
      tx /= tl; ty /= tl; tz /= tl;

      // Coordinate frame
      let sx = up[1] * tz - up[2] * ty, sy = up[2] * tx - up[0] * tz, sz = up[0] * ty - up[1] * tx;
      let sl = hypot(sx, sy, sz);
      if (sl < 0.01) {
        up = [1, 0, 0];
        sx = up[1] * tz - up[2] * ty; sy = up[2] * tx - up[0] * tz; sz = up[0] * ty - up[1] * tx;
        sl = hypot(sx, sy, sz) || 1;
      }
      sx /= sl; sy /= sl; sz /= sl;
      const ux = ty * sz - tz * sy, uy = tz * sx - tx * sz, uz = tx * sy - ty * sx;
      up = [ux, uy, uz];

      const r = typeof radiusFn === 'function' ? radiusFn(k / (nPts - 1), k) : radiusFn;
      const ring = [];
      const vCoord = k / (nPts - 1);
      const col = colorFn ? colorFn(vCoord, k) : [1, 1, 1, 1];

      for (let s = 0; s < sides; s++) {
        const theta = (s / sides) * TAU;
        const cosT = cos(theta), sinT = sin(theta);
        const nx = sx * cosT + ux * sinT;
        const ny = sy * cosT + uy * sinT;
        const nz = sz * cosT + uz * sinT;
        const px = p[0] + nx * r;
        const py = p[1] + ny * r;
        const pz = p[2] + nz * r;
        const idx = this.vertex(px, py, pz, nx, ny, nz, s / sides, vCoord, col[0], col[1], col[2], col[3] ?? 1);
        ring.push(idx);
      }
      rings.push(ring);
    }

    // Connect tube sides
    for (let k = 0; k < nPts - 1; k++) {
      for (let s = 0; s < sides; s++) {
        const nextS = (s + 1) % sides;
        this.quad(rings[k][s], rings[k][nextS], rings[k + 1][nextS], rings[k + 1][s]);
      }
    }

    // Caps
    if (capStart) {
      const p = pts[0];
      const c = this.vertex(p[0], p[1], p[2], 0, 0, -1, 0.5, 0);
      for (let s = 0; s < sides; s++) this.tri(c, rings[0][(s + 1) % sides], rings[0][s]);
    }
    if (capEnd) {
      const p = pts[nPts - 1];
      const c = this.vertex(p[0], p[1], p[2], 0, 0, 1, 0.5, 1);
      for (let s = 0; s < sides; s++) this.tri(c, rings[nPts - 1][s], rings[nPts - 1][(s + 1) % sides]);
    }
  }

  // Recompute area-weighted smooth normals
  computeVertexNormals() {
    const p = this.positions, idx = this.indices;
    const n = new Float32Array(p.length);
    for (let i = 0; i < idx.length; i += 3) {
      const i0 = idx[i] * 3, i1 = idx[i + 1] * 3, i2 = idx[i + 2] * 3;
      const ax = p[i1] - p[i0], ay = p[i1 + 1] - p[i0 + 1], az = p[i1 + 2] - p[i0 + 2];
      const bx = p[i2] - p[i0], by = p[i2 + 1] - p[i0 + 1], bz = p[i2 + 2] - p[i0 + 2];
      const nx = ay * bz - az * by;
      const ny = az * bx - ax * bz;
      const nz = ax * by - ay * bx;
      n[i0] += nx; n[i0 + 1] += ny; n[i0 + 2] += nz;
      n[i1] += nx; n[i1 + 1] += ny; n[i1 + 2] += nz;
      n[i2] += nx; n[i2 + 1] += ny; n[i2 + 2] += nz;
    }
    for (let i = 0; i < p.length; i += 3) {
      const l = hypot(n[i], n[i + 1], n[i + 2]) || 1;
      this.normals[i] = n[i] / l;
      this.normals[i + 1] = n[i + 1] / l;
      this.normals[i + 2] = n[i + 2] / l;
    }
  }

  toBuffers() {
    return {
      positions: new Float32Array(this.positions),
      normals: new Float32Array(this.normals),
      uvs: new Float32Array(this.uvs),
      colors: new Float32Array(this.colors),
      indices: new Uint16Array(this.indices),
      vertexCount: this.positions.length / 3,
      indexCount: this.indices.length
    };
  }
}
