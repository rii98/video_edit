// Subject tracking for footage: face, hands, body pose and a soft person mask for every frame.
// Runs Google's MediaPipe models (WASM, CPU) inside Playwright's headless Chromium, so it needs
// no Python and no GPU. Scenes read the result with useTrack / FollowCam / CamMask (src/video/track.tsx):
// words that follow a hand, a glow around the speaker, type behind her, a virtual camera that
// keeps her framed in a vertical crop.
//
// Output (public via staticFile, like every analysis file):
//   analysis/<id>/track/track.json   per-frame landmarks, normalised 0..1 in the source frame
//   analysis/<id>/track/mask/NNNNN.png  white with alpha = person confidence, 1280×720
import { createServer } from 'node:http';
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { extname, join, normalize } from 'node:path';
import { ROOT } from '../store.ts';
import { ffmpeg } from './ffmpeg.ts';
import { analysisDir, mediaPath } from './library.ts';

export const TRACK_FPS = 30;
const FRAME_W = 1920;
const FRAME_H = 1080;
const MASK_W = 1280;
const MASK_H = 720;
const MODELS_DIR = join(ROOT, '.cache', 'mediapipe');
const MODELS: Record<string, string> = {
  'face_landmarker.task': 'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/latest/face_landmarker.task',
  'hand_landmarker.task': 'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/latest/hand_landmarker.task',
  'pose_landmarker_full.task': 'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_full/float16/latest/pose_landmarker_full.task',
  'selfie_multiclass_256x256.tflite': 'https://storage.googleapis.com/mediapipe-models/image_segmenter/selfie_multiclass_256x256/float32/latest/selfie_multiclass_256x256.tflite',
};

/** [x, y] normalised to the source frame. */
export type Pt = [number, number];

export interface TrackFrame {
  /** Face: bounding box [x0, y0, x1, y1] and named points, or null when no face was found. */
  face: { box: [number, number, number, number]; nose: Pt; eyeL: Pt; eyeR: Pt; mouth: Pt; chin: Pt; forehead: Pt } | null;
  /** Up to two hands, 21 landmarks each (MediaPipe order: 0 wrist, 4 thumb tip, 8 index tip, 9 middle base…). */
  hands: { side: 'Left' | 'Right'; score: number; pts: Pt[]; palm: Pt }[];
  /** 33 body landmarks with visibility, or null. */
  pose: [number, number, number][] | null;
  /** Bounding box of the person mask [x0, y0, x1, y1]. */
  body: [number, number, number, number] | null;
}

export interface Track {
  fps: number;
  width: number;
  height: number;
  frames: TrackFrame[];
  mask: string;
}

async function ensureModels(): Promise<void> {
  mkdirSync(MODELS_DIR, { recursive: true });
  for (const [file, url] of Object.entries(MODELS)) {
    const dest = join(MODELS_DIR, file);
    if (existsSync(dest)) continue;
    console.log(`  downloading ${file}…`);
    const res = await fetch(url);
    if (!res.ok) throw new Error(`model download failed: ${url} (${res.status})`);
    writeFileSync(dest, Buffer.from(await res.arrayBuffer()));
  }
}

const PAGE = /* html */ `<!doctype html><meta charset="utf-8"><body><script type="module">
import { FilesetResolver, FaceLandmarker, HandLandmarker, PoseLandmarker, ImageSegmenter } from '/node_modules/@mediapipe/tasks-vision/vision_bundle.mjs';
const W = ${FRAME_W}, H = ${FRAME_H}, MW = ${MASK_W}, MH = ${MASK_H};
const r = (v) => Math.round(v * 10000) / 10000;
const pt = (l) => [r(l.x), r(l.y)];
window.runTrack = async (count) => {
  const fileset = await FilesetResolver.forVisionTasks('/node_modules/@mediapipe/tasks-vision/wasm');
  const opts = (file) => ({ baseOptions: { modelAssetPath: '/models/' + file, delegate: 'CPU' }, runningMode: 'VIDEO' });
  const face = await FaceLandmarker.createFromOptions(fileset, { ...opts('face_landmarker.task'), numFaces: 1 });
  const hands = await HandLandmarker.createFromOptions(fileset, { ...opts('hand_landmarker.task'), numHands: 2, minHandDetectionConfidence: 0.4, minTrackingConfidence: 0.4 });
  const pose = await PoseLandmarker.createFromOptions(fileset, { ...opts('pose_landmarker_full.task'), numPoses: 1 });
  const seg = await ImageSegmenter.createFromOptions(fileset, { ...opts('selfie_multiclass_256x256.tflite'), outputConfidenceMasks: true, outputCategoryMask: false });
  const segWide = await ImageSegmenter.createFromOptions(fileset, { ...opts('selfie_multiclass_256x256.tflite'), outputConfidenceMasks: true, outputCategoryMask: false });
  // The segmenter sees a square crop around the person (more pixels on her edges than the full frame).
  const crop = document.createElement('canvas'); crop.width = crop.height = H;
  const cctx = crop.getContext('2d');
  const sq = document.createElement('canvas'); sq.width = sq.height = H;
  const sqctx = sq.getContext('2d');
  const wide = document.createElement('canvas'); wide.width = wide.height = W;
  const wctx = wide.getContext('2d');
  const feather = document.createElement('canvas'); feather.width = MW; feather.height = MH;
  const fctx = feather.getContext('2d');
  const out = document.createElement('canvas'); out.width = MW; out.height = MH;
  const octx = out.getContext('2d');
  let prev = null; // previous mask for temporal smoothing
  let cx = 0.5;
  const frames = [];
  for (let i = 0; i < count; i++) {
    const img = new Image();
    img.src = '/frames/' + String(i + 1).padStart(5, '0') + '.jpg';
    await img.decode();
    const ts = Math.round((i * 1000) / ${TRACK_FPS}) + 1;
    const f = face.detectForVideo(img, ts);
    const h = hands.detectForVideo(img, ts);
    const p = pose.detectForVideo(img, ts);
    const frame = { face: null, hands: [], pose: null, body: null };
    if (f.faceLandmarks?.[0]) {
      const L = f.faceLandmarks[0];
      let x0 = 1, y0 = 1, x1 = 0, y1 = 0;
      for (const l of L) { x0 = Math.min(x0, l.x); y0 = Math.min(y0, l.y); x1 = Math.max(x1, l.x); y1 = Math.max(y1, l.y); }
      const mid = (a, b) => [r((L[a].x + L[b].x) / 2), r((L[a].y + L[b].y) / 2)];
      frame.face = { box: [r(x0), r(y0), r(x1), r(y1)], nose: pt(L[1]), eyeL: mid(33, 133), eyeR: mid(362, 263), mouth: mid(13, 14), chin: pt(L[152]), forehead: pt(L[10]) };
      cx = cx * 0.7 + ((x0 + x1) / 2) * 0.3;
    }
    (h.landmarks || []).forEach((L, k) => {
      const hd = h.handedness?.[k]?.[0];
      const palm = [0, 5, 9, 13, 17].reduce((a, j) => [a[0] + L[j].x / 5, a[1] + L[j].y / 5], [0, 0]);
      frame.hands.push({ side: hd?.categoryName || 'Left', score: r(hd?.score ?? 0), pts: L.map(pt), palm: [r(palm[0]), r(palm[1])] });
    });
    if (p.landmarks?.[0]) frame.pose = p.landmarks[0].map((l) => [r(l.x), r(l.y), r(l.visibility ?? 0)]);
    // Segment a full-height square centred on the face.
    const sx = Math.max(0, Math.min(W - H, Math.round(cx * W - H / 2)));
    cctx.drawImage(img, sx, 0, H, H, 0, 0, H, H);
    // A second pass on the whole frame (letterboxed square) covers arms that reach outside the crop.
    wctx.fillStyle = '#000'; wctx.fillRect(0, 0, W, W);
    wctx.drawImage(img, 0, (W - H) / 2, W, H);
    const ws = segWide.segmentForVideo(wide, ts);
    const wbg = ws.confidenceMasks[0].getAsFloat32Array();
    const wn = Math.round(Math.sqrt(wbg.length));
    ws.close();
    const s = seg.segmentForVideo(crop, ts);
    const bg = s.confidenceMasks[0].getAsFloat32Array();
    const n = Math.round(Math.sqrt(bg.length));
    // Full-frame mask at the output size; the crop's sharper result is drawn over it.
    const fid = new ImageData(MW, MH);
    for (let y = 0; y < MH; y++) for (let x = 0; x < MW; x++) {
      const u = Math.min(wn - 1, Math.floor((x / MW) * wn));
      const v = Math.min(wn - 1, Math.floor((((y / MH) * H + (W - H) / 2) / W) * wn));
      const a = Math.max(0, Math.min(1, (1 - wbg[v * wn + u] - 0.35) / 0.3));
      const o = (y * MW + x) * 4;
      fid.data[o] = fid.data[o + 1] = fid.data[o + 2] = 255; fid.data[o + 3] = Math.round(a * 255);
    }
    const id = new ImageData(n, n);
    let bx0 = n, by0 = n, bx1 = 0, by1 = 0;
    for (let j = 0; j < bg.length; j++) {
      let a = 1 - bg[j];
      if (prev) a = a * 0.65 + prev[j] * 0.35;
      bg[j] = a;
      // Firm up the edge: soft ramp between 0.35 and 0.65 confidence.
      const v = Math.max(0, Math.min(1, (a - 0.35) / 0.3));
      id.data[j * 4] = id.data[j * 4 + 1] = id.data[j * 4 + 2] = 255;
      id.data[j * 4 + 3] = Math.round(v * 255);
      if (v > 0.5) { const x = j % n, y = (j / n) | 0; bx0 = Math.min(bx0, x); by0 = Math.min(by0, y); bx1 = Math.max(bx1, x); by1 = Math.max(by1, y); }
    }
    prev = bg;
    s.close();
    sq.width = n; sq.height = n;
    sqctx.putImageData(id, 0, 0);
    octx.putImageData(fid, 0, 0);
    // Blend the crop in with feathered side edges so there's no seam.
    fctx.clearRect(0, 0, MW, MH);
    fctx.globalCompositeOperation = 'source-over';
    fctx.imageSmoothingQuality = 'high';
    const dx = (sx / W) * MW, dw = (H / W) * MW;
    fctx.drawImage(sq, 0, 0, n, n, dx, 0, dw, MH);
    const g = fctx.createLinearGradient(dx, 0, dx + dw, 0);
    const fe = sx > 0 ? 0.08 : 0, fe2 = sx < W - H ? 0.92 : 1;
    g.addColorStop(0, 'rgba(0,0,0,' + (sx > 0 ? 0 : 1) + ')'); g.addColorStop(fe, '#000'); g.addColorStop(fe2, '#000'); g.addColorStop(1, 'rgba(0,0,0,' + (sx < W - H ? 0 : 1) + ')');
    fctx.globalCompositeOperation = 'destination-in';
    fctx.fillStyle = g; fctx.fillRect(dx, 0, dw, MH);
    // Inside the crop, the crop wins: erase the wide mask there, weighted by the feather.
    octx.globalCompositeOperation = 'destination-out';
    octx.fillStyle = g; octx.fillRect(dx, 0, dw, MH);
    octx.globalCompositeOperation = 'source-over';
    octx.drawImage(feather, 0, 0);
    if (bx1 > bx0) frame.body = [r((sx + (bx0 / n) * H) / W), r(by0 / n), r((sx + (bx1 / n) * H) / W), r(by1 / n)];
    const png = out.toDataURL('image/png');
    await fetch('/save?i=' + i, { method: 'POST', body: png });
    frames.push(frame);
    if (i % 30 === 0) console.log('frame ' + i + '/' + count);
  }
  return frames;
};
window.ready = true;
</script>`;

const TYPES: Record<string, string> = { '.js': 'text/javascript', '.mjs': 'text/javascript', '.wasm': 'application/wasm', '.jpg': 'image/jpeg', '.task': 'application/octet-stream', '.tflite': 'application/octet-stream', '.html': 'text/html' };

/** Track the person in a video asset. Writes track.json and the mask sequence; returns the track. */
export async function trackAsset(id: string, file: string, duration: number): Promise<Track> {
  await ensureModels();
  const outDir = join(analysisDir(id), 'track');
  const maskDir = join(outDir, 'mask');
  rmSync(outDir, { recursive: true, force: true });
  mkdirSync(maskDir, { recursive: true });
  const framesDir = join(tmpdir(), `ev-track-${id}`);
  rmSync(framesDir, { recursive: true, force: true });
  mkdirSync(framesDir, { recursive: true });

  console.log(`  extracting frames at ${TRACK_FPS} fps…`);
  await ffmpeg(['-y', '-i', mediaPath(file), '-t', String(duration), '-vf', `fps=${TRACK_FPS},scale=${FRAME_W}:${FRAME_H}`, '-q:v', '3', join(framesDir, '%05d.jpg')]);
  const count = readdirSync(framesDir).filter((f) => f.endsWith('.jpg')).length;

  const server = createServer((req, res) => {
    const url = new URL(req.url ?? '/', 'http://x');
    if (url.pathname === '/save' && req.method === 'POST') {
      const chunks: Buffer[] = [];
      req.on('data', (c) => chunks.push(c));
      req.on('end', () => {
        const b64 = Buffer.concat(chunks).toString().replace(/^data:image\/png;base64,/, '');
        const i = Number(url.searchParams.get('i'));
        writeFileSync(join(maskDir, `${String(i).padStart(5, '0')}.png`), Buffer.from(b64, 'base64'));
        res.end('ok');
      });
      return;
    }
    let path: string | null = null;
    if (url.pathname === '/') path = null;
    else if (url.pathname.startsWith('/node_modules/@mediapipe/')) path = join(ROOT, normalize(url.pathname));
    else if (url.pathname.startsWith('/models/')) path = join(MODELS_DIR, normalize(url.pathname.slice(8)));
    else if (url.pathname.startsWith('/frames/')) path = join(framesDir, normalize(url.pathname.slice(8)));
    if (url.pathname === '/') {
      res.setHeader('content-type', 'text/html');
      res.end(PAGE);
    } else if (path && existsSync(path)) {
      res.setHeader('content-type', TYPES[extname(path)] ?? 'application/octet-stream');
      res.end(readFileSync(path));
    } else {
      res.statusCode = 404;
      res.end();
    }
  });
  await new Promise<void>((ok) => server.listen(0, '127.0.0.1', ok));
  const port = (server.address() as { port: number }).port;

  const { chromium } = await import('@playwright/test');
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    page.on('console', (m) => {
      const t = m.text();
      if (t.startsWith('frame ')) process.stdout.write(`\r  tracking ${t.slice(6)}   `);
    });
    page.on('pageerror', (e) => console.error('  page error:', e.message));
    await page.goto(`http://127.0.0.1:${port}/`);
    await page.waitForFunction('window.ready === true');
    const frames = (await page.evaluate(`window.runTrack(${count})`)) as TrackFrame[];
    process.stdout.write('\n');
    const track: Track = { fps: TRACK_FPS, width: FRAME_W, height: FRAME_H, frames, mask: `analysis/${id}/track/mask` };
    writeFileSync(join(outDir, 'track.json'), JSON.stringify(track));
    return track;
  } finally {
    await browser.close();
    server.close();
    rmSync(framesDir, { recursive: true, force: true });
  }
}
