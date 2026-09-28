import { describe, expect, it } from 'vitest';
import { validateRange } from './validation';

describe('validateRange', () => {
  it('accepts the default', () => expect(validateRange({ low: 70, high: 180 })).toBeNull());
  it('rejects low >= high', () => expect(validateRange({ low: 180, high: 180 })).not.toBeNull());
  it('rejects out-of-bounds', () => expect(validateRange({ low: 30, high: 180 })).not.toBeNull());
  it('rejects decimals', () => expect(validateRange({ low: 70.5, high: 180 })).not.toBeNull());
});
