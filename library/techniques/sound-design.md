---
title: Sound design and mix
summary: Sound sells motion. Whooshes match each move's length and start slightly before it, hits land on the frame of impact, risers end on the reveal. Duck music 6-12 dB under voice, and deliver at -14 LUFS.
components: Sfx, Voiceover, DuckedMusic, BeatPulse
themes: any
---
# Sound design and mix

## When to use
Every video with motion graphics. Sound is half of what makes motion feel expensive. Even 4–6 well-placed effects transform an edit.

## Rules
- **Match the move.**
  - The whoosh's length ≈ the move's length. A 15-frame slide gets a ~0.4–0.5 s whoosh.
  - Light moves get soft textures; big transitions get deeper, heavier sounds.
  - Don't paste one generic sweep over every cut.
- **Lead the picture slightly.** Start a whoosh 0–1 frame *before* the move begins. Nudge it frame by frame until it locks.
- **Hits land on the impact frame:** a logo or title settling, or a cut on a downbeat. Pair a **riser** that *ends* exactly on the hit. The riser's length is the anticipation (1–2 s).
- **UI demos:** a soft click on every on-screen click or tap, quieter than you think (volume 0.3–0.5).
- **Pops for small elements** (badges, icons, list items). Vary the volume or seed when several fire in a row, so it doesn't sound like a machine gun.
- **Restraint:** the theme sets the density.
  - premium (keynote-mono): sparse, soft, mostly hits and shimmers;
  - sport (neon-sport): punchy hits and whooshes;
  - playful-pop: pops and clicks.
- **Music under voice:**
  - Duck 6–12 dB, ~-8 dB by default (`duckTo` 0.4).
  - Fast attack (dip just before speech), slow release (~0.5 s) so it doesn't pump between phrases.
- **Delivery loudness:** -14 LUFS integrated, true peak ≤ -1 dBTP (the Final export does this).
- **Voiceover:** use the user's recording, or Deepgram TTS with their key (`ev tts`). Never the macOS `say` voice.

## Build it here
```tsx
// npm run ev -- sfx whoosh    → asset id sfx-whoosh-…
<Sfx id="sfx-whoosh-…" at={transitionStart - 1} volume={0.6} />
<Sfx id="sfx-riser-…" at={revealFrame - 48} />   // 1.6 s riser ends on the reveal
<Sfx id="sfx-hit-…" at={revealFrame} />
<Voiceover id="voice-…" at={15} />
<DuckedMusic id="track-…" voiceId="voice-…" voiceAt={15} />
```

## Sources
- [Pitchdrift: 20 sound design tips for motion graphics](https://pitchdrift-productions.com/sound-design-tips-for-motion-graphics/)
- [Sonilo: Whoosh sound effect, motion, timing and mix](https://sonilo.com/ai-music/whoosh-sound-effect-guide)
- [Pixflow: Cinematic transition sounds for motion graphics](https://pixflow.net/blog/enhancing-motion-graphics-with-cinematic-transition-sounds/)
- [OpenClip: Audio ducking](https://openclip.app/learn/audio-ducking)
- [DaVinci Resolve Club: Audio ducking](https://davinciresolveclub.com/davinci-resolve-audio-ducking/)
- [Larry Jordan: Automatic music ducking in Audition](https://larryjordan.com/articles/adobe-audition-automatic-music-ducking/)
