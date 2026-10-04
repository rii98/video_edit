// Tiles labelled images into one contact sheet: one image is far cheaper for Claude to
// look at than many, and a grid makes side-by-side comparison easy.
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { FFMPEG } from '../server/media/ffmpeg.ts';

const FONT = ['/System/Library/Fonts/Supplemental/Arial.ttf', '/System/Library/Fonts/Helvetica.ttc'].find(existsSync);

/** All images must share an aspect ratio. Labels are drawn top-left of each tile. */
export function makeSheet(images: string[], labels: string[], output: string, { cols, tileWidth }: { cols: number; tileWidth: number }): string {
  const escape = (s: string) => s.replace(/\\/g, '\\\\').replace(/'/g, '\u2019').replace(/:/g, '\\:').replace(/%/g, '\\%');
  const labelled = images.map((img, i) => {
    const out = img.replace(/\.png$/, '.label.png');
    const text = FONT && labels[i] ? `,drawtext=fontfile='${FONT}':text='${escape(labels[i]!)}':x=12:y=12:fontsize=24:fontcolor=white:box=1:boxcolor=black@0.7:boxborderw=8` : '';
    execFileSync(FFMPEG, ['-v', 'error', '-y', '-i', img, '-vf', `scale=${tileWidth}:-2${text}`, out]);
    return out;
  });
  return tile(labelled, output, cols, tileWidth);
}

/** Reads an image's size from ffmpeg's input summary (it exits 1 with no output given). */
function imageHeight(path: string): number {
  try {
    execFileSync(FFMPEG, ['-hide_banner', '-i', path], { stdio: ['ignore', 'pipe', 'pipe'] });
  } catch (err) {
    const m = String((err as { stderr?: Buffer }).stderr ?? '').match(/, (\d+)x(\d+)/);
    if (m) return Number(m[2]);
  }
  throw new Error(`could not read the size of ${path}`);
}

function tile(images: string[], output: string, cols: number, tileWidth: number): string {
  const tileHeight = imageHeight(images[0]!);
  const gap = 4;
  const rows = Math.ceil(images.length / cols);
  const layout = images.map((_, i) => `${(i % cols) * (tileWidth + gap)}_${Math.floor(i / cols) * (tileHeight + gap)}`).join('|');
  const inputs = images.flatMap((img) => ['-i', img]);
  const graph =
    images.length === 1
      ? '[0]null'
      : `${images.map((_, i) => `[${i}]`).join('')}xstack=inputs=${images.length}:layout=${layout}:fill=0x111111`;
  execFileSync(FFMPEG, ['-v', 'error', '-y', ...inputs, '-filter_complex', `${graph},pad=${cols * (tileWidth + gap) - gap}:${rows * (tileHeight + gap) - gap}:0:0:0x111111`, '-q:v', '3', output]);
  return output;
}
