// What's in the library, as plain data (no JSX) so the `ev` CLI can print it cheaply.
// A unit test keeps this in sync with library/index.ts and library/demos.tsx.

export interface CatalogEntry {
  name: string;
  summary: string;
  usage: string;
  tags: string[];
  /** Technique cards (library/techniques/<slug>.md) this component implements. */
  techniques: string[];
  /** Sound-only components have no visual demo. */
  audio?: boolean;
}

export const catalog: CatalogEntry[] = [
  {
    name: 'KineticTitle',
    summary: 'Headline revealed word-by-word or letter-by-letter: mask (premium), rise, blur, scale.',
    usage: '<KineticTitle id="headline" text="Meet the new way to edit" mode="mask" size={120} start={6} />',
    tags: ['text', 'title', 'intro'],
    techniques: ['kinetic-typography', 'premium-product-reveal'],
  },
  {
    name: 'LowerThird',
    summary: 'Name/role graphic in the title-safe area; animates in, holds, animates out.',
    usage: '<LowerThird id="speaker" title="Alex Rivera" subtitle="Head of Design" start={15} hold={150} />',
    tags: ['text', 'interview', 'broadcast'],
    techniques: ['lower-thirds'],
  },
  {
    name: 'Captions',
    summary: 'Social captions from a transcript: 2–5 words at a time, spoken word highlighted, safe-zone aware.',
    usage: '<Captions id="captions" assetId="interview-ab12cd34" offset={3.2} maxWords={4} />',
    tags: ['text', 'social', 'accessibility'],
    techniques: ['social-vertical-captions'],
  },
  {
    name: 'Counter',
    summary: 'Number that counts up with tabular digits: stats, prices, percentages.',
    usage: '<Counter id="users" to={12500} suffix="+" start={10} duration={45} />',
    tags: ['text', 'data'],
    techniques: ['motion-timing-and-easing'],
  },
  {
    name: 'SplitScreen',
    summary: 'Two panes side by side or stacked, sliding in with a drawn divider. Comparisons, before/after.',
    usage: '<SplitScreen id="compare" a={<Footage id="before-…" />} b={<Footage id="after-…" />} />',
    tags: ['layout', 'comparison'],
    techniques: ['split-screen-comparison'],
  },
  {
    name: 'DeviceFrame',
    summary: 'Phone, browser window or laptop around footage or a screen; rises in and floats.',
    usage: '<DeviceFrame id="phone" device="phone"><Footage id="app-demo-…" /></DeviceFrame>',
    tags: ['layout', 'product', 'demo'],
    techniques: ['screen-demo-zoom', 'premium-product-reveal'],
  },
  {
    name: 'ZoomPan',
    summary: 'Virtual camera: push-ins, pans and zoom-to-click over any content, with clamped edges.',
    usage: '<ZoomPan keys={[{ at: 0, x: 0.5, y: 0.5, scale: 1 }, { at: 30, x: 0.8, y: 0.2, scale: 2.2 }]}>…</ZoomPan>',
    tags: ['camera', 'demo'],
    techniques: ['screen-demo-zoom', 'premium-product-reveal'],
  },
  {
    name: 'MaskReveal',
    summary: 'Reveals children through an animated wipe, expanding circle or inset.',
    usage: '<MaskReveal shape="circle" start={0} duration={24}><Picture id="hero-…" /></MaskReveal>',
    tags: ['transition', 'reveal'],
    techniques: ['transitions-match-whip-mask'],
  },
  {
    name: 'RingCounter',
    summary: 'Circular progress ring with a big value: rep counts, timers, scores.',
    usage: '<RingCounter id="reps" value={2} label="Reps" progress={2 / 3} />',
    tags: ['hud', 'sport', 'data'],
    techniques: ['fitness-hud-overlays'],
  },
  {
    name: 'Badge',
    summary: 'Pill tag that expands in: tempo cues, stats, labels ("▲ PRESS 0.2s", "FORM CHECK").',
    usage: '<Badge id="cue" icon="▲" text="Press 0.2s" tone="dark" start={8} />',
    tags: ['hud', 'sport', 'label'],
    techniques: ['fitness-hud-overlays'],
  },
  {
    name: 'Callout',
    summary: 'Self-drawing hand-drawn circle, underline, box or arrow with a label. Points at things.',
    usage: '<Callout id="look-here" x={1200} y={300} w={300} h={160} shape="circle" label="New!" start={10} />',
    tags: ['annotation', 'demo'],
    techniques: ['screen-demo-zoom'],
  },
  {
    name: 'BeatPulse',
    summary: 'Pulses its children on the beats or downbeats of a music asset (or useBeatEnvelope for any property).',
    usage: '<BeatPulse assetId="track-…" on="downbeats" amount={0.05}><Logo /></BeatPulse>',
    tags: ['music', 'rhythm'],
    techniques: ['cutting-to-music'],
  },
  {
    name: 'AuroraBackground',
    summary: 'Slow drifting mesh-gradient colour fields with a vignette, from the theme accents.',
    usage: '<AuroraBackground speed={1} />',
    tags: ['background', 'saas'],
    techniques: ['dark-saas-aurora'],
  },
  {
    name: 'Sfx',
    summary: 'A synthesized sound effect at a frame: whoosh, riser, hit, click, pop, shimmer (create with `ev sfx`).',
    usage: '<Sfx id="sfx-whoosh-…" at={42} volume={0.7} />',
    tags: ['audio', 'sound design'],
    techniques: ['sound-design'],
    audio: true,
  },
  {
    name: 'Voiceover',
    summary: 'A voiceover asset (Deepgram TTS via `ev tts`, or a recording) starting at a frame.',
    usage: '<Voiceover id="voice-…" at={15} />',
    tags: ['audio', 'voice'],
    techniques: ['sound-design'],
    audio: true,
  },
  {
    name: 'DuckedMusic',
    summary: 'Music that dips smoothly under a voiceover, driven by its word timings.',
    usage: '<DuckedMusic id="track-…" voiceId="voice-…" voiceAt={15} volume={0.8} duckTo={0.4} />',
    tags: ['audio', 'music', 'mix'],
    techniques: ['sound-design', 'cutting-to-music'],
    audio: true,
  },
];
