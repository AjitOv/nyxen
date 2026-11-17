// ============================================================================
// NYXEN — First-Person Fish Physics & Camera Kinematics
// Biologically realistic swimming dynamics, spine undulation, banking roll,
// drag, buoyancy, sprint burst, soft collision repulsion, and dual-perspective cameras.
// ============================================================================

import { Vec3, Quat, Mat4, clamp, sin, cos, abs, max, min, hypot, PI, TAU } from './math.js';
import { SPECIES_DATA, SPECIES } from './species.js';

export const CAMERA_MODES = {
  FIRST_PERSON: 'first_person', // Locked at fish eye position
  CHASE_CAM: 'chase_cam',       // Third-person dynamic trailing chase camera
  FREE_LOOK: 'free_look'        // Cinematic inspection camera
};

export class FishPhysics {
  constructor(speciesId = SPECIES.CLOWNFISH) {
    this.speciesId = speciesId;
    this.spec = SPECIES_DATA[speciesId];

    // Spatial State
    this.position = Vec3.create(0, -18, 0); // Start in comfortable mid-water
    this.velocity = Vec3.create(0, 0, 0);
    this.forward = Vec3.create(0, 0, 1);
    this.up = Vec3.create(0, 1, 0);
    this.right = Vec3.create(1, 0, 0);

    // Orientation angles (Euler)
    this.yaw = 0.0;
    this.pitch = 0.0;
    this.roll = 0.0;
    this.targetRoll = 0.0;
    this.orientation = Quat.create();

    // Locomotion & Physics Parameters
    this.currentSpeed = 0.0;
    this.stamina = 1.0;          // 0 to 1
    this.isBursting = false;
    this.tailPhase = 0.0;
    this.tailFrequency = 2.0;    // Radians per sec
    this.tailAmplitude = 0.0;
    this.pectoralPhase = 0.0;

    // Environmental bounds
    this.waterSurfaceY = -0.5;   // Ocean surface ceiling
    this.maxDepthY = -52.0;      // Abyssal floor floor limit

    // Camera
    this.cameraMode = CAMERA_MODES.CHASE_CAM;
    this.camPos = Vec3.create(0, -17.5, -3.5);
    this.camTarget = Vec3.create(0, -18, 0);
    this.camUp = Vec3.create(0, 1, 0);
    this.viewMatrix = Mat4.create();

    // Smoothing vectors
    this._tempV = Vec3.create();
    this._tempV2 = Vec3.create();
    this._accel = Vec3.create();
  }

  setSpecies(speciesId) {
    if (!SPECIES_DATA[speciesId]) return;
    this.speciesId = speciesId;
    this.spec = SPECIES_DATA[speciesId];
  }

  toggleCameraMode() {
    if (this.cameraMode === CAMERA_MODES.FIRST_PERSON) {
      this.cameraMode = CAMERA_MODES.CHASE_CAM;
    } else {
      this.cameraMode = CAMERA_MODES.FIRST_PERSON;
    }
    return this.cameraMode;
  }

  update(dt, input, terrainQuery = null) {
    if (dt <= 0 || dt > 0.1) dt = 0.016; // Clamp large step glitches

    const spec = this.spec;

    // 1. Process Steering (Yaw & Pitch)
    const turnSpeed = spec.turnRate;
    const yawDelta = (input.yaw || 0) * turnSpeed * dt;
    const pitchDelta = (input.pitch || 0) * turnSpeed * dt;

    this.yaw += yawDelta;
    this.pitch = clamp(this.pitch + pitchDelta, -1.25, 1.25); // ~70 deg max pitch

    // 2. Sprint / Burst handling & Stamina
    if (input.sprint && this.stamina > 0.05 && (input.forward || input.ascend || input.descend)) {
      this.isBursting = true;
      this.stamina = max(0.0, this.stamina - dt * 0.35);
    } else {
      this.isBursting = false;
      this.stamina = min(1.0, this.stamina + dt * 0.25 * spec.staminaRegen);
    }

    const targetSpeed = this.isBursting ? spec.burstSpeed : spec.speed;

    // 3. Forward & Vertical Thrust
    this._accel[0] = 0; this._accel[1] = 0; this._accel[2] = 0;

    // Direction vectors from Yaw & Pitch
    const cy = cos(this.yaw), sy = sin(this.yaw);
    const cp = cos(this.pitch), sp = sin(this.pitch);

    this.forward[0] = sy * cp;
    this.forward[1] = sp;
    this.forward[2] = cy * cp;
    Vec3.normalize(this.forward, this.forward);

    // Lateral right vector
    this.right[0] = cy;
    this.right[1] = 0;
    this.right[2] = -sy;
    Vec3.normalize(this.right, this.right);

    // Biological banking roll when turning
    const yawRate = (input.yaw || 0);
    this.targetRoll = clamp(-yawRate * 0.65 * (this.currentSpeed / (spec.speed + 0.1)), -0.75, 0.75);
    this.roll += (this.targetRoll - this.roll) * min(1.0, dt * 5.0);

    // Compute Up vector factoring pitch, yaw, and banking roll
    Vec3.cross(this.up, this.right, this.forward);
    // Apply roll rotation around forward axis
    const cr = cos(this.roll), sr = sin(this.roll);
    const rolledRightX = this.right[0] * cr + this.up[0] * sr;
    const rolledRightY = this.right[1] * cr + this.up[1] * sr;
    const rolledRightZ = this.right[2] * cr + this.up[2] * sr;
    this.right[0] = rolledRightX; this.right[1] = rolledRightY; this.right[2] = rolledRightZ;
    Vec3.cross(this.up, this.forward, this.right);
    Vec3.normalize(this.up, this.up);

    // Forward drive
    let forwardThrust = 0;
    if (input.forward) forwardThrust += 1.0;
    if (input.backward) forwardThrust -= 0.45;

    // Strafe drive
    let strafeThrust = 0;
    if (input.strafeRight) strafeThrust += 0.5;
    if (input.strafeLeft) strafeThrust -= 0.5;

    // Vertical ascend / descend drive
    let verticalThrust = 0;
    if (input.ascend) verticalThrust += 0.8;
    if (input.descend) verticalThrust -= 0.8;

    // Acceleration magnitude
    const accelRate = (this.isBursting ? 32.0 : 16.0) / spec.mass;
    this._accel[0] += (this.forward[0] * forwardThrust + this.right[0] * strafeThrust) * accelRate;
    this._accel[1] += (this.forward[1] * forwardThrust + verticalThrust) * accelRate;
    this._accel[2] += (this.forward[2] * forwardThrust + this.right[2] * strafeThrust) * accelRate;

    // Hydrodynamic Drag: F_drag = -k * v * |v|
    const speed = Vec3.length(this.velocity);
    const dragCoeff = spec.drag * 0.55;
    this._accel[0] -= this.velocity[0] * speed * dragCoeff;
    this._accel[1] -= this.velocity[1] * speed * dragCoeff;
    this._accel[2] -= this.velocity[2] * speed * dragCoeff;

    // Slight neutral buoyancy oscillation
    const buoyancyFactor = (spec.buoyancy - 1.0) * 2.0;
    this._accel[1] += buoyancyFactor + 0.12 * sin(this.tailPhase * 0.5);

    // Integrate Velocity & Position
    this.velocity[0] += this._accel[0] * dt;
    this.velocity[1] += this._accel[1] * dt;
    this.velocity[2] += this._accel[2] * dt;

    // Velocity clamp to species top limits
    const maxAllowedSpeed = targetSpeed * 1.35;
    const curSpeed = Vec3.length(this.velocity);
    if (curSpeed > maxAllowedSpeed) {
      Vec3.scale(this.velocity, this.velocity, maxAllowedSpeed / curSpeed);
    }
    this.currentSpeed = Vec3.length(this.velocity);

    this.position[0] += this.velocity[0] * dt;
    this.position[1] += this.velocity[1] * dt;
    this.position[2] += this.velocity[2] * dt;

    // 4. Biological Kinematics: Spine Undulation & Pectoral Sculling
    const swimActivity = max(0.2, this.currentSpeed / spec.speed);
    this.tailFrequency = 3.5 + swimActivity * 6.5; // Faster tail beat at higher speed
    this.tailPhase += this.tailFrequency * dt;
    this.tailAmplitude = clamp(0.12 + swimActivity * 0.28, 0.1, 0.45);
    this.pectoralPhase += (4.0 + swimActivity * 8.0) * dt;

    // 5. Environmental Collisions (Surface & Seabed)
    // Surface ceiling
    if (this.position[1] > this.waterSurfaceY - 0.2) {
      this.position[1] = this.waterSurfaceY - 0.2;
      if (this.velocity[1] > 0) this.velocity[1] *= -0.2;
    }

    // Seabed collision
    let floorY = this.maxDepthY;
    if (terrainQuery) {
      floorY = terrainQuery(this.position[0], this.position[2]);
    }
    const minClearance = 0.5 * spec.scale;
    if (this.position[1] < floorY + minClearance) {
      this.position[1] = floorY + minClearance;
      if (this.velocity[1] < 0) this.velocity[1] *= -0.15; // Soft bounce & glide
    }

    // 6. Update Orientation Quaternion
    Quat.fromEuler(this.orientation, this.pitch, this.yaw, this.roll);

    // 7. Camera Computation
    this.updateCamera(dt);
  }

  updateCamera(dt) {
    const spec = this.spec;

    if (this.cameraMode === CAMERA_MODES.FIRST_PERSON) {
      // FIRST PERSON: Eye Position
      // Eye offset in fish local coordinate space
      const eyeL = spec.eyeOffset; // e.g. [0.08, 0.05, 0.22]
      // Use center-eye bridge for first person
      const localEye = Vec3.create(0, eyeL[1] * spec.scale, eyeL[2] * spec.scale);
      Quat.rotateVec3(this._tempV, this.orientation, localEye);
      Vec3.add(this.camPos, this.position, this._tempV);

      // Look direction is forward vector
      Vec3.add(this.camTarget, this.camPos, this.forward);
      Vec3.copy(this.camUp, this.up);
    } else {
      // CHASE CAM: Smooth trailing behind and above fish
      const chaseDistance = 1.8 + spec.scale * 1.4;
      const chaseHeight = 0.45 + spec.scale * 0.4;

      // Ideal camera target position behind fish
      const idealX = this.position[0] - this.forward[0] * chaseDistance + this.up[0] * chaseHeight;
      const idealY = this.position[1] - this.forward[1] * chaseDistance + this.up[1] * chaseHeight;
      const idealZ = this.position[2] - this.forward[2] * chaseDistance + this.up[2] * chaseHeight;

      // Spring-damper interpolation for silky-smooth motion
      const camLerp = min(1.0, dt * 7.5);
      this.camPos[0] += (idealX - this.camPos[0]) * camLerp;
      this.camPos[1] += (idealY - this.camPos[1]) * camLerp;
      this.camPos[2] += (idealZ - this.camPos[2]) * camLerp;

      // Keep camera submerged below water surface
      if (this.camPos[1] > this.waterSurfaceY - 0.25) {
        this.camPos[1] = this.waterSurfaceY - 0.25;
      }

      // Look slightly ahead of fish head
      this.camTarget[0] = this.position[0] + this.forward[0] * (spec.scale * 0.8);
      this.camTarget[1] = this.position[1] + this.forward[1] * (spec.scale * 0.8);
      this.camTarget[2] = this.position[2] + this.forward[2] * (spec.scale * 0.8);

      Vec3.lerp(this.camUp, this.camUp, this.up, dt * 5.0);
      Vec3.normalize(this.camUp, this.camUp);
    }

    // Build View Matrix
    Mat4.lookAt(this.viewMatrix, this.camPos, this.camTarget, this.camUp);
  }
}
