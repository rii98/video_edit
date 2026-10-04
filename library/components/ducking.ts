// Music ducking under speech, as pure functions (unit-tested; no React).

export interface Interval {
  s: number;
  e: number;
}

/**
 * Turns word timings into speech intervals: words closer than `gap` seconds merge (so the
 * music doesn't pump between words), and each interval is padded by `pad` on both sides.
 */
export function speechIntervals(words: { s: number; e: number }[], { pad = 0.12, gap = 0.45 } = {}): Interval[] {
  const out: Interval[] = [];
  for (const w of [...words].sort((a, b) => a.s - b.s)) {
    const last = out.at(-1);
    if (last && w.s - pad - last.e <= gap) last.e = Math.max(last.e, w.e + pad);
    else out.push({ s: Math.max(0, w.s - pad), e: w.e + pad });
  }
  return out;
}

/**
 * Gain (0..1) for music at time `t`: `duckTo` while someone speaks, 1 otherwise.
 * Word timings are known ahead, so the dip *anticipates* speech (`attack` s before the
 * first word, which a live sidechain can't do) and recovers slowly (`release` s) so the
 * music doesn't pump. Default ≈ -8 dB, mid-range of common 6–12 dB practice.
 */
export function duckGain(intervals: Interval[], t: number, { duckTo = 0.4, attack = 0.12, release = 0.5 } = {}): number {
  let depth = 0; // 0 = full music, 1 = fully ducked
  for (const { s, e } of intervals) {
    if (t >= s && t <= e) return duckTo;
    if (t < s && s - t < attack) depth = Math.max(depth, 1 - (s - t) / attack);
    if (t > e && t - e < release) depth = Math.max(depth, 1 - (t - e) / release);
  }
  const smooth = depth * depth * (3 - 2 * depth); // smoothstep, no audible corners
  return 1 - (1 - duckTo) * smooth;
}
