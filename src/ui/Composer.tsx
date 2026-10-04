import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { formatTime, sceneAt } from '../shared/timeline.ts';
import type { FrameRange, Scope } from '../shared/types.ts';
import { timeline } from '../video/Main';
import { api } from './api';
import type { Selection } from './Stage';

const SCOPES: { value: Scope; label: string; hint: string }[] = [
  { value: 'frame', label: 'This moment', hint: 'Change only around this frame' },
  { value: 'scene', label: 'This scene', hint: 'Apply across the whole scene' },
  { value: 'range', label: 'Range', hint: 'Apply to the range selected on the timeline (Shift+drag)' },
  { value: 'video', label: 'Whole video', hint: 'Apply everywhere' },
];

export function Composer({ frame, selection, range, onSent }: { frame: number; selection: Selection | null; range: FrameRange | null; onSent: () => void }) {
  const [prompt, setPrompt] = useState('');
  const [scope, setScope] = useState<Scope>('video');
  const [targets, setTargets] = useState<string[]>([]);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // A new pin targets the most specific layer and the scene by default, then focuses the input.
  useEffect(() => {
    setTargets(selection?.layers.slice(0, 1) ?? []);
    setScope(range ? 'range' : selection ? 'scene' : 'video');
    if (selection) inputRef.current?.focus();
  }, [selection, range]);

  // Context frame: where you pointed; else the start of a selected range (the playhead may
  // have moved elsewhere since); else the playhead.
  const atFrame = selection?.frame ?? (scope === 'range' && range ? range.start : frame);
  const scene = sceneAt(timeline, atFrame);

  const send = async () => {
    if (!prompt.trim() || sending) return;
    setSending(true);
    setError(null);
    try {
      await api.submit({
        prompt,
        scope,
        frame: atFrame,
        sceneId: scene?.id ?? null,
        pin: selection?.pin ?? null,
        region: selection?.region ?? null,
        layers: targets,
        range: scope === 'range' ? range : null,
      });
      setPrompt('');
      onSent();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSending(false);
    }
  };

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      void send();
    }
  };

  const toggle = (layer: string) => setTargets((t) => (t.includes(layer) ? t.filter((l) => l !== layer) : [...t, layer]));

  return (
    <section className="composer">
      <div className="composer-context">
        <div className="context-line">
          <span className="context-icon">{selection?.region ? '⬚' : selection ? '◎' : '▶'}</span>
          {selection ? (selection.region ? 'Region' : 'Pin') : 'No pin'} · frame {atFrame} · {formatTime(atFrame, timeline.fps)}
          {scene && <span className="muted"> · {scene.id} {scene.name}</span>}
        </div>
        {selection && selection.layers.length > 0 && (
          <div className="chips">
            {selection.layers.map((layer) => (
              <button key={layer} className={`chip${targets.includes(layer) ? ' on' : ''}`} onClick={() => toggle(layer)}>
                {layer}
              </button>
            ))}
          </div>
        )}
        {range && (
          <div className="context-line small">
            Range {formatTime(range.start, timeline.fps)}–{formatTime(range.end, timeline.fps)} <span className="muted">(frames {range.start}–{range.end})</span>
          </div>
        )}
        {!selection && !range && <div className="muted small">Click the preview to point at something, drag to mark an area, or Shift+drag the timeline to select a range.</div>}
        <div className="segmented" role="radiogroup" aria-label="Scope">
          {SCOPES.filter((s) => s.value !== 'range' || range).map((s) => (
            <button key={s.value} role="radio" aria-checked={scope === s.value} className={scope === s.value ? 'on' : ''} title={s.hint} onClick={() => setScope(s.value)}>
              {s.label}
            </button>
          ))}
        </div>
      </div>
      <div className="composer-input">
        <textarea
          ref={inputRef}
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder={selection ? 'Describe the change you want here…' : 'Describe a change to the video…'}
          rows={3}
        />
        <div className="composer-actions">
          {error && <span className="error">{error}</span>}
          <span className="muted small">Enter to send · Shift+Enter for a new line</span>
          <button className="primary" disabled={!prompt.trim() || sending} onClick={() => void send()}>
            {sending ? 'Sending…' : 'Send to Claude'}
          </button>
        </div>
      </div>
    </section>
  );
}
