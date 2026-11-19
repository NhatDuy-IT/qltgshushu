/**
 * ShuShu — Pure Web Audio API Ambient Sound Mixer & Singing Bowl Chime
 * Works 100% offline with zero external audio assets.
 */

export const SOUND_CHANNELS = [
  { id: 'rain', name: 'Tiếng mưa', desc: 'Mưa rơi nhẹ bên cửa sổ', icon: '🌧️' },
  { id: 'forest', name: 'Rừng cây', desc: 'Gió lá xào xạc yên bình', icon: '🌲' },
  { id: 'cafe', name: 'Quán cà phê', desc: 'Không gian ấm áp dịu nhẹ', icon: '☕' },
  { id: 'ocean', name: 'Sóng biển', desc: 'Nhịp sóng vỗ bờ chậm rãi', icon: '🌊' },
  { id: 'white', name: 'Tiếng ồn trắng', desc: 'White Noise tăng tập trung', icon: '🌫️' },
  { id: 'brown', name: 'Tiếng ồn nâu', desc: 'Brown Noise trầm ấm sâu', icon: '🤎' }
];

class AmbientAudioEngine {
  constructor() {
    this.ctx = null;
    this.nodes = new Map();
    this.volumes = {
      rain: 0,
      forest: 0,
      cafe: 0,
      ocean: 0,
      white: 0,
      brown: 0
    };
    this.muted = false;
  }

  _ensureContext() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AudioCtx();
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  _createNoiseBuffer(type = 'white', seconds = 4) {
    const ctx = this._ensureContext();
    const length = ctx.sampleRate * seconds;
    const buffer = ctx.createBuffer(2, length, ctx.sampleRate);

    for (let ch = 0; ch < 2; ch += 1) {
      const data = buffer.getChannelData(ch);
      if (type === 'white') {
        for (let i = 0; i < length; i += 1) {
          data[i] = (Math.random() * 2 - 1) * 0.45;
        }
      } else if (type === 'pink') {
        let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
        for (let i = 0; i < length; i += 1) {
          const w = Math.random() * 2 - 1;
          b0 = 0.99886 * b0 + w * 0.0555179;
          b1 = 0.99332 * b1 + w * 0.0750759;
          b2 = 0.96900 * b2 + w * 0.1538520;
          b3 = 0.86650 * b3 + w * 0.3104856;
          b4 = 0.55000 * b4 + w * 0.5329522;
          b5 = -0.7616 * b5 - w * 0.0168980;
          data[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362) * 0.06;
          b6 = w * 0.115926;
        }
      } else {
        // Brown noise
        let last = 0;
        for (let i = 0; i < length; i += 1) {
          const w = Math.random() * 2 - 1;
          last = (last + 0.02 * w) / 1.02;
          data[i] = last * 2.6;
        }
      }
    }
    return buffer;
  }

  _startChannel(id) {
    const ctx = this._ensureContext();
    const gain = ctx.createGain();
    gain.gain.value = 0;
    gain.connect(ctx.destination);

    const src = ctx.createBufferSource();
    src.loop = true;

    const cleanup = [];

    if (id === 'white') {
      src.buffer = this._createNoiseBuffer('white');
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = 5200;
      src.connect(lp);
      lp.connect(gain);
    } else if (id === 'brown') {
      src.buffer = this._createNoiseBuffer('brown');
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = 460;
      src.connect(lp);
      lp.connect(gain);
    } else if (id === 'rain') {
      src.buffer = this._createNoiseBuffer('pink');
      const bp = ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.value = 1150;
      bp.Q.value = 0.55;
      const hs = ctx.createBiquadFilter();
      hs.type = 'highshelf';
      hs.frequency.value = 3200;
      hs.gain.value = -5;
      src.connect(bp);
      bp.connect(hs);
      hs.connect(gain);
    } else if (id === 'forest') {
      src.buffer = this._createNoiseBuffer('pink');
      const bp = ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.value = 620;
      bp.Q.value = 1.4;

      // Gentle breeze LFO sweeping filter frequency
      const lfo = ctx.createOscillator();
      const lfoGain = ctx.createGain();
      lfo.frequency.value = 0.14;
      lfoGain.gain.value = 260;
      lfo.connect(lfoGain);
      lfoGain.connect(bp.frequency);
      lfo.start();
      cleanup.push(() => lfo.stop());

      src.connect(bp);
      bp.connect(gain);
    } else if (id === 'cafe') {
      src.buffer = this._createNoiseBuffer('brown');
      const bp = ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.value = 420;
      bp.Q.value = 0.9;

      // Subtle warm acoustic drone
      const warmOsc = ctx.createOscillator();
      const warmGain = ctx.createGain();
      warmOsc.type = 'sine';
      warmOsc.frequency.value = 174;
      warmGain.gain.value = 0.025;
      warmOsc.connect(warmGain);
      warmGain.connect(gain);
      warmOsc.start();
      cleanup.push(() => warmOsc.stop());

      src.connect(bp);
      bp.connect(gain);
    } else if (id === 'ocean') {
      src.buffer = this._createNoiseBuffer('pink');
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = 520;

      // Slow wave swell LFO modulating filter & amplitude
      const waveGain = ctx.createGain();
      waveGain.gain.value = 0.65;
      const lfo = ctx.createOscillator();
      const lfoAmp = ctx.createGain();
      const lfoFreq = ctx.createGain();
      lfo.frequency.value = 0.11; // ~9s per wave cycle
      lfoAmp.gain.value = 0.35;
      lfoFreq.gain.value = 300;

      lfo.connect(lfoAmp);
      lfoAmp.connect(waveGain.gain);
      lfo.connect(lfoFreq);
      lfoFreq.connect(lp.frequency);
      lfo.start();
      cleanup.push(() => lfo.stop());

      src.connect(lp);
      lp.connect(waveGain);
      waveGain.connect(gain);
    }

    src.start();
    cleanup.push(() => src.stop());
    this.nodes.set(id, { gain, cleanup });
  }

  setVolume(id, value) {
    const vol = Math.max(0, Math.min(1, Number(value) || 0));
    this.volumes[id] = vol;

    if (vol === 0) {
      this._stopChannel(id);
      return;
    }

    if (!this.nodes.has(id)) {
      this._startChannel(id);
    }

    const node = this.nodes.get(id);
    if (node && this.ctx) {
      const target = this.muted ? 0 : vol * 0.45;
      node.gain.gain.setTargetAtTime(target, this.ctx.currentTime, 0.08);
    }
  }

  _stopChannel(id) {
    const node = this.nodes.get(id);
    if (!node) return;
    try {
      node.cleanup.forEach((fn) => fn());
      node.gain.disconnect();
    } catch {
      // Ignore already stopped audio nodes
    }
    this.nodes.delete(id);
  }

  toggleMute() {
    this.muted = !this.muted;
    if (this.ctx) {
      for (const [id, node] of this.nodes.entries()) {
        const target = this.muted ? 0 : (this.volumes[id] || 0) * 0.45;
        node.gain.gain.setTargetAtTime(target, this.ctx.currentTime, 0.08);
      }
    }
    return this.muted;
  }

  stopAll() {
    for (const id of Object.keys(this.volumes)) {
      this.volumes[id] = 0;
      this._stopChannel(id);
    }
    this.muted = false;
  }

  applyPreset(presetMap) {
    this.muted = false;
    for (const ch of SOUND_CHANNELS) {
      this.setVolume(ch.id, presetMap[ch.id] || 0);
    }
  }

  isAnythingPlaying() {
    return !this.muted && Object.values(this.volumes).some((v) => v > 0);
  }

  playChime() {
    try {
      const ctx = this._ensureContext();
      const now = ctx.currentTime;
      const freqs = [528, 792, 1056];
      freqs.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const g = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now);
        g.gain.setValueAtTime(0.0001, now);
        g.gain.exponentialRampToValueAtTime(0.12 / (idx + 1), now + 0.04);
        g.gain.exponentialRampToValueAtTime(0.0001, now + 2.2);
        osc.connect(g);
        g.connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 2.3);
      });
    } catch {
      // Audio playback blocked before user gesture
    }
  }
}

export const audioEngine = new AmbientAudioEngine();
