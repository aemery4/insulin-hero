import { describe, expect, it } from 'vitest';
import { DISCLAIMER, eventExplanation, ZONE_EXPLANATION } from './explanations';

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

  it('uses the hero name', () => {
    expect(eventExplanation('insulinHeroes', 'Captain Key')).toMatch(/^Captain Key/);
  });
});
