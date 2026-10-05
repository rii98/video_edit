# Content writing, script and storyboard

The words are half the video. Write like a good documentary scriptwriter or a top ad copywriter: concrete, spoken, short, true.

## 1. Find the angle

Before writing a line, answer in one sentence each:
- **Who** is watching, and what do they already know?
- **What should they remember** (the one message from the brief)?
- **What should they feel** at the end?
- **What's the most surprising true thing** about the subject? That is usually the hook.

## 2. Hooks (first 1–3 seconds)

Pick the one that fits the subject; write three versions and keep the best.
- **The surprising fact or number:** "Rome didn't fall in a day. It took 300 years."
- **The question the viewer already has:** "Why does every airline seat look the same?"
- **The bold claim:** "Your coffee is lying to you."
- **The end result first:** show the finished thing, then "here's how".
- **The contradiction:** "The safest city in the world has no police on the street."
- **Stakes as numbers:** "20 S-words in 11 seconds."
- **In medias res:** open on the most dramatic moment, then rewind.

The hook must be visual too: the first frame should already be interesting with the sound off.

## 3. Structures

- **Problem → agitate → solve** (ads, product).
- **Hook → context → 3 beats → payoff → button** (explainers, 30–90 s).
- **Question → clues → answer** (mysteries, history).
- **Myth → reality** (education).
- **List / countdown** with an escalating order and the best item last.
- **Before → after** (transformations, tutorials).
- **Three-act micro story:** setup (who, what they want), confrontation (what's in the way), resolution (what changed).

## 4. Writing the script

- **Voiceover runs at about 2.5 words per second** (150 wpm); 2.0 for calm and premium, 3.0 for fast creator style. A 30 s video holds about 60–75 spoken words.
- **On-screen text:** about 3 words per second plus 0.5 s to land. Text-only videos hold far fewer words than VO videos.
- **Write for the ear:** short sentences, one idea each, active verbs, concrete nouns. Read it aloud in your head against the clock.
- **Let the picture talk:** don't narrate what's on screen ("here we see a chart"); add what the picture can't say.
- **Numbers:** round them for speech ("almost a third", "over 2 million"), show the exact figure on screen.
- **Specific beats generic:** "a 1987 Toyota Corolla" beats "an old car".
- **Every fact sourced** in `research.md`. No invented quotes, stats or testimonials.
- **Cut it by a fifth** after the first draft. Then check it still lands.

Copy to avoid (it reads as generated): "unlock", "elevate", "seamless", "game-changer", "in today's fast-paced world", "dive in", "the power of", "revolutionize", "imagine a world", rhetorical questions stacked in threes, em-dash-heavy sentences, ending on "the future is now". Say the plain thing.

## 5. script.md format

```markdown
# Script: <title>
Length: 30 s · VO 68 words (2.3 wps) · Format: 1080×1920

| Time | Beat | Voiceover | On screen |
|---|---|---|---|
| 0:00–0:02 | Hook | "Rome didn't fall in a day." | ROME · 476 AD (type slams on the word "fall") |
| 0:02–0:07 | Context | "It took three hundred years, five plagues and …" | Map, borders shrinking |
| … | | | |
```

Mark emphasis words in **bold** (they get the kinetic treatment) and pauses with `/`.

## 6. Storyboard / shot list

One row per shot. Every column filled, every choice justified by the playbook.

```markdown
# Storyboard: <title>

| # | Time | Purpose | A/B | Shot size · angle | Camera | Type and graphics | Transition in → out (why) | Sound | Asset |
|---|---|---|---|---|---|---|---|---|---|
| 1 | 0:00–0:02 | Hook | B | ECU, top-down | push-in 6% | "ROME" mask-reveal on "fall", 180 px Fraunces | cold open → whip right (energy, time jump) | sub hit on "fall" | coin photo, Met OA #12345 |
| 2 | … | | | | | | | | |
```

After writing it, check:
- Does the hook work with the sound off?
- Is the picture changing at the pace the genre needs (§2 of the playbook)?
- Are there at most two transition families? Are type animations consistent per hierarchy level?
- Is every asset findable (or codable)? If not, change the shot now, not during the build.
- Does it fit the length with room to breathe (holds after reveals, a final beat)?
