// Plays a Blender (Cycles) render made with `npm run ev -- blender <script> --name=<name>`:
// one PNG per scene frame under project/media/renders/<name>/. Frame-exact (Remotion waits for
// each <Img>), with alpha when rendered --transparent. Wrap it in a sized <Layer> like footage.
import { Img, staticFile, useCurrentFrame } from 'remotion';
import type { CSSProperties } from 'react';

export function BlenderShot({ name, offset = 0, hold, fit = 'cover', style }: {
  name: string;
  /** Render frame shown at this component's frame 0 (renders are numbered by scene frame). */
  offset?: number;
  /** Rendered frame range [first, last]: frames outside it hold the nearest end (e.g. a still: [60, 60]). */
  hold?: [number, number];
  fit?: 'cover' | 'contain';
  style?: CSSProperties;
}) {
  const f = useCurrentFrame() + offset;
  const n = hold ? Math.min(hold[1], Math.max(hold[0], f)) : f;
  return <Img src={staticFile(`renders/${name}/${String(n).padStart(5, '0')}.png`)} style={{ width: '100%', height: '100%', objectFit: fit, ...style }} />;
}
