import { useEffect, useState } from 'react';
import { formatTime } from '../shared/timeline.ts';
import type { Version } from '../shared/types.ts';
import { timeline } from '../video/Main';
import { api } from './api';

/** Current project vs an earlier version, rendered at the same frame. */
export function CompareModal({ version, frame, onClose }: { version: Version; frame: number; onClose: () => void }) {
  const [images, setImages] = useState<{ current: string; version: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [restoring, setRestoring] = useState(false);

  useEffect(() => {
    let cancelled = false;
    api
      .compare(version.sha, frame)
      .then((r) => !cancelled && setImages(r))
      .catch((err) => !cancelled && setError(err instanceof Error ? err.message : String(err)));
    return () => {
      cancelled = true;
    };
  }, [version.sha, frame]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const restore = async () => {
    setRestoring(true);
    try {
      await api.restore(version.sha);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setRestoring(false);
    }
  };

  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal compare" role="dialog" aria-label="Compare versions">
        <header>
          <strong>Compare at frame {frame}</strong>
          <span className="muted small">{formatTime(frame, timeline.fps)}</span>
          <button className="link close" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </header>
        {error ? (
          <div className="error">{error}</div>
        ) : !images ? (
          <div className="muted compare-loading">Rendering both versions at this frame…</div>
        ) : (
          <div className="compare-grid">
            <figure>
              <figcaption>Current</figcaption>
              <img src={images.current} alt="Current version" />
            </figure>
            <figure>
              <figcaption>
                {version.subject} <span className="muted small">{version.short}</span>
              </figcaption>
              <img src={images.version} alt={`Version ${version.short}`} />
            </figure>
          </div>
        )}
        <footer>
          <button className="small-btn" onClick={onClose}>
            Keep current
          </button>
          <button className="primary" disabled={restoring || !images} onClick={() => void restore()}>
            {restoring ? 'Restoring…' : 'Restore this version'}
          </button>
        </footer>
      </div>
    </div>
  );
}
