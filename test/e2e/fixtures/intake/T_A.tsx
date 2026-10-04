import { AbsoluteFill } from 'remotion';
import { AuroraBackground, KineticTitle } from '../../library';

export function T_A() {
  return (
    <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center' }}>
      <AuroraBackground />
      <KineticTitle id="title" text="Fixture calm" size={120} />
    </AbsoluteFill>
  );
}
