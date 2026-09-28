import { useEffect, useRef, useState } from 'react';
import type { SimEvent } from '../../domain/simulator';
import type { TargetRange } from '../../domain/types';
import type { SimSample } from '../../sim/simStore';
import { scaleLinear } from '../chart/chartMath';

interface Props {
  history: SimSample[];
  events: SimEvent[];
  now: number;
  range: TargetRange;
}

const WINDOW = 4 * 60; // body-minutes shown
const H = 64;
const M = { left: 30, right: 8, top: 5, bottom: 16 };
const Y: [number, number] = [40, 300];
const TICKS = [100, 200];

/** Small "last 4 hours" graph of the example body, with button presses marked. */
export function SimChart({ history, events, now, range }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(340);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(([e]) => e && setWidth(Math.max(260, Math.round(e.contentRect.width))));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const start = Math.max(0, now - WINDOW);
  const x = scaleLinear([start, Math.max(start + WINDOW, now)], [M.left, width - M.right]);
  const y = scaleLinear(Y, [H - M.bottom, M.top]);
  const clampY = (v: number) => y(Math.min(Y[1], Math.max(Y[0], v)));
  const pts = history.filter((h) => h.t >= start);
  const path = pts.map((h, i) => `${i ? 'L' : 'M'}${x(h.t).toFixed(1)} ${clampY(h.mgdl).toFixed(1)}`).join(' ');
  const marks = events.filter((e) => e.at >= start);

  return (
    <div ref={ref} className="sim-chart">
      <svg width={width} height={H} role="img" aria-label="Graph of the example body's glucose over the last few hours">
        <rect className="band" x={M.left} y={y(range.high)} width={width - M.left - M.right} height={y(range.low) - y(range.high)} />
        {TICKS.map((v) => (
          <g key={v}>
            <line className="grid" x1={M.left} x2={width - M.right} y1={y(v)} y2={y(v)} />
            <text className="axis" x={M.left - 5} y={y(v) + 4} textAnchor="end">
              {v}
            </text>
          </g>
        ))}
        {marks.map((e) => (
          <g key={e.id} transform={`translate(${x(e.at)}, ${H - M.bottom + 12})`}>
            <line className="mark-line" x1={0} x2={0} y1={-(H - M.bottom - M.top) - 12} y2={-12} />
            <text className="mark" textAnchor="middle">
              {e.action.type === 'insulin' ? '🔑' : e.action.kind === 'fastSugar' ? '🧃' : e.action.kind === 'meal' ? '🍝' : '🍎'}
            </text>
          </g>
        ))}
        {pts.length > 1 && <path className="line" d={path} />}
        {pts.length > 0 && <circle className="now-dot" cx={x(pts.at(-1)!.t)} cy={clampY(pts.at(-1)!.mgdl)} r={5} />}
      </svg>
    </div>
  );
}
