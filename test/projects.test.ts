// Project switching moves folders; these tests make sure nothing is ever lost or mixed up.
import assert from 'node:assert/strict';
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, beforeEach, describe, it } from 'node:test';
import { activeProject, createProject, ensureProjectsLayout, listProjects, ROOT, slugify, switchProject } from '../server/projects.ts';

let root = '';
const roots: string[] = [];
after(() => roots.forEach((r) => rmSync(r, { recursive: true, force: true })));

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'ev-projects-'));
  roots.push(root);
  cpSync(join(ROOT, 'templates'), join(root, 'templates'), { recursive: true });
});

/** A legacy single-project folder with history and media. */
function legacyProject() {
  mkdirSync(join(root, 'project/scenes'), { recursive: true });
  mkdirSync(join(root, 'project/media/raw'), { recursive: true });
  mkdirSync(join(root, 'project/.git'), { recursive: true });
  writeFileSync(join(root, 'project/scenes/S01.tsx'), 'gym scene');
  writeFileSync(join(root, 'project/media/raw/clip.mp4'), 'footage');
  writeFileSync(join(root, 'project/.git/HEAD'), 'ref: refs/heads/main');
}
const read = (p: string) => readFileSync(join(root, p), 'utf8');

describe('projects', () => {
  it('migrates the original single project in place, keeping everything', () => {
    legacyProject();
    ensureProjectsLayout(root, { defaultName: 'Skull crushers reel' });
    assert.equal(activeProject(root).slug, 'skull-crushers-reel');
    assert.equal(read('project/scenes/S01.tsx'), 'gym scene');
    assert.equal(read('project/media/raw/clip.mp4'), 'footage');
    assert.ok(existsSync(join(root, 'project/.git/HEAD')));
  });

  it('creates a fresh project from the template on an empty install', () => {
    ensureProjectsLayout(root);
    assert.equal(activeProject(root).name, 'My first video');
    assert.ok(existsSync(join(root, 'project/scenes/S01_Start.tsx')));
  });

  it('creates, switches and switches back without mixing content', () => {
    legacyProject();
    ensureProjectsLayout(root, { defaultName: 'Gym' });
    const { info } = createProject('Cold brew ad', root);
    assert.equal(info.slug, 'cold-brew-ad');
    assert.equal(activeProject(root).slug, 'gym', 'creating does not switch');

    switchProject('cold-brew-ad', root);
    assert.equal(activeProject(root).name, 'Cold brew ad');
    assert.ok(existsSync(join(root, 'project/scenes/S01_Start.tsx')));
    assert.ok(!existsSync(join(root, 'project/media/raw/clip.mp4')), 'media stays with its project');
    assert.equal(read('projects/gym/scenes/S01.tsx'), 'gym scene');

    switchProject('gym', root);
    assert.equal(read('project/media/raw/clip.mp4'), 'footage');
    assert.deepEqual(listProjects(root).map((p) => `${p.slug}${p.active ? '*' : ''}`), ['gym*', 'cold-brew-ad']);
  });

  it('gives duplicate names distinct slugs', () => {
    ensureProjectsLayout(root);
    assert.equal(createProject('Launch', root).info.slug, 'launch');
    assert.equal(createProject('Launch', root).info.slug, 'launch-2');
    assert.equal(slugify('  Café Ad!! '), 'cafe-ad');
  });

  it('finishes a switch that crashed between its two renames', () => {
    legacyProject();
    ensureProjectsLayout(root, { defaultName: 'Gym' });
    createProject('Next', root);
    // Simulate a crash after step 1: active shelved, new one not yet moved in.
    writeFileSync(join(root, 'projects/.switch.json'), JSON.stringify({ from: 'gym', to: 'next' }));
    renameSync(join(root, 'project'), join(root, 'projects/gym'));
    ensureProjectsLayout(root);
    assert.equal(activeProject(root).slug, 'next');
    assert.ok(existsSync(join(root, 'projects/gym/media/raw/clip.mp4')));
    assert.ok(!existsSync(join(root, 'projects/.switch.json')));
  });

  it('refuses unknown or unsafe project names', () => {
    ensureProjectsLayout(root);
    assert.throws(() => switchProject('../etc', root), /No project/);
    assert.throws(() => switchProject('missing', root), /No project/);
    assert.throws(() => createProject('   ', root), /name/);
  });
});
