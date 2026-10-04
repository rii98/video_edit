// Wraps a treatment's motion test with its scene id, theme and media mode, so the same
// component renders identically in the editor's Intake view and in Remotion stills.
import type { ComponentType } from 'react';
import intakeJson from '../../project/intake/intake.json';
import { treatmentComponents } from '../../project/intake';
import { themes } from '../../library/themes';
import type { Intake } from '../shared/types.ts';
import { MediaModeProvider, SceneProvider, ThemeProvider } from './kit';

export const intake = intakeJson as Intake;

export function treatmentComponent(id: string): ComponentType<{ proxy: boolean }> {
  const Test = treatmentComponents[id];
  const tokens = themes[intake.treatments.find((t) => t.id === id)?.theme ?? ''];
  return function TreatmentWithTheme({ proxy }: { proxy: boolean }) {
    if (!Test) return null;
    const body = (
      <MediaModeProvider proxy={proxy}>
        <SceneProvider id={`T${id}`}>
          <Test />
        </SceneProvider>
      </MediaModeProvider>
    );
    return tokens ? <ThemeProvider tokens={tokens}>{body}</ThemeProvider> : body;
  };
}
