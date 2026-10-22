// App shell: owns input, the save, the on-screen numpad and which screen is showing.

import { Input, type KeyPress, type NumKey } from '../core/input';
import { sfx } from '../core/audio';
import { loadSave, writeSave, type SaveData } from '../core/save';
import { h } from './dom';

export interface Screen {
  el: HTMLElement;
  key(k: KeyPress): void;
  /** Whether the on-screen numpad should be offered on this screen. */
  wantsPad?: boolean;
  mounted?(): void;
  destroy?(): void;
}

export class App {
  readonly root: HTMLElement;
  readonly input = new Input();
  save: SaveData;
  private current: Screen | null = null;
  private pad: VirtualPad;
  private sawPointer = false;

  constructor(root: HTMLElement) {
    this.root = root;
    this.save = loadSave();
    this.pad = new VirtualPad(this);
    root.append(this.pad.el);
    this.input.setHandler((k) => {
      sfx.unlock();
      this.current?.key(k);
    });
    window.addEventListener('pointerdown', () => {
      if (!this.sawPointer) {
        this.sawPointer = true;
        this.refreshPad();
      }
    });
    this.applySettings();
  }

  show(screen: Screen): void {
    const old = this.current;
    this.current = screen;
    screen.el.classList.add('screen-enter');
    this.root.insertBefore(screen.el, this.pad.el);
    requestAnimationFrame(() => requestAnimationFrame(() => screen.el.classList.remove('screen-enter')));
    if (old) {
      old.destroy?.();
      old.el.classList.add('screen-leave');
      window.setTimeout(() => old.el.remove(), 260);
    }
    screen.mounted?.();
    this.refreshPad();
  }

  persist(): void {
    writeSave(this.save);
  }

  applySettings(): void {
    const s = this.save.settings;
    sfx.enabled = s.sound;
    document.documentElement.classList.toggle('reduced-motion', s.motion === 'reduced');
    this.refreshPad();
  }

  refreshPad(): void {
    const mode = this.save.settings.pad;
    const coarse = matchMedia('(pointer: coarse)').matches;
    const auto = coarse || (this.sawPointer && !this.input.sawKeyboard);
    const want = !!this.current?.wantsPad && (mode === 'on' || (mode === 'auto' && auto));
    this.pad.setVisible(want);
  }
}

/**
 * On-screen numpad. It mirrors the physical layout so touch players learn the same
 * muscle memory, and it lights up when a physical key is pressed.
 */
class VirtualPad {
  readonly el: HTMLElement;
  private keys = new Map<NumKey, HTMLElement>();

  constructor(app: App) {
    const layout: { k: NumKey; label: string; cls?: string }[] = [
      { k: 'esc', label: 'esc', cls: 'fn' },
      { k: '/', label: '/', cls: 'fn' },
      { k: '*', label: '✱', cls: 'fn' },
      { k: '-', label: '−', cls: 'fn' },
      { k: '7', label: '7' },
      { k: '8', label: '8' },
      { k: '9', label: '9' },
      { k: '+', label: '+', cls: 'fn tall' },
      { k: '4', label: '4' },
      { k: '5', label: '5' },
      { k: '6', label: '6' },
      { k: '1', label: '1' },
      { k: '2', label: '2' },
      { k: '3', label: '3' },
      { k: 'enter', label: 'Enter', cls: 'enter tall' },
      { k: '0', label: '0', cls: 'zero' },
      { k: '.', label: '.' },
    ];
    this.el = h('div', { class: 'vpad hidden', attrs: { 'aria-label': 'On-screen numpad' } });
    for (const item of layout) {
      const b = h('button', { class: `vk ${item.cls ?? ''}`, text: item.label, attrs: { type: 'button', 'data-k': item.k } });
      b.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        app.input.emit(item.k);
      });
      this.keys.set(item.k, b);
      this.el.append(b);
    }
    app.input.onAny((k) => {
      const map: Partial<Record<NumKey, NumKey>> = { bksp: '/', up: '8', down: '2', left: '4', right: '6' };
      const b = this.keys.get(map[k] ?? k);
      if (!b) return;
      b.classList.remove('lit');
      void b.offsetWidth;
      b.classList.add('lit');
    });
  }

  setVisible(v: boolean): void {
    this.el.classList.toggle('hidden', !v);
    document.documentElement.classList.toggle('has-pad', v);
  }
}
