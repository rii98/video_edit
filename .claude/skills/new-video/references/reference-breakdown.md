# Breaking down a reference video

When the user gives a reference ("make it like this"), study it the way a senior editor studies a film they admire: from the first frame to the last, then again, and write down every decision. The goal is to understand *why it works* so we can build something original that works for the same reasons. **We adopt principles, never copy footage, artwork, logos or exact layouts.**

## 1. Get the frames

```bash
npm run ev -- reference <file | URL>
```

- A URL needs `yt-dlp` (`pip3 install yt-dlp` or `brew install yt-dlp`). Without it, ask the user to download the video and give you the path.
- It writes to `project/.ev/reference/<slug>/` (not versioned, not in the media library):
  - `sheet-NN.jpg`: one row per shot, showing its **in · mid · out** frames with timecodes and duration. The in/out pair shows the camera move, the type build and the transition on each side.
  - `strip.jpg`: one frame every 0.5–4 s, evenly. It catches what changes *inside* a long take: type builds, counters, checklists, slow pushes.
  - `frames/s###-{in,mid,out}.png`: single full-size frames, for Reading up close.
  - `shots.json`: shot list with start, end and cut score.
- It prints pacing numbers: shot count, average shot length (ASL), cuts per minute, shortest/longest, cuts per third, and **soft cuts** (low scdet score: dissolves, morphs, whips, fast moves, or a graphic change rather than a picture cut).

**Read every sheet in order, and the strip.** Don't skim. Long videos (over ~3 min) produce many sheets; read them all, but take notes per sheet so you don't lose the thread.

## 2. Zoom in on key moments

The sheets show *what*; bursts show *how fast and with what curve*. For every signature moment (title build, transition, camera move, speed ramp), render a burst of consecutive frames:

```bash
node_modules/ffmpeg-static/ffmpeg -v error -y -ss <seconds> -i <file> -t 1 \
  -vf "fps=30,scale=240:-2,drawtext=fontfile=/System/Library/Fonts/Supplemental/Arial.ttf:text='%{n}':x=4:y=4:fontsize=16:fontcolor=white:box=1:boxcolor=black@0.7,tile=10x3:padding=2" \
  -frames:v 1 project/.ev/reference/<slug>/burst-<seconds>.jpg
```

That's 30 frames (1 s) on one sheet, numbered. From it, measure in frames at 30 fps:
- how long a word or line takes to come in, how long it holds, how it leaves;
- the stagger between words or letters;
- whether motion eases out (fast then settles), eases in-out, overshoots, or is linear;
- where the cut sits inside a whip or a flash, and how many frames of blur each side;
- how far a push-in travels (scale at the in frame vs the out frame).

Use `-t 2` with `tile=10x6` for slower moves. For audio-led moments (cuts on the beat, SFX hits), ingest a temporary copy (`ev ingest`, read `ev media <id>` for BPM, downbeats, loudness and transcript, then `ev remove <id>`).

**Identifying fonts:** crop a clean frame of the type and compare by eye with likely families (Google Fonts first, since they load in one line). Describe the class if you can't name it: "condensed grotesk, heavy, all caps, tight tracking". Then pick the closest licensed option.

## 3. The checklist (what a senior editor notes)

Go through every section. Write "n/a" rather than skipping, so nothing is forgotten.

### Format and context
- Platform, aspect ratio, resolution, fps, duration.
- Genre (trailer, explainer, ad, title sequence, talking head, music video, product reel, documentary short…) and audience.
- The single message, and the emotion it's after.

### Structure and story
- **Hook:** exactly what happens in the first 1 s, 3 s and 5 s. How the question or promise is set up.
- **Beats:** a timeline of acts and turns (setup → escalation → reveal → payoff → button/CTA). Where the open loops are and where they close.
- **Story devices:** pattern interrupts, cold open, repetition with variation, countdown or list structure, callbacks, reveal held back, contrast (before/after, myth/fact).
- **Ending:** button, CTA, end card, loop back to the start.

### Pacing and rhythm
- ASL overall and per section; where it accelerates and where it breathes (holds after reveals, slow sections before climaxes).
- What the cuts are motivated by: beat, action, word, eye-trace, graphic.
- Rhythm pattern (e.g. long-short-short-long, steady on every bar, accelerating to the drop).

### Shot by shot (the table)
For every shot: timecode, duration, **A-roll or B-roll**, content, **shot size** (EWS, WS, MS, MCU, CU, ECU, insert), **angle** (eye level, low, high, top-down, OTS, POV, dutch), **camera move** (static, push, pull, pan, tilt, truck, orbit, crane, handheld, whip, crash zoom, dolly zoom, rack focus, virtual camera on graphics, Ken Burns on stills), **composition** (thirds, centred/symmetric, negative space for type, leading lines, frame within frame, depth layers), graphics and type on screen, **transition in and out**, and the sound event at the cut.

### A-roll / B-roll
- Ratio of A-roll to B-roll, and how long B-roll covers stay up.
- How literal B-roll is (shows exactly what's said) vs metaphorical.
- Jump cuts: hidden, punched-in (and by how much), or embraced as style.
- J-cuts and L-cuts (audio leading or trailing the picture), cutaways, reaction shots, inserts.

### Typography
- Families (or their class), weights, case, tracking, leading, size relative to frame height, colour, outline/shadow/box treatment.
- **Hierarchy:** how many levels, the scale contrast between them, how emphasis is shown (weight, colour, size, one word only?).
- **Placement system:** where each kind of text lives (titles, labels, captions, stats, CTAs), margins, safe zones.
- **Animation:** in / hold / out in frames, per-word or per-letter stagger, mask, slide, scale punch, blur, tracking, typewriter; sync with voice (on the word, before it, after it).
- **Kinetic type as layout:** words filling the frame, type interacting with footage, type behind the subject (depth masking), type in 3D space, type as a transition.
- Captions: style, words per line, highlight method, position.

### Layout and graphic system
- Grid and margins; symmetry vs asymmetry; how much empty space.
- Recurring graphic elements (badges, HUD, frames, lines, shapes, icons, stickers) and their style (stroke weight, corner radius, fill vs outline).
- Illustration style, if any (flat, line, collage, textured, 3D, cut-paper, archival).
- Split screen, picture-in-picture, grids, device frames: when and how they enter.

### Colour and finish
- Palette (bg, text, accent; approximate hex), how graphics colours relate to the footage.
- Grade: contrast, warm/cool, saturation, consistency between shots.
- Texture and finish: grain, noise, vignette, halation, light leaks, paper, scan lines, chromatic aberration. Strength (subtle vs styled).

### Motion language
- Overall feel: snappy, floaty, mechanical, organic, springy.
- Easing (ease-out expo, ease-in-out, overshoot), typical durations for small/medium/large moves, stagger values.
- Direction logic (things enter from one side and exit the other; motion continues across cuts).
- Choreography: how many things move at once, what leads, what follows.

### Transitions
- Inventory: count of each type (hard cut, match cut, whip, mask/object wipe, morph, zoom-through, flash/dip, dissolve, graphic wipe, smash cut, cut to black, L/J audio bridge).
- What motivates each one, its length in frames, and the sound on it.
- How many families are used overall (usually one or two).

### Camera
- Real camera moves vs virtual (pushes on stills or graphics, parallax, 2.5D).
- Speed ramps (where, from/to %), slow motion, freeze frames, rewinds, time-lapse.
- Stabilised vs handheld energy; drone or crane reveals.

### Layering and depth
- Foreground / midground / background separation; parallax speeds.
- Depth masking (text or graphics behind the subject), depth-of-field blur, shadows and light direction, blend modes, particles, atmosphere.

### Sound
- Music: genre, BPM, energy shape, where it drops out, edits to the music (cuts on downbeats? every bar?).
- Voice: VO style, pace (words per second), presence or absence of music under it, ducking.
- SFX: which events get sound (whooshes on moves, hits on reveals, risers before drops, UI clicks), layering, silence used for impact.
- Mix: loudness feel, room tone, transitions in the audio.

### What makes it work
- Three sentences: the core idea, the signature device, the feeling it leaves.
- **Adopt (principles):** e.g. "every stat lands on a downbeat and holds 1 bar", "titles mask up behind the subject", "ASL 1.4 s in the first third, 3 s after the reveal".
- **Don't copy:** footage, artwork, logos, characters, the exact layout or title design, the music. Make an original take on the principles.
- **Map to our tools:** which library components, themes and technique cards cover each adopted principle, and what's missing (a gap might become a new component or card).

## 4. Output

Write `project/intake/reference-<slug>.md`:

```markdown
# Reference: <title or URL>
<platform · aspect · duration · fps · genre> · source: <URL or file name>

## Summary
<3 sentences: core idea, signature device, feeling>

## Pacing
<ASL, cuts/min, rhythm pattern, where it speeds/breathes>

## Structure
| Time | Beat | Device |
|---|---|---|

## Shot list
| # | Time | Dur | A/B | Shot size · angle | Camera | Graphics / type | Transition in → out | Sound |
|---|---|---|---|---|---|---|---|---|

## Typography
## Layout and graphics
## Colour and finish
## Motion language
## Transitions
## Camera and time
## Layering and depth
## Sound

## Adopt (principles)
- …
## Don't copy
- …
## Maps to
- components / themes / cards; gaps
```

Then, if a principle is reusable beyond this video, write a technique card in `library/techniques/` (same frontmatter as the others: title, summary, components, themes; `## Rules` with numbers, `## Avoid`, `## Sources` with the reference credited by name and URL).
