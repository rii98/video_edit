---
title: Glass logo ident (Apple-TV-style brand film from a flat logo)
summary: Turn a flat logo PNG into a path-traced glass sculpture on a black stage, lit from behind by brand-coloured light the camera never sees, in one continuous camera move ending on a lockup. Blender renders one square plate that serves both 16:9 and 9:16; Remotion adds type, halation, grain and the score. Includes the tracing, lighting, choreography, render-budget and sonic-logo numbers from the ileyy film.
components: none (project/blender/mark.py pattern, parts.tsx Stage/Wordmark)
themes: any (black stage)
---
# Glass logo ident

Built 2026-10-08 for the ileyy brand film (project `ileyy-brand-film`).

## Rules

**From PNG to geometry**
- Trace the logo's alpha: upscale 4×, light blur (1.2 px), threshold 170, connected components (each one is a piece), Moore boundary trace, a moving-average smooth (r = 6), and Douglas–Peucker at 0.6 px. Split a closed ring into two halves before DP: when the first and last points match, DP collapses it to one point.
- Pieces that the trace joins along a hairline must be cut by hand at the notch. A sliver thinner than the bevel makes spike artefacts.
- Build each piece as a 2D curve object (`fill_mode BOTH`, round bevel). Curves fill concave outlines robustly. Use half-thickness 0.16 and bevel 0.07 for a logo about 4 units wide.

**Light (the Apple TV glass shoot, in Cycles)**
- The stage is pure black (world strength 0). All colour comes through the glass from a large emissive card behind it, with `visible_camera = False`.
- Give that card the brand gradient under a radial falloff. Two separate coloured cards refract as a hard band across the glass.
- Thin white side strips and a top strip give the bevels their hairline highlights. One moving "blade" strip sweeps across for the reveal beats.
- A light inside a glass piece (the dot): Blender 4+ point lights render as visible spheres. Set `visible_camera = False` and drive an emissive bead instead. The glass magnifies it, so keep the bead small (about 7% of the dot radius).
- For a lens-shaped glass piece to read as a brand colour after landing, give its Principled BSDF a little emission (about 1.4), or it stays navy.

**Choreography (14 s at 30 fps)**
- Ignite (0.2 s), shards with four light-blade beats 24 frames apart, assembly (wings flip half a turn like pages), dot landing at 8.0 s, wordmark at 8.7 s, tagline at 10 s, glint, hold.
- The dot falls on an ease-in cubic, then settles in the last 18%. No bounce: bounce reads as cartoon.
- One continuous camera with no cuts. Macro at 85 mm and f/1.4, opening out to 50 mm and f/11 for a sharp lockup.
- Share every beat frame through one JSON file (`scenes/data/motion.json`) that the Blender script, the Remotion scenes and the score all read.

**Render budget (M1, 7-core GPU)**
- The per-frame cost has a big fixed part because moving objects rebuild the BVH: 480² at 24 spp takes about 8 s, and 1440² at 56 spp takes about 25–30 s.
- Render one square plate. Show it at the long side of the frame (16:9: 1440 → 1920 wide; 9:16: 1920 tall). The black stage hides the crop.
- Render a full proxy at 480 px first and cut the whole film against it. Then render the final overnight or in the background.
- Hold the last rendered frame for the end of the lockup and continue the drift with a small Remotion scale (about 0.022% per frame).

**Finish in Remotion**
- Halation: two blurred copies of the plate (1.8% and 6% of the side) in screen blend at 0.38 and 0.22. Both swell on the landing flash.
- Grain at 7% screen, plus a soft vignette. Pure digital black looks cheap.

**Sound**
- Synth for the music: pad, in-key glass bells (FM, ratio 3.5) and the mnemonic. Use CC0 recordings for the organic glass and air.
- Give the mnemonic three notes, rising: A5–D6–F♯6, 0.16 s apart, so it is hummable after one listen.
- Leave 3 frames of silence before the signature hit (boom + sub drop + glass tink + bell chord).
- Shape the momentary loudness as a story: about −25 LUFS before the words, −13 on the words, a dip, the build, a −8 peak on the landing, then decay.

## Sources
- Apple TV glass ident: https://www.newscaststudio.com/2025/11/04/apple-tv-debuts-vibrant-rainbow-logo-animation-with-finneas-composed-mnemonic-following-rebrand · https://fastcompany.co.za/co-design/2025-11-10-revamping-apple-tv-the-creative-process-behind-the-new-logo/
- Sonic logo length and simplicity: https://www.heardis.com/services/sound-logo/ · https://brand.resmed.com/brand-sting
- Cycles glass: https://www.blendernation.com/2018/11/16/advanced-glass-shader-in-cycles/
