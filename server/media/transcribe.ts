// Speech-to-text through the user's own Deepgram key. The key is read from the git-ignored
// .env and is never logged. Audio is sent as small mono Opus to keep uploads fast.
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseEnv } from 'node:util';
import { ROOT } from '../store.ts';
import { ffmpeg } from './ffmpeg.ts';

/**
 * Reads .env on every call (it's tiny): the editor server is long-running, and a key the
 * user adds while it runs must take effect without a restart. Real env vars win.
 */
function env(name: string): string | undefined {
  const file = join(ROOT, '.env');
  const fromFile = existsSync(file) ? parseEnv(readFileSync(file, 'utf8'))[name] : undefined;
  return (process.env[name] ?? fromFile)?.trim() || undefined;
}

/** Reads a setting from the environment or the git-ignored .env (re-read on each call). */
export function setting(name: string): string | undefined {
  return env(name);
}

export function transcriptionKey(): string | null {
  return env('DEEPGRAM_API_KEY') ?? null;
}

export interface Transcript {
  provider: 'deepgram';
  model: string;
  language: string | null;
  text: string;
  /** Word timings in seconds. */
  words: { w: string; s: number; e: number }[];
  /** Sentence-ish chunks, the most useful unit for cutting. */
  utterances: { s: number; e: number; text: string }[];
}

interface DeepgramResponse {
  results?: {
    channels?: { detected_language?: string; alternatives?: { transcript?: string; words?: { word: string; punctuated_word?: string; start: number; end: number }[] }[] }[];
    utterances?: { start: number; end: number; transcript: string }[];
  };
}

export async function transcribe(file: string): Promise<Transcript> {
  const key = transcriptionKey();
  if (!key) throw new Error('needs DEEPGRAM_API_KEY in .env');
  const model = env('DEEPGRAM_STT_MODEL') ?? 'nova-3';

  const { stdout: audio } = await ffmpeg(['-i', file, '-vn', '-ac', '1', '-ar', '16000', '-c:a', 'libopus', '-b:a', '24k', '-f', 'ogg', 'pipe:1']);
  const params = new URLSearchParams({ model, smart_format: 'true', punctuate: 'true', utterances: 'true', detect_language: 'true' });
  const res = await fetch(`https://api.deepgram.com/v1/listen?${params}`, {
    method: 'POST',
    headers: { Authorization: `Token ${key}`, 'Content-Type': 'audio/ogg' },
    body: new Uint8Array(audio),
    signal: AbortSignal.timeout(10 * 60_000),
  });
  if (!res.ok) {
    // Surface Deepgram's message (e.g. invalid key, bad model) but never the key itself.
    const detail = (await res.text().catch(() => '')).slice(0, 300);
    throw new Error(`Deepgram ${res.status}: ${detail}`);
  }
  const data = (await res.json()) as DeepgramResponse;
  const channel = data.results?.channels?.[0];
  const alt = channel?.alternatives?.[0];
  return {
    provider: 'deepgram',
    model,
    language: channel?.detected_language ?? null,
    text: alt?.transcript ?? '',
    words: (alt?.words ?? []).map((w) => ({ w: w.punctuated_word ?? w.word, s: w.start, e: w.end })),
    utterances: (data.results?.utterances ?? []).map((u) => ({ s: u.start, e: u.end, text: u.transcript })),
  };
}

/** Human/Claude-readable form: one timestamped line per utterance. */
export function transcriptToText(t: Transcript): string {
  const stamp = (s: number) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${(s % 60).toFixed(1).padStart(4, '0')}`;
  const lines = t.utterances.length ? t.utterances.map((u) => `[${stamp(u.s)}–${stamp(u.e)}] ${u.text}`) : [t.text];
  return lines.join('\n') + '\n';
}
