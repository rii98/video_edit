// Subject tracking in scenes. `npm run ev -- track <id>` writes per-frame face, hand and pose
// landmarks plus a soft person mask; this file turns them into:
//   useTrack(id)      smoothed points at any source time (face, palms, fingertips, shoulders…)
//   <FollowCam>       a virtual camera operator: crops the footage to the canvas, keeps the face
//                     framed, zooms/punches in, and maps tracked points to screen pixels (useCam)
//   <CamFootage>      the footage, placed by the camera
//   <CamMask>         the person mask, placed by the camera: a glow around her, or a cutout of her
//                     (put type between <CamFootage> and a cutout for "text behind the subject")
// All coordinates in the track are 0..1 of the source frame.
import { createContext, useContext, useEffect, useMemo, useState, type CSSProperties, type ReactNode } from "react";
import { cancelRender, continueRender, delayRender, Img, staticFile, useCurrentFrame, useVideoConfig } from 'remotion';
import mediaJson from '../../project/media.json';
import type { MediaManifest } from '../shared/types.ts';
import { Footage } from './kit';

const media = mediaJson as MediaManifest;

export type Pt = [number, number];
interface RawHand { side: string; score: number; pts: Pt[]; palm: Pt }
interface RawFrame {
  face: { box: [number, number, number, number]; nose: Pt; eyeL: Pt; eyeR: Pt; mouth: Pt; chin: Pt; forehead: Pt } | null;
  hands: RawHand[];
  pose: [number, number, number][] | null;
  body: [number, number, number, number] | null;
}
interface RawTrack { fps: number; width: number; height: number; frames: RawFrame[]; mask: string }

export interface FaceAt { cx: number; cy: number; w: number; h: number; nose: Pt; eyes: Pt; mouth: Pt; chin: Pt; forehead: Pt }
export interface HandAt { palm: Pt; wrist: Pt; thumb: Pt; index: Pt; middle: Pt; pinky: Pt; /** 0..1, fades in/out around gaps */ presence: number }

export interface Tracker {
  fps: number;
  frames: number;
  aspect: number;
  maskSrc: (t: number) => string;
  /** Face, lightly smoothed (for anchoring graphics). */
  face: (t: number) => FaceAt;
  /** Face centre and size, heavily smoothed (for the camera). */
  camFace: (t: number) => { cx: number; cy: number; h: number };
  /** Hands sorted by screen position: [0] is the one on the left of the frame. */
  hand: (t: number, which: 'left' | 'right') => HandAt | null;
  /** Pose landmark (MediaPipe index, e.g. 11/12 shoulders, 15/16 wrists). */
  pose: (t: number, index: number) => Pt;
  body: (t: number) => [number, number, number, number];
}

const cache = new Map<string, RawTrack>();

function gaussian(values: (number | null)[], sigma: number): number[] {
  const r = Math.ceil(sigma * 2.5);
  const out: number[] = [];
  let last = values.find((v) => v !== null) ?? 0.5;
  for (let i = 0; i < values.length; i++) {
    let sum = 0;
    let wsum = 0;
    for (let k = -r; k <= r; k++) {
      const v = values[i + k];
      if (v === null || v === undefined) continue;
      const w = Math.exp(-(k * k) / (2 * sigma * sigma));
      sum += v * w;
      wsum += w;
    }
    if (wsum > 0) last = sum / wsum;
    out.push(last);
  }
  return out;
}

function build(id: string, raw: RawTrack): Tracker {
  const n = raw.frames.length;
  const idx = (t: number) => Math.max(0, Math.min(n - 1, t * raw.fps));
  const series = (get: (f: RawFrame) => number | null | undefined, sigma: number) => gaussian(raw.frames.map((f) => get(f) ?? null), sigma);
  const sample = (arr: number[], t: number) => {
    const x = idx(t);
    const i = Math.floor(x);
    const j = Math.min(n - 1, i + 1);
    return arr[i]! + (arr[j]! - arr[i]!) * (x - i);
  };
  const pt2 = (get: (f: RawFrame) => Pt | null | undefined, sigma: number) => {
    const xs = series((f) => get(f)?.[0], sigma);
    const ys = series((f) => get(f)?.[1], sigma);
    return (t: number): Pt => [sample(xs, t), sample(ys, t)];
  };
  const box = (f: RawFrame) => f.face?.box;
  const fcx = series((f) => (box(f) ? (box(f)![0] + box(f)![2]) / 2 : null), 1.5);
  const fcy = series((f) => (box(f) ? (box(f)![1] + box(f)![3]) / 2 : null), 1.5);
  const fw = series((f) => (box(f) ? box(f)![2] - box(f)![0] : null), 2);
  const fh = series((f) => (box(f) ? box(f)![3] - box(f)![1] : null), 2);
  const ccx = series((f) => (box(f) ? (box(f)![0] + box(f)![2]) / 2 : null), 14);
  const ccy = series((f) => (box(f) ? (box(f)![1] + box(f)![3]) / 2 : null), 14);
  const ch = series((f) => (box(f) ? box(f)![3] - box(f)![1] : null), 20);
  const nose = pt2((f) => f.face?.nose, 1.5);
  const mouth = pt2((f) => f.face?.mouth, 1.5);
  const chin = pt2((f) => f.face?.chin, 1.5);
  const forehead = pt2((f) => f.face?.forehead, 1.5);
  const eyes = pt2((f) => (f.face ? [(f.face.eyeL[0] + f.face.eyeR[0]) / 2, (f.face.eyeL[1] + f.face.eyeR[1]) / 2] : null), 1.5);

  // Hands: assign each detection to the left/right slot by its palm x (stable for a speaker).
  const slot = (f: RawFrame, which: 'left' | 'right'): RawHand | null => {
    const hs = f.hands.filter((h) => h.score > 0.5);
    if (hs.length === 0) return null;
    if (hs.length === 1) {
      const nx = f.face ? (f.face.box[0] + f.face.box[2]) / 2 : 0.5;
      const onLeft = hs[0]!.palm[0] < nx;
      return (which === 'left') === onLeft ? hs[0]! : null;
    }
    const sorted = [...hs].sort((a, b) => a.palm[0] - b.palm[0]);
    return which === 'left' ? sorted[0]! : sorted[sorted.length - 1]!;
  };
  const handSeries = (which: 'left' | 'right') => {
    const get = (k: number) => pt2((f) => slot(f, which)?.pts[k], 1.2);
    const palm = pt2((f) => slot(f, which)?.palm, 1.2);
    const pres = gaussian(raw.frames.map((f) => (slot(f, which) ? 1 : 0)), 2);
    const parts = { wrist: get(0), thumb: get(4), index: get(8), middle: get(12), pinky: get(20) };
    return (t: number): HandAt | null => {
      const p = sample(pres, t);
      if (p < 0.05) return null;
      return { palm: palm(t), wrist: parts.wrist(t), thumb: parts.thumb(t), index: parts.index(t), middle: parts.middle(t), pinky: parts.pinky(t), presence: Math.min(1, p * 1.4) };
    };
  };
  const hands = { left: handSeries('left'), right: handSeries('right') };
  const poseCache = new Map<number, (t: number) => Pt>();
  const bodies = [0, 1, 2, 3].map((k) => series((f) => f.body?.[k], 3));

  return {
    fps: raw.fps,
    frames: n,
    aspect: raw.width / raw.height,
    maskSrc: (t) => staticFile(`analysis/${id}/track/mask/${String(Math.round(idx(t))).padStart(5, '0')}.png`),
    face: (t) => ({ cx: sample(fcx, t), cy: sample(fcy, t), w: sample(fw, t), h: sample(fh, t), nose: nose(t), eyes: eyes(t), mouth: mouth(t), chin: chin(t), forehead: forehead(t) }),
    camFace: (t) => ({ cx: sample(ccx, t), cy: sample(ccy, t), h: sample(ch, t) }),
    hand: (t, which) => hands[which](t),
    pose: (t, i) => {
      if (!poseCache.has(i)) poseCache.set(i, pt2((f) => (f.pose ? [f.pose[i]![0], f.pose[i]![1]] : null), 1.5));
      return poseCache.get(i)!(t);
    },
    body: (t) => bodies.map((b) => sample(b, t)) as [number, number, number, number],
  };
}

/** Loads `analysis/<id>/track/track.json` (run `ev track <id>` first). Null until loaded. */
export function useTrack(id: string): Tracker | null {
  const [raw, setRaw] = useState<RawTrack | null>(() => cache.get(id) ?? null);
  const [handle] = useState(() => (cache.has(id) ? null : delayRender(`track ${id}`)));
  useEffect(() => {
    if (raw) return;
    if (!media.assets[id]) cancelRender(new Error(`useTrack: unknown asset ${id}`));
    fetch(staticFile(`analysis/${id}/track/track.json`))
      .then((r) => {
        if (!r.ok) throw new Error(`No track for ${id}: run \`npm run ev -- track ${id}\``);
        return r.json();
      })
      .then((j: RawTrack) => {
        cache.set(id, j);
        setRaw(j);
        if (handle !== null) continueRender(handle);
      })
      .catch((e) => cancelRender(e));
  }, [id, raw, handle]);
  return useMemo(() => (raw ? build(id, raw) : null), [id, raw]);
}

// ---- Virtual camera ---------------------------------------------------------------------------

export interface Cam {
  /** Source time (seconds) shown at the current frame. */
  t: number;
  track: Tracker;
  /** Source 0..1 point → canvas pixels. */
  toScreen: (p: Pt) => Pt;
  /** Size of the source frame on the canvas, in px (for scaling graphics with zoom). */
  scale: number;
  box: { x: number; y: number; w: number; h: number };
}

const CamContext = createContext<Cam | null>(null);

export function useCam(): Cam {
  const c = useContext(CamContext);
  if (!c) throw new Error('useCam() must be inside <FollowCam>');
  return c;
}

/**
 * Crops `id` to the canvas and frames the subject like a camera operator would.
 * - `from`: source second shown at scene frame 0.
 * - `zoom`: 1 = source height fills the canvas height (cover for vertical canvases). Pass a
 *   number, or a function of the scene frame for push-ins and punch-ins.
 * - `target`: where the face centre should sit on the canvas (0..1). Eyes near the upper third.
 * - `follow`: 0 = locked-off centre crop, 1 = fully follows the (smoothed) face.
 * - `shake`: low-frequency handheld drift in px (smooth, never per-frame jitter).
 */
export function FollowCam({ id, from = 0, zoom = 1, target = [0.5, 0.36], follow = 1, shake = 0, size, overflow = 'hidden', children, style }: {
  id: string;
  from?: number;
  zoom?: number | ((frame: number) => number);
  target?: Pt | ((frame: number) => Pt);
  follow?: number;
  shake?: number;
  /** Viewport size in px when the camera fills a box (a PiP, a polaroid, a split pane); default the canvas. */
  size?: [number, number];
  /** 'visible' lets cutouts spill past the viewport (pop-out-of-frame). */
  overflow?: 'hidden' | 'visible';
  children: ReactNode;
  style?: CSSProperties;
}) {
  const track = useTrack(id);
  const frame = useCurrentFrame();
  const video = useVideoConfig();
  const fps = video.fps;
  const [width, height] = size ?? [video.width, video.height];
  if (!track) return null;
  const t = from + frame / fps;
  const z = typeof zoom === 'function' ? zoom(frame) : zoom;
  const tg = typeof target === 'function' ? target(frame) : target;
  // Base size: cover the canvas.
  const baseH = Math.max(height, width / track.aspect);
  const h = baseH * z;
  const w = h * track.aspect;
  const f = track.camFace(t);
  const fx = 0.5 + (f.cx - 0.5) * follow;
  const fy = 0.45 + (f.cy - 0.45) * follow;
  let x = tg[0] * width - fx * w;
  let y = tg[1] * height - fy * h;
  if (shake) {
    x += shake * (Math.sin(frame * 0.071) * 0.6 + Math.sin(frame * 0.033 + 1.3) * 0.4);
    y += shake * (Math.sin(frame * 0.057 + 2.1) * 0.6 + Math.sin(frame * 0.029) * 0.4);
  }
  // Covering: keep the frame edges inside the viewport. Zoomed out below cover: centre
  // horizontally and sit on the bottom edge (the band above is free for type).
  x = w >= width ? Math.min(0, Math.max(width - w, x)) : (width - w) / 2;
  y = h >= height ? Math.min(0, Math.max(height - h, y)) : height - h;
  const cam: Cam = { t, track, toScreen: (p) => [x + p[0] * w, y + p[1] * h], scale: h, box: { x, y, w, h } };
  return (
    <CamContext.Provider value={cam}>
      <div style={{ position: 'absolute', left: 0, top: 0, width, height, overflow, ...style }}>{children}</div>
    </CamContext.Provider>
  );
}

/** The camera's footage. Pass `from` equal to the FollowCam's `from`. */
export function CamFootage({ id, from = 0, muted, volume, featherTop = 0, style }: { id: string; from?: number; muted?: boolean; volume?: number | ((f: number) => number); featherTop?: number; style?: CSSProperties }) {
  const { box } = useCam();
  // When zoomed out below cover, the frame's top edge is visible: fade it into whatever is behind.
  const feather = featherTop > 0 && box.y > 0 ? Math.min(featherTop, box.y + featherTop * 0.5) : 0;
  const mask = feather ? `linear-gradient(to bottom, transparent 0px, #000 ${feather}px)` : undefined;
  return (
    <div style={{ position: 'absolute', left: box.x, top: box.y, width: box.w, height: box.h, WebkitMaskImage: mask, maskImage: mask, ...style }}>
      <Footage id={id} from={from} muted={muted} volume={volume} />
    </div>
  );
}

/** Waits for a mask image so CSS mask-image is painted in renders (Remotion doesn't track it). */
function useImageReady(src: string): void {
  useEffect(() => {
    const h = delayRender(`mask ${src}`);
    let done = false;
    const finish = () => {
      if (!done) continueRender(h);
      done = true;
    };
    const img = new Image();
    img.src = src;
    img.decode().then(finish, finish);
    return finish;
  }, [src]);
}

/**
 * The person mask, placed by the camera.
 * - mode "glow": a coloured, blurred silhouette (put it under a cutout for a rim glow, or above
 *   the footage alone for an aura). `spread` grows it in px before blurring.
 * - mode "cutout": the speaker cut out of the footage (needs the same `id`/`from` as CamFootage).
 *   Stack type between <CamFootage> and this to put text behind her.
 * - mode "fill": a flat silhouette in `color` (matte / shadow / colour block).
 */
export function CamMask({ id, from = 0, mode, color = '#fff', blur = 24, spread = 0, opacity = 1, featherTop = 0, style }: {
  id: string;
  from?: number;
  mode: 'glow' | 'cutout' | 'fill';
  /** Match CamFootage's featherTop so a cutout doesn't end on a hard line at the frame's top edge. */
  featherTop?: number;
  color?: string;
  blur?: number;
  spread?: number;
  opacity?: number;
  style?: CSSProperties;
}) {
  const { box, t, track } = useCam();
  const src = track.maskSrc(t);
  useImageReady(src);
  const feather = featherTop > 0 && box.y > 0 ? Math.min(featherTop, box.y + featherTop * 0.5) : 0;
  const maskStyle: CSSProperties = feather
    ? {
        WebkitMaskImage: `url(${src}), linear-gradient(to bottom, transparent 0px, #000 ${feather}px)`,
        maskImage: `url(${src}), linear-gradient(to bottom, transparent 0px, #000 ${feather}px)`,
        WebkitMaskSize: '100% 100%, 100% 100%',
        maskSize: '100% 100%, 100% 100%',
        WebkitMaskRepeat: 'no-repeat',
        maskRepeat: 'no-repeat',
        WebkitMaskComposite: 'source-in',
        maskComposite: 'intersect',
      }
    : {
        WebkitMaskImage: `url(${src})`,
        maskImage: `url(${src})`,
        WebkitMaskSize: '100% 100%',
        maskSize: '100% 100%',
        WebkitMaskRepeat: 'no-repeat',
        maskRepeat: 'no-repeat',
      };
  if (mode === 'cutout') {
    return (
      <div style={{ position: 'absolute', left: box.x, top: box.y, width: box.w, height: box.h, ...maskStyle, opacity, ...style }}>
        <Footage id={id} from={from} muted />
      </div>
    );
  }
  const filter = [spread ? `drop-shadow(0 0 ${spread}px ${color}) drop-shadow(0 0 ${spread}px ${color})` : '', mode === 'glow' ? `blur(${blur}px)` : ''].join(' ').trim();
  return (
    <div style={{ position: 'absolute', left: box.x, top: box.y, width: box.w, height: box.h, opacity, filter: filter || undefined, ...style }}>
      <div style={{ position: 'absolute', inset: 0, background: color, ...maskStyle }} />
    </div>
  );
}

/** A hidden <Img> of the current mask frame: lets Remotion's own loading wait cover it too. */
export function MaskPreload() {
  const { t, track } = useCam();
  return <Img src={track.maskSrc(t)} style={{ display: 'none' }} />;
}
