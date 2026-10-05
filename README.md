# Easy Video

Edit video by pointing and talking. Click a moment in the preview, describe the change, and Claude Code (in your terminal) edits the video's code, checks its work, and saves a version. There are no editing skills to learn.

Everything runs locally. The only outside calls are optional Deepgram requests with **your** key, for transcripts and voiceover.

## Quick start

```bash
npm install
npm run dev            # editor at http://127.0.0.1:5173
```

Then, in Claude Code in this folder:
- **"make a video from my media"**: add files in the editor's **Media** tab first. Claude studies them, asks a few questions, and proposes three directions in the **Intake** tab.
- **"start listening"**: Claude waits for your edits. In the editor, click (or drag a box) on the preview, type what you want, and press Enter.

Optional, for transcripts and voiceover:
```bash
echo 'DEEPGRAM_API_KEY=your_key' >> .env    # .env is git-ignored
```

## What you can do in the editor

| | |
|---|---|
| **Projects** | Each video is its own project (top-bar menu: switch, or **+ New project**), with its own media, versions and exports. |
| **Point and say** | Click a spot to pin it, or drag a box. Scope the change to this moment, the scene, a timeline range (**Shift+drag** the timeline), or the whole video. |
| **Watch it happen** | The preview hot-reloads as Claude edits. The status pill shows what Claude is doing. |
| **Talk it through** | Each request has a thread. Claude asks when unsure (quick picks, or rendered alternatives to click). You can reply to tweak ("good, but slower") or ask why. Guesses are flagged ("I assumed…") with a one-click **Wrong guess? Undo** that reverts just that edit. |
| **Versions** | Every edit is a version. **Compare** any version side by side at the playhead, or **Restore** it. Restores are versions too, so nothing is lost. |
| **Media** | Drag files anywhere in the window. They get preview copies, shot detection, contact sheets, loudness, beats (music) and transcripts (speech). |
| **Tracking** | Claude can track the person in your footage (face, hands, body, a cut-out mask), so words can sit behind you, float from your hands, glow around you, and a vertical crop can follow you like a camera operator. |
| **Intake** | The brief plus three directions as real motion tests with your footage. Choose one, or describe a mix. |
| **Library** | Themes (preview live, apply in one click), animated components, synthesized sound effects, and researched technique cards. |
| **Export** | Final (original media, loudness-normalized to -14 LUFS) or Draft (half size, fast). Download from the sidebar. |

Keyboard: Space plays and pauses, ←/→ step a frame (Shift: 10 frames), Esc clears the pin and range, Enter sends.

## How it works

- The video is a [Remotion](https://www.remotion.dev) project in `project/`: `timeline.json` plus one React component per scene. Every visible element carries an id, which is how a click maps to code.
- The editor (Vite + React) and Claude communicate only through files in `project/.ev/`. Claude's side is the `npm run ev` CLI (`npm run ev` lists commands).
- `project/` is its own git repo: one commit per edit. Media (`project/media/`) is never versioned.
- Workflow rules for Claude are in `CLAUDE.md`. The creative-director process is the `new-video` skill in `.claude/skills/`. The full design is in `DESIGN.md`.

## Development

```bash
npm run typecheck
npm test          # unit tests (DSP, analysis, library, git safety, export, sound)
npm run e2e       # Playwright drives the real editor
```

Note: Remotion is free for individuals and small teams. Larger companies need a [Remotion license](https://www.remotion.dev/license).
