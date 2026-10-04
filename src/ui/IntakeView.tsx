import { useMemo, useState } from 'react';
import { Player } from '@remotion/player';
import { themes } from '../../library/themes';
import type { Treatment } from '../shared/types.ts';
import { intake, treatmentComponent } from '../video/treatments';
import { api } from './api';

const TEST_PROPS = { proxy: true };

function TreatmentCard({ t, chosen, onChoose, busy }: { t: Treatment; chosen: boolean; onChoose: () => void; busy: boolean }) {
  const component = useMemo(() => treatmentComponent(t.id), [t.id]);
  const { width, height, fps } = intake.format;
  const total = t.outline.reduce((s, o) => s + o.seconds, 0);
  const theme = themes[t.theme];
  return (
    <article className={`treatment${chosen ? ' chosen' : ''}`} data-treatment={t.id}>
      {/* Height-capped so vertical (9:16) tests read like a phone and the pitch stays in view. */}
      <div className="treatment-player" style={{ aspectRatio: `${width} / ${height}`, width: `min(100%, calc(52vh * ${width / height}))` }}>
        <Player
          component={component}
          inputProps={TEST_PROPS}
          durationInFrames={t.durationInFrames}
          fps={fps}
          compositionWidth={width}
          compositionHeight={height}
          style={{ width: '100%', height: '100%' }}
          autoPlay
          loop
          controls={false}
          clickToPlay={false}
          initiallyMuted
          // Scenes stack many short sounds (sfx, voice, music) and premount the next scene; the
          // default of 5 shared audio tags crashes the player into a black frame.
          numberOfSharedAudioTags={32}
          acknowledgeRemotionLicense
        />
      </div>
      <div className="treatment-text">
        <div className="treatment-head">
          <span className="treatment-id">{t.id}</span>
          <h3>{t.title}</h3>
          {chosen && <span className="badge done">Chosen</span>}
        </div>
        <p>{t.pitch}</p>
        <div className="treatment-meta muted small">
          Theme: {theme?.name ?? t.theme} · {total}s · Music: {t.music}
        </div>
        <ol className="outline">
          {t.outline.map((o, i) => (
            <li key={i}>
              <span className="outline-scene">{o.scene}</span>
              <span className="muted small"> {o.seconds}s</span>
              <div className="small">{o.beat}</div>
            </li>
          ))}
        </ol>
        <div className="chips">
          {t.techniques.map((tech) => (
            <a key={tech} className="chip" href={`#library`} title="Technique card in the Library">
              {tech}
            </a>
          ))}
        </div>
        <button className="primary" disabled={busy} onClick={onChoose}>
          Choose {t.id}
        </button>
      </div>
    </article>
  );
}

export function IntakeView({ onSent }: { onSent: () => void }) {
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  if (!intake.treatments.length) {
    return (
      <div className="intake empty-intake">
        <h2>Start a new video</h2>
        <ol>
          <li>Add your footage, images and music in the editor's <strong>Media</strong> tab.</li>
          <li>
            In the Claude Code terminal, say <em>“make a video from my media”</em> (or run <code>/new-video</code>).
          </li>
          <li>Claude studies the footage, asks you a few creative-director questions, and proposes three directions here, as real motion tests.</li>
        </ol>
      </div>
    );
  }

  const choose = async (id: string) => {
    setBusy(true);
    setMessage(null);
    try {
      const request = await api.chooseTreatment(id, notes);
      setMessage(`Sent to Claude as request #${request.id}. It's building version 1 from treatment ${id}.`);
      setNotes('');
      onSent();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  const brief = intake.brief;
  return (
    <div className="intake">
      {brief && (
        <section className="brief">
          <h2>Brief</h2>
          <dl>
            {(
              [
                ['Goal', brief.goal],
                ['Platform', brief.platform],
                ['Audience', brief.audience],
                ['Message', brief.message],
                ['Feel', brief.feel],
                ['Pacing', brief.pacing],
                ['Length', brief.length],
                ['Music', brief.music],
                ['Must-haves', brief.mustHaves.join(' · ')],
              ] as const
            ).map(([k, v]) => (
              <div key={k}>
                <dt>{k}</dt>
                <dd>{v || '-'}</dd>
              </div>
            ))}
          </dl>
        </section>
      )}

      <section>
        <div className="section-head">
          <h2>Three directions</h2>
          <span className="muted small">Each is a short motion test with your media. Pick one, or describe a mix below.</span>
        </div>
        <div className="treatments">
          {intake.treatments.map((t) => (
            <TreatmentCard key={t.id} t={t} chosen={intake.chosen === t.id} busy={busy} onChoose={() => void choose(t.id)} />
          ))}
        </div>
        <div className="mix">
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} placeholder="Optional notes or a mix, e.g. “A's typography with C's pacing, and keep the rep counter from B”. Then choose the base direction." />
          {message && <div className="small mix-msg">{message}</div>}
        </div>
      </section>
    </div>
  );
}
