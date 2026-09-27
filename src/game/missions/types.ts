/**
 * Shared mission plumbing. A mission is a pure, seedable model (unit-tested)
 * plus a Pixi renderer that only draws it.
 *
 * Game world: 360 x 640, portrait. Game rules are a simplified, fictional
 * "Glucose City" — not a model of any real body, and never tied to readings.
 */
export const GAME_W = 360;
export const GAME_H = 640;

export type GameEventType =
  | 'countdown'
  | 'go'
  | 'pickup'
  | 'deliver'
  | 'wake'
  | 'combo'
  | 'bump'
  | 'dropKey'
  | 'noKeyNeeded'
  | 'asleep'
  | 'bossStart'
  | 'bossDone'
  | 'send'
  | 'bonk'
  | 'kidney'
  | 'flush'
  | 'doorOpen'
  | 'end';

export interface GameEvent {
  type: GameEventType;
  x: number;
  y: number;
  /** Points, combo level, countdown number, etc. */
  value?: number;
  /** Target id (district) where relevant. */
  target?: string;
}

export interface Hud {
  phase: 'countdown' | 'play' | 'done';
  countdown: number;
  score: number;
  timeLeft: number;
  combo: number;
  /** 0..1 average energy of the city's buildings. */
  cityPower: number;
  keys?: number;
  maxKeys?: number;
  boss?: { label: string; done: number; goal: number; active: boolean };
  kidney?: number;
}

export interface MissionResult {
  score: number;
  /** Friendly breakdown lines for the results screen. */
  stats: { label: string; value: string }[];
}

export interface PointerState {
  x: number;
  y: number;
  down: boolean;
}

export interface MissionModel {
  readonly time: number;
  readonly done: boolean;
  step(dtMs: number): void;
  pointer(p: PointerState): void;
  /** Keyboard nudge (-1..1 per axis), for desktop play. */
  nudge?(dx: number, dy: number): void;
  hud(): Hud;
  result(): MissionResult;
  /** Events since the last call (drives sound + effects). */
  drainEvents(): GameEvent[];
}
