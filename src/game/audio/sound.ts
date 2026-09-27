/**
 * Tiny synthesized sound engine (Web Audio). No audio files, nothing
 * downloaded — works offline. Silently does nothing where Web Audio is missing.
 */

export type Sfx =
  | 'tap'
  | 'pickup'
  | 'deliver'
  | 'combo'
  | 'wake'
  | 'bump'
  | 'send'
  | 'bonk'
  | 'kidney'
  | 'flush'
  | 'door'
  | 'countdown'
  | 'go'
  | 'boss'
  | 'win'
  | 'star'
  | 'blip';

/** Semitone offset from A4 → frequency. */
export const noteHz = (semitonesFromA4: number) => 440 * Math.pow(2, semitonesFromA4 / 12);

// C major pentatonic-ish melody/bass for the background loop (semitones from A4).
const C4 = -9;
const MELODY = [C4 + 12, null, C4 + 16, C4 + 19, null, C4 + 16, C4 + 14, null, C4 + 12, null, C4 + 9, C4 + 7, null, C4 + 9, C4 + 12, null];
const BASS_ROOTS = [C4 - 12, C4 - 15, C4 - 19, C4 - 17]; // C, A, F, G

type Ctx = AudioContext;

export class SoundEngine {
  private ctx: Ctx | null = null;
  private master: GainNode | null = null;
  private sfxBus: GainNode | null = null;
  private musicBus: GainNode | null = null;
  private noise: AudioBuffer | null = null;
  private musicTimer: ReturnType<typeof setInterval> | null = null;
  private nextNoteTime = 0;
  private step = 0;
  muted = false;
  musicOn = true;

  /** Must be called from a user gesture (tap/click) before sounds can play. */
  unlock() {
    const AC: typeof AudioContext | undefined =
      typeof window !== 'undefined'
        ? (window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext)
        : undefined;
    if (!AC) return;
    if (!this.ctx) {
      const ctx = new AC();
      this.ctx = ctx;
      this.master = ctx.createGain();
      this.master.gain.value = this.muted ? 0 : 0.8;
      this.master.connect(ctx.destination);
      this.sfxBus = ctx.createGain();
      this.sfxBus.gain.value = 0.5;
      this.sfxBus.connect(this.master);
      this.musicBus = ctx.createGain();
      this.musicBus.gain.value = 0.16;
      this.musicBus.connect(this.master);
      const buf = ctx.createBuffer(1, ctx.sampleRate * 0.5, ctx.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
      this.noise = buf;
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume();
  }

  setMuted(muted: boolean) {
    this.muted = muted;
    if (this.master && this.ctx) this.master.gain.setTargetAtTime(muted ? 0 : 0.8, this.ctx.currentTime, 0.02);
  }

  setMusic(on: boolean) {
    this.musicOn = on;
    if (!on) this.stopMusic();
  }

  private tone(freq: number, dur: number, opts: { type?: OscillatorType; vol?: number; at?: number; slide?: number; bus?: GainNode | null } = {}) {
    const ctx = this.ctx;
    const bus = opts.bus ?? this.sfxBus;
    if (!ctx || !bus) return;
    const t = ctx.currentTime + (opts.at ?? 0);
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = opts.type ?? 'square';
    osc.frequency.setValueAtTime(freq, t);
    if (opts.slide) osc.frequency.exponentialRampToValueAtTime(opts.slide, t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(opts.vol ?? 0.3, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(g).connect(bus);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }

  private hiss(dur: number, vol: number, at = 0, lowpass = 4000, bus: GainNode | null = this.sfxBus) {
    const ctx = this.ctx;
    if (!ctx || !bus || !this.noise) return;
    const t = ctx.currentTime + at;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = lowpass;
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f).connect(g).connect(bus);
    src.start(t);
    src.stop(t + dur + 0.02);
  }

  play(sfx: Sfx, level = 1) {
    if (!this.ctx || this.muted) return;
    const up = Math.min(level - 1, 6); // combos climb in pitch
    switch (sfx) {
      case 'tap':
        this.tone(880, 0.06, { type: 'triangle', vol: 0.2 });
        break;
      case 'blip':
        this.tone(noteHz(3 + up * 2), 0.07, { type: 'square', vol: 0.12 });
        break;
      case 'pickup':
        this.tone(noteHz(7), 0.07, { vol: 0.18 });
        this.tone(noteHz(14), 0.12, { vol: 0.18, at: 0.06 });
        break;
      case 'deliver':
        [0, 4, 7, 12].forEach((n, i) => this.tone(noteHz(3 + n + up), 0.14, { type: 'triangle', vol: 0.3, at: i * 0.05 }));
        this.hiss(0.15, 0.05, 0, 9000);
        break;
      case 'combo':
        this.tone(noteHz(15 + up * 2), 0.18, { type: 'square', vol: 0.14, slide: noteHz(22 + up * 2) });
        break;
      case 'wake':
        this.tone(noteHz(-5), 0.25, { type: 'sine', vol: 0.3, slide: noteHz(7) });
        break;
      case 'bump':
        this.tone(140, 0.2, { type: 'sine', vol: 0.4, slide: 60 });
        this.hiss(0.12, 0.15, 0, 900);
        break;
      case 'send':
        this.tone(noteHz(5 + up), 0.1, { type: 'triangle', vol: 0.2, slide: noteHz(17 + up) });
        break;
      case 'bonk':
        this.tone(200, 0.12, { type: 'square', vol: 0.12, slide: 120 });
        break;
      case 'kidney':
        this.tone(320, 0.08, { type: 'sine', vol: 0.12, slide: 180 });
        break;
      case 'flush':
        this.hiss(0.7, 0.25, 0, 1500);
        this.tone(500, 0.6, { type: 'sine', vol: 0.15, slide: 90 });
        break;
      case 'door':
        this.tone(noteHz(-2), 0.08, { type: 'triangle', vol: 0.12 });
        this.tone(noteHz(5), 0.1, { type: 'triangle', vol: 0.12, at: 0.07 });
        break;
      case 'countdown':
        this.tone(noteHz(0), 0.15, { type: 'square', vol: 0.18 });
        break;
      case 'go':
        this.tone(noteHz(12), 0.3, { type: 'square', vol: 0.2 });
        break;
      case 'boss':
        [0, 3, 7, 10].forEach((n, i) => this.tone(noteHz(-12 + n), 0.2, { type: 'sawtooth', vol: 0.12, at: i * 0.12 }));
        break;
      case 'star':
        this.tone(noteHz(12 + up * 4), 0.35, { type: 'triangle', vol: 0.3 });
        this.tone(noteHz(19 + up * 4), 0.35, { type: 'sine', vol: 0.15, at: 0.05 });
        break;
      case 'win':
        [0, 4, 7, 12, 16, 19, 24].forEach((n, i) => this.tone(noteHz(3 + n), 0.22, { type: 'triangle', vol: 0.25, at: i * 0.08 }));
        break;
    }
  }

  /** Cheerful looping background tune, scheduled slightly ahead of time. */
  startMusic(tempo = 132) {
    if (!this.ctx || !this.musicOn || this.musicTimer) return;
    const stepDur = 60 / tempo / 2; // eighth notes
    this.nextNoteTime = this.ctx.currentTime + 0.1;
    this.step = 0;
    this.musicTimer = setInterval(() => {
      const ctx = this.ctx;
      if (!ctx) return;
      while (this.nextNoteTime < ctx.currentTime + 0.2) {
        const at = this.nextNoteTime - ctx.currentTime;
        const s = this.step % 64;
        const bar = Math.floor(s / 16) % 4;
        const m = MELODY[s % 16];
        if (m !== null && m !== undefined && !(bar === 3 && s % 16 > 11))
          this.tone(noteHz(m + (bar === 2 ? -3 : 0)), stepDur * 0.9, { type: 'square', vol: 0.18, at, bus: this.musicBus });
        if (s % 4 === 0) this.tone(noteHz(BASS_ROOTS[bar]!), stepDur * 1.6, { type: 'triangle', vol: 0.5, at, bus: this.musicBus });
        if (s % 2 === 1) this.hiss(0.03, 0.12, at, 8000, this.musicBus);
        this.nextNoteTime += stepDur;
        this.step++;
      }
    }, 25);
  }

  stopMusic() {
    if (this.musicTimer) clearInterval(this.musicTimer);
    this.musicTimer = null;
  }
}

/** One shared engine for the whole app. */
export const sound = new SoundEngine();
