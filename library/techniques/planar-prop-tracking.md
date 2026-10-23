---
title: Planar tracking a held prop (corner pin)
summary: Track a flat object in the speaker's hands (banknote, card, phone, book cover) like Mocha or AE's corner pin. Measure four corners once at 3× zoom, then ORB + RANSAC homography per frame refined with ECC against the rectified reference. Use the corners to glow the edge, glint the surface, re-grade it, or patch the person matte where the segmenter drops paper.
components: none (project tools/track_note.py + NoteTrace/TrackedGlint/NoteWindow in the money project's scenes/marks.tsx)
themes: any
---
# Planar tracking a held prop

## Rules
- **Reference frame:** pick a sharp frame where the prop is flat and frontal. Read the corners on a 3× crop with a 10 px grid; corners under fingers are extrapolated along the visible edges. Corners 5-8 px off show as a line floating inside the paper.
- **Per frame:** ORB (1500 features, mask eroded 9 px so fingers on the edges don't become features) → ratio test 0.78 → RANSAC homography (3 px). Fall back to the previous frame's H under 15 inliers.
- **Refine:** ECC `MOTION_HOMOGRAPHY` between the rectified reference (warped flat) and the frame, seeded by the RANSAC H. Crop the template to the interior instead of passing a mask (OpenCV 5's mask must match the input size). Correlation is the confidence: ≥ 0.95 locked, < 0.9 hide graphics.
- **Smooth:** gaussian σ = 1 frame over confident frames only. More smoothing lags behind hand moves.
- **Motion blur ends the track.** When the prop is lowered or thrown, confidence falls under 0.5 within 2-3 frames: fade the graphic out *before* that (money: fade frames 52-62, lost at 75).
- **Edge glow that reads as light:** grow the quad 5 px outward; draw-on with `pathLength=1` dash in 16 frames (ease-in-out) with a radial comet head; three strokes screen-blended (30 px blur 16, 12 px blur 5, 3.4 px cream core); breathe ±15% while held. On a dark grade only: on a bright room it looks like a sticker.
- **Glint:** a skewed white-gold band clipped to the tracked quad, 18 frames, on the word that names the prop.
- **Matte patch:** segmenters drop paper held over the face. Re-draw the footage through the tracked quad (plus the hands below it) above any room darkening.
- Runs in ~10 s for 100 frames at 576×1024 on CPU (venv in `.cache/cv` with opencv-python-headless).

## Sources
- OpenCV AKAZE/ORB planar tracking tutorial: https://docs.opencv.org/4.x/dc/d16/tutorial_akaze_tracking.html
- OpenCV detection of planar objects (perspectiveTransform of the reference corners): https://docs.opencv.org/4.x/dd/dd4/tutorial_detection_of_planar_objects.html
- Direct (photometric) homography refinement, background in HVC-Net: https://arxiv.org/pdf/2209.08924
- Built and measured on the money project, 2026-10-19 (0.97-0.99 ECC correlation over 0-2.4 s).
