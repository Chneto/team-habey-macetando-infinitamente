import saveManager from './SaveManager.js';

class SoundManager {
  constructor() {
    this.ctx = null;
    this.lastGemSoundTime = 0;
    this.lastHitSoundTime = 0;
  }

  initContext() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') {
        this.ctx.resume().catch(() => {});
      }
      return this.ctx;
    }
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return null;
    try {
      this.ctx = new AudioCtx();
      return this.ctx;
    } catch (_err) {
      return null;
    }
  }

  playTone({ freq = 440, endFreq = null, duration = 0.12, type = 'sine', volume = 0.12, delay = 0 }) {
    if (saveManager.data?.settings?.muted) return;
    const ctx = this.initContext();
    if (!ctx) return;

    try {
      const now = ctx.currentTime + delay;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = type;
      osc.frequency.setValueAtTime(freq, now);
      if (endFreq !== null) {
        osc.frequency.exponentialRampToValueAtTime(Math.max(20, endFreq), now + duration);
      }

      gain.gain.setValueAtTime(Math.max(0.001, volume), now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + duration + 0.02);
    } catch (_err) {
      // Ignore audio scheduling errors in headless browsers
    }
  }

  playGemPickup(isSuper = false) {
    const now = performance.now();
    if (now - this.lastGemSoundTime < 35) return;
    this.lastGemSoundTime = now;
    if (isSuper) {
      this.playTone({ freq: 587.33, endFreq: 1174.66, duration: 0.18, type: 'triangle', volume: 0.14 });
    } else {
      this.playTone({ freq: 660 + Math.random() * 140, endFreq: 990, duration: 0.08, type: 'sine', volume: 0.08 });
    }
  }

  playHit(isCrit = false) {
    const now = performance.now();
    if (now - this.lastHitSoundTime < 40) return;
    this.lastHitSoundTime = now;
    if (isCrit) {
      this.playTone({ freq: 320, endFreq: 110, duration: 0.11, type: 'sawtooth', volume: 0.12 });
    } else {
      this.playTone({ freq: 190, endFreq: 75, duration: 0.07, type: 'triangle', volume: 0.07 });
    }
  }

  playReaction() {
    this.playTone({ freq: 260, endFreq: 680, duration: 0.16, type: 'sawtooth', volume: 0.14 });
    this.playTone({ freq: 520, endFreq: 880, duration: 0.22, type: 'triangle', volume: 0.12, delay: 0.05 });
  }

  playDash() {
    this.playTone({ freq: 420, endFreq: 150, duration: 0.14, type: 'sine', volume: 0.12 });
  }

  playLevelUp() {
    const notes = [523.25, 659.25, 783.99, 1046.5];
    notes.forEach((n, idx) => {
      this.playTone({ freq: n, endFreq: n * 1.02, duration: 0.18, type: 'triangle', volume: 0.14, delay: idx * 0.07 });
    });
  }

  playEvolution() {
    const notes = [440, 554.37, 659.25, 880, 1108.73];
    notes.forEach((n, idx) => {
      this.playTone({ freq: n, endFreq: n * 1.05, duration: 0.24, type: 'sawtooth', volume: 0.15, delay: idx * 0.08 });
    });
  }

  playBossSpawn() {
    this.playTone({ freq: 140, endFreq: 65, duration: 0.65, type: 'sawtooth', volume: 0.20 });
    this.playTone({ freq: 98, endFreq: 49, duration: 0.75, type: 'square', volume: 0.15, delay: 0.15 });
  }

  playChestBreak() {
    this.playTone({ freq: 480, endFreq: 960, duration: 0.15, type: 'triangle', volume: 0.15 });
    this.playTone({ freq: 720, endFreq: 1240, duration: 0.22, type: 'sine', volume: 0.15, delay: 0.08 });
  }

  playButtonClick() {
    this.playTone({ freq: 480, endFreq: 320, duration: 0.05, type: 'sine', volume: 0.09 });
  }
}

export const soundManager = new SoundManager();
export default soundManager;
