// Test runner: bundled by esbuild and run in Node (npm test).
// 1. Every grammar is checked by an independent evaluator that re-reads the
//    displayed text, so a riddle can never show one thing and expect another.
// 2. Every stage is validated (sites clear of roads, references resolve).
// 3. The progress code round-trips and rejects typos.
// 4. Answers lock the right Fogling, and misses are read the way a player meant them.

declare const process: { exit(code: number): void };

import { Rng } from '../src/core/rng';
import { GRAMMARS, MINUS } from '../src/content/grammars';
import { REGIONS, ALL_STAGES, STAGE_BY_ID, STAGE_SLOTS } from '../src/content/regions';
import { ENEMIES, TOWERS } from '../src/content/units';
import { NOTE_BY_ID, NOTES } from '../src/content/notes';
import { Path } from '../src/sim/path';
import { encodeProgress, decodeProgress } from '../src/core/progressCode';
import { loadSave, totalStars, isUnlocked, noteUnlocked } from '../src/core/save';
import { Battle, JAM, STAR_ACCURACY, STAR_LIVES } from '../src/sim/battle';
import { mapKeyEvent } from '../src/core/input';
import type { GrammarParams, Riddle, SiteDigit } from '../src/content/types';

let failures = 0;
function fail(msg: string) {
  failures++;
  console.log('  FAIL ' + msg);
}

const SUPS: Record<string, string> = { '⁰': '0', '¹': '1', '²': '2', '³': '3', '⁴': '4', '⁵': '5', '⁶': '6', '⁷': '7', '⁸': '8', '⁹': '9' };

/** Turns displayed math into a JS expression. */
function toJs(text: string, x?: number): string {
  let s = text.split(MINUS).join('-').split('×').join('*').split('÷').join('/');
  s = s.replace(/([0-9x)])([⁰¹²³⁴⁵⁶⁷⁸⁹]+)/g, (_m, base, p) => `${base}**${p.split('').map((c: string) => SUPS[c]).join('')}`);
  s = s.replace(/√(\d+)/g, 'Math.sqrt($1)');
  s = s.replace(/(\d+)% of (\d+)/g, '($1/100*$2)');
  s = s.replace(/(\d+)\/(\d+) of (\d+)/g, '($1/$2*$3)');
  s = s.replace(/(\d)\(/g, '$1*(');
  s = s.replace(/(\d)x/g, '$1*x');
  if (x !== undefined) s = s.split('x').join(`(${x})`);
  return s;
}

function evaluate(expr: string): number {
  // eslint-disable-next-line no-new-func
  return Function(`"use strict"; return (${expr});`)() as number;
}

function checkRiddle(id: string, r: Riddle): string | null {
  if (!Number.isFinite(r.answer)) return 'answer not finite';
  const typed = String(Math.abs(r.answer)).length + (r.answer < 0 ? 1 : 0);
  if (typed > 6) return `answer ${r.answer} too long to type`;
  if (Math.abs(r.answer * 100 - Math.round(r.answer * 100)) > 1e-9) return 'answer has more than 2 decimals';
  for (const line of r.lines) if (line.length > 22) return `line too long: "${line}"`;

  if (id === 'seq') {
    const terms = r.lines[0].replace(', ?', '').split(', ').map((t) => evaluate(toJs(t)));
    const d = terms[1] - terms[0];
    for (let i = 2; i < terms.length; i++) if (terms[i] - terms[i - 1] !== d) return 'not arithmetic';
    return terms[terms.length - 1] + d === r.answer ? null : 'wrong next term';
  }
  if (r.ask === 'x') {
    const [lhs, rhs] = r.lines[0].split(' = ');
    const a = evaluate(toJs(lhs, r.answer));
    const b = evaluate(toJs(rhs, r.answer));
    return Math.abs(a - b) < 1e-9 ? null : `x=${r.answer} does not satisfy ${r.lines[0]}`;
  }
  if (r.lines.length === 2 && r.lines[0].startsWith('x = ')) {
    const x = evaluate(toJs(r.lines[0].slice(4)));
    const v = evaluate(toJs(r.lines[1], x));
    return Math.abs(v - r.answer) < 1e-9 ? null : `substitution gives ${v}, expected ${r.answer}`;
  }
  const v = evaluate(toJs(r.lines[0]));
  return Math.abs(v - r.answer) < 1e-9 ? null : `"${r.lines[0]}" evaluates to ${v}, riddle says ${r.answer}`;
}

// ---------------------------------------------------------------- grammars
console.log('Grammars');
const paramSets: GrammarParams[] = [{}, { neg: true }, { mixed: true }, { lo: 2, hi: 9 }, { max: 40 }];
for (const [id, g] of Object.entries(GRAMMARS)) {
  const rng = new Rng(1234);
  let n = 0;
  for (const params of paramSets) {
    for (let i = 0; i < 800; i++) {
      const r = g.generate(rng, params);
      const err = checkRiddle(id, r);
      n++;
      if (err) {
        fail(`${id} ${JSON.stringify(params)}: ${err} [${r.lines.join(' | ')}]`);
        break;
      }
    }
  }
  console.log(`  ok ${id} (${n} riddles)`);
}

// ---------------------------------------------------------------- fractions in lowest terms
console.log('Fractions');
{
  const gcd = (a: number, b: number): number => (b ? gcd(b, a % b) : a);
  const rng = new Rng(99);
  const seen = new Set<string>();
  let bad = 0;
  for (let i = 0; i < 20000; i++) {
    const r = GRAMMARS.fracof.generate(rng, i % 2 ? {} : { kMax: 20 });
    const m = r.lines[0].match(/^(\d+)\/(\d+) of (\d+)$/);
    if (!m) { fail(`fracof text "${r.lines[0]}" not in "a/b of n" form`); break; }
    const [a, b] = [Number(m[1]), Number(m[2])];
    if (gcd(a, b) !== 1 || a >= b || a < 1) { bad++; if (bad === 1) fail(`fraction not in lowest terms: ${r.lines[0]}`); }
    if (!Number.isInteger(r.answer)) fail(`fraction answer not whole: ${r.lines[0]} = ${r.answer}`);
    seen.add(`${a}/${b}`);
  }
  // Every proper fraction in lowest terms with these denominators should still turn up.
  const expected = [2, 3, 4, 5, 6, 8, 10].flatMap((q) => Array.from({ length: q - 1 }, (_, i) => i + 1).filter((t) => gcd(t, q) === 1).map((t) => `${t}/${q}`));
  for (const f of expected) if (!seen.has(f)) fail(`fraction ${f} never generated`);
  if (seen.size !== expected.length) fail(`unexpected fractions: ${[...seen].filter((f) => !expected.includes(f)).join(', ')}`);
  console.log(`  ok 20000 riddles, ${seen.size} distinct fractions, all in lowest terms with whole answers`);
}

// ---------------------------------------------------------------- content
console.log('Content');
for (const stage of ALL_STAGES) {
  const paths = stage.paths.map((p) => new Path(p));
  const report: string[] = [];
  for (const [k, pos] of Object.entries(stage.sites)) {
    if (!pos) continue;
    const near = Math.min(...paths.map((p) => p.distanceTo(pos)));
    if (near < 46) fail(`${stage.id} site ${k} is ${near.toFixed(0)}px from a road`);
    if (pos.x < 40 || pos.x > 920 || pos.y < 70 || pos.y > 470) fail(`${stage.id} site ${k} out of bounds`);
    // How much road a ballista on this site would cover.
    let covered = 0;
    for (const p of paths)
      for (let d = 0; d < p.length; d += 5) {
        const q = p.at(d);
        if (Math.hypot(q.x - pos.x, q.y - pos.y) <= TOWERS.ballista.range) covered += 5;
      }
    report.push(`${k}:${near.toFixed(0)}/${covered}`);
  }
  for (const w of stage.waves) for (const g of w.groups) if (!ENEMIES[g.enemy]) fail(`${stage.id} unknown enemy ${g.enemy}`);
  for (const t of stage.towers) if (!TOWERS[t]) fail(`${stage.id} unknown tower ${t}`);
  for (const pb of stage.prebuilt ?? []) if (!stage.sites[pb.site as SiteDigit]) fail(`${stage.id} prebuilt on missing site`);
  for (const tier of ['easy', 'main', 'hard'] as const)
    for (const ref of stage.math[tier]) if (!GRAMMARS[ref.id]) fail(`${stage.id} unknown grammar ${ref.id}`);
  for (const r of stage.requires) if (!STAGE_BY_ID[r]) fail(`${stage.id} requires missing ${r}`);
  for (const n of Object.values(stage.nav)) if (n && !STAGE_BY_ID[n]) fail(`${stage.id} nav to missing ${n}`);
  for (const n of stage.introduces) if (!NOTE_BY_ID[n]) fail(`${stage.id} introduces missing note ${n}`);
  if (!STAGE_SLOTS.includes(stage.id)) fail(`${stage.id} has no progress-code slot`);
  console.log(`  ok ${stage.id} sites (dist/coverage) ${report.join(' ')}`);
}
if (REGIONS.filter((r) => r.available).length < 1) fail('no playable region');

// ---------------------------------------------------------------- progress code
console.log('Progress code');
{
  const stars: Record<string, number> = { 'syr-1': 3, 'syr-2': 2, 'syr-3': 1, 'syr-5': 3 };
  const code = encodeProgress(stars);
  const back = decodeProgress(code);
  if (!back) fail('code did not decode');
  else for (const id of STAGE_SLOTS) if ((back[id] ?? 0) !== (stars[id] ?? 0)) fail(`code round trip lost ${id}`);
  const digits = code.replace(/\D/g, '');
  const typo = digits.slice(0, 5) + ((Number(digits[5]) + 1) % 10) + digits.slice(6);
  if (decodeProgress(typo)) fail('typo was accepted');
  const swap = digits.slice(0, 3) + digits[4] + digits[3] + digits.slice(5);
  if (digits[3] !== digits[4] && decodeProgress(swap)) fail('swapped digits were accepted');
  if (decodeProgress(encodeProgress({})) === null) fail('empty progress code rejected');
  console.log(`  ok ${code}`);
}

// ---------------------------------------------------------------- answers
console.log('Answers');
{
  const b = new Battle(STAGE_BY_ID['syr-3'], 7);
  b.startWave();
  for (let i = 0; i < 4000 && b.enemies.filter((e) => e.riddle).length < 2; i++) b.step(1 / 60);
  const [e1, e2] = b.enemies.filter((e) => e.riddle);
  if (!e1 || !e2) fail('could not get two riddles on the road');
  else {
    e1.riddle = { ...e1.riddle!, answer: 12 };
    e2.riddle = { ...e2.riddle!, answer: -10 };
    b.drainEvents();
    b.submitAnswer('-12');
    const miss = b.drainEvents().find((e) => e.type === 'answerMiss');
    if (!miss || miss.type !== 'answerMiss' || miss.kind !== 'sign' || miss.enemy !== e1) fail('typing −12 for 12 should read as a sign slip on that Fogling');
    if (b.submitAnswer('-10')) fail('an answer straight after a miss should wait for "Steady!"');
    if (e2.locked) fail('an answer during "Steady!" locked a Fogling');
    b.steadyUntil = 0; // skip the pause; the jam tests below cover its timing
    b.submitAnswer('-10');
    if (!e2.locked) fail('a correct answer did not lock its Fogling');
    b.steadyUntil = 0;
    b.submitAnswer('15');
    const short = b.drainEvents().find((e) => e.type === 'answerMiss');
    if (!short || short.type !== 'answerMiss' || short.kind !== 'long' || short.enemy !== e1) fail('15 for 12 should land long');
    console.log('  ok lock, sign slip, long');
  }
}

// ---------------------------------------------------------------- the jam and "Steady!"
console.log('Jam');
{
  const near = (a: number, b: number) => Math.abs(a - b) < 1e-6;
  const setup = (speed = 1) => {
    const b = new Battle(STAGE_BY_ID['syr-1'], 3); // prebuilt: ballista on 5, sling on 8
    b.speed = speed;
    b.startWave();
    for (let i = 0; i < 6000 && b.enemies.filter((e) => e.riddle).length < 1; i++) b.step(1 / 60);
    b.drainEvents();
    return b;
  };
  const wrongFor = (b: Battle) => String(b.enemies.find((e) => e.riddle && !e.locked)!.riddle!.answer + 1000);
  const ballista = (b: Battle) => b.towers.get(5)!;
  const sling = (b: Battle) => b.towers.get(8)!;

  // One miss: every math engine jams for the base time, slings do not, and answers wait.
  let b = setup();
  b.submitAnswer(wrongFor(b));
  const jam = b.drainEvents().find((e) => e.type === 'jam');
  if (!jam || jam.type !== 'jam' || !near(jam.seconds, JAM.base) || jam.chain !== 0) fail(`first miss should jam for ${JAM.base}s`);
  if (!near(ballista(b).jam, JAM.base)) fail('the ballista did not jam');
  if (sling(b).jam !== 0) fail('a Sling Post jammed');
  if (!near(b.steadyLeft, JAM.steadyBase)) fail(`"Steady!" should last ${JAM.steadyBase}s, got ${b.steadyLeft}`);
  const target = b.enemies.find((e) => e.riddle && !e.locked)!;
  if (b.submitAnswer(String(target.riddle!.answer)) || target.locked) fail('a right answer during "Steady!" was taken');
  if (!b.drainEvents().some((e) => e.type === 'steady')) fail('no steady event when Enter is pressed too soon');
  // A jammed engine holds its fire even at a locked Fogling in range, then fires once clear.
  const before = ballista(b).sinceFire;
  for (let i = 0; i < 60 * (JAM.base - 0.1); i++) b.step(1 / 60);
  if (ballista(b).jam <= 0 || ballista(b).sinceFire < before) fail('the jam did not hold for its full time');
  for (let i = 0; i < 30; i++) b.step(1 / 60);
  if (ballista(b).jam !== 0) fail('the jam did not clear');
  for (let i = 0; i < 60 * JAM.steadyBase; i++) b.step(1 / 60);
  if (b.steadyLeft !== 0) fail('"Steady!" did not end');

  // A quick repeat miss (within the window after "Steady!" ends) escalates, up to the caps.
  b = setup();
  const steadies: number[] = [];
  const jams: number[] = [];
  for (let k = 0; k < 4; k++) {
    for (let i = 0; i < 6000 && b.steadyLeft > 0; i++) b.step(1 / 60);
    b.submitAnswer(wrongFor(b));
    steadies.push(Math.round(b.steadyLeft * 100) / 100);
    jams.push(Math.round(ballista(b).jam * 100) / 100);
  }
  const wantSteady = [0, 1, 2, 3].map((c) => Math.min(JAM.steadyMax, JAM.steadyBase + JAM.steadyStep * c));
  const wantJam = [0, 1, 2, 3].map((c) => Math.min(JAM.max, JAM.base + JAM.step * c));
  if (steadies.join() !== wantSteady.join()) fail(`quick repeat misses: steady ${steadies} want ${wantSteady}`);
  if (jams.join() !== wantJam.join()) fail(`quick repeat misses: jam ${jams} want ${wantJam}`);

  // A slow, careful second miss does not escalate; nor does a miss after a right answer.
  b = setup();
  b.submitAnswer(wrongFor(b));
  for (let i = 0; i < 60 * (JAM.steadyBase + JAM.window + 0.5); i++) b.step(1 / 60);
  b.submitAnswer(wrongFor(b));
  if (!near(b.steadyLeft, JAM.steadyBase)) fail('a miss made after thinking escalated "Steady!"');
  b = setup();
  b.submitAnswer(wrongFor(b));
  for (let i = 0; i < 6000 && b.steadyLeft > 0; i++) b.step(1 / 60);
  const open = b.enemies.find((e) => e.riddle && !e.locked);
  if (open) {
    b.submitAnswer(String(open.riddle!.answer));
    if (b.enemies.some((e) => e.riddle && !e.locked)) {
      b.submitAnswer(wrongFor(b));
      if (!near(b.steadyLeft, JAM.steadyBase)) fail('a miss after a right answer escalated "Steady!"');
    }
  }

  // "Steady!" is thinking time, so it is real seconds: at Calm speed it covers less battle time.
  b = setup(0.6);
  b.submitAnswer(wrongFor(b));
  if (!near(b.steadyLeft, JAM.steadyBase * 0.6)) fail('"Steady!" should scale with game speed');
  if (!near(ballista(b).jam, JAM.base)) fail('the engine jam should not scale with game speed');
  console.log(`  ok jam ${wantJam.join('/')}s, steady ${wantSteady.join('/')}s, slings never jam, careful misses do not escalate`);
}

// ---------------------------------------------------------------- stars
console.log('Stars');
{
  const st = STAGE_BY_ID['syr-1'];
  const run = (won: boolean, lives: number, correct: number, wrong: number) => {
    const b = new Battle(st, 1);
    b.phase = won ? 'won' : 'lost';
    b.lives = lives;
    b.stats.correct = correct;
    b.stats.wrong = wrong;
    b.stats.attempts = correct + wrong;
    return { earned: b.starsEarned().map((x) => (x ? 1 : 0)).join(''), n: b.stars() };
  };
  const max = st.lives;
  const keep = Math.ceil(max * STAR_LIVES);
  const cases: [string, ReturnType<typeof run>, string, number][] = [
    ['lost', run(false, 0, 50, 0), '000', 0],
    ['won, all lives, 100%', run(true, max, 40, 0), '111', 3],
    ['won, all lives, exactly 80%', run(true, max, 40, 10), '111', 3],
    ['won, all lives, 79%', run(true, max, 79, 21), '110', 2],
    ['won, guesser 50%', run(true, max, 20, 20), '110', 2],
    [`won, ${keep} lives (90%), 90%`, run(true, keep, 9, 1), '111', 3],
    [`won, ${keep - 1} lives, 90%`, run(true, keep - 1, 9, 1), '101', 2],
    ['won, 1 life, 50%', run(true, 1, 5, 5), '100', 1],
    ['won, no answers at all', run(true, max, 0, 0), '110', 2],
  ];
  for (const [name, got, earned, n] of cases)
    if (got.earned !== earned || got.n !== n) fail(`stars ${name}: got ${got.earned}/${got.n}, want ${earned}/${n}`);
  if (STAR_ACCURACY !== 0.8) fail('accuracy star should be 80%');
  console.log(`  ok ${cases.length} cases (win / ${Math.round(STAR_LIVES * 100)}% lives / ${Math.round(STAR_ACCURACY * 100)}% right)`);
}

// ---------------------------------------------------------------- old saves (0.1.0) still load
console.log('Save compatibility');
{
  const store = new Map<string, string>();
  const g = globalThis as unknown as Record<string, unknown>;
  g.localStorage = { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => void store.set(k, v), removeItem: (k: string) => void store.delete(k) };
  g.matchMedia = () => ({ matches: false });
  // A save written by 0.1.0 (copied from a real 0.1.0 session).
  const old = { v: 1, stars: { 'syr-1': 3, 'syr-2': 1 }, records: { 'syr-1': { bestStars: 3, clears: 1, bestAccuracy: 0.98, bestStreak: 53 } }, seen: ['m-addsub', 'p-archimedes'], settings: { sound: true, speed: 'standard', pad: 'auto', motion: 'full' } };
  store.set('math-defense:save:v1', JSON.stringify(old));
  const save = loadSave();
  if (save.stars['syr-1'] !== 3 || save.stars['syr-2'] !== 1) fail('0.1.0 save lost its stars');
  if (totalStars(save) !== 4) fail('0.1.0 save total stars changed');
  if (!isUnlocked(save, 'syr-3')) fail('0.1.0 save no longer unlocks syr-3');
  if (save.records['syr-1']?.bestAccuracy !== 0.98) fail('0.1.0 save lost its records');
  // A progress code written by 0.1.0 still decodes to the same stars.
  // Codes produced by the 0.1.0 encoder: the same stars must give the same digits, both ways.
  if (encodeProgress(save.stars) !== '1000 0000 0000 0007 39') fail('0.1.0 save no longer encodes to its 0.1.0 code');
  const back = decodeProgress('1000 0000 0000 0795 03');
  if (!back || back['syr-1'] !== 3 || back['syr-2'] !== 2 || back['syr-3'] !== 1 || back['syr-5'] !== 3) fail('0.1.0 progress code decodes differently');
  console.log('  ok 0.1.0 save and progress code load unchanged');
  // A save from before the rename (0.1.0 to 0.1.2) keeps its Notes entry under the new id.
  store.set('math-defense:save:v1', JSON.stringify({ ...old, stars: {}, seen: ['e-muddle', 'm-addsub'] }));
  const renamed = loadSave();
  if (!noteUnlocked(renamed, 'e-fogling')) fail('a pre-rename save lost its Fogling note');
  if (renamed.seen.length !== 2 || !renamed.seen.includes('m-addsub')) fail('the rename changed other seen notes');
  if (!NOTES.some((n) => n.id === 'e-fogling')) fail('no Fogling note in the Notes book');
  console.log('  ok pre-rename save keeps its Fogling note');
}

// ---------------------------------------------------------------- keys
console.log('Keys');
{
  const k = (code: string, key: string) => mapKeyEvent({ code, key, ctrlKey: false, metaKey: false, altKey: false } as KeyboardEvent);
  const want: [string, string, string][] = [
    ['NumpadDivide', '/', '/'],
    ['Slash', '/', '/'],
    ['Escape', 'Escape', 'esc'],
    ['NumLock', 'NumLock', 'esc'],
    ['NumpadClear', 'Clear', 'esc'],
    ['Backspace', 'Backspace', 'bksp'],
  ];
  for (const [code, key, nk] of want) if (k(code, key) !== nk) fail(`${code} should map to ${nk}, got ${k(code, key)}`);
  console.log('  ok / is delete; Esc, NumLock and Clear are menu/back');
}

console.log(failures ? `\n${failures} failure(s)` : '\nAll tests passed');
process.exit(failures ? 1 : 0);
