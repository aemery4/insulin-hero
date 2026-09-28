import { describe, expect, it } from 'vitest';
import {
  fractionDone,
  HIGH_LIMIT,
  LOW_LIMIT,
  START_MGDL,
  stepGlucose,
  stillWorking,
  trendFrom,
  type SimAction,
  type SimEvent,
} from './simulator';

let id = 0;
const ev = (action: SimAction, at = 0): SimEvent => ({ id: ++id, action, at });
const at = (events: SimEvent[], minutes: number, start = START_MGDL) => stepGlucose(start, events, 0, minutes);

describe('simulator curves', () => {
  it('fractionDone goes 0 → 1 smoothly', () => {
    expect(fractionDone(0, 60)).toBe(0);
    expect(fractionDone(60, 60)).toBeGreaterThan(0.2);
    expect(fractionDone(600, 60)).toBeGreaterThan(0.99);
  });

  it('stays steady at the start value with nothing given', () => {
    expect(at([], 300)).toBe(START_MGDL);
  });
});

describe('cause and effect', () => {
  it('insulin brings glucose down — slowly', () => {
    const e = [ev({ type: 'insulin', size: 'medium' })];
    expect(START_MGDL - at(e, 10)).toBeLessThan(3); // barely moved after 10 minutes
    expect(at(e, 90)).toBeLessThan(START_MGDL - 15);
    expect(at(e, 300)).toBeCloseTo(START_MGDL - 60, -1);
  });

  it('bigger insulin → bigger drop', () => {
    const drop = (size: 'small' | 'medium' | 'big') => START_MGDL - at([ev({ type: 'insulin', size })], 300, 250);
    expect(drop('small')).toBeLessThan(drop('medium'));
    expect(drop('medium')).toBeLessThan(drop('big'));
  });

  it('food raises glucose faster than insulin lowers it', () => {
    const food = at([ev({ type: 'food', kind: 'meal' })], 30) - START_MGDL;
    const insulin = START_MGDL - at([ev({ type: 'insulin', size: 'big' })], 30);
    expect(food).toBeGreaterThan(insulin);
  });

  it('fast sugar is the quickest', () => {
    const rise = (kind: 'snack' | 'meal' | 'fastSugar') => at([ev({ type: 'food', kind })], 15) - START_MGDL;
    expect(rise('fastSugar')).toBeGreaterThan(rise('snack'));
    expect(rise('fastSugar')).toBeGreaterThan(rise('meal'));
  });

  it('a meal alone goes high; a meal with insulin comes back toward where it started', () => {
    const meal = ev({ type: 'food', kind: 'meal' });
    const alone = at([meal], 300);
    const withInsulin = at([meal, ev({ type: 'insulin', size: 'big' })], 300);
    expect(alone).toBeGreaterThan(180);
    expect(withInsulin).toBeLessThan(alone - 80);
  });

  it('big insulin with no food can go low', () => {
    expect(at([ev({ type: 'insulin', size: 'big' })], 300)).toBeLessThan(70);
  });

  it('fast sugar brings a low back up within about half an hour', () => {
    const low = 50;
    const after = stepGlucose(low, [ev({ type: 'food', kind: 'fastSugar' }, 0)], 0, 30);
    expect(after).toBeGreaterThan(low + 30);
  });

  it('never shows beyond meter limits, and food still helps after bottoming out', () => {
    const events = [ev({ type: 'insulin', size: 'big' }), ev({ type: 'insulin', size: 'big' })];
    const bottom = stepGlucose(START_MGDL, events, 0, 400);
    expect(bottom).toBe(LOW_LIMIT);
    const rescued = stepGlucose(bottom, [...events, ev({ type: 'food', kind: 'fastSugar' }, 400)], 400, 430);
    expect(rescued).toBeGreaterThan(LOW_LIMIT + 20);
    const lots = Array.from({ length: 8 }, () => ev({ type: 'food', kind: 'meal' }));
    expect(at(lots, 300)).toBe(HIGH_LIMIT);
  });

  it('is the same whether stepped all at once or in pieces', () => {
    const e = [ev({ type: 'food', kind: 'snack' }), ev({ type: 'insulin', size: 'small' }, 20)];
    let g = START_MGDL;
    for (let t = 0; t < 200; t += 7) g = stepGlucose(g, e, t, Math.min(t + 7, 200));
    expect(g).toBeCloseTo(at(e, 200), 6);
  });
});

describe('status helpers', () => {
  it('knows when insulin and food are still working', () => {
    const e = [ev({ type: 'insulin', size: 'medium' }), ev({ type: 'food', kind: 'snack' })];
    const early = stillWorking(e, 30);
    expect(early).toMatchObject({ insulin: true, food: true });
    expect(early.insulinMinutesLeft).toBeGreaterThan(200);
    expect(stillWorking(e, 600)).toMatchObject({ insulin: false, food: false, insulinMinutesLeft: 0 });
  });

  it('trend arrows', () => {
    expect(trendFrom(160, 120)).toBe('upFast');
    expect(trendFrom(130, 120)).toBe('up');
    expect(trendFrom(122, 120)).toBe('flat');
    expect(trendFrom(110, 120)).toBe('down');
    expect(trendFrom(80, 120)).toBe('downFast');
  });
});
