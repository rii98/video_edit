// Voiceover through the user's Deepgram key (never the macOS `say` voice). Generated audio
// is imported into the media library and analyzed like any upload, so it gets a word-timed
// transcript for captions and ducking. Repeat requests are served from a local cache.
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { MediaAsset } from '../../src/shared/types.ts';
import { writeJsonAtomic } from '../store.ts';
import { getAsset, importFile, MEDIA_DIR, RAW_DIR, slugify } from './library.ts';
import { setting, transcriptionKey } from './transcribe.ts';

export const DEFAULT_VOICE = 'aura-2-thalia-en';
const MAX_CHARS = 2000; // Deepgram's per-request limit for TTS
const CACHE_FILE = join(MEDIA_DIR, 'tts-cache.json');

function cache(): Record<string, string> {
  return existsSync(CACHE_FILE) ? (JSON.parse(readFileSync(CACHE_FILE, 'utf8')) as Record<string, string>) : {};
}

/** Returns the voiceover asset for `text` in `voice`, calling Deepgram only if it isn't cached. */
export async function synthesizeSpeech(text: string, voice = setting('DEEPGRAM_TTS_VOICE') ?? DEFAULT_VOICE): Promise<{ asset: MediaAsset; cached: boolean }> {
  const clean = text.trim();
  if (!clean) throw new Error('nothing to say');
  if (clean.length > MAX_CHARS) throw new Error(`text is ${clean.length} characters; Deepgram TTS takes up to ${MAX_CHARS} per request (split it into lines)`);
  if (!/^[\w.-]+$/.test(voice)) throw new Error(`invalid voice "${voice}"`);
  const key = transcriptionKey();
  if (!key) throw new Error('needs DEEPGRAM_API_KEY in .env');

  const cacheKey = createHash('sha1').update(`${voice}\n${clean}`).digest('hex');
  const hit = cache()[cacheKey];
  const existing = hit ? getAsset(hit) : null;
  if (existing) return { asset: existing, cached: true };

  const params = new URLSearchParams({ model: voice, encoding: 'linear16', container: 'wav', sample_rate: '48000' });
  const res = await fetch(`https://api.deepgram.com/v1/speak?${params}`, {
    method: 'POST',
    headers: { Authorization: `Token ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ text: clean }),
    signal: AbortSignal.timeout(120_000),
  });
  if (!res.ok) throw new Error(`Deepgram TTS ${res.status}: ${(await res.text().catch(() => '')).slice(0, 300)}`);
  const audio = Buffer.from(await res.arrayBuffer());
  if (audio.length < 1000) throw new Error('Deepgram returned no audio');

  const tmp = join(RAW_DIR, `.incoming-tts-${cacheKey}.wav`);
  writeFileSync(tmp, audio);
  const { asset } = importFile(tmp, { name: `voice-${slugify(clean).slice(0, 24)}.wav`, move: true, origin: 'tts' });
  writeJsonAtomic(CACHE_FILE, { ...cache(), [cacheKey]: asset.id });
  return { asset, cached: false };
}
