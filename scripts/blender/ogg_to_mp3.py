# Mix an audio file down to MP3 headless (no ffmpeg on the machine, Blender ships its own).
# Usage: Blender -b --factory-startup -P scripts/blender/ogg_to_mp3.py -- <in.ogg> <out.mp3> [bitrate_kbps]
import sys, bpy
args = sys.argv[sys.argv.index('--') + 1:]
src, dst = args[0], args[1]
bitrate = int(args[2]) if len(args) > 2 else 160
scene = bpy.context.scene
scene.sequence_editor_create()
strip = scene.sequence_editor.strips.new_sound('track', src, 1, 1)
scene.render.fps = 24
scene.frame_start = 1
scene.frame_end = strip.frame_final_end - 1
print('frames', scene.frame_end, 'seconds', scene.frame_end / 24)
bpy.ops.sound.mixdown(filepath=dst, check_existing=False, container='MP3', codec='MP3', bitrate=bitrate, accuracy=1024, format='S16')
