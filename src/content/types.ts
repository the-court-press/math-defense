// Content contracts. Everything a designer adds (regions, stages, Foglings, towers,
// math grammars, notes) is plain data that matches these shapes.

import type { Rng } from '../core/rng';

export interface Vec {
  x: number;
  y: number;
}

/** Numpad digits that name build sites. 7 8 9 is the top row, 1 2 3 the bottom. */
export type SiteDigit = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9;
export const SITE_DIGITS: SiteDigit[] = [7, 8, 9, 4, 5, 6, 1, 2, 3];

export type RiddleTier = 'easy' | 'main' | 'hard';

export interface Riddle {
  /** One or two short lines shown on the Fogling's tag. */
  lines: string[];
  answer: number;
  /** Note id in the Notes book that explains this kind of problem. */
  topic: string;
  /** What the player is solving for, shown as a small badge ("x"). */
  ask?: string;
}

export type GrammarParams = Record<string, number | boolean>;

export interface GrammarDef {
  id: string;
  topic: string;
  generate(rng: Rng, p: GrammarParams): Riddle;
}

export interface GrammarRef {
  id: string;
  weight?: number;
  params?: GrammarParams;
}

export interface EnemyDef {
  id: string;
  name: string;
  hp: number;
  /** Logical pixels per second. */
  speed: number;
  gold: number;
  /** Lives lost if it reaches the gate. */
  lives: number;
  radius: number;
  /** Fraction of light (automatic) damage blocked. Math shots ignore it. */
  shell: number;
  /** Which pool of riddles it carries. null means no riddle (only light towers and splash hurt it). */
  tier: RiddleTier | null;
  boss?: boolean;
  /** How much a Claw grab hurts it, as a fraction of max HP. 1 = removed outright. */
  clawFraction: number;
  look: 'fogling' | 'imp' | 'shellback' | 'mites' | 'tangle';
  blurb: string;
  counter: string;
}

export type TowerKind = 'light' | 'math';

export interface TowerDef {
  id: string;
  name: string;
  kind: TowerKind;
  /** "Light", "Medium", "Heavy", "Control" */
  weight: string;
  cost: number;
  range: number;
  damage: number;
  /** Seconds between shots. */
  reload: number;
  splash?: number;
  slow?: { factor: number; duration: number; radius: number };
  projectile: 'stone' | 'bolt' | 'boulder' | 'beam';
  /** Seconds a projectile takes to arrive. */
  flight: number;
  blurb: string;
  tip: string;
}

export interface WaveGroup {
  enemy: string;
  count: number;
  /** Seconds between spawns in this group. */
  gap: number;
  /** Seconds after wave start before the first spawn. */
  delay?: number;
  path?: number;
}

export interface Wave {
  groups: WaveGroup[];
}

export type HintTrigger =
  | 'start'
  | 'firstRiddle'
  | 'firstLock'
  | 'firstMiss'
  | 'waveCleared'
  | 'clawReady'
  | 'shellback'
  | 'mites'
  | 'firstJam';

export interface HintDef {
  on: HintTrigger;
  /** For waveCleared: which wave number (1-based). */
  wave?: number;
  /** Text with keycaps written as [Enter], [+], [1]-[9]. */
  text: string;
}

export interface SceneDef {
  ground: 'meadow' | 'sand' | 'stone' | 'dusk';
  sea?: 'top' | 'bottom' | 'left' | 'right';
  props: number;
  seed: number;
}

export interface StageDef {
  id: string;
  name: string;
  subtitle: string;
  /** Position on the region map, 0..1 in each axis. */
  mapPos: Vec;
  requires: string[];
  nav: Partial<Record<'left' | 'right' | 'up' | 'down', string>>;
  paths: Vec[][];
  sites: Partial<Record<SiteDigit, Vec>>;
  towers: string[];
  prebuilt?: { site: SiteDigit; tower: string }[];
  startGold: number;
  lives: number;
  waves: Wave[];
  /** Multiplies every spawn gap and delay. Above 1 gives more thinking time. */
  pace?: number;
  math: Record<RiddleTier, GrammarRef[]>;
  /** Short label for the briefing, like "Order of operations". */
  focus: string;
  /** Note ids introduced here (math topics, Foglings, towers). */
  introduces: string[];
  hints?: HintDef[];
  scene: SceneDef;
}

export interface RegionDef {
  id: string;
  name: string;
  era: string;
  mind: string;
  blurb: string;
  available: boolean;
  accent: string;
  stages: StageDef[];
}

export type NoteKind = 'math' | 'fogling' | 'tower' | 'mind';

export interface NoteDef {
  id: string;
  kind: NoteKind;
  title: string;
  /** One-sentence meaning. */
  summary: string;
  example?: string;
  mixup?: string;
  body?: string;
}
