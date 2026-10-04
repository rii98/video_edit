// Loads cached media analysis (transcripts, beats) inside compositions. Renders wait for
// the data via delayRender, so stills and exports never capture a half-loaded frame.
import { useEffect, useRef, useState } from 'react';
import { continueRender, delayRender, staticFile } from 'remotion';

export function useAnalysis<T>(assetId: string | undefined, file: string): T | null {
  const [data, setData] = useState<T | null>(null);
  const handle = useRef<number | null>(null);
  if (assetId && handle.current === null) handle.current = delayRender(`Loading ${file} for ${assetId}`);

  useEffect(() => {
    if (!assetId) return;
    let cancelled = false;
    const release = () => {
      if (handle.current !== null) {
        continueRender(handle.current);
        handle.current = -1; // released; never release twice (StrictMode runs effects twice)
      }
    };
    fetch(staticFile(`analysis/${assetId}/${file}`))
      .then((r) => (r.ok ? (r.json() as Promise<T>) : null))
      .then((json) => !cancelled && setData(json))
      .catch(() => {})
      .finally(release);
    return () => {
      cancelled = true;
    };
  }, [assetId, file]);

  return data;
}

export interface Word {
  w: string;
  s: number;
  e: number;
}

export function useTranscript(assetId: string | undefined): Word[] | null {
  return useAnalysis<{ words: Word[] }>(assetId, 'transcript.json')?.words ?? null;
}

export interface Beats {
  bpm: number;
  beats: number[];
  downbeats: number[];
  sections: { start: number; energy: 'low' | 'mid' | 'high' }[];
}

export function useBeats(assetId: string | undefined): Beats | null {
  return useAnalysis<Beats>(assetId, 'beats.json');
}
