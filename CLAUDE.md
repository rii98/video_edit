# Easy Video

A natural-language video editor. The user points at frames in the browser UI and describes changes. You (Claude Code) make them by editing the video's code. See `DESIGN.md` for the full vision.

- **Fresh clone / new machine** (no `node_modules/` or no `project/`): follow `SETUP.md` first.
- `npm run dev`: the editor UI at http://127.0.0.1:5173. The user usually has it open.
- `npm run ev -- <cmd>`: your side of the bridge. Run `npm run ev` alone for help.
- `npm run typecheck`: run it after non-trivial edits.
- `npm run render`: final export to `project/out/video.mp4`.

## ffmpeg

Use the project-local full build from `ffmpeg-static`:
- In code: `require('ffmpeg-static')` / `import ffmpegPath from 'ffmpeg-static'`.
- Path: `node_modules/ffmpeg-static/ffmpeg`.

Things to avoid:
- Homebrew has no bottle for this macOS (14).
- Remotion's bundled ffmpeg lacks `scdet`, `select`, `tile`, `sidechaincompress` and `afftdn`.

There is no ffprobe. For media metadata, use `getVideoMetadata` / `getAudioDurationInSeconds` from `@remotion/renderer`.

## Layout

| Path | What |
|---|---|
| `project/timeline.json` | Scene order, durations (frames) and transitions. The source of truth for timing. |
| `project/scenes/S##_Name.tsx` | One component per scene. It uses scene-local frames (`useCurrentFrame()` starts at 0). |
| `project/scenes/index.ts` | Scene registry. Every timeline id must be registered here. |
| `project/theme/tokens.json` | Colors, fonts, easing, tempo. |
| `src/video/kit.tsx` | `Layer`, `theme`, `ease`, `useProgress`, `useFadeUp`. Scenes use these. |
| `project/.ev/` | Bridge state (requests, snapshots, status). Never edit by hand. Use `ev`. |
| `src/ui`, `server`, `scripts` | The editor app itself. Only change these when the user asks for a tool change. |

`project/` is its own git repo. Each finished edit becomes one commit (a "version"). Do not commit there yourself. `ev done` does it.

## The edit loop

When the user says "start listening" (or similar), do this loop until they say stop:

1. Run `npm run ev -- wait` **in the background** (`run_in_background: true`). It exits when the user sends a request and prints a briefing: prompt, scope, frame, scene and local frame, pin in pixels, and the clicked layers with `file:line`.
2. `npm run ev -- snap <id>`, then Read the PNG. It shows the frame with the user's pin or region drawn in red. Always look before editing.
3. Edit the scene file and/or `timeline.json`. Use `npm run ev -- status "<short note>"` to tell the UI what you're doing during longer edits.
4. Verify:
   - `npm run ev -- check <id>` renders frames around the edit. Read them and fix anything off: overlap, clipping, contrast, layout.
   - Add explicit frames (`check <id> 40 80`) when the change is about motion over time.
5. `npm run ev -- done <id> "<one line, user-facing: what changed>" [--assumed="…"]` commits a version. If you need the user to decide, use `ev ask` (see below). If you can't do the edit, use `npm run ev -- fail <id> "<why + what would work>"`.
6. Go back to step 1 immediately. If several requests are queued, `wait` returns the next one at once.

Scope semantics:
- `frame`: change things around this moment only.
- `scene`: across the pinned scene.
- `video`: everywhere, including theme tokens.

### Ask, assume, or just do it

Every request has a **thread** in the editor. The user can answer you, tweak ("good, but slower") or ask "why?" there without pointing again. Use it like a good editor would:

- **Clear request:** just do it, then `ev done <id> "<summary>"`.
- **Ambiguous, but a wrong guess is cheap** (easy to see, quick to redo):
  - Do the most reasonable reading.
  - **Always record the guess:** `ev done <id> "<summary>" --assumed="<what you assumed>"`. The editor highlights it and offers "Wrong guess? Undo".
- **Ambiguous, and a wrong guess would waste time** (big or slow edits, two equally likely targets, taste calls):
  - **Ask instead:** `ev ask <id> "<short question>" --choices="A|B|C"`.
  - For visual choices, show alternatives:
    1. Make variant A and run `ev still <frame> --name=alt-a`.
    2. Make variant B and run `ev still <frame> --name=alt-b`.
    3. Revert to the original.
    4. Run `ev ask <id> "Which?" --images=project/.ev/snapshots/alt-a.png,project/.ev/snapshots/alt-b.png --labels="A|B"`.
  - Then go straight back to `ev wait`. Other requests keep flowing, and the answer arrives as a reply.
- **Replies** arrive through `ev wait` with the whole thread in the briefing. Act on the **last** message, with the original pin, frame and layers as context:
  - an answer → do the edit;
  - a tweak → edit again (a new version);
  - a question ("why…?") → `ev reply <id> "<answer>"`, with no edit.
- If a thread message asks for something outside the video (a feature in the editor, setup, research), reply that it belongs in the terminal conversation, rather than doing big work from a side channel.
- Keep questions to one line, answerable in a click. Never ask what the pin, layers or a still already tell you.

## Scene rules

- **Every visible element is wrapped in `<Layer id="kebab-name">`.** Ids are stable: never rename one the user may have pointed at. New elements get new ids.
- Use `theme.*` tokens for color and font. Never hard-code a new color, unless the user asked for that specific color.
- Animate with `useProgress` / `useFadeUp` / `interpolate` + `ease.*`. Avoid CSS transitions and animations: they don't render frame-accurately.
- Durations live in `timeline.json`. Scene timing math uses scene-local frames. `fps` is 30 unless the timeline says otherwise.
- A new scene needs:
  - a file named `S##_Name.tsx`,
  - an entry in `scenes/index.ts`,
  - an entry in `timeline.json`.
- Keep scenes self-contained and readable. Edits must stay surgical, because the user is iterating.

## Media

The user adds media in two ways:
- In the editor's Media tab (drag and drop anywhere). Analysis runs automatically.
- By giving you a path: `npm run ev -- ingest <file|dir>`.

Files live in `project/media/`, which is not in git. Scenes refer to media **only by asset id**.

Commands:
- `npm run ev -- media`: one line per asset. **Start here.** It is cheap on tokens.
- `npm run ev -- media <id>`: shots with times, the contact sheet path, loudness and silent gaps, BPM/downbeats/energy sections, and the transcript.
  - Read the sheet image to see footage. Each tile is a shot's middle frame, labelled with its timestamp.
  - Don't extract frames yourself unless the sheet isn't enough.
- `npm run ev -- analyze <id> --redo=<step>`: re-run a step, e.g. `--redo=transcript` after the user adds a Deepgram key.

In scenes (from `src/video/kit`):
- `<Footage id from={s} to={s} />` for video,
- `<Picture id />` for images,
- `<Music id from={s} volume={…} />` for audio.

Rules:
- Wrap each one in a sized `<Layer>`.
- Preview and snapshots use 720p proxies automatically; `npm run render` uses the originals.
- Cut on downbeats from `media <id>` when there's music.
- Trim dead air using the silent gaps.
- Cut on utterance boundaries from the transcript.

## Projects

Each video is its own project, with its own scenes, intake, media library, version history and exports. **The active project always lives at `project/`**, so every path in this file means "the active project". Inactive projects wait in `projects/<slug>/`.

- `ev project` lists projects.
- `ev project new "<name>"` creates one (from `templates/project/`) and switches to it.
- `ev project use <slug>` switches. The user can also switch in the editor's top-bar menu.
- Switching swaps folders and restarts the editor. It's refused while media is being analyzed, an export runs, or a request is being worked on.
- If the user switches while you're listening, `ev wait` exits with code 3 and says so. Run it again to listen in the new project.
- For a **brand-new video**, create a new project first (unless the active one is the blank starter), so the previous video stays untouched.

## Starting a new video (intake)

When the user wants to make a new video, from their own footage or from scratch from an idea, use the **`new-video` skill**. It runs the full pipeline:
1. Study the material, and break down any reference video.
2. Brief, then research inspiration, craft and facts.
3. Three treatments as motion tests in the editor's Intake tab. Their choice arrives as a normal request.
4. Script, storyboard, real sourced assets, build, then a senior QA pass.

Its reference files (`.claude/skills/new-video/references/`) hold the craft playbook, research sources, asset sourcing and the AI-tell checklist.

Commands:
- `ev intake` validates the treatments.
- `ev treatments` renders them all to one sheet.
- `ev save "<msg>"` commits work that happens outside a request.
- `ev reference <file|url>` breaks down someone else's video shot by shot (in · mid · out frames, an even strip, pacing numbers). It's for study only and is not imported. URLs need `yt-dlp`.

## Library (components, themes, techniques)

- `npm run ev -- library`: every component (with usage), theme and technique card. Run it before designing a scene.
- **Read the technique card** (`library/techniques/<slug>.md`) before applying a style. Cards hold researched rules with numbers: timing, safe zones, cut points.
- Components:
  - Import from `'../../library'`, e.g. `KineticTitle`, `LowerThird`, `Captions`, `SplitScreen`, `DeviceFrame`, `ZoomPan`, `RingCounter`, `Badge`, `Callout`, `BeatPulse`, `AuroraBackground`…
  - Each takes an `id` and becomes a clickable Layer, so the usual id rules apply.
  - Prefer them over hand-rolled equivalents.
- Themes:
  - `npm run ev -- theme <slug>` applies a preset (and creates a version).
  - In components use `useTheme()`; in scenes `theme` is fine.
  - Change `tempo` to change the whole video's feel.
- Adding a reusable component:
  - Add the component, a `catalog.ts` entry, a `demos.tsx` demo and a `demo-frames.ts` frame. `npm test` enforces this.
  - Check it visually with `npm run ev -- demo <Name> --theme=<slug>`.
  - After touching shared components, run `npm run ev -- demo all`. It renders one labelled sheet, cheap to look at.
- New research becomes a new card (same frontmatter: title, summary, components, themes; with `## Rules` and `## Sources`).

## Tests

- `npm test`: unit tests (beat tracking, probe parsing, library consistency).
- `npm run e2e`: Playwright drives the real editor. **Use Playwright for UI checks**, and look at `test-results/screens/`.
- e2e tests share the live project:
  - They must delete what they create.
  - They must never apply themes or create versions.

## Audio

Before adding or changing any sound effect, read `SOUND.md`.

- **Sound effects:** `ev sfx <whoosh|riser|hit|click|pop|shimmer|all> [--seed=N] [--seconds=S]` synthesizes effects into the media library (no sample packs). Use them with `<Sfx id at={frame} />`. Read the `sound-design` card for timing.
- **Stock sounds:**
  - `ev sfx-find "<query>" [--min=S --max=S] [--sort=…] [--limit=N]` searches Freesound, CC0 only by default. `--similar=<id>` finds more like one.
  - `ev sfx-get <id>...` imports: trimmed, -1 dBFS, licence recorded. It prints `at={frame - N}` so the sound's peak lands on `frame`.
  - `ev sfx-credits` lists credits for any non-CC0 sound in use. Needs `FREESOUND_API_KEY` in `.env`.
  - New providers implement `SoundSource` in `server/media/sources/` and register in its `index.ts`.
- **Voiceover:** `ev tts "<text>" --voice=<Name> [--style="…"]` uses Gemini 3.8 Flash TTS (the user's free `GEMINI_API_KEY`), and falls back to Deepgram Aura-2 when Gemini isn't available.
  - `"[[style]] text [[style]] text"` gives several deliveries in one request. The text is spoken verbatim; styles are never spoken. Inline tags like `<short pause>` and `<chuckle>` work.
  - The quota is about 100 requests a day per key. A ledger in `.cache/` caps use at 90 and throttles to 8 a minute. Cache hits cost nothing. Use one request per scene, generate only once the script is locked, and check with `ev tts --usage`.
  - Cast the voice to the content: `ev tts --voices` and the skill's `references/voice-casting.md`.
  - Every new take is transcribed for word timings and checked against the script.
  - Use `<Voiceover id at />`, and `<Captions assetId={voiceId} offset={-at/fps} />` for captions.
  - **Never use the macOS `say` voice.** Never print or commit keys.
- **Ducking:**
  - `<DuckedMusic id voiceId voiceAt />` for music.
  - `useDuckVolume(voiceId, { voiceAt })` as `volume` on `<Footage>` whose own soundtrack should dip.
  - The default dip is about -8 dB.
- **Delivery:** `ev export final` renders the original media and normalizes to -14 LUFS (two-pass).

## Polish tools

- `ev export [final|draft]`: final = original media plus loudness normalization; draft = half size, fast. The editor's **Export** menu does the same, with progress and a download link.
- **Range requests:** the user Shift+drags the timeline. Requests with scope `range` carry `range: {start, end}` (global frames), and `ev check` defaults to start, middle and end of the range.
- **Compare:** the editor's Versions → Compare renders any version next to the current one at the playhead (scratch workspace in the OS temp dir).
- `ev occupancy <id>`: where already-edited footage has its own graphics, per second. Check it before placing titles, captions or CTAs on uploaded edits.
- `ev remove <id>` (or Media → Remove) deletes an asset. It refuses while scenes or treatments use it.
