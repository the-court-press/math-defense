// The progress code: your whole campaign as a number you can type on a numpad.
// Layout: 1 version digit, 15 digits of stars (base 4, one slot per stage), 2 check digits.
// The check digits use ISO 7064 mod 97-10 (the scheme bank IBANs use), which catches
// every single-digit typo and almost every swapped pair.
// It is a convenience, not a secret: anyone can decode it, and that is fine.

import { STAGE_SLOTS } from '../content/regions';

const VERSION = 1;
const PAYLOAD_DIGITS = 15; // 4^24 < 10^15, so 24 stage slots fit.

function mod97(digits: string): number {
  let r = 0;
  for (const c of digits) r = (r * 10 + Number(c)) % 97;
  return r;
}

export function encodeProgress(stars: Record<string, number>): string {
  let v = 0n;
  for (let i = STAGE_SLOTS.length - 1; i >= 0; i--) {
    const s = Math.max(0, Math.min(3, stars[STAGE_SLOTS[i]] ?? 0));
    v = v * 4n + BigInt(s);
  }
  const body = String(VERSION) + v.toString().padStart(PAYLOAD_DIGITS, '0');
  const check = 98 - mod97(body + '00');
  const all = body + String(check).padStart(2, '0');
  return all.replace(/(\d{4})(?=\d)/g, '$1 ');
}

/** Returns stars by stage id, or null if the code is mistyped. */
export function decodeProgress(code: string): Record<string, number> | null {
  const d = code.replace(/\D/g, '');
  if (d.length !== 1 + PAYLOAD_DIGITS + 2) return null;
  if (mod97(d) !== 1) return null;
  if (Number(d[0]) !== VERSION) return null;
  let v = BigInt(d.slice(1, 1 + PAYLOAD_DIGITS));
  const out: Record<string, number> = {};
  for (let i = 0; i < STAGE_SLOTS.length; i++) {
    const s = Number(v % 4n);
    v = v / 4n;
    if (s) out[STAGE_SLOTS[i]] = s;
  }
  return v === 0n ? out : null;
}

export const PROGRESS_CODE_LENGTH = 1 + PAYLOAD_DIGITS + 2;
