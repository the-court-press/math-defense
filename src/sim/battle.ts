// The battle simulation. Pure logic with no drawing: the renderer and UI read its
// state and drain its event queue. Everything runs on simulation time, so pausing
// is simply not calling step().

import { Rng } from '../core/rng';
import { GRAMMARS } from '../content/grammars';
import { ENEMIES, LEVELS, SELL_RATE, TOWERS } from '../content/units';
import type { EnemyDef, Riddle, RiddleTier, SiteDigit, StageDef, TowerDef, Vec } from '../content/types';
import { Path, dist } from './path';

export type Phase = 'planning' | 'wave' | 'won' | 'lost';

export const CLAW_MAX = 5;
/** Share of light damage an unsolved riddle blocks. Solving a Fogling exposes it. */
export const RIDDLE_GUARD = 0.8;
/** Star 2: lives kept, as a share of the stage's lives. */
export const STAR_LIVES = 0.9;
/** Star 3: share of answers that must be right. */
export const STAR_ACCURACY = 0.8;
/**
 * The jam: a wrong answer costs a beat. Every math engine in range of the Fogling you were
 * aiming at jams (smokes, cannot fire) for `base` seconds of battle time. Misses that follow
 * a previous miss within `window` seconds stack `step` more each, up to `max`, so rapid
 * guessing hurts far more than an occasional careful slip. Locks are kept: a Fogling you
 * solved is still locked when the engines clear. Light engines (Sling Posts) never jam.
 * "Steady!": for `steadyBase` seconds after a miss (plus `steadyStep` per quick repeat, up
 * to `steadyMax`) a new answer is not accepted yet. Typing still works; Enter waits.
 * Mutable only so the balance tool can sweep values; the game never changes it.
 */
export const JAM = { base: 2, step: 2, window: 2, max: 8, all: true, steadyBase: 2.5, steadyStep: 4, steadyMax: 10 };
const CLAW_TIME = 1.1;
const CLAW_GRAB_AT = 0.5;

export interface Enemy {
  id: number;
  def: EnemyDef;
  path: number;
  d: number;
  x: number;
  y: number;
  angle: number;
  hp: number;
  maxHp: number;
  slowUntil: number;
  slowFactor: number;
  riddle: Riddle | null;
  locked: boolean;
  layer: number;
  alive: boolean;
  hitFlash: number;
  age: number;
  clawed: boolean;
  phase: number;
}

export interface Tower {
  site: SiteDigit;
  x: number;
  y: number;
  def: TowerDef;
  level: number;
  cooldown: number;
  angle: number;
  spent: number;
  sinceFire: number;
  /** Seconds left jammed after a wrong answer (math engines only). */
  jam: number;
  /** Length of the current jam, for drawing how much of it is left. */
  jamFor: number;
}

export interface Projectile {
  id: number;
  kind: TowerDef['projectile'];
  fromX: number;
  fromY: number;
  x: number;
  y: number;
  targetId: number | null;
  tx: number;
  ty: number;
  t: number;
  dur: number;
  damage: number;
  splash: number;
  slow: TowerDef['slow'];
  light: boolean;
  miss: boolean;
}

export interface ClawState {
  targetId: number;
  t: number;
  x: number;
  y: number;
  grabbed: boolean;
}

export interface MissRecord {
  lines: string[];
  answer: number;
  typed: number;
  topic: string;
}

export type MissKind = 'short' | 'long' | 'sign';

export type BattleEvent =
  | { type: 'spawn'; enemy: Enemy }
  | { type: 'fire'; tower: Tower; miss: boolean }
  | { type: 'impact'; x: number; y: number; kind: Projectile['kind']; splash: number; miss: boolean }
  | { type: 'damage'; enemy: Enemy; amount: number }
  | { type: 'kill'; enemy: Enemy; gold: number }
  | { type: 'leak'; enemy: Enemy; lives: number }
  | { type: 'lock'; enemy: Enemy }
  | { type: 'answerMiss'; typed: number; enemy: Enemy | null; kind: MissKind }
  | { type: 'jam'; towers: Tower[]; seconds: number; chain: number }
  | { type: 'steady'; left: number }
  | { type: 'duplicate'; enemy: Enemy }
  | { type: 'noTarget' }
  | { type: 'newRiddle'; enemy: Enemy }
  | { type: 'waveStart'; wave: number }
  | { type: 'waveClear'; wave: number; bonus: number }
  | { type: 'won' }
  | { type: 'lost' }
  | { type: 'build'; tower: Tower }
  | { type: 'upgrade'; tower: Tower }
  | { type: 'sell'; site: SiteDigit; refund: number }
  | { type: 'clawStart'; enemy: Enemy }
  | { type: 'clawGrab'; enemy: Enemy }
  | { type: 'clawReady' }
  | { type: 'slow'; x: number; y: number; radius: number };

interface Spawn {
  t: number;
  enemy: string;
  path: number;
}

export interface BattleStats {
  attempts: number;
  correct: number;
  wrong: number;
  streak: number;
  bestStreak: number;
  misses: MissRecord[];
  topics: Record<string, { right: number; wrong: number }>;
  leaked: number;
  killed: number;
}

export function towerStats(def: TowerDef, level: number) {
  const L = LEVELS[level];
  return {
    damage: Math.round(def.damage * L.damage),
    range: def.range * L.range,
    reload: def.reload * L.reload,
  };
}

export function upgradeCost(def: TowerDef, level: number): number | null {
  if (level + 1 >= LEVELS.length) return null;
  return Math.round(def.cost * LEVELS[level + 1].costFactor);
}

export function sellValue(t: Tower): number {
  return Math.floor(t.spent * SELL_RATE);
}

export class Battle {
  readonly stage: StageDef;
  readonly paths: Path[];
  readonly rng: Rng;
  phase: Phase = 'planning';
  time = 0;
  waveIndex = 0; // number of waves started
  gold: number;
  lives: number;
  readonly maxLives: number;
  towers = new Map<SiteDigit, Tower>();
  enemies: Enemy[] = [];
  projectiles: Projectile[] = [];
  events: BattleEvent[] = [];
  claw: ClawState | null = null;
  clawCharge = 0;
  stats: BattleStats = {
    attempts: 0,
    correct: 0,
    wrong: 0,
    streak: 0,
    bestStreak: 0,
    misses: [],
    topics: {},
    leaked: 0,
    killed: 0,
  };

  /** Battle time of the last wrong answer, and how many came in a row (for the jam). */
  private lastMissAt = -99;
  private missChain = 0;
  /** Battle time until which a new answer is not accepted (after a miss). */
  steadyUntil = 0;
  /**
   * Game speed (Calm 0.6, Standard 1, Swift 1.25), set by the screen. The "Steady!" pause and
   * the repeat-miss window are a player's thinking time, so they are measured in real
   * seconds: at Calm speed they cover less battle time. The engine jam is battle time.
   */
  speed = 1;
  private schedule: Spawn[] = [];
  private waveTime = 0;
  private nextId = 1;

  constructor(stage: StageDef, seed: number) {
    this.stage = stage;
    this.paths = stage.paths.map((p) => new Path(p));
    this.rng = new Rng(seed);
    this.gold = stage.startGold;
    this.lives = stage.lives;
    this.maxLives = stage.lives;
    for (const pb of stage.prebuilt ?? []) {
      const pos = stage.sites[pb.site];
      if (!pos) continue;
      const def = TOWERS[pb.tower];
      this.towers.set(pb.site, this.makeTower(pb.site, pos, def, def.cost));
    }
  }

  get totalWaves(): number {
    return this.stage.waves.length;
  }

  // ---------------------------------------------------------------- commands

  startWave(): boolean {
    if (this.phase !== 'planning' || this.waveIndex >= this.stage.waves.length) return false;
    const wave = this.stage.waves[this.waveIndex];
    const pace = this.stage.pace ?? 1;
    this.schedule = [];
    for (const g of wave.groups) {
      for (let i = 0; i < g.count; i++) {
        this.schedule.push({ t: ((g.delay ?? 0) + i * g.gap) * pace, enemy: g.enemy, path: g.path ?? 0 });
      }
    }
    this.schedule.sort((a, b) => a.t - b.t);
    this.waveTime = 0;
    this.waveIndex++;
    this.phase = 'wave';
    this.events.push({ type: 'waveStart', wave: this.waveIndex });
    return true;
  }

  /** The player typed an answer and pressed Enter. */
  /** Seconds left before an answer is accepted again (0 when ready). */
  get steadyLeft(): number {
    return Math.max(0, this.steadyUntil - this.time);
  }

  /** Returns false if the answer was not taken because of the "Steady!" pause after a miss. */
  submitAnswer(raw: string): boolean {
    const value = parseFloat(raw);
    if (!Number.isFinite(value)) return true;
    if (this.steadyLeft > 0) {
      this.events.push({ type: 'steady', left: this.steadyLeft });
      return false;
    }
    const open = this.enemies.filter((e) => e.alive && e.riddle && !e.locked);
    const match = open
      .filter((e) => Math.abs(e.riddle!.answer - value) < 1e-6)
      .sort((a, b) => this.remaining(a) - this.remaining(b))[0];

    if (match) {
      this.stats.attempts++;
      this.stats.correct++;
      this.stats.streak++;
      this.stats.bestStreak = Math.max(this.stats.bestStreak, this.stats.streak);
      this.topicStat(match.riddle!.topic, true);
      this.missChain = 0;
      this.lastMissAt = -99;
      match.locked = true;
      this.events.push({ type: 'lock', enemy: match });
      if (this.clawCharge < CLAW_MAX) {
        this.clawCharge++;
        if (this.clawCharge === CLAW_MAX) this.events.push({ type: 'clawReady' });
      }
      return true;
    }

    const dup = this.enemies.find((e) => e.alive && e.riddle && e.locked && Math.abs(e.riddle.answer - value) < 1e-6);
    if (dup) {
      this.events.push({ type: 'duplicate', enemy: dup });
      return true;
    }

    if (open.length === 0) {
      this.events.push({ type: 'noTarget' });
      return true;
    }

    // A miss. Guess which riddle the player was aiming at: an exact sign flip if there is
    // one (the most common slip), otherwise the closest answer.
    const rel = (e: Enemy) => Math.abs(e.riddle!.answer - value) / Math.max(1, Math.abs(e.riddle!.answer));
    const flipped = open.filter((e) => e.riddle!.answer !== 0 && Math.abs(e.riddle!.answer + value) < 1e-6);
    const target = (flipped.length ? flipped : open.slice()).sort((a, b) => rel(a) - rel(b))[0];
    const answer = target.riddle!.answer;
    const kind: MissKind = answer !== 0 && Math.abs(value + answer) < 1e-6 ? 'sign' : value < answer ? 'short' : 'long';

    this.stats.attempts++;
    this.stats.wrong++;
    this.stats.streak = 0;
    this.topicStat(target.riddle!.topic, false);
    if (this.stats.misses.length < 40) {
      this.stats.misses.push({ lines: target.riddle!.lines, answer, typed: value, topic: target.riddle!.topic });
    }
    this.clawCharge = Math.max(0, this.clawCharge - 1);
    this.events.push({ type: 'answerMiss', typed: value, enemy: target, kind });

    // The visible miss: a ready engine in range fires and lands off target.
    const inRange = this.mathTowers().filter((t) => dist(t, target) <= towerStats(t.def, t.level).range);
    const shooter = inRange.filter((t) => t.cooldown <= 0 && t.jam <= 0).sort((a, b) => dist(a, target) - dist(b, target))[0];
    if (shooter) {
      const err = Math.min(3, rel(target));
      const offset = Math.min(150, 50 + 90 * err) * (kind === 'long' ? 1 : -1);
      const path = this.paths[target.path];
      const land = path.at(target.d + offset);
      this.fire(shooter, null, land.x, land.y, true);
    }

    // The jam: the engines aiming at that Fogling lose a beat; quick repeat misses lose more.
    // A repeat miss is one made within `window` seconds of being allowed to answer again.
    const quick = this.lastMissAt >= 0 && this.time - Math.max(this.lastMissAt, this.steadyUntil) <= JAM.window * this.speed;
    this.missChain = quick ? this.missChain + 1 : 0;
    this.lastMissAt = this.time;
    const seconds = Math.min(JAM.max, JAM.base + JAM.step * this.missChain);
    const engines = JAM.all ? this.mathTowers() : inRange;
    if (seconds > 0 && engines.length) {
      for (const t of engines) {
        if (seconds > t.jam) t.jamFor = seconds;
        t.jam = Math.max(t.jam, seconds);
      }
      this.events.push({ type: 'jam', towers: engines, seconds, chain: this.missChain });
    }
    const steady = Math.min(JAM.steadyMax, JAM.steadyBase + JAM.steadyStep * this.missChain);
    if (steady > 0) this.steadyUntil = this.time + steady * this.speed;
    return true;
  }

  build(site: SiteDigit, towerId: string): boolean {
    const pos = this.stage.sites[site];
    const def = TOWERS[towerId];
    if (!pos || !def || this.towers.has(site) || !this.stage.towers.includes(towerId)) return false;
    if (this.gold < def.cost || this.phase === 'won' || this.phase === 'lost') return false;
    this.gold -= def.cost;
    const t = this.makeTower(site, pos, def, def.cost);
    this.towers.set(site, t);
    this.events.push({ type: 'build', tower: t });
    return true;
  }

  upgrade(site: SiteDigit): boolean {
    const t = this.towers.get(site);
    if (!t) return false;
    const cost = upgradeCost(t.def, t.level);
    if (cost === null || this.gold < cost) return false;
    this.gold -= cost;
    t.level++;
    t.spent += cost;
    this.events.push({ type: 'upgrade', tower: t });
    return true;
  }

  sell(site: SiteDigit): boolean {
    const t = this.towers.get(site);
    if (!t) return false;
    const refund = sellValue(t);
    this.gold += refund;
    this.towers.delete(site);
    this.events.push({ type: 'sell', site, refund });
    return true;
  }

  useClaw(): boolean {
    if (this.clawCharge < CLAW_MAX || this.claw || this.phase !== 'wave') return false;
    const target = this.enemies
      .filter((e) => e.alive && !e.clawed)
      .sort((a, b) => this.remaining(a) - this.remaining(b))[0];
    if (!target) return false;
    this.clawCharge = 0;
    this.claw = { targetId: target.id, t: 0, x: target.x, y: target.y, grabbed: false };
    this.events.push({ type: 'clawStart', enemy: target });
    return true;
  }

  // ---------------------------------------------------------------- simulation

  step(dt: number): void {
    if (this.phase === 'won' || this.phase === 'lost') return;
    this.time += dt;

    if (this.phase === 'wave') {
      this.waveTime += dt;
      while (this.schedule.length && this.schedule[0].t <= this.waveTime) {
        const s = this.schedule.shift()!;
        this.spawn(s.enemy, s.path);
      }
    }

    this.moveEnemies(dt);
    this.updateClaw(dt);
    this.updateTowers(dt);
    this.updateProjectiles(dt);
    this.enemies = this.enemies.filter((e) => e.alive);

    if (this.lives <= 0) {
      this.lives = 0;
      this.phase = 'lost';
      this.events.push({ type: 'lost' });
      return;
    }

    if (this.phase === 'wave' && this.schedule.length === 0 && this.enemies.length === 0 && !this.claw) {
      const bonus = 20 + 5 * this.waveIndex;
      this.gold += bonus;
      this.events.push({ type: 'waveClear', wave: this.waveIndex, bonus });
      if (this.waveIndex >= this.stage.waves.length) {
        this.phase = 'won';
        this.events.push({ type: 'won' });
      } else {
        this.phase = 'planning';
      }
    }
  }

  // ---------------------------------------------------------------- internals

  remaining(e: Enemy): number {
    return this.paths[e.path].length - e.d;
  }

  mathTowers(): Tower[] {
    return [...this.towers.values()].filter((t) => t.def.kind === 'math');
  }

  private makeTower(site: SiteDigit, pos: Vec, def: TowerDef, spent: number): Tower {
    return { site, x: pos.x, y: pos.y, def, level: 0, cooldown: 0, angle: -Math.PI / 2, spent, sinceFire: 99, jam: 0, jamFor: 0 };
  }

  private topicStat(topic: string, right: boolean): void {
    const s = (this.stats.topics[topic] ??= { right: 0, wrong: 0 });
    if (right) s.right++;
    else s.wrong++;
  }

  private spawn(enemyId: string, pathIndex: number): void {
    const def = ENEMIES[enemyId];
    const path = this.paths[Math.min(pathIndex, this.paths.length - 1)];
    const start = path.at(0);
    const e: Enemy = {
      id: this.nextId++,
      def,
      path: Math.min(pathIndex, this.paths.length - 1),
      d: 0,
      x: start.x,
      y: start.y,
      angle: start.angle,
      hp: def.hp,
      maxHp: def.hp,
      slowUntil: 0,
      slowFactor: 1,
      riddle: null,
      locked: false,
      layer: 0,
      alive: true,
      hitFlash: 0,
      age: 0,
      clawed: false,
      phase: this.rng.next() * Math.PI * 2,
    };
    if (def.tier) e.riddle = this.makeRiddle(def.tier);
    this.enemies.push(e);
    this.events.push({ type: 'spawn', enemy: e });
  }

  /** Picks a riddle whose answer differs from every riddle already on the field. */
  makeRiddle(tier: RiddleTier): Riddle {
    const pool = this.stage.math[tier].length ? this.stage.math[tier] : this.stage.math.main;
    const taken = new Set(this.enemies.filter((e) => e.alive && e.riddle).map((e) => e.riddle!.answer));
    let riddle: Riddle | null = null;
    for (let i = 0; i < 25; i++) {
      const ref = this.rng.weighted(pool, (g) => g.weight ?? 1);
      const grammar = GRAMMARS[ref.id];
      riddle = grammar.generate(this.rng, ref.params ?? {});
      if (!taken.has(riddle.answer)) return riddle;
    }
    return riddle!;
  }

  private moveEnemies(dt: number): void {
    for (const e of this.enemies) {
      if (!e.alive) continue;
      e.age += dt;
      e.hitFlash = Math.max(0, e.hitFlash - dt);
      if (e.clawed) continue;
      const slow = this.time < e.slowUntil ? e.slowFactor : 1;
      e.d += e.def.speed * slow * dt;
      const path = this.paths[e.path];
      if (e.d >= path.length) {
        e.alive = false;
        this.lives -= e.def.lives;
        this.stats.leaked++;
        this.events.push({ type: 'leak', enemy: e, lives: e.def.lives });
        continue;
      }
      const p = path.at(e.d);
      e.x = p.x;
      e.y = p.y;
      e.angle = p.angle;
    }
  }

  private updateClaw(dt: number): void {
    const c = this.claw;
    if (!c) return;
    c.t += dt;
    const target = this.enemies.find((e) => e.id === c.targetId);
    if (target && !c.grabbed) {
      c.x = target.x;
      c.y = target.y;
    }
    if (!c.grabbed && c.t >= CLAW_GRAB_AT) {
      c.grabbed = true;
      if (target && target.alive) {
        this.events.push({ type: 'clawGrab', enemy: target });
        if (target.def.clawFraction >= 1) {
          target.clawed = true;
        } else {
          this.damage(target, target.maxHp * target.def.clawFraction, false);
        }
      }
    }
    if (c.t >= CLAW_TIME) {
      if (target && target.alive && target.clawed) this.kill(target);
      this.claw = null;
    }
  }

  private updateTowers(dt: number): void {
    for (const t of this.towers.values()) {
      t.cooldown = Math.max(0, t.cooldown - dt);
      t.sinceFire += dt;
      t.jam = Math.max(0, t.jam - dt);
      if (t.cooldown > 0 || t.jam > 0) continue;
      const { range } = towerStats(t.def, t.level);
      let candidates = this.enemies.filter((e) => e.alive && !e.clawed && dist(t, e) <= range);
      if (t.def.kind === 'math') candidates = candidates.filter((e) => e.locked);
      if (!candidates.length) continue;
      // Light engines prefer what they can actually hurt: solved Foglings and riddle-less swarms.
      const exposed = (e: Enemy) => (t.def.kind === 'light' ? this.lightFactor(e) : 1);
      const target = candidates.sort((a, b) => exposed(b) - exposed(a) || this.remaining(a) - this.remaining(b))[0];
      this.fire(t, target, target.x, target.y, false);
    }
  }

  private fire(t: Tower, target: Enemy | null, x: number, y: number, miss: boolean): void {
    const st = towerStats(t.def, t.level);
    t.cooldown = st.reload;
    t.sinceFire = 0;
    t.angle = Math.atan2(y - t.y, x - t.x);
    this.projectiles.push({
      id: this.nextId++,
      kind: t.def.projectile,
      fromX: t.x,
      fromY: t.y - 14,
      x: t.x,
      y: t.y - 14,
      targetId: target ? target.id : null,
      tx: x,
      ty: y,
      t: 0,
      dur: t.def.flight,
      damage: st.damage,
      splash: t.def.splash ?? 0,
      slow: t.def.slow,
      light: t.def.kind === 'light',
      miss,
    });
    this.events.push({ type: 'fire', tower: t, miss });
  }

  private updateProjectiles(dt: number): void {
    const done: Projectile[] = [];
    for (const p of this.projectiles) {
      p.t += dt;
      const target = p.targetId !== null ? this.enemies.find((e) => e.id === p.targetId && e.alive) : undefined;
      if (target) {
        p.tx = target.x;
        p.ty = target.y;
      }
      const k = Math.min(1, p.t / p.dur);
      p.x = p.fromX + (p.tx - p.fromX) * k;
      p.y = p.fromY + (p.ty - p.fromY) * k;
      if (p.t >= p.dur) {
        done.push(p);
        this.impact(p, target);
      }
    }
    if (done.length) this.projectiles = this.projectiles.filter((p) => !done.includes(p));
  }

  private impact(p: Projectile, target: Enemy | undefined): void {
    this.events.push({ type: 'impact', x: p.tx, y: p.ty, kind: p.kind, splash: p.splash, miss: p.miss });
    if (p.miss) return;

    if (p.splash > 0) {
      for (const e of this.enemies) {
        if (e.alive && !e.clawed && Math.hypot(e.x - p.tx, e.y - p.ty) <= p.splash + e.def.radius) {
          this.damage(e, p.damage, p.light);
        }
      }
    } else if (target) {
      this.damage(target, p.damage, p.light);
    }

    if (p.slow) {
      this.events.push({ type: 'slow', x: p.tx, y: p.ty, radius: p.slow.radius });
      for (const e of this.enemies) {
        if (!e.alive || Math.hypot(e.x - p.tx, e.y - p.ty) > p.slow.radius + e.def.radius) continue;
        const factor = e.def.boss ? 1 - (1 - p.slow.factor) / 2 : p.slow.factor;
        e.slowFactor = this.time < e.slowUntil ? Math.min(e.slowFactor, factor) : factor;
        e.slowUntil = Math.max(e.slowUntil, this.time + p.slow.duration);
      }
    }

    // A math hit spends the lock. Survivors grow a fresh riddle.
    if (!p.light && target && target.locked) {
      target.locked = false;
      if (target.alive && target.def.tier) {
        target.layer++;
        target.riddle = this.makeRiddle(target.def.tier);
        this.events.push({ type: 'newRiddle', enemy: target });
      }
    }
  }

  private damage(e: Enemy, amount: number, light: boolean): void {
    if (!e.alive) return;
    const dealt = light ? amount * this.lightFactor(e) : amount;
    e.hp -= dealt;
    e.hitFlash = 0.12;
    this.events.push({ type: 'damage', enemy: e, amount: dealt });
    if (e.hp <= 0) this.kill(e);
  }

  /** Fraction of light damage that gets through a shell or an unsolved riddle. */
  lightFactor(e: Enemy): number {
    const guard = e.riddle && !e.locked ? RIDDLE_GUARD : 0;
    return 1 - Math.max(e.def.shell, guard);
  }

  private kill(e: Enemy): void {
    if (!e.alive) return;
    e.alive = false;
    e.hp = 0;
    this.gold += e.def.gold;
    this.stats.killed++;
    this.events.push({ type: 'kill', enemy: e, gold: e.def.gold });
  }

  drainEvents(): BattleEvent[] {
    const ev = this.events;
    this.events = [];
    return ev;
  }

  /** Share of answers that were right (0 when nothing was answered). */
  accuracy(): number {
    return this.stats.attempts ? this.stats.correct / this.stats.attempts : 0;
  }

  /**
   * The three stars, each earned for its own reason:
   *   [0] won the stage, [1] kept at least 90% of lives, [2] won with at least 80% of answers right.
   * The second and third can be earned in either order; the saved score is how many were earned.
   */
  starsEarned(): [boolean, boolean, boolean] {
    if (this.phase !== 'won') return [false, false, false];
    return [true, this.lives >= this.maxLives * STAR_LIVES, this.accuracy() >= STAR_ACCURACY];
  }

  stars(): number {
    return this.starsEarned().filter(Boolean).length;
  }
}
