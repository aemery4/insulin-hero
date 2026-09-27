/**
 * Maps a reading to what the animated scene should show.
 *
 * This is a VISUALIZATION mapping only: it decides how crowded the bloodstream
 * looks and how brightly cells glow. It does not — and must never — calculate,
 * recommend, or suggest insulin doses, carb amounts, or treatment decisions.
 */
import type { Reading, SceneInput, SceneState, TargetRange, Zone } from './types';

/** Visual density bands: the in-range band sits in the middle third. */
const LOW_EDGE = 1 / 3;
const HIGH_EDGE = 2 / 3;
const MIN_LEVEL = 0.05;

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

export function zoneFor(mgdl: number, range: TargetRange): Zone {
  if (mgdl < range.low) return 'low';
  if (mgdl > range.high) return 'high';
  return 'inRange';
}

/** Strip a reading down to what the scene may see (never amounts). */
export function toSceneInput(reading: Pick<Reading, 'mgdl' | 'insulinGiven' | 'carbsEaten'>): SceneInput {
  return { mgdl: reading.mgdl, insulinGiven: reading.insulinGiven, carbsEaten: reading.carbsEaten };
}

/** 0..1 visual crowding of the bloodstream, relative to the family's range. */
export function glucoseLevelFor(mgdl: number, range: TargetRange): number {
  const { low, high } = range;
  if (mgdl < low) return clamp(LOW_EDGE * (mgdl / low), MIN_LEVEL, LOW_EDGE);
  if (mgdl > high) return clamp(HIGH_EDGE + (1 - HIGH_EDGE) * ((mgdl - high) / high), HIGH_EDGE, 1);
  const t = high === low ? 0.5 : (mgdl - low) / (high - low);
  return LOW_EDGE + (HIGH_EDGE - LOW_EDGE) * t;
}

export const EMPTY_SCENE: SceneState = {
  zone: 'none',
  glucoseLevel: 0.5,
  cellEnergy: 0.6,
  locks: 'closed',
  kidneySpill: false,
  events: [],
};

export function deriveSceneState(input: SceneInput | null, range: TargetRange): SceneState {
  if (!input) return EMPTY_SCENE;

  const zone = zoneFor(input.mgdl, range);
  const glucoseLevel = glucoseLevelFor(input.mgdl, range);
  const events: SceneState['events'] = [];

  if (input.insulinGiven) events.push('insulinHeroes');
  if (input.carbsEaten) events.push(zone === 'low' ? 'fastSugarHelper' : 'foodGlucose');

  switch (zone) {
    case 'high':
      // Plenty of glucose, but without keys the cells stay locked and hungry.
      return {
        zone,
        glucoseLevel,
        cellEnergy: input.insulinGiven ? 0.7 : 0.3,
        locks: input.insulinGiven ? 'opening' : 'closed',
        kidneySpill: true,
        events,
      };
    case 'low':
      // Doors are open, but there is little glucose left to go through them.
      return {
        zone,
        glucoseLevel,
        cellEnergy: clamp(0.6 * (glucoseLevel / LOW_EDGE), 0.15, 0.6),
        locks: 'open',
        kidneySpill: false,
        events,
      };
    case 'inRange':
      return { zone, glucoseLevel, cellEnergy: 1, locks: 'open', kidneySpill: false, events };
  }
}
