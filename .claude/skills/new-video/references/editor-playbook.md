# The editor's playbook

What a senior editor and motion designer weighs before and during a cut. Numbers are frames at 30 fps unless stated; treat them as strong defaults and judge by eye. For deeper rules, the matching technique card in `library/techniques/` wins. Where a library component implements a technique, it's named in brackets.

**The governing idea:** every element and every cut must serve the message and the emotion. Walter Murch's "rule of six" ranks what a cut must respect: **emotion (51%) > story (23%) > rhythm (10%) > eye-trace (7%) > 2D screen plane (5%) > 3D space (4%)**. If you must break one, break from the bottom.

---

## 1. Story and structure

- **Hook in the first 1–3 s** (social) or a cold open (long form). Open on the most interesting image, a question, a bold claim, a number, or the end result. No logos, no "hi guys", no slow fade-in.
- **Promise → proof → payoff.** Say what they'll get, show it, deliver it. Close every open loop you opened.
- **"But / therefore", never "and then".** Each beat should turn the previous one (South Park writers' rule).
- **One idea per screen.** If a frame says two things, split it into two shots.
- **Escalate.** Order beats from good to best; save the strongest image or fact for the climax, then end quickly.
- **Contrast creates interest:** before/after, myth/fact, big/small, fast/slow, loud/silent.
- **Repetition with variation** builds pattern, then breaks it for surprise (pattern interrupt every 5–10 s on social).
- **Endings:** a button (a final beat that lands the idea), a CTA held long enough to read twice, or a seamless loop back to frame 1 for shorts.

## 2. Pacing and rhythm

- **Average shot length (ASL) by genre:** trailer and hype 0.7–2 s; social short 1.5–3 s; explainer 2.5–5 s; commercial 2–4 s; documentary and interviews 4–10 s; premium product reveal 3–6 s.
- **Vary it.** Steady rhythms numb; use patterns like long-short-short-long, and accelerate into a climax.
- **Breathe after a reveal:** hold 12–24 frames on a big moment before cutting. Silence and stillness are tools.
- **Cut on action:** cut mid-movement so motion carries the eye across (match on action).
- **Cut on the beat, not every beat:** downbeats, every 1, 2 or 4 bars for calmer sections (see `cutting-to-music`).
- **Eye-trace:** keep the focal point near where the previous shot's was, or move it deliberately. A big jump in focus position costs the viewer ~3–6 frames to find the subject.
- **Trim the air:** start shots late, leave early. Cut the first and last few frames of every action if they add nothing.

## 3. A-roll and B-roll

- **A-roll** carries the story (the talking head, the voiceover, the main action). **B-roll** shows what's being said, covers edits, adds texture and pace.
- **Be specific:** when the voice says "a 1960s IBM mainframe", show that exact machine, not "a computer". Literal first, metaphorical when literal is impossible.
- **Change the picture every 2–4 s** in explainers and social, even if the voice is continuous.
- **Cover jump cuts** in interviews with B-roll, or embrace them as style with a **punch-in of 110–125%** on alternate cuts (keeps eyes in the upper third).
- **J-cut:** audio of the next shot starts 6–15 frames before its picture. **L-cut:** audio carries 6–15 frames over the next picture. Both make cuts invisible and feel conversational.
- **Cutaways and inserts:** hands, details, screens, reactions. Reaction shots sell a line more than the line itself.
- **Show then tell or tell then show:** showing first creates curiosity; telling first creates clarity. Choose per beat.

## 4. Shot sizes

| Size | Use it for |
|---|---|
| Extreme wide (EWS) | Scale, isolation, establishing a world |
| Wide (WS) | Geography, full action, the subject in context |
| Medium wide / cowboy | Body language, two people |
| Medium (MS) | Default for talking, demonstrating |
| Medium close-up (MCU) | Interview standard: chest up |
| Close-up (CU) | Emotion, emphasis |
| Extreme close-up (ECU) | Detail, tension, texture, a single word on screen |
| Insert | The object that matters (a button, a signature, a number) |

- **Progress wide → medium → close** to build intimacy or intensity; jump from close straight to wide for a reveal or a shock.
- **Avoid jump cuts by accident:** a new shot of the same subject should change size by at least ~20% or angle by 30°+.
- **Motion graphics have shot sizes too:** a whole infographic is a wide; one number filling the frame is an ECU. Cut or push between them the same way.

## 5. Angles and composition

- **Angles:** eye level (neutral, honest), low (power, heroism), high (vulnerability, overview), top-down (flat lay, process, very good for graphics), over-the-shoulder (dialogue, POV of a screen), POV (immersion), dutch (unease; use rarely).
- **Rule of thirds** for documentary and human subjects; **centred symmetry** for authority, titles, products and stylised worlds (Wes Anderson, Kubrick).
- **Lead room and look room:** leave space in the direction the subject faces or moves. **Headroom:** eyes on the upper third line.
- **Negative space for type:** compose (or crop) so text has a clean area; never stack text on a busy region.
- **Depth:** foreground, midground, background. A blurred foreground element sells depth instantly.
- **Leading lines and frames within frames** (doorways, screens, cards) guide the eye.
- **180° rule and screen direction:** keep movement direction consistent across cuts. Left→right reads as progress and forward time; right→left as return or resistance.

## 6. Camera movement (real and virtual)

Every move needs a motivation: follow, reveal, emphasise, or energise. One move per shot; ease in and out.

| Move | Meaning | Defaults |
|---|---|---|
| Static lock-off | Calm, authority, lets action play | Add a tiny drift (1–2% scale) on graphics so they don't feel frozen |
| Push-in | Realisation, emphasis, intimacy | 3–8% scale over a held shot; up to 15% for drama [ZoomPan] |
| Pull-out | Reveal context, isolation, ending | Start tight on a detail, end wide |
| Pan / tilt | Follow or survey; tilt up = awe | Ease both ends; avoid stuttering speeds |
| Truck / dolly (lateral) | Parallax, gliding past a world | Layers move at different speeds (2.5D) |
| Orbit / arc | Hero moment, product, 3D feel | Slow, ~15–40° |
| Crane / pedestal | Grand reveals, scale | Rise over the subject into the wide |
| Handheld | Urgency, documentary truth | Low-frequency drift 2–6 px; smooth noise, never random per-frame jitter |
| Whip pan | Energy, time/place jump | Cut mid-blur; both sides blur the same direction (see `transitions-match-whip-mask`) |
| Crash zoom | Comedy, shock, emphasis | 4–8 frames to 1.3–2×, a hit on arrival |
| Dolly zoom (vertigo) | Dread, realisation | Background scale and foreground scale move opposite |
| Rack focus | Shift attention between depths | Blur the leaving layer to ~8–12 px while the new one sharpens |
| Ken Burns (stills) | Bring photos to life | ≤10–15% scale over 3–6 s, move toward eyes or the key detail; add parallax by cutting the subject out when possible |
| Speed ramp | Emphasise an action peak | 100% → 20–40% at the peak → 100%, ramps 4–8 frames |

**Virtual camera in motion graphics:** build scenes as layers and move a camera over them: background at 0.2–0.4× the movement, midground 0.6×, foreground 1× or more. **Momentum match:** if the camera is moving right at the end of shot A, start shot B already moving right.

## 7. Transitions

Order of preference:
1. **Hard cut** (invisible, keeps pace). The default.
2. **Match cut:** shape, motion, colour, sound or idea carried across the cut (a coin becomes the moon; a swipe continues).
3. **Motivated transitions:** whip pan, object passing the lens (mask wipe), zoom-through into a letter or a dark area, light flash, morph of one shape into another, type filling the frame and becoming the next background [MaskReveal].
4. **Smash cut** (loud to silent, calm to chaos), **cut to black** (weight, ending a chapter), **dip to white** (memory, flash, impact).
5. **Dissolve** for time passing or dreamlike connection; 10–30 frames.
6. **Graphic wipes and slides** only inside a strong graphic system, 8–16 frames.

Rules:
- **One or two transition families per video**, repeated. Variety looks amateur.
- **Length:** 6–20 frames; never longer than the shots around it.
- **Sound sells it:** a whoosh starting slightly before the move, a hit on the landing; J/L audio hides picture cuts (see `sound-design`).
- **Invisible cuts:** hide the cut in darkness, a foreground wipe, or the peak of a whip.
- Avoid: star wipes, page curls, cube spins, random glitches, light leaks on every cut.

## 8. Typography and kinetic type

**Choosing type:**
- Pick by voice: grotesk sans (neutral, modern, tech), condensed sans (sport, urgency, impact), humanist sans (friendly), high-contrast serif (premium, cinematic, editorial), slab (sturdy, retro), mono (code, data, terminal), script and hand (personal; sparingly).
- **Two families maximum** (display + text), often one family in several weights. Weights you use: 2–3.
- Prefer Google Fonts (one line in `src/video/fonts.ts`). Check the theme's display face first.

**Setting type:**
- **Hierarchy through contrast:** 2–3× size between levels, or weight/colour contrast. One emphasis treatment, applied to one word per line at most.
- **Tracking:** large display type slightly tight (−1% to −4%); all caps loose (+5% to +15%); small labels +2–8%.
- **Sizes (1080 px tall frame):** body/captions ≥ 40 px (16:9) and ≥ 54 px (9:16 at 1080 wide); headlines 90–220 px; one word can fill the frame.
- **Reading time:** about 3 words per second, plus 0.5 s to land; hold anything important long enough to read twice.
- **Line breaks by meaning**, not by width ("the fastest / way to edit", not "the fastest way / to edit"); no orphans; 2–3 lines max.
- Kerning on big type: look at it at full size; fix gaps in "AV", "To", "LT".

**Animating type** [KineticTitle, Captions]:
- Families: **mask reveal** (premium, from behind a line), **rise and fade** (gentle), **per-word stagger** (2–4 frames apart), **per-letter** (1–2 frames apart, short words only), **scale punch** (1.15→1.0 over 4–6 frames, energy), **tracking expand** (cinematic, slow), **blur-in** (dreamy), **typewriter** (only for code, terminals or notes), **counters** for numbers [Counter].
- Total in-animation under ~0.8 s (12–24 frames). Out-animations faster than in (60–70% of the in-time) or a hard cut.
- **Sync to voice:** a word appears on the frame it's spoken (0–2 frames early feels right); keyword pops 200–400 ms after the word for emphasis-only styles.
- **Type as image:** words that fill the frame, type tracked behind the subject (depth masking), type in perspective on a surface, type that becomes the transition.
- Pick one animation family for each level of the hierarchy and stick with it.

## 9. Layout and graphic system

- **Margins:** 5–10% of the frame. **Title safe** 90% of frame; **action safe** 93%.
- **9:16 social safe area:** keep text inside roughly the central 900×1400 of 1080×1920: clear of the top ~220 px, the bottom ~420 px (captions, UI) and the right ~120 px (buttons). See `social-vertical-captions`.
- **Grid:** a 12-column (16:9) or 6-column (9:16) grid with an 8 px baseline; align every element to it.
- **Placement system:** each kind of information lives in one place (labels lower-left, stats upper-right, etc.). Consistency makes it look designed.
- **Colour:** 60/30/10 (background / secondary / accent); one accent for emphasis only. Text contrast ≥ 4.5:1. Derive graphic colours from the footage's palette so they belong.
- **Shape language:** one corner radius, one stroke weight, one icon style throughout.

## 10. Layering and depth

- **Three planes:** background (texture, gradient, environment), midground (subject, footage), foreground (type, graphics, particles, blurred elements).
- **Parallax** between planes for every camera move (see §6).
- **Depth masking:** put a title behind the subject (needs a cut-out or a clean plate; on stills, cut the subject out as a separate PNG layer).
- **Shadows:** one light direction for the whole video; soft, low-opacity (15–35%), offset matched to the light.
- **Finish:** film grain 2–5% (also kills banding on gradients), subtle vignette, gentle halation on bright edges for cinematic looks. Blend modes: screen/add for light, multiply for paper and ink.
- **Atmosphere** (dust, bokeh, light sweeps) only when it suits the world, at low opacity, slow.

## 11. Split screen, picture-in-picture, grids

- **Split screen** [SplitScreen]: comparison, before/after, parallel action, conversation. Match subject scale and eye lines across panes; align horizons; thin divider 2–6 px or a gap; stagger the panes' entry 4–8 frames, from opposite edges. Slider wipe for precise before/after.
- **Picture-in-picture:** commentary, reactions, a presenter over a demo. 25–33% of frame width, 4–6% margins from the edges, rounded corners 12–24 px, soft shadow, in a corner that never covers the subject or captions. Animate in with a scale/position ease (10–14 frames).
- **Grids and multi-frame:** montage, variety, "everyone's doing it". Fill cells in a rhythm (on beats), one cell featured at a time.
- **Device frames** [DeviceFrame] for screens and apps; zoom into the UI to make it readable [ZoomPan, `screen-demo-zoom`].

## 12. Montage and sequences

- **Rhythmic montage:** shots cut to the music, building toward a peak.
- **Match-on-action chains:** one movement continued across several shots or places.
- **Kuleshov effect:** meaning comes from juxtaposition; the shot after a face tells us what it feels.
- **Lists and countdowns:** a consistent template per item, with variation in content; number on screen.
- **Time-lapse and hyperlapse** for passing time; **freeze frame + label** to introduce a person or moment.

## 13. Speed and time

- **Speed ramp** around an action peak (see §6). **Slow motion** for emotion or detail (needs high-frame-rate footage; don't slow 30 fps footage below ~60%).
- **Freeze frame** with a name, stat or callout (hold 1–2 s), then release.
- **Rewind** for "how did we get here" or a loop ending.
- **Retime graphics** to the music: big moves land on downbeats.

## 14. Colour and grade

- One consistent look across all shots; match exposure and white balance between cuts before styling.
- Protect skin tones. Push the look in the shadows and highlights, not the mids.
- Avoid the default teal-orange and crushed-black "cinematic" look unless the reference asks for it.
- Graphics follow the grade: if footage is warm, pure cold white type looks pasted on; tint whites slightly toward the palette.

## 15. Motion design principles

The 12 principles of animation, applied to graphics:
- **Timing:** small moves 3–6 frames, standard 8–15, large/full-screen 13–20 (see `motion-timing-and-easing`).
- **Easing:** ease-out to enter, ease-in to exit, ease-in-out to move. Never linear (except constant drifts and tickers). Strong curves (expo, quint) read as premium.
- **Anticipation:** a small opposite move (2–4 frames) before a big one.
- **Overshoot and settle** only for playful or energetic brands; not on premium or serious work.
- **Follow-through and overlap:** parts of an element finish at different times; nothing stops all at once.
- **Stagger / offset:** elements in a group start 2–4 frames apart, in reading order or from the motion's origin.
- **Arcs:** organic things move on curves, mechanical things in straight lines.
- **Squash and stretch** on bouncy, cartoonish elements only.
- **Secondary action:** a small supporting movement (a shadow, a line drawing) enriches the main one.
- **Choreography:** one main thing moves at a time; the eye can follow only one lead. Others wait or move subtly.
- **Direction logic:** things leave the way the next thing enters; transitions inherit the motion's direction.
- **Hold frames:** let a finished composition sit (at least 0.5–1 s) before the next move.

## 16. Sound

Read `SOUND.md` and the `sound-design` and `cutting-to-music` cards. Core habits:
- Lock music first for music-driven edits; cut and animate to its structure.
- Sound on motion: whoosh lengths match the move, hits on impacts, risers ending on reveals.
- **Silence before impact:** drop the music 4–12 frames before a big hit or line.
- Duck music 6–12 dB under voice; deliver at −14 LUFS (`ev export final`).
- Keep room tone under interview cuts; J/L cuts on dialogue.

## 17. Captions, branding and endings

- Captions for social: 2–5 words, 1–2 lines, bold sans, active word highlighted, inside safe zones (`social-vertical-captions`).
- Lower thirds for names and roles (`lower-thirds`) [LowerThird].
- **Logo:** at the start only if the brand is the hook; otherwise a short sting at the end (1–2 s). Respect brand colours and clear space.
- **End card:** CTA held 2–3 s on social; 5–20 s for a YouTube end screen.

## 18. Data and information in motion

- Build the frame first (axes, labels), then the data; one series highlighted, the rest muted.
- Count numbers up [Counter] and land them on a beat; use tabular figures.
- Annotate the one insight directly on the chart with a drawn callout [Callout]; don't make viewers read a legend.
- Sources in small type at the bottom when stating real data.

---

## Genre playbooks (starting points)

- **Trailer / hype:** cold open on a striking image; title cards as punctuation between shot runs; accelerate (ASL 2 s → 0.7 s); riser into a hard stop, silence, final hit; title and date last.
- **Title sequence:** one visual metaphor developed through the whole sequence; type integrated into the world (on objects, in space); restrained palette; music-led pacing.
- **Explainer / documentary short:** hook question; narration-led with a visual change every 2–4 s; archival or real photos with parallax; diagrams for mechanisms; maps for geography; real sources on screen; end on the insight (`finance-explainer-shorts` for the creator style).
- **Talking head / creator video:** punch-ins on emphasis, B-roll for every concrete noun, keyword pops, captions, pattern interrupts every 5–10 s, trim every breath and filler.
- **Product / brand ad:** problem in 2 s, product as the hero (push-ins, orbits, macro inserts), one benefit per shot, logo and CTA at the end (`premium-product-reveal`, `dark-saas-aurora`).
- **Social vertical reel:** payoff or hook in frame 1, captions, beat-cut, loopable end, everything in the safe area (`social-vertical-captions`, `family-moment-reels`).
- **Music video / montage:** cut to the music's structure, vary shot sizes per bar, match-on-action chains, speed ramps on accents.
- **Event / recap:** best moment first, faces and reactions over wide crowd shots, names in lower thirds, energy curve that peaks before the end, then a calm final image.
