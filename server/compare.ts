// Side-by-side comparison of any version with the current project at the same frame.
// An old version's scene code isn't loaded anywhere, so it is rebuilt in a cached scratch
// workspace (git archive of that version + a copy of the engine) and rendered from there.
import { execFileSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { MANIFEST_FILE, MEDIA_DIR } from './media/library.ts';
import { PROJECT_DIR, ROOT, SNAPSHOTS_DIR } from './store.ts';

const CACHE = join(tmpdir(), 'easy-video-compare');

function workspaceFor(sha: string): string {
  const dir = join(CACHE, sha);
  if (existsSync(join(dir, '.ready'))) return dir;
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(join(dir, 'project'), { recursive: true });
  // The engine is small; copying it (rather than symlinking) keeps webpack from resolving
  // `../../project` back to the live project.
  for (const part of ['src', 'library']) cpSync(join(ROOT, part), join(dir, part), { recursive: true });
  symlinkSync(join(ROOT, 'node_modules'), join(dir, 'node_modules'));
  execFileSync('sh', ['-c', `git archive ${sha} | tar -x -C "${join(dir, 'project')}"`], { cwd: PROJECT_DIR });
  // Media is shared with the live project (it is never versioned).
  if (existsSync(MEDIA_DIR)) symlinkSync(MEDIA_DIR, join(dir, 'project/media'));
  if (existsSync(MANIFEST_FILE)) symlinkSync(MANIFEST_FILE, join(dir, 'project/media.json'));
  // Versions from before the intake feature have no intake folder; the engine imports it.
  if (!existsSync(join(dir, 'project/intake'))) {
    mkdirSync(join(dir, 'project/intake'));
    writeFileSync(join(dir, 'project/intake/intake.json'), JSON.stringify({ brief: null, format: { width: 1920, height: 1080, fps: 30 }, treatments: [], chosen: null }));
    writeFileSync(join(dir, 'project/intake/index.ts'), "import type { ComponentType } from 'react';\nexport const treatmentComponents: Record<string, ComponentType> = {};\n");
  }
  writeFileSync(join(dir, '.ready'), '');
  return dir;
}

/** Renders `frame` of the current project and of version `sha`. Returns snapshot file names. */
export async function renderComparison(sha: string, frame: number): Promise<{ current: string; version: string }> {
  if (!/^[0-9a-f]{7,40}$/.test(sha)) throw new Error('invalid version id');
  const full = execFileSync('git', ['rev-parse', '--verify', `${sha}^{commit}`], { cwd: PROJECT_DIR, encoding: 'utf8' }).trim();
  const f = Math.max(0, Math.round(frame));
  const { renderStills } = await import('../scripts/stills.ts');
  const current = `compare-current-${f}.png`;
  const version = `compare-${full.slice(0, 7)}-${f}.png`;
  await renderStills([{ frame: f, output: join(SNAPSHOTS_DIR, current) }]);
  const ws = workspaceFor(full);
  await renderStills([{ frame: f, output: join(SNAPSHOTS_DIR, version) }], { entryPoint: join(ws, 'src/video/index.ts') });
  return { current, version };
}
