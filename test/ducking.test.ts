import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { duckGain, speechIntervals } from '../library/components/ducking.ts';

describe('music ducking', () => {
  const words = [
    { s: 1.0, e: 1.3 },
    { s: 1.4, e: 1.8 }, // close: merges with the previous word
    { s: 4.0, e: 4.5 }, // after a real pause: separate interval
  ];
  const intervals = speechIntervals(words);

  it('merges nearby words and pads each phrase', () => {
    assert.equal(intervals.length, 2);
    assert.ok(Math.abs(intervals[0]!.s - 0.88) < 1e-9 && Math.abs(intervals[0]!.e - 1.92) < 1e-9);
  });

  it('ducks during speech, is full in the gaps, and ramps smoothly', () => {
    assert.equal(duckGain(intervals, 1.5), 0.4);
    assert.equal(duckGain(intervals, 3.0), 1);
    const attack = [0.7, 0.78, 0.84, 0.88].map((t) => duckGain(intervals, t));
    for (let i = 1; i < attack.length; i++) assert.ok(attack[i]! <= attack[i - 1]!, `attack not monotonic: ${attack}`);
    assert.equal(attack[0], 1, 'no dip before the attack window');
    const release = [1.92, 2.1, 2.3, 2.45].map((t) => duckGain(intervals, t));
    for (let i = 1; i < release.length; i++) assert.ok(release[i]! >= release[i - 1]!, `release not monotonic: ${release}`);
    assert.ok(release.at(-1)! > 0.95);
  });

  it('dips fast and recovers slowly (attack shorter than release)', () => {
    const halfwayIn = duckGain(intervals, 0.88 - 0.06); // half the attack before speech
    const halfwayOut = duckGain(intervals, 1.92 + 0.06); // same distance after speech
    assert.ok(halfwayOut < halfwayIn, 'should still be ducked shortly after speech ends');
  });

  it('never pumps between words of the same phrase', () => {
    for (let t = 0.9; t <= 1.9; t += 0.02) assert.equal(duckGain(intervals, t), 0.4);
  });
});
