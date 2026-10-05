import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { describe, it } from 'node:test';
import { parseEnv } from 'node:util';
import { cacheKey, GEMINI_VOICES, keyFingerprint, pacificDay, parseSegments, plainText, resetTime, spokenWords, throttleDelay, unavailableMessage } from '../server/media/tts.ts';

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

  it('tracks keys by a fingerprint that never contains the key', () => {
    const a = keyFingerprint('AIza-first-key-1234567890');
    assert.match(a, /^[0-9a-f]{8}$/);
    assert.notEqual(a, keyFingerprint('AIza-second-key-1234567890'), 'a new key starts a fresh count');
    assert.ok(!'AIza-first-key-1234567890'.includes(a));
  });

  it('stops with key-swap steps instead of falling back to Deepgram', () => {
    const spent = unavailableMessage('the current key has used today\'s budget', true);
    assert.match(spent, /Not falling back to Deepgram/);
    assert.match(spent, /# GEMINI_API_KEY=/);
    assert.match(spent, /--provider=deepgram/);
    assert.match(spent, /reset at/);
    const none = unavailableMessage('there is no GEMINI_API_KEY in .env', false);
    assert.doesNotMatch(none, /Comment out/);
    assert.match(none, /Add a line/);
  });

  it('a commented-out key in .env is ignored, so the new line wins', () => {
    assert.equal(parseEnv('# GEMINI_API_KEY=old\nGEMINI_API_KEY=new\n').GEMINI_API_KEY, 'new');
  });

  it('gives the reset as a local clock time', () => {
    assert.match(resetTime(new Date('2026-10-05T07:12:00Z')), /\d{1,2}:\d{2}/);
  });
});
