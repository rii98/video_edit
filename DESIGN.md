# Easy Video: design

> **Status (2026-10-03):** phases 1–5 are built and tested, plus audio (synthesized SFX, Deepgram voiceover, ducking, loudness).
> - Aspect-ratio variants are done by asking Claude to re-lay out the video, not with a button.
> - Subject cut-out and motion tracking remain future work.
>
> See README.md for usage.

A local video editor you run by talking. Claude Code in the terminal writes and edits the video as code, and a browser UI on localhost lets you point at the exact frame and spot you want to change.

---

## 1. Core idea

Video editing is hard to learn because you have to drive dozens of controls by hand: keyframes, curves, masks, tracks. Easy Video keeps only two inputs:

1. **Point.** Click a frame, and a spot or region inside it.
2. **Say.** Describe the change: "make this a split screen with the product shot," "slow this title down," "music should hit here."

Claude does the rest. It owns the project as **code**, so every edit is exact, repeatable, versioned, and undoable.

```
┌──────────────────────────┐   pinned request (JSON + snapshot)   ┌─────────────────────────┐
│  Browser UI (localhost)  │ ───────────────────────────────────▶ │  Claude Code (terminal) │
│  preview · click · say   │                                      │  reads, edits code      │
│                          │ ◀─────────────────────────────────── │  writes status          │
└──────────────────────────┘    hot reload (preview updates live) └─────────────────────────┘
              ▲                                                               │
              └──────────── project folder on disk (the single source of truth) ◀┘
```

There is no hosted backend and no API key. The UI and Claude only talk through files in the project folder.

---

## 2. Tech choices

| Concern | Choice | Why |
|---|---|---|
| Video engine | **Remotion** (React → video) | Claude is very good at writing React. Each scene is a component, and frame-accurate animation is just `useCurrentFrame()`. |
| Live preview | `@remotion/player` inside a Vite app | Previews in real time with **no render step**. Vite HMR shows Claude's edit within about a second. |
| Final export | `remotion render` (and `--frames=a-b` for a range) | You only pay render time when exporting. |
| Media analysis | ffmpeg/ffprobe, `whisper.cpp` (local transcripts), scene-cut detection, beat detection | Runs once per asset and is cached. Install with `brew install ffmpeg` (not on this machine yet). |
| Versioning | git, one commit per applied edit | Free undo, history, and "compare v7 vs v9". |
| UI ↔ Claude bridge | File inbox plus a tiny blocking `ev wait` CLI | Needs no API. Claude runs `ev wait` in the background and wakes when you submit an edit. |

> Licensing note: Remotion is free for individuals and small teams (≤3 people). Larger companies need a paid license. Motion Canvas (MIT) is the fallback if that ever matters.

---

## 3. Project layout

```
my-project/
  project.json            # meta: aspect, fps, duration, theme, music
  timeline.json           # scenes[] → layers[] with stable IDs, timings, props
  theme/tokens.json       # colors, fonts, easing curves, motion "tempo"
  scenes/
    S01_Intro.tsx         # one React component per scene
    S02_SplitDemo.tsx
  assets/
    raw/                  # user's originals (never modified)
    proxy/                # 720p proxies for fast preview
    analysis/             # transcripts, cuts, beats, contact sheets (cached)
  .ev/
    inbox/                # edit requests from the UI
    snapshots/            # PNG of the frame you clicked, with your pin drawn on it
    status.json           # "Claude is working on #12…" shown in the UI
    history.md            # human-readable log of every edit
```

**Every visible element carries an ID** (`data-layer="S02.headline"`). That ID is what turns "this thing I clicked" into "this line of code."

Global library, reused across all projects (`~/.easy-video/library/`):

```
techniques/   apple-product-reveal.md, kinetic-type.md, ui-screen-demo.md, ...
components/   SplitScreen.tsx, KineticTitle.tsx, LowerThird.tsx, DeviceMockup.tsx,
              CursorZoom.tsx, Captions.tsx, Counter.tsx, MaskReveal.tsx, ...
themes/       minimal-mono.json, warm-editorial.json, neon-tech.json, ...
music/        user-provided or royalty-free tracks + cached beat maps
```

---

## 4. The UI (kept small on purpose)

```
┌───────────────────────────────────────────────────────────────────────┐
│ Easy Video · launch-video        Theme: Warm Editorial ▾   [Export]   │
├─────────────────────────────────────────────┬─────────────────────────┤
│                                             │  Edit requests          │
│            PREVIEW (Remotion Player)        │  ● #12 split screen…  ⟳ │
│                                             │  ✓ #11 slower title     │
│         ✚ ← your pin (click anywhere)       │  ✓ #10 swap music       │
│                                             │                         │
│                                             │  Versions               │
│                                             │  v11 ◀ compare ▶ v12    │
├─────────────────────────────────────────────┴─────────────────────────┤
│ ▶ 00:04.12 / 00:30  │ [S01 Intro][S02 Demo     ][S03 Features][S04 CTA]│
│   music ▁▃▅█▅▃▁▃▅█▅▃▁ (beats marked)          ⟦ range ⟧                │
├───────────────────────────────────────────────────────────────────────┤
│ 📍 Frame 124 · S02.headline  │ "Make this a split screen with the     │
│ Scope: ○frame ●scene ○range  │  phone on the right, slide in on beat" │
│                               │                         [Send ⏎]      │
└───────────────────────────────────────────────────────────────────────┘
```

Interactions:
- **Click** the preview to pause there and drop a pin. **Drag** to draw a region box instead.
- **Hit-testing:** `document.elementsFromPoint` on the player DOM returns the layer IDs under the pin, shown as "S02.headline."
- **Scope:** this frame only, this scene, or a range dragged on the timeline.
- **Queue:** you can send several requests in a row. Claude works through them in order, and each one becomes a version.
- **Compare:** flip between two versions at the same frame.
- **Direct manipulation is limited to things that are faster by hand:** trimming a scene edge and nudging a timing. Everything else goes through natural language.

---

## 5. The edit loop

**1. You submit.** The UI writes `.ev/inbox/0012.json`:
```json
{
  "id": 12,
  "frame": 124, "time": 4.13,
  "pin": { "x": 0.42, "y": 0.31 }, "region": null,
  "hit": ["S02.headline", "S02.bg"],
  "scene": "S02",
  "scope": "scene",
  "prompt": "Make this a split screen with the phone on the right, slide in on beat",
  "snapshot": ".ev/snapshots/0012.png"
}
```

**2. Claude wakes.** It has been running `ev wait` in the background, which exits as soon as a request appears.

**3. Claude reads** the request, the snapshot (the frame with your pin drawn on it), and the scene's source. It then edits the scene and timeline code, reusing library components where it can.

**4. The preview hot-reloads.** You see the result in about a second, with no render.

**5. Claude verifies.** It renders 3–5 still frames around the edit, looks at them, and fixes anything off: overlaps, cropped text, contrast.

**6. Claude closes the request.** It commits ("#12 split screen S02"), updates `status.json` and `history.md`, and goes back to `ev wait`.

How this keeps each edit fast:
- Claude reads `timeline.json` plus **one** scene file, not the whole project.
- Footage is understood through cached transcripts and **contact sheets** (a grid of frames in one image), not hundreds of frames.
- The preview uses 720p proxies. Full-resolution media is only used at export.
- Only export renders video. Partial renders (`--frames`) are used for quick checks.

---

## 6. Starting a project: the "creative director" intake

Run `ev new` (or just tell Claude "new project") and drop files in.

**Step 1: Ingest and analyze (automatic).**
- Probe each file: length, resolution, fps.
- Transcribe speech.
- Detect cuts and pick the best shots.
- Detect music beats.
- Build a contact sheet.

Claude then tells you what it sees. For example: "You have 2:10 of screen recording, 3 product photos, and a voiceover that runs 48s."

**Step 2: Brief.** Claude asks a few sharp questions, the way a senior editor would:
1. Goal and where it will be posted (launch, ad, explainer, social), which sets aspect ratio and length.
2. Audience, and the one thing they should remember.
3. Feel, picked from visual references rather than adjectives: *calm/premium*, *playful/bouncy*, *bold/kinetic*, *warm/editorial*, *technical/precise*.
4. Pacing (slow and confident vs. fast cuts) and the music mood.
5. Must-haves: logo, call to action, captions, brand colors and fonts.

**Step 3: Three treatments.** Claude proposes 3 distinct directions. Each one is shown as **real rendered style frames plus a 3-second motion test**, not a text description. Each includes:
- Type, color, and motion grammar (easing, speed, transitions).
- A scene-by-scene outline, synced to the voiceover or beats.
- Which techniques it borrows, and why they fit this brief.

**Step 4: Pick and build.** You choose one, or mix them ("A's typography with C's pacing"). Claude builds v1, and you switch to the point-and-say loop.

---

## 7. Research and style library (do it once, reuse forever)

The first time a style is needed, Claude researches it on the web: talks, breakdowns, frame-by-frame analysis of well-known launch and brand films (Apple, Figma, OpenAI, Anthropic, Stripe, Linear, motion studios, VFX breakdowns). It distills each into a **technique card**:

```markdown
# Product hero reveal (Apple-style)
Signature: dark field, single light source, slow push-in, product rotates ~15°.
Timing: 1.2–2s moves, ease cubic-bezier(0.22, 1, 0.36, 1); no bounce.
Type: large tight-tracked headline, one line, fades up 12px.
Transitions: match cuts on shape; hard cuts on beat for energy sections.
When to use: premium hardware/software launches, calm confident tone.
Avoid: busy backgrounds, more than one idea per shot.
Component: components/HeroReveal.tsx  ·  Sources: [links]
```

Cards and components live in the global library, so **project #10 is much faster and better than project #1**. Themes are just token files. Switching "Warm Editorial" to "Neon Tech" re-skins the whole video, because scenes read tokens instead of hard-coded colors.

Cards record the *principles* (timing, composition, typography), not copies of anyone's footage or brand assets.

---

## 8. Audio: music, sound effects, voice

Rule: **use the best source for each layer, and let Claude do the editing and mixing.** Claude is weak at composing music from scratch but strong at cutting, timing, placing and mixing audio as code.

### Where each layer comes from

| Layer | Primary source | Fallbacks |
|---|---|---|
| **Music** | You provide a licensed track, or generate one in an AI music tool and drop the file in | Local generation (MusicGen / Stable Audio Open); a curated royalty-free library in `~/.easy-video/library/music` |
| **Sound effects** | **Default: Claude synthesizes them as code** (whoosh, click, pop, riser, hit, glitch, swoosh, UI ticks), tuned to the scene and the music key/tempo | You override a specific SFX only when you want to, by dropping in your own file. CC0 packs and Stable Audio Open are extras |
| **Voiceover** | Your own recording, or **a cloud TTS provider using your API key** (Deepgram Aura first; any provider fits behind the same adapter) | A voice you supply: your own clips or a voice ID from your provider. Voice cloning only with the voice owner's consent |

**Never use the macOS `say` voice.** It sounds robotic and is not acceptable even for drafts.

**TTS setup:**
- Your provider key lives in `.env` (for example `DEEPGRAM_API_KEY=...`). `.env` is git-ignored and never printed or committed.
- A small `ev tts` script takes a script line, a voice and a provider, and writes `assets/voice/<id>.wav`.
- It caches by text and voice, so re-runs don't re-bill. When you change a line, only that line is regenerated.
- Word timings (from the provider, or from the transcription step) drive captions and cut timing.

The app itself still has no backend or API of its own. The only outside calls are the TTS requests you choose to make with your key.

### What Claude does with audio (the senior-editor part)

1. **Analysis** runs once and is cached in `assets/analysis/`. It detects beats, **bars and downbeats**, song sections (intro / build / drop / outro) and loudness, and transcribes the voiceover with word timings.
2. **Music-first editing.** For music-driven videos, the track is locked first and picture cuts land on downbeats. Big reveals land on section changes, not on random beats.
3. **Fitting music to length.** Music is cut or looped only at bar boundaries, and the ending is built so the last hit lands on the logo, instead of fading out mid-phrase.
4. **Sound design layered on the visuals.** Each animation event (from the timeline) can trigger an SFX:
   - transition → whoosh
   - reveal → riser + hit
   - screen demo → UI clicks
   - text pop → soft tick

   Restraint matters. Claude keeps a "SFX density" knob in the theme (*none / subtle / punchy*).
5. **Silence before the hit.** Claude drops music for 0.3–0.8s before a key moment, a classic trailer move.
6. **Mixing.** Music ducks under the voice automatically (sidechain, about −12 to −18 dB). Speech gets cleanup (ffmpeg `afftdn` / RNNoise denoise, EQ, light compression). J/L cuts let audio lead or trail the picture.
7. **Stems.** If a song has vocals that clash with the voiceover, Demucs (local) splits it into stems so Claude can keep only drums and bass under the speech.
8. **Loudness targets at export** (`ffmpeg loudnorm`): about −14 LUFS for social and YouTube, with true peak ≤ −1 dBTP.

### Audio in the UI and the edit loop

- The timeline shows separate tracks for **Music / SFX / Voice**, with beat and bar markers. Every clip has an ID (`A.music`, `A.sfx.S02.whoosh`).
- Clicking a waveform pins a request just like clicking a frame: *"music is too busy under this sentence," "add a hit when the logo lands," "make the voice warmer," "swap to a calmer track from here."*
- **Music swap** is one prompt. Claude re-analyzes the new track and re-times cuts to its beats.
- Audio is declared in `timeline.json` and rendered by Remotion's `<Audio>` with volume curves, so every audio change is versioned like any other edit.

### Licensing

Use only music and SFX you have rights to: your own, CC0 or royalty-free with a license you've checked, or generated by a tool whose terms allow commercial use. The library stores the license and source with each file.

---

## 9. What's in scope (enough for a normal person)

| In scope | Not in scope (on purpose) |
|---|---|
| Cuts, trims, reorder, speed ramps | Multicam, pro color grading panels |
| Kinetic text, titles, captions, lower thirds | Node compositing |
| Split screen, picture-in-picture, device mockups | Manual keyframe curve editors |
| Zoom/pan on screen recordings, cursor highlights | Audio mixing console |
| Transitions, mask reveals, shape and graph animation | Plugin ecosystem |
| Music swap, beat-synced cuts, auto-ducking under voice | |
| Themes, brand kit, aspect-ratio variants (16:9 / 9:16 / 1:1) | |
| Versions, compare, undo, export MP4/MOV/GIF | |

Later, harder add-ons: subject cut-out (SAM-style segmentation), motion tracking to stick text onto moving objects, AI B-roll generation.

---

## 10. Build plan

| Phase | Deliverable | Rough size |
|---|---|---|
| **1. Core loop** | Remotion project template, Vite UI with player, click-to-pin, hit-testing, inbox, `ev wait`, git versioning | small: a few sessions |
| **2. Ingest** | ffmpeg proxies, transcript, cut and beat detection, contact sheets | small |
| **3. Library v1** | ~12 components, 5 themes, ~10 technique cards | medium |
| **4. Intake** | Brief questions, 3-treatment style frames, project generator | medium |
| **5. Polish** | Compare view, range scope, aspect variants, export presets, CLAUDE.md + skills that encode the workflow | small |

The workflow rules (how to read requests, verify with stills, commit, keep context small) go in `CLAUDE.md` and project skills. That way any Claude Code session that opens the folder already knows the job.
