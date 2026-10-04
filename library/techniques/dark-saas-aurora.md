---
title: Dark SaaS aurora
summary: The modern developer-tool and B2B launch look. Near-black surfaces, fine 1px borders, crisp sans, slow drifting colour "aurora" behind the hero, UI in browser frames. Tightly controlled, minimal motion.
components: AuroraBackground, DeviceFrame, KineticTitle, ZoomPan
themes: midnight-gradient
---
# Dark SaaS aurora

## When to use
Developer tools, AI products, B2B launches, changelog and feature videos.

## Rules
- **Quiet dark surfaces** (#08–#14 greys), **fine 1px borders** at low opacity, and generous spacing.
- **An aurora / mesh gradient** drifts slowly behind the hero (a 20–40 s cycle). Two related accents (indigo + cyan). Blur heavily, and add a vignette so text stays readable.
- **Crisp sans display type**, slightly tight tracking, medium-semibold weight. Short declarative lines.
- **The UI is the hero:** show the real product in a browser frame, zooming into features (see `screen-demo-zoom`).
- **Motion is restrained:** fades, small rises and smooth camera. No bounces. Let the background provide the life.
- **Light accents on interaction:** glows, cursor-tracked highlights and subtle borders that brighten.

## Build it here
```tsx
<AuroraBackground />
<KineticTitle id="headline" text="Ship faster with Nova" mode="blur" size={120} />
<DeviceFrame id="app" device="browser"><Footage id="ui-…" /></DeviceFrame>
```
Theme: `midnight-gradient`.

## Sources
- [Codefronts: CSS gradient UI designs](https://codefronts.com/design-styles/css-gradient-ui/)
- [Medium / Bootcamp: Moving mesh gradient backgrounds (Stripe's technique)](https://medium.com/design-bootcamp/moving-mesh-gradient-background-with-stripe-mesh-gradient-webgl-package-6dc1c69c4fa2)
- [Setproduct: The Vercel aesthetic](https://www.setproduct.com/blog/complete-guide-to-blueprint-grid-design)
