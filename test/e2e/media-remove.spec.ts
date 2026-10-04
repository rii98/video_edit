// Removing media: refused while a scene uses it, allowed otherwise.
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test } from '@playwright/test';
import { FFMPEG } from '../../server/media/ffmpeg.ts';
import { RAW_DIR } from '../../server/media/library.ts';

const SCENE = join(import.meta.dirname, '../../project/scenes/S02_PointAndSay.tsx');
const FIXTURE = join(import.meta.dirname, '../../test-results/fixtures/e2e removable.png');

test('Remove deletes unused media, and refuses media a scene still uses', async ({ page }) => {
  mkdirSync(join(FIXTURE, '..'), { recursive: true });
  execFileSync(FFMPEG, ['-v', 'error', '-y', '-f', 'lavfi', '-i', 'color=c=0x336699:size=320x240:duration=1', '-frames:v', '1', FIXTURE]);
  await page.goto('/');
  await page.getByRole('tab', { name: /Media/ }).click();
  await page.locator('.media-panel input[type=file]').setInputFiles(FIXTURE);
  const item = page.locator('.media-item', { hasText: 'e2e removable.png' });
  await expect(item.locator('.media-status')).toHaveText(/^Ready/, { timeout: 30_000 });
  await item.locator('.media-main').click();
  const id = (await item.locator('.media-id code').textContent())!;

  // Pretend a scene uses it: removal must be refused, leaving the file in place.
  const original = readFileSync(SCENE);
  try {
    writeFileSync(SCENE, `${original}\n// uses ${id}\n`);
    await item.getByRole('button', { name: 'Remove' }).click();
    await item.getByRole('button', { name: 'Confirm remove' }).click();
    await expect(item.locator('.error')).toContainText('is used in project/scenes/S02_PointAndSay.tsx');
  } finally {
    writeFileSync(SCENE, original);
  }

  await item.getByRole('button', { name: 'Remove' }).click();
  await item.getByRole('button', { name: 'Confirm remove' }).click();
  await expect(item).toHaveCount(0);
  expect(existsSync(join(RAW_DIR, `${id}.png`))).toBe(false);
});
