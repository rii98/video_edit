// Multiple videos. The active project always lives at `project/` (every import, tool and
// path is written against it); inactive projects wait in `projects/<slug>/`. Switching
// renames folders: instant on one disk, with each project's git history, media and
// exports moving with it.
//
// Why not a symlink? Vite and webpack resolve symlinks to real paths, which would break
// every scene's relative imports (`../../src/video/kit`).
//
// A swap is two renames, so it is journaled (projects/.switch.json): if the process dies
// in between, the next start finishes it.
import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

import type { ProjectInfo } from '../src/shared/types.ts';
export type { ProjectInfo };

const paths = (root: string) => ({
  active: join(root, 'project'),
  shelf: join(root, 'projects'),
  journal: join(root, 'projects', '.switch.json'),
  template: join(root, 'templates', 'project'),
});

export function slugify(name: string): string {
  return (
    name
      .toLowerCase()
      .normalize('NFKD')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 40)
      .replace(/-+$/, '') || 'video'
  );
}

function readInfo(dir: string): ProjectInfo | null {
  try {
    return JSON.parse(readFileSync(join(dir, 'project.json'), 'utf8')) as ProjectInfo;
  } catch {
    return null;
  }
}

function writeInfo(dir: string, info: ProjectInfo): void {
  writeFileSync(join(dir, 'project.json'), JSON.stringify(info, null, 2) + '\n');
}

/** Finishes an interrupted switch, so `project/` is always a complete project. */
function recover(root: string): void {
  const p = paths(root);
  if (!existsSync(p.journal)) return;
  const { from, to } = JSON.parse(readFileSync(p.journal, 'utf8')) as { from: string; to: string };
  const activeSlug = existsSync(p.active) ? readInfo(p.active)?.slug : null;
  if (activeSlug === from) renameSync(p.active, join(p.shelf, from)); // step 1 hadn't happened
  if (!existsSync(p.active) && existsSync(join(p.shelf, to))) renameSync(join(p.shelf, to), p.active); // step 2
  rmSync(p.journal, { force: true });
}

/**
 * Makes sure there is an active project with a project.json. Migrates the original
 * single-project layout in place (it just gains a project.json).
 */
export function ensureProjectsLayout(root = ROOT, { defaultName = 'My first video' } = {}): void {
  const p = paths(root);
  mkdirSync(p.shelf, { recursive: true });
  recover(root);
  if (!existsSync(p.active)) {
    const shelved = listShelf(root)[0];
    if (shelved) renameSync(join(p.shelf, shelved.slug), p.active);
    else {
      cpSync(p.template, p.active, { recursive: true });
      writeInfo(p.active, { slug: slugify(defaultName), name: defaultName, createdAt: new Date().toISOString() });
    }
  }
  if (!readInfo(p.active)) writeInfo(p.active, { slug: slugify(defaultName), name: defaultName, createdAt: new Date().toISOString() });
}

function listShelf(root: string): ProjectInfo[] {
  const p = paths(root);
  if (!existsSync(p.shelf)) return [];
  return readdirSync(p.shelf, { withFileTypes: true })
    .filter((d) => d.isDirectory() && !d.name.startsWith('.'))
    .map((d) => readInfo(join(p.shelf, d.name)) ?? { slug: d.name, name: d.name, createdAt: '' });
}

export function activeProject(root = ROOT): ProjectInfo {
  const info = readInfo(paths(root).active);
  if (!info) throw new Error('No active project (project/project.json missing)');
  return info;
}

/** Active first, then the rest by name. */
export function listProjects(root = ROOT): (ProjectInfo & { active: boolean })[] {
  const active = activeProject(root);
  const others = listShelf(root).sort((a, b) => a.name.localeCompare(b.name));
  return [{ ...active, active: true }, ...others.map((o) => ({ ...o, active: false }))];
}

/** Creates a project from the template, shelved (not active). Returns where it lives. */
export function createProject(name: string, root = ROOT): { info: ProjectInfo; dir: string } {
  const clean = name.trim();
  if (!clean) throw new Error('Give the project a name');
  if (clean.length > 80) throw new Error('That name is too long');
  const taken = new Set(listProjects(root).map((p) => p.slug));
  const base = slugify(clean);
  let slug = base;
  for (let n = 2; taken.has(slug); n++) slug = `${base}-${n}`;
  const dir = join(paths(root).shelf, slug);
  cpSync(paths(root).template, dir, { recursive: true });
  const info = { slug, name: clean, createdAt: new Date().toISOString() };
  writeInfo(dir, info);
  return { info, dir };
}

/** Makes `slug` the active project. Callers must make sure nothing is writing to project/. */
export function switchProject(slug: string, root = ROOT): ProjectInfo {
  const p = paths(root);
  const from = activeProject(root).slug;
  if (slug === from) return activeProject(root);
  if (!/^[a-z0-9-]+$/.test(slug) || !existsSync(join(p.shelf, slug))) throw new Error(`No project "${slug}"`);
  writeFileSync(p.journal, JSON.stringify({ from, to: slug }));
  renameSync(p.active, join(p.shelf, from));
  renameSync(join(p.shelf, slug), p.active);
  rmSync(p.journal, { force: true });
  return activeProject(root);
}
