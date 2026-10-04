import { Composition, Folder } from 'remotion';
import { demoComponents, type DemoProps } from '../../library/demo-compositions';
import { demos, DEMO_SIZE } from '../../library/demos';
import { totalFrames } from '../shared/timeline.ts';
import type { MainProps } from '../shared/types.ts';
import { Main, timeline } from './Main';
import { intake, treatmentComponent } from './treatments';

// Final renders use original media; preview and snapshots pass proxy: true.
const defaultProps: MainProps = { pin: null, region: null, proxy: false };

const treatmentComponents = Object.fromEntries(intake.treatments.map((t) => [t.id, treatmentComponent(t.id)]));

export function Root() {
  return (
    <>
      <Composition
        id="Main"
        component={Main}
        durationInFrames={totalFrames(timeline)}
        fps={timeline.fps}
        width={timeline.width}
        height={timeline.height}
        defaultProps={defaultProps}
      />
      {/* Library demos, renderable as stills: `npm run ev -- demo <Name> [--theme=slug]`. */}
      <Folder name="Library">
        {Object.entries(demos).map(([name, demo]) => (
          <Composition
            key={name}
            id={`Demo-${name}`}
            component={demoComponents[name]!}
            durationInFrames={demo.durationInFrames}
            fps={DEMO_SIZE.fps}
            width={DEMO_SIZE.width}
            height={DEMO_SIZE.height}
            defaultProps={{ theme: null } as DemoProps}
          />
        ))}
      </Folder>
      {/* Intake motion tests: `npm run ev -- treatments` renders them to one sheet. */}
      <Folder name="Treatments">
        {intake.treatments.map((t) => (
          <Composition
            key={t.id}
            id={`Treatment-${t.id}`}
            component={treatmentComponents[t.id]!}
            durationInFrames={t.durationInFrames}
            fps={intake.format.fps}
            width={intake.format.width}
            height={intake.format.height}
            defaultProps={{ proxy: false }}
          />
        ))}
      </Folder>
    </>
  );
}
