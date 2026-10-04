// Media metadata from `ffmpeg -i` (ffmpeg-static ships no ffprobe).
import { ffmpeg } from './ffmpeg.ts';
import type { MediaKind } from '../../src/shared/types.ts';

export const EXTENSIONS: Record<MediaKind, readonly string[]> = {
  video: ['mp4', 'mov', 'm4v', 'webm', 'mkv'],
  image: ['png', 'jpg', 'jpeg', 'webp', 'gif'],
  audio: ['mp3', 'wav', 'm4a', 'aac', 'flac', 'ogg'],
};

export function kindOf(fileName: string): MediaKind | null {
  const ext = fileName.split('.').pop()?.toLowerCase() ?? '';
  for (const [kind, exts] of Object.entries(EXTENSIONS) as [MediaKind, readonly string[]][]) {
    if (exts.includes(ext)) return kind;
  }
  return null;
}

export interface ProbeResult {
  duration?: number;
  width?: number;
  height?: number;
  fps?: number;
  hasAudio: boolean;
  hasVideo: boolean;
}

/** Parses the stream summary ffmpeg prints for an input. Exported for tests. */
export function parseProbe(stderr: string): ProbeResult {
  const result: ProbeResult = { hasAudio: false, hasVideo: false };

  const d = stderr.match(/Duration: (\d+):(\d+):(\d+(?:\.\d+)?)/);
  if (d) result.duration = Number(d[1]) * 3600 + Number(d[2]) * 60 + Number(d[3]);

  for (const line of stderr.split('\n')) {
    if (!/^\s*Stream #/.test(line)) continue;
    if (/: Audio: /.test(line)) result.hasAudio = true;
    // Cover art in audio files is a video stream marked "attached pic"; it isn't footage.
    if (/: Video: /.test(line) && !/attached pic/.test(line) && !result.hasVideo) {
      result.hasVideo = true;
      const size = line.match(/, (\d{2,5})x(\d{2,5})[,\s]/);
      if (size) {
        result.width = Number(size[1]);
        result.height = Number(size[2]);
      }
      const fps = line.match(/, (\d+(?:\.\d+)?) fps/) ?? line.match(/, (\d+(?:\.\d+)?) tbr/);
      if (fps) result.fps = Number(fps[1]);
    }
  }

  // Phones record portrait as landscape + a rotation flag.
  const rotation = stderr.match(/rotation of (-?\d+(?:\.\d+)?) degrees/);
  if (rotation && Math.abs(Number(rotation[1])) % 180 === 90 && result.width && result.height) {
    [result.width, result.height] = [result.height, result.width];
  }
  return result;
}

export async function probe(file: string): Promise<ProbeResult> {
  // With no output file ffmpeg exits 1 after printing the input summary; that's expected.
  const { stderr } = await ffmpeg(['-i', file], { okExitCodes: [1] });
  if (/Invalid data found|No such file/.test(stderr)) throw new Error('Not a readable media file');
  return parseProbe(stderr);
}
