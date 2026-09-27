import { describe, expect, it } from 'vitest';
import { heroSvg, safeColor } from './art';

describe('art', () => {
  it('only lets plain hex colors into SVG markup', () => {
    expect(safeColor('#AbC123', '#000000')).toBe('#AbC123');
    expect(safeColor('red"/><script>', '#000000')).toBe('#000000');
    expect(heroSvg('"/><x', '#ff0000')).not.toContain('<x');
  });

  it('applies the chosen hero colors', () => {
    const svg = heroSvg('#112233', '#445566');
    expect(svg).toContain('fill="#112233"');
    expect(svg).toContain('fill="#445566"');
  });
});
