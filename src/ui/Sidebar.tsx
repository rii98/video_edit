import { useState } from 'react';
import type { AgentStatus, EditRequest, ExportJob, MediaAsset, Version } from '../shared/types.ts';
import { ExportList } from './Exports';
import { api, type Upload } from './api';
import { MediaPanel } from './MediaPanel';
import { RequestItem } from './RequestItem';

function relativeTime(iso: string): string {
  const s = Math.round((Date.now() - Date.parse(iso)) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return new Date(iso).toLocaleDateString();
}

export function AgentPill({ agent, connected }: { agent: AgentStatus | null; connected: boolean }) {
  if (!connected) return <span className="pill offline">Dev server disconnected</span>;
  const state = agent?.state ?? 'offline';
  const label = state === 'working' ? `Claude is working${agent?.requestId ? ` on #${agent.requestId}` : ''}` : state === 'listening' ? 'Claude is listening' : 'Claude not connected';
  return <span className={`pill ${state}`}>{label}</span>;
}

export function Sidebar({
  agent,
  requests,
  versions,
  media,
  exports,
  uploads,
  onUpload,
  onOpenRequest,
  onCompare,
}: {
  agent: AgentStatus | null;
  requests: EditRequest[];
  versions: Version[];
  media: MediaAsset[];
  exports: ExportJob[];
  uploads: Upload[];
  onUpload: (files: File[]) => void;
  onOpenRequest: (r: EditRequest) => void;
  onCompare: (v: Version) => void;
}) {
  const [tab, setTab] = useState<'edits' | 'media'>('edits');
  const waiting = requests.filter((r) => r.status === 'needs-input');
  const [confirming, setConfirming] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const busy = requests.some((r) => r.status === 'working');

  const restore = async (sha: string) => {
    setConfirming(null);
    setError(null);
    try {
      await api.restore(sha);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  return (
    <aside className="sidebar">
      <div className={`agent-card ${agent?.state ?? 'offline'}`}>
        {agent?.state === 'working' ? (
          <>
            <div className="agent-title">Working on #{agent.requestId}</div>
            <div className="agent-msg">{agent.message || 'Editing…'}</div>
          </>
        ) : agent?.state === 'listening' ? (
          <>
            <div className="agent-title">{waiting.length ? 'Waiting for you' : 'Ready'}</div>
            <div className="agent-msg">
              {waiting.length ? `Claude asked a question on #${waiting.map((r) => r.id).join(', #')}. Answer it in the thread below.` : 'Point at a frame and describe your change.'}
            </div>
          </>
        ) : (
          <>
            <div className="agent-title">Claude isn't listening</div>
            <div className="agent-msg">
              In the Claude Code terminal, say <em>"start listening"</em>. Requests you send now will wait in the queue.
            </div>
          </>
        )}
      </div>

      <div className="tabs" role="tablist">
        <button role="tab" aria-selected={tab === 'edits'} className={tab === 'edits' ? 'on' : ''} onClick={() => setTab('edits')}>
          Edits <span className="count">{requests.length}</span>
          {waiting.length > 0 && <span className="dot" title="Claude is waiting for your answer" />}
        </button>
        <button role="tab" aria-selected={tab === 'media'} className={tab === 'media' ? 'on' : ''} onClick={() => setTab('media')}>
          Media <span className="count">{media.length}</span>
          {uploads.length > 0 && <span className="dot" />}
        </button>
      </div>

      {tab === 'media' ? (
        <MediaPanel media={media} uploads={uploads} onUpload={onUpload} />
      ) : (
        <>
          <h3>Edit requests</h3>
          <ol className="requests">
            {requests.length === 0 && <li className="empty">Nothing yet. Your requests appear here.</li>}
            {[...requests].reverse().map((r) => (
              <RequestItem key={r.id} r={r} onOpen={onOpenRequest} />
            ))}
          </ol>

          <h3>Versions</h3>
          {error && <div className="error small">{error}</div>}
          <ol className="versions">
            {versions.map((v, i) => (
              <li key={v.sha} className="version">
                <div className="version-text">
                  <div className="version-subject">{v.subject}</div>
                  <div className="muted small">
                    {v.short} · {relativeTime(v.date)}
                  </div>
                </div>
                {i === 0 ? (
                  <span className="muted small">current</span>
                ) : confirming === v.sha ? (
                  <button className="danger small-btn" onClick={() => void restore(v.sha)}>
                    Confirm
                  </button>
                ) : (
                  <span className="version-actions">
                    <button className="small-btn" onClick={() => onCompare(v)} title="See this version next to the current one at the playhead">
                      Compare
                    </button>
                    <button className="small-btn" disabled={busy} title={busy ? 'Wait for Claude to finish' : 'Go back to this version'} onClick={() => setConfirming(v.sha)}>
                      Restore
                    </button>
                  </span>
                )}
              </li>
            ))}
          </ol>
          <ExportList jobs={exports} />
        </>
      )}
    </aside>
  );
}
