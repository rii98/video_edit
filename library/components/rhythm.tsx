// Music-driven motion (beat pulses) and living backgrounds.
import type { CSSProperties, ReactNode } from 'react';
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from 'remotion';
import { useTheme } from '../../src/video/kit';
import { useBeats } from './data';

/**
 * 1 right on a beat, decaying toward 0 until the next one. Use it to drive any property:
 * scale, glow, brightness. `times` are beat times in seconds; `offset` is the music time
 * at which this sequence starts.
 */
export function useBeatEnvelope(times: number[], { offset = 0, decay = 6 }: { offset?: number; decay?: number } = {}): number {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const now = frame / fps + offset;
  let last = -Infinity;
  for (const b of times) {
    if (b > now) break;
    last = b;
  }
  if (last === -Infinity) return 0;
  return Math.exp(-((now - last) * fps) / decay);
}

/**
 * Pulses its children on the beat of a music asset (or explicit beat times).
 * `on: 'downbeats'` pulses once per bar: calmer, and usually what feels right.
 */
export function BeatPulse({ assetId, beats: given, on = 'beats', offset = 0, amount = 0.06, decay = 6, children, style }: {
  assetId?: string;
  beats?: number[];
  on?: 'beats' | 'downbeats';
  offset?: number;
  amount?: number;
  decay?: number;
  children: ReactNode;
  style?: CSSProperties;
}) {
  const loaded = useBeats(given ? undefined : assetId);
  const times = given ?? (on === 'downbeats' ? loaded?.downbeats : loaded?.beats) ?? [];
  const env = useBeatEnvelope(times, { offset, decay });
  return <div style={{ transform: `scale(${1 + amount * env})`, ...style }}>{children}</div>;
}

/**
 * Slow drifting colour fields ("aurora" / mesh gradient), the backdrop of most modern SaaS
 * launches. Deterministic per frame, so renders match the preview exactly.
 */
export function AuroraBackground({ colors, speed = 1, intensity = 0.85 }: { colors?: string[]; speed?: number; intensity?: number }) {
  const t = useTheme();
  const frame = useCurrentFrame();
  const palette = colors ?? [t.colors.accent, t.colors.accent2, t.colors.accent];
  const time = (frame / 30) * speed * (1 / t.tempo);
  const blobs = palette.map((color, i) => {
    const phase = i * 2.1;
    return {
      color,
      x: 50 + 32 * Math.sin(time * 0.35 + phase),
      y: 50 + 26 * Math.cos(time * 0.28 + phase * 1.3),
      r: 38 + 8 * Math.sin(time * 0.5 + phase),
    };
  });
  return (
    <AbsoluteFill style={{ background: t.colors.bg, overflow: 'hidden' }}>
      <AbsoluteFill style={{ filter: 'blur(90px)', opacity: intensity, transform: 'scale(1.2)' }}>
        {blobs.map((b, i) => (
          <div
            key={i}
            style={{
              position: 'absolute',
              left: `${b.x - b.r}%`,
              top: `${b.y - b.r}%`,
              width: `${b.r * 2}%`,
              height: `${b.r * 2}%`,
              borderRadius: '50%',
              background: `radial-gradient(circle, ${b.color} 0%, transparent 65%)`,
              opacity: 0.75,
            }}
          />
        ))}
      </AbsoluteFill>
      {/* Vignette keeps text readable on top. */}
      <AbsoluteFill style={{ background: `radial-gradient(ellipse at center, transparent 40%, ${t.colors.bg} 100%)` }} />
    </AbsoluteFill>
  );
}
