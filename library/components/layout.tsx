// Composition and camera: split screens, device frames, zoom/pan, mask reveals.
import type { CSSProperties, ReactNode } from 'react';
import { AbsoluteFill, interpolate, useCurrentFrame } from 'remotion';
import { Layer, useTheme, type Theme } from '../../src/video/kit';

const clamp = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;

function progress(frame: number, start: number, duration: number, t: Theme, easing = t.ease.emphasized): number {
  const s = start * t.tempo;
  return interpolate(frame, [s, s + Math.max(1, duration * t.tempo)], [0, 1], { ...clamp, easing });
}

/**
 * Two panes side by side (`horizontal`) or stacked (`vertical`). Panes slide in from
 * opposite edges and a divider draws between them. Keep subjects at similar scale in
 * both panes so viewers can compare without mentally resizing.
 */
export function SplitScreen({ id, a, b, direction = 'horizontal', ratio = 0.5, start = 0, duration = 24, gap = 0, divider = true }: {
  id: string;
  a: ReactNode;
  b: ReactNode;
  direction?: 'horizontal' | 'vertical';
  ratio?: number;
  start?: number;
  duration?: number;
  gap?: number;
  divider?: boolean;
}) {
  const t = useTheme();
  const frame = useCurrentFrame();
  const pa = progress(frame, start, duration, t);
  const pb = progress(frame, start + 4, duration, t);
  const line = progress(frame, start + 8, duration, t);
  const h = direction === 'horizontal';
  const pct = (n: number) => `${n * 100}%`;
  const pane = (first: boolean, p: number): CSSProperties => ({
    position: 'absolute',
    overflow: 'hidden',
    ...(h
      ? { top: 0, bottom: 0, left: first ? 0 : `calc(${pct(ratio)} + ${gap / 2}px)`, width: `calc(${pct(first ? ratio : 1 - ratio)} - ${gap / 2}px)` }
      : { left: 0, right: 0, top: first ? 0 : `calc(${pct(ratio)} + ${gap / 2}px)`, height: `calc(${pct(first ? ratio : 1 - ratio)} - ${gap / 2}px)` }),
    transform: h ? `translateX(${(first ? -1 : 1) * (1 - p) * 100}%)` : `translateY(${(first ? -1 : 1) * (1 - p) * 100}%)`,
  });
  return (
    <Layer id={id} style={{ position: 'absolute', inset: 0, overflow: 'hidden' }}>
      <Layer id={`${id}-a`} style={pane(true, pa)}>{a}</Layer>
      <Layer id={`${id}-b`} style={pane(false, pb)}>{b}</Layer>
      {divider && gap === 0 && (
        <div
          style={{
            position: 'absolute',
            background: t.colors.accent,
            ...(h
              ? { left: pct(ratio), top: 0, bottom: 0, width: 6, marginLeft: -3, transform: `scaleY(${line})` }
              : { top: pct(ratio), left: 0, right: 0, height: 6, marginTop: -3, transform: `scaleX(${line})` }),
          }}
        />
      )}
    </Layer>
  );
}

/**
 * Puts footage/screens inside a device: `phone` (portrait), `browser` (window chrome), or
 * `laptop`. Rises in and floats gently, the standard look for product and app demos.
 */
export function DeviceFrame({ id, device = 'phone', children, start = 0, width, float = true, url = 'yourproduct.com' }: {
  id: string;
  device?: 'phone' | 'browser' | 'laptop';
  children: ReactNode;
  start?: number;
  /** Outer width in px. Defaults suit a 1920×1080 frame. */
  width?: number;
  float?: boolean;
  url?: string;
}) {
  const t = useTheme();
  const frame = useCurrentFrame();
  const p = progress(frame, start, 30, t, t.ease.standard);
  const bob = float ? Math.sin((frame - start) / (40 * t.tempo)) * 8 * p : 0;
  const motion: CSSProperties = { opacity: p, transform: `translateY(${(1 - p) * 80 + bob}px) scale(${0.94 + 0.06 * p})` };
  const shadow = '0 40px 120px rgba(0,0,0,0.35)';

  if (device === 'phone') {
    const w = width ?? 420;
    return (
      <Layer id={id} style={{ width: w, aspectRatio: '9 / 19.5', borderRadius: w * 0.16, background: '#0d0d0f', padding: w * 0.035, boxShadow: shadow, ...motion }}>
        <div style={{ position: 'relative', width: '100%', height: '100%', borderRadius: w * 0.13, overflow: 'hidden', background: '#000' }}>
          <Layer id={`${id}-screen`} style={{ position: 'absolute', inset: 0 }}>{children}</Layer>
          <div style={{ position: 'absolute', top: w * 0.03, left: '50%', width: w * 0.3, height: w * 0.075, marginLeft: -w * 0.15, borderRadius: 999, background: '#000' }} />
        </div>
      </Layer>
    );
  }

  const w = width ?? 1280;
  const chrome = (
    <div style={{ height: 44, display: 'flex', alignItems: 'center', gap: 8, padding: '0 16px', background: t.colors.surface, borderBottom: `1px solid ${t.colors.muted}33` }}>
      {['#ff5f57', '#febc2e', '#28c840'].map((c) => <span key={c} style={{ width: 12, height: 12, borderRadius: 6, background: c }} />)}
      <span style={{ marginLeft: 16, flex: 1, maxWidth: 420, height: 26, borderRadius: 8, background: `${t.colors.muted}22`, fontFamily: t.fonts.body, fontSize: 14, color: t.colors.muted, display: 'flex', alignItems: 'center', paddingLeft: 12 }}>{url}</span>
    </div>
  );
  const screen = (
    <div style={{ position: 'relative', aspectRatio: '16 / 10', overflow: 'hidden', background: '#000' }}>
      <Layer id={`${id}-screen`} style={{ position: 'absolute', inset: 0 }}>{children}</Layer>
    </div>
  );
  if (device === 'browser') {
    return (
      <Layer id={id} style={{ width: w, borderRadius: 14, overflow: 'hidden', boxShadow: shadow, border: `1px solid ${t.colors.muted}33`, ...motion }}>
        {chrome}
        {screen}
      </Layer>
    );
  }
  return (
    <Layer id={id} style={{ width: w, ...motion }}>
      <div style={{ margin: '0 6%', borderRadius: '18px 18px 0 0', background: '#0d0d0f', padding: 14, boxShadow: shadow }}>{screen}</div>
      <div style={{ height: 22, borderRadius: '0 0 18px 18px', background: 'linear-gradient(#cfd2d6, #9da1a6)' }} />
    </Layer>
  );
}

export interface CameraKey {
  /** Frame (relative to this component's sequence) at which this framing is reached. */
  at: number;
  /** Point of the content to centre, 0–1. */
  x: number;
  y: number;
  scale: number;
}

/**
 * Virtual camera over its children: push-ins, pans, zoom-to-click on screen recordings.
 * Keys are reached with emphasized easing; edges never show (focus is clamped).
 */
export function ZoomPan({ keys, children, style }: { keys: CameraKey[]; children: ReactNode; style?: CSSProperties }) {
  const t = useTheme();
  const frame = useCurrentFrame();
  const sorted = [...keys].sort((a, b) => a.at - b.at);
  let cam = sorted[0] ?? { at: 0, x: 0.5, y: 0.5, scale: 1 };
  for (let i = 0; i < sorted.length - 1; i++) {
    const k0 = sorted[i]!;
    const k1 = sorted[i + 1]!;
    if (frame >= k0.at) {
      const p = interpolate(frame, [k0.at, k1.at], [0, 1], { ...clamp, easing: t.ease.emphasized });
      cam = { at: frame, x: k0.x + (k1.x - k0.x) * p, y: k0.y + (k1.y - k0.y) * p, scale: k0.scale + (k1.scale - k0.scale) * p };
    }
  }
  const s = Math.max(1, cam.scale);
  const fx = Math.min(1 - 0.5 / s, Math.max(0.5 / s, cam.x));
  const fy = Math.min(1 - 0.5 / s, Math.max(0.5 / s, cam.y));
  return (
    <AbsoluteFill style={{ overflow: 'hidden', ...style }}>
      <AbsoluteFill style={{ transformOrigin: '0 0', transform: `translate(${(0.5 - s * fx) * 100}%, ${(0.5 - s * fy) * 100}%) scale(${s})` }}>{children}</AbsoluteFill>
    </AbsoluteFill>
  );
}

/** Reveals its children through an animated mask: wipes, an expanding circle, or an inset. */
export function MaskReveal({ children, start = 0, duration = 24, shape = 'wipe-right', style }: {
  children: ReactNode;
  start?: number;
  duration?: number;
  shape?: 'wipe-right' | 'wipe-left' | 'wipe-up' | 'circle' | 'inset';
  style?: CSSProperties;
}) {
  const t = useTheme();
  const frame = useCurrentFrame();
  const p = progress(frame, start, duration, t);
  const r = (1 - p) * 100;
  const clipPath = {
    'wipe-right': `inset(0 ${r}% 0 0)`,
    'wipe-left': `inset(0 0 0 ${r}%)`,
    'wipe-up': `inset(${r}% 0 0 0)`,
    circle: `circle(${p * 75}% at 50% 50%)`,
    inset: `inset(${r / 2}% round ${t.radius}px)`,
  }[shape];
  return <AbsoluteFill style={{ clipPath, ...style }}>{children}</AbsoluteFill>;
}
