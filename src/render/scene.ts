// Battlefield scenery: ground, sea, roads, props, the Fogling portal and the city gate.
// The static parts are painted once into an offscreen canvas per stage and size.

import { Rng } from '../core/rng';
import type { SceneDef, StageDef, Vec } from '../content/types';
import { Path, dist } from '../sim/path';
import { INK, roundRect, shadow, type Ctx } from './art';

export const W = 960;
export const H = 540;

interface Palette {
  base: string;
  light: string;
  dark: string;
  road: string;
  roadEdge: string;
  tuft: string;
}

export const PALETTES: Record<SceneDef['ground'], Palette> = {
  meadow: { base: '#bfe08f', light: '#d3eda3', dark: '#a7cf7c', road: '#efd9a6', roadEdge: '#c9a266', tuft: '#8fbd62' },
  sand: { base: '#f0dcaa', light: '#f8eac5', dark: '#e3c88d', road: '#fbf0d4', roadEdge: '#c8a46c', tuft: '#c9ad6e' },
  stone: { base: '#ddd6c6', light: '#ebe6da', dark: '#cbc2ae', road: '#f1e4c6', roadEdge: '#b39a6f', tuft: '#b5ab96' },
  dusk: { base: '#a8c488', light: '#bbd49a', dark: '#90ae70', road: '#e8d1a0', roadEdge: '#a98552', tuft: '#7f9d5f' },
};

type PropKind = 'cypress' | 'olive' | 'rock' | 'column' | 'amphora' | 'house' | 'flowers';

interface Prop {
  kind: PropKind;
  x: number;
  y: number;
  s: number;
  v: number;
}

export function seaRect(sea: SceneDef['sea']): { x: number; y: number; w: number; h: number } | null {
  switch (sea) {
    case 'bottom':
      return { x: -400, y: 482, w: W + 800, h: 400 };
    case 'top':
      return { x: -400, y: -400, w: W + 800, h: 460 };
    case 'left':
      return { x: -400, y: -400, w: 452, h: H + 800 };
    case 'right':
      return { x: 892, y: -400, w: 400, h: H + 800 };
    default:
      return null;
  }
}

/** Where the road visibly enters and leaves the screen. */
export function roadEnds(path: Path): { entry: Vec & { angle: number }; exit: Vec & { angle: number } } {
  const inside = (p: Vec, m: number) => p.x >= m && p.x <= W - m && p.y >= m && p.y <= H - m;
  let d0 = 0;
  while (d0 < path.length && !inside(path.at(d0), 22)) d0 += 2;
  let d1 = path.length;
  while (d1 > 0 && !inside(path.at(d1), 30)) d1 -= 2;
  const a = path.at(d0);
  const b = path.at(d1);
  return { entry: { x: a.x, y: a.y, angle: a.angle }, exit: { x: b.x, y: b.y, angle: b.angle } };
}

export class Scene {
  readonly stage: StageDef;
  readonly paths: Path[];
  readonly pal: Palette;
  private props: Prop[] = [];
  private cache: HTMLCanvasElement | null = null;
  private cacheKey = '';

  constructor(stage: StageDef, paths: Path[]) {
    this.stage = stage;
    this.paths = paths;
    this.pal = PALETTES[stage.scene.ground];
    this.placeProps();
  }

  private placeProps(): void {
    const rng = new Rng(this.stage.scene.seed * 7919);
    const sea = seaRect(this.stage.scene.sea);
    const sites = Object.values(this.stage.sites) as Vec[];
    const kinds: PropKind[] =
      this.stage.scene.ground === 'stone'
        ? ['column', 'amphora', 'house', 'rock', 'cypress']
        : this.stage.scene.ground === 'sand'
          ? ['olive', 'rock', 'amphora', 'house', 'cypress']
          : ['cypress', 'olive', 'rock', 'flowers', 'column'];
    let tries = 0;
    while (this.props.length < this.stage.scene.props && tries++ < 2000) {
      const p = { x: rng.range(10, W - 10), y: rng.range(40, H - 10) };
      if (sea && p.x > sea.x - 24 && p.x < sea.x + sea.w + 24 && p.y > sea.y - 30 && p.y < sea.y + sea.h + 10) continue;
      if (this.paths.some((path) => path.distanceTo(p) < 48)) continue;
      if (sites.some((s) => dist(s, p) < 58)) continue;
      if (this.props.some((o) => dist(o, p) < 34)) continue;
      // Keep the area behind the answer field and HUD pills clear.
      if (p.y > 470 && p.x > 330 && p.x < 630) continue;
      if (p.y < 70 && (p.x < 300 || p.x > 700)) continue;
      this.props.push({ kind: rng.pick(kinds), x: p.x, y: p.y, s: rng.range(0.8, 1.15), v: rng.next() });
    }
    // Flowers are ground cover; draw them first.
    this.props.sort((a, b) => (a.kind === 'flowers' ? -1 : 0) - (b.kind === 'flowers' ? -1 : 0) || a.y - b.y);
  }

  /** Paints (or reuses) the static layer for the current canvas transform. */
  staticLayer(pxW: number, pxH: number, scale: number, ox: number, oy: number): HTMLCanvasElement {
    const key = `${pxW}x${pxH}@${scale.toFixed(4)}`;
    if (this.cache && this.cacheKey === key) return this.cache;
    const c = document.createElement('canvas');
    c.width = pxW;
    c.height = pxH;
    const ctx = c.getContext('2d')!;
    ctx.setTransform(scale, 0, 0, scale, ox, oy);
    this.paintStatic(ctx, ox / scale, oy / scale, pxW / scale, pxH / scale);
    this.cache = c;
    this.cacheKey = key;
    return c;
  }

  private paintStatic(ctx: Ctx, ox: number, oy: number, vw: number, vh: number): void {
    const pal = this.pal;
    const x0 = -ox;
    const y0 = -oy;
    const rng = new Rng(this.stage.scene.seed);

    // Ground
    const g = ctx.createLinearGradient(0, y0, 0, y0 + vh);
    g.addColorStop(0, pal.light);
    g.addColorStop(1, pal.base);
    ctx.fillStyle = g;
    ctx.fillRect(x0, y0, vw, vh);
    // Soft, rounded patches of lighter and darker ground.
    for (let i = 0; i < 46; i++) {
      ctx.fillStyle = rng.chance(0.5) ? pal.light : pal.dark;
      ctx.globalAlpha = rng.range(0.16, 0.34);
      const rx = rng.range(40, 120);
      ctx.beginPath();
      ctx.ellipse(rng.range(x0, x0 + vw), rng.range(y0, y0 + vh), rx, rx * rng.range(0.55, 0.8), rng.range(-0.3, 0.3), 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    if (this.stage.scene.ground === 'stone') {
      ctx.strokeStyle = 'rgba(120, 105, 80, 0.12)';
      ctx.lineWidth = 1;
      for (let y = Math.floor(y0 / 40) * 40; y < y0 + vh; y += 40) {
        ctx.beginPath();
        ctx.moveTo(x0, y);
        ctx.lineTo(x0 + vw, y);
        ctx.stroke();
        const off = (Math.round(y / 40) % 2) * 32;
        for (let x = Math.floor(x0 / 64) * 64 + off; x < x0 + vw; x += 64) {
          ctx.beginPath();
          ctx.moveTo(x, y);
          ctx.lineTo(x, y + 40);
          ctx.stroke();
        }
      }
    } else {
      ctx.strokeStyle = pal.tuft;
      ctx.lineWidth = 1.4;
      ctx.lineCap = 'round';
      for (let i = 0; i < 160; i++) {
        const x = rng.range(x0, x0 + vw);
        const y = rng.range(y0, y0 + vh);
        ctx.globalAlpha = rng.range(0.4, 0.8);
        ctx.beginPath();
        ctx.moveTo(x - 3, y - 4);
        ctx.lineTo(x, y);
        ctx.lineTo(x + 3, y - 5);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
    }

    // Sea
    const sea = seaRect(this.stage.scene.sea);
    if (sea) {
      const horizontal = this.stage.scene.sea === 'bottom' || this.stage.scene.sea === 'top';
      ctx.fillStyle = '#f5e4b5';
      ctx.fillRect(sea.x - (horizontal ? 0 : 12), sea.y - (horizontal ? 12 : 0), sea.w + (horizontal ? 0 : 24), sea.h + (horizontal ? 24 : 0));
      const sg = horizontal
        ? ctx.createLinearGradient(0, sea.y, 0, sea.y + (this.stage.scene.sea === 'bottom' ? 120 : -120))
        : ctx.createLinearGradient(sea.x, 0, sea.x + 120, 0);
      sg.addColorStop(0, '#8fdcf6');
      sg.addColorStop(1, '#3ea2e2');
      ctx.fillStyle = sg;
      ctx.fillRect(sea.x, sea.y, sea.w, sea.h);
    }

    // Roads: shadow, edge, surface, then a soft dashed centre line.
    const stroke = (w: number, color: string, dy = 0, dash: number[] = []) => {
      ctx.strokeStyle = color;
      ctx.lineWidth = w;
      ctx.lineJoin = 'round';
      ctx.lineCap = 'round';
      ctx.setLineDash(dash);
      for (const p of this.paths) {
        ctx.beginPath();
        p.points.forEach((pt, i) => (i ? ctx.lineTo(pt.x, pt.y + dy) : ctx.moveTo(pt.x, pt.y + dy)));
        ctx.stroke();
      }
      ctx.setLineDash([]);
    };
    stroke(50, 'rgba(60, 40, 20, 0.10)', 4);
    stroke(46, pal.roadEdge);
    stroke(38, pal.road);
    stroke(3, 'rgba(255,255,255,0.55)', 0, [2, 16]);
    // Pebbles on the road
    for (const p of this.paths) {
      for (let d = 0; d < p.length; d += 23) {
        const q = p.at(d + rng.range(-6, 6));
        ctx.fillStyle = 'rgba(150, 115, 70, 0.25)';
        ctx.beginPath();
        ctx.arc(q.x + rng.range(-14, 14), q.y + rng.range(-12, 12), rng.range(1, 2.4), 0, Math.PI * 2);
        ctx.fill();
      }
    }

    for (const pr of this.props) drawProp(ctx, pr);

    if (this.stage.scene.ground === 'dusk') {
      const dg = ctx.createLinearGradient(0, y0, 0, y0 + vh);
      dg.addColorStop(0, 'rgba(255, 140, 90, 0.18)');
      dg.addColorStop(1, 'rgba(90, 60, 160, 0.20)');
      ctx.fillStyle = dg;
      ctx.fillRect(x0, y0, vw, vh);
    }

    // Soft vignette
    const vg = ctx.createRadialGradient(W / 2, H / 2, H * 0.45, W / 2, H / 2, W * 0.75);
    vg.addColorStop(0, 'rgba(0,0,0,0)');
    vg.addColorStop(1, 'rgba(40,30,60,0.16)');
    ctx.fillStyle = vg;
    ctx.fillRect(x0, y0, vw, vh);
  }

  /** Animated scenery drawn every frame under the units. */
  drawDynamicUnder(ctx: Ctx, t: number): void {
    const sea = seaRect(this.stage.scene.sea);
    if (sea) {
      ctx.strokeStyle = 'rgba(255,255,255,0.7)';
      ctx.lineWidth = 2;
      ctx.lineCap = 'round';
      const side = this.stage.scene.sea;
      for (let i = 0; i < 9; i++) {
        const k = (t * 0.05 + i / 9) % 1;
        if (side === 'bottom' || side === 'top') {
          const x = -60 + k * (W + 120);
          const y = side === 'bottom' ? sea.y + 22 + (i % 3) * 14 : sea.y + sea.h - 20 - (i % 3) * 14;
          ctx.beginPath();
          ctx.arc(x, y, 8, Math.PI * 1.15, Math.PI * 1.85);
          ctx.stroke();
        } else {
          const y = -40 + k * (H + 80);
          const x = side === 'right' ? sea.x + 18 + (i % 3) * 14 : sea.x + sea.w - 18 - (i % 3) * 14;
          ctx.beginPath();
          ctx.arc(x, y, 8, Math.PI * 1.15, Math.PI * 1.85);
          ctx.stroke();
        }
      }
      // Foam along the shore
      ctx.strokeStyle = 'rgba(255,255,255,0.85)';
      ctx.lineWidth = 3;
      ctx.beginPath();
      if (side === 'bottom' || side === 'top') {
        const y = side === 'bottom' ? sea.y + 2 : sea.y + sea.h - 2;
        for (let x = -40; x <= W + 40; x += 8) {
          const yy = y + Math.sin(x * 0.05 + t * 1.5) * 2.5;
          if (x === -40) ctx.moveTo(x, yy);
          else ctx.lineTo(x, yy);
        }
      } else {
        const x = side === 'right' ? sea.x + 2 : sea.x + sea.w - 2;
        for (let y = -40; y <= H + 40; y += 8) {
          const xx = x + Math.sin(y * 0.05 + t * 1.5) * 2.5;
          if (y === -40) ctx.moveTo(xx, y);
          else ctx.lineTo(xx, y);
        }
      }
      ctx.stroke();
    }

    for (const p of this.paths) drawPortal(ctx, roadEnds(p).entry, t);
  }

  /** Gate and Archimedes, drawn above the road but under riddle tags. */
  drawGate(ctx: Ctx, t: number, cheer: number): void {
    const exits: Vec[] = [];
    for (const p of this.paths) {
      const e = roadEnds(p).exit;
      if (!exits.some((x) => dist(x, e) < 10)) exits.push(e);
    }
    // Set the gate a little inside the exit so it never touches the screen edge.
    for (const e of exits) drawGateAt(ctx, e.x - 14, e.y, t, cheer);
  }
}

function drawPortal(ctx: Ctx, p: Vec, t: number): void {
  ctx.save();
  ctx.translate(p.x, p.y);
  const g = ctx.createRadialGradient(0, 0, 2, 0, 0, 30);
  g.addColorStop(0, 'rgba(40, 20, 70, 0.95)');
  g.addColorStop(0.7, 'rgba(110, 70, 200, 0.55)');
  g.addColorStop(1, 'rgba(110, 70, 200, 0)');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.ellipse(0, 0, 30, 24, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = 'rgba(200, 180, 255, 0.85)';
  ctx.lineWidth = 2;
  for (let i = 0; i < 3; i++) {
    ctx.beginPath();
    const a = t * (1.5 + i * 0.4) + i * 2;
    ctx.ellipse(0, 0, 10 + i * 6, 8 + i * 5, 0, a, a + 2.2);
    ctx.stroke();
  }
  ctx.restore();
}

function drawGateAt(ctx: Ctx, x: number, y: number, t: number, cheer: number): void {
  // Two stone towers either side of the road with a lintel, Syracuse banners and Archimedes on top.
  const stone = '#efe7d6';
  const side = '#cdbfa5';
  shadow(ctx, x + 6, y + 42, 34, 9, 0.18);
  shadow(ctx, x + 6, y - 22, 30, 8, 0.12);
  for (const dy of [-46, 30]) {
    ctx.fillStyle = side;
    roundRect(ctx, x - 14, y + dy - 6, 32, 34, 4);
    ctx.fill();
    ctx.fillStyle = stone;
    roundRect(ctx, x - 14, y + dy - 12, 32, 30, 4);
    ctx.fill();
    ctx.strokeStyle = 'rgba(90,70,40,0.4)';
    ctx.lineWidth = 1.2;
    ctx.stroke();
    // Crenellations
    ctx.fillStyle = stone;
    for (let i = 0; i < 3; i++) {
      roundRect(ctx, x - 13 + i * 11, y + dy - 18, 8, 8, 2);
      ctx.fill();
      ctx.stroke();
    }
    // Banner
    ctx.fillStyle = '#2d6cdf';
    ctx.beginPath();
    ctx.moveTo(x - 2, y + dy - 4);
    ctx.lineTo(x + 8, y + dy - 4);
    ctx.lineTo(x + 8, y + dy + 12 + Math.sin(t * 3 + dy) * 1.5);
    ctx.lineTo(x + 3, y + dy + 8);
    ctx.lineTo(x - 2, y + dy + 12 + Math.sin(t * 3 + dy) * 1.5);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x - 1, y + dy);
    ctx.lineTo(x + 7, y + dy);
    ctx.stroke();
  }
  // Archimedes on the upper tower.
  drawArchimedes(ctx, x + 2, y - 60, t, cheer);
}

export function drawArchimedes(ctx: Ctx, x: number, y: number, t: number, cheer: number): void {
  const hop = cheer > 0 ? Math.abs(Math.sin(cheer * 14)) * 4 : Math.sin(t * 2) * 0.6;
  const yy = y - hop;
  shadow(ctx, x, y + 9, 7, 2.5, 0.2);
  // Toga
  ctx.fillStyle = '#ffffff';
  ctx.strokeStyle = INK;
  ctx.lineWidth = 1.3;
  ctx.beginPath();
  ctx.moveTo(x - 6, yy + 9);
  ctx.quadraticCurveTo(x - 7, yy - 2, x, yy - 4);
  ctx.quadraticCurveTo(x + 7, yy - 2, x + 6, yy + 9);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.strokeStyle = '#2d6cdf';
  ctx.beginPath();
  ctx.moveTo(x - 5, yy);
  ctx.lineTo(x + 4, yy + 7);
  ctx.stroke();
  // Head, beard
  ctx.fillStyle = '#f1c9a0';
  ctx.strokeStyle = INK;
  ctx.beginPath();
  ctx.arc(x, yy - 9, 5, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#e8e8e8';
  ctx.beginPath();
  ctx.moveTo(x - 4.5, yy - 8);
  ctx.quadraticCurveTo(x, yy + 1, x + 4.5, yy - 8);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = INK;
  ctx.beginPath();
  ctx.arc(x - 1.8, yy - 10, 0.8, 0, Math.PI * 2);
  ctx.arc(x + 1.8, yy - 10, 0.8, 0, Math.PI * 2);
  ctx.fill();
  // Compass raised when cheering
  ctx.strokeStyle = '#6b4810';
  ctx.lineWidth = 1.4;
  const arm = cheer > 0 ? -1.2 : -0.4;
  ctx.beginPath();
  ctx.moveTo(x + 5, yy - 1);
  ctx.lineTo(x + 5 + Math.cos(arm) * 8, yy - 1 + Math.sin(arm) * 8);
  ctx.stroke();
}

function drawProp(ctx: Ctx, p: Prop): void {
  const { x, y, s } = p;
  switch (p.kind) {
    case 'cypress': {
      shadow(ctx, x + 4, y + 2, 9 * s, 3.5 * s);
      ctx.fillStyle = '#6b4a2b';
      ctx.fillRect(x - 1.5 * s, y - 4 * s, 3 * s, 6 * s);
      const g = ctx.createLinearGradient(x - 8 * s, 0, x + 8 * s, 0);
      g.addColorStop(0, '#4f8a45');
      g.addColorStop(1, '#2f5c2e');
      ctx.fillStyle = g;
      ctx.strokeStyle = 'rgba(30,50,25,0.6)';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(x, y - 46 * s);
      ctx.bezierCurveTo(x + 11 * s, y - 30 * s, x + 10 * s, y - 6 * s, x, y - 2 * s);
      ctx.bezierCurveTo(x - 10 * s, y - 6 * s, x - 11 * s, y - 30 * s, x, y - 46 * s);
      ctx.fill();
      ctx.stroke();
      break;
    }
    case 'olive': {
      shadow(ctx, x + 4, y + 2, 16 * s, 5 * s);
      ctx.strokeStyle = '#7a5532';
      ctx.lineWidth = 3 * s;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.quadraticCurveTo(x - 3 * s, y - 8 * s, x + 1 * s, y - 14 * s);
      ctx.stroke();
      const blobs: [number, number, number, string][] = [
        [-8, -18, 9, '#93ad73'],
        [7, -19, 10, '#86a266'],
        [0, -25, 10, '#a3bb84'],
      ];
      for (const [dx, dy, r, c] of blobs) {
        ctx.fillStyle = c;
        ctx.beginPath();
        ctx.arc(x + dx * s, y + dy * s, r * s, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.fillStyle = 'rgba(255,255,255,0.25)';
      ctx.beginPath();
      ctx.arc(x - 3 * s, y - 28 * s, 4 * s, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
    case 'rock': {
      shadow(ctx, x + 3, y + 3, 12 * s, 4 * s);
      ctx.fillStyle = '#bdb6aa';
      ctx.strokeStyle = 'rgba(70,60,50,0.45)';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(x - 12 * s, y + 2 * s);
      ctx.quadraticCurveTo(x - 13 * s, y - 9 * s, x - 3 * s, y - 11 * s);
      ctx.quadraticCurveTo(x + 9 * s, y - 13 * s, x + 12 * s, y - 2 * s);
      ctx.quadraticCurveTo(x + 12 * s, y + 4 * s, x - 12 * s, y + 2 * s);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,0.35)';
      ctx.beginPath();
      ctx.ellipse(x - 3 * s, y - 7 * s, 5 * s, 2.5 * s, -0.3, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
    case 'column': {
      shadow(ctx, x + 4, y + 2, 11 * s, 4 * s);
      const h = (p.v > 0.5 ? 34 : 22) * s;
      ctx.fillStyle = '#f6f2ea';
      ctx.strokeStyle = 'rgba(90,80,60,0.45)';
      ctx.lineWidth = 1.2;
      roundRect(ctx, x - 7 * s, y - h, 14 * s, h, 2);
      ctx.fill();
      ctx.stroke();
      ctx.strokeStyle = 'rgba(120,110,90,0.3)';
      for (const dx of [-3, 0, 3]) {
        ctx.beginPath();
        ctx.moveTo(x + dx * s, y - h + 3);
        ctx.lineTo(x + dx * s, y - 2);
        ctx.stroke();
      }
      ctx.fillStyle = '#ece5d6';
      ctx.strokeStyle = 'rgba(90,80,60,0.45)';
      roundRect(ctx, x - 10 * s, y - 4 * s, 20 * s, 5 * s, 1.5);
      ctx.fill();
      ctx.stroke();
      if (p.v > 0.5) {
        roundRect(ctx, x - 10 * s, y - h - 3 * s, 20 * s, 5 * s, 1.5);
        ctx.fill();
        ctx.stroke();
      }
      break;
    }
    case 'amphora': {
      shadow(ctx, x + 3, y + 2, 7 * s, 2.5 * s);
      ctx.fillStyle = '#cf6d3e';
      ctx.strokeStyle = 'rgba(80,30,10,0.6)';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(x - 2.5 * s, y - 16 * s);
      ctx.quadraticCurveTo(x - 9 * s, y - 10 * s, x - 2 * s, y);
      ctx.lineTo(x + 2 * s, y);
      ctx.quadraticCurveTo(x + 9 * s, y - 10 * s, x + 2.5 * s, y - 16 * s);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.strokeStyle = '#2b2340';
      ctx.beginPath();
      ctx.moveTo(x - 5 * s, y - 9 * s);
      ctx.lineTo(x + 5 * s, y - 9 * s);
      ctx.stroke();
      break;
    }
    case 'house': {
      shadow(ctx, x + 5, y + 2, 20 * s, 5 * s);
      ctx.fillStyle = '#fbf8f1';
      ctx.strokeStyle = 'rgba(90,80,60,0.5)';
      ctx.lineWidth = 1.2;
      roundRect(ctx, x - 16 * s, y - 20 * s, 32 * s, 20 * s, 2);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#d4693b';
      ctx.beginPath();
      ctx.moveTo(x - 19 * s, y - 19 * s);
      ctx.lineTo(x, y - 31 * s);
      ctx.lineTo(x + 19 * s, y - 19 * s);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#3a78d6';
      roundRect(ctx, x - 4 * s, y - 11 * s, 8 * s, 11 * s, 3);
      ctx.fill();
      break;
    }
    case 'flowers': {
      const colors = ['#ffffff', '#ff9fbf', '#ffd65a'];
      for (let i = 0; i < 7; i++) {
        const a = i * 2.4 + p.v * 6;
        ctx.fillStyle = colors[i % 3];
        ctx.beginPath();
        ctx.arc(x + Math.cos(a) * (4 + i) * s, y + Math.sin(a) * (3 + i * 0.6) * s, 1.8 * s, 0, Math.PI * 2);
        ctx.fill();
      }
      break;
    }
  }
}
