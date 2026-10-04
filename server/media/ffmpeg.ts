// Thin, promise-based ffmpeg runner. Uses the full build from ffmpeg-static
// (Remotion's bundled ffmpeg lacks scdet/tile/sidechaincompress/afftdn).
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
export const FFMPEG: string = require('ffmpeg-static');

export interface RunResult {
  stderr: string;
  stdout: Buffer;
}

/** Runs ffmpeg; rejects with the tail of stderr on a non-zero exit. */
export function ffmpeg(args: string[], opts: { okExitCodes?: number[]; onStdout?: (chunk: Buffer) => void } = {}): Promise<RunResult> {
  return new Promise((resolve, reject) => {
    const child = spawn(FFMPEG, ['-hide_banner', '-nostdin', ...args], { stdio: ['ignore', 'pipe', 'pipe'] });
    const out: Buffer[] = [];
    let err = '';
    child.stdout.on('data', (chunk: Buffer) => (opts.onStdout ? opts.onStdout(chunk) : out.push(chunk)));
    child.stderr.on('data', (chunk: Buffer) => {
      err += chunk.toString('utf8');
      // Keep memory bounded on long jobs; parsers only need recent output plus summaries.
      if (err.length > 8_000_000) err = err.slice(-4_000_000);
    });
    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0 || opts.okExitCodes?.includes(code ?? -1)) resolve({ stderr: err, stdout: Buffer.concat(out) });
      else reject(new Error(`ffmpeg exited with ${code}: ${err.trim().split('\n').slice(-3).join(' | ')}`));
    });
  });
}

/** Decodes the first audio stream to mono float32 PCM. */
export async function decodePcm(file: string, sampleRate: number, maxSeconds?: number): Promise<Float32Array> {
  const limit = maxSeconds ? ['-t', String(maxSeconds)] : [];
  const { stdout } = await ffmpeg(['-i', file, ...limit, '-vn', '-ac', '1', '-ar', String(sampleRate), '-f', 'f32le', 'pipe:1']);
  // Copy into an aligned buffer; Buffer.concat may return an unaligned view.
  const aligned = new Float32Array(stdout.length / 4);
  new Uint8Array(aligned.buffer).set(stdout.subarray(0, aligned.length * 4));
  return aligned;
}
