// Building blocks every scene uses. Scenes import from here, never from Remotion internals
// they don't need, so conventions (layer ids, theme, easing) stay consistent.
import { createContext, useContext, useMemo, type CSSProperties, type ReactNode } from 'react';
import { AbsoluteFill, Audio, Easing, Img, interpolate, OffthreadVideo, staticFile, useCurrentFrame, useVideoConfig } from 'remotion';
import tokens from '../../project/theme/tokens.json';
import mediaJson from '../../project/media.json';
import type { MediaManifest, ThemeTokens } from '../shared/types.ts';
import { fontStack } from './fonts';

const media = mediaJson as MediaManifest;

// ---- Theme ------------------------------------------------------------------------------

export type EasingFn = (t: number) => number;

/** Theme tokens with fonts resolved to CSS stacks and easing curves turned into functions. */
export type Theme = Omit<ThemeTokens, 'fonts'> & {
  fonts: ThemeTokens['fonts'];
  ease: { standard: EasingFn; emphasized: EasingFn };
};

const bezier = (curve: number[]) => Easing.bezier(curve[0]!, curve[1]!, curve[2]!, curve[3]!);

export function resolveTheme(t: ThemeTokens): Theme {
  return {
    ...t,
    fonts: { display: fontStack(t.fonts.display), body: fontStack(t.fonts.body), mono: fontStack(t.fonts.mono) },
    ease: { standard: bezier(t.easing.standard), emphasized: bezier(t.easing.emphasized) },
  };
}

/** The project's theme (project/theme/tokens.json). Prefer useTheme() in components. */
export const theme: Theme = resolveTheme(tokens as ThemeTokens);
export const ease = theme.ease;

const ThemeContext = createContext<Theme>(theme);

/** Overrides the theme for a subtree; the Library gallery uses it to preview presets. */
export function ThemeProvider({ tokens: override, children }: { tokens: ThemeTokens; children: ReactNode }) {
  const resolved = useMemo(() => resolveTheme(override), [override]);
  return <ThemeContext.Provider value={resolved}>{children}</ThemeContext.Provider>;
}

export function useTheme(): Theme {
  return useContext(ThemeContext);
}

const SceneIdContext = createContext<string>('unknown');

export function SceneProvider({ id, children }: { id: string; children: ReactNode }) {
  return <SceneIdContext.Provider value={id}>{children}</SceneIdContext.Provider>;
}

export function useSceneId(): string {
  return useContext(SceneIdContext);
}

/**
 * Every visible element must be wrapped in a Layer. The id becomes `<sceneId>.<id>`,
 * which is how a click in the editor maps back to the exact code that drew it.
 */
export function Layer({
  id,
  style,
  children,
}: {
  id: string;
  style?: CSSProperties;
  children?: ReactNode;
}) {
  const sceneId = useSceneId();
  return (
    <div data-layer={`${sceneId}.${id}`} style={style}>
      {children}
    </div>
  );
}

/**
 * 0→1 progress over [start, start + duration) in scene-local frames, eased and clamped.
 * Durations are scaled by the theme tempo so one token can speed up or calm down a video.
 */
export function useProgress(start: number, duration: number, easing?: EasingFn): number {
  const frame = useCurrentFrame();
  const t = useTheme();
  const d = Math.max(1, duration * t.tempo);
  const s = start * t.tempo;
  return interpolate(frame, [s, s + d], [0, 1], {
    easing: easing ?? t.ease.standard,
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
}

/** Common entrance: fade in while rising `distance` px. */
export function useFadeUp(start: number, duration = 24, distance = 24): CSSProperties {
  const p = useProgress(start, duration);
  return { opacity: p, transform: `translateY(${(1 - p) * distance}px)` };
}

// ---- Media --------------------------------------------------------------------------------
// Scenes reference media by asset id (see `npm run ev -- media`). Preview and snapshots
// play lightweight proxies; final renders use the original files.

const MediaModeContext = createContext({ proxy: false });

export function MediaModeProvider({ proxy, children }: { proxy: boolean; children: ReactNode }) {
  return <MediaModeContext.Provider value={{ proxy }}>{children}</MediaModeContext.Provider>;
}

function useAssetSrc(id: string): string | null {
  const { proxy } = useContext(MediaModeContext);
  const asset = media.assets[id];
  if (!asset) return null;
  return staticFile(proxy && asset.proxy ? asset.proxy : asset.file);
}

function MissingAsset({ id }: { id: string }) {
  return (
    <AbsoluteFill style={{ background: '#300', color: '#fff', alignItems: 'center', justifyContent: 'center', fontSize: 36, fontFamily: 'monospace' }}>
      Missing media "{id}"
    </AbsoluteFill>
  );
}

type Fit = 'cover' | 'contain';

/**
 * A clip of footage. `from`/`to` trim the source in seconds; the clip starts playing when
 * its parent Sequence (or scene) starts. Fills its container; size it with a wrapper.
 */
export function Footage({ id, from = 0, to, volume = 1, muted = false, fit = 'cover', playbackRate = 1, style }: { id: string; from?: number; to?: number; volume?: number | ((frame: number) => number); muted?: boolean; fit?: Fit; playbackRate?: number; style?: CSSProperties }) {
  const src = useAssetSrc(id);
  const { fps } = useVideoConfig();
  if (!src) return <MissingAsset id={id} />;
  return (
    <OffthreadVideo
      src={src}
      trimBefore={Math.round(from * fps)}
      trimAfter={to !== undefined ? Math.round(to * fps) : undefined}
      volume={volume}
      muted={muted}
      playbackRate={playbackRate}
      style={{ width: '100%', height: '100%', objectFit: fit, ...style }}
    />
  );
}

/** A still image asset. Fills its container. */
export function Picture({ id, fit = 'cover', style }: { id: string; fit?: Fit; style?: CSSProperties }) {
  const src = useAssetSrc(id);
  if (!src) return <MissingAsset id={id} />;
  return <Img src={src} style={{ width: '100%', height: '100%', objectFit: fit, ...style }} />;
}

/** Music or any audio asset. `volume` may be a function of the frame for fades/ducking. */
export function Music({ id, from = 0, to, volume = 1 }: { id: string; from?: number; to?: number; volume?: number | ((frame: number) => number) }) {
  const src = useAssetSrc(id);
  const { fps } = useVideoConfig();
  if (!src) return null;
  return <Audio src={src} trimBefore={Math.round(from * fps)} trimAfter={to !== undefined ? Math.round(to * fps) : undefined} volume={volume} />;
}
