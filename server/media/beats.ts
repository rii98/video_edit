// Music timing analysis, pure TypeScript (no Python): onset strength → tempo → beats →
// downbeats → energy sections. Follows the classic Ellis (2007) dynamic-programming
// beat tracker that librosa also uses. Pure functions on PCM so they are unit-testable.

export const SAMPLE_RATE = 22050;
const N_FFT = 1024;
const HOP = 512;
const FRAME_RATE = SAMPLE_RATE / HOP; // ~43 onset frames per second

export interface BeatAnalysis {
  bpm: number;
  /** 0..1, how clearly periodic the onsets are. Low values mean speech/ambient, not music. */
  confidence: number;
  beats: number[];
  downbeats: number[];
  /** Section boundaries in seconds (big energy changes on bar lines), always starting at 0. */
  sections: { start: number; energy: 'low' | 'mid' | 'high' }[];
}

// ---- FFT ------------------------------------------------------------------------------

/** In-place iterative radix-2 FFT. `re`/`im` length must be a power of two. */
export function fft(re: Float64Array, im: Float64Array): void {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) {
      [re[i], re[j]] = [re[j]!, re[i]!];
      [im[i], im[j]] = [im[j]!, im[i]!];
    }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = (-2 * Math.PI) / len;
    const wr = Math.cos(ang);
    const wi = Math.sin(ang);
    for (let i = 0; i < n; i += len) {
      let cr = 1;
      let ci = 0;
      for (let k = 0; k < len / 2; k++) {
        const a = i + k;
        const b = a + len / 2;
        const tr = re[b]! * cr - im[b]! * ci;
        const ti = re[b]! * ci + im[b]! * cr;
        re[b] = re[a]! - tr;
        im[b] = im[a]! - ti;
        re[a] = re[a]! + tr;
        im[a] = im[a]! + ti;
        const ncr = cr * wr - ci * wi;
        ci = cr * wi + ci * wr;
        cr = ncr;
      }
    }
  }
}

// ---- Onset strength -------------------------------------------------------------------

/**
 * Spectral flux on a log-magnitude spectrogram: how much new energy appears per frame.
 * Also returns low-band (< ~150 Hz, kick drum) flux, used to find downbeats.
 */
export function onsetStrength(pcm: Float32Array): { onset: Float64Array; low: Float64Array; rms: Float64Array } {
  const frames = Math.max(0, Math.floor((pcm.length - N_FFT) / HOP) + 1);
  const bins = N_FFT / 2 + 1;
  const lowBins = Math.ceil((150 * N_FFT) / SAMPLE_RATE);
  const window = new Float64Array(N_FFT).map((_, i) => 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / N_FFT));
  const onset = new Float64Array(frames);
  const low = new Float64Array(frames);
  const rms = new Float64Array(frames);
  let prev = new Float64Array(bins);
  const re = new Float64Array(N_FFT);
  const im = new Float64Array(N_FFT);

  for (let f = 0; f < frames; f++) {
    const offset = f * HOP;
    let energy = 0;
    for (let i = 0; i < N_FFT; i++) {
      const s = pcm[offset + i]!;
      energy += s * s;
      re[i] = s * window[i]!;
      im[i] = 0;
    }
    rms[f] = Math.sqrt(energy / N_FFT);
    fft(re, im);
    const mag = new Float64Array(bins);
    let flux = 0;
    let lowFlux = 0;
    for (let k = 0; k < bins; k++) {
      mag[k] = Math.log1p(100 * Math.hypot(re[k]!, im[k]!));
      const rise = Math.max(0, mag[k]! - prev[k]!);
      flux += rise;
      if (k > 0 && k <= lowBins) lowFlux += rise;
    }
    onset[f] = f === 0 ? 0 : flux;
    low[f] = f === 0 ? 0 : lowFlux;
    prev = mag;
  }
  return { onset: normalize(detrend(onset)), low: normalize(low), rms };
}

/** Removes the slowly varying level so only transients remain. */
function detrend(x: Float64Array): Float64Array {
  const half = Math.round(FRAME_RATE / 2);
  const out = new Float64Array(x.length);
  let sum = 0;
  let count = 0;
  for (let i = -half; i < x.length; i++) {
    const add = i + half;
    if (add < x.length) (sum += x[add]!), count++;
    const drop = i - half - 1;
    if (drop >= 0) (sum -= x[drop]!), count--;
    if (i >= 0) out[i] = Math.max(0, x[i]! - sum / count);
  }
  return out;
}

function normalize(x: Float64Array): Float64Array {
  let mean = 0;
  for (const v of x) mean += v;
  mean /= x.length || 1;
  let sd = 0;
  for (const v of x) sd += (v - mean) ** 2;
  sd = Math.sqrt(sd / (x.length || 1)) || 1;
  return x.map((v) => v / sd);
}

// ---- Tempo ----------------------------------------------------------------------------

/**
 * Tempo by autocorrelation of the onset envelope, weighted toward ~120 BPM so the
 * tracker prefers the felt beat over double/half time. Returns period in onset frames.
 */
export function estimateTempo(onset: Float64Array): { period: number; bpm: number; confidence: number } {
  const minLag = Math.floor((60 / 200) * FRAME_RATE);
  const maxLag = Math.ceil((60 / 60) * FRAME_RATE);
  const ac = new Float64Array(maxLag + 2);
  for (let lag = 0; lag <= maxLag + 1; lag++) {
    let s = 0;
    for (let i = lag; i < onset.length; i++) s += onset[i]! * onset[i - lag]!;
    ac[lag] = s / (onset.length - lag || 1);
  }
  let best = minLag;
  let bestScore = -Infinity;
  for (let lag = minLag; lag <= maxLag; lag++) {
    const bpm = (60 * FRAME_RATE) / lag;
    const prior = Math.exp(-0.5 * (Math.log2(bpm / 120) / 1.0) ** 2);
    // Reward lags whose double is also strong: real beats repeat at 2x the period too.
    const harmonic = lag * 2 <= maxLag + 1 ? 0.5 * ac[lag * 2]! : 0;
    const score = (ac[lag]! + harmonic) * prior;
    if (score > bestScore) (bestScore = score), (best = lag);
  }
  // Parabolic interpolation for sub-frame precision.
  const y0 = ac[best - 1]!;
  const y1 = ac[best]!;
  const y2 = ac[best + 1]!;
  const denom = y0 - 2 * y1 + y2;
  const period = denom !== 0 ? best + (0.5 * (y0 - y2)) / denom : best;
  const confidence = ac[0]! > 0 ? Math.max(0, Math.min(1, y1 / ac[0]!)) : 0;
  return { period, bpm: (60 * FRAME_RATE) / period, confidence };
}

// ---- Beat tracking --------------------------------------------------------------------

/** Ellis DP: choose beat times that sit on strong onsets AND keep a steady period. */
export function trackBeats(onset: Float64Array, period: number, tightness = 100): number[] {
  const n = onset.length;
  if (n === 0) return [];
  const score = new Float64Array(n);
  const backlink = new Int32Array(n).fill(-1);
  const lo = Math.round(period / 2);
  const hi = Math.round(period * 2);
  for (let t = 0; t < n; t++) {
    let bestPrev = -1;
    let bestVal = 0;
    for (let p = t - hi; p <= t - lo; p++) {
      if (p < 0) continue;
      const v = score[p]! - tightness * Math.log((t - p) / period) ** 2;
      if (bestPrev === -1 || v > bestVal) (bestVal = v), (bestPrev = p);
    }
    // Starting a fresh chain beats linking to a bad predecessor; otherwise beats near the
    // start (with no real beat one period earlier) are penalized and silently dropped.
    const link = bestPrev >= 0 && bestVal > 0;
    score[t] = onset[t]! + (link ? bestVal : 0);
    backlink[t] = link ? bestPrev : -1;
  }
  // Start from the best-scoring frame within the last period, then follow links back.
  let t = n - 1;
  for (let i = Math.max(0, n - Math.ceil(period)); i < n; i++) if (score[i]! > score[t]!) t = i;
  const frames: number[] = [];
  while (t >= 0) {
    frames.push(t);
    t = backlink[t]!;
  }
  frames.reverse();
  // Drop leading/trailing beats that sit on silence (the DP chains through quiet intros).
  const strong = (f: number) => onset[f]! > 0.1;
  while (frames.length && !strong(frames[0]!)) frames.shift();
  while (frames.length && !strong(frames.at(-1)!)) frames.pop();
  return frames;
}

// ---- Bars and sections ----------------------------------------------------------------

/** The beat phase (0..3) with the most low-end energy is taken as beat 1 of each bar. */
export function findDownbeatPhase(beatFrames: number[], low: Float64Array, beatsPerBar = 4): number {
  const totals = new Array<number>(beatsPerBar).fill(0);
  beatFrames.forEach((f, i) => {
    let peak = 0;
    for (let k = Math.max(0, f - 2); k <= Math.min(low.length - 1, f + 2); k++) peak = Math.max(peak, low[k]!);
    totals[i % beatsPerBar]! += peak;
  });
  return totals.indexOf(Math.max(...totals));
}

function energySections(rms: Float64Array, downbeatFrames: number[]): BeatAnalysis['sections'] {
  if (downbeatFrames.length < 2) return [{ start: 0, energy: 'mid' }];
  const bars = downbeatFrames.slice(0, -1).map((f, i) => {
    const end = downbeatFrames[i + 1]!;
    let s = 0;
    for (let k = f; k < end; k++) s += rms[k]!;
    return { start: f / FRAME_RATE, level: s / Math.max(1, end - f) };
  });
  // Levels in dB relative to the loudest bar. (Quantiles would invent a "mid" in a track
  // that only has two levels.)
  const loudest = Math.max(...bars.map((b) => b.level)) || 1;
  const label = (v: number): 'low' | 'mid' | 'high' => {
    const db = 20 * Math.log10(Math.max(v, 1e-9) / loudest);
    return db > -4 ? 'high' : db > -12 ? 'mid' : 'low';
  };
  const sections: BeatAnalysis['sections'] = [{ start: 0, energy: label(bars[0]!.level) }];
  // Sections change on bar lines, and only when the new level persists for 2+ bars.
  for (let i = 1; i < bars.length - 1; i++) {
    const current = sections.at(-1)!.energy;
    const next = label(bars[i]!.level);
    if (next !== current && label(bars[i + 1]!.level) === next) sections.push({ start: round(bars[i]!.start), energy: next });
  }
  return sections;
}

const round = (s: number) => Math.round(s * 1000) / 1000;

/** Tempo from the tracked beats: a least-squares fit of time vs beat index averages out
 * the frame quantization that limits autocorrelation to about ±1 BPM. */
function bpmFromBeats(times: number[], fallback: number): number {
  if (times.length < 8) return fallback;
  const n = times.length;
  const meanI = (n - 1) / 2;
  const meanT = times.reduce((a, b) => a + b, 0) / n;
  let num = 0;
  let den = 0;
  times.forEach((t, i) => {
    num += (i - meanI) * (t - meanT);
    den += (i - meanI) ** 2;
  });
  const slope = num / den;
  return slope > 0 ? 60 / slope : fallback;
}

export function analyzeBeats(input: Float32Array): BeatAnalysis {
  // Lead with silence so a hit on the very first sample still registers as an onset.
  const pcm = new Float32Array(input.length + N_FFT);
  pcm.set(input, N_FFT);
  const { onset, low, rms } = onsetStrength(pcm);
  const tempo = estimateTempo(onset);
  const beatFrames = trackBeats(onset, tempo.period);
  const phase = findDownbeatPhase(beatFrames, low);
  const downbeatFrames = beatFrames.filter((_, i) => i % 4 === phase);
  // An onset frame is centred half a window after its start; remove the padding too.
  const toSeconds = (f: number) => Math.max(0, round((f * HOP + N_FFT / 2 - N_FFT) / SAMPLE_RATE));
  const beats = beatFrames.map(toSeconds);
  return {
    bpm: Math.round(bpmFromBeats(beats, tempo.bpm) * 10) / 10,
    confidence: Math.round(tempo.confidence * 100) / 100,
    beats,
    downbeats: downbeatFrames.map(toSeconds),
    sections: energySections(rms, downbeatFrames).map((s) => ({ ...s, start: s.start === 0 ? 0 : Math.max(0, round(s.start + (N_FFT / 2 - N_FFT) / SAMPLE_RATE)) })),
  };
}
