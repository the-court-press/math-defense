// Headless balance check: plays every stage with simulated players of different
// skill and reports win rate, stars and lives left. Run with: npm run balance
// The bracket shows how often each star was earned: won the stage, kept 90% of lives,
// and at least 80% of answers right.

declare const process: { argv: string[] };

import { Battle, JAM, towerStats, upgradeCost } from '../src/sim/battle';
import { ALL_STAGES } from '../src/content/regions';
import { TOWERS } from '../src/content/units';
import { Path } from '../src/sim/path';
import { Rng } from '../src/core/rng';
import type { SiteDigit, StageDef } from '../src/content/types';

interface Profile {
  name: string;
  accuracy: number;
  /** Seconds to solve a main-tier riddle. */
  think: number;
  math: boolean;
  /** Game speed setting (Calm is 0.6). Only the real-time "Steady!" pause depends on it. */
  speed?: number;
}

const PROFILES: Profile[] = [
  { name: 'strong', accuracy: 0.95, think: 2.5, math: true },
  { name: 'average', accuracy: 0.85, think: 4.0, math: true },
  { name: 'struggling', accuracy: 0.7, think: 6.0, math: true },
  // Calm speed runs the battle at 0.6×, so the same 6 s of real thinking is 3.6 s of battle time.
  { name: 'strug+calm', accuracy: 0.7, think: 3.6, math: true, speed: 0.6 },
  // Answers fast and guesses a lot: half right. Wins on speed, should miss the accuracy star.
  { name: 'guesser', accuracy: 0.5, think: 1.5, math: true },
  { name: 'no-math', accuracy: 0, think: 99, math: false },
];

const TIER_FACTOR = { easy: 0.8, main: 1, hard: 1.3 };

/** Rough relative effort of each topic for an 11-year-old, used to scale think time. */
const EFFORT: Record<string, number> = {
  'm-addsub': 1, 'm-times': 0.9, 'm-divide': 1, 'm-order': 1.4, 'm-negatives': 1.2, 'm-powers': 1,
  'm-fractions': 1.3, 'm-percent': 1.3, 'm-decimals': 1.3, 'm-substitution': 1.5, 'm-equations1': 1.3,
  'm-equations2': 1.8, 'm-equations3': 2.4, 'm-sequences': 1.3,
};

function coverage(stage: StageDef, pos: { x: number; y: number }, range: number): number {
  let c = 0;
  for (const pts of stage.paths) {
    const p = new Path(pts);
    for (let d = 0; d < p.length; d += 5) {
      const q = p.at(d);
      if (Math.hypot(q.x - pos.x, q.y - pos.y) <= range) c += 5;
    }
  }
  return c;
}

/** Spends gold the way a sensible player would: math engines on the busiest road, slings for swarms. */
function spend(b: Battle, profile: Profile): void {
  const stage = b.stage;
  for (let guard = 0; guard < 12; guard++) {
    const free = (Object.keys(stage.sites).map(Number) as SiteDigit[]).filter((s) => !b.towers.has(s));
    const towers = [...b.towers.values()];
    const counts: Record<string, number> = {};
    for (const t of towers) counts[t.def.id] = (counts[t.def.id] ?? 0) + 1;

    // Read the wave preview like a player would: swarms need slings.
    const next = stage.waves[b.waveIndex];
    const swarm = next ? next.groups.some((g) => g.enemy === 'mites') : false;
    let wantId: string;
    if (!profile.math) wantId = 'sling';
    else if (swarm && (counts.sling ?? 0) < 2) wantId = 'sling';
    else if ((counts.sling ?? 0) < Math.ceil(((counts.ballista ?? 0) + (counts.catapult ?? 0)) / 2)) wantId = 'sling';
    else if (stage.towers.includes('catapult') && (counts.catapult ?? 0) < 1 && (counts.ballista ?? 0) >= 2) wantId = 'catapult';
    else if (stage.towers.includes('mirror') && (counts.mirror ?? 0) < 1 && (counts.ballista ?? 0) >= 3) wantId = 'mirror';
    else wantId = 'ballista';

    // Once three math engines stand, deepen them before spreading thin.
    const mathCount = towers.filter((t) => t.def.kind === 'math').length;
    if (profile.math && mathCount >= 3 && !(swarm && (counts.sling ?? 0) < 2)) {
      const up = towers
        .filter((t) => t.def.kind === 'math' && upgradeCost(t.def, t.level) !== null)
        .map((t) => ({ t, c: coverage(stage, t, towerStats(t.def, t.level).range), cost: upgradeCost(t.def, t.level)! }))
        .sort((x, y) => y.c - x.c)[0];
      if (up && up.t.level < 2) {
        if (up.cost > b.gold) return;
        b.upgrade(up.t.site);
        continue;
      }
    }
    const def = TOWERS[wantId];
    if (free.length && b.gold >= def.cost) {
      const best = free
        .map((s) => ({ s, c: coverage(stage, stage.sites[s]!, def.range) }))
        .sort((x, y) => y.c - x.c)[0];
      b.build(best.s, wantId);
      continue;
    }
    // No free site we can afford: save for one, or upgrade once the board is full.
    if (free.length) return;
    const up = towers
      .filter((t) => (profile.math || t.def.kind === 'light') && upgradeCost(t.def, t.level) !== null)
      .map((t) => ({ t, c: coverage(stage, t, towerStats(t.def, t.level).range), cost: upgradeCost(t.def, t.level)! }))
      .filter((u) => u.cost <= b.gold)
      .sort((x, y) => y.c - x.c)[0];
    if (!up) return;
    b.upgrade(up.t.site);
  }
}

function play(stage: StageDef, profile: Profile, seed: number) {
  const b = new Battle(stage, seed);
  b.speed = profile.speed ?? 1;
  const rng = new Rng(seed * 7 + 3);
  const dt = 1 / 30;
  let thinking: { id: number; until: number } | null = null;
  spend(b, profile);
  b.startWave();
  let t = 0;
  const leaks = stage.waves.map(() => 0);
  while (b.phase !== 'won' && b.phase !== 'lost' && t < 3600) {
    t += dt;
    b.step(dt);
    for (const ev of b.drainEvents()) if (ev.type === 'leak') leaks[b.waveIndex - 1] += ev.lives;
    if (b.phase === 'planning') {
      spend(b, profile);
      b.startWave();
      continue;
    }
    if (!profile.math) continue;
    if (b.clawCharge >= 5) b.useClaw();
    if (thinking) {
      const e = b.enemies.find((x) => x.id === thinking!.id);
      if (!e || !e.riddle || e.locked) thinking = null;
      else if (t >= thinking.until && b.steadyLeft <= 0) {
        // While "Steady!" is up, Enter is refused: the bot keeps its answer and presses again.
        if (rng.chance(profile.accuracy)) b.submitAnswer(String(e.riddle.answer));
        else b.submitAnswer(String(e.riddle.answer + (rng.chance(0.5) ? 1 : -1) * rng.int(1, 5)));
        thinking = null;
      }
    } else {
      // Work on the open riddle nearest the gate that is already on screen.
      const target = b.enemies
        .filter((e) => e.alive && e.riddle && !e.locked && e.d > 20)
        .sort((x, y) => b.remaining(x) - b.remaining(y))[0];
      if (target) {
        const tier = target.def.tier ?? 'main';
        const effort = EFFORT[target.riddle!.topic] ?? 1;
        thinking = { id: target.id, until: t + profile.think * effort * TIER_FACTOR[tier] * rng.range(0.7, 1.3) };
      }
    }
  }
  return { won: b.phase === 'won', stars: b.stars(), earned: b.starsEarned(), lives: b.lives, leaks };
}

// Optional: --jam=base,step,window,max tries other jam values without editing the game.
const flags = process.argv.slice(2).filter((a) => a.startsWith('--'));
const args = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const jamFlag = flags.find((f) => f.startsWith('--jam='));
if (jamFlag) {
  const [base, step, window, max, all, steadyBase, steadyStep, steadyMax] = jamFlag.slice(6).split(',').map(Number);
  Object.assign(JAM, { base, step, window, max, all: all === undefined ? JAM.all : all === 1 });
  if (steadyBase !== undefined) Object.assign(JAM, { steadyBase, steadyStep, steadyMax });
}
console.log(`jam: ${JAM.base}s, +${JAM.step}s per repeat miss within ${JAM.window}s, max ${JAM.max}s, ${JAM.all ? 'all math engines' : 'engines in range'}; steady ${JAM.steadyBase}s +${JAM.steadyStep}s max ${JAM.steadyMax}s`);
const only = args[0];
const runsFlag = flags.find((f) => f.startsWith('--runs='));
const RUNS = runsFlag ? Number(runsFlag.slice(7)) : 12;
for (const stage of ALL_STAGES) {
  if (only && only !== 'all' && stage.id !== only) continue;
  const row: string[] = [];
  const pick = args[1]?.split(',');
  for (const p of PROFILES.filter((x) => !pick || pick.includes(x.name))) {
    let wins = 0, stars = 0, lives = 0;
    const got = [0, 0, 0];
    const leaks = stage.waves.map(() => 0);
    for (let i = 0; i < RUNS; i++) {
      const r = play(stage, p, 1000 + i * 17);
      if (r.won) wins++;
      stars += r.stars;
      r.earned.forEach((e, k) => (got[k] += e ? 1 : 0));
      lives += r.lives;
      r.leaks.forEach((l, w) => (leaks[w] += l));
    }
    const perWave = leaks.map((l) => (l / RUNS).toFixed(1).padStart(4)).join(' ');
    const pct = (n: number) => `${String(Math.round((n / RUNS) * 100)).padStart(3)}%`;
    row.push(
      `${p.name.padEnd(10)} win ${pct(wins)}  ★${(stars / RUNS).toFixed(1)}  [won ${pct(got[0])} · lives ${pct(got[1])} · aim ${pct(got[2])}]  ♥${(lives / RUNS).toFixed(0).padStart(2)}   leaks/wave ${perWave}`,
    );
  }
  console.log(`${stage.id} ${stage.name}\n  ${row.join('\n  ')}`);
}
