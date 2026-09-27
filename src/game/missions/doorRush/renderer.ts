import { Container, Graphics, Sprite, Text, type Renderer } from 'pixi.js';
import type { HeroSettings } from '../../../domain/types';
import { Backdrop } from '../../engine/Backdrop';
import { Building } from '../../engine/Building';
import { Fx } from '../../engine/Fx';
import { createTextures, type GameTextures } from '../../engine/textures';
import type { MissionRenderer } from '../../engine/stage';
import { LANE } from '../districts';
import { GAME_H } from '../types';
import type { GameEvent } from '../types';
import type { DoorRushModel } from './model';

const INK = 0x1b1f3b;

export class DoorRushRenderer implements MissionRenderer {
  readonly root = new Container();
  private camera = new Container();
  private tex: GameTextures;
  private backdrop: Backdrop;
  private buildings = new Map<string, Building>();
  private helpers = new Map<string, Sprite>();
  private glucose = new Map<number, Sprite>();
  private glucoseLayer = new Container();
  private trail = new Graphics();
  private trailPts: { x: number; y: number; age: number }[] = [];
  private kidneyFill = new Graphics();
  private fx: Fx;
  private shake = 0;
  private t = 0;
  private lastBonkText = -9;

  constructor(
    renderer: Renderer,
    private model: DoorRushModel,
    heroColors: HeroSettings,
  ) {
    this.tex = createTextures(renderer, heroColors);
    this.backdrop = new Backdrop(renderer, this.tex);
    this.fx = new Fx(this.tex);

    const buildingLayer = new Container();
    for (const d of model.districts) {
      const b = new Building(d, this.tex);
      this.buildings.set(d.id, b);
      buildingLayer.addChild(b.root);
      if (d.hasLock) {
        // a fellow insulin hero holds the door open
        const s = new Sprite(this.tex.miniHero);
        s.anchor.set(0.5);
        s.scale.set(0.55);
        s.position.set(b.doorX + (d.side === 'left' ? 18 : -18), d.y - 34);
        s.alpha = 0;
        buildingLayer.addChild(s);
        this.helpers.set(d.id, s);
      }
    }

    this.camera.addChild(this.backdrop.root, buildingLayer, this.drawKidneyPlant(), this.glucoseLayer, this.trail, this.fx.layer);
    this.root.addChild(this.camera);
  }

  private drawKidneyPlant() {
    const c = new Container();
    const y = LANE.bottom - 8;
    const g = new Graphics()
      .roundRect(LANE.left - 14, y, LANE.right - LANE.left + 28, GAME_H - y + 20, 10)
      .fill(0x6d3a63)
      .rect(LANE.left, y + 4, LANE.right - LANE.left, 4)
      .fill(0x9c4f7a);
    // grate
    for (let x = LANE.left + 8; x < LANE.right; x += 14) g.rect(x, y - 2, 4, 10).fill(0x9c4f7a);
    const label = new Text({
      text: 'Kidney Filter Plant',
      style: { fontFamily: 'system-ui', fontSize: 11, fontWeight: '800', fill: 0xffffff, stroke: { color: INK, width: 3 } },
    });
    label.anchor.set(0, 0.5);
    label.position.set(LANE.left - 4, y + 18);
    const meterBg = new Graphics().roundRect(LANE.right - 76, y + 13, 72, 9, 5).fill({ color: 0x000000, alpha: 0.4 });
    this.kidneyFill.position.set(LANE.right - 75, y + 14);
    c.addChild(g, label, meterBg, this.kidneyFill);
    return c;
  }

  onEvent(e: GameEvent) {
    const fx = this.fx;
    switch (e.type) {
      case 'send':
        fx.burst(e.x, e.y, 0xfff3b0, 6, 90);
        break;
      case 'deliver': {
        const b = e.target ? this.buildings.get(e.target) : undefined;
        if (b) {
          const cx = b.slot.side === 'left' ? 40 : 320;
          fx.burst(cx, b.slot.y, 0xfff1a8, 10, 140);
          fx.text(b.doorX + (b.slot.side === 'left' ? 34 : -34), b.slot.y - 24, `+${e.value}`, 0xfff3b0, 18);
        }
        break;
      }
      case 'bonk':
        if (this.t - this.lastBonkText > 1.2) {
          this.lastBonkText = this.t;
          fx.text(e.x, e.y - 24, 'No open door!', 0xff9aa8, 14);
        }
        break;
      case 'doorOpen':
        fx.ring(e.x, e.y, 0xfff1a8, 60);
        break;
      case 'kidney':
        fx.burst(e.x, e.y, 0xc98bd0, 4, 60);
        break;
      case 'flush':
        this.shake = 8;
        fx.burst(180, LANE.bottom, 0x9fd8ff, 30, 220);
        fx.text(180, LANE.bottom - 50, 'FLUSH! Extra glucose → pee', 0x9fd8ff, 16);
        break;
      case 'end':
        fx.confetti(180, 360, 60);
        break;
    }
  }

  sync(dt: number, calm: boolean) {
    const m = this.model;
    this.t += dt;
    this.fx.calm = calm;
    this.backdrop.update(dt, this.t, m.config.flowSpeed, calm);

    for (const d of m.districts) {
      this.buildings.get(d.id)!.update(
        dt,
        {
          energy: d.energy,
          locked: d.hasLock && !d.open,
          open: d.open,
          hungry: d.energy < 0.45,
          asleep: d.energy <= 0.02,
          fed: d.fed,
        },
        calm,
      );
      const helper = this.helpers.get(d.id);
      if (helper) {
        helper.alpha += ((d.open ? 1 : 0) - helper.alpha) * Math.min(1, dt * 8);
        helper.y = d.y - 34 + (calm ? 0 : Math.sin(this.t * 6) * 2);
      }
    }

    // glucose
    const live = new Set(m.glucose.map((g) => g.id));
    for (const [id, s] of this.glucose) {
      if (live.has(id)) continue;
      s.destroy();
      this.glucose.delete(id);
    }
    for (const g of m.glucose) {
      let s = this.glucose.get(g.id);
      if (!s) {
        s = new Sprite(this.tex.gloo);
        s.anchor.set(0.5);
        this.glucoseLayer.addChild(s);
        this.glucose.set(g.id, s);
      }
      s.position.set(g.x, g.y);
      if (g.state === 'sent') {
        s.scale.set(1.4 * (1 - Math.min(1, g.t / 0.35) * 0.5));
        s.tint = 0xffffff;
        s.rotation += dt * 12;
      } else if (g.state === 'bonk') {
        s.scale.set(1.4);
        s.tint = 0xff9aa8;
        s.rotation = Math.sin(g.t * 40) * 0.3;
      } else {
        s.scale.set(1.4 + (calm ? 0 : Math.sin(this.t * 4 + g.sway) * 0.06));
        s.tint = 0xffffff;
        s.rotation = calm ? 0 : Math.sin(this.t * 2 + g.sway) * 0.25;
      }
    }

    // swipe trail
    const p = m.pointerPos;
    if (p.down) this.trailPts.push({ x: p.x, y: p.y, age: 0 });
    for (const pt of this.trailPts) pt.age += dt;
    this.trailPts = this.trailPts.filter((pt) => pt.age < 0.18).slice(-14);
    this.trail.clear();
    for (let i = 1; i < this.trailPts.length; i++) {
      const a = this.trailPts[i - 1]!;
      const b = this.trailPts[i]!;
      this.trail.moveTo(a.x, a.y).lineTo(b.x, b.y).stroke({ width: 3 + i, color: 0xfff3b0, alpha: 0.12 + (i / this.trailPts.length) * 0.5, cap: 'round' });
    }

    const k = m.kidney / m.config.kidneyCapacity;
    this.kidneyFill.clear().roundRect(0, 0, Math.max(2, 70 * k), 7, 4).fill(k > 0.75 ? 0xff9aa8 : 0xc98bd0);

    this.fx.update(dt);
    if (this.shake > 0 && !calm) {
      this.camera.position.set((Math.random() - 0.5) * this.shake, (Math.random() - 0.5) * this.shake);
      this.shake = Math.max(0, this.shake - dt * 40);
    } else this.camera.position.set(0, 0);
  }

  destroy() {
    this.root.destroy({ children: true });
    this.tex.destroy();
  }
}
