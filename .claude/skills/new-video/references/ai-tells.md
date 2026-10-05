# Avoiding AI tells, and the final QA pass

Viewers can smell a generated video in two seconds. These are the tells, and what a senior designer does instead. Read this before building the treatments and run the checklist before every hand-over.

## Visual tells

| Tell | Do instead |
|---|---|
| Everything centred, every scene the same layout | A grid and a placement system; vary composition between scenes on purpose (centred for titles, thirds for story) |
| Purple-blue gradients, glowing blobs, glassmorphism cards on dark | A palette from the brand, the footage or the reference; flat colour or real texture; gradients only with grain and a reason |
| Inter/Poppins/Montserrat at one weight, everywhere | A deliberate pairing with character; real hierarchy (2–3× size contrast, weight contrast) |
| Generic icons and emoji as decoration | One icon set with consistent stroke, used only when it carries meaning; real images over icons |
| "Futuristic HUD" lines and dots that mean nothing | Every graphic element encodes information or guides the eye |
| Stock-photo clichés (handshake, lightbulb, glowing brain, robot hand) | The specific real thing, or a designed visual metaphor |
| Blurry or upscaled images, mismatched image styles | Sources at ≥ 2× display size, one treatment across a sequence (see `assets.md`) |
| Fake screenshots, invented logos, AI faces of real people | The real thing, credited |
| Flat, layerless frames | Foreground / midground / background, parallax, soft shadows, grain |
| Text walls and bullet-point slides | One idea per screen, few words, big type; let the voice carry detail |
| Cramped margins, text in UI zones | 5–10% margins, safe zones (social: central ~900×1400) |

## Motion tells

| Tell | Do instead |
|---|---|
| Every element fades up from 20 px with the same duration | One animation family per hierarchy level; varied durations by distance and size |
| Everything moves at once | Choreography: one lead, followers staggered 2–4 frames, hold frames between moves |
| Linear or default easing; springy overshoot on everything | Strong ease-out/in-out curves from the theme; overshoot only for playful brands |
| Constant motion with no rest | Holds of 0.5–1 s after a composition lands; stillness before a big moment |
| Random transitions (glitch, zoom, spin) in one video | One or two motivated transition families (see playbook §7) |
| Camera drift on every shot for no reason | Motivated moves only; static is a choice too |
| Animation not tied to sound | Big moves on downbeats, type on the spoken word, SFX on landings |
| Ken Burns zoom on every still at the same speed | Vary direction and scale by content; parallax cut-outs for hero stills |

## Writing tells

Covered in `writing.md` §4: no "unlock / elevate / seamless / game-changer / dive in / in today's fast-paced world", no triple rhetorical questions, no vague claims. Specific, sourced, spoken.

## Sound tells

- Stock "corporate inspiring" ukulele or piano under everything → music chosen for the specific feel, cut to its structure.
- A whoosh on every move, all at the same level → sound only on meaningful moves, matched in length, mixed under the voice.
- Robotic TTS read flat → a natural voice (`ev tts` with a fitting Deepgram voice), script punctuated for pauses and emphasis. Never macOS `say`.

## Final QA checklist (before `ev done`)

Render frames across the whole timeline (`ev check`), plus bursts around every transition and type animation. Go through:

**Story**
- [ ] The first frame is interesting with sound off; the hook lands by 3 s.
- [ ] Each scene has one idea; the order escalates; the ending lands and is held long enough.

**Pacing**
- [ ] ASL fits the genre (playbook §2) and varies; holds after reveals.
- [ ] Cuts are motivated (beat, action, word); none land mid-word or mid-gesture by accident.

**Type**
- [ ] Two families max; hierarchy is obvious at a glance; one emphasis treatment.
- [ ] Every text is on screen long enough to read twice; line breaks follow meaning.
- [ ] Spelling of every name, title and number checked against `research.md`.
- [ ] Sizes meet the minimums (playbook §8); nothing in a safe-zone violation.

**Image**
- [ ] No soft, watermarked, stretched or mismatched images; logos correct and unmodified.
- [ ] Contrast ≥ 4.5:1 for all text; nothing overlaps or clips unintentionally.
- [ ] Depth: no frame is a flat stack of centred elements unless it's a deliberate minimal title.
- [ ] Graphic system is consistent: radius, stroke, colour, placement.

**Motion**
- [ ] Easing everywhere; one lead per moment; staggered groups; holds between moves.
- [ ] Transitions are one or two families, 6–20 frames, motivated, with sound.
- [ ] Camera moves are motivated and eased; momentum matches across cuts.

**Sound**
- [ ] Music edits on bar lines; voice clear over music (ducked); SFX on the right frames.
- [ ] Silence or a drop before the biggest moment.

**Integrity**
- [ ] Every external asset is in `credits.md` with its licence.
- [ ] Every fact on screen has a source; no invented quotes or numbers.
- [ ] `npm run typecheck` passes.

If any box fails, fix it before hand-over. If a fix needs the user's call, `ev ask` with the options.
