// Takes screenshots of every screen in headless Chromium (npm run shots).
// Used for visual review; also catches runtime errors and any network request on each screen.
//
// npm run shots builds the dev version first (.tmp/dev/index.html), which carries the
// window.__md hook this script uses to read riddles. It also opens the real dist/index.html
// to check that the published file has no debug hook and makes no network requests.
//
// Needs a browser: run `npx playwright install chromium` once, or have Google Chrome installed.

import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const out = process.argv[2] || '.tmp/shots';
fs.mkdirSync(out, { recursive: true });
const url = pathToFileURL(path.resolve('.tmp/dev/index.html')).href;
const distUrl = pathToFileURL(path.resolve('dist/index.html')).href;
const errors = [];
const requests = [];

async function launch() {
  try {
    return await chromium.launch();
  } catch (first) {
    try {
      return await chromium.launch({ channel: 'chrome' });
    } catch {
      console.error('No browser found. Run `npx playwright install chromium` (or install Google Chrome) and try again.');
      throw first;
    }
  }
}
const browser = await launch();

async function page(opts = {}) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1, ...opts });
  const p = await ctx.newPage();
  p.on('pageerror', (e) => errors.push(String(e)));
  p.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  p.on('request', (r) => {
    if (!/^(file|data|blob):/.test(r.url())) requests.push(r.url());
  });
  return p;
}

const wait = (p, ms) => p.waitForTimeout(ms);
const shot = (p, name) => p.screenshot({ path: `${out}/${name}.png` });
const screen = (p, expr) => p.evaluate(`(() => { const s = window.__md.app.current; return (${expr}); })()`);

// Title, map, notes, settings
{
  const p = await page();
  await p.goto(url);
  await wait(p, 2500);
  await shot(p, '01-title');
  await p.keyboard.press('Numpad5');
  await wait(p, 700);
  await shot(p, '02-map');
  await p.keyboard.press('NumpadDivide');
  await wait(p, 400);
  await p.keyboard.press('Numpad2');
  await p.keyboard.press('NumpadEnter');
  await wait(p, 600);
  await shot(p, '03-notes');
  await p.keyboard.press('Numpad6');
  await wait(p, 300);
  await shot(p, '04-notes-foglings');
  await p.keyboard.press('NumpadDivide');
  await wait(p, 400);
  await p.keyboard.press('Numpad2');
  await p.keyboard.press('Numpad2');
  await p.keyboard.press('NumpadEnter');
  await wait(p, 600);
  await shot(p, '05-settings');
  for (let i = 0; i < 4; i++) await p.keyboard.press('Numpad2');
  await p.keyboard.press('NumpadEnter');
  await wait(p, 500);
  for (const d of '1000000') await p.keyboard.press('Numpad' + d);
  await shot(p, '06-code');
  await p.close();
}

// A campaign in progress: map and Notes with some entries found.
{
  const p = await page();
  await p.addInitScript(() => {
    localStorage.setItem('math-defense:save:v1', JSON.stringify({ v: 1, stars: { 'syr-1': 3, 'syr-2': 2 }, records: { 'syr-1': { bestAccuracy: 0.92, bestStars: 3 } }, seen: [], settings: {} }));
  });
  await p.goto(url);
  await wait(p, 800);
  await p.keyboard.press('Numpad5');
  await wait(p, 700);
  await shot(p, '07-map-progress');
  await p.keyboard.press('NumpadDivide');
  await wait(p, 400);
  await p.keyboard.press('Numpad2');
  await p.keyboard.press('NumpadEnter');
  await wait(p, 500);
  await p.keyboard.press('Numpad6');
  await wait(p, 400);
  await shot(p, '08-notes-fogling');
  await p.keyboard.press('Numpad2');
  await p.keyboard.press('Numpad2');
  await p.keyboard.press('Numpad2');
  await wait(p, 300);
  await shot(p, '09-notes-locked');
  await p.close();
}

// Battle
{
  const p = await page();
  await p.goto(url + '#stage=syr-1');
  await wait(p, 1200);
  await shot(p, '10-battle-planning');
  await p.keyboard.press('NumpadEnter');
  await wait(p, 9000);
  await shot(p, '11-battle-wave');
  // Answer the front riddle correctly, then a wrong one.
  const ans = await screen(p, 's.battle.enemies.filter(e => e.riddle && !e.locked).sort((a,b)=>s.battle.remaining(a)-s.battle.remaining(b)).map(e => e.riddle.answer)');
  if (ans.length) {
    for (const ch of String(ans[0])) await p.keyboard.press(ch === '-' ? 'NumpadSubtract' : ch === '.' ? 'NumpadDecimal' : 'Numpad' + ch);
    await shot(p, '12-typing');
    await p.keyboard.press('NumpadEnter');
    await wait(p, 120);
    await shot(p, '13-locked');
  }
  if (ans.length > 1) {
    for (const ch of String(ans[1] + 3)) await p.keyboard.press('Numpad' + ch);
    await p.keyboard.press('NumpadEnter');
    await wait(p, 250);
    await shot(p, '14-miss');
    // The jam: engines smoke with an orange countdown ring, the answer box shows "Steady…".
    await wait(p, 700);
    await shot(p, '14b-jam-steady');
    if (!(await screen(p, 's.battle.steadyLeft > 0'))) errors.push('no "Steady!" pause after a miss');
    if (!(await screen(p, '[...s.battle.towers.values()].some((t) => t.jam > 0)'))) errors.push('no engine jammed after a miss');
  }
  await p.keyboard.press('NumpadAdd');
  await wait(p, 400);
  await shot(p, '15-build-site');
  await p.keyboard.press('Numpad6');
  await wait(p, 400);
  await shot(p, '16-build-pick');
  await p.keyboard.press('NumpadDivide');
  await p.keyboard.press('Numpad5');
  await wait(p, 400);
  await shot(p, '17-build-manage');
  await p.keyboard.press('NumpadDivide');
  await p.keyboard.press('NumpadDivide');
  await wait(p, 300);
  // / is delete only: hammering it on an empty answer must never open the menu.
  for (let i = 0; i < 12; i++) await p.keyboard.press('NumpadDivide');
  await wait(p, 300);
  if ((await screen(p, 's.mode')) !== 'play') errors.push('/ opened the menu');
  await shot(p, '17b-legend');
  await p.keyboard.press('Escape');
  await wait(p, 600);
  if ((await screen(p, 's.mode')) !== 'paused') errors.push('Esc did not open the menu');
  await shot(p, '18-pause');
  await p.keyboard.press('Escape');
  await wait(p, 200);
  await p.keyboard.press('NumLock');
  await wait(p, 300);
  if ((await screen(p, 's.mode')) !== 'paused') errors.push('NumLock did not open the menu');
  await p.keyboard.press('NumLock');
  await wait(p, 200);
  await screen(p, 's.battle.stats.misses.push({lines:["7 × 8"],answer:56,typed:54,topic:"m-times"}), s.battle.phase = "won", s.battle.lives = 19, s.finish(true)');
  await wait(p, 1800);
  await shot(p, '19-results');
  await p.close();
}

// A lost battle, to check the retry sheet.
{
  const p = await page();
  await p.goto(url + '#stage=syr-2');
  await wait(p, 600);
  await screen(p, 's.battle.stats.misses.push({lines:["20 − 2 × 4"],answer:12,typed:72,topic:"m-order"}), s.battle.phase = "lost", s.battle.lives = 0, s.finish(false)');
  await wait(p, 900);
  await shot(p, '19b-results-lost');
  await p.close();
}

// Later stages, to check scenery and algebra tags.
for (const id of ['syr-2', 'syr-3', 'syr-4', 'syr-5', 'syr-6']) {
  const p = await page();
  await p.goto(url + '#stage=' + id);
  await wait(p, 600);
  await screen(p, 's.battle.gold = 2000, [5,6,8,4].forEach((d,i) => s.battle.build(d, s.stage.towers[i % s.stage.towers.length]))');
  await p.keyboard.press('NumpadEnter');
  await wait(p, 12000);
  await shot(p, `20-${id}`);
  await p.close();
}

// Phone and dark mode
{
  const p = await page({ viewport: { width: 844, height: 390 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 });
  await p.goto(url + '#stage=syr-1');
  await wait(p, 600);
  await p.keyboard.press('NumpadEnter');
  await wait(p, 6000);
  await shot(p, '30-phone-battle');
  await p.close();
  for (const [name, hash] of [['32-phone-title', ''], ['33-phone-map', '#map']]) {
    const q = await page({ viewport: { width: 844, height: 390 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 });
    await q.goto(url + hash);
    await wait(q, 1200);
    await shot(q, name);
    await q.close();
  }
  const portrait = await page({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 });
  await portrait.goto(url + '#stage=syr-1');
  await wait(portrait, 600);
  await portrait.keyboard.press('NumpadEnter');
  await wait(portrait, 5000);
  await shot(portrait, '34-portrait-battle');
  await portrait.close();
  const d = await page({ colorScheme: 'dark' });
  await d.goto(url + '#map');
  await wait(d, 900);
  await shot(d, '31-dark-map');
  await d.close();
}

// Results where star 2 is missed (lives) but star 3 (accuracy) is earned.
{
  const p = await page();
  await p.goto(url + '#stage=syr-1');
  await wait(p, 600);
  await screen(p, 'Object.assign(s.battle.stats, {attempts: 40, correct: 36, wrong: 4, bestStreak: 21}), s.battle.stats.misses.push({lines:["7 × 8"],answer:56,typed:54,topic:"m-times"}, {lines:["63 − 28"],answer:35,typed:45,topic:"m-addsub"}), s.battle.phase = "won", s.battle.lives = 12, s.finish(true)');
  await wait(p, 1800);
  await shot(p, '19c-results-aim-not-lives');
  await p.close();
}

// The published file: no debug hook, no network, no errors.
{
  const p = await page();
  await p.goto(distUrl);
  await wait(p, 1200);
  if (await p.evaluate(() => '__md' in window)) errors.push('dist/index.html exposes window.__md');
  await p.keyboard.press('Numpad5');
  await wait(p, 600);
  await shot(p, '40-dist-map');
  await p.close();
}

await browser.close();
if (requests.length) errors.push('Network requests: ' + requests.join(', '));
console.log(`${fs.readdirSync(out).filter((f) => f.endsWith('.png')).length} screenshots in ${out}`);
if (errors.length) {
  console.log('Page errors:\n' + [...new Set(errors)].join('\n'));
  process.exit(1);
}
console.log(`Screenshots in ${out}`);
