import { zoneFor } from '../../domain/sceneState';
import type { Reading, TargetRange, Zone } from '../../domain/types';

export const WINDOWS = {
  day: { label: '24 hours', ms: 24 * 3600_000 },
  week: { label: '7 days', ms: 7 * 24 * 3600_000 },
  month: { label: '30 days', ms: 30 * 24 * 3600_000 },
} as const;
export type WindowKey = keyof typeof WINDOWS;

export interface Box {
  width: number;
  height: number;
  left: number;
  right: number;
  top: number;
  bottom: number;
}

export interface ChartPoint {
  id: string;
  x: number;
  y: number;
  mgdl: number;
  timestamp: number;
  zone: Zone;
}

export function inWindow(readings: Reading[], windowMs: number, now: number): Reading[] {
  return readings.filter((r) => r.timestamp > now - windowMs && r.timestamp <= now);
}

/** Y axis always shows the whole target range with some headroom. */
export function yDomain(readings: Reading[], range: TargetRange): [number, number] {
  const values = readings.map((r) => r.mgdl);
  const lo = Math.min(range.low, ...values);
  const hi = Math.max(range.high, ...values);
  const floor = Math.max(0, Math.floor((Math.min(lo, 40) - 10) / 20) * 20);
  const ceil = Math.ceil((Math.max(hi, 250) + 10) / 50) * 50;
  return [floor, ceil];
}

export function yTicks([lo, hi]: [number, number]): number[] {
  const step = hi - lo > 300 ? 100 : 50;
  const ticks: number[] = [];
  for (let v = Math.ceil(lo / step) * step; v <= hi; v += step) ticks.push(v);
  return ticks;
}

export function scaleLinear([d0, d1]: [number, number], [r0, r1]: [number, number]) {
  return (v: number) => (d1 === d0 ? (r0 + r1) / 2 : r0 + ((v - d0) / (d1 - d0)) * (r1 - r0));
}

export function buildChart(readings: Reading[], range: TargetRange, windowMs: number, now: number, box: Box) {
  const visible = inWindow(readings, windowMs, now).sort((a, b) => a.timestamp - b.timestamp);
  const domain = yDomain(visible, range);
  const x = scaleLinear([now - windowMs, now], [box.left, box.width - box.right]);
  const y = scaleLinear(domain, [box.height - box.bottom, box.top]);
  const points: ChartPoint[] = visible.map((r) => ({
    id: r.id,
    x: x(r.timestamp),
    y: y(r.mgdl),
    mgdl: r.mgdl,
    timestamp: r.timestamp,
    zone: zoneFor(r.mgdl, range),
  }));
  return {
    points,
    domain,
    ticks: yTicks(domain).map((v) => ({ value: v, y: y(v) })),
    band: { top: y(range.high), bottom: y(range.low) },
    x,
    y,
  };
}

/** Neutral counts for the screen-reader summary. */
export function zoneCounts(points: Pick<ChartPoint, 'zone'>[]): Record<Zone, number> {
  const counts: Record<Zone, number> = { low: 0, inRange: 0, high: 0 };
  for (const p of points) counts[p.zone]++;
  return counts;
}
