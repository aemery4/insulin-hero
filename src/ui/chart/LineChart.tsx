import { useEffect, useRef, useState } from 'react';
import type { Reading, TargetRange, Zone } from '../../domain/types';
import { formatDateTime } from '../format';
import { buildChart, plural, WINDOWS, zoneCounts, type Box, type ChartPoint, type WindowKey } from './chartMath';

interface Props {
  readings: Reading[];
  range: TargetRange;
  now?: number;
}

const HEIGHT = 240;
const MARGIN = { left: 40, right: 12, top: 12, bottom: 28 };

/** Point shape carries the zone too, so color is never the only signal. */
function Marker({ p }: { p: ChartPoint }) {
  const cls = `pt pt-${p.zone}`;
  if (p.zone === 'high') return <path className={cls} d={`M${p.x} ${p.y - 6} L${p.x + 6} ${p.y + 4} L${p.x - 6} ${p.y + 4} Z`} />;
  if (p.zone === 'low') return <path className={cls} d={`M${p.x} ${p.y + 6} L${p.x + 6} ${p.y - 4} L${p.x - 6} ${p.y - 4} Z`} />;
  return <circle className={cls} cx={p.x} cy={p.y} r={4.5} />;
}

function useWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState(340);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(([entry]) => entry && setWidth(Math.max(260, Math.round(entry.contentRect.width))));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, width] as const;
}

/** Ticks on local-time boundaries: every 6 hours, every 2 days, or every week. */
function timeLabels(windowKey: WindowKey, now: number, x: (t: number) => number) {
  const start = now - WINDOWS[windowKey].ms;
  const d = new Date(start);
  const fmt = new Intl.DateTimeFormat(
    undefined,
    windowKey === 'day' ? { hour: 'numeric' } : { month: 'short', day: 'numeric' },
  );
  if (windowKey === 'day') d.setHours(Math.ceil(d.getHours() / 6) * 6, 0, 0, 0);
  else d.setHours(24, 0, 0, 0);
  const stepDays = windowKey === 'week' ? 2 : 7;
  const labels: { x: number; label: string }[] = [];
  while (d.getTime() <= now) {
    labels.push({ x: x(d.getTime()), label: fmt.format(d) });
    if (windowKey === 'day') d.setHours(d.getHours() + 6);
    else d.setDate(d.getDate() + stepDays);
  }
  return labels;
}

const ZONE_WORD: Record<Zone, string> = { low: 'low', inRange: 'in range', high: 'high' };

export function LineChart({ readings, range, now: nowProp }: Props) {
  const [windowKey, setWindowKey] = useState<WindowKey>('week');
  const [mountedAt] = useState(() => Date.now());
  const now = nowProp ?? Math.max(mountedAt, readings.at(-1)?.timestamp ?? 0);
  const [ref, width] = useWidth<HTMLDivElement>();
  const box: Box = { width, height: HEIGHT, ...MARGIN };
  const chart = buildChart(readings, range, WINDOWS[windowKey].ms, now, box);
  const counts = zoneCounts(chart.points);
  const summary =
    chart.points.length === 0
      ? `No readings in the last ${WINDOWS[windowKey].label}.`
      : `Last ${WINDOWS[windowKey].label}: ${plural(chart.points.length, 'reading')} — ${counts.inRange} in range, ${counts.high} high, ${counts.low} low. Target range ${range.low} to ${range.high}.`;
  const path = chart.points.map((p, i) => `${i ? 'L' : 'M'}${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ');

  return (
    <div className="chart">
      <div className="segmented" role="group" aria-label="Time window">
        {(Object.keys(WINDOWS) as WindowKey[]).map((k) => (
          <button key={k} type="button" aria-pressed={k === windowKey} onClick={() => setWindowKey(k)}>
            {WINDOWS[k].label}
          </button>
        ))}
      </div>

      <div ref={ref} className="chart-frame">
        <svg width={width} height={HEIGHT} role="img" aria-label={summary}>
          <rect
            className="band"
            x={MARGIN.left}
            y={chart.band.top}
            width={width - MARGIN.left - MARGIN.right}
            height={chart.band.bottom - chart.band.top}
          />
          {chart.ticks.map((t) => (
            <g key={t.value}>
              <line className="grid" x1={MARGIN.left} x2={width - MARGIN.right} y1={t.y} y2={t.y} />
              <text className="axis" x={MARGIN.left - 6} y={t.y + 4} textAnchor="end">
                {t.value}
              </text>
            </g>
          ))}
          {timeLabels(windowKey, now, chart.x)
            .filter((t) => t.x < width - MARGIN.right - 18)
            .map((t, i) => (
            <text key={i} className="axis" x={t.x} y={HEIGHT - 8} textAnchor="middle">
              {t.label}
            </text>
          ))}
          {chart.points.length > 1 && <path className="line" d={path} />}
          {chart.points.map((p) => (
            <Marker key={p.id} p={p} />
          ))}
        </svg>
      </div>
      <ul className="chart-legend" aria-hidden="true">
        <li>
          <span className="key-band" /> Target {range.low}–{range.high}
        </li>
        <li>
          <svg width="14" height="14" viewBox="-7 -7 14 14">
            <path className="pt pt-high" d="M0 -6 L6 4 L-6 4 Z" />
          </svg>
          High
        </li>
        <li>
          <svg width="14" height="14" viewBox="-7 -7 14 14">
            <circle className="pt pt-inRange" r="5" />
          </svg>
          In range
        </li>
        <li>
          <svg width="14" height="14" viewBox="-7 -7 14 14">
            <path className="pt pt-low" d="M0 6 L6 -4 L-6 -4 Z" />
          </svg>
          Low
        </li>
      </ul>
      <p className="chart-summary">{summary}</p>

      {chart.points.length > 0 && (
        <details className="chart-table">
          <summary>Show as a table</summary>
          <table>
            <thead>
              <tr>
                <th scope="col">When</th>
                <th scope="col">mg/dL</th>
                <th scope="col">Zone</th>
              </tr>
            </thead>
            <tbody>
              {[...chart.points].reverse().map((p) => (
                <tr key={p.id}>
                  <td>{formatDateTime(p.timestamp)}</td>
                  <td>{p.mgdl}</td>
                  <td>{ZONE_WORD[p.zone]}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </details>
      )}
    </div>
  );
}
