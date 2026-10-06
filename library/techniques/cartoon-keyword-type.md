---
title: Cartoon keyword type (the word acts out its meaning)
summary: For a vocabulary or grammar contrast, set the two keywords in a fat cartoon face and make each one do what it means. EAT gets eaten (three toothed bites with ink outlines, crumbs and crunches, synced to the speaker's eating mime); HAVE gets served (a plate slides in, a cloche drops and pops, the word springs up with steam and sparkle). Classic cartoon drawing: gradient fill, thick round-joined ink outline, hard offset shadow, squash and stretch.
components: none (project-side: vid-1 scenes/cartoon.tsx)
themes: ember-supper
---
# Cartoon keyword type

Asked for by the user on vid-1 (request #4): "cartoon typography for EAT, big font getting snapped as if it's being eaten, and a similar effect for HAVE".

## Rules

**Face and drawing**
- Use Luckiest Guy (Google Fonts, in `src/video/fonts.ts`): fat, bouncy, cookie-like caps. That gives the most surface to bite. Chewy is the softer alternative.
- Draw in SVG:
  - a vertical gradient fill (lighter at the top),
  - an ink outline about 7.5% of the size (round joins, `paintOrder: stroke`),
  - a hard ink shadow offset about 5% of the size.
- Measure the word with the real font every render (canvas `measureText`), never once in a memo. In preview the font can arrive after the first measure.

**Eaten**
- A bite is a toothed mask: one main circle plus five small circles (r about 0.36R) on the side facing the word. That leaves scallops, not a smooth hole.
- **Outline the bite:**
  - mask the ink silhouette with circles 1.1 × outline smaller than the fill's;
  - a clean ink line then traces every tooth mark;
  - without it, the shadow layer pokes into the notch as a dark blob, which reads as a glitch (user-reported).
- Bites are defined in units of the type size, relative to the word's right edge and baseline. The bitten state then survives any resize (the word flies into a ledger header later).
- Three bites, 5 frames apart, on the frame the speaker's fingers reach their lips (track fingertip-to-mouth distance below 0.01). Take them from the last letter's edges only, so the word stays readable.
- On each bite:
  - **motion:** a squash (scaleY about 0.9, scaleX about 1.06, 1 frame, settling over 4). Never a sine shake: a jitter reads as a glitch;
  - **crumbs:** 7 outlined crumbs on arcs with gravity, gone by 20 frames;
  - **sound:** a crunch, each slightly different in level.
- Entrance: squash to stretch to settle (scaleY 0.2 → 1.22 → 0.9 → 1 over 8 frames), with a pop.

**Served**
- The contrasting verb gets a different action with the same cartoon energy:
  - a plate (amber ellipse, ink outline, inner rim) slides in;
  - a cloche (about 0.64 of the plate width, so it clears labels above) drops and squashes on landing with a clink;
  - on the spoken word it pops off up and right, spinning;
  - the word springs up from the plate (scaleY 0.15 → 1.28 → 0.88 → 1.05 → 1 over 12 frames);
  - two steam squiggles (stroke-dash draw-on) and two four-point sparkles follow, with a bell.
- Keep steam and cloche clear of the pill labels: move the label to the plate's free end.

**System**
- Two type systems in one video can work when the second is reserved for one job (here: the two grammar keywords) and appears in every place those words do (S03 moment and S04 ledger headers).
- Captions keep their own keyword chips (eat on coral, have on amber), so the colour coding stays consistent.

## Sources
- Cartoon faces: https://fontadvice.com/font-collections/cartoon-fonts/, https://memefont.org/styles/funny-fonts
- Bite and chomp technique (bitten-state swaps, squash and stretch): https://schoolofmotion.com/blog/kinetic-typography-after-effects-part-3
