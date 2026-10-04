// The Intake view: empty state, then three-directions flow with fixture treatments.
// Fixtures are copied into project/intake and every original byte is restored afterwards;
// no version is created.
import { copyFileSync, existsSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test } from '@playwright/test';
import { REQUESTS_DIR } from '../../server/store.ts';

const INTAKE = join(import.meta.dirname, '../../project/intake');
const FIXTURES = join(import.meta.dirname, 'fixtures/intake');
let originals: Map<string, Buffer> | null = null;

function installFixtures() {
  originals = new Map(readdirSync(INTAKE).map((f) => [f, readFileSync(join(INTAKE, f))]));
  for (const f of readdirSync(FIXTURES)) copyFileSync(join(FIXTURES, f), join(INTAKE, f));
}

function restoreOriginals() {
  if (!originals) return;
  for (const f of readdirSync(INTAKE)) if (!originals.has(f)) rmSync(join(INTAKE, f));
  for (const [f, bytes] of originals) writeFileSync(join(INTAKE, f), bytes);
  originals = null;
}

test.describe.configure({ mode: 'serial' });
test.afterAll(() => {
  restoreOriginals();
  for (const name of readdirSync(REQUESTS_DIR)) {
    const path = join(REQUESTS_DIR, name);
    if (existsSync(path) && readFileSync(path, 'utf8').includes('[e2e]')) rmSync(path);
  }
});

test('with no treatments, Intake explains how to start', async ({ page }) => {
  const current = JSON.parse(readFileSync(join(INTAKE, 'intake.json'), 'utf8')) as { treatments: unknown[] };
  test.skip(current.treatments.length > 0, 'project already has treatments');
  await page.goto('/#intake');
  await expect(page.getByRole('heading', { name: 'Start a new video' })).toBeVisible();
});

test('shows the brief and directions, and choosing one queues the build', async ({ page }) => {
  installFixtures();
  await page.goto('/#intake');
  await expect(page.locator('.treatment')).toHaveCount(2, { timeout: 15_000 });
  await expect(page.locator('.brief')).toContainText('Slow negatives build the triceps');
  // Motion tests render real layers, each in its own theme.
  await expect(page.locator('[data-treatment="A"] [data-layer="TA.title"]')).toBeAttached();
  await expect(page.locator('[data-treatment="B"] [data-layer="TB.reps"]')).toBeAttached();
  await expect
    .poll(() => page.locator('[data-treatment="A"] [data-layer="TA.title"]').evaluate((el) => getComputedStyle(el).fontFamily))
    .toContain('Inter');
  await expect
    .poll(() => page.locator('[data-treatment="B"] [data-layer="TB.reps"]').evaluate((el) => {
      // The big number in the ring is set in the theme's display font.
      const value = [...el.querySelectorAll('div')].find((d) => d.textContent === '3' && d.children.length === 0)!;
      return getComputedStyle(value).fontFamily;
    }))
    .toContain('Anton');
  await page.waitForTimeout(800);
  await page.screenshot({ path: 'test-results/screens/09-intake.png' });

  await page.locator('.mix textarea').fill("[e2e] B's HUD with A's title");
  await page.getByRole('button', { name: 'Choose B' }).click();

  // The pick becomes a normal request, and the editor opens to show it queued.
  await expect(page.locator('.nav button.on')).toHaveText('Editor');
  const request = page.locator('.request', { hasText: 'treatment B' }).first();
  await expect(request).toContainText("B's HUD with A's title");
  await expect(request.locator('.badge')).toHaveText('Queued');
  const saved = JSON.parse(readFileSync(join(INTAKE, 'intake.json'), 'utf8')) as { chosen: string };
  expect(saved.chosen).toBe('B');
});
