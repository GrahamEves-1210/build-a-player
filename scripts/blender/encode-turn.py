# Encode the spin's PNG frames into the card's two films with Blender's own ffmpeg.
# blender -b -P encode.py -- <framesdir> <outbase>
import bpy, sys, os
argv = sys.argv[sys.argv.index('--') + 1:]
FR, OUT = argv[0], argv[1]
files = sorted(f for f in os.listdir(FR) if f.endswith('.png'))
bpy.ops.wm.read_factory_settings(use_empty=True)
sc = bpy.context.scene
sc.render.resolution_x, sc.render.resolution_y, sc.render.resolution_percentage = 450, 300, 100
sc.render.fps = 20
sc.view_settings.view_transform = 'Standard'
sc.sequence_editor_create()
st = sc.sequence_editor.sequences.new_image('f', os.path.join(FR, files[0]), 1, 1)
for f in files[1:]: st.elements.append(f)
sc.frame_start, sc.frame_end = 1, len(files)
r = sc.render
r.image_settings.file_format = 'FFMPEG'
for ext, fmt, codec in (('mp4', 'MPEG4', 'H264'), ('webm', 'WEBM', 'WEBM')):
    r.ffmpeg.format = fmt; r.ffmpeg.codec = codec
    r.ffmpeg.constant_rate_factor = 'LOW'
    r.ffmpeg.ffmpeg_preset = 'BEST'
    r.ffmpeg.gopsize = 20
    r.ffmpeg.audio_codec = 'NONE'
    r.use_file_extension = False
    r.filepath = f'{OUT}.{ext}'
    bpy.ops.render.render(animation=True)
    print('wrote', r.filepath, os.path.getsize(r.filepath))
