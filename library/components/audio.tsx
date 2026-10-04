// Sound in scenes: effects at a frame, voiceover, and music that ducks under speech.
import { useMemo } from 'react';
import { Sequence, useVideoConfig } from 'remotion';
import { Music } from '../../src/video/kit';
import { useTranscript } from './data';
import { duckGain, speechIntervals } from './ducking';

/** A sound effect asset (see `ev sfx`) played at frame `at` of the current sequence. */
export function Sfx({ id, at = 0, volume = 0.8 }: { id: string; at?: number; volume?: number }) {
  return (
    <Sequence from={at} layout="none" name={`sfx ${id}`}>
      <Music id={id} volume={volume} />
    </Sequence>
  );
}

/** A voiceover asset (see `ev tts`, or a recording) starting at frame `at`. */
export function Voiceover({ id, at = 0, volume = 1 }: { id: string; at?: number; volume?: number }) {
  return (
    <Sequence from={at} layout="none" name={`voice ${id}`}>
      <Music id={id} volume={volume} />
    </Sequence>
  );
}

/**
 * A volume function that dips under a voiceover, for <Music> or <Footage> (e.g. footage
 * whose own soundtrack should duck under narration). `voiceAt` is the frame where the
 * voice starts, in the same sequence as the sound being ducked.
 */
export function useDuckVolume(voiceId: string, { voiceAt = 0, volume = 0.8, duckTo = 0.4 } = {}): (frame: number) => number {
  const { fps } = useVideoConfig();
  const words = useTranscript(voiceId);
  const intervals = useMemo(() => speechIntervals(words ?? []), [words]);
  return (f: number) => volume * duckGain(intervals, (f - voiceAt) / fps, { duckTo });
}

/**
 * Music that automatically dips under a voiceover, using the voice's word timings.
 * `voiceAt` is the frame where the voice starts (same sequence as this music);
 * `from` trims the music's start in seconds.
 */
export function DuckedMusic({ id, voiceId, voiceAt = 0, from = 0, volume = 0.8, duckTo = 0.4 }: {
  id: string;
  voiceId: string;
  voiceAt?: number;
  from?: number;
  volume?: number;
  duckTo?: number;
}) {
  const duck = useDuckVolume(voiceId, { voiceAt, volume, duckTo });
  return <Music id={id} from={from} volume={duck} />;
}
