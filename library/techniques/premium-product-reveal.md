---
title: Premium product reveal
summary: Apple-style restraint. One idea per screen, slow push-ins, long eased moves, big tight type on a quiet background.
components: KineticTitle, ZoomPan, DeviceFrame, MaskReveal
themes: keynote-mono, midnight-gradient
---
# Premium product reveal

## When to use
Launches, hero moments, "introducing…" beats, anything that should feel expensive and confident.

## Rules
- **One idea per screen.** A word or a short phrase stands alone ("Introducing", the product name, one benefit). Never stack a headline, a subhead and a bullet list.
- **Slow, continuous camera.**
  - Push-ins of 3–8% scale over 2–4 s (60–120 frames).
  - Slow orbits or pans. Every move should *reveal* something.
- **Long, smooth easing.** Moves of 1.2–2 s use a strong ease-in-out (`ease.emphasized`). No bounce or overshoot: overshoot reads as playful, not premium.
- **Type is large, tightly tracked (-0.02 to -0.04em), and set on a near-empty background.** Use `keynote-mono`.
- **Pacing breathes.**
  - Hold each statement ~1.5–2.5 s after it lands.
  - Cut on musical phrases (every 2–4 bars), not on every beat.
- **Light and dark carry the drama:** black backgrounds, a single light source, subtle reflections. Use colour in one accent only.

## Build it here
```tsx
<ZoomPan keys={[{ at: 0, x: 0.5, y: 0.5, scale: 1 }, { at: 120, x: 0.5, y: 0.45, scale: 1.06 }]}>
  <Footage id="product-…" />
</ZoomPan>
<KineticTitle id="name" text="Introducing Nova" mode="mask" size={150} start={20} />
```
Use theme `keynote-mono`. Its tempo of 1.25 slows every animation automatically.

## Avoid
- Busy backgrounds.
- More than one moving element at a time.
- Fast whip transitions.
- Stock "glitch" effects.

## Sources
- [Designer Daily: Product launch video, creating hype through motion design](https://www.designer-daily.com/product-launch-video-creating-hype-through-motion-design-230773)
- [Motion.so: Apple-style product launch video](https://motion.so/learn/apple-style-product-launch-video)
- [Demotion: Apple style animation guide](https://trydemotion.com/blog/apple-style-animation-guide)
