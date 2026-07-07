/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

class AudioEngine {
  private ctx: AudioContext | null = null;
  private isMuted: boolean = false;
  private activeLoops: Map<string, { osc?: OscillatorNode; gain: GainNode; filter?: BiquadFilterNode; source?: AudioScheduledSourceNode }> = new Map();

  private initCtx() {
    if (!this.ctx) {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioContextClass) {
        this.ctx = new AudioContextClass();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  setMute(mute: boolean) {
    this.isMuted = mute;
    if (mute) {
      this.stopAll();
    } else {
      this.initCtx();
    }
  }

  getMuted() {
    return this.isMuted;
  }

  stopAll() {
    this.activeLoops.forEach((loop) => {
      try {
        if (loop.osc) loop.osc.stop();
        if (loop.source) loop.source.stop();
      } catch (e) {}
    });
    this.activeLoops.clear();
  }

  playBeep(freq: number, duration: number, type: OscillatorType = 'sine') {
    if (this.isMuted) return;
    this.initCtx();
    if (!this.ctx) return;

    try {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      
      osc.type = type;
      osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
      
      gain.gain.setValueAtTime(0.15, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.0001, this.ctx.currentTime + duration);
      
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      
      osc.start();
      osc.stop(this.ctx.currentTime + duration);
    } catch (e) {}
  }

  playSuccess() {
    if (this.isMuted) return;
    const now = 0;
    setTimeout(() => this.playBeep(523.25, 0.1), now); // C5
    setTimeout(() => this.playBeep(659.25, 0.1), now + 120); // E5
    setTimeout(() => this.playBeep(783.99, 0.1), now + 240); // G5
    setTimeout(() => this.playBeep(1046.50, 0.35), now + 360); // C6
  }

  playFailure() {
    if (this.isMuted) return;
    const now = 0;
    setTimeout(() => this.playBeep(293.66, 0.15, 'triangle'), now); // D4
    setTimeout(() => this.playBeep(220.00, 0.15, 'triangle'), now + 180); // A3
    setTimeout(() => this.playBeep(146.83, 0.4, 'sawtooth'), now + 360); // D3
  }

  startSiren() {
    if (this.isMuted || this.activeLoops.has('siren')) return;
    this.initCtx();
    if (!this.ctx) return;

    try {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(440, this.ctx.currentTime);
      
      // Siren modulation
      const mod = this.ctx.createOscillator();
      const modGain = this.ctx.createGain();
      mod.frequency.value = 1.2; // Siren sweep frequency (Hz)
      modGain.gain.value = 180; // Sweep range
      
      mod.connect(modGain);
      modGain.connect(osc.frequency);
      
      gain.gain.setValueAtTime(0.02, this.ctx.currentTime);
      
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      
      mod.start();
      osc.start();
      
      this.activeLoops.set('siren', { osc, gain, source: mod });
    } catch (e) {}
  }

  stopSiren() {
    const loop = this.activeLoops.get('siren');
    if (loop) {
      try {
        if (loop.osc) loop.osc.stop();
        if (loop.source) loop.source.stop();
      } catch (e) {}
      this.activeLoops.delete('siren');
    }
  }

  startEarthquakeRumble() {
    if (this.isMuted || this.activeLoops.has('rumble')) return;
    this.initCtx();
    if (!this.ctx) return;

    try {
      // Noise buffer or low frequency oscillator
      const osc = this.ctx.createOscillator();
      const osc2 = this.ctx.createOscillator();
      const filter = this.ctx.createBiquadFilter();
      const gain = this.ctx.createGain();

      osc.type = 'sawtooth';
      osc.frequency.value = 35; // Very low base
      
      osc2.type = 'sawtooth';
      osc2.frequency.value = 47;
      
      filter.type = 'lowpass';
      filter.frequency.value = 65; // Cut off high harsh frequencies for rumble
      
      gain.gain.value = 0.08;

      osc.connect(filter);
      osc2.connect(filter);
      filter.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start();
      osc2.start();

      this.activeLoops.set('rumble', { osc, gain, filter, source: osc2 });
    } catch (e) {}
  }

  stopEarthquakeRumble() {
    const loop = this.activeLoops.get('rumble');
    if (loop) {
      try {
        if (loop.osc) loop.osc.stop();
        if (loop.source) loop.source.stop();
      } catch (e) {}
      this.activeLoops.delete('rumble');
    }
  }
}

export const audioEngine = new AudioEngine();
