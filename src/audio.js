// ============================================================================
// NYXEN — 100% Procedural Web Audio Marine Soundscape
// Generative underwater ambience, dynamic swimming speed rush, bubble bursts,
// melodic pentatonic reef chimes, distant whale calls, and UI discovery audio.
// Adapted & evolved from technical references in Abyssal Garden.
// ============================================================================

import { rnd, rr, clamp, exp, pow, sin, cos } from './math.js';

export class MarineAudio {
  constructor() {
    this.ctx = null;
    this.masterGain = null;
    this.rushGain = null;
    this.rushFilter = null;
    this.washGain = null;
    this.muted = false;
    this.volume = 0.8;
    this.isInitialized = false;

    // Timers
    this.nextBubbleTime = 1.5;
    this.nextWhaleTime = 14.0;
    this.nextChimeTime = 6.0;
  }

  init() {
    if (this.isInitialized) return;
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;

    this.ctx = new AudioContext({ latencyHint: 'playback' });
    const ac = this.ctx;
    const sr = ac.sampleRate;

    // Master Dynamics Compressor to prevent clipping
    const compressor = ac.createDynamicsCompressor();
    compressor.threshold.value = -6;
    compressor.knee.value = 6;
    compressor.ratio.value = 16;
    compressor.attack.value = 0.003;
    compressor.release.value = 0.25;
    compressor.connect(ac.destination);

    this.masterGain = ac.createGain();
    this.masterGain.gain.setValueAtTime(this.muted ? 0 : this.volume, ac.currentTime);
    this.masterGain.connect(compressor);

    // Brown noise buffer generation (10 seconds loop)
    const noiseLength = sr * 10;
    const noiseBuffer = ac.createBuffer(2, noiseLength, sr);
    for (let ch = 0; ch < 2; ch++) {
      const data = noiseBuffer.getChannelData(ch);
      let last = 0;
      for (let i = 0; i < noiseLength; i++) {
        const white = rnd() * 2 - 1;
        last = (last + 0.02 * white) / 1.02;
        data[i] = last * 3.5;
      }
    }

    // 1. Ocean Bed Deep Rumble
    const rumbleSource = ac.createBufferSource();
    rumbleSource.buffer = noiseBuffer;
    rumbleSource.loop = true;
    const rumbleFilter = ac.createBiquadFilter();
    rumbleFilter.type = 'lowpass';
    rumbleFilter.frequency.value = 120;
    rumbleFilter.Q.value = 0.8;
    const rumbleGain = ac.createGain();
    rumbleGain.gain.value = 0.32;
    rumbleSource.connect(rumbleFilter);
    rumbleFilter.connect(rumbleGain);
    rumbleGain.connect(this.masterGain);
    rumbleSource.start();

    // 2. Surface Wash
    const washSource = ac.createBufferSource();
    washSource.buffer = noiseBuffer;
    washSource.loop = true;
    washSource.playbackRate.value = 0.65;
    const washFilter = ac.createBiquadFilter();
    washFilter.type = 'bandpass';
    washFilter.frequency.value = 380;
    washFilter.Q.value = 0.5;
    this.washGain = ac.createGain();
    this.washGain.gain.value = 0.2;
    washSource.connect(washFilter);
    washFilter.connect(this.washGain);
    this.washGain.connect(this.masterGain);
    washSource.start();

    // 3. Dynamic Swimming Rush (Follows fish speed)
    const rushSource = ac.createBufferSource();
    rushSource.buffer = noiseBuffer;
    rushSource.loop = true;
    rushSource.playbackRate.value = 0.95;
    this.rushFilter = ac.createBiquadFilter();
    this.rushFilter.type = 'bandpass';
    this.rushFilter.frequency.value = 240;
    this.rushFilter.Q.value = 1.0;
    this.rushGain = ac.createGain();
    this.rushGain.gain.value = 0.0;
    rushSource.connect(this.rushFilter);
    this.rushFilter.connect(this.rushGain);
    this.rushGain.connect(this.masterGain);
    rushSource.start();

    // 4. Underwater Harmonic Drone (Subtle chord)
    const freqs = [65.41, 98.0, 130.81, 196.0]; // C2, G2, C3, G3
    freqs.forEach(f => {
      const osc = ac.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = f + (rnd() - 0.5) * 0.15;
      const gain = ac.createGain();
      gain.gain.value = 0.015;
      osc.connect(gain);
      gain.connect(this.masterGain);
      osc.start();
    });

    this.isInitialized = true;
  }

  resume() {
    if (!this.isInitialized) {
      this.init();
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  toggleMute() {
    this.muted = !this.muted;
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setTargetAtTime(this.muted ? 0 : this.volume, this.ctx.currentTime, 0.08);
    }
    return this.muted;
  }

  update(dt, speed, depthY, isBursting) {
    if (!this.isInitialized || !this.ctx || this.ctx.state !== 'running') return;

    const t = this.ctx.currentTime;

    // 1. Update Swimming Rush based on current speed
    const normalizedSpeed = clamp(speed / 16.0, 0.0, 1.0);
    const rushTargetGain = (isBursting ? 0.45 : 0.25) * pow(normalizedSpeed, 1.3);
    const rushTargetFreq = 220 + normalizedSpeed * 420;

    this.rushGain.gain.setTargetAtTime(rushTargetGain, t, 0.15);
    this.rushFilter.frequency.setTargetAtTime(rushTargetFreq, t, 0.15);

    // 2. Surface Wash louder when near water surface
    const surfaceProximity = clamp(1.0 + depthY / 15.0, 0.0, 1.0);
    this.washGain.gain.setTargetAtTime(0.08 + 0.35 * surfaceProximity, t, 0.3);

    // 3. Periodic Natural Bubbles
    if (t > this.nextBubbleTime) {
      this.playBubbleBurst();
      this.nextBubbleTime = t + rr(2.5, 6.0);
    }

    // 4. Distant Oceanic Whale Calls
    if (t > this.nextWhaleTime) {
      this.playWhaleSong();
      this.nextWhaleTime = t + rr(18.0, 35.0);
    }

    // 5. Melodic Coral Chimes
    if (t > this.nextChimeTime) {
      this.playChime();
      this.nextChimeTime = t + rr(4.0, 9.0);
    }
  }

  playBubbleBurst() {
    if (!this.isInitialized || this.muted) return;
    const ac = this.ctx;
    const t = ac.currentTime;
    const numBubbles = Math.floor(rr(2, 5));

    for (let i = 0; i < numBubbles; i++) {
      const osc = ac.createOscillator();
      const gain = ac.createGain();
      const f0 = rr(420, 950);
      const f1 = f0 * rr(1.3, 1.9);
      const dur = rr(0.06, 0.12);
      const delay = i * rr(0.05, 0.14);

      osc.type = 'sine';
      osc.frequency.setValueAtTime(f0, t + delay);
      osc.frequency.exponentialRampToValueAtTime(f1, t + delay + dur);

      gain.gain.setValueAtTime(0, t + delay);
      gain.gain.linearRampToValueAtTime(0.06, t + delay + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.001, t + delay + dur);

      osc.connect(gain);
      gain.connect(this.masterGain);

      osc.start(t + delay);
      osc.stop(t + delay + dur + 0.05);
    }
  }

  playWhaleSong() {
    if (!this.isInitialized || this.muted) return;
    const ac = this.ctx;
    const t = ac.currentTime;

    const osc = ac.createOscillator();
    const gain = ac.createGain();
    const dur = rr(2.5, 4.5);
    const f0 = rr(180, 320);
    const f1 = f0 * rr(0.65, 1.4);

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(f0, t);
    osc.frequency.exponentialRampToValueAtTime(f1, t + dur);

    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(0.08, t + dur * 0.35);
    gain.gain.setTargetAtTime(0, t + dur * 0.7, dur * 0.3);

    osc.connect(gain);
    gain.connect(this.masterGain);

    osc.start(t);
    osc.stop(t + dur + 0.5);
  }

  playChime() {
    if (!this.isInitialized || this.muted) return;
    const ac = this.ctx;
    const t = ac.currentTime;

    // D Major Pentatonic notes
    const NOTES = [293.66, 329.63, 369.99, 440.0, 493.88, 587.33];
    const freq = NOTES[Math.floor(rnd() * NOTES.length)];

    const osc = ac.createOscillator();
    const gain = ac.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, t);

    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(0.04, t + 0.04);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 3.5);

    osc.connect(gain);
    gain.connect(this.masterGain);

    osc.start(t);
    osc.stop(t + 3.6);
  }

  playDiscoveryJingle() {
    if (!this.isInitialized || this.muted) return;
    const ac = this.ctx;
    const t = ac.currentTime;

    // Majestic ascending triad
    const notes = [440.0, 554.37, 659.25, 880.0];
    notes.forEach((freq, idx) => {
      const osc = ac.createOscillator();
      const gain = ac.createGain();
      const delay = idx * 0.12;

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, t + delay);

      gain.gain.setValueAtTime(0, t + delay);
      gain.gain.linearRampToValueAtTime(0.12, t + delay + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, t + delay + 1.2);

      osc.connect(gain);
      gain.connect(this.masterGain);

      osc.start(t + delay);
      osc.stop(t + delay + 1.3);
    });
  }

  playPearlCollect() {
    if (!this.isInitialized || this.muted) return;
    const ac = this.ctx;
    const t = ac.currentTime;

    const osc = ac.createOscillator();
    const gain = ac.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(784.0, t); // G5
    osc.frequency.exponentialRampToValueAtTime(1174.66, t + 0.15); // D6

    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(0.15, t + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.4);

    osc.connect(gain);
    gain.connect(this.masterGain);

    osc.start(t);
    osc.stop(t + 0.45);
  }

  // ----------------------------------------------------------------
  // Superpower Audio Synthesizers
  // ----------------------------------------------------------------
  playPowerupPickup(type) {
    if (!this.isInitialized || this.muted) return;
    const ac = this.ctx;
    const t = ac.currentTime;

    // Ascending Celestial Fanfare Arpeggio [C5, E5, G5, C6, E6]
    const notes = [523.25, 659.25, 783.99, 1046.50, 1318.51];
    notes.forEach((freq, idx) => {
      const osc = ac.createOscillator();
      const gain = ac.createGain();
      const delay = idx * 0.08;

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, t + delay);
      osc.frequency.exponentialRampToValueAtTime(freq * 1.05, t + delay + 0.35);

      gain.gain.setValueAtTime(0, t + delay);
      gain.gain.linearRampToValueAtTime(0.18, t + delay + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, t + delay + 0.85);

      osc.connect(gain);
      gain.connect(this.masterGain);

      osc.start(t + delay);
      osc.stop(t + delay + 0.9);
    });
  }

  playShieldDeflect() {
    if (!this.isInitialized || this.muted) return;
    const ac = this.ctx;
    const t = ac.currentTime;

    const osc = ac.createOscillator();
    const gain = ac.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(1480.0, t);
    osc.frequency.exponentialRampToValueAtTime(440.0, t + 0.3);

    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(0.25, t + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.35);

    osc.connect(gain);
    gain.connect(this.masterGain);

    osc.start(t);
    osc.stop(t + 0.4);
  }

  playSonicShockwave() {
    if (!this.isInitialized || this.muted) return;
    const ac = this.ctx;
    const t = ac.currentTime;

    // Sub-bass sonar pulse
    const osc = ac.createOscillator();
    const gain = ac.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(280.0, t);
    osc.frequency.exponentialRampToValueAtTime(45.0, t + 0.8);

    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(0.35, t + 0.03);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 1.2);

    osc.connect(gain);
    gain.connect(this.masterGain);

    osc.start(t);
    osc.stop(t + 1.3);
  }

  playVortexBlast() {
    if (!this.isInitialized || this.muted) return;
    const ac = this.ctx;
    const t = ac.currentTime;

    const osc = ac.createOscillator();
    const gain = ac.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(120.0, t);
    osc.frequency.exponentialRampToValueAtTime(680.0, t + 0.25);
    osc.frequency.exponentialRampToValueAtTime(90.0, t + 0.6);

    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(0.28, t + 0.04);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.65);

    osc.connect(gain);
    gain.connect(this.masterGain);

    osc.start(t);
    osc.stop(t + 0.7);
  }
}
