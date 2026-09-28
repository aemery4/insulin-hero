/**
 * Holds the example-body simulation for the session (survives tab switches,
 * resets on reload or "Start over"). Nothing here is saved or sent anywhere.
 */
import {
  MINUTES_PER_SECOND,
  START_MGDL,
  stepGlucose,
  type SimAction,
  type SimEvent,
} from '../domain/simulator';

export interface SimSample {
  t: number;
  mgdl: number;
}

export interface SimState {
  /** Body-minutes since start. */
  minutes: number;
  mgdl: number;
  events: SimEvent[];
  /** One sample per body-minute for the last few hours (for the chart + trend). */
  history: SimSample[];
  running: boolean;
  speed: 1 | 3;
  /** The most recent action (drives one-shot animations). */
  last: SimEvent | null;
}

const HISTORY_MINUTES = 6 * 60;

function initial(): SimState {
  return { minutes: 0, mgdl: START_MGDL, events: [], history: [{ t: 0, mgdl: START_MGDL }], running: true, speed: 1, last: null };
}

export class SimStore {
  private state: SimState = initial();
  private listeners = new Set<() => void>();
  private nextId = 1;
  private carry = 0;

  subscribe = (fn: () => void) => {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  };

  getSnapshot = () => this.state;

  private set(next: SimState) {
    this.state = next;
    for (const fn of this.listeners) fn();
  }

  /** Advance by real seconds (respects pause + speed). */
  tick(realSeconds: number) {
    const s = this.state;
    if (!s.running) return;
    this.advanceMinutes(realSeconds * MINUTES_PER_SECOND * s.speed);
  }

  /** Advance body time directly (used by tick and tests). */
  advanceMinutes(minutes: number) {
    const s = this.state;
    // step in whole body-minutes so results don't depend on frame rate
    this.carry += minutes;
    const whole = Math.floor(this.carry);
    if (whole <= 0) return;
    this.carry -= whole;
    let mgdl = s.mgdl;
    const history = s.history.slice();
    const active = s.events.filter((e) => s.minutes - e.at < 12 * 60); // finished effects no longer matter
    for (let t = s.minutes; t < s.minutes + whole; t++) {
      mgdl = stepGlucose(mgdl, active, t, t + 1);
      history.push({ t: t + 1, mgdl });
    }
    const end = s.minutes + whole;
    this.set({
      ...s,
      minutes: end,
      mgdl,
      events: active,
      history: history.filter((h) => h.t >= end - HISTORY_MINUTES),
    });
  }

  give(action: SimAction) {
    const e: SimEvent = { id: this.nextId++, action, at: this.state.minutes };
    this.set({ ...this.state, events: [...this.state.events, e], last: e, running: true });
  }

  setRunning(running: boolean) {
    this.set({ ...this.state, running });
  }

  setSpeed(speed: 1 | 3) {
    this.set({ ...this.state, speed });
  }

  reset() {
    this.carry = 0;
    this.set(initial());
  }

  /** Glucose `minutesAgo` body-minutes back (nearest sample). */
  valueAgo(minutesAgo: number): number {
    const target = this.state.minutes - minutesAgo;
    const h = this.state.history;
    for (let i = h.length - 1; i >= 0; i--) if (h[i]!.t <= target) return h[i]!.mgdl;
    return h[0]?.mgdl ?? START_MGDL;
  }
}

/** The one shared example body for the app session. */
export const simStore = new SimStore();
