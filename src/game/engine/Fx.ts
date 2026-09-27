/** Lightweight pooled particle + floating-text effects. */
import { Container, Sprite, Text, type Texture } from 'pixi.js';
import type { GameTextures } from './textures';

interface Particle {
  s: Sprite;
  vx: number;
  vy: number;
  life: number;
  max: number;
  spin: number;
  grow: number;
  gravity: number;
  fade: boolean;
}

interface Floater {
  t: Text;
  vy: number;
  life: number;
  max: number;
}

interface Ring {
  s: Sprite;
  life: number;
  max: number;
  size: number;
}

export class Fx {
  readonly layer = new Container();
  private parts: Particle[] = [];
  private pool: Sprite[] = [];
  private floaters: Floater[] = [];
  private rings: Ring[] = [];
  /** Fewer, calmer effects for reduced motion. */
  calm = false;

  constructor(private tex: GameTextures) {}

  private sprite(texture: Texture): Sprite {
    const s = this.pool.pop() ?? new Sprite();
    s.texture = texture;
    s.anchor.set(0.5);
    s.alpha = 1;
    s.rotation = 0;
    s.tint = 0xffffff; // pooled sprites keep old tints otherwise
    s.blendMode = 'add';
    this.layer.addChild(s);
    return s;
  }

  burst(x: number, y: number, color: number, count = 14, speed = 160, texture: Texture = this.tex.spark) {
    const n = this.calm ? Math.ceil(count / 3) : count;
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const v = speed * (0.4 + Math.random() * 0.8) * (this.calm ? 0.4 : 1);
      const s = this.sprite(texture);
      s.tint = color;
      s.position.set(x, y);
      s.scale.set(0.5 + Math.random() * 0.6);
      this.parts.push({ s, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: 0, max: 0.5 + Math.random() * 0.4, spin: (Math.random() - 0.5) * 8, grow: -0.6, gravity: 120, fade: true });
    }
  }

  confetti(x: number, y: number, count = 40) {
    const colors = [0xffd23f, 0x43d9a3, 0x5fb4ff, 0xff7a93, 0xb48bff];
    for (let i = 0; i < (this.calm ? 10 : count); i++) {
      const s = this.sprite(this.tex.dot);
      s.blendMode = 'normal';
      s.tint = colors[i % colors.length]!;
      s.position.set(x, y);
      s.scale.set(0.8, 1.6);
      const a = -Math.PI / 2 + (Math.random() - 0.5) * 2.2;
      const v = 250 + Math.random() * 250;
      this.parts.push({ s, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: 0, max: 1.6 + Math.random(), spin: (Math.random() - 0.5) * 14, grow: 0, gravity: 420, fade: true });
    }
  }

  /** A few drifting sparkles (trails, idle glints). */
  sparkle(x: number, y: number, color: number, texture: Texture = this.tex.spark) {
    if (this.calm) return;
    const s = this.sprite(texture);
    s.tint = color;
    s.position.set(x + (Math.random() - 0.5) * 10, y + (Math.random() - 0.5) * 10);
    s.scale.set(0.35 + Math.random() * 0.3);
    this.parts.push({ s, vx: (Math.random() - 0.5) * 30, vy: 20 + Math.random() * 30, life: 0, max: 0.45, spin: 3, grow: -0.5, gravity: 0, fade: true });
  }

  /** Something flying from A to B (e.g. glucose streaming into a building). */
  stream(fromX: number, fromY: number, toX: number, toY: number, texture: Texture, count = 8) {
    for (let i = 0; i < (this.calm ? 3 : count); i++) {
      const s = this.sprite(texture);
      s.blendMode = 'normal';
      s.scale.set(0.9);
      const delay = i * 0.06;
      const fx = fromX + (Math.random() - 0.5) * 40;
      const fy = fromY + (Math.random() - 0.5) * 40;
      s.position.set(fx, fy);
      s.alpha = 0;
      const dur = 0.45;
      this.parts.push({
        s,
        vx: (toX - fx) / dur,
        vy: (toY - fy) / dur,
        life: -delay,
        max: dur,
        spin: 2,
        grow: -0.8,
        gravity: 0,
        fade: false,
      });
    }
  }

  ring(x: number, y: number, color: number, size = 60) {
    const s = this.sprite(this.tex.glow);
    s.tint = color;
    s.position.set(x, y);
    s.scale.set(0.2);
    this.rings.push({ s, life: 0, max: 0.45, size });
  }

  text(x: number, y: number, str: string, color = 0xffffff, size = 18) {
    const t = new Text({
      text: str,
      style: {
        fontFamily: 'system-ui, sans-serif',
        fontSize: size,
        fontWeight: '900',
        fill: color,
        stroke: { color: 0x1b1f3b, width: 4 },
      },
    });
    t.anchor.set(0.5);
    t.position.set(x, y);
    this.layer.addChild(t);
    this.floaters.push({ t, vy: -50, life: 0, max: 1 });
  }

  update(dt: number) {
    for (const p of this.parts) {
      p.life += dt;
      if (p.life < 0) continue;
      if (!p.fade && p.s.alpha === 0) p.s.alpha = 1;
      p.vy += p.gravity * dt;
      p.s.x += p.vx * dt;
      p.s.y += p.vy * dt;
      p.s.rotation += p.spin * dt;
      const k = p.life / p.max;
      if (p.grow) p.s.scale.set(Math.max(0.05, p.s.scale.x * (1 + p.grow * dt)), Math.max(0.05, p.s.scale.y * (1 + p.grow * dt)));
      if (p.fade) p.s.alpha = 1 - k;
    }
    for (const p of this.parts.filter((q) => q.life >= q.max)) {
      this.layer.removeChild(p.s);
      this.pool.push(p.s);
    }
    this.parts = this.parts.filter((p) => p.life < p.max);

    for (const r of this.rings) {
      r.life += dt;
      const k = r.life / r.max;
      r.s.scale.set(0.2 + (k * r.size) / 40);
      r.s.alpha = 1 - k;
    }
    for (const r of this.rings.filter((q) => q.life >= q.max)) {
      this.layer.removeChild(r.s);
      this.pool.push(r.s);
    }
    this.rings = this.rings.filter((r) => r.life < r.max);

    for (const f of this.floaters) {
      f.life += dt;
      f.t.y += f.vy * dt;
      f.vy *= 0.94;
      const k = f.life / f.max;
      f.t.alpha = k < 0.7 ? 1 : 1 - (k - 0.7) / 0.3;
      f.t.scale.set(k < 0.12 ? 0.6 + (k / 0.12) * 0.5 : 1.1 - Math.min(0.1, k * 0.2));
    }
    for (const f of this.floaters.filter((q) => q.life >= q.max)) f.t.destroy();
    this.floaters = this.floaters.filter((f) => f.life < f.max);
  }
}
