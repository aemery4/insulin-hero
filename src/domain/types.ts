/**
 * Core data types.
 *
 * SAFETY: Insulin and carb amounts are stored exactly as the family entered them,
 * for their own log. Nothing in this app computes with those amounts — the scene
 * only ever sees whether insulin/food was logged (see `SceneInput`).
 */

export type Zone = 'low' | 'inRange' | 'high';

export interface TargetRange {
  /** mg/dL, family-configured */
  low: number;
  /** mg/dL, family-configured */
  high: number;
}

export type ReadingSource = 'manual' | 'cgm-import';

export interface Reading {
  id: string;
  /** Future multi-member support; one person for now. */
  personId: string;
  /** Epoch milliseconds. */
  timestamp: number;
  mgdl: number;
  notes?: string;
  insulinGiven: boolean;
  /** As entered by the family. Display only — never used in any calculation. */
  insulinUnitsEntered?: number;
  carbsEaten: boolean;
  /** As entered by the family. Display only — never used in any calculation. */
  carbsGramsEntered?: number;
  source: ReadingSource;
}

export interface HeroSettings {
  name: string;
  bodyColor: string;
  capeColor: string;
}

export interface Settings {
  /** Shown in the disclaimer and explanations; set by the family on their device. */
  childName: string;
  range: TargetRange;
  hero: HeroSettings;
  reducedMotion: 'system' | 'on' | 'off';
}

/**
 * The only facts the scene is allowed to know about a reading. Amounts are
 * deliberately absent so animations can never scale with a dose or carb count.
 */
export interface SceneInput {
  mgdl: number;
  insulinGiven: boolean;
  carbsEaten: boolean;
}

export type SceneEvent = 'insulinHeroes' | 'fastSugarHelper' | 'foodGlucose';

export type LockState = 'open' | 'closed' | 'opening';

export interface SceneState {
  zone: Zone | 'none';
  /** 0..1 — how crowded the bloodstream looks. Visual only. */
  glucoseLevel: number;
  /** 0..1 — how brightly the cells glow. Visual only. */
  cellEnergy: number;
  locks: LockState;
  kidneySpill: boolean;
  /** One-shot animations to play for this reading. */
  events: SceneEvent[];
}
