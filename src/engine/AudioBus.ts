// Procedural Web Audio. No asset files.
// Lazy-init on first user gesture (autoplay policies).

type SfxKind = 'place' | 'demolish' | 'milestone' | 'fire' | 'raid' | 'win' | 'click' | 'bad';

export class AudioBus {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private ambient: { osc: OscillatorNode; gain: GainNode } | null = null;
  private muted = false;
  private musicTimer: number | null = null;
  private musicStep = 0;

  constructor() {
    // resume on first interaction
    const resume = () => {
      this.ensure();
      window.removeEventListener('pointerdown', resume);
      window.removeEventListener('keydown', resume);
    };
    window.addEventListener('pointerdown', resume, { once: true });
    window.addEventListener('keydown', resume, { once: true });
  }

  private ensure(): AudioContext | null {
    if (this.muted) return null;
    if (this.ctx) {
      if (this.ctx.state === 'suspended') void this.ctx.resume();
      return this.ctx;
    }
    try {
      const Ctor =
        (window as unknown as { AudioContext?: typeof AudioContext; webkitAudioContext?: typeof AudioContext }).AudioContext ??
        (window as unknown as { AudioContext?: typeof AudioContext; webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) return null;
      const ctx = new Ctor();
      const master = ctx.createGain();
      master.gain.value = 0.55;
      master.connect(ctx.destination);
      this.ctx = ctx;
      this.master = master;
      this.startAmbient();
      return ctx;
    } catch {
      return null;
    }
  }

  setMuted(m: boolean): void {
    this.muted = m;
    if (this.master) this.master.gain.value = m ? 0 : 0.55;
  }

  play(kind: SfxKind): void {
    const ctx = this.ensure();
    if (!ctx || !this.master) return;
    const t = ctx.currentTime;
    switch (kind) {
      case 'place':     this.blip(t, 660, 0.10, 'triangle', 0.18); break;
      case 'demolish':  this.blip(t, 180, 0.18, 'sawtooth', 0.18); break;
      case 'click':     this.blip(t, 880, 0.05, 'square', 0.10); break;
      case 'bad':       this.blip(t, 220, 0.12, 'square', 0.18); break;
      case 'milestone': this.chord(t, [523, 659, 784], 0.6, 0.22); break;
      case 'win':       this.chord(t, [523, 659, 784, 988], 1.2, 0.28); break;
      case 'fire':      this.noise(t, 0.5, 0.25, 600); break;
      case 'raid':      this.blip(t, 110, 0.4, 'sawtooth', 0.30); break;
    }
  }

  private blip(t0: number, freq: number, dur: number, type: OscillatorType, vol: number): void {
    if (!this.ctx || !this.master) return;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t0);
    o.frequency.exponentialRampToValueAtTime(Math.max(40, freq * 0.6), t0 + dur);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(vol, t0 + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g).connect(this.master);
    o.start(t0);
    o.stop(t0 + dur + 0.05);
  }

  private chord(t0: number, freqs: number[], dur: number, vol: number): void {
    if (!this.ctx || !this.master) return;
    freqs.forEach((f, i) => {
      const o = this.ctx!.createOscillator();
      const g = this.ctx!.createGain();
      o.type = 'triangle';
      o.frequency.value = f;
      g.gain.setValueAtTime(0.0001, t0 + i * 0.08);
      g.gain.exponentialRampToValueAtTime(vol / freqs.length, t0 + i * 0.08 + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      o.connect(g).connect(this.master!);
      o.start(t0 + i * 0.08);
      o.stop(t0 + dur + 0.05);
    });
  }

  private noise(t0: number, dur: number, vol: number, cutoff: number): void {
    if (!this.ctx || !this.master) return;
    const bufLen = Math.max(1, Math.floor(this.ctx.sampleRate * dur));
    const buf = this.ctx.createBuffer(1, bufLen, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < bufLen; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / bufLen);
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const filt = this.ctx.createBiquadFilter();
    filt.type = 'lowpass';
    filt.frequency.value = cutoff;
    const g = this.ctx.createGain();
    g.gain.value = vol;
    src.connect(filt).connect(g).connect(this.master);
    src.start(t0);
  }

  private startAmbient(): void {
    if (!this.ctx || !this.master) return;
    const osc = this.ctx.createOscillator();
    const lfo = this.ctx.createOscillator();
    const lfoGain = this.ctx.createGain();
    const g = this.ctx.createGain();
    const filt = this.ctx.createBiquadFilter();
    osc.type = 'sine';
    osc.frequency.value = 130.81; // C3
    lfo.type = 'sine';
    lfo.frequency.value = 0.07;
    lfoGain.gain.value = 6;
    lfo.connect(lfoGain).connect(osc.frequency);
    filt.type = 'lowpass';
    filt.frequency.value = 600;
    g.gain.value = 0.04;
    osc.connect(filt).connect(g).connect(this.master);
    osc.start();
    lfo.start();
    this.ambient = { osc, gain: g };

    this.startMusic();
  }

  // A gentle pentatonic-minor arpeggio looped at ~80 BPM (≈300 ms per note).
  // C minor pentatonic: C–Eb–F–G–Bb. Two octaves alternating with a soft bass.
  private startMusic(): void {
    if (!this.ctx || !this.master) return;
    if (this.musicTimer !== null) return;
    const pattern: number[] = [
      261.63, 311.13, 392.00, 466.16,    // C4 Eb4 G4 Bb4
      523.25, 466.16, 392.00, 311.13,    // C5 Bb4 G4 Eb4
      349.23, 392.00, 466.16, 523.25,    // F4 G4 Bb4 C5
      392.00, 311.13, 261.63, 196.00,    // G4 Eb4 C4 G3
    ];
    const stepMs = 320;
    this.musicTimer = window.setInterval(() => {
      if (!this.ctx || !this.master) return;
      const f = pattern[this.musicStep % pattern.length];
      this.melodyNote(f, stepMs / 1000 * 0.92);
      // Soft bass on every 4th note.
      if (this.musicStep % 4 === 0) this.bassNote(f / 4, stepMs / 1000 * 1.4);
      this.musicStep++;
    }, stepMs);
  }

  private melodyNote(freq: number, dur: number): void {
    if (!this.ctx || !this.master) return;
    const t0 = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    const filt = this.ctx.createBiquadFilter();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(freq, t0);
    filt.type = 'lowpass';
    filt.frequency.value = 1800;
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(0.06, t0 + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(filt).connect(g).connect(this.master);
    osc.start(t0);
    osc.stop(t0 + dur + 0.05);
  }

  private bassNote(freq: number, dur: number): void {
    if (!this.ctx || !this.master) return;
    const t0 = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.value = freq;
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(0.05, t0 + 0.03);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(g).connect(this.master);
    osc.start(t0);
    osc.stop(t0 + dur + 0.05);
  }

  setAmbientLevel(v: number): void {
    if (this.ambient) this.ambient.gain.gain.value = Math.max(0, Math.min(0.06, v));
  }
}
