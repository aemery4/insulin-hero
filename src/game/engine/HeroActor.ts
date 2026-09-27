/**
 * The player's insulin hero, built from parts so it can animate: flapping
 * cape, blinking eyes that look where it flies, squash-and-stretch, orbiting
 * keys, and a dizzy spin when bumped. Colors come from Settings.
 */
import { Container, Graphics, Sprite } from 'pixi.js';
import { safeColor } from '../../scene/art';
import type { GameTextures } from './textures';

const INK = 0x1b1f3b;
const GOLD = 0xffd23f;
const hex = (c: string, fallback: string) => parseInt(safeColor(c, fallback).slice(1), 16);

export class HeroActor {
  readonly root = new Container();
  private aura: Sprite;
  private cape = new Graphics();
  private rig = new Container();
  private body = new Graphics();
  private eyes = new Container();
  private pupils = new Graphics();
  private mouth = new Graphics();
  private keyRing = new Container();
  private keySprites: Sprite[] = [];
  private dizzy = new Container();
  private bodyColor: number;
  private capeColor: number;
  private blink = 2;
  private t = 0;
  private prevStun = 0;

  constructor(
    private tex: GameTextures,
    colors: { bodyColor: string; capeColor: string },
  ) {
    this.bodyColor = hex(colors.bodyColor, '#3aa0ff');
    this.capeColor = hex(colors.capeColor, '#ff6b3d');

    this.aura = new Sprite(tex.glow);
    this.aura.anchor.set(0.5);
    this.aura.tint = this.bodyColor;
    this.aura.alpha = 0.35;
    this.aura.blendMode = 'add';
    this.aura.scale.set(0.9);

    this.drawBody();
    const whites = new Graphics().circle(-6, -5, 5).fill(0xffffff).circle(6, -5, 5).fill(0xffffff);
    this.eyes.addChild(whites, this.pupils);
    this.drawMouth(false);

    for (let i = 0; i < 3; i++) {
      const k = new Sprite(tex.key);
      k.anchor.set(0.5);
      k.scale.set(0.5);
      k.visible = false;
      this.keySprites.push(k);
      this.keyRing.addChild(k);
    }

    for (let i = 0; i < 3; i++) {
      const s = new Sprite(tex.spark);
      s.anchor.set(0.5);
      s.tint = 0xfff1a8;
      s.scale.set(0.45);
      this.dizzy.addChild(s);
    }
    this.dizzy.visible = false;

    this.rig.addChild(this.body, this.eyes, this.mouth);
    this.root.addChild(this.aura, this.cape, this.rig, this.keyRing, this.dizzy);
  }

  private drawBody() {
    this.body
      .clear()
      .ellipse(0, 0, 17, 19)
      .fill(this.bodyColor)
      .ellipse(-6, -10, 6, 4)
      .fill({ color: 0xffffff, alpha: 0.3 })
      // mask band
      .moveTo(-17, -9)
      .quadraticCurveTo(0, -15, 17, -9)
      .lineTo(17, -1)
      .quadraticCurveTo(0, -6, -17, -1)
      .closePath()
      .fill(this.capeColor)
      // keyhole emblem
      .circle(0, 11, 4.5)
      .fill(GOLD)
      .circle(0, 10, 1.4)
      .fill(INK)
      .poly([-1, 11, 1, 11, 1.6, 14, -1.6, 14])
      .fill(INK);
  }

  private drawMouth(dizzy: boolean) {
    this.mouth.clear();
    if (dizzy) this.mouth.ellipse(0, 4, 3, 3.5).fill(INK);
    else this.mouth.moveTo(-6, 2).quadraticCurveTo(0, 8, 6, 2).stroke({ width: 2.4, color: INK, cap: 'round' });
  }

  /**
   * @param vx,vy current velocity (world units/s)
   * @param keys how many keys are being carried
   * @param stun seconds of bump-dizziness left
   */
  update(dt: number, x: number, y: number, vx: number, vy: number, keys: number, stun: number, calm: boolean) {
    this.t += dt;
    const t = this.t;
    this.root.position.set(x, y + (calm ? 0 : Math.sin(t * 5) * 2));

    // lean + squash/stretch with speed
    const speed = Math.min(1, Math.hypot(vx, vy) / 430);
    this.rig.rotation = Math.max(-0.35, Math.min(0.35, vx / 1200));
    const stretch = calm ? 0 : speed * 0.14;
    this.rig.scale.set(1 - stretch * 0.6, 1 + stretch);

    // cape flutters behind the direction of travel
    const flap = calm ? 0 : Math.sin(t * 14) * (3 + speed * 6);
    const trailX = -vx / 60;
    const trailY = 26 - vy / 90;
    this.cape
      .clear()
      .moveTo(-13, -8)
      .quadraticCurveTo(-22 + trailX - flap, 12, -16 + trailX * 1.4, trailY)
      .lineTo(16 + trailX * 1.4, trailY + flap * 0.6)
      .quadraticCurveTo(22 + trailX + flap, 12, 13, -8)
      .closePath()
      .fill(this.capeColor);

    // eyes look where we're going; blink every few seconds
    const lx = Math.max(-2, Math.min(2, vx / 120));
    const ly = Math.max(-2, Math.min(2, vy / 120));
    this.pupils.clear().circle(-6 + lx, -5 + ly, 2.4).fill(INK).circle(6 + lx, -5 + ly, 2.4).fill(INK);
    this.blink -= dt;
    if (this.blink < 0) this.blink = 2 + Math.random() * 3;
    this.eyes.scale.y = this.blink < 0.12 ? 0.15 : 1;

    // carried keys orbit the hero
    this.keySprites.forEach((k, i) => {
      k.visible = i < keys;
      const a = t * 3 + (i * Math.PI * 2) / 3;
      k.position.set(Math.cos(a) * 28, Math.sin(a) * 12 - 4);
      k.rotation = a + Math.PI / 2;
    });

    // bumped: dizzy stars + "o" mouth
    const isDizzy = stun > 0;
    if (isDizzy !== this.prevStun > 0) this.drawMouth(isDizzy);
    this.prevStun = stun;
    this.dizzy.visible = isDizzy;
    if (isDizzy) {
      this.dizzy.children.forEach((s, i) => {
        const a = t * 8 + (i * Math.PI * 2) / 3;
        s.position.set(Math.cos(a) * 16, -26 + Math.sin(a) * 5);
      });
      this.rig.rotation += Math.sin(t * 30) * 0.2;
    }

    this.aura.alpha = 0.25 + speed * 0.25 + (keys > 0 ? 0.1 : 0);
  }

  get tint() {
    return this.bodyColor;
  }

  destroy() {
    this.root.destroy({ children: true });
    void this.tex;
  }
}
