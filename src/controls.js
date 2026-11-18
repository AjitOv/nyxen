// ============================================================================
// NYXEN — Desktop Keyboard/Mouse & Mobile Dual-Touch Ergonomic Controls
// Smooth analog steering, PointerLock, virtual dynamic joystick, camera swipe pad,
// dedicated combat action buttons, and full responsive touch gesture handling.
// ============================================================================

import { clamp, hypot, sin, cos, atan2, min, max } from './math.js';

export class InputManager {
  constructor(canvas) {
    this.canvas = canvas;

    // Movement & Combat State
    this.input = {
      forward: false,
      backward: false,
      strafeLeft: false,
      strafeRight: false,
      analogForward: 0.0,
      analogStrafe: 0.0,
      ascend: false,
      descend: false,
      sprint: false,
      fire: false,
      fireSecondary: false,
      yaw: 0.0,
      pitch: 0.0
    };

    this.mouseSensitivity = 0.0022;
    this.touchSensitivity = 0.0055;
    this.isPointerLocked = false;
    this.isTouchDevice = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0) || (window.innerWidth <= 1024);

    // Callbacks
    this.onToggleCamera = null;
    this.onSelectSpecies = null;
    this.onToggleJournal = null;
    this.onToggleMute = null;
    this.onPhotoMode = null;
    this.onToggleRoyale = null;

    // Virtual Joystick & Touch Aiming State
    this.leftStick = {
      active: false,
      id: null,
      startX: 0,
      startY: 0,
      curX: 0,
      curY: 0,
      maxRadius: 46
    };

    this.rightTouch = {
      active: false,
      id: null,
      lastX: 0,
      lastY: 0
    };

    this.initDesktop();
    this.initTouch();
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
        // Number keys 1-0 for instant species quick-select!
        case 'Digit1': if (this.onSelectSpecies) this.onSelectSpecies(0); break;
        case 'Digit2': if (this.onSelectSpecies) this.onSelectSpecies(1); break;
        case 'Digit3': if (this.onSelectSpecies) this.onSelectSpecies(2); break;
        case 'Digit4': if (this.onSelectSpecies) this.onSelectSpecies(3); break;
        case 'Digit5': if (this.onSelectSpecies) this.onSelectSpecies(4); break;
        case 'Digit6': if (this.onSelectSpecies) this.onSelectSpecies(5); break;
        case 'Digit7': if (this.onSelectSpecies) this.onSelectSpecies(6); break;
        case 'Digit8': if (this.onSelectSpecies) this.onSelectSpecies(7); break;
        case 'Digit9': if (this.onSelectSpecies) this.onSelectSpecies(8); break;
        case 'Digit0': if (this.onSelectSpecies) this.onSelectSpecies(9); break;
        case 'KeyP': if (this.onPhotoMode) this.onPhotoMode(); break;
        case 'KeyR':
        case 'KeyB':
          if (this.onToggleRoyale) this.onToggleRoyale();
          break;
        case 'KeyF':
          this.input.fireSecondary = true;
          break;
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
        case 'KeyF':
          this.input.fireSecondary = false;
          break;
      }
    });

    // Mouse buttons for firing water jet and secondary venom
    window.addEventListener('mousedown', (e) => {
      // Ignore if clicking on UI buttons or modals
      if (e.target.closest('button, .modal-content, .hud-header, .hud-footer, .species-card')) return;
      if (e.button === 0) {
        this.input.fire = true;
      } else if (e.button === 2) {
        this.input.fireSecondary = true;
      }
    });

    window.addEventListener('mouseup', (e) => {
      if (e.button === 0) {
        this.input.fire = false;
      } else if (e.button === 2) {
        this.input.fireSecondary = false;
      }
    });

    // Prevent context menu on right-click so right-click fires venom spines cleanly
    this.canvas.addEventListener('contextmenu', (e) => {
      e.preventDefault();
    });

    // PointerLock for smooth mouse look
    this.canvas.addEventListener('click', () => {
      if (!this.isPointerLocked && document.pointerLockElement !== this.canvas && !this.isTouchDevice) {
        this.canvas.requestPointerLock().catch(() => {});
      }
    });

    document.addEventListener('pointerlockchange', () => {
      this.isPointerLocked = (document.pointerLockElement === this.canvas);
    });

    window.addEventListener('mousemove', (e) => {
      if (this.isPointerLocked) {
        this.input.yaw -= e.movementX * this.mouseSensitivity;
        this.input.pitch -= e.movementY * this.mouseSensitivity;
      }
    });
  }

  // =========================================================================
  // Mobile Multi-Touch Ergonomics (Dual Virtual Joystick & Action Buttons)
  // =========================================================================
  initTouch() {
    // 1. Hook Mobile Touch Action Buttons
    const bindTouchBtn = (id, onDown, onUp) => {
      const btn = document.getElementById(id);
      if (!btn) return;

      const handleDown = (e) => {
        e.preventDefault();
        e.stopPropagation();
        btn.classList.add('active');
        if (navigator.vibrate) {
          try { navigator.vibrate(10); } catch (_) {}
        }
        onDown();
      };

      const handleUp = (e) => {
        e.preventDefault();
        e.stopPropagation();
        btn.classList.remove('active');
        onUp();
      };

      btn.addEventListener('pointerdown', handleDown, { passive: false });
      btn.addEventListener('pointerup', handleUp, { passive: false });
      btn.addEventListener('pointercancel', handleUp, { passive: false });
      btn.addEventListener('touchstart', handleDown, { passive: false });
      btn.addEventListener('touchend', handleUp, { passive: false });
      btn.addEventListener('touchcancel', handleUp, { passive: false });
    };

    // Primary Attack: Water Jet
    bindTouchBtn('btn-touch-fire',
      () => { this.input.fire = true; },
      () => { this.input.fire = false; }
    );

    // Secondary Attack: Lionfish Venom Barrage
    bindTouchBtn('btn-touch-venom',
      () => { this.input.fireSecondary = true; },
      () => { this.input.fireSecondary = false; }
    );

    // Sprint Burst
    bindTouchBtn('btn-touch-burst',
      () => { this.input.sprint = true; },
      () => { this.input.sprint = false; }
    );

    // Ascend / Surface
    bindTouchBtn('btn-touch-ascend',
      () => { this.input.ascend = true; },
      () => { this.input.ascend = false; }
    );

    // Descend / Dive
    bindTouchBtn('btn-touch-descend',
      () => { this.input.descend = true; },
      () => { this.input.descend = false; }
    );

    // 2. Dual Touch Zones (Left: Joystick Movement, Right: Camera Look)
    const touchLayer = document.getElementById('touch-controls-layer') || this.canvas;
    const joystickBase = document.getElementById('joystick-base');
    const joystickNipple = document.getElementById('joystick-nipple');

    const updateNippleVisual = (dx, dy) => {
      if (!joystickNipple) return;
      joystickNipple.style.transform = `translate(${dx}px, ${dy}px)`;
    };

    const positionJoystickBase = (x, y) => {
      if (!joystickBase) return;
      joystickBase.style.left = `${x}px`;
      joystickBase.style.top = `${y}px`;
      joystickBase.classList.add('active');
    };

    const resetJoystickVisual = () => {
      if (joystickNipple) {
        joystickNipple.style.transform = 'translate(0px, 0px)';
      }
      if (joystickBase) {
        joystickBase.classList.remove('active');
        // Reset to default ergonomic location
        joystickBase.style.left = '';
        joystickBase.style.top = '';
      }
    };

    touchLayer.addEventListener('touchstart', (e) => {
      const halfW = window.innerWidth * 0.5;

      for (let i = 0; i < e.changedTouches.length; i++) {
        const t = e.changedTouches[i];

        // Ignore touches directly targeting action buttons
        const targetEl = document.elementFromPoint(t.clientX, t.clientY);
        if (targetEl && targetEl.closest('.touch-btn, .glass-btn, .fish-selector-btn, .modal-content')) {
          continue;
        }

        if (t.clientX < halfW && !this.leftStick.active) {
          // Left touch -> Virtual Floating Analog Joystick
          e.preventDefault();
          this.leftStick.active = true;
          this.leftStick.id = t.identifier;
          this.leftStick.startX = t.clientX;
          this.leftStick.startY = t.clientY;
          this.leftStick.curX = t.clientX;
          this.leftStick.curY = t.clientY;

          positionJoystickBase(t.clientX, t.clientY);
          updateNippleVisual(0, 0);
        } else if (t.clientX >= halfW && !this.rightTouch.active) {
          // Right touch -> Smooth Camera Look & Aiming
          e.preventDefault();
          this.rightTouch.active = true;
          this.rightTouch.id = t.identifier;
          this.rightTouch.lastX = t.clientX;
          this.rightTouch.lastY = t.clientY;
        }
      }
    }, { passive: false });

    touchLayer.addEventListener('touchmove', (e) => {
      for (let i = 0; i < e.changedTouches.length; i++) {
        const t = e.changedTouches[i];

        if (this.leftStick.active && t.identifier === this.leftStick.id) {
          e.preventDefault();
          this.leftStick.curX = t.clientX;
          this.leftStick.curY = t.clientY;

          const dx = t.clientX - this.leftStick.startX;
          const dy = t.clientY - this.leftStick.startY;
          const dist = hypot(dx, dy);
          const maxR = this.leftStick.maxRadius;
          const clampedDist = min(dist, maxR);
          const angle = atan2(dy, dx);

          const nippleX = cos(angle) * clampedDist;
          const nippleY = sin(angle) * clampedDist;
          updateNippleVisual(nippleX, nippleY);

          // Proportional analog swimming values
          const normDist = clampedDist / maxR;
          this.input.analogForward = -sin(angle) * normDist;
          this.input.analogStrafe = cos(angle) * normDist;

          // Digital fallbacks for systems checking boolean flags
          this.input.forward = this.input.analogForward > 0.22;
          this.input.backward = this.input.analogForward < -0.22;
          this.input.strafeRight = this.input.analogStrafe > 0.22;
          this.input.strafeLeft = this.input.analogStrafe < -0.22;

        } else if (this.rightTouch.active && t.identifier === this.rightTouch.id) {
          e.preventDefault();
          const dx = t.clientX - this.rightTouch.lastX;
          const dy = t.clientY - this.rightTouch.lastY;
          this.rightTouch.lastX = t.clientX;
          this.rightTouch.lastY = t.clientY;

          this.input.yaw -= dx * this.touchSensitivity;
          this.input.pitch -= dy * this.touchSensitivity;
        }
      }
    }, { passive: false });

    const endTouch = (e) => {
      for (let i = 0; i < e.changedTouches.length; i++) {
        const t = e.changedTouches[i];

        if (this.leftStick.active && t.identifier === this.leftStick.id) {
          this.leftStick.active = false;
          this.leftStick.id = null;
          this.input.analogForward = 0.0;
          this.input.analogStrafe = 0.0;
          this.input.forward = false;
          this.input.backward = false;
          this.input.strafeLeft = false;
          this.input.strafeRight = false;
          resetJoystickVisual();
        } else if (this.rightTouch.active && t.identifier === this.rightTouch.id) {
          this.rightTouch.active = false;
          this.rightTouch.id = null;
        }
      }
    };

    touchLayer.addEventListener('touchend', endTouch, { passive: false });
    touchLayer.addEventListener('touchcancel', endTouch, { passive: false });
  }

  // Drain frame deltas
  getFrameInput() {
    const frame = {
      forward: this.input.forward,
      backward: this.input.backward,
      strafeLeft: this.input.strafeLeft,
      strafeRight: this.input.strafeRight,
      analogForward: this.input.analogForward,
      analogStrafe: this.input.analogStrafe,
      ascend: this.input.ascend,
      descend: this.input.descend,
      sprint: this.input.sprint,
      fire: this.input.fire,
      fireSecondary: this.input.fireSecondary,
      yaw: this.input.yaw,
      pitch: this.input.pitch
    };

    // Reset frame delta mouse / touch turns
    this.input.yaw = 0.0;
    this.input.pitch = 0.0;

    return frame;
  }
}
