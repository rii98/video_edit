---
title: Real 3D objects and depth (Three.js in Remotion)
summary: When flat photos look pasted on, build a 3D world with @remotion/three and fly a perspective camera through it. Textured spheres lit by one sun, true axial tilts, visible spin, atmosphere rims, night sides that block the stars, and a twinkling 3D starfield for parallax. 1 unit = 1 px at z = 0 keeps the 2D type layout exact. Renders need the ANGLE GL backend.
components: none (project-side pattern: nine-planets scenes/planet3d.tsx + world.tsx)
themes: cinema-ink, keynote-mono, midnight-gradient
---
# Real 3D objects and depth

## When to use
- Planets, globes, coins, products: anything round or turnable whose flat photo would look pasted on.
- When the brief asks for "3D" or "more depth". Use it for the hero object only; type and UI stay 2D on top, which keeps them crisp and clickable.
- Skip it when a real photo carries the story (a person, an event): real beats rendered.

## Rules
- **Stack:** `npm i @remotion/three three @react-three/fiber @types/three`, with `@remotion/three` pinned to the exact `remotion` version. Render with `chromiumOptions: { gl: 'angle' }` everywhere (`openBrowser`, `selectComposition`, `renderStill`, `renderMedia`, plus `Config.setChromiumOpenGlRenderer('angle')`). This repo already does that.
- **Animate from `useCurrentFrame()`, never `useFrame()`.** Rotation = `frame × speed`, so every frame is deterministic.
- **Load textures outside `<ThreeCanvas>`.** Custom React contexts, such as the editor's media mode, don't cross into the R3F tree. Wrap each load in `delayRender`/`continueRender` so no frame renders a blank mesh. Set `colorSpace = SRGBColorSpace` on colour maps.
- **Orthographic camera, 1 unit = 1 px** (`orthographic camera={{ position: [0,0,2000], zoom: 1 }}`). The 3D object then drops into a 2D layout system at exact pixel sizes, and CSS transforms on the wrapping `Layer` (truck, blur, scale) still work.
- **One sun for the whole video.** A directional light from the same side in every shot (here upper-left-front), with ambient ≈ 0.01. The terminator, the line between day and night, is what sells the volume. Flat ambient light kills it.
- **Night side darker than the background.** It blocks the starfield, which is physically right and gives instant depth.
- **True physical detail is free storytelling:** axial tilt (Uranus 97.8°: "spins on its side"), ring tilt (~0.3 rad from edge-on reads well), spin 0.003–0.014 rad/frame (enough to see within a 2 s hold; much faster looks like a toy). Venus spins backwards.
- **Atmosphere:** a 1.03–1.04× back sphere with an additive fresnel shader, masked by the sun direction (`smoothstep(0, 0.65, dot(n, sun))`). Otherwise it draws a glowing outline on the night side, which is an AI tell.
- **Rings:** `RingGeometry` with UVs remapped radially (`u = (r - inner) / (outer - inner)`), a transparent radial alpha texture, `DoubleSide`, `depthWrite: false`.
- **Many objects in one shot → one canvas** with several meshes, not one canvas per object (WebGL context limits, speed).
- **Texture quality:** ≥ 2× the on-screen diameter × π across the equirectangular width (a 900 px globe → ≥ 2048 px map; 4k is plenty). Proxies are fine for preview.
- **Missing map data** (e.g. Pluto's south, in darkness during the New Horizons flyby): orient the object so the gap faces away. If you colour a greyscale map, sample the colours from a real true-colour photo and say so in the credits.

- **Fly the camera, don't slide the objects.** Put every object in one world (spaced ~2000 units apart), and render each scene at its *global* frame so the flight continues across cuts. One perspective camera (fov 30°, distance `D0 = H / (2 tan(fov/2))` so 1 unit = 1 px at z = 0, which keeps the 2D type layout exact).
  - Each move: 20 frames, ease `bezier(0.87,0,0.13,1)`, the camera pulls back ~45% mid-flight (`sin(πp)`) and yaws ~0.09 rad toward where it's going. Hold = 3% push-in.
  - Motion blur = CSS blur on the canvas layer from the camera's speed (≤ 9 px).
  - Count spin from each object's arrival frame, not frame 0, or it arrives facing the wrong way.
- **Stars as 3D points** with a twinkle shader (about a third twinkle, 0.08–0.13 rad/frame, out of phase). Spread depth 6k–66k units and let the star group follow the camera at 90%. That gives subtle parallax, and a dolly never flies through them.
- **A reveal from far away:** put the final object deep in −z so it's a speck at the normal distance, then dolly the camera so its on-screen size eases from speck to hero (`z = objZ + R·D0/px`).
- **Featureless worlds (Uranus, Neptune, Venus) don't show rotation.** Boost local contrast on luminance only (keep hue). Only add features you can source as real (e.g. Uranus storm clouds seen by Keck), and say so in the credits.
- **Texture loads:** call `continueRender` in an effect after the texture is in state, not in the loader callback, or frames get captured before the mesh exists.

## Sources
- Remotion: @remotion/three: https://www.remotion.dev/docs/three
- Solar System Scope textures (CC BY 4.0, credit required): https://www.solarsystemscope.com/textures/ · on Commons: https://commons.wikimedia.org/wiki/Category:Solar_System_Scope
- NASA PIA19858, Global Map of Pluto (New Horizons): https://images.nasa.gov/details/PIA19858
- Axial tilts: NASA planet fact pages (e.g. https://science.nasa.gov/uranus/facts/)
