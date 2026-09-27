/**
 * Glucose City backdrop: night-sky tissue, distant skyline, and the
 * bloodstream highway with scrolling flow and drifting blood cells (parallax).
 */
import { Container, Graphics, Sprite, TilingSprite, type Renderer } from 'pixi.js';
import { LANE } from '../missions/districts';
import { GAME_H, GAME_W } from '../missions/types';
import type { GameTextures } from './textures';

interface Drifter {
  s: Sprite;
  speed: number;
  sway: number;
}

export class Backdrop {
  readonly root = new Container();
  private flow: TilingSprite;
  private drifters: Drifter[] = [];
  private glints: Drifter[] = [];

  constructor(renderer: Renderer, tex: GameTextures) {
    const sky = new Graphics();
    // extend beyond the world so letterboxing never shows edges
    sky.rect(-400, -400, GAME_W + 800, GAME_H + 800).fill(0x241033);
    for (let i = 0; i < 60; i++) {
      const x = (i * 83) % GAME_W;
      const y = (i * 131) % GAME_H;
      if (x > LANE.left - 6 && x < LANE.right + 6) continue;
      sky.circle(x, y, 1 + (i % 3)).fill({ color: 0x7a4a9a, alpha: 0.5 });
    }
    // distant skyline silhouettes on both sides
    const skyline = new Graphics();
    for (let y = 40; y < GAME_H; y += 70) {
      for (const side of [0, 1]) {
        const x = side ? LANE.right + 10 : 8;
        const w = LANE.left - 18;
        const h = 18 + ((y * 7 + side * 13) % 26);
        skyline.rect(x, y - h, w * 0.45, h).fill({ color: 0x3a1a52, alpha: 0.8 });
        skyline.rect(x + w * 0.5, y - h * 0.7, w * 0.4, h * 0.7).fill({ color: 0x3a1a52, alpha: 0.8 });
      }
    }

    // highway: walls + blood
    const road = new Graphics()
      .rect(LANE.left - 10, -400, LANE.right - LANE.left + 20, GAME_H + 800)
      .fill(0x7a1a36)
      .rect(LANE.left, -400, LANE.right - LANE.left, GAME_H + 800)
      .fill(0xa8224a)
      .rect(LANE.left + 30, -400, LANE.right - LANE.left - 60, GAME_H + 800)
      .fill({ color: 0xc0325a, alpha: 0.45 });

    // scrolling flow streaks
    const streakG = new Graphics();
    for (let i = 0; i < 6; i++) {
      streakG.roundRect(10 + i * 34, (i * 53) % 160, 3, 34, 2).fill({ color: 0xffffff, alpha: 0.09 });
      streakG.poly([20 + i * 34, 120 + ((i * 29) % 40), 26 + i * 34, 130 + ((i * 29) % 40), 14 + i * 34, 130 + ((i * 29) % 40)]).fill({ color: 0xffffff, alpha: 0.08 });
    }
    streakG.rect(0, 0, 204, 200).fill({ color: 0xffffff, alpha: 0.001 });
    const streakTex = renderer.generateTexture({ target: streakG, resolution: 2 });
    streakG.destroy();
    this.flow = new TilingSprite({ texture: streakTex, width: LANE.right - LANE.left, height: GAME_H + 800 });
    this.flow.position.set(LANE.left, -400);

    this.root.addChild(sky, skyline, road, this.flow);

    // drifting red blood cells (two depths)
    for (let i = 0; i < 14; i++) {
      const s = new Sprite(tex.rbc);
      s.anchor.set(0.5);
      const near = i % 2 === 0;
      s.alpha = near ? 0.55 : 0.3;
      s.scale.set(near ? 1 : 0.7);
      s.position.set(LANE.left + 14 + ((i * 47) % (LANE.right - LANE.left - 28)), (i * 97) % GAME_H);
      this.root.addChild(s);
      this.drifters.push({ s, speed: near ? 70 : 40, sway: i });
    }
    // faint glucose glints drifting in the stream
    for (let i = 0; i < 10; i++) {
      const s = new Sprite(tex.glucose);
      s.anchor.set(0.5);
      s.alpha = 0.35;
      s.scale.set(0.55);
      s.position.set(LANE.left + 20 + ((i * 61) % (LANE.right - LANE.left - 40)), (i * 71) % GAME_H);
      this.root.addChild(s);
      this.glints.push({ s, speed: 55, sway: i * 2 });
    }
  }

  update(dt: number, t: number, speed: number, calm: boolean) {
    const k = calm ? 0.3 : 1;
    this.flow.tilePosition.y += speed * dt * k;
    for (const d of [...this.drifters, ...this.glints]) {
      d.s.y += d.speed * (speed / 100) * dt * k;
      d.s.rotation = Math.sin(t + d.sway) * 0.5;
      if (d.s.y > GAME_H + 20) d.s.y = -20;
    }
  }
}
