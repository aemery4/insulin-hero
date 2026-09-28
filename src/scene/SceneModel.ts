/**
 * Renderer-agnostic simulation of the bloodstream scene. It eases toward a
 * `SceneState` and plays one-shot event timelines. The Pixi renderer only draws
 * what this model says, so everything here can be unit-tested without WebGL.
 *
 * World units: a 400 x 300 box; the blood vessel runs left → right through the middle.
 */
import type { SceneEvent, SceneState, Zone } from '../domain/types';
import { EMPTY_SCENE } from '../domain/sceneState';
import { createRng, type Rng } from './rng';

export const WORLD = { w: 400, h: 300 } as const;
export const VESSEL = { top: 88, bottom: 212 } as const;
export const MAX_GLUCOSE = 120;

export type CellKind = 'brain' | 'muscle' | 'heart' | 'fat';

export interface CellModel {
  kind: CellKind;
  x: number;
  y: number;
  r: number;
  /** Brain cells take in glucose without insulin, so they have no lock. */
  hasLock: boolean;
  locked: boolean;
  /** 0 = shut, 1 = fully open (animated). */
  lockOpen: number;
  /** 0..1 displayed glow (eased). */
  energy: number;
  /** 0..1 flash when glucose enters; decays. */
  fed: number;
}

export type ParticleMode = 'flow' | 'toCell' | 'toKidney' | 'fadeOut';

export interface Particle {
  id: number;
  x: number;
  y: number;
  baseY: number;
  speed: number;
  phase: number;
  mode: ParticleMode;
  tx: number;
  ty: number;
  cell?: CellKind;
  alpha: number;
  /** Extra glucose from a food/fast-sugar burst; trimmed after the event. */
  bonus: boolean;
}

export type HeroPhase = 'enter' | 'unlock' | 'leave' | 'done';

export interface HeroModel {
  id: number;
  x: number;
  y: number;
  cell: CellKind;
  phase: HeroPhase;
  t: number;
  delay: number;
  alpha: number;
}

export type HelperKind = 'fastSugar' | 'food';
export type HelperPhase = 'enter' | 'release' | 'leave' | 'done';

export interface HelperModel {
  kind: HelperKind;
  x: number;
  y: number;
  phase: HelperPhase;
  t: number;
  alpha: number;
  released: number;
}

export const KIDNEY = { x: 318, y: 262 } as const;

const CELL_LAYOUT: Omit<CellModel, 'locked' | 'lockOpen' | 'energy' | 'fed'>[] = [
  { kind: 'brain', x: 70, y: 44, r: 30, hasLock: false },
  { kind: 'muscle', x: 200, y: 44, r: 32, hasLock: true },
  { kind: 'heart', x: 330, y: 44, r: 30, hasLock: true },
  { kind: 'fat', x: 110, y: 258, r: 32, hasLock: true },
];

const TRICKLE_MS = 700;
const SPILL_MS = 900;
const HERO_SPEED = 95;
const HELPER_SPEED = 80;
const BURST = { fastSugar: 28, food: 18 } as const;

export interface SceneSnapshot {
  zone: Zone | 'none';
  glucose: { count: number; target: number; bonus: number };
  cells: { kind: CellKind; hasLock: boolean; locked: boolean; energy: number }[];
  kidneySpill: boolean;
  headingToKidney: number;
  enteringCells: number;
  heroes: { active: number; unlocked: CellKind[] };
  helpers: HelperKind[];
  events: SceneEvent[];
  reducedMotion: boolean;
  time: number;
}

const approach = (v: number, target: number, rate: number, dt: number) => {
  const step = rate * dt;
  return Math.abs(target - v) <= step ? target : v + Math.sign(target - v) * step;
};

export class SceneModel {
  state: SceneState = EMPTY_SCENE;
  reducedMotion = false;
  particles: Particle[] = [];
  cells: CellModel[];
  heroes: HeroModel[] = [];
  helpers: HelperModel[] = [];
  time = 0;

  private rng: Rng;
  private nextId = 1;
  private trickleTimer = 0;
  private spillTimer = 0;
  private initialized = false;
  private unlockedByHero = new Set<CellKind>();

  constructor(seed = 1) {
    this.rng = createRng(seed);
    this.cells = CELL_LAYOUT.map((c) => ({ ...c, locked: c.hasLock, lockOpen: c.hasLock ? 0 : 1, energy: 0.6, fed: 0 }));
  }

  get targetGlucose(): number {
    return Math.round(this.state.glucoseLevel * MAX_GLUCOSE);
  }

  private get motion(): number {
    return this.reducedMotion ? 0.25 : 1;
  }

  /**
   * Point the scene at a new state. `replay` starts the one-shot event
   * animations (on a new reading or "Play again").
   */
  apply(state: SceneState, opts: { replay: boolean; reducedMotion?: boolean }) {
    this.state = state;
    if (opts.reducedMotion !== undefined) this.reducedMotion = opts.reducedMotion;

    if (!this.initialized) {
      this.initialized = true;
      for (let i = 0; i < this.targetGlucose; i++) this.spawn(this.rng.range(0, WORLD.w));
    }

    if (opts.replay) {
      this.heroes = [];
      this.helpers = [];
      // Only a new hero delivery re-locks cells for the heroes to open again.
      if (state.events.includes('insulinHeroes')) this.unlockedByHero.clear();
      for (const p of this.particles) p.bonus = false;
      this.startEvents(state.events);
    }
    this.syncLocks(opts.replay);
  }

  private syncLocks(replay: boolean) {
    for (const c of this.cells) {
      if (!c.hasLock) continue;
      if (this.state.locks === 'open' || this.state.zone === 'none') c.locked = this.state.locks !== 'open';
      else if (this.state.locks === 'closed') c.locked = true;
      else if (replay && this.state.events.includes('insulinHeroes')) c.locked = true; // heroes unlock on arrival
      else c.locked = !this.unlockedByHero.has(c.kind);
    }
  }

  private startEvents(events: SceneEvent[]) {
    for (const e of events) {
      if (e === 'insulinHeroes') {
        this.cells
          .filter((c) => c.hasLock)
          .forEach((c, i) => {
            const start = this.reducedMotion ? { x: c.x, y: this.dockY(c) } : { x: -24, y: 150 + (i - 1) * 26 };
            this.heroes.push({
              id: this.nextId++,
              ...start,
              cell: c.kind,
              phase: 'enter',
              t: 0,
              delay: i * 0.45,
              alpha: this.reducedMotion ? 0 : 1,
            });
          });
      } else {
        const kind: HelperKind = e === 'fastSugarHelper' ? 'fastSugar' : 'food';
        const start = this.reducedMotion
          ? this.helperStop(kind)
          : kind === 'fastSugar'
            ? { x: -30, y: 110 }
            : { x: -30, y: 190 };
        this.helpers.push({ kind, ...start, phase: 'enter', t: 0, alpha: this.reducedMotion ? 0 : 1, released: 0 });
      }
    }
  }

  private dockY(c: CellModel) {
    return c.y < WORLD.h / 2 ? c.y + c.r + 20 : c.y - c.r - 20;
  }

  private helperStop(kind: HelperKind) {
    return kind === 'fastSugar' ? { x: 150, y: 125 } : { x: 90, y: 185 };
  }

  private spawn(x: number, y?: number, bonus = false): Particle {
    const baseY = y ?? this.rng.range(VESSEL.top + 8, VESSEL.bottom - 8);
    const p: Particle = {
      id: this.nextId++,
      x,
      y: baseY,
      baseY,
      speed: this.rng.range(16, 30),
      phase: this.rng.range(0, Math.PI * 2),
      mode: 'flow',
      tx: 0,
      ty: 0,
      alpha: 1,
      bonus,
    };
    this.particles.push(p);
    return p;
  }

  private cell(kind: CellKind): CellModel {
    return this.cells.find((c) => c.kind === kind)!;
  }

  private openCells(): CellModel[] {
    return this.cells.filter((c) => !c.locked);
  }

  private flowing(): Particle[] {
    return this.particles.filter((p) => p.mode === 'flow');
  }

  private sendToCell(p: Particle, c: CellModel) {
    p.mode = 'toCell';
    p.cell = c.kind;
    p.tx = c.x + this.rng.range(-c.r * 0.4, c.r * 0.4);
    p.ty = c.y + this.rng.range(-c.r * 0.4, c.r * 0.4);
  }

  /** Send the n flowing particles closest to a cell into it. */
  private feedCell(c: CellModel, n: number) {
    const near = this.flowing()
      .sort((a, b) => Math.hypot(a.x - c.x, a.y - c.y) - Math.hypot(b.x - c.x, b.y - c.y))
      .slice(0, n);
    for (const p of near) this.sendToCell(p, c);
  }

  step(dtMs: number) {
    const dt = Math.min(dtMs, 100) / 1000;
    this.time += dt;
    this.stepEvents(dt);
    this.stepPopulation(dtMs);
    this.stepParticles(dt);
    this.stepCells(dt);
  }

  private stepEvents(dt: number) {
    const m = this.motion;
    for (const h of this.heroes) {
      if (h.delay > 0) {
        h.delay -= dt;
        continue;
      }
      const c = this.cell(h.cell);
      h.t += dt;
      if (h.phase === 'enter') {
        if (this.reducedMotion) {
          h.alpha = Math.min(1, h.t / 0.8);
          if (h.alpha >= 1) this.heroArrives(h, c);
        } else {
          const tx = c.x;
          const ty = this.dockY(c);
          const d = Math.hypot(tx - h.x, ty - h.y);
          const s = HERO_SPEED * dt;
          if (d <= s) {
            h.x = tx;
            h.y = ty;
            this.heroArrives(h, c);
          } else {
            h.x += ((tx - h.x) / d) * s;
            h.y += ((ty - h.y) / d) * s;
          }
        }
      } else if (h.phase === 'unlock') {
        if (h.t >= 1.6 / Math.max(m, 0.5)) {
          h.phase = 'leave';
          h.t = 0;
        }
      } else if (h.phase === 'leave') {
        if (this.reducedMotion) h.alpha = Math.max(0, 1 - h.t / 0.8);
        else {
          h.x += HERO_SPEED * dt;
          h.y = approach(h.y, 150, 40, dt);
          if (h.x > WORLD.w + 30) h.alpha = 0;
        }
        if (h.alpha <= 0) h.phase = 'done';
      }
    }
    this.heroes = this.heroes.filter((h) => h.phase !== 'done');

    for (const hp of this.helpers) {
      hp.t += dt;
      const stop = this.helperStop(hp.kind);
      if (hp.phase === 'enter') {
        if (this.reducedMotion) {
          hp.alpha = Math.min(1, hp.t / 0.8);
          if (hp.alpha >= 1) Object.assign(hp, { phase: 'release', t: 0 });
        } else {
          hp.x = approach(hp.x, stop.x, HELPER_SPEED, dt);
          hp.y = approach(hp.y, stop.y, HELPER_SPEED, dt);
          if (hp.x === stop.x && hp.y === stop.y) Object.assign(hp, { phase: 'release', t: 0 });
        }
      } else if (hp.phase === 'release') {
        const total = BURST[hp.kind];
        const due = Math.min(total, Math.floor((hp.t / 1.4) * total));
        while (hp.released < due) {
          const p = this.spawn(hp.x + this.rng.range(-8, 8), hp.y + this.rng.range(-8, 8), true);
          p.baseY = this.rng.range(VESSEL.top + 8, VESSEL.bottom - 8);
          hp.released++;
        }
        if (hp.released >= total && hp.t > 1.8) Object.assign(hp, { phase: 'leave', t: 0 });
      } else if (hp.phase === 'leave') {
        if (this.reducedMotion) hp.alpha = Math.max(0, 1 - hp.t / 0.8);
        else {
          hp.y = approach(hp.y, hp.kind === 'fastSugar' ? -40 : WORLD.h + 40, HELPER_SPEED, dt);
          if (hp.y <= -40 || hp.y >= WORLD.h + 40) hp.alpha = 0;
        }
        if (hp.alpha <= 0) hp.phase = 'done';
      }
    }
    this.helpers = this.helpers.filter((h) => h.phase !== 'done');
  }

  private heroArrives(h: HeroModel, c: CellModel) {
    h.phase = 'unlock';
    h.t = 0;
    this.unlockedByHero.add(c.kind);
    c.locked = false;
    this.feedCell(c, 6);
  }

  private stepPopulation(dtMs: number) {
    const target = this.targetGlucose;
    const helperBusy = this.helpers.length > 0;
    const inBlood = this.particles.filter((p) => p.mode === 'flow');
    const normal = inBlood.filter((p) => !p.bonus);

    // Refill toward the target: small gaps from the left edge, big jumps fade in
    // across the vessel so they don't arrive as one clump.
    const deficit = target - normal.length;
    if (deficit > 6) this.spawn(this.rng.range(0, WORLD.w)).alpha = 0.01;
    else if (deficit > 0 && this.rng.next() < 0.5) this.spawn(-6);

    // Too much glucose for this reading: extra goes into open cells, or fades.
    // Bonus glucose from a helper burst is kept until the helper is done.
    const extraNormal = normal.length - target;
    const extraTotal = inBlood.length - target;
    const trimPool = extraNormal > 0 ? normal : !helperBusy && extraTotal > 0 ? inBlood.filter((p) => p.bonus) : [];
    const trimRate = extraNormal > 12 ? 0.6 : 0.25;
    if (trimPool.length && this.rng.next() < trimRate) {
      const p = trimPool[0]!;
      const c = this.rng.pick(this.openCells());
      if (c) this.sendToCell(p, c);
      else p.mode = 'fadeOut';
    }

    // Steady trickle into open cells (replaced from the left).
    this.trickleTimer += dtMs;
    if (this.trickleTimer >= TRICKLE_MS / this.motion) {
      this.trickleTimer = 0;
      const c = this.rng.pick(this.openCells());
      const p = this.rng.pick(this.flowing());
      if (c && p && this.state.zone !== 'none') this.sendToCell(p, c);
    }

    // High glucose: some spills out toward the kidneys.
    this.spillTimer += dtMs;
    if (this.state.kidneySpill && this.spillTimer >= SPILL_MS / this.motion) {
      this.spillTimer = 0;
      const p = this.flowing().find((q) => q.x > 200 && q.x < 330);
      if (p) {
        p.mode = 'toKidney';
        p.tx = KIDNEY.x + this.rng.range(-10, 10);
        p.ty = KIDNEY.y;
      }
    } else if (!this.state.kidneySpill) this.spillTimer = 0;
  }

  private stepParticles(dt: number) {
    const m = this.motion;
    for (const p of this.particles) {
      switch (p.mode) {
        case 'flow':
          if (p.alpha < 1) p.alpha = Math.min(1, p.alpha + dt * 1.5);
          p.x += p.speed * m * dt;
          p.baseY = approach(p.baseY, Math.min(VESSEL.bottom - 8, Math.max(VESSEL.top + 8, p.baseY)), 30, dt);
          p.y = approach(p.y, p.baseY + Math.sin(p.phase + this.time * 1.6) * 5, 60, dt);
          if (p.x > WORLD.w + 6) p.x = -6;
          break;
        case 'toCell':
        case 'toKidney': {
          const d = Math.hypot(p.tx - p.x, p.ty - p.y);
          const s = (p.mode === 'toCell' ? 70 : 50) * Math.max(m, 0.5) * dt;
          if (d <= s) {
            p.alpha = 0;
            if (p.cell) this.cell(p.cell).fed = 1;
          } else {
            p.x += ((p.tx - p.x) / d) * s;
            p.y += ((p.ty - p.y) / d) * s;
            if (d < 14) p.alpha = d / 14;
          }
          break;
        }
        case 'fadeOut':
          p.alpha -= dt * 1.5;
          break;
      }
    }
    this.particles = this.particles.filter((p) => p.alpha > 0);
  }

  private targetEnergy(c: CellModel): number {
    const s = this.state;
    if (s.zone === 'none') return 0.6;
    if (!c.hasLock) return s.zone === 'low' ? s.cellEnergy : 1; // brain: no lock needed
    if (c.locked) return Math.min(s.cellEnergy, 0.3);
    return s.cellEnergy;
  }

  private stepCells(dt: number) {
    for (const c of this.cells) {
      c.energy = approach(c.energy, this.targetEnergy(c), 0.5, dt);
      c.lockOpen = approach(c.lockOpen, c.locked ? 0 : 1, 2.5, dt);
      c.fed = Math.max(0, c.fed - dt * 2);
    }
  }

  snapshot(): SceneSnapshot {
    const count = (mode: ParticleMode) => this.particles.filter((p) => p.mode === mode).length;
    return {
      zone: this.state.zone,
      glucose: {
        count: count('flow'),
        target: this.targetGlucose,
        bonus: this.particles.filter((p) => p.bonus && p.mode === 'flow').length,
      },
      cells: this.cells.map((c) => ({
        kind: c.kind,
        hasLock: c.hasLock,
        locked: c.locked,
        energy: Math.round(c.energy * 100) / 100,
      })),
      kidneySpill: this.state.kidneySpill,
      headingToKidney: count('toKidney'),
      enteringCells: count('toCell'),
      heroes: { active: this.heroes.length, unlocked: [...this.unlockedByHero] },
      helpers: this.helpers.map((h) => h.kind),
      events: this.state.events,
      reducedMotion: this.reducedMotion,
      time: Math.round(this.time * 10) / 10,
    };
  }
}
