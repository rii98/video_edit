---
title: Social vertical captions and safe zones
summary: 1080x1920. Keep text inside the ~900x1400 cross-platform safe area. Captions 2-5 words, 1-2 lines, bold sans 60-90 px, word highlight, placed above the bottom UI band.
components: Captions, KineticTitle, Badge
themes: neon-sport, playful-pop
---
# Social vertical captions and safe zones

## Frame and safe zones (1080×1920)
- **TikTok:**
  - Top ~150 px: username and music label.
  - Bottom ~350 px: caption, hashtags and buttons.
  - Right edge: like/comment/share icons.
- **Instagram Reels:** the bottom UI band is ~250 px.
- **YouTube Shorts:** a lighter overlay; bottom ~250 px.
- **The common safe area is about 900×1400, centred.** Put every critical element (text, faces, logos, CTAs) inside it.

## Rules
- **2–5 words per block, 1–2 lines, never 3.** `maxWords={4}` is the default.
- **Bold sans, 60–90 px letter height** on 1080×1920. Display themes with condensed caps (`neon-sport`) read especially well.
- **Highlight the spoken word** (karaoke style). It keeps eyes on the text and holds attention.
- **Break at natural pauses and punctuation**, not mid-phrase. The component does this from transcript word timings.
- **Placement:** the lower-middle third, above the bottom UI band. The component puts vertical captions at 26% from the bottom.
- **Contrast:** a light text shadow or a pill behind the text. Never rely on footage being dark.
- Most social video is watched muted. Captions aren't optional for talking content.

## Build it here
```tsx
<Footage id="talk-…" from={3.2} />
<Captions id="captions" assetId="talk-…" offset={3.2} />
```
Transcripts come from ingest (Deepgram). Use `ev media <id>` to see the utterances.

## Sources
- [Syllaby: Aspect ratios and safe zones for Shorts, Reels and TikTok](https://syllaby.io/blog/aspect-ratios-safe-zones-shorts-reels-tiktok/)
- [Argil: TikTok aspect ratio spec sheet](https://www.argil.ai/blog/tiktok-aspect-ratio-cec4c)
- [PostPlanify: Social media safe zones 2026](https://postplanify.com/blog/social-media-safe-zones-2026-complete-guide)
- [Filmscribe: Adding captions to Reels and TikTok](https://filmscribe.ai/en/guides/how-to-add-captions-to-reels-and-tiktok)
