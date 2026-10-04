import { useEffect, useState, type KeyboardEvent } from 'react';
import type { EditRequest, ThreadMessage } from '../shared/types.ts';
import { api } from './api';

export const STATUS_LABEL: Record<EditRequest['status'], string> = {
  pending: 'Queued',
  working: 'Working',
  'needs-input': 'Needs you',
  done: 'Done',
  failed: 'Failed',
};

function relativeTime(iso: string): string {
  const s = Math.round((Date.now() - Date.parse(iso)) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return new Date(iso).toLocaleDateString();
}

/** `answer` is the user's reply that followed this question, used to mark the chosen option. */
function Message({ m, answerable, answer, onAnswer }: { m: ThreadMessage; answerable: boolean; answer?: string; onAnswer: (text: string) => void }) {
  return (
    <div className={`msg ${m.from} ${m.kind}`}>
      <div className="msg-text">{m.text}</div>
      {m.assumed && <div className={`assumed${m.undone ? ' undone' : ''}`}>I assumed: {m.assumed}</div>}
      {m.kind === 'done' && m.commit && (
        <div className="muted small">
          Version {m.commit}
          {m.undone && ' · undone'}
        </div>
      )}
      {m.images && (
        <div className="choice-images">
          {m.images.map((img) => (
            <button key={img.file} className={`choice-image${answer === img.label ? ' chosen' : ''}`} disabled={!answerable} onClick={() => onAnswer(img.label)} title={answerable ? `Choose “${img.label}”` : img.label}>
              <img src={`/api/snapshots/${img.file}`} alt={img.label} />
              <span>{img.label}</span>
            </button>
          ))}
        </div>
      )}
      {m.choices && (answerable || answer) && (
        <div className="choices">
          {m.choices.map((c) => (
            <button key={c} className={`chip${answer === c ? ' on' : ''}`} disabled={!answerable} onClick={() => onAnswer(c)}>
              {c}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * One request and its conversation: Claude's questions (with quick picks or alternative
 * stills), the user's answers and follow-ups, what was assumed, and a one-click undo.
 */
export function RequestItem({ r, onOpen }: { r: EditRequest; onOpen: (r: EditRequest) => void }) {
  const thread = r.thread ?? [];
  const needsInput = r.status === 'needs-input';
  const busyHere = r.status === 'pending' || r.status === 'working';
  const [open, setOpen] = useState(needsInput);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (needsInput) setOpen(true); // a question should never be hidden
  }, [needsInput]);

  const lastEdit = [...thread].reverse().find((m) => m.kind === 'done' && m.commit);
  const canUndo = !!lastEdit && !lastEdit.undone && !busyHere;
  const latestClaude = [...thread].reverse().find((m) => m.from !== 'user');
  const lastIndex = thread.length - 1;

  const send = async (message: string) => {
    if (!message.trim() || sending) return;
    setSending(true);
    setError(null);
    try {
      await api.reply(r.id, message);
      setText('');
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSending(false);
    }
  };
  const undo = async () => {
    setError(null);
    try {
      await api.undo(r.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };
  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      void send(text);
    }
  };

  return (
    <li className={`request ${r.status}`} data-request={r.id}>
      <button className="request-main" onClick={() => onOpen(r)} title="Jump to this moment">
        <div className="request-head">
          <span className="request-id">#{r.id}</span>
          <span className={`badge ${r.status}`}>{STATUS_LABEL[r.status]}</span>
          <span className="muted small">{relativeTime(r.createdAt)}</span>
        </div>
        <div className="request-prompt">{r.prompt}</div>
        {!open && latestClaude && <div className="request-result">{latestClaude.text}</div>}
        {!open && !latestClaude && r.result && <div className="request-result">{r.result}</div>}
        {!open && lastEdit?.assumed && !lastEdit.undone && <div className="assumed">I assumed: {lastEdit.assumed}</div>}
      </button>

      <div className="request-actions">
        <button className="link" onClick={() => setOpen((o) => !o)}>
          {open ? 'Hide thread' : thread.length ? `Thread (${thread.length})` : 'Reply'}
        </button>
        {canUndo && (
          <button className={`link${lastEdit!.assumed ? ' undo-warn' : ''}`} onClick={() => void undo()} title="Revert just this edit (later edits stay)">
            {lastEdit!.assumed ? 'Wrong guess? Undo' : 'Undo'}
          </button>
        )}
        {(r.status === 'pending' || needsInput) && (
          <button className="link" onClick={() => void api.cancel(r.id)}>
            Cancel
          </button>
        )}
      </div>

      {open && (
        <div className="thread">
          {thread.map((m, i) => (
            <Message
              key={i}
              m={m}
              answerable={needsInput && i === lastIndex && m.kind === 'question'}
              answer={m.kind === 'question' && thread[i + 1]?.from === 'user' ? thread[i + 1]!.text : undefined}
              onAnswer={(a) => void send(a)}
            />
          ))}
          {busyHere ? (
            <div className="muted small">{r.status === 'working' ? 'Claude is on it…' : 'Queued for Claude…'}</div>
          ) : (
            <div className="reply">
              <textarea
                rows={2}
                value={text}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={onKeyDown}
                placeholder={needsInput ? 'Answer Claude…' : 'Follow up: tweak it (“good, but slower”) or ask why…'}
              />
              <button className="small-btn" disabled={!text.trim() || sending} onClick={() => void send(text)}>
                {sending ? 'Sending…' : 'Send'}
              </button>
            </div>
          )}
          {error && <div className="error small">{error}</div>}
        </div>
      )}
      {!open && error && <div className="error small request-error">{error}</div>}
    </li>
  );
}
