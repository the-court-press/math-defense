// A vertical list driven by the numpad as a D-pad: 8 and 2 move, 5 or Enter chooses,
// 4 and 6 change a setting's value.

import { sfx } from '../core/audio';
import { isOk, navDir, type NumKey } from '../core/input';
import { h, kc } from './dom';

export interface MenuItem {
  label: string;
  /** Right-aligned value or hint, re-read on every refresh. */
  value?: () => string;
  icon?: string;
  disabled?: () => boolean;
  danger?: boolean;
  action?: () => void;
  /** Called with -1 or +1 when 4 or 6 is pressed on this row. */
  adjust?: (dir: number) => void;
}

export class MenuList {
  readonly el: HTMLElement;
  private rows: HTMLElement[] = [];
  private values: (HTMLElement | null)[] = [];
  sel = 0;

  constructor(private items: MenuItem[], cls = 'menu') {
    this.el = h('div', { class: cls, attrs: { role: 'menu' } });
    for (const it of items) {
      const value = it.value ? h('span', { class: 'menu-value' }) : null;
      const row = h(
        'div',
        { class: `menu-row${it.danger ? ' danger' : ''}`, attrs: { role: 'menuitem' } },
        it.icon ? h('span', { class: 'menu-icon', text: it.icon }) : null,
        h('span', { class: 'menu-label', text: it.label }),
        value,
        it.adjust ? h('span', { class: 'menu-arrows' }, kc('4'), kc('6')) : null,
      );
      this.rows.push(row);
      this.values.push(value);
      this.el.append(row);
    }
    this.refresh();
  }

  refresh(): void {
    this.items.forEach((it, i) => {
      this.rows[i].classList.toggle('selected', i === this.sel);
      this.rows[i].classList.toggle('disabled', !!it.disabled?.());
      const v = this.values[i];
      if (v && it.value) v.textContent = it.value();
    });
  }

  select(i: number): void {
    this.sel = (i + this.items.length) % this.items.length;
    this.refresh();
  }

  /** Returns true if the key was used. */
  key(k: NumKey): boolean {
    const d = navDir(k);
    if (d === 'up' || d === 'down') {
      this.select(this.sel + (d === 'up' ? -1 : 1));
      sfx.move();
      return true;
    }
    const it = this.items[this.sel];
    if ((d === 'left' || d === 'right') && it.adjust) {
      it.adjust(d === 'left' ? -1 : 1);
      sfx.move();
      this.refresh();
      return true;
    }
    if (isOk(k)) {
      if (it.disabled?.()) {
        sfx.denied();
        return true;
      }
      if (it.action) {
        sfx.select();
        it.action();
      } else if (it.adjust) {
        it.adjust(1);
        sfx.move();
      }
      this.refresh();
      return true;
    }
    return false;
  }
}
