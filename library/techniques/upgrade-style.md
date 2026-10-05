---
title: The Upgrade style (talking-head tips, "Ileyy style")
summary: The house style built for Ileyy's "Stop saying very ___" short. One person, one take, turned into an award-level vertical edit. A tracked follow-cam, a repeating ❌ DON'T SAY → ✓ SAY INSTEAD grammar, huge type behind the speaker with a blue rim light, "or…" stickers from her hand, a 01/04 progress HUD, a 3D ring and extruded 3D type, a split screen, a freeze-frame sticker name card, a PiP recap and a seamless loop. Calm, measured sound. Say "Upgrade style" or "Ileyy style" to get it.
components: none (project-side: stop-saying-this-v2 scenes/parts.tsx; src/video/track.tsx)
themes: editorial-pop
---
# The Upgrade style

The trigger phrases are **"Upgrade style"**, **"Ileyy style"** and **"like the stop-saying video"**. The live reference is the project `stop-saying-this-v2` (`ev project use stop-saying-this-v2`). Copy its `scenes/parts.tsx` into the new project and adapt it. Don't rebuild from memory.

## When to use
- Talking-head tips and lists: vocabulary swaps, myth/fact, "stop doing X / do Y", top-N advice. Any one-take creator video with a repeating "wrong → right" or "item N of M" structure.
- Skip it when there's no person on camera, or for calm documentary pieces (too much graphic energy).

## Rules

**Setup**
- `ev track <id>` in the background first (about 1.1 s per frame). Everything below depends on it.
- Theme `editorial-pop`: Bricolage Grotesque 800 display, Inter Tight, JetBrains Mono labels, warm white `#FFF8EE`, ultramarine `#3050FF`, red `#FF3B2F`. Grade contrast 1.05 and saturation 0.92, overlay grain at 6%.
- 9:16 from 16:9 with `FollowCam` (eyes at about y 0.40). Jump cuts change zoom by at least 10% so they read as new shots. Trim breaths and fillers; cut on utterance boundaries.

**The swap grammar (repeat it every item so viewers learn it)**
1. **Close shot (zoom about 1.1):**
   - The weak phrase appears as a **✕ DON'T SAY card**: red pill tag over the phrase, Bricolage 800 at 100 px, dark card with a 3 px red border.
   - It sits centred under her chin and pops in 0.55 → 1.08 → 1 with a soft pop.
2. **On "becomes" (or the turn word):**
   - The card shakes and a thick red strike draws across it.
   - Sound: a marker stroke plus a soft two-note "nope". Never a game-show buzzer.
   - The card drops away.
3. **Pull-out:**
   - The camera pulls to 0.78–0.82 (bottom-anchored, blurred backdrop above, 220 px feather).
   - The room dims to navy (0.7) and a blue rim glow switches on.
4. **The upgrade:**
   - A **✓ SAY INSTEAD** blue pill appears.
   - The word lands huge (about 196 px) behind her head, the cutout over the type, with her hair overlapping only its lower edge.
   - Slam in: scale 1.35 → 1 with blur 10 → 0 over 7 frames.
   - Sound: hit plus a correct ding.
5. **The alternative ("or…"):**
   - A warm-white **sticker** with blue 104 px type, a hard 9/11 px blue offset shadow, a dark "or" badge and a shine sweep.
   - It launches from her tracked palm (or her mouth) and arcs into the chin zone. Sound: whoosh → pop → shimmer.
- **Placement system:** the upgrade owns the top; the alternatives (wrong and "or") own the chin zone. Nothing covers the face.

**Series HUD**
- Top-left (76, 228): an UPGRADE label, a big **01/04** that rolls to the next number each item, and 4 story-style bars (done white, current filling blue).
- It pulses when the upgrade lands, and tucks away when a split screen owns the top.

**Variety across items (one depth trick per beat, never all at once)**
- Item 1: type behind the head.
- Item 2: a **split screen**, ✕ grey pane over ✓ colour pane, sliding in from opposite edges; the ✓ pane then grows to full frame.
- Item 3: a **Three.js halo ring** at forehead height (tilt about 0.2 rad, radius ≤ 380 px), with the words orbiting behind her. Two canvases split at the ring's depth plane (z = 0) give real occlusion. Slow push-in, deeper dim.
- Item 4: **3D extruded type** (CSS `preserve-3d`, 18 layers × 3.6 px, shaded sides) flipping in behind her raised arms.

**Hook and ending**
- Hook: a 3D extruded red word (STOP) spins in behind her on the first spoken word. A layered impact (whoosh, punch, thump, synth hit) sits 5–6 dB over the voice. Visible from frame 1.
- Name: a **freeze-frame sticker card**: white flash and shutter, brand-blue background, her cutout with a solid white die-cut outline (four chained zero-blur drop-shadows), the 3D name and a series label. Hold 0.6 s while her voice continues.
- Then the shot shrinks into a **PiP card** (50%, radius 36, blue edge) over a recap list of all items (old struck → new), so viewers can screenshot it.
- **Seamless loop:** in the last 0.4 s the card grows back to full frame and the text clears, so the last frame matches the first.

**Sound**
- A CC0 music bed (Freesound, imported with `--raw`) about 10 dB under her voice, swelling on the end card.
- Effects go through one global gain (about −8 dB) so they sit under the voice. Only the hook impact stands out.
- Verify a mix by rendering a wav slice and checking `volumedetect`, not by feel.

## Sources
- Built and iterated with the user on 2026-10-05: project stop-saying-this-v2. Every rule above came from a render check or a user request: bigger DON'T SAY card, progress HUD, "or" sticker, louder STOP, the veteran ending, and no buzzer.
- Research behind it: see that project's `intake/research.md`, plus the `subject-tracking-depth`, `kinetic-typography`, `split-screen-comparison`, `3d-planets-and-depth` and `sound-design` cards.
- Loop endings: https://faceless.so/blog/looping-short-videos-tutorial-story-seamless-loops
- Caption fatigue in 2026 ("steal the principles, update the aesthetic"): https://joyspace.ai/hormozi-editing-style-2026-analysis
