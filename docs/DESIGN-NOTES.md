# Design notes, v0.1.4

What this version decides, the flaws we already know about, and what each one costs.
Flaws are listed with the fix in this build (if any) and what is still open.

## The core loop

1. Foglings walk the road carrying riddles.
2. You type an answer and press Enter. If it matches a visible riddle, that Fogling is
   locked and every *ready* math engine in range fires at it.
3. A wrong answer fires at the Fogling you were most likely aiming at, and the shot lands
   short or long by how far off you were. Typing the right number with the wrong sign
   says "Check the sign!". Since 0.1.2 it also costs a beat: the math engines jam and the
   next answer waits ("Steady!", see below).
4. Between waves (and any time, since build mode pauses) you spend gold on engines.

The strategy layer is the choice of engines and where to put them:

| Engine | Role | Fires at | Cost |
| --- | --- | --- | --- |
| Sling Post | Light, steady | Anything, automatically, but only a fifth of its damage to an unsolved Fogling | 60 |
| Ballista | Medium | Solved Foglings | 100 |
| Catapult | Heavy, slow, splash | Solved Foglings | 150 |
| Burning Mirror | Control, slows a group | Solved Foglings | 120 |

Placement decides which riddles are worth solving: a solved Fogling outside every engine's
range is a wasted answer. Heavy engines reward solving riddles on clumps; Slings handle
Carry Mites (no riddle) and soften what you cannot solve in time.

## Numpad-only: flaws and fixes

**1. Most laptops, and every Mac laptop, have no numpad.**
Fixed: the top-row digits, Enter, Backspace and arrow keys all work, and touch screens get
an on-screen numpad. Still open: on top-row digits the build spots lose their meaning,
because 7 8 9 / 4 5 6 / 1 2 3 is a grid only on a numpad. The keycaps drawn on each spot in
build mode keep it usable, but the "the map is your keypad" feeling is gone.

**2. A numpad has no Backspace.**
Fixed: `/` deletes the last digit. **Fixed in 0.1.1:** `/` is now delete only. In 0.1.0 it
also opened the menu on an empty answer, so hammering `/` could overshoot into the pause menu.
The menu now lives on `Esc`, `NumLock` (and the Mac numpad's `Clear`, which sits in the same
place), the ❚❚ button on the HUD, and the on-screen pad's `esc` key. The 0.45 s guard is gone.
In menus and build mode `/` still means Back, which is safe because Back never pauses a
running battle. `NumLock` doubles as the menu key and as Back inside menus; that is one
meaning ("get me out / stop"), not two. The cost: pressing `NumLock` also flips the
keyboard's NumLock light. The game does not care (keys are read by position), but the player's
numpad may be left in arrow mode after they close the game.

**3. A numpad has no letters.**
Every answer must be a number. Equations always ask for the single unknown, shown as a blue
*x* badge on the riddle. The save code is digits only. Constraint for future content: no word
answers, no "x = 3, y = 4", and no fraction answers (riddles like "2/5 of 35" are built to have
whole-number answers, and since 0.1.1 the fraction is always in lowest terms, so no
"4/8 of 56"). **If fraction answers are ever wanted, there is no free key for the
fraction bar, since `/` is Delete.** Decide that before designing Alexandria or Pisa.

**4. NumLock.**
With NumLock off, most numpads send arrows and Home/End instead of digits. Fixed: keys are
read by physical position (`event.code`), so it works either way. The NumLock and Clear keys
act as Back. Mac numpads' `=` key acts as Enter.

**5. Browser shortcuts.**
Firefox opens quick-find on `/`, and some browsers scroll on arrows. Fixed: the game claims
the keys it uses. Ctrl/Cmd combinations are left alone, so zoom and refresh still work.

**6. Decimal comma.**
Many European numpads type `,` for the decimal key. Fixed: both `.` and `,` mean decimal point.

**7. Negative numbers.**
`−` toggles the sign at any point, so "−12" and "12−" both work. The risk is that a player who
presses `−` thinking "subtract" gets a negative answer; the "Check the sign!" miss explains it.

**8. Digits on the field invite pressing them.**
In play, a player may press 5 meaning "the tower on spot 5" and type a 5 into their answer
instead. Mitigated: in play the spot numbers are small plaques; they become big keycaps only
in build mode, and build mode is behind `+`.

## Learning design: flaws and open questions

**Guessing still fires.** That is deliberate (the miss is the lesson), but it means a
guesser is not punished much. Costs: the engine spends its reload on the miss, a Claw
charge is lost, and the results screen shows accuracy.

**Fixed in 0.1.1: stars no longer count only lives.** Each star now has its own reason,
shown on the results screen: ★ *Held the city* (win), ★ *Lost 2 lives or fewer* (at least 90%
of lives kept, the old three-star rule), ★ *Sharp aim: 80%+ right* (at least 80% of answers
correct). Stars 2 and 3 can be earned in either order; the save stores how many were earned,
so saves and progress codes from 0.1.0 load unchanged (an old three-star stage stays three
stars). The old two-star tier (half the lives kept) is gone.

**Addressed in 0.1.2: guessing no longer beats care on the battlefield.** In 0.1.1 the
guesser bot (fast, half right) won every stage and kept more lives than the average bot,
because the bottleneck is how fast Foglings get locked, not engine firepower: a guesser
locks everything early, and a wasted reload on one engine barely mattered.

The mechanism, "Steady!", has two parts. Values live in `JAM` in `src/sim/battle.ts`:

| | First miss | Quick repeat miss | Cap | Counts |
| --- | --- | --- | --- | --- |
| Engine jam (all Ballistas, Catapults, Mirrors) | 2 s | +2 s each | 8 s | battle time |
| Answer wait ("Steady… 3" on the answer box) | 2.5 s | +4 s each | 10 s | real seconds |

- A *quick repeat* is a miss made within 2 real seconds of being allowed to answer again.
  A right answer, or a miss made after a longer think, resets to the first-miss values.
  This is what separates a guesser from a careful child who slips: in the bots, careful
  players' second misses come after they have thought again, so they almost never escalate.
- The miss shot itself is unchanged (it still lands short or long), and a Fogling you already
  locked stays locked while the engines clear, so a right answer is never thrown away.
- Sling Posts never jam: they are the safety net for a struggling player.
- The wait counts real seconds because it is the player's thinking time; at Calm speed
  (0.6×) it covers less game time. The jam is game time, so it is the same on every setting.
- Why all engines, not only those in range: guessers solve Foglings early, before they reach
  any engine, so an in-range jam almost never cost them anything (tried first, no effect).
- Why a wait at all: jams alone, even when engines were jammed 57% of the time, still left the
  guesser ahead on lives, because locking early beats firepower. The wait slows the locking.
- Readable for 11 to 13 year olds: engines puff grey smoke, say "Jammed!", and show an
  orange ring with a seconds countdown; the answer box gets an orange outline and a
  "Steady… N" badge; a creak sound plays; and a one-time tip (shown at once, ahead of other tips) says
  "Steady! A wrong answer jams your engines for a moment. Quick guesses jam them longer.
  Think, then fire." Typing still works during the wait; Enter gives a soft tick and a shake.

Tuning was done with `npm run balance -- --runs=40 --jam=...`. Targets: guesser keeps fewer
lives than the average bot on every stage, struggling-at-Calm win rates within about 10
points of 0.1.1, average still wins most runs, no-maths always loses. Results are in the
tables below.

Open: the bot model makes guessers answer every 1 to 3 s and careful players think longer;
real children may press Enter faster after a careful re-think. If playtests show careful
kids hitting the long waits, shorten the 2 s quick-repeat window first.

**One answer, one Fogling.** Two riddles on screen never share an answer, or one answer would
lock both. The generator enforces this.

**Struggling learners.** The balance bots below show a 70%-accurate, slow solver cannot clear
stage 2 at Standard speed. Calm speed (0.6×) brings them to a 50 to 100% win rate per stage,
and after a loss the first option on the results screen is "Try again at Calm speed". Open:
nothing adapts automatically; a teacher may want to lock Calm on.

**Strong learners.** The strong bot gets three stars everywhere with no lives lost. The skill
ceiling is low for quick students. Options: a Swift-only star, harder riddle tiers, or a
challenge mode per stage.

**The bots are not children.** All balance numbers come from a model of think time and
accuracy per topic. Real playtesting with 11 to 13 year olds is the next step that matters most.

## Balance targets and results

`npm run balance` (12 runs per stage). Each cell: win rate, average stars, average lives
kept (of 20). Before = 0.1.1, after = 0.1.2.

| Stage | Bot | Before: win / ★ / ♥ | After: win / ★ / ♥ |
| --- | --- | --- | --- |
| 1 Harbour Road | strong | 100% / 3.0 / 20 | 100% / 2.9 / 20 |
| | average | 100% / 2.3 / 17 | 100% / 2.3 / 17 |
| | struggling | 75% / 0.9 / 5 | 67% / 0.8 / 4 |
| | struggling, Calm | 100% / 1.2 / 16 | 100% / 1.3 / 16 |
| | guesser | 100% / 2.0 / 20 | 100% / 1.1 / 10 |
| 2 The Lever Works | average | 100% / 2.0 / 8 | 92% / 1.8 / 8 |
| | struggling, Calm | 92% / 1.1 / 5 | 92% / 1.0 / 6 |
| | guesser | 100% / 1.5 / 17 | 75% / 0.8 / 6 |
| 3 The Cold Cisterns | average | 100% / 2.0 / 11 | 92% / 1.8 / 10 |
| | struggling, Calm | 67% / 0.8 / 6 | 67% / 0.8 / 6 |
| | guesser | 100% / 1.7 / 18 | 42% / 0.4 / 3 |
| 4 Mirror Cliffs | average | 100% / 2.1 / 10 | 100% / 2.1 / 11 |
| | struggling, Calm | 50% / 0.6 / 4 | 67% / 0.8 / 4 |
| | guesser | 100% / 1.7 / 17 | 42% / 0.4 / 3 |
| 5 The Agora | average | 100% / 2.0 / 10 | 100% / 2.0 / 11 |
| | struggling, Calm | 75% / 0.9 / 6 | 75% / 0.9 / 6 |
| | guesser | 100% / 1.9 / 20 | 67% / 0.7 / 5 |
| 6 The Great Tangle | average | 92% / 1.8 / 8 | 92% / 1.8 / 7 |
| | struggling, Calm | 50% / 0.7 / 3 | 50% / 0.7 / 3 |
| | guesser | 100% / 1.9 / 20 | 58% / 0.7 / 5 |

Strong stays at 100% and 20 lives everywhere; struggling at Standard speed loses stages 2
to 6 before and after; no-maths loses every run before and after.

With 40 runs per stage (`--runs=40`, less noise), lives kept, average vs guesser:
before 18/20, 9/17, 10/19, 10/17, 10/20, 9/19; after 18/9, 8/5, 10/2, 10/2, 10/6, 9/6.
Struggling-at-Calm win rates before/after: 100/100, 85/90, 80/80, 70/75, 78/78, 55/53.
Average win rates before/after: 100/100, 98/93, 95/93, 95/88, 98/98, 95/95.

Stars: the guesser never earns the aim star (it never did) and now rarely earns the lives
star either. The average bot almost always earns the aim star and usually loses more than
2 lives after stage 1.

Targets: the no-maths bot always loses (the maths is never optional), the average bot wins
most runs with lives to spare, Calm speed makes every stage reachable, and guessing keeps
fewer lives than careful play on every stage.

## No backend: what it gives and what it costs

Everything runs in the browser. Saves go to `localStorage`; nothing is sent anywhere.

- **Browsers can wipe saves** (private windows, storage pressure, cleared site data,
  Safari's storage limits). The progress code is the backup: write the 18 digits down.
- **The code is checked, not secret.** The checksum catches typos, but anyone who reads the
  source can make a code with every star. Fine for a game. **Not fine if a teacher ever uses
  codes as proof of work.** A signed code would need a secret key, which needs a server.
- **No leaderboards, no class dashboard, no analytics.** By design. If a teacher view is
  wanted later without a server, the same trick works: a "report code" a student reads out
  (stars plus weakest topics), decoded on the teacher's copy of the game.

## Technical choices

- **Canvas 2D, no engine.** PixiJS or Phaser would add 300 KB to 1 MB and a dependency for
  effects this art style does not need. The whole game is one 140 KB HTML file.
- **Deterministic simulation** (`src/sim`) with a seeded RNG and no DOM, so the balance bots
  run the real game logic headless.
- **Riddles are generated, then re-checked.** `npm test` evaluates every generated riddle from
  its displayed text with a separate evaluator, so the text and the expected answer can
  never drift apart.
- **Audio is synthesised** with WebAudio, so there are no sound files to license or load.

## Known limitations in 0.1.4

- One region (Syracuse). Alexandria, Baghdad and Pisa are on the map as "Soon".
- No music yet, only sound effects.
- Portrait phones work but are cramped; the game asks to be turned sideways.
- The battlefield is a canvas, so screen readers cannot read riddles. The menus are HTML.
- Balance is bot-tested only.
