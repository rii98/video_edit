---
title: Screen and product demo zooms
summary: Make UI readable. Zoom 1.25-3x onto the element being used, glide the camera (no darting), annotate the one thing that matters, frame screens in a device or browser.
components: ZoomPan, DeviceFrame, Callout, Captions
themes: midnight-gradient, playful-pop, warm-editorial
---
# Screen and product demo zooms

## When to use
App walkthroughs, SaaS launches, tutorials. Any time the footage is a screen recording.

## Rules
- **Zoom to the action.** Buttons and numbers are unreadable at full-screen scale, especially on phones.
  - Push in **1.25–3x** onto the element being clicked or typed into.
  - Hold while it happens, then pull back out to re-orient.
- **The camera glides, never darts.** Moves of 20–35 frames with `ease.emphasized`. Don't follow every cursor jitter.
- **Explain intent, not every movement.** Zoom only on the 3–6 moments that carry the story. Cut the dead time between them.
- **Point at the one thing.** Use a `Callout` (circle/arrow) or a highlight on the key element, drawn as it becomes relevant (about 0.5 s before the click).
- **Frame it.** A `DeviceFrame` (browser or phone) on a calm background (`AuroraBackground`) makes a raw recording look like a product shot.
- **Source quality.** Record at 60 fps and at least 1440p if possible. Zooms magnify compression artifacts.
- **Pacing.** About 3–5 s per step. Captions or a short on-screen label for each step.

## Build it here
```tsx
<AuroraBackground />
<DeviceFrame id="app" device="browser" width={1500}>
  <ZoomPan keys={[{ at: 0, x: 0.5, y: 0.5, scale: 1 }, { at: 30, x: 0.82, y: 0.12, scale: 2.4 }, { at: 100, x: 0.82, y: 0.12, scale: 2.4 }, { at: 130, x: 0.5, y: 0.5, scale: 1 }]}>
    <Footage id="recording-…" from={12.5} />
  </ZoomPan>
</DeviceFrame>
```
Find the click moments from the contact sheet (`ev media <id>`) and the pin the user drops.

## Avoid
- Constant zooming (it's nauseating).
- Zooming past ~3x on low-res sources.
- Tiny cursors.
- Leaving long loading spinners in.

## Sources
- [CursorClip: How to make a SaaS demo video that converts](https://cursorclip.com/blog/how-to-make-a-saas-demo-video/)
- [Moonb: SaaS product demo videos, examples](https://www.moonb.io/blog/saas-product-demo-video)
- [Medium: Best screen recorders for SaaS founders (2026)](https://medium.com/@cubixeditor/the-best-screen-recorders-for-saas-founders-in-2026-a-practical-comparison-9879eb18c092)
