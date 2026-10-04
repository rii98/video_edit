import { useRef, useState } from 'react';
import type { MediaAsset } from '../shared/types.ts';
import { api, type Upload } from './api';

const KIND_ICON: Record<MediaAsset['kind'], string> = { video: '▶', image: '◼', audio: '♪' };

function statusLine(a: MediaAsset): { text: string; tone: 'busy' | 'warn' | 'ok' } {
  const steps = Object.entries(a.steps);
  const running = steps.find(([, s]) => s.state === 'running');
  const pending = steps.filter(([, s]) => s.state === 'pending');
  if (running) return { text: `Analyzing: ${running[0]}…`, tone: 'busy' };
  if (pending.length) return { text: `Queued: ${pending.map(([k]) => k).join(', ')}`, tone: 'busy' };
  const failed = steps.filter(([, s]) => s.state === 'failed');
  if (failed.length) return { text: failed.map(([k, s]) => `${k} failed: ${s.note ?? ''}`).join(' · '), tone: 'warn' };
  const needsKey = steps.find(([, s]) => s.note?.includes('DEEPGRAM_API_KEY'));
  if (needsKey) return { text: 'Ready · transcript needs a Deepgram key', tone: 'ok' };
  return { text: 'Ready', tone: 'ok' };
}

export function MediaPanel({ media, uploads, onUpload }: { media: MediaAsset[]; uploads: Upload[]; onUpload: (files: File[]) => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [removing, setRemoving] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const remove = async (id: string) => {
    setError(null);
    try {
      await api.removeMedia(id);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setRemoving(null);
    }
  };

  const copy = (id: string) => {
    void navigator.clipboard?.writeText(id);
    setCopied(id);
    setTimeout(() => setCopied((c) => (c === id ? null : c)), 1200);
  };

  return (
    <div className="media-panel">
      <button className="dropzone" onClick={() => inputRef.current?.click()}>
        <strong>Add media</strong>
        <span className="muted small">Drop video, images or music anywhere, or click to browse</span>
      </button>
      <input
        ref={inputRef}
        type="file"
        multiple
        hidden
        accept="video/*,image/*,audio/*"
        onChange={(e) => {
          onUpload(Array.from(e.target.files ?? []));
          e.target.value = '';
        }}
      />

      {uploads.map((u) => (
        <div key={u.key} className={`upload${u.error ? ' failed' : ''}`}>
          <div className="upload-name">{u.name}</div>
          {u.error ? <div className="error small">{u.error}</div> : <div className="bar"><div style={{ width: `${Math.round(u.progress * 100)}%` }} /></div>}
        </div>
      ))}

      {media.length === 0 && uploads.length === 0 && <div className="empty">No media yet. Add footage, screenshots, logos or a music track; Claude can then use them in the video.</div>}

      <ol className="media-list">
        {[...media].reverse().map((a) => {
          const status = statusLine(a);
          const expanded = open === a.id;
          return (
            <li key={a.id} className="media-item">
              <button className="media-main" onClick={() => setOpen(expanded ? null : a.id)}>
                <div className="thumb">
                  {a.poster ? <img src={`/${a.poster}?v=${a.updatedAt}`} alt="" /> : <span>{KIND_ICON[a.kind]}</span>}
                </div>
                <div className="media-text">
                  <div className="media-name" title={a.name}>{a.name}</div>
                  <div className="muted small">{[a.kind, ...a.facts].join(' · ')}</div>
                  <div className={`media-status ${status.tone}`}>{status.text}</div>
                </div>
              </button>
              {expanded && (
                <div className="media-detail">
                  {a.sheet && <img className="sheet" src={`/${a.sheet}?v=${a.updatedAt}`} alt={`Contact sheet for ${a.name}`} />}
                  <div className="media-id">
                    <code>{a.id}</code>
                    <button className="small-btn" onClick={() => copy(a.id)}>{copied === a.id ? 'Copied' : 'Copy id'}</button>
                    {removing === a.id ? (
                      <button className="small-btn danger" onClick={() => void remove(a.id)}>Confirm remove</button>
                    ) : (
                      <button className="small-btn" onClick={() => setRemoving(a.id)} title="Delete this file and its analysis">Remove</button>
                    )}
                  </div>
                  {error && removing === null && <div className="error small">{error}</div>}
                  <div className="muted small">Tell Claude what to do with it, e.g. “use {a.kind === 'audio' ? 'this track as the music' : 'this clip in scene 2'}”.</div>
                </div>
              )}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
