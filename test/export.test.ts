import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, describe, it } from 'node:test';
import { normalizeLoudness } from '../server/exporter.ts';
import { FFMPEG } from '../server/media/ffmpeg.ts';
import { probe } from '../server/media/probe.ts';

const dir = mkdtempSync(join(tmpdir(), 'ev-export-'));
after(() => rmSync(dir, { recursive: true, force: true }));

describe('normalizeLoudness', () => {
  it('brings a quiet mix to -14 LUFS and leaves the video stream intact', async () => {
    const input = join(dir, 'quiet.mp4');
    // ~-32 LUFS: a soft tone over a test pattern.
    execFileSync(FFMPEG, ['-v', 'error', '-y', '-f', 'lavfi', '-i', 'testsrc2=size=640x360:rate=30:duration=6', '-f', 'lavfi', '-i', 'sine=frequency=440:duration=6',
      '-af', 'volume=0.02', '-c:v', 'libx264', '-preset', 'veryfast', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-shortest', input]);
    const output = join(dir, 'loud.mp4');
    const { before, after } = await normalizeLoudness(input, output);
    assert.ok(before < -25, `fixture should start quiet, was ${before}`);
    assert.ok(Math.abs(after - -14) <= 1, `expected -14 ± 1 LUFS, got ${after}`);
    const out = await probe(output);
    assert.equal(out.width, 640);
    assert.ok(out.hasAudio);
    assert.ok(Math.abs((out.duration ?? 0) - 6) < 0.2);
  });
});
