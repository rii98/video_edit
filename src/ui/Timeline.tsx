import { useRef, type PointerEvent } from 'react';
import { layoutScenes, totalFrames } from '../shared/timeline.ts';
import type { EditRequest, FrameRange, Timeline as TimelineData } from '../shared/types.ts';

export function Timeline({
  timeline,
  frame,
  requests,
  onSeek,
  onOpenRequest,
  range,
  onRange,
}: {
  timeline: TimelineData;
  frame: number;
  requests: EditRequest[];
  onSeek: (frame: number) => void;
  onOpenRequest: (request: EditRequest) => void;
  range: FrameRange | null;
  onRange: (range: FrameRange | null) => void;
}) {
  const trackRef = useRef<HTMLDivElement>(null);
  /** Anchor frame of an in-progress Shift+drag range selection. */
  const anchor = useRef<number | null>(null);
  const total = totalFrames(timeline);
  const scenes = layoutScenes(timeline);
  const pct = (f: number) => `${(f / total) * 100}%`;

  const frameAt = (clientX: number) => {
    const r = trackRef.current!.getBoundingClientRect();
    return Math.round(Math.min(1, Math.max(0, (clientX - r.left) / r.width)) * (total - 1));
  };

  // Plain drag scrubs; Shift+drag selects a range (for "change everything from here to here").
  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    const f = frameAt(e.clientX);
    if (e.shiftKey) {
      anchor.current = f;
      onRange({ start: f, end: f });
    } else {
      anchor.current = null;
      onSeek(f);
    }
  };
  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    if (!e.currentTarget.hasPointerCapture(e.pointerId)) return;
    const f = frameAt(e.clientX);
    if (anchor.current !== null) onRange({ start: Math.min(anchor.current, f), end: Math.max(anchor.current, f) });
    else onSeek(f);
  };
  const onPointerUp = () => {
    if (anchor.current !== null && range && range.end - range.start < 3) onRange(null); // a Shift+click, not a drag
    if (anchor.current !== null && range) onSeek(range.start);
    anchor.current = null;
  };

  // One tick per second; labels thin out on long videos.
  const seconds = Math.floor(total / timeline.fps);
  const labelEvery = seconds > 60 ? 10 : seconds > 20 ? 5 : 1;

  return (
    <div className="timeline">
      <div className="ruler">
        {Array.from({ length: seconds + 1 }, (_, s) => (
          <span key={s} className="tick" style={{ left: pct(s * timeline.fps) }}>
            {s % labelEvery === 0 ? `${s}s` : ''}
          </span>
        ))}
      </div>
      <div ref={trackRef} className="track" onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} title="Drag to scrub · Shift+drag to select a range">
        {scenes.map((s) => {
          const active = frame >= s.from && frame < s.from + s.durationInFrames;
          return (
            <div key={s.id} className={`scene-block${active ? ' active' : ''}`} style={{ left: pct(s.from), width: pct(s.durationInFrames) }} title={`${s.id} · ${s.name}`}>
              <span className="scene-id">{s.id}</span> {s.name}
            </div>
          );
        })}
        {requests.map((r) => (
          <button
            key={r.id}
            className={`marker ${r.status}`}
            style={{ left: pct(r.frame) }}
            title={`#${r.id} ${r.prompt}`}
            onPointerDown={(e) => e.stopPropagation()}
            onClick={() => onOpenRequest(r)}
          />
        ))}
        {range && <div className="range-sel" style={{ left: pct(range.start), width: pct(range.end - range.start) }} />}
        <div className="playhead" style={{ left: pct(frame) }} />
      </div>
    </div>
  );
}
