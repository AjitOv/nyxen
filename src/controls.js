// ============================================================================
// NYXEN — Desktop Keyboard/Mouse & Mobile Touch Controls
// Smooth analog steering, PointerLock, virtual touch joysticks & gesture controls.
// ============================================================================

import { clamp } from './math.js';

export class InputManager {
  constructor(canvas) {
    this.canvas = canvas;

    // Movement state
    this.input = {
      forward: false,
      backward: false,
      strafeLeft: false,
      strafeRight: false,
      ascend: false,
      descend: false,
      sprint: false,
      yaw: 0.0,
      pitch: 0.0
    };

    this.mouseSensitivity = 0.0022;
    this.isPointerLocked = false;
    this.isTouchDevice = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0);

    // Callbacks
    this.onToggleCamera = null;
    this.onSelectSpecies = null;
    this.onToggleJournal = null;
    this.onToggleMute = null;

    // Touch joystick trackers
    this.touches = new Map();
    this.leftStick = { active: false, id: null, startX: 0, startY: 0, curX: 0, curY: 0 };
    this.rightStick = { active: false, id: null, startX: 0, startY: 0, curX: 0, curY: 0 };

    this.initDesktop();
    if (this.isTouchDevice) {
      this.initTouch();
    }
  }

  initDesktop() {
    window.addEventListener('keydown', (e) => {
      // Ignore if typing in text inputs
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

      switch (e.code) {
        case 'KeyW':
        case 'ArrowUp':
          this.input.forward = true;
          break;
        case 'KeyS':
        case 'ArrowDown':
          this.input.backward = true;
          break;
        case 'KeyA':
        case 'ArrowLeft':
          this.input.strafeLeft = true;
          break;
        case 'KeyD':
        case 'ArrowRight':
          this.input.strafeRight = true;
          break;
        case 'Space':
        case 'KeyE':
          this.input.ascend = true;
          e.preventDefault();
          break;
        case 'KeyQ':
          this.input.descend = true;
          break;
        case 'ShiftLeft':
        case 'ShiftRight':
          this.input.sprint = true;
          break;
        case 'KeyV':
          if (this.onToggleCamera) this.onToggleCamera();
          break;
        case 'KeyM':
          if (this.onToggleMute) this.onToggleMute();
          break;
        case 'Tab':
        case 'KeyJ':
          e.preventDefault();
          if (this.onToggleJournal) this.onToggleJournal();
          break;
        // Number keys 1-8 for instant species quick-select!
        case 'Digit1': if (this.onSelectSpecies) this.onSelectSpecies(0); break;
        case 'Digit2': if (this.onSelectSpecies) this.onSelectSpecies(1); break;
        case 'Digit3': if (this.onSelectSpecies) this.onSelectSpecies(2); break;
        case 'Digit4': if (this.onSelectSpecies) this.onSelectSpecies(3); break;
        case 'Digit5': if (this.onSelectSpecies) this.onSelectSpecies(4); break;
        case 'Digit6': if (this.onSelectSpecies) this.onSelectSpecies(5); break;
        case 'Digit7': if (this.onSelectSpecies) this.onSelectSpecies(6); break;
        case 'Digit8': if (this.onSelectSpecies) this.onSelectSpecies(7); break;
      }
    });

    window.addEventListener('keyup', (e) => {
      switch (e.code) {
        case 'KeyW':
        case 'ArrowUp':
          this.input.forward = false;
          break;
        case 'KeyS':
        case 'ArrowDown':
          this.input.backward = false;
          break;
        case 'KeyA':
        case 'ArrowLeft':
          this.input.strafeLeft = false;
          break;
        case 'KeyD':
        case 'ArrowRight':
          this.input.strafeRight = false;
          break;
        case 'Space':
        case 'KeyE':
          this.input.ascend = false;
          break;
        case 'KeyQ':
          this.input.descend = false;
          break;
        case 'ShiftLeft':
        case 'ShiftRight':
          this.input.sprint = false;
          break;
      }
    });

    // PointerLock for smooth mouse look
    this.canvas.addEventListener('click', () => {
      if (!this.isPointerLocked && document.pointerLockElement !== this.canvas) {
        this.canvas.requestPointerLock().catch(() => {});
      }
    });

    document.addEventListener('pointerlockchange', () => {
      this.isPointerLocked = (document.pointerLockElement === this.canvas);
    });

    window.addEventListener('mousemove', (e) => {
      if (this.isPointerLocked) {
        // Delta mouse controls yaw and pitch
        this.input.yaw -= e.movementX * this.mouseSensitivity;
        this.input.pitch -= e.movementY * this.mouseSensitivity;
      }
    });
  }

  initTouch() {
    const el = this.canvas;

    el.addEventListener('touchstart', (e) => {
      e.preventDefault();
      const rect = el.getBoundingClientRect();
      const halfW = rect.width * 0.5;

      for (let i = 0; i < e.changedTouches.length; i++) {
        const t = e.changedTouches[i];
        const x = t.clientX - rect.left;
        const y = t.clientY - rect.top;

        if (x < halfW && !this.leftStick.active) {
          // Left half -> Move stick
          this.leftStick.active = true;
          this.leftStick.id = t.identifier;
          this.leftStick.startX = x;
          this.leftStick.startY = y;
          this.leftStick.curX = x;
          this.leftStick.curY = y;
        } else if (x >= halfW && !this.rightStick.active) {
          // Right half -> Aim/Turn stick
          this.rightStick.active = true;
          this.rightStick.id = t.identifier;
          this.rightStick.startX = x;
          this.rightStick.startY = y;
          this.rightStick.curX = x;
          this.rightStick.curY = y;
        }
      }
    }, { passive: false });

    el.addEventListener('touchmove', (e) => {
      e.preventDefault();
      const rect = el.getBoundingClientRect();

      for (let i = 0; i < e.changedTouches.length; i++) {
        const t = e.changedTouches[i];
        const x = t.clientX - rect.left;
        const y = t.clientY - rect.top;

        if (this.leftStick.active && t.identifier === this.leftStick.id) {
          this.leftStick.curX = x;
          this.leftStick.curY = y;
          const dx = x - this.leftStick.startX;
          const dy = y - this.leftStick.startY;
          this.input.forward = dy < -18;
          this.input.backward = dy > 18;
          this.input.strafeLeft = dx < -18;
          this.input.strafeRight = dx > 18;
        } else if (this.rightStick.active && t.identifier === this.rightStick.id) {
          const dx = x - this.rightStick.curX;
          const dy = y - this.rightStick.curY;
          this.rightStick.curX = x;
          this.rightStick.curY = y;
          this.input.yaw -= dx * 0.006;
          this.input.pitch -= dy * 0.006;
        }
      }
    }, { passive: false });

    const endTouch = (e) => {
      for (let i = 0; i < e.changedTouches.length; i++) {
        const t = e.changedTouches[i];
        if (this.leftStick.active && t.identifier === this.leftStick.id) {
          this.leftStick.active = false;
          this.leftStick.id = null;
          this.input.forward = false;
          this.input.backward = false;
          this.input.strafeLeft = false;
          this.input.strafeRight = false;
        } else if (this.rightStick.active && t.identifier === this.rightStick.id) {
          this.rightStick.active = false;
          this.rightStick.id = null;
        }
      }
    };

    el.addEventListener('touchend', endTouch, { passive: false });
    el.addEventListener('touchcancel', endTouch, { passive: false });
  }

  // Drain frame deltas
  getFrameInput() {
    const frame = {
      forward: this.input.forward,
      backward: this.input.backward,
      strafeLeft: this.input.strafeLeft,
      strafeRight: this.input.strafeRight,
      ascend: this.input.ascend,
      descend: this.input.descend,
      sprint: this.input.sprint,
      yaw: this.input.yaw,
      pitch: this.input.pitch
    };

    // Reset frame delta mouse turns
    this.input.yaw = 0.0;
    this.input.pitch = 0.0;

    return frame;
  }
}
