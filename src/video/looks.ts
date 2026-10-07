// Colour looks as pure functions (no DOM), shared by the browser (3D LUT textures for <Look>)
// and the CLI (`ev lut` writes them as .cube files and previews them with ffmpeg's lut3d).
// Every look maps a gamma-encoded Rec.709 colour (0..1) to a new one, the way a creative LUT does.

export type RGB = [number, number, number];
export type LookFn = (c: RGB) => RGB;

const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
const mix = (a: number, b: number, t: number) => a + (b - a) * t;
const luma = (c: RGB) => 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
const smooth = (e0: number, e1: number, x: number) => {
  const t = clamp01((x - e0) / (e1 - e0));
  return t * t * (3 - 2 * t);
};

/** Filmic S-curve around a pivot: `amount` 0 = straight, 1 = strong. Keeps 0→0 and 1→1. */
function sCurve(x: number, amount: number, pivot = 0.42): number {
  if (amount === 0) return x;
  const k = 1 + amount * 2.2;
  const f = (v: number) => (v < pivot ? pivot * Math.pow(v / pivot, k) : 1 - (1 - pivot) * Math.pow((1 - v) / (1 - pivot), k));
  return mix(x, f(clamp01(x)), Math.min(1, amount * 1.2));
}

/**
 * Soft highlight shoulder: straight up to `knee`, then bends so 1 lands on `ceiling` (no clipping,
 * still monotonic). A real white stays near white.
 */
function shoulder(x: number, knee = 0.78, ceiling = 0.97): number {
  if (x <= knee) return x;
  const a = (1 - ceiling) / ((1 - knee) * (1 - knee));
  const d = Math.min(x, 1) - knee;
  return knee + d - a * d * d;
}

/**
 * Applies a tone curve to brightness only, so hues and skin don't drift the way per-channel
 * curves make them (pale skin going yellow). Over-bright channels roll toward white.
 */
function tone(c: RGB, f: (y: number) => number): RGB {
  const y = luma(c);
  const ny = f(y);
  const k = ny / Math.max(1e-4, y);
  let r: RGB = [c[0] * k, c[1] * k, c[2] * k];
  const mx = Math.max(...r);
  if (mx > 1) {
    const t = Math.min(1, (mx - 1) / Math.max(1e-4, mx - ny));
    r = [mix(r[0], ny, t), mix(r[1], ny, t), mix(r[2], ny, t)];
  }
  return r;
}

function saturate(c: RGB, s: number): RGB {
  const y = luma(c);
  return [y + (c[0] - y) * s, y + (c[1] - y) * s, y + (c[2] - y) * s];
}

/** Split-tone: tints shadows toward `sh` and highlights toward `hi` (offsets, roughly ±0.1). */
function splitTone(c: RGB, sh: RGB, hi: RGB, amount = 1): RGB {
  const y = luma(c);
  const ws = (1 - smooth(0.0, 0.55, y)) * amount;
  const wh = smooth(0.45, 1.0, y) * amount;
  return [c[0] + sh[0] * ws + hi[0] * wh, c[1] + sh[1] * ws + hi[1] * wh, c[2] + sh[2] * ws + hi[2] * wh];
}

function rgbToHsv([r, g, b]: RGB): RGB {
  const mx = Math.max(r, g, b);
  const mn = Math.min(r, g, b);
  const d = mx - mn;
  let h = 0;
  if (d > 1e-6) {
    if (mx === r) h = ((g - b) / d) % 6;
    else if (mx === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h /= 6;
    if (h < 0) h += 1;
  }
  return [h, mx > 0 ? d / mx : 0, mx];
}

function hsvToRgb([h, s, v]: RGB): RGB {
  const i = Math.floor(h * 6);
  const f = h * 6 - i;
  const p = v * (1 - s);
  const q = v * (1 - f * s);
  const t = v * (1 - (1 - f) * s);
  switch (((i % 6) + 6) % 6) {
    case 0: return [v, t, p];
    case 1: return [q, v, p];
    case 2: return [p, v, t];
    case 3: return [p, q, v];
    case 4: return [t, p, v];
    default: return [v, p, q];
  }
}

/** Hue distance on the 0..1 circle. */
const hueDist = (a: number, b: number) => Math.min(Math.abs(a - b), 1 - Math.abs(a - b));

const out = (c: RGB): RGB => [clamp01(c[0]), clamp01(c[1]), clamp01(c[2])];
const perChannel = (c: RGB, f: (x: number) => number): RGB => [f(c[0]), f(c[1]), f(c[2])];

export interface LookInfo {
  fn: LookFn;
  /** One line for `ev lut` and the catalog. */
  about: string;
}

/** Moves hue `h` toward `target` by fraction `k`, the short way round the circle. */
function toward(h: number, target: number, k: number): number {
  let d = target - h;
  if (d > 0.5) d -= 1;
  if (d < -0.5) d += 1;
  return (h + d * k + 1) % 1;
}

export const LOOKS: Record<string, LookInfo> = {
  clean: {
    about: 'Pro-camera polish: gentle S-curve, soft highlight roll-off, a touch of colour density. Safe on anything.',
    fn: (c) => out(saturate(tone(c, (y) => shoulder(sCurve(y, 0.25), 0.8, 0.975)), 1.07)),
  },
  film: {
    about: 'Print-film emulation: filmic contrast, lifted milky blacks, warm highlights, slightly teal shadows, calmer greens.',
    fn: (c) => {
      // half brightness-only, half per-channel: a little of film's colour crossover, without the skin drift
      const a = tone(c, (y) => sCurve(y, 0.38));
      const b = perChannel(c, (x) => sCurve(x, 0.38));
      let r: RGB = perChannel([mix(a[0], b[0], 0.35), mix(a[1], b[1], 0.35), mix(a[2], b[2], 0.35)], (x) => 0.022 + 0.968 * shoulder(x, 0.74, 0.97));
      r = splitTone(r, [-0.02, 0.006, 0.018], [0.026, 0.008, -0.026]);
      const hsv = rgbToHsv(out(r));
      // greens lean toward olive/teal and calm down, like print stock; very bright colours desaturate
      const green = 1 - smooth(0.05, 0.14, hueDist(hsv[0], 0.33));
      hsv[0] = toward(hsv[0], 0.36, green * 0.15);
      hsv[1] = hsv[1] * (1 - green * 0.15) * mix(1, 0.88, smooth(0.75, 1, hsv[2]));
      return out(hsvToRgb(hsv));
    },
  },
  'teal-orange': {
    about: 'Blockbuster complementary look: reds/skin/yellows lean warm orange, greens/blues lean teal, shadows cool.',
    fn: (c) => {
      const hsv = rgbToHsv(out(tone(c, (y) => shoulder(sCurve(y, 0.32), 0.8, 0.975))));
      // warm family (red → amber) gathers toward orange; cool family (green → blue) toward teal
      const warm = 1 - smooth(0.07, 0.13, hueDist(hsv[0], 0.075));
      const cool = 1 - smooth(0.13, 0.24, hueDist(hsv[0], 0.5));
      hsv[0] = toward(hsv[0], 0.075, warm * 0.22);
      hsv[0] = toward(hsv[0], 0.5, cool * 0.3);
      hsv[1] = hsv[1] * (1 + warm * 0.08 - cool * 0.06);
      const r = splitTone(hsvToRgb(hsv), [-0.03, 0.008, 0.03], [0.02, 0.006, -0.02]);
      return out(r);
    },
  },
  warm: {
    about: 'Golden hour: warm whites, soft contrast, gently lifted shadows. Friendly, family, food, lifestyle.',
    fn: (c) => {
      let r = tone(c, (y) => 0.014 + 0.98 * shoulder(sCurve(y, 0.18), 0.78, 0.975));
      r = splitTone(r, [0.014, 0.005, -0.014], [0.024, 0.009, -0.024]);
      return out(saturate(r, 1.05));
    },
  },
  moody: {
    about: 'Dark and quiet: lower exposure, muted colour, cool shadows, faded blacks. Drama, night, serious topics.',
    fn: (c) => {
      let r = tone(c, (y) => 0.028 + 0.9 * shoulder(sCurve(y * 0.88, 0.45), 0.62, 0.9));
      r = saturate(r, 0.72);
      r = splitTone(r, [-0.02, 0.0, 0.028], [0.012, 0.004, -0.008]);
      return out(r);
    },
  },
  mono: {
    about: 'Rich black and white with filmic contrast (red-filter weighting keeps skin luminous).',
    fn: (c) => {
      const y = 0.4 * c[0] + 0.5 * c[1] + 0.1 * c[2];
      const v = 0.01 + 0.98 * shoulder(sCurve(y, 0.5), 0.8, 0.98);
      return out([v, v, v]);
    },
  },
};

export const LOOK_NAMES = Object.keys(LOOKS);

/** A look generated from theme colours: shadows lean toward the background hue, highlights toward the accent. */
export function themeLook(bg: string, accent: string, strength = 1): LookFn {
  const hex = (h: string): RGB => {
    const s = h.replace('#', '');
    const n = parseInt(s.length === 3 ? s.split('').map((x) => x + x).join('') : s.slice(0, 6), 16);
    return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
  };
  // Only the hue direction of each colour is used, at a small fixed size, so any theme stays tasteful.
  const dir = (c: RGB, size: number): RGB => {
    const y = luma(c);
    const d: RGB = [c[0] - y, c[1] - y, c[2] - y];
    const m = Math.max(1e-3, Math.hypot(...d));
    return [(d[0] / m) * size * strength, (d[1] / m) * size * strength, (d[2] / m) * size * strength];
  };
  const sh = dir(hex(bg), 0.035);
  const hi = dir(hex(accent), 0.03);
  return (c) => {
    let r = tone(c, (y) => 0.015 + 0.98 * shoulder(sCurve(y, 0.28), 0.8, 0.975));
    r = splitTone(r, sh, hi);
    return out(saturate(r, 1.04));
  };
}

/** Samples a look into an N×N×N table, red fastest (the .cube order and the WebGL 3D texture order). */
export function bakeLut(fn: LookFn, size = 33): Float32Array {
  const data = new Float32Array(size * size * size * 3);
  let i = 0;
  for (let b = 0; b < size; b++)
    for (let g = 0; g < size; g++)
      for (let r = 0; r < size; r++) {
        const o = fn([r / (size - 1), g / (size - 1), b / (size - 1)]);
        data[i++] = o[0];
        data[i++] = o[1];
        data[i++] = o[2];
      }
  return data;
}

export function toCube(data: Float32Array, size: number, title: string): string {
  const lines = [`TITLE "${title}"`, `LUT_3D_SIZE ${size}`, 'DOMAIN_MIN 0.0 0.0 0.0', 'DOMAIN_MAX 1.0 1.0 1.0'];
  for (let i = 0; i < data.length; i += 3) lines.push(`${data[i]!.toFixed(6)} ${data[i + 1]!.toFixed(6)} ${data[i + 2]!.toFixed(6)}`);
  return lines.join('\n') + '\n';
}

/** Parses a .cube 3D LUT. Creative LUTs use the 0..1 domain; 1D LUTs are rejected. */
export function parseCube(text: string): { size: number; data: Float32Array } {
  let size = 0;
  const values: number[] = [];
  for (const raw of text.split('\n')) {
    const line = raw.trim();
    if (!line || line.startsWith('#') || line.startsWith('TITLE') || line.startsWith('DOMAIN_')) continue;
    if (line.startsWith('LUT_1D_SIZE')) throw new Error('1D LUTs are not supported; export a 3D .cube');
    if (line.startsWith('LUT_3D_SIZE')) size = Number(line.split(/\s+/)[1]);
    else if (/^[-\d.]/.test(line)) values.push(...line.split(/\s+/).slice(0, 3).map(Number));
  }
  if (!size || values.length !== size * size * size * 3) throw new Error(`Bad .cube: size ${size}, ${values.length / 3} entries`);
  return { size, data: Float32Array.from(values) };
}
