---
title: Cutting to music
summary: Lock the music first. Cut on downbeats (every 1, 2 or 4 bars for calmer pacing), land reveals on section changes, use J/L cuts, and drop the music out before a big hit.
components: BeatPulse, useBeats, useBeatEnvelope, Music
themes: any
---
# Cutting to music

## When to use
Any video with a music bed. Highest impact on social, montage, launch and fitness edits.

## Rules
- **Music first.** Choose and trim the track, then cut the picture to it. `ev media <id>` gives the BPM, beats, downbeats and energy sections.
- **Cut on downbeats** (the "1" of the bar), not on every beat:
  - Every downbeat: rhythmic, energetic.
  - Every 2 bars: measured.
  - Every 4 bars: cinematic, calm. House/EDM phrases are usually 4 or 8 bars.
- **Big moments land on section changes.** A low→high energy jump (the "drop") is where the logo, headline or best shot goes.
- **Cut slightly early (0–2 frames before the beat).** The eye registers the cut a beat-fraction late, so a cut exactly on the beat can feel late.
- **Silence before the hit.** Duck or cut the music for 0.3–0.8 s right before a key reveal, then hit on the downbeat.
- **J and L cuts.** Let audio lead the picture (J) or trail it (L) by about 0.5–1 s across a cut. This makes VO and dialogue edits feel smooth.
- **Small motion on beats.** Pulse a logo or accent element on downbeats (`BeatPulse on="downbeats" amount={0.04}`). Subtle beats loud.
- **End on a real ending.** Cut the music on a bar boundary at the end of a phrase. Don't fade out mid-phrase.

## Build it here
```tsx
const beats = useBeats('track-…');            // { bpm, beats, downbeats, sections }
// scene durations in timeline.json = whole bars: 60 / bpm * 4 * fps frames per bar
<BeatPulse assetId="track-…" on="downbeats" amount={0.05}><Logo /></BeatPulse>
```

## Avoid
- Cutting on every single beat for a whole video (exhausting).
- Ignoring the energy sections.
- Fading out mid-phrase.

## Sources
- [Thematic: How to sync music to video cuts](https://hellothematic.com/how-to-sync-music-to-video/)
- [Kudoflix: Music sync video editing techniques](https://kudoflix.com/blog/2026/07/22/music-sync-video-editing-techniques/)
- [Wikipedia: J cut](https://en.wikipedia.org/wiki/J_cut) · [Split edit](https://en.wikipedia.org/wiki/Split_edit)
- [Apple: Edit to the beat in Final Cut Pro](https://support.apple.com/en-hk/guide/final-cut-pro/ver65b55a2b7/mac)
