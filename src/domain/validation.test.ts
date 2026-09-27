import { describe, expect, it } from 'vitest';
import { validateRange, validateReading, type ReadingDraft } from './validation';

const NOW = Date.UTC(2026, 8, 27, 12, 0);
const draft = (over: Partial<ReadingDraft> = {}): ReadingDraft => ({
  mgdl: '120',
  timestamp: NOW,
  notes: '',
  insulinGiven: false,
  insulinUnits: '',
  carbsEaten: false,
  carbsGrams: '',
  ...over,
});

describe('validateReading', () => {
  it('accepts a normal reading', () => {
    expect(validateReading(draft(), NOW)).toEqual({});
  });

  it.each(['', 'abc', '12.5', '19', '601'])('rejects mg/dL "%s"', (mgdl) => {
    expect(validateReading(draft({ mgdl }), NOW).mgdl).toBeDefined();
  });

  it.each(['20', '600'])('accepts meter limits "%s"', (mgdl) => {
    expect(validateReading(draft({ mgdl }), NOW).mgdl).toBeUndefined();
  });

  it('rejects times in the future beyond small clock drift', () => {
    expect(validateReading(draft({ timestamp: NOW + 60_000 }), NOW).timestamp).toBeUndefined();
    expect(validateReading(draft({ timestamp: NOW + 60 * 60_000 }), NOW).timestamp).toBeDefined();
  });

  it('allows insulin/carbs logged without an amount', () => {
    expect(validateReading(draft({ insulinGiven: true, carbsEaten: true }), NOW)).toEqual({});
  });

  it('rejects negative or non-numeric amounts', () => {
    const e = validateReading(draft({ insulinGiven: true, insulinUnits: '-1', carbsEaten: true, carbsGrams: 'x' }), NOW);
    expect(e.insulinUnits).toBeDefined();
    expect(e.carbsGrams).toBeDefined();
  });

  it('ignores amount fields when the box is unchecked', () => {
    expect(validateReading(draft({ insulinUnits: 'x' }), NOW)).toEqual({});
  });

  it('limits note length', () => {
    expect(validateReading(draft({ notes: 'a'.repeat(501) }), NOW).notes).toBeDefined();
  });
});

describe('validateRange', () => {
  it('accepts the default', () => expect(validateRange({ low: 70, high: 180 })).toBeNull());
  it('rejects low >= high', () => expect(validateRange({ low: 180, high: 180 })).not.toBeNull());
  it('rejects out-of-bounds', () => expect(validateRange({ low: 30, high: 180 })).not.toBeNull());
  it('rejects decimals', () => expect(validateRange({ low: 70.5, high: 180 })).not.toBeNull());
});
