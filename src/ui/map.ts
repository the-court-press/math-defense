// Campaign map: pick a region with + and −, move between stages with 4 6 8 2, Enter to play.

import { sfx } from '../core/audio';
import { isBack, isOk, navDir, type KeyPress } from '../core/input';
import { isUnlocked, totalStars } from '../core/save';
import { Rng, hashString } from '../core/rng';
import { REGIONS } from '../content/regions';
import { ENEMIES, TOWERS } from '../content/units';
import type { RegionDef, StageDef } from '../content/types';
import { enemyIcon, towerIcon, roundRect } from '../render/art';
import { clear, h, kc, percentDown, starRow, withKeys } from './dom';
import type { App, Screen } from './app';
import { BattleScreen } from './battleScreen';
import { TitleScreen } from './title';

interface Tree {
  x: number;
  y: number;
  s: number;
  cypress: boolean;
}

/** A padlock drawn with paths, so it looks the same on every platform. */
function drawLock(ctx: CanvasRenderingContext2D, x: number, y: number, color: string): void {
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(x, y - 2, 4, Math.PI, 0);
  ctx.lineTo(x + 4, y + 1);
  ctx.moveTo(x - 4, y + 1);
  ctx.lineTo(x - 4, y - 2);
  ctx.stroke();
  roundRect(ctx, x - 6.5, y, 13, 9, 2.5);
  ctx.fill();
}

let lastRegion = 0;
const lastStage: Record<string, string> = {};

export class MapScreen implements Screen {
  readonly el: HTMLElement;
  readonly wantsPad = true;
  private regionIdx = lastRegion;
  private stageId: string;
  private canvas = h('canvas', { class: 'region-canvas' });
  private card = h('aside', { class: 'stage-card glass' });
  private tabs = h('div', { class: 'seg' });
  private starsTotal = h('div', { class: 'stars-total' });
  private raf = 0;
  private ro: ResizeObserver;
  private t0 = performance.now();

  constructor(private app: App) {
    this.stageId = this.defaultStage(this.region);
    this.el = h(
      'div',
      { class: 'screen map' },
      h(
        'header',
        { class: 'topbar' },
        h('div', { class: 'topbar-left' }, withKeys('[/] Back')),
        this.tabs,
        this.starsTotal,
      ),
      h('main', { class: 'map-main' }, h('div', { class: 'map-card' }, this.canvas), this.card),
      h('footer', { class: 'legend map-legend' }, withKeys('[4] [6] [8] [2] Move    [Enter] Play    [+] [−] Region    [/] Back')),
    );
    this.ro = new ResizeObserver(() => this.draw());
    this.ro.observe(this.canvas);
    this.render();
    const tick = () => {
      this.draw();
      this.raf = requestAnimationFrame(tick);
    };
    this.raf = requestAnimationFrame(tick);
  }

  get region(): RegionDef {
    return REGIONS[this.regionIdx];
  }

  get stage(): StageDef | undefined {
    return this.region.stages.find((s) => s.id === this.stageId);
  }

  private defaultStage(region: RegionDef): string {
    if (lastStage[region.id]) return lastStage[region.id];
    const open = region.stages.filter((s) => isUnlocked(this.app.save, s.id));
    const fresh = open.find((s) => !this.app.save.stars[s.id]);
    return (fresh ?? open[open.length - 1] ?? region.stages[0])?.id ?? '';
  }

  private render(): void {
    clear(this.tabs);
    REGIONS.forEach((r, i) => {
      this.tabs.append(
        h(
          'div',
          { class: `seg-item${i === this.regionIdx ? ' on' : ''}${r.available ? '' : ' soon'}` },
          h('span', { text: r.name }),
          r.available ? null : h('small', { text: 'Soon' }),
        ),
      );
    });
    this.starsTotal.textContent = `★ ${totalStars(this.app.save)} / ${REGIONS.reduce((a, r) => a + r.stages.length * 3, 0)}`;
    this.renderCard();
  }

  private renderCard(): void {
    const card = this.card;
    clear(card);
    const r = this.region;
    if (!r.available) {
      card.append(
        h('div', { class: 'eyebrow', text: r.era }),
        h('h2', { text: r.name }),
        h('p', { class: 'muted', text: r.blurb }),
        h('div', { class: 'soon-box' }, h('strong', { text: `${r.mind} arrives in a later version.` }), h('span', { text: 'New Foglings, new engines, new mathematics.' })),
      );
      return;
    }
    const st = this.stage;
    if (!st) return;
    const idx = r.stages.indexOf(st) + 1;
    const unlocked = isUnlocked(this.app.save, st.id);
    const stars = this.app.save.stars[st.id] ?? 0;
    const rec = this.app.save.records[st.id];
    const enemyIds = [...new Set(st.waves.flatMap((w) => w.groups.map((g) => g.enemy)))];

    card.append(
      h('div', { class: 'eyebrow', text: `${r.name} · Stage ${idx}` }),
      h('h2', { text: st.name }),
      h('p', { class: 'muted', text: st.subtitle }),
      h('div', { class: 'chip-row' }, h('span', { class: 'chip accent', text: st.focus })),
      h('div', { class: 'card-label', text: 'Foglings' }),
      h(
        'div',
        { class: 'icon-row' },
        ...enemyIds.map((id) => {
          const e = ENEMIES[id];
          return h('div', { class: 'icon-cell', attrs: { title: e.name } }, enemyIcon(e.look, e.radius, 44), h('span', { text: e.name.split(' ').pop()! }));
        }),
      ),
      h('div', { class: 'card-label', text: 'Engines' }),
      h(
        'div',
        { class: 'icon-row' },
        ...st.towers.map((id) => h('div', { class: 'icon-cell' }, towerIcon(id, 44), h('span', { text: TOWERS[id].name.split(' ').pop()! }))),
      ),
      h(
        'div',
        { class: 'record-row' },
        starRow(stars),
        h('span', { class: 'muted', text: rec ? `Best accuracy ${percentDown(rec.bestAccuracy)}%` : unlocked ? 'Not yet played' : '' }),
      ),
      unlocked
        ? h('div', { class: 'btn primary' }, h('span', { text: stars ? 'Play again' : 'Play' }), kc('Enter'))
        : h('div', { class: 'btn disabled' }, h('span', { text: `Clear ${st.requires.map((id) => r.stages.find((s) => s.id === id)?.name).join(' and ')} first` })),
    );
  }

  private draw(): void {
    const c = this.canvas;
    const rect = c.getBoundingClientRect();
    if (rect.width < 10) return;
    const dpr = Math.min(2, devicePixelRatio || 1);
    if (c.width !== Math.round(rect.width * dpr)) {
      c.width = Math.round(rect.width * dpr);
      c.height = Math.round(rect.height * dpr);
    }
    const ctx = c.getContext('2d')!;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const W = rect.width;
    const H = rect.height;
    const t = (performance.now() - this.t0) / 1000;
    const r = this.region;
    const dark = matchMedia('(prefers-color-scheme: dark)').matches;

    // Sea
    const sea = ctx.createLinearGradient(0, 0, 0, H);
    sea.addColorStop(0, dark ? '#16324a' : '#bfe6fb');
    sea.addColorStop(1, dark ? '#0d2236' : '#8ccff4');
    ctx.fillStyle = sea;
    ctx.fillRect(0, 0, W, H);
    ctx.strokeStyle = dark ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.55)';
    ctx.lineWidth = 2;
    for (let i = 0; i < 14; i++) {
      const x = ((i * 137 + t * 8) % (W + 60)) - 30;
      const y = ((i * 89) % H) + 10;
      ctx.beginPath();
      ctx.arc(x, y, 9, Math.PI * 1.15, Math.PI * 1.85);
      ctx.stroke();
    }

    // The island lives on a board with a fixed shape, centred in whatever space the canvas has.
    const BW = Math.min(W, H * 1.45);
    const BH = Math.min(H, BW / 1.15);
    const BX = (W - BW) / 2;
    const BY = (H - BH) / 2;

    // Land: a soft island shape.
    const land = (inset: number) => {
      ctx.beginPath();
      const cx = BX + BW * 0.5;
      const cy = BY + BH * 0.5;
      const n = 120;
      for (let i = 0; i <= n; i++) {
        const a = (i / n) * Math.PI * 2;
        const rr = 1 + 0.06 * Math.sin(a * 3 + 1) + 0.04 * Math.sin(a * 7 + 2);
        const x = cx + Math.cos(a) * (BW * 0.46 - inset) * rr;
        const y = cy + Math.sin(a) * (BH * 0.42 - inset) * rr;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.closePath();
    };
    ctx.save();
    ctx.shadowColor = 'rgba(0,40,80,0.25)';
    ctx.shadowBlur = 24;
    ctx.shadowOffsetY = 6;
    land(0);
    ctx.fillStyle = dark ? '#3b4a35' : '#f4ecd6';
    ctx.fill();
    ctx.restore();
    land(14);
    ctx.fillStyle = dark ? '#475a3f' : '#dcebbd';
    ctx.fill();
    land(Math.min(BW, BH) * 0.16);
    ctx.fillStyle = dark ? 'rgba(255,255,255,0.03)' : 'rgba(255,255,255,0.28)';
    ctx.fill();

    // Cartographer's title in the corner of the sea.
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    ctx.fillStyle = dark ? 'rgba(255,255,255,0.75)' : 'rgba(20,60,100,0.62)';
    ctx.font = 'italic 600 22px Georgia, "Times New Roman", serif';
    ctx.fillText(r.name, 22, H - 34);
    ctx.font = '500 12px -apple-system, system-ui, sans-serif';
    ctx.fillStyle = dark ? 'rgba(255,255,255,0.5)' : 'rgba(20,60,100,0.5)';
    ctx.fillText(`${r.era} · ${r.mind}`, 22, H - 16);

    if (!r.available) {
      ctx.fillStyle = dark ? 'rgba(0,0,0,0.35)' : 'rgba(255,255,255,0.5)';
      ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = dark ? '#f5f5f7' : '#1d1d1f';
      ctx.font = '700 22px -apple-system, system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`${r.mind} · ${r.name}`, W / 2, H / 2 - 6);
      ctx.font = '500 15px -apple-system, system-ui, sans-serif';
      ctx.fillStyle = dark ? '#a1a1a6' : '#6e6e73';
      ctx.fillText('Coming in a later version', W / 2, H / 2 + 20);
      return;
    }

    const pos = (s: StageDef) => ({ x: BX + 40 + s.mapPos.x * (BW - 80), y: BY + 30 + s.mapPos.y * (BH - 60) });

    // Routes
    ctx.setLineDash([2, 9]);
    ctx.lineCap = 'round';
    ctx.lineWidth = 4;
    for (const s of r.stages) {
      for (const req of s.requires) {
        const from = r.stages.find((x) => x.id === req);
        if (!from) continue;
        const a = pos(from);
        const b = pos(s);
        ctx.strokeStyle = isUnlocked(this.app.save, s.id) ? (dark ? '#e0c890' : '#b8925a') : 'rgba(120,110,90,0.35)';
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.quadraticCurveTo((a.x + b.x) / 2, Math.min(a.y, b.y) - 20, b.x, b.y);
        ctx.stroke();
      }
    }
    ctx.setLineDash([]);

    // Little olive groves and cypresses, kept off the routes and nodes.
    const trees = this.treesFor(r, BX, BY, BW, BH, pos);
    for (const tr of trees) {
      ctx.fillStyle = dark ? 'rgba(0,0,0,0.25)' : 'rgba(60,80,30,0.16)';
      ctx.beginPath();
      ctx.ellipse(tr.x + 1, tr.y + 4, tr.s * 5, tr.s * 2, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = tr.cypress ? (dark ? '#2f4a2c' : '#5f9a52') : dark ? '#3f5a37' : '#93c06c';
      ctx.beginPath();
      if (tr.cypress) ctx.ellipse(tr.x, tr.y - tr.s * 3, tr.s * 2.2, tr.s * 6, 0, 0, Math.PI * 2);
      else ctx.arc(tr.x, tr.y - tr.s * 2, tr.s * 4, 0, Math.PI * 2);
      ctx.fill();
    }

    // Nodes shrink a little on small maps so they never crowd each other.
    const k = Math.max(0.7, Math.min(1, BW / 640));
    let label = null as (() => void) | null;
    r.stages.forEach((s, i) => {
      const p = pos(s);
      const sel = s.id === this.stageId;
      const unlocked = isUnlocked(this.app.save, s.id);
      const stars = this.app.save.stars[s.id] ?? 0;
      const R = (sel ? 24 : 20) * k;
      if (sel) {
        const pulse = (Math.sin(t * 3) + 1) / 2;
        ctx.strokeStyle = `rgba(10,132,255,${0.25 + pulse * 0.3})`;
        ctx.lineWidth = 6 * k;
        ctx.beginPath();
        ctx.arc(p.x, p.y, R + (8 + pulse * 3) * k, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.save();
      ctx.shadowColor = 'rgba(0,0,0,0.22)';
      ctx.shadowBlur = 10;
      ctx.shadowOffsetY = 3;
      ctx.fillStyle = !unlocked ? (dark ? '#5a5a5e' : '#d8d8dc') : sel ? '#0a84ff' : '#ffffff';
      ctx.beginPath();
      ctx.arc(p.x, p.y, R, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      if (stars === 3) {
        ctx.strokeStyle = '#ffb000';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(p.x, p.y, R - 1.5, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.fillStyle = !unlocked ? '#8e8e93' : sel ? '#ffffff' : '#1d1d1f';
      ctx.font = `700 ${Math.round((sel ? 18 : 16) * k)}px -apple-system, system-ui, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      if (unlocked) ctx.fillText(String(i + 1), p.x, p.y + 1);
      else drawLock(ctx, p.x, p.y, dark ? '#a1a1a6' : '#8e8e93');
      // Star pips, below the selection ring when there is one.
      const pipY = p.y + R + (sel ? 22 : 12) * k;
      for (let j = 0; j < 3; j++) {
        ctx.fillStyle = j < stars ? '#ffb000' : 'rgba(120,120,128,0.35)';
        ctx.font = `700 ${Math.round(12 * k)}px -apple-system, system-ui, sans-serif`;
        ctx.fillText('★', p.x + (j - 1) * 13 * k, pipY);
      }
      // Name label for the selected stage, drawn after every node so none covers it.
      if (sel)
        label = () => {
          ctx.font = '600 13px -apple-system, system-ui, sans-serif';
          const w = ctx.measureText(s.name).width + 18;
          const lx = Math.max(6, Math.min(W - w - 6, p.x - w / 2));
          ctx.save();
          ctx.shadowColor = 'rgba(0,0,0,0.15)';
          ctx.shadowBlur = 8;
          ctx.fillStyle = dark ? 'rgba(28,28,30,0.92)' : 'rgba(255,255,255,0.95)';
          roundRect(ctx, lx, p.y - R - 34, w, 24, 12);
          ctx.fill();
          ctx.restore();
          ctx.fillStyle = dark ? '#f5f5f7' : '#1d1d1f';
          ctx.textAlign = 'center';
          ctx.fillText(s.name, lx + w / 2, p.y - R - 21.5);
        };
    });
    label?.();
  }

  private trees: { key: string; list: Tree[] } = { key: '', list: [] };

  /** Seeded scatter of trees for a region map, cached per size. */
  private treesFor(r: RegionDef, BX: number, BY: number, W: number, H: number, pos: (s: StageDef) => { x: number; y: number }): Tree[] {
    const key = `${r.id}:${Math.round(BX)},${Math.round(BY)}:${Math.round(W)}x${Math.round(H)}`;
    if (this.trees.key === key) return this.trees.list;
    const rng = new Rng(hashString(r.id));
    const nodes = r.stages.map(pos);
    const route: { x: number; y: number }[] = [];
    for (const s of r.stages)
      for (const req of s.requires) {
        const from = r.stages.find((x) => x.id === req);
        if (!from) continue;
        const a = pos(from);
        const b = pos(s);
        const c = { x: (a.x + b.x) / 2, y: Math.min(a.y, b.y) - 20 };
        for (let k = 0; k <= 24; k++) {
          const u = k / 24;
          route.push({ x: (1 - u) * (1 - u) * a.x + 2 * (1 - u) * u * c.x + u * u * b.x, y: (1 - u) * (1 - u) * a.y + 2 * (1 - u) * u * c.y + u * u * b.y });
        }
      }
    const list: Tree[] = [];
    const rx = W * 0.46 - 40;
    const ry = H * 0.42 - 40;
    for (let tries = 0; tries < 600 && list.length < 34; tries++) {
      const x = BX + W / 2 + rng.range(-rx, rx);
      const y = BY + H / 2 + rng.range(-ry, ry);
      if (((x - BX - W / 2) / rx) ** 2 + ((y - BY - H / 2) / ry) ** 2 > 1) continue;
      if (nodes.some((n) => Math.hypot(n.x - x, n.y - y) < 54)) continue;
      if (route.some((q) => Math.hypot(q.x - x, q.y - y) < 16)) continue;
      if (list.some((o) => Math.hypot(o.x - x, o.y - y) < 14)) continue;
      // Trees grow in little groves: favour spots near an existing tree.
      if (list.length > 6 && !list.some((o) => Math.hypot(o.x - x, o.y - y) < 40) && rng.chance(0.6)) continue;
      list.push({ x, y, s: rng.range(1.2, 1.7), cypress: rng.chance(0.35) });
    }
    list.sort((a, b) => a.y - b.y);
    this.trees = { key, list };
    return list;
  }

  key({ key }: KeyPress): void {
    if (isBack(key)) {
      sfx.back();
      this.app.show(new TitleScreen(this.app));
      return;
    }
    if (key === '+' || key === '-') {
      const next = Math.max(0, Math.min(REGIONS.length - 1, this.regionIdx + (key === '+' ? 1 : -1)));
      if (next === this.regionIdx) {
        sfx.denied();
        return;
      }
      this.regionIdx = next;
      lastRegion = next;
      this.stageId = this.defaultStage(this.region);
      sfx.move();
      this.render();
      return;
    }
    const d = navDir(key);
    if (d && this.stage) {
      const target = this.stage.nav[d];
      if (target) {
        this.stageId = target;
        lastStage[this.region.id] = target;
        sfx.move();
        this.renderCard();
      } else sfx.denied();
      return;
    }
    if (isOk(key) && this.stage) {
      if (!isUnlocked(this.app.save, this.stage.id)) {
        sfx.denied();
        return;
      }
      sfx.select();
      lastStage[this.region.id] = this.stage.id;
      this.app.show(new BattleScreen(this.app, this.stage.id));
    }
  }

  destroy(): void {
    cancelAnimationFrame(this.raf);
    this.ro.disconnect();
  }
}
