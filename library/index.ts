// Reusable motion components. Scenes import from here: `import { KineticTitle } from '../../library';`
// Every entry is documented in catalog.ts (`npm run ev -- library`) and previewed in the editor's Library tab.
export { KineticTitle, LowerThird, Captions, Counter, chunkWords, type RevealMode } from './components/text';
export { SplitScreen, DeviceFrame, ZoomPan, MaskReveal, type CameraKey } from './components/layout';
export { RingCounter, Badge, Callout } from './components/hud';
export { BeatPulse, AuroraBackground, useBeatEnvelope } from './components/rhythm';
export { Sfx, Voiceover, DuckedMusic, useDuckVolume } from './components/audio';
export { speechIntervals, duckGain } from './components/ducking';
export { useAnalysis, useTranscript, useBeats, type Word, type Beats } from './components/data';
