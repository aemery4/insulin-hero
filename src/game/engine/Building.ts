/**
 * A Glucose City building beside the bloodstream highway. Windows light up
 * with energy; a door with a lock faces the highway; a thought bubble shows
 * when it's hungry; "Zzz" when it's run out of energy.
 */
import { Container, Graphics, Sprite, Text } from 'pixi.js';
import { DISTRICTS, LANE, type DistrictKind, type DistrictSlot } from '../missions/districts';
import type { GameTextures } from './textures';

const INK = 0x1b1f3b;

const STYLE: Record<DistrictKind, { wall: number; roof: number; trim: number }> = {
  muscle: { wall: 0xff8a66, roof: 0xd9533a, trim: 0xffd2c2 },
  heart: { wall: 0xff6f8e, roof: 0xd13a5c, trim: 0xffd0db },
  fat: { wall: 0xffd57a, roof: 0xe0a93a, trim: 0xfff1cc },
  brain: { wall: 0xffa8d2, roof: 0xe0609e, trim: 0xffe0ef },
};

export interface BuildingState {
  energy: number;
  locked: boolean;
  open: boolean;
  hungry: boolean;
  asleep: boolean;
  /** 0..1 flash when fed. */
  fed: number;
}

export class Building {
  readonly root = new Container();
  readonly doorX: number;
  private glow: Sprite;
  private windows = new Graphics();
  private door = new Graphics();
  private lock = new Container();
  private shackle = new Graphics();
  private bubble = new Container();
  private zzz: Text;
  private meterFill = new Graphics();
  private flash = new Graphics();
  private windowSlots: { x: number; y: number; w: number; h: number }[] = [];
  private t = Math.random() * 10;
  private openAmt = 0;

  constructor(
    readonly slot: DistrictSlot,
    tex: GameTextures,
  ) {
    const left = slot.side === 'left';
    const cx = left ? 40 : 320;
    const dir = left ? 1 : -1;
    this.doorX = left ? LANE.left : LANE.right;
    this.root.position.set(0, slot.y);
    const s = STYLE[slot.kind];

    this.glow = new Sprite(tex.glow);
    this.glow.anchor.set(0.5);
    this.glow.position.set(cx, 0);
    this.glow.scale.set(1.6);
    this.glow.tint = 0xfff1a8;
    this.glow.blendMode = 'add';

    const g = new Graphics();
    this.drawShape(g, slot.kind, cx, s);

    // door facing the highway
    const dx = this.doorX - dir * 9;
    this.door.position.set(dx, 14);

    // lock
    this.shackle.moveTo(-5, 0).lineTo(-5, -4).arc(0, -4, 5, Math.PI, 0).lineTo(5, 0).stroke({ width: 2.6, color: 0xe8e8f0 });
    const lockBody = new Graphics().roundRect(-8, -1, 16, 12, 3).fill(0xe8e8f0).circle(0, 4, 1.8).fill(INK).rect(-0.8, 4, 1.6, 4).fill(INK);
    this.lock.addChild(this.shackle, lockBody);
    this.lock.position.set(this.doorX + dir * 2, -14);
    this.lock.visible = DISTRICTS[slot.kind].hasLock;

    // hungry thought bubble: "(glucose) !"
    const b = new Graphics()
      .circle(0, 0, 17)
      .fill(0xffffff)
      .circle(-dir * 12, 16, 4)
      .fill(0xffffff)
      .circle(-dir * 17, 23, 2.5)
      .fill(0xffffff);
    const gl = new Sprite(tex.glucose);
    gl.anchor.set(0.5);
    gl.scale.set(0.8);
    gl.position.set(-3, 0);
    const bang = new Text({ text: '!', style: { fontFamily: 'system-ui', fontSize: 18, fontWeight: '900', fill: 0xff4d6d } });
    bang.anchor.set(0.5);
    bang.position.set(10, 0);
    this.bubble.addChild(b, gl, bang);
    this.bubble.position.set(cx + dir * 22, -72);
    this.bubble.visible = false;

    this.zzz = new Text({
      text: 'Zzz',
      style: { fontFamily: 'system-ui', fontSize: 16, fontWeight: '900', fill: 0xc9d1ff, stroke: { color: INK, width: 3 } },
    });
    this.zzz.anchor.set(0.5);
    this.zzz.position.set(cx, -66);
    this.zzz.visible = false;

    const label = new Text({
      text: DISTRICTS[slot.kind].name,
      style: { fontFamily: 'system-ui', fontSize: 11, fontWeight: '800', fill: 0xffffff, stroke: { color: INK, width: 3 }, align: 'center', wordWrap: true, wordWrapWidth: 70 },
    });
    label.anchor.set(0.5, 0);
    label.position.set(cx, 46);

    // energy meter under the building
    const meterBg = new Graphics().roundRect(cx - 28, 76, 56, 7, 4).fill({ color: 0x000000, alpha: 0.45 });
    this.meterFill.position.set(cx - 27, 77);

    this.flash.circle(cx, 0, 46).fill(0xffffff);
    this.flash.alpha = 0;
    this.flash.blendMode = 'add';

    this.root.addChild(this.glow, g, this.windows, this.door, this.flash, this.lock, meterBg, this.meterFill, label, this.bubble, this.zzz);
    if (!DISTRICTS[slot.kind].hasLock) this.root.addChild(this.noKeyTag(cx));
  }

  private noKeyTag(cx: number) {
    const tag = new Container();
    const txt = new Text({ text: 'No key needed', style: { fontFamily: 'system-ui', fontSize: 9, fontWeight: '800', fill: INK } });
    txt.anchor.set(0.5);
    const w = txt.width + 10;
    tag.addChild(new Graphics().roundRect(-w / 2, -7, w, 14, 7).fill(0xfff1a8), txt);
    tag.position.set(cx, -62);
    return tag;
  }

  private drawShape(g: Graphics, kind: DistrictKind, cx: number, s: { wall: number; roof: number; trim: number }) {
    const w = 64;
    const x0 = cx - w / 2;
    const shadow = { color: 0x000000, alpha: 0.25 };
    g.roundRect(x0 + 4, -40, w, 84, 8).fill(shadow);
    switch (kind) {
      case 'muscle': // stadium: dome + banners
        g.roundRect(x0, -30, w, 74, 8).fill(s.wall);
        g.ellipse(cx, -30, w / 2, 16).fill(s.roof);
        g.ellipse(cx, -32, w / 2 - 8, 9).fill(0x3aa870); // the pitch
        g.rect(cx - 1, -40, 2, 16).fill(0xffffff);
        for (let i = 0; i < 4; i++) g.rect(x0 + 6 + i * 15, -18, 7, 6).fill(i % 2 ? s.trim : 0xffffff);
        break;
      case 'heart': // station with a heart sign
        g.roundRect(x0, -34, w, 78, 6).fill(s.wall);
        g.poly([x0 - 4, -34, cx, -54, x0 + w + 4, -34]).fill(s.roof);
        g.circle(cx - 5, -42, 5).fill(0xffffff).circle(cx + 5, -42, 5).fill(0xffffff).poly([cx - 10, -40, cx + 10, -40, cx, -30]).fill(0xffffff);
        g.circle(cx - 5, -42, 3.2).fill(0xff3d6b).circle(cx + 5, -42, 3.2).fill(0xff3d6b).poly([cx - 8, -41, cx + 8, -41, cx, -33]).fill(0xff3d6b);
        break;
      case 'fat': // storage silos
        g.roundRect(x0, -24, w, 68, 8).fill(s.wall);
        g.roundRect(x0 + 4, -46, 24, 30, 12).fill(s.roof);
        g.roundRect(x0 + 34, -40, 24, 24, 12).fill(s.roof);
        g.rect(x0, -8, w, 4).fill(s.trim);
        break;
      case 'brain': // tall tower with a cloudy, wrinkly top
        g.roundRect(cx - 24, -30, 48, 74, 6).fill(s.wall);
        for (const [dx, dy, r] of [[-14, -40, 13], [0, -48, 15], [14, -40, 13], [-6, -32, 12], [8, -32, 12]] as const) g.circle(cx + dx, dy, r).fill(s.roof);
        g.moveTo(cx - 16, -44).quadraticCurveTo(cx - 6, -50, cx, -42).quadraticCurveTo(cx + 6, -50, cx + 16, -44).stroke({ width: 2, color: s.trim });
        break;
    }
    // window grid
    const cols = kind === 'brain' ? 2 : 3;
    const gx0 = kind === 'brain' ? cx - 16 : x0 + 8;
    const gap = kind === 'brain' ? 20 : 17;
    for (let r = 0; r < 3; r++) for (let c = 0; c < cols; c++) this.windowSlots.push({ x: gx0 + c * gap, y: -8 + r * 15, w: 11, h: 9 });
  }

  update(dt: number, st: BuildingState, calm: boolean) {
    this.t += dt;
    const e = Math.max(0, Math.min(1, st.energy));

    // windows: lit count follows energy, with a little flicker
    this.windows.clear();
    const lit = Math.round(e * this.windowSlots.length);
    this.windowSlots.forEach((w, i) => {
      const on = i < lit;
      const flick = on && !calm ? 0.85 + 0.15 * Math.sin(this.t * 3 + i * 1.7) : 1;
      this.windows.roundRect(w.x, w.y, w.w, w.h, 2).fill({ color: on ? 0xfff3b0 : 0x2b1030, alpha: on ? flick : 0.85 });
    });

    this.glow.alpha = Math.max(0, e - 0.3) * 0.5 + st.fed * 0.4;
    this.flash.alpha = st.fed * 0.35;

    // door + lock
    this.openAmt += ((st.open ? 1 : 0) - this.openAmt) * Math.min(1, dt * 10);
    this.door.clear().roundRect(-8, -18, 16, 18, 4).fill(0x2b1030);
    this.door.roundRect(-8, -18, 16 * (1 - this.openAmt * 0.85), 18, 4).fill(0x8a5a3a);
    if (this.openAmt > 0.3) this.door.roundRect(-8, -18, 16, 18, 4).fill({ color: 0xfff3b0, alpha: this.openAmt * 0.6 });
    const unlocked = !st.locked || st.open;
    this.shackle.position.set(0, unlocked ? -5 : 0);
    this.shackle.rotation = unlocked ? -0.5 : 0;
    this.lock.alpha = unlocked ? 0.55 : 1;
    this.lock.scale.set(st.hungry && !unlocked && !calm ? 1 + Math.sin(this.t * 8) * 0.08 : 1);

    // hungry / asleep indicators
    this.bubble.visible = st.hungry && !st.asleep;
    if (this.bubble.visible && !calm) this.bubble.y = -72 + Math.sin(this.t * 4) * 3;
    this.zzz.visible = st.asleep;
    if (st.asleep && !calm) {
      this.zzz.y = -66 - ((this.t * 12) % 10);
      this.zzz.alpha = 0.6 + 0.4 * Math.sin(this.t * 3);
    }

    const color = e < 0.3 ? 0xff7a93 : e < 0.7 ? 0xffb547 : 0x43d9a3;
    this.meterFill.clear().roundRect(0, 0, Math.max(2, 54 * e), 5, 3).fill(color);
  }

  /** Point on the highway at this building's door. */
  get doorPoint() {
    return { x: this.doorX, y: this.slot.y };
  }
}
