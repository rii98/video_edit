// Registry of online sound sources. Add a provider here after implementing SoundSource.
import { freesound } from './freesound.ts';
import type { SoundSource } from './types.ts';

export const SOURCES: Record<string, SoundSource> = { freesound };
export const DEFAULT_SOURCE = 'freesound';

export function getSource(name = DEFAULT_SOURCE): SoundSource {
  const source = SOURCES[name];
  if (!source) throw new Error(`unknown sound source "${name}" (have: ${Object.keys(SOURCES).join(', ')})`);
  return source;
}

export * from './types.ts';
