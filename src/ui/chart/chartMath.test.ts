import { describe, expect, it } from 'vitest';
import { scaleLinear } from './chartMath';

describe('scaleLinear', () => {
  it('maps domain to range (including inverted y)', () => {
    const s = scaleLinear([0, 100], [200, 0]);
    expect([s(0), s(50), s(100)]).toEqual([200, 100, 0]);
  });

  it('handles a zero-width domain', () => {
    expect(scaleLinear([5, 5], [0, 10])(5)).toBe(5);
  });
});
