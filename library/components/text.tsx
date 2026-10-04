// Typography in motion: titles, lower thirds, captions, counters.
import type { CSSProperties } from 'react';
import { interpolate, useCurrentFrame, useVideoConfig } from 'remotion';
import { Layer, useTheme, type Theme } from '../../src/video/kit';
import { useTranscript, type Word } from './data';

const clamp = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;

/** Progress 0→1 over [start, start+duration] frames, tempo-scaled and eased. Not a hook. */
function progress(frame: number, start: number, duration: number, t: Theme, easing = t.ease.standard): number {
  const s = start * t.tempo;
  return interpolate(frame, [s, s + Math.max(1, duration * t.tempo)], [0, 1], { ...clamp, easing });
}

function displayType(t: Theme): CSSProperties {
  return {
    fontFamily: t.fonts.display,
    fontWeight: t.type.displayWeight,
    letterSpacing: t.type.displayTracking,
    textTransform: t.type.uppercaseDisplay ? 'uppercase' : 'none',
    lineHeight: 1.05,
  };
}

export type RevealMode = 'rise' | 'mask' | 'blur' | 'scale';

/**
 * Headline that reveals word by word (or letter by letter). Stagger comes from the theme.
 * `mask` slides each word up out of an invisible line: the cleanest, most "premium" look.
 */
export function KineticTitle({ id, text, start = 0, mode = 'mask', by = 'word', size = 96, color, align = 'center', duration = 20, style }: {
  id: string;
  text: string;
  start?: number;
  mode?: RevealMode;
  by?: 'word' | 'char';
  size?: number;
  color?: string;
  align?: 'left' | 'center' | 'right';
  /** Frames each word takes to arrive. */
  duration?: number;
  style?: CSSProperties;
}) {
  const t = useTheme();
  const frame = useCurrentFrame();
  const parts = by === 'word' ? text.split(/(\s+)/) : Array.from(text);
  let index = 0;
  return (
    <Layer id={id} style={{ ...displayType(t), fontSize: size, color: color ?? t.colors.text, textAlign: align, ...style }}>
      {parts.map((part, i) => {
        if (/^\s+$/.test(part)) return part;
        const p = progress(frame, start + index++ * t.stagger, duration, t, mode === 'mask' ? t.ease.emphasized : t.ease.standard);
        if (mode === 'mask') {
          return (
            <span key={i} style={{ display: 'inline-block', overflow: 'hidden', verticalAlign: 'top', paddingBottom: '0.12em', marginBottom: '-0.12em' }}>
              <span style={{ display: 'inline-block', transform: `translateY(${(1 - p) * 110}%)` }}>{part}</span>
            </span>
          );
        }
        const anim: CSSProperties =
          mode === 'blur'
            ? { opacity: p, filter: `blur(${(1 - p) * 14}px)` }
            : mode === 'scale'
              ? { opacity: p, transform: `scale(${0.5 + 0.5 * p})` }
              : { opacity: p, transform: `translateY(${(1 - p) * 0.45}em)` };
        return <span key={i} style={{ display: 'inline-block', whiteSpace: 'pre', ...anim }}>{part}</span>;
      })}
    </Layer>
  );
}

/**
 * Name/title graphic in the title-safe area. Animates in (~0.5 s), holds, animates out.
 * Broadcast practice: hold long enough to read both lines twice (4–7 s).
 */
export function LowerThird({ id, title, subtitle, start = 0, hold = 150, side = 'left' }: {
  id: string;
  title: string;
  subtitle?: string;
  start?: number;
  /** Frames fully visible. */
  hold?: number;
  side?: 'left' | 'right';
}) {
  const t = useTheme();
  const frame = useCurrentFrame();
  const IN = 16;
  const OUT = 12;
  const bar = progress(frame, start, IN, t, t.ease.emphasized);
  const titleIn = progress(frame, start + 4, IN, t);
  const subIn = progress(frame, start + 9, IN, t);
  const out = progress(frame, start + IN + hold, OUT, t, t.ease.emphasized);
  const visible = (1 - out);
  const dir = side === 'left' ? -1 : 1;
  return (
    <Layer
      id={id}
      style={{
        position: 'absolute',
        bottom: '12%',
        [side]: '8%',
        display: 'flex',
        flexDirection: side === 'left' ? 'row' : 'row-reverse',
        alignItems: 'stretch',
        gap: 20,
        opacity: visible,
        transform: `translateX(${dir * out * 40}px)`,
      }}
    >
      <div style={{ width: 8, borderRadius: 4, background: t.colors.accent, transform: `scaleY(${bar})`, transformOrigin: 'bottom' }} />
      <div style={{ textAlign: side, overflow: 'hidden' }}>
        <Layer id={`${id}-title`} style={{ ...displayType(t), fontSize: 68, color: t.colors.text, transform: `translateX(${dir * (1 - titleIn) * 105}%)` }}>
          {title}
        </Layer>
        {subtitle && (
          <Layer id={`${id}-subtitle`} style={{ fontFamily: t.fonts.body, fontSize: 32, color: t.colors.muted, marginTop: 10, opacity: subIn, transform: `translateY(${(1 - subIn) * 12}px)` }}>
            {subtitle}
          </Layer>
        )}
      </div>
    </Layer>
  );
}

/** Groups words into readable caption blocks: ≤ maxWords, split at pauses and sentence ends. */
export function chunkWords(words: Word[], maxWords: number): Word[][] {
  const chunks: Word[][] = [];
  let current: Word[] = [];
  for (const word of words) {
    const prev = current.at(-1);
    const pause = prev ? word.s - prev.e > 0.45 : false;
    const sentenceEnd = prev ? /[.!?,;:]$/.test(prev.w) : false;
    if (current.length && (current.length >= maxWords || pause || sentenceEnd)) {
      chunks.push(current);
      current = [];
    }
    current.push(word);
  }
  if (current.length) chunks.push(current);
  return chunks;
}

/**
 * Social-style captions: 2–5 words at a time, the spoken word highlighted. Give `assetId` to
 * use that asset's transcript, or `words` directly. `offset` is the source time (s) at which
 * this component's sequence starts, e.g. the `from` you passed to <Footage>.
 */
export function Captions({ id, assetId, words: given, offset = 0, maxWords = 4, size, position = 'auto' }: {
  id: string;
  assetId?: string;
  words?: Word[];
  offset?: number;
  maxWords?: number;
  size?: number;
  position?: 'auto' | 'bottom' | 'center';
}) {
  const t = useTheme();
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const loaded = useTranscript(given ? undefined : assetId);
  const words = given ?? loaded ?? [];
  const now = frame / fps + offset;
  const chunks = chunkWords(words, maxWords);
  const chunkIndex = chunks.findIndex((c, i) => now >= c[0]!.s - 0.05 && now < (chunks[i + 1]?.[0]!.s ?? c.at(-1)!.e + 0.6));
  const chunk = chunks[chunkIndex];
  if (!chunk) return null;

  const vertical = height > width;
  // Vertical: sit above the TikTok/Reels caption band (bottom ~350 px of 1920).
  const bottom = position === 'center' ? '45%' : vertical ? '26%' : '9%';
  const enteredAt = Math.round((chunk[0]!.s - offset) * fps);
  const pop = interpolate(frame - enteredAt, [0, 6], [0.85, 1], { ...clamp, easing: t.ease.standard });
  const fontSize = size ?? (vertical ? 76 : 64);

  return (
    <Layer id={id} style={{ position: 'absolute', left: '7%', right: '7%', bottom, textAlign: 'center', transform: `scale(${pop})` }}>
      {chunk.map((w, i) => {
        const active = now >= w.s && now < w.e + 0.08;
        return (
          <span
            key={i}
            style={{
              ...displayType(t),
              fontSize,
              display: 'inline-block',
              margin: '0 0.06em',
              padding: '0.04em 0.18em',
              borderRadius: '0.18em',
              // Captions sit over footage, so unspoken words are always light (a light theme's
              // dark text colour would vanish), like Badge's dark tones.
              color: active ? t.colors.bg : '#F5F5F5',
              background: active ? t.colors.accent : 'transparent',
              textShadow: active ? 'none' : '0 2px 4px rgba(0,0,0,0.6), 0 3px 18px rgba(0,0,0,0.55)',
            }}
          >
            {w.w}
          </span>
        );
      })}
    </Layer>
  );
}

/** A number that counts up: stats, prices, percentages. Tabular digits so it doesn't jitter. */
export function Counter({ id, from = 0, to, start = 0, duration = 45, decimals = 0, prefix = '', suffix = '', size = 140, color }: {
  id: string;
  from?: number;
  to: number;
  start?: number;
  duration?: number;
  decimals?: number;
  prefix?: string;
  suffix?: string;
  size?: number;
  color?: string;
}) {
  const t = useTheme();
  const frame = useCurrentFrame();
  const p = progress(frame, start, duration, t);
  const value = (from + (to - from) * p).toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
  return (
    <Layer id={id} style={{ ...displayType(t), fontSize: size, color: color ?? t.colors.text, fontVariantNumeric: 'tabular-nums', opacity: Math.min(1, p * 4) }}>
      {prefix}
      {value}
      {suffix}
    </Layer>
  );
}
