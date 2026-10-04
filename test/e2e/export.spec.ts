// Export from the editor: start a draft, watch progress, download, remove.
import { expect, test } from '@playwright/test';

test('a draft export renders, downloads as MP4, and can be removed', async ({ page, request }) => {
  test.setTimeout(180_000);
  await page.goto('/');
  await page.getByRole('button', { name: 'Export', exact: true }).click();
  await page.getByRole('menuitem', { name: /Draft/ }).click();

  const job = page.locator('.export-job').first();
  await expect(job).toBeVisible();
  const download = job.getByRole('link', { name: 'Download' });
  await expect(download).toBeVisible({ timeout: 150_000 });
  await page.screenshot({ path: 'test-results/screens/10-export.png' });

  const href = (await download.getAttribute('href'))!;
  const res = await request.get(href);
  expect(res.status()).toBe(200);
  expect(res.headers()['content-type']).toBe('video/mp4');
  const body = await res.body();
  expect(body.subarray(4, 8).toString()).toBe('ftyp'); // a real MP4 container
  expect(body.length).toBeGreaterThan(20_000);

  await job.getByRole('button', { name: 'Remove' }).click();
  await expect(page.locator('.export-job')).toHaveCount(0);
  expect((await request.get(href)).status()).toBe(404);
});
