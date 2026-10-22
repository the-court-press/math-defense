// The Notes book: math ideas, Foglings, engines and the minds behind them.
// Fogling and tower entries are generated from their unit definitions.

import type { NoteDef } from './types';
import { ENEMIES, TOWERS } from './units';

const MATH: NoteDef[] = [
  {
    id: 'm-addsub',
    kind: 'math',
    title: 'Adding and subtracting',
    summary: 'Split numbers into tens and ones, combine each part, then put them back together.',
    example: '47 + 38 → 40 + 30 = 70, 7 + 8 = 15, so 85.',
    mixup: 'Forgetting the carried ten: 47 + 38 is not 75.',
  },
  {
    id: 'm-times',
    kind: 'math',
    title: 'Multiplying',
    summary: 'Multiplication counts equal groups. 7 × 8 is seven groups of eight.',
    example: '7 × 8 = 7 × 4 × 2 = 28 × 2 = 56.',
    mixup: '7 × 8 is not 54. Doubling a fact you know (7 × 4) is a reliable rescue.',
  },
  {
    id: 'm-divide',
    kind: 'math',
    title: 'Dividing',
    summary: 'Division undoes multiplication: 72 ÷ 8 asks "8 times what makes 72?"',
    example: '72 ÷ 8 = 9 because 8 × 9 = 72.',
    mixup: 'Swapping the order. 72 ÷ 8 and 8 ÷ 72 are very different.',
  },
  {
    id: 'm-order',
    kind: 'math',
    title: 'Order of operations',
    summary: 'Brackets first, then powers, then × and ÷, then + and −.',
    example: '5 + 3 × 4 = 5 + 12 = 17, but (5 + 3) × 4 = 32.',
    mixup: 'Working left to right regardless: 5 + 3 × 4 is not 32.',
  },
  {
    id: 'm-negatives',
    kind: 'math',
    title: 'Negative numbers',
    summary: 'Subtracting a negative moves you up the number line. Two negatives multiply to a positive.',
    example: '−4 − (−9) = −4 + 9 = 5.   (−6) × (−3) = 18.',
    mixup: 'Treating − (−9) as − 9. Press the [−] key any time to flip your answer\'s sign.',
  },
  {
    id: 'm-powers',
    kind: 'math',
    title: 'Powers and roots',
    summary: 'A power repeats multiplication: 4³ = 4 × 4 × 4. A square root undoes squaring.',
    example: '4³ = 64.   √81 = 9 because 9² = 81.',
    mixup: '4³ is not 4 × 3 = 12.',
  },
  {
    id: 'm-fractions',
    kind: 'math',
    title: 'Fractions of amounts',
    summary: 'To find 3/4 of a number, divide by the bottom, then multiply by the top.',
    example: '3/4 of 20 → 20 ÷ 4 = 5, then 5 × 3 = 15.',
    mixup: 'Dividing by the top number instead of the bottom.',
  },
  {
    id: 'm-percent',
    kind: 'math',
    title: 'Percentages',
    summary: 'Per cent means "out of 100". Find 10% or 1% first, then build what you need.',
    example: '15% of 80 → 10% = 8, 5% = 4, so 12.',
    mixup: '25% is a quarter, not "divide by 25".',
  },
  {
    id: 'm-decimals',
    kind: 'math',
    title: 'Decimals',
    summary: 'Line up the decimal point and work column by column. Use [.] to type the point.',
    example: '4.7 + 3.8 = 8.5.   2.6 × 3 = 7.8.',
    mixup: '4.7 + 3.8 is not 7.15. Tenths carry into ones just like ones carry into tens.',
  },
  {
    id: 'm-substitution',
    kind: 'math',
    title: 'Substitution',
    summary: 'A letter stands for a number. Swap it in, then follow the order of operations.',
    example: 'x = 4:  3x − 2 = 3 × 4 − 2 = 10.',
    mixup: '3x means 3 × x, so with x = 4 it is 12, not 34.',
  },
  {
    id: 'm-equations1',
    kind: 'math',
    title: 'One-step equations',
    summary: 'Do the opposite operation to both sides to get x on its own. Type the value of x.',
    example: 'x + 7 = 15 → x = 15 − 7 = 8.   4x = 28 → x = 7.',
    mixup: 'Adding 7 instead of subtracting it: x + 7 = 15 does not give 22.',
  },
  {
    id: 'm-equations2',
    kind: 'math',
    title: 'Two-step equations',
    summary: 'Undo the adding or subtracting first, then undo the multiplying.',
    example: '3x + 5 = 20 → 3x = 15 → x = 5.',
    mixup: 'Dividing first: (20 ÷ 3) leaves an awkward fraction. Clear the + 5 first.',
  },
  {
    id: 'm-equations3',
    kind: 'math',
    title: 'Unknowns on both sides, and brackets',
    summary: 'Collect the x terms on one side and the numbers on the other. Expand or divide out brackets first.',
    example: '5x − 3 = 2x + 9 → 3x = 12 → x = 4.   3(x + 2) = 21 → x + 2 = 7 → x = 5.',
    mixup: 'Moving a term across the = without changing its sign.',
  },
  {
    id: 'm-sequences',
    kind: 'math',
    title: 'Sequences',
    summary: 'In a linear sequence the gap between terms stays the same. Find the gap, then keep going.',
    example: '3, 7, 11, 15, ? → the gap is 4, so 19.',
    mixup: 'Checking only the first gap. Make sure the pattern holds for every pair.',
  },
];

const MINDS: NoteDef[] = [
  {
    id: 'p-archimedes',
    kind: 'mind',
    title: 'Archimedes of Syracuse',
    summary: 'Greek mathematician and engineer, about 287 to 212 BC, who defended his city against a Roman siege.',
    body:
      'Archimedes explained the lever and buoyancy, estimated π between 3 10/71 and 3 1/7, and found the volume of a sphere. ' +
      'When Rome besieged Syracuse (about 214 to 212 BC), ancient historians describe his machines: catapults and a great "claw" that lifted ships from the water. ' +
      'The famous burning mirrors appear only in much later stories, and modern tests suggest they probably did not work as told. ' +
      'He died when the city fell. Legend says his last words were "Do not disturb my circles."',
  },
  {
    id: 'p-hypatia',
    kind: 'mind',
    title: 'Hypatia of Alexandria',
    summary: 'Mathematician, astronomer and teacher in Alexandria, who died in AD 415. Arrives in a later version.',
    body: 'Hypatia taught mathematics, astronomy and philosophy, and is said to have written commentaries on Diophantus and Apollonius. Her own writings are lost.',
  },
  {
    id: 'p-khwarizmi',
    kind: 'mind',
    title: 'Al-Khwarizmi',
    summary: 'Scholar of Baghdad\'s House of Wisdom, about AD 780 to 850. Arrives in a later version.',
    body: 'His book on "al-jabr" gave algebra its name, and his own name gave us the word "algorithm".',
  },
  {
    id: 'p-fibonacci',
    kind: 'mind',
    title: 'Leonardo of Pisa',
    summary: 'Leonardo of Pisa, later nicknamed Fibonacci: Italian mathematician, about 1170 to 1250. Arrives in a later version.',
    body: 'His Liber Abaci (1202) helped bring Hindu-Arabic numerals, the digits on your numpad, into everyday European use.',
  },
];

const FOGLINGS: NoteDef[] = Object.values(ENEMIES).map((e) => ({
  id: `e-${e.id}`,
  kind: 'fogling' as const,
  title: e.name,
  summary: e.blurb,
  body: e.counter,
}));

const ENGINES: NoteDef[] = Object.values(TOWERS).map((t) => ({
  id: `t-${t.id}`,
  kind: 'tower' as const,
  title: t.name,
  summary: t.blurb,
  body: t.tip,
}));

export const NOTES: NoteDef[] = [...MATH, ...FOGLINGS, ...ENGINES, ...MINDS];
export const NOTE_BY_ID: Record<string, NoteDef> = Object.fromEntries(NOTES.map((n) => [n.id, n]));
