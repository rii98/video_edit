import { useRef, useState } from 'react';
import { Player, type PlayerRef } from '@remotion/player';
import { catalog } from '../../library/catalog';
import { demoComponents, type DemoProps } from '../../library/demo-compositions';
import { DEMO_FRAMES } from '../../library/demo-frames';
import { demos, DEMO_SIZE } from '../../library/demos';
import { themes } from '../../library/themes';
import { theme as projectTheme } from '../video/kit';
import type { MediaAsset } from '../shared/types.ts';
import { api } from './api';

const techniqueFiles = import.meta.glob('/library/techniques/*.md', { query: '?raw', import: 'default', eager: true }) as Record<string, string>;

interface Technique {
  slug: string;
  title: string;
  summary: string;
  body: string;
}

const techniques: Technique[] = Object.entries(techniqueFiles)
  .filter(([path]) => !path.endsWith('README.md'))
  .map(([path, md]) => {
    const fm = Object.fromEntries((md.match(/^---\n([\s\S]*?)\n---/)?.[1] ?? '').split('\n').map((l) => l.split(/:\s*/, 2)));
    return { slug: path.split('/').pop()!.replace(/\.md$/, ''), title: fm.title ?? '', summary: fm.summary ?? '', body: md.replace(/^---[\s\S]*?---\n/, '').trim() };
  })
  .sort((a, b) => a.title.localeCompare(b.title));

const projectSlug = () => Object.entries(themes).find(([, t]) => t.name === projectTheme.name)?.[0] ?? null;

/** Plays on hover, rests on the demo's "settled" frame so the grid is readable at a glance. */
function DemoCard({ name, theme }: { name: string; theme: string | null }) {
  const ref = useRef<PlayerRef>(null);
  const entry = catalog.find((c) => c.name === name)!;
  const settled = DEMO_FRAMES[name] ?? 60;
  const [copied, setCopied] = useState(false);
  const props: DemoProps = { theme };
  return (
    <article className="demo-card">
      <div
        className="demo-player"
        onMouseEnter={() => {
          ref.current?.seekTo(0);
          ref.current?.play();
        }}
        onMouseLeave={() => {
          ref.current?.pause();
          ref.current?.seekTo(settled);
        }}
      >
        <Player
          ref={ref}
          component={demoComponents[name]!}
          inputProps={props}
          durationInFrames={demos[name]!.durationInFrames}
          fps={DEMO_SIZE.fps}
          compositionWidth={DEMO_SIZE.width}
          compositionHeight={DEMO_SIZE.height}
          initialFrame={settled}
          loop
          style={{ width: '100%', aspectRatio: '16 / 9' }}
          controls={false}
          clickToPlay={false}
          // Scenes stack many short sounds (sfx, voice, music) and premount the next scene; the
          // default of 5 shared audio tags crashes the player into a black frame.
          numberOfSharedAudioTags={32}
          acknowledgeRemotionLicense
        />
      </div>
      <div className="demo-text">
        <h4>{name}</h4>
        <p className="muted small">{entry.summary}</p>
        <div className="usage">
          <code>{entry.usage}</code>
          <button
            className="small-btn"
            onClick={() => {
              void navigator.clipboard?.writeText(entry.usage);
              setCopied(true);
              setTimeout(() => setCopied(false), 1200);
            }}
          >
            {copied ? 'Copied' : 'Copy'}
          </button>
        </div>
        <div className="chips">
          {entry.techniques.map((t) => (
            <a key={t} className="chip" href={`#technique-${t}`}>
              {t}
            </a>
          ))}
        </div>
      </div>
    </article>
  );
}

export function LibraryView({ media }: { media: MediaAsset[] }) {
  const sfx = media.filter((a) => a.origin === 'sfx');
  const current = projectSlug();
  const [preview, setPreview] = useState<string | null>(current);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [open, setOpen] = useState<string | null>(null);

  const apply = async (slug: string) => {
    setBusy(true);
    setMessage(null);
    try {
      const { commit } = await api.applyTheme(slug);
      setMessage(commit ? `Applied ${themes[slug]!.name}: saved as version ${commit}. Restore from Versions to undo.` : 'Already the project theme.');
    } catch (err) {
      setMessage(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="library">
      <section>
        <div className="section-head">
          <h2>Themes</h2>
          <span className="muted small">Click a theme to preview it on every component below. Apply it to restyle your whole video.</span>
        </div>
        <div className="themes">
          {Object.entries(themes).map(([slug, t]) => (
            <button key={slug} className={`theme-card${preview === slug ? ' on' : ''}`} onClick={() => setPreview(slug)} style={{ background: t.colors.bg, color: t.colors.text }}>
              <div className="swatches">
                {[t.colors.accent, t.colors.accent2, t.colors.surface, t.colors.muted].map((c, i) => (
                  <span key={i} style={{ background: c }} />
                ))}
              </div>
              <div className="theme-name" style={{ fontWeight: 700 }}>
                {t.name}
                {slug === current && <span className="theme-current">current</span>}
              </div>
              <div className="theme-fonts" style={{ color: t.colors.muted }}>
                {t.fonts.display} · {t.fonts.body} · tempo {t.tempo}
              </div>
              <div className="theme-desc" style={{ color: t.colors.muted }}>{t.description}</div>
            </button>
          ))}
        </div>
        {preview && preview !== current && (
          <div className="apply-row">
            <span>
              Previewing <strong>{themes[preview]!.name}</strong>
            </span>
            <button className="primary" disabled={busy} onClick={() => void apply(preview)}>
              {busy ? 'Applying…' : 'Apply to project'}
            </button>
          </div>
        )}
        {message && <div className="muted small apply-msg">{message}</div>}
      </section>

      <section>
        <div className="section-head">
          <h2>Components</h2>
          <span className="muted small">Hover to play. Ask Claude for any of these by name, e.g. “add a lower third for the speaker”.</span>
        </div>
        <div className="demo-grid">
          {catalog
            .filter((c) => !c.audio)
            .map((c) => (
              <DemoCard key={c.name} name={c.name} theme={preview} />
            ))}
        </div>
      </section>

      <section>
        <div className="section-head">
          <h2>Audio</h2>
          <span className="muted small">Sound effects are synthesized (no sample packs); voiceover uses your Deepgram key.</span>
        </div>
        <div className="audio-grid">
          {catalog
            .filter((c) => c.audio)
            .map((c) => (
              <article key={c.name} className="audio-card">
                <h4>{c.name}</h4>
                <p className="muted small">{c.summary}</p>
                <code className="usage-code">{c.usage}</code>
              </article>
            ))}
        </div>
        {sfx.length > 0 && (
          <div className="sfx-list">
            {sfx.map((a) => (
              <figure key={a.id} className="sfx">
                <figcaption>
                  {a.name.replace(/^sfx-|\.wav$/g, '')} <span className="muted small">{a.id}</span>
                </figcaption>
                <audio controls preload="none" src={`/${a.file}`} />
              </figure>
            ))}
          </div>
        )}
      </section>

      <section>
        <div className="section-head">
          <h2>Techniques</h2>
          <span className="muted small">Researched editing practice Claude follows. Saved here for every future project.</span>
        </div>
        <div className="techniques">
          {techniques.map((t) => (
            <article key={t.slug} id={`technique-${t.slug}`} className={`technique${open === t.slug ? ' open' : ''}`}>
              <button className="technique-head" onClick={() => setOpen(open === t.slug ? null : t.slug)}>
                <h4>{t.title}</h4>
                <p className="muted small">{t.summary}</p>
              </button>
              {open === t.slug && <pre className="technique-body">{t.body}</pre>}
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
