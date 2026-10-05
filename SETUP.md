# Setting up Easy Video on a new Mac

For Claude Code: when the user asks to set up this repo (or after a fresh clone), follow these steps in order. Read `CLAUDE.md` and `README.md` first.

1. **Check prerequisites.**
   - Node >= 24. Scripts run `.ts` files directly with `node`. The original machine used v24.21.0.
   - git.
   - Xcode command line tools.
   - yt-dlp (`pip3 install --user yt-dlp`) so `ev reference <url>` can download reference videos. `ev reference` also finds it in `~/Library/Python/*/bin` if that isn't on PATH.

   If something is missing, give the user the exact install command. Don't use Homebrew ffmpeg; the project uses `ffmpeg-static`.
2. **Install dependencies.** Run `npm install`. `.npmrc` sets `legacy-peer-deps`. Make sure `ffmpeg-static`'s install script downloaded the binary: `node_modules/ffmpeg-static/ffmpeg -version` must work and must list the `scdet`, `select`, `tile`, `sidechaincompress` and `afftdn` filters.
3. **Install the Playwright browser.** Run `npx playwright install chromium`. The e2e tests need it.
4. **Create `.env`.** It's git-ignored. Add placeholder lines and ask the user to paste the keys in themselves. Never print or commit them.
   - `DEEPGRAM_API_KEY=`: voiceover and transcripts.
   - `FREESOUND_API_KEY=`: stock sounds (`ev sfx-find`).
   - `UNSPLASH_ACCESS_KEY=`: stock photos for the new-video pipeline. Only the Access Key is needed, not the Secret Key.
   - `GEMINI_API_KEY=`: voiceover (Gemini TTS; free key from aistudio.google.com). Deepgram stays as the fallback and for transcripts.
5. **Run checks.** Run `npm run typecheck` and `npm test`. Fix anything that's environment-related. Don't change the editor's behavior.
6. **Start the editor.** Run `npm run dev` in the background.
   - Confirm http://127.0.0.1:5173 loads.
   - Confirm a blank `project/` was created from `templates/project/`, with its own git repo and v0.
   - Run `npm run ev` to confirm the bridge CLI works.
7. **Run the e2e tests.** Run `npm run e2e` and look at `test-results/screens/`. The e2e tests must clean up after themselves.
8. **Save these preferences to memory:**
   - Never use the macOS `say` voice. Use Deepgram TTS with the user's key, or their own recordings. Sound effects come from `ev sfx`.
   - Use Playwright, not Claude-in-Chrome, for UI checks. E2E tests must clean up and must never touch the user's media, apply themes or create versions.
   - Video projects (`project/`, `projects/`) are not in this repo. Each new video starts with `ev project new "<name>"`.

Finish with a short report: what passed, what failed, and anything the user needs to do by hand.

## Bringing over existing videos

Video projects and media are git-ignored, so they don't come with the clone. To move one over, copy its folder (for example `projects/horro/`) into this repo's `projects/` folder by AirDrop or a drive. Then switch to it with `npm run ev -- project use <slug>` or from the editor's project menu.
