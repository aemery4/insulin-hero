/**
 * KEY RUN — fly the insulin hero along the bloodstream highway, grab keys,
 * and unlock hungry buildings so glucose can get inside.
 *
 * Fictional game rules. Nothing here models real insulin action or doses.
 */
import { createRng, type Rng } from '../../../scene/rng';
import { CITY_LAYOUT, DISTRICTS, LANE, doorX, type DistrictSlot } from '../districts';
import {
  GAME_H,
  type GameEvent,
  type Hud,
  type MissionModel,
  type MissionResult,
  type PointerState,
} from '../types';

export interface KeyRunConfig {
  duration: number;
  /** Seconds between key spawns (min, max). */
  keyEvery: [number, number];
  /** Energy lost per second by each locked building. */
  drain: number;
  scrollSpeed: number;
  obstacles?: { every: [number, number]; startAt: number };
  boss?: { district: string; label: string; goal: number; startAt: number; drainMultiplier: number };
}

export const MAX_KEYS = 3;
/** Buildings accept a key once they're this hungry (lock shows). */
export const HUNGRY_AT = 0.7;
const COMBO_WINDOW = 4;
const COUNTDOWN = 3;
const HERO_MAX_SPEED = 430;
const FINGER_OFFSET = 56; // hero flies above the finger so it stays visible

export interface KeyRunHero {
  x: number;
  y: number;
  vx: number;
  vy: number;
  keys: number;
  stun: number;
}

export interface KeyItem {
  id: number;
  x: number;
  y: number;
  sway: number;
  dropped: boolean;
}

export interface Obstacle {
  id: number;
  x: number;
  y: number;
  r: number;
  sway: number;
}

export interface District extends DistrictSlot {
  hasLock: boolean;
  energy: number;
  /** >0 while the door is open and glucose is flowing in. */
  filling: number;
  asleep: boolean;
  drainMult: number;
  deliveries: number;
}

export class KeyRunModel implements MissionModel {
  time = 0;
  phase: Hud['phase'] = 'countdown';
  score = 0;
  combo = 0;
  bestCombo = 0;
  hero: KeyRunHero = { x: 180, y: 540, vx: 0, vy: 0, keys: 0, stun: 0 };
  keys: KeyItem[] = [];
  obstacles: Obstacle[] = [];
  districts: District[];
  bossActive = false;
  bossDone = false;

  private rng: Rng;
  private nextId = 1;
  private keyTimer = 0.4;
  private obstacleTimer = 0;
  private lastDeliver = -99;
  private target: { x: number; y: number } | null = null;
  private powerSum = 0;
  private powerTime = 0;
  private wakes = 0;
  private deliveries = 0;
  private events: GameEvent[] = [];
  private lastCount = COUNTDOWN + 1;
  private powerBonus = 0;

  constructor(
    readonly config: KeyRunConfig,
    seed = 1,
  ) {
    this.rng = createRng(seed);
    this.districts = CITY_LAYOUT.map((d) => ({
      ...d,
      hasLock: DISTRICTS[d.kind].hasLock,
      energy: DISTRICTS[d.kind].hasLock ? this.rng.range(0.55, 0.85) : 1,
      filling: 0,
      asleep: false,
      drainMult: this.rng.range(0.8, 1.25),
      deliveries: 0,
    }));
  }

  get done() {
    return this.phase === 'done';
  }

  private get playTime() {
    return Math.max(0, this.time - COUNTDOWN);
  }

  private emit(e: GameEvent) {
    this.events.push(e);
  }

  drainEvents(): GameEvent[] {
    const out = this.events;
    this.events = [];
    return out;
  }

  pointer(p: PointerState) {
    this.target = p.down ? { x: p.x, y: p.y - FINGER_OFFSET } : null;
  }

  nudge(dx: number, dy: number) {
    const h = this.hero;
    this.target = dx || dy ? { x: h.x + dx * 80, y: h.y + dy * 80 } : null;
  }

  step(dtMs: number) {
    if (this.phase === 'done') return;
    const dt = Math.min(dtMs, 50) / 1000;
    this.time += dt;

    if (this.phase === 'countdown') {
      const n = Math.ceil(COUNTDOWN - this.time);
      if (n < this.lastCount && n > 0) this.emit({ type: 'countdown', x: 180, y: 320, value: n });
      this.lastCount = n;
      this.moveHero(dt);
      if (this.time >= COUNTDOWN) {
        this.phase = 'play';
        this.emit({ type: 'go', x: 180, y: 320 });
      }
      return;
    }

    this.moveHero(dt);
    this.spawn(dt);
    this.moveThings(dt);
    this.updateDistricts(dt);
    this.collide();

    if (this.combo > 0 && this.playTime - this.lastDeliver > COMBO_WINDOW) this.combo = 0;

    if (this.playTime >= this.config.duration) this.finish();
  }

  private moveHero(dt: number) {
    const h = this.hero;
    h.stun = Math.max(0, h.stun - dt);
    if (this.target && h.stun <= 0) {
      const dx = this.target.x - h.x;
      const dy = this.target.y - h.y;
      // spring toward the finger, capped speed
      h.vx += (dx * 18 - h.vx * 6) * dt;
      h.vy += (dy * 18 - h.vy * 6) * dt;
    } else {
      h.vx *= Math.pow(0.02, dt);
      h.vy *= Math.pow(0.02, dt);
    }
    const sp = Math.hypot(h.vx, h.vy);
    if (sp > HERO_MAX_SPEED) {
      h.vx *= HERO_MAX_SPEED / sp;
      h.vy *= HERO_MAX_SPEED / sp;
    }
    h.x = Math.min(LANE.right + 14, Math.max(LANE.left - 14, h.x + h.vx * dt));
    h.y = Math.min(LANE.bottom - 16, Math.max(LANE.top + 16, h.y + h.vy * dt));
  }

  private spawn(dt: number) {
    const c = this.config;
    this.keyTimer -= dt;
    if (this.keyTimer <= 0) {
      this.keyTimer = this.rng.range(c.keyEvery[0], c.keyEvery[1]);
      this.keys.push({
        id: this.nextId++,
        x: this.rng.range(LANE.left + 22, LANE.right - 22),
        y: -20,
        sway: this.rng.range(0, Math.PI * 2),
        dropped: false,
      });
    }

    if (c.obstacles && this.playTime >= c.obstacles.startAt) {
      this.obstacleTimer -= dt;
      if (this.obstacleTimer <= 0) {
        this.obstacleTimer = this.rng.range(c.obstacles.every[0], c.obstacles.every[1]);
        this.obstacles.push({
          id: this.nextId++,
          x: this.rng.range(LANE.left + 30, LANE.right - 30),
          y: -34,
          r: this.rng.range(20, 27),
          sway: this.rng.range(0, Math.PI * 2),
        });
      }
    }

    const b = c.boss;
    if (b && !this.bossActive && !this.bossDone && this.playTime >= b.startAt) {
      this.bossActive = true;
      const d = this.districts.find((x) => x.id === b.district)!;
      d.energy = Math.min(d.energy, 0.45);
      this.bossBase = d.deliveries;
      this.emit({ type: 'bossStart', x: doorX(d.side), y: d.y, target: d.id });
    }
  }

  private moveThings(dt: number) {
    const s = this.config.scrollSpeed;
    for (const k of this.keys) {
      k.y += s * (k.dropped ? 0.9 : 0.55) * dt;
      k.x += Math.sin(this.time * 2 + k.sway) * 14 * dt;
    }
    this.keys = this.keys.filter((k) => k.y < GAME_H + 24);
    for (const o of this.obstacles) {
      o.y += s * 0.8 * dt;
      o.x += Math.sin(this.time * 1.3 + o.sway) * 18 * dt;
    }
    this.obstacles = this.obstacles.filter((o) => o.y < GAME_H + 40);
  }

  private updateDistricts(dt: number) {
    let sum = 0;
    let n = 0;
    for (const d of this.districts) {
      if (!d.hasLock) continue;
      if (d.filling > 0) {
        d.filling = Math.max(0, d.filling - dt);
        d.energy = Math.min(1, d.energy + dt * 1.1);
      } else {
        const boss = this.bossActive && this.config.boss?.district === d.id ? this.config.boss.drainMultiplier : 1;
        d.energy = Math.max(0, d.energy - this.config.drain * d.drainMult * boss * dt);
        if (d.energy === 0 && !d.asleep) {
          d.asleep = true;
          this.emit({ type: 'asleep', x: doorX(d.side), y: d.y, target: d.id });
        }
      }
      sum += d.energy;
      n++;
    }
    this.powerSum += (n ? sum / n : 1) * dt;
    this.powerTime += dt;
  }

  private collide() {
    const h = this.hero;

    if (h.stun <= 0) {
      for (const k of this.keys) {
        if (h.keys >= MAX_KEYS) break;
        if (Math.hypot(k.x - h.x, k.y - h.y) < 30) {
          h.keys++;
          this.emit({ type: 'pickup', x: k.x, y: k.y, value: h.keys });
          k.y = GAME_H + 999; // removed next frame
        }
      }
    }

    for (const o of this.obstacles) {
      if (h.stun > 0) break;
      const d = Math.hypot(o.x - h.x, o.y - h.y);
      if (d < o.r + 14) {
        h.stun = 0.7;
        const nx = (h.x - o.x) / (d || 1);
        const ny = (h.y - o.y) / (d || 1);
        h.vx = nx * 320;
        h.vy = ny * 320 + 120;
        this.emit({ type: 'bump', x: h.x, y: h.y });
        if (h.keys > 0) {
          h.keys--;
          this.keys.push({ id: this.nextId++, x: h.x, y: h.y + 10, sway: 0, dropped: true });
          this.emit({ type: 'dropKey', x: h.x, y: h.y });
        }
        this.combo = 0;
      }
    }

    for (const d of this.districts) {
      const dx = doorX(d.side);
      if (Math.hypot(dx - h.x, d.y - h.y) > 38) continue;
      if (!d.hasLock) {
        if (h.keys > 0 && !this.hintedBrain) {
          this.hintedBrain = true;
          this.emit({ type: 'noKeyNeeded', x: dx, y: d.y, target: d.id });
        }
        continue;
      }
      if (h.keys > 0 && d.filling <= 0 && d.energy < HUNGRY_AT) this.deliver(d);
    }
  }

  private hintedBrain = false;

  private deliver(d: District) {
    const before = d.energy;
    this.hero.keys--;
    d.filling = 1;
    d.deliveries++;
    this.deliveries++;

    this.combo = this.playTime - this.lastDeliver <= COMBO_WINDOW ? Math.min(this.combo + 1, 5) : 1;
    this.bestCombo = Math.max(this.bestCombo, this.combo);
    this.lastDeliver = this.playTime;

    // combo x1, x1.5, x2 … up to x3
    let points = Math.round((100 + 150 * (1 - before)) * (1 + 0.5 * (this.combo - 1)));
    const x = doorX(d.side);
    if (d.asleep) {
      d.asleep = false;
      this.wakes++;
      points += 100;
      this.emit({ type: 'wake', x, y: d.y, target: d.id });
    }

    const b = this.config.boss;
    if (b && this.bossActive && b.district === d.id) {
      points += 150;
      if (d.deliveries - (this.bossBase ?? 0) >= b.goal) {
        this.bossActive = false;
        this.bossDone = true;
        points += 1000;
        this.emit({ type: 'bossDone', x, y: d.y, target: d.id, value: 1000 });
      }
    }

    this.score += points;
    this.emit({ type: 'deliver', x, y: d.y, value: points, target: d.id });
    if (this.combo >= 2) this.emit({ type: 'combo', x, y: d.y - 30, value: this.combo });
  }

  /** Boss-district deliveries made before the boss began don't count toward it. */
  private bossBase: number | null = null;

  private finish() {
    this.phase = 'done';
    const power = this.powerTime ? this.powerSum / this.powerTime : 0;
    this.powerBonus = Math.round(power * 1000);
    this.score += this.powerBonus;
    this.emit({ type: 'end', x: 180, y: 320, value: this.score });
  }

  hud(): Hud {
    const b = this.config.boss;
    const bossDistrict = b && this.districts.find((d) => d.id === b.district);
    const lockable = this.districts.filter((d) => d.hasLock);
    return {
      phase: this.phase,
      countdown: Math.max(0, Math.ceil(COUNTDOWN - this.time)),
      score: this.score,
      timeLeft: Math.max(0, Math.ceil(this.config.duration - this.playTime)),
      combo: this.combo,
      cityPower: lockable.reduce((s, d) => s + d.energy, 0) / (lockable.length || 1),
      keys: this.hero.keys,
      maxKeys: MAX_KEYS,
      boss:
        b && bossDistrict
          ? {
              label: b.label,
              goal: b.goal,
              done: this.bossDone
                ? b.goal
                : this.bossBase === null
                  ? 0
                  : Math.min(b.goal, bossDistrict.deliveries - this.bossBase),
              active: this.bossActive,
            }
          : undefined,
    };
  }

  result(): MissionResult {
    const power = this.powerTime ? this.powerSum / this.powerTime : 0;
    const stats = [
      { label: 'Buildings unlocked', value: String(this.deliveries) },
      { label: 'Best combo', value: this.bestCombo ? `x${this.bestCombo}` : '—' },
      { label: 'Sleepy buildings woken', value: String(this.wakes) },
      { label: 'City power', value: `${Math.round(power * 100)}% (+${this.powerBonus})` },
    ];
    if (this.config.boss) stats.push({ label: this.config.boss.label, value: this.bossDone ? 'Won!' : 'Not yet' });
    return { score: this.score, stats };
  }
}
