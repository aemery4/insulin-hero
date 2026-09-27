/**
 * Draws a SceneModel with Pixi. Holds no simulation state of its own: every
 * frame it syncs display objects to the model.
 */
import { Container, Graphics, Sprite, Text, type Renderer, type Texture } from 'pixi.js';
import type { HeroSettings } from '../domain/types';
import { fastSugarSvg, foodSvg, glucoseSvg, heroSvg } from './art';
import { KIDNEY, VESSEL, WORLD, type CellKind, type CellModel, type HelperKind, type SceneModel } from './SceneModel';

const CELL_COLORS: Record<CellKind, { fill: number; edge: number; nucleus: number }> = {
  brain: { fill: 0xffa8d2, edge: 0xe0609e, nucleus: 0xc94d8a },
  muscle: { fill: 0xff8a66, edge: 0xd9533a, nucleus: 0xb8432c },
  heart: { fill: 0xff6f8e, edge: 0xd13a5c, nucleus: 0xa92c49 },
  fat: { fill: 0xffd57a, edge: 0xe0a93a, nucleus: 0xc08a24 },
};

const CELL_LABELS: Record<CellKind, string> = { brain: 'Brain', muscle: 'Muscle', heart: 'Heart', fat: 'Fat' };

const INK = 0x1b1f3b;
const LABEL_STYLE = {
  fontFamily: 'system-ui, sans-serif',
  fontSize: 14,
  fontWeight: '800',
  fill: 0xffffff,
  stroke: { color: 0x2b0b1a, width: 3 },
} as const;

type Expression = 'happy' | 'ok' | 'hungry' | 'sleepy';

function expressionFor(c: CellModel): Expression {
  if (c.energy > 0.75 || (c.fed > 0.5 && c.energy > 0.5)) return 'happy';
  if (c.energy > 0.45) return 'ok';
  return c.locked ? 'hungry' : 'sleepy';
}

interface CellView {
  glow: Graphics;
  dim: Graphics;
  face: Graphics;
  lock: Container;
  shackle: Graphics;
  expression: Expression | null;
}

interface Bubble {
  sprite: Graphics;
  x: number;
  y: number;
  speed: number;
  phase: number;
}

export class PixiRenderer {
  readonly root = new Container();
  private background = new Container();
  private decorLayer = new Container();
  private cellLayer = new Container();
  private particleLayer = new Container();
  private actorLayer = new Container();
  private textures: { glucose: Texture; fastSugar: Texture; food: Texture; hero: Texture | null };
  private particles = new Map<number, Sprite>();
  private pool: Sprite[] = [];
  private cells = new Map<CellKind, CellView>();
  private heroes = new Map<number, Sprite>();
  private helpers = new Map<HelperKind, Sprite>();
  private bloodCells: Bubble[] = [];
  private hero: HeroSettings;

  constructor(
    private renderer: Renderer,
    model: SceneModel,
    hero: HeroSettings,
  ) {
    this.hero = hero;
    this.root.addChild(this.background, this.decorLayer, this.cellLayer, this.particleLayer, this.actorLayer);
    this.textures = {
      glucose: this.bake(glucoseSvg()),
      fastSugar: this.bake(fastSugarSvg()),
      food: this.bake(foodSvg()),
      hero: null,
    };
    this.drawBackground();
    this.createBloodCells();
    for (const c of model.cells) this.cells.set(c.kind, this.createCell(c));
  }

  private bake(svg: string): Texture {
    const g = new Graphics().svg(svg);
    const tex = this.renderer.generateTexture({ target: g, resolution: 3, antialias: true });
    g.destroy();
    return tex;
  }

  private heroTexture(): Texture {
    this.textures.hero ??= this.bake(heroSvg(this.hero.bodyColor, this.hero.capeColor));
    return this.textures.hero;
  }

  setHero(hero: HeroSettings) {
    if (hero.bodyColor === this.hero.bodyColor && hero.capeColor === this.hero.capeColor) return;
    this.hero = hero;
    this.textures.hero?.destroy(true);
    this.textures.hero = null;
    for (const s of this.heroes.values()) s.texture = this.heroTexture();
  }

  /** Fit the 400x300 world into the canvas, centered. */
  layout(width: number, height: number) {
    const s = Math.min(width / WORLD.w, height / WORLD.h);
    this.root.scale.set(s);
    this.root.position.set((width - WORLD.w * s) / 2, (height - WORLD.h * s) / 2);
  }

  private drawBackground() {
    const g = new Graphics();
    g.rect(-40, -40, WORLD.w + 80, WORLD.h + 80).fill(0x3a1024);
    // tissue texture
    for (let i = 0; i < 40; i++) {
      const x = (i * 97) % WORLD.w;
      const y = (i * 53) % WORLD.h;
      if (y > VESSEL.top - 20 && y < VESSEL.bottom + 20) continue;
      g.circle(x, y, 3 + (i % 4)).fill({ color: 0x55203a, alpha: 0.6 });
    }
    // vessel: wall, blood, and a soft center highlight
    g.roundRect(-40, VESSEL.top - 12, WORLD.w + 80, VESSEL.bottom - VESSEL.top + 24, 44).fill(0x7a1a36);
    g.roundRect(-40, VESSEL.top, WORLD.w + 80, VESSEL.bottom - VESSEL.top, 36).fill(0xa8224a);
    g.roundRect(-40, VESSEL.top + 30, WORLD.w + 80, VESSEL.bottom - VESSEL.top - 60, 30).fill({
      color: 0xc0325a,
      alpha: 0.5,
    });
    // flow arrows
    for (const x of [40, 190, 340]) {
      g.poly([x, VESSEL.bottom - 16, x + 12, VESSEL.bottom - 11, x, VESSEL.bottom - 6]).fill({
        color: 0xffffff,
        alpha: 0.18,
      });
    }
    // kidney (bean) with a little tube from the vessel
    g.roundRect(KIDNEY.x - 4, VESSEL.bottom + 4, 8, KIDNEY.y - VESSEL.bottom - 20, 4).fill(0x7a1a36);
    g.ellipse(KIDNEY.x - 12, KIDNEY.y, 22, 24).fill(0x9c4f7a);
    g.ellipse(KIDNEY.x + 12, KIDNEY.y, 22, 24).fill(0x9c4f7a);
    g.ellipse(KIDNEY.x, KIDNEY.y - 16, 10, 7).fill(0x3a1024);
    g.ellipse(KIDNEY.x - 12, KIDNEY.y + 2, 12, 12).fill({ color: 0xffffff, alpha: 0.08 });
    const label = new Text({ text: 'Kidney', style: LABEL_STYLE });
    label.anchor.set(0.5);
    label.position.set(KIDNEY.x, KIDNEY.y + 6);
    this.background.addChild(g, label);
  }

  private createBloodCells() {
    for (let i = 0; i < 9; i++) {
      const g = new Graphics()
        .ellipse(0, 0, 11, 8)
        .fill({ color: 0xe0405f, alpha: 0.55 })
        .ellipse(0, 0, 5, 3.5)
        .fill({ color: 0x9c1d3c, alpha: 0.45 });
      this.decorLayer.addChild(g);
      this.bloodCells.push({
        sprite: g,
        x: (i * 47) % WORLD.w,
        y: VESSEL.top + 16 + ((i * 37) % (VESSEL.bottom - VESSEL.top - 32)),
        speed: 10 + (i % 3) * 3,
        phase: i,
      });
    }
  }

  private createCell(c: CellModel): CellView {
    const colors = CELL_COLORS[c.kind];
    const root = new Container();
    root.position.set(c.x, c.y);

    const glow = new Graphics().circle(0, 0, c.r + 14).fill({ color: 0xfff1a8, alpha: 0.9 });
    const body = new Graphics()
      .circle(0, 0, c.r)
      .fill(colors.fill)
      .stroke({ width: 3, color: colors.edge })
      .circle(-c.r * 0.62, c.r * 0.1, 3.5)
      .fill({ color: colors.nucleus, alpha: 0.55 })
      .circle(-c.r * 0.4, c.r * 0.6, 3)
      .fill({ color: colors.nucleus, alpha: 0.5 })
      .circle(c.r * 0.5, c.r * 0.45, 2.5)
      .fill({ color: colors.nucleus, alpha: 0.5 });
    const dim = new Graphics().circle(0, 0, c.r + 1.5).fill(0x1a0612);
    const face = new Graphics();
    const label = new Text({ text: CELL_LABELS[c.kind], style: LABEL_STYLE });
    label.anchor.set(0.5);
    label.position.set(0, -c.r * 0.52);
    const top = c.y < WORLD.h / 2;

    const lock = new Container();
    const shackle = new Graphics()
      .moveTo(-5, 0)
      .lineTo(-5, -4)
      .arc(0, -4, 5, Math.PI, 0)
      .lineTo(5, 0)
      .stroke({ width: 2.6, color: 0xe8e8f0 });
    const lockBody = new Graphics()
      .roundRect(-8, -1, 16, 12, 3)
      .fill(0xe8e8f0)
      .circle(0, 4, 1.8)
      .fill(INK)
      .rect(-0.8, 4, 1.6, 4)
      .fill(INK);
    lock.addChild(shackle, lockBody);
    lock.position.set(0, top ? c.r + 2 : -c.r - 8);
    lock.visible = c.hasLock;

    root.addChild(glow, body, dim, face, label, lock);
    this.cellLayer.addChild(root);
    return { glow, dim, face, lock, shackle, expression: null };
  }

  private drawFace(g: Graphics, expr: Expression, r: number) {
    g.clear();
    const ex = r * 0.3;
    const ey = r * 0.08;
    if (expr === 'sleepy') {
      g.moveTo(-ex - 4, ey).lineTo(-ex + 4, ey).moveTo(ex - 4, ey).lineTo(ex + 4, ey).stroke({ width: 2.2, color: INK });
    } else {
      g.circle(-ex, ey, 3.2).fill(INK).circle(ex, ey, 3.2).fill(INK);
      g.circle(-ex + 1, ey - 1, 1).fill(0xffffff).circle(ex + 1, ey - 1, 1).fill(0xffffff);
    }
    const my = r * 0.42;
    if (expr === 'happy') g.moveTo(-7, my - 2).quadraticCurveTo(0, my + 6, 7, my - 2).stroke({ width: 2.4, color: INK });
    else if (expr === 'ok') g.moveTo(-5, my).lineTo(5, my).stroke({ width: 2.4, color: INK });
    else if (expr === 'hungry') g.ellipse(0, my + 1, 4, 5).fill(INK); // open "hungry" mouth
    else g.moveTo(-5, my + 2).quadraticCurveTo(0, my - 3, 5, my + 2).stroke({ width: 2.2, color: INK });
  }

  sync(model: SceneModel) {
    const t = model.time;

    // background blood cells drift along (decoration only)
    const drift = model.reducedMotion ? 0.25 : 1;
    for (const b of this.bloodCells) {
      const x = (((b.x + t * b.speed * drift) % (WORLD.w + 40)) + WORLD.w + 40) % (WORLD.w + 40) - 20;
      b.sprite.position.set(x, b.y + Math.sin(t + b.phase) * 3);
      b.sprite.rotation = Math.sin(t * 0.5 + b.phase) * 0.4;
    }

    // glucose particles (pooled sprites)
    const seen = new Set<number>();
    for (const p of model.particles) {
      seen.add(p.id);
      let s = this.particles.get(p.id);
      if (!s) {
        s = this.pool.pop() ?? new Sprite(this.textures.glucose);
        s.anchor.set(0.5);
        s.scale.set(0.42);
        this.particleLayer.addChild(s);
        this.particles.set(p.id, s);
      }
      s.position.set(p.x, p.y);
      s.alpha = p.alpha;
      s.rotation = p.phase + t * 0.4;
    }
    for (const [id, s] of this.particles) {
      if (seen.has(id)) continue;
      this.particleLayer.removeChild(s);
      this.pool.push(s);
      this.particles.delete(id);
    }

    // cells: glow with energy, darken when hungry, face shows how they feel
    for (const c of model.cells) {
      const v = this.cells.get(c.kind)!;
      const pulse = model.reducedMotion ? 0 : Math.sin(t * 3 + c.x) * 0.03;
      v.glow.alpha = Math.max(0, (c.energy - 0.35) * 0.55) + 0.35 * c.fed;
      v.glow.scale.set(0.85 + 0.2 * c.energy + 0.1 * c.fed + pulse);
      v.dim.alpha = (1 - c.energy) * 0.6;
      const expr = expressionFor(c);
      if (expr !== v.expression) {
        this.drawFace(v.face, expr, c.r);
        v.expression = expr;
      }
      v.shackle.position.set(0, -6 * c.lockOpen);
      v.shackle.rotation = -0.5 * c.lockOpen;
      v.lock.alpha = 1 - 0.4 * c.lockOpen;
    }

    // heroes
    const liveHeroes = new Set(model.heroes.map((h) => h.id));
    for (const [id, s] of this.heroes) {
      if (liveHeroes.has(id)) continue;
      s.destroy();
      this.heroes.delete(id);
    }
    for (const h of model.heroes) {
      let s = this.heroes.get(h.id);
      if (!s) {
        s = new Sprite(this.heroTexture());
        s.anchor.set(0.5);
        s.scale.set(0.62);
        this.actorLayer.addChild(s);
        this.heroes.set(h.id, s);
      }
      s.visible = h.delay <= 0;
      const bob = model.reducedMotion ? 0 : Math.sin(t * 6 + h.id) * 1.8;
      s.position.set(h.x, h.y + bob);
      s.rotation = h.phase === 'unlock' && !model.reducedMotion ? Math.sin(h.t * 10) * 0.12 : 0;
      s.alpha = h.alpha;
    }

    // helpers
    const liveHelpers = new Set(model.helpers.map((h) => h.kind));
    for (const [kind, s] of this.helpers) {
      if (liveHelpers.has(kind)) continue;
      s.destroy();
      this.helpers.delete(kind);
    }
    for (const h of model.helpers) {
      let s = this.helpers.get(h.kind);
      if (!s) {
        s = new Sprite(h.kind === 'fastSugar' ? this.textures.fastSugar : this.textures.food);
        s.anchor.set(0.5);
        s.scale.set(0.7);
        this.actorLayer.addChild(s);
        this.helpers.set(h.kind, s);
      }
      const wiggle = h.phase === 'release' && !model.reducedMotion ? Math.sin(h.t * 14) * 0.1 : 0;
      s.position.set(h.x, h.y);
      s.rotation = wiggle;
      s.alpha = h.alpha;
    }
  }

  destroy() {
    this.textures.glucose.destroy(true);
    this.textures.fastSugar.destroy(true);
    this.textures.food.destroy(true);
    this.textures.hero?.destroy(true);
    this.root.destroy({ children: true });
  }
}
