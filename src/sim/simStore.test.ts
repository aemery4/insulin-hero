import { describe, expect, it } from 'vitest';
import { START_MGDL } from '../domain/simulator';
import { SimStore } from './simStore';

describe('SimStore', () => {
  it('starts steady at the example start value', () => {
    const s = new SimStore();
    s.advanceMinutes(120);
    expect(s.getSnapshot()).toMatchObject({ mgdl: START_MGDL, minutes: 120 });
  });

  it('insulin given now lowers glucose over the next hours', () => {
    const s = new SimStore();
    s.give({ type: 'insulin', size: 'medium' });
    s.advanceMinutes(180);
    expect(s.getSnapshot().mgdl).toBeLessThan(START_MGDL - 30);
    expect(s.getSnapshot().last?.action).toEqual({ type: 'insulin', size: 'medium' });
  });

  it('pause stops time; speed x3 runs three times as fast', () => {
    const s = new SimStore();
    s.setRunning(false);
    s.tick(10);
    expect(s.getSnapshot().minutes).toBe(0);
    s.setRunning(true);
    s.setSpeed(3);
    s.tick(2);
    expect(s.getSnapshot().minutes).toBe(30); // 2 s × 5 min/s × 3
  });

  it('fractional ticks add up (frame-rate independent)', () => {
    const a = new SimStore();
    const b = new SimStore();
    a.give({ type: 'food', kind: 'meal' });
    b.give({ type: 'food', kind: 'meal' });
    for (let i = 0; i < 600; i++) a.tick(1 / 60);
    b.tick(10);
    expect(a.getSnapshot().mgdl).toBeCloseTo(b.getSnapshot().mgdl, 6);
  });

  it('keeps a rolling history and can look back for the trend', () => {
    const s = new SimStore();
    s.give({ type: 'food', kind: 'fastSugar' });
    s.advanceMinutes(20);
    expect(s.valueAgo(15)).toBeLessThan(s.getSnapshot().mgdl);
    s.advanceMinutes(600);
    expect(s.getSnapshot().history[0]!.t).toBeGreaterThanOrEqual(620 - 360);
  });

  it('start over resets everything', () => {
    const s = new SimStore();
    s.give({ type: 'insulin', size: 'big' });
    s.advanceMinutes(200);
    s.reset();
    expect(s.getSnapshot()).toMatchObject({ mgdl: START_MGDL, minutes: 0, events: [], last: null });
  });
});
