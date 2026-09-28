import { describe, expect, it } from 'vitest';
import { deriveSceneState, EMPTY_SCENE, glucoseLevelFor, simSceneState, toSceneInput, zoneFor } from './sceneState';
import type { SceneInput, TargetRange } from './types';

const DEFAULT: TargetRange = { low: 70, high: 180 };
const input = (mgdl: number, extra: Partial<SceneInput> = {}): SceneInput => ({
  mgdl,
  insulinGiven: false,
  carbsEaten: false,
  ...extra,
});

describe('zoneFor', () => {
  it.each([
    [69, 'low'],
    [70, 'inRange'],
    [120, 'inRange'],
    [180, 'inRange'],
    [181, 'high'],
  ] as const)('%i mg/dL is %s with the default range', (mgdl, zone) => {
    expect(zoneFor(mgdl, DEFAULT)).toBe(zone);
  });

  it('follows a custom family-configured range', () => {
    const custom = { low: 80, high: 150 };
    expect(zoneFor(75, custom)).toBe('low');
    expect(zoneFor(160, custom)).toBe('high');
    expect(zoneFor(160, DEFAULT)).toBe('inRange');
  });
});

describe('glucoseLevelFor', () => {
  it('places the target range in the middle third', () => {
    expect(glucoseLevelFor(70, DEFAULT)).toBeCloseTo(1 / 3);
    expect(glucoseLevelFor(180, DEFAULT)).toBeCloseTo(2 / 3);
    expect(glucoseLevelFor(125, DEFAULT)).toBeCloseTo(0.5);
  });

  it('is monotonic and stays within 0..1', () => {
    let prev = -1;
    for (let mgdl = 20; mgdl <= 600; mgdl += 5) {
      const level = glucoseLevelFor(mgdl, DEFAULT);
      expect(level).toBeGreaterThanOrEqual(prev);
      expect(level).toBeGreaterThan(0);
      expect(level).toBeLessThanOrEqual(1);
      prev = level;
    }
  });

  it('saturates for very high readings', () => {
    expect(glucoseLevelFor(600, DEFAULT)).toBe(1);
  });
});

describe('deriveSceneState', () => {
  it('returns an empty scene when there is no reading', () => {
    expect(deriveSceneState(null, DEFAULT)).toEqual(EMPTY_SCENE);
  });

  it('HIGH: crowded, locked, dim, spilling to kidneys', () => {
    const s = deriveSceneState(input(250), DEFAULT);
    expect(s.zone).toBe('high');
    expect(s.locks).toBe('closed');
    expect(s.kidneySpill).toBe(true);
    expect(s.cellEnergy).toBeLessThan(0.5);
    expect(s.glucoseLevel).toBeGreaterThan(2 / 3);
    expect(s.events).toEqual([]);
  });

  it('IN RANGE: balanced, open, fully fueled', () => {
    const s = deriveSceneState(input(110), DEFAULT);
    expect(s).toMatchObject({ zone: 'inRange', locks: 'open', kidneySpill: false, cellEnergy: 1 });
  });

  it('LOW: little glucose, cells dimming', () => {
    const s = deriveSceneState(input(55), DEFAULT);
    expect(s.zone).toBe('low');
    expect(s.glucoseLevel).toBeLessThan(1 / 3);
    expect(s.cellEnergy).toBeLessThan(1);
    expect(s.kidneySpill).toBe(false);
  });

  it('LOW: cells get dimmer as the reading drops', () => {
    expect(deriveSceneState(input(40), DEFAULT).cellEnergy).toBeLessThan(
      deriveSceneState(input(65), DEFAULT).cellEnergy,
    );
  });

  it('logged insulin triggers the hero animation and opens locks when high', () => {
    const s = deriveSceneState(input(250, { insulinGiven: true }), DEFAULT);
    expect(s.events).toContain('insulinHeroes');
    expect(s.locks).toBe('opening');
  });

  it('logged carbs trigger the fast-sugar helper when low, food glucose otherwise', () => {
    expect(deriveSceneState(input(60, { carbsEaten: true }), DEFAULT).events).toEqual(['fastSugarHelper']);
    expect(deriveSceneState(input(120, { carbsEaten: true }), DEFAULT).events).toEqual(['foodGlucose']);
  });

  it('never shows the fast-sugar helper unless carbs were logged', () => {
    expect(deriveSceneState(input(50), DEFAULT).events).not.toContain('fastSugarHelper');
  });
});

describe('simSceneState', () => {
  it('plays the animation for the last button pressed', () => {
    expect(simSceneState(200, DEFAULT, { insulin: true, food: false }, { type: 'insulin', size: 'small' }).events).toEqual(['insulinHeroes']);
    expect(simSceneState(60, DEFAULT, { insulin: false, food: true }, { type: 'food', kind: 'fastSugar' }).events).toEqual(['fastSugarHelper']);
    expect(simSceneState(120, DEFAULT, { insulin: false, food: true }, { type: 'food', kind: 'meal' }).events).toEqual(['foodGlucose']);
    expect(simSceneState(120, DEFAULT, { insulin: false, food: false }, null).events).toEqual([]);
  });

  it('high with insulin still working → heroes opening the locks', () => {
    expect(simSceneState(220, DEFAULT, { insulin: true, food: false }, null).locks).toBe('opening');
    expect(simSceneState(220, DEFAULT, { insulin: false, food: false }, null).locks).toBe('closed');
  });
});

describe('safety: amounts never reach the scene', () => {
  const base = {
    mgdl: 240,
    insulinGiven: true,
    carbsEaten: true,
  };

  it('toSceneInput drops entered amounts', () => {
    const scene = toSceneInput({ ...base, insulinUnitsEntered: 4, carbsGramsEntered: 30 } as never);
    expect(Object.keys(scene).sort()).toEqual(['carbsEaten', 'insulinGiven', 'mgdl']);
  });

  it('scene output is identical regardless of the amounts entered', () => {
    const a = deriveSceneState(toSceneInput({ ...base, insulinUnitsEntered: 1, carbsGramsEntered: 5 } as never), DEFAULT);
    const b = deriveSceneState(toSceneInput({ ...base, insulinUnitsEntered: 20, carbsGramsEntered: 90 } as never), DEFAULT);
    expect(a).toEqual(b);
  });
});
