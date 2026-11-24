"""Baked far facades of the house kit (S0004 07). Run (ADR 0003):

    Blender -b --factory-startup -P scripts/blender/housebake.py -- assets/levels/kosice/housefacade [--ppm 64] [--previews <dir>]

Writes <out>_col.webp, <out>_nrm.webp, <out>_msk.webp and <out>.json. The near modules of scripts/blender/housekit.py are laid out per cell (one storey of a few
bays, or a cornice / parapet strip), seen from the front with an orthographic camera, and rendered with Cycles in four emission-only passes (no lighting is baked):
  albedo   colour of every role (plaster and accent stay white: the game tints them per house; glass is painted afterwards with a hint of interior and sky),
  mask     R plaster, G accent, B glass (the rest is fixed detail colour),
  depth    height out of the wall, from which the tangent-space normal is derived (a front view only has the edge normals of reveals, sills, cornices),
  AO       Cycles ambient occlusion on the real geometry.
Atlas files (the game reads them in js/baked-facades.ts):
  _col  sRGB colour (lossy WebP);  _nrm  R,G = tangent-space normal x,y; B = ambient occlusion (lossless WebP);  _msk  R plaster, G accent, B glass (lossless WebP).
Every cell has an 8 px gutter that wraps round (the game repeats a cell along a wall); the json lists the inner rectangle of each cell in uv, its width in bays and its height in metres.
"""
import os, sys, math, json, shutil, zlib
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import numpy as np
import bpy
import housekit as hk
import modernkit as mk                                                       # S0004 13: the modern modules share the cells, roles and materials
from lib import cli, log, reset

W, H = hk.W, hk.H
GUT = 8
# cell -> (modules left to right, extra modules laid over every bay, height in metres)
CELLS = {
    'old_ground': (['old_shop'], [], H), 'old_first': (['old_bay_d', 'old_bay_c'], [], H), 'old_upper': (['old_bay_a', 'old_bay_b'], [], H),
    'old_cornice': (['old_cornice'], [], 0.52), 'old_parapet': (['old_parapet'], [], 0.5),
    'pn_ground': (['pn_door', 'pn_win', 'pn_win', 'pn_win'], ['pn_foot'], H), 'pn_loggia': (['pn_core', 'pn_win', 'pn_loggia', 'pn_win'], [], H),
    'pn_balcony': (['pn_core', 'pn_win', 'pn_balcony', 'pn_win'], [], H), 'pn_blank': (['pn_blank'], [], H), 'pn_edge': (['pn_edge'], [], 0.82),
    'mid_ground': (['mid_ground'], [], H), 'mid_upper': (['mid_bay'], [], H), 'mid_cornice': (['mid_cornice'], [], 0.4), 'mid_parapet': (['mid_parapet'], [], 0.56),
    'bk_ground': (['bk_ground'], [], H), 'bk_upper': (['bk_bay'], [], H), 'bk_upper_b': (['bk_bay_b'], [], H), 'bk_cornice': (['bk_cornice'], [], 0.5),
    'rs_ground': (['rs_ground'], [], H), 'rs_upper': (['rs_balcony', 'rs_win', 'rs_win'], [], H), 'rs_end': (['rs_win'], [], H), 'rs_edge': (['rs_edge'], [], 0.48),
    'of_ground': (['of_lobby'], [], H), 'of_upper': (['of_fin', 'of_cw'], [], H), 'of_upper_p': (['of_panel', 'of_cw', 'of_cw'], [], H), 'of_band': (['of_band'], [], H),
    'of_edge': (['of_edge'], [], 0.98),
}
MODS = {**hk.MODS, **mk.MODS}

def set_pass(mats, mode):
    """Replace the node tree of the four kit materials by an emission shader of the pass."""
    for cls, mt in zip(hk.CLASSES, mats):
        nt = mt.node_tree; nt.nodes.clear()
        out = nt.nodes.new('ShaderNodeOutputMaterial'); em = nt.nodes.new('ShaderNodeEmission'); nt.links.new(em.outputs[0], out.inputs[0])
        if mode == 'alb':
            if cls == 'detail':
                a = nt.nodes.new('ShaderNodeAttribute'); a.attribute_name = 'Col'; nt.links.new(a.outputs['Color'], em.inputs['Color'])
            else: em.inputs['Color'].default_value = (1, 1, 1, 1)
        elif mode == 'msk':
            em.inputs['Color'].default_value = {'plaster': (1, 0, 0, 1), 'accent': (0, 1, 0, 1), 'detail': (0, 0, 0, 1), 'glass': (0, 0, 1, 1)}[cls]
        elif mode == 'dep':                                    # height out of the wall (game z) mapped from [-1, 1] to [0, 1]; Blender y = -game z
            g = nt.nodes.new('ShaderNodeNewGeometry'); sp = nt.nodes.new('ShaderNodeSeparateXYZ'); mp = nt.nodes.new('ShaderNodeMath'); mp.operation = 'MULTIPLY_ADD'
            mp.inputs[1].default_value = -0.5; mp.inputs[2].default_value = 0.5
            nt.links.new(g.outputs['Position'], sp.inputs[0]); nt.links.new(sp.outputs['Y'], mp.inputs[0]); nt.links.new(mp.outputs[0], em.inputs['Color'])
        elif mode == 'ao':
            ao = nt.nodes.new('ShaderNodeAmbientOcclusion'); ao.inputs['Distance'].default_value = 0.8; ao.samples = 24
            nt.links.new(ao.outputs['AO'], em.inputs['Color'])

def render(path, bays, hm, ppm):
    sc = bpy.context.scene
    sc.render.resolution_x = int(round(bays * W * ppm)); sc.render.resolution_y = int(round(hm * ppm)); sc.render.resolution_percentage = 100
    cam = sc.camera; cam.data.ortho_scale = bays * W
    cam.location = (bays * W / 2, -10.0, hm / 2); cam.rotation_euler = (math.pi / 2, 0, 0)
    sc.render.filepath = path; bpy.ops.render.render(write_still=True)
    img = bpy.data.images.load(path); img.colorspace_settings.name = 'Non-Color'
    a = np.empty(len(img.pixels), dtype=np.float32); img.pixels.foreach_get(a); a = a.reshape(sc.render.resolution_y, sc.render.resolution_x, 4)[:, :, :3].copy()
    bpy.data.images.remove(img); os.remove(path)
    return a                                                                 # row 0 = bottom

def setup():
    reset(); sc = bpy.context.scene
    sc.render.engine = 'CYCLES'; sc.cycles.device = 'CPU'; sc.cycles.samples = 48; sc.cycles.use_denoising = False; sc.cycles.filter_width = 1.2
    sc.view_settings.view_transform = 'Raw'; sc.view_settings.look = 'None'; sc.display_settings.display_device = 'sRGB'
    sc.render.image_settings.file_format = 'PNG'; sc.render.image_settings.color_depth = '16'; sc.render.image_settings.color_mode = 'RGB'
    sc.world = bpy.data.worlds.new('w'); sc.world.use_nodes = True; sc.world.node_tree.nodes['Background'].inputs['Color'].default_value = (0, 0, 0, 1)
    cam = bpy.data.objects.new('cam', bpy.data.cameras.new('cam')); cam.data.type = 'ORTHO'; cam.data.sensor_fit = 'HORIZONTAL'; cam.data.clip_end = 100
    sc.collection.objects.link(cam); sc.camera = cam
    mats = hk.make_mats()
    for name, m in MODS.items():
        for f in m.bm.faces: f[m.al] = 1.0                                   # occlusion comes from the real AO pass, not from the hand-set vertex values
    objs = {n: m.to_object(mats) for n, m in MODS.items()}
    for o in objs.values(): o.hide_render = True
    return mats, objs

def layout(objs, mods, over, mats):
    """Instances of a cell's modules side by side, with a plain plaster backdrop 1 m behind the wall; returns the objects to delete afterwards."""
    made = []
    for i, name in enumerate(mods):
        for n in [name] + over:
            o = bpy.data.objects.new(f'{n}.{i}', objs[n].data); bpy.context.scene.collection.objects.link(o); o.location = (i * W, 0, 0); made.append(o)
    me = bpy.data.meshes.new('backdrop'); bd = bpy.data.objects.new('backdrop', me); bpy.context.scene.collection.objects.link(bd)
    me.from_pydata([(-1, 1.0, -1), (len(mods) * W + 1, 1.0, -1), (len(mods) * W + 1, 1.0, 5), (-1, 1.0, 5)], [], [(0, 1, 2, 3)])
    for mt in mats: me.materials.append(mt)
    made.append(bd)
    return made

def srgb_enc(x): x = np.clip(x, 0, 1); return np.where(x <= 0.0031308, x * 12.92, 1.055 * np.power(x, 1 / 2.4) - 0.055)

def paint_office_glass(col, msk):
    """Office curtain wall (S0004 18): no room behind the pane, a mirror of the sky. Blue-grey, light at the top of each pane, darker towards the floor plate, two soft diagonal glints, a faint ceiling-void band."""
    g = msk[:, :, 2] > 0.5; h, w = g.shape
    ys = np.arange(h)[:, None].repeat(w, 1).astype(np.float32); xs = np.arange(w)[None, :].repeat(h, 0).astype(np.float32)
    big = 1e9
    ymin = np.where(g, ys, big).min(0)[None, :]; ymax = np.where(g, ys, -big).max(0)[None, :]
    xmin = np.where(g, xs, big).min(1)[:, None]; xmax = np.where(g, xs, -big).max(1)[:, None]
    t = np.clip((ys - ymin) / np.maximum(ymax - ymin, 1), 0, 1); s = np.clip((xs - xmin) / np.maximum(xmax - xmin, 1), 0, 1)
    top_c = np.array([0.33, 0.47, 0.62]); bot_c = np.array([0.07, 0.12, 0.17])
    base = bot_c + (top_c - bot_c) * (1 - t ** 0.8)[..., None]
    d = s * 0.7 + (1 - t) * 0.5; glint = np.clip(1 - np.abs(d - 0.55) / 0.12, 0, 1) * 0.35 + np.clip(1 - np.abs(d - 0.9) / 0.05, 0, 1) * 0.2
    base = base + glint[..., None] * np.array([0.5, 0.55, 0.6])
    void = ((t > 0.9) & (t <= 1.0)).astype(np.float32)[..., None]; base = base * (1 - 0.35 * void)
    col[g] = np.clip(base, 0, 1)[g]
    return col

def paint_glass(col, msk):
    """Window panes: a dark room (lighter ceiling, a curtain, a warm wall) with a soft sky reflection. Per column / row extents of the glass give each pane its own gradient."""
    g = msk[:, :, 2] > 0.5; h, w = g.shape
    ys = np.arange(h)[:, None].repeat(w, 1).astype(np.float32); xs = np.arange(w)[None, :].repeat(h, 0).astype(np.float32)
    big = 1e9
    ymin = np.where(g, ys, big).min(0)[None, :]; ymax = np.where(g, ys, -big).max(0)[None, :]
    xmin = np.where(g, xs, big).min(1)[:, None]; xmax = np.where(g, xs, -big).max(1)[:, None]
    t = np.clip((ys - ymin) / np.maximum(ymax - ymin, 1), 0, 1); s = np.clip((xs - xmin) / np.maximum(xmax - xmin, 1), 0, 1)
    floor_c = np.array([0.030, 0.034, 0.042]); ceil_c = np.array([0.20, 0.205, 0.21]); wall_c = np.array([0.19, 0.15, 0.11])
    room = floor_c + (ceil_c - floor_c) * (t ** 1.6)[..., None]
    back = np.clip(1.0 - np.abs(t - 0.55) * 2.2, 0, 1)[..., None]; room = room * (1 - back * 0.5) + wall_c * back * 0.5   # warm back wall at mid height
    curtain = ((s < 0.3) & (t > 0.15) & (t < 0.97)).astype(np.float32); fold = 0.8 + 0.2 * np.sin(xs * 0.9)
    room = room * (1 - curtain[..., None]) + (np.array([0.30, 0.26, 0.22]) * fold[..., None]) * curtain[..., None]
    d = s * 0.75 + (1 - t) * 0.55; streak = np.clip(1 - np.abs(d - 0.62) / 0.16, 0, 1) * 0.85 + np.clip(1 - np.abs(d - 0.86) / 0.07, 0, 1) * 0.4   # two diagonal reflections
    sky = np.array([0.30, 0.42, 0.58]); top = np.clip((1 - t) * 1.5 - 0.5, 0, 1)[..., None]
    refl = np.clip(streak[..., None] * 0.5 + top * 0.55, 0, 0.9)
    out = room * (1 - refl) + sky * refl
    col[g] = out[g]
    return col

def blur(a, wrap=False):
    k = np.array([1, 2, 1], dtype=np.float32) / 4
    for ax in (0, 1): a = np.apply_along_axis(lambda v: np.convolve(np.pad(v, 1, mode='wrap' if wrap else 'edge'), k, mode='valid'), ax, a)
    return a

def normals(depth, ppm):
    """Tangent-space normal (x right, y up, z out) from the height map, a little blurred so a reveal edge spans two pixels."""
    b = blur(depth[:, :, 0] * 2.0 - 1.0)                                       # metres
    dx = (np.roll(b, -1, 1) - np.roll(b, 1, 1)) * ppm / 2; dy = (np.roll(b, -1, 0) - np.roll(b, 1, 0)) * ppm / 2           # metres per metre
    nx, ny = -dx * 0.6, -dy * 0.6; nz = np.ones_like(nx); l = np.sqrt(nx * nx + ny * ny + nz * nz)
    return np.stack([nx / l, ny / l, nz / l], -1)

def main():
    argv = cli(); out = argv[0]; ppm = int(argv[argv.index('--ppm') + 1]) if '--ppm' in argv else 64
    mats, objs = setup(); work = os.path.join(os.path.dirname(os.path.abspath(out)), '_bake'); os.makedirs(work, exist_ok=True)
    cells = {}
    for name, (mods, over, hm) in CELLS.items():
        made = layout(objs, mods, over, mats); passes = {}
        for mode in ('alb', 'msk', 'dep', 'ao'):
            set_pass(mats, mode); passes[mode] = render(os.path.join(work, f'{name}_{mode}.png'), len(mods), hm, ppm)
        for o in made:
            me, bk = o.data, o.name == 'backdrop'; bpy.data.objects.remove(o)
            if bk: bpy.data.meshes.remove(me)
        alb, msk, dep, ao = passes['alb'], passes['msk'], passes['dep'], passes['ao']
        col = (paint_office_glass if name.startswith('of_') else paint_glass)(alb.copy(), msk)
        pl = msk[:, :, 0] > 0.5; n = np.random.default_rng(zlib.crc32(name.encode())).normal(0, 1, col.shape[:2]).astype(np.float32); n = blur(n, True)
        col[pl] *= (1.0 + 0.03 * n[pl])[:, None]                                # plaster grain
        nrm = normals(dep, ppm)
        cells[name] = dict(col=srgb_enc(col), nrm=np.concatenate([nrm[:, :, :2] * 0.5 + 0.5, ao[:, :, :1]], -1), msk=msk, bays=len(mods), h=hm)
        log('cell', name, col.shape)
    # shelf packing: 2048 wide, rows by height, each cell with a wrapped gutter
    AW = 2048; items = sorted(cells.items(), key=lambda kv: -kv[1]['col'].shape[0]); x = y = rowh = 0; place = {}
    for name, c in items:
        ch, cw = c['col'].shape[:2]; bw, bh = cw + 2 * GUT, ch + 2 * GUT
        if x + bw > AW: x, y, rowh = 0, y + rowh, 0
        place[name] = (x, y); x += bw; rowh = max(rowh, bh)
    AH = -(-(y + rowh) // 64) * 64                                            # a multiple of 64, not a power of two (WebGL 2 mipmaps any size): the modern cells add a row, not a second 1024
    log('atlas', AW, AH)
    atl = {k: np.zeros((AH, AW, 3), np.float32) for k in ('col', 'nrm', 'msk')}; atl['nrm'][:] = (0.5, 0.5, 1.0); atl['col'][:] = 0.5
    meta = {'size': [AW, AH], 'ppm': ppm, 'bay': W, 'storey': H, 'cells': {}}
    for name, c in cells.items():
        x0, y0 = place[name]; ch, cw = c['col'].shape[:2]
        for k in atl:
            a = np.pad(c[k], ((GUT, GUT), (GUT, GUT), (0, 0)), mode='wrap'); atl[k][y0:y0 + ch + 2 * GUT, x0:x0 + cw + 2 * GUT] = a
        # rows are bottom-up like the image buffer of Blender and like uv space: v = row / AH
        meta['cells'][name] = dict(rect=[round((x0 + GUT) / AW, 6), round((y0 + GUT) / AH, 6), round(cw / AW, 6), round(ch / AH, 6)], bays=c['bays'], h=c['h'])
    sc = bpy.context.scene; sc.view_settings.view_transform = 'Raw'
    def save(key, path, fmt, q=0):
        img = bpy.data.images.new(key + fmt, AW, AH, alpha=False); img.colorspace_settings.name = 'Non-Color'
        px = np.ones((AH, AW, 4), np.float32); px[:, :, :3] = np.clip(atl[key], 0, 1); img.pixels.foreach_set(px.ravel()); img.update()
        sc.render.image_settings.file_format = fmt; sc.render.image_settings.color_mode = 'RGB'; sc.render.image_settings.color_depth = '8'
        if fmt == 'WEBP': sc.render.image_settings.quality = q
        img.save_render(path, scene=sc); log('wrote', path, os.path.getsize(path) // 1024, 'KB')
    save('col', out + '_col.webp', 'WEBP', 88); save('nrm', out + '_nrm.webp', 'WEBP', 100); save('msk', out + '_msk.webp', 'WEBP', 100)
    json.dump(meta, open(out + '.json', 'w'), indent=1)
    if '--previews' in argv:
        folder = argv[argv.index('--previews') + 1]; os.makedirs(folder, exist_ok=True)
        for k in atl: save(k, os.path.join(folder, f'atlas_{k}.png'), 'PNG')
    shutil.rmtree(work, ignore_errors=True)

main()
