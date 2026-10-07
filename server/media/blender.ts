// Blender (Cycles) as a hero-shot renderer. Project scripts (project/blender/*.py) build a scene with
// the helpers in scripts/blender/ev3d.py; `ev blender` renders it to a PNG sequence under
// project/media/renders/<name>/, which scenes play with <BlenderShot name="…" />.
// Blender lives in .cache/blender (portable, no admin rights), installed on first use.
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { createReadStream, existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT, PROJECT_DIR } from '../store.ts';
import { MEDIA_DIR } from './library.ts';

export const BLENDER_VERSION = '5.2.2';
const SERIES = BLENDER_VERSION.split('.').slice(0, 2).join('.');
const DIR = join(ROOT, '.cache', 'blender');
export const BLENDER = join(DIR, 'Blender.app', 'Contents', 'MacOS', 'Blender');
export const RENDERS_DIR = join(MEDIA_DIR, 'renders');

function run(cmd: string, args: string[], onLine?: (line: string) => void, env?: NodeJS.ProcessEnv): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { stdio: ['ignore', 'pipe', 'pipe'], env: env ?? process.env });
    let tail = '';
    const feed = (chunk: Buffer) => {
      const text = chunk.toString('utf8');
      tail = (tail + text).slice(-6000);
      if (onLine) for (const line of text.split('\n')) if (line.trim()) onLine(line);
    };
    child.stdout.on('data', feed);
    child.stderr.on('data', feed);
    child.on('error', reject);
    child.on('close', (code) => (code === 0 ? resolve() : reject(new Error(`${cmd.split('/').pop()} exited with ${code}: ${tail.trim().split('\n').slice(-6).join(' | ')}`))));
  });
}

async function sha256(file: string): Promise<string> {
  const h = createHash('sha256');
  for await (const chunk of createReadStream(file)) h.update(chunk as Buffer);
  return h.digest('hex');
}

/** Downloads and verifies Blender into .cache/blender if it isn't there (macOS, Apple Silicon or Intel). */
export async function ensureBlender(log: (m: string) => void = () => {}): Promise<string> {
  if (existsSync(BLENDER)) return BLENDER;
  if (process.platform !== 'darwin') throw new Error('ev blender installs Blender automatically on macOS only; elsewhere install Blender and symlink it to .cache/blender/Blender.app/Contents/MacOS/Blender');
  const arch = process.arch === 'arm64' ? 'arm64' : 'x64';
  const name = `blender-${BLENDER_VERSION}-macos-${arch}.dmg`;
  const base = `https://download.blender.org/release/Blender${SERIES}`;
  mkdirSync(DIR, { recursive: true });
  const dmg = join(DIR, name);
  log(`downloading ${name} (~350 MB)…`);
  const res = await fetch(`${base}/${name}`);
  if (!res.ok || !res.body) throw new Error(`download failed: ${res.status} ${base}/${name}`);
  writeFileSync(dmg, Buffer.from(await res.arrayBuffer()));
  const sums = await (await fetch(`${base}/blender-${BLENDER_VERSION}.sha256`)).text();
  const expected = sums.split('\n').find((l) => l.includes(name))?.split(/\s+/)[0];
  const actual = await sha256(dmg);
  if (!expected || expected !== actual) {
    rmSync(dmg, { force: true });
    throw new Error(`checksum mismatch for ${name} (expected ${expected ?? 'none'}, got ${actual})`);
  }
  const mount = join(DIR, 'mnt');
  mkdirSync(mount, { recursive: true });
  await run('hdiutil', ['attach', '-nobrowse', '-readonly', '-mountpoint', mount, dmg]);
  try {
    await run('cp', ['-R', join(mount, 'Blender.app'), join(DIR, 'Blender.app')]);
  } finally {
    await run('hdiutil', ['detach', mount]).catch(() => {});
    rmSync(dmg, { force: true });
  }
  log(`installed Blender ${BLENDER_VERSION} → ${BLENDER}`);
  return BLENDER;
}

export interface BlenderJob {
  /** project/blender/<script>.py (name or path). */
  script: string;
  name: string;
  width: number;
  height: number;
  samples: number;
  /** Scene frames, inclusive, 0-based (rendered as 00000.png …). */
  frames: [number, number];
  transparent: boolean;
  fps: number;
  options: Record<string, string | number | boolean>;
  saveBlend?: boolean;
}

export interface BlenderResult { dir: string; frames: number; seconds: number; perFrame: number }

export async function renderBlender(job: BlenderJob, onFrame: (frame: number, seconds: number) => void, log: (m: string) => void = () => {}): Promise<BlenderResult> {
  const blender = await ensureBlender(log);
  const script = existsSync(job.script) ? job.script : join(PROJECT_DIR, 'blender', job.script.endsWith('.py') ? job.script : `${job.script}.py`);
  if (!existsSync(script)) throw new Error(`no Blender script ${job.script} (looked in project/blender/)`);
  const out = join(RENDERS_DIR, job.name);
  mkdirSync(out, { recursive: true });
  const args = {
    project: PROJECT_DIR,
    script,
    out,
    width: job.width,
    height: job.height,
    samples: job.samples,
    frames: [job.frames[0] + 1, job.frames[1] + 1],
    transparent: job.transparent,
    fps: job.fps,
    options: job.options,
    blend: job.saveBlend ?? false,
  };
  let frames = 0;
  let total = 0;
  const t0 = Date.now();
  await run(blender, ['-b', '--factory-startup', '--python-exit-code', '1', '--python', join(ROOT, 'scripts', 'blender', 'harness.py')], (line) => {
    const m = /^EVFRAME (\d+) ([\d.]+)/.exec(line);
    if (m) {
      frames++;
      total += Number(m[2]);
      onFrame(Number(m[1]), Number(m[2]));
    } else if (/Error|Traceback|error:/.test(line) && !/Color management/.test(line)) log(line);
  }, { ...process.env, EV_BLENDER_ARGS: JSON.stringify(args) });
  const meta = { ...job, script: script.replace(ROOT + '/', ''), renderedAt: new Date().toISOString(), seconds: Math.round((Date.now() - t0) / 1000), perFrame: frames ? total / frames : 0, blender: BLENDER_VERSION };
  writeFileSync(join(out, 'render.json'), JSON.stringify(meta, null, 2));
  return { dir: out, frames, seconds: meta.seconds, perFrame: meta.perFrame };
}
