---
title: Subject–room separation and precision finishing for phone talking heads
summary: Phone footage in a bright room puts the background at the subject's brightness. Separate them like a colourist (a tracked, heavily feathered power window about 1–1.5 stops over the room), keep lit practicals reading ON, and use the person matte only where type sits behind the head. Plus the measurement habits that keep cuts and graphics exact. Cuts are placed in silence found at 5–10 ms with fricatives respected, everything is in source frames, read times are checked, and the mix is verified by rendering.
components: none (project-side: vid-1 scenes/parts.tsx Shot, PowerWindow, HeadCutout, Practical, VoiceCuts, CutShots)
themes: ember-supper
---
# Subject–room separation and precision finishing

Learned on vid-1 (2026-10-06). The user's notes: "her background is too bright", "small mistiming and misplacement could be costly".

## Rules

**Measure first**
- Measure luma for the face region and the matte-excluded background. Here it was face 167 against room 172, so the room competed with her.
- Target: background about 1–1.5 stops under the subject (achieved: face 131, wall 81, ceiling 87 in gamma space).

**Separate with a power window, not a hard matte**
- Grading her through the segmentation matte showed blocky chunks of bedding. The whole-frame mask is low resolution and its false positives sit inside her body extent, so a pose-based garbage matte doesn't remove them.
- Instead, use a tracked oval sized to her silhouette:
  - half-width about 1.75 face widths, height about 560 source px;
  - centred below the face (camFace + 1.15 face heights);
  - core 38%, feathered to 0 by 100%;
  - it carries her grade, so there is no hard edge anywhere.
- Room grade: gain about 0.66, saturation 0.74, highlight ceiling 0.6.
- Contrast: HLG phone footage decodes flat in Chrome, so add contrast 1.06 on the room and 1.09 on her.
- Use the precise cutout only where type is behind her head, limited to above the shoulders (pose 11/12) with a soft edge. That region's matte is clean.

**Practicals stay ON**
- The room grade turns a ceiling lamp into a grey disc, which reads as "off" in a shot where the lights just came on.
- Restore it: a warm-white core below clipping (screen blend) plus a soft bloom, pinned to the lamp's measured source position.

**Cuts**
- Find speech islands at 5–10 ms, and read the spectrum where they merge. Here "love … food" looked continuous at −44 dB. The 9.02–9.24 s fricative "v" tail (5–6 kHz) belonged to the word; 9.26–9.88 s was room tone.
- Cut 2 frames past the last sound and 2 frames before the next onset, fricatives included (the "f" of "food" started at 9.90 s).
- Keep cut lists in **source frames** (`[[in, out], …]`), never seconds, so picture and audio can't drift by a frame.
- Play the voice per segment (`VoiceCuts`, 1-frame fades) separately from muted picture, so J/L cuts stay possible.
- Keep comic pauses whose silence carries action (a hair toss): trim only the still part before it, hidden by a punch-in.
- Find the source's own camera cut by frame differencing (a jump from 0.1 to 50).

**Read time and layout**
- Every text holds for 3 words per second plus 0.5 s. When a scene cut is earlier, carry the text over the cut and let it clear there (one-word moments get about 0.5 s).
- Two graphics must never share a band at the same time. Sequence them (one clears, then the other enters).
- Keyword colour alone fails on matching wardrobe (coral "eat" on her coral top). Put keywords on chips.
- Text must sit fully inside its chip; check ascenders like the "h" in "have".
- A PiP of a vertical source should be the **scaled** full frame (face, neck and hands in view), not a tight crop at zoom 1.44. Animate into it by scaling the full frame and clipping to the panel, so the shot is continuous.
- Use the empty space for big, airy rows (170 px chips, 100 px words, 190 px row spacing) when the user asks. Note when this enters the platform-UI band.

**Mix, verified by rendering**
- Render the soundtrack to WAV and measure RMS and peaks per moment:
  - voice about −24 to −26 dB RMS;
  - bed about 10 dB under (a spacious trap bed with open mids: about 0.09 gain on −12.7 LUFS);
  - only the signature hit about 5 dB over voice peaks (the lights-on 808 at −5.6 dB);
  - a bite at −5.7 dB was too hot, so it went down 6 dB.
- Choose music by spectrum against the voice band (300 Hz–3 kHz). A dense, sampled mid-range bed fights speech even at low level.

**Code hygiene that bit us**
- Never call a hook after an early return. Single stills pass, but a continuous render fails with React #310.
- Load the scene fonts explicitly (`fontStack(...)`) rather than relying on a theme. Renders then wait for them.

## Sources
- Built and measured on project vid-1. Related cards: lights-out-hook, cartoon-keyword-type, subject-tracking-depth, sound-design, social-vertical-captions.
- Power windows and secondaries (tracked, feathered qualifiers for subject vs background): https://www.blackmagicdesign.com/products/davinciresolve/color
- Motivated and practical light (practicals must still read as light sources): https://www.studiobinder.com/blog/film-lighting-techniques/
- J/L cuts and dialogue edits: https://borisfx.com/blog/l-and-j-cuts-smoother-more-cinematic/
