/**
 * Generates app icons from the hero artwork (default colors).
 * Run: node tools/make-icons.ts   (outputs into public/)
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import sharp from 'sharp';
import { heroSvg } from '../src/scene/art.ts';

const BG = '#141833';
const hero = heroSvg('#3aa0ff', '#ff6b3d')
  .replace(/<svg[^>]*>/, '')
  .replace('</svg>', '');

/** Hero on a glowing circle; `scale` is how much of the canvas the art fills. */
function iconSvg(size: number, scale: number, rounded: boolean): string {
  const art = size * scale;
  const off = (size - art) / 2;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
<defs><radialGradient id="g"><stop offset="0" stop-color="#b3264d"/><stop offset="1" stop-color="#3a1024"/></radialGradient></defs>
<rect width="${size}" height="${size}" rx="${rounded ? size * 0.22 : 0}" fill="${BG}"/>
<circle cx="${size / 2}" cy="${size / 2}" r="${art * 0.5}" fill="url(#g)"/>
<svg x="${off}" y="${off}" width="${art}" height="${art}" viewBox="0 0 64 64">${hero}</svg>
</svg>`;
}

mkdirSync('public', { recursive: true });
writeFileSync('public/favicon.svg', iconSvg(64, 0.95, true));

const pngs: [string, number, number, boolean][] = [
  ['pwa-192.png', 192, 0.86, true],
  ['pwa-512.png', 512, 0.86, true],
  ['maskable-512.png', 512, 0.62, false], // art inside the maskable safe zone
  ['apple-touch-icon.png', 180, 0.8, false],
];
for (const [file, size, scale, rounded] of pngs) {
  await sharp(Buffer.from(iconSvg(size, scale, rounded))).png().toFile(`public/${file}`);
  console.log('wrote public/' + file);
}
