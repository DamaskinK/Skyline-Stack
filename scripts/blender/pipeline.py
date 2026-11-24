"""Shared model assembly of the Blender landmarks (ADR 0003, extended in S0004 01).

A model script builds three `Build`s (body: unioned masses, cut: cutters, inl: inlays that are not cut) and calls `assemble(...)`:
union -> cut -> roles -> UV (atlas for everything unique, tiling materials for roles that repeat) -> Cycles bake -> LODs -> Draco GLB -> previews.

Materials of a model: one atlas material (colour, ORM with glTF occlusion, emission) plus optional tiling materials (`tiling` dict), at most
three in all. A tiling role keeps a small atlas patch for its baked ambient occlusion only; the occlusion texture of its material reads
the second UV set ('ao'), its colour and normal map tile over the first ('atlas', in repeats).
"""
import os, sys, math, time, tempfile
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import bpy, bmesh
import numpy as np
from lib import *


# ------------------------------------------------------------------ textures (numpy, periodic so they tile)
def _save(path, arr, colour=True):
    h, w = arr.shape[:2]
    rgba = np.concatenate([np.clip(arr, 0, 1), np.ones((h, w, 1))], -1) if arr.shape[2] == 3 else np.clip(arr, 0, 1)
    im = bpy.data.images.new('tex', w, h, alpha=False)
    if not colour: im.colorspace_settings.name = 'Non-Color'
    im.pixels.foreach_set(rgba[::-1].astype(np.float32).ravel()); im.filepath_raw = path; im.file_format = 'PNG'; im.save()
    bpy.data.images.remove(im)

def _rgb(h): return np.array([(h >> s & 255) / 255 for s in (16, 8, 0)])

def _periodic_noise(px, cells, seed, octaves=3):
    """Tileable value noise (bilinear interpolation of a periodic random grid), 0..1."""
    rng = np.random.default_rng(seed); out = np.zeros((px, px)); amp = 1.0; tot = 0.0
    for o in range(octaves):
        n = cells * 2 ** o; g = rng.random((n, n))
        u = (np.arange(px) + 0.5) / px * n; i0 = np.floor(u).astype(int); f = u - i0; f = f * f * (3 - 2 * f); i1 = (i0 + 1) % n
        a = g[i0][:, i0] * (1 - f)[None, :] + g[i0][:, i1] * f[None, :]
        b = g[i1][:, i0] * (1 - f)[None, :] + g[i1][:, i1] * f[None, :]
        out += amp * (a * (1 - f)[:, None] + b * f[:, None]); tot += amp; amp *= 0.5
    return out / tot

def write_stone_texture(path, normal_path, period=4.0, px=1024, course=0.5, c1=0xb8aa8c, c2=0x8c8271, mortar=0x6a6354, seed=3, block=(0.9, 1.7), joint=0.014, bevel=0.03, accents=()):
    """Ashlar masonry that tiles every `period` metres: courses of random block lengths, per-block tint, chipped bevelled edges, grain.
    Writes the colour map and a normal map made from the same height field. `accents`: [(probability, colour)] blocks of another stone
    scattered among the others (S0004 09: the cathedral's patchwork of dark grey and reddish blocks in the pale sandstone)."""
    rng = np.random.default_rng(seed); ncourse = int(round(period / course)); ch = period / ncourse
    y = (np.arange(px) + 0.5) / px * period; x = (np.arange(px) + 0.5) / px * period
    X, Y = np.meshgrid(x, y)
    row = np.minimum((Y / ch).astype(int), ncourse - 1)
    col = np.zeros((px, px, 3)); height = np.zeros((px, px)); edge = np.zeros((px, px))
    ca, cb = _rgb(c1), _rgb(c2)
    for r in range(ncourse):
        # partition [0, period] into blocks of random length, the course shifted so joints do not line up
        cuts = []; pos = rng.uniform(0, block[1])
        while pos < period + block[1]:
            cuts.append(pos); pos += rng.uniform(*block)
        cuts = np.array(cuts) % period; cuts.sort()
        if len(cuts) < 2: cuts = np.array([0.0, period / 2])
        rows = row == r
        xs = X[rows]; idx = np.searchsorted(cuts, xs) % len(cuts)
        left = cuts[(idx - 1) % len(cuts)]; right = cuts[idx]
        dl = (xs - left) % period; dr = (right - xs) % period
        yy = Y[rows] - r * ch
        d = np.minimum(np.minimum(dl, dr), np.minimum(yy, ch - yy))
        edge[rows] = d
        tint = 0.2 + 0.6 * rng.random(len(cuts)); tint = tint[(idx - 1) % len(cuts)]
        bright = 0.94 + 0.12 * rng.random(len(cuts)); bright = bright[(idx - 1) % len(cuts)]
        bc = ca[None] * (1 - tint[:, None]) + cb[None] * tint[:, None]
        if accents:
            pick = rng.random(len(cuts)); acc = np.zeros(len(cuts), int) - 1; lo = 0.0
            for ai, (p, _) in enumerate(accents):
                acc[(pick >= lo) & (pick < lo + p)] = ai; lo += p
            ac = acc[(idx - 1) % len(cuts)]
            for ai, (_, ah) in enumerate(accents):
                m = ac == ai; bc[m] = _rgb(ah)[None] * (0.9 + 0.2 * tint[m, None])
        col[rows] = bc * bright[:, None]
    grain = _periodic_noise(px, 64, seed + 1, 2); blot = _periodic_noise(px, 5, seed + 2, 3)
    col *= (0.86 + 0.28 * blot)[..., None] * (0.94 + 0.12 * grain)[..., None]
    groove = np.clip(1 - edge / joint, 0, 1)                       # mortar joint
    col = col * (1 - groove[..., None]) + _rgb(mortar)[None, None] * groove[..., None]
    height = np.clip(edge / bevel, 0, 1) ** 0.6 - 0.35 * groove + 0.10 * grain + 0.12 * blot
    # darker chipped corners
    col *= (0.9 + 0.1 * np.clip(edge / bevel, 0, 1))[..., None]
    _save(path, col)
    # normal map: gradient of the height field (periodic differences); strength in tangent units
    gx = (np.roll(height, -1, 1) - np.roll(height, 1, 1)) * 0.5; gy = (np.roll(height, -1, 0) - np.roll(height, 1, 0)) * 0.5
    s = 3.2; nx, ny = -gx * s, gy * s; nz = np.ones_like(nx); l = np.sqrt(nx * nx + ny * ny + nz * nz)
    _save(normal_path, np.stack([nx / l * 0.5 + 0.5, ny / l * 0.5 + 0.5, nz / l * 0.5 + 0.5], -1), colour=False)

def write_tile_texture(path, kind='cathedral', px=512, period=TILE_PERIOD, seed=7):
    """Roof tile patterns. `cathedral`: diamonds, mostly yellow and green (S0004 01, from the photos of the real roof);
    `chapel`: dark brown field with a yellow lattice; `slate`: dark brown plain tiles in rows; `red`: orange clay tiles in rows."""
    rng = np.random.default_rng(seed)
    u = (np.arange(px) + 0.5) / px * period; U, V = np.meshgrid(u, u)
    P = {k: _rgb(PALETTE[k]) for k in ('tileYellow', 'tileGreen', 'tileRed', 'tileBlue', 'tileBlack')}
    if kind == 'cathedral':
        # S0004 09, from File:St. Elisabeth Cathedral - Old Town - Kosice - Slovakia (36169946860).jpg and File:Cathedral of St Elizabeth Košice, Staré Mesto, Slovakia.jpg:
        # glazed beaver-tail tiles, a terracotta to red-brown field with horizontal zigzag bands of ochre yellow, green and dark brown and small dark lozenges between them.
        cols, rows = 24, 16; tw, rh = period / cols, period / rows
        r = np.floor(V / rh).astype(int); fy = V / rh - r
        sh = (r % 2) * 0.5; c = np.floor(U / tw + sh).astype(int); fx = U / tw + sh - c; c = c % cols; r = r % rows
        base = np.array([_rgb(0x9a4c2e), _rgb(0x86422d), _rgb(0xa45634), _rgb(0x763b2a)])
        pick = rng.integers(0, 4, (rows, cols)); grid = base[pick]
        zig = np.abs((np.arange(cols)[None, :] % 8) - 4)                                        # chevron: 3 per period
        rr = np.arange(rows)[:, None]
        band = (rr + zig) % 8
        grid[band == 0] = _rgb(0xcf9f3a); grid[band == 1] = _rgb(0x3f7445)
        dia = ((rr + 4 + zig) % 8 == 0) & ((np.arange(cols)[None, :] % 8) == 4)
        grid[dia] = _rgb(0x3a2a22)
        img = grid[r, c] * rng.normal(1.0, 0.035, (rows, cols))[r, c][..., None]
        # beaver tail: rounded lower edge, each tile darker under the one above, thin gaps
        tail = np.clip(1 - ((fx - 0.5) * 2) ** 2, 0, 1) ** 0.5
        shadow = np.clip((fy - 0.12) / 0.2, 0, 1)
        img *= (0.62 + 0.38 * shadow)[..., None]
        img *= (0.85 + 0.15 * tail)[..., None]
        edge = np.minimum(fx, 1 - fx); img *= (1 - 0.35 * np.clip(1 - edge / 0.07, 0, 1))[..., None]
        img *= (0.92 + 0.14 * np.exp(-((fx - 0.4) ** 2 + (fy - 0.6) ** 2) / 0.03))[..., None]       # glaze highlight
    elif kind == 'chapel':
        cells = 24; L = period / cells
        a = (U + V) / L; b = (U - V) / L
        ia, ib = np.floor(a).astype(int) % cells, np.floor(b).astype(int) % cells
        fa, fb = a - np.floor(a), b - np.floor(b)
        img = np.zeros((px, px, 3))
        brown = _rgb(0x5a4034); cream = _rgb(0xd8c27a)
        line = (ia % 6 == 0) | (ib % 6 == 0)
        img[:] = brown; img[line] = cream
        img[(ia % 6 == 3) & (ib % 6 == 3)] = _rgb(0x3d6a4a)           # green lozenge in the lattice centres
        noise = rng.normal(1.0, 0.045, (cells, cells))[ia, ib][..., None]
        edge = np.minimum(np.minimum(fa, 1 - fa), np.minimum(fb, 1 - fb)); img *= (1 - 0.35 * np.clip(1 - edge / 0.06, 0, 1))[..., None] * noise
        img *= (0.94 + 0.12 * np.exp(-(((fa - 0.5) ** 2 + (fb - 0.5) ** 2) / 0.05)))[..., None]
    else:
        rows = 16; rh = period / rows; r = np.floor(V / rh).astype(int); fy = V / rh - r
        tw = period / 20; sh = (r % 2) * 0.5
        c = np.floor(U / tw + sh).astype(int); fx = (U / tw + sh) - c
        base = {'slate': 0x4b3d37, 'red': 0xb4532f}[kind]; alt = {'slate': 0x5d4a40, 'red': 0xc8703a}[kind]
        rr = rng.random((rows, 21)); k = rr[r % rows, c % 20][..., None]
        img = _rgb(base)[None, None] * (1 - k) + _rgb(alt)[None, None] * k
        edge = np.minimum(np.minimum(fx, 1 - fx), np.minimum(fy, 1 - fy))
        img *= (1 - 0.45 * np.clip(1 - edge / 0.08, 0, 1))[..., None]
        img *= (0.8 + 0.25 * fy)[..., None]                                   # each tile shades up toward its lower edge
    _save(path, img)


# ------------------------------------------------------------------ materials
def _tiling_material(name, role_cfg, imgs):
    """Tiling material of one role: colour (and normal map) repeat over UV 0 (in repeats); occlusion from the atlas ORM through UV 1 ('ao')."""
    m = bpy.data.materials.new(name); m.use_nodes = True; nt = m.node_tree
    for n in list(nt.nodes): nt.nodes.remove(n)
    out = nt.nodes.new('ShaderNodeOutputMaterial'); bsdf = nt.nodes.new('ShaderNodeBsdfPrincipled'); nt.links.new(bsdf.outputs['BSDF'], out.inputs['Surface'])
    img = bpy.data.images.load(role_cfg['png']); img.colorspace_settings.name = 'sRGB'
    t = nt.nodes.new('ShaderNodeTexImage'); t.image = img; t.extension = 'REPEAT'; nt.links.new(t.outputs['Color'], bsdf.inputs['Base Color'])
    bsdf.inputs['Roughness'].default_value = role_cfg['rough']; bsdf.inputs['Metallic'].default_value = role_cfg['metal']
    if role_cfg.get('normal'):
        ni = bpy.data.images.load(role_cfg['normal']); ni.colorspace_settings.name = 'Non-Color'
        tn = nt.nodes.new('ShaderNodeTexImage'); tn.image = ni; tn.extension = 'REPEAT'
        nm = nt.nodes.new('ShaderNodeNormalMap'); nm.inputs['Strength'].default_value = role_cfg.get('normal_strength', 1.0)
        nt.links.new(tn.outputs['Color'], nm.inputs['Color']); nt.links.new(nm.outputs['Normal'], bsdf.inputs['Normal'])
    if role_cfg.get('ao'):
        uvn = nt.nodes.new('ShaderNodeUVMap'); uvn.uv_map = 'ao'
        to = nt.nodes.new('ShaderNodeTexImage'); to.image = imgs['orm']; to.interpolation = 'Linear'; nt.links.new(uvn.outputs['UV'], to.inputs['Vector'])
        sep = nt.nodes.new('ShaderNodeSeparateColor'); nt.links.new(to.outputs['Color'], sep.inputs['Color'])
        g = bpy.data.node_groups.get('glTF Material Output') or bpy.data.node_groups.new('glTF Material Output', 'ShaderNodeTree')
        if 'Occlusion' not in [s.name for s in g.interface.items_tree]: g.interface.new_socket('Occlusion', in_out='INPUT', socket_type='NodeSocketFloat')
        gn = nt.nodes.new('ShaderNodeGroup'); gn.node_tree = g; gn.label = 'glTF Material Output'; nt.links.new(sep.outputs['Red'], gn.inputs['Occlusion'])
    return m

def _atlas_material(name, imgs):
    m = bpy.data.materials.new(name); m.use_nodes = True; nt = m.node_tree
    for n in list(nt.nodes): nt.nodes.remove(n)
    out = nt.nodes.new('ShaderNodeOutputMaterial'); bsdf = nt.nodes.new('ShaderNodeBsdfPrincipled'); nt.links.new(bsdf.outputs['BSDF'], out.inputs['Surface'])
    def tex(img, cs):
        t = nt.nodes.new('ShaderNodeTexImage'); t.image = img; t.interpolation = 'Linear'; img.colorspace_settings.name = cs; return t
    tc, to, te = tex(imgs['color'], 'sRGB'), tex(imgs['orm'], 'Non-Color'), tex(imgs['emit'], 'sRGB')
    nt.links.new(tc.outputs['Color'], bsdf.inputs['Base Color'])
    sep = nt.nodes.new('ShaderNodeSeparateColor'); nt.links.new(to.outputs['Color'], sep.inputs['Color'])
    nt.links.new(sep.outputs['Green'], bsdf.inputs['Roughness']); nt.links.new(sep.outputs['Blue'], bsdf.inputs['Metallic'])
    nt.links.new(te.outputs['Color'], bsdf.inputs['Emission Color']); bsdf.inputs['Emission Strength'].default_value = 1.0
    g = bpy.data.node_groups.get('glTF Material Output') or bpy.data.node_groups.new('glTF Material Output', 'ShaderNodeTree')
    if 'Occlusion' not in [s.name for s in g.interface.items_tree]: g.interface.new_socket('Occlusion', in_out='INPUT', socket_type='NodeSocketFloat')
    gn = nt.nodes.new('ShaderNodeGroup'); gn.node_tree = g; gn.label = 'glTF Material Output'; nt.links.new(sep.outputs['Red'], gn.inputs['Occlusion'])
    return m

def _flat_materials(cols):
    mats = []
    for role in ROLE_ORDER:
        m = bpy.data.materials.new(f'flat_{role}'); m.use_nodes = True
        m.node_tree.nodes['Principled BSDF'].inputs['Base Color'].default_value = srgb(cols.get(role, 0x888888)); m.node_tree.nodes['Principled BSDF'].inputs['Roughness'].default_value = 0.8
        mats.append(m)
    return mats


# ------------------------------------------------------------------ assembly
def assemble(name, body, cut, inl, argv, out_glb, size=2048, tiling=None, geom_colours=None, views=None, lods=((6.0, 0.6), (25.0, 0.3)),
             stone_to_tiles=True, merge=0.003, union=True, flat_roles=('stone2',)):
    """Everything after the shells. `tiling`: {role: dict(png, normal, period, rough, metal, ao)} roles that repeat (their own material, in the order given:
    material 0 is the atlas). Roles with `ao` keep a small atlas patch (density 0.3) for baked occlusion. Returns the LOD objects."""
    def opt(k, d): return argv[argv.index(k) + 1] if k in argv else d
    SIZE = int(opt('--size', size)); STAGE = opt('--stage', 'full'); PREVIEWS = opt('--previews', None)
    tiling = tiling or {}
    t0 = time.time()
    ob = body.object(); co = cut.object(); oi = inl.object()
    if union: union_self(ob)
    log('union', len(ob.data.polygons), 'faces', round(time.time() - t0, 1), 's')
    if len(co.data.polygons): boolean(ob, co, 'DIFFERENCE', True); evaluated_copy(ob)
    bpy.data.objects.remove(co); log('cut', len(ob.data.polygons), 'faces', round(time.time() - t0, 1), 's')
    bm = bmesh.new(); bm.from_mesh(ob.data); lay = bm.faces.layers.int.get('role'); ti = ROLE_ORDER.index('tiles'); si = ROLE_ORDER.index('stone')
    if lay is None: raise SystemExit('boolean dropped the role attribute')
    if stone_to_tiles:
        for f in bm.faces:
            if f[lay] == ti and not (0.2 < f.normal.z < 0.985): f[lay] = si
    bm.to_mesh(ob.data); bm.free()
    bpy.ops.object.select_all(action='DESELECT'); oi.select_set(True); ob.select_set(True); bpy.context.view_layer.objects.active = ob; bpy.ops.object.join()
    mesh_obj = bpy.context.view_layer.objects.active; mesh_obj.name = f'{name}_LOD0'; mesh_obj.data.name = f'{name}_LOD0'
    merge_close(mesh_obj, merge); flat_shade(mesh_obj)
    log('LOD0 triangles', tri_count(mesh_obj), 'time', round(time.time() - t0, 1), 's')

    if STAGE == 'geom':
        mesh_obj.data.materials.clear()
        for m in _flat_materials(geom_colours or {}): mesh_obj.data.materials.append(m)
        bm = bmesh.new(); bm.from_mesh(mesh_obj.data); lay = bm.faces.layers.int.get('role')
        for f in bm.faces: f.material_index = f[lay]
        bm.to_mesh(mesh_obj.data); bm.free()
    else:
        work = os.path.join(tempfile.gettempdir(), f'{name}_work'); os.makedirs(work, exist_ok=True)       # intermediate PNGs stay out of the repo
        tile_png = tiling.get('tiles', {}).get('png')
        if not tile_png:
            tile_png = os.path.join(work, 'dummy.png'); _save(tile_png, np.full((4, 4, 3), 0.5))                  # the bake builds a source material for every role
        pattern_uv(mesh_obj)
        parts = split_by_role(mesh_obj); bpy.data.objects.remove(mesh_obj)
        tiling_objs = {}
        for role, cfg in tiling.items():
            if role in parts and not cfg.get('ao'): tiling_objs[role] = parts.pop(role)
        old_density = {r: ROLES[r]['density'] for r in tiling}
        for role, cfg in tiling.items():
            if cfg.get('ao'): ROLES[role]['density'] = 0.3
        # S0004 09: roles in `flat_roles` (carved stone of statues, tracery, sculpted clouds: thousands of tiny islands whose packing margins would starve
        # the atlas) share one small patch of the atlas: an even colour, the game's lighting does their shading
        flat_objs = {r: parts.pop(r) for r in flat_roles if r in parts and len(parts) > 1}
        joined = unwrap_roles(parts, SIZE); joined.name = f'{name}_LOD0'
        if flat_objs:
            uvl = joined.data.uv_layers['atlas']
            for l in uvl.data: l.uv = (l.uv.x * 0.975, l.uv.y)
            for r, o in flat_objs.items():
                l = o.data.uv_layers.new(name='atlas')
                for d in l.data: d.uv = (0.9875, 0.5)
                for k in [k for k in o.data.uv_layers.keys() if k not in ('atlas', 'pat')]: o.data.uv_layers.remove(o.data.uv_layers[k])
            bpy.ops.object.select_all(action='DESELECT')
            for o in flat_objs.values(): o.select_set(True)
            joined.select_set(True); bpy.context.view_layer.objects.active = joined; bpy.ops.object.join(); joined = bpy.context.view_layer.objects.active
        log('atlas coverage', round(uv_coverage(joined) * 100, 1), '% ; texel density', round(texel_density(joined, SIZE), 1), 'px/m')
        tuv = None
        for role, o in tiling_objs.items():
            l = o.data.uv_layers.new(name='atlas')
            for p in l.data: p.uv = (0.9995, 0.9995)                           # no atlas space for repeating roles while baking (they still occlude)
        bpy.ops.object.select_all(action='DESELECT')
        for o in tiling_objs.values(): o.select_set(True)
        joined.select_set(True); bpy.context.view_layer.objects.active = joined
        if tiling_objs: bpy.ops.object.join()
        joined = bpy.context.view_layer.objects.active
        imgs = bake_atlas(joined, SIZE, tile_png, work)
        finish_images(imgs); save_images(imgs, work)
        mats = [_atlas_material(f'{name}_atlas', imgs)]; slot = {}
        for i, (role, cfg) in enumerate(tiling.items()):
            mats.append(_tiling_material(f'{name}_{role}', cfg, imgs)); slot[role] = i + 1
        me = joined.data
        me.materials.clear()
        for m in mats: me.materials.append(m)
        bm = bmesh.new(); bm.from_mesh(me); lay = bm.faces.layers.int.get('role'); puv = bm.loops.layers.uv['pat']; auv = bm.loops.layers.uv['atlas']
        want_ao = any(c.get('ao') for c in tiling.values())
        if want_ao: auv2 = bm.loops.layers.uv.new('ao')
        for f in bm.faces:
            role = ROLE_ORDER[f[lay]]
            if want_ao:
                for l in f.loops: l[auv2].uv = l[auv].uv.copy()
            if role in slot:
                f.material_index = slot[role]; per = tiling[role]['period']
                for l in f.loops: l[auv].uv = (l[puv].uv.x / per, l[puv].uv.y / per)
            else: f.material_index = 0
        bm.to_mesh(me); bm.free()
        me.uv_layers.remove(me.uv_layers['pat'])
        for r, d in old_density.items(): ROLES[r]['density'] = d
        mesh_obj = joined; flat_shade(mesh_obj)

    objs = [mesh_obj]
    for i, (pl, col) in enumerate(lods): objs.append(make_lod(mesh_obj, f'{name}_LOD{i + 1}', pl, col))
    for o in objs:                                                         # exporter warns "mesh not valid" for degenerate decimate output: clean it here
        bm = bmesh.new(); bm.from_mesh(o.data)
        bmesh.ops.dissolve_degenerate(bm, dist=1e-5, edges=bm.edges)
        bmesh.ops.delete(bm, geom=[f for f in bm.faces if f.calc_area() < 1e-9], context='FACES')
        bm.to_mesh(o.data); bm.free()
        fixed = o.data.validate(verbose=True, clean_customdata=False); log('validate', o.name, 'changed' if fixed else 'clean')
    log('triangles', [tri_count(o) for o in objs])
    if STAGE != 'geom': export_glb(objs, out_glb)
    if PREVIEWS and views:
        os.makedirs(PREVIEWS, exist_ok=True)
        preview_scene(objs)
        for o in objs[1:]: o.hide_render = True
        for vname, (eye, tgt, lens) in views.items(): render_view(os.path.join(PREVIEWS, f'{name}-{vname}.png'), eye, tgt, lens)
        if '--lods' in argv:
            for o in objs: o.hide_render = True
            for i, o in enumerate(objs):
                o.hide_render = False; vname = list(views)[0]; eye, tgt, lens = views[vname]; render_view(os.path.join(PREVIEWS, f'{name}-lod{i}.png'), eye, tgt, lens); o.hide_render = True
    log('done', round(time.time() - t0, 1), 's')
    return objs
