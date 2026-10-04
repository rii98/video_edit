---
title: Kinetic typography
summary: Text animated as individual words or letters. Staggered ease-out reveals (20-100 ms apart), total under ~0.8 s, legible sans or display faces.
components: KineticTitle, Captions, Counter
themes: any
---
# Kinetic typography

## When to use
Titles, key messages, quotes, lyric- or VO-driven sequences, and any time words *are* the visual.

## Rules
- **Animate atoms, not paragraphs.** Split into words (default) or characters (for short, punchy words only).
- **Stagger 20–100 ms (1–3 frames) between atoms. Keep the whole reveal under ~800 ms (24 frames)** so reading isn't delayed. The theme's `stagger` sets this.
- **Ease-out entrances.** Content arrives fast and settles.
- **Pick one reveal style per video:**
  - `mask` (slides up from an invisible line): cleanest and most premium.
  - `rise` (fade + lift): friendly.
  - `blur`: dreamy, soft.
  - `scale`: punchy, social.
- **Emphasize by contrast, not motion overload.** A brief scale pulse or a colour change on 1 key word beats animating every word differently.
- **Sync with audio.** Land words on syllables or beats when there's VO or music (see `cutting-to-music`).
- **Legibility first.** Sans or display faces, generous size: at least 6% of frame height for titles.

## Build it here
```tsx
<KineticTitle id="headline" text="Built for speed" mode="mask" size={140} start={8} />
// emphasis on one word: render it separately with colour={theme.colors.accent}
```

## Avoid
- Per-letter animation on long sentences: it's slow to read.
- Mixing more than two reveal styles in one video.
- Linear easing.

## Sources
- [Rendercomp: Kinetic typography in Remotion, the complete guide](https://rendercomp.com/blog/kinetic-typography-remotion-guide/)
- [iArt: How to animate text, 6 techniques](https://www.iart.ai/blog/how-to-animate-text)
- [Linearity: Kinetic typography, the what, why and how](https://www.linearity.io/blog/kinetic-typography/)
- [SVGator: What is kinetic typography](https://www.svgator.com/blog/kinetic-typography-a-guide-to-text-in-motion/)
