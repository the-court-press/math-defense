// Regions and stages. A region is one mathematician's city; each stage is one battle.
// Battlefield coordinates use a 960 × 540 logical space. Build sites follow the
// numpad layout: 7 8 9 across the top, 4 5 6 through the middle, 1 2 3 along the bottom.

import type { RegionDef, StageDef, SiteDigit, Vec } from './types';

const COL = [190, 480, 770];
const ROW = [150, 285, 420];

/** Default site position for a numpad digit, nudged by an optional offset. */
function site(d: SiteDigit, dx = 0, dy = 0): Vec {
  const col = (d - 1) % 3;
  const row = d >= 7 ? 0 : d >= 4 ? 1 : 2;
  return { x: COL[col] + dx, y: ROW[row] + dy };
}

function sites(
  digits: SiteDigit[],
  nudges: Partial<Record<SiteDigit, [number, number]>> = {},
): Partial<Record<SiteDigit, Vec>> {
  const out: Partial<Record<SiteDigit, Vec>> = {};
  for (const d of digits) {
    const [dx, dy] = nudges[d] ?? [0, 0];
    out[d] = site(d, dx, dy);
  }
  return out;
}

const P = (x: number, y: number): Vec => ({ x, y });

const harbour: StageDef = {
  id: 'syr-1',
  name: 'Harbour Road',
  subtitle: 'The Foglings come ashore',
  mapPos: P(0.13, 0.68),
  requires: [],
  nav: { right: 'syr-2' },
  paths: [[P(-40, 218), P(625, 218), P(625, 352), P(1000, 352)]],
  sites: sites([7, 8, 9, 4, 5, 6, 2, 3], { 9: [-40, 10], 2: [20, -10] }),
  towers: ['sling', 'ballista'],
  prebuilt: [
    { site: 5, tower: 'ballista' },
    { site: 8, tower: 'sling' },
  ],
  startGold: 120,
  lives: 20,
  focus: 'Adding, subtracting, times tables',
  introduces: ['m-addsub', 'm-times', 'e-fogling', 'e-imp', 'e-mites', 't-sling', 't-ballista', 'p-archimedes'],
  math: {
    easy: [{ id: 'add', params: { lo: 5, hi: 40 } }, { id: 'sub', params: { lo: 5, hi: 40 } }],
    main: [
      { id: 'add', params: { lo: 12, hi: 89 } },
      { id: 'sub', params: { lo: 12, hi: 89 } },
      { id: 'mul', weight: 2, params: { aLo: 2, aHi: 9, bLo: 2, bHi: 9 } },
    ],
    hard: [{ id: 'mul', params: { aLo: 3, aHi: 12, bLo: 6, bHi: 12 } }],
  },
  waves: [
    { groups: [{ enemy: 'fogling', count: 4, gap: 3.4 }] },
    { groups: [{ enemy: 'fogling', count: 6, gap: 2.8 }] },
    { groups: [{ enemy: 'imp', count: 4, gap: 2.4 }, { enemy: 'fogling', count: 3, gap: 3, delay: 8 }] },
    { groups: [{ enemy: 'mites', count: 10, gap: 0.35 }, { enemy: 'fogling', count: 4, gap: 2.8, delay: 5 }] },
    { groups: [{ enemy: 'fogling', count: 8, gap: 2.3 }, { enemy: 'imp', count: 4, gap: 2, delay: 7 }] },
  ],
  hints: [
    { on: 'start', text: 'Press [Enter] to send the first wave.' },
    { on: 'firstRiddle', text: 'Each Fogling carries a sum. Type the answer, then press [Enter].' },
    { on: 'firstLock', text: 'Locked on! Every math engine in range fires at a solved Fogling.' },
    { on: 'firstMiss', text: 'A wrong answer misses. "Short" means too low, "Long" too high. [/] deletes a digit.' },
    { on: 'waveCleared', wave: 1, text: 'Spend gold: press [+], then a spot\'s number. Spots match your numpad.' },
    { on: 'mites', text: 'Carry Mites have no riddle. Sling Posts deal with them automatically.' },
    { on: 'clawReady', text: 'The Claw is ready! Press [*] to grab the Fogling nearest the gate.' },
  ],
  scene: { ground: 'meadow', sea: 'bottom', props: 18, seed: 11 },
};

const lever: StageDef = {
  id: 'syr-2',
  name: 'The Lever Works',
  subtitle: 'Brackets first, then the heavy lifting',
  mapPos: P(0.31, 0.47),
  requires: ['syr-1'],
  nav: { left: 'syr-1', right: 'syr-3', down: 'syr-4' },
  paths: [[P(-40, 352), P(335, 352), P(335, 218), P(625, 218), P(625, 352), P(1000, 352)]],
  sites: sites([7, 8, 9, 4, 5, 6, 1, 3], { 7: [40, 0], 9: [-40, 0], 4: [-10, 0], 6: [10, 0] }),
  towers: ['sling', 'ballista', 'catapult'],
  pace: 1.35,
  startGold: 300,
  lives: 20,
  focus: 'Order of operations, division',
  introduces: ['m-order', 'm-divide', 'e-shellback', 't-catapult'],
  math: {
    easy: [{ id: 'mul' }, { id: 'div' }],
    main: [{ id: 'order', weight: 3 }, { id: 'div' }],
    hard: [{ id: 'order' }],
  },
  waves: [
    { groups: [{ enemy: 'fogling', count: 5, gap: 2.8 }] },
    { groups: [{ enemy: 'mites', count: 12, gap: 0.3 }, { enemy: 'fogling', count: 4, gap: 2.6, delay: 5 }] },
    { groups: [{ enemy: 'shellback', count: 2, gap: 6 }, { enemy: 'fogling', count: 5, gap: 2.6, delay: 4 }] },
    { groups: [{ enemy: 'imp', count: 6, gap: 2 }, { enemy: 'fogling', count: 5, gap: 2.6, delay: 5 }] },
    { groups: [{ enemy: 'mites', count: 16, gap: 0.3 }, { enemy: 'shellback', count: 2, gap: 6, delay: 4 }] },
    {
      groups: [
        { enemy: 'fogling', count: 7, gap: 2.3 },
        { enemy: 'shellback', count: 2, gap: 6, delay: 6 },
        { enemy: 'imp', count: 5, gap: 1.8, delay: 16 },
      ],
    },
  ],
  hints: [
    { on: 'start', text: 'New engine: the Catapult. Heavy and slow, it flattens anything near its target.' },
    { on: 'shellback', text: 'Shellbacks ignore sling stones. Each solved riddle cracks the shell and grows a new one.' },
  ],
  scene: { ground: 'sand', props: 16, seed: 23 },
};

const cisterns: StageDef = {
  id: 'syr-3',
  name: 'The Cold Cisterns',
  subtitle: 'Below sea level, below zero',
  mapPos: P(0.47, 0.22),
  requires: ['syr-2'],
  nav: { left: 'syr-2', right: 'syr-5', down: 'syr-4' },
  paths: [[P(335, -40), P(335, 352), P(625, 352), P(625, 218), P(1000, 218)]],
  sites: sites([7, 8, 9, 4, 5, 6, 1, 2, 3], { 7: [60, 0], 4: [60, 0], 1: [60, -10], 9: [-30, 0], 3: [-40, 0] }),
  towers: ['sling', 'ballista', 'catapult'],
  pace: 1.25,
  startGold: 280,
  lives: 20,
  focus: 'Negative numbers',
  introduces: ['m-negatives'],
  math: {
    easy: [{ id: 'negadd', params: { max: 10 } }],
    main: [{ id: 'negadd', weight: 2, params: { max: 20 } }, { id: 'negmul', params: { max: 9 } }],
    hard: [{ id: 'negmul', params: { max: 12 } }, { id: 'negadd', params: { max: 40 } }],
  },
  waves: [
    { groups: [{ enemy: 'fogling', count: 6, gap: 2.8 }] },
    { groups: [{ enemy: 'imp', count: 6, gap: 2.2 }, { enemy: 'mites', count: 10, gap: 0.3, delay: 6 }] },
    { groups: [{ enemy: 'fogling', count: 6, gap: 2.4 }, { enemy: 'shellback', count: 2, gap: 6, delay: 5 }] },
    { groups: [{ enemy: 'mites', count: 18, gap: 0.28 }, { enemy: 'imp', count: 5, gap: 2, delay: 3 }] },
    { groups: [{ enemy: 'shellback', count: 4, gap: 5 }, { enemy: 'fogling', count: 6, gap: 2.4, delay: 3 }] },
    {
      groups: [
        { enemy: 'fogling', count: 10, gap: 2.1 },
        { enemy: 'imp', count: 6, gap: 1.6, delay: 10 },
        { enemy: 'shellback', count: 2, gap: 5, delay: 14 },
      ],
    },
  ],
  hints: [{ on: 'start', text: 'Negative answer? Type the number, then press [−] at any time to flip its sign.' }],
  scene: { ground: 'stone', props: 14, seed: 37 },
};

const cliffs: StageDef = {
  id: 'syr-4',
  name: 'Mirror Cliffs',
  subtitle: 'Parts, powers and percentages',
  mapPos: P(0.5, 0.78),
  requires: ['syr-2'],
  nav: { left: 'syr-2', up: 'syr-3', right: 'syr-5' },
  paths: [
    // Both roads end at the city gate on the clifftop, just short of the sea.
    [P(-40, 218), P(625, 218), P(625, 352), P(872, 352)],
    [P(335, 580), P(335, 218), P(625, 218), P(625, 352), P(872, 352)],
  ],
  sites: sites([7, 8, 9, 4, 5, 6, 1, 2, 3], { 1: [50, -20], 9: [-40, 10], 2: [30, 0] }),
  towers: ['sling', 'ballista', 'catapult', 'mirror'],
  pace: 1.42,
  startGold: 320,
  lives: 20,
  focus: 'Powers, fractions, percentages, decimals',
  introduces: ['m-powers', 'm-fractions', 'm-percent', 'm-decimals', 't-mirror'],
  math: {
    easy: [{ id: 'powers' }],
    main: [{ id: 'fracof' }, { id: 'percent' }, { id: 'decimals' }, { id: 'powers' }],
    hard: [{ id: 'percent' }, { id: 'decimals' }, { id: 'powers', params: { mixed: true } }],
  },
  waves: [
    { groups: [{ enemy: 'fogling', count: 4, gap: 3 }, { enemy: 'fogling', count: 3, gap: 3, delay: 6, path: 1 }] },
    { groups: [{ enemy: 'imp', count: 5, gap: 2.2, path: 1 }, { enemy: 'mites', count: 12, gap: 0.3, delay: 4 }] },
    { groups: [{ enemy: 'shellback', count: 2, gap: 6 }, { enemy: 'fogling', count: 5, gap: 2.5, delay: 3, path: 1 }] },
    { groups: [{ enemy: 'mites', count: 14, gap: 0.28, path: 1 }, { enemy: 'fogling', count: 6, gap: 2.3, delay: 3 }] },
    {
      groups: [
        { enemy: 'shellback', count: 3, gap: 5, path: 1 },
        { enemy: 'imp', count: 6, gap: 1.8, delay: 4 },
      ],
    },
    {
      groups: [
        { enemy: 'fogling', count: 8, gap: 2.2 },
        { enemy: 'fogling', count: 6, gap: 2.4, delay: 6, path: 1 },
        { enemy: 'shellback', count: 2, gap: 6, delay: 12 },
      ],
    },
  ],
  hints: [
    { on: 'start', text: 'Two roads today. New: the Burning Mirror slows everything near a solved Fogling.' },
    { on: 'firstRiddle', text: 'Decimal answers: press [.] for the point.' },
  ],
  scene: { ground: 'meadow', sea: 'right', props: 14, seed: 41 },
};

const agora: StageDef = {
  id: 'syr-5',
  name: 'The Agora',
  subtitle: 'Where letters stand for numbers',
  mapPos: P(0.69, 0.46),
  requires: ['syr-3', 'syr-4'],
  nav: { left: 'syr-3', down: 'syr-4', right: 'syr-6' },
  paths: [[P(1000, 218), P(335, 218), P(335, 352), P(1000, 352)]],
  sites: sites([7, 8, 9, 4, 5, 6, 1, 2, 3], { 7: [60, 0], 1: [60, 0], 4: [0, 0] }),
  towers: ['sling', 'ballista', 'catapult', 'mirror'],
  pace: 1.4,
  startGold: 320,
  lives: 20,
  focus: 'Substitution, one-step equations',
  introduces: ['m-substitution', 'm-equations1'],
  math: {
    easy: [{ id: 'eq1' }],
    main: [{ id: 'substitute' }, { id: 'eq1', weight: 2 }],
    hard: [{ id: 'eq1', params: { neg: true } }, { id: 'substitute', params: { neg: true } }],
  },
  waves: [
    { groups: [{ enemy: 'fogling', count: 6, gap: 3 }] },
    { groups: [{ enemy: 'imp', count: 7, gap: 2.4 }, { enemy: 'mites', count: 10, gap: 0.3, delay: 6 }] },
    { groups: [{ enemy: 'fogling', count: 8, gap: 2.6 }, { enemy: 'shellback', count: 2, gap: 6, delay: 6 }] },
    { groups: [{ enemy: 'mites', count: 12, gap: 0.28 }, { enemy: 'shellback', count: 3, gap: 5, delay: 4 }, { enemy: 'fogling', count: 4, gap: 3, delay: 8 }] },
    { groups: [{ enemy: 'imp', count: 6, gap: 1.8 }, { enemy: 'fogling', count: 7, gap: 2.4, delay: 6 }, { enemy: 'shellback', count: 2, gap: 6, delay: 12 }] },
    {
      groups: [
        { enemy: 'shellback', count: 4, gap: 5 },
        { enemy: 'fogling', count: 8, gap: 2.2, delay: 4 },
        { enemy: 'mites', count: 12, gap: 0.3, delay: 18 },
      ],
    },
  ],
  hints: [{ on: 'start', text: 'Equations show an [x] badge. Type the value of x and press [Enter].' }],
  scene: { ground: 'stone', props: 12, seed: 53 },
};

const tangle: StageDef = {
  id: 'syr-6',
  name: 'The Great Tangle',
  subtitle: 'Everything unsolved, all at once',
  mapPos: P(0.87, 0.26),
  requires: ['syr-5'],
  nav: { left: 'syr-5' },
  paths: [
    [P(-40, 218), P(335, 218), P(335, 352), P(625, 352), P(625, 218), P(1000, 218)],
    [P(335, 580), P(335, 352), P(625, 352), P(625, 218), P(1000, 218)],
  ],
  sites: sites([7, 8, 9, 4, 5, 6, 1, 2, 3], { 8: [0, 0], 9: [-30, 0], 6: [0, 15], 3: [-40, 0], 1: [40, -10] }),
  towers: ['sling', 'ballista', 'catapult', 'mirror'],
  pace: 1.5,
  startGold: 360,
  lives: 20,
  focus: 'Two-step equations and sequences',
  introduces: ['m-equations2', 'm-sequences', 'm-equations3', 'e-tangle'],
  math: {
    easy: [{ id: 'eq1' }, { id: 'seq' }],
    main: [{ id: 'eq2', weight: 3 }, { id: 'seq' }],
    hard: [{ id: 'eq2', weight: 2, params: { neg: true } }, { id: 'eqbr' }, { id: 'eqboth', weight: 0.5 }],
  },
  waves: [
    { groups: [{ enemy: 'fogling', count: 6, gap: 2.8 }] },
    { groups: [{ enemy: 'imp', count: 6, gap: 2.2, path: 1 }, { enemy: 'mites', count: 12, gap: 0.3, delay: 5 }] },
    { groups: [{ enemy: 'shellback', count: 3, gap: 5 }, { enemy: 'fogling', count: 5, gap: 2.6, delay: 4, path: 1 }] },
    { groups: [{ enemy: 'mites', count: 16, gap: 0.28, path: 1 }, { enemy: 'fogling', count: 7, gap: 2.3, delay: 2 }] },
    {
      groups: [
        { enemy: 'shellback', count: 3, gap: 5 },
        { enemy: 'imp', count: 6, gap: 1.8, delay: 6, path: 1 },
      ],
    },
    {
      groups: [
        { enemy: 'tangle', count: 1, gap: 1 },
        { enemy: 'fogling', count: 4, gap: 3, delay: 10, path: 1 },
        { enemy: 'mites', count: 12, gap: 0.3, delay: 20 },
      ],
    },
  ],
  hints: [
    { on: 'start', text: 'Two roads, and The Great Tangle waits in the final wave. Consider saving the Claw.' },
  ],
  scene: { ground: 'dusk', props: 12, seed: 67 },
};

export const REGIONS: RegionDef[] = [
  {
    id: 'syracuse',
    name: 'Syracuse',
    era: 'Sicily · 214 BC',
    mind: 'Archimedes',
    blurb: 'The Foglings have come ashore. Archimedes has engines, a claw, and you.',
    available: true,
    accent: '#0a84ff',
    stages: [harbour, lever, cisterns, cliffs, agora, tangle],
  },
  {
    id: 'alexandria',
    name: 'Alexandria',
    era: 'Egypt · AD 400',
    mind: 'Hypatia',
    blurb: "Hypatia's classroom is knotted with tangled geometry.",
    available: false,
    accent: '#bf5af2',
    stages: [],
  },
  {
    id: 'baghdad',
    name: 'Baghdad',
    era: 'House of Wisdom · AD 830',
    mind: 'al-Khwarizmi',
    blurb: 'Unbalanced equations stalk the House of Wisdom.',
    available: false,
    accent: '#ff9f0a',
    stages: [],
  },
  {
    id: 'pisa',
    name: 'Pisa',
    era: 'Italy · AD 1202',
    mind: 'Fibonacci',
    blurb: 'Roman numerals are back, and they have brought friends. Leonardo of Pisa, later nicknamed Fibonacci, has better digits.',
    available: false,
    accent: '#30d158',
    stages: [],
  },
];

export const ALL_STAGES: StageDef[] = REGIONS.flatMap((r) => r.stages);
export const STAGE_BY_ID: Record<string, StageDef> = Object.fromEntries(ALL_STAGES.map((s) => [s.id, s]));

/**
 * Fixed slot order used by the progress code. Never reorder; only append,
 * so old codes keep working after new stages are added.
 */
export const STAGE_SLOTS: string[] = ['syr-1', 'syr-2', 'syr-3', 'syr-4', 'syr-5', 'syr-6'];
