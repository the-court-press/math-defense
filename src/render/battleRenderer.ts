// Draws a Battle every frame: scenery, towers, Foglings, projectiles, effects and riddle tags.

import type { Battle, BattleEvent, Enemy } from '../sim/battle';
import { towerStats } from '../sim/battle';
import type { SiteDigit, Vec } from '../content/types';
import { SITE_DIGITS } from '../content/types';
import { TOWERS } from '../content/units';
import { ACCENT, ENEMY_COLORS, INK, drawEnemy, drawPlatform, drawTower, roundRect, sparkle, type Ctx } from './art';
import { H, Scene, W } from './scene';

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  max: number;
  size: number;
  color: string;
  gravity: number;
  spark?: boolean;
}

interface Floater {
  x: number;
  y: number;
  text: string;
  color: string;
  life: number;
  max: number;
  size: number;
}

interface Ring {
  x: number;
  y: number;
  r0: number;
  r1: number;
  life: number;
  max: number;
  color: string;
  width: number;
}

interface Beam {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  life: number;
  max: number;
}

export interface RenderUi {
  buildMode: boolean;
  selectedSite: SiteDigit | null;
  previewTower: string | null;
  hideRiddles: boolean;
}

const TAG_FONT = '600 15px -apple-system, BlinkMacSystemFont, "SF Pro Text", "Segoe UI", Roboto, system-ui, sans-serif';
const TAG_FONT_SMALL = '600 12px -apple-system, BlinkMacSystemFont, "SF Pro Text", "Segoe UI", Roboto, system-ui, sans-serif';

export class BattleRenderer {
  readonly battle: Battle;
  readonly scene: Scene;
  private canvas: HTMLCanvasElement;
  private ctx: Ctx;
  scale = 1;
  ox = 0;
  oy = 0;
  private dpr = 1;
  reducedMotion = false;

  private particles: Particle[] = [];
  private floaters: Floater[] = [];
  private rings: Ring[] = [];
  private beams: Beam[] = [];
  private shake = 0;
  private cheer = 0;
  private tagPop = new Map<number, number>();
  private missMark = new Map<number, { typed: string; t: number }>();
  private widthCache = new Map<string, number>();
  private time = 0;

  constructor(canvas: HTMLCanvasElement, battle: Battle) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d')!;
    this.battle = battle;
    this.scene = new Scene(battle.stage, battle.paths);
  }

  resize(cssW: number, cssH: number, dpr: number): void {
    this.dpr = dpr;
    this.canvas.width = Math.round(cssW * dpr);
    this.canvas.height = Math.round(cssH * dpr);
    // Fit the 960×540 field inside the view, keeping a little margin for the HUD.
    const s = Math.min(cssW / W, cssH / H);
    this.scale = s;
    this.ox = (cssW - W * s) / 2;
    this.oy = (cssH - H * s) / 2;
  }

  toScreen(p: Vec): Vec {
    return { x: this.ox + p.x * this.scale, y: this.oy + p.y * this.scale };
  }

  // ---------------------------------------------------------------- events → effects

  handle(events: BattleEvent[]): void {
    for (const ev of events) {
      switch (ev.type) {
        case 'impact': {
          if (ev.miss) {
            this.dust(ev.x, ev.y, 10, '#b9a68a', 1.3);
            this.rings.push({ x: ev.x, y: ev.y, r0: 4, r1: 26, life: 0.45, max: 0.45, color: 'rgba(120,90,60,0.55)', width: 3 });
          } else if (ev.kind === 'boulder') {
            this.dust(ev.x, ev.y, 18, '#c8b391', 2);
            this.rings.push({ x: ev.x, y: ev.y, r0: 8, r1: ev.splash, life: 0.4, max: 0.4, color: 'rgba(255,255,255,0.8)', width: 4 });
            this.addShake(5);
          } else if (ev.kind === 'bolt') {
            this.dust(ev.x, ev.y, 6, '#e8dcc0', 1);
          } else if (ev.kind === 'stone') {
            this.dust(ev.x, ev.y, 3, '#d8ccb4', 0.6);
          }
          break;
        }
        case 'fire': {
          if (ev.tower.def.projectile === 'beam') {
            const target = this.battle.projectiles[this.battle.projectiles.length - 1];
            if (target) this.beams.push({ x1: ev.tower.x, y1: ev.tower.y - 30, x2: target.tx, y2: target.ty, life: 0.35, max: 0.35 });
          }
          break;
        }
        case 'jam': {
          for (const tw of ev.towers) {
            this.dust(tw.x, tw.y - 30, 6, '#8e8e93', 0.7);
            this.floaters.push({ x: tw.x, y: tw.y - 56, text: 'Jammed!', color: '#ff9500', life: 1.6, max: 1.6, size: 17 });
          }
          break;
        }
        case 'slow':
          this.rings.push({ x: ev.x, y: ev.y, r0: 6, r1: ev.radius, life: 0.6, max: 0.6, color: 'rgba(255, 210, 60, 0.85)', width: 3 });
          break;
        case 'kill': {
          const c = ENEMY_COLORS[ev.enemy.def.look];
          for (let i = 0; i < 14; i++) {
            const a = Math.random() * Math.PI * 2;
            const sp = 40 + Math.random() * 110;
            this.particles.push({
              x: ev.enemy.x,
              y: ev.enemy.y - 6,
              vx: Math.cos(a) * sp,
              vy: Math.sin(a) * sp - 60,
              life: 0.7,
              max: 0.7,
              size: 2 + Math.random() * 3,
              color: c[i % 3],
              gravity: 260,
            });
          }
          for (let i = 0; i < 4; i++) {
            this.particles.push({
              x: ev.enemy.x + (Math.random() - 0.5) * 16,
              y: ev.enemy.y - 10,
              vx: (Math.random() - 0.5) * 30,
              vy: -40 - Math.random() * 40,
              life: 0.8,
              max: 0.8,
              size: 4,
              color: '#ffffff',
              gravity: 0,
              spark: true,
            });
          }
          this.floaters.push({ x: ev.enemy.x, y: ev.enemy.y - 24, text: `+${ev.gold}`, color: '#f5a300', life: 1, max: 1, size: 15 });
          break;
        }
        case 'leak': {
          this.floaters.push({ x: ev.enemy.x - 20, y: ev.enemy.y - 20, text: `−${ev.lives} ♥`, color: '#ff3b30', life: 1.2, max: 1.2, size: 17 });
          this.addShake(4);
          break;
        }
        case 'lock': {
          this.tagPop.set(ev.enemy.id, this.time);
          this.rings.push({ x: ev.enemy.x, y: ev.enemy.y, r0: ev.enemy.def.radius, r1: ev.enemy.def.radius + 26, life: 0.45, max: 0.45, color: ACCENT, width: 3 });
          this.cheer = 0.6;
          break;
        }
        case 'newRiddle':
          this.tagPop.set(ev.enemy.id, this.time);
          break;
        case 'spawn':
          this.tagPop.set(ev.enemy.id, this.time);
          break;
        case 'answerMiss': {
          if (ev.enemy) {
            const label = ev.kind === 'sign' ? 'Check the sign!' : ev.kind === 'short' ? 'Short!' : 'Long!';
            this.missMark.set(ev.enemy.id, { typed: fmtTyped(ev.typed), t: this.time });
            this.floaters.push({ x: ev.enemy.x, y: ev.enemy.y + 30, text: label, color: '#ff6b35', life: 1.3, max: 1.3, size: 16 });
          }
          break;
        }
        case 'clawGrab':
          this.dust(ev.enemy.x, ev.enemy.y, 12, '#a07a4a', 1.5);
          this.addShake(3);
          break;
        case 'build':
        case 'upgrade': {
          this.dust(ev.tower.x, ev.tower.y, 12, '#e6d7b8', 1.2);
          for (let i = 0; i < 6; i++) {
            this.particles.push({
              x: ev.tower.x + (Math.random() - 0.5) * 30,
              y: ev.tower.y - 20,
              vx: 0,
              vy: -30 - Math.random() * 30,
              life: 0.9,
              max: 0.9,
              size: 4,
              color: '#ffd60a',
              gravity: 0,
              spark: true,
            });
          }
          break;
        }
        case 'sell': {
          const pos = this.battle.stage.sites[ev.site]!;
          this.dust(pos.x, pos.y, 12, '#c9b48e', 1.2);
          this.floaters.push({ x: pos.x, y: pos.y - 30, text: `+${ev.refund}`, color: '#f5a300', life: 1, max: 1, size: 15 });
          break;
        }
        case 'waveClear':
          this.floaters.push({ x: W / 2, y: H / 2 - 40, text: `Wave cleared  +${ev.bonus}`, color: '#f5a300', life: 1.6, max: 1.6, size: 22 });
          break;
        default:
          break;
      }
    }
  }

  /** Grey smoke puffing from a jammed engine, with a small countdown of whole seconds. */
  private drawJam(x: number, y: number, left: number, t: number): void {
    const ctx = this.ctx;
    for (let i = 0; i < 4; i++) {
      const ph = this.reducedMotion ? 0.15 + i * 0.22 : (t * 0.8 + i / 4) % 1;
      const r = 8 + ph * 13;
      ctx.fillStyle = `rgba(88,88,96,${(0.7 * (1 - ph * 0.85)).toFixed(3)})`;
      ctx.beginPath();
      ctx.arc(x + Math.sin((t + i) * 2.1) * 6 + (i - 1.5) * 6, y - 36 - ph * 34, r, 0, Math.PI * 2);
      ctx.fill();
    }
    // Countdown pill beside the engine.
    const label = `${Math.ceil(left)}s`;
    ctx.font = '800 13px ui-rounded, system-ui, sans-serif';
    const w = ctx.measureText(label).width + 12;
    ctx.fillStyle = '#ff9500';
    roundRect(ctx, x + 22, y - 30, w, 19, 9.5);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, x + 22 + w / 2, y - 20);
  }

  private dust(x: number, y: number, n: number, color: string, power: number): void {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = (20 + Math.random() * 60) * power;
      this.particles.push({
        x,
        y,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp * 0.5 - 20,
        life: 0.5 + Math.random() * 0.3,
        max: 0.8,
        size: 3 + Math.random() * 4 * power,
        color,
        gravity: 40,
      });
    }
  }

  private addShake(a: number): void {
    if (!this.reducedMotion) this.shake = Math.max(this.shake, a);
  }

  // ---------------------------------------------------------------- frame

  draw(dt: number, ui: RenderUi): void {
    this.time += dt;
    const t = this.time;
    const ctx = this.ctx;
    const b = this.battle;

    this.cheer = Math.max(0, this.cheer - dt);
    this.shake = Math.max(0, this.shake - dt * 30);
    const sx = this.shake ? (Math.random() - 0.5) * this.shake : 0;
    const sy = this.shake ? (Math.random() - 0.5) * this.shake : 0;

    const pxW = this.canvas.width;
    const pxH = this.canvas.height;
    const s = this.scale * this.dpr;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.drawImage(this.scene.staticLayer(pxW, pxH, s, this.ox * this.dpr, this.oy * this.dpr), sx * s, sy * s);
    ctx.setTransform(s, 0, 0, s, (this.ox + sx * this.scale) * this.dpr, (this.oy + sy * this.scale) * this.dpr);

    this.scene.drawDynamicUnder(ctx, t);

    // Platforms (empty sites) and reload rings.
    for (const d of SITE_DIGITS) {
      const pos = b.stage.sites[d];
      if (!pos) continue;
      drawPlatform(ctx, pos.x, pos.y, d, b.stage.scene.ground, !ui.buildMode);
      const tw = b.towers.get(d);
      if (!tw && !ui.buildMode) {
        ctx.fillStyle = 'rgba(80,65,40,0.28)';
        ctx.font = '600 16px ui-rounded, system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('+', pos.x, pos.y);
      }
      if (tw && tw.def.kind === 'math' && tw.jam > 0) {
        // Jammed after a wrong answer: an orange ring fills back up as the jam clears.
        const k = 1 - tw.jam / Math.max(0.01, tw.jamFor);
        ctx.lineWidth = 3.5;
        ctx.lineCap = 'round';
        ctx.strokeStyle = 'rgba(255,149,0,0.9)';
        ctx.beginPath();
        ctx.ellipse(pos.x, pos.y + 4, 33, 18, 0, Math.PI * 0.5, Math.PI * 0.5 + Math.PI * 2 * Math.max(0.02, k));
        ctx.stroke();
      } else if (tw && tw.def.kind === 'math') {
        const st = towerStats(tw.def, tw.level);
        const k = tw.cooldown > 0 ? 1 - tw.cooldown / st.reload : 1;
        ctx.lineWidth = 3;
        ctx.lineCap = 'round';
        ctx.strokeStyle = k >= 1 ? 'rgba(10,132,255,0.55)' : 'rgba(255,255,255,0.75)';
        ctx.beginPath();
        ctx.ellipse(pos.x, pos.y + 4, 33, 18, 0, Math.PI * 0.5, Math.PI * 0.5 + Math.PI * 2 * k);
        ctx.stroke();
      }
    }

    // Range preview
    if (ui.selectedSite) {
      const pos = b.stage.sites[ui.selectedSite];
      const tw = b.towers.get(ui.selectedSite);
      const def = ui.previewTower ? TOWERS[ui.previewTower] : tw?.def;
      if (pos && def) {
        const range = towerStats(def, tw && !ui.previewTower ? tw.level : 0).range;
        ctx.fillStyle = 'rgba(10,132,255,0.10)';
        ctx.strokeStyle = 'rgba(10,132,255,0.7)';
        ctx.lineWidth = 2;
        ctx.setLineDash([6, 6]);
        ctx.lineDashOffset = -t * 12;
        ctx.beginPath();
        ctx.arc(pos.x, pos.y, range, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.setLineDash([]);
      }
    }

    // Depth-sorted units.
    type Drawable = { y: number; draw: () => void };
    const list: Drawable[] = [];
    for (const tw of b.towers.values()) {
      list.push({
        y: tw.y,
        draw: () => {
          drawTower(ctx, tw, t, tw.cooldown <= 0 && tw.jam <= 0);
          if (tw.jam > 0) this.drawJam(tw.x, tw.y, tw.jam, t);
        },
      });
    }
    const claw = b.claw;
    for (const e of b.enemies) {
      if (claw && e.id === claw.targetId && e.clawed) continue;
      list.push({ y: e.y, draw: () => this.drawEnemyWithMarks(e, t) });
    }
    list.sort((a, c) => a.y - c.y);
    for (const d of list) d.draw();

    this.scene.drawGate(ctx, t, this.cheer);

    // Projectiles
    for (const p of b.projectiles) {
      const k = Math.min(1, p.t / p.dur);
      if (p.kind === 'boulder') {
        const h = Math.sin(Math.PI * k) * 90;
        ctx.fillStyle = 'rgba(30,20,40,0.18)';
        ctx.beginPath();
        ctx.ellipse(p.x, p.y + 4, 7, 3, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#9c8a74';
        ctx.strokeStyle = INK;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(p.x, p.y - h, 7, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = 'rgba(255,255,255,0.4)';
        ctx.beginPath();
        ctx.arc(p.x - 2, p.y - h - 2, 2.2, 0, Math.PI * 2);
        ctx.fill();
      } else if (p.kind === 'bolt') {
        const a = Math.atan2(p.ty - p.fromY, p.tx - p.fromX);
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(a);
        ctx.strokeStyle = '#7a4f28';
        ctx.lineWidth = 2.2;
        ctx.beginPath();
        ctx.moveTo(-12, 0);
        ctx.lineTo(6, 0);
        ctx.stroke();
        ctx.fillStyle = '#5b6770';
        ctx.beginPath();
        ctx.moveTo(10, 0);
        ctx.lineTo(4, -3);
        ctx.lineTo(4, 3);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      } else if (p.kind === 'stone') {
        const h = Math.sin(Math.PI * k) * 14;
        ctx.fillStyle = '#7d7d7d';
        ctx.beginPath();
        ctx.arc(p.x, p.y - h, 2.6, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // Beams
    for (const bm of this.beams) {
      const a = bm.life / bm.max;
      ctx.save();
      ctx.globalAlpha = a;
      ctx.strokeStyle = 'rgba(255, 220, 90, 0.5)';
      ctx.lineWidth = 12;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(bm.x1, bm.y1);
      ctx.lineTo(bm.x2, bm.y2);
      ctx.stroke();
      ctx.strokeStyle = '#fffbe0';
      ctx.lineWidth = 3;
      ctx.stroke();
      ctx.restore();
    }

    if (claw) this.drawClaw(claw.x, claw.y, claw.t, claw.grabbed);

    this.updateEffects(dt);
    this.drawEffects();

    if (!ui.hideRiddles) this.drawTags(t);
    if (ui.buildMode) this.drawBuildOverlay(ui, t);
  }

  private drawEnemyWithMarks(e: Enemy, t: number): void {
    const ctx = this.ctx;
    drawEnemy(ctx, e, t, e.x, e.y);
    const r = e.def.radius;
    if (e.locked) {
      ctx.save();
      ctx.translate(e.x, e.y);
      ctx.rotate(t * 2);
      ctx.strokeStyle = ACCENT;
      ctx.lineWidth = 2.5;
      ctx.setLineDash([7, 6]);
      ctx.beginPath();
      ctx.arc(0, 0, r + 9, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
      for (let i = 0; i < 4; i++) {
        const a = (i * Math.PI) / 2;
        ctx.beginPath();
        ctx.moveTo(Math.cos(a) * (r + 5), Math.sin(a) * (r + 5));
        ctx.lineTo(Math.cos(a) * (r + 14), Math.sin(a) * (r + 14));
        ctx.stroke();
      }
      ctx.restore();
    }
    const showBar = e.hp < e.maxHp;
    if (showBar) {
      const w = Math.max(24, r * 1.8);
      const y = e.y + r + 8;
      ctx.fillStyle = 'rgba(30,20,40,0.35)';
      roundRect(ctx, e.x - w / 2, y, w, 4, 2);
      ctx.fill();
      ctx.fillStyle = e.hp / e.maxHp > 0.35 ? '#34c759' : '#ff9500';
      roundRect(ctx, e.x - w / 2, y, (w * Math.max(0, e.hp)) / e.maxHp, 4, 2);
      ctx.fill();
    }
  }

  private drawClaw(x: number, y: number, t: number, grabbed: boolean): void {
    const ctx = this.ctx;
    const descend = Math.min(1, t / 0.5);
    const ease = 1 - (1 - descend) ** 3;
    let cy = -60 + (y - 20 + 60) * ease;
    if (grabbed) cy = y - 20 - ((t - 0.5) / 0.6) * (y + 80);
    // Beam and rope from off-screen
    ctx.strokeStyle = '#6b4a2b';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(x, -80);
    ctx.lineTo(x, cy - 10);
    ctx.stroke();
    ctx.fillStyle = '#5b6770';
    ctx.strokeStyle = INK;
    ctx.lineWidth = 1.6;
    roundRect(ctx, x - 9, cy - 14, 18, 8, 3);
    ctx.fill();
    ctx.stroke();
    const open = grabbed ? 0.25 : 0.9 - descend * 0.3;
    for (const s of [-1, 1]) {
      ctx.save();
      ctx.translate(x + s * 6, cy - 7);
      ctx.rotate(s * open);
      ctx.strokeStyle = '#4a5560';
      ctx.lineWidth = 4;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.quadraticCurveTo(s * 8, 12, s * -1, 22);
      ctx.stroke();
      ctx.restore();
    }
    if (grabbed) {
      const e = this.battle.enemies.find((en) => en.id === this.battle.claw?.targetId);
      if (e && e.clawed) {
        ctx.save();
        ctx.translate(x, cy + 22);
        ctx.rotate(Math.sin(t * 20) * 0.2);
        drawEnemy(ctx, e, t, 0, 0);
        ctx.restore();
      }
    }
  }

  private updateEffects(dt: number): void {
    for (const p of this.particles) {
      p.life -= dt;
      p.vy += p.gravity * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vx *= 0.96;
    }
    this.particles = this.particles.filter((p) => p.life > 0);
    for (const f of this.floaters) {
      f.life -= dt;
      f.y -= 26 * dt;
    }
    this.floaters = this.floaters.filter((f) => f.life > 0);
    for (const r of this.rings) r.life -= dt;
    this.rings = this.rings.filter((r) => r.life > 0);
    for (const bm of this.beams) bm.life -= dt;
    this.beams = this.beams.filter((bm) => bm.life > 0);
  }

  private drawEffects(): void {
    const ctx = this.ctx;
    for (const r of this.rings) {
      const k = 1 - r.life / r.max;
      ctx.globalAlpha = 1 - k;
      ctx.strokeStyle = r.color;
      ctx.lineWidth = r.width;
      ctx.beginPath();
      ctx.arc(r.x, r.y, r.r0 + (r.r1 - r.r0) * (1 - (1 - k) ** 2), 0, Math.PI * 2);
      ctx.stroke();
    }
    for (const p of this.particles) {
      ctx.globalAlpha = Math.max(0, p.life / p.max);
      ctx.fillStyle = p.color;
      if (p.spark) sparkle(ctx, p.x, p.y, p.size * 0.6);
      else {
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * (0.5 + 0.5 * (p.life / p.max)), 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.globalAlpha = 1;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (const f of this.floaters) {
      const k = f.life / f.max;
      ctx.globalAlpha = Math.min(1, k * 2.5);
      const pop = k > 0.85 ? 1 + (k - 0.85) * 2 : 1;
      ctx.font = `800 ${Math.round(f.size * pop)}px ui-rounded, -apple-system, system-ui, sans-serif`;
      ctx.lineWidth = 4;
      ctx.strokeStyle = 'rgba(255,255,255,0.9)';
      ctx.strokeText(f.text, f.x, f.y);
      ctx.fillStyle = f.color;
      ctx.fillText(f.text, f.x, f.y);
    }
    ctx.globalAlpha = 1;
  }

  // ---------------------------------------------------------------- riddle tags

  private measure(text: string, font: string): number {
    const key = font + text;
    let w = this.widthCache.get(key);
    if (w === undefined) {
      this.ctx.font = font;
      w = this.ctx.measureText(text).width;
      this.widthCache.set(key, w);
    }
    return w;
  }

  private drawTags(t: number): void {
    const ctx = this.ctx;
    const placed: { x: number; y: number; w: number; h: number }[] = [];
    // On small screens, grow the tags so the maths never drops below ~14 CSS pixels.
    const z = Math.min(1.5, Math.max(1, 14 / (15 * this.scale)));
    const enemies = this.battle.enemies
      .filter((e) => e.alive && e.riddle && !(e.clawed && this.battle.claw))
      .sort((a, b) => this.battle.remaining(a) - this.battle.remaining(b));

    for (const e of enemies) {
      const r = e.riddle!;
      const miss = this.missMark.get(e.id);
      const missAge = miss ? t - miss.t : 99;
      if (miss && missAge > 1.1) this.missMark.delete(e.id);

      // w and h are in tag units; zw and zh are the scaled size on the field.
      let w: number;
      let h: number;
      if (e.locked) {
        w = 26;
        h = 26;
      } else {
        const lw = Math.max(...r.lines.map((l) => this.measure(l, TAG_FONT)));
        w = lw + 20 + (r.ask ? 22 : 0);
        h = r.lines.length === 2 ? 42 : 26;
      }
      const zw = w * z;
      const zh = h * z;
      // Keep the tag on the field even when its Fogling is just stepping out of the portal.
      const cx = Math.max(zw / 2 + 4, Math.min(W - zw / 2 - 4, e.x));
      let top = e.y - e.def.radius - 14 - zh;
      const rect = () => ({ x: cx - zw / 2, y: top, w: zw, h: zh });
      // Nudge upward (then downward) until the tag no longer overlaps an earlier one.
      const overlaps = (a: { x: number; y: number; w: number; h: number }) =>
        placed.some((p) => a.x < p.x + p.w + 3 && a.x + a.w + 3 > p.x && a.y < p.y + p.h + 3 && a.y + a.h + 3 > p.y);
      let tries = 0;
      const baseTop = top;
      while (overlaps(rect()) && tries < 6) {
        tries++;
        top = tries % 2 ? baseTop - Math.ceil(tries / 2) * (zh + 4) : baseTop + zh + e.def.radius * 2 + 22 + Math.floor(tries / 2) * (zh + 4);
      }
      top = Math.max(4, Math.min(H - zh - 4, top));
      const box = rect();
      placed.push(box);

      const popAge = t - (this.tagPop.get(e.id) ?? -9);
      const pop = popAge < 0.22 ? 0.7 + 0.3 * Math.sin((popAge / 0.22) * Math.PI * 0.5) : 1;
      const shakeX = missAge < 0.4 ? Math.sin(missAge * 60) * 4 * (1 - missAge / 0.4) : 0;

      ctx.save();
      ctx.translate(cx + shakeX, top + zh / 2);
      ctx.scale(pop * z, pop * z);
      // Where the Fogling is, in tag units.
      const ex = (e.x - cx - shakeX) / z;
      const ey = (e.y - (top + zh / 2)) / z;

      if (tries > 0) {
        // Leader line back to its Fogling.
        ctx.strokeStyle = 'rgba(43,35,64,0.35)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(0, ey > 0 ? h / 2 : -h / 2);
        ctx.lineTo(ex, ey * 0.8);
        ctx.stroke();
      }

      ctx.shadowColor = 'rgba(30, 20, 50, 0.22)';
      ctx.shadowBlur = 8;
      ctx.shadowOffsetY = 2;
      if (e.locked) {
        ctx.fillStyle = ACCENT;
        ctx.beginPath();
        ctx.arc(0, 0, 13, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowColor = 'transparent';
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 2.6;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.beginPath();
        ctx.moveTo(-5, 0);
        ctx.lineTo(-1.5, 4);
        ctx.lineTo(5.5, -4);
        ctx.stroke();
        ctx.restore();
        continue;
      }
      const missing = missAge < 1.1;
      ctx.fillStyle = 'rgba(255,255,255,0.97)';
      roundRect(ctx, -w / 2, -h / 2, w, h, 10);
      ctx.fill();
      ctx.shadowColor = 'transparent';
      if (missing) {
        ctx.strokeStyle = 'rgba(255, 59, 48, 0.9)';
        ctx.lineWidth = 2;
        ctx.stroke();
      }
      // Tail pointing at the Fogling
      ctx.fillStyle = 'rgba(255,255,255,0.97)';
      if (tries === 0) {
        const tx = Math.max(-w / 2 + 11, Math.min(w / 2 - 11, ex));
        ctx.beginPath();
        ctx.moveTo(tx - 5, h / 2 - 1);
        ctx.lineTo(tx, h / 2 + 5);
        ctx.lineTo(tx + 5, h / 2 - 1);
        ctx.closePath();
        ctx.fill();
      }
      let textX = 0;
      if (r.ask) {
        ctx.fillStyle = ACCENT;
        ctx.beginPath();
        ctx.arc(-w / 2 + 15, 0, 8, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#fff';
        ctx.font = '700 italic 12px Georgia, "Times New Roman", serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(r.ask, -w / 2 + 15, 0.5);
        textX = 11;
      }
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      if (r.lines.length === 2) {
        ctx.font = TAG_FONT_SMALL;
        ctx.fillStyle = '#6e6e73';
        ctx.fillText(r.lines[0], textX, -9);
        ctx.font = TAG_FONT;
        ctx.fillStyle = '#1d1d1f';
        ctx.fillText(r.lines[1], textX, 9);
      } else {
        ctx.font = TAG_FONT;
        ctx.fillStyle = '#1d1d1f';
        ctx.fillText(r.lines[0], textX, 1);
      }
      if (missing && miss) {
        ctx.font = '700 12px -apple-system, system-ui, sans-serif';
        const label = `${miss.typed} ✗`;
        const lw = this.measure(label, '700 12px -apple-system, system-ui, sans-serif') + 12;
        ctx.fillStyle = '#ff3b30';
        roundRect(ctx, w / 2 - lw + 4, -h / 2 - 12, lw, 18, 9);
        ctx.fill();
        ctx.fillStyle = '#fff';
        ctx.fillText(label, w / 2 - lw / 2 + 4, -h / 2 - 3);
      }
      ctx.restore();
    }
  }

  // ---------------------------------------------------------------- build overlay

  private drawBuildOverlay(ui: RenderUi, t: number): void {
    const ctx = this.ctx;
    const b = this.battle;
    for (const d of SITE_DIGITS) {
      const pos = b.stage.sites[d];
      if (!pos) continue;
      const selected = ui.selectedSite === d;
      const occupied = b.towers.has(d);
      const size = selected ? 34 : 28;
      const y = occupied ? pos.y + 22 : pos.y - 4;
      const bounce = selected && !this.reducedMotion ? Math.sin(t * 6) * 1.5 : 0;
      ctx.save();
      ctx.shadowColor = 'rgba(20, 10, 40, 0.35)';
      ctx.shadowBlur = 10;
      ctx.shadowOffsetY = 3;
      ctx.fillStyle = selected ? ACCENT : 'rgba(255,255,255,0.96)';
      roundRect(ctx, pos.x - size / 2, y - size / 2 + bounce, size, size, 8);
      ctx.fill();
      ctx.shadowColor = 'transparent';
      ctx.fillStyle = selected ? '#ffffff' : '#1d1d1f';
      ctx.font = `700 ${selected ? 19 : 16}px -apple-system, BlinkMacSystemFont, system-ui, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(String(d), pos.x, y + 1 + bounce);
      ctx.restore();
    }
  }
}

function fmtTyped(v: number): string {
  const r = Math.round(v * 100) / 100;
  return (r < 0 ? '−' : '') + String(Math.abs(r));
}
