/**
 * Hosts one mission: owns the Pixi app, maps touches to world coordinates,
 * runs the model at a steady tick, and forwards events to the renderer + UI.
 */
import 'pixi.js/unsafe-eval'; // lets Pixi run under our strict CSP (no eval)
import { Application, Container, Rectangle, type Renderer } from 'pixi.js';
import { GAME_H, GAME_W, type GameEvent, type Hud, type MissionModel } from '../missions/types';

export interface MissionRenderer {
  readonly root: Container;
  sync(dt: number, calm: boolean): void;
  onEvent(e: GameEvent): void;
  destroy(): void;
}

export interface StageCallbacks {
  onEvent(e: GameEvent): void;
  onHud(h: Hud): void;
}

export class GameStage {
  paused = false;
  private world = new Container();
  private hudTimer = 0;
  private cleanup: (() => void)[] = [];
  private keys = new Set<string>();
  private nudging = false;

  private constructor(
    private app: Application,
    private model: MissionModel,
    private view: MissionRenderer,
    private cb: StageCallbacks,
    private calm: boolean,
  ) {}

  static async create(
    host: HTMLElement,
    model: MissionModel,
    makeRenderer: (r: Renderer) => MissionRenderer,
    cb: StageCallbacks,
    calm: boolean,
  ): Promise<GameStage> {
    const app = new Application();
    await app.init({
      resizeTo: host,
      background: '#241033',
      antialias: true,
      autoDensity: true,
      resolution: Math.min(window.devicePixelRatio || 1, 2),
      preference: 'webgl',
    });
    app.canvas.style.touchAction = 'none';
    app.canvas.setAttribute('aria-hidden', 'true');
    host.appendChild(app.canvas);

    const view = makeRenderer(app.renderer);
    const stage = new GameStage(app, model, view, cb, calm);
    stage.world.addChild(view.root);
    app.stage.addChild(stage.world);
    stage.layout(app.screen.width, app.screen.height);
    app.renderer.on('resize', (w: number, h: number) => stage.layout(w, h));
    stage.bindInput();
    app.ticker.add((t) => stage.tick(t.deltaMS));
    return stage;
  }

  /** Fit the 360x640 world, centered (letterboxed). */
  private layout(w: number, h: number) {
    const s = Math.min(w / GAME_W, h / GAME_H);
    this.world.scale.set(s);
    this.world.position.set((w - GAME_W * s) / 2, (h - GAME_H * s) / 2);
  }

  private toWorld(clientX: number, clientY: number) {
    const r = this.app.canvas.getBoundingClientRect();
    return {
      x: (clientX - r.left - this.world.x) / this.world.scale.x,
      y: (clientY - r.top - this.world.y) / this.world.scale.y,
    };
  }

  private bindInput() {
    const c = this.app.canvas;
    let down = false;
    const send = (e: PointerEvent, isDown: boolean) => {
      if (this.paused) return;
      const p = this.toWorld(e.clientX, e.clientY);
      this.model.pointer({ ...p, down: isDown });
    };
    const onDown = (e: PointerEvent) => {
      down = true;
      c.setPointerCapture?.(e.pointerId);
      send(e, true);
      e.preventDefault();
    };
    const onMove = (e: PointerEvent) => {
      if (down) send(e, true);
    };
    const onUp = (e: PointerEvent) => {
      down = false;
      send(e, false);
    };
    c.addEventListener('pointerdown', onDown);
    c.addEventListener('pointermove', onMove);
    c.addEventListener('pointerup', onUp);
    c.addEventListener('pointercancel', onUp);

    // arrow keys / WASD for desktop players
    const onKey = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      if (!['arrowleft', 'arrowright', 'arrowup', 'arrowdown', 'a', 'd', 'w', 's'].includes(k)) return;
      e.preventDefault();
      if (e.type === 'keydown') this.keys.add(k);
      else this.keys.delete(k);
    };
    window.addEventListener('keydown', onKey);
    window.addEventListener('keyup', onKey);
    this.cleanup.push(() => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('keyup', onKey);
    });
  }

  private tick(ms: number) {
    const dt = Math.min(ms, 50) / 1000;
    if (!this.paused) {
      if (this.model.nudge && (this.keys.size || this.nudging)) {
        const has = (...ks: string[]) => ks.some((k) => this.keys.has(k));
        this.model.nudge((has('arrowright', 'd') ? 1 : 0) - (has('arrowleft', 'a') ? 1 : 0), (has('arrowdown', 's') ? 1 : 0) - (has('arrowup', 'w') ? 1 : 0));
        this.nudging = this.keys.size > 0; // one final (0,0) nudge stops the hero
      }
      this.model.step(ms);
      for (const e of this.model.drainEvents()) {
        this.view.onEvent(e);
        this.cb.onEvent(e);
      }
      this.view.sync(dt, this.calm);
    }
    this.hudTimer -= dt;
    if (this.hudTimer <= 0 || this.model.done) {
      this.hudTimer = 0.1;
      this.cb.onHud(this.model.hud());
    }
  }

  /** Dev checks: step the game manually (the frame loop pauses in hidden tabs). */
  advance(seconds: number, pointer?: { x: number; y: number }) {
    for (let i = 0; i < seconds * 60; i++) {
      if (pointer) this.model.pointer({ ...pointer, down: true });
      this.tick(1000 / 60);
    }
    if (pointer) this.model.pointer({ ...pointer, down: false });
  }

  /** Dev checks: render the world to a PNG at a fixed size, whatever the canvas size. */
  async capture(width = 540): Promise<string> {
    const height = (width * GAME_H) / GAME_W;
    const prev = { s: this.world.scale.x, x: this.world.x, y: this.world.y };
    this.world.scale.set(width / GAME_W);
    this.world.position.set(0, 0);
    try {
      return await this.app.renderer.extract.base64({
        target: this.app.stage,
        frame: new Rectangle(0, 0, width, height),
        resolution: 1,
        clearColor: '#241033',
      });
    } finally {
      this.world.scale.set(prev.s);
      this.world.position.set(prev.x, prev.y);
    }
  }

  setPaused(p: boolean) {
    this.paused = p;
    if (p) this.model.pointer({ x: 0, y: 0, down: false });
  }

  destroy() {
    for (const f of this.cleanup) f();
    this.view.destroy();
    this.app.destroy({ removeView: true }, { children: true });
  }
}
