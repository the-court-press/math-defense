// Settings, plus the progress code: your save as a number you can type on any numpad.

import { sfx } from '../core/audio';
import { isBack, isOk, type KeyPress } from '../core/input';
import { resetSave } from '../core/save';
import { PROGRESS_CODE_LENGTH, decodeProgress, encodeProgress } from '../core/progressCode';
import { clear, h, withKeys } from './dom';
import { MenuList } from './menu';
import type { App, Screen } from './app';
import { TitleScreen } from './title';

declare const __VERSION__: string;

type Sub = null | 'code' | 'confirmImport' | 'confirmReset';

export class SettingsScreen implements Screen {
  readonly el: HTMLElement;
  readonly wantsPad = true;
  private menu: MenuList;
  private sub: Sub = null;
  private sheet = h('div', { class: 'sheet-wrap hidden' });
  private codeEntry = '';
  private pending: Record<string, number> | null = null;
  private slotsEl = h('div');
  private statusEl = h('p');

  constructor(private app: App) {
    const s = app.save.settings;
    const cycle = <T>(list: readonly T[], cur: T, d: number) => list[(list.indexOf(cur) + d + list.length) % list.length];
    this.menu = new MenuList(
      [
        {
          label: 'Sound',
          icon: '♪',
          value: () => (s.sound ? 'On' : 'Off'),
          adjust: () => {
            s.sound = !s.sound;
            this.save();
          },
        },
        {
          label: 'Game speed',
          icon: '◷',
          value: () => ({ calm: 'Calm', standard: 'Standard', swift: 'Swift' })[s.speed],
          adjust: (d) => {
            s.speed = cycle(['calm', 'standard', 'swift'] as const, s.speed, d);
            this.save();
          },
        },
        {
          label: 'On-screen numpad',
          icon: '⌗',
          value: () => ({ auto: 'Automatic', on: 'Always', off: 'Never' })[s.pad],
          adjust: (d) => {
            s.pad = cycle(['auto', 'on', 'off'] as const, s.pad, d);
            this.save();
          },
        },
        {
          label: 'Motion',
          icon: '≋',
          value: () => (s.motion === 'full' ? 'Full' : 'Reduced'),
          adjust: () => {
            s.motion = s.motion === 'full' ? 'reduced' : 'full';
            this.save();
          },
        },
        { label: 'Progress code', icon: '#', value: () => 'Save or load', action: () => this.openCode() },
        { label: 'Reset progress', icon: '⌫', danger: true, action: () => this.openReset() },
      ],
      'menu settings-menu',
    );
    this.el = h(
      'div',
      { class: 'screen settings' },
      h('header', { class: 'topbar' }, h('div', { class: 'topbar-left' }, withKeys('[/] Back')), h('div', { class: 'topbar-title', text: 'Settings' }), h('div', { class: 'topbar-right' })),
      h(
        'main',
        { class: 'settings-main' },
        h('div', { class: 'glass settings-card' }, this.menu.el),
        h(
          'p',
          { class: 'muted small center' },
          `Math Defense v${__VERSION__}. Everything runs in your browser and saves on this device only. Nothing is sent anywhere.`,
        ),
      ),
      h('footer', { class: 'legend' }, withKeys('[8] [2] Move    [4] [6] Change    [Enter] Choose    [/] Back')),
      this.sheet,
    );
  }

  private save(): void {
    this.app.persist();
    this.app.applySettings();
  }

  private openCode(): void {
    this.sub = 'code';
    this.codeEntry = '';
    clear(this.sheet);
    this.slotsEl = h('div', { class: 'code-slots' });
    this.statusEl = h('p', { class: 'code-status' });
    this.sheet.append(
      h(
        'div',
        { class: 'sheet glass code-sheet' },
        h('div', { class: 'sheet-head' }, h('div', { class: 'eyebrow', text: 'Progress code' }), h('h2', { text: 'Your campaign, as a number' })),
        h('p', { class: 'muted', text: 'Write this down. Type it on any device to carry your stars over. Browsers sometimes clear saved games, but a code on paper lasts.' }),
        h('div', { class: 'code-mine', text: encodeProgress(this.app.save.stars) }),
        h('div', { class: 'card-label', text: 'Load a code' }),
        this.slotsEl,
        this.statusEl,
        h('div', { class: 'card-foot' }, withKeys('[0]–[9] Type    [/] Delete    [Enter] Load')),
      ),
    );
    this.renderCode();
    this.sheet.classList.remove('hidden');
  }

  /** Updates the typed digits in place, so the sheet does not re-animate on every key. */
  private renderCode(): void {
    const digits = this.codeEntry;
    clear(this.slotsEl);
    for (let i = 0; i < PROGRESS_CODE_LENGTH; i++) {
      if (i && i % 4 === 0) this.slotsEl.append(h('span', { class: 'code-gap' }));
      this.slotsEl.append(h('span', { class: `code-slot${i < digits.length ? ' filled' : ''}${i === digits.length ? ' cur' : ''}`, text: digits[i] ?? '' }));
    }
    const complete = digits.length === PROGRESS_CODE_LENGTH;
    const valid = complete && decodeProgress(digits) !== null;
    this.statusEl.className = `code-status${complete ? (valid ? ' ok' : ' bad') : ''}`;
    this.statusEl.textContent = complete
      ? valid
        ? 'Valid code. Press Enter to load it.'
        : 'That code has a typo. Check each digit.'
      : `${PROGRESS_CODE_LENGTH - digits.length} digits to go`;
  }

  private openReset(): void {
    this.sub = 'confirmReset';
    clear(this.sheet);
    this.sheet.append(
      h(
        'div',
        { class: 'sheet glass' },
        h('div', { class: 'sheet-head' }, h('div', { class: 'eyebrow', text: 'Reset progress' }), h('h2', { text: 'Start the campaign over?' })),
        h('p', { class: 'muted' }, 'Stars, records and notes on this device will be erased. Your progress code still works if you wrote it down: ', h('b', { text: encodeProgress(this.app.save.stars) })),
        h('div', { class: 'card-foot' }, withKeys('[Enter] Erase everything    [/] Keep my progress')),
      ),
    );
    this.sheet.classList.remove('hidden');
  }

  private closeSheet(): void {
    this.sub = null;
    this.sheet.classList.add('hidden');
  }

  key({ key }: KeyPress): void {
    if (this.sub === 'code') {
      if (/^[0-9]$/.test(key)) {
        if (this.codeEntry.length < PROGRESS_CODE_LENGTH) {
          this.codeEntry += key;
          sfx.key();
        } else sfx.denied();
        this.renderCode();
        return;
      }
      if (isBack(key)) {
        if (this.codeEntry && key !== 'esc') this.codeEntry = this.codeEntry.slice(0, -1);
        else {
          sfx.back();
          this.closeSheet();
          return;
        }
        this.renderCode();
        return;
      }
      if (key === 'enter') {
        const decoded = decodeProgress(this.codeEntry);
        if (!decoded) return sfx.denied();
        this.pending = decoded;
        this.sub = 'confirmImport';
        clear(this.sheet);
        const count = Object.values(decoded).reduce((a, b) => a + b, 0);
        this.sheet.append(
          h(
            'div',
            { class: 'sheet glass' },
            h('div', { class: 'sheet-head' }, h('div', { class: 'eyebrow', text: 'Load progress' }), h('h2', { text: `Load ${count} stars?` })),
            h('p', { class: 'muted', text: 'This replaces the stars on this device with the ones in the code.' }),
            h('div', { class: 'card-foot' }, withKeys('[Enter] Load    [/] Cancel')),
          ),
        );
      }
      return;
    }
    if (this.sub === 'confirmImport') {
      if (isOk(key) && this.pending) {
        this.app.save.stars = this.pending;
        this.app.persist();
        sfx.win();
        this.closeSheet();
      } else if (isBack(key)) {
        sfx.back();
        this.openCode();
      }
      return;
    }
    if (this.sub === 'confirmReset') {
      if (key === 'enter') {
        this.app.save = resetSave(this.app.save.settings);
        sfx.back();
        this.closeSheet();
      } else if (isBack(key)) {
        sfx.back();
        this.closeSheet();
      }
      return;
    }
    if (isBack(key)) {
      sfx.back();
      this.app.show(new TitleScreen(this.app));
      return;
    }
    this.menu.key(key);
  }
}
