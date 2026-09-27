import type { HeroSettings } from '../../domain/types';

// Placeholder preview; replaced by the real hero artwork in M5.
export function HeroPreview({ hero }: { hero: HeroSettings }) {
  return (
    <div className="hero-preview" aria-hidden="true">
      <svg viewBox="0 0 100 100" width="96" height="96">
        <path d="M30 45 L15 90 L85 90 L70 45 Z" fill={hero.capeColor} />
        <circle cx="50" cy="50" r="28" fill={hero.bodyColor} />
      </svg>
      <span>{hero.name || 'Insulin Hero'}</span>
    </div>
  );
}
