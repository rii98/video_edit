// Sound effects synthesized from scratch: filtered noise, swept oscillators and envelopes.
// No sample packs or licenses needed, deterministic for a given seed, and tuned for motion
// graphics: whooshes for transitions, risers into reveals, hits on landings, UI clicks.

export const SFX_RATE = 48_000;

export const SFX_KINDS = {
  whoosh: { seconds: 0.7, use: 'Transitions, fast moves, whip pans' },
  riser: { seconds: 1.6, use: 'Build-up into a reveal (end it on the hit)' },
  hit: { seconds: 1.2, use: 'Logo/title landing, big cut on a downbeat' },
  click: { seconds: 0.06, use: 'UI taps, cursor clicks in screen demos' },
  pop: { seconds: 0.2, use: 'Badges, icons and text popping in' },
  shimmer: { seconds: 1.4, use: 'Magical/premium reveal sparkle' },
} as const;

export type SfxKind = keyof typeof SFX_KINDS;

/** Small deterministic PRNG (mulberry32): same seed, same sound. */
function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** RBJ-cookbook band-pass biquad whose centre frequency can move every sample. */
function sweptBandpass(input: Float32Array, freqAt: (t: number) => number, q: number): Float32Array {
  const out = new Float32Array(input.length);
  let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
  for (let i = 0; i < input.length; i++) {
    const w0 = (2 * Math.PI * Math.min(freqAt(i / SFX_RATE), SFX_RATE * 0.45)) / SFX_RATE;
    const alpha = Math.sin(w0) / (2 * q);
    const a0 = 1 + alpha;
    const b0 = alpha / a0, b2 = -alpha / a0, a1 = (-2 * Math.cos(w0)) / a0, a2 = (1 - alpha) / a0;
    const x = input[i]!;
    const y = b0 * x + b2 * x2 - a1 * y1 - a2 * y2;
    x2 = x1; x1 = x; y2 = y1; y1 = y;
    out[i] = y;
  }
  return out;
}

/**
 * Edge fades (so nothing clicks), then peak-normalizes to -1 dBFS. The fade-in is only
 * 0.5 ms: a longer one would flatten the attack of percussive sounds, which *is* the sound.
 */
function finish(buf: Float32Array): Float32Array {
  const fadeIn = Math.round(0.0005 * SFX_RATE);
  const fadeOut = Math.round(0.004 * SFX_RATE);
  let peak = 0;
  for (let i = 0; i < buf.length; i++) {
    buf[i] = buf[i]! * Math.min(1, i / fadeIn, (buf.length - 1 - i) / fadeOut);
    peak = Math.max(peak, Math.abs(buf[i]!));
  }
  const gain = peak > 0 ? 0.891 / peak : 0;
  for (let i = 0; i < buf.length; i++) buf[i] = buf[i]! * gain;
  return buf;
}

export function synthesize(kind: SfxKind, { seconds = SFX_KINDS[kind].seconds, seed = 1 }: { seconds?: number; seed?: number } = {}): Float32Array {
  const n = Math.round(seconds * SFX_RATE);
  const rand = rng(seed);
  const noise = () => Float32Array.from({ length: n }, () => rand() * 2 - 1);
  const out = new Float32Array(n);
  const T = (i: number) => i / SFX_RATE;

  switch (kind) {
    case 'whoosh': {
      // Air rushing past: band-passed noise sweeping up then down, loudest just past the middle.
      const band = sweptBandpass(noise(), (t) => { const p = t / seconds; return 350 + 3200 * Math.sin(Math.PI * Math.min(1, p * 1.1)) ** 2; }, 1.4);
      for (let i = 0; i < n; i++) { const p = i / n; out[i] = band[i]! * Math.sin(Math.PI * p) ** 2.2 * (0.6 + 0.4 * p); }
      break;
    }
    case 'riser': {
      // Tension: noise and a detuned tone pair sweep up exponentially as they crescendo.
      const f = (t: number) => 180 * Math.pow(30, t / seconds);
      const band = sweptBandpass(noise(), (t) => 300 * Math.pow(20, t / seconds), 2.2);
      let phase1 = 0, phase2 = 0;
      for (let i = 0; i < n; i++) {
        const t = T(i), p = t / seconds;
        phase1 += (2 * Math.PI * f(t)) / SFX_RATE;
        phase2 += (2 * Math.PI * f(t) * 1.012) / SFX_RATE;
        const tone = 0.5 * (Math.sin(phase1) + Math.sin(phase2)) * (1 + 0.2 * Math.sin(2 * Math.PI * 7 * t));
        out[i] = (0.55 * band[i]! + 0.45 * tone) * p ** 2.4;
      }
      break;
    }
    case 'hit': {
      // Impact: sub "boom" with a fast pitch drop, a noisy transient, gentle saturation.
      let phase = 0;
      const crack = sweptBandpass(noise(), () => 1800, 0.7);
      for (let i = 0; i < n; i++) {
        const t = T(i);
        phase += (2 * Math.PI * (42 + 90 * Math.exp(-t / 0.06))) / SFX_RATE;
        const boom = Math.sin(phase) * Math.exp(-t / 0.38);
        const transient = crack[i]! * Math.exp(-t / 0.025);
        out[i] = Math.tanh(1.6 * (0.9 * boom + 0.6 * transient));
      }
      break;
    }
    case 'click': {
      // Crisp UI tick: a 2.4 kHz blip plus a tiny high-passed noise burst.
      const hp = sweptBandpass(noise(), () => 6000, 0.9);
      for (let i = 0; i < n; i++) { const t = T(i); out[i] = Math.sin(2 * Math.PI * 2400 * t) * Math.exp(-t / 0.006) + 0.5 * hp[i]! * Math.exp(-t / 0.002); }
      break;
    }
    case 'pop': {
      // Bubble pop: a sine gliding down from 900 to 350 Hz with a fast decay.
      let phase = 0;
      for (let i = 0; i < n; i++) { const t = T(i); phase += (2 * Math.PI * (350 + 550 * Math.exp(-t / 0.018))) / SFX_RATE; out[i] = Math.sin(phase) * Math.exp(-t / 0.045); }
      break;
    }
    case 'shimmer': {
      // Sparkle: a C-major arpeggio of bright partials, each ringing out, with a soft tremolo.
      const notes = [2093, 2637, 3136, 4186];
      for (let i = 0; i < n; i++) {
        const t = T(i);
        let v = 0;
        notes.forEach((f, k) => { const start = k * 0.07; if (t >= start) v += Math.sin(2 * Math.PI * f * (t - start)) * Math.exp(-(t - start) / 0.45); });
        out[i] = v * (0.8 + 0.2 * Math.sin(2 * Math.PI * 11 * t));
      }
      break;
    }
  }
  return finish(out);
}

/** 16-bit PCM mono WAV. */
export function toWav(samples: Float32Array, rate = SFX_RATE): Buffer {
  const data = Buffer.alloc(samples.length * 2);
  samples.forEach((v, i) => data.writeInt16LE(Math.round(Math.max(-1, Math.min(1, v)) * 32767), i * 2));
  const header = Buffer.alloc(44);
  header.write('RIFF', 0);
  header.writeUInt32LE(36 + data.length, 4);
  header.write('WAVEfmt ', 8);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20); // PCM
  header.writeUInt16LE(1, 22); // mono
  header.writeUInt32LE(rate, 24);
  header.writeUInt32LE(rate * 2, 28);
  header.writeUInt16LE(2, 32);
  header.writeUInt16LE(16, 34);
  header.write('data', 36);
  header.writeUInt32LE(data.length, 40);
  return Buffer.concat([header, data]);
}
