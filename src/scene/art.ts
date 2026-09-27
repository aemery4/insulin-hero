/**
 * Original character artwork as SVG strings. One source feeds both Pixi
 * (`Graphics.svg`) and the DOM (`<img src=data:…>`), so the hero looks the same
 * in the scene, the legend, and the settings preview.
 */

const HEX = /^#[0-9a-f]{6}$/i;

/** Only allow plain #rrggbb colors into SVG markup. */
export function safeColor(value: string, fallback: string): string {
  return HEX.test(value) ? value : fallback;
}

const INK = '#1b1f3b';
const GOLD = '#ffd23f';

/** The insulin hero: a round key-keeper with a cape, mask, and a golden key. */
export function heroSvg(bodyColor: string, capeColor: string): string {
  const body = safeColor(bodyColor, '#3aa0ff');
  const cape = safeColor(capeColor, '#ff6b3d');
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="64" height="64">
<path d="M18 24 Q32 18 46 24 L56 60 Q32 53 8 60 Z" fill="${cape}"/>
<ellipse cx="31" cy="34" rx="17" ry="19" fill="${body}"/>
<ellipse cx="25" cy="24" rx="6" ry="4" fill="#ffffff" fill-opacity="0.3"/>
<path d="M14 24 Q31 18 48 24 L48 32 Q31 27 14 32 Z" fill="${cape}"/>
<circle cx="25" cy="28" r="4.5" fill="#ffffff"/>
<circle cx="37" cy="28" r="4.5" fill="#ffffff"/>
<circle cx="26" cy="29" r="2.2" fill="${INK}"/>
<circle cx="38" cy="29" r="2.2" fill="${INK}"/>
<path d="M24 38 Q31 45 38 38" fill="none" stroke="${INK}" stroke-width="2.6" stroke-linecap="round"/>
<circle cx="31" cy="47" r="4.5" fill="${GOLD}"/>
<circle cx="31" cy="46" r="1.5" fill="${INK}"/>
<path d="M30 47 L32 47 L32.6 50 L29.4 50 Z" fill="${INK}"/>
<circle cx="48" cy="40" r="3.5" fill="${body}"/>
<circle cx="55" cy="27" r="5" fill="none" stroke="${GOLD}" stroke-width="3"/>
<rect x="53.5" y="31" width="3" height="15" fill="${GOLD}"/>
<rect x="56.5" y="40" width="4" height="2.5" fill="${GOLD}"/>
<rect x="56.5" y="43.5" width="3" height="2.5" fill="${GOLD}"/>
</svg>`;
}

/** Fast-sugar helper: an original zippy juice-box character with a lightning bolt. */
export function fastSugarSvg(): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="64" height="64">
<rect x="36" y="2" width="4" height="16" rx="2" fill="#ffffff"/>
<rect x="16" y="12" width="32" height="42" rx="6" fill="#2ec4ff"/>
<rect x="16" y="12" width="32" height="8" rx="4" fill="#8be3ff"/>
<path d="M34 24 L24 38 L31 38 L28 50 L40 33 L33 33 L36 24 Z" fill="${GOLD}"/>
<circle cx="25" cy="27" r="3" fill="#ffffff"/>
<circle cx="25.5" cy="27.5" r="1.5" fill="${INK}"/>
<circle cx="41" cy="44" r="3" fill="#ffffff"/>
<circle cx="41.5" cy="44.5" r="1.5" fill="${INK}"/>
<rect x="20" y="54" width="4" height="8" rx="2" fill="${INK}"/>
<rect x="40" y="54" width="4" height="8" rx="2" fill="${INK}"/>
</svg>`;
}

/** Food helper: a friendly slice of bread (carbs become glucose). */
export function foodSvg(): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="64" height="64">
<path d="M12 26 Q10 8 32 8 Q54 8 52 26 L50 56 Q32 60 14 56 Z" fill="#c9843e"/>
<path d="M17 27 Q15 13 32 13 Q49 13 47 27 L45 52 Q32 55 19 52 Z" fill="#ffe0a6"/>
<circle cx="26" cy="30" r="3" fill="${INK}"/>
<circle cx="38" cy="30" r="3" fill="${INK}"/>
<path d="M26 39 Q32 44 38 39" fill="none" stroke="${INK}" stroke-width="2.6" stroke-linecap="round"/>
<circle cx="21" cy="36" r="2.5" fill="#ff9aa8"/>
<circle cx="43" cy="36" r="2.5" fill="#ff9aa8"/>
</svg>`;
}

/** Glucose: a ring-shaped molecule, drawn as a friendly hexagon. */
export function glucoseSvg(): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24">
<path d="M12 2 L20.7 7 L20.7 17 L12 22 L3.3 17 L3.3 7 Z" fill="#fff3b0" stroke="#ffc93c" stroke-width="2.4" stroke-linejoin="round"/>
</svg>`;
}

export function lockSvg(): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24">
<path d="M7 11 L7 8 Q7 3 12 3 Q17 3 17 8 L17 11" fill="none" stroke="#e8e8f0" stroke-width="2.6"/>
<rect x="4" y="10" width="16" height="12" rx="3" fill="#e8e8f0"/>
<circle cx="12" cy="15" r="2" fill="${INK}"/>
<rect x="11" y="15" width="2" height="4" fill="${INK}"/>
</svg>`;
}

export const svgDataUrl = (svg: string) => `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
