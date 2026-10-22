# Math Defense

**Clear the Fog.** A tower defence game for ages 11 and up where the
maths *is* the aiming. Every Fogling carries a riddle. Type the answer and every math
engine in range locks on and fires. Get it wrong and you see the shot land short or long.

Version 0.1.4, the Numpad edition: the whole game is played on a numeric keypad.

## Play it

Open `dist/index.html` in any modern browser (Chrome, Edge, Firefox, Safari).
It is one self-contained file: no server, no install, no network. It works from a
USB stick, a shared drive, or any static host (GitHub Pages, Netlify, an S3 bucket).

Deep links, handy for testing:

- `index.html#map` opens the campaign map.
- `index.html#stage=syr-3` jumps straight into a stage.

## Controls

Everything is on the numpad. The main keyboard's top-row digits, Enter, Backspace
and arrow keys also work, so a laptop without a numpad can still play. On touch
screens an on-screen numpad appears (Settings → On-screen numpad).

| Key | In battle | In menus |
| --- | --- | --- |
| `0`–`9` `.` | Type an answer | `8` `2` `4` `6` move, `5` chooses |
| `−` | Make the answer negative | Previous region, sell |
| `Enter` | Fire, or start the next wave | Choose |
| `/` | Delete a digit (never opens the menu) | Back |
| `+` | Build mode (the game pauses) | Next region, upgrade |
| `✱` | Use the Claw when it is charged | |
| `Esc` / `NumLock` / `Clear` | Open the pause menu | Back, resume |

With a mouse, the ❚❚ button next to the wave counter opens the pause menu too; when the
on-screen numpad is showing (touch screens), its `esc` key does the same. `NumLock` works as the menu
key whichever state NumLock is in, because the game reads keys by their position.

Build mode: press `+`, then the digit of a spot (spots are laid out like the
numpad: 7 8 9 across the top, 1 2 3 along the bottom), then the number of an engine.

## How it plays

- **Lock-on.** A correct answer locks the Fogling. Every *ready* math engine in range
  fires at it. Where you build decides which riddles you can afford to answer.
- **Visible misses.** A wrong answer still fires, and the shot lands *short* or *long*
  by how far off you were. A wrong sign says "Check the sign!". The results screen
  lists each miss with the right answer and what you typed.
- **Steady!** A wrong answer jams every math engine for 2 seconds (they smoke, and an
  orange ring shows the jam clearing) and the answer box waits 2.5 seconds before it takes
  the next answer. Guess again straight away and get it wrong again, and both get longer
  (jam 4, 6, then 8 s; wait 6.5 then 10 s). A miss you made after thinking, or after a right
  answer, starts again from the short version. Sling Posts never jam, and the wait counts
  real seconds, so on Calm speed it is shorter in game time.
- **Light vs. heavy.** Sling Posts fire on their own but barely scratch a Fogling
  until its riddle is solved. Ballista (medium), Catapult (heavy, splash) and Burning
  Mirror (control, slows) only fire at solved Foglings. Gold is short, so every
  build is a choice between steady coverage and big hits.
- **The Claw.** Each correct answer adds a charge and each miss takes one away. At
  five charges, `✱` drops Archimedes' Claw on the Fogling nearest the gate and lifts it
  off the road (a boss only loses a fifth of its health).
- **Three stars, three reasons.** One for holding the city (winning), one for losing
  no more than a tenth of your lives (2 of 20), and one for sharp aim: at least 80% of
  your answers right. The results screen shows which ones you earned. Fast guessing can
  win a stage, but it never earns the third star.
- **Six stages in Syracuse**, branching after stage 2, from times tables to two-step
  equations and sequences. Stars unlock the next stages.

## Saving, without a server

Progress saves in the browser (`localStorage`) on this device only. Nothing is sent
anywhere. Because browsers can clear saved data, Settings → Progress code shows the
whole campaign as an 18-digit number. Type it on any device to carry the stars over.
The last two digits are a checksum (ISO 7064 mod 97-10, the same scheme as IBAN bank
numbers), so a typo or two swapped digits is caught instead of loading wrong progress.

## Develop

Needs Node 18 or later.

```sh
npm install
npm run build     # writes dist/index.html (minified, everything inlined)
npm run dev       # readable build with a debug hook, to .tmp/dev/index.html (never to dist/)
npm run check     # TypeScript type-check
npm test          # riddle generators, stage data, progress code
npm run balance   # headless bots play every stage and report win rates
npm run shots     # screenshots of every screen into .tmp/shots, and checks for errors and network use
```

`npm run balance -- syr-3` runs one stage; `npm run balance -- all strong,average,guesser`
runs chosen bot profiles. The balance report also shows how often each star was earned.
`--runs=40` plays more runs per stage (less noise), and `--jam=2,2,2,8,1,2.5,4,10` tries other
jam values (jam base, step, window, max, all-engines, steady base, step, max) without editing the game.

`npm run shots` uses Playwright. The first time, run `npx playwright install chromium`;
if that browser is missing it falls back to an installed Google Chrome.

### Layout

```
src/
  core/      input (numpad mapping), audio (synthesised, no files), save, progress code, RNG
  content/   all game data: riddle grammars, stages and regions, enemies and engines, notes
  sim/       the battle simulation: deterministic, no DOM, used by the game and the bots
  render/    canvas drawing: scenery, units, effects, riddle tags
  ui/        screens: title, map, battle, notes, settings
tests/       npm test
tools/       balance bot and screenshot tool
dist/        the built game (one HTML file)
```

### Adding content

- **A riddle type:** add a grammar to `src/content/grammars.ts`. `npm test` checks
  4,000 samples of every grammar with an independent evaluator that re-reads the
  displayed text, so a riddle can never show one thing and expect another.
- **A stage:** add a `StageDef` to `src/content/regions.ts` and append its id to
  `STAGE_SLOTS`. Never reorder `STAGE_SLOTS`: progress codes depend on the order.
  `npm test` checks that build spots stay clear of the road. Then run
  `npm run balance` and aim for: no-math bot loses, average bot wins most runs.
- **A region:** fill in the `stages` of Alexandria, Baghdad or Pisa and set
  `available: true`.

## Licence

Copyright (c) 2026 Julius.

Math Defense is free to play, read, learn from, change and share for non-commercial
purposes: at home, in school, in a club, or just for fun. You may not sell it or use it
to make money. The full terms are the PolyForm Noncommercial License 1.0.0 in
[LICENSE](LICENSE); if you share a copy, include that file.

See `docs/DESIGN-NOTES.md` for the design decisions, the known flaws and the balance
targets, and `CHANGELOG.md` for what changed in each version.
