// The media library: one record per asset at media/analysis/<id>/asset.json.
// Per-asset files (instead of one shared index) mean the UI server and the `ev` CLI can
// both ingest/analyze without clobbering each other. project/media.json is derived.
import { constants, copyFileSync, existsSync, mkdirSync, openSync, readdirSync, readFileSync, readSync, closeSync, renameSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { basename, extname, join } from 'node:path';
import type { AnalysisStep, MediaAsset, MediaKind, MediaManifest } from '../../src/shared/types.ts';
import { PROJECT_DIR, writeJsonAtomic } from '../store.ts';
import { kindOf } from './probe.ts';

/** Static root: served by Vite (preview) and symlinked into Remotion bundles (stills/renders). */
export const MEDIA_DIR = join(PROJECT_DIR, 'media');
export const RAW_DIR = join(MEDIA_DIR, 'raw');
export const PROXY_DIR = join(MEDIA_DIR, 'proxy');
export const ANALYSIS_DIR = join(MEDIA_DIR, 'analysis');
export const MANIFEST_FILE = join(PROJECT_DIR, 'media.json');

export const analysisDir = (id: string) => join(ANALYSIS_DIR, id);
export const mediaPath = (relative: string) => join(MEDIA_DIR, relative);

export function ensureMediaDirs(): void {
  for (const dir of [RAW_DIR, PROXY_DIR, ANALYSIS_DIR]) mkdirSync(dir, { recursive: true });
  // Scenes import the manifest, so it must exist even before the first import.
  if (!existsSync(MANIFEST_FILE)) writeJsonAtomic(MANIFEST_FILE, { assets: {} } satisfies MediaManifest);
}

const STEPS: Record<MediaKind, AnalysisStep[]> = {
  video: ['probe', 'proxy', 'poster', 'shots', 'sheet', 'audio', 'transcript'],
  image: ['probe', 'proxy', 'poster'],
  audio: ['probe', 'audio', 'beats', 'transcript'],
};
export const stepsFor = (kind: MediaKind) => STEPS[kind];

export function listAssets(): MediaAsset[] {
  if (!existsSync(ANALYSIS_DIR)) return [];
  const assets: MediaAsset[] = [];
  for (const id of readdirSync(ANALYSIS_DIR)) {
    const asset = getAsset(id);
    if (asset) assets.push(asset);
  }
  return assets.sort((a, b) => a.addedAt.localeCompare(b.addedAt));
}

export function getAsset(id: string): MediaAsset | null {
  if (!/^[a-z0-9-]+$/.test(id)) return null;
  const file = join(analysisDir(id), 'asset.json');
  try {
    return JSON.parse(readFileSync(file, 'utf8')) as MediaAsset;
  } catch {
    return null;
  }
}

export function saveAsset(asset: MediaAsset): MediaAsset {
  const next = { ...asset, updatedAt: new Date().toISOString() };
  mkdirSync(analysisDir(asset.id), { recursive: true });
  writeJsonAtomic(join(analysisDir(asset.id), 'asset.json'), next);
  writeManifest();
  return next;
}

/**
 * Regenerates media.json from all asset records. Scenes import it, so every write causes
 * a hot reload; only write when the content actually changed.
 */
export function writeManifest(): void {
  const manifest: MediaManifest = { assets: {} };
  for (const a of listAssets()) {
    manifest.assets[a.id] = { kind: a.kind, file: a.file, proxy: a.proxy, width: a.width, height: a.height, fps: a.fps, duration: a.duration, hasAudio: a.hasAudio };
  }
  const next = JSON.stringify(manifest, null, 2) + '\n';
  const current = existsSync(MANIFEST_FILE) ? readFileSync(MANIFEST_FILE, 'utf8') : '';
  if (next !== current) writeJsonAtomic(MANIFEST_FILE, manifest);
}

// ---- Import -----------------------------------------------------------------------------

export function slugify(name: string): string {
  const slug = basename(name, extname(name))
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 28)
    .replace(/-+$/, '');
  return slug || 'media';
}

/**
 * Content fingerprint from size + first and last MiB: fast on multi-GB footage and
 * stable across renames, so importing the same file twice is a no-op.
 */
export function fingerprint(path: string): string {
  const size = statSync(path).size;
  const hash = createHash('sha1').update(String(size));
  const fd = openSync(path, 'r');
  try {
    const chunk = Buffer.alloc(Math.min(size, 1 << 20));
    readSync(fd, chunk, 0, chunk.length, 0);
    hash.update(chunk);
    if (size > chunk.length) {
      readSync(fd, chunk, 0, chunk.length, size - chunk.length);
      hash.update(chunk);
    }
  } finally {
    closeSync(fd);
  }
  return hash.digest('hex').slice(0, 8);
}

/**
 * Adds a file to the library. `move` is used for uploads already written to a temp file
 * inside the media dir; otherwise the file is copied (an instant clone on APFS).
 */
export function importFile(src: string, { name = basename(src), move = false, origin = 'upload' as MediaAsset['origin'] } = {}): { asset: MediaAsset; existing: boolean } {
  ensureMediaDirs();
  const kind = kindOf(name);
  if (!kind) throw new Error(`Unsupported file type: ${name}`);
  const fp = fingerprint(src);
  // Same content under another name is the same asset.
  const existing = listAssets().find((a) => a.id.endsWith(`-${fp}`)) ?? null;
  const id = `${slugify(name)}-${fp}`;
  if (existing) {
    if (move) rmSync(src, { force: true });
    return { asset: existing, existing: true };
  }
  const ext = extname(name).toLowerCase();
  const file = `raw/${id}${ext}`;
  if (move) renameSync(src, mediaPath(file));
  else copyFileSync(src, mediaPath(file), constants.COPYFILE_FICLONE);
  const now = new Date().toISOString();
  const asset: MediaAsset = {
    id,
    kind,
    name,
    file,
    bytes: statSync(mediaPath(file)).size,
    addedAt: now,
    updatedAt: now,
    hasAudio: false,
    steps: Object.fromEntries(stepsFor(kind).map((s) => [s, { state: 'pending' }])),
    facts: [],
    origin,
  };
  return { asset: saveAsset(asset), existing: false };
}

// ---- Locks: one analyzer per asset across processes --------------------------------------

const lockPath = (id: string) => join(analysisDir(id), '.lock');

function pidAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

export function acquireLock(id: string): boolean {
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      writeFileSync(lockPath(id), String(process.pid), { flag: 'wx' });
      return true;
    } catch {
      const holder = Number(readFileSync(lockPath(id), 'utf8'));
      if (holder && pidAlive(holder)) return false;
      rmSync(lockPath(id), { force: true }); // stale: the analyzer crashed
    }
  }
  return false;
}

export function releaseLock(id: string): void {
  rmSync(lockPath(id), { force: true });
}

// ---- Removal ----------------------------------------------------------------------------

/** Scene/treatment files that mention an asset id (so removing it would break the video). */
export function assetUsages(id: string): string[] {
  const dirs = [join(PROJECT_DIR, 'scenes'), join(PROJECT_DIR, 'intake')];
  const hits: string[] = [];
  for (const dir of dirs) {
    if (!existsSync(dir)) continue;
    for (const f of readdirSync(dir)) {
      if (/\.(tsx?|json)$/.test(f) && readFileSync(join(dir, f), 'utf8').includes(id)) hits.push(`project/${dir === dirs[0] ? 'scenes' : 'intake'}/${f}`);
    }
  }
  return hits;
}

/** Deletes an asset's original, proxy and analysis. Refuses while scenes still use it. */
export function removeAsset(id: string, { force = false } = {}): void {
  const asset = getAsset(id);
  if (!asset) throw new Error(`No asset "${id}"`);
  const used = assetUsages(id);
  if (used.length && !force) throw new Error(`"${id}" is used in ${used.join(', ')}; remove it from there first`);
  rmSync(mediaPath(asset.file), { force: true });
  if (asset.proxy) rmSync(mediaPath(asset.proxy), { force: true });
  rmSync(analysisDir(id), { recursive: true, force: true });
  writeManifest();
}
