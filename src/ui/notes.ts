// The Notes book: everything you have met, in four tabs.

import { sfx } from '../core/audio';
import { isBack, navDir, type KeyPress } from '../core/input';
import { noteUnlocked } from '../core/save';
import { NOTES } from '../content/notes';
import { ALL_STAGES } from '../content/regions';
import { ENEMIES, TOWERS } from '../content/units';
import type { NoteDef, NoteKind } from '../content/types';
import { enemyIcon, towerIcon } from '../render/art';
import { clear, h, lockIcon, withKeys } from './dom';
import type { App, Screen } from './app';
import { TitleScreen } from './title';

/** Where a locked note will be found, so the book reads as a promise rather than a wall. */
function whereFound(n: NoteDef): string {
  const i = ALL_STAGES.findIndex((s) => s.introduces.includes(n.id));
  return i < 0 ? 'A later city' : `Stage ${i + 1} · ${ALL_STAGES[i].name}`;
}

const TABS: { kind: NoteKind; label: string }[] = [
  { kind: 'math', label: 'Math' },
  { kind: 'fogling', label: 'Foglings' },
  { kind: 'tower', label: 'Engines' },
  { kind: 'mind', label: 'Minds' },
];

export class NotesScreen implements Screen {
  readonly el: HTMLElement;
  readonly wantsPad = true;
  private tab = 0;
  private sel = 0;
  private tabsEl = h('div', { class: 'seg' });
  private listEl = h('div', { class: 'note-list' });
  private detailEl = h('article', { class: 'note-detail glass' });

  constructor(private app: App) {
    this.el = h(
      'div',
      { class: 'screen notes' },
      h('header', { class: 'topbar' }, h('div', { class: 'topbar-left' }, withKeys('[/] Back')), this.tabsEl, h('div', { class: 'topbar-right', text: `${NOTES.filter((n) => noteUnlocked(app.save, n.id)).length} of ${NOTES.length} found` })),
      h('main', { class: 'notes-main' }, h('div', { class: 'note-list-wrap glass' }, this.listEl), this.detailEl),
      h('footer', { class: 'legend' }, withKeys('[4] [6] Tabs    [8] [2] Entries    [/] Back')),
    );
    this.render();
  }

  private get entries(): NoteDef[] {
    return NOTES.filter((n) => n.kind === TABS[this.tab].kind);
  }

  private render(): void {
    clear(this.tabsEl);
    TABS.forEach((t, i) => this.tabsEl.append(h('div', { class: `seg-item${i === this.tab ? ' on' : ''}`, text: t.label })));
    clear(this.listEl);
    const entries = this.entries;
    entries.forEach((n, i) => {
      const open = noteUnlocked(this.app.save, n.id);
      // Math topics are not secrets, so their names show; creatures and engines stay a surprise.
      const label = open || n.kind === 'math' ? n.title : '???';
      const row = h(
        'div',
        { class: `note-row${i === this.sel ? ' selected' : ''}${open ? '' : ' locked'}` },
        h('span', { text: label }),
        open ? null : lockIcon('note-lock'),
      );
      this.listEl.append(row);
      if (i === this.sel) requestAnimationFrame(() => row.scrollIntoView({ block: 'nearest' }));
    });
    this.renderDetail(entries[this.sel]);
  }

  private renderDetail(n: NoteDef | undefined): void {
    const d = this.detailEl;
    clear(d);
    if (!n) return;
    if (!noteUnlocked(this.app.save, n.id)) {
      const where = whereFound(n);
      d.append(
        h(
          'div',
          { class: 'locked-note' },
          h('div', { class: 'lock-glyph', text: '?' }),
          h('h2', { text: n.kind === 'math' ? n.title : 'Not yet discovered' }),
          h('p', { class: 'muted', text: where === 'A later city' ? 'Arrives with a later city.' : `Found in ${where.replace(' · ', ': ')}. Meet it in battle and it will be written here.` }),
        ),
      );
      return;
    }
    let art: HTMLElement | null = null;
    if (n.kind === 'fogling') {
      const e = ENEMIES[n.id.slice(2)];
      art = enemyIcon(e.look, e.radius, 96);
    } else if (n.kind === 'tower') {
      art = towerIcon(n.id.slice(2), 96);
    }
    d.append(
      h('div', { class: 'note-head' }, art ? h('div', { class: 'note-art' }, art) : null, h('div', {}, h('div', { class: 'eyebrow', text: TABS[this.tab].label }), h('h2', { text: n.title }))),
      h('p', { class: 'note-summary', text: n.summary }),
    );
    if (n.example) d.append(h('div', { class: 'note-box' }, h('div', { class: 'card-label', text: 'Example' }), h('div', { class: 'note-example', text: n.example })));
    if (n.mixup) d.append(h('div', { class: 'note-box warn' }, h('div', { class: 'card-label', text: 'Common mix-up' }), h('div', {}, withKeys(n.mixup))));
    if (n.kind === 'tower') {
      const t = TOWERS[n.id.slice(2)];
      d.append(h('div', { class: 'stat-row' }, ...[['Cost', String(t.cost)], ['Damage', String(t.damage)], ['Range', String(t.range)], ['Reload', `${t.reload}s`], ['Type', t.kind === 'light' ? 'Automatic' : 'Math-aimed']].map(([a, b]) => h('div', { class: 'stat' }, h('span', { class: 'stat-label', text: a }), h('strong', { text: b })))));
    }
    if (n.kind === 'fogling') {
      const e = ENEMIES[n.id.slice(2)];
      d.append(h('div', { class: 'stat-row' }, ...[['Health', String(e.hp)], ['Speed', String(e.speed)], ['Shell', e.shell ? `${Math.round(e.shell * 100)}%` : 'None'], ['Gate damage', `${e.lives} ♥`]].map(([a, b]) => h('div', { class: 'stat' }, h('span', { class: 'stat-label', text: a }), h('strong', { text: b })))));
    }
    if (n.body) d.append(h('p', { class: 'note-body', text: n.body }));
  }

  key({ key }: KeyPress): void {
    if (isBack(key)) {
      sfx.back();
      this.app.show(new TitleScreen(this.app));
      return;
    }
    const dir = navDir(key);
    if (dir === 'left' || dir === 'right') {
      this.tab = (this.tab + (dir === 'left' ? -1 : 1) + TABS.length) % TABS.length;
      this.sel = 0;
      sfx.move();
      this.render();
    } else if (dir === 'up' || dir === 'down') {
      const n = this.entries.length;
      this.sel = (this.sel + (dir === 'up' ? -1 : 1) + n) % n;
      sfx.move();
      this.render();
    }
  }
}
