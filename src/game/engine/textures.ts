/** Procedurally generated textures shared by game renderers (no image files). */
import { Graphics, type Renderer, type Texture } from 'pixi.js';
import { glucoseSvg, heroSvg } from '../../scene/art';

export interface GameTextures {
  glow: Texture;
  spark: Texture;
  dot: Texture;
  key: Texture;
  glucose: Texture;
  gloo: Texture;
  rbc: Texture;
  jam: Texture;
  miniHero: Texture;
  destroy(): void;
}

const INK = 0x1b1f3b;
const GOLD = 0xffd23f;

function bake(renderer: Renderer, g: Graphics, resolution = 2): Texture {
  const t = renderer.generateTexture({ target: g, resolution, antialias: true });
  g.destroy();
  return t;
}

export function createTextures(renderer: Renderer, hero: { bodyColor: string; capeColor: string }): GameTextures {
  // soft radial glow built from stacked translucent circles
  const glowG = new Graphics();
  for (let i = 12; i > 0; i--) glowG.circle(0, 0, i * 4).fill({ color: 0xffffff, alpha: 0.06 });

  const sparkG = new Graphics()
    .poly([0, -10, 2.5, -2.5, 10, 0, 2.5, 2.5, 0, 10, -2.5, 2.5, -10, 0, -2.5, -2.5])
    .fill(0xffffff);

  const dotG = new Graphics().circle(0, 0, 4).fill(0xffffff);

  const keyG = new Graphics()
    .circle(-8, 0, 7)
    .stroke({ width: 4, color: GOLD })
    .rect(-2, -2, 16, 4)
    .fill(GOLD)
    .rect(9, 2, 3, 5)
    .fill(GOLD)
    .rect(13, 2, 2.5, 4)
    .fill(GOLD)
    .circle(-8, 0, 2)
    .fill({ color: 0xffffff, alpha: 0.6 });

  const glooG = new Graphics().svg(glucoseSvg());
  // Gloo-style glucose with a face, for Door Rush
  const face = new Graphics()
    .svg(glucoseSvg())
    .circle(9, 11, 1.6)
    .fill(INK)
    .circle(15, 11, 1.6)
    .fill(INK)
    .moveTo(9.5, 14.5)
    .quadraticCurveTo(12, 17, 14.5, 14.5)
    .stroke({ width: 1.3, color: INK });

  const rbcG = new Graphics()
    .ellipse(0, 0, 13, 9)
    .fill({ color: 0xe0405f })
    .ellipse(0, 0, 6, 4)
    .fill({ color: 0x9c1d3c, alpha: 0.6 });

  // "traffic jam": a squashed pile of red blood cells with a caution cone
  const jamG = new Graphics();
  for (const [x, y, r] of [
    [-12, 4, 0.4],
    [10, 6, -0.3],
    [0, -6, 0.1],
    [-4, 12, 0.8],
    [14, -6, -0.6],
  ] as const) {
    jamG.ellipse(x, y, 13, 9).fill(0xd8354f).stroke({ width: 1.5, color: 0x8a1530 });
    jamG.ellipse(x + Math.cos(r) * 2, y, 5, 3.5).fill({ color: 0x8a1530, alpha: 0.6 });
  }
  jamG.poly([0, -26, 7, -10, -7, -10]).fill(0xff8a3d).rect(-3, -21, 6, 3).fill(0xffffff);

  const t: GameTextures = {
    glow: bake(renderer, glowG),
    spark: bake(renderer, sparkG),
    dot: bake(renderer, dotG),
    key: bake(renderer, keyG, 3),
    glucose: bake(renderer, glooG, 3),
    gloo: bake(renderer, face, 3),
    rbc: bake(renderer, rbcG),
    jam: bake(renderer, jamG, 2),
    miniHero: bake(renderer, new Graphics().svg(heroSvg(hero.bodyColor, hero.capeColor)), 2),
    destroy() {
      for (const v of Object.values(t)) if (typeof v !== 'function') (v as Texture).destroy(true);
    },
  };
  return t;
}
