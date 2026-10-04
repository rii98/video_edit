import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { analyzeBeats, fft, SAMPLE_RATE } from '../server/media/beats.ts';
import { kindOf, parseProbe } from '../server/media/probe.ts';

/** Synthetic drum loop: a hi-hat click on every beat, a low kick on beat 1 of each bar. */
function drumLoop({ bpm, seconds, offset = 0, gain = (_t: number) => 1 }: { bpm: number; seconds: number; offset?: number; gain?: (t: number) => number }) {
  const pcm = new Float32Array(Math.round(seconds * SAMPLE_RATE));
  const beat = 60 / bpm;
  for (let b = 0; offset + b * beat < seconds; b++) {
    const start = Math.round((offset + b * beat) * SAMPLE_RATE);
    const g = gain(offset + b * beat);
    for (let i = 0; i < 0.03 * SAMPLE_RATE && start + i < pcm.length; i++) {
      const t = i / SAMPLE_RATE;
      pcm[start + i]! += g * 0.4 * Math.sin(2 * Math.PI * 3000 * t) * Math.exp(-t * 150);
    }
    if (b % 4 === 0) {
      for (let i = 0; i < 0.15 * SAMPLE_RATE && start + i < pcm.length; i++) {
        const t = i / SAMPLE_RATE;
        pcm[start + i]! += g * 0.9 * Math.sin(2 * Math.PI * 55 * t) * Math.exp(-t * 25);
      }
    }
  }
  return pcm;
}

const near = (actual: number, expected: number, tolerance: number, what: string) =>
  assert.ok(Math.abs(actual - expected) <= tolerance, `${what}: expected ${expected} ± ${tolerance}, got ${actual}`);

describe('fft', () => {
  it('puts a pure tone in the right bin', () => {
    const n = 64;
    const re = Float64Array.from({ length: n }, (_, i) => Math.cos((2 * Math.PI * 5 * i) / n));
    const im = new Float64Array(n);
    fft(re, im);
    const mags = Array.from(re, (r, i) => Math.hypot(r, im[i]!));
    assert.equal(mags.indexOf(Math.max(...mags.slice(0, n / 2))), 5);
  });
});

describe('analyzeBeats', () => {
  it('finds 120 BPM, beat positions and downbeats', () => {
    const offset = 0.25;
    const result = analyzeBeats(drumLoop({ bpm: 120, seconds: 30, offset }));
    near(result.bpm, 120, 0.3, 'bpm');
    assert.ok(result.confidence > 0.3, `confidence ${result.confidence}`);
    near(result.beats[0]!, offset, 0.05, 'first beat');
    near(result.beats.length, 60, 2, 'beat count');
    for (const d of result.downbeats.slice(0, 5)) {
      const barPos = (d - offset) / 2; // a 4/4 bar at 120 BPM is 2 s
      near(barPos, Math.round(barPos), 0.03, `downbeat ${d}s on a bar line`);
    }
  });

  it('measures tempo precisely and catches a hit on the very first sample', () => {
    for (const bpm of [124, 128, 97]) {
      const result = analyzeBeats(drumLoop({ bpm, seconds: 30 }));
      near(result.bpm, bpm, 0.3, `bpm ${bpm}`);
      near(result.beats[0]!, 0, 0.03, `first beat at ${bpm} BPM`);
      near(result.downbeats[0]!, 0, 0.03, `first downbeat at ${bpm} BPM`);
    }
  });

  it('marks unstructured noise as low confidence', () => {
    let seed = 7;
    const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647) * 2 - 1;
    const noise = Float32Array.from({ length: 20 * SAMPLE_RATE }, rand);
    const music = analyzeBeats(drumLoop({ bpm: 120, seconds: 20 }));
    assert.ok(analyzeBeats(noise).confidence < music.confidence / 2, 'noise should be far less periodic than music');
  });

  it('finds an energy section change on a bar line', () => {
    const result = analyzeBeats(drumLoop({ bpm: 120, seconds: 40, gain: (t) => (t < 16 ? 0.15 : 1) }));
    const lift = result.sections.find((s) => s.start > 8);
    assert.ok(lift, `expected a section boundary, got ${JSON.stringify(result.sections)}`);
    near(lift.start, 16, 0.1, 'section start');
    assert.equal(lift.energy, 'high');
  });
});

describe('parseProbe', () => {
  it('reads a phone video with rotation', () => {
    const r = parseProbe(`Input #0, mov,mp4, from 'a.mov':
  Duration: 00:01:02.50, start: 0.000000, bitrate: 9000 kb/s
  Stream #0:0[0x1](und): Video: hevc (Main) (hvc1 / 0x31637668), yuv420p(tv), 1920x1080, 8000 kb/s, 29.97 fps, 29.97 tbr, 600 tbn (default)
      Side data:
        displaymatrix: rotation of -90.00 degrees
  Stream #0:1[0x2](und): Audio: aac (LC) (mp4a / 0x6134706D), 44100 Hz, stereo, fltp, 192 kb/s (default)`);
    assert.deepEqual(r, { duration: 62.5, width: 1080, height: 1920, fps: 29.97, hasAudio: true, hasVideo: true });
  });

  it('ignores cover art in audio files', () => {
    const r = parseProbe(`  Duration: 00:03:00.00, start: 0.025057, bitrate: 320 kb/s
  Stream #0:0: Audio: mp3, 44100 Hz, stereo, fltp, 320 kb/s
  Stream #0:1: Video: mjpeg (Baseline), yuvj420p(pc), 600x600, 90k tbr, 90k tbn (attached pic)`);
    assert.equal(r.hasVideo, false);
    assert.equal(r.width, undefined);
    assert.equal(r.duration, 180);
  });

  it('reads an image', () => {
    const r = parseProbe(`  Duration: N/A, bitrate: N/A
  Stream #0:0: Video: png, rgba(pc), 2400x1600, 25 tbr, 25 tbn`);
    assert.deepEqual(r, { width: 2400, height: 1600, fps: 25, hasAudio: false, hasVideo: true });
  });
});

describe('kindOf', () => {
  it('classifies by extension, case-insensitively', () => {
    assert.equal(kindOf('Clip.MOV'), 'video');
    assert.equal(kindOf('logo.png'), 'image');
    assert.equal(kindOf('song.mp3'), 'audio');
    assert.equal(kindOf('notes.txt'), null);
  });
});
