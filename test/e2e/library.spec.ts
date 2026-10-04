// The Library view: themes, live component demos, technique cards.
// Applying a theme is deliberately not exercised here: it creates a real version in the
// user's project history. It is covered by the API being shared with `ev theme`.
import { expect, test } from '@playwright/test';
import { catalog } from '../../library/catalog.ts';

const shot = (page: import('@playwright/test').Page, name: string) => page.screenshot({ path: `test-results/screens/${name}.png`, fullPage: false });

test('Library shows themes, a live demo per component, and technique cards', async ({ page }) => {
  await page.goto('/#library');
  await expect(page.locator('.theme-card')).toHaveCount(5);
  await expect(page.locator('.theme-card.on')).toContainText('current');
  await expect(page.locator('.demo-card')).toHaveCount(catalog.filter((c) => !c.audio).length);
  await expect(page.locator('.audio-card')).toHaveCount(catalog.filter((c) => c.audio).length);
  // Each demo renders real composition DOM (layers), not an empty player.
  await expect(page.locator('.demo-card [data-layer^="DEMO."]').first()).toBeAttached();
  await expect(page.locator('.technique')).toHaveCount(12);
  await page.waitForTimeout(800); // let fonts settle for the screenshot
  await shot(page, '07-library');
});

test('previewing a theme restyles the demos without applying it', async ({ page }) => {
  await page.goto('/#library');
  const title = page.locator('.demo-card', { hasText: 'KineticTitle' }).locator('[data-layer="DEMO.title"]');
  // Preview a theme whose type style differs from the project's current one, whatever that is.
  const currentlyUppercase = (await title.evaluate((el) => getComputedStyle(el).textTransform)) === 'uppercase';
  const target = currentlyUppercase ? { name: 'Warm Editorial', transform: 'none', font: 'Instrument Serif' } : { name: 'Neon Sport', transform: 'uppercase', font: 'Anton' };

  await page.locator('.theme-card', { hasText: target.name }).click();
  await expect(page.locator('.theme-card.on')).toContainText(target.name);
  await expect.poll(() => title.evaluate((el) => getComputedStyle(el).textTransform)).toBe(target.transform);
  await expect.poll(() => title.evaluate((el) => getComputedStyle(el).fontFamily)).toContain(target.font);
  await expect(page.getByRole('button', { name: 'Apply to project' })).toBeVisible();
  await page.waitForTimeout(800);
  await shot(page, '08-library-preview');
});

test('a technique card expands to the full card', async ({ page }) => {
  await page.goto('/#library');
  const card = page.locator('.technique', { hasText: 'Cutting to music' });
  await card.locator('.technique-head').click();
  await expect(card.locator('.technique-body')).toContainText('Cut on downbeats');
  await expect(card.locator('.technique-body')).toContainText('## Sources');
});

test('switching views keeps the editor state, and shortcuts only act in the editor', async ({ page }) => {
  await page.goto('/');
  const track = (await page.locator('.track').boundingBox())!;
  await page.mouse.click(track.x + track.width * 0.3, track.y + 8);
  const frame = await page.locator('.controls .small').textContent();
  await page.locator('.nav').getByRole('button', { name: 'Library' }).click();
  await expect(page.locator('.library')).toBeVisible();
  await page.keyboard.press('ArrowRight'); // must not move the hidden editor's playhead
  await page.locator('.nav').getByRole('button', { name: 'Editor' }).click();
  await expect(page.locator('.controls .small')).toHaveText(frame!);
});
