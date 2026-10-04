---
title: Split screen and comparisons
summary: Show two things at once to compare, contrast or run in parallel. Keep the subjects at matching scale and alignment. Slide panes in from opposite edges; use a slider wipe for precise before/after.
components: SplitScreen, MaskReveal
themes: any
---
# Split screen and comparisons

## When to use
- Before/after (fitness progress, edits, redesigns).
- Product A vs B.
- Reaction + content.
- Parallel action.
- Compressing a sequence that would otherwise need several cuts.

## Rules
- **Match the scale and alignment** of the subjects in both panes, so viewers compare without mentally resizing. Crop or zoom each `Footage` to match.
- **Orientation follows the frame:**
  - Side by side (`horizontal`) for 16:9.
  - Stacked (`vertical`) for 9:16.
- **Label the panes** ("Before" / "After", "Week 1" / "Week 12") with Badges in a consistent position.
- **Animate in with purpose:** panes from opposite edges, then the divider draws. 20–30 frames.
- **Slider wipe for precision:** for subtle differences, a moving vertical wipe over aligned shots (`MaskReveal shape="wipe-right"`) beats a static split. It needs well-matched framing.
- **One focal point at a time:** if both panes move, the eye splits. Let one pane be static, or sync their motion.

## Build it here
```tsx
<SplitScreen id="compare" direction="vertical" a={<Footage id="week1-…" />} b={<Footage id="week12-…" />} />
<Badge id="before" text="Week 1" tone="dark" … />
```

## Sources
- [Wideframe: How to create before and after comparison videos](https://try.wideframe.com/blog/how-to-create-before-and-after-comparison-videos/)
- [ShortGenius: Split screen editing for short-form creators](https://shortgenius.com/blog/split-screen-video-editing)
- [Wikipedia: Split screen (film and video production)](https://en.wikipedia.org/wiki/Split_screen_(film_and_video_production))
