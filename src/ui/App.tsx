import { useCallback, useEffect, useRef, useState } from 'react';
import type { PlayerRef } from '@remotion/player';
import { formatTime, totalFrames } from '../shared/timeline.ts';
import type { EditRequest, FrameRange, Version } from '../shared/types.ts';
import { theme } from '../video/kit';
import { timeline } from '../video/Main';
import { useServerState, useUploads } from './api';
import { Composer } from './Composer';
import { CompareModal } from './CompareModal';
import { ExportButton, ExportNotice } from './Exports';
import { IntakeView } from './IntakeView';
import { ProjectSwitcher } from './ProjectSwitcher';
import { LibraryView } from './LibraryView';
import { AgentPill, Sidebar } from './Sidebar';
import { Stage, type Selection } from './Stage';
import { Timeline } from './Timeline';

export function App() {
  const playerRef = useRef<PlayerRef>(null);
  const [frame, setFrame] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [selection, setSelection] = useState<Selection | null>(null);
  const [range, setRange] = useState<FrameRange | null>(null);
  const [comparing, setComparing] = useState<Version | null>(null);
  const { state, connected } = useServerState();
  const { uploads, upload } = useUploads();
  const [dragging, setDragging] = useState(false);
  type View = 'editor' | 'intake' | 'library';
  const viewFromHash = (): View => {
    const hash = window.location.hash.slice(1);
    return hash === 'library' || hash === 'intake' ? hash : 'editor';
  };
  const [view, setView] = useState<View>(viewFromHash);
  const viewRef = useRef(view);
  viewRef.current = view;
  useEffect(() => {
    const onHash = () => setView(viewFromHash());
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);
  const go = (next: View) => {
    if (next !== 'editor') playerRef.current?.pause();
    window.location.hash = next === 'editor' ? '' : next;
    setView(next);
  };
  const total = totalFrames(timeline);

  // Drop files anywhere in the window to add them to the media library.
  useEffect(() => {
    let depth = 0; // dragenter/leave fire for every child element
    const hasFiles = (e: DragEvent) => e.dataTransfer?.types.includes('Files') ?? false;
    const onEnter = (e: DragEvent) => {
      if (!hasFiles(e)) return;
      depth++;
      setDragging(true);
    };
    const onLeave = (e: DragEvent) => {
      if (!hasFiles(e)) return;
      if (--depth <= 0) (depth = 0), setDragging(false);
    };
    const onOver = (e: DragEvent) => hasFiles(e) && e.preventDefault();
    const onDrop = (e: DragEvent) => {
      if (!hasFiles(e)) return;
      e.preventDefault();
      depth = 0;
      setDragging(false);
      upload(Array.from(e.dataTransfer?.files ?? []));
    };
    window.addEventListener('dragenter', onEnter);
    window.addEventListener('dragleave', onLeave);
    window.addEventListener('dragover', onOver);
    window.addEventListener('drop', onDrop);
    return () => {
      window.removeEventListener('dragenter', onEnter);
      window.removeEventListener('dragleave', onLeave);
      window.removeEventListener('dragover', onOver);
      window.removeEventListener('drop', onDrop);
    };
  }, [upload]);

  useEffect(() => {
    const player = playerRef.current;
    if (!player) return;
    const onFrame = (e: { detail: { frame: number } }) => setFrame(e.detail.frame);
    const onPlay = () => setPlaying(true);
    const onPause = () => setPlaying(false);
    player.addEventListener('frameupdate', onFrame);
    player.addEventListener('play', onPlay);
    player.addEventListener('pause', onPause);
    return () => {
      player.removeEventListener('frameupdate', onFrame);
      player.removeEventListener('play', onPlay);
      player.removeEventListener('pause', onPause);
    };
  }, []);

  const seek = useCallback(
    (f: number) => {
      playerRef.current?.seekTo(Math.min(Math.max(0, f), total - 1));
    },
    [total],
  );

  const togglePlay = useCallback(() => {
    const player = playerRef.current;
    if (!player) return;
    if (player.isPlaying()) return player.pause();
    setSelection(null);
    player.play();
  }, []);

  const openRequest = useCallback(
    (r: EditRequest) => {
      playerRef.current?.pause();
      seek(r.frame);
      setSelection({ frame: r.frame, pin: r.pin, region: r.region, layers: r.layers });
    },
    [seek],
  );

  // Editor shortcuts, suspended while typing.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // Editor shortcuts only act in the editor, and not under a dialog.
      if (viewRef.current !== 'editor' || document.querySelector('.modal')) return;
      const target = e.target as HTMLElement;
      // Escape cancels the pin even while typing: dropping a pin focuses the prompt box.
      if (e.key === 'Escape') {
        setSelection(null);
        setRange(null);
        if (target instanceof HTMLElement) target.blur();
        return;
      }
      if (target.closest('textarea, input, [contenteditable]')) return;
      const step = e.shiftKey ? 10 : 1;
      const current = playerRef.current?.getCurrentFrame() ?? 0;
      if (e.code === 'Space') {
        e.preventDefault();
        togglePlay();
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        seek(current - step);
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        seek(current + step);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [seek, togglePlay]);

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <span className="logo" /> Easy Video
        </div>
        <ProjectSwitcher state={state} />
        <nav className="nav" aria-label="View">
          <button className={view === 'editor' ? 'on' : ''} onClick={() => go('editor')}>
            Editor
          </button>
          <button className={view === 'intake' ? 'on' : ''} onClick={() => go('intake')}>
            Intake
          </button>
          <button className={view === 'library' ? 'on' : ''} onClick={() => go('library')}>
            Library
          </button>
        </nav>
        <div className="muted small">
          {timeline.width}×{timeline.height} · {timeline.fps}fps · theme: {theme.name}
        </div>
        <div className="topbar-right">
          <AgentPill agent={state?.agent ?? null} connected={connected} />
          <ExportButton jobs={state?.exports ?? []} />
          <ExportNotice jobs={state?.exports ?? []} />
        </div>
      </header>

      {view === 'library' && <LibraryView media={state?.media ?? []} />}
      {view === 'intake' && <IntakeView onSent={() => go('editor')} />}

      {/* Kept mounted while hidden so the player, playhead and pin survive switching views. */}
      <div className="editor" hidden={view !== 'editor'}>
        <main className="workspace">
          <section className="viewer">
            <Stage playerRef={playerRef} selection={selection} onSelect={setSelection} />
          </section>
          <Sidebar
            agent={state?.agent ?? null}
            requests={state?.requests ?? []}
            versions={state?.versions ?? []}
            media={state?.media ?? []}
          exports={state?.exports ?? []}
            uploads={uploads}
            onUpload={upload}
            onOpenRequest={openRequest}
            onCompare={(v) => {
              playerRef.current?.pause();
              setComparing(v);
            }}
          />
        </main>

        <section className="transport">
          <div className="controls">
            <button className="icon-btn" onClick={() => seek(frame - 1)} title="Previous frame (←)">
              ⏮
            </button>
            <button className="icon-btn play" onClick={togglePlay} title="Play / pause (Space)">
              {playing ? '❚❚' : '▶'}
            </button>
            <button className="icon-btn" onClick={() => seek(frame + 1)} title="Next frame (→)">
              ⏭
            </button>
            <span className="timecode">
              {formatTime(frame, timeline.fps)} <span className="muted">/ {formatTime(total - 1, timeline.fps)}</span>
            </span>
            <span className="muted small">frame {frame}</span>
          </div>
          <Timeline timeline={timeline} frame={frame} requests={state?.requests ?? []} onSeek={seek} onOpenRequest={openRequest} range={range} onRange={setRange} />
        </section>

        <Composer
            frame={frame}
            selection={selection}
            range={range}
            onSent={() => {
              setSelection(null);
              setRange(null);
            }}
          />
      </div>

      {comparing && <CompareModal version={comparing} frame={frame} onClose={() => setComparing(null)} />}

      {dragging && (
        <div className="drop-overlay">
          <div>Drop to add to the media library</div>
        </div>
      )}
    </div>
  );
}
