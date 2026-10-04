import { AbsoluteFill } from 'remotion';
import { RingCounter } from '../../library';
import { useTheme } from '../../src/video/kit';

export function T_B() {
  const t = useTheme();
  return (
    <AbsoluteFill style={{ background: t.colors.bg, alignItems: 'center', justifyContent: 'center' }}>
      <RingCounter id="reps" value={3} label="Reps" size={360} />
    </AbsoluteFill>
  );
}
