import { describe, expect, it } from 'vitest';
import {
  actionExplanation,
  DISCLAIMER,
  eventExplanation,
  HIGH_WITH_INSULIN,
  ZONE_EXPLANATION,
  ZONE_SHORT,
} from './explanations';

describe('DISCLAIMER', () => {
  it('uses the configured name', () => {
    expect(DISCLAIMER('Wyatt')).toBe("For learning only. Follow Wyatt's care team plan for all treatment decisions.");
  });
  it('handles names ending in s and blank names', () => {
    expect(DISCLAIMER('James')).toContain("James' care team");
    expect(DISCLAIMER('  ')).toContain('your care team');
  });
});

describe('explanation copy', () => {
  // Explanations describe the body; they must never instruct treatment.
  const ADVICE = /\b(take|give|inject|eat|drink|dose|units?|grams?|should|need to)\b/i;

  it('zone explanations contain no treatment instructions', () => {
    for (const text of Object.values(ZONE_EXPLANATION)) expect(text).not.toMatch(ADVICE);
  });

  it('event explanations contain no treatment instructions', () => {
    for (const e of ['insulinHeroes', 'fastSugarHelper', 'foodGlucose'] as const) {
      expect(eventExplanation(e, 'Hero')).not.toMatch(ADVICE);
    }
  });

  it('simulator lines are short (fit one line on a phone)', () => {
    const lines = [
      ...Object.values(ZONE_SHORT),
      HIGH_WITH_INSULIN,
      actionExplanation({ type: 'insulin', size: 'big' }),
      actionExplanation({ type: 'food', kind: 'fastSugar' }),
      actionExplanation({ type: 'food', kind: 'meal' }),
      actionExplanation({ type: 'food', kind: 'snack' }),
    ];
    for (const l of lines) expect(l.length, l).toBeLessThanOrEqual(62);
    for (const l of lines) expect(l).not.toMatch(/\b(units?|grams?|carbs?|should|need to|take|give|dose)\b/i);
  });

  it('simulator copy never shows amounts or instructions', () => {
    const actions = [
      { type: 'insulin', size: 'small' },
      { type: 'insulin', size: 'big' },
      { type: 'food', kind: 'snack' },
      { type: 'food', kind: 'meal' },
      { type: 'food', kind: 'fastSugar' },
    ] as const;
    for (const a of actions) {
      const text = actionExplanation(a);
      expect(text).not.toMatch(/\b(units?|grams?|carbs?|should|need to|take|give|dose)\b/i);
    }
  });

  it('uses the hero name', () => {
    expect(eventExplanation('insulinHeroes', 'Captain Key')).toMatch(/^Captain Key/);
  });
});
