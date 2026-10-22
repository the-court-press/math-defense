// Math grammars: small generators that each produce one kind of riddle.
// A stage lists which grammars (and parameters) each Fogling tier draws from,
// so new topics are added here once and reused by any number of stages.

import type { GrammarDef, GrammarParams, Riddle } from './types';

export const MINUS = '−';

/** Formats a number for display: real minus sign, no trailing zeros. */
export function fmt(v: number): string {
  const r = Math.round(v * 100) / 100;
  return (r < 0 ? MINUS : '') + String(Math.abs(r));
}

/** Wraps negatives in brackets when they follow an operator. */
function par(v: number): string {
  return v < 0 ? `(${fmt(v)})` : fmt(v);
}

function coef(a: number, v = 'x'): string {
  if (a === 1) return v;
  if (a === -1) return MINUS + v;
  return fmt(a) + v;
}

/** " + 5" or " − 5" for a trailing term. */
function tail(b: number): string {
  return b < 0 ? ` ${MINUS} ${fmt(-b)}` : ` + ${fmt(b)}`;
}

const SUP: Record<string, string> = { '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴', '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹' };
function sup(n: number): string {
  return String(n)
    .split('')
    .map((c) => SUP[c] ?? c)
    .join('');
}

function gcd(a: number, b: number): number {
  return b ? gcd(b, a % b) : Math.abs(a);
}

function num(p: GrammarParams, key: string, dflt: number): number {
  const v = p[key];
  return typeof v === 'number' ? v : dflt;
}

function flag(p: GrammarParams, key: string): boolean {
  return p[key] === true;
}

function r(lines: string[], answer: number, topic: string, ask?: string): Riddle {
  return { lines, answer: Math.round(answer * 100) / 100, topic, ask };
}

const list: GrammarDef[] = [
  {
    id: 'add',
    topic: 'm-addsub',
    generate(g, p) {
      const lo = num(p, 'lo', 10);
      const hi = num(p, 'hi', 99);
      const a = g.int(lo, hi);
      const b = g.int(lo, hi);
      return r([`${a} + ${b}`], a + b, this.topic);
    },
  },
  {
    id: 'sub',
    topic: 'm-addsub',
    generate(g, p) {
      const lo = num(p, 'lo', 10);
      const hi = num(p, 'hi', 99);
      let a = g.int(lo, hi);
      let b = g.int(lo, hi);
      if (!flag(p, 'neg') && b > a) [a, b] = [b, a];
      if (a === b) a += 1;
      return r([`${a} ${MINUS} ${b}`], a - b, this.topic);
    },
  },
  {
    id: 'mul',
    topic: 'm-times',
    generate(g, p) {
      const a = g.int(num(p, 'aLo', 2), num(p, 'aHi', 12));
      const b = g.int(num(p, 'bLo', 2), num(p, 'bHi', 12));
      return r([`${a} × ${b}`], a * b, this.topic);
    },
  },
  {
    id: 'div',
    topic: 'm-divide',
    generate(g, p) {
      const d = g.int(num(p, 'dLo', 2), num(p, 'dHi', 12));
      const q = g.int(num(p, 'qLo', 2), num(p, 'qHi', 12));
      return r([`${d * q} ÷ ${d}`], q, this.topic);
    },
  },
  {
    id: 'order',
    topic: 'm-order',
    generate(g) {
      const form = g.int(1, 7);
      switch (form) {
        case 1: {
          const a = g.int(2, 20), b = g.int(2, 9), c = g.int(2, 9);
          return r([`${a} + ${b} × ${c}`], a + b * c, this.topic);
        }
        case 2: {
          const a = g.int(3, 9), b = g.int(3, 9), c = g.int(1, a * b - 1);
          return r([`${a} × ${b} ${MINUS} ${c}`], a * b - c, this.topic);
        }
        case 3: {
          const a = g.int(1, 9), b = g.int(1, 9), c = g.int(2, 6);
          return r([`(${a} + ${b}) × ${c}`], (a + b) * c, this.topic);
        }
        case 4: {
          const b = g.int(2, 6), c = g.int(2, 6), a = b * c + g.int(1, 20);
          return r([`${a} ${MINUS} ${b} × ${c}`], a - b * c, this.topic);
        }
        case 5: {
          const c = g.int(2, 6), b = c * g.int(2, 9), a = g.int(1, 20);
          return r([`${a} + ${b} ÷ ${c}`], a + b / c, this.topic);
        }
        case 6: {
          const a = g.int(2, 6), b = g.int(2, 6), c = g.int(2, 6), d = g.int(2, 6);
          return r([`${a} × ${b} + ${c} × ${d}`], a * b + c * d, this.topic);
        }
        default: {
          const c = g.int(2, 5), k = g.int(2, 9), b = g.int(1, 15), a = b + c * k;
          return r([`(${a} ${MINUS} ${b}) ÷ ${c}`], k, this.topic);
        }
      }
    },
  },
  {
    id: 'negadd',
    topic: 'm-negatives',
    generate(g, p) {
      const m = num(p, 'max', 20);
      let a = g.intNz(-m, m);
      let b = g.intNz(-m, m);
      if (a > 0 && b > 0) {
        if (g.chance(0.5)) a = -a;
        else b = -b;
      }
      if (g.chance(0.5)) return r([`${fmt(a)} + ${par(b)}`], a + b, this.topic);
      return r([`${fmt(a)} ${MINUS} ${par(b)}`], a - b, this.topic);
    },
  },
  {
    id: 'negmul',
    topic: 'm-negatives',
    generate(g, p) {
      const m = num(p, 'max', 12);
      let a = g.int(2, m) * (g.chance(0.5) ? -1 : 1);
      let b = g.int(2, m) * (g.chance(0.5) ? -1 : 1);
      if (a > 0 && b > 0) a = -a;
      if (g.chance(0.5)) return r([`${fmt(a)} × ${par(b)}`], a * b, this.topic);
      return r([`${fmt(a * b)} ÷ ${par(b)}`], a, this.topic);
    },
  },
  {
    id: 'powers',
    topic: 'm-powers',
    generate(g, p) {
      const form = g.int(1, flag(p, 'mixed') ? 5 : 4);
      switch (form) {
        case 1: {
          const n = g.int(2, num(p, 'sqMax', 15));
          return r([`${n}${sup(2)}`], n * n, this.topic);
        }
        case 2: {
          const n = g.int(2, num(p, 'sqMax', 15));
          return r([`√${n * n}`], n, this.topic);
        }
        case 3: {
          const k = g.int(2, 8);
          return r([`2${sup(k)}`], 2 ** k, this.topic);
        }
        case 4: {
          const n = g.int(2, 5);
          return r([`${n}${sup(3)}`], n ** 3, this.topic);
        }
        default: {
          const a = g.int(2, 9), b = g.int(2, 30);
          return r([`${a}${sup(2)} ${MINUS} ${b}`], a * a - b, this.topic);
        }
      }
    },
  },
  {
    id: 'fracof',
    topic: 'm-fractions',
    generate(g, p) {
      // Always in lowest terms (no 4/8 or 2/6): the numerator is coprime with the denominator.
      // n is a multiple of q, so the answer is always a whole number.
      const q = g.pick([2, 3, 4, 5, 6, 8, 10]);
      const tops: number[] = [];
      for (let t = 1; t < q; t++) if (gcd(t, q) === 1) tops.push(t);
      const pp = g.pick(tops);
      const n = q * g.int(2, num(p, 'kMax', 12));
      return r([`${pp}/${q} of ${n}`], (pp * n) / q, this.topic);
    },
  },
  {
    id: 'percent',
    topic: 'm-percent',
    generate(g) {
      const table: [number, number][] = [
        [10, 10], [20, 5], [25, 4], [50, 2], [75, 4], [5, 20], [30, 10], [40, 5], [60, 5], [15, 20],
      ];
      const [pct, step] = g.pick(table);
      const n = step * g.int(Math.ceil(20 / step), Math.floor(400 / step));
      return r([`${pct}% of ${n}`], (pct * n) / 100, this.topic);
    },
  },
  {
    id: 'decimals',
    topic: 'm-decimals',
    generate(g) {
      const form = g.int(1, 4);
      const t = (v: number) => fmt(v / 10);
      if (form === 1) {
        const a = g.int(11, 99), b = g.int(11, 99);
        return r([`${t(a)} + ${t(b)}`], (a + b) / 10, this.topic);
      }
      if (form === 2) {
        let a = g.int(11, 99), b = g.int(11, 99);
        if (b > a) [a, b] = [b, a];
        if (a === b) a += 3;
        return r([`${t(a)} ${MINUS} ${t(b)}`], (a - b) / 10, this.topic);
      }
      if (form === 3) {
        const k = g.int(3, 41);
        return r([`${k} × 0.5`], k / 2, this.topic);
      }
      const a = g.int(11, 49), c = g.int(2, 9);
      return r([`${t(a)} × ${c}`], (a * c) / 10, this.topic);
    },
  },
  {
    id: 'substitute',
    topic: 'm-substitution',
    generate(g, p) {
      const x = flag(p, 'neg') ? g.intNz(-6, 9) : g.int(1, 9);
      const form = g.int(1, 4);
      const head = `x = ${fmt(x)}`;
      if (form === 1) {
        const a = g.int(2, 9), b = g.int(1, 20);
        return r([head, `${coef(a)} + ${b}`], a * x + b, this.topic);
      }
      if (form === 2) {
        const a = g.int(2, 9), b = g.int(1, 20);
        return r([head, `${coef(a)} ${MINUS} ${b}`], a * x - b, this.topic);
      }
      if (form === 3) {
        const b = g.int(1, 20);
        return r([head, `x${sup(2)} + ${b}`], x * x + b, this.topic);
      }
      const a = g.int(2, 6), b = g.int(1, 9);
      return r([head, `${a}(x + ${b})`], a * (x + b), this.topic);
    },
  },
  {
    id: 'eq1',
    topic: 'm-equations1',
    generate(g, p) {
      const x = flag(p, 'neg') ? g.intNz(-12, 20) : g.int(1, 20);
      const form = g.int(1, 4);
      if (form === 1) {
        const a = g.int(2, 30);
        return r([`x + ${a} = ${fmt(x + a)}`], x, this.topic, 'x');
      }
      if (form === 2) {
        const a = g.int(2, 30);
        return r([`x ${MINUS} ${a} = ${fmt(x - a)}`], x, this.topic, 'x');
      }
      if (form === 3) {
        const a = g.int(2, 12);
        return r([`${coef(a)} = ${fmt(a * x)}`], x, this.topic, 'x');
      }
      const a = g.int(2, 9), q = flag(p, 'neg') ? g.intNz(-9, 12) : g.int(1, 12);
      return r([`x ÷ ${a} = ${fmt(q)}`], q * a, this.topic, 'x');
    },
  },
  {
    id: 'eq2',
    topic: 'm-equations2',
    generate(g, p) {
      const a = g.int(2, 9);
      const x = flag(p, 'neg') ? g.intNz(-9, 12) : g.int(1, 12);
      const b = g.int(1, 20);
      if (g.chance(0.5)) return r([`${coef(a)} + ${b} = ${fmt(a * x + b)}`], x, this.topic, 'x');
      return r([`${coef(a)} ${MINUS} ${b} = ${fmt(a * x - b)}`], x, this.topic, 'x');
    },
  },
  {
    id: 'eqboth',
    topic: 'm-equations3',
    generate(g, p) {
      const x = flag(p, 'neg') ? g.intNz(-6, 10) : g.int(1, 10);
      const a = g.int(3, 9);
      const c = g.int(1, a - 1);
      const b = g.intNz(-15, 15);
      const d = (a - c) * x + b;
      const right = d === 0 ? coef(c) : `${coef(c)}${tail(d)}`;
      return r([`${coef(a)}${tail(b)} = ${right}`], x, this.topic, 'x');
    },
  },
  {
    id: 'eqbr',
    topic: 'm-equations3',
    generate(g) {
      const a = g.int(2, 6), b = g.intNz(-5, 9), x = g.int(1, 10);
      const inner = b < 0 ? `x ${MINUS} ${-b}` : `x + ${b}`;
      return r([`${a}(${inner}) = ${fmt(a * (x + b))}`], x, this.topic, 'x');
    },
  },
  {
    id: 'seq',
    topic: 'm-sequences',
    generate(g, p) {
      const d = flag(p, 'neg') ? g.intNz(-9, 12) : g.int(2, 12);
      const s = g.int(flag(p, 'neg') ? -10 : 1, 30);
      const terms = [0, 1, 2, 3].map((i) => fmt(s + i * d));
      return r([`${terms.join(', ')}, ?`], s + 4 * d, this.topic);
    },
  },
];

export const GRAMMARS: Record<string, GrammarDef> = Object.fromEntries(list.map((gd) => [gd.id, gd]));
