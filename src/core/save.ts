// Saves live in this browser's localStorage. Nothing is ever sent anywhere.
// Browsers can clear this storage (Safari after about a week unused, school
// Chromebooks at log-out), which is why the progress code exists.

import { ALL_STAGES, STAGE_BY_ID } from '../content/regions';

export interface StageRecord {
  bestStars: number;
  clears: number;
  bestAccuracy: number;
  bestStreak: number;
}

export interface Settings {
  sound: boolean;
  speed: 'calm' | 'standard' | 'swift';
  pad: 'auto' | 'on' | 'off';
  motion: 'full' | 'reduced';
}

export interface SaveData {
  v: 1;
  stars: Record<string, number>;
  records: Record<string, StageRecord>;
  seen: string[];
  settings: Settings;
}

const KEY = 'math-defense:save:v1';

export const SPEED_SCALE: Record<Settings['speed'], number> = { calm: 0.6, standard: 1, swift: 1.25 };

function fresh(): SaveData {
  return {
    v: 1,
    stars: {},
    records: {},
    seen: [],
    settings: {
      sound: true,
      speed: 'standard',
      pad: 'auto',
      motion: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'reduced' : 'full',
    },
  };
}

/** Note ids renamed since older saves were written (0.1.3: the enemies became Foglings). */
const RENAMED_NOTES: Record<string, string> = { 'e-muddle': 'e-fogling' };

export function loadSave(): SaveData {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return fresh();
    const data = JSON.parse(raw) as SaveData;
    if (data.v !== 1) return fresh();
    const base = fresh();
    const seen = Array.isArray(data.seen) ? [...new Set(data.seen.map((id) => RENAMED_NOTES[id] ?? id))] : [];
    return { ...base, ...data, seen, settings: { ...base.settings, ...data.settings } };
  } catch {
    return fresh();
  }
}

export function writeSave(data: SaveData): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(data));
  } catch {
    // Private mode or storage disabled: the game still works, it just forgets.
  }
}

export function resetSave(keepSettings: Settings): SaveData {
  const d = fresh();
  d.settings = keepSettings;
  writeSave(d);
  return d;
}

export function isUnlocked(save: SaveData, stageId: string): boolean {
  const st = STAGE_BY_ID[stageId];
  return !!st && st.requires.every((r) => (save.stars[r] ?? 0) > 0);
}

export function noteUnlocked(save: SaveData, noteId: string): boolean {
  if (save.seen.includes(noteId)) return true;
  return ALL_STAGES.some((s) => (save.stars[s.id] ?? 0) > 0 && s.introduces.includes(noteId));
}

export function totalStars(save: SaveData): number {
  return Object.values(save.stars).reduce((a, b) => a + b, 0);
}
