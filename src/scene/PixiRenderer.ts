/**
 * Draws a SceneModel with Pixi. Holds no simulation state of its own: every
 * frame it syncs display objects to the model.
 */
import { Container, Graphics, Sprite, Text, type Renderer, type Texture } from 'pixi.js';
import type { HeroSettings } from '../domain/types';
import { KIDNEY, VESSEL, WORLD, type CellKind, type CellModel, type HelperKind, type SceneModel } from './SceneModel';

const CELL_COLORS: Record<CellKind, number> = {
  brain: 0xff9ecb,
  muscle: 0xff7a59,
  heart: 0xff5577,
  fat: 0xffd166,
};

const CELL_LABELS: Record<CellKind, string> = {
  brain: 'Brain',
  muscle: 'Muscle',
  heart: 'Heart',
  fat: 'Fat',
};

const LABEL_STYLE = {
  fontFamily: 'system-ui, sans-serif',
  fontSize: 13,
  fontWeight: '700',
  fill: 0xffffff,
} as const;

const hex = (css: string) => parseInt(css.replace('#', ''), 16);

interface CellView {
  root: Container;
  glow: Graphics;
  body: Graphics;
  lock: Container;
  shackle: Graphics;
}

export class PixiRenderer {
  readonly root = new Container();
  private background = new Container();
  private cellLayer = new Container();
  private particleLayer = new Container();
  private actorLayer = new Container();
  private glucoseTexture: Texture;
  private particles = new Map<number, Sprite>();
  private pool: Sprite[] = [];
  private cells = new Map<CellKind, CellView>();
  private heroes = new Map<number, Container>();
  private helpers = new Map<HelperKind, Container>();
  private hero: HeroSettings;

  constructor(
    private renderer: Renderer,
    model: SceneModel,
    hero: HeroSettings,
  ) {
    this.hero = hero;
    this.root.addChild(this.background, this.cellLayer, this.particleLayer, this.actorLayer);
    this.drawBackground();
    for (const c of model.cells) this.cells.set(c.kind, this.createCell(c));
    this.glucoseTexture = this.renderer.generateTexture({ target: glucoseShape(), resolution: 3 });
  }

  setHero(hero: HeroSettings) {
    if (hero.bodyColor === this.hero.bodyColor && hero.capeColor === this.hero.capeColor) return;
    this.hero = hero;
    for (const v of this.heroes.values()) v.destroy({ children: true });
    this.heroes.clear();
  }

  /** Fit the 400x300 world into the canvas, centered. */
  layout(width: number, height: number) {
    const s = Math.min(width / WORLD.w, height / WORLD.h);
    this.root.scale.set(s);
    this.root.position.set((width - WORLD.w * s) / 2, (height - WORLD.h * s) / 2);
  }

  private drawBackground() {
    const g = new Graphics();
    // vessel wall + blood
    g.roundRect(-20, VESSEL.top - 10, WORLD.w + 40, VESSEL.bottom - VESSEL.top + 20, 40).fill(0x8a1f3d);
    g.roundRect(-20, VESSEL.top, WORLD.w + 40, VESSEL.bottom - VESSEL.top, 34).fill(0xb3264d);
    // kidney
    g.ellipse(KIDNEY.x, KIDNEY.y, 34, 22).fill(0x9c4f7a);
    g.ellipse(KIDNEY.x - 4, KIDNEY.y - 22, 10, 6).fill(0x2b0b1a);
    const label = new Text({ text: 'Kidney', style: LABEL_STYLE });
    label.anchor.set(0.5);
    label.position.set(KIDNEY.x, KIDNEY.y + 2);
    this.background.addChild(g, label);
  }

  private createCell(c: CellModel): CellView {
    const root = new Container();
    root.position.set(c.x, c.y);
    const glow = new Graphics().circle(0, 0, c.r + 12).fill(CELL_COLORS[c.kind]);
    const body = new Graphics().circle(0, 0, c.r).fill(CELL_COLORS[c.kind]);
    const label = new Text({ text: CELL_LABELS[c.kind], style: { ...LABEL_STYLE, stroke: { color: 0x2b0b1a, width: 3 } } });
    label.anchor.set(0.5);

    const lock = new Container();
    const shackle = new Graphics().arc(0, 0, 6, Math.PI, 0).stroke({ width: 3, color: 0xe8e8f0 });
    shackle.position.set(0, -2);
    const lockBody = new Graphics().roundRect(-8, -2, 16, 13, 3).fill(0xe8e8f0).circle(0, 4, 2).fill(0x333344);
    lock.addChild(shackle, lockBody);
    lock.position.set(0, c.y < WORLD.h / 2 ? c.r - 4 : -c.r + 2);
    lock.visible = c.hasLock;

    root.addChild(glow, body, label, lock);
    this.cellLayer.addChild(root);
    return { root, glow, body, lock, shackle };
  }

  private createHero(): Container {
    const v = new Container();
    const cape = new Graphics().poly([-10, -4, 10, -4, 16, 20, -16, 20]).fill(hex(this.hero.capeColor));
    const body = new Graphics().circle(0, 0, 12).fill(hex(this.hero.bodyColor));
    const eyes = new Graphics().circle(-4, -2, 2).fill(0x111122).circle(4, -2, 2).fill(0x111122);
    const key = new Graphics()
      .circle(16, 2, 4)
      .stroke({ width: 2, color: 0xffd23f })
      .rect(19, 1, 10, 2)
      .fill(0xffd23f)
      .rect(25, 3, 2, 3)
      .fill(0xffd23f);
    v.addChild(cape, body, eyes, key);
    this.actorLayer.addChild(v);
    return v;
  }

  private createHelper(kind: HelperKind): Container {
    const v = new Container();
    if (kind === 'fastSugar') {
      // original juice-box style helper
      v.addChild(
        new Graphics().roundRect(-12, -16, 24, 32, 4).fill(0x33c9ff),
        new Graphics().rect(-12, -4, 24, 10).fill(0xffffff),
        new Graphics().rect(4, -24, 3, 10).fill(0xffffff),
        new Graphics().circle(-4, -9, 2).fill(0x111122).circle(4, -9, 2).fill(0x111122),
      );
    } else {
      v.addChild(
        new Graphics().circle(0, 0, 16).fill(0xf4a259),
        new Graphics().circle(-5, -3, 2).fill(0x111122).circle(5, -3, 2).fill(0x111122),
      );
    }
    this.actorLayer.addChild(v);
    return v;
  }

  sync(model: SceneModel) {
    // glucose particles
    const seen = new Set<number>();
    for (const p of model.particles) {
      seen.add(p.id);
      let s = this.particles.get(p.id);
      if (!s) {
        s = this.pool.pop() ?? new Sprite(this.glucoseTexture);
        s.anchor.set(0.5);
        this.particleLayer.addChild(s);
        this.particles.set(p.id, s);
      }
      s.position.set(p.x, p.y);
      s.alpha = p.alpha;
      s.rotation = p.phase + model.time * 0.3;
    }
    for (const [id, s] of this.particles) {
      if (seen.has(id)) continue;
      this.particleLayer.removeChild(s);
      this.pool.push(s);
      this.particles.delete(id);
    }

    // cells
    for (const c of model.cells) {
      const v = this.cells.get(c.kind)!;
      v.glow.alpha = 0.15 + 0.45 * c.energy + 0.3 * c.fed;
      v.glow.scale.set(0.9 + 0.15 * c.energy + 0.08 * c.fed);
      v.body.alpha = 0.35 + 0.65 * c.energy;
      v.shackle.y = -2 - 6 * c.lockOpen;
      v.shackle.rotation = -0.6 * c.lockOpen;
    }

    // heroes
    const liveHeroes = new Set(model.heroes.map((h) => h.id));
    for (const [id, v] of this.heroes) {
      if (!liveHeroes.has(id)) {
        v.destroy({ children: true });
        this.heroes.delete(id);
      }
    }
    for (const h of model.heroes) {
      let v = this.heroes.get(h.id);
      if (!v) this.heroes.set(h.id, (v = this.createHero()));
      v.visible = h.delay <= 0;
      v.position.set(h.x, h.y + Math.sin(model.time * 6 + h.id) * 1.5);
      v.alpha = h.alpha;
    }

    // helpers
    const liveHelpers = new Set(model.helpers.map((h) => h.kind));
    for (const [kind, v] of this.helpers) {
      if (!liveHelpers.has(kind)) {
        v.destroy({ children: true });
        this.helpers.delete(kind);
      }
    }
    for (const h of model.helpers) {
      let v = this.helpers.get(h.kind);
      if (!v) this.helpers.set(h.kind, (v = this.createHelper(h.kind)));
      v.position.set(h.x, h.y);
      v.alpha = h.alpha;
    }
  }

  destroy() {
    this.glucoseTexture.destroy(true);
    this.root.destroy({ children: true });
  }
}

/** Glucose is a ring-shaped molecule, drawn as a friendly hexagon. */
function glucoseShape(): Graphics {
  const pts: number[] = [];
  for (let i = 0; i < 6; i++) {
    const a = (Math.PI / 3) * i + Math.PI / 6;
    pts.push(Math.cos(a) * 6, Math.sin(a) * 6);
  }
  return new Graphics().poly(pts).fill(0xfff3b0).stroke({ width: 1.5, color: 0xffc93c });
}
