import { describe, expect, it } from 'vitest';
import type { Reading } from '../../domain/types';
import { buildChart, inWindow, scaleLinear, yDomain, yTicks, zoneCounts, type Box } from './chartMath';

const NOW = Date.UTC(2026, 8, 27, 12);
const H = 3600_000;
const reading = (mgdl: number, hoursAgo: number): Reading => ({
  id: `${mgdl}-${hoursAgo}`,
  personId: 'me',
  timestamp: NOW - hoursAgo * H,
  mgdl,
  insulinGiven: false,
  carbsEaten: false,
  source: 'manual',
});
const RANGE = { low: 70, high: 180 };
const BOX: Box = { width: 400, height: 200, left: 40, right: 10, top: 10, bottom: 30 };

describe('chartMath', () => {
  it('scaleLinear maps domain to range', () => {
    const s = scaleLinear([0, 100], [200, 0]);
    expect(s(0)).toBe(200);
    expect(s(50)).toBe(100);
    expect(s(100)).toBe(0);
  });

  it('inWindow keeps only readings inside the window', () => {
    const rs = [reading(100, 1), reading(100, 30), reading(100, -1)];
    expect(inWindow(rs, 24 * H, NOW)).toHaveLength(1);
  });

  it('yDomain always includes the target range with headroom', () => {
    expect(yDomain([], RANGE)).toEqual([20, 300]);
    const [lo, hi] = yDomain([reading(35, 1), reading(420, 2)], RANGE);
    expect(lo).toBeLessThanOrEqual(25);
    expect(hi).toBeGreaterThanOrEqual(430);
  });

  it('yTicks are evenly spaced inside the domain', () => {
    expect(yTicks([20, 300])).toEqual([50, 100, 150, 200, 250, 300]);
    expect(yTicks([0, 500])).toEqual([0, 100, 200, 300, 400, 500]);
  });

  it('buildChart places points in time order inside the plot box and shades the range', () => {
    const c = buildChart([reading(250, 2), reading(60, 20), reading(120, 10)], RANGE, 24 * H, NOW, BOX);
    expect(c.points.map((p) => p.mgdl)).toEqual([60, 120, 250]);
    for (const p of c.points) {
      expect(p.x).toBeGreaterThanOrEqual(BOX.left);
      expect(p.x).toBeLessThanOrEqual(BOX.width - BOX.right);
      expect(p.y).toBeGreaterThanOrEqual(BOX.top);
      expect(p.y).toBeLessThanOrEqual(BOX.height - BOX.bottom);
    }
    expect(c.band.top).toBeLessThan(c.band.bottom);
    expect(c.points.map((p) => p.zone)).toEqual(['low', 'inRange', 'high']);
  });

  it('band follows a custom range', () => {
    const a = buildChart([], RANGE, 24 * H, NOW, BOX);
    const b = buildChart([], { low: 90, high: 150 }, 24 * H, NOW, BOX);
    expect(b.band.bottom).toBeLessThan(a.band.bottom);
    expect(b.band.top).toBeGreaterThan(a.band.top);
  });

  it('zoneCounts tallies zones', () => {
    expect(zoneCounts([{ zone: 'low' }, { zone: 'high' }, { zone: 'high' }])).toEqual({ low: 1, inRange: 0, high: 2 });
  });
});
