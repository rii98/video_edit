---
title: Colour grading footage (measure → correct → separate → look)
summary: The colourist's order for making phone footage look shot on a good camera. Measure first (ev grade-check), correct exposure and white balance, separate the subject from the room with a tracked power window, then add a creative LUT look at partial strength. Optional portrait blur and denoise. All of it is GPU and frame-exact via <Look>, so preview equals render and text is never graded.
components: Look (plus SubjectWindow and PortraitBlur in src/video/track)
themes: any
---
# Colour grading footage

Built 2026-10-07 as the shared version of what vid-1 did by hand (see `subject-room-separation`).

## Rules

**Order matters (the same as DaVinci Resolve's node order)**
1. **Measure:** `ev grade-check <id>` prints scopes-style numbers and a starting grade. Read them, then look at the frame. Numbers find problems; eyes judge taste.
2. **Correct:** exposure, white balance and tint first, then contrast, shadows and highlights. A LUT on uncorrected footage exaggerates the error.
3. **Separate:** keep the subject about 1–1.5 stops over the room. On tracked footage, grade the room inside `<Look>` and put `<SubjectWindow>` right after `<CamFootage>`.
4. **Look:** a creative LUT (`look="film"`, etc.) at `amount` 0.5–0.8. A full-strength look is rarely right on real skin.
5. **Finish:** grain or vignette only if the scene calls for it. Check stills at several moments, not one.

**Healthy numbers (gamma 0..1, from `grade-check`)**
- Face luma 0.45–0.75. Skin differs by person, so never grade every face to one value. Below 0.45 reads underexposed; above 0.75 starts to look plastic or clipped.
- Room 1–1.5 stops under the face for a talking head. Under 0.9 stops, the room competes with the speaker.
- Neutral surfaces (white walls, grey) within ±0.04 warm/cool. Phone auto white balance under tungsten often reads +0.05 to +0.10 warm.
- Green tint over 0.025 means LED or fluorescent light; fix it with `tint` (positive = toward magenta).
- 1–99% luma range under 0.72 is flat (typical of HLG/HDR phone clips decoded in Chrome); add `contrast` 1.05–1.15.
- Clipped highlights over 1.5% are gone for good: `highlights` at about −0.4 only softens the edge. Note it for the next shoot.
- Noise σ over 3.2 on the original: `ev denoise` (light, medium, or strong = nlmeans). Denoise before grading; brightening shadows lifts noise too.

**Look strength by content**
- Talking head or tutorial: `clean` or `film` at 0.5–0.7. Skin is the priority.
- Lifestyle, food, family: `warm` at 0.6.
- Drama, night, serious: `moody` at 0.7, with the room pulled down, not the face.
- Cinematic B-roll: `teal-orange` at 0.6–0.8. It is too much on a full talking head.
- Brand consistency: `look="theme"` leans shadows toward the theme background and highlights toward the accent, subtly.
- An external `.cube` (film emulation packs, a Resolve export): `ev lut import file.cube`, then `look="luts/name.cube"`.
- Compare looks on the real frame before choosing: `ev lut preview <id> --at=12` gives one sheet with every look.

**Portrait blur**
- `<PortraitBlur id from blur={12–20}>` replaces `<CamFootage>`: the room blurs like a fast lens and the speaker stays sharp through the tracked matte.
- Keep `blur` ≤ 20 at 1080 wide. Stronger blur shows matte edges in hair.
- Don't stack it with `SubjectWindow` (the blur already separates). Darken the room with the outer `<Look>` instead.

**Technical**
- `<Look>` grades every `<Footage>`/`<Picture>` inside it, including `CamFootage` and the `CamMask` cutout. Nested Looks replace the outer one.
- The pipeline runs in linear light for exposure and white balance, then in gamma for tone, saturation and the LUT (33³ trilinear). The built-in looks are brightness-preserving tone curves plus hue moves, so skin doesn't drift.
- It needs WebGL2: renders use ANGLE (`remotion.config.ts`).

## Sources
- DaVinci Resolve node order (correct before creative) and power windows: https://www.blackmagicdesign.com/products/davinciresolve/color
- Skin-tone exposure varies by complexion (common practice: lighter skin around 60–70 IRE, darker 40–55 on a waveform), so no single target.
- 3D LUTs: Adobe "Cube LUT Specification 1.0" (the .cube format Resolve, Premiere and ffmpeg's lut3d read).
- Noise estimation, Immerkær, "Fast Noise Variance Estimation" (1996), Computer Vision and Image Understanding 64(2).
- Built and measured on vid-1 (room 0.39 stops under the face before the fix). Related: subject-room-separation, subject-tracking-depth.
