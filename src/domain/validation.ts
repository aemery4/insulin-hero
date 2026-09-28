/**
 * Settings validation. These are data-entry sanity checks, not medical guidance.
 */
import type { TargetRange } from './types';

export const RANGE_MIN = 40;
export const RANGE_MAX = 400;

export function validateRange(range: TargetRange): string | null {
  const { low, high } = range;
  if (!Number.isInteger(low) || !Number.isInteger(high)) return 'Use whole numbers.';
  if (low < RANGE_MIN || high > RANGE_MAX) return `Keep the range between ${RANGE_MIN} and ${RANGE_MAX}.`;
  if (low >= high) return 'The low number must be smaller than the high number.';
  return null;
}
