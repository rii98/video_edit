// Voiceover with the user's own keys (never the macOS `say` voice). Gemini TTS is the main
// voice: directable per segment, near the top of blind naturalness rankings, free but capped
// at ~100 requests a day per key. Deepgram Aura-2 is used only when asked for explicitly.
// Generated audio is imported into the media library and analyzed like any upload, so it
// gets a word-timed transcript (Deepgram STT) for captions and ducking.
//
// Request discipline, because the Gemini quota is small:
// - a cache keyed on provider + voice + every segment's text and style: an unchanged line
//   never costs a request again;
// - a daily ledger per key (by fingerprint, never the key itself), shared by all projects,
//   with a soft cap below Google's limit and a per-minute throttle;
// - a 429 for the day marks that key exhausted until the Pacific-time reset;
// - when Gemini can't be used there is no silent fallback: the error tells the user to
//   comment out the spent key in .env and add a new one (a new key starts a fresh count).
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { MediaAsset } from '../../src/shared/types.ts';
import { ROOT, writeJsonAtomic } from '../store.ts';
import { getAsset, importFile, MEDIA_DIR, RAW_DIR, slugify } from './library.ts';
import { setting, transcriptionKey } from './transcribe.ts';

export type TtsProvider = 'gemini' | 'deepgram';

export interface SpeechSegment {
  /** Spoken verbatim. Gemini also reads inline vocal tags: <chuckle>, <sigh>, <short pause>… */
  text: string;
  /** Gemini only: how this segment is delivered ("hushed, almost whispering"). Never spoken. */
  style?: string;
}

export const GEMINI_MODEL = 'gemini-3.8-flash-tts';
export const DEEPGRAM_DEFAULT_VOICE = 'aura-2-thalia-en';
const DEEPGRAM_MALE_VOICE = 'aura-2-orion-en';
const DEEPGRAM_MAX_CHARS = 2000;
/** Gemini handles more, but long requests drift (ignored pauses, truncation): one scene each. */
const GEMINI_MAX_CHARS = 1200;
const CACHE_FILE = join(MEDIA_DIR, 'tts-cache.json');
const LEDGER_FILE = join(ROOT, '.cache', 'gemini-tts.json');

/**
 * The 30 Gemini voices: gender from Google's voice table, character from the Gemini docs,
 * and where each one fits. Casting guidance lives in the new-video skill (voice-casting.md).
 */
export const GEMINI_VOICES = {
  Achernar: { gender: 'female', tone: 'soft', fits: 'meditation, gentle stories, wellness' },
  Achird: { gender: 'male', tone: 'friendly', fits: 'tutorials, family, approachable brands' },
  Algenib: { gender: 'male', tone: 'gravelly', fits: 'trailers, true crime, gritty drama' },
  Algieba: { gender: 'male', tone: 'smooth', fits: 'luxury, cars, premium product' },
  Alnilam: { gender: 'male', tone: 'firm', fits: 'announcements, sports, authority' },
  Aoede: { gender: 'female', tone: 'breezy', fits: 'lifestyle, travel, light vlogs' },
  Autonoe: { gender: 'female', tone: 'bright', fits: 'explainers, education, upbeat promos' },
  Callirrhoe: { gender: 'female', tone: 'easy-going', fits: 'casual social, food, lifestyle' },
  Charon: { gender: 'male', tone: 'informative', fits: 'documentary, history, news-style explainers' },
  Despina: { gender: 'female', tone: 'smooth', fits: 'luxury, beauty, fashion, premium' },
  Enceladus: { gender: 'male', tone: 'breathy', fits: 'intimate, ASMR-ish, moody, poetic' },
  Erinome: { gender: 'female', tone: 'clear', fits: 'tech, SaaS, product demos, instructions' },
  Fenrir: { gender: 'male', tone: 'excitable', fits: 'hype, gaming, fitness, reactions' },
  Gacrux: { gender: 'female', tone: 'mature', fits: 'documentary, finance, serious narration' },
  Iapetus: { gender: 'male', tone: 'clear', fits: 'tech, tutorials, corporate explainers' },
  Kore: { gender: 'female', tone: 'firm', fits: 'news, finance, confident explainers' },
  Laomedeia: { gender: 'female', tone: 'upbeat', fits: 'social ads, launches, energetic promos' },
  Leda: { gender: 'female', tone: 'youthful', fits: 'kids, family, Gen-Z social, playful' },
  Orus: { gender: 'male', tone: 'firm', fits: 'corporate, authority, sports' },
  Pulcherrima: { gender: 'female', tone: 'forward', fits: 'bold ads, calls to action, debate' },
  Puck: { gender: 'male', tone: 'upbeat', fits: 'playful explainers, comedy, consumer apps' },
  Rasalgethi: { gender: 'male', tone: 'informative', fits: 'finance, science, education' },
  Sadachbia: { gender: 'male', tone: 'lively', fits: 'fitness, sports, energetic social' },
  Sadaltager: { gender: 'male', tone: 'knowledgeable', fits: 'history, science, long-form documentary' },
  Schedar: { gender: 'male', tone: 'even', fits: 'tech, B2B, neutral narration' },
  Sulafat: { gender: 'female', tone: 'warm', fits: 'brand stories, family, heartfelt' },
  Umbriel: { gender: 'male', tone: 'easy-going', fits: 'podcasts, casual explainers, vlogs' },
  Vindemiatrix: { gender: 'female', tone: 'gentle', fits: 'calm, health, bedtime, care' },
  Zephyr: { gender: 'female', tone: 'bright', fits: 'upbeat explainers, social, travel' },
  Zubenelgenubi: { gender: 'male', tone: 'casual', fits: 'creator-style talk, vlogs, comedy' },
} as const satisfies Record<string, { gender: 'female' | 'male'; tone: string; fits: string }>;
export type GeminiVoice = keyof typeof GEMINI_VOICES;
export const DEFAULT_GEMINI_VOICE: GeminiVoice = 'Charon';

const isGeminiVoice = (v: string): v is GeminiVoice => Object.hasOwn(GEMINI_VOICES, v);

/**
 * `[[style]]` at the start of a part sets that segment's style:
 * `[[deep, ominous]] In a world… [[hushed]] No templates.` → two segments.
 */
export function parseSegments(input: string, defaultStyle?: string): SpeechSegment[] {
  const parts = input.split(/\[\[([^\]]+)\]\]/);
  const segments: SpeechSegment[] = [];
  const lead = parts[0]!.trim();
  if (lead) segments.push({ text: lead, ...(defaultStyle ? { style: defaultStyle } : {}) });
  for (let i = 1; i < parts.length; i += 2) {
    const text = parts[i + 1]!.trim();
    if (text) segments.push({ text, style: parts[i]!.trim() });
  }
  return segments;
}

/** Deepgram reads tags aloud and can't take styles: plain text only. */
export const plainText = (segments: SpeechSegment[]) =>
  segments.map((s) => s.text.replace(/<[a-z -]+>/gi, ' ')).join(' ').replace(/\s+/g, ' ').trim();

export const spokenWords = (segments: SpeechSegment[]) => plainText(segments).split(' ').filter(Boolean).length;

// ---- Daily ledger (shared by every project: the quota belongs to the key) ------------------

/** Gemini quotas reset at midnight Pacific time. */
export const pacificDay = (now = new Date()) => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Los_Angeles' }).format(now);

export interface Ledger {
  day: string;
  count: number;
  /** Set when Google refused for the day: don't ask again until the reset. */
  exhausted: boolean;
  /** Epoch ms of recent requests, for the per-minute throttle. */
  recent: number[];
}

/** A short one-way fingerprint, so the ledger can tell keys apart without storing them. */
export const keyFingerprint = (key: string) => createHash('sha256').update(key).digest('hex').slice(0, 8);

function ledgerFile(currentFp: string): Record<string, Ledger> {
  if (!existsSync(LEDGER_FILE)) return {};
  const raw = JSON.parse(readFileSync(LEDGER_FILE, 'utf8')) as Record<string, Ledger> | Ledger;
  // The first version kept one ledger for whatever key was set: it belongs to the current key.
  return 'day' in raw && typeof raw.day === 'string' ? { [currentFp]: raw as Ledger } : (raw as Record<string, Ledger>);
}

export function readLedger(fp: string, now = new Date()): Ledger {
  const today = pacificDay(now);
  const saved = ledgerFile(fp)[fp];
  return saved && saved.day === today ? saved : { day: today, count: 0, exhausted: false, recent: [] };
}

function writeLedger(fp: string, l: Ledger): void {
  mkdirSync(join(ROOT, '.cache'), { recursive: true });
  // Only today's entries matter; older days are dropped.
  const keep = Object.fromEntries(Object.entries(ledgerFile(fp)).filter(([k, v]) => k !== fp && v.day === l.day));
  writeJsonAtomic(LEDGER_FILE, { ...keep, [fp]: l });
}

/** Soft cap below Google's observed 100/day, leaving room for a manual test or two. */
export const dailyCap = () => Number(setting('GEMINI_TTS_DAILY') ?? 90);
const perMinute = () => Number(setting('GEMINI_TTS_PER_MINUTE') ?? 8);

/** How long to wait (ms) before another request fits in the per-minute window. */
export function throttleDelay(recent: number[], limit: number, now = Date.now()): number {
  const window = recent.filter((t) => now - t < 60_000).sort((a, b) => a - b);
  return window.length < limit ? 0 : window[window.length - limit]! + 60_000 - now + 250;
}

/** The next midnight Pacific, in the user's local time ("12:45 pm"). */
export function resetTime(now = new Date()): string {
  const today = pacificDay(now);
  let t = now.getTime();
  for (let step = 3_600_000; step >= 60_000; step /= 60) {
    while (pacificDay(new Date(t + step)) === today) t += step;
  }
  return new Date(t + 60_000).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

const currentKey = () => setting('GEMINI_API_KEY');

export function geminiAvailable(): { ok: true } | { ok: false; reason: string; hasKey: boolean } {
  const key = currentKey();
  if (!key) return { ok: false, reason: 'there is no GEMINI_API_KEY in .env', hasKey: false };
  const l = readLedger(keyFingerprint(key));
  if (l.exhausted) return { ok: false, reason: `Google refused the current key (${keyFingerprint(key)}) for today: its daily quota is used up`, hasKey: true };
  if (l.count >= dailyCap()) return { ok: false, reason: `the current key (${keyFingerprint(key)}) has used today's budget of ${dailyCap()} requests (GEMINI_TTS_DAILY)`, hasKey: true };
  return { ok: true };
}

/** Thrown instead of falling back: the user decides whether to swap keys, wait or use Deepgram. */
export class GeminiUnavailable extends Error {}

export function unavailableMessage(reason: string, hasKey: boolean): string {
  const steps = hasKey
    ? [
        `  1. Comment out the current key line:  # GEMINI_API_KEY=…   (keep it: it works again after the reset)`,
        `  2. Add a new line below it:           GEMINI_API_KEY=<new key from aistudio.google.com>`,
      ]
    : [`  Add a line:  GEMINI_API_KEY=<key from aistudio.google.com>`];
  return [
    `Gemini TTS is not available: ${reason}.`,
    `Not falling back to Deepgram. Ask the user to update .env (they paste keys themselves; never print them):`,
    ...steps,
    `Then rerun the same ev tts command; lines already generated are cached and cost nothing.`,
    ...(hasKey ? [`Or wait for the reset at ${resetTime()} (midnight Pacific).`] : []),
    `Use Deepgram only if the user explicitly asks for it: --provider=deepgram.`,
  ].join('\n');
}

export function usageSummary(): string {
  const key = currentKey();
  if (!key) return 'Gemini TTS: no GEMINI_API_KEY in .env';
  const fp = keyFingerprint(key);
  const l = readLedger(fp);
  return `Gemini TTS today (${l.day}, Pacific), key ${fp}: ${l.count}/${dailyCap()} requests${l.exhausted ? ' · Google says this key is used up' : ''} · resets at ${resetTime()} your time`;
}

// ---- Providers -------------------------------------------------------------------------

class QuotaError extends Error {
  daily: boolean;
  retryMs: number;
  constructor(message: string, daily: boolean, retryMs: number) {
    super(message);
    this.daily = daily;
    this.retryMs = retryMs;
  }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function geminiRequest(segments: SpeechSegment[], voice: GeminiVoice): Promise<Buffer> {
  const key = currentKey();
  if (!key) throw new GeminiUnavailable(unavailableMessage('there is no GEMINI_API_KEY in .env', false));
  const fp = keyFingerprint(key);
  const wait = throttleDelay(readLedger(fp).recent, perMinute());
  if (wait > 0) await sleep(wait);

  // Count the attempt before sending: a request that fails still spends quota.
  const now = Date.now();
  const ledger = readLedger(fp);
  writeLedger(fp, { ...ledger, count: ledger.count + 1, recent: [...ledger.recent.filter((t) => now - t < 60_000), now] });

  // The Interactions API reads `text` strictly verbatim; styles go in speech_metadata.
  // (generateContent speaks any instructions placed in the prompt.)
  const res = await fetch('https://generativelanguage.googleapis.com/v1beta/interactions', {
    method: 'POST',
    headers: { 'x-goog-api-key': key, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: GEMINI_MODEL,
      input: [
        {
          type: 'user_input',
          content: segments.map((s) => ({
            type: 'text',
            text: s.text,
            ...(s.style ? { annotations: [{ type: 'speech_metadata', style: s.style }] } : {}),
          })),
        },
      ],
      response_format: { type: 'audio' },
      generation_config: { speech_config: [{ voice }] },
    }),
    signal: AbortSignal.timeout(180_000),
  });
  const body = (await res.json().catch(() => ({}))) as {
    error?: { message?: string; status?: string; details?: { quotaId?: string; violations?: { quotaId?: string }[]; retryDelay?: string }[] };
    steps?: { type: string; content?: { type: string; data?: string }[] }[];
  };
  if (res.status === 429 || body.error?.status === 'RESOURCE_EXHAUSTED') {
    const details = JSON.stringify(body.error?.details ?? []);
    const daily = /PerDay|per_day|daily/i.test(details) || /per day|daily/i.test(body.error?.message ?? '');
    const retry = Number(details.match(/"retryDelay":"(\d+)/)?.[1] ?? 30) * 1000;
    throw new QuotaError(`Gemini quota: ${body.error?.message ?? 'rate limited'}`, daily, retry);
  }
  if (!res.ok) throw new Error(`Gemini TTS ${res.status}: ${(body.error?.message ?? '').slice(0, 300)}`);
  const audio = body.steps?.filter((s) => s.type === 'model_output').flatMap((s) => s.content ?? []).filter((c) => c.type === 'audio').at(-1)?.data;
  if (!audio) throw new Error('Gemini returned no audio');
  return Buffer.from(audio, 'base64');
}

/** One retry for a per-minute limit; a daily limit marks the day exhausted and stops. */
async function geminiSpeech(segments: SpeechSegment[], voice: GeminiVoice): Promise<Buffer> {
  try {
    return await geminiRequest(segments, voice);
  } catch (err) {
    if (!(err instanceof QuotaError)) throw err;
    if (err.daily) {
      const fp = keyFingerprint(currentKey() ?? '');
      writeLedger(fp, { ...readLedger(fp), exhausted: true });
      throw new GeminiUnavailable(unavailableMessage(`Google refused the current key (${fp}) for today: ${err.message}`, true));
    }
    await sleep(Math.min(err.retryMs, 65_000));
    return geminiRequest(segments, voice);
  }
}

async function deepgramSpeech(text: string, voice: string): Promise<Buffer> {
  const key = transcriptionKey();
  if (!key) throw new Error('needs DEEPGRAM_API_KEY in .env');
  if (text.length > DEEPGRAM_MAX_CHARS) throw new Error(`text is ${text.length} characters; Deepgram TTS takes up to ${DEEPGRAM_MAX_CHARS} per request (split it into lines)`);
  const params = new URLSearchParams({ model: voice, encoding: 'linear16', container: 'wav', sample_rate: '48000' });
  const res = await fetch(`https://api.deepgram.com/v1/speak?${params}`, {
    method: 'POST',
    headers: { Authorization: `Token ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ text }),
    signal: AbortSignal.timeout(120_000),
  });
  if (!res.ok) throw new Error(`Deepgram TTS ${res.status}: ${(await res.text().catch(() => '')).slice(0, 300)}`);
  return Buffer.from(await res.arrayBuffer());
}

// ---- Entry point -------------------------------------------------------------------------

function cache(): Record<string, string> {
  return existsSync(CACHE_FILE) ? (JSON.parse(readFileSync(CACHE_FILE, 'utf8')) as Record<string, string>) : {};
}

export function cacheKey(provider: TtsProvider, voice: string, segments: SpeechSegment[]): string {
  const id = provider === 'gemini' ? `gemini:${GEMINI_MODEL}:${voice}\n${JSON.stringify(segments)}` : `${voice}\n${plainText(segments)}`;
  // Deepgram keys keep the old `${voice}\n${text}` shape, so earlier voiceovers stay cached.
  return createHash('sha1').update(id).digest('hex');
}

export interface SpeechOptions {
  /** `gemini` (default). `deepgram` only when the user explicitly asked for it. */
  provider?: TtsProvider;
  /** A Gemini voice name, or a Deepgram model id (which implies `deepgram`). */
  voice?: string;
}

export interface SpeechResult {
  asset: MediaAsset;
  cached: boolean;
  provider: TtsProvider;
  voice: string;
}

/** Deepgram stand-in for a Gemini voice: same gender. */
const deepgramFor = (voice: string) => (isGeminiVoice(voice) && GEMINI_VOICES[voice].gender === 'male' ? DEEPGRAM_MALE_VOICE : (setting('DEEPGRAM_TTS_VOICE') ?? DEEPGRAM_DEFAULT_VOICE));

export async function synthesizeSpeech(segments: SpeechSegment[], { provider, voice }: SpeechOptions = {}): Promise<SpeechResult> {
  const clean = segments.map((s) => ({ text: s.text.trim(), ...(s.style?.trim() ? { style: s.style.trim() } : {}) })).filter((s) => s.text);
  if (!clean.length) throw new Error('nothing to say');
  const useDeepgram = provider === 'deepgram' || (!provider && !!voice && !isGeminiVoice(voice));

  const hit = (p: TtsProvider, v: string) => {
    const id = cache()[cacheKey(p, v, clean)];
    return id ? getAsset(id) : null;
  };
  const store = (audio: Buffer, p: TtsProvider, v: string): MediaAsset => {
    if (audio.length < 1000) throw new Error(`${p} returned no audio`);
    const key = cacheKey(p, v, clean);
    const tmp = join(RAW_DIR, `.incoming-tts-${key}.wav`);
    writeFileSync(tmp, audio);
    const { asset } = importFile(tmp, { name: `voice-${slugify(plainText(clean)).slice(0, 24)}.wav`, move: true, origin: 'tts' });
    writeJsonAtomic(CACHE_FILE, { ...cache(), [key]: asset.id });
    return asset;
  };

  if (useDeepgram) {
    const dgVoice = voice && !isGeminiVoice(voice) ? voice : deepgramFor(voice ?? '');
    if (!/^[\w.-]+$/.test(dgVoice)) throw new Error(`invalid voice "${dgVoice}"`);
    const cached = hit('deepgram', dgVoice);
    if (cached) return { asset: cached, cached: true, provider: 'deepgram', voice: dgVoice };
    return { asset: store(await deepgramSpeech(plainText(clean), dgVoice), 'deepgram', dgVoice), cached: false, provider: 'deepgram', voice: dgVoice };
  }

  const geminiVoice = voice ?? setting('GEMINI_TTS_VOICE') ?? DEFAULT_GEMINI_VOICE;
  if (!isGeminiVoice(geminiVoice)) throw new Error(`"${geminiVoice}" is not a Gemini voice (see: ev tts --voices)`);
  const cached = hit('gemini', geminiVoice);
  if (cached) return { asset: cached, cached: true, provider: 'gemini', voice: geminiVoice };
  const chars = clean.reduce((n, s) => n + s.text.length, 0);
  if (chars > GEMINI_MAX_CHARS) throw new Error(`${chars} characters in one request; keep Gemini requests to one scene (≤ ${GEMINI_MAX_CHARS} characters, ~20 s of speech)`);
  const available = geminiAvailable();
  if (!available.ok) throw new GeminiUnavailable(unavailableMessage(available.reason, available.hasKey));
  return { asset: store(await geminiSpeech(clean, geminiVoice), 'gemini', geminiVoice), cached: false, provider: 'gemini', voice: geminiVoice };
}
