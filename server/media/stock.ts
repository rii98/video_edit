// Stock sounds from online libraries (see ./sources): download, prepare, import.
// Preparation makes a stock sound behave like our synthesized ones: dead air trimmed so the
// sound starts at once, peak-normalized to -1 dBFS, and its loudest moment (`peakAt`)
// recorded so placement can land it on the visual frame. Provenance (source, author,
// licence) is kept on the asset for credits. Repeat requests come from a local cache.
import { existsSync, readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import type { MediaAsset } from '../../src/shared/types.ts';
import { writeJsonAtomic } from '../store.ts';
import { ffmpeg } from './ffmpeg.ts';
import { getAsset, importFile, MEDIA_DIR, RAW_DIR, ensureMediaDirs, saveAsset, slugify } from './library.ts';
import { getSource, type SoundHit } from './sources/index.ts';

export const STOCK_RATE = 48_000;
/** Same convention as the synthesized effects (server/media/sfx.ts). */
const TARGET_PEAK = 0.891;
const CACHE_FILE = join(MEDIA_DIR, 'stock-cache.json');

export interface TrimPlan {
  /** Seconds to keep, in the source file. */
  start: number;
  end: number;
  /** Loudest 10 ms, in seconds from `start`. */
  peakAt: number;
  /** Gain that brings the peak to -1 dBFS. */
  gainDb: number;
}

/**
 * Plans the trim and gain from an amplitude envelope (max |sample| across channels).
 * Leading silence is cut to a 5 ms pre-roll (keeps the attack); the tail is cut once it is
 * 50 dB under the peak, with 50 ms to spare for the fade.
 */
export function planTrim(env: Float32Array, rate = STOCK_RATE, { trim = true } = {}): TrimPlan {
  let peak = 0;
  for (const v of env) peak = Math.max(peak, v);
  if (peak < 1e-4) throw new Error('the sound is silent');
  let first = 0;
  let last = env.length - 1;
  if (trim) {
    const startThreshold = peak * 10 ** (-40 / 20);
    const endThreshold = peak * 10 ** (-50 / 20);
    while (first < env.length && env[first]! < startThreshold) first++;
    while (last > first && env[last]! < endThreshold) last--;
    first = Math.max(0, first - Math.round(0.005 * rate));
    last = Math.min(env.length - 1, last + Math.round(0.05 * rate));
  }
  // Loudest 10 ms window (a running sum), so one stray sample can't decide the peak.
  const win = Math.max(1, Math.round(0.01 * rate));
  let sum = 0;
  let best = -1;
  let bestAt = first;
  for (let i = first; i <= last; i++) {
    sum += env[i]! ** 2;
    if (i - win >= first) sum -= env[i - win]! ** 2;
    if (sum > best) {
      best = sum;
      bestAt = Math.max(first, i - win + 1);
    }
  }
  return {
    start: first / rate,
    end: (last + 1) / rate,
    peakAt: Math.round(((bestAt - first) / rate) * 1000) / 1000,
    gainDb: Math.round(20 * Math.log10(TARGET_PEAK / peak) * 100) / 100,
  };
}

/** Max |sample| across (up to two) channels, at STOCK_RATE. */
async function envelope(file: string): Promise<Float32Array> {
  const { stdout } = await ffmpeg(['-i', file, '-vn', '-ac', '2', '-ar', String(STOCK_RATE), '-f', 'f32le', 'pipe:1']);
  const samples = new Float32Array(stdout.length / 4);
  new Uint8Array(samples.buffer).set(stdout.subarray(0, samples.length * 4));
  const env = new Float32Array(samples.length / 2);
  for (let i = 0; i < env.length; i++) env[i] = Math.max(Math.abs(samples[2 * i]!), Math.abs(samples[2 * i + 1]!));
  return env;
}

/** Writes the prepared sound as 48 kHz 16-bit WAV, keeping the source's channel count. */
export async function prepareSound(src: string, dest: string, { trim = true } = {}): Promise<TrimPlan> {
  const plan = planTrim(await envelope(src), STOCK_RATE, { trim });
  const length = plan.end - plan.start;
  const fadeOut = Math.min(0.01, length / 4);
  const filters = [
    `atrim=start=${plan.start}:end=${plan.end}`,
    'asetpts=PTS-STARTPTS',
    `afade=t=out:st=${(length - fadeOut).toFixed(4)}:d=${fadeOut.toFixed(4)}`,
    `volume=${plan.gainDb}dB`,
    'alimiter=limit=0.95:attack=1:release=20:level=false', // catches inter-sample overs from MP3 decoding
  ];
  await ffmpeg(['-y', '-i', src, '-vn', '-af', filters.join(','), '-ar', String(STOCK_RATE), '-c:a', 'pcm_s16le', dest]);
  return plan;
}

function cache(): Record<string, string> {
  return existsSync(CACHE_FILE) ? (JSON.parse(readFileSync(CACHE_FILE, 'utf8')) as Record<string, string>) : {};
}

const cacheKey = (source: string, id: string, raw: boolean) => `${source}:${id}${raw ? ':raw' : ''}`;

/** The library asset already imported for a source sound, if any. */
export function cachedStock(source: string, id: string, { raw = false } = {}): MediaAsset | null {
  const assetId = cache()[cacheKey(source, id, raw)];
  return assetId ? getAsset(assetId) : null;
}

/**
 * Downloads a sound from `source`, prepares it (unless `raw`) and imports it into the
 * library. The caller runs analysis (`analyzeAsset`) on new assets.
 */
export async function importStock(source: string, id: string, { raw = false } = {}): Promise<{ asset: MediaAsset; hit: SoundHit | null; cached: boolean }> {
  const hit = cachedStock(source, id, { raw });
  if (hit) return { asset: hit, hit: null, cached: true };
  const provider = getSource(source);
  ensureMediaDirs();
  const tag = `${provider.prefix}-${id}-${process.pid}`;
  const download = join(RAW_DIR, `.incoming-${tag}.download`);
  const prepared = join(RAW_DIR, `.incoming-${tag}.wav`);
  try {
    const sound = await provider.download(id, download);
    const plan = await prepareSound(download, prepared, { trim: !raw });
    // Asset ids are capped at 28 characters (library.slugify): shorten the title, never the id.
    const tail = `-${id}${raw ? '-raw' : ''}`;
    const title = slugify(sound.title).slice(0, Math.max(1, 28 - provider.prefix.length - 1 - tail.length)).replace(/-+$/, '');
    const name = `${provider.prefix}-${title}${tail}.wav`;
    const { asset: imported } = importFile(prepared, { name, move: true, origin: 'stock' });
    const asset = saveAsset({
      ...imported,
      peakAt: plan.peakAt,
      source: { provider: provider.name, id: sound.id, title: sound.title, author: sound.author, license: sound.license, url: sound.url },
    });
    writeJsonAtomic(CACHE_FILE, { ...cache(), [cacheKey(source, id, raw)]: asset.id });
    return { asset, hit: sound, cached: false };
  } finally {
    rmSync(download, { force: true });
    rmSync(prepared, { force: true });
  }
}
