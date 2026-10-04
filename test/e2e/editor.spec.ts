// End-to-end: drives the real editor in Chromium the way a user would.
// Runs against the live project, so every test removes what it creates.
import { execFileSync } from 'node:child_process';
import { mkdirSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test, type Page } from '@playwright/test';
import { FFMPEG } from '../../server/media/ffmpeg.ts';
import { ANALYSIS_DIR, PROXY_DIR, RAW_DIR, writeManifest } from '../../server/media/library.ts';
import { REQUESTS_DIR } from '../../server/store.ts';

const TAG = '[e2e]';
const FIXTURES = join(import.meta.dirname, '../../test-results/fixtures');
const shot = (page: Page, name: string) => page.screenshot({ path: `test-results/screens/${name}.png` });

test.beforeAll(() => {
  mkdirSync(FIXTURES, { recursive: true });
  const ff = (...args: string[]) => execFileSync(FFMPEG, ['-v', 'error', '-y', ...args]);
  ff('-f', 'lavfi', '-i', 'testsrc2=size=1280x720:rate=30:duration=2', '-f', 'lavfi', '-i', 'color=c=0x2F5D50:size=1280x720:rate=30:duration=2',
    '-filter_complex', '[0:v][1:v]concat=n=2:v=1:a=0[v]', '-map', '[v]', '-c:v', 'libx264', '-preset', 'veryfast', '-pix_fmt', 'yuv420p', join(FIXTURES, 'e2e clip.mp4'));
  ff('-f', 'lavfi', '-i', 'gradients=size=800x600:duration=1', '-frames:v', '1', join(FIXTURES, 'e2e still.png'));
});

test.afterAll(() => {
  // Requests created by these tests.
  for (const name of readdirSync(REQUESTS_DIR)) {
    const path = join(REQUESTS_DIR, name);
    if (readFileSync(path, 'utf8').includes(TAG)) rmSync(path);
  }
  // Media created by these tests (ids start with the slug of the fixture names).
  for (const dir of [RAW_DIR, PROXY_DIR, ANALYSIS_DIR]) {
    for (const name of readdirSync(dir)) if (name.startsWith('e2e-')) rmSync(join(dir, name), { recursive: true, force: true });
  }
  writeManifest();
});

/** Seeks by clicking the timeline at a frame. */
async function seek(page: Page, frame: number) {
  const track = page.locator('.track');
  const box = (await track.boundingBox())!;
  const total = 267; // from project/timeline.json: 90 + 120 + 90 - 15 - 18
  await page.mouse.click(box.x + (frame / (total - 1)) * box.width, box.y + 8);
}

test('editor loads with player, timeline and sidebar', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('.brand')).toHaveText(/Easy Video/);
  await expect(page.locator('.scene-block')).toHaveCount(3);
  await expect(page.locator('.stage [data-layer]').first()).toBeAttached();
  await expect(page.locator('.pill')).toBeVisible();
  await shot(page, '01-loaded');
});

test('clicking the headline pins it and identifies the layer', async ({ page }) => {
  await page.goto('/');
  await seek(page, 60);
  await expect(page.locator('.timecode')).toContainText('00:02.00');
  const headline = (await page.locator('[data-layer="S01.headline"]').boundingBox())!;
  await page.mouse.click(headline.x + headline.width / 2, headline.y + headline.height / 2);
  await expect(page.locator('.pin')).toBeVisible();
  await expect(page.locator('.chip.on')).toHaveText('S01.headline');
  await expect(page.locator('.context-line')).toContainText('frame 60');
  await expect(page.locator('.context-line')).toContainText('S01 Intro');
  await shot(page, '02-pinned');
});

test('dragging marks a region covering several layers', async ({ page }) => {
  await page.goto('/');
  await seek(page, 60);
  const stage = (await page.locator('.stage').boundingBox())!;
  await page.mouse.move(stage.x + stage.width * 0.15, stage.y + stage.height * 0.25);
  await page.mouse.down();
  await page.mouse.move(stage.x + stage.width * 0.85, stage.y + stage.height * 0.75, { steps: 8 });
  await page.mouse.up();
  await expect(page.locator('.region')).toBeVisible();
  await expect(page.locator('.context-line')).toContainText('Region');
  const chips = await page.locator('.chip').allTextContents();
  expect(chips).toEqual(expect.arrayContaining(['S01.headline', 'S01.underline']));
  await shot(page, '03-region');
});

test('sending a request queues it, shows a marker, and can be cancelled', async ({ page }) => {
  await page.goto('/');
  await seek(page, 60);
  const headline = (await page.locator('[data-layer="S01.headline"]').boundingBox())!;
  await page.mouse.click(headline.x + headline.width / 2, headline.y + headline.height / 2);
  await page.locator('.composer textarea').fill(`${TAG} make the headline bigger`);
  await page.keyboard.press('Enter');

  const item = page.locator('.request', { hasText: TAG }).first();
  await expect(item).toBeVisible();
  await expect(item.locator('.badge')).toHaveText('Queued');
  await expect(page.locator('.marker.pending')).toHaveCount(1);
  await expect(page.locator('.pin')).toHaveCount(0); // selection clears after sending
  await shot(page, '04-queued');

  await item.getByRole('button', { name: 'Cancel' }).click();
  await expect(item.locator('.badge')).toHaveText('Failed');
  await expect(item.locator('.request-result')).toHaveText('Cancelled');
});

test('Space plays, arrow keys step frames, Escape clears the pin', async ({ page }) => {
  await page.goto('/');
  await seek(page, 30);
  await page.keyboard.press('ArrowRight');
  await expect(page.locator('.controls .small')).toHaveText('frame 31');
  await page.keyboard.press('Shift+ArrowLeft');
  await expect(page.locator('.controls .small')).toHaveText('frame 21');
  await page.keyboard.press('Space');
  await expect(page.locator('.icon-btn.play')).toHaveText('❚❚');
  await page.keyboard.press('Space');
  await expect(page.locator('.icon-btn.play')).toHaveText('▶');
  const stage = (await page.locator('.stage').boundingBox())!;
  await page.mouse.click(stage.x + 40, stage.y + 40);
  await expect(page.locator('.pin')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.locator('.pin')).toHaveCount(0);
});

test('uploading a video through the Media tab analyzes it', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('tab', { name: /Media/ }).click();
  await page.locator('.media-panel input[type=file]').setInputFiles(join(FIXTURES, 'e2e clip.mp4'));

  const item = page.locator('.media-item', { hasText: 'e2e clip.mp4' });
  await expect(item).toBeVisible();
  await expect(item.locator('.media-status')).toHaveText(/^Ready/, { timeout: 30_000 });
  await expect(item).toContainText('2 shots');
  await expect(item).toContainText('1280×720');
  // Poster thumbnail actually loads.
  await expect.poll(() => item.locator('.thumb img').evaluate((img: HTMLImageElement) => img.naturalWidth)).toBeGreaterThan(0);

  await item.locator('.media-main').click();
  await expect.poll(() => item.locator('img.sheet').evaluate((img: HTMLImageElement) => img.naturalWidth)).toBeGreaterThan(0);
  await expect(item.locator('.media-id code')).toHaveText(/^e2e-clip-[0-9a-f]{8}$/);
  await shot(page, '05-media');
});

test('dropping a file anywhere in the window uploads it', async ({ page }) => {
  await page.goto('/');
  const bytes = readFileSync(join(FIXTURES, 'e2e still.png')).toString('base64');
  // Build a real DataTransfer with a File, as the OS does for a drag from Finder.
  const dt = await page.evaluateHandle((b64) => {
    const data = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
    const transfer = new DataTransfer();
    transfer.items.add(new File([data], 'e2e still.png', { type: 'image/png' }));
    return transfer;
  }, bytes);

  await page.dispatchEvent('.stage', 'dragenter', { dataTransfer: dt });
  await expect(page.locator('.drop-overlay')).toBeVisible();
  await shot(page, '06-drop-overlay');
  await page.dispatchEvent('.stage', 'drop', { dataTransfer: dt });
  await expect(page.locator('.drop-overlay')).toHaveCount(0);

  await page.getByRole('tab', { name: /Media/ }).click();
  const item = page.locator('.media-item', { hasText: 'e2e still.png' });
  await expect(item.locator('.media-status')).toHaveText(/^Ready/, { timeout: 30_000 });
  await expect(item).toContainText('800×600');
});

test('Shift+drag on the timeline selects a range that a request can target', async ({ page }) => {
  await page.goto('/');
  const track = (await page.locator('.track').boundingBox())!;
  await page.keyboard.down('Shift');
  // 45%–70% of the timeline lies inside S02 (frames 75–194 of 267).
  await page.mouse.move(track.x + track.width * 0.45, track.y + 10);
  await page.mouse.down();
  await page.mouse.move(track.x + track.width * 0.7, track.y + 10, { steps: 6 });
  await page.mouse.up();
  await page.keyboard.up('Shift');
  await expect(page.locator('.range-sel')).toBeVisible();
  await expect(page.locator('.segmented button.on')).toHaveText('Range');
  // Move the playhead elsewhere: the request must still describe the range, not the playhead.
  await page.mouse.click(track.x + track.width * 0.05, track.y + 10);
  await expect(page.locator('.range-sel')).toBeVisible();
  await expect(page.locator('.composer-context')).toContainText('Range 00:04');

  await page.locator('.composer textarea').fill(`${TAG} speed this part up`);
  await page.keyboard.press('Enter');
  const item = page.locator('.request', { hasText: TAG }).first();
  await expect(item).toBeVisible();
  const saved = readdirSync(REQUESTS_DIR).map((f) => JSON.parse(readFileSync(join(REQUESTS_DIR, f), 'utf8'))).find((r) => r.prompt.includes('speed this part up'));
  expect(saved.scope).toBe('range');
  expect(saved.range.end).toBeGreaterThan(saved.range.start + 30);
  expect(saved.frame).toBe(saved.range.start);
  expect(saved.sceneId).toBe('S02'); // the range's scene, not the playhead's (S01)
  await expect(page.locator('.range-sel')).toHaveCount(0); // cleared after sending
  await item.getByRole('button', { name: 'Cancel' }).click();
});
