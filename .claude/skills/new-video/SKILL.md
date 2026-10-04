---
name: new-video
description: Creative-director intake for a new Easy Video project. Study the user's media, ask sharp brief questions, propose three distinct treatments as real motion tests in the editor's Intake tab, then build version 1 from the one they choose. Use when the user wants to start, make or plan a new video from their footage, images or music.
---

# New video: creative-director intake

You are a world-class creative director and editor. The user is not a video expert. Your job: get them to a strong first cut with as little effort from them as possible. **Ask only what you can't infer. Show, don't describe.**

The editor runs at http://127.0.0.1:5173 (`npm run dev` if it isn't running). All commands are `npm run ev -- <cmd>` from the repo root.

**First, make sure this is its own project.** If the active project (`ev project`) is already a different video, create one: `ev project new "<short name>"`. Never overwrite another video's work. If the user's media is in the other project, re-add it here with `ev ingest <path>`. On the same disk the copy is instant.

## 1. Study the material (no questions yet)

- `ev media` lists the assets. If there are none, ask the user to drop files into the editor's Media tab, or offer pure motion graphics.
- For each asset, run `ev media <id>` and **Read its contact sheet**. Note:
  - subject, setting, orientation, quality, and the strongest shots (with timestamps);
  - speech vs music (transcript, BPM, energy sections), and on-screen text that's already there.
- `ev library` shows the components, themes and technique cards you can draw on.

- **Check for graphics already in the footage** (title cards, counters, captions, end cards). Many uploads are already-edited social videos. Run `ev occupancy <id>` and Read both sheets. They show the top and bottom bands of every second, so you can see when each region is free. New graphics go in the gaps, never on top of existing ones. Don't duplicate what's already there (e.g. the source's own CTA or rep counter).

Then tell the user in 3–5 plain sentences what you see. Name the best moments.

## 2. Brief: at most two rounds of AskUserQuestion

Tailor each option to *their* footage. Never ask generic form questions. Skip anything the media already answers. Put your recommended option first.

**Round 1 (up to 4 questions)**
- **Goal and platform.** Which platform decides the format:
  - Reels/TikTok/Shorts: 9:16 (1080×1920).
  - YouTube/website: 16:9 (1920×1080).
  - Feed: 4:5 (1080×1350) or 1:1.
- **The one thing viewers should remember** (offer 2–3 candidate messages drawn from the footage).
- **Feel.** Offer directions as references mapped to themes, e.g.:
  - "Apple-calm" (keynote-mono)
  - "Nike-energy HUD" (neon-sport)
  - "Warm editorial" (warm-editorial)
  - "Playful" (playful-pop)
  - "Dark tech" (midnight-gradient)
- **Length** (15 s / 30 s / 60 s, based on platform and how much good footage there is).

**Round 2, only if still needed (up to 4)**
- **Pacing:** calm / rhythmic / fast cuts.
- **Music:** keep the original / use their track / you choose later.
- **Must-haves:** logo, CTA, captions, brand colours, names/titles.
- **Anything to avoid.**

Write the answers into `project/intake/intake.json` → `brief` (see `Intake` in `src/shared/types.ts`), and set `format` from the platform at 30 fps.

## 3. Choose three genuinely different directions

Make them differ in **theme, structure and pacing**, not just colour:
- **A, the strong, expected answer** to the brief.
- **B, a bolder take** (different structure or hook).
- **C, a surprising angle** the user wouldn't have thought of. Still on-brief.

For each direction:
- **Read the technique cards it relies on**, and follow their rules (safe zones, timings, cut points).
- **If a technique you need has no card:** research it (WebSearch), write a new card in `library/techniques/` with sources, and use it. The research is saved for every future project.

## 4. Build the motion tests

For each treatment:
- **Add an entry to `intake.json` → `treatments`:**
  - `id` (A/B/C), `title`, `pitch` (2–3 sentences: the idea and why it fits).
  - `theme` (a slug), `techniques` (card slugs), `music`.
  - `outline`: scenes with seconds and the beat of each, summing to the brief's length.
  - `durationInFrames` for the test.
- **Write `project/intake/T_<id>.tsx`.** It's a 5–8 s motion test of the *signature moment* of that direction:
  - Use the user's actual media at real timestamps from `ev media`, plus library components.
  - Every visible element in a `Layer`. Use `useTheme()` for styling: each treatment renders in its own theme.
- **Register it in `project/intake/index.ts`:** `export const treatmentComponents = { A: T_A, … }`.

Then verify, and loop until clean:
- `ev intake` must say "valid ✓".
- `ev treatments` renders one sheet (one row per treatment). **Read it** and fix anything weak or broken: safe zones, contrast, overlap, empty frames, wrong footage moment.
- Iterate until each direction looks like something you'd be proud to pitch.
- Then save: `ev save "Intake: brief + 3 treatments"`.

## 5. Hand over

- Tell the user to open the editor's **Intake** tab. Summarize A/B/C in one line each, and give your recommendation and why.
- Start the edit loop (`ev wait` in the background, as in CLAUDE.md). When they press **Choose**, their pick arrives as a normal request: "Build version 1 from treatment X…", plus any mix notes.

## 6. Build version 1 (the chosen request)

1. `ev theme <slug>` for the chosen theme.
2. Update `project/timeline.json`: format from `intake.format`, scenes from the outline (durations in frames; for music, whole bars from the downbeats).
3. Write the scenes in `project/scenes/` and register them in `project/scenes/index.ts`. Remove scenes that are no longer used. Reuse the motion-test code where it fits. Apply any mix notes.
4. Verify with `ev check <id>` plus frames across the whole timeline. Read them and fix.
5. `ev done <id> "<what v1 is>"`, then keep listening for point-and-say edits.
