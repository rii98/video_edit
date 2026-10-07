"""Helpers for Easy Video Blender scripts (run by `ev blender`, never by hand).

Coordinates: scenes are authored in Three.js units (Y up). `v(x, y, z)` converts to Blender (Z up),
so a shot can match a <Studio3D> camera exactly: Three (x, y, z) -> Blender (x, -z, y).
"""
import json
import math
import os
import sys

import bmesh
import bpy
from mathutils import Matrix, Vector

ARGS = json.loads(os.environ.get("EV_BLENDER_ARGS", "{}"))
PROJECT = ARGS.get("project", ".")
MEDIA = os.path.join(PROJECT, "media")


def v(x, y, z):
    """Three.js (Y up) -> Blender (Z up)."""
    return Vector((x, -z, y))


def hex_rgba(h, a=1.0):
    h = h.lstrip("#")
    r, g, b = (int(h[i : i + 2], 16) / 255 for i in (0, 2, 4))
    # sRGB -> linear (Blender colour inputs are linear)
    lin = lambda c: c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4
    return (lin(r), lin(g), lin(b), a)


def reset():
    bpy.ops.wm.read_factory_settings(use_empty=True)


def setup_render(width, height, samples=96, transparent=False, view="Khronos PBR Neutral"):
    """Cycles on the Metal GPU when there is one, OpenImageDenoise, PNG RGBA output."""
    sc = bpy.context.scene
    sc.render.engine = "CYCLES"
    prefs = bpy.context.preferences.addons["cycles"].preferences
    try:
        prefs.compute_device_type = "METAL"
        prefs.get_devices()
        gpu = False
        for d in prefs.devices:
            d.use = d.type == "METAL"
            gpu = gpu or d.use
        sc.cycles.device = "GPU" if gpu else "CPU"
    except Exception:
        sc.cycles.device = "CPU"
    sc.cycles.samples = samples
    sc.cycles.use_adaptive_sampling = True
    sc.cycles.adaptive_threshold = 0.02
    sc.cycles.use_denoising = True
    sc.cycles.denoiser = "OPENIMAGEDENOISE"
    sc.cycles.max_bounces = 8
    sc.cycles.transmission_bounces = 8
    sc.cycles.glossy_bounces = 4
    sc.cycles.caustics_reflective = True
    sc.cycles.caustics_refractive = True
    sc.render.resolution_x = width
    sc.render.resolution_y = height
    sc.render.resolution_percentage = 100
    sc.render.film_transparent = transparent
    sc.render.image_settings.file_format = "PNG"
    sc.render.image_settings.color_mode = "RGBA"
    sc.render.image_settings.color_depth = "8"
    try:
        sc.view_settings.view_transform = view
    except TypeError:
        sc.view_settings.view_transform = "AgX"
    sc.view_settings.look = "None"
    return sc


def camera_three(position, look_at, fov_deg):
    """A camera matching a Three.js PerspectiveCamera (vertical fov, position, lookAt)."""
    cam_data = bpy.data.cameras.new("Camera")
    cam_data.sensor_fit = "VERTICAL"
    cam_data.angle_y = math.radians(fov_deg)
    cam_data.clip_start = 0.05
    cam_data.clip_end = 200
    cam = bpy.data.objects.new("Camera", cam_data)
    bpy.context.collection.objects.link(cam)
    cam.location = v(*position)
    direction = v(*look_at) - cam.location
    cam.rotation_euler = direction.to_track_quat("-Z", "Y").to_euler()
    bpy.context.scene.camera = cam
    return cam


def material(name, color="#ffffff", roughness=0.5, metallic=0.0, coat=0.0, coat_roughness=0.1, transmission=0.0, ior=1.5, subsurface=0.0, sheen=0.0):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    p = m.node_tree.nodes["Principled BSDF"]
    p.inputs["Base Color"].default_value = hex_rgba(color)
    p.inputs["Roughness"].default_value = roughness
    p.inputs["Metallic"].default_value = metallic
    p.inputs["Coat Weight"].default_value = coat
    p.inputs["Coat Roughness"].default_value = coat_roughness
    p.inputs["Transmission Weight"].default_value = transmission
    p.inputs["IOR"].default_value = ior
    if subsurface:
        p.inputs["Subsurface Weight"].default_value = subsurface
        p.inputs["Subsurface Radius"].default_value = (0.6, 0.5, 0.4)
        p.inputs["Subsurface Scale"].default_value = 0.02
    if sheen:
        p.inputs["Sheen Weight"].default_value = sheen
    return m


def mesh_object(name, bm, mat=None, smooth=True):
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    if smooth:
        me.shade_smooth()
    ob = bpy.data.objects.new(name, me)
    bpy.context.collection.objects.link(ob)
    if mat:
        ob.data.materials.append(mat)
    return ob


def lathe(name, profile, steps=128, mat=None):
    """Spins a (radius, height) profile around the up axis, like THREE.LatheGeometry."""
    bm = bmesh.new()
    verts = [bm.verts.new(v(r, y, 0)) for r, y in profile]
    edges = [bm.edges.new((verts[i], verts[i + 1])) for i in range(len(verts) - 1)]
    bmesh.ops.spin(bm, geom=verts + edges, cent=(0, 0, 0), axis=(0, 0, 1), angle=math.tau, steps=steps, use_merge=True)
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-5)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    return mesh_object(name, bm, mat)


def cyclorama(color="#3a332c", floor_y=0.0):
    """Floor curving into a back wall (the same profile as Studio3D's backdrop)."""
    pts = [(z, 0.0) for z in [14 - 0.5 * i for i in range(32)]]
    pts += [(-2 - math.sin(a) * 4, 4 - math.cos(a) * 4) for a in [i / 24 * math.pi / 2 for i in range(25)]]
    pts += [(-6, 4.5 + 1.5 * i) for i in range(18)]
    bm = bmesh.new()
    rows = []
    for z, y in pts:
        rows.append((bm.verts.new(v(-40, y + floor_y, z)), bm.verts.new(v(40, y + floor_y, z))))
    for (a0, a1), (b0, b1) in zip(rows, rows[1:]):
        bm.faces.new((a0, a1, b1, b0))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    return mesh_object("Cyclorama", bm, material("Backdrop", color, roughness=0.92))


def shadow_catcher(size=30, floor_y=0.0):
    """Invisible floor that only keeps shadows (for compositing over footage with film_transparent)."""
    bm = bmesh.new()
    s = size / 2
    vs = [bm.verts.new(v(x, floor_y, z)) for x, z in ((-s, -s), (s, -s), (s, s), (-s, s))]
    bm.faces.new(vs)
    ob = mesh_object("ShadowCatcher", bm, smooth=False)
    ob.is_shadow_catcher = True
    return ob


def area_light(name, position, target, size, power, color="#ffffff", shape="RECTANGLE"):
    ld = bpy.data.lights.new(name, "AREA")
    ld.shape = shape
    if isinstance(size, (list, tuple)):
        ld.size, ld.size_y = size
    else:
        ld.size = size
    ld.energy = power
    ld.color = hex_rgba(color)[:3]
    ob = bpy.data.objects.new(name, ld)
    bpy.context.collection.objects.link(ob)
    ob.location = v(*position)
    ob.rotation_euler = (v(*target) - ob.location).to_track_quat("-Z", "Y").to_euler()
    return ob


def studio_lights(accent="#D9653B", scale=1.0):
    """The Studio3D "studio" look as real area lights: overhead softbox, two strips, accent rim."""
    area_light("Softbox", (0, 6, 1), (0, 0, 0), (7, 5), 900 * scale)
    area_light("StripL", (-5, 2, 2), (0, 0.5, 0), (1.5, 6), 350 * scale)
    area_light("StripR", (5, 1.5, 3), (0, 0.5, 0), (1.5, 5), 200 * scale)
    area_light("Rim", (0, 2, -6), (0, 0.6, 0), (6, 1.2), 500 * scale, color=accent)


def world(color="#141210", strength=1.0, hdri=None, hdri_strength=0.4):
    w = bpy.data.worlds.new("World")
    bpy.context.scene.world = w
    w.use_nodes = True
    nt = w.node_tree
    bg = nt.nodes["Background"]
    if hdri:
        env = nt.nodes.new("ShaderNodeTexEnvironment")
        env.image = bpy.data.images.load(os.path.join(MEDIA, hdri))
        nt.links.new(env.outputs["Color"], bg.inputs["Color"])
        bg.inputs["Strength"].default_value = hdri_strength
    else:
        bg.inputs["Color"].default_value = hex_rgba(color)
        bg.inputs["Strength"].default_value = strength
    return w


def keyframe_linear(obj, path, index, frames_values):
    for f, val in frames_values:
        getattr(obj, path)[index] = val
        obj.keyframe_insert(data_path=path, index=index, frame=f)
    ad = obj.animation_data
    if ad and ad.action:
        for fc in getattr(ad.action, "fcurves", []):
            for k in fc.keyframe_points:
                k.interpolation = "LINEAR"
        # Blender 5 layered actions
        for layer in getattr(ad.action, "layers", []):
            for strip in layer.strips:
                for bag in strip.channelbags:
                    for fc in bag.fcurves:
                        for k in fc.keyframe_points:
                            k.interpolation = "LINEAR"
