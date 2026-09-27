/**
 * DOOR RUSH — insulin heroes open doors for a few seconds at a time. Tap or
 * swipe glucose to send it through an open door. Glucose that isn't used drifts
 * to the Kidney Filter Plant.
 *
 * Fictional game rules. Nothing here models real insulin action or doses.
 */
import { createRng, type Rng } from '../../../scene/rng';
import { CITY_LAYOUT, DISTRICTS, LANE, doorX, type DistrictSlot } from '../districts';
import type { GameEvent, Hud, MissionModel, MissionResult, PointerState } from '../types';

export interface DoorRushConfig {
  duration: number;
  /** Seconds between glucose arrivals at the start (min, max); it speeds up over time. */
  spawnEvery: [number, number];
  flowSpeed: number;
  openFor: number;
  closedFor: [number, number];
  drain: number;
  kidneyCapacity: number;
}

const COUNTDOWN = 3;
const TOUCH_RADIUS = 30;
const TRAVEL_TIME = 0.35;
const COMBO_WINDOW = 1.2;
const FEED = 0.12;

export type GlucoseState = 'flow' | 'sent' | 'bonk';

export interface Glucose {
  id: number;
  x: number;
  y: number;
  sway: number;
  state: GlucoseState;
  t: number;
  fromX: number;
  fromY: number;
  target?: string;
}

export interface DoorDistrict extends DistrictSlot {
  hasLock: boolean;
  open: boolean;
  timer: number;
  energy: number;
  drainMult: number;
  fed: number;
}

export class DoorRushModel implements MissionModel {
  time = 0;
  phase: Hud['phase'] = 'countdown';
  score = 0;
  combo = 0;
  bestCombo = 0;
  kidney = 0;
  glucose: Glucose[] = [];
  districts: DoorDistrict[];
  pointerPos: PointerState = { x: 0, y: 0, down: false };

  private rng: Rng;
  private nextId = 1;
  private spawnTimer = 0.3;
  private lastSend = -99;
  private sent = 0;
  private flushes = 0;
  private filtered = 0;
  private powerSum = 0;
  private powerTime = 0;
  private powerBonus = 0;
  private events: GameEvent[] = [];
  private lastCount = COUNTDOWN + 1;

  constructor(
    readonly config: DoorRushConfig,
    seed = 1,
  ) {
    this.rng = createRng(seed);
    this.districts = CITY_LAYOUT.map((d, i) => {
      const hasLock = DISTRICTS[d.kind].hasLock;
      return {
        ...d,
        hasLock,
        // brain has no lock, so its door is always open
        open: !hasLock || i === 0,
        timer: hasLock ? (i === 0 ? config.openFor : this.rng.range(0.8, 3.5)) : Infinity,
        energy: this.rng.range(0.4, 0.7),
        drainMult: hasLock ? this.rng.range(0.85, 1.2) : 0.5,
        fed: 0,
      };
    });
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

  drainEvents() {
    const out = this.events;
    this.events = [];
    return out;
  }

  pointer(p: PointerState) {
    this.pointerPos = p;
    if (p.down && this.phase === 'play') this.touch(p.x, p.y);
  }

  /** Send any glucose under the finger to the best open door. */
  touch(x: number, y: number) {
    for (const g of this.glucose) {
      if (g.state !== 'flow') continue;
      if (Math.hypot(g.x - x, g.y - y) > TOUCH_RADIUS) continue;
      const door = this.bestDoor(g);
      if (!door) {
        g.state = 'bonk';
        g.t = 0;
        this.combo = 0;
        this.emit({ type: 'bonk', x: g.x, y: g.y });
        continue;
      }
      g.state = 'sent';
      g.t = 0;
      g.fromX = g.x;
      g.fromY = g.y;
      g.target = door.id;
      this.combo = this.playTime - this.lastSend <= COMBO_WINDOW ? Math.min(this.combo + 1, 9) : 1;
      this.bestCombo = Math.max(this.bestCombo, this.combo);
      this.lastSend = this.playTime;
      this.emit({ type: 'send', x: g.x, y: g.y, target: door.id, value: this.combo });
    }
  }

  /** Nearest open door on a building that still has room for glucose. */
  private bestDoor(g: Glucose): DoorDistrict | undefined {
    return this.districts
      .filter((d) => d.open && d.energy < 0.98)
      .sort((a, b) => Math.hypot(doorX(a.side) - g.x, a.y - g.y) - Math.hypot(doorX(b.side) - g.x, b.y - g.y))[0];
  }

  step(dtMs: number) {
    if (this.phase === 'done') return;
    const dt = Math.min(dtMs, 50) / 1000;
    this.time += dt;

    if (this.phase === 'countdown') {
      const n = Math.ceil(COUNTDOWN - this.time);
      if (n < this.lastCount && n > 0) this.emit({ type: 'countdown', x: 180, y: 320, value: n });
      this.lastCount = n;
      if (this.time >= COUNTDOWN) {
        this.phase = 'play';
        this.emit({ type: 'go', x: 180, y: 320 });
      }
      return;
    }

    this.spawn(dt);
    this.updateDoors(dt);
    this.moveGlucose(dt);
    if (this.pointerPos.down) this.touch(this.pointerPos.x, this.pointerPos.y);
    if (this.combo > 0 && this.playTime - this.lastSend > COMBO_WINDOW * 2) this.combo = 0;

    if (this.playTime >= this.config.duration) this.finish();
  }

  /** 0 → 1 over the mission: glucose arrives faster and flows quicker. */
  private get intensity() {
    return Math.min(1, this.playTime / this.config.duration);
  }

  private spawn(dt: number) {
    this.spawnTimer -= dt;
    if (this.spawnTimer > 0) return;
    const [lo, hi] = this.config.spawnEvery;
    this.spawnTimer = this.rng.range(lo, hi) / (1 + 0.8 * this.intensity);
    this.glucose.push({
      id: this.nextId++,
      x: this.rng.range(LANE.left + 26, LANE.right - 26),
      y: -16,
      sway: this.rng.range(0, Math.PI * 2),
      state: 'flow',
      t: 0,
      fromX: 0,
      fromY: 0,
    });
  }

  private updateDoors(dt: number) {
    let sum = 0;
    let n = 0;
    for (const d of this.districts) {
      d.energy = Math.max(0, d.energy - this.config.drain * d.drainMult * dt);
      d.fed = Math.max(0, d.fed - dt * 2);
      if (d.hasLock) {
        d.timer -= dt;
        if (d.timer <= 0) {
          d.open = !d.open;
          d.timer = d.open ? this.config.openFor : this.rng.range(...this.config.closedFor);
          if (d.open) this.emit({ type: 'doorOpen', x: doorX(d.side), y: d.y, target: d.id });
        }
        sum += d.energy;
        n++;
      }
    }
    this.powerSum += (n ? sum / n : 1) * dt;
    this.powerTime += dt;
  }

  private moveGlucose(dt: number) {
    const speed = this.config.flowSpeed * (1 + 0.6 * this.intensity);
    for (const g of this.glucose) {
      g.t += dt;
      if (g.state === 'sent') {
        const d = this.districts.find((x) => x.id === g.target)!;
        const k = Math.min(1, g.t / TRAVEL_TIME);
        const e = 1 - (1 - k) * (1 - k);
        g.x = g.fromX + (doorX(d.side) - g.fromX) * e;
        g.y = g.fromY + (d.y - g.fromY) * e - Math.sin(k * Math.PI) * 24;
        if (k >= 1) {
          const before = d.energy;
          d.energy = Math.min(1, d.energy + FEED);
          d.fed = 1;
          this.sent++;
          const points = Math.round((50 + 100 * (1 - before)) * (1 + 0.25 * (Math.max(1, this.combo) - 1)));
          this.score += points;
          this.emit({ type: 'deliver', x: doorX(d.side), y: d.y, value: points, target: d.id });
          g.state = 'bonk';
          g.y = 99999; // consumed
        }
        continue;
      }
      g.y += speed * dt * (g.state === 'bonk' ? 0.7 : 1);
      g.x += Math.sin(this.time * 2.2 + g.sway) * 16 * dt;
      if (g.state === 'bonk' && g.t > 0.5 && g.y < LANE.bottom) g.state = 'flow';
      if (g.y > LANE.bottom && g.y < 9999) {
        g.y = 99999;
        this.kidney++;
        this.filtered++;
        this.emit({ type: 'kidney', x: g.x, y: LANE.bottom, value: this.kidney });
        if (this.kidney >= this.config.kidneyCapacity) {
          this.kidney = 0;
          this.flushes++;
          this.combo = 0;
          this.emit({ type: 'flush', x: 180, y: LANE.bottom });
        }
      }
    }
    this.glucose = this.glucose.filter((g) => g.y < 9999);
  }

  private finish() {
    this.phase = 'done';
    const power = this.powerTime ? this.powerSum / this.powerTime : 0;
    this.powerBonus = Math.round(power * 1000);
    this.score += this.powerBonus;
    this.emit({ type: 'end', x: 180, y: 320, value: this.score });
  }

  hud(): Hud {
    const lockable = this.districts.filter((d) => d.hasLock);
    return {
      phase: this.phase,
      countdown: Math.max(0, Math.ceil(COUNTDOWN - this.time)),
      score: this.score,
      timeLeft: Math.max(0, Math.ceil(this.config.duration - this.playTime)),
      combo: this.combo,
      cityPower: lockable.reduce((s, d) => s + d.energy, 0) / (lockable.length || 1),
      kidney: this.kidney / this.config.kidneyCapacity,
    };
  }

  result(): MissionResult {
    const power = this.powerTime ? this.powerSum / this.powerTime : 0;
    return {
      score: this.score,
      stats: [
        { label: 'Glucose sent inside', value: String(this.sent) },
        { label: 'Best combo', value: this.bestCombo ? `x${this.bestCombo}` : '—' },
        { label: 'Filtered by the kidney', value: String(this.filtered) },
        { label: 'City power', value: `${Math.round(power * 100)}% (+${this.powerBonus})` },
      ],
    };
  }
}
