// The ingest pipeline. Each step is resumable and idempotent: finished steps are skipped
// on re-run, so a crash or restart picks up where it stopped. Outputs are cached in
// media/analysis/<id>/ and summarized into asset.facts for the UI and for Claude.
import { existsSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { AnalysisStep, MediaAsset, StepState } from '../../src/shared/types.ts';
import { writeJsonAtomic } from '../store.ts';
import { analyzeBeats, SAMPLE_RATE, type BeatAnalysis } from './beats.ts';
import { decodePcm, ffmpeg } from './ffmpeg.ts';
import { probe } from './probe.ts';
import { acquireLock, analysisDir, getAsset, mediaPath, PROXY_DIR, releaseLock, saveAsset, stepsFor } from './library.ts';
import { transcribe, transcriptionKey, transcriptToText } from './transcribe.ts';

interface StepResult {
  state?: Extract<StepState, 'done' | 'skipped'>;
  note?: string;
  patch?: Partial<MediaAsset>;
}

type Step = (asset: MediaAsset) => Promise<StepResult>;

const PROXY_SHORT_SIDE = 720;
const IMAGE_MAX_SIDE = 2560;
const SHEET_TILE_WIDTH = 384;
const MAX_SHEET_TILES = 24;
const MIN_SHOT_SECONDS = 0.5;
const BEAT_MAX_SECONDS = 15 * 60;
/** Below this, onsets aren't periodic: treat as speech/ambient rather than music. */
const MUSIC_CONFIDENCE = 0.3;
const LABEL_FONT = ['/System/Library/Fonts/Supplemental/Arial.ttf', '/System/Library/Fonts/Helvetica.ttc'].find(existsSync);

const src = (a: MediaAsset) => mediaPath(a.file);
const preview = (a: MediaAsset) => mediaPath(a.proxy ?? a.file);
const out = (a: MediaAsset, name: string) => join(analysisDir(a.id), name);
const rel = (a: MediaAsset, name: string) => `analysis/${a.id}/${name}`;
const readJson = <T>(path: string): T | null => (existsSync(path) ? (JSON.parse(readFileSync(path, 'utf8')) as T) : null);

/** Writes via a temp file so a killed ffmpeg never leaves a truncated output behind. */
async function ffmpegTo(target: string, args: (tmp: string) => string[]): Promise<void> {
  const tmp = target.replace(/(\.\w+)$/, '.part$1');
  await ffmpeg(args(tmp));
  renameSync(tmp, target);
}

const steps: Record<AnalysisStep, Step> = {
  async probe(a) {
    const p = await probe(src(a));
    if (a.kind === 'video' && !p.hasVideo) throw new Error('no video stream');
    if (a.kind === 'audio' && !p.hasAudio) throw new Error('no audio stream');
    return { patch: { width: p.width, height: p.height, fps: p.fps, duration: p.duration, hasAudio: p.hasAudio } };
  },

  async proxy(a) {
    if (a.kind === 'image') {
      if (Math.max(a.width ?? 0, a.height ?? 0) <= IMAGE_MAX_SIDE) return { state: 'skipped', note: 'original is small enough' };
      const ext = a.file.endsWith('.png') ? 'png' : 'jpg';
      const target = join(PROXY_DIR, `${a.id}.${ext}`);
      await ffmpegTo(target, (tmp) => ['-y', '-i', src(a), '-vf', `scale=${IMAGE_MAX_SIDE}:${IMAGE_MAX_SIDE}:force_original_aspect_ratio=decrease`, '-q:v', '2', tmp]);
      return { patch: { proxy: `proxy/${a.id}.${ext}` } };
    }
    // Short side ≤ 720, ≤ 60 fps, keyframe every 15 frames so scrubbing in the editor is instant.
    const s = PROXY_SHORT_SIDE;
    const scale = `scale='if(gte(iw,ih),-2,min(${s},iw))':'if(gte(iw,ih),min(${s},ih),-2)'`;
    const target = join(PROXY_DIR, `${a.id}.mp4`);
    await ffmpegTo(target, (tmp) => [
      '-y', '-i', src(a), '-vf', scale, '-fpsmax', '60',
      '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '23', '-g', '15', '-pix_fmt', 'yuv420p',
      '-c:a', 'aac', '-b:a', '128k', '-movflags', '+faststart', tmp,
    ]);
    return { patch: { proxy: `proxy/${a.id}.mp4` } };
  },

  async poster(a) {
    const at = a.kind === 'video' ? Math.min(2, (a.duration ?? 0) * 0.1) : 0;
    // No seek for stills: `-ss` on a single-frame JPEG yields zero frames.
    const seek = a.kind === 'video' ? ['-ss', at.toFixed(2)] : [];
    await ffmpegTo(out(a, 'poster.jpg'), (tmp) => ['-y', ...seek, '-i', preview(a), '-frames:v', '1', '-vf', 'scale=480:-2', '-q:v', '4', tmp]);
    return { patch: { poster: rel(a, 'poster.jpg') } };
  },

  async shots(a) {
    // Scene-cut detection on a small version of the proxy: fast and plenty accurate.
    const { stderr } = await ffmpeg(['-i', preview(a), '-vf', 'scale=320:-2,scdet=threshold=10', '-an', '-f', 'null', '-']);
    const cuts: { time: number; score: number }[] = [];
    for (const m of stderr.matchAll(/lavfi\.scd\.score: ([\d.]+), lavfi\.scd\.time: ([\d.]+)/g)) {
      const time = Number(m[2]);
      if (time - (cuts.at(-1)?.time ?? 0) >= MIN_SHOT_SECONDS) cuts.push({ time, score: Number(m[1]) });
    }
    const bounds = [0, ...cuts.map((c) => c.time), a.duration ?? 0];
    const shots = bounds.slice(0, -1).map((start, i) => ({ start, end: bounds[i + 1]! }));
    writeJsonAtomic(out(a, 'shots.json'), { cuts, shots });
    return { note: `${shots.length} shot${shots.length === 1 ? '' : 's'}` };
  },

  async sheet(a) {
    const duration = a.duration ?? 0;
    const fps = Math.min(a.fps ?? 30, 60);
    const shots = readJson<{ shots: { start: number; end: number }[] }>(out(a, 'shots.json'))?.shots ?? [];
    let times: number[];
    if (shots.length >= 2) {
      // One tile per shot (its middle frame), thinned evenly if there are many shots.
      const mids = shots.map((s) => (s.start + s.end) / 2);
      times = mids.length <= MAX_SHEET_TILES ? mids : Array.from({ length: MAX_SHEET_TILES }, (_, i) => mids[Math.floor((i * mids.length) / MAX_SHEET_TILES)]!);
    } else {
      const count = Math.max(4, Math.min(12, Math.floor(duration)));
      times = Array.from({ length: count }, (_, i) => ((i + 0.5) * duration) / count);
    }
    const frames = [...new Set(times.map((t) => Math.min(Math.floor(t * fps), Math.max(0, Math.floor(duration * fps) - 2))))];
    const cols = frames.length > 12 ? 6 : Math.min(4, frames.length);
    const rows = Math.ceil(frames.length / cols);
    const label = LABEL_FONT
      ? `,drawtext=fontfile='${LABEL_FONT}':text='%{pts\\:hms}':x=8:y=8:fontsize=18:fontcolor=white:box=1:boxcolor=black@0.65:boxborderw=5`
      : '';
    const filter = `select='${frames.map((n) => `eq(n\\,${n})`).join('+')}',scale=${SHEET_TILE_WIDTH}:-2${label},tile=${cols}x${rows}:padding=4:margin=4:color=0x111111`;
    await ffmpegTo(out(a, 'sheet.jpg'), (tmp) => ['-y', '-i', preview(a), '-vf', filter, '-fps_mode', 'vfr', '-frames:v', '1', '-q:v', '4', tmp]);
    writeJsonAtomic(out(a, 'sheet.json'), { cols, rows, tiles: frames.map((n) => Math.round((n / fps) * 100) / 100) });
    return { patch: { sheet: rel(a, 'sheet.jpg') }, note: `${frames.length} frames` };
  },

  async audio(a) {
    if (!a.hasAudio) return { state: 'skipped', note: 'no audio track' };
    const { stderr } = await ffmpeg(['-i', src(a), '-vn', '-af', 'silencedetect=n=-35dB:d=0.5,ebur128=peak=true:framelog=quiet', '-f', 'null', '-']);
    const silences: { start: number; end: number }[] = [];
    for (const m of stderr.matchAll(/silence_(start|end): (-?[\d.]+)/g)) {
      if (m[1] === 'start') silences.push({ start: Math.max(0, Number(m[2])), end: a.duration ?? 0 });
      else if (silences.length) silences.at(-1)!.end = Number(m[2]);
    }
    const summary = stderr.slice(stderr.lastIndexOf('Summary:'));
    const loudness = Number(summary.match(/I:\s+(-?[\d.]+) LUFS/)?.[1] ?? NaN);
    const truePeak = Number(summary.match(/Peak:\s+(-?[\d.]+) dBFS/)?.[1] ?? NaN);
    const silent = silences.reduce((sum, s) => sum + (s.end - s.start), 0);
    const activeRatio = a.duration ? Math.max(0, Math.min(1, 1 - silent / a.duration)) : 0;
    writeJsonAtomic(out(a, 'audio.json'), { loudness, truePeak, activeRatio: round2(activeRatio), silences });

    // Waveform for the timeline: 50 peaks per second, 0-100, streamed so long files stay cheap.
    const RATE = 8000;
    const PER_PEAK = RATE / 50;
    const peaks: number[] = [];
    let current = 0;
    let count = 0;
    let carry: Buffer = Buffer.alloc(0);
    await ffmpeg(['-i', src(a), '-vn', '-ac', '1', '-ar', String(RATE), '-f', 's16le', 'pipe:1'], {
      onStdout: (chunk) => {
        const buf = carry.length ? Buffer.concat([carry, chunk]) : chunk;
        const usable = buf.length - (buf.length % 2);
        for (let i = 0; i < usable; i += 2) {
          current = Math.max(current, Math.abs(buf.readInt16LE(i)));
          if (++count === PER_PEAK) {
            peaks.push(Math.round((current / 32768) * 100));
            current = 0;
            count = 0;
          }
        }
        carry = buf.subarray(usable);
      },
    });
    writeFileSync(out(a, 'waveform.json'), JSON.stringify({ rate: 50, peaks }));
    // Integrated loudness uses 400 ms blocks: meaningless for very short sounds (UI clicks).
    const measurable = Number.isFinite(loudness) && (a.duration ?? 0) >= 0.5;
    return { note: measurable ? `${loudness} LUFS` : undefined };
  },

  async beats(a) {
    if (a.origin === 'sfx' || a.origin === 'tts') return { state: 'skipped', note: 'generated audio' };
    if (a.origin === 'stock') return { state: 'skipped', note: 'sound effect' };
    const pcm = await decodePcm(src(a), SAMPLE_RATE, BEAT_MAX_SECONDS);
    const result = analyzeBeats(pcm);
    writeJsonAtomic(out(a, 'beats.json'), result);
    return result.confidence >= MUSIC_CONFIDENCE
      ? { note: `${Math.round(result.bpm)} BPM` }
      : { note: 'no steady beat' };
  },

  async transcript(a) {
    if (!a.hasAudio) return { state: 'skipped', note: 'no audio track' };
    if (a.origin === 'sfx' || a.origin === 'stock') return { state: 'skipped', note: 'sound effect' };
    const audio = readJson<{ activeRatio: number }>(out(a, 'audio.json'));
    if (audio && audio.activeRatio < 0.1) return { state: 'skipped', note: 'mostly silent' };
    const beats = readJson<BeatAnalysis>(out(a, 'beats.json'));
    if (a.kind === 'audio' && beats && beats.confidence >= MUSIC_CONFIDENCE) {
      return { state: 'skipped', note: 'music (run `ev analyze <id> --redo=transcript` to force)' };
    }
    if (!transcriptionKey()) return { state: 'skipped', note: 'needs DEEPGRAM_API_KEY in .env' };
    const t = await transcribe(src(a));
    writeJsonAtomic(out(a, 'transcript.json'), t);
    writeFileSync(out(a, 'transcript.txt'), transcriptToText(t));
    return { note: t.words.length ? `${t.words.length} words` : 'no speech' };
  },
};

const round2 = (n: number) => Math.round(n * 100) / 100;

function fmtDuration(s: number): string {
  const m = Math.floor(s / 60);
  return `${m}:${(s % 60).toFixed(1).padStart(4, '0')}`;
}

/** One-line facts derived from the analysis files; recomputed so re-runs never duplicate. */
function buildFacts(a: MediaAsset): string[] {
  const facts: string[] = [];
  if (a.duration) facts.push(fmtDuration(a.duration));
  if (a.width && a.height) facts.push(`${a.width}×${a.height}`);
  if (a.kind === 'video' && a.fps) facts.push(`${Math.round(a.fps * 100) / 100} fps`);
  for (const step of ['shots', 'beats', 'audio', 'transcript'] as const) {
    const s = a.steps[step];
    if (s?.state === 'done' && s.note) facts.push(s.note);
  }
  if (a.peakAt !== undefined) facts.push(`peak at ${a.peakAt.toFixed(2)}s`);
  if (a.source) facts.push(`${a.source.provider} #${a.source.id} · ${a.source.license.toUpperCase()} · by ${a.source.author}`);
  return facts;
}

export interface AnalyzeOptions {
  /** Steps to run again even if already done. */
  redo?: AnalysisStep[];
  log?: (message: string) => void;
}

/**
 * Runs all outstanding steps for an asset. Returns null if another process holds the
 * asset's lock (it is already being analyzed). A failed step doesn't stop later steps
 * that don't depend on it.
 */
export async function analyzeAsset(id: string, { redo = [], log = () => {} }: AnalyzeOptions = {}): Promise<MediaAsset | null> {
  if (!acquireLock(id)) return null;
  try {
    let asset = getAsset(id);
    if (!asset) throw new Error(`Unknown asset ${id}`);
    for (const step of stepsFor(asset.kind)) {
      const current = asset.steps[step]?.state;
      if ((current === 'done' || current === 'skipped') && !redo.includes(step)) continue;
      if (step !== 'probe' && asset.steps.probe?.state === 'failed') {
        asset = saveAsset({ ...asset, steps: { ...asset.steps, [step]: { state: 'failed', note: 'could not read the file' } } });
        continue;
      }
      asset = saveAsset({ ...asset, steps: { ...asset.steps, [step]: { state: 'running' } } });
      log(`${id}: ${step}…`);
      const started = Date.now();
      try {
        const result = await steps[step](asset);
        asset = { ...asset, ...result.patch, steps: { ...asset.steps, [step]: { state: result.state ?? 'done', ...(result.note ? { note: result.note } : {}) } } };
        log(`${id}: ${step} ${result.state ?? 'done'}${result.note ? ` (${result.note})` : ''} in ${((Date.now() - started) / 1000).toFixed(1)}s`);
      } catch (err) {
        const note = err instanceof Error ? err.message.slice(0, 300) : String(err);
        asset = { ...asset, steps: { ...asset.steps, [step]: { state: 'failed', note } } };
        log(`${id}: ${step} FAILED: ${note}`);
      }
      asset = saveAsset({ ...asset, facts: buildFacts(asset) });
    }
    return asset;
  } finally {
    releaseLock(id);
  }
}

/** Assets with unfinished steps (e.g. interrupted by a restart). */
export const needsAnalysis = (a: MediaAsset) => stepsFor(a.kind).some((s) => ['pending', 'running'].includes(a.steps[s]?.state ?? 'pending'));
