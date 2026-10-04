import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { SFX_KINDS, SFX_RATE, synthesize, toWav, type SfxKind } from '../server/media/sfx.ts';

const rms = (a: Float32Array, from = 0, to = a.length) => {
  let s = 0;
  for (let i = from; i < to; i++) s += a[i]! ** 2;
  return Math.sqrt(s / Math.max(1, to - from));
};
const quarter = (a: Float32Array, q: number) => rms(a, Math.floor((q * a.length) / 4), Math.floor(((q + 1) * a.length) / 4));

describe('synthesized sound effects', () => {
  for (const kind of Object.keys(SFX_KINDS) as SfxKind[]) {
    it(`${kind}: right length, -1 dBFS peak, clean edges, audible`, () => {
      const a = synthesize(kind);
      assert.equal(a.length, Math.round(SFX_KINDS[kind].seconds * SFX_RATE));
      let peak = 0;
      for (const v of a) {
        assert.ok(Number.isFinite(v));
        peak = Math.max(peak, Math.abs(v));
      }
      assert.ok(Math.abs(peak - 0.891) < 0.01, `peak ${peak}`);
      assert.ok(Math.abs(a[0]!) < 1e-3 && Math.abs(a.at(-1)!) < 1e-3, 'edges must be faded');
      assert.ok(rms(a) > 0.02, 'too quiet');
    });
  }

  it('each sound has its characteristic shape over time', () => {
    const riser = synthesize('riser');
    assert.ok(quarter(riser, 3) > quarter(riser, 0) * 4, 'a riser crescendos');
    const hit = synthesize('hit');
    assert.ok(quarter(hit, 0) > quarter(hit, 3) * 4, 'a hit is front-loaded');
    const whoosh = synthesize('whoosh');
    assert.ok(quarter(whoosh, 1) + quarter(whoosh, 2) > (quarter(whoosh, 0) + quarter(whoosh, 3)) * 1.5, 'a whoosh peaks in the middle');
  });

  it('is deterministic per seed, and seeds give variations', () => {
    assert.deepEqual(synthesize('whoosh', { seed: 3 }), synthesize('whoosh', { seed: 3 }));
    assert.notDeepEqual(synthesize('whoosh', { seed: 3 }), synthesize('whoosh', { seed: 4 }));
  });

  it('writes a valid 16-bit mono WAV', () => {
    const wav = toWav(synthesize('pop'));
    assert.equal(wav.toString('ascii', 0, 4), 'RIFF');
    assert.equal(wav.toString('ascii', 8, 12), 'WAVE');
    assert.equal(wav.readUInt32LE(24), SFX_RATE);
    assert.equal(wav.readUInt32LE(40), Math.round(SFX_KINDS.pop.seconds * SFX_RATE) * 2);
  });
});
