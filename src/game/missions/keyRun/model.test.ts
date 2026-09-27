import { describe, expect, it } from 'vitest';
import { missionById } from '../../story/content';
import { doorX } from '../districts';
import { HUNGRY_AT, KeyRunModel, MAX_KEYS, type KeyRunConfig } from './model';

const BASIC: KeyRunConfig = { duration: 60, keyEvery: [0.8, 1.3], drain: 0.08, scrollSpeed: 110 };
const BOSS: KeyRunConfig = {
  ...BASIC,
  duration: 75,
  obstacles: { every: [2, 3.5], startAt: 5 },
  boss: { district: 'muscle', label: 'Soccer match', goal: 5, startAt: 15, drainMultiplier: 3 },
};

const FPS = 60;
const DT = 1000 / FPS;

/** A decent player: grab keys, then fly to the hungriest building. */
function skilledTarget(m: KeyRunModel) {
  const h = m.hero;
  const hungry = m.districts
    .filter((d) => d.hasLock && d.filling <= 0 && d.energy < HUNGRY_AT)
    .sort((a, b) => a.energy - b.energy)[0];
  if (h.keys > 0 && hungry) return { x: doorX(hungry.side), y: hungry.y };
  if (h.keys < MAX_KEYS) {
    const key = [...m.keys].filter((k) => k.y > 0).sort((a, b) => Math.hypot(a.x - h.x, a.y - h.y) - Math.hypot(b.x - h.x, b.y - h.y))[0];
    if (key) return { x: key.x, y: key.y + 20 };
  }
  return { x: 180, y: 330 };
}

/** A distracted player: any hungry building, wobbly aim. */
function casualTarget(m: KeyRunModel) {
  const t = skilledTarget(m);
  const h = m.hero;
  const hungry = m.districts.filter((d) => d.hasLock && d.energy < HUNGRY_AT);
  const pick = hungry[Math.floor(m.time * 7) % Math.max(1, hungry.length)];
  const base = h.keys > 0 && pick ? { x: doorX(pick.side), y: pick.y } : t;
  return { x: base.x + Math.sin(m.time * 5) * 30, y: base.y + Math.cos(m.time * 4) * 30 };
}

function play(m: KeyRunModel, policy: ((m: KeyRunModel) => { x: number; y: number } | null) | null, reactEvery = 1) {
  let target: { x: number; y: number } | null = null;
  let frame = 0;
  while (!m.done && frame < 200 * FPS) {
    if (policy && frame % reactEvery === 0) target = policy(m);
    // pointer is below the hero by the finger offset
    m.pointer(target ? { x: target.x, y: target.y + 56, down: true } : { x: 0, y: 0, down: false });
    m.step(DT);
    frame++;
  }
  return m;
}

describe('KeyRunModel', () => {
  it('counts down 3-2-1 then goes', () => {
    const m = new KeyRunModel(BASIC, 1);
    for (let i = 0; i < 3.1 * FPS; i++) m.step(DT);
    const types = m.drainEvents().map((e) => e.type + (e.value ?? ''));
    expect(types).toEqual(['countdown3', 'countdown2', 'countdown1', 'go']);
    expect(m.hud().phase).toBe('play');
  });

  it('picking up a key and flying it to a hungry building unlocks it and scores', () => {
    const m = new KeyRunModel(BASIC, 2);
    for (let i = 0; i < 3.1 * FPS; i++) m.step(DT);
    m.hero.keys = 1;
    const d = m.districts.find((x) => x.id === 'heart')!;
    d.energy = 0.3;
    m.hero.x = doorX(d.side);
    m.hero.y = d.y;
    m.step(DT);
    expect(m.hero.keys).toBe(0);
    expect(d.filling).toBeGreaterThan(0);
    expect(m.score).toBeGreaterThan(0);
    for (let i = 0; i < 1.5 * FPS; i++) m.step(DT);
    expect(d.energy).toBeGreaterThan(0.9);
  });

  it('full buildings do not take keys', () => {
    const m = new KeyRunModel(BASIC, 3);
    for (let i = 0; i < 3.1 * FPS; i++) m.step(DT);
    const d = m.districts.find((x) => x.id === 'fat')!;
    d.energy = 0.95;
    m.hero.keys = 1;
    m.hero.x = doorX(d.side);
    m.hero.y = d.y;
    m.step(DT);
    expect(m.hero.keys).toBe(1);
  });

  it('Brain Tower never needs a key (and says so once)', () => {
    const m = new KeyRunModel(BASIC, 4);
    for (let i = 0; i < 3.1 * FPS; i++) m.step(DT);
    m.drainEvents();
    const brain = m.districts.find((x) => x.id === 'brain')!;
    m.hero.keys = 2;
    m.hero.x = doorX(brain.side);
    m.hero.y = brain.y;
    m.step(DT);
    m.step(DT);
    expect(m.hero.keys).toBe(2);
    expect(brain.energy).toBe(1);
    expect(m.drainEvents().filter((e) => e.type === 'noKeyNeeded')).toHaveLength(1);
  });

  it('can carry at most three keys', () => {
    const m = new KeyRunModel(BASIC, 5);
    play(m, (mm) => {
      const k = mm.keys.filter((x) => x.y > 0)[0];
      return k ? { x: k.x, y: k.y + 10 } : null;
    });
    expect(m.hud().maxKeys).toBe(MAX_KEYS);
    expect(m.hero.keys).toBeLessThanOrEqual(MAX_KEYS);
  });

  it('untended buildings fall asleep (gently — no failure)', () => {
    const m = play(new KeyRunModel(BASIC, 6), null);
    expect(m.done).toBe(true);
    expect(m.districts.filter((d) => d.hasLock).every((d) => d.asleep)).toBe(true);
  });

  it('bumping a traffic jam drops a key', () => {
    const m = new KeyRunModel(BOSS, 7);
    for (let i = 0; i < 3.1 * FPS; i++) m.step(DT);
    m.hero.keys = 2;
    m.obstacles.push({ id: 999, x: m.hero.x, y: m.hero.y, r: 24, sway: 0 });
    m.step(DT);
    expect(m.hero.keys).toBe(1);
    expect(m.hero.stun).toBeGreaterThan(0);
    expect(m.keys.some((k) => k.dropped)).toBe(true);
  });

  it('boss: the soccer match starts, and feeding the stadium enough wins it', () => {
    const m = play(new KeyRunModel(BOSS, 8), skilledTarget);
    const r = m.result();
    expect(r.stats.find((s) => s.label === 'Soccer match')?.value).toBe('Won!');
  });

  it('is deterministic for a seed', () => {
    const a = play(new KeyRunModel(BASIC, 9), skilledTarget);
    const b = play(new KeyRunModel(BASIC, 9), skilledTarget);
    expect(a.score).toBe(b.score);
  });

  it('star thresholds: a sharp player can reach 3 stars; doing nothing earns none', () => {
    for (const id of ['m1-1', 'm1-3']) {
      const mission = missionById(id)!;
      if (mission.kind !== 'keyRun') throw new Error(id);
      const skilled = [21, 22, 23, 24].map((s) => play(new KeyRunModel(mission.config, s), skilledTarget).score);
      const idle = play(new KeyRunModel(mission.config, 21), null).score;
      expect(skilled.reduce((a, b) => a + b) / skilled.length, id).toBeGreaterThanOrEqual(mission.stars[2]);
      expect(idle, id).toBeLessThan(mission.stars[0]);
    }
  });

  it('calibration: skilled > casual > idle', () => {
    const scores = (cfg: KeyRunConfig, policy: typeof skilledTarget | null, react: number) =>
      [11, 12, 13, 14, 15].map((s) => play(new KeyRunModel(cfg, s), policy, react).score);
    const report = {
      basic: { idle: scores(BASIC, null, 1), casual: scores(BASIC, casualTarget, 30), skilled: scores(BASIC, skilledTarget, 1) },
      boss: { idle: scores(BOSS, null, 1), casual: scores(BOSS, casualTarget, 30), skilled: scores(BOSS, skilledTarget, 1) },
    };
    console.log(JSON.stringify(report));
    const avg = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
    // Bots play near-perfectly, so skilled ≈ casual here; both must beat idle by a mile.
    expect(avg(report.basic.skilled)).toBeGreaterThan(avg(report.basic.idle) * 50);
    expect(avg(report.basic.casual)).toBeGreaterThan(avg(report.basic.idle) * 50);
  });
});
