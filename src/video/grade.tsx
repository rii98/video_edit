// Colour grading for footage, done like a colourist: correct (exposure, white balance, contrast,
// shadows/highlights, saturation), then apply a creative look (a 3D LUT) at some strength.
//
//   <Look exposure={0.3} temperature={-0.15} look="film" amount={0.8}>
//     <Footage id="…" />            ← every Footage / Picture inside is graded (text is not)
//   </Look>
//
// It runs as a WebGL2 shader on each decoded frame (Remotion's onVideoFrame), so preview,
// snapshots and the final render match exactly. One shared GL context draws every graded clip.
// Nested <Look>s replace the outer one (e.g. a subject window graded apart from the room).
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { cancelRender, continueRender, delayRender, OffthreadVideo, staticFile } from 'remotion';
import tokens from '../../project/theme/tokens.json';
import { bakeLut, LOOKS, parseCube, themeLook } from './looks';

export interface Grade {
  /** Exposure in stops (+1 = twice as bright). Applied in linear light. */
  exposure?: number;
  /** White balance: -1 cooler (bluer) … +1 warmer (more orange). */
  temperature?: number;
  /** -1 greener … +1 more magenta (fixes the green cast of fluorescent/LED light). */
  tint?: number;
  /** 1 = untouched; 1.15 = punchier. Pivots around mid-grey. */
  contrast?: number;
  /** -1 … +1: lift (+) or deepen (−) the shadows without touching highlights. */
  shadows?: number;
  /** -1 … +1: negative pulls bright areas down (recovers windows, shiny skin). */
  highlights?: number;
  /** 1 = untouched, 0 = black and white. */
  saturation?: number;
  /** 0 … 1: saturates muted colours more than already-strong ones (kind to skin). */
  vibrance?: number;
  /** Creative look: a built-in name (clean, film, teal-orange, warm, moody, mono), "theme", or a .cube path under project/media (e.g. "luts/kodak.cube"). */
  look?: string;
  /** Look strength 0 … 1 (default 1). */
  amount?: number;
}

/** Blend two grades, e.g. for a grade that changes over a shot. */
export function blendGrade(a: Grade, b: Grade, k: number): Grade {
  const n = (x: number | undefined, d: number) => x ?? d;
  const m = (x: number | undefined, y: number | undefined, d: number) => n(x, d) + (n(y, d) - n(x, d)) * k;
  return {
    exposure: m(a.exposure, b.exposure, 0),
    temperature: m(a.temperature, b.temperature, 0),
    tint: m(a.tint, b.tint, 0),
    contrast: m(a.contrast, b.contrast, 1),
    shadows: m(a.shadows, b.shadows, 0),
    highlights: m(a.highlights, b.highlights, 0),
    saturation: m(a.saturation, b.saturation, 1),
    vibrance: m(a.vibrance, b.vibrance, 0),
    // Looks can't be interpolated as tables; fade the strength instead.
    look: k < 0.5 ? (a.look ?? b.look) : (b.look ?? a.look),
    amount: a.look === b.look ? m(a.amount, b.amount, 1) : k < 0.5 ? n(a.amount, 1) * (1 - 2 * k) : n(b.amount, 1) * (2 * k - 1),
  };
}

interface Lut { key: string; size: number; data: Float32Array }
interface LookState { grade: Grade; lut: Lut | null }

const LookContext = createContext<LookState | null>(null);

export function useLook(): LookState | null {
  return useContext(LookContext);
}

const lutCache = new Map<string, Lut>();

function builtinLut(name: string): Lut | null {
  const key = name;
  if (lutCache.has(key)) return lutCache.get(key)!;
  // "theme": shadows lean toward the project background hue, highlights toward its accent.
  const fn = name === 'theme' ? themeLook(tokens.colors.bg, tokens.colors.accent) : LOOKS[name]?.fn;
  if (!fn) return null;
  const lut = { key, size: 33, data: bakeLut(fn, 33) };
  lutCache.set(key, lut);
  return lut;
}

/** Resolves `look` to a LUT table, fetching .cube files (render waits for them). */
function useLut(look: string | undefined): Lut | null {
  const isFile = !!look && look.endsWith('.cube');
  const [file, setFile] = useState<Lut | null>(() => (isFile ? lutCache.get(look!) ?? null : null));
  useEffect(() => {
    if (!isFile || file?.key === look) return;
    const cached = lutCache.get(look!);
    if (cached) return setFile(cached);
    const h = delayRender(`LUT ${look}`);
    fetch(staticFile(look!))
      .then((r) => {
        if (!r.ok) throw new Error(`LUT not found: project/media/${look} (import one with \`ev lut import <file.cube>\`)`);
        return r.text();
      })
      .then((text) => {
        const lut = { key: look!, ...parseCube(text) };
        lutCache.set(look!, lut);
        setFile(lut);
        continueRender(h);
      })
      .catch((e) => cancelRender(e));
  }, [look, isFile, file]);
  if (!look) return null;
  if (isFile) return file?.key === look ? file : null;
  const lut = builtinLut(look);
  if (!lut) throw new Error(`Unknown look "${look}". Built in: ${Object.keys(LOOKS).join(', ')}, theme; or a .cube path`);
  return lut;
}

/** Grades every <Footage> and <Picture> inside it. Text and graphics are untouched. */
export function Look({ children, ...grade }: Grade & { children: ReactNode }) {
  const lut = useLut(grade.look);
  const key = JSON.stringify(grade);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const value = useMemo<LookState>(() => ({ grade, lut }), [key, lut]);
  return <LookContext.Provider value={value}>{children}</LookContext.Provider>;
}

// ---- The shared WebGL2 renderer ---------------------------------------------------------------

const VERT = `#version 300 es
in vec2 p; out vec2 uv;
void main() { uv = vec2(p.x * 0.5 + 0.5, 0.5 - p.y * 0.5); gl_Position = vec4(p, 0.0, 1.0); }`;

const FRAG = `#version 300 es
precision highp float;
precision highp sampler3D;
uniform sampler2D src;
uniform sampler3D lut;
uniform float lutSize, amount, exposure, temperature, tint, contrast, shadows, highlights, saturation, vibrance;
in vec2 uv; out vec4 outColor;
const vec3 W = vec3(0.2126, 0.7152, 0.0722);
vec3 toLinear(vec3 c) { return mix(c / 12.92, pow((c + 0.055) / 1.055, vec3(2.4)), step(0.04045, c)); }
vec3 toGamma(vec3 c) { c = max(c, 0.0); return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c)); }
void main() {
  vec4 s = texture(src, uv);
  vec3 c = toLinear(s.rgb);
  // 1. exposure and white balance, in linear light (like a camera would)
  c *= exp2(exposure);
  vec3 wb = vec3(1.0 + 0.10 * temperature + 0.03 * tint, 1.0 - 0.06 * tint, 1.0 - 0.10 * temperature + 0.03 * tint);
  c *= wb / dot(wb, W);
  c = toGamma(c);
  // 2. tone: shadows / highlights on luma (hue preserved), then contrast around mid-grey
  float y = dot(c, W);
  float ny = y + shadows * 0.6 * y * (1.0 - y) * (1.0 - y) + highlights * 0.6 * y * y * (1.0 - y);
  c *= ny / max(y, 1e-4);
  c = (c - 0.42) * contrast + 0.42;
  // 3. saturation and vibrance
  y = dot(c, W);
  float sat = max(c.r, max(c.g, c.b)) - min(c.r, min(c.g, c.b));
  c = y + (c - y) * saturation * (1.0 + vibrance * (1.0 - clamp(sat * 1.6, 0.0, 1.0)));
  c = clamp(c, 0.0, 1.0);
  // 4. creative look (3D LUT, trilinear), mixed by amount
  if (amount > 0.0) {
    vec3 l = texture(lut, c * ((lutSize - 1.0) / lutSize) + 0.5 / lutSize).rgb;
    c = mix(c, l, amount);
  }
  outColor = vec4(c, s.a);
}`;

interface Renderer {
  canvas: HTMLCanvasElement;
  gl: WebGL2RenderingContext;
  uniforms: Record<string, WebGLUniformLocation | null>;
  srcTex: WebGLTexture;
  luts: Map<string, WebGLTexture>;
  identity: WebGLTexture;
}

let renderer: Renderer | null = null;

function compile(gl: WebGL2RenderingContext, type: number, source: string): WebGLShader {
  const sh = gl.createShader(type)!;
  gl.shaderSource(sh, source);
  gl.compileShader(sh);
  if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) throw new Error(`Look shader: ${gl.getShaderInfoLog(sh)}`);
  return sh;
}

function lutTexture(gl: WebGL2RenderingContext, size: number, data: Float32Array): WebGLTexture {
  const tex = gl.createTexture()!;
  gl.bindTexture(gl.TEXTURE_3D, tex);
  // 16-bit float storage is linear-filterable everywhere WebGL2 runs (32-bit float often isn't).
  gl.texImage3D(gl.TEXTURE_3D, 0, gl.RGB16F, size, size, size, 0, gl.RGB, gl.FLOAT, data);
  for (const p of [gl.TEXTURE_MIN_FILTER, gl.TEXTURE_MAG_FILTER]) gl.texParameteri(gl.TEXTURE_3D, p, gl.LINEAR);
  for (const p of [gl.TEXTURE_WRAP_S, gl.TEXTURE_WRAP_T, gl.TEXTURE_WRAP_R]) gl.texParameteri(gl.TEXTURE_3D, p, gl.CLAMP_TO_EDGE);
  return tex;
}

function getRenderer(): Renderer {
  if (renderer) return renderer;
  const canvas = document.createElement('canvas');
  const gl = canvas.getContext('webgl2', { premultipliedAlpha: false, preserveDrawingBuffer: true });
  if (!gl) throw new Error('<Look> needs WebGL2 (Chrome renders it with --gl=angle, set in remotion.config.ts)');
  const prog = gl.createProgram()!;
  gl.attachShader(prog, compile(gl, gl.VERTEX_SHADER, VERT));
  gl.attachShader(prog, compile(gl, gl.FRAGMENT_SHADER, FRAG));
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(`Look program: ${gl.getProgramInfoLog(prog)}`);
  gl.useProgram(prog);
  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
  const loc = gl.getAttribLocation(prog, 'p');
  gl.enableVertexAttribArray(loc);
  gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
  const names = ['src', 'lut', 'lutSize', 'amount', 'exposure', 'temperature', 'tint', 'contrast', 'shadows', 'highlights', 'saturation', 'vibrance'];
  const uniforms = Object.fromEntries(names.map((n) => [n, gl.getUniformLocation(prog, n)]));
  gl.uniform1i(uniforms.src!, 0);
  gl.uniform1i(uniforms.lut!, 1);
  const srcTex = gl.createTexture()!;
  gl.bindTexture(gl.TEXTURE_2D, srcTex);
  for (const p of [gl.TEXTURE_MIN_FILTER, gl.TEXTURE_MAG_FILTER]) gl.texParameteri(gl.TEXTURE_2D, p, gl.LINEAR);
  for (const p of [gl.TEXTURE_WRAP_S, gl.TEXTURE_WRAP_T]) gl.texParameteri(gl.TEXTURE_2D, p, gl.CLAMP_TO_EDGE);
  const identity = lutTexture(gl, 2, Float32Array.from([0, 0, 0, 1, 0, 0, 0, 1, 0, 1, 1, 0, 0, 0, 1, 1, 0, 1, 0, 1, 1, 1, 1, 1]));
  renderer = { canvas, gl, uniforms, srcTex, luts: new Map(), identity };
  return renderer;
}

type Source = HTMLVideoElement | HTMLImageElement | HTMLCanvasElement | ImageBitmap;

function sourceSize(s: Source): [number, number] {
  if (s instanceof HTMLVideoElement) return [s.videoWidth, s.videoHeight];
  if (s instanceof HTMLImageElement) return [s.naturalWidth, s.naturalHeight];
  return [s.width, s.height];
}

/** Grades `source` into `target` (a 2D canvas sized to the source). */
export function drawGraded(source: Source, target: HTMLCanvasElement, state: LookState): void {
  const [w, h] = sourceSize(source);
  if (!w || !h) return;
  const r = getRenderer();
  const { gl, uniforms: u } = r;
  if (r.canvas.width !== w || r.canvas.height !== h) {
    r.canvas.width = w;
    r.canvas.height = h;
  }
  gl.viewport(0, 0, w, h);
  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D, r.srcTex);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source);
  gl.activeTexture(gl.TEXTURE1);
  let lutTex = r.identity;
  if (state.lut) {
    if (!r.luts.has(state.lut.key)) r.luts.set(state.lut.key, lutTexture(gl, state.lut.size, state.lut.data));
    lutTex = r.luts.get(state.lut.key)!;
  }
  gl.bindTexture(gl.TEXTURE_3D, lutTex);
  const g = state.grade;
  gl.uniform1f(u.lutSize!, state.lut?.size ?? 2);
  gl.uniform1f(u.amount!, state.lut ? (g.amount ?? 1) : 0);
  gl.uniform1f(u.exposure!, g.exposure ?? 0);
  gl.uniform1f(u.temperature!, g.temperature ?? 0);
  gl.uniform1f(u.tint!, g.tint ?? 0);
  gl.uniform1f(u.contrast!, g.contrast ?? 1);
  gl.uniform1f(u.shadows!, g.shadows ?? 0);
  gl.uniform1f(u.highlights!, g.highlights ?? 0);
  gl.uniform1f(u.saturation!, g.saturation ?? 1);
  gl.uniform1f(u.vibrance!, g.vibrance ?? 0);
  gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  if (target.width !== w || target.height !== h) {
    target.width = w;
    target.height = h;
  }
  const ctx = target.getContext('2d')!;
  ctx.clearRect(0, 0, w, h);
  ctx.drawImage(r.canvas, 0, 0);
}

/** Keeps a canvas graded: call `onFrame` with each new frame; regrades the last one when the look changes. */
function useGradedCanvas(state: LookState) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const last = useRef<Source | null>(null);
  const stateRef = useRef(state);
  stateRef.current = state;
  const onFrame = useCallback((frame: CanvasImageSource) => {
    last.current = frame as Source;
    if (canvas.current) drawGraded(frame as Source, canvas.current, stateRef.current);
  }, []);
  useEffect(() => {
    if (last.current && canvas.current) drawGraded(last.current, canvas.current, state);
  }, [state]);
  return { canvas, onFrame };
}

const hidden: CSSProperties = { position: 'absolute', inset: 0, width: '100%', height: '100%', opacity: 0, pointerEvents: 'none' };

/** Footage through the current look. Used by kit's <Footage> when inside a <Look>. */
export function GradedVideo({ state, src, fit, style, ...video }: {
  state: LookState;
  src: string;
  fit: 'cover' | 'contain';
  style?: CSSProperties;
  trimBefore?: number;
  trimAfter?: number;
  volume?: number | ((frame: number) => number);
  muted?: boolean;
  playbackRate?: number;
}) {
  const { canvas, onFrame } = useGradedCanvas(state);
  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      <OffthreadVideo src={src} {...video} onVideoFrame={onFrame} style={{ ...hidden, objectFit: fit }} />
      <canvas ref={canvas} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: fit, ...style}} />
    </div>
  );
}

/** A still image through the current look. Waits for the image so renders include the grade. */
export function GradedImage({ state, src, fit, style }: { state: LookState; src: string; fit: 'cover' | 'contain'; style?: CSSProperties }) {
  const { canvas, onFrame } = useGradedCanvas(state);
  useEffect(() => {
    const h = delayRender(`graded image ${src}`);
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.src = src;
    img
      .decode()
      .then(() => onFrame(img))
      .catch((e) => cancelRender(e))
      .finally(() => continueRender(h));
  }, [src, onFrame]);
  return <canvas ref={canvas} style={{ width: '100%', height: '100%', objectFit: fit, ...style }} />;
}

/** Any canvas-drawable source through a look (the Library demo grades a generated test chart). */
export function GradedSource({ source, fit = 'cover', style }: { source: Source | null; fit?: 'cover' | 'contain'; style?: CSSProperties }) {
  const state = useLook() ?? { grade: {}, lut: null };
  const { canvas, onFrame } = useGradedCanvas(state);
  useEffect(() => {
    if (source) onFrame(source);
  }, [source, onFrame]);
  return <canvas ref={canvas} style={{ width: '100%', height: '100%', objectFit: fit, ...style }} />;
}
