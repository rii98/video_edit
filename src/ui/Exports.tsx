import { useEffect, useRef, useState } from 'react';
import type { ExportJob, ExportPreset } from '../shared/types.ts';
import { api } from './api';

const PRESETS: { value: ExportPreset; label: string; hint: string }[] = [
  { value: 'final', label: 'Final', hint: 'Original media, full quality, loudness normalized to -14 LUFS for social/YouTube' },
  { value: 'draft', label: 'Draft', hint: 'Half size, fast: for a quick review on your phone' },
];

const isActive = (j: ExportJob) => j.status === 'rendering' || j.status === 'finishing';

// Progress samples per job, so the estimate uses the recent render speed: the first seconds
// (bundling, warming up) are much slower than the rest and would inflate an all-time average.
const samples = new Map<string, { t: number; p: number }[]>();
const WINDOW_MS = 10_000;
const lastEta = new Map<string, string>();

/** "~40 s left", from the last ~10 s of render speed. Null until there's enough to tell. */
export function timeLeft(j: ExportJob, now = Date.now()): string | null {
  if (j.status !== 'rendering') return null;
  const list = samples.get(j.id) ?? [];
  if (!list.length || list[list.length - 1]!.p !== j.progress) list.push({ t: now, p: j.progress });
  while (list.length > 2 && now - list[0]!.t > WINDOW_MS) list.shift();
  samples.set(j.id, list);
  const first = list[0]!;
  const last = list[list.length - 1]!;
  const rate = (last.p - first.p) / Math.max(1, last.t - first.t); // progress per ms
  // Between progress updates there may be too few samples: keep showing the last estimate.
  if (list.length < 3 || rate <= 0) return lastEta.get(j.id) ?? null;
  const left = (1 - j.progress) / rate / 1000;
  const eta = left < 60 ? `~${Math.max(1, Math.round(left))} s left` : `~${Math.round(left / 60)} min left`;
  lastEta.set(j.id, eta);
  return eta;
}

function activeLabel(j: ExportJob): string {
  if (j.status === 'finishing') return 'Normalizing loudness…';
  const eta = timeLeft(j);
  return `Rendering ${Math.round(j.progress * 100)}%${eta ? ` · ${eta}` : ''}`;
}

/** Header button with a small preset menu; shows the running export's progress and time left. */
export function ExportButton({ jobs }: { jobs: ExportJob[] }) {
  const active = jobs.find(isActive);
  const busy = Boolean(active);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // A stale "already running" (or other) error shouldn't outlive the export it was about.
  useEffect(() => {
    if (active) setError(null);
  }, [active?.id]);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const close = (e: MouseEvent) => ref.current && !ref.current.contains(e.target as Node) && setOpen(false);
    window.addEventListener('mousedown', close);
    return () => window.removeEventListener('mousedown', close);
  }, []);
  const start = async (preset: ExportPreset) => {
    setOpen(false);
    setError(null);
    try {
      await api.exportVideo(preset);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };
  return (
    <div className="export" ref={ref}>
      <button className={`primary small-primary${busy ? ' exporting' : ''}`} disabled={busy} onClick={() => setOpen((o) => !o)} title={active ? activeLabel(active) : 'Render the video'}>
        {active ? (active.status === 'finishing' ? 'Normalizing…' : `Exporting ${Math.round(active.progress * 100)}%`) : 'Export'}
        {active && <span className="export-progress" style={{ width: `${active.status === 'finishing' ? 100 : Math.round(active.progress * 100)}%` }} />}
      </button>
      {active && timeLeft(active) && <span className="muted small export-eta">{timeLeft(active)}</span>}
      {open && (
        <div className="menu" role="menu">
          {PRESETS.map((p) => (
            <button key={p.value} role="menuitem" onClick={() => void start(p.value)}>
              <strong>{p.label}</strong>
              <span className="muted small">{p.hint}</span>
            </button>
          ))}
        </div>
      )}
      {error && <span className="error small">{error}</span>}
    </div>
  );
}

/** Export jobs with live progress and download links (sidebar). */
export function ExportList({ jobs }: { jobs: ExportJob[] }) {
  if (!jobs.length) return null;
  return (
    <>
      <h3>Exports</h3>
      <ol className="exports">
        {jobs.map((j) => (
          <li key={j.id} className={`export-job ${j.status}`}>
            <div className="export-head">
              <strong>{j.preset === 'final' ? 'Final' : 'Draft'}</strong>
              <span className="muted small">{new Date(j.startedAt).toLocaleTimeString()}</span>
            </div>
            {j.status === 'rendering' || j.status === 'finishing' ? (
              <>
                <div className="bar">
                  <div style={{ width: `${Math.round(j.progress * 100)}%` }} />
                </div>
                <div className="muted small">{activeLabel(j)}</div>
              </>
            ) : j.status === 'done' ? (
              <div className="export-done">
                <a className="small-btn" href={`/api/exports/${j.id}/file`} download>
                  Download
                </a>
                <span className="muted small">
                  {j.bytes ? `${(j.bytes / 1e6).toFixed(1)} MB` : ''}
                  {j.loudness ? ` · ${j.loudness.after} LUFS` : ''}
                </span>
                <button className="link" onClick={() => void api.deleteExport(j.id)} title="Remove this export and its file">
                  Remove
                </button>
              </div>
            ) : (
              <div className="error small">{j.error ?? 'Failed'}</div>
            )}
          </li>
        ))}
      </ol>
    </>
  );
}

/**
 * "Export ready" notice: pops up when an export this tab watched running finishes (or fails),
 * with a Download button, so there's no need to keep checking the sidebar. The watched ids
 * live in sessionStorage, so it still fires after the editor reloads mid-export (it reloads
 * when the video's code changes), but a freshly opened tab never announces old exports.
 */
const WATCHING_KEY = 'ev-export-watching';

function loadWatching(): Set<string> {
  try {
    return new Set(JSON.parse(sessionStorage.getItem(WATCHING_KEY) ?? '[]') as string[]);
  } catch {
    return new Set();
  }
}

function saveWatching(ids: Set<string>) {
  try {
    sessionStorage.setItem(WATCHING_KEY, JSON.stringify([...ids]));
  } catch {
    // Storage unavailable: a reload mid-export just won't show the notice.
  }
}

export function ExportNotice({ jobs }: { jobs: ExportJob[] }) {
  const watching = useRef<Set<string>>(loadWatching());
  const [notice, setNotice] = useState<ExportJob | null>(null);
  useEffect(() => {
    for (const j of jobs) {
      if (isActive(j)) watching.current.add(j.id);
      else if (watching.current.has(j.id)) {
        watching.current.delete(j.id);
        setNotice(j);
      }
    }
    saveWatching(watching.current);
  }, [jobs]);
  useEffect(() => {
    if (!notice || notice.status !== 'done') return;
    const timer = setTimeout(() => setNotice(null), 20000);
    return () => clearTimeout(timer);
  }, [notice]);
  if (!notice) return null;
  const name = notice.preset === 'final' ? 'Final' : 'Draft';
  return (
    <div className={`toast ${notice.status}`} role="status">
      {notice.status === 'done' ? (
        <>
          <span>
            <strong>{name} export ready</strong>
            <span className="muted small">{notice.bytes ? ` · ${(notice.bytes / 1e6).toFixed(1)} MB` : ''}{notice.loudness ? ` · ${notice.loudness.after} LUFS` : ''}</span>
          </span>
          <a className="small-btn" href={`/api/exports/${notice.id}/file`} download onClick={() => setNotice(null)}>
            Download
          </a>
        </>
      ) : (
        <span>
          <strong>{name} export failed</strong> <span className="muted small">{notice.error ?? ''}</span>
        </span>
      )}
      <button className="link" onClick={() => setNotice(null)} aria-label="Dismiss">
        ✕
      </button>
    </div>
  );
}
