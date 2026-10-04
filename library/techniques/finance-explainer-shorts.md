---
title: Finance explainer shorts (talking head + research cutaways)
summary: The Humphrey Yang / Johnny Harris / Ali Abdaal pattern for money and markets education. A visual change every 2-3 s, a hook resolved by 3 s, keyword pops 200-400 ms after the word, real resources (screenshots, charts) with a drawn highlighter while the voice keeps going, bull-green/bear-red as the only loud colours.
components: Captions, Badge, Callout, DeviceFrame, SplitScreen, ZoomPan, KineticTitle, Sfx, Counter
themes: market-desk, warm-editorial, midnight-gradient
---
# Finance explainer shorts

The dominant format for money and markets education on TikTok, Reels and Shorts is a talking head plus on-screen graphics. The speaker gives trust. The graphics carry the facts: lists, charts, real documents.

## Rules

### Retention
- **Hook by 3 s.** The scroll-or-stay decision happens at about 3.1 s. Put the promise ("there are 2 ways to…") on screen as a title *while* it's said, never after.
- **A meaningful visual change every 2-3 s:**
  - a punch-in,
  - a keyword pop,
  - a cutaway,
  - a layout change (full face → split → full content).
- Static face for more than about 10 s is where retention drops.
- **Abstract concepts get a picture.** Retention dips on abstract explanations: show the thing (a chart, a company page, a board-of-directors list) during them.

### Keyword pops
- Appear **200-400 ms after** the speaker starts the key phrase.
- At most 4-6 words.
- Hold 1.5-2.5 s.
- Minimum 48 px (aim for 70-110 px on 1080×1920).
- Place them in the upper third, so they never fight the captions in the lower third.

### Lists
- When the speaker enumerates (1, 2, 3…), build a **checklist that ticks on each word**. The list is the retention device: viewers stay to see it complete.
- Number the items.
- Leave earlier items visible but dimmed (about 45% opacity), so the structure reads at a glance.

### Resource cutaways (documentary style)
- Show the real source (website, article, chart) **while the voice continues** (a J/L-style overlay, not a cut).
- Frame it in a browser card with a soft shadow, tilted ±2-4°, floating.
- Then **draw a highlighter** stroke over the key line: 12-18 frames, ease-out, about 35% opacity, in a yellow or brand accent.
- Optionally push in 1.15-1.4× on it.
- After it, add a red-pen circle or underline (`Callout`) on the one number that matters.

### Progressive zoom
- On long talking-head stretches, creep from a medium shot to a close-up: about 1.5-2% per second, starting at about 100% and ending at about 112-118%.
- **Reset with a hard punch-in or out** on a new topic.

### Colour language
- Near-black navy or charcoal base.
- **Green = bullish/up, red = bearish/down.** Never use them decoratively for anything else.
- One highlight colour (amber or yellow) for emphasis and highlighter strokes.
- Numbers in tabular mono.

### Charts
- Candlesticks draw left to right, one candle every 1-2 frames.
- Support/resistance lines draw *after* the price touches them.
- Fibonacci levels (0.236, 0.382, 0.5, 0.618, 0.786) fade in top-down with labels at the right edge.

### Captions
- 2-4 words per chunk.
- Active-word highlight.
- Above the bottom 350 px UI band.
- Use the language as spoken: romanized Nepali or Hinglish in a Latin font reads faster on social than native script for many viewers.

### Sound
- **Whoosh** 2-4 frames before every cutaway.
- **Soft pop or click** on each list tick and keyword.
- **Riser** into the section change ("dosro number ma…").
- Music 12-15 dB under the voice, lifted on the end card.

### Ending
- End with a **series hook** ("Part 2 → Follow"), not a generic "like and subscribe".
- Hold the end card 2-3 s.

## Build it here
- Captions: pass corrected `words` to `<Captions>` when the auto transcript is wrong (non-English speech).
- Resources: a browser `DeviceFrame` with a `Picture` of a screenshot asset (ingest screenshots with `ev ingest`).
- Ticks: `Sfx` pop at each item's frame.
- Splits: `SplitScreen`, or a manual top/bottom layout with the face in the top 55%.

## Sources
- [Strategia-X: Vertical video retention editing playbook (2026)](https://www.strategia-x.com/blog/2026-07-01-vertical-video-retention-editing-playbook/)
- [Pixflow: YouTube retention editing](https://pixflow.net/blog/youtube-video-retention-editing/)
- [Subscribr: Editing talking-head videos](https://subscribr.ai/p/editing-talking-head-videos-engaging)
- [Edición Video Pro: Pattern interrupts on TikTok](https://edicionvideopro.com/en/editing-for-platforms-video-marketing/pattern-interrupts-tiktok-retention-guide/)
- [OutlierKit: Top finance YouTube creators 2026](https://outlierkit.com/resources/youtube-finance-niche-creators/)
- [Increditors: Ali Abdaal, Hormozi and MrBeast editing styles](https://increditors.com/an-ultimate-guide-to-alex-hormozi-ali-abdaal-and-mr-beast-video-editing-style-and-methods/)
- [Indian Fun Media: Johnny Harris newspaper and highlighter animation](https://indianfunmedia.com/master-the-johnny-harris-style-newspaper-animation-in-after-effects/)
- [Brainrot Shorts: Split-screen vertical layouts](https://www.brainrotshorts.com/blog/how-to-make-split-screen-videos)
