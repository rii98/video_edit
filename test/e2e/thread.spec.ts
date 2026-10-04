// Request threads: the test plays Claude through the real `ev` CLI while the browser plays
// the user: ask with alternatives → pick → done with an assumption → "why?" → explanation.
// No version is created (no files change); everything is removed afterwards.
import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test } from '@playwright/test';
import { FFMPEG } from '../../server/media/ffmpeg.ts';
import { REQUESTS_DIR, ROOT, SNAPSHOTS_DIR, writeAgentStatus } from '../../server/store.ts';

const TAG = '[e2e-thread]';
const ev = (...args: string[]) => execFileSync('node', ['--no-warnings', 'scripts/ev.ts', ...args], { cwd: ROOT, encoding: 'utf8' });
const altA = join(SNAPSHOTS_DIR, 'e2e-alt-a.png');
const altB = join(SNAPSHOTS_DIR, 'e2e-alt-b.png');

test.describe.configure({ mode: 'serial' });
test.afterAll(() => {
  for (const name of readdirSync(REQUESTS_DIR)) {
    const path = join(REQUESTS_DIR, name);
    if (!readFileSync(path, 'utf8').includes(TAG)) continue;
    const id = Number(name.replace('.json', ''));
    rmSync(path);
    for (const f of readdirSync(SNAPSHOTS_DIR)) if (f.startsWith(`thread-${id}-`)) rmSync(join(SNAPSHOTS_DIR, f));
  }
  for (const f of [altA, altB]) rmSync(f, { force: true });
  writeAgentStatus({ state: 'offline', message: '', requestId: null });
});

test('a request becomes a conversation: question with alternatives, pick, assumption, follow-up', async ({ page }) => {
  test.setTimeout(90_000);
  execFileSync(FFMPEG, ['-v', 'error', '-y', '-f', 'lavfi', '-i', 'color=c=0xD9653B:size=320x180', '-frames:v', '1', altA]);
  execFileSync(FFMPEG, ['-v', 'error', '-y', '-f', 'lavfi', '-i', 'color=c=0x2F5D50:size=320x180', '-frames:v', '1', altB]);

  // The user sends a vague request.
  await page.goto('/');
  await page.locator('.composer textarea').fill(`${TAG} make this pop`);
  await page.keyboard.press('Enter');
  const item = page.locator('.request', { hasText: TAG }).first();
  await expect(item.locator('.badge')).toHaveText('Queued');

  // Claude picks it up and, unsure, asks with two rendered alternatives.
  const briefing = ev('wait', '--timeout=20');
  const id = briefing.match(/^#(\d+)/m)![1]!;
  expect(briefing).toContain('make this pop');
  ev('ask', id, 'Which kind of pop?', `--images=${altA},${altB}`, '--labels=Warmer|Cooler');

  // The question surfaces in the browser, expanded, with clickable alternatives.
  await expect(item.locator('.badge')).toHaveText('Needs you');
  await expect(page.locator('.agent-card')).toContainText(`Claude asked a question on #${id}`);
  await expect(page.locator('.tabs .dot')).toBeVisible();
  await expect(item.locator('.msg.question')).toContainText('Which kind of pop?');
  const cooler = item.getByRole('button', { name: 'Cooler' });
  await expect(cooler.locator('img')).toHaveJSProperty('complete', true);
  await page.screenshot({ path: 'test-results/screens/13-thread-question.png' });
  await cooler.click();
  await expect(item.locator('.badge')).toHaveText('Queued');
  await expect(item.locator('.msg.user').last()).toHaveText('Cooler');

  // Claude gets the answer in the briefing, edits, and records what it had to assume.
  const followUp = ev('wait', '--timeout=20');
  expect(followUp).toContain('USER [reply] Cooler');
  expect(followUp).toContain('The user replied');
  ev('done', id, 'Shifted the scene to the cooler palette', '--assumed=you meant the whole scene, not just the headline');
  await expect(item.locator('.badge')).toHaveText('Done');
  await expect(item.locator('.assumed')).toContainText('you meant the whole scene');
  await expect(item.locator('.choice-image.chosen')).toHaveText('Cooler'); // the pick stays visible

  // The user asks why; Claude answers without editing.
  await item.locator('.reply textarea').fill('why the whole scene?');
  await item.locator('.reply textarea').press('Enter');
  await expect(item.locator('.badge')).toHaveText('Queued');
  const why = ev('wait', '--timeout=20');
  expect(why).toContain('why the whole scene?');
  ev('reply', id, 'Your pin was on the background, so the whole scene was the target.');
  await expect(item.locator('.msg.claude.note').last()).toContainText('Your pin was on the background');
  await expect(item.locator('.badge')).toHaveText('Done');
  await page.screenshot({ path: 'test-results/screens/14-thread-done.png' });
  // Thread order is preserved end to end.
  const kinds = JSON.parse(readFileSync(join(REQUESTS_DIR, `${id.padStart(4, '0')}.json`), 'utf8')).thread.map((m: { from: string; kind: string }) => `${m.from}:${m.kind}`);
  expect(kinds).toEqual(['claude:question', 'user:reply', 'claude:done', 'user:reply', 'claude:note']);
});

test('“Wrong guess? Undo” calls undo for that request (API intercepted: no real version)', async ({ page }) => {
  // A finished request whose edit was a guess, written directly as the CLI would.
  const ids = readdirSync(REQUESTS_DIR).map((f) => Number(f.replace('.json', ''))).filter(Number.isFinite);
  const id = Math.max(0, ...ids) + 1;
  const now = new Date().toISOString();
  const path = join(REQUESTS_DIR, `${String(id).padStart(4, '0')}.json`);
  writeFileSync(path, JSON.stringify({
    id, createdAt: now, updatedAt: now, queuedAt: now, status: 'done', prompt: `${TAG} bigger`, scope: 'video', frame: 0, sceneId: null, pin: null, region: null, layers: [],
    result: 'Made the headline bigger', commit: 'abc1234',
    thread: [{ from: 'claude', kind: 'done', text: 'Made the headline bigger', at: now, commit: 'abc1234', assumed: 'you meant the headline, not the subtitle' }],
  }));
  let undoCalled = false;
  await page.route(`**/api/requests/${id}/undo`, (route) => {
    undoCalled = true;
    return route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
  });
  await page.goto('/');
  const item = page.locator(`[data-request="${id}"]`);
  await expect(item.locator('.assumed')).toContainText('not the subtitle');
  await item.getByRole('button', { name: 'Wrong guess? Undo' }).click();
  await expect.poll(() => undoCalled).toBe(true);
  expect(existsSync(path)).toBe(true);
});
