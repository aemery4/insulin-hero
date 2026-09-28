import { describe, expect, it } from 'vitest';
import { deriveSceneState } from '../domain/sceneState';
import type { SceneInput } from '../domain/types';
import { MAX_GLUCOSE, SceneModel, WORLD } from './SceneModel';

const RANGE = { low: 70, high: 180 };
const state = (mgdl: number, extra: Partial<SceneInput> = {}) =>
  deriveSceneState({ mgdl, insulinGiven: false, carbsEaten: false, ...extra }, RANGE);

/** Advance the simulation at 60fps, returning the max of a sampled value along the way. */
function run(model: SceneModel, seconds: number, sample?: (m: SceneModel) => number) {
  let max = -Infinity;
  for (let i = 0; i < seconds * 60; i++) {
    model.step(1000 / 60);
    if (sample) max = Math.max(max, sample(model));
  }
  return max;
}

const lockable = (m: SceneModel) => m.snapshot().cells.filter((c) => c.hasLock);
const brain = (m: SceneModel) => m.snapshot().cells.find((c) => c.kind === 'brain')!;

describe('SceneModel steady states', () => {
  it('HIGH: crowded bloodstream, locked dim cells, glucose heading to kidneys', () => {
    const m = new SceneModel(1);
    m.apply(state(280), { replay: true });
    const maxToKidney = run(m, 10, (x) => x.snapshot().headingToKidney);
    const s = m.snapshot();
    expect(s.zone).toBe('high');
    expect(s.glucose.target).toBeGreaterThan(MAX_GLUCOSE * (2 / 3));
    expect(Math.abs(s.glucose.count - s.glucose.target)).toBeLessThanOrEqual(6);
    expect(lockable(m).every((c) => c.locked && c.energy <= 0.3)).toBe(true);
    expect(maxToKidney).toBeGreaterThan(0);
  });

  it('HIGH: brain cells still get glucose (they need no key)', () => {
    const m = new SceneModel(1);
    m.apply(state(280), { replay: true });
    run(m, 5);
    expect(brain(m)).toMatchObject({ hasLock: false, locked: false, energy: 1 });
  });

  it('IN RANGE: all cells unlocked and fully powered, nothing spilling', () => {
    const m = new SceneModel(2);
    m.apply(state(120), { replay: true });
    const maxToKidney = run(m, 5, (x) => x.snapshot().headingToKidney);
    expect(m.snapshot().cells.every((c) => !c.locked && c.energy === 1)).toBe(true);
    expect(maxToKidney).toBe(0);
  });

  it('LOW: very little glucose and dim cells', () => {
    const m = new SceneModel(3);
    m.apply(state(50), { replay: true });
    run(m, 5);
    const s = m.snapshot();
    expect(s.glucose.target).toBeLessThan(MAX_GLUCOSE / 3);
    expect(s.cells.every((c) => c.energy < 0.6)).toBe(true);
    expect(s.helpers).toEqual([]);
  });

  it('eases the particle count when the reading changes', () => {
    const m = new SceneModel(4);
    m.apply(state(120), { replay: true });
    run(m, 2);
    m.apply(state(300), { replay: true });
    run(m, 8);
    const s = m.snapshot();
    expect(Math.abs(s.glucose.count - s.glucose.target)).toBeLessThanOrEqual(6);
  });
});

describe('SceneModel event animations', () => {
  it('insulin heroes travel to each locked cell, unlock it, and leave', () => {
    const m = new SceneModel(5);
    m.apply(state(250, { insulinGiven: true }), { replay: true });
    expect(m.snapshot().heroes.active).toBe(3);
    expect(lockable(m).every((c) => c.locked)).toBe(true);

    run(m, 15);
    const s = m.snapshot();
    expect(s.heroes.active).toBe(0);
    expect(s.heroes.unlocked.sort()).toEqual(['fat', 'heart', 'muscle']);
    expect(lockable(m).every((c) => !c.locked && c.energy >= 0.65)).toBe(true);
  });

  it('does not replay events on a re-apply without replay (e.g. settings change)', () => {
    const m = new SceneModel(6);
    m.apply(state(250, { insulinGiven: true }), { replay: true });
    run(m, 15);
    m.apply(state(250, { insulinGiven: true }), { replay: false });
    expect(m.snapshot().heroes.active).toBe(0);
    expect(lockable(m).every((c) => !c.locked)).toBe(true);
  });

  it('fast-sugar helper brings a burst of glucose, then the scene settles to the reading', () => {
    const m = new SceneModel(7);
    m.apply(state(55, { carbsEaten: true }), { replay: true });
    expect(m.snapshot().helpers).toEqual(['fastSugar']);
    const peakBonus = run(m, 6, (x) => x.snapshot().glucose.bonus);
    expect(peakBonus).toBeGreaterThan(15);

    run(m, 20);
    const s = m.snapshot();
    expect(s.helpers).toEqual([]);
    expect(Math.abs(s.glucose.count - s.glucose.target)).toBeLessThanOrEqual(4);
  });

  it('going from HIGH to a LOW with fast sugar drains the old glucose even while the helper works', () => {
    const m = new SceneModel(11);
    m.apply(state(300), { replay: true });
    run(m, 3);
    m.apply(state(55, { carbsEaten: true }), { replay: true });
    run(m, 4);
    const s = m.snapshot();
    expect(s.helpers).toEqual(['fastSugar']);
    expect(s.glucose.count - s.glucose.bonus).toBeLessThanOrEqual(s.glucose.target + 6);
  });

  it('a big jump up fills in across the vessel instead of in one clump', () => {
    const m = new SceneModel(12);
    m.apply(state(60), { replay: true });
    run(m, 2);
    m.apply(state(300), { replay: true });
    run(m, 1);
    const xs = m.particles.filter((p) => p.mode === 'flow').map((p) => p.x);
    expect(xs.filter((x) => x > WORLD.w / 2).length).toBeGreaterThan(xs.length / 4);
  });

  it('food eaten while insulin is still working keeps the unlocked doors open', () => {
    const m = new SceneModel(13);
    m.apply(state(250, { insulinGiven: true }), { replay: true });
    run(m, 15);
    // later: still high, insulin still working, a snack arrives (no new heroes)
    const s = { ...state(240, { insulinGiven: true }), events: ['foodGlucose' as const] };
    m.apply(s, { replay: true });
    expect(lockable(m).every((c) => !c.locked)).toBe(true);
  });

  it('food helper appears when carbs are logged outside a low', () => {
    const m = new SceneModel(8);
    m.apply(state(130, { carbsEaten: true }), { replay: true });
    expect(m.snapshot().helpers).toEqual(['food']);
  });

  it('reduced motion: heroes fade in at the cells instead of travelling', () => {
    const m = new SceneModel(9);
    m.apply(state(250, { insulinGiven: true }), { replay: true, reducedMotion: true });
    const hero = m.heroes[0]!;
    const cell = m.cells.find((c) => c.kind === hero.cell)!;
    expect(hero.x).toBe(cell.x);
    run(m, 15);
    expect(m.snapshot().heroes.unlocked).toHaveLength(3);
    expect(m.snapshot().reducedMotion).toBe(true);
  });

  it('is deterministic for a given seed', () => {
    const a = new SceneModel(42);
    const b = new SceneModel(42);
    for (const m of [a, b]) {
      m.apply(state(200, { insulinGiven: true, carbsEaten: true }), { replay: true });
      run(m, 7);
    }
    expect(a.snapshot()).toEqual(b.snapshot());
  });
});
