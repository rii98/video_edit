// Final renders. Uses the original media (not proxies), then normalizes loudness for
// social/YouTube. Job state lives in .ev/exports so the editor and the CLI both see it.
import { existsSync, mkdirSync, readdirSync, readFileSync, renameSync, rmSync, statSync } from 'node:fs';
import { join } from 'node:path';
import type { ExportJob, ExportPreset, MainProps } from '../src/shared/types.ts';
import { ffmpeg } from './media/ffmpeg.ts';
import { ensureMediaDirs, MEDIA_DIR } from './media/library.ts';
import { probe } from './media/probe.ts';
import { EV_DIR, PROJECT_DIR, ROOT, writeJsonAtomic } from './store.ts';

export const PRESETS: Record<ExportPreset, { label: string; scale: number; crf: number; loudnorm: boolean }> = {
  final: { label: 'Final: full quality, loudness-normalized', scale: 1, crf: 18, loudnorm: true },
  draft: { label: 'Draft: half size, fast', scale: 0.5, crf: 28, loudnorm: false },
};

/** Loudness target for social platforms and YouTube; true peak kept under -1 dBTP. */
const TARGET = { I: -14, TP: -1, LRA: 11 };

const JOBS_DIR = join(EV_DIR, 'exports');
export const OUT_DIR = join(PROJECT_DIR, 'out');

export function listExports(): ExportJob[] {
  if (!existsSync(JOBS_DIR)) return [];
  return readdirSync(JOBS_DIR)
    .filter((f) => f.endsWith('.json'))
    .map((f) => JSON.parse(readFileSync(join(JOBS_DIR, f), 'utf8')) as ExportJob)
    .sort((a, b) => b.startedAt.localeCompare(a.startedAt));
}

export function getExport(id: string): ExportJob | null {
  return listExports().find((j) => j.id === id) ?? null;
}

const save = (job: ExportJob) => writeJsonAtomic(join(JOBS_DIR, `${job.id}.json`), job);

/**
 * Two-pass EBU R128 normalization: measure, then apply a linear gain. Gentler and more
 * accurate than single-pass (which compresses dynamics). Video is copied untouched.
 */
export async function normalizeLoudness(input: string, output: string): Promise<{ before: number; after: number }> {
  const target = `I=${TARGET.I}:TP=${TARGET.TP}:LRA=${TARGET.LRA}`;
  const measure = await ffmpeg(['-i', input, '-vn', '-af', `loudnorm=${target}:print_format=json`, '-f', 'null', '-']);
  const json = JSON.parse(measure.stderr.slice(measure.stderr.lastIndexOf('{'), measure.stderr.lastIndexOf('}') + 1)) as Record<string, string>;
  const measured = `measured_I=${json.input_i}:measured_TP=${json.input_tp}:measured_LRA=${json.input_lra}:measured_thresh=${json.input_thresh}:offset=${json.target_offset}`;
  await ffmpeg(['-y', '-i', input, '-c:v', 'copy', '-af', `loudnorm=${target}:${measured}:linear=true:print_format=summary`, '-ar', '48000', '-c:a', 'aac', '-b:a', '192k', '-movflags', '+faststart', output]);
  const check = await ffmpeg(['-i', output, '-vn', '-af', 'ebur128=framelog=quiet', '-f', 'null', '-']);
  const after = Number(check.stderr.slice(check.stderr.lastIndexOf('Summary:')).match(/I:\s+(-?[\d.]+) LUFS/)?.[1]);
  return { before: Number(json.input_i), after };
}

let running = false;
export const isExporting = () => running;

/** Renders the project. One export at a time; progress is written to the job file. */
export async function runExport(preset: ExportPreset, log: (m: string) => void = () => {}): Promise<ExportJob> {
  if (!PRESETS[preset]) throw new Error(`Unknown preset "${preset}". Use: ${Object.keys(PRESETS).join(', ')}`);
  if (running) throw new Error('An export is already running');
  running = true;
  const settings = PRESETS[preset];
  const stamp = new Date().toISOString().replace(/[-:]/g, '').replace('T', '-').slice(0, 15);
  const id = `${stamp}-${preset}`;
  const file = `video-${id}.mp4`;
  mkdirSync(JOBS_DIR, { recursive: true });
  mkdirSync(OUT_DIR, { recursive: true });
  let job: ExportJob = { id, preset, status: 'rendering', progress: 0, file: null, startedAt: new Date().toISOString() };
  save(job);
  const tmp = join(OUT_DIR, `.${id}.render.mp4`);
  try {
    ensureMediaDirs();
    const { bundleVideo } = await import('../scripts/stills.ts');
    const { renderMedia, selectComposition } = await import('@remotion/renderer');
    log('bundling…');
    const serveUrl = await bundleVideo();
    const inputProps: MainProps = { pin: null, region: null, proxy: false };
    const composition = await selectComposition({ serveUrl, id: 'Main', inputProps });
    let lastSaved = 0;
    await renderMedia({
      serveUrl,
      composition,
      inputProps,
      codec: 'h264',
      crf: settings.crf,
      scale: settings.scale,
      outputLocation: tmp,
      onProgress: ({ progress }) => {
        if (progress - lastSaved >= 0.02 || progress === 1) {
          lastSaved = progress;
          job = { ...job, progress: Math.round(progress * 100) / 100 };
          save(job);
          log(`rendering ${Math.round(progress * 100)}%`);
        }
      },
    });

    const target = join(OUT_DIR, file);
    const { hasAudio } = await probe(tmp);
    if (settings.loudnorm && hasAudio) {
      job = { ...job, status: 'finishing', progress: 1 };
      save(job);
      log('normalizing loudness…');
      const { before, after } = await normalizeLoudness(tmp, target);
      job = { ...job, loudness: { before, after } };
      rmSync(tmp, { force: true });
    } else {
      renameSync(tmp, target);
    }
    job = { ...job, status: 'done', progress: 1, file, bytes: statSync(target).size, finishedAt: new Date().toISOString() };
    save(job);
    log(`done → project/out/${file}`);
    return job;
  } catch (err) {
    rmSync(tmp, { force: true });
    job = { ...job, status: 'failed', error: err instanceof Error ? err.message.slice(0, 400) : String(err), finishedAt: new Date().toISOString() };
    save(job);
    throw err;
  } finally {
    running = false;
  }
}

/** Removes a job and its output file (used by tests and to clean up the list). */
export function deleteExport(id: string): void {
  const job = getExport(id);
  if (job?.file) rmSync(join(OUT_DIR, job.file), { force: true });
  rmSync(join(JOBS_DIR, `${id}.json`), { force: true });
}
