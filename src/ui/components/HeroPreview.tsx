import type { HeroSettings } from '../../domain/types';
import { heroSvg, svgDataUrl } from '../../scene/art';

export function HeroPreview({ hero }: { hero: HeroSettings }) {
  return (
    <div className="hero-preview">
      <img src={svgDataUrl(heroSvg(hero.bodyColor, hero.capeColor))} width={96} height={96} alt="" />
      <span>{hero.name || 'Insulin Hero'}</span>
    </div>
  );
}
