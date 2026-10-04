import { useEffect, useRef, useState, type FormEvent } from 'react';
import type { ServerState } from '../shared/types.ts';
import { api } from './api';

/**
 * Top-bar project menu: switch between videos or start a new one. A switch swaps folders
 * on disk and restarts the editor's server, so we wait for the new project and reload.
 */
export function ProjectSwitcher({ state }: { state: ServerState | null }) {
  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [opening, setOpening] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const close = (e: MouseEvent) => ref.current && !ref.current.contains(e.target as Node) && setOpen(false);
    window.addEventListener('mousedown', close);
    return () => window.removeEventListener('mousedown', close);
  }, []);

  /** Polls until the restarted server reports the target project, then reloads the page. */
  const waitFor = async (slug: string) => {
    for (let i = 0; i < 120; i++) {
      await new Promise((r) => setTimeout(r, 400));
      try {
        const s = (await (await fetch('/api/state')).json()) as ServerState;
        if (s.project.slug === slug) return window.location.reload();
      } catch {
        // server restarting
      }
    }
    setOpening(null);
    setError('The editor did not come back after switching. Is `npm run dev` still running?');
  };

  const run = async (label: string, action: () => Promise<{ project: { slug: string } }>) => {
    setError(null);
    setOpening(label);
    setOpen(false);
    try {
      const { project } = await action();
      await waitFor(project.slug);
    } catch (err) {
      setOpening(null);
      setOpen(true);
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  const create = (e: FormEvent) => {
    e.preventDefault();
    if (name.trim()) void run(name.trim(), () => api.createProject(name.trim()));
  };

  const current = state?.project;
  return (
    <div className="project-switcher" ref={ref}>
      <button className="project-button" onClick={() => setOpen((o) => !o)} title="Switch or create projects">
        <span className="project-name">{current?.name ?? '…'}</span> ▾
      </button>
      {open && (
        <div className="menu project-menu" role="menu">
          <div className="menu-label">Projects</div>
          {(state?.projects ?? []).map((p) => (
            <button key={p.slug} role="menuitem" className={p.active ? 'on' : ''} disabled={p.active} onClick={() => void run(p.name, () => api.switchProject(p.slug))}>
              <strong>
                {p.active ? '✓ ' : ''}
                {p.name}
              </strong>
              <span className="muted small">{p.slug}</span>
            </button>
          ))}
          {creating ? (
            <form className="new-project" onSubmit={create}>
              <input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Cold brew launch ad" maxLength={80} />
              <button className="primary small-primary" disabled={!name.trim()}>
                Create
              </button>
            </form>
          ) : (
            <button role="menuitem" onClick={() => setCreating(true)}>
              <strong>+ New project</strong>
              <span className="muted small">A fresh video with its own media, versions and exports</span>
            </button>
          )}
          {error && <div className="error small menu-error">{error}</div>}
        </div>
      )}
      {opening && (
        <div className="switch-overlay" role="status">
          <div>Opening “{opening}”…</div>
        </div>
      )}
    </div>
  );
}
