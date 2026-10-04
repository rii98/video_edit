// Renders composition frames to PNG. One bundle + one browser per call, however many frames,
// because bundling dominates the cost.
import { join } from 'node:path';
import { bundle } from '@remotion/bundler';
import { openBrowser, renderStill, selectComposition } from '@remotion/renderer';
import type { MainProps } from '../src/shared/types.ts';
import { createHash } from 'node:crypto';
import { ROOT } from '../server/store.ts';
import { activeProject } from '../server/projects.ts';
import { ensureMediaDirs, MEDIA_DIR } from '../server/media/library.ts';

export interface StillJob {
  frame: number;
  output: string;
  /** Defaults to the project video ("Main"); library demos are "Demo-<Name>". */
  composition?: string;
  props?: Partial<MainProps> | Record<string, unknown>;
}

/** Half resolution is plenty to judge layout and keeps images cheap for Claude to look at. */
const SCALE = 0.5;

/**
 * Bundles the video for rendering. Media is symlinked (not copied: raw footage can be
 * gigabytes). Every project lives at the same project/ path, so webpack's on-disk cache is
 * namespaced per project (and per entry) to stop one video's cached modules leaking into another's.
 */
export async function bundleVideo(entryPoint = join(ROOT, 'src/video/index.ts')): Promise<string> {
  ensureMediaDirs();
  const tag = createHash('sha1').update(`${activeProject().slug}\n${entryPoint}`).digest('hex').slice(0, 10);
  return bundle({
    entryPoint,
    publicDir: MEDIA_DIR,
    symlinkPublicDir: true,
    webpackOverride: (config) => (config.cache && typeof config.cache === 'object' ? { ...config, cache: { ...config.cache, name: `${(config.cache as { name?: string }).name ?? 'remotion'}-${tag}` } } : config),
  });
}

/** `entryPoint` lets version comparisons render an older project from a scratch workspace. */
export async function renderStills(jobs: StillJob[], { entryPoint = join(ROOT, 'src/video/index.ts') } = {}): Promise<string[]> {
  const serveUrl = await bundleVideo(entryPoint);
  const browser = await openBrowser('chrome');
  try {
    const base: MainProps = { pin: null, region: null, proxy: true };
    const compositions = new Map<string, Awaited<ReturnType<typeof selectComposition>>>();
    const outputs: string[] = [];
    for (const job of jobs) {
      const id = job.composition ?? 'Main';
      if (!compositions.has(id)) compositions.set(id, await selectComposition({ serveUrl, id, inputProps: { ...base }, puppeteerInstance: browser }));
      const composition = compositions.get(id)!;
      const frame = Math.min(Math.max(0, job.frame), composition.durationInFrames - 1);
      // In Remotion v4 the component receives composition.props, not inputProps, so a
      // per-frame annotation must be merged into the composition itself.
      const props = { ...base, ...job.props };
      await renderStill({
        serveUrl,
        composition: { ...composition, props: { ...composition.props, ...props } },
        frame,
        output: job.output,
        inputProps: props,
        scale: SCALE,
        imageFormat: 'png',
        puppeteerInstance: browser,
      });
      outputs.push(job.output);
    }
    return outputs;
  } finally {
    await browser.close({ silent: true });
  }
}
