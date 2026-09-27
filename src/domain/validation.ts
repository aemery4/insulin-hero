/**
 * Input validation. These limits are data-entry sanity checks (e.g. what a home
 * meter can display), not medical guidance.
 */
import type { TargetRange } from './types';

/** Typical home meter display limits ("LO" / "HI"). */
export const METER_MIN = 20;
export const METER_MAX = 600;
export const RANGE_MIN = 40;
export const RANGE_MAX = 400;
export const NOTES_MAX = 500;
/** Allow small clock drift between devices. */
const FUTURE_TOLERANCE_MS = 5 * 60 * 1000;

export interface ReadingDraft {
  mgdl: string;
  timestamp: number;
  notes: string;
  insulinGiven: boolean;
  insulinUnits: string;
  carbsEaten: boolean;
  carbsGrams: string;
}

export type FieldErrors = Partial<Record<keyof ReadingDraft, string>>;

function parseNumber(raw: string): number | null {
  const s = raw.trim();
  if (s === '') return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : NaN;
}

export function validateReading(draft: ReadingDraft, now: number = Date.now()): FieldErrors {
  const errors: FieldErrors = {};

  const mgdl = parseNumber(draft.mgdl);
  if (mgdl === null) errors.mgdl = 'Enter the blood sugar number.';
  else if (Number.isNaN(mgdl) || !Number.isInteger(mgdl)) errors.mgdl = 'Use a whole number, like 120.';
  else if (mgdl < METER_MIN || mgdl > METER_MAX)
    errors.mgdl = `Enter a number from ${METER_MIN} to ${METER_MAX}.`;

  if (!Number.isFinite(draft.timestamp)) errors.timestamp = 'Choose a date and time.';
  else if (draft.timestamp > now + FUTURE_TOLERANCE_MS) errors.timestamp = "That time hasn't happened yet.";

  if (draft.notes.length > NOTES_MAX) errors.notes = `Keep notes under ${NOTES_MAX} characters.`;

  if (draft.insulinGiven) {
    const u = parseNumber(draft.insulinUnits);
    if (u !== null && (Number.isNaN(u) || u < 0)) errors.insulinUnits = 'Use a number, or leave blank.';
  }
  if (draft.carbsEaten) {
    const g = parseNumber(draft.carbsGrams);
    if (g !== null && (Number.isNaN(g) || g < 0)) errors.carbsGrams = 'Use a number, or leave blank.';
  }

  return errors;
}

export function validateRange(range: TargetRange): string | null {
  const { low, high } = range;
  if (!Number.isInteger(low) || !Number.isInteger(high)) return 'Use whole numbers.';
  if (low < RANGE_MIN || high > RANGE_MAX) return `Keep the range between ${RANGE_MIN} and ${RANGE_MAX}.`;
  if (low >= high) return 'The low number must be smaller than the high number.';
  return null;
}
