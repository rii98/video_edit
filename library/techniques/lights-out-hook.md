---
title: Lights-out hook (a practical light in the shot becomes the only light)
summary: Turn a calm opening into a cinematic cold open. Black the room out with a real day-for-night grade, then let a light source the subject is holding (lighter, phone, match, candle) be the only light, pinned to that object by measurement. Strikes, flames and releases are timed from the audio to the millisecond; the light falls off physically; the subject gets a motivated fill; the cut lands on the moment the light dies. Then the lights snap on with the music's first hit.
components: none (project-side: vid-1 scenes/S01_LightsOut.tsx, S02_LightsOn.tsx, parts.tsx grades)
themes: ember-supper
---
# Lights-out hook

Built for Ileyy's "Did you eat lunch?" (project `vid-1`, 2026-10-06): she flicks a small lighter before the question. The user asked for the darkness to look real and for zero misplacement or mistiming.

## Rules

**Measure the practical; never estimate it**
- Track the object itself, not the hand. The palm centre from hand tracking was ~32 source px (~80 px on screen) from the lighter. Colour-track it instead: yellowness `R+G−2B` (lighter ≈ 160, skin and wall ≈ 70, beige trousers ≈ 28), in a ±70 px window that follows the last hit. Bake a per-frame table (`lighter.json`) and interpolate gaps where the thumb hides it.
- Read the strike frames at 3× zoom: the metal head pops above the thumb (here at (316, 779) and (314, 780)), which is where sparks and the flame come from.
- Time events from audio onsets at 1 ms (high-pass at 2.5 kHz, energy jump > 18 dB over the floor). A butane lighter is **strike** (the loud click), then **release** (a softer click 0.28–0.32 s later). The flame only exists between a strike that catches and its release: 0.33 s here. Cut on the release: the flame dies and the scene changes on the same frame.
- Cross-check: the object disappears under the thumb on exactly the strike frames.

**Real darkness (day-for-night)**
- Use a tone curve, not a brightness slider: an SVG `feComponentTransfer` table with gain about 0.17 (−2.5 stops), a highlight shoulder with the ceiling about 0.22, saturation about 0.3, a subtle blue tint `[0.84, 0.93, 1.1]`, and neutral blacks. Too much blue looks fake ([PremiumBeat](https://www.premiumbeat.com/blog/5-reasons-day-for-night-footage-doesnt-look-right/)).
- Targets measured on the render: frame 0 mean luma about 20; with the flame about 30. A window stays a faint, cool rectangle (moonlight) and motivates the ambient.
- Grain up in the dark (about 10%, sensor noise), vignette about 0.8.

**Light that behaves**
- Practical: the frame graded at about 1900 K (tint `[1, 0.64, 0.3]`), masked by an inverse-square falloff `1/(1+(d/d0)²)` from the nozzle with d0 about 90 source px. Hands and lap glow; the floor 1–1.5 m away stays black.
- Motivated fill: the same warm grade on **her only** (person matte), in an upward ellipse from just above the flame. Light from below reaches the chest and the underside of the face; the feet and the bedding beside her stay out. An even fill on the whole body reads as a pasted cutout.
- Spark: about 0.5 intensity, decaying over 4 frames. Sparks are tiny flint specks (6, 2–4 frames each), not a starburst.
- Flame: about 34 source px tall, a blue base, a yellow-white core and an orange envelope, flickering at about 10 Hz (smooth noise every 3 frames). It always burns upward, whatever the lighter's angle.
- A question asked in the dark can light her: warm spill from the glowing words falls onto her head (a masked warm grade below the type).

**Lights on**
- On the next shot, peak the light switch on frame 0, together with the music's first 808 (find the transient in the low band and align it to the frame).
- Use a 1-frame `screen` flash (not an opaque overlay, which reads as fog), a stutter (on, dip to 55%, on), then let the room separate from her over about 16 frames, like eyes adjusting. This also hides any matte wobble during fast motion.

**Sound**
- No music in the dark. Sweeten the real strikes (flick sample peak on the strike frame), add an ignite on the catch and soft clicks on the releases (the denoise gates them).
- Under it all, a synthesized night drone: E1 (41.2 Hz) and 41.7 Hz beating at 0.5 Hz, plus an octave and pink room tone, swelling to the cut. A 0.9 s riser crests on the lights-on frame.

## Sources
- Day for night: https://en.wikipedia.org/wiki/Day_for_night, https://www.dfirentals.com/news/what-is-day-for-night
- Motivated and practical lighting: https://nofilmschool.com/motivated-lighting, https://www.studiobinder.com/blog/film-lighting-techniques/
- Flame colour temperature (about 1900 K) and flicker (about 10 Hz indoors): https://softlight.tools/color-temperature-chart/, https://www.nature.com/articles/srep36145
