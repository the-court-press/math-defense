// Title screen: a live, self-playing battle behind a clean glass menu.

import type { KeyPress } from '../core/input';
import { Battle } from '../sim/battle';
import { BattleRenderer } from '../render/battleRenderer';
import { STAGE_BY_ID } from '../content/regions';
import { h, withKeys } from './dom';
import { MenuList } from './menu';
import type { App, Screen } from './app';
import { MapScreen } from './map';
import { NotesScreen } from './notes';
import { SettingsScreen } from './settings';

declare const __VERSION__: string;

/** A quiet demo battle that plays itself. */
export class DemoField {
  readonly canvas = h('canvas', { class: 'demo-canvas' });
  private battle!: Battle;
  private renderer!: BattleRenderer;
  private raf = 0;
  private last = 0;
  private nextAnswer = 2;
  private ro: ResizeObserver;

  constructor(private stageId = 'syr-1') {
    this.reset();
    this.ro = new ResizeObserver(() => this.resize());
    this.ro.observe(this.canvas);
    this.raf = requestAnimationFrame((t) => this.frame(t));
  }

  private reset(): void {
    this.battle = new Battle(STAGE_BY_ID[this.stageId], (Math.random() * 1e9) | 0);
    this.battle.gold = 9999;
    this.battle.build(6, 'ballista');
    this.battle.build(4, 'sling');
    this.battle.build(3, 'ballista');
    this.renderer = new BattleRenderer(this.canvas, this.battle);
    this.renderer.reducedMotion = true;
    this.resize();
  }

  private resize(): void {
    const r = this.canvas.getBoundingClientRect();
    if (r.width > 0) this.renderer.resize(r.width, r.height, Math.min(2, devicePixelRatio || 1));
  }

  private frame(now: number): void {
    const dt = Math.min(0.05, (now - (this.last || now)) / 1000);
    this.last = now;
    const b = this.battle;
    if (b.phase === 'planning') b.startWave();
    if (b.phase === 'won' || b.phase === 'lost') this.reset();
    b.step(dt);
    b.lives = b.maxLives;
    this.nextAnswer -= dt;
    if (this.nextAnswer <= 0) {
      const target = b.enemies.filter((e) => e.riddle && !e.locked && e.x > 120).sort((a, c) => b.remaining(a) - b.remaining(c))[0];
      if (target) b.submitAnswer(String(target.riddle!.answer));
      this.nextAnswer = 1.6 + Math.random() * 1.2;
    }
    this.renderer.handle(b.drainEvents());
    this.renderer.draw(dt, { buildMode: false, selectedSite: null, previewTower: null, hideRiddles: false });
    this.raf = requestAnimationFrame((t) => this.frame(t));
  }

  destroy(): void {
    cancelAnimationFrame(this.raf);
    this.ro.disconnect();
  }
}

export class TitleScreen implements Screen {
  readonly el: HTMLElement;
  readonly wantsPad = true;
  private menu: MenuList;
  private demo = new DemoField();

  constructor(app: App) {
    this.menu = new MenuList(
      [
        { label: 'Play', icon: '▶︎', action: () => app.show(new MapScreen(app)) },
        { label: 'Notes', icon: '✎', action: () => app.show(new NotesScreen(app)) },
        { label: 'Settings', icon: '⚙︎', action: () => app.show(new SettingsScreen(app)) },
      ],
      'menu title-menu',
    );
    this.el = h(
      'div',
      { class: 'screen title' },
      h('div', { class: 'title-field' }, this.demo.canvas),
      h('div', { class: 'title-scrim' }),
      h(
        'div',
        { class: 'title-card glass' },
        h('div', { class: 'eyebrow', text: 'Clear the Fog' }),
        h('h1', { class: 'wordmark' }, 'Math', h('span', { text: ' Defense' })),
        h('p', { class: 'title-sub', text: 'Solve the riddle. Aim the engine. Save the city.' }),
        this.menu.el,
      ),
      h(
        'div',
        { class: 'title-foot' },
        h('span', { class: 'legend' }, withKeys('[8] [2] Move   [Enter] Choose')),
        h('span', { class: 'ver', text: `v${__VERSION__} · Numpad edition` }),
      ),
    );
  }

  key(k: KeyPress): void {
    this.menu.key(k.key);
  }

  destroy(): void {
    this.demo.destroy();
  }
}
