import { describe, expect, it } from 'vitest';
import { missionById } from '../../story/content';
import { doorX } from '../districts';
import { DoorRushModel, type DoorRushConfig } from './model';

const CFG: DoorRushConfig = {
  duration: 45,
  spawnEvery: [0.45, 0.75],
  flowSpeed: 95,
  openFor: 3.2,
  closedFor: [2, 4.5],
  drain: 0.07,
  kidneyCapacity: 12,
};
const FPS = 60;
const DT = 1000 / FPS;

const skipCountdown = (m: DoorRushModel) => {
  for (let i = 0; i < 3.1 * FPS; i++) m.step(DT);
  m.drainEvents();
};

/** Taps the lowest glucose every `every` frames. */
function play(m: DoorRushModel, every: number | null) {
  let f = 0;
  while (!m.done && f < 200 * FPS) {
    if (every && f % every === 0 && m.phase === 'play') {
      const g = m.glucose.filter((x) => x.state === 'flow').sort((a, b) => b.y - a.y)[0];
      if (g && m.districts.some((d) => d.open && d.energy < 0.98)) m.touch(g.x, g.y);
    }
    m.step(DT);
    f++;
  }
  return m;
}

describe('DoorRushModel', () => {
  it('tapping glucose sends it through an open door and feeds that building', () => {
    const m = new DoorRushModel(CFG, 1);
    skipCountdown(m);
    const d = m.districts.find((x) => x.id === 'heart')!;
    for (const x of m.districts) x.open = x === d;
    d.timer = 99;
    d.energy = 0.3;
    m.glucose = [{ id: 1, x: 180, y: 250, sway: 0, state: 'flow', t: 0, fromX: 0, fromY: 0 }];
    m.touch(180, 250);
    expect(m.glucose[0]!.target).toBe('heart');
    for (let i = 0; i < 0.5 * FPS; i++) m.step(DT);
    expect(d.energy).toBeGreaterThan(0.35); // fed, minus a little drain in flight
    expect(m.score).toBeGreaterThan(0);
  });

  it('with every door closed, tapped glucose bonks instead', () => {
    const m = new DoorRushModel(CFG, 2);
    skipCountdown(m);
    for (const x of m.districts) {
      x.open = false;
      x.timer = 99;
    }
    m.glucose = [{ id: 1, x: 180, y: 200, sway: 0, state: 'flow', t: 0, fromX: 0, fromY: 0 }];
    m.touch(180, 200);
    expect(m.glucose[0]!.state).toBe('bonk');
    expect(m.drainEvents().map((e) => e.type)).toContain('bonk');
  });

  it('Brain Tower door is always open (no key needed)', () => {
    const m = new DoorRushModel(CFG, 3);
    play(m, null);
    expect(m.districts.find((d) => d.id === 'brain')!.open).toBe(true);
  });

  it('prefers the nearest open door', () => {
    const m = new DoorRushModel(CFG, 4);
    skipCountdown(m);
    for (const x of m.districts) {
      x.open = true;
      x.timer = 99;
      x.energy = 0.5;
    }
    const fat = m.districts.find((x) => x.id === 'fat')!;
    m.glucose = [{ id: 1, x: doorX('left') + 20, y: fat.y, sway: 0, state: 'flow', t: 0, fromX: 0, fromY: 0 }];
    m.touch(doorX('left') + 20, fat.y);
    expect(m.glucose[0]!.target).toBe('fat');
  });

  it('missed glucose goes to the kidney, which flushes when full', () => {
    const m = play(new DoorRushModel(CFG, 5), null);
    const r = m.result();
    expect(Number(r.stats.find((s) => s.label === 'Filtered by the kidney')!.value)).toBeGreaterThan(CFG.kidneyCapacity);
  });

  it('doors open and close over time', () => {
    const m = new DoorRushModel(CFG, 6);
    skipCountdown(m);
    for (let i = 0; i < 12 * FPS; i++) m.step(DT);
    expect(m.drainEvents().filter((e) => e.type === 'doorOpen').length).toBeGreaterThan(2);
  });

  it('star thresholds: an active player can reach 3 stars; doing nothing earns none', () => {
    const mission = missionById('m1-2')!;
    if (mission.kind !== 'doorRush') throw new Error('m1-2');
    const active = [31, 32, 33].map((s) => play(new DoorRushModel(mission.config, s), 6).score);
    expect(active.reduce((a, b) => a + b) / active.length).toBeGreaterThanOrEqual(mission.stars[2]);
    expect(play(new DoorRushModel(mission.config, 31), null).score).toBeLessThan(mission.stars[0]);
  });

  it('calibration: active > lazy > idle', () => {
    const avg = (every: number | null) =>
      [1, 2, 3, 4, 5].map((s) => play(new DoorRushModel(CFG, s), every).score).reduce((a, b) => a + b) / 5;
    const report = { idle: avg(null), lazy: avg(40), active: avg(6) };
    console.log('doorRush', JSON.stringify(report));
    expect(report.active).toBeGreaterThan(report.lazy);
    expect(report.lazy).toBeGreaterThan(report.idle);
  });
});
