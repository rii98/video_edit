"""Runs a project Blender script and renders it. Invoked by `ev blender` as:
  Blender -b --factory-startup --python scripts/blender/harness.py
with EV_BLENDER_ARGS = {"project", "script", "out", "width", "height", "samples", "frames": [a, b],
                        "transparent", "options": {...}}. Frames are 1-based (frame 1 = scene frame 0).
"""
import json
import os
import runpy
import sys
import time

sys.path.insert(0, os.path.dirname(__file__))
import bpy  # noqa: E402

import ev3d  # noqa: E402

A = ev3d.ARGS
ev3d.reset()
sc = ev3d.setup_render(A["width"], A["height"], samples=A.get("samples", 96), transparent=A.get("transparent", False))
first, last = A["frames"]
sc.frame_start, sc.frame_end = first, last
sc.render.fps = A.get("fps", 30)
runpy.run_path(A["script"], run_name="__main__")
if A.get("transparent") is not None:
    sc.render.film_transparent = A["transparent"] or sc.render.film_transparent
os.makedirs(A["out"], exist_ok=True)
if A.get("blend"):
    bpy.ops.wm.save_as_mainfile(filepath=os.path.join(A["out"], "scene.blend"))
t0 = time.time()
for f in range(first, last + 1):
    sc.frame_set(f)
    sc.render.filepath = os.path.join(A["out"], f"{f - 1:05d}.png")
    t = time.time()
    bpy.ops.render.render(write_still=True)
    print(f"EVFRAME {f - 1} {time.time() - t:.2f}", flush=True)
print(f"EVDONE {last - first + 1} {time.time() - t0:.1f}", flush=True)
