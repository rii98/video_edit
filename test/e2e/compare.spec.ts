// Compare: render the oldest version next to the current project at the playhead.
import { readdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test } from '@playwright/test';
import { SNAPSHOTS_DIR } from '../../server/store.ts';

test.afterAll(() => {
  for (const f of readdirSync(SNAPSHOTS_DIR)) if (f.startsWith('compare-')) rmSync(join(SNAPSHOTS_DIR, f));
});

test('compares the first version with the current one at the same frame', async ({ page }) => {
  test.setTimeout(120_000);
  await page.goto('/');
  const track = (await page.locator('.track').boundingBox())!;
  await page.mouse.click(track.x + (60 / 266) * track.width, track.y + 8);
  const oldest = page.locator('.version').last();
  await oldest.getByRole('button', { name: 'Compare' }).click();

  const modal = page.getByRole('dialog', { name: 'Compare versions' });
  await expect(modal).toContainText('Rendering both versions');
  const images = modal.locator('.compare-grid img');
  await expect(images).toHaveCount(2, { timeout: 90_000 });
  for (const img of await images.all()) {
    await expect.poll(() => img.evaluate((el: HTMLImageElement) => el.naturalWidth), { timeout: 15_000 }).toBeGreaterThan(100);
  }
  await expect(modal.locator('figcaption').last()).toContainText('v0: starting point');
  await page.screenshot({ path: 'test-results/screens/11-compare.png' });

  // Escape closes without restoring anything.
  await page.keyboard.press('Escape');
  await expect(modal).toHaveCount(0);
});
