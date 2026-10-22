// The battle screen: canvas, HUD, answer field, build cards, pause and results.
//
// Numpad meaning in battle:
//   0-9 . −   type an answer (− flips the sign at any time)
//   Enter     fire the answer, or start the next wave when the field is empty
//   +         build mode: pick a spot by its numpad position
//   ✱         Archimedes' Claw, once charged
//   /         delete a digit (never opens the menu, so it is safe to hammer)
//   Esc/NumLock  pause menu (also the ❚❚ button on the HUD and the esc key on the on-screen pad)

import { sfx } from '../core/audio';
import { isBack, isOk, type KeyPress, type NumKey } from '../core/input';
import { SPEED_SCALE, isUnlocked } from '../core/save';
import { Battle, CLAW_MAX, STAR_ACCURACY, STAR_LIVES, sellValue, towerStats, upgradeCost, type BattleEvent } from '../sim/battle';
import { BattleRenderer } from '../render/battleRenderer';
import { enemyIcon, towerIcon } from '../render/art';
import { REGIONS, STAGE_BY_ID } from '../content/regions';
import { ENEMIES, TOWERS } from '../content/units';
import type { HintDef, HintTrigger, SiteDigit, StageDef } from '../content/types';
import { clear, formatNumber, h, kc, percentDown, withKeys } from './dom';
import { MenuList } from './menu';
import type { App, Screen } from './app';
import { MapScreen } from './map';

type Mode = 'play' | 'site' | 'pick' | 'manage' | 'paused' | 'results';

const shownHints = new Set<string>();
/** Tips that apply on every stage, shown once per stage per session. */
const GLOBAL_HINTS: HintDef[] = [
  { on: 'firstJam', text: 'Steady! A wrong answer jams your engines for a moment. Quick guesses jam them longer. Think, then fire.' },
];
const MAX_ENTRY = 7;

export class BattleScreen implements Screen {
  readonly el: HTMLElement;
  readonly wantsPad = true;
  private stage: StageDef;
  private battle: Battle;
  private renderer: BattleRenderer;
  private canvas = h('canvas', { class: 'battle-canvas' });
  private mode: Mode = 'play';
  private entry = '';
  private site: SiteDigit | null = null;
  private pickIdx = -1;
  private sellArmed = false;
  private raf = 0;
  private last = 0;
  private ro: ResizeObserver;
  private finished = false;
  private hintTimer = 0;
  private hintQueue: string[] = [];

  // HUD
  private lives = h('span', { class: 'hud-num' });
  private gold = h('span', { class: 'hud-num' });
  private wave = h('span', { class: 'hud-num' });
  private clawDots = h('span', { class: 'claw-dots' });
  private clawPill = h('div', { class: 'hud-pill claw' });
  private answer = h('div', { class: 'answer' });
  private answerText = h('span', { class: 'answer-text' });
  private steadyBadge = h('span', { class: 'steady-badge hidden' });
  private lastSteady = -1;
  private coach = h('div', { class: 'coach hidden' });
  private banner = h('div', { class: 'banner glass hidden' });
  private legend = h('div', { class: 'legend battle-legend' });
  private card = h('div', { class: 'build-card glass hidden' });
  private menuBtn = h('button', { class: 'hud-menu', text: '❚❚', attrs: { type: 'button', 'aria-label': 'Pause menu', title: 'Menu (Esc)' } });
  private sheet = h('div', { class: 'sheet-wrap hidden' });
  private sheetMenu: MenuList | null = null;
  private lastGold = -1;
  private lastLives = -1;
  private lastPhase = '';

  constructor(private app: App, stageId: string) {
    this.stage = STAGE_BY_ID[stageId];
    this.battle = new Battle(this.stage, (Date.now() ^ (Math.random() * 1e9)) >>> 0);
    this.renderer = new BattleRenderer(this.canvas, this.battle);
    this.renderer.reducedMotion = app.save.settings.motion === 'reduced';

    for (const n of this.stage.introduces) if (!app.save.seen.includes(n)) app.save.seen.push(n);
    app.persist();

    for (let i = 0; i < CLAW_MAX; i++) this.clawDots.append(h('i'));
    this.clawPill.append(h('span', { class: 'hud-label', text: 'Claw' }), this.clawDots, kc('*'));
    this.answer.append(this.answerText, this.steadyBadge);

    this.el = h(
      'div',
      { class: 'screen battle' },
      this.canvas,
      h(
        'div',
        { class: 'hud' },
        h(
          'div',
          { class: 'hud-pill stats' },
          h('span', { class: 'hud-item lives' }, h('b', { text: '♥' }), this.lives),
          h('span', { class: 'hud-item gold' }, h('b', { class: 'coin' }), this.gold),
          h('span', { class: 'hud-item wave' }, h('span', { class: 'hud-label', text: 'Wave' }), this.wave),
          this.menuBtn,
        ),
        h('div', { class: 'hud-title' }, h('strong', { text: this.stage.name }), h('span', { text: this.stage.focus })),
        h('div', { class: 'rotate-hint', text: 'Turn your device sideways for a bigger battlefield' }),
        this.clawPill,
        this.coach,
        this.banner,
        this.answer,
        this.legend,
        this.card,
      ),
      this.sheet,
    );

    this.menuBtn.addEventListener('click', (e) => {
      e.preventDefault();
      this.menuBtn.blur();
      this.openPause();
    });

    this.ro = new ResizeObserver(() => this.resize());
    this.ro.observe(this.el);
    document.addEventListener('visibilitychange', this.onVisibility);
    this.renderAnswer();
    this.renderLegend();
    this.trigger('start');
    this.raf = requestAnimationFrame((t) => this.frame(t));
  }

  private onVisibility = () => {
    if (document.hidden && this.mode === 'play') this.openPause();
  };

  private resize(): void {
    const r = this.el.getBoundingClientRect();
    this.renderer.resize(r.width, r.height, Math.min(2.5, devicePixelRatio || 1));
  }

  // ---------------------------------------------------------------- loop

  private frame(now: number): void {
    const dt = Math.min(0.05, (now - (this.last || now)) / 1000);
    this.last = now;
    if (this.mode === 'play') {
      this.battle.speed = SPEED_SCALE[this.app.save.settings.speed];
      let left = dt * this.battle.speed;
      while (left > 0) {
        const step = Math.min(1 / 60, left);
        this.battle.step(step);
        left -= step;
      }
    }
    const events = this.battle.drainEvents();
    this.renderer.handle(events);
    this.onEvents(events);
    const building = this.mode === 'site' || this.mode === 'pick' || this.mode === 'manage';
    this.renderer.draw(dt, {
      buildMode: building,
      selectedSite: building ? this.site : null,
      previewTower: this.mode === 'pick' && this.pickIdx >= 0 ? this.stage.towers[this.pickIdx] : null,
      hideRiddles: building || this.mode === 'paused',
    });
    this.updateHud(dt);
    this.raf = requestAnimationFrame((t) => this.frame(t));
  }

  private onEvents(events: BattleEvent[]): void {
    for (const ev of events) {
      switch (ev.type) {
        case 'spawn':
          if (ev.enemy.riddle) this.trigger('firstRiddle');
          if (ev.enemy.def.id === 'shellback') this.trigger('shellback');
          if (ev.enemy.def.id === 'mites') this.trigger('mites');
          break;
        case 'lock':
          sfx.lock();
          this.trigger('firstLock');
          break;
        case 'answerMiss':
          sfx.miss();
          this.trigger('firstMiss');
          break;
        case 'jam':
          sfx.jam();
          this.trigger('firstJam');
          break;
        case 'fire':
          sfx.fire(ev.tower.def.projectile);
          break;
        case 'impact':
          if (ev.miss) sfx.thud();
          else sfx.impact(ev.kind);
          break;
        case 'kill':
          sfx.kill();
          break;
        case 'leak':
          sfx.leak();
          break;
        case 'waveStart':
          sfx.wave();
          break;
        case 'waveClear':
          sfx.coin();
          this.trigger('waveCleared', ev.wave);
          break;
        case 'clawReady':
          sfx.ready();
          this.trigger('clawReady');
          break;
        case 'clawStart':
          sfx.claw();
          break;
        case 'build':
        case 'upgrade':
          sfx.build();
          break;
        case 'sell':
          sfx.coin();
          break;
        case 'won':
          window.setTimeout(() => this.finish(true), 900);
          break;
        case 'lost':
          window.setTimeout(() => this.finish(false), 700);
          break;
        default:
          break;
      }
    }
  }

  // ---------------------------------------------------------------- hints

  private trigger(on: HintTrigger, wave?: number): void {
    const hints = [...(this.stage.hints ?? []), ...GLOBAL_HINTS];
    hints.forEach((hd: HintDef, i) => {
      if (hd.on !== on || (hd.wave !== undefined && hd.wave !== wave)) return;
      const key = `${this.stage.id}:${i < (this.stage.hints?.length ?? 0) ? i : 'g' + hd.on}`;
      if (shownHints.has(key)) return;
      shownHints.add(key);
      if (on === 'firstJam') {
        // Explain the jam the moment it happens, ahead of any waiting tips.
        this.hintQueue.unshift(hd.text);
        this.hintTimer = 0;
      } else this.hintQueue.push(hd.text);
    });
    if (this.hintTimer <= 0) this.nextHint();
  }

  private nextHint(): void {
    const text = this.hintQueue.shift();
    if (!text) {
      this.coach.classList.add('hidden');
      this.hintTimer = 0;
      return;
    }
    clear(this.coach);
    this.coach.append(h('span', { class: 'coach-dot' }), h('span', { class: 'coach-text' }, withKeys(text)));
    this.coach.classList.remove('hidden');
    this.coach.classList.remove('pop');
    void this.coach.offsetWidth;
    this.coach.classList.add('pop');
    this.hintTimer = Math.max(5, text.length / 12);
  }

  // ---------------------------------------------------------------- HUD

  private updateHud(dt: number): void {
    const b = this.battle;
    if (b.gold !== this.lastGold) {
      if (this.lastGold >= 0) this.bump(this.gold);
      this.gold.textContent = String(b.gold);
      this.lastGold = b.gold;
    }
    if (b.lives !== this.lastLives) {
      if (this.lastLives >= 0 && b.lives < this.lastLives) this.bump(this.lives, 'hurt');
      this.lives.textContent = String(b.lives);
      this.lastLives = b.lives;
    }
    this.wave.textContent = `${Math.max(1, b.waveIndex)}/${b.totalWaves}`;
    // "Steady!" countdown after a miss, in real seconds.
    const steady = b.steadyLeft > 0 ? Math.ceil(b.steadyLeft / b.speed) : 0;
    if (steady !== this.lastSteady) {
      this.lastSteady = steady;
      this.answer.classList.toggle('steady', steady > 0);
      this.steadyBadge.classList.toggle('hidden', steady === 0);
      this.steadyBadge.textContent = steady ? `Steady… ${steady}` : '';
    }
    const dots = this.clawDots.children;
    for (let i = 0; i < dots.length; i++) dots[i].classList.toggle('on', i < b.clawCharge);
    this.clawPill.classList.toggle('ready', b.clawCharge >= CLAW_MAX);

    const phaseKey = `${b.phase}:${b.waveIndex}:${this.mode}`;
    if (phaseKey !== this.lastPhase) {
      this.lastPhase = phaseKey;
      this.renderBanner();
      this.renderLegend();
    }

    if (this.hintTimer > 0 && this.mode === 'play') {
      // The opening hint waits until the first wave is sent.
      const holding = b.phase === 'planning' && b.waveIndex === 0;
      if (!holding) {
        this.hintTimer -= dt;
        if (this.hintTimer <= 0) this.nextHint();
      }
    }
  }

  private bump(el: HTMLElement, cls = 'bump'): void {
    el.classList.remove(cls);
    void el.offsetWidth;
    el.classList.add(cls);
  }

  private renderBanner(): void {
    const b = this.battle;
    const show = b.phase === 'planning' && this.mode === 'play';
    this.banner.classList.toggle('hidden', !show);
    if (!show) return;
    clear(this.banner);
    const next = this.stage.waves[b.waveIndex];
    const counts = new Map<string, number>();
    for (const g of next.groups) counts.set(g.enemy, (counts.get(g.enemy) ?? 0) + g.count);
    this.banner.append(
      h('div', { class: 'banner-title' }, h('span', { class: 'eyebrow', text: b.waveIndex === 0 ? 'Ready?' : 'Next up' }), h('strong', { text: `Wave ${b.waveIndex + 1} of ${b.totalWaves}` })),
      h(
        'div',
        { class: 'banner-preview' },
        ...[...counts.entries()].map(([id, n]) => {
          const e = ENEMIES[id];
          return h('span', { class: 'preview-chip', attrs: { title: e.name } }, enemyIcon(e.look, e.radius, 34), h('b', { text: `×${n}` }));
        }),
      ),
      h('div', { class: 'banner-actions' }, h('span', {}, withKeys('[Enter] Start wave')), h('span', { class: 'muted' }, withKeys('[+] Build'))),
    );
  }

  private renderLegend(): void {
    clear(this.legend);
    const parts: string[] = {
      play: ['[Enter] Fire', '[+] Build', '[*] Claw', '[/] Delete', '[Esc] Menu'],
      site: ['[1]–[9] Choose a spot', '[/] Done'],
      pick: ['Number: choose engine', '[Enter] Build', '[/] Back'],
      manage: ['[+] Upgrade', '[−] Sell', '[/] Back'],
      paused: ['[8] [2] Move', '[Enter] Choose', '[Esc] Resume'],
      results: ['[8] [2] Move', '[Enter] Choose'],
    }[this.mode];
    parts.forEach((p) => this.legend.append(h('span', {}, withKeys(p))));
  }

  private renderAnswer(state: 'idle' | 'good' | 'bad' | 'dup' = 'idle', note = ''): void {
    const empty = this.entry === '';
    this.answer.classList.toggle('empty', empty);
    this.answer.classList.toggle('hidden', this.mode !== 'play');
    if (state !== 'idle') {
      this.answer.classList.remove('good', 'bad', 'dup');
      void this.answer.offsetWidth;
      this.answer.classList.add(state);
      clear(this.answerText);
      this.answerText.append(note);
      window.setTimeout(() => {
        this.answer.classList.remove('good', 'bad', 'dup');
        this.renderAnswer();
      }, 650);
      return;
    }
    clear(this.answerText);
    if (empty) {
      this.answerText.append(this.battle.phase === 'planning' ? h('span', { class: 'placeholder' }, withKeys('[Enter] to start')) : h('span', { class: 'placeholder', text: 'Type an answer' }));
    } else {
      this.answerText.append(this.entry.replace('-', '−'), h('i', { class: 'caret' }));
    }
  }

  // ---------------------------------------------------------------- input

  key({ key, repeat }: KeyPress): void {
    if (repeat && this.mode === 'play' && key !== '/' && key !== 'bksp') return;
    switch (this.mode) {
      case 'play':
        return this.keyPlay(key);
      case 'site':
        return this.keySite(key);
      case 'pick':
        return this.keyPick(key);
      case 'manage':
        return this.keyManage(key);
      case 'paused':
      case 'results':
        if (this.mode === 'paused' && isBack(key)) {
          this.closeSheet();
          return;
        }
        this.sheetMenu?.key(key);
        return;
    }
  }

  private keyPlay(key: NumKey): void {
    const b = this.battle;
    if (/^[0-9]$/.test(key)) {
      if (this.entry.replace('-', '').length >= MAX_ENTRY) return sfx.denied();
      this.entry += key;
      sfx.key();
    } else if (key === '.') {
      if (this.entry.includes('.')) return sfx.denied();
      this.entry += this.entry === '' || this.entry === '-' ? '0.' : '.';
      sfx.key();
    } else if (key === '-') {
      this.entry = this.entry.startsWith('-') ? this.entry.slice(1) : '-' + this.entry;
      sfx.key();
    } else if (key === '/' || key === 'bksp') {
      // Delete only. The menu lives on Esc / NumLock, so hammering / can never pause.
      if (this.entry) {
        this.entry = this.entry.slice(0, -1);
        if (this.entry === '-') this.entry = '';
        sfx.key();
      }
    } else if (key === 'esc') {
      this.openPause();
      return;
    } else if (key === 'enter') {
      if (this.entry && this.entry !== '-' && this.entry !== '0.') {
        this.submit();
        return;
      }
      if (b.phase === 'planning') {
        b.startWave();
        if (this.hintTimer > 0) this.hintTimer = Math.min(this.hintTimer, 2.5);
      }
    } else if (key === '+') {
      this.enterBuild();
      return;
    } else if (key === '*') {
      if (!b.useClaw()) {
        sfx.denied();
        this.bump(this.clawPill, 'shake');
      }
    }
    this.renderAnswer();
  }

  private submit(): void {
    const b = this.battle;
    const typed = this.entry;
    if (b.steadyLeft > 0) {
      // "Steady!": keep what was typed, it fires when the countdown ends and Enter is pressed again.
      sfx.steady();
      this.bump(this.answer, 'shake');
      return;
    }
    this.entry = '';
    const before = b.events.length;
    b.submitAnswer(typed);
    const ev = b.events.slice(before).find((e) => e.type === 'lock' || e.type === 'answerMiss' || e.type === 'duplicate' || e.type === 'noTarget');
    const shown = formatNumber(parseFloat(typed));
    if (!ev) this.renderAnswer();
    else if (ev.type === 'lock') this.renderAnswer('good', `${shown}  ✓`);
    else if (ev.type === 'answerMiss') this.renderAnswer('bad', ev.kind === 'sign' ? `${shown}  · sign?` : `${shown}  · ${ev.kind}`);
    else if (ev.type === 'duplicate') this.renderAnswer('dup', `${shown}  · already locked`);
    else this.renderAnswer('dup', 'Nothing to aim at yet');
  }

  // ---------------------------------------------------------------- building

  private enterBuild(): void {
    this.setMode('site');
    this.site = null;
    sfx.select();
    this.renderCard();
  }

  private setMode(m: Mode): void {
    this.mode = m;
    this.sellArmed = false;
    this.renderAnswer();
    this.renderLegend();
    this.renderBanner();
    this.el.classList.toggle('building', m === 'site' || m === 'pick' || m === 'manage');
  }

  private keySite(key: NumKey): void {
    if (/^[1-9]$/.test(key)) {
      const d = Number(key) as SiteDigit;
      if (!this.stage.sites[d]) return sfx.denied();
      this.site = d;
      this.pickIdx = -1;
      sfx.move();
      this.setMode(this.battle.towers.has(d) ? 'manage' : 'pick');
      if (this.mode === 'pick') {
        // Preselect the first engine the player can afford.
        const affordable = this.stage.towers.findIndex((id) => TOWERS[id].cost <= this.battle.gold);
        this.pickIdx = affordable;
      }
      this.renderCard();
      return;
    }
    if (isBack(key) || key === '+' || key === 'enter') {
      sfx.back();
      this.site = null;
      this.setMode('play');
      this.renderCard();
    }
  }

  private keyPick(key: NumKey): void {
    const n = this.stage.towers.length;
    if (/^[1-9]$/.test(key)) {
      const i = Number(key) - 1;
      if (i >= n) return sfx.denied();
      if (i === this.pickIdx) return this.tryBuild();
      this.pickIdx = i;
      sfx.move();
      this.renderCard();
      return;
    }
    if (isOk(key)) return this.tryBuild();
    if (isBack(key)) {
      sfx.back();
      this.site = null;
      this.setMode('site');
      this.renderCard();
    }
  }

  private tryBuild(): void {
    if (this.site === null || this.pickIdx < 0) return sfx.denied();
    const id = this.stage.towers[this.pickIdx];
    if (!this.battle.build(this.site, id)) {
      sfx.denied();
      this.bump(this.card, 'shake');
      return;
    }
    this.site = null;
    this.setMode('site');
    this.renderCard();
  }

  private keyManage(key: NumKey): void {
    if (this.site === null) return;
    if (key === '+') {
      if (!this.battle.upgrade(this.site)) {
        sfx.denied();
        this.bump(this.card, 'shake');
      }
      this.renderCard();
      return;
    }
    if (key === '-') {
      if (!this.sellArmed) {
        this.sellArmed = true;
        sfx.move();
        this.renderCard();
        return;
      }
      this.battle.sell(this.site);
      this.site = null;
      this.setMode('site');
      this.renderCard();
      return;
    }
    if (isBack(key) || key === 'enter') {
      sfx.back();
      this.site = null;
      this.setMode('site');
      this.renderCard();
    }
  }

  private renderCard(): void {
    const card = this.card;
    clear(card);
    const b = this.battle;
    if (this.mode === 'site') {
      card.classList.remove('hidden');
      card.className = 'build-card glass compact';
      card.append(
        h('div', { class: 'card-head' }, h('strong', { text: 'Build' }), h('span', { class: 'muted', text: 'Paused · spots match your numpad' })),
        h('div', { class: 'mini-pad' }, ...[7, 8, 9, 4, 5, 6, 1, 2, 3].map((d) => {
          const has = !!this.stage.sites[d as SiteDigit];
          const tw = b.towers.get(d as SiteDigit);
          return h('span', { class: `mini-key${has ? '' : ' none'}${tw ? ' built' : ''}`, text: String(d) });
        })),
        h('div', { class: 'card-foot' }, withKeys(`Gold ${b.gold}`)),
      );
      return;
    }
    if (this.mode === 'pick' && this.site !== null) {
      card.className = 'build-card glass';
      card.append(h('div', { class: 'card-head' }, h('strong', { text: `Spot ${this.site}` }), h('span', { class: 'muted', text: `You have ${b.gold} gold` })));
      const row = h('div', { class: 'tower-row' });
      this.stage.towers.forEach((id, i) => {
        const def = TOWERS[id];
        const afford = def.cost <= b.gold;
        row.append(
          h(
            'div',
            { class: `tower-tile${i === this.pickIdx ? ' selected' : ''}${afford ? '' : ' poor'}` },
            kc(String(i + 1), 'tile-key'),
            towerIcon(id, 52),
            h('strong', { text: def.name }),
            h('span', { class: `weight w-${def.weight.toLowerCase()}`, text: def.kind === 'light' ? `${def.weight} · automatic` : `${def.weight} · math-aimed` }),
            h('span', { class: 'cost' }, h('b', { class: 'coin' }), String(def.cost)),
          ),
        );
      });
      card.append(row);
      const sel = this.stage.towers[this.pickIdx];
      if (sel) {
        const def = TOWERS[sel];
        const st = towerStats(def, 0);
        card.append(
          h('p', { class: 'tile-blurb', text: def.blurb }),
          h('div', { class: 'stat-row' }, stat('Damage', String(st.damage)), stat('Range', String(Math.round(st.range))), stat('Reload', `${st.reload.toFixed(1)}s`), def.splash ? stat('Splash', String(def.splash)) : null, def.slow ? stat('Slow', `${Math.round((1 - def.slow.factor) * 100)}%`) : null),
          h('div', { class: 'card-foot' }, withKeys(def.cost <= b.gold ? '[Enter] Build   [/] Back' : `Needs ${def.cost - b.gold} more gold   [/] Back`)),
        );
      }
      card.classList.remove('hidden');
      return;
    }
    if (this.mode === 'manage' && this.site !== null) {
      const tw = b.towers.get(this.site);
      if (!tw) return;
      const st = towerStats(tw.def, tw.level);
      const up = upgradeCost(tw.def, tw.level);
      const next = up !== null ? towerStats(tw.def, tw.level + 1) : null;
      card.className = 'build-card glass manage';
      card.append(
        h('div', { class: 'manage-head' }, towerIcon(tw.def.id, 60), h('div', {}, h('strong', { text: tw.def.name }), h('span', { class: 'muted', text: `Spot ${this.site} · Level ${tw.level + 1} of 3 · ${tw.def.weight}` }))),
        h('div', { class: 'stat-row' }, stat('Damage', next ? `${st.damage} → ${next.damage}` : String(st.damage)), stat('Range', next ? `${Math.round(st.range)} → ${Math.round(next.range)}` : String(Math.round(st.range))), stat('Reload', `${st.reload.toFixed(1)}s`)),
        h(
          'div',
          { class: 'action-row' },
          up !== null
            ? h('div', { class: `action${up <= b.gold ? '' : ' poor'}` }, kc('+'), h('span', { text: 'Upgrade' }), h('span', { class: 'cost' }, h('b', { class: 'coin' }), String(up)))
            : h('div', { class: 'action done' }, h('span', { text: 'Fully upgraded' })),
          h('div', { class: `action sell${this.sellArmed ? ' armed' : ''}` }, kc('-'), h('span', { text: this.sellArmed ? 'Press again to sell' : 'Sell' }), h('span', { class: 'cost' }, h('b', { class: 'coin' }), `+${sellValue(tw)}`)),
        ),
      );
      card.classList.remove('hidden');
      return;
    }
    card.classList.add('hidden');
  }

  // ---------------------------------------------------------------- pause and results

  private openPause(): void {
    if (this.mode !== 'play') return;
    sfx.select();
    this.setMode('paused');
    const s = this.app.save.settings;
    this.showSheet(
      h('div', { class: 'sheet-head' }, h('div', { class: 'eyebrow', text: this.stage.name }), h('h2', { text: 'Paused' })),
      new MenuList([
        { label: 'Resume', icon: '▶︎', action: () => this.closeSheet() },
        { label: 'Restart stage', icon: '↺', action: () => this.app.show(new BattleScreen(this.app, this.stage.id)) },
        {
          label: 'Game speed',
          icon: '◷',
          value: () => ({ calm: 'Calm', standard: 'Standard', swift: 'Swift' })[s.speed],
          adjust: (d) => {
            const order = ['calm', 'standard', 'swift'] as const;
            s.speed = order[Math.max(0, Math.min(2, order.indexOf(s.speed) + d))];
            this.app.persist();
          },
        },
        {
          label: 'Sound',
          icon: '♪',
          value: () => (s.sound ? 'On' : 'Off'),
          adjust: () => {
            s.sound = !s.sound;
            this.app.applySettings();
            this.app.persist();
          },
        },
        { label: 'Leave stage', icon: '⌂', danger: true, action: () => this.app.show(new MapScreen(this.app)) },
      ]),
    );
  }

  private showSheet(head: HTMLElement, menu: MenuList, extra?: HTMLElement): void {
    this.sheetMenu = menu;
    clear(this.sheet);
    this.sheet.append(h('div', { class: 'sheet glass' }, head, extra ?? null, menu.el));
    this.sheet.classList.remove('hidden');
  }

  private closeSheet(): void {
    sfx.back();
    this.sheet.classList.add('hidden');
    this.sheetMenu = null;
    this.setMode('play');
    this.last = performance.now();
  }

  private finish(won: boolean): void {
    if (this.finished) return;
    this.finished = true;
    const b = this.battle;
    const save = this.app.save;
    const earned = b.starsEarned();
    const stars = earned.filter(Boolean).length;
    const acc = b.accuracy();
    const prevStars = save.stars[this.stage.id] ?? 0;
    if (won) {
      save.stars[this.stage.id] = Math.max(prevStars, stars);
      const rec = (save.records[this.stage.id] ??= { bestStars: 0, clears: 0, bestAccuracy: 0, bestStreak: 0 });
      rec.bestStars = Math.max(rec.bestStars, stars);
      rec.clears++;
      rec.bestAccuracy = Math.max(rec.bestAccuracy, acc);
      rec.bestStreak = Math.max(rec.bestStreak, b.stats.bestStreak);
    }
    this.app.persist();
    if (won) sfx.win();
    else sfx.lose();

    this.setMode('results');
    const region = REGIONS.find((r) => r.stages.includes(this.stage))!;
    const nextStage = region.stages[region.stages.indexOf(this.stage) + 1];
    const canNext = won && nextStage && isUnlocked(save, nextStage.id);

    const misses = dedupeMisses(b.stats.misses).slice(0, 3);
    const extra = h(
      'div',
      { class: 'results' },
      won ? starReasons(earned, b.maxLives) : null,
      h(
        'div',
        { class: 'result-grid' },
        stat('Accuracy', b.stats.attempts ? `${percentDown(acc)}%` : '—'),
        stat('Solved', String(b.stats.correct)),
        stat('Best streak', String(b.stats.bestStreak)),
        stat('Lives left', `${b.lives}/${b.maxLives}`),
      ),
      misses.length
        ? h(
            'div',
            { class: 'review' },
            h('div', { class: 'card-label', text: 'Worth another look' }),
            ...misses.map((m) =>
              h(
                'div',
                { class: 'review-row' },
                h('span', { class: 'review-q', text: m.lines.join('   ') }),
                h('span', { class: 'review-a' }, h('b', { text: formatNumber(m.answer) }), h('span', { class: 'muted', text: ` · you typed ${formatNumber(m.typed)}` })),
              ),
            ),
          )
        : b.stats.attempts
          ? h('p', { class: 'muted center', text: 'Not a single miss. Archimedes approves.' })
          : null,
    );

    const items = [] as ConstructorParameters<typeof MenuList>[0];
    if (canNext) items.push({ label: `Next: ${nextStage.name}`, icon: '▶︎', action: () => this.app.show(new BattleScreen(this.app, nextStage.id)) });
    const calmer = !won && this.app.save.settings.speed !== 'calm';
    if (calmer)
      items.push({
        label: 'Try again at Calm speed',
        icon: '◷',
        action: () => {
          this.app.save.settings.speed = 'calm';
          this.app.persist();
          this.app.show(new BattleScreen(this.app, this.stage.id));
        },
      });
    items.push({ label: won ? 'Play again' : 'Try again', icon: '↺', action: () => this.app.show(new BattleScreen(this.app, this.stage.id)) });
    items.push({ label: 'Back to the map', icon: '⌂', action: () => this.app.show(new MapScreen(this.app)) });

    const head = h(
      'div',
      { class: `sheet-head ${won ? 'won' : 'lost'}` },
      h('div', { class: 'eyebrow', text: this.stage.name }),
      h('h2', { text: won ? 'Syracuse holds!' : 'The Foglings broke through' }),
      won
        ? h('span', { class: 'stars big' }, ...earned.map((on) => h('span', { class: on ? 'star on' : 'star', text: '★' })))
        : h('p', { class: 'muted', text: calmer ? 'Every miss shows you what to practise. Calm speed gives you more time for each riddle.' : 'Every miss shows you what to practise.' }),
    );
    this.showSheet(head, new MenuList(items), extra);
    if (won) {
      head.querySelectorAll('.star.on').forEach((el, i) => {
        (el as HTMLElement).style.animationDelay = `${0.25 + i * 0.22}s`;
        window.setTimeout(() => sfx.star(i), 250 + i * 220);
      });
    }
  }

  destroy(): void {
    cancelAnimationFrame(this.raf);
    this.ro.disconnect();
    document.removeEventListener('visibilitychange', this.onVisibility);
  }
}

/** One short line per star, in words an 11-year-old would use. */
export function starLabels(maxLives: number): [string, string, string] {
  const canLose = maxLives - Math.ceil(maxLives * STAR_LIVES);
  const lives = canLose <= 0 ? 'Lost no lives' : `Lost ${canLose} ${canLose === 1 ? 'life' : 'lives'} or fewer`;
  return ['Held the city', lives, `Sharp aim: ${Math.round(STAR_ACCURACY * 100)}%+ right`];
}

function starReasons(earned: [boolean, boolean, boolean], maxLives: number): HTMLElement {
  const labels = starLabels(maxLives);
  return h(
    'div',
    { class: 'star-reasons' },
    ...labels.map((text, i) => h('div', { class: `star-reason${earned[i] ? ' on' : ''}` }, h('span', { class: 'sr-star', text: '★' }), h('span', { text }))),
  );
}

function stat(label: string, value: string): HTMLElement {
  return h('div', { class: 'stat' }, h('span', { class: 'stat-label', text: label }), h('strong', { text: value }));
}

function dedupeMisses<T extends { lines: string[] }>(list: T[]): T[] {
  const seen = new Set<string>();
  return list.filter((m) => {
    const k = m.lines.join('|');
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}
