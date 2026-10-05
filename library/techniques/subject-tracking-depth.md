---
title: Subject tracking and depth for talking heads
summary: Track the speaker (face, hands, pose, a soft person mask per frame) with `ev track`, then build depth that looks rotoscoped. Type behind her, a rim glow, words riding her palm, a follow-cam reframing 16:9 into 9:16, pop-out-of-frame PiP, and 3D rings that pass behind her head. Keep the face clear of type, pull out to make room, and use one depth trick per beat.
components: none (src/video/track.tsx: useTrack, FollowCam, CamFootage, CamMask)
themes: editorial-pop, red-pen, velvet-cinema
---
# Subject tracking and depth for talking heads

## Pipeline
- `npm run ev -- track <video id>` runs MediaPipe (face landmarker, hand landmarker, pose full, selfie multiclass segmenter) in Playwright's Chromium on CPU. No Python or GPU needed. It takes about 1.1 s per frame at 30 fps (a 25 s clip takes about 14 min), so run it once, in the background, while you research.
- Output: `analysis/<id>/track/track.json` (0..1 source coordinates) and `mask/NNNNN.png` (1280×720, white with alpha = person).
- Masks: the face-centred square crop gives sharp edges, a full-frame pass catches arms outside it, and the two are feathered together. Never use the crop alone; it leaves a hard vertical seam on raised arms.
- Smoothing lives in `useTrack`. Anchors use a gaussian with σ ≈ 1.5 frames (they stick to the hand and don't jitter). The camera uses σ ≈ 14 frames, which feels like an operator rather than a gimbal.

## Rules
- **Reframing 16:9 → 9:16:** a 4K source gives a 1215×2160 window, sharp up to about 1.75× punch-in. `FollowCam follow={1}` keeps the face centred; put the eyes on the upper third (`target` y 0.36–0.42).
- **Type behind the subject needs room.** At cover zoom the head fills the upper third, and a full-width word behind it becomes unreadable: the head eats the middle letters. That was the first failure in the motion tests. Fixes:
  1. Pull out (zoom < 1, bottom-anchored) for the reveal, so the head drops and the word sits above it with only its lower edge tucked behind the hair. Fill the band above with a blurred, dimmed copy of the footage.
  2. Or set the word in two short lines high in frame, with ≤ 25% of the letters covered.
- **Dim the room, not her** (navy overlay at about 60% between the footage and the cutout). The speaker pops and the type behind her stays readable on a busy background.
- **Rim glow:** `CamMask mode="glow"` with spread 8–10 and blur 18–22, under the cutout. It only reads on a dimmed background; on the raw room it's invisible.
- **Words from hands:** anchor to the tracked palm, then clamp into the safe area (x 250–830, y 560–1400). Scale in from 0.2 with a slight rotation, then drift up 60–80 px over about 40 frames with the hand. Fall back to the face when no hand is detected (hands are found ~75% of the time).
- **Old vs new phrase:** the weak phrase is small (64 px), grey, on a dark chip by the mouth, struck in red on "becomes". The upgrade is huge (220–260 px) and heavy. Size contrast teaches the point without a label.
- **Pop-out-of-frame PiP:** draw the cutout again over the frame, clipped to above the photo edge. It only works when the camera puts her head across the top edge (zoom about 1.3, face target y about 0.2). If her head sits inside the photo, nothing pops out (failure in test B).
- **3D ring orbit (Three.js):** use two ThreeCanvases, the back half (clipping plane z < 0) under the cutout and the front half over it, so words truly pass behind her head. Keep the radius ≤ 0.75 × face height on screen and ≤ 380 px, or the words orbit off-canvas (failure in test C). Tilt about 0.3 rad, spin about 0.04 rad per frame. Draw word textures only after `document.fonts.load` resolves.
- **3D type without a font converter:** stack 10–14 copies of the text in a `preserve-3d` container, 2–3 px apart in Z, the back copies darker. That gives a true extrusion under CSS perspective that rotates convincingly.
- **One depth trick per beat.** Text-behind, glow, ring, pop-out and split screen each get their own moment. Stacking them all at once reads as an effects demo.
- **Grain and grade (from the cinematic test):** contrast 1.05–1.08, saturation about 0.9, overlay grain at 5–7%. It glues the graphics to the footage.

## Sources
- MediaPipe Tasks Vision for Web: https://developers.google.com/edge/mediapipe/solutions/vision/hand_landmarker/web_js
- Rotoscope "text behind subject" (Adobe): https://www.adobe.com/learn/after-effects/web/rotoscope-subject
- Pop-out-of-frame trend: https://picsart.com/blog/pop-out-of-phone-trend-tutorial/
- 2026 caption fatigue, "steal the principles, update the aesthetic": https://joyspace.ai/hormozi-editing-style-2026-analysis
