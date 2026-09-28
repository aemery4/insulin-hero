/**
 * An ILLUSTRATIVE example body. Tapping insulin or food changes blood glucose
 * over (sped-up) time so cause and effect can be seen.
 *
 * SAFETY: This is not a model of Wyatt or anyone real. Inputs are deliberately
 * abstract sizes — no units, no grams — so there is no ratio to copy into real
 * dosing. Effect sizes and timings are round, made-up "textbook-shaped" values.
 * Real decisions come from the care team.
 */

export type InsulinSize = 'small' | 'medium' | 'big';
export type FoodKind = 'snack' | 'meal' | 'fastSugar';

export type SimAction = { type: 'insulin'; size: InsulinSize } | { type: 'food'; kind: FoodKind };

export interface SimEvent {
  id: number;
  action: SimAction;
  /** Body-minutes since the simulation started. */
  at: number;
}

/** Where the example body starts: steady and in range. */
export const START_MGDL = 120;
/** One real second = this many body-minutes. */
export const MINUTES_PER_SECOND = 5;
/** Display limits, like a home meter's "LO" / "HI". */
export const LOW_LIMIT = 40;
export const HIGH_LIMIT = 400;

interface Effect {
  /** Total mg/dL change once fully absorbed/finished. */
  total: number;
  /** Minutes to peak activity (gamma-shaped curve). */
  tau: number;
}

/** Illustrative only. Insulin is slow (works over ~3–4 hours); food is fast. */
const INSULIN: Record<InsulinSize, Effect> = {
  small: { total: -30, tau: 60 },
  medium: { total: -60, tau: 60 },
  big: { total: -100, tau: 60 },
};

const FOOD: Record<FoodKind, Effect> = {
  snack: { total: 40, tau: 20 },
  meal: { total: 90, tau: 35 },
  fastSugar: { total: 45, tau: 8 },
};

export function effectOf(action: SimAction): Effect {
  return action.type === 'insulin' ? INSULIN[action.size] : FOOD[action.kind];
}

/** Fraction (0..1) of an effect that has happened `t` minutes after it started. */
export function fractionDone(t: number, tau: number): number {
  if (t <= 0) return 0;
  const x = t / tau;
  return 1 - (1 + x) * Math.exp(-x);
}

const clamp = (v: number) => Math.min(HIGH_LIMIT, Math.max(LOW_LIMIT, v));

/**
 * Advance glucose from minute t0 to t1 (one-minute steps). Clamped at each step,
 * so food still helps after a very low value instead of vanishing into a hidden deficit.
 */
export function stepGlucose(g: number, events: SimEvent[], t0: number, t1: number): number {
  let value = g;
  for (let t = t0; t < t1; t += 1) {
    const next = Math.min(t + 1, t1);
    let delta = 0;
    for (const e of events) {
      const { total, tau } = effectOf(e.action);
      delta += total * (fractionDone(next - e.at, tau) - fractionDone(t - e.at, tau));
    }
    value = clamp(value + delta);
  }
  return value;
}

/** How much of each kind of action is still working (0 = nothing left). */
export function stillWorking(events: SimEvent[], t: number) {
  let insulin = 0;
  let food = 0;
  let insulinMinutes = 0;
  for (const e of events) {
    const { total, tau } = effectOf(e.action);
    const left = Math.abs(total) * (1 - fractionDone(t - e.at, tau));
    if (e.action.type === 'insulin') {
      insulin += left;
      // time until 95% done: x where (1+x)e^-x = 0.05 → x ≈ 4.74
      if (left > 1) insulinMinutes = Math.max(insulinMinutes, e.at + 4.74 * tau - t);
    } else food += left;
  }
  return { insulin: insulin > 2, food: food > 2, insulinMinutesLeft: Math.max(0, Math.round(insulinMinutes)) };
}

export type Trend = 'upFast' | 'up' | 'flat' | 'down' | 'downFast';

/** Direction over the last 15 body-minutes. */
export function trendFrom(now: number, fifteenMinAgo: number): Trend {
  const d = now - fifteenMinAgo;
  if (d > 25) return 'upFast';
  if (d > 8) return 'up';
  if (d < -25) return 'downFast';
  if (d < -8) return 'down';
  return 'flat';
}

export const TREND_ARROW: Record<Trend, string> = { upFast: '⇈', up: '↑', flat: '→', down: '↓', downFast: '⇊' };
export const TREND_WORDS: Record<Trend, string> = {
  upFast: 'rising fast',
  up: 'rising',
  flat: 'steady',
  down: 'falling',
  downFast: 'falling fast',
};

export function formatBodyTime(minutes: number): string {
  const m = Math.floor(minutes);
  const h = Math.floor(m / 60);
  return h ? `${h} h ${m % 60} min` : `${m} min`;
}
