# Chrome basketball with gold seams, for basketball Franchise's card (the football card's twin).
# Render: ~/Applications/Blender.app/Contents/MacOS/Blender -b -P scripts/blender/basketball-card.py -- <out> both 96
# then scripts/blender/encode-turn.py on <out>/f, and <out>/f/0000.png as public/franchise/art/basketball-card.webp
# blender -b -P ball.py -- <outdir> [still|film|both] [samples]
import bpy, math, sys, os
from mathutils import Vector

argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
OUT = argv[0] if argv else '/tmp/bball'
MODE = argv[1] if len(argv) > 1 else 'still'
SAMPLES = int(argv[2]) if len(argv) > 2 else 96
F0, F1 = (int(argv[3]), int(argv[4])) if len(argv) > 4 else (None, None)   # a part of the film (two Blenders at once)
os.makedirs(OUT, exist_ok=True)

W, H, FPS, SECS = 450, 300, 20, 6
FRAMES = FPS * SECS
BG = (10, 12, 16)
lin = lambda c: ((c / 255) / 12.92) if c / 255 <= 0.04045 else (((c / 255) + 0.055) / 1.055) ** 2.4

bpy.ops.wm.read_factory_settings(use_empty=True)
sc = bpy.context.scene
sc.render.engine = 'CYCLES'
prefs = bpy.context.preferences.addons['cycles'].preferences
try:
    prefs.compute_device_type = 'METAL'; prefs.get_devices()
    for d in prefs.devices: d.use = True
    sc.cycles.device = 'GPU'
except Exception: pass
sc.cycles.samples = SAMPLES
sc.cycles.use_denoising = True
sc.render.resolution_x, sc.render.resolution_y, sc.render.resolution_percentage = W, H, 100
sc.render.fps = FPS
sc.frame_start, sc.frame_end = 0, FRAMES - 1
sc.view_settings.view_transform = 'Standard'
sc.view_settings.look = 'None'
sc.render.film_transparent = True

# ── materials ──
def chrome():
    m = bpy.data.materials.new('chrome'); m.use_nodes = True
    nt = m.node_tree; p = nt.nodes['Principled BSDF']
    p.inputs['Base Color'].default_value = (0.82, 0.84, 0.87, 1)
    p.inputs['Metallic'].default_value = 1.0
    p.inputs['Roughness'].default_value = 0.16
    # the ball's pebbling, faint (it reads as a basketball, not a mirror sphere)
    tc = nt.nodes.new('ShaderNodeTexCoord'); nz = nt.nodes.new('ShaderNodeTexNoise'); bump = nt.nodes.new('ShaderNodeBump')
    nz.inputs['Scale'].default_value = 90.0; nz.inputs['Detail'].default_value = 2.0
    bump.inputs['Strength'].default_value = 0.06; bump.inputs['Distance'].default_value = 0.02
    nt.links.new(tc.outputs['Object'], nz.inputs['Vector'])
    nt.links.new(nz.outputs['Fac'], bump.inputs['Height'])
    nt.links.new(bump.outputs['Normal'], p.inputs['Normal'])
    return m

def gold():
    m = bpy.data.materials.new('gold'); m.use_nodes = True
    p = m.node_tree.nodes['Principled BSDF']
    p.inputs['Base Color'].default_value = (0.86, 0.56, 0.18, 1)
    p.inputs['Metallic'].default_value = 1.0
    p.inputs['Roughness'].default_value = 0.24
    return m


# ── the ball: a sphere with its seams laid into the surface as gold (flush, not raised) ──
# The seams of a real game ball (Paul Bourke, "Geometry of sports balls"): two great circles through the same two
# poles at right angles to each other, and one curved seam, the tennis ball's curve, weaving through the four lunes
# between them (it reaches about 23 degrees from a pole where it crosses each great circle):
#   colat = pi/2 - (pi/2 - A) cos t, long = t/2 + A sin 2t, 0 <= t < 4 pi, A = 0.40
# Drawn as a mask in the ball's own long/lat (an equirectangular image on the sphere's UVs): gold within the seam's
# half-width of any seam, chrome elsewhere, a soft edge one pixel wide.
import numpy as np
from mathutils import kdtree
A = 0.40
HALF = 0.027           # the seam's half-width (radians): about a quarter inch on a 9.5 inch ball, read at card size
IW, IH = 2048, 1024
pts = []
for i in range(6000):
    t = 4 * math.pi * i / 6000
    co, lo = math.pi / 2 - (math.pi / 2 - A) * math.cos(t), t / 2 + A * math.sin(2 * t)
    pts.append((math.sin(co) * math.cos(lo), math.sin(co) * math.sin(lo), math.cos(co)))
kd = kdtree.KDTree(len(pts))
for i, v in enumerate(pts): kd.insert(v, i)
kd.balance()
lon = (np.arange(IW) + 0.5) / IW * 2 * math.pi - math.pi
col = (np.arange(IH) + 0.5) / IH * math.pi            # row 0 = the south pole (Blender images run bottom to top)
col = math.pi - col
L, C = np.meshgrid(lon, col)
X, Y, Z = np.sin(C) * np.cos(L), np.sin(C) * np.sin(L), np.cos(C)
d = np.minimum(np.abs(np.arcsin(np.clip(X, -1, 1))), np.abs(np.arcsin(np.clip(Y, -1, 1))))   # the two great circles (x = 0, y = 0)
dc = np.empty(X.size)
fx, fy, fz = X.ravel(), Y.ravel(), Z.ravel()
for k in range(X.size):
    dc[k] = kd.find((fx[k], fy[k], fz[k]))[2]
d = np.minimum(d, 2 * np.arcsin(np.clip(dc.reshape(X.shape) / 2, 0, 1)))
px = 2 * math.pi / IW
m = np.clip((HALF + px * 0.75 - d) / (px * 1.5), 0, 1).astype(np.float32)
# (written to a PNG beside the renders and loaded back: the render reads a file reliably)
tmp = bpy.data.images.new('seams_w', IW, IH, alpha=False, float_buffer=False)
rgba = np.ones((IH, IW, 4), np.float32); rgba[..., 0] = rgba[..., 1] = rgba[..., 2] = m
tmp.pixels.foreach_set(rgba.ravel())
MASK = os.path.join(OUT, 'seams.png')
tmp.filepath_raw = MASK; tmp.file_format = 'PNG'; tmp.save()
img = bpy.data.images.load(MASK); img.colorspace_settings.name = 'Non-Color'
print('seam mask share', float(m.mean()))

piv = bpy.data.objects.new('pivot', None); sc.collection.objects.link(piv)
bpy.ops.mesh.primitive_uv_sphere_add(segments=192, ring_count=96, radius=1.0)
ball = bpy.context.active_object; ball.name = 'ball'
bpy.ops.object.shade_smooth(); ball.parent = piv
# UVs from each corner's own direction (long/lat), so the mask lands exactly; a face across the date line keeps going
me = ball.data; uvl = me.uv_layers.active.data
for poly in me.polygons:
    us = []
    for li in poly.loop_indices:
        v = me.vertices[me.loops[li].vertex_index].co.normalized()
        u = (math.atan2(v.y, v.x) + math.pi) / (2 * math.pi)
        w = 1 - math.acos(max(-1, min(1, v.z))) / math.pi
        us.append([li, u, w, abs(v.z) > 0.9999])
    real = [x[1] for x in us if not x[3]]
    if real and max(real) - min(real) > 0.5:
        for x in us:
            if x[1] < 0.5: x[1] += 1
    mid = sum(real) / len(real) if real else 0.5
    for x in us:
        if x[3]: x[1] = (sum(y[1] for y in us if not y[3]) / max(1, len([y for y in us if not y[3]])))
        uvl[x[0]].uv = (x[1], x[2])

mat = bpy.data.materials.new('ball'); mat.use_nodes = True; nt = mat.node_tree
for n in list(nt.nodes): nt.nodes.remove(n)
outn = nt.nodes.new('ShaderNodeOutputMaterial')
chrome = nt.nodes.new('ShaderNodeBsdfPrincipled'); goldn = nt.nodes.new('ShaderNodeBsdfPrincipled')
chrome.inputs['Base Color'].default_value = (0.82, 0.84, 0.87, 1); chrome.inputs['Metallic'].default_value = 1.0; chrome.inputs['Roughness'].default_value = 0.16
goldn.inputs['Base Color'].default_value = (1.0, 0.70, 0.26, 1); goldn.inputs['Metallic'].default_value = 1.0; goldn.inputs['Roughness'].default_value = 0.32
goldn.inputs['Emission Color'].default_value = (1.0, 0.62, 0.2, 1); goldn.inputs['Emission Strength'].default_value = 0.35   # (a touch of its own glow so the inlay reads on the dark side of the ball)
tc = nt.nodes.new('ShaderNodeTexCoord'); nz = nt.nodes.new('ShaderNodeTexNoise'); bump = nt.nodes.new('ShaderNodeBump')
nz.inputs['Scale'].default_value = 90.0; nz.inputs['Detail'].default_value = 2.0
bump.inputs['Strength'].default_value = 0.06; bump.inputs['Distance'].default_value = 0.02
nt.links.new(tc.outputs['Object'], nz.inputs['Vector']); nt.links.new(nz.outputs['Fac'], bump.inputs['Height'])
nt.links.new(bump.outputs['Normal'], chrome.inputs['Normal'])     # (the pebbling on the leather only; the seams are smooth)
tex = nt.nodes.new('ShaderNodeTexImage'); tex.image = img; tex.interpolation = 'Linear'; tex.extension = 'REPEAT'
nt.links.new(tc.outputs['UV'], tex.inputs['Vector'])
mix = nt.nodes.new('ShaderNodeMixShader')
nt.links.new(tex.outputs['Color'], mix.inputs['Fac']); nt.links.new(chrome.outputs[0], mix.inputs[1]); nt.links.new(goldn.outputs[0], mix.inputs[2])
nt.links.new(mix.outputs[0], outn.inputs['Surface'])
ball.data.materials.append(mat)
# the poles lie left and right (the classic face: one great circle across the middle, the curved seam arching over
# and under it), the ball spinning about the upright
ball.rotation_mode = 'ZYX'
ROLL = math.radians(float(os.environ.get('ROLL', '0')))
ball.rotation_euler = (0, math.radians(90), ROLL)

# the ball's own pose: its axis tipped toward the camera and to the side so the seams draw a basketball, then it
# spins about that axis (a ball spun on a finger)
piv.rotation_mode = 'XYZ'
TILT = (math.radians(-14), math.radians(8), 0)
axis = bpy.data.objects.new('axis', None); sc.collection.objects.link(axis)
axis.rotation_euler = TILT
piv.parent = axis
YAW0 = math.radians(0)
piv.rotation_euler = (0, 0, YAW0)

# ── camera ──
cam_d = bpy.data.cameras.new('cam'); cam_d.lens = 96; cam_d.sensor_fit = 'HORIZONTAL'
cam = bpy.data.objects.new('cam', cam_d); sc.collection.objects.link(cam); sc.camera = cam
cam.location = (0, -9.2, 0.25)
cam.rotation_euler = (math.radians(90 - 1.5), 0, 0)
cam_d.shift_y = -0.01

# ── light: big soft boxes like the trophy's studio, reflected in the chrome ──
def area(name, loc, size, energy, sx=None, color=(1, 1, 1)):
    l = bpy.data.lights.new(name, 'AREA'); l.shape = 'RECTANGLE'; l.size = size; l.size_y = sx or size
    l.energy = energy; l.color = color
    o = bpy.data.objects.new(name, l); sc.collection.objects.link(o); o.location = loc
    d = Vector((0, 0, 0)) - Vector(loc); o.rotation_euler = d.to_track_quat('-Z', 'Y').to_euler()
    return o
area('key', (-3.2, -4.0, 3.4), 2.6, 900, 1.4)
area('fill', (4.2, -2.8, 0.6), 1.2, 240, 3.2)
area('rim', (2.0, 3.5, 3.0), 2.0, 700)
area('top', (0, -0.8, 5.0), 3.0, 260, 0.8)
area('low', (-2.0, -3.0, -3.0), 3.5, 70, 0.6)

# a dark studio: almost no world light, only what the boxes give (the background is laid in after)
w = bpy.data.worlds.new('w'); sc.world = w; w.use_nodes = True
wt = w.node_tree; bgn = wt.nodes['Background']
# a studio the chrome can reflect: dark floor, a soft grey horizon, a bright ceiling (the camera never sees it: the
# film is transparent and the card's near-black is laid in after)
tc = wt.nodes.new('ShaderNodeTexCoord'); sep = wt.nodes.new('ShaderNodeSeparateXYZ'); mr = wt.nodes.new('ShaderNodeMapRange'); ramp = wt.nodes.new('ShaderNodeValToRGB')
wt.links.new(tc.outputs['Generated'], sep.inputs[0]); wt.links.new(sep.outputs['Z'], mr.inputs['Value'])
mr.inputs['From Min'].default_value = -1; mr.inputs['From Max'].default_value = 1
wt.links.new(mr.outputs['Result'], ramp.inputs['Fac'])
el = ramp.color_ramp.elements
el[0].position = 0.0; el[0].color = (0.004, 0.005, 0.007, 1)
el[1].position = 1.0; el[1].color = (0.75, 0.77, 0.8, 1)
e = el.new(0.47); e.color = (0.02, 0.022, 0.026, 1)
e = el.new(0.53); e.color = (0.22, 0.23, 0.25, 1)
e = el.new(0.70); e.color = (0.08, 0.085, 0.095, 1)
wt.links.new(ramp.outputs['Color'], bgn.inputs['Color']); bgn.inputs['Strength'].default_value = 1.0

# ── compositor: the card's own near-black under the ball, exact ──
sc.use_nodes = True
ct = sc.node_tree
for n in list(ct.nodes): ct.nodes.remove(n)
rl = ct.nodes.new('CompositorNodeRLayers'); rgb = ct.nodes.new('CompositorNodeRGB'); ao = ct.nodes.new('CompositorNodeAlphaOver'); out = ct.nodes.new('CompositorNodeComposite')
rgb.outputs[0].default_value = (lin(BG[0]), lin(BG[1]), lin(BG[2]), 1)
ct.links.new(rgb.outputs[0], ao.inputs[1]); ct.links.new(rl.outputs['Image'], ao.inputs[2]); ct.links.new(ao.outputs[0], out.inputs['Image'])
sc.render.film_transparent = True

# ── the turn: one full spin over the film, the last frame one step short of the first (a seamless loop) ──
piv.keyframe_insert('rotation_euler', index=2, frame=0)
piv.rotation_euler[2] = YAW0 + 2 * math.pi * FRAMES / FRAMES
piv.keyframe_insert('rotation_euler', index=2, frame=FRAMES)
for fc in piv.animation_data.action.fcurves:
    for k in fc.keyframe_points: k.interpolation = 'LINEAR'
piv.rotation_euler[2] = YAW0

if MODE in ('still', 'both'):
    sc.frame_set(0)
    sc.render.image_settings.file_format = 'PNG'; sc.render.image_settings.color_mode = 'RGB'
    sc.render.filepath = os.path.join(OUT, 'still.png')
    bpy.ops.render.render(write_still=True)

if MODE in ('film', 'both'):
    sc.render.image_settings.file_format = 'PNG'; sc.render.image_settings.color_mode = 'RGB'
    sc.render.filepath = os.path.join(OUT, 'f/')
    if F0 is not None: sc.frame_start, sc.frame_end = F0, F1
    bpy.ops.render.render(animation=True)
