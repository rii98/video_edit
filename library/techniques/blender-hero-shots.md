---
title: Blender hero shots (path-traced 3D inside an Easy Video edit)
summary: When realism is the point of a shot (a product, glass, food, liquid, a 3D object placed into real footage), path-trace it in Blender Cycles and play the PNG sequence in Remotion. Same object data, camera and light rig as the <Studio3D> version, so you can swap renderers per shot. Everything else (type, timing, captions, sound) stays in Remotion.
components: none (src/video/blender BlenderShot; scripts/blender/ev3d.py helpers; project/blender/*.py scene scripts)
themes: any
---
# Blender hero shots

Built 2026-10-07 on the `upgrade-showcase` rice bowl (S03, S04). Machine: Apple M1, 7-core GPU, 8 GB.

## When to use
- Use it when a viewer would notice the shot isn't real, and that would hurt: products, food, glass and liquid close-ups, metal, wax and skin (subsurface), haze and light beams, or a 3D object sitting in real footage (shadow catcher).
- Keep it to short, important moments (2–5 s), or a frozen hero frame. Renders take seconds to minutes per frame.
- Don't use it for type, UI, charts or anything tweaked often. That's `<Studio3D>`, with instant preview.

## Rules

**Pipeline**
- `ev blender install` (once): Blender 5.2 LTS goes portable into `.cache/blender`, checksum-verified.
- Scene scripts live in `project/blender/<shot>.py` and use `scripts/blender/ev3d.py`:
  - `v(x,y,z)` converts Three.js Y-up coordinates to Blender Z-up.
  - `camera_three(pos, lookAt, fov)` matches a `<Studio3D>` camera exactly (vertical fov).
  - Also available: `lathe`, `cyclorama`, `shadow_catcher`, `studio_lights`, `world(hdri=…)`, `material(...)`, `keyframe_linear`.
- Share geometry and animation data with the Three.js version through a JSON file (e.g. `scenes/bowl.json`), never by hand-copying numbers. Animation is a function of the scene frame on both sides.
- `ev blender <shot> --name=x --frames=a-b|--still=N [--scale] [--samples] [--transparent] [--opt.k=v]` writes `media/renders/x/NNNNN.png` (scene frame numbers) plus `render.json` with timings.
- In scenes, `<BlenderShot name="x" offset? hold? />` is frame-exact; Remotion waits for every image.

**Cost control (measured on M1)**
- The first render compiles Cycles' Metal kernels: about 10–15 min, one time, cached afterwards.
- Render only the pixels you show: a 460 px graphic doesn't need a 1080×1920 frame.
- Freeze-frame comparisons and hero holds need one frame at full quality (256 spp).
- Adaptive sampling (threshold 0.02) plus OpenImageDenoise: 64–128 spp is clean for diffuse and glossy work. Glass and caustics need more.
- Very long sequences: render at `--scale=0.5` first to check motion, then the final pass overnight.

**Look parity with Studio3D**
- View transform `Khronos PBR Neutral` on both sides, so colours match and only the light transport differs.
- The same light rig as Studio3D's "studio" cards, as real area lights (`studio_lights(accent)`).
- Materials: Principled BSDF with the same base colour, roughness and coat values as `MATERIALS.*`. Add what real time can't do: subsurface on rice, ceramic and skin; real refraction on glass.

**Compositing into footage**
- `--transparent` with `shadow_catcher()`: the object casts real shadows onto an invisible floor, and the alpha keeps only object plus shadow.
- Match the footage's light direction and colour temperature, or the object looks pasted on. Grade it with the same `<Look>` as the footage, or grade both after compositing.

## Sources
- Blender Cycles manual (sampling, denoising, shadow catcher, Metal): https://docs.blender.org/manual/en/latest/render/cycles/
- Blender downloads and checksums: https://download.blender.org/release/
- Poly Haven HDRIs (CC0): https://polyhaven.com/hdris
