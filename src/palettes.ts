/**
 * Gradient palette definitions and helpers for GPU upload.
 *
 * Each palette is an array of color stops. Positions are evenly spaced
 * by default. Colors are stored as linear-space [r, g, b] floats (0–1).
 */

export const MAX_STOPS = 8;

// ---- Easing ----

/**
 * Symmetric ease-in-out power curve.
 * p=1 is linear, p=5 (default) gives a smooth ease.
 */
export const easeInOut = (t: number, p = 5): number =>
  t <= 0.5
    ? Math.pow(t * 2, p) / 2
    : 1 - Math.pow(2 - t * 2, p) / 2;

// ---- Types ----

export interface ColorStop {
  color: [number, number, number]; // RGB 0–1
}

export interface Palette {
  name: string;
  stops: ColorStop[];
}

// ---- Hex → RGB helper ----

function hex(h: string): [number, number, number] {
  const r = parseInt(h.slice(0, 2), 16) / 255;
  const g = parseInt(h.slice(2, 4), 16) / 255;
  const b = parseInt(h.slice(4, 6), 16) / 255;
  return [r, g, b];
}

// ---- 8 Palettes ----

export const PALETTES: Record<string, Palette> = {
  A: {
    name: 'Dawn',
    stops: [
      { color: hex('331B0F') },
      { color: hex('E82338') },
      { color: hex('FC6540') },
      { color: hex('F39A35') },
      { color: hex('FFC471') },
      { color: hex('CCC4BB') },
      { color: hex('66A4CE') },
      { color: hex('5890C3') },
    ],
  },
  B: {
    name: 'Foggy Haze',
    stops: [
      { color: hex('4E917D') },
      { color: hex('C4EFC9') },
      { color: hex('CEF36E') },
      { color: hex('4E917D') },
      { color: hex('0A6350') },
    ],
  },
  C: {
    name: 'Morning',
    stops: [
      { color: hex('FFFFFF') },
      { color: hex('F39A35') },
      { color: hex('FC6540') },
    ],
  },
  D: {
    name: 'Midday',
    stops: [
      { color: hex('89C0C6') },
      { color: hex('DEDEDE') },
      { color: hex('DEDEDE') },
      { color: hex('89C0C6') },
      { color: hex('66A4CE') },
    ],
  },
  E: {
    name: 'Dusk',
    stops: [
      { color: hex('9EEFE1') },
      { color: hex('DBDBDB') },
      { color: hex('F39A35') },
      { color: hex('4E917D') },
      { color: hex('0A6350') },
    ],
  },
  F: {
    name: 'Sunset',
    stops: [
      { color: hex('E82338') },
      { color: hex('FC483B') },
      { color: hex('FC6540') },
      { color: hex('C29688') },
    ],
  },
  G: {
    name: 'Afterglow',
    stops: [
      { color: hex('FC6540') },
      { color: hex('F39A35') },
      { color: hex('FC6540') },
      { color: hex('FC483B') },
      { color: hex('FC6540') },
      { color: hex('F39A35') },
    ],
  },
  H: {
    name: 'Night',
    stops: [
      { color: hex('000000') },
      { color: hex('0B1836') },
      { color: hex('1F3362') },
    ],
  },
};

/** Ordered keys for the dropdown */
export const PALETTE_KEYS = Object.keys(PALETTES) as Array<keyof typeof PALETTES>;

/** Label map for Leva dropdown: { "A — Red": "A", ... } */
export const PALETTE_OPTIONS: Record<string, string> = {};
for (const key of PALETTE_KEYS) {
  PALETTE_OPTIONS[`${key} — ${PALETTES[key].name}`] = key;
}

// ---- GPU data helpers ----

export interface PaletteGPUData {
  colors: Float32Array;    // MAX_STOPS * 3 floats (RGB triples)
  positions: Float32Array; // MAX_STOPS floats
  stopCount: number;
}

/**
 * Convert a Palette to flat typed arrays suitable for uniform upload.
 * Positions are evenly spaced [0, ..., 1]. Arrays are padded to MAX_STOPS
 * by repeating the last color at position 1.0.
 */
export function paletteToGPU(palette: Palette): PaletteGPUData {
  const count = palette.stops.length;
  const colors = new Float32Array(MAX_STOPS * 3);
  const positions = new Float32Array(MAX_STOPS);

  for (let i = 0; i < MAX_STOPS; i++) {
    const srcIndex = Math.min(i, count - 1);
    const stop = palette.stops[srcIndex];
    colors[i * 3 + 0] = stop.color[0];
    colors[i * 3 + 1] = stop.color[1];
    colors[i * 3 + 2] = stop.color[2];

    if (i < count) {
      positions[i] = count > 1 ? i / (count - 1) : 0;
    } else {
      positions[i] = 1.0; // padding
    }
  }

  return { colors, positions, stopCount: count };
}

// ---- Lerp state machine ----

export interface LerpState {
  /** GPU data for the "from" palette */
  from: PaletteGPUData;
  /** GPU data for the "to" palette */
  to: PaletteGPUData;
  /** Current blend factor 0 → 1 */
  blend: number;
  /** Key of the currently-displayed (or target) palette */
  currentKey: string;
  /** Is a transition in progress? */
  transitioning: boolean;
}

export function createLerpState(initialKey: string): LerpState {
  const gpu = paletteToGPU(PALETTES[initialKey]);
  return {
    from: gpu,
    to: gpu,
    blend: 0,
    currentKey: initialKey,
    transitioning: false,
  };
}

/**
 * Call when the user picks a new palette.
 * Snapshots the current display as "from" and starts lerping to the new one.
 */
export function startTransition(state: LerpState, newKey: string): void {
  if (newKey === state.currentKey && !state.transitioning) return;

  // Snapshot current visual state: if mid-lerp, blend from/to into a new "from"
  if (state.transitioning) {
    state.from = blendPaletteGPU(state.from, state.to, state.blend);
  }
  // else from is already correct

  state.to = paletteToGPU(PALETTES[newKey]);
  state.blend = 0;
  state.currentKey = newKey;
  state.transitioning = true;
}

/**
 * Advance the lerp by dt seconds, given the configured duration.
 * Returns true while still transitioning.
 */
export function updateLerp(state: LerpState, dt: number, duration: number): boolean {
  if (!state.transitioning) return false;

  state.blend += dt / duration;
  if (state.blend >= 1.0) {
    state.blend = 0;
    state.from = state.to;
    state.transitioning = false;
    return false;
  }
  return true;
}

/**
 * Produce a blended PaletteGPUData by mixing two palettes at factor t.
 * Used to snapshot mid-transition states.
 */
function blendPaletteGPU(
  a: PaletteGPUData,
  b: PaletteGPUData,
  t: number,
): PaletteGPUData {
  const colors = new Float32Array(MAX_STOPS * 3);
  const positions = new Float32Array(MAX_STOPS);
  const stopCount = Math.max(a.stopCount, b.stopCount);

  for (let i = 0; i < MAX_STOPS * 3; i++) {
    colors[i] = a.colors[i] + (b.colors[i] - a.colors[i]) * t;
  }
  for (let i = 0; i < MAX_STOPS; i++) {
    positions[i] = a.positions[i] + (b.positions[i] - a.positions[i]) * t;
  }

  return { colors, positions, stopCount };
}
