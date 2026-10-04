// Every applied edit is a commit in project/, so versions, undo and compare come from git.
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Version } from '../src/shared/types.ts';
import { PROJECT_DIR } from './store.ts';

// Version history must not depend on the machine's global git identity.
const IDENTITY = ['-c', 'user.name=Easy Video', '-c', 'user.email=easy-video@localhost'];

/**
 * Paths that are never part of a version: media (large, user-owned), bridge state, renders.
 * Two independent guards keep them out:
 * 1. .git/info/exclude, which unlike .gitignore is not versioned, so restoring an old
 *    version can't switch the rule off. (That once let media get committed and then
 *    deleted by a later restore.)
 * 2. Every stage unstages them explicitly, and restores skip them, in case the ignore
 *    rules are ever wrong. (Exclude pathspecs can't be used with `add`: git errors when they
 *    name ignored paths.)
 */
const NEVER_VERSIONED = ['media/', 'media.json', '.ev/', 'out/', '.env'];
const NEVER_PATHS = NEVER_VERSIONED.map((p) => p.replace(/\/$/, ''));
const RESTORE_PATHSPECS = ['.', ...NEVER_PATHS.map((p) => `:(exclude)${p}`)];

function git(dir: string, ...args: string[]): string {
  return execFileSync('git', [...IDENTITY, ...args], { cwd: dir, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
}

function ensureExcludes(dir: string): void {
  const file = join(dir, '.git/info/exclude');
  mkdirSync(join(dir, '.git/info'), { recursive: true });
  const current = existsSync(file) ? readFileSync(file, 'utf8') : '';
  const missing = NEVER_VERSIONED.filter((p) => !current.split('\n').includes(p));
  if (missing.length) writeFileSync(file, `${current.trimEnd()}\n# Easy Video: never versioned\n${missing.join('\n')}\n`);
}

export function ensureRepo(dir = PROJECT_DIR): void {
  if (!existsSync(join(dir, '.git'))) {
    git(dir, 'init', '-q', '-b', 'main');
    ensureExcludes(dir);
    stageAll(dir);
    git(dir, 'commit', '-q', '-m', 'v0: starting point');
    return;
  }
  ensureExcludes(dir);
}

function stageAll(dir: string): void {
  git(dir, 'add', '-A');
  // Unstages (and untracks, if an old version tracked them) anything never versioned.
  git(dir, 'rm', '-r', '-q', '--cached', '--ignore-unmatch', '--', ...NEVER_PATHS);
}

/** Commits all project changes. Returns the short sha, or null if nothing changed. */
export function commitAll(message: string, dir = PROJECT_DIR): string | null {
  ensureRepo(dir);
  stageAll(dir);
  try {
    git(dir, 'diff', '--cached', '--quiet');
    return null; // exit 0 → nothing staged
  } catch {
    git(dir, 'commit', '-q', '-m', message);
    return git(dir, 'rev-parse', '--short', 'HEAD');
  }
}

export function listVersions(limit = 50, dir = PROJECT_DIR): Version[] {
  if (!existsSync(join(dir, '.git'))) return [];
  const raw = git(dir, 'log', `-n${limit}`, '--format=%H%x1f%h%x1f%cI%x1f%s');
  return raw
    ? raw.split('\n').map((line) => {
        const [sha = '', short = '', date = '', subject = ''] = line.split('\x1f');
        return { sha, short, date, subject };
      })
    : [];
}

/** Restores the project to a version as a new commit, so the restore itself can be undone. */
export function restoreVersion(sha: string, dir = PROJECT_DIR): string | null {
  if (!/^[0-9a-f]{7,40}$/.test(sha)) throw new Error('invalid version id');
  ensureRepo(dir);
  const subject = git(dir, 'log', '-1', '--format=%s', sha);
  git(dir, 'restore', `--source=${sha}`, '--staged', '--worktree', '--', ...RESTORE_PATHSPECS);
  return commitAll(`Restore: ${subject}`, dir);
}

/**
 * Undoes one version's changes as a new commit, keeping everything done since. If a later
 * edit changed the same lines the revert can't apply cleanly: it is aborted (nothing
 * changes) and an error explains that Compare/Restore is the way back instead.
 */
export function revertCommit(sha: string, message: string, dir = PROJECT_DIR): string {
  if (!/^[0-9a-f]{7,40}$/.test(sha)) throw new Error('invalid version id');
  ensureRepo(dir);
  try {
    git(dir, 'revert', '--no-commit', sha);
  } catch {
    try {
      git(dir, 'revert', '--abort');
    } catch {
      // nothing to abort
    }
    throw new Error('Later edits changed the same part of the video, so this one edit can’t be undone on its own. Use Compare/Restore in Versions instead.');
  }
  const commit = commitAll(message, dir);
  if (!commit) throw new Error('That edit made no changes to undo');
  return commit;
}
