// Shot-by-shot breakdown of a reference video (someone else's edit the user wants to learn
// from). Not added to the media library: the frames are for study, never for the video.
// Each shot becomes one sheet row: its first, middle and last frame, so camera moves,
// type animation and the transition in/out are all visible without watching it.
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { basename, extname, join } from 'node:path';
import { makeSheet } from '../../scripts/sheet.ts';
import { FFMPEG, ffmpeg } from './ffmpeg.ts';

/** Fast edits cut every few frames; keep anything a viewer could register as a shot. */
const MIN_SHOT_SECONDS = 0.2;
const SHOTS_PER_SHEET = 8;

export interface ReferenceShot {
  n: number;
  start: number;
  end: number;
  /** How hard the cut into this shot is (scdet score); low = dissolve, morph or a move, not a cut. */
  cutScore: number;
}

export interface ReferenceBreakdown {
  source: string;
  dir: string;
  duration: number;
  width: number;
  height: number;
  fps: number;
  shots: ReferenceShot[];
  sheets: string[];
  pace: string[];
}

export function slugify(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'reference';
}

/** pip installs yt-dlp to ~/Library/Python/<ver>/bin, which often isn't on PATH. */
function findYtDlp(): string | null {
  if (spawnSync('yt-dlp', ['--version']).status === 0) return 'yt-dlp';
  const base = join(homedir(), 'Library', 'Python');
  const versions = existsSync(base) ? readdirSync(base).sort().reverse() : [];
  return versions.map((v) => join(base, v, 'bin', 'yt-dlp')).find(existsSync) ?? null;
}

/** A URL is downloaded with yt-dlp when it's installed; otherwise the user saves the file. */
export function fetchReference(url: string, dir: string): string {
  const ytdlp = findYtDlp();
  if (!ytdlp) {
    throw new Error('yt-dlp is not installed. Install it (`pip3 install yt-dlp` or `brew install yt-dlp`), or download the video and pass the file path.');
  }
  mkdirSync(dir, { recursive: true });
  // Merging separate video and audio streams needs ffmpeg; use the project's full build.
  execFileSync(ytdlp, ['-f', 'bv*[height<=1080]+ba/b[height<=1080]/b', '--merge-output-format', 'mp4', '--ffmpeg-location', FFMPEG, '-o', join(dir, 'source.%(ext)s'), url], { stdio: 'inherit' });
  const file = readdirSync(dir).find((f) => f.startsWith('source.') && !f.endsWith('.part'));
  if (!file) throw new Error(`yt-dlp finished but no file landed in ${dir}`);
  return join(dir, file);
}

function probe(stderr: string) {
  const d = stderr.match(/Duration: (\d+):(\d+):([\d.]+)/);
  const v = stderr.match(/Video:.*?, (\d{2,5})x(\d{2,5})/);
  const f = stderr.match(/([\d.]+) fps/);
  if (!d || !v) throw new Error('not a readable video');
  return {
    duration: Number(d[1]) * 3600 + Number(d[2]) * 60 + Number(d[3]),
    width: Number(v[1]),
    height: Number(v[2]),
    fps: f ? Number(f[1]) : 30,
  };
}

const stamp = (t: number) => `${Math.floor(t / 60)}:${(t % 60).toFixed(2).padStart(5, '0')}`;

export async function breakdownReference(file: string, dir: string): Promise<ReferenceBreakdown> {
  mkdirSync(join(dir, 'frames'), { recursive: true });
  const { stderr } = await ffmpeg(['-i', file, '-vf', 'scale=320:-2,scdet=threshold=8', '-an', '-f', 'null', '-']);
  const meta = probe(stderr);
  const cuts: { time: number; score: number }[] = [];
  for (const m of stderr.matchAll(/lavfi\.scd\.score: ([\d.]+), lavfi\.scd\.time: ([\d.]+)/g)) {
    const time = Number(m[2]);
    if (time - (cuts.at(-1)?.time ?? 0) >= MIN_SHOT_SECONDS) cuts.push({ time, score: Number(m[1]) });
  }
  const bounds = [0, ...cuts.map((c) => c.time), meta.duration];
  const shots: ReferenceShot[] = bounds.slice(0, -1).map((start, i) => ({
    n: i + 1,
    start,
    end: bounds[i + 1]!,
    cutScore: i === 0 ? 0 : Math.round(cuts[i - 1]!.score),
  }));

  // First / middle / last frame of every shot, nudged inside the shot so a cut frame never lands.
  const frame = 1 / meta.fps;
  const grab = (t: number, out: string) =>
    execFileSync(FFMPEG, ['-v', 'error', '-y', '-ss', t.toFixed(3), '-i', file, '-frames:v', '1', '-vf', 'scale=480:-2', out]);
  const tiles: { img: string; label: string }[] = [];
  for (const s of shots) {
    const len = s.end - s.start;
    const points: [string, number][] = [
      ['in', s.start + Math.min(2 * frame, len / 4)],
      ['mid', s.start + len / 2],
      ['out', Math.max(s.start, s.end - Math.min(3 * frame, len / 4))],
    ];
    for (const [tag, t] of points) {
      const img = join(dir, 'frames', `s${String(s.n).padStart(3, '0')}-${tag}.png`);
      grab(t, img);
      tiles.push({ img, label: tag === 'in' ? `#${s.n} ${stamp(s.start)} (${len.toFixed(1)}s)` : `#${s.n} ${tag} ${stamp(t)}` });
    }
  }

  const portrait = meta.height > meta.width;
  const sheets: string[] = [];
  const perSheet = SHOTS_PER_SHEET * 3;
  for (let i = 0; i < tiles.length; i += perSheet) {
    const page = tiles.slice(i, i + perSheet);
    const out = join(dir, `sheet-${String(i / perSheet + 1).padStart(2, '0')}.jpg`);
    sheets.push(makeSheet(page.map((p) => p.img), page.map((p) => p.label), out, { cols: portrait ? 6 : 3, tileWidth: portrait ? 240 : 420 }));
  }

  // Shots miss what changes inside a long take (type builds, counters, camera drift):
  // an evenly timed strip catches it.
  const every = Math.min(4, Math.max(0.5, Math.round((meta.duration / 36) * 2) / 2));
  const count = Math.ceil(meta.duration / every);
  const cols = portrait ? 9 : 6;
  const font = ['/System/Library/Fonts/Supplemental/Arial.ttf', '/System/Library/Fonts/Helvetica.ttc'].find(existsSync);
  const label = font ? `,drawtext=fontfile='${font}':text='%{pts\\:hms}':x=4:y=4:fontsize=14:fontcolor=white:box=1:boxcolor=black@0.7` : '';
  const strip = join(dir, 'strip.jpg');
  execFileSync(FFMPEG, ['-v', 'error', '-y', '-i', file, '-vf', `fps=1/${every},scale=${portrait ? 160 : 240}:-2${label},tile=${cols}x${Math.ceil(count / cols)}:padding=3`, '-frames:v', '1', '-q:v', '3', strip]);
  sheets.push(strip);

  const lengths = shots.map((s) => s.end - s.start);
  const asl = meta.duration / shots.length;
  const thirds = [0, 1, 2].map((k) => {
    const from = (k * meta.duration) / 3;
    const to = ((k + 1) * meta.duration) / 3;
    return shots.filter((s) => s.n > 1 && s.start >= from && s.start < to).length;
  });
  const pace = [
    `${shots.length} shots in ${meta.duration.toFixed(1)} s · average shot ${asl.toFixed(2)} s (${Math.round(asl * meta.fps)} frames) · ${(((shots.length - 1) / meta.duration) * 60).toFixed(0)} cuts/min`,
    `shortest ${Math.min(...lengths).toFixed(2)} s · longest ${Math.max(...lengths).toFixed(2)} s`,
    `cuts per third (beginning / middle / end): ${thirds.join(' / ')}`,
    `strip.jpg: one frame every ${every} s, for changes inside long takes`,
    `soft cuts (score < 20: dissolves, morphs, fast moves): ${shots.filter((s) => s.n > 1 && s.cutScore < 20).map((s) => `#${s.n}`).join(' ') || 'none'}`,
  ];

  const breakdown: ReferenceBreakdown = { source: file, dir, ...meta, shots, sheets, pace };
  writeFileSync(join(dir, 'shots.json'), JSON.stringify(breakdown, null, 2));
  return breakdown;
}

/** Folder name for a file or URL. */
export function referenceSlug(input: string): string {
  if (/^https?:\/\//.test(input)) {
    const u = new URL(input);
    return slugify(`${u.hostname.replace(/^www\./, '')}-${u.pathname}${u.searchParams.get('v') ?? ''}`);
  }
  return slugify(basename(input, extname(input)));
}

export const isUrl = (s: string) => /^https?:\/\//.test(s) && !existsSync(s);
