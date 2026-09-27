import { Container, Sprite, type Renderer } from 'pixi.js';
import type { HeroSettings } from '../../../domain/types';
import { Backdrop } from '../../engine/Backdrop';
import { Building } from '../../engine/Building';
import { Fx } from '../../engine/Fx';
import { HeroActor } from '../../engine/HeroActor';
import { createTextures, type GameTextures } from '../../engine/textures';
import type { MissionRenderer } from '../../engine/stage';
import type { GameEvent } from '../types';
import { HUNGRY_AT, type KeyRunModel } from './model';

const GOLD = 0xffd23f;

export class KeyRunRenderer implements MissionRenderer {
  readonly root = new Container();
  private camera = new Container();
  private tex: GameTextures;
  private backdrop: Backdrop;
  private buildings = new Map<string, Building>();
  private fed = new Map<string, number>();
  private itemLayer = new Container();
  private keys = new Map<number, Container>();
  private jams = new Map<number, Sprite>();
  private hero: HeroActor;
  private fx: Fx;
  private shake = 0;
  private t = 0;
  private bossRing: Sprite;

  constructor(
    renderer: Renderer,
    private model: KeyRunModel,
    heroColors: HeroSettings,
  ) {
    this.tex = createTextures(renderer, heroColors);
    this.backdrop = new Backdrop(renderer, this.tex);
    this.fx = new Fx(this.tex);
    this.hero = new HeroActor(this.tex, heroColors);

    const buildingLayer = new Container();
    for (const d of model.districts) {
      const b = new Building(d, this.tex);
      this.buildings.set(d.id, b);
      buildingLayer.addChild(b.root);
    }

    this.bossRing = new Sprite(this.tex.glow);
    this.bossRing.anchor.set(0.5);
    this.bossRing.tint = 0xff8a3d;
    this.bossRing.blendMode = 'add';
    this.bossRing.visible = false;

    this.camera.addChild(this.backdrop.root, this.bossRing, buildingLayer, this.itemLayer, this.hero.root, this.fx.layer);
    this.root.addChild(this.camera);
  }

  onEvent(e: GameEvent) {
    const fx = this.fx;
    switch (e.type) {
      case 'pickup':
        fx.burst(e.x, e.y, GOLD, 12, 140);
        fx.ring(e.x, e.y, GOLD, 50);
        break;
      case 'deliver': {
        const b = e.target ? this.buildings.get(e.target) : undefined;
        if (b) {
          const cx = b.slot.side === 'left' ? 40 : 320;
          fx.stream(b.doorX + (b.slot.side === 'left' ? 50 : -50), b.slot.y, cx, b.slot.y, this.tex.glucose, 10);
          fx.burst(b.doorX, b.slot.y, 0xfff1a8, 18, 180);
          fx.ring(cx, b.slot.y, 0xfff1a8, 90);
          this.fed.set(b.slot.id, 1);
        }
        fx.text(e.x + (e.x < 180 ? 40 : -40), e.y - 20, `+${e.value}`, 0xfff3b0, 20);
        break;
      }
      case 'combo':
        fx.text(180, e.y - 10, `COMBO x${1 + 0.5 * ((e.value ?? 1) - 1)}!`, GOLD, 26);
        break;
      case 'wake':
        fx.text(e.x + (e.x < 180 ? 40 : -40), e.y - 50, 'Wake up! +100', 0xc9d1ff, 16);
        break;
      case 'bump':
        this.shake = 10;
        fx.burst(e.x, e.y, 0xff5577, 10, 120);
        break;
      case 'noKeyNeeded':
        fx.text(e.x - 50, e.y - 40, 'No key needed here!', 0xfff1a8, 14);
        break;
      case 'asleep':
        fx.text(e.x + (e.x < 180 ? 40 : -40), e.y - 40, 'Zzz…', 0xc9d1ff, 14);
        break;
      case 'bossStart':
        this.shake = 8;
        fx.ring(e.x, e.y, 0xff8a3d, 160);
        break;
      case 'bossDone':
        fx.confetti(e.x + (e.x < 180 ? 40 : -40), e.y);
        fx.text(180, e.y - 60, 'MATCH WON! +1000', GOLD, 26);
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
    this.backdrop.update(dt, this.t, m.config.scrollSpeed, calm);

    // buildings
    for (const d of m.districts) {
      const b = this.buildings.get(d.id)!;
      const fed = Math.max(0, (this.fed.get(d.id) ?? 0) - dt * 1.5);
      this.fed.set(d.id, fed);
      b.update(
        dt,
        {
          energy: d.energy,
          locked: d.hasLock,
          open: d.filling > 0,
          hungry: d.hasLock && d.energy < HUNGRY_AT && d.filling <= 0,
          asleep: d.asleep,
          fed,
        },
        calm,
      );
    }

    // boss spotlight
    const boss = m.config.boss && m.bossActive ? m.districts.find((d) => d.id === m.config.boss!.district) : undefined;
    this.bossRing.visible = !!boss;
    if (boss) {
      this.bossRing.position.set(boss.side === 'left' ? 40 : 320, boss.y);
      this.bossRing.scale.set(2.2 + Math.sin(this.t * 6) * 0.25);
      this.bossRing.alpha = 0.5 + Math.sin(this.t * 6) * 0.2;
    }

    // keys
    const liveKeys = new Set(m.keys.map((k) => k.id));
    for (const [id, c] of this.keys) {
      if (liveKeys.has(id)) continue;
      c.destroy({ children: true });
      this.keys.delete(id);
    }
    for (const k of m.keys) {
      let c = this.keys.get(k.id);
      if (!c) {
        c = new Container();
        const glow = new Sprite(this.tex.glow);
        glow.anchor.set(0.5);
        glow.tint = GOLD;
        glow.alpha = 0.5;
        glow.scale.set(0.7);
        glow.blendMode = 'add';
        const key = new Sprite(this.tex.key);
        key.anchor.set(0.5);
        key.scale.set(0.85);
        c.addChild(glow, key);
        this.itemLayer.addChild(c);
        this.keys.set(k.id, c);
      }
      c.position.set(k.x, k.y);
      c.children[1]!.rotation = calm ? 0 : Math.sin(this.t * 3 + k.sway) * 0.5;
      c.children[0]!.alpha = 0.35 + 0.25 * Math.sin(this.t * 5 + k.sway);
      c.alpha = k.dropped ? 0.6 + 0.4 * Math.sin(this.t * 20) : 1;
      if (!calm && Math.random() < dt * 3) this.fx.sparkle(k.x, k.y, GOLD);
    }

    // traffic jams
    const liveJams = new Set(m.obstacles.map((o) => o.id));
    for (const [id, s] of this.jams) {
      if (liveJams.has(id)) continue;
      s.destroy();
      this.jams.delete(id);
    }
    for (const o of m.obstacles) {
      let s = this.jams.get(o.id);
      if (!s) {
        s = new Sprite(this.tex.jam);
        s.anchor.set(0.5);
        this.itemLayer.addChild(s);
        this.jams.set(o.id, s);
      }
      s.position.set(o.x, o.y);
      s.scale.set((o.r / 24) * (1 + (calm ? 0 : Math.sin(this.t * 6 + o.sway) * 0.05)));
      s.rotation = calm ? 0 : Math.sin(this.t * 2 + o.sway) * 0.15;
    }

    // hero + speed trail
    const h = m.hero;
    this.hero.update(dt, h.x, h.y, h.vx, h.vy, h.keys, h.stun, calm);
    if (Math.hypot(h.vx, h.vy) > 200) this.fx.sparkle(h.x, h.y + 12, this.hero.tint);

    this.fx.update(dt);

    // screen shake
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
