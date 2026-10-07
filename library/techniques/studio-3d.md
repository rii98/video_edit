---
title: Studio-finish 3D in Remotion (light, shadow, lens)
summary: Why plain Three.js looks like a game and what fixes it. Light from big soft sources that show up in reflections (environment light cards or an HDRI), physical materials, soft contact shadows that ground objects, ambient occlusion, a filmic/neutral tone map, bloom only on true highlights, and depth of field on opaque product shots. Implemented by <Studio3D>; pitfalls (blank frames, black shadow rectangles, alpha) are solved inside it.
components: Studio3D
themes: any
---
# Studio-finish 3D

Built 2026-10-07. Before/after on the rice-bowl test (project `upgrade-showcase`, S02).

## Rules

**Light**
- Reflections sell realism more than any other cue. Shiny surfaces must reflect *something*: big soft light cards (drei `Lightformer`) baked into the environment, or a real HDRI (`ev hdri studio_small_09`, Poly Haven CC0).
- Each look has one clear key direction, plus a dim floor bounce so chrome never reflects a black void.
- A rim light from behind in the theme accent separates the object from a dark backdrop. Keep it at most ~2.5× the fill.
- `look="basic"` (ambient + one directional) exists only as the honest "before".

**Materials** (`MATERIALS.*`, spread onto `meshPhysicalMaterial`)
- Ceramic and glaze: clearcoat 0.9, clearcoat roughness about 0.08. The clearcoat highlight is what reads as "glazed".
- Metal: metalness 1 and roughness 0.05–0.2; its colour comes from the environment.
- Glass: transmission 1, ior 1.5, thickness 0.3–1, a faint attenuation colour. It needs something behind it to bend.
- Small repeated details (rice, sprinkles): instanced meshes, randomised scale ±15% and rotation, packed in layers so nothing shows through.

**Grounding**
- Every object touching a surface needs a contact shadow: dark and tight at the contact point, soft further out.
- Contact shadows stack everything within `shadowReach`, occluded or not. Keep the reach below inner details (bowl: 0.6, under the rice at 0.65), or interior detail prints into the shadow.
- With a `backdrop` (cyclorama), the shadow area stays on the flat floor (scale 4.4). Otherwise the cove reads as a caster.

**Camera and finish**
- Product camera: fov 30–35°, about 25° down, object filling about 70% of the frame's short side. A portrait canvas needs a farther camera (bowl: distance 8.2 at fov 35).
- Tone mapping: `neutral` (Khronos PBR Neutral) keeps brand colours true; `agx` is filmic but desaturates saturated colours.
- Bloom threshold 0.85, intensity ≤ 0.4: only real highlights glow. A glowing everything is an AI tell.
- Depth of field only on opaque scenes (`backdrop`). The pass writes alpha 1 and blacks out a transparent canvas. Over footage, blur the layer with CSS instead.
- Ambient occlusion (N8AO, radius 0.6) gives creases and contact their weight. It is safe on transparent canvases.

**Remotion pitfalls (handled in Studio3D)**
- EffectComposer + Remotion: the composer builds over several React updates after mount, while Remotion renders each frame once, so frames come out blank. Hold the frame (`delayRender`) until the composer has its passes, then `advance()`.
- An opaque canvas makes ContactShadows clear its texture with alpha 1, which prints a black rectangle. Keep `gl.alpha` true always.
- Animate from `useCurrentFrame()` only. Accumulating effects (AccumulativeShadows, TAA) don't fit frame-by-frame rendering.

**When Studio3D isn't enough**
- True refraction caustics, real bounce light (colour bleeding), subsurface skin and wax, volumetrics: render the shot in Blender (Cycles). See the `blender-hero-shots` card.

## Sources
- drei Lightformer, Environment, ContactShadows: https://github.com/pmndrs/drei
- react-postprocessing (N8AO, Bloom, DepthOfField, ToneMapping): https://github.com/pmndrs/react-postprocessing
- Khronos PBR Neutral tone mapper: https://github.com/KhronosGroup/ToneMapping
- Poly Haven HDRIs (CC0): https://polyhaven.com/hdris
- Remotion + Three.js: https://www.remotion.dev/docs/three
