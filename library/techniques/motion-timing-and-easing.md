---
title: Motion timing and easing
summary: Durations and curves that feel right. Small moves 3-6 frames, standard 8-15, big/full-screen 13-18. Ease-out entering, ease-in leaving, ease-in-out moving. Never linear.
components: all (theme easing/tempo tokens)
themes: any
---
# Motion timing and easing

## Rules: durations at 30 fps
Material Design's tokens are a good, well-tested baseline:

| Move | ms | frames |
|---|---|---|
| Micro (fade, colour, tick) | 50–150 | 2–5 |
| Small element in/out | 200–300 | 6–9 |
| Standard move / card | 300–450 | 9–14 |
| Large or full-screen transition | 450–600 | 14–18 |
| Hero / premium camera move | 1200–2000+ | 36–60+ |

- Elements **entering** can take a little longer than elements **leaving**. Exits are about 15% faster.
- On video, motion can run longer than in UI, because nobody is waiting on it. Still, keep each move as short as it can be while staying readable.

## Rules: easing
- **Never linear** for spatial motion. It looks mechanical. Linear is fine for opacity fades under 6 frames and for constant drifts.
- **Entering:** decelerate (ease-out). **Leaving:** accelerate (ease-in). **Moving on screen:** ease-in-out.
- The theme has two curves:
  - `standard`: fast ease-out, for most entrances.
  - `emphasized`: strong ease-in-out, for big moves and transitions.
- **Overshoot / follow-through** (things land past their target and settle) adds life and playfulness. Use it in `playful-pop` and for HUD pops. Never use it in premium styles.
- **Anticipation:** a tiny move against the direction (2–3 frames) before a big move makes it read clearly.
- **Overlapping action:** related parts shouldn't move in lockstep. Offset them by 2–4 frames (stagger).

## Tempo
The theme's `tempo` multiplies all durations: 1.25 is calm/premium, 0.8 is snappy/social. To change a video's whole "feel", change `tempo` instead of editing every animation.

## Sources
- [Material Design 3: easing and duration tokens](https://m3.material.io/styles/motion/easing-and-duration/tokens-specs)
- [Material Design 1: duration and easing](https://m1.material.io/motion/duration-easing.html)
- [Marvel: Disney's motion principles in interface animation](https://marvelapp.com/blog/disneys-motion-principles-in-designing-interface-animations/)
- [Wikipedia, via Thomas & Johnston, The Illusion of Life (1981)](https://en.wikipedia.org/wiki/Twelve_basic_principles_of_animation)
