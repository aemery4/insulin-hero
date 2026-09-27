import type { HeroSettings } from '../../domain/types';
import { glucoseSvg, heroSvg, lockSvg, svgDataUrl } from '../../scene/art';

/** "Who's who" key under the scene, so every picture has words too. */
export function SceneLegend({ hero }: { hero: HeroSettings }) {
  const items = [
    { src: svgDataUrl(glucoseSvg()), label: 'Glucose (sugar for energy)' },
    { src: svgDataUrl(heroSvg(hero.bodyColor, hero.capeColor)), label: `${hero.name || 'Insulin Hero'} (insulin)` },
    { src: svgDataUrl(lockSvg()), label: 'Cell lock (needs an insulin key)' },
  ];
  return (
    <details className="legend">
      <summary>Who&apos;s who?</summary>
      <ul>
        {items.map((i) => (
          <li key={i.label}>
            <img src={i.src} width={32} height={32} alt="" />
            {i.label}
          </li>
        ))}
        <li>
          <span className="legend-note">
            Brain cells can take in glucose without a key, so they have no lock.
          </span>
        </li>
      </ul>
    </details>
  );
}
