// Studio-quality 3D for Remotion: the lighting, shadows and camera finish that make Three.js read
// as "rendered" rather than "game". Wraps @remotion/three's <ThreeCanvas>:
//   - image-based lighting from procedural light cards (drei Lightformers; no files, no network)
//     or an HDRI under project/media (`ev hdri <slug>`, Poly Haven CC0)
//   - soft contact shadows, ambient occlusion (N8AO), bloom, depth of field, AgX filmic tone mapping
//   - material presets (glass, chrome, ceramic…) as plain meshPhysicalMaterial props
// look="basic" is the plain setup (two lights, default tone mapping) for honest before/afters.
// Animate from useCurrentFrame() (never useFrame), and keep everything deterministic.
import { ContactShadows, Environment, Lightformer } from '@react-three/drei';
import { Bloom, DepthOfField, EffectComposer, N8AO, ToneMapping, Vignette } from '@react-three/postprocessing';
import { ThreeCanvas } from '@remotion/three';
import { ToneMappingMode } from 'postprocessing';
import { Suspense, useEffect, useLayoutEffect, useMemo, useRef, useState, type JSX, type ReactNode, type RefObject } from 'react';
import { continueRender, delayRender, staticFile, useCurrentFrame, useRemotionEnvironment } from 'remotion';
import { useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { Layer, useTheme } from '../../src/video/kit';

export type StudioLook = 'basic' | 'studio' | 'sunset' | 'night' | 'product';

/** Holds the render while anything inside a Suspense boundary (HDRIs, models) is loading. */
function HoldRender() {
  const [h] = useState(() => delayRender('Studio3D: loading'));
  useEffect(() => () => continueRender(h), [h]);
  return null;
}

/**
 * Remotion renders each frame with a single `advance()`. The EffectComposer builds itself over
 * several React updates after mount (composer, then its passes) and, being a priority render,
 * suppresses the normal render meanwhile, so that single frame comes out blank. This holds every
 * frame (delayRender) until the composer has its passes, then renders it.
 */
function RenderWhenComposed({ composer }: { composer: RefObject<{ passes: unknown[] } | null> }) {
  const { advance } = useThree();
  const frame = useCurrentFrame();
  const { isRendering } = useRemotionEnvironment();
  useLayoutEffect(() => {
    if (!isRendering) return;
    const h = delayRender(`Studio3D: post effects for frame ${frame}`);
    let tries = 0;
    let timer: ReturnType<typeof setTimeout>;
    const tick = () => {
      if ((composer.current?.passes.length ?? 0) >= 2 || tries++ > 400) {
        advance(performance.now());
        continueRender(h);
      } else timer = setTimeout(tick, 5);
    };
    tick();
    return () => clearTimeout(timer);
  }, [frame, advance, isRendering, composer]);
  return null;
}

/** A dim floor bounce and sky so mirror-like surfaces reflect a gradient, not a black void. */
function Bounce() {
  return (
    <>
      <Lightformer form="rect" intensity={0.35} color="#9a948c" position={[0, -4, 0]} rotation-x={-Math.PI / 2} scale={[30, 30, 1]} />
      <Lightformer form="rect" intensity={0.12} color="#cfd6e0" position={[0, 0, -12]} scale={[40, 14, 1]} />
    </>
  );
}

/**
 * A photo-studio cyclorama: the floor curves up into the back wall, so there's no horizon line.
 * Makes the scene opaque (and depth of field possible). The floor sits at y = `floorY`.
 */
function Cyclorama({ color, floorY }: { color: string; floorY: number }) {
  const geometry = useMemo(() => {
    // profile in (z, y): flat floor from the front to z = -2, a radius-4 cove, then the wall
    const pts: [number, number][] = [];
    for (let z = 14; z > -2; z -= 0.5) pts.push([z, 0]);
    for (let i = 0; i <= 24; i++) {
      const a = (i / 24) * (Math.PI / 2);
      pts.push([-2 - Math.sin(a) * 4, 4 - Math.cos(a) * 4]);
    }
    for (let y = 4.5; y <= 30; y += 1.5) pts.push([-6, y]);
    const g = new THREE.PlaneGeometry(80, 1, 1, pts.length - 1);
    const pos = g.attributes.position!;
    for (let i = 0; i < pos.count; i++) {
      const row = Math.floor(i / 2);
      const [z, y] = pts[pts.length - 1 - row]!;
      pos.setXYZ(i, pos.getX(i), y + floorY, z);
    }
    g.computeVertexNormals();
    return g;
  }, [floorY]);
  return (
    <mesh geometry={geometry}>
      <meshStandardMaterial color={color} roughness={0.92} metalness={0} side={THREE.DoubleSide} />
    </mesh>
  );
}

/** Light cards baked into the environment map: big soft sources read as studio softboxes in every reflection. */
function Cards({ look, accent, accent2 }: { look: Exclude<StudioLook, 'basic'>; accent: string; accent2: string }) {
  switch (look) {
    case 'sunset':
      return (
        <>
          <Lightformer form="rect" intensity={6} color="#ffb070" position={[-6, 1.2, 3]} scale={[6, 2.4, 1]} target={[0, 0, 0]} />
          <Lightformer form="rect" intensity={1.2} color="#7fa8ff" position={[0, 6, -2]} scale={[12, 4, 1]} target={[0, 0, 0]} />
          <Lightformer form="rect" intensity={2} color="#ff7a50" position={[5, 0.5, -5]} scale={[4, 1, 1]} target={[0, 0, 0]} />
        </>
      );
    case 'night':
      return (
        <>
          <Lightformer form="rect" intensity={1.4} color="#9fb8ff" position={[-3, 5, 3]} scale={[5, 3, 1]} target={[0, 0, 0]} />
          <Lightformer form="rect" intensity={5} color={accent} position={[-5, 0.5, -3]} scale={[0.4, 6, 1]} target={[0, 0, 0]} />
          <Lightformer form="rect" intensity={5} color={accent2} position={[5, 0.5, -3]} scale={[0.4, 6, 1]} target={[0, 0, 0]} />
        </>
      );
    case 'product':
      return (
        <>
          <Lightformer form="ring" intensity={4} position={[0, 2, 6]} scale={3} target={[0, 0, 0]} />
          <Lightformer form="rect" intensity={3} position={[0, 7, 0]} scale={[8, 8, 1]} rotation-x={Math.PI / 2} />
          <Lightformer form="rect" intensity={2.4} position={[-6, 1, 0]} scale={[1.2, 8, 1]} target={[0, 0, 0]} />
          <Lightformer form="rect" intensity={2.4} position={[6, 1, 0]} scale={[1.2, 8, 1]} target={[0, 0, 0]} />
        </>
      );
    default:
      // studio: big overhead softbox, two strip lights, a warm rim from behind in the theme accent
      return (
        <>
          <Lightformer form="rect" intensity={3} position={[0, 6, 1]} scale={[7, 5, 1]} rotation-x={Math.PI / 2} />
          <Lightformer form="rect" intensity={2} position={[-5, 2, 2]} scale={[1.5, 6, 1]} target={[0, 0, 0]} />
          <Lightformer form="rect" intensity={1.2} position={[5, 1.5, 3]} scale={[1.5, 5, 1]} target={[0, 0, 0]} />
          <Lightformer form="rect" intensity={2.5} color={accent} position={[0, 2, -6]} scale={[6, 1.2, 1]} target={[0, 0, 0]} />
        </>
      );
  }
}

/** Key light direction per look (also used for the real shadow-casting light). */
const KEY: Record<StudioLook, [number, number, number]> = {
  basic: [3, 5, 4],
  studio: [1, 6, 2],
  sunset: [-6, 1.6, 3],
  night: [-3, 5, 3],
  product: [0, 7, 1],
};

export interface Studio3DProps {
  id: string;
  width: number;
  height: number;
  look?: StudioLook;
  /** Perspective camera; units are scene units (a 1-unit object ≈ a coffee mug at the default distance). */
  camera?: { position?: [number, number, number]; fov?: number; lookAt?: [number, number, number] };
  /** An .hdr under project/media (e.g. "hdri/studio_small_09_1k.hdr") instead of the light cards. */
  hdri?: string;
  /** Show the environment as the background (else transparent, for compositing over footage). */
  background?: boolean;
  /** A studio cyclorama in this colour (floor curving into a wall). Opaque; enables depth of field. */
  backdrop?: string;
  /** Final tone mapping: "neutral" keeps brand colours true (default), "agx" is filmic and softer. */
  tone?: 'neutral' | 'agx';
  /** Soft contact shadow on the ground plane at y = `floorY`. */
  shadow?: boolean;
  floorY?: number;
  /** How high above the floor geometry still darkens the contact shadow (scene units). Contact
   *  shadows stack everything within reach, occluded or not, so keep it below inner details
   *  (e.g. below the rice in a bowl). */
  shadowReach?: number;
  /** Post effects (studio looks only). */
  ao?: boolean;
  bloom?: number;
  /** Depth of field: distance from the camera to the plane in focus (scene units), 0 = off.
   *  Needs an opaque scene (`backdrop` or `background`); with a transparent canvas it would black out the alpha. */
  focus?: number;
  /** Bokeh strength for depth of field. */
  bokeh?: number;
  vignette?: number;
  /** Environment light strength (default 1.5 with light cards, 0.9 with an HDRI). */
  exposure?: number;
  children: ReactNode;
}

export function Studio3D({ id, width, height, look = 'studio', camera = {}, hdri, background = false, backdrop, tone = 'neutral', shadow = true, floorY = 0, shadowReach = 1, ao = true, bloom = 0.35, focus = 0, bokeh = 3, vignette = 0.25, exposure: exposureProp, children }: Studio3DProps) {
  const t = useTheme();
  const composer = useRef<{ passes: unknown[] } | null>(null);
  // Real HDRIs carry more light than the procedural cards.
  const exposure = exposureProp ?? (hdri ? 0.9 : 1.5);
  const at = camera.lookAt ?? [0, 0, 0];
  const basic = look === 'basic';
  const key = KEY[look];
  const opaque = background || !!backdrop;
  // DoF writes an opaque frame: only allowed when the scene is opaque anyway
  const dof = focus > 0 && opaque;
  return (
    <Layer id={id} style={{ width, height, position: 'relative' }}>
      <ThreeCanvas
        width={width}
        height={height}
        shadows={basic}
        camera={{ position: camera.position ?? [0, 1.6, 6], fov: camera.fov ?? 32, near: 0.05, far: 200 }}
        // With the composer, tone mapping happens last (AgX) as a post effect, so the renderer stays linear.
        // Always alpha-capable: ContactShadows clears its shadow texture with the renderer's clear
        // alpha, and an opaque canvas (alpha 1) turns the shadow plane into a black rectangle.
        gl={{ alpha: true, antialias: true, toneMapping: basic ? THREE.ACESFilmicToneMapping : THREE.NoToneMapping, preserveDrawingBuffer: true }}
        onCreated={({ camera: cam }) => cam.lookAt(...at)}
        style={{ background: 'transparent' }}
      >
        {basic ? (
          <>
            {/* The "before": what a default Three.js scene looks like (ambient + one directional light). */}
            <ambientLight intensity={0.35} />
            <directionalLight position={key} intensity={2.2} castShadow shadow-mapSize={[1024, 1024]} />
            {backdrop && <Cyclorama color={backdrop} floorY={floorY - 0.002} />}
            {shadow && (
              <mesh rotation-x={-Math.PI / 2} position={[0, floorY - 0.001, 0]} receiveShadow>
                <planeGeometry args={[30, 30]} />
                <shadowMaterial opacity={0.35} />
              </mesh>
            )}
            {children}
          </>
        ) : (
          <Suspense fallback={<HoldRender />}>
            {hdri ? (
              <Environment files={staticFile(hdri)} background={background} environmentIntensity={exposure} />
            ) : (
              <Environment resolution={512} frames={1} background={background} environmentIntensity={exposure}>
                <color attach="background" args={[background ? t.colors.bg : '#000000']} />
                <Cards look={look} accent={t.colors.accent} accent2={t.colors.accent2} />
                <Bounce />
              </Environment>
            )}
            {backdrop && <Cyclorama color={backdrop} floorY={floorY - 0.002} />}
            {/* a faint real key so specular highlights have a direction */}
            <directionalLight position={key} intensity={0.7 * exposure} />
            {/* With a cyclorama the shadow area stays on the flat floor (|z| < 2), or the cove itself reads as a caster. */}
            {shadow && <ContactShadows position={[0, floorY + 0.001, 0]} opacity={0.72} scale={backdrop ? 4.4 : 12} blur={2.6} far={shadowReach} resolution={1024} frames={Infinity} color="#000000" />}
            {children}
            <EffectComposer ref={composer as never} multisampling={4} frameBufferType={THREE.HalfFloatType}>
              {[
                ao && <N8AO key="ao" aoRadius={0.6} intensity={2.2} distanceFalloff={0.6} quality="high" />,
                bloom > 0 && <Bloom key="bloom" intensity={bloom} luminanceThreshold={0.85} luminanceSmoothing={0.2} mipmapBlur />,
                dof && <DepthOfField key="dof" worldFocusDistance={focus} worldFocusRange={1.2} bokehScale={bokeh} />,
                <ToneMapping key="tm" mode={tone === 'agx' ? ToneMappingMode.AGX : ToneMappingMode.NEUTRAL} />,
                vignette > 0 && <Vignette key="vig" offset={0.3} darkness={vignette} />,
              ].filter((e): e is JSX.Element => !!e)}
            </EffectComposer>
            <RenderWhenComposed composer={composer} />
          </Suspense>
        )}
      </ThreeCanvas>
    </Layer>
  );
}

/**
 * Physical material presets: spread onto <meshPhysicalMaterial {...MATERIALS.glass} />.
 * They only look right with environment lighting (any non-basic Studio3D look).
 */
export const MATERIALS = {
  glass: { transmission: 1, thickness: 0.6, roughness: 0.04, ior: 1.5, metalness: 0, color: '#ffffff', attenuationColor: '#e8f4ff', attenuationDistance: 2.5, specularIntensity: 1, envMapIntensity: 1.2 },
  chrome: { metalness: 1, roughness: 0.06, color: '#e9ecef', envMapIntensity: 1.3 },
  gold: { metalness: 1, roughness: 0.18, color: '#e8b04a', envMapIntensity: 1.2 },
  ceramic: { metalness: 0, roughness: 0.22, clearcoat: 0.9, clearcoatRoughness: 0.08, color: '#f2efe9' },
  plastic: { metalness: 0, roughness: 0.35, clearcoat: 0.4, clearcoatRoughness: 0.2, color: '#d9653b' },
  rubber: { metalness: 0, roughness: 0.85, color: '#222222' },
  wood: { metalness: 0, roughness: 0.6, sheen: 0.2, color: '#9a6a43' },
} as const;
