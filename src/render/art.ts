// Hand-drawn-in-code cartoon art. Everything is vector, so it stays crisp at any
// size and needs no image files. Each draw function works in logical units.

import type { Enemy, Tower } from '../sim/battle';

export type Ctx = CanvasRenderingContext2D;

export const INK = '#2b2340';
export const ACCENT = '#0a84ff';

export function roundRect(ctx: Ctx, x: number, y: number, w: number, h: number, r: number): void {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

export function shadow(ctx: Ctx, x: number, y: number, rx: number, ry: number, a = 0.18): void {
  ctx.fillStyle = `rgba(30, 20, 40, ${a})`;
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
  ctx.fill();
}

function blobPath(ctx: Ctx, x: number, y: number, r: number, t: number, phase: number, wob = 0.07): void {
  ctx.beginPath();
  const n = 18;
  for (let i = 0; i <= n; i++) {
    const a = (i / n) * Math.PI * 2;
    const rr = r * (1 + wob * Math.sin(3 * a + t * 3 + phase) + wob * 0.6 * Math.sin(5 * a - t * 4 + phase));
    const px = x + Math.cos(a) * rr;
    const py = y + Math.sin(a) * rr * 0.92;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
}

function eyes(ctx: Ctx, x: number, y: number, size: number, gap: number, look: number, t: number, phase: number): void {
  const blink = (t + phase * 1.7) % 4.2 < 0.12;
  const lx = Math.cos(look) * size * 0.35;
  const ly = Math.sin(look) * size * 0.25;
  for (const s of [-1, 1]) {
    const ex = x + s * gap;
    if (blink) {
      ctx.strokeStyle = INK;
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.moveTo(ex - size * 0.8, y);
      ctx.lineTo(ex + size * 0.8, y);
      ctx.stroke();
      continue;
    }
    ctx.fillStyle = '#fff';
    ctx.strokeStyle = INK;
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.ellipse(ex, y, size, size * 1.1, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = INK;
    ctx.beginPath();
    ctx.arc(ex + lx, y + ly, size * 0.48, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(ex + lx - size * 0.15, y + ly - size * 0.2, size * 0.14, 0, Math.PI * 2);
    ctx.fill();
  }
}

function feet(ctx: Ctx, x: number, y: number, r: number, t: number, speed: number, color: string): void {
  const s = Math.sin(t * speed);
  ctx.fillStyle = color;
  for (const side of [-1, 1]) {
    const lift = Math.max(0, s * side) * 3;
    ctx.beginPath();
    ctx.ellipse(x + side * r * 0.45, y + r * 0.82 - lift, r * 0.28, r * 0.16, 0, 0, Math.PI * 2);
    ctx.fill();
  }
}

function flash(ctx: Ctx, e: Enemy, draw: () => void): void {
  if (e.hitFlash <= 0) return;
  ctx.save();
  ctx.globalAlpha = Math.min(0.85, e.hitFlash * 7);
  ctx.fillStyle = '#ffffff';
  draw();
  ctx.fill();
  ctx.restore();
}

export const ENEMY_COLORS: Record<Enemy['def']['look'], string[]> = {
  fogling: ['#a48cf5', '#7357d6', '#4c3799'],
  imp: ['#ffb08c', '#f2704a', '#b8432a'],
  shellback: ['#9fc2cf', '#5f8597', '#3c5868'],
  mites: ['#d3f58c', '#9bd34b', '#5f9426'],
  tangle: ['#e58bd6', '#a93a9c', '#62205e'],
};

export function drawEnemy(ctx: Ctx, e: Enemy, t: number, x: number, y: number): void {
  const r = e.def.radius;
  const bob = Math.sin(t * 7 + e.phase) * 1.6;
  const look = e.angle;
  const c = ENEMY_COLORS[e.def.look];
  shadow(ctx, x, y + r * 0.85, r * 0.95, r * 0.32);

  const by = y + bob - 2;
  switch (e.def.look) {
    case 'fogling':
    case 'imp': {
      const imp = e.def.look === 'imp';
      feet(ctx, x, by, r, t, imp ? 22 : 12, c[2]);
      if (imp) {
        // Horns
        ctx.fillStyle = c[2];
        for (const s of [-1, 1]) {
          ctx.beginPath();
          ctx.moveTo(x + s * r * 0.35, by - r * 0.7);
          ctx.lineTo(x + s * r * 0.75, by - r * 1.35);
          ctx.lineTo(x + s * r * 0.75, by - r * 0.55);
          ctx.closePath();
          ctx.fill();
        }
      }
      const g = ctx.createRadialGradient(x - r * 0.4, by - r * 0.5, r * 0.1, x, by, r * 1.1);
      g.addColorStop(0, c[0]);
      g.addColorStop(0.55, c[1]);
      g.addColorStop(1, c[2]);
      blobPath(ctx, x, by, r, t, e.phase, imp ? 0.04 : 0.08);
      ctx.fillStyle = g;
      ctx.fill();
      ctx.strokeStyle = INK;
      ctx.lineWidth = 2;
      ctx.stroke();
      if (!imp) {
        // Crossed-out working scribbled across the body.
        ctx.strokeStyle = 'rgba(255,255,255,0.45)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(x - r * 0.6, by + r * 0.35);
        ctx.bezierCurveTo(x - r * 0.2, by + r * 0.05, x + r * 0.1, by + r * 0.65, x + r * 0.6, by + r * 0.25);
        ctx.moveTo(x - r * 0.5, by + r * 0.55);
        ctx.lineTo(x + r * 0.45, by + r * 0.5);
        ctx.stroke();
      }
      eyes(ctx, x, by - r * 0.22, r * (imp ? 0.27 : 0.25), r * 0.36, look, t, e.phase);
      ctx.strokeStyle = INK;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      if (imp) ctx.arc(x, by + r * 0.2, r * 0.32, 0.15 * Math.PI, 0.85 * Math.PI);
      else ctx.arc(x, by + r * 0.38, r * 0.18, 1.15 * Math.PI, 1.85 * Math.PI);
      ctx.stroke();
      flash(ctx, e, () => blobPath(ctx, x, by, r, t, e.phase));
      break;
    }
    case 'shellback': {
      const dir = Math.cos(look) >= 0 ? 1 : -1;
      feet(ctx, x, by + 2, r, t, 8, c[2]);
      // Head
      ctx.fillStyle = '#b7d3a8';
      ctx.strokeStyle = INK;
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.ellipse(x + dir * r * 0.95, by + r * 0.05, r * 0.42, r * 0.36, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      eyes(ctx, x + dir * r * 1.05, by - r * 0.05, r * 0.13, r * 0.16, look, t, e.phase);
      // Shell
      const g = ctx.createLinearGradient(x, by - r, x, by + r * 0.6);
      g.addColorStop(0, c[0]);
      g.addColorStop(1, c[2]);
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.ellipse(x, by, r, r * 0.78, 0, Math.PI, 0);
      ctx.lineTo(x + r, by + r * 0.25);
      ctx.lineTo(x - r, by + r * 0.25);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      // Plates
      ctx.strokeStyle = 'rgba(255,255,255,0.35)';
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.moveTo(x - r * 0.5, by + r * 0.2);
      ctx.lineTo(x - r * 0.35, by - r * 0.45);
      ctx.lineTo(x + r * 0.35, by - r * 0.45);
      ctx.lineTo(x + r * 0.5, by + r * 0.2);
      ctx.stroke();
      ctx.fillStyle = '#ffffff';
      ctx.font = `700 ${Math.round(r * 0.75)}px ui-rounded, system-ui, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('±', x, by - r * 0.12);
      flash(ctx, e, () => {
        ctx.beginPath();
        ctx.ellipse(x, by, r, r * 0.78, 0, Math.PI, 0);
        ctx.closePath();
      });
      break;
    }
    case 'mites': {
      const jx = Math.sin(t * 31 + e.phase) * 0.8;
      ctx.fillStyle = c[1];
      ctx.strokeStyle = INK;
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.arc(x + jx, by + 2, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = INK;
      ctx.beginPath();
      ctx.arc(x + jx - r * 0.35, by + 1, r * 0.2, 0, Math.PI * 2);
      ctx.arc(x + jx + r * 0.35, by + 1, r * 0.2, 0, Math.PI * 2);
      ctx.fill();
      flash(ctx, e, () => {
        ctx.beginPath();
        ctx.arc(x + jx, by + 2, r, 0, Math.PI * 2);
      });
      break;
    }
    case 'tangle': {
      const pulse = 1 + Math.sin(t * 2.4 + e.phase) * 0.04;
      const R = r * pulse;
      const g = ctx.createRadialGradient(x - R * 0.3, by - R * 0.4, R * 0.1, x, by, R * 1.1);
      g.addColorStop(0, c[0]);
      g.addColorStop(0.6, c[1]);
      g.addColorStop(1, c[2]);
      blobPath(ctx, x, by, R, t * 0.6, e.phase, 0.1);
      ctx.fillStyle = g;
      ctx.fill();
      ctx.strokeStyle = INK;
      ctx.lineWidth = 2.6;
      ctx.stroke();
      // Knotted loops
      ctx.strokeStyle = 'rgba(255,255,255,0.4)';
      ctx.lineWidth = 2;
      for (let i = 0; i < 5; i++) {
        const a = t * (0.6 + i * 0.13) + i * 1.3;
        ctx.beginPath();
        ctx.ellipse(x + Math.cos(a) * R * 0.25, by + Math.sin(a) * R * 0.2, R * 0.55, R * 0.28, a, 0, Math.PI * 2);
        ctx.stroke();
      }
      // Crown of scribbles
      ctx.strokeStyle = INK;
      ctx.lineWidth = 2;
      ctx.beginPath();
      for (let i = 0; i <= 8; i++) {
        const px = x - R * 0.6 + (i / 8) * R * 1.2;
        const py = by - R * 0.95 - (i % 2 ? R * 0.35 : 0);
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.stroke();
      eyes(ctx, x - R * 0.3, by - R * 0.15, R * 0.15, 0, look, t, e.phase);
      eyes(ctx, x + R * 0.3, by - R * 0.2, R * 0.17, 0, look, t, e.phase + 1);
      eyes(ctx, x, by + R * 0.25, R * 0.12, 0, look, t, e.phase + 2);
      flash(ctx, e, () => blobPath(ctx, x, by, R, t * 0.6, e.phase, 0.1));
      break;
    }
  }

  if (e.slowFactor < 1 && e.slowUntil > 0) {
    // Dazzle sparkles while slowed by a mirror.
    ctx.fillStyle = 'rgba(255, 214, 10, 0.9)';
    for (let i = 0; i < 3; i++) {
      const a = t * 3 + (i * Math.PI * 2) / 3;
      sparkle(ctx, x + Math.cos(a) * r * 1.2, by - r * 0.4 + Math.sin(a) * r * 0.5, 3);
    }
  }
}

export function sparkle(ctx: Ctx, x: number, y: number, s: number): void {
  ctx.beginPath();
  ctx.moveTo(x, y - s * 1.6);
  ctx.quadraticCurveTo(x, y, x + s * 1.6, y);
  ctx.quadraticCurveTo(x, y, x, y + s * 1.6);
  ctx.quadraticCurveTo(x, y, x - s * 1.6, y);
  ctx.quadraticCurveTo(x, y, x, y - s * 1.6);
  ctx.fill();
}

// ---------------------------------------------------------------- towers

const WOOD = '#b07a43';
const WOOD_DARK = '#7a4f28';
const WOOD_LIGHT = '#d49a5c';
const METAL = '#a7b1b8';

export function drawPlatform(ctx: Ctx, x: number, y: number, digit: number, ground: string, showDigit = true): void {
  shadow(ctx, x, y + 14, 34, 12, 0.2);
  const stone = ground === 'dusk' ? '#cfc4d6' : '#ddd3c2';
  const side = ground === 'dusk' ? '#a597b0' : '#b8aa93';
  // A short stone drum: side wall, then the top face.
  ctx.fillStyle = side;
  ctx.beginPath();
  ctx.ellipse(x, y + 9, 30, 16, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillRect(x - 30, y, 60, 9);
  ctx.fillStyle = stone;
  ctx.beginPath();
  ctx.ellipse(x, y, 30, 16, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = 'rgba(60,45,30,0.35)';
  ctx.lineWidth = 1.2;
  ctx.stroke();
  ctx.strokeStyle = 'rgba(255,255,255,0.5)';
  ctx.beginPath();
  ctx.ellipse(x, y, 22, 11, 0, Math.PI * 1.1, Math.PI * 1.7);
  ctx.stroke();
  if (!showDigit) return;
  // The site's numpad digit on a small plaque on the front of the drum.
  ctx.fillStyle = 'rgba(255,255,255,0.78)';
  roundRect(ctx, x - 7, y + 15, 14, 11, 3.5);
  ctx.fill();
  ctx.fillStyle = 'rgba(60,45,30,0.8)';
  ctx.font = '800 9.5px ui-rounded, -apple-system, system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(String(digit), x, y + 21);
}

function levelPennant(ctx: Ctx, x: number, y: number, level: number, t: number): void {
  if (level === 0) return;
  const color = level === 1 ? '#0a84ff' : '#ffb000';
  ctx.strokeStyle = WOOD_DARK;
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x, y - 22);
  ctx.stroke();
  const w = Math.sin(t * 5 + x) * 2;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(x, y - 22);
  ctx.quadraticCurveTo(x + 7, y - 20 + w, x + 13, y - 18 + w);
  ctx.lineTo(x, y - 14);
  ctx.closePath();
  ctx.fill();
}

export function drawTower(ctx: Ctx, tw: Tower, t: number, ready: boolean): void {
  const { x, y } = tw;
  const cy = y - 4;
  const kick = tw.sinceFire < 0.18 ? (1 - tw.sinceFire / 0.18) : 0;

  switch (tw.def.id) {
    case 'sling': {
      // A small timber watch post with a whirling sling.
      ctx.fillStyle = WOOD_DARK;
      ctx.fillRect(x - 11, cy - 22, 4, 22);
      ctx.fillRect(x + 7, cy - 22, 4, 22);
      ctx.fillStyle = WOOD;
      roundRect(ctx, x - 14, cy - 30, 28, 11, 3);
      ctx.fill();
      ctx.strokeStyle = INK;
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.fillStyle = '#d65a3a';
      ctx.beginPath();
      ctx.moveTo(x - 16, cy - 30);
      ctx.lineTo(x, cy - 42);
      ctx.lineTo(x + 16, cy - 30);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      const spin = t * (tw.sinceFire < 0.6 ? 18 : 6);
      const sx = x + Math.cos(spin) * 9;
      const sy = cy - 26 + Math.sin(spin) * 4;
      ctx.strokeStyle = '#5c4630';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(x, cy - 26);
      ctx.lineTo(sx, sy);
      ctx.stroke();
      ctx.fillStyle = '#8c8c8c';
      ctx.beginPath();
      ctx.arc(sx, sy, 2.4, 0, Math.PI * 2);
      ctx.fill();
      levelPennant(ctx, x + 14, cy - 28, tw.level, t);
      break;
    }
    case 'ballista': {
      ctx.fillStyle = WOOD_DARK;
      ctx.beginPath();
      ctx.ellipse(x, cy - 2, 15, 8, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.save();
      ctx.translate(x, cy - 10);
      ctx.rotate(tw.angle);
      ctx.translate(-kick * 4, 0);
      // Rail
      ctx.fillStyle = WOOD;
      roundRect(ctx, -14, -3, 30, 6, 2);
      ctx.fill();
      ctx.strokeStyle = INK;
      ctx.lineWidth = 1.4;
      ctx.stroke();
      // Bow
      ctx.strokeStyle = WOOD_DARK;
      ctx.lineWidth = 3.2;
      ctx.beginPath();
      ctx.arc(2, 0, 15, -1.15, 1.15);
      ctx.stroke();
      ctx.strokeStyle = '#ede3d0';
      ctx.lineWidth = 1;
      ctx.beginPath();
      const pull = ready ? -9 : -3;
      ctx.moveTo(2 + Math.cos(-1.15) * 15, Math.sin(-1.15) * 15);
      ctx.lineTo(pull, 0);
      ctx.lineTo(2 + Math.cos(1.15) * 15, Math.sin(1.15) * 15);
      ctx.stroke();
      if (ready) {
        ctx.strokeStyle = METAL;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(pull, 0);
        ctx.lineTo(18, 0);
        ctx.stroke();
        ctx.fillStyle = '#5b6770';
        ctx.beginPath();
        ctx.moveTo(22, 0);
        ctx.lineTo(16, -3);
        ctx.lineTo(16, 3);
        ctx.closePath();
        ctx.fill();
      }
      ctx.restore();
      levelPennant(ctx, x - 16, cy - 2, tw.level, t);
      break;
    }
    case 'catapult': {
      const dir = Math.cos(tw.angle) >= 0 ? 1 : -1;
      // Frame
      ctx.fillStyle = WOOD_DARK;
      roundRect(ctx, x - 18, cy - 8, 36, 8, 2);
      ctx.fill();
      ctx.fillStyle = '#5a5a5a';
      for (const s of [-12, 12]) {
        ctx.beginPath();
        ctx.arc(x + s, cy, 5, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.fillStyle = WOOD;
      ctx.beginPath();
      ctx.moveTo(x - 6, cy - 8);
      ctx.lineTo(x, cy - 24);
      ctx.lineTo(x + 6, cy - 8);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = INK;
      ctx.lineWidth = 1.4;
      ctx.stroke();
      // Arm swings forward when it fires, then winds back while reloading.
      const reloadK = Math.min(1, tw.sinceFire / 1.2);
      const fired = tw.sinceFire < 0.25 ? 1 - tw.sinceFire / 0.25 : 0;
      const armA = ready ? -2.5 : -2.5 + (1 - reloadK) * 1.9 + fired * 0.3;
      ctx.save();
      ctx.translate(x, cy - 22);
      ctx.scale(dir, 1);
      ctx.rotate(armA + Math.PI);
      ctx.fillStyle = WOOD_LIGHT;
      roundRect(ctx, -2, -3, 30, 6, 2);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = WOOD_DARK;
      ctx.beginPath();
      ctx.arc(28, 0, 6, 0, Math.PI * 2);
      ctx.fill();
      if (ready) {
        ctx.fillStyle = '#9c8a74';
        ctx.beginPath();
        ctx.arc(28, -2, 5, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = INK;
        ctx.stroke();
      }
      ctx.restore();
      levelPennant(ctx, x + 18 * -dir, cy - 6, tw.level, t);
      break;
    }
    case 'mirror': {
      ctx.strokeStyle = WOOD_DARK;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(x, cy);
      ctx.lineTo(x, cy - 18);
      ctx.moveTo(x - 9, cy);
      ctx.lineTo(x, cy - 10);
      ctx.lineTo(x + 9, cy);
      ctx.stroke();
      const face = Math.abs(Math.cos(tw.angle)) * 0.55 + 0.45;
      const g = ctx.createRadialGradient(x - 4, cy - 30, 2, x, cy - 26, 16);
      g.addColorStop(0, '#fff6c8');
      g.addColorStop(0.5, '#f0c050');
      g.addColorStop(1, '#b07818');
      ctx.fillStyle = g;
      ctx.strokeStyle = '#6b4810';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.ellipse(x, cy - 26, 14 * face, 14, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      if (ready) {
        ctx.save();
        ctx.globalAlpha = 0.35 + 0.25 * Math.sin(t * 4 + x);
        ctx.fillStyle = '#ffe58a';
        ctx.beginPath();
        ctx.arc(x, cy - 26, 19, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
      if (kick > 0) {
        ctx.save();
        ctx.globalAlpha = kick;
        ctx.fillStyle = '#fffbe0';
        ctx.beginPath();
        ctx.arc(x, cy - 26, 24, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
      levelPennant(ctx, x + 16, cy - 2, tw.level, t);
      break;
    }
  }
}

/** Small tower glyph used on cards and the build menu. */
export function towerIcon(id: string, size = 56): HTMLCanvasElement {
  const c = document.createElement('canvas');
  const dpr = Math.min(3, window.devicePixelRatio || 1);
  c.width = size * dpr;
  c.height = size * dpr;
  c.style.width = `${size}px`;
  c.style.height = `${size}px`;
  const ctx = c.getContext('2d')!;
  ctx.scale((dpr * size) / 64, (dpr * size) / 64);
  const fake = {
    site: 5,
    x: 32,
    y: 50,
    def: { id } as Tower['def'],
    level: 0,
    cooldown: 0,
    angle: -0.4,
    spent: 0,
    sinceFire: 9,
    jam: 0,
    jamFor: 0,
  } as Tower;
  drawTower(ctx, fake, 0.6, true);
  return c;
}

export function enemyIcon(look: Enemy['def']['look'], radius: number, size = 56): HTMLCanvasElement {
  const c = document.createElement('canvas');
  const dpr = Math.min(3, window.devicePixelRatio || 1);
  c.width = size * dpr;
  c.height = size * dpr;
  c.style.width = `${size}px`;
  c.style.height = `${size}px`;
  const ctx = c.getContext('2d')!;
  const scale = Math.min(1.6, 22 / radius);
  ctx.scale((dpr * size) / 64, (dpr * size) / 64);
  ctx.translate(32, 34);
  ctx.scale(scale, scale);
  const fake = {
    def: { look, radius } as Enemy['def'],
    angle: 0.3,
    phase: 1,
    hitFlash: 0,
    slowFactor: 1,
    slowUntil: 0,
  } as Enemy;
  drawEnemy(ctx, fake, 0.2, 0, 0);
  return c;
}
