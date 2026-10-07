// Colour tools for footage, used by `ev grade-check`, `ev lut` and `ev denoise`.
// Measures like a colourist's scopes (exposure, white balance, contrast, clipping, noise, and the
// face against the room when the clip is tracked), and turns the numbers into a starting <Look>.
import { copyFileSync, cpSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, extname, join } from 'node:path';
import { tmpdir } from 'node:os';
import type { MediaAsset } from '../../src/shared/types.ts';
import { bakeLut, LOOKS, themeLook, toCube } from '../../src/video/looks.ts';
import { ffmpeg } from './ffmpeg.ts';
import { analysisDir, getAsset, importFile, MEDIA_DIR, mediaPath, saveAsset } from './library.ts';

export const LUT_DIR = join(MEDIA_DIR, 'luts');

interface Frame { w: number; h: number; rgb: Uint8Array }

async function grabFrame(file: string, at: number, width?: number): Promise<Frame> {
  const vf = width ? ['-vf', `scale=${width}:-2`] : [];
  const { stdout, stderr } = await ffmpeg(['-ss', at.toFixed(3), '-i', file, '-frames:v', '1', ...vf, '-f', 'rawvideo', '-pix_fmt', 'rgb24', 'pipe:1']);
  // Output stream size from ffmpeg's log, e.g. "Stream #0:0: Video: rawvideo (RGB[24] …), rgb24, 360x640"
  const m = [...stderr.matchAll(/rawvideo.*?, (\d+)x(\d+)/g)].at(-1);
  if (!m) throw new Error(`could not read a frame at ${at}s`);
  return { w: Number(m[1]), h: Number(m[2]), rgb: new Uint8Array(stdout) };
}

async function grabGray(file: string, w: number, h: number): Promise<Uint8Array> {
  const { stdout } = await ffmpeg(['-i', file, '-vf', `scale=${w}:${h}`, '-f', 'rawvideo', '-pix_fmt', 'gray', 'pipe:1']);
  return new Uint8Array(stdout);
}

const toLin = (v: number) => (v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4));
const lumaOf = (r: number, g: number, b: number) => (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;

export interface ClipStats {
  at: number[];
  luma: { p1: number; p50: number; p99: number; mean: number };
  clipped: number;
  crushed: number;
  /** Mean channel ratios over near-neutral pixels (white balance): >0 r-b means warm. */
  cast: { warm: number; green: number; neutralShare: number };
  saturation: number;
  /** Immerkær noise sigma, in 8-bit code values, on a full-size frame of the original. */
  noise: number;
  subject?: { face: number; room: number };
}

interface TrackJson { fps: number; frames: { face: { box: [number, number, number, number] } | null }[] }

export async function measureClip(a: MediaAsset, at?: number[]): Promise<ClipStats> {
  const file = mediaPath(a.proxy ?? a.file);
  const dur = a.duration ?? 1;
  const times = at?.length ? at : Array.from({ length: Math.min(8, Math.max(2, Math.round(dur / 3))) }, (_, i) => ((i + 0.5) * dur) / Math.min(8, Math.max(2, Math.round(dur / 3))));
  const lumas: number[] = [];
  let clipped = 0, crushed = 0, n = 0, sat = 0;
  let nr = 0, ng = 0, nb = 0, nn = 0;
  const trackFile = join(analysisDir(a.id), 'track', 'track.json');
  const track = existsSync(trackFile) ? (JSON.parse(readFileSync(trackFile, 'utf8')) as TrackJson) : null;
  let faceSum = 0, faceN = 0, roomSum = 0, roomN = 0;
  for (const t of times) {
    const f = await grabFrame(file, t, 360);
    for (let i = 0; i < f.w * f.h; i++) {
      const r = f.rgb[i * 3]!, g = f.rgb[i * 3 + 1]!, b = f.rgb[i * 3 + 2]!;
      const y = lumaOf(r, g, b);
      lumas.push(y);
      if (Math.max(r, g, b) >= 250) clipped++;
      if (y <= 0.02) crushed++;
      const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
      const s = mx ? (mx - mn) / mx : 0;
      sat += s;
      n++;
      // near-neutral, well-exposed pixels are where a colour cast shows
      if (s < 0.18 && y > 0.2 && y < 0.88) {
        nr += r; ng += g; nb += b; nn++;
      }
    }
    if (track) {
      const fi = Math.min(track.frames.length - 1, Math.round(t * track.fps));
      const box = track.frames[fi]?.face?.box;
      const maskFile = join(analysisDir(a.id), 'track', 'mask', `${String(fi).padStart(5, '0')}.png`);
      if (box && existsSync(maskFile)) {
        const mask = await grabGray(maskFile, f.w, f.h);
        // inner 60% of the face box (skin, not hair/background)
        const [x0, y0, x1, y1] = box;
        const ix0 = Math.round((x0 + (x1 - x0) * 0.2) * f.w), ix1 = Math.round((x1 - (x1 - x0) * 0.2) * f.w);
        const iy0 = Math.round((y0 + (y1 - y0) * 0.25) * f.h), iy1 = Math.round((y1 - (y1 - y0) * 0.15) * f.h);
        for (let y = 0; y < f.h; y++)
          for (let x = 0; x < f.w; x++) {
            const i = y * f.w + x;
            const l = lumaOf(f.rgb[i * 3]!, f.rgb[i * 3 + 1]!, f.rgb[i * 3 + 2]!);
            if (x >= ix0 && x < ix1 && y >= iy0 && y < iy1) {
              faceSum += l;
              faceN++;
            } else if (mask[i]! < 40) {
              roomSum += l;
              roomN++;
            }
          }
      }
    }
  }
  // Noise on one full-size frame of the ORIGINAL (the proxy's compression smooths grain away),
  // Immerkær 1996: convolve luma with a Laplacian-difference kernel.
  const full = await grabFrame(mediaPath(a.file), times[Math.floor(times.length / 2)]!);
  const L = (x: number, y: number) => {
    const i = (y * full.w + x) * 3;
    return 0.2126 * full.rgb[i]! + 0.7152 * full.rgb[i + 1]! + 0.0722 * full.rgb[i + 2]!;
  };
  // Only flat areas count (edges would read as noise).
  const vals: number[] = [];
  for (let y = 1; y < full.h - 1; y += 2)
    for (let x = 1; x < full.w - 1; x += 2) {
      const gx = Math.abs(L(x + 1, y) - L(x - 1, y)), gy = Math.abs(L(x, y + 1) - L(x, y - 1));
      if (gx + gy > 12) continue;
      const v = L(x - 1, y - 1) - 2 * L(x, y - 1) + L(x + 1, y - 1) - 2 * L(x - 1, y) + 4 * L(x, y) - 2 * L(x + 1, y) + L(x - 1, y + 1) - 2 * L(x, y + 1) + L(x + 1, y + 1);
      vals.push(Math.abs(v));
    }
  const noise = vals.length ? (Math.sqrt(Math.PI / 2) / 6) * (vals.reduce((s, v) => s + v, 0) / vals.length) : 0;
  lumas.sort((x, y) => x - y);
  const pct = (p: number) => lumas[Math.min(lumas.length - 1, Math.floor(p * lumas.length))]!;
  const stats: ClipStats = {
    at: times,
    luma: { p1: pct(0.01), p50: pct(0.5), p99: pct(0.99), mean: lumas.reduce((s, v) => s + v, 0) / lumas.length },
    clipped: clipped / n,
    crushed: crushed / n,
    cast: nn ? { warm: (nr - nb) / Math.max(1, ng), green: (ng - (nr + nb) / 2) / Math.max(1, ng), neutralShare: nn / n } : { warm: 0, green: 0, neutralShare: 0 },
    saturation: sat / n,
    noise,
  };
  if (faceN && roomN) stats.subject = { face: faceSum / faceN, room: roomSum / roomN };
  return stats;
}

const r2 = (x: number) => Math.round(x * 100) / 100;
const clampTo = (x: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, x));

export interface GradeAdvice {
  lines: string[];
  grade: Record<string, number | string>;
  room?: Record<string, number>;
  denoise?: 'light' | 'medium' | 'strong';
}

/** Turns measurements into readable findings and a starting grade (always look before trusting it). */
export function adviseGrade(s: ClipStats): GradeAdvice {
  const lines: string[] = [];
  const grade: Record<string, number | string> = {};
  // Exposure: skin varies a lot by person, so a face anywhere in 0.45–0.75 (gamma) is left alone;
  // only outside that band is it pulled to the nearest healthy value. Without a face: median 0.35–0.55.
  const ref = s.subject ? s.subject.face : s.luma.p50;
  const [lo, hi] = s.subject ? [0.45, 0.75] : [0.35, 0.55];
  const target = ref < lo ? lo + 0.05 : ref > hi ? hi - 0.03 : ref;
  const stops = Math.log2(toLin(target) / Math.max(1e-3, toLin(ref)));
  const label = s.subject ? `face ${r2(ref)}` : `median ${r2(ref)}`;
  if (Math.abs(stops) > 0.1) {
    grade.exposure = r2(clampTo(stops, -1.5, 1.5));
    lines.push(`Exposure: ${label} → ${stops > 0 ? 'under' : 'over'}exposed by ${Math.abs(r2(stops))} stops (healthy ${lo}–${hi}).`);
  } else lines.push(`Exposure: ${label} is within the healthy ${lo}–${hi}.`);
  // White balance from near-neutral pixels.
  if (s.cast.neutralShare > 0.02) {
    const warm = s.cast.warm, green = s.cast.green;
    if (Math.abs(warm) > 0.04) {
      grade.temperature = r2(clampTo(-warm * 2.2, -0.8, 0.8));
      lines.push(`White balance: neutrals read ${warm > 0 ? 'warm/orange' : 'cool/blue'} (${r2(warm)}).`);
    } else lines.push('White balance: neutral.');
    if (Math.abs(green) > 0.025) {
      grade.tint = r2(clampTo(green * 3, -0.6, 0.6));
      lines.push(`Tint: a ${green > 0 ? 'green' : 'magenta'} cast (${r2(green)}), typical of ${green > 0 ? 'LED/fluorescent light' : 'some phone processing'}.`);
    }
  } else lines.push('White balance: too few neutral surfaces to judge; check by eye.');
  // Contrast from the 1–99% range.
  const range = s.luma.p99 - s.luma.p1;
  if (range < 0.72) {
    grade.contrast = r2(clampTo(1 + (0.85 - range) * 0.6, 1.02, 1.25));
    lines.push(`Contrast: flat (1–99% range ${r2(range)}); common for phone HDR/HLG footage.`);
  } else lines.push(`Contrast: healthy range ${r2(range)}.`);
  if (s.clipped > 0.015) {
    grade.highlights = -0.4;
    lines.push(`Highlights: ${r2(s.clipped * 100)}% clipped. Detail there is gone; rolling them off hides the hard edge.`);
  }
  if (s.crushed > 0.04) {
    grade.shadows = 0.3;
    lines.push(`Shadows: ${r2(s.crushed * 100)}% crushed to black.`);
  }
  if (s.saturation < 0.2) {
    grade.vibrance = 0.25;
    lines.push(`Colour: muted (mean saturation ${r2(s.saturation)}).`);
  }
  const advice: GradeAdvice = { lines, grade };
  if (s.subject) {
    const diff = Math.log2(toLin(s.subject.face) / Math.max(1e-3, toLin(s.subject.room)));
    if (diff < 0.9) {
      advice.room = { exposure: r2(-(1.2 - diff)), saturation: 0.8 };
      lines.push(`Separation: the room is only ${r2(diff)} stops under the face (aim for 1–1.5): darken the room, keep her.`);
    } else lines.push(`Separation: room sits ${r2(diff)} stops under the face. Good.`);
  }
  if (s.noise > 3.2) advice.denoise = s.noise > 6 ? 'strong' : s.noise > 4.5 ? 'medium' : 'light';
  lines.push(`Noise: σ ${r2(s.noise)}${advice.denoise ? ` → \`ev denoise <id> --strength=${advice.denoise}\`` : ' (clean)'}.`);
  return advice;
}

// ---- LUT files ---------------------------------------------------------------------------------

/** Writes every built-in look (and the theme look) as a .cube for ffmpeg previews and other apps. */
export function writeBuiltinLuts(themeColors: { bg: string; accent: string }): Record<string, string> {
  const dir = join(LUT_DIR, 'builtin');
  mkdirSync(dir, { recursive: true });
  const out: Record<string, string> = {};
  const all: [string, (c: [number, number, number]) => [number, number, number]][] = [...Object.entries(LOOKS).map(([k, v]) => [k, v.fn] as [string, typeof v.fn]), ['theme', themeLook(themeColors.bg, themeColors.accent)]];
  for (const [name, fn] of all) {
    const file = join(dir, `${name}.cube`);
    writeFileSync(file, toCube(bakeLut(fn, 33), 33, `Easy Video ${name}`));
    out[name] = file;
  }
  return out;
}

/** Copies a .cube into project/media/luts/ and returns the path to use as `look="…"`. */
export function importLut(src: string): string {
  if (extname(src).toLowerCase() !== '.cube') throw new Error('Only .cube 3D LUTs are supported');
  const text = readFileSync(src, 'utf8');
  if (!/LUT_3D_SIZE/.test(text)) throw new Error(`${basename(src)} is not a 3D LUT (no LUT_3D_SIZE)`);
  mkdirSync(LUT_DIR, { recursive: true });
  const name = basename(src).toLowerCase().replace(/[^a-z0-9.]+/g, '-');
  copyFileSync(src, join(LUT_DIR, name));
  return `luts/${name}`;
}

// ---- Denoise -----------------------------------------------------------------------------------

const DENOISE: Record<string, string> = {
  // hqdn3d: luma/chroma spatial, luma/chroma temporal. Temporal does most of the work on static talking heads.
  light: 'hqdn3d=1.5:1.2:4:3',
  medium: 'hqdn3d=3:2.5:7:5',
  // nlmeans keeps edges and skin texture far better at high strength (slower: ~0.3 s a frame).
  strong: 'nlmeans=s=3.5:p=7:r=11,hqdn3d=0:1.5:4:3',
};

/**
 * Writes a denoised copy as a new asset (the original stays), carrying over its transcript and
 * tracking so scenes can switch ids without re-analysis.
 */
export async function denoiseAsset(a: MediaAsset, strength: 'light' | 'medium' | 'strong', log: (m: string) => void): Promise<MediaAsset> {
  const name = `${basename(a.name, extname(a.name))}-denoised-${strength}.mp4`;
  const tmp = join(tmpdir(), `ev-denoise-${Date.now()}.mp4`);
  log(`denoising ${a.id} (${strength}: ${DENOISE[strength]})…`);
  await ffmpeg(['-y', '-i', mediaPath(a.file), '-vf', DENOISE[strength]!, '-c:v', 'libx264', '-preset', 'slow', '-crf', '14', '-pix_fmt', 'yuv420p', '-c:a', 'copy', '-movflags', '+faststart', tmp]);
  const { asset, existing } = importFile(tmp, { name, move: true });
  if (existing) return asset;
  const from = analysisDir(a.id), to = analysisDir(asset.id);
  for (const f of ['transcript.json', 'transcript.txt']) if (existsSync(join(from, f))) copyFileSync(join(from, f), join(to, f));
  if (existsSync(join(from, 'track'))) cpSync(join(from, 'track'), join(to, 'track'), { recursive: true });
  const src = getAsset(a.id)!;
  // Same words, same timing: reuse the transcript result instead of paying for it again.
  if (src.steps.transcript?.state === 'done') saveAsset({ ...asset, steps: { ...asset.steps, transcript: src.steps.transcript } });
  return getAsset(asset.id)!;
}
