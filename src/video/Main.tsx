import type { ComponentType } from 'react';
import { AbsoluteFill } from 'remotion';
import { linearTiming, TransitionSeries, type TransitionPresentation } from '@remotion/transitions';
import { fade } from '@remotion/transitions/fade';
import { slide } from '@remotion/transitions/slide';
import { wipe } from '@remotion/transitions/wipe';
import timelineJson from '../../project/timeline.json';
import { scenes as registry } from '../../project/scenes';
import type { MainProps, Timeline, TransitionType } from '../shared/types.ts';
import { ease, MediaModeProvider, SceneProvider, theme } from './kit';

export const timeline = timelineJson as Timeline;

const presentations: Record<TransitionType, () => TransitionPresentation<any>> = {
  fade: () => fade(),
  slide: () => slide({ direction: 'from-right' }),
  wipe: () => wipe({ direction: 'from-left' }),
};

function MissingScene({ id }: { id: string }) {
  return (
    <AbsoluteFill style={{ background: '#300', color: '#fff', alignItems: 'center', justifyContent: 'center', fontSize: 48, fontFamily: 'monospace' }}>
      Scene "{id}" is in timeline.json but not in project/scenes/index.ts
    </AbsoluteFill>
  );
}

export function Main({ pin, region, proxy }: MainProps) {
  return (
    <MediaModeProvider proxy={proxy}>
      <AbsoluteFill style={{ background: theme.colors.bg }}>
        <TransitionSeries>
          {timeline.scenes.flatMap((entry, i) => {
            const Scene: ComponentType | undefined = registry[entry.id];
            const items = [
              // premountFor: load each scene's footage 1 s before its cut, so preview playback doesn't
              // flash black or stutter while the next clip seeks. (No effect on rendering.)
              <TransitionSeries.Sequence key={entry.id} durationInFrames={entry.durationInFrames} premountFor={30} name={`${entry.id} ${entry.name}`}>
                <SceneProvider id={entry.id}>
                  <AbsoluteFill style={{ background: theme.colors.bg }}>
                    {Scene ? <Scene /> : <MissingScene id={entry.id} />}
                  </AbsoluteFill>
                </SceneProvider>
              </TransitionSeries.Sequence>,
            ];
            if (entry.transition && i < timeline.scenes.length - 1) {
              items.push(
                <TransitionSeries.Transition
                  key={`${entry.id}-transition`}
                  presentation={presentations[entry.transition.type]()}
                  timing={linearTiming({ durationInFrames: entry.transition.durationInFrames, easing: ease.emphasized })}
                />,
              );
            }
            return items;
          })}
        </TransitionSeries>
        {(pin || region) && <Annotation pin={pin} region={region} />}
      </AbsoluteFill>
    </MediaModeProvider>
  );
}

/** Drawn only into snapshots, so Claude sees exactly where the user pointed. */
function Annotation({ pin, region }: Pick<MainProps, 'pin' | 'region'>) {
  const color = '#ff2d55';
  return (
    <AbsoluteFill style={{ pointerEvents: 'none' }}>
      {region && (
        <div
          style={{
            position: 'absolute',
            left: `${region.x * 100}%`,
            top: `${region.y * 100}%`,
            width: `${region.w * 100}%`,
            height: `${region.h * 100}%`,
            border: `4px dashed ${color}`,
            background: 'rgba(255,45,85,0.08)',
          }}
        />
      )}
      {pin && (
        <div
          style={{
            position: 'absolute',
            left: `${pin.x * 100}%`,
            top: `${pin.y * 100}%`,
            width: 56,
            height: 56,
            marginLeft: -28,
            marginTop: -28,
            borderRadius: '50%',
            border: `5px solid ${color}`,
            boxShadow: '0 0 0 3px #fff',
          }}
        />
      )}
    </AbsoluteFill>
  );
}
