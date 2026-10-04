// Placeholder for a brand-new project; the intake (new-video skill) replaces it.
// Static on purpose: a fresh project should show something on frame 0, not an empty fade.
import { AbsoluteFill } from 'remotion';
import { Layer, useTheme } from '../../src/video/kit';

export function S01_Start() {
  const t = useTheme();
  return (
    <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center', gap: 28 }}>
      <Layer id="title" style={{ fontFamily: t.fonts.display, fontSize: 110, color: t.colors.text }}>
        A new video starts here.
      </Layer>
      <Layer id="hint" style={{ fontFamily: t.fonts.body, fontSize: 34, color: t.colors.muted }}>
        Add media, then tell Claude what it's for.
      </Layer>
    </AbsoluteFill>
  );
}
