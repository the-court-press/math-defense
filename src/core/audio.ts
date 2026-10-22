// Every sound is synthesised with WebAudio, so the game ships no audio files.

type Wave = OscillatorType;

class Sfx {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private noiseBuf: AudioBuffer | null = null;
  enabled = true;

  /** Browsers only allow audio after a user gesture; call this from a key handler. */
  unlock(): void {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') void this.ctx.resume();
      return;
    }
    try {
      const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.45;
      this.master.connect(this.ctx.destination);
      const len = this.ctx.sampleRate * 0.5;
      this.noiseBuf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const data = this.noiseBuf.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    } catch {
      this.ctx = null;
    }
  }

  private tone(freq: number, dur: number, type: Wave = 'sine', vol = 0.3, slideTo?: number, delay = 0): void {
    if (!this.enabled || !this.ctx || !this.master) return;
    const t0 = this.ctx.currentTime + delay;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t0);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(vol, t0 + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g).connect(this.master);
    o.start(t0);
    o.stop(t0 + dur + 0.05);
  }

  private noise(dur: number, vol: number, freq: number, delay = 0): void {
    if (!this.enabled || !this.ctx || !this.master || !this.noiseBuf) return;
    const t0 = this.ctx.currentTime + delay;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    const f = this.ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = freq;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(vol, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(f).connect(g).connect(this.master);
    src.start(t0);
    src.stop(t0 + dur + 0.05);
  }

  key(): void {
    this.tone(1800, 0.03, 'sine', 0.05);
  }
  move(): void {
    this.tone(880, 0.05, 'sine', 0.08);
  }
  select(): void {
    this.tone(660, 0.06, 'triangle', 0.14);
    this.tone(990, 0.08, 'triangle', 0.12, undefined, 0.05);
  }
  back(): void {
    this.tone(520, 0.07, 'triangle', 0.1, 380);
  }
  denied(): void {
    this.tone(200, 0.12, 'square', 0.06);
  }
  lock(): void {
    this.tone(880, 0.09, 'sine', 0.22);
    this.tone(1320, 0.14, 'sine', 0.2, undefined, 0.07);
  }
  miss(): void {
    this.tone(300, 0.2, 'triangle', 0.18, 140);
  }
  /** Engines jam after a wrong answer: a low creak and a puff. */
  jam(): void {
    this.tone(160, 0.28, 'sawtooth', 0.07, 95);
    this.noise(0.18, 0.12, 700, 0.08);
  }
  /** Enter pressed while "Steady!" is still counting down. */
  steady(): void {
    this.tone(260, 0.08, 'triangle', 0.08);
  }
  fire(kind: string): void {
    if (kind === 'stone') this.noise(0.05, 0.05, 2500);
    else if (kind === 'bolt') this.noise(0.08, 0.14, 1800);
    else if (kind === 'boulder') this.tone(140, 0.25, 'triangle', 0.18, 70);
    else this.tone(1600, 0.25, 'sine', 0.12, 2400);
  }
  impact(kind: string): void {
    if (kind === 'boulder') this.noise(0.35, 0.35, 600);
    else if (kind === 'bolt') this.noise(0.06, 0.12, 1200);
  }
  thud(): void {
    this.noise(0.2, 0.2, 400);
  }
  kill(): void {
    this.tone(700, 0.08, 'sine', 0.12, 1100);
    this.tone(1400, 0.06, 'sine', 0.06, undefined, 0.05);
  }
  coin(): void {
    this.tone(1320, 0.06, 'square', 0.04);
    this.tone(1760, 0.1, 'square', 0.04, undefined, 0.05);
  }
  leak(): void {
    this.tone(220, 0.3, 'sawtooth', 0.08, 110);
  }
  build(): void {
    this.noise(0.08, 0.2, 900);
    this.tone(392, 0.1, 'triangle', 0.15, undefined, 0.05);
    this.tone(523, 0.14, 'triangle', 0.15, undefined, 0.12);
  }
  wave(): void {
    this.tone(392, 0.18, 'triangle', 0.15);
    this.tone(523, 0.3, 'triangle', 0.15, undefined, 0.15);
  }
  claw(): void {
    this.tone(180, 0.5, 'sawtooth', 0.06, 90);
    this.noise(0.25, 0.25, 500, 0.45);
  }
  ready(): void {
    [523, 659, 784].forEach((f, i) => this.tone(f, 0.12, 'sine', 0.12, undefined, i * 0.06));
  }
  win(): void {
    [523, 659, 784, 1047].forEach((f, i) => this.tone(f, 0.3, 'triangle', 0.18, undefined, i * 0.12));
  }
  lose(): void {
    [392, 330, 262, 196].forEach((f, i) => this.tone(f, 0.35, 'triangle', 0.14, undefined, i * 0.16));
  }
  star(i: number): void {
    this.tone(784 * Math.pow(1.26, i), 0.18, 'sine', 0.18);
  }
}

export const sfx = new Sfx();
