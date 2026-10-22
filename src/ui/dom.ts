// Tiny DOM helpers. No framework: each screen builds its own elements.

type Child = Node | string | number | null | undefined | false;

export interface Props {
  class?: string;
  text?: string;
  style?: string;
  attrs?: Record<string, string>;
}

export function h<K extends keyof HTMLElementTagNameMap>(tag: K, props: Props = {}, ...children: Child[]): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  if (props.class) el.className = props.class;
  if (props.text !== undefined) el.textContent = props.text;
  if (props.style) el.setAttribute('style', props.style);
  if (props.attrs) for (const [k, v] of Object.entries(props.attrs)) el.setAttribute(k, v);
  for (const c of children) {
    if (c === null || c === undefined || c === false) continue;
    el.append(typeof c === 'number' ? String(c) : c);
  }
  return el;
}

const KEY_LABELS: Record<string, string> = {
  Enter: 'Enter',
  '-': '−',
  '−': '−',
  '*': '✱',
  '/': '/',
  '+': '+',
  '.': '.',
};

/** A keycap, styled like a key on a numpad. */
export function kc(label: string, extra = ''): HTMLElement {
  const text = KEY_LABELS[label] ?? label;
  return h('kbd', { class: `kc${text.length > 1 ? ' wide' : ''}${extra ? ' ' + extra : ''}`, text });
}

/** Turns "Press [Enter] to start" into text with keycaps. */
export function withKeys(text: string): DocumentFragment {
  const frag = document.createDocumentFragment();
  const re = /\[([^\]]+)\]/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    if (m.index > last) frag.append(text.slice(last, m.index));
    frag.append(kc(m[1]));
    last = m.index + m[0].length;
  }
  if (last < text.length) frag.append(text.slice(last));
  return frag;
}

export function clear(el: HTMLElement): void {
  while (el.firstChild) el.removeChild(el.firstChild);
}

export function starRow(n: number, max = 3, cls = 'stars'): HTMLElement {
  const row = h('span', { class: cls });
  for (let i = 0; i < max; i++) row.append(h('span', { class: i < n ? 'star on' : 'star', text: '★' }));
  return row;
}

/**
 * A share as a whole percent, rounded down, so 79.7% shows as 79% and never as an
 * "80%" that did not earn the 80% star.
 */
export function percentDown(share: number): number {
  return Math.floor(share * 100 + 1e-9);
}

export function formatNumber(v: number): string {
  const r = Math.round(v * 100) / 100;
  return (r < 0 ? '−' : '') + String(Math.abs(r));
}

/** A small padlock glyph that looks the same on every platform (emoji locks do not). */
export function lockIcon(cls = 'lock-icon'): HTMLElement {
  const span = h('span', { class: cls, attrs: { 'aria-label': 'Locked' } });
  const ns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('viewBox', '0 0 12 14');
  svg.setAttribute('width', '10');
  svg.setAttribute('height', '12');
  const shackle = document.createElementNS(ns, 'path');
  shackle.setAttribute('d', 'M3.2 6V4.2a2.8 2.8 0 0 1 5.6 0V6');
  shackle.setAttribute('fill', 'none');
  shackle.setAttribute('stroke', 'currentColor');
  shackle.setAttribute('stroke-width', '1.6');
  const body = document.createElementNS(ns, 'rect');
  body.setAttribute('x', '1');
  body.setAttribute('y', '6');
  body.setAttribute('width', '10');
  body.setAttribute('height', '7.5');
  body.setAttribute('rx', '1.8');
  body.setAttribute('fill', 'currentColor');
  svg.append(shackle, body);
  span.append(svg);
  return span;
}
