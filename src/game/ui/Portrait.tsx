import type { HeroSettings } from '../../domain/types';
import { heroSvg, safeColor, svgDataUrl } from '../../scene/art';
import type { Mood, Speaker } from '../story/content';

const INK = '#1b1f3b';

function Mouth({ mood, y = 40 }: { mood: Mood; y?: number }) {
  if (mood === 'excited') return <path d={`M24 ${y} Q32 ${y + 12} 40 ${y} Z`} fill={INK} />;
  if (mood === 'thinking') return <path d={`M26 ${y + 3} L38 ${y + 1}`} stroke={INK} strokeWidth="2.6" strokeLinecap="round" />;
  if (mood === 'wink') return <path d={`M25 ${y} Q32 ${y + 7} 39 ${y}`} fill="none" stroke={INK} strokeWidth="2.6" strokeLinecap="round" />;
  return <path d={`M24 ${y} Q32 ${y + 8} 40 ${y}`} fill="none" stroke={INK} strokeWidth="2.6" strokeLinecap="round" />;
}

function Eyes({ mood, y = 28 }: { mood: Mood; y?: number }) {
  return (
    <>
      <circle cx="25" cy={y} r="4.5" fill="#fff" />
      {mood === 'wink' ? (
        <path d={`M34 ${y} Q39 ${y - 4} 44 ${y}`} fill="none" stroke={INK} strokeWidth="2.4" strokeLinecap="round" />
      ) : (
        <circle cx="39" cy={y} r="4.5" fill="#fff" />
      )}
      <circle cx={mood === 'thinking' ? 27 : 26} cy={mood === 'thinking' ? y - 1.5 : y + 0.5} r="2.3" fill={INK} />
      {mood !== 'wink' && <circle cx={mood === 'thinking' ? 41 : 40} cy={mood === 'thinking' ? y - 1.5 : y + 0.5} r="2.3" fill={INK} />}
    </>
  );
}

/** Commander Nova: a veteran insulin hero with a gold cape and visor. */
function Nova({ mood }: { mood: Mood }) {
  return (
    <svg viewBox="0 0 64 64" aria-hidden="true">
      <path d="M16 24 Q32 16 48 24 L58 62 Q32 54 6 62 Z" fill="#ffc83d" />
      <ellipse cx="32" cy="35" rx="18" ry="20" fill="#7d6cff" />
      <path d="M14 22 Q32 14 50 22 L50 32 Q32 26 14 32 Z" fill="#2b2f5c" />
      <Eyes mood={mood} y={27} />
      <path d="M20 12 L24 18 L32 8 L40 18 L44 12 L42 22 L22 22 Z" fill="#ffc83d" />
      <Mouth mood={mood} y={41} />
      <circle cx="32" cy="50" r="4.5" fill="#ffc83d" />
      <path d="M32 46.5 L33.2 49 L36 49.3 L34 51 L34.6 53.8 L32 52.4 L29.4 53.8 L30 51 L28 49.3 L30.8 49 Z" fill={INK} />
    </svg>
  );
}

/** Gloo: a friendly glucose (hexagon). */
function Gloo({ mood }: { mood: Mood }) {
  return (
    <svg viewBox="0 0 64 64" aria-hidden="true">
      <path d="M32 4 L56 18 L56 46 L32 60 L8 46 L8 18 Z" fill="#fff3b0" stroke="#ffc93c" strokeWidth="5" strokeLinejoin="round" />
      <Eyes mood={mood} y={28} />
      <Mouth mood={mood} y={39} />
      <circle cx="18" cy="36" r="3.5" fill="#ffb3a0" />
      <circle cx="46" cy="36" r="3.5" fill="#ffb3a0" />
    </svg>
  );
}

export function Portrait({ speaker, mood = 'happy', hero }: { speaker: Speaker; mood?: Mood; hero: HeroSettings }) {
  if (speaker === 'nova') return <Nova mood={mood} />;
  if (speaker === 'gloo') return <Gloo mood={mood} />;
  return (
    <img
      src={svgDataUrl(heroSvg(safeColor(hero.bodyColor, '#3aa0ff'), safeColor(hero.capeColor, '#ff6b3d')))}
      alt=""
    />
  );
}
