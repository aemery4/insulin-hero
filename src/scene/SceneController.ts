import 'pixi.js/unsafe-eval'; // lets Pixi run under our strict CSP (no eval)
import { Application, Rectangle } from 'pixi.js';
import type { HeroSettings, SceneState } from '../domain/types';
import { DEFAULT_SETTINGS } from '../storage/settingsRepo';
import { PixiRenderer } from './PixiRenderer';
import { SceneModel, WORLD, type SceneSnapshot } from './SceneModel';

export interface SceneUpdate {
  state: SceneState;
  playKey: string;
  hero: HeroSettings;
  reducedMotion: boolean;
}

/** Owns the Pixi application; React only calls `update`. */
export class SceneController {
  readonly model = new SceneModel(Date.now() & 0xffff);
  private lastKey: string | null = null;

  private constructor(
    private app: Application,
    private view: PixiRenderer,
    private host: HTMLElement,
  ) {}

  static async create(host: HTMLElement, hero: HeroSettings = DEFAULT_SETTINGS.hero): Promise<SceneController> {
    const app = new Application();
    await app.init({
      resizeTo: host,
      backgroundAlpha: 0,
      antialias: true,
      autoDensity: true,
      resolution: Math.min(window.devicePixelRatio || 1, 2),
      preference: 'webgl',
    });
    app.canvas.setAttribute('aria-hidden', 'true');
    host.appendChild(app.canvas);

    const controller = new SceneController(app, null as unknown as PixiRenderer, host);
    const view = new PixiRenderer(app.renderer, controller.model, hero);
    controller.view = view;
    app.stage.addChild(view.root);
    view.layout(app.screen.width, app.screen.height);
    app.renderer.on('resize', (w: number, h: number) => view.layout(w, h));
    app.ticker.add((t) => {
      controller.model.step(t.deltaMS);
      view.sync(controller.model);
    });
    return controller;
  }

  update({ state, playKey, hero, reducedMotion }: SceneUpdate) {
    const replay = playKey !== this.lastKey;
    this.lastKey = playKey;
    this.view.setHero(hero);
    this.model.apply(state, { replay, reducedMotion });
    this.view.sync(this.model);
  }

  snapshot(): SceneSnapshot {
    return this.model.snapshot();
  }

  /** Step the simulation manually (for checks while the page's frame loop is paused). */
  advance(seconds: number): SceneSnapshot {
    for (let i = 0; i < seconds * 60; i++) this.model.step(1000 / 60);
    this.view.sync(this.model);
    return this.model.snapshot();
  }

  /**
   * Render the scene to a PNG data URL at a fixed size, independent of the
   * on-screen canvas size (used for visual checks during development).
   */
  async capture(width = 800): Promise<string> {
    const height = (width * WORLD.h) / WORLD.w;
    const { root } = this.view;
    const prev = { sx: root.scale.x, x: root.x, y: root.y };
    this.view.sync(this.model);
    this.view.layout(width, height);
    try {
      return await this.app.renderer.extract.base64({
        target: this.app.stage,
        frame: new Rectangle(0, 0, width, height),
        resolution: 1,
        clearColor: '#3a1024',
      });
    } finally {
      root.scale.set(prev.sx);
      root.position.set(prev.x, prev.y);
    }
  }

  destroy() {
    this.view.destroy();
    this.app.destroy({ removeView: true }, { children: true });
    this.host.replaceChildren();
  }
}
