# Changelog

All notable changes to Math Defense. Versions follow [semantic versioning](https://semver.org):
the version lives in `package.json` and is shown on the title screen and in Settings.

## 0.1.4 (2026-10-22)

### Licence
- Math Defense is now licensed under the PolyForm Noncommercial License 1.0.0
  (`LICENSE`, with "Required Notice: Copyright (c) 2026 Julius"). Free to play, read,
  learn from and share for non-commercial purposes; no selling.
- `package.json`: `"license": "PolyForm-Noncommercial-1.0.0"`. The README has a plain-words
  Licence section. No game changes.

## 0.1.3 (2026-10-22)

### Game
- The enemies are now **Foglings** (one Fogling), renamed from the Muddles. The title screen
  reads "Math Defense" with "Clear the Fog". Old saves and progress codes still work: a
  saved Notes entry is carried over to its new id.
- Notes and map text fixes:
  - Alexandria teaser: "Hypatia's classroom is knotted with tangled geometry."
  - Hypatia: taught mathematics, astronomy and philosophy, and is said to have written
    commentaries on Diophantus and Apollonius. Her own writings are lost.
  - Pisa: Leonardo of Pisa, later nicknamed Fibonacci.
  - Carry Mites: "Slings scatter them".

## 0.1.2 (2026-10-22)

### Game
- **Steady!** A wrong answer now costs a beat, so care beats speed on the battlefield too:
  - every math engine (Ballista, Catapult, Burning Mirror) jams for 2 s: it smokes, shows
    "Jammed!", and an orange ring with a countdown fills as it clears. Sling Posts never jam.
  - the answer box waits 2.5 s (a "Steady… 3" badge counts down) before it takes another
    answer. You can keep typing; press Enter again when it clears.
  - a quick repeat miss (within 2 s of being allowed to answer again) makes both longer:
    jam 4, 6, 8 s; wait 6.5, then 10 s. A right answer, or a miss made after thinking, resets it.
  - the wait is thinking time, so it counts real seconds (shorter in game time at Calm speed).
  - a one-time tip explains it straight away (ahead of other waiting tips), with its own sound. The short/long miss shot is unchanged,
    and a Fogling you already solved stays locked while the engines clear.

### Tooling
- `npm run balance` takes `--runs=N` and `--jam=...` for tuning; the Calm bot now plays at
  Calm speed in the simulation. `npm test` covers the jam, the wait, escalation, resets and
  Calm scaling. `npm run shots` adds a screenshot of the jam and checks it happens.

## 0.1.1 (2026-10-22)

### Game
- Stars now each mean something, and the results screen says which you earned:
  ★ Held the city (win), ★ Lost 2 lives or fewer (90% of lives kept), ★ Sharp aim: 80%+ right.
  Still three stars per stage (18 in Syracuse); saves and progress codes from 0.1.0 still work.
- Accuracy is shown rounded down (79.7% shows as 79%), so the screen never says 80% when
  the Sharp aim star was missed.
- Fraction riddles always show the fraction in lowest terms (no more "4/8 of 56").
  Answers are still whole numbers.

### Controls and interface
- `/` only deletes a digit. It no longer opens the menu on an empty answer, so hammering it is safe.
- The pause menu opens with `Esc`, `NumLock` or `Clear`, the new ❚❚ button on the HUD,
  or the on-screen pad's `esc` key. The in-battle key legend shows `[/] Delete` and `[Esc] Menu`.

### Tooling and repository
- Licence file added (`LICENSE`); `package.json` is no longer private.
- The `window.__md` debug hook exists only in dev builds (`npm run dev`, written to
  `.tmp/dev/`); the production build fails if it ever leaks into `dist/index.html`.
- `npm run shots` works from a fresh clone: Playwright is a dev dependency, there is no
  hard-coded path, and it falls back to an installed Chrome. It now also checks that `/` never
  opens the menu, that `Esc` and `NumLock` do, and that the game makes no network requests.
- `npm run balance` adds a guesser bot (fast, half right) and reports how often each star is earned.
- `npm test` adds checks for fractions in lowest terms, the star rules, 0.1.0 saves and codes,
  and the key map.

## 0.1.0 (2026-10-21), Numpad edition

First playable version.

### Game
- Lock-on aiming: a correct answer locks a Fogling and every ready math engine in range fires.
- Visible misses: wrong answers still fire and land short or long by how far off they were;
  a wrong sign is called out. Results list each miss with the right answer.
- Four engines: Sling Post (light, automatic), Ballista (medium), Catapult (heavy, splash),
  Burning Mirror (control, slows). Three upgrade levels each; sell for 70%.
- Riddle guard: light engines do a fifth of their damage to a Fogling until its riddle is solved,
  so the game cannot be won without the maths.
- Five Foglings: Fogling, Off-by-One Imp, Sign-Flip Shellback, Carry Mites, and the Great Tangle (boss).
- Archimedes' Claw, charged by correct answers.
- Syracuse campaign: six stages on a branching map, from times tables to two-step equations
  and sequences. 17 riddle types, all generated and checked by tests.
- Notes book: math topics, Foglings, engines and mathematicians, filled in as you play.

### Controls and interface
- Entirely playable on a numpad, with main-keyboard fallbacks and an on-screen numpad for touch.
  Keys are read by physical position, so NumLock on or off does not matter.
- Build mode pauses the battle; build spots are numbered like the numpad.
- Settings: sound, game speed (Calm 0.6×, Standard, Swift 1.25×), on-screen numpad, reduced motion.
- After a loss, one key retries the stage at Calm speed.
- Progress code: the whole campaign as 18 digits with a typo-catching checksum. No accounts, no server.
- Light and dark appearance; phone, tablet and desktop layouts.

### Tooling
- Single-file build (`dist/index.html`, about 140 KB, no runtime dependencies).
- `npm test`: grammar checker, stage validator, progress-code tests.
- `npm run balance`: bots (strong, average, struggling, struggling at Calm, no-math) play every stage.
- `npm run shots`: screenshots of every screen in a headless browser.
