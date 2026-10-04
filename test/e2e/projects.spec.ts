// Multiple projects: create → land in a blank video → switch back to the original, intact.
// Switching restarts the editor's server; the test always restores the original project
// and deletes the one it made.
import { existsSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test, type APIRequestContext } from '@playwright/test';
import { REQUESTS_DIR, ROOT } from '../../server/store.ts';

const NAME = '[e2e] Project test';
const SLUG = 'e2e-project-test';
let original = '';

async function state(request: APIRequestContext) {
  for (let i = 0; i < 60; i++) {
    try {
      const res = await request.get('/api/state');
      if (res.ok()) return (await res.json()) as { project: { slug: string; name: string }; projects: { slug: string }[]; media: unknown[] };
    } catch {
      // restarting
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error('editor did not come back');
}

test.describe.configure({ mode: 'serial' });

test.beforeAll(async ({ request }) => {
  original = (await state(request)).project.slug;
});

test.afterAll(async ({ request }) => {
  const s = await state(request);
  if (s.project.slug !== original) {
    await request.post('/api/projects/switch', { headers: { 'X-Easy-Video': '1' }, data: { slug: original } });
    for (let i = 0; i < 60 && (await state(request)).project.slug !== original; i++) await new Promise((r) => setTimeout(r, 500));
  }
  rmSync(join(ROOT, 'projects', SLUG), { recursive: true, force: true });
  expect((await state(request)).project.slug).toBe(original);
});

test('create a project, land in a blank video, then switch back to the original intact', async ({ page, request }) => {
  test.setTimeout(120_000);
  const before = await state(request);
  await page.goto('/');
  await expect(page.locator('.project-name')).toHaveText(before.project.name);

  await page.locator('.project-button').click();
  await page.getByRole('menuitem', { name: /New project/ }).click();
  await page.locator('.new-project input').fill(NAME);
  await page.getByRole('button', { name: 'Create' }).click();
  await expect(page.locator('.switch-overlay')).toContainText(NAME);

  // The page reloads into the new, blank project.
  await expect(page.locator('.project-name')).toHaveText(NAME, { timeout: 60_000 });
  await expect(page.locator('[data-layer="S01.title"]')).toContainText('A new video starts here');
  await expect(page.getByRole('tab', { name: /Media/ }).locator('.count')).toHaveText('0');
  await expect(page.locator('.version')).toHaveCount(1);
  await expect(page.locator('.version-subject')).toHaveText('v0: starting point');
  expect(existsSync(join(ROOT, 'projects', before.project.slug, 'timeline.json'))).toBe(true); // original shelved, not touched
  await page.screenshot({ path: 'test-results/screens/15-new-project.png' });

  // Switch back from the menu.
  await page.locator('.project-button').click();
  await page.getByRole('menuitem', { name: new RegExp(before.project.name) }).click();
  await expect(page.locator('.project-name')).toHaveText(before.project.name, { timeout: 60_000 });
  await expect(page.getByRole('tab', { name: /Media/ }).locator('.count')).toHaveText(String(before.media.length));
  const after = await state(request);
  expect(after.projects.map((p) => p.slug).sort()).toEqual([before.project.slug, SLUG].sort());
});

test('switching is refused while Claude is mid-edit', async ({ request }) => {
  const path = join(REQUESTS_DIR, '9999.json');
  const now = new Date().toISOString();
  writeFileSync(path, JSON.stringify({ id: 9999, createdAt: now, updatedAt: now, status: 'working', prompt: '[e2e] busy', scope: 'video', frame: 0, sceneId: null, pin: null, region: null, layers: [] }));
  try {
    const res = await request.post('/api/projects/switch', { headers: { 'X-Easy-Video': '1' }, data: { slug: SLUG } });
    expect(res.status()).toBe(409);
    expect((await res.json()).error).toContain('Claude is mid-edit');
    expect((await state(request)).project.slug).toBe(original);
  } finally {
    rmSync(path, { force: true });
  }
  expect(readdirSync(REQUESTS_DIR).includes('9999.json')).toBe(false);
});
