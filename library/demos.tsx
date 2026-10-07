// One short looping demo per catalog entry, rendered in the editor's Library tab under
// whichever theme is selected. Demos use only library components and theme tokens.
import { useMemo, type ComponentType, type ReactNode } from 'react';
import { AbsoluteFill, interpolate, useCurrentFrame } from 'remotion';
import { GradedSource } from '../src/video/grade';
import { useTheme } from '../src/video/kit';
import {
  AuroraBackground, Badge, Look, MATERIALS, Studio3D, type StudioLook, BeatPulse, Callout, Captions, Counter, DeviceFrame, KineticTitle, LowerThird, MaskReveal, RingCounter, SplitScreen, ZoomPan, type Word,
} from './index';

export const DEMO_SIZE = { width: 1920, height: 1080, fps: 30 };

function Stage({ children, center = true }: { children: ReactNode; center?: boolean }) {
  const t = useTheme();
  return <AbsoluteFill style={{ background: t.colors.bg, ...(center ? { alignItems: 'center', justifyContent: 'center' } : {}) }}>{children}</AbsoluteFill>;
}

/** Stand-in "screen" for device/zoom demos: a small dashboard drawn with theme colours. */
function MockScreen() {
  const t = useTheme();
  return (
    <AbsoluteFill style={{ background: t.colors.surface, padding: 48, gap: 24, display: 'flex', flexDirection: 'column', fontFamily: t.fonts.body }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ fontSize: 40, fontWeight: 700, color: t.colors.text }}>Dashboard</div>
        <div style={{ padding: '14px 28px', borderRadius: t.radius / 2, background: t.colors.accent, color: t.colors.bg, fontSize: 28, fontWeight: 700 }}>Export</div>
      </div>
      <div style={{ display: 'flex', gap: 24, flex: 1 }}>
        {[0.8, 0.55, 0.9].map((h, i) => (
          <div key={i} style={{ flex: 1, borderRadius: t.radius / 2, background: t.colors.bg, display: 'flex', alignItems: 'flex-end', padding: 24 }}>
            <div style={{ width: '100%', height: `${h * 100}%`, borderRadius: 12, background: i === 1 ? t.colors.accent2 : t.colors.accent, opacity: 0.85 }} />
          </div>
        ))}
      </div>
    </AbsoluteFill>
  );
}

const captionWords: Word[] = 'Edit your video by pointing at it and saying what you want.'
  .split(' ')
  .map((w, i) => ({ w, s: 0.2 + i * 0.32, e: 0.2 + i * 0.32 + 0.28 }));

/**
 * A synthetic "photo" for the Look demo: sky, skin tones, foliage, a warm practical, a grey ramp.
 * Drawn once to a canvas so the demo needs no media.
 */
function useTestChart(): HTMLCanvasElement | null {
  return useMemo(() => {
    if (typeof document === 'undefined') return null;
    const c = document.createElement('canvas');
    c.width = 960;
    c.height = 1080;
    const g = c.getContext('2d')!;
    const sky = g.createLinearGradient(0, 0, 0, 620);
    sky.addColorStop(0, '#7fa6c9');
    sky.addColorStop(1, '#d9d4c8');
    g.fillStyle = sky;
    g.fillRect(0, 0, 960, 620);
    g.fillStyle = '#4f6b3a';
    for (let i = 0; i < 9; i++) {
      g.beginPath();
      g.arc(60 + i * 110, 600, 120 + (i % 3) * 30, 0, Math.PI * 2);
      g.fill();
    }
    g.fillStyle = '#6b5a4a';
    g.fillRect(0, 640, 960, 440);
    const lamp = g.createRadialGradient(800, 200, 10, 800, 200, 160);
    lamp.addColorStop(0, '#fff6dc');
    lamp.addColorStop(1, 'rgba(255,200,120,0)');
    g.fillStyle = lamp;
    g.fillRect(600, 0, 360, 420);
    ['#f1c7a8', '#e0a98a', '#c68863', '#9a6446', '#6b4430'].forEach((skin, i) => {
      g.fillStyle = skin;
      g.beginPath();
      g.ellipse(110 + i * 185, 470, 70, 92, 0, 0, Math.PI * 2);
      g.fill();
    });
    for (let i = 0; i < 12; i++) {
      const v = Math.round((i / 11) * 255);
      g.fillStyle = `rgb(${v},${v},${v})`;
      g.fillRect(i * 80, 960, 80, 120);
    }
    ['#c0392b', '#e67e22', '#f1c40f', '#27ae60', '#2980b9', '#8e44ad'].forEach((col, i) => {
      g.fillStyle = col;
      g.fillRect(40 + i * 150, 740, 120, 160);
    });
    return c;
  }, []);
}

const beats120 = Array.from({ length: 16 }, (_, i) => i * 0.5);

export const demos: Record<string, { component: ComponentType; durationInFrames: number }> = {
  KineticTitle: {
    durationInFrames: 90,
    component: () => (
      <Stage>
        <KineticTitle id="title" text="Edit video by pointing and talking." size={130} style={{ maxWidth: 1500 }} />
      </Stage>
    ),
  },
  LowerThird: {
    durationInFrames: 120,
    component: () => (
      <Stage center={false}>
        <AuroraBackground intensity={0.35} />
        <LowerThird id="name" title="Alex Rivera" subtitle="Head of Design" start={8} hold={80} />
      </Stage>
    ),
  },
  Captions: {
    durationInFrames: 120,
    component: () => (
      <Stage center={false}>
        <AuroraBackground intensity={0.5} />
        <Captions id="captions" words={captionWords} />
      </Stage>
    ),
  },
  Counter: {
    durationInFrames: 90,
    component: () => (
      <Stage>
        <Counter id="count" to={12500} suffix="+" size={220} start={4} />
      </Stage>
    ),
  },
  SplitScreen: {
    durationInFrames: 90,
    component: () => {
      const t = useTheme();
      const pane = (label: string, bg: string) => (
        <AbsoluteFill style={{ background: bg, alignItems: 'center', justifyContent: 'center', fontFamily: t.fonts.display, fontSize: 110, color: t.colors.text }}>{label}</AbsoluteFill>
      );
      return <Stage><SplitScreen id="split" a={pane('Before', t.colors.surface)} b={pane('After', `${t.colors.accent}55`)} start={4} /></Stage>;
    },
  },
  DeviceFrame: {
    durationInFrames: 120,
    component: () => (
      <Stage>
        <div style={{ display: 'flex', gap: 80, alignItems: 'center' }}>
          <DeviceFrame id="browser" device="browser" width={1100}><MockScreen /></DeviceFrame>
          <DeviceFrame id="phone" device="phone" width={330} start={10}><AuroraBackground speed={2} /></DeviceFrame>
        </div>
      </Stage>
    ),
  },
  ZoomPan: {
    durationInFrames: 120,
    component: () => (
      <Stage>
        <ZoomPan keys={[{ at: 10, x: 0.5, y: 0.5, scale: 1 }, { at: 45, x: 0.86, y: 0.1, scale: 2.4 }, { at: 85, x: 0.86, y: 0.1, scale: 2.4 }, { at: 115, x: 0.5, y: 0.5, scale: 1 }]}>
          <MockScreen />
        </ZoomPan>
      </Stage>
    ),
  },
  MaskReveal: {
    durationInFrames: 90,
    component: () => (
      <Stage>
        <MaskReveal shape="circle" start={6} duration={30}>
          <AuroraBackground />
          <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center' }}>
            <KineticTitle id="reveal" text="Revealed" size={160} mode="rise" start={20} />
          </AbsoluteFill>
        </MaskReveal>
      </Stage>
    ),
  },
  RingCounter: {
    durationInFrames: 90,
    component: () => (
      <Stage>
        <div style={{ display: 'flex', gap: 120 }}>
          <RingCounter id="reps" value={2} label="Reps" progress={2 / 3} size={300} />
          <RingCounter id="timer" value="0:45" label="Rest" progress={0.75} size={300} start={10} />
        </div>
      </Stage>
    ),
  },
  Badge: {
    durationInFrames: 90,
    component: () => (
      <Stage>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 36, alignItems: 'flex-start' }}>
          <Badge id="press" icon="▲" text="Press 0.2s" tone="dark" size={56} />
          <Badge id="lower" icon="▼" text="Lower 0.8s" tone="alert" size={56} start={10} />
          <Badge id="form" text="Form check" tone="accent" size={56} start={20} />
        </div>
      </Stage>
    ),
  },
  Callout: {
    durationInFrames: 90,
    component: () => (
      <Stage center={false}>
        <MockScreen />
        <Callout id="circle" x={1650} y={34} w={250} h={104} shape="circle" label="Click here" start={10} />
      </Stage>
    ),
  },
  BeatPulse: {
    durationInFrames: 120,
    component: () => {
      const t = useTheme();
      return (
        <Stage>
          <BeatPulse beats={beats120} amount={0.12} decay={7}>
            <div style={{ width: 360, height: 360, borderRadius: t.radius * 2, background: t.colors.accent, display: 'grid', placeItems: 'center', fontFamily: t.fonts.display, fontSize: 120, color: t.colors.bg }}>120</div>
          </BeatPulse>
        </Stage>
      );
    },
  },
  AuroraBackground: {
    durationInFrames: 150,
    component: () => (
      <Stage>
        <AuroraBackground speed={3} />
        <KineticTitle id="aurora-title" text="Ship something great" size={120} mode="blur" />
      </Stage>
    ),
  },
  Look: {
    durationInFrames: 90,
    component: () => {
      const t = useTheme();
      const chart = useTestChart();
      const f = useCurrentFrame();
      const amount = interpolate(f, [5, 35], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
      const label = (text: string) => (
        <div style={{ position: 'absolute', top: 36, left: 40, padding: '10px 22px', borderRadius: 999, background: t.colors.bg, color: t.colors.text, fontFamily: t.fonts.body, fontSize: 34, fontWeight: 700 }}>{text}</div>
      );
      return (
        <Stage center={false}>
          <div style={{ position: 'absolute', left: 0, top: 0, width: 960, height: 1080 }}>
            <GradedSource source={chart} />
            {label('Original')}
          </div>
          <div style={{ position: 'absolute', left: 960, top: 0, width: 960, height: 1080 }}>
            <Look exposure={0.15} contrast={1.05} vibrance={0.2} look="teal-orange" amount={amount}>
              <GradedSource source={chart} />
            </Look>
            {label('Look: teal-orange')}
          </div>
        </Stage>
      );
    },
  },
  Studio3D: {
    durationInFrames: 90,
    component: () => {
      const t = useTheme();
      const f = useCurrentFrame();
      const spin = f * 0.012;
      const objects = (physical: boolean) => (
        <>
          <mesh position={[-1.25, 0.6, 0.3]}>
            <sphereGeometry args={[0.6, 64, 64]} />
            {physical ? <meshPhysicalMaterial {...MATERIALS.glass} /> : <meshStandardMaterial color="#cfe3f2" />}
          </mesh>
          <mesh position={[0, 0.75, -0.4]} rotation={[0.3, spin, 0]}>
            <torusKnotGeometry args={[0.45, 0.16, 200, 32]} />
            {physical ? <meshPhysicalMaterial {...MATERIALS.chrome} /> : <meshStandardMaterial color="#d8dde2" metalness={0.8} roughness={0.3} />}
          </mesh>
          <mesh position={[1.25, 0.45, 0.3]} rotation={[0, -spin, 0]}>
            <boxGeometry args={[0.9, 0.9, 0.9]} />
            {physical ? <meshPhysicalMaterial {...MATERIALS.plastic} color={t.colors.accent} /> : <meshStandardMaterial color={t.colors.accent} />}
          </mesh>
        </>
      );
      const half = (look: StudioLook, label: string, x: number) => (
        <div style={{ position: 'absolute', left: x, top: 0, width: 960, height: 1080, background: '#16130f' }}>
          <Studio3D id={`studio-${look}`} width={960} height={1080} look={look} backdrop="#2c2925" camera={{ position: [0, 2.4, 7.4], fov: 34, lookAt: [0, 0.55, 0] }} focus={look === 'basic' ? 0 : 7.6}>
            {objects(look !== 'basic')}
          </Studio3D>
          <div style={{ position: 'absolute', top: 36, left: 40, padding: '10px 22px', borderRadius: 999, background: t.colors.bg, color: t.colors.text, fontFamily: t.fonts.body, fontSize: 34, fontWeight: 700 }}>{label}</div>
        </div>
      );
      return (
        <Stage center={false}>
          {half('basic', 'Basic Three.js', 0)}
          {half('studio', 'Studio3D look="studio"', 960)}
        </Stage>
      );
    },
  },
};
