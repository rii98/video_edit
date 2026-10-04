// Regression: restoring old versions must never commit or delete user media.
// Replays the sequence that once lost a user's upload: an old version whose .gitignore
// predates the media rules is restored, then a version without media is restored.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, describe, it } from 'node:test';
import { commitAll, ensureRepo, listVersions, restoreVersion, revertCommit } from '../server/git.ts';

const dir = mkdtempSync(join(tmpdir(), 'ev-git-'));
after(() => rmSync(dir, { recursive: true, force: true }));
const write = (p: string, s: string) => {
  mkdirSync(join(dir, p, '..'), { recursive: true });
  writeFileSync(join(dir, p), s);
};
const tracked = () => execFileSync('git', ['ls-files'], { cwd: dir, encoding: 'utf8' }).split('\n').filter(Boolean);

describe('version restore', () => {
  it('never versions or deletes media, even when an old .gitignore is restored', () => {
    // v0: old-style .gitignore without the media rules (like early projects).
    write('.gitignore', '.ev/\nout/\n');
    write('scenes/S01.tsx', 'v0');
    ensureRepo(dir);
    const v0 = listVersions(1, dir)[0]!.sha;

    write('.gitignore', '.ev/\nout/\nmedia/\nmedia.json\n');
    write('scenes/S01.tsx', 'v1');
    const v1 = commitAll('v1', dir)!;

    // The user's media arrives (never committed).
    write('media/raw/clip.mp4', 'precious footage');
    write('media.json', '{"assets":{}}');

    restoreVersion(v0, dir); // brings back the old .gitignore
    assert.equal(readFileSync(join(dir, 'scenes/S01.tsx'), 'utf8'), 'v0');
    assert.ok(!tracked().some((f) => f.startsWith('media')), `media got versioned: ${tracked().join(', ')}`);

    restoreVersion(v1, dir); // a version that has no media in it
    assert.equal(readFileSync(join(dir, 'scenes/S01.tsx'), 'utf8'), 'v1');
    assert.ok(existsSync(join(dir, 'media/raw/clip.mp4')), 'media was deleted by restore');
    assert.equal(readFileSync(join(dir, 'media/raw/clip.mp4'), 'utf8'), 'precious footage');
    assert.ok(existsSync(join(dir, 'media.json')));
  });

  it('restores removed and changed scene files exactly', () => {
    write('scenes/S02.tsx', 'new scene');
    const before = commitAll('add S02', dir)!;
    restoreVersion(listVersions(50, dir).at(-1)!.sha, dir); // back to v0
    assert.ok(!existsSync(join(dir, 'scenes/S02.tsx')), 'file added later should be removed');
    restoreVersion(before, dir);
    assert.equal(readFileSync(join(dir, 'scenes/S02.tsx'), 'utf8'), 'new scene');
  });
});

describe('undo one edit', () => {
  it('reverts just that version, keeping later edits', () => {
    write('scenes/A.tsx', 'a1');
    write('scenes/B.tsx', 'b1');
    commitAll('base', dir);
    write('scenes/A.tsx', 'a2');
    const edit = commitAll('#7 bigger headline', dir)!;
    write('scenes/B.tsx', 'b2');
    commitAll('#8 other scene', dir);
    write('media/raw/keep.mp4', 'footage');

    const undo = revertCommit(edit, 'Undo #7', dir);
    assert.ok(undo);
    assert.equal(readFileSync(join(dir, 'scenes/A.tsx'), 'utf8'), 'a1', 'the edit is undone');
    assert.equal(readFileSync(join(dir, 'scenes/B.tsx'), 'utf8'), 'b2', 'the later edit survives');
    assert.ok(existsSync(join(dir, 'media/raw/keep.mp4')), 'media untouched');
    assert.equal(listVersions(1, dir)[0]!.subject, 'Undo #7');
  });

  it('refuses cleanly when a later edit changed the same lines', () => {
    write('scenes/C.tsx', 'c1');
    commitAll('base C', dir);
    write('scenes/C.tsx', 'c2');
    const edit = commitAll('#9 change C', dir)!;
    write('scenes/C.tsx', 'c3');
    commitAll('#10 change C again', dir);
    const head = listVersions(1, dir)[0]!.sha;

    assert.throws(() => revertCommit(edit, 'Undo #9', dir), /can’t be undone on its own/);
    assert.equal(readFileSync(join(dir, 'scenes/C.tsx'), 'utf8'), 'c3', 'working files unchanged');
    assert.equal(listVersions(1, dir)[0]!.sha, head, 'no new version');
    assert.equal(execFileSync('git', ['status', '--porcelain'], { cwd: dir, encoding: 'utf8' }).trim(), '', 'repo left clean');
  });
});
