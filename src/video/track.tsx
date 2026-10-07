// Subject tracking in scenes. `npm run ev -- track <id>` writes per-frame face, hand and pose
// landmarks plus a soft person mask; this file turns them into:
//   useTrack(id)      smoothed points at any source time (face, palms, fingertips, shoulders…)
//   <FollowCam>       a virtual camera operator: crops the footage to the canvas, keeps the face
//                     framed, zooms/punches in, and maps tracked points to screen pixels (useCam)
//   <CamFootage>      the footage, placed by the camera
//   <CamMask>         the person mask, placed by the camera: a glow around her, or a cutout of her
//                     (put type between <CamFootage> and a cutout for "text behind the subject")
// All coordinates in the track are 0..1 of the source frame.
import { createContext, useContext, useEffect, useId, useMemo, useState, type CSSProperties, type ReactNode } from "react";
import { cancelRender, continueRender, delayRender, Img, staticFile, useCurrentFrame, useVideoConfig } from 'remotion';
import mediaJson from '../../project/media.json';
import type { MediaManifest } from '../shared/types.ts';
import { Footage } from './kit';
import { Look, type Grade } from './grade';

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

/**
 * The face detector is short-range: in wide shots (a small face) it finds nothing, while the pose
 * model still sees the head. Estimate the face from pose landmarks then (0 nose, 2/5 eyes,
 * 7/8 ears, 9/10 mouth), sized from the ear-to-ear distance.
 */
function faceFromPose(pose: RawFrame['pose']): RawFrame['face'] {
  if (!pose) return null;
  const v = (i: number) => (pose[i]![2] ?? 0) > 0.5;
  if (!v(0) || !v(2) || !v(5)) return null;
  const P = (i: number): Pt => [pose[i]![0], pose[i]![1]];
  const nose = P(0);
  const eyeL = P(2);
  const eyeR = P(5);
  const earSpan = v(7) && v(8) ? Math.abs(pose[7]![0] - pose[8]![0]) : Math.abs(eyeL[0] - eyeR[0]) * 2.4;
  const w = earSpan * 1.05;
  const eyeY = (eyeL[1] + eyeR[1]) / 2;
  const mouth: Pt = v(9) && v(10) ? [(pose[9]![0] + pose[10]![0]) / 2, (pose[9]![1] + pose[10]![1]) / 2] : [nose[0], nose[1] + (nose[1] - eyeY)];
  const unit = mouth[1] - eyeY;
  const top = eyeY - unit * 2.1;
  const chin: Pt = [mouth[0], mouth[1] + unit * 0.9];
  return { box: [nose[0] - w / 2, top, nose[0] + w / 2, chin[1]], nose, eyeL, eyeR, mouth, chin, forehead: [nose[0], top + unit * 0.4] };
}

function build(id: string, raw: RawTrack): Tracker {
  raw = { ...raw, frames: raw.frames.map((f) => (f.face || !f.pose ? f : { ...f, face: faceFromPose(f.pose) })) };
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

// ---- Subject finishing (pairs with <Look> from src/video/grade) -------------------------------

/**
 * Grades the speaker apart from the room the way a colourist does: a tracked, heavily feathered
 * oval (a power window) around head and shoulders carries `grade`, so there's never a hard matte
 * edge. Put it right after <CamFootage> (graded as the room, e.g. inside <Look exposure={-0.8}>).
 * Sized from the face: half-width `width` face widths, half-height `height` face heights,
 * centred `drop` face heights below the face centre. See the subject-room-separation card.
 */
export function SubjectWindow({ id, from = 0, grade, width = 1.75, height = 3, drop = 1.15, core = 0.38 }: {
  id: string;
  from?: number;
  grade: Grade;
  width?: number;
  height?: number;
  drop?: number;
  /** Fraction of the oval at full strength before the feather starts. */
  core?: number;
}) {
  const { toScreen, track, t, box } = useCam();
  const f = track.camFace(t);
  const face = track.face(t);
  const [cx, cy] = toScreen([f.cx, f.cy + f.h * drop]);
  const rx = Math.max(face.w * box.w * width, box.w * 0.18);
  const ry = Math.max(f.h * box.h * height, rx * 1.2);
  const c = Math.round(core * 100);
  const mask = `radial-gradient(ellipse ${rx}px ${ry}px at ${cx}px ${cy}px, #000 0%, #000 ${c}%, rgba(0,0,0,0.62) ${c + (100 - c) * 0.45}%, rgba(0,0,0,0.2) ${c + (100 - c) * 0.78}%, transparent 100%)`;
  return (
    <div style={{ position: 'absolute', inset: 0, WebkitMaskImage: mask, maskImage: mask }}>
      <Look {...grade}>
        <CamFootage id={id} from={from} muted />
      </Look>
    </div>
  );
}

/**
 * Portrait-mode background blur for footage: the room is blurred like a wide-open lens and the
 * speaker (her tracked soft matte) stays sharp on top. Use instead of <CamFootage>.
 * `blur` in px at canvas scale (10 = subtle f/2.8, 20 = strong f/1.4).
 *
 * The room is blurred with her cut OUT and the result renormalised (an SVG blur on a layer with a
 * hole, read back unpremultiplied = average of room pixels only), so her colours never smear
 * into a halo around her the way blurring the whole frame does.
 */
export function PortraitBlur({ id, from = 0, blur = 14, muted = true }: { id: string; from?: number; blur?: number; muted?: boolean }) {
  const { box, t, track } = useCam();
  const src = track.maskSrc(t);
  useImageReady(src);
  const fid = 'pb' + useId().replace(/[^a-zA-Z0-9]/g, '');
  const roomOnly: CSSProperties = {
    position: 'absolute',
    inset: 0,
    WebkitMaskImage: `url(${src}), linear-gradient(#000, #000)`,
    maskImage: `url(${src}), linear-gradient(#000, #000)`,
    WebkitMaskSize: `${box.w}px ${box.h}px, 100% 100%`,
    maskSize: `${box.w}px ${box.h}px, 100% 100%`,
    WebkitMaskPosition: `${box.x}px ${box.y}px, 0 0`,
    maskPosition: `${box.x}px ${box.y}px, 0 0`,
    WebkitMaskRepeat: 'no-repeat',
    maskRepeat: 'no-repeat',
    WebkitMaskComposite: 'xor',
    maskComposite: 'exclude',
  };
  // alpha → 1 wherever any room pixel contributed (≥ 4%): the colour there is already the room average
  const alphaTable = ['0', ...Array(24).fill('1')].join(' ');
  return (
    <>
      <svg width={0} height={0} style={{ position: 'absolute' }}>
        <filter id={fid} x="-10%" y="-10%" width="120%" height="120%" colorInterpolationFilters="sRGB">
          <feGaussianBlur stdDeviation={blur} edgeMode="duplicate" />
          <feComponentTransfer>
            <feFuncA type="discrete" tableValues={alphaTable} />
          </feComponentTransfer>
        </filter>
      </svg>
      {/* fallback deep inside her silhouette, where no room pixel is in reach (hidden by the cutout) */}
      <div style={{ position: 'absolute', inset: 0, filter: `blur(${blur * 2.5}px)`, transform: 'scale(1.06)' }}>
        <CamFootage id={id} from={from} muted />
      </div>
      <div style={{ position: 'absolute', inset: 0, filter: `url(#${fid})` }}>
        <div style={roomOnly}>
          <CamFootage id={id} from={from} muted={muted} />
        </div>
      </div>
      <CamMask id={id} from={from} mode="cutout" />
    </>
  );
}
