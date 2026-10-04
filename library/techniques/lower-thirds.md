---
title: Lower thirds
summary: Name/role graphics in the title-safe area (about 10% in from the edges). Animate in over 0.3-0.7 s, hold 4-7 s (long enough to read twice), out over 0.3-0.5 s. Appear about 0.5 s after the speaker starts.
components: LowerThird
themes: any
---
# Lower thirds

## Rules
- **Placement:** the lower third of the frame, inside **title-safe (≈10% from every edge)**, so it isn't cropped on any platform.
- **Timing:**
  - In: 0.3–0.7 s (9–20 frames).
  - Hold: **4–7 s** (120–210 frames). Readers should get both lines twice.
  - Out: 0.3–0.5 s (9–15 frames).
  - Short name tags can hold less.
- **Enter about 0.5 s after the person starts speaking**, not before. Viewers look at the face first.
- **Hierarchy:** the name is large; the role/company is smaller and muted. Two lines at most.
- **Always eased.** Linear slides look mechanical.
- **Consistency:** the same position, style and timing for every speaker in a video.
- **Vertical video:** keep it above the platform UI band (see `social-vertical-captions`). Consider placing it top-left instead.

## Build it here
```tsx
<LowerThird id="speaker" title="Alex Rivera" subtitle="Head of Design" start={15} hold={150} />
```

## Sources
- [anfx: Lower thirds, 4 design rules](https://anfx.co/blog/lower-thirds-design-rules-free-templates/)
- [Riverside: Lower thirds full guide](https://riverside.com/blog/lower-thirds)
- [School of Motion: Sports lower thirds](https://schoolofmotion.com/blog/sports-lower-thirds)
- [Wikipedia: Lower third](https://en.wikipedia.org/wiki/Lower_third)
