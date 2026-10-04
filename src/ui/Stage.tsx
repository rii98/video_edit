import { useRef, useState, type PointerEvent, type RefObject } from 'react';
import { Player, type PlayerRef } from '@remotion/player';
import { totalFrames } from '../shared/timeline.ts';
import type { MainProps, Point, Region } from '../shared/types.ts';
import { Main, timeline } from '../video/Main';
import { hitTest } from './hitTest';

export interface Selection {
  frame: number;
  pin: Point | null;
  region: Region | null;
  layers: string[];
}

// Stable reference: a new object per render would make the Player re-render every frame.
const PLAYER_PROPS: MainProps = { pin: null, region: null, proxy: true };
const DRAG_THRESHOLD_PX = 6;

export function Stage({
  playerRef,
  selection,
  onSelect,
}: {
  playerRef: RefObject<PlayerRef | null>;
  selection: Selection | null;
  onSelect: (selection: Selection) => void;
}) {
  const stageRef = useRef<HTMLDivElement>(null);
  const [drag, setDrag] = useState<{ x0: number; y0: number; x1: number; y1: number } | null>(null);

  const toNormalized = (clientX: number, clientY: number): Point => {
    const r = stageRef.current!.getBoundingClientRect();
    return {
      x: Math.min(1, Math.max(0, (clientX - r.left) / r.width)),
      y: Math.min(1, Math.max(0, (clientY - r.top) / r.height)),
    };
  };

  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    playerRef.current?.pause();
    e.currentTarget.setPointerCapture(e.pointerId);
    setDrag({ x0: e.clientX, y0: e.clientY, x1: e.clientX, y1: e.clientY });
  };

  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    if (drag) setDrag({ ...drag, x1: e.clientX, y1: e.clientY });
  };

  const onPointerUp = (e: PointerEvent<HTMLDivElement>) => {
    if (!drag || !stageRef.current) return;
    setDrag(null);
    const frame = playerRef.current?.getCurrentFrame() ?? 0;
    const isRegion = Math.hypot(e.clientX - drag.x0, e.clientY - drag.y0) > DRAG_THRESHOLD_PX;
    if (isRegion) {
      const area = {
        left: Math.min(drag.x0, e.clientX),
        top: Math.min(drag.y0, e.clientY),
        right: Math.max(drag.x0, e.clientX),
        bottom: Math.max(drag.y0, e.clientY),
      };
      const a = toNormalized(area.left, area.top);
      const b = toNormalized(area.right, area.bottom);
      onSelect({ frame, pin: null, region: { x: a.x, y: a.y, w: b.x - a.x, h: b.y - a.y }, layers: hitTest(stageRef.current, area) });
    } else {
      const area = { left: e.clientX, top: e.clientY, right: e.clientX, bottom: e.clientY };
      onSelect({ frame, pin: toNormalized(e.clientX, e.clientY), region: null, layers: hitTest(stageRef.current, area) });
    }
  };

  const dragBox = drag && stageRef.current ? boxStyle(stageRef.current, drag) : null;

  return (
    <div className="stage-fit">
      <div ref={stageRef} className="stage" style={{ aspectRatio: `${timeline.width} / ${timeline.height}`, ['--ratio' as string]: timeline.width / timeline.height }}>
        <Player
          ref={playerRef}
          component={Main}
          inputProps={PLAYER_PROPS}
          durationInFrames={totalFrames(timeline)}
          fps={timeline.fps}
          compositionWidth={timeline.width}
          compositionHeight={timeline.height}
          style={{ width: '100%', height: '100%' }}
          controls={false}
          clickToPlay={false}
          doubleClickToFullscreen={false}
          spaceKeyToPlayOrPause={false}
          // Scenes stack many short sounds (sfx, voice, music) and premount the next scene; the
          // default of 5 shared audio tags crashes the player into a black frame.
          numberOfSharedAudioTags={32}
          acknowledgeRemotionLicense
        />
        <div className="stage-overlay" onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp}>
          {dragBox && <div className="region drafting" style={dragBox} />}
          {!drag && selection?.region && <div className="region" style={pct(selection.region)} />}
          {!drag && selection?.pin && <div className="pin" style={{ left: `${selection.pin.x * 100}%`, top: `${selection.pin.y * 100}%` }} />}
        </div>
      </div>
    </div>
  );
}

const pct = (r: Region) => ({ left: `${r.x * 100}%`, top: `${r.y * 100}%`, width: `${r.w * 100}%`, height: `${r.h * 100}%` });

function boxStyle(stage: HTMLElement, d: { x0: number; y0: number; x1: number; y1: number }) {
  const r = stage.getBoundingClientRect();
  return {
    left: Math.min(d.x0, d.x1) - r.left,
    top: Math.min(d.y0, d.y1) - r.top,
    width: Math.abs(d.x1 - d.x0),
    height: Math.abs(d.y1 - d.y0),
  };
}
