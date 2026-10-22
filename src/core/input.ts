// Numpad-first input. The whole game is played with the 17 keys of a numpad:
//
//   [Num]  [/]  [*]  [-]
//   [ 7 ]  [8]  [9]  [+]
//   [ 4 ]  [5]  [6]  [+]
//   [ 1 ]  [2]  [3]  [Enter]
//   [   0   ]   [.]  [Enter]
//
// Keys are read by physical position (event.code), so NumLock on or off does not
// matter. The main keyboard's digits and symbols work too as a fallback for laptops.

export type NumKey =
  | '0' | '1' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9'
  | '.' | '-' | '+' | '*' | '/'
  | 'enter' | 'esc' | 'bksp' | 'up' | 'down' | 'left' | 'right';

export interface KeyPress {
  key: NumKey;
  repeat: boolean;
}

const CODE_MAP: Record<string, NumKey> = {
  Numpad0: '0', Numpad1: '1', Numpad2: '2', Numpad3: '3', Numpad4: '4',
  Numpad5: '5', Numpad6: '6', Numpad7: '7', Numpad8: '8', Numpad9: '9',
  NumpadDecimal: '.', NumpadComma: '.', NumpadSubtract: '-', NumpadAdd: '+',
  NumpadMultiply: '*', NumpadDivide: '/', NumpadEnter: 'enter', NumpadEqual: 'enter',
  NumLock: 'esc', NumpadClear: 'esc',
};

const KEY_MAP: Record<string, NumKey> = {
  '0': '0', '1': '1', '2': '2', '3': '3', '4': '4', '5': '5', '6': '6', '7': '7', '8': '8', '9': '9',
  '.': '.', ',': '.', '-': '-', '+': '+', '=': '+', '*': '*', '/': '/',
  Enter: 'enter', Escape: 'esc', Backspace: 'bksp', Delete: 'bksp',
  ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right',
};

export function mapKeyEvent(e: KeyboardEvent): NumKey | null {
  if (e.ctrlKey || e.metaKey || e.altKey) return null;
  if (e.code in CODE_MAP) return CODE_MAP[e.code];
  return KEY_MAP[e.key] ?? null;
}

type Handler = (k: KeyPress) => void;

export class Input {
  private handler: Handler | null = null;
  private listeners = new Set<(k: NumKey) => void>();
  /** Set once any physical key arrives; used to decide whether to show the on-screen pad. */
  sawKeyboard = false;

  constructor() {
    window.addEventListener('keydown', (e) => {
      const key = mapKeyEvent(e);
      if (!key) return;
      e.preventDefault();
      this.sawKeyboard = true;
      this.emit(key, e.repeat);
    });
  }

  setHandler(h: Handler | null): void {
    this.handler = h;
  }

  /** Observers (for example the on-screen pad lighting up the key you pressed). */
  onAny(fn: (k: NumKey) => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  emit(key: NumKey, repeat = false): void {
    for (const l of this.listeners) l(key);
    this.handler?.({ key, repeat });
  }
}

// ---------------------------------------------------------------- menu helpers

export type Dir = 'up' | 'down' | 'left' | 'right';

/** In menus the numpad is a D-pad: 8 up, 2 down, 4 left, 6 right. */
export function navDir(k: NumKey): Dir | null {
  switch (k) {
    case '8':
    case 'up':
      return 'up';
    case '2':
    case 'down':
      return 'down';
    case '4':
    case 'left':
      return 'left';
    case '6':
    case 'right':
      return 'right';
    default:
      return null;
  }
}

export function isOk(k: NumKey): boolean {
  return k === 'enter' || k === '5';
}

export function isBack(k: NumKey): boolean {
  return k === '/' || k === 'esc' || k === 'bksp';
}
