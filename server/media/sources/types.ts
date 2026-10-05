// Online sound libraries behind one interface, so `ev sfx-find` / `ev sfx-get` (and the
// import pipeline in ../stock.ts) work the same for every provider. To add a provider:
// implement SoundSource in a new file in this folder and register it in index.ts.
// Licences are normalized here so the commercial-use rule is enforced in one place.

export type License = 'cc0' | 'by' | 'by-nc' | 'sampling+' | 'other';

/** Safe in monetized videos. */
export const COMMERCIAL_OK: readonly License[] = ['cc0', 'by'];
/** The video must credit the author (see `ev sfx-credits`). */
export const NEEDS_CREDIT: readonly License[] = ['by', 'by-nc', 'sampling+', 'other'];

export const LICENSE_LABEL: Record<License, string> = {
  cc0: 'CC0',
  by: 'CC BY',
  'by-nc': 'CC BY-NC',
  'sampling+': 'Sampling+',
  other: 'other licence',
};

export interface SoundHit {
  source: string;
  /** The provider's own id, as a string (Freesound ids are numbers). */
  id: string;
  title: string;
  /** Seconds. */
  duration: number;
  channels?: number;
  license: License;
  author: string;
  /** Human-facing page for the sound (for credits and for the user to audition). */
  url: string;
  rating?: number;
  ratings?: number;
  downloads?: number;
  tags?: string[];
}

export type SearchSort = 'relevant' | 'popular' | 'rated' | 'shortest' | 'newest';

export interface SearchOptions {
  query?: string;
  /** Provider id of a sound to find more like (acoustic + semantic similarity). */
  similarTo?: string;
  minSeconds?: number;
  maxSeconds?: number;
  /** Only these licences are returned. Defaults to CC0 at the CLI. */
  licenses: License[];
  sort: SearchSort;
  limit: number;
}

export interface SoundSource {
  /** Registry key, e.g. "freesound". */
  name: string;
  /** Short prefix for imported asset names, e.g. "fs" → fs-boom-impact-2-<fp>. */
  prefix: string;
  /** Licences this provider can filter on. */
  licenses: readonly License[];
  /** Page where the user can audition a sound. */
  pageUrl(id: string): string;
  search(opts: SearchOptions): Promise<{ total: number; hits: SoundHit[] }>;
  /** Writes the sound's audio to `dest` (any format ffmpeg reads) and returns its metadata. */
  download(id: string, dest: string): Promise<SoundHit>;
}
