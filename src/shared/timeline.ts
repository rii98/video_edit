import type { SceneEntry, Timeline } from './types.ts';

export interface PlacedScene extends SceneEntry {
  /** First global frame of the scene (transitions make neighbours overlap). */
  from: number;
}

/** Resolves scene start frames, accounting for transitions overlapping adjacent scenes. */
export function layoutScenes(timeline: Timeline): PlacedScene[] {
  const placed: PlacedScene[] = [];
  let cursor = 0;
  timeline.scenes.forEach((scene, i) => {
    placed.push({ ...scene, from: cursor });
    const overlap = i < timeline.scenes.length - 1 ? (scene.transition?.durationInFrames ?? 0) : 0;
    cursor += scene.durationInFrames - overlap;
  });
  return placed;
}

export function totalFrames(timeline: Timeline): number {
  const placed = layoutScenes(timeline);
  const last = placed.at(-1);
  return last ? Math.max(1, last.from + last.durationInFrames) : 1;
}

/** The scene visible at a frame. During a transition the incoming scene wins. */
export function sceneAt(timeline: Timeline, frame: number): PlacedScene | null {
  const placed = layoutScenes(timeline);
  for (let i = placed.length - 1; i >= 0; i--) {
    const scene = placed[i]!;
    if (frame >= scene.from) return scene;
  }
  return placed[0] ?? null;
}

export function formatTime(frame: number, fps: number): string {
  const totalSeconds = Math.floor(frame / fps);
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  const f = frame % fps;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}.${String(f).padStart(2, '0')}`;
}
