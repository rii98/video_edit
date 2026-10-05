import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { buildSearchParams, createFreesound, parseLicense, toHit } from '../server/media/sources/freesound.ts';
import { fetchWithRetry } from '../server/media/sources/http.ts';
import { getSource, SOURCES } from '../server/media/sources/index.ts';
import { planTrim, STOCK_RATE } from '../server/media/stock.ts';

const base = { licenses: ['cc0' as const], sort: 'popular' as const, limit: 10 };

describe('freesound source', () => {
  it('normalizes licence URLs and names', () => {
    assert.equal(parseLicense('http://creativecommons.org/publicdomain/zero/1.0/'), 'cc0');
    assert.equal(parseLicense('https://creativecommons.org/licenses/by/4.0/'), 'by');
    assert.equal(parseLicense('http://creativecommons.org/licenses/by/3.0/'), 'by');
    assert.equal(parseLicense('http://creativecommons.org/licenses/by-nc/3.0/'), 'by-nc');
    assert.equal(parseLicense('http://creativecommons.org/licenses/sampling+/1.0/'), 'sampling+');
    assert.equal(parseLicense('Attribution NonCommercial'), 'by-nc');
    assert.equal(parseLicense('something else'), 'other');
  });

  it('builds search params: licence and duration filters, sort, limit', () => {
    const p = buildSearchParams({ ...base, query: ' door slam ', minSeconds: 0.3, maxSeconds: 2, licenses: ['cc0', 'by'], limit: 500 });
    assert.equal(p.get('query'), 'door slam');
    assert.equal(p.get('filter'), 'license:("Creative Commons 0" OR "Attribution") duration:[0.3 TO 2]');
    assert.equal(p.get('sort'), 'downloads_desc');
    assert.equal(p.get('page_size'), '150');
    assert.equal(buildSearchParams({ ...base, maxSeconds: 1 }).get('filter'), 'license:("Creative Commons 0") duration:[* TO 1]');
    assert.equal(buildSearchParams({ ...base, sort: 'relevant' }).get('sort'), null);
  });

  it('similarity search uses CLAP and ignores sort; ids are validated', () => {
    const p = buildSearchParams({ ...base, similarTo: '60013' });
    assert.equal(p.get('similar_to'), '60013');
    assert.equal(p.get('similarity_space'), 'laion_clap');
    assert.equal(p.get('sort'), null);
    assert.throws(() => buildSearchParams({ ...base, similarTo: '../etc' }), /not a Freesound sound id/);
    assert.throws(() => buildSearchParams({ ...base, licenses: ['other'] }), /can filter on/);
  });

  it('maps API results to hits', () => {
    const hit = toHit({ id: 60013, name: 'Whoosh', duration: 0.43, channels: 2, license: 'http://creativecommons.org/publicdomain/zero/1.0/', username: 'qubodup', url: 'https://freesound.org/people/qubodup/sounds/60013/', avg_rating: 4.4, num_ratings: 1639, num_downloads: 209032 });
    assert.deepEqual(
      { id: hit.id, title: hit.title, license: hit.license, author: hit.author, downloads: hit.downloads },
      { id: '60013', title: 'Whoosh', license: 'cc0', author: 'qubodup', downloads: 209032 },
    );
  });

  it('never sends the API key to the preview CDN', async () => {
    const prev = process.env.FREESOUND_API_KEY;
    process.env.FREESOUND_API_KEY = 'test-key';
    const seen: { url: string; auth: string | null }[] = [];
    const fake = async (url: string, init?: RequestInit) => {
      seen.push({ url, auth: new Headers(init?.headers).get('authorization') });
      if (url.includes('/apiv2/sounds/'))
        return Response.json({ id: 1, name: 'x', duration: 1, license: 'http://creativecommons.org/publicdomain/zero/1.0/', username: 'u', url: 'https://freesound.org/s/1/', previews: { 'preview-hq-mp3': 'https://cdn.freesound.org/previews/1.mp3' } });
      return new Response(new Uint8Array(1000));
    };
    try {
      const { mkdtempSync, rmSync } = await import('node:fs');
      const { join } = await import('node:path');
      const { tmpdir } = await import('node:os');
      const dir = mkdtempSync(join(tmpdir(), 'ev-stock-'));
      await createFreesound(fake).download('1', join(dir, 'a.mp3'));
      rmSync(dir, { recursive: true, force: true });
    } finally {
      if (prev === undefined) delete process.env.FREESOUND_API_KEY;
      else process.env.FREESOUND_API_KEY = prev;
    }
    assert.equal(seen[0]!.auth, 'Token test-key');
    assert.equal(seen[1]!.url, 'https://cdn.freesound.org/previews/1.mp3');
    assert.equal(seen[1]!.auth, null);
  });

  it('is registered as the default source', () => {
    assert.equal(getSource(), SOURCES.freesound);
    assert.throws(() => getSource('nope'), /unknown sound source/);
  });
});

describe('fetchWithRetry', () => {
  it('retries rate limits and server errors, then succeeds', async () => {
    const statuses = [429, 503, 200];
    let calls = 0;
    const res = await fetchWithRetry('https://x', {}, { baseDelayMs: 1, fetchFn: async () => new Response('', { status: statuses[calls++] }) });
    assert.equal(res.status, 200);
    assert.equal(calls, 3);
  });

  it('does not retry client errors, and gives up after `retries`', async () => {
    let calls = 0;
    assert.equal((await fetchWithRetry('https://x', {}, { baseDelayMs: 1, fetchFn: async () => (calls++, new Response('', { status: 404 })) })).status, 404);
    assert.equal(calls, 1);
    calls = 0;
    await assert.rejects(fetchWithRetry('https://x', {}, { retries: 2, baseDelayMs: 1, fetchFn: async () => (calls++, Promise.reject(new Error('offline'))) }), /offline/);
    assert.equal(calls, 3);
  });
});

describe('planTrim', () => {
  /** 0.2 s of silence, a 2 ms attack to a 0.5 peak at 0.25 s, a decay, then silence. */
  function sound(): Float32Array {
    const env = new Float32Array(STOCK_RATE);
    for (let i = 0; i < env.length; i++) {
      const t = i / STOCK_RATE;
      if (t >= 0.2 && t < 0.25) env[i] = 0.5 * ((t - 0.2) / 0.05);
      else if (t >= 0.25 && t < 0.6) env[i] = 0.5 * Math.exp(-(t - 0.25) / 0.05);
    }
    return env;
  }

  it('cuts dead air to a short pre-roll, finds the peak, normalizes to -1 dBFS', () => {
    const plan = planTrim(sound());
    assert.ok(plan.start > 0.19 && plan.start < 0.21, `start ${plan.start}`);
    assert.ok(plan.end < 0.9, `end ${plan.end}`);
    const peakInFile = plan.start + plan.peakAt;
    assert.ok(Math.abs(peakInFile - 0.245) < 0.01, `peak at ${peakInFile}`);
    assert.ok(Math.abs(plan.gainDb - 20 * Math.log10(0.891 / 0.5)) < 0.02, `gain ${plan.gainDb}`);
  });

  it('keeps the whole sound when trimming is off', () => {
    const plan = planTrim(sound(), STOCK_RATE, { trim: false });
    assert.equal(plan.start, 0);
    assert.equal(plan.end, 1);
    assert.ok(Math.abs(plan.peakAt - 0.245) < 0.01);
  });

  it('rejects silence', () => {
    assert.throws(() => planTrim(new Float32Array(STOCK_RATE)), /silent/);
  });
});
