---
title: Fitness and sport HUD overlays
summary: Functional graphics that track the workout (rep rings, tempo cues, rest timers, form checks), styled as a high-contrast HUD with condensed caps and one electric accent. Snappy pops, on the rep.
components: RingCounter, Badge, Counter, Captions, BeatPulse
themes: neon-sport
---
# Fitness and sport HUD overlays

## When to use
- Workout reels and form tutorials.
- Training logs, sports highlights.
- Any footage where *numbers over time* tell the story.

## Rules
- **Graphics carry information, not decoration.** Rep count, tempo per phase ("▼ LOWER 0.8s", "▲ PRESS 0.2s"), rest timer, set number, form cue ("FORM CHECK", "CORE TIGHT").
- **Sync to the movement.** The rep counter ticks at the **top of each rep**, and tempo badges appear as each phase begins. Find the moments in the contact sheet and shots (`ev media <id>`), then fine-tune from the user's pins.
- **Style:**
  - Near-black translucent plates.
  - Condensed uppercase type (Anton).
  - One electric accent (lime), plus red for warnings and negatives.
  - Thin rings and progress arcs.
  - This is the `neon-sport` theme.
- **Placement (vertical):**
  - The rep ring goes top-right, inside the safe area (below ~150 px, away from the right-edge icons).
  - Cues go top-left.
  - Captions go lower-middle.
  - Never put anything over the lifter's face or the bar path.
- **Snappy timing:** pops of 8–12 frames with slight overshoot; tempo 0.8. Pulse on downbeats if there's music.
- **Rest periods:** a large timer (RingCounter with a "REST" label) and a calmer pace. A heartbeat or ECG line works well as a motif.

## Build it here
```tsx
<RingCounter id="reps" value={repAt(frame)} label="Reps" progress={rep / total} size={240} />
<Badge id="tempo" icon="▼" text="Lower 0.8s" tone="alert" start={phaseStart} />
```

## Sources
- [Adobe Video World: How to edit a fitness video](https://adobevideoworld.com/fitness-video-editing/)
- Pattern observed across trending gym-reel templates ([Pippit gym reel templates](https://www.pippit.ai/templates/overlay-edit-gym)) and the user's own reference footage (rep rings, tempo badges, rest timer).
