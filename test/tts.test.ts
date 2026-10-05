import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { describe, it } from 'node:test';
import { cacheKey, GEMINI_VOICES, pacificDay, parseSegments, plainText, spokenWords, throttleDelay } from '../server/media/tts.ts';

describe('tts segments', () => {
  it('splits [[style]] markers into styled segments', () => {
    assert.deepEqual(parseSegments('[[deep, ominous]] In a world… [[hushed]] No templates.'), [
      { text: 'In a world…', style: 'deep, ominous' },
      { text: 'No templates.', style: 'hushed' },
    ]);
  });

  it('applies --style to unmarked text and keeps plain text as one segment', () => {
    assert.deepEqual(parseSegments('Hello there.', 'warm'), [{ text: 'Hello there.', style: 'warm' }]);
    assert.deepEqual(parseSegments('Hello there.'), [{ text: 'Hello there.' }]);
    assert.deepEqual(parseSegments('Intro. [[fast]] Then this.'), [{ text: 'Intro.' }, { text: 'Then this.', style: 'fast' }]);
  });

  it('strips vocal tags for Deepgram and word counts', () => {
    const segs = parseSegments('No templates. <short pause> No shortcuts. [[warm]] <chuckle> Just magic.');
    assert.equal(plainText(segs), 'No templates. No shortcuts. Just magic.');
    assert.equal(spokenWords(segs), 6);
  });
});

describe('tts request discipline', () => {
  it('throttles only once the per-minute window is full', () => {
    const now = 1_000_000;
    assert.equal(throttleDelay([now - 10_000, now - 5_000], 3, now), 0);
    const full = [now - 50_000, now - 20_000, now - 1_000];
    const wait = throttleDelay(full, 3, now);
    assert.ok(wait > 9_000 && wait < 11_000, `waits until the oldest request leaves the window (${wait})`);
    assert.equal(throttleDelay([now - 70_000, now - 65_000, now - 61_000], 3, now), 0, 'old requests do not count');
  });

  it('resets the day at midnight Pacific, not local or UTC midnight', () => {
    assert.equal(pacificDay(new Date('2026-10-05T06:59:00Z')), '2026-10-04');
    assert.equal(pacificDay(new Date('2026-10-05T07:01:00Z')), '2026-10-05');
  });

  it('keeps old Deepgram cache keys valid and separates providers and styles', () => {
    const old = createHash('sha1').update('aura-2-thalia-en\nHello there.').digest('hex');
    assert.equal(cacheKey('deepgram', 'aura-2-thalia-en', [{ text: 'Hello there.' }]), old);
    const a = cacheKey('gemini', 'Charon', [{ text: 'Hello there.', style: 'warm' }]);
    assert.notEqual(a, cacheKey('gemini', 'Charon', [{ text: 'Hello there.', style: 'brisk' }]));
    assert.notEqual(a, cacheKey('gemini', 'Kore', [{ text: 'Hello there.', style: 'warm' }]));
  });

  it('casts from all 30 Gemini voices, split by gender', () => {
    const voices = Object.values(GEMINI_VOICES);
    assert.equal(voices.length, 30);
    assert.equal(voices.filter((v) => v.gender === 'female').length, 14);
    assert.equal(voices.filter((v) => v.gender === 'male').length, 16);
  });
});
