// Freesound (freesound.org): 700k+ Creative Commons recordings, searched with the user's
// free API key (FREESOUND_API_KEY in .env, from https://freesound.org/apiv2/apply/).
// Audio comes from the HQ preview (MP3, no OAuth needed), which is plenty for sound
// effects; original files would need an OAuth2 login. The key is only ever sent to the
// API host, never to the preview CDN, and is never logged.
import { writeFileSync } from 'node:fs';
import { setting } from '../transcribe.ts';
import { describeFailure, fetchWithRetry, HttpError, type FetchFn } from './http.ts';
import type { License, SearchOptions, SearchSort, SoundHit, SoundSource } from './types.ts';

const API = 'https://freesound.org/apiv2';
const FIELDS = 'id,name,duration,channels,license,username,url,avg_rating,num_ratings,num_downloads,tags,previews';
const MAX_PAGE = 150;
export const KEY_NAME = 'FREESOUND_API_KEY';

/** Licence names as Freesound's `license:` filter spells them. */
const FILTER_NAME: Partial<Record<License, string>> = {
  cc0: 'Creative Commons 0',
  by: 'Attribution',
  'by-nc': 'Attribution NonCommercial',
};

const SORT: Record<SearchSort, string | null> = {
  relevant: null, // Freesound's default (score)
  popular: 'downloads_desc',
  rated: 'rating_desc',
  shortest: 'duration_asc',
  newest: 'created_desc',
};

interface RawSound {
  id: number;
  name: string;
  duration: number;
  channels?: number;
  license: string;
  username: string;
  url: string;
  avg_rating?: number;
  num_ratings?: number;
  num_downloads?: number;
  tags?: string[];
  previews?: Record<string, string>;
}

/** Freesound returns licences as deed URLs (old sounds use older versions). */
export function parseLicense(url: string): License {
  if (/publicdomain\/zero/.test(url) || url === 'Creative Commons 0') return 'cc0';
  if (/sampling\+/.test(url)) return 'sampling+';
  if (/\/by-nc\//.test(url) || url === 'Attribution NonCommercial') return 'by-nc';
  if (/\/by\//.test(url) || url === 'Attribution') return 'by';
  return 'other';
}

export function toHit(raw: RawSound): SoundHit {
  return {
    source: 'freesound',
    id: String(raw.id),
    title: raw.name,
    duration: raw.duration,
    channels: raw.channels,
    license: parseLicense(raw.license),
    author: raw.username,
    url: raw.url,
    rating: raw.avg_rating,
    ratings: raw.num_ratings,
    downloads: raw.num_downloads,
    tags: raw.tags,
  };
}

export function buildSearchParams(opts: SearchOptions): URLSearchParams {
  const params = new URLSearchParams({ fields: FIELDS, page_size: String(Math.max(1, Math.min(MAX_PAGE, opts.limit))) });
  if (opts.query?.trim()) params.set('query', opts.query.trim());
  const filters: string[] = [];
  const names = opts.licenses.map((l) => FILTER_NAME[l]).filter((n): n is string => !!n);
  if (names.length !== opts.licenses.length) throw new Error(`Freesound can filter on ${Object.keys(FILTER_NAME).join(', ')} only`);
  if (names.length) filters.push(`license:(${names.map((n) => `"${n}"`).join(' OR ')})`);
  if (opts.minSeconds !== undefined || opts.maxSeconds !== undefined) filters.push(`duration:[${opts.minSeconds ?? '*'} TO ${opts.maxSeconds ?? '*'}]`);
  if (filters.length) params.set('filter', filters.join(' '));
  if (opts.similarTo) {
    params.set('similar_to', validId(opts.similarTo));
    params.set('similarity_space', 'laion_clap');
  } else if (SORT[opts.sort]) {
    params.set('sort', SORT[opts.sort]!);
  }
  return params;
}

function validId(id: string): string {
  if (!/^\d{1,12}$/.test(id)) throw new Error(`"${id}" is not a Freesound sound id (a number, e.g. 535592)`);
  return id;
}

function apiKey(): string {
  const key = setting(KEY_NAME);
  if (!key) throw new Error(`needs ${KEY_NAME} in .env (free: https://freesound.org/apiv2/apply/)`);
  return key;
}

export function createFreesound(fetchFn?: FetchFn): SoundSource {
  async function api<T>(path: string, params?: URLSearchParams): Promise<T> {
    const res = await fetchWithRetry(`${API}${path}${params ? `?${params}` : ''}`, { headers: { Authorization: `Token ${apiKey()}` } }, { fetchFn });
    if (res.ok) return (await res.json()) as T;
    if (res.status === 401) throw new HttpError(401, `Freesound rejected the API key: check ${KEY_NAME} in .env`);
    throw new HttpError(res.status, `Freesound ${await describeFailure(res)}`);
  }

  return {
    name: 'freesound',
    prefix: 'fs',
    licenses: Object.keys(FILTER_NAME) as License[],
    pageUrl: (id) => `https://freesound.org/s/${id}/`,

    async search(opts) {
      const page = await api<{ count: number; results: RawSound[] }>('/search/', buildSearchParams(opts));
      return { total: page.count, hits: page.results.map(toHit) };
    },

    async download(id, dest) {
      let raw: RawSound;
      try {
        raw = await api<RawSound>(`/sounds/${validId(id)}/`, new URLSearchParams({ fields: FIELDS }));
      } catch (err) {
        if (err instanceof HttpError && err.status === 404) throw new Error(`no Freesound sound #${id}`);
        throw err;
      }
      const preview = raw.previews?.['preview-hq-mp3'] ?? raw.previews?.['preview-hq-ogg'];
      if (!preview) throw new Error(`Freesound #${id} has no preview to download`);
      const res = await fetchWithRetry(preview, {}, { fetchFn, timeoutMs: 120_000 });
      if (!res.ok) throw new Error(`downloading Freesound #${id} failed: ${await describeFailure(res)}`);
      const audio = Buffer.from(await res.arrayBuffer());
      if (audio.length < 500) throw new Error(`Freesound #${id}: the preview is empty`);
      writeFileSync(dest, audio);
      return toHit(raw);
    },
  };
}

export const freesound = createFreesound();
