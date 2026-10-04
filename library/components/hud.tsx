// HUD and annotation graphics: rings, badges, callouts. Built for sport/fitness overlays
// (rep counters, tempo cues, timers) and for pointing at things in product footage.
import type { CSSProperties } from 'react';
import { interpolate, useCurrentFrame, useVideoConfig } from 'remotion';
import { Layer, useTheme, type Theme } from '../../src/video/kit';

const clamp = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;

function progress(frame: number, start: number, duration: number, t: Theme, easing = t.ease.standard): number {
  const s = start * t.tempo;
  return interpolate(frame, [s, s + Math.max(1, duration * t.tempo)], [0, 1], { ...clamp, easing });
}

/** Ease-out with a little overshoot: things "land" instead of just stopping. */
const overshoot = (p: number) => 1 + 2.2 * Math.pow(p - 1, 3) + 1.2 * Math.pow(p - 1, 2);

/**
 * Circular progress ring with a big value in the middle, e.g. a rep count, a timer or a
 * score. The arc fills to `progress` (0–1) while the ring pops in.
 */
export function RingCounter({ id, value, label, progress: target = 1, start = 0, duration = 30, size = 220, color, style }: {
  id: string;
  value: string | number;
  label?: string;
  progress?: number;
  start?: number;
  duration?: number;
  size?: number;
  color?: string;
  style?: CSSProperties;
}) {
  const t = useTheme();
  const frame = useCurrentFrame();
  const pop = progress(frame, start, 14, t, (x) => x);
  const fill = progress(frame, start + 4, duration, t) * target;
  const stroke = size * 0.07;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const accent = color ?? t.colors.accent;
  return (
    <Layer id={id} style={{ width: size, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: size * 0.05, transform: `scale(${overshoot(pop)})`, opacity: Math.min(1, pop * 3), ...style }}>
      {label && (
        <div style={{ fontFamily: t.fonts.body, fontWeight: 700, fontSize: size * 0.09, letterSpacing: '0.18em', color: accent, textTransform: 'uppercase' }}>{label}</div>
      )}
      <div style={{ position: 'relative', width: size, height: size }}>
        <svg width={size} height={size} style={{ position: 'absolute', inset: 0, transform: 'rotate(-90deg)' }}>
          <circle cx={size / 2} cy={size / 2} r={r} fill={t.colors.surface} fillOpacity={0.9} stroke={`${t.colors.text}26`} strokeWidth={stroke} />
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={accent} strokeWidth={stroke} strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - fill)} />
        </svg>
        <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', fontFamily: t.fonts.display, fontWeight: t.type.displayWeight, fontSize: size * 0.42, color: t.colors.text, fontVariantNumeric: 'tabular-nums' }}>
          {value}
        </div>
      </div>
    </Layer>
  );
}

/**
 * Pill-shaped tag for cues and stats ("▲ PRESS 0.2s", "FORM CHECK", "NEW"). Expands from
 * its left edge, then the text slides in.
 */
export function Badge({ id, text, icon, tone = 'accent', start = 0, size = 34, style }: {
  id: string;
  text: string;
  icon?: string;
  tone?: 'accent' | 'alert' | 'dark';
  start?: number;
  size?: number;
  style?: CSSProperties;
}) {
  const t = useTheme();
  const frame = useCurrentFrame();
  const grow = progress(frame, start, 12, t, t.ease.emphasized);
  const textIn = progress(frame, start + 5, 12, t);
  const palette = {
    accent: { bg: t.colors.accent, fg: '#0b0b0c', bar: t.colors.accent },
    // Dark tones always sit on a dark pill (they're for use over footage), so their text is
    // light whatever the theme; theme text colour would vanish on light themes.
    alert: { bg: 'rgba(15,15,16,0.85)', fg: '#F5F5F5', bar: t.colors.accent2 },
    dark: { bg: 'rgba(15,15,16,0.85)', fg: '#F5F5F5', bar: t.colors.accent },
  }[tone];
  return (
    <Layer
      id={id}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: size * 0.35,
        padding: `${size * 0.28}px ${size * 0.55}px`,
        borderRadius: size * 0.3,
        background: palette.bg,
        borderLeft: tone === 'accent' ? 'none' : `${size * 0.16}px solid ${palette.bar}`,
        transform: `scaleX(${grow})`,
        transformOrigin: 'left center',
        fontFamily: t.fonts.display,
        fontWeight: t.type.displayWeight,
        textTransform: 'uppercase',
        letterSpacing: '0.02em',
        fontSize: size,
        lineHeight: 1,
        color: palette.fg,
        overflow: 'hidden',
        ...style,
      }}
    >
      {icon && <span style={{ color: tone === 'accent' ? palette.fg : palette.bar, opacity: textIn }}>{icon}</span>}
      <span style={{ opacity: textIn, transform: `translateX(${(1 - textIn) * -16}px)` }}>{text}</span>
    </Layer>
  );
}

/**
 * Hand-drawn style annotation that draws itself onto the frame: circle, underline, box or
 * arrow, with an optional label. Coordinates are composition pixels (x, y = top-left).
 */
export function Callout({ id, x, y, w = 240, h = 120, shape = 'circle', label, start = 0, color, strokeWidth = 8 }: {
  id: string;
  x: number;
  y: number;
  w?: number;
  h?: number;
  shape?: 'circle' | 'underline' | 'box' | 'arrow';
  label?: string;
  start?: number;
  color?: string;
  strokeWidth?: number;
}) {
  const t = useTheme();
  const frame = useCurrentFrame();
  const { width } = useVideoConfig();
  const draw = progress(frame, start, 22, t, t.ease.emphasized);
  // Label sits to the right of the shape, or below it when it would run off the frame.
  const below = shape === 'arrow' || x + w + 360 > width;
  const labelIn = progress(frame, start + 16, 14, t);
  const stroke = color ?? t.colors.accent;
  const pad = strokeWidth * 2;
  // Slightly open, overshooting loop reads as drawn by hand rather than a perfect ellipse.
  const paths = {
    circle: `M ${w * 0.62} ${h * 0.04} C ${w * 1.05} ${h * 0.08}, ${w * 1.04} ${h * 0.95}, ${w * 0.5} ${h * 0.97} C ${-w * 0.04} ${h}, ${-w * 0.03} ${h * 0.06}, ${w * 0.5} ${h * 0.03} L ${w * 0.7} ${h * 0.08}`,
    underline: `M 0 ${h * 0.6} C ${w * 0.3} ${h * 0.45}, ${w * 0.7} ${h * 0.75}, ${w} ${h * 0.55}`,
    box: `M 0 0 H ${w} V ${h} H 0 Z`,
    arrow: `M 0 ${h} C ${w * 0.2} ${h * 0.3}, ${w * 0.6} ${h * 0.1}, ${w} 0 M ${w - w * 0.16} ${h * 0.02} L ${w} 0 L ${w * 0.9} ${h * 0.16}`,
  };
  return (
    <Layer id={id} style={{ position: 'absolute', left: x - pad, top: y - pad, width: w + pad * 2, height: h + pad * 2 }}>
      <svg width={w + pad * 2} height={h + pad * 2} style={{ overflow: 'visible' }}>
        <path
          d={paths[shape]}
          transform={`translate(${pad} ${pad})`}
          fill="none"
          stroke={stroke}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeLinejoin="round"
          pathLength={1}
          strokeDasharray={1}
          strokeDashoffset={1 - draw}
        />
      </svg>
      {label && (
        <Layer
          id={`${id}-label`}
          style={{
            position: 'absolute',
            ...(below ? { right: shape === 'arrow' ? undefined : pad, left: shape === 'arrow' ? -pad : undefined, top: h + pad * 2 + 8 } : { left: w + pad * 2 + 12, top: pad + h / 2 - 24 }),
            whiteSpace: 'nowrap',
            fontFamily: t.fonts.body,
            fontWeight: 700,
            fontSize: 34,
            color: t.colors.bg,
            background: stroke,
            borderRadius: 12,
            padding: '6px 16px',
            opacity: labelIn,
            transform: `translateY(${(1 - labelIn) * 10}px)`,
          }}
        >
          {label}
        </Layer>
      )}
    </Layer>
  );
}
