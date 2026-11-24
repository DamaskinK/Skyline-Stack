"""Shared helpers of the Blender model pipeline (ADR 0003). Run through Blender, never imported by the game:

    /Applications/Blender.app/Contents/MacOS/Blender -b --factory-startup -P scripts/blender/<model>.py -- <out.glb> [options]

Frame: models are written in GAME coordinates (1 unit = 1 m, x east, y up, z south, as in js/landmarks); `Build.V` maps them
to Blender's z-up frame, and the glTF exporter maps them back, so the GLB arrives in the same frame as the procedural landmarks.

Pipeline: closed shells per role (Build) -> Exact boolean (union of masses, cut windows and portals) -> bevel -> split by role ->
UV unwrap with a texel density per role -> pack one atlas -> Cycles bake (colour, AO, emission, roughness/metal) -> one material
-> LODs (Decimate) -> Draco GLB -> EEVEE previews.
"""
import bpy, bmesh, math, os, sys, time
from mathutils import Vector, Matrix

# ------------------------------------------------------------------ palette (mirrors js/landmarks/style.js)
def srgb(h):                                     # '#rrggbb' or 0xrrggbb -> linear RGBA for Blender colour sockets
    if isinstance(h, str): h = int(h.lstrip('#'), 16)
    c = [((h >> s) & 255) / 255 for s in (16, 8, 0)]
    c = [x / 12.92 if x <= 0.04045 else ((x + 0.055) / 1.055) ** 2.4 for x in c]
    return (c[0], c[1], c[2], 1.0)

PALETTE = {
    'stone': 0xcfc6ae, 'stoneDark': 0xa9a395, 'copper': 0x4f9a82, 'copperDark': 0x3f7f6f, 'gold': 0xe3b34a,
    'glass': 0x26323f, 'dark': 0x23272c, 'warm': 0xffc477,
    'tileYellow': 0xe0b43a, 'tileGreen': 0x3d8a52, 'tileRed': 0xc4412f, 'tileBlue': 0x2f5f9e, 'tileBlack': 0x262626,
}
TILE_PERIOD = 3.0                                # metres per repeat of the roof tile texture
# roles: atlas density (px per metre, relative), roughness, metalness, night emission (js glowMats colours), source colour
ROLES = {
    'stone':  dict(density=1.00, rough=0.88, metal=0.0, emit=(0x2a2418, 1.0)),
    'tiles':  dict(density=1.35, rough=0.50, metal=0.05, emit=(0x3a2e12, 1.0)),
    'copper': dict(density=0.55, rough=0.45, metal=0.30, emit=(0x1d4a3c, 1.0)),
    'gold':   dict(density=0.25, rough=0.35, metal=0.60, emit=(0x7a5a14, 1.0)),
    'glass':  dict(density=0.30, rough=0.30, metal=0.0, emit=(0xffc477, 0.9)),
    'dark':   dict(density=0.15, rough=0.9, metal=0.0, emit=(0x000000, 0.0)),
    'stone2': dict(density=1.00, rough=0.88, metal=0.0, emit=(0x2a2418, 1.0)),      # second masonry look (S0004 01: plaster vs dressed stone)
}
# Look of the two baked masonry roles; a model script updates these before assembling. bw/rh: block width and course height in metres.
STYLES = {
    'stone':  dict(c1=0xe4dac0, c2=0xd0c6aa, mortar=0xa89e86, bw=1.3, rh=0.55, msize=0.006, nz=0.2),
    'stone2': dict(c1=0xe4dac0, c2=0xd0c6aa, mortar=0xa89e86, bw=1.3, rh=0.55, msize=0.006, nz=0.2),
}
ROLE_ORDER = list(ROLES)

def cli():
    argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
    return argv

def log(*a): print('[blender]', *a, flush=True)

def reset():
    bpy.ops.wm.read_factory_settings(use_empty=True)

# ------------------------------------------------------------------ geometry kit (game coordinates)
class Build:
    """One bmesh of closed shells; every shell tagged with a role through a face attribute ('role' int)."""
    def __init__(self, name):
        self.name = name; self.bm = bmesh.new(); self.stack = [(0.0, 0.0, 0.0, 0.0)]; self.role = 'stone'
        self.lay = self.bm.faces.layers.int.new('role')

    class _At:
        def __init__(s, b, t): s.b, s.t = b, t
        def __enter__(s): s.b.stack.append(s.t)
        def __exit__(s, *a): s.b.stack.pop()
    def at(self, x=0.0, y=0.0, z=0.0, ry=0.0):          # nested placement: translate (in parent frame) then rotate about y
        px, py, pz, pry = self.stack[-1]
        c, s = math.cos(pry), math.sin(pry)
        return Build._At(self, (px + x * c + z * s, py + y, pz - x * s + z * c, pry + ry))
    def V(self, x, y, z):
        px, py, pz, ry = self.stack[-1]
        c, s = math.cos(ry), math.sin(ry)
        gx, gz = px + x * c + z * s, pz - x * s + z * c
        return self.bm.verts.new((gx, -gz, py + y))
    def _faces(self, vlists, role):
        fs = []
        for vl in vlists:
            try: f = self.bm.faces.new(vl)
            except ValueError: continue
            f[self.lay] = ROLE_ORDER.index(role or self.role); fs.append(f)
        bmesh.ops.recalc_face_normals(self.bm, faces=fs)
        return fs
    # ---- solids
    def prism(self, prof, z0, z1, role=None):                      # outline in local (x,y), extruded along local z
        a = [self.V(x, y, z0) for x, y in prof]; b = [self.V(x, y, z1) for x, y in prof]; n = len(prof)
        return self._faces([a[::-1], b] + [[a[i], a[(i + 1) % n], b[(i + 1) % n], b[i]] for i in range(n)], role)
    def plan(self, pts, y0, y1, role=None):                       # outline in local (x,z), extruded up
        a = [self.V(x, y0, z) for x, z in pts]; b = [self.V(x, y1, z) for x, z in pts]; n = len(pts)
        return self._faces([a, b] + [[a[i], a[(i + 1) % n], b[(i + 1) % n], b[i]] for i in range(n)], role)
    def box(self, x0, x1, y0, y1, z0, z1, role=None):
        return self.plan([(x0, z0), (x1, z0), (x1, z1), (x0, z1)], y0, y1, role)
    def cbox(self, cx, cz, sx, sz, y0, y1, role=None):
        return self.box(cx - sx / 2, cx + sx / 2, y0, y1, cz - sz / 2, cz + sz / 2, role)
    def pyramid(self, pts, y0, apex, role=None):                  # base outline (x,z) at y0, apex (x,y,z)
        a = [self.V(x, y0, z) for x, z in pts]; p = self.V(*apex); n = len(pts)
        return self._faces([a] + [[a[i], a[(i + 1) % n], p] for i in range(n)], role)
    def lathe(self, prof, n=8, rot=0.0, role=None, cap=True):    # profile (radius, y) bottom -> top about local y axis
        rings = []
        for r, y in prof:
            if r < 1e-4: rings.append(self.V(0, y, 0))
            else: rings.append([self.V(r * math.cos(rot + 2 * math.pi * i / n), y, r * math.sin(rot + 2 * math.pi * i / n)) for i in range(n)])
        fl = []
        for k in range(len(prof) - 1):
            A, B = rings[k], rings[k + 1]
            for i in range(n):
                j = (i + 1) % n
                if isinstance(A, list) and isinstance(B, list): fl.append([A[i], A[j], B[j], B[i]])
                elif isinstance(A, list): fl.append([A[i], A[j], B])
                else: fl.append([A, B[j], B[i]])
        if cap and isinstance(rings[0], list): fl.append(rings[0][::-1])
        if cap and isinstance(rings[-1], list): fl.append(rings[-1])
        return self._faces(fl, role)
    def beam(self, p0, p1, w, d, up=(0, 1, 0), role=None):       # rectangular bar between two local points, section w x d
        a, b = Vector(p0), Vector(p1); t = (b - a).normalized(); u = Vector(up)
        s = t.cross(u).normalized(); u = s.cross(t).normalized()
        pts = []
        for P in (a, b):
            for sx, uy in ((-1, -1), (1, -1), (1, 1), (-1, 1)):
                pts.append(P + s * (sx * w / 2) + u * (uy * d / 2))
        v = [self.V(*q) for q in pts]
        return self._faces([[v[3], v[2], v[1], v[0]], [v[4], v[5], v[6], v[7]]] + [[v[i], v[(i + 1) % 4], v[4 + (i + 1) % 4], v[4 + i]] for i in range(4)], role)

    def object(self, collection=None):
        me = bpy.data.meshes.new(self.name); self.bm.to_mesh(me)
        o = bpy.data.objects.new(self.name, me); (collection or bpy.context.scene.collection).objects.link(o)
        return o

def arch_profile(w, h, R_over_w=1.0, seg=5):
    """Pointed (two-centred) arch: width w, straight sides to height h, then the arch. R = R_over_w * w (1 = equilateral, >1 lancet)."""
    hw, R = w / 2, w * R_over_w
    cx = hw - R; rise = math.sqrt(max(2 * R * hw - hw * hw, 1e-6)); tmax = math.atan2(rise, -cx)
    right = [(cx + R * math.cos(tmax * k / seg), h + R * math.sin(tmax * k / seg)) for k in range(seg + 1)]   # spring -> apex
    pts = [(-hw, 0), (hw, 0)] + right[:-1] + [(0, h + rise)] + [(-x, y) for x, y in reversed(right[:-1])]
    return pts, h + rise

# ------------------------------------------------------------------ modifiers
def evaluated_copy(o):                              # apply all modifiers: replace the mesh with the evaluated one
    dg = bpy.context.evaluated_depsgraph_get(); e = o.evaluated_get(dg)
    me = bpy.data.meshes.new_from_object(e); old = o.data
    o.modifiers.clear(); o.data = me; bpy.data.meshes.remove(old)
    return o

def boolean(o, operand, op='DIFFERENCE', self_int=True):
    m = o.modifiers.new('bool', 'BOOLEAN'); m.operation = op; m.solver = 'EXACT'; m.use_self = self_int; m.object = operand
    return m

def union_self(o):                                  # resolve overlapping shells into one solid (winding-number boolean with an empty operand)
    d = bpy.data.objects.new('dummy', bpy.data.meshes.new('dummy')); bpy.context.scene.collection.objects.link(d)
    boolean(o, d); evaluated_copy(o); bpy.data.objects.remove(d)
    return o

def bevel_edges(o, width=0.1, angle_deg=35, seg=1):
    m = o.modifiers.new('bevel', 'BEVEL'); m.width = width; m.segments = seg; m.limit_method = 'ANGLE'; m.angle_limit = math.radians(angle_deg)
    m.harden_normals = False
    return m

def merge_close(o, d=0.002):
    bm = bmesh.new(); bm.from_mesh(o.data); bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=d); bm.to_mesh(o.data); bm.free()

def flat_shade(o):
    for p in o.data.polygons: p.use_smooth = False

# ------------------------------------------------------------------ roles, UVs, atlas
def assign_roles_by_normal(o, tiles_min_y=0.0):
    """After a boolean: sloped faces above `tiles_min_y` become tiles; the rest keeps its role."""
    bm = bmesh.new(); bm.from_mesh(o.data); lay = bm.faces.layers.int.get('role')
    for f in bm.faces:
        n = f.normal; c = f.calc_center_median()
        if 0.22 < n.z < 0.93 and c.z > tiles_min_y: f[lay] = ROLE_ORDER.index('tiles')
    bm.to_mesh(o.data); bm.free()

def pattern_uv(o, layer='pat'):
    """Per-corner UVs in metres on the surface: u along the horizontal tangent of the face, v up the slope. Drives stone courses and roof tiles."""
    me = o.data
    uv = me.uv_layers.get(layer) or me.uv_layers.new(name=layer)
    for p in me.polygons:
        n = p.normal; up = Vector((0, 0, 1))
        t = n.cross(up)
        if t.length < 1e-4: t = Vector((1, 0, 0))                      # horizontal face: x along
        t.normalize(); s = n.cross(t) if abs(n.z) < 0.999 else Vector((0, 1, 0))
        if s.z < 0: s = -s
        for li in p.loop_indices:
            P = me.vertices[me.loops[li].vertex_index].co
            uv.data[li].uv = (P.dot(t), P.dot(s))

def split_by_role(o):
    """Duplicate `o` per role holding only that role's faces. Returns {role: object}."""
    out = {}
    for ri, role in enumerate(ROLE_ORDER):
        bm = bmesh.new(); bm.from_mesh(o.data); lay = bm.faces.layers.int.get('role')
        dele = [f for f in bm.faces if f[lay] != ri]
        if len(dele) == len(bm.faces): bm.free(); continue
        bmesh.ops.delete(bm, geom=dele, context='FACES')
        me = bpy.data.meshes.new(f'{o.name}_{role}'); bm.to_mesh(me); bm.free()
        ob = bpy.data.objects.new(f'{o.name}_{role}', me); bpy.context.scene.collection.objects.link(ob); out[role] = ob
    return out

def _select_only(objs):
    bpy.ops.object.select_all(action='DESELECT')
    for ob in objs: ob.select_set(True)
    bpy.context.view_layer.objects.active = objs[0]

def unwrap_roles(parts, size_hint=2048):
    """Smart-UV each role object, scale its islands to its role density, then join all and pack one atlas. Returns the joined object."""
    for role, ob in parts.items():
        _select_only([ob]); bpy.ops.object.mode_set(mode='EDIT'); bpy.ops.mesh.select_all(action='SELECT')
        if 'atlas' not in ob.data.uv_layers: ob.data.uv_layers.new(name='atlas')
        ob.data.uv_layers.active = ob.data.uv_layers['atlas']
        bpy.ops.uv.smart_project(angle_limit=math.radians(80), island_margin=0.0008, area_weight=0.0, correct_aspect=True, scale_to_bounds=False)
        bpy.ops.object.mode_set(mode='OBJECT')
        # scale so uv area / world area = density^2 (ratio between roles)
        bm = bmesh.new(); bm.from_mesh(ob.data); uvl = bm.loops.layers.uv['atlas']; wa = ua = 0.0
        for f in bm.faces:
            wa += f.calc_area(); pts = [l[uvl].uv for l in f.loops]
            ua += abs(sum(pts[i].x * pts[(i + 1) % len(pts)].y - pts[(i + 1) % len(pts)].x * pts[i].y for i in range(len(pts)))) / 2
        k = ROLES[role]['density'] * math.sqrt(wa / max(ua, 1e-9)) if ua > 0 else 1.0
        for f in bm.faces:
            for l in f.loops: l[uvl].uv *= k
        bm.to_mesh(ob.data); bm.free()
    objs = list(parts.values()); _select_only(objs); bpy.ops.object.join()
    j = bpy.context.view_layer.objects.active
    bpy.ops.object.mode_set(mode='EDIT'); bpy.ops.mesh.select_all(action='SELECT')
    j.data.uv_layers.active = j.data.uv_layers['atlas']
    bpy.ops.uv.pack_islands(margin=0.0015, rotate=True, scale=True)
    bpy.ops.object.mode_set(mode='OBJECT')
    return j

def uv_coverage(o):
    bm = bmesh.new(); bm.from_mesh(o.data); uvl = bm.loops.layers.uv['atlas']; a = 0.0
    for f in bm.faces:
        pts = [l[uvl].uv for l in f.loops]
        a += abs(sum(pts[i].x * pts[(i + 1) % len(pts)].y - pts[(i + 1) % len(pts)].x * pts[i].y for i in range(len(pts)))) / 2
    bm.free(); return a

def texel_density(o, size):
    """Average atlas pixels per metre over the whole model."""
    bm = bmesh.new(); bm.from_mesh(o.data); wa = sum(f.calc_area() for f in bm.faces); bm.free()
    return math.sqrt(uv_coverage(o) / wa) * size

# ------------------------------------------------------------------ bake
def _tex_node(nt, img, loc=(0, 0)):
    n = nt.nodes.new('ShaderNodeTexImage'); n.image = img; n.location = loc; return n

def source_material(role, tile_png):
    """Cycles source material of a role: its colour pattern (read from the 'pat' UV map, in metres) into emission-free diffuse."""
    m = bpy.data.materials.new(f'src_{role}'); m.use_nodes = True; nt = m.node_tree
    for n in list(nt.nodes): nt.nodes.remove(n)
    out = nt.nodes.new('ShaderNodeOutputMaterial'); bsdf = nt.nodes.new('ShaderNodeBsdfPrincipled')
    nt.links.new(bsdf.outputs['BSDF'], out.inputs['Surface'])
    uvn = nt.nodes.new('ShaderNodeUVMap'); uvn.uv_map = 'pat'
    def col_rgb(h): return srgb(h)
    if role == 'tiles':
        mp = nt.nodes.new('ShaderNodeMapping'); mp.inputs['Scale'].default_value = (1 / TILE_PERIOD, 1 / TILE_PERIOD, 1)
        nt.links.new(uvn.outputs['UV'], mp.inputs['Vector'])
        img = bpy.data.images.load(tile_png); img.colorspace_settings.name = 'sRGB'
        t = _tex_node(nt, img); t.extension = 'REPEAT'; t.interpolation = 'Linear'
        nt.links.new(mp.outputs['Vector'], t.inputs['Vector']); nt.links.new(t.outputs['Color'], bsdf.inputs['Base Color'])
    elif role in ('stone', 'stone2'):
        # ashlar courses; per-block tint; slow noise for weathering (look from STYLES)
        st = STYLES[role]
        mp = nt.nodes.new('ShaderNodeMapping'); nt.links.new(uvn.outputs['UV'], mp.inputs['Vector'])
        b = nt.nodes.new('ShaderNodeTexBrick'); b.inputs['Scale'].default_value = 1.0
        b.inputs['Color1'].default_value = srgb(st['c1']); b.inputs['Color2'].default_value = srgb(st['c2']); b.inputs['Mortar'].default_value = srgb(st['mortar'])
        b.inputs['Mortar Size'].default_value = st['msize']; b.inputs['Mortar Smooth'].default_value = 0.4; b.inputs['Bias'].default_value = 0.0
        b.inputs['Brick Width'].default_value = st['bw']; b.inputs['Row Height'].default_value = st['rh']; b.offset = 0.5; b.offset_frequency = 2
        nt.links.new(mp.outputs['Vector'], b.inputs['Vector'])
        nz = nt.nodes.new('ShaderNodeTexNoise'); nz.inputs['Scale'].default_value = 0.8; nz.inputs['Detail'].default_value = 4
        nt.links.new(mp.outputs['Vector'], nz.inputs['Vector'])
        mx = nt.nodes.new('ShaderNodeMix'); mx.data_type = 'RGBA'; mx.blend_type = 'MULTIPLY'; mx.inputs['Factor'].default_value = st['nz']
        nt.links.new(b.outputs['Color'], mx.inputs['A']); nt.links.new(nz.outputs['Color'], mx.inputs['B'])
        nt.links.new(mx.outputs['Result'], bsdf.inputs['Base Color'])
    else:
        c = {'copper': PALETTE['copper'], 'gold': PALETTE['gold'], 'glass': PALETTE['glass'], 'dark': PALETTE['dark']}[role]
        if role == 'copper':
            mp = nt.nodes.new('ShaderNodeMapping'); nt.links.new(uvn.outputs['UV'], mp.inputs['Vector'])
            nz = nt.nodes.new('ShaderNodeTexNoise'); nz.inputs['Scale'].default_value = 1.5; nt.links.new(mp.outputs['Vector'], nz.inputs['Vector'])
            mx = nt.nodes.new('ShaderNodeMix'); mx.data_type = 'RGBA'; mx.inputs['A'].default_value = srgb(PALETTE['copperDark']); mx.inputs['B'].default_value = srgb(PALETTE.get('copperLight', 0x66b39a))
            nt.links.new(nz.outputs['Fac'], mx.inputs['Factor']); nt.links.new(mx.outputs['Result'], bsdf.inputs['Base Color'])
        else:
            bsdf.inputs['Base Color'].default_value = srgb(c)
    return m

def make_images(size):
    names = {}
    for k, fill in (('color', (0, 0, 0, 1)), ('ao', (1, 1, 1, 1)), ('emit', (0, 0, 0, 1)), ('orm', (1, 0.5, 0, 1))):
        names[k] = bpy.data.images.new(f'atlas_{k}', size, size, alpha=False, float_buffer=False)
        names[k].generated_color = fill
    return names

def bake(o, img, kind, margin=8, samples=24):
    """Bake `kind` ('DIFFUSE_COLOR', 'AO', 'EMIT') of object `o` into `img`; every material slot gets `img` as its active target node."""
    sc = bpy.context.scene
    for slot in o.material_slots:
        nt = slot.material.node_tree
        for n in [n for n in nt.nodes if n.name == 'BAKE_TARGET']: nt.nodes.remove(n)
        t = nt.nodes.new('ShaderNodeTexImage'); t.name = 'BAKE_TARGET'; t.image = img; nt.nodes.active = t
    _select_only([o])
    o.data.uv_layers.active = o.data.uv_layers['atlas']
    sc.render.engine = 'CYCLES'; sc.cycles.device = 'CPU'; sc.cycles.samples = samples; sc.cycles.use_denoising = False
    b = sc.render.bake; b.margin = margin; b.margin_type = 'EXTEND'; b.use_clear = True
    if kind == 'DIFFUSE_COLOR':
        b.use_pass_direct = False; b.use_pass_indirect = False; b.use_pass_color = True
        bpy.ops.object.bake(type='DIFFUSE')
    elif kind == 'AO': bpy.ops.object.bake(type='AO')
    else: bpy.ops.object.bake(type='EMIT')

def emit_material(role, mode):
    """Materials for the EMIT bakes: mode 'emit' = night glow colour of the role, mode 'orm' = (0, roughness, metal)."""
    m = bpy.data.materials.new(f'em_{mode}_{role}'); m.use_nodes = True; nt = m.node_tree
    for n in list(nt.nodes): nt.nodes.remove(n)
    out = nt.nodes.new('ShaderNodeOutputMaterial'); e = nt.nodes.new('ShaderNodeEmission'); nt.links.new(e.outputs['Emission'], out.inputs['Surface'])
    r = ROLES[role]
    if mode == 'emit':
        c = srgb(r['emit'][0]); e.inputs['Color'].default_value = (c[0] * r['emit'][1], c[1] * r['emit'][1], c[2] * r['emit'][1], 1)
    else:
        e.inputs['Color'].default_value = (0.0, r['rough'], r['metal'], 1)       # raw values; image is Non-Color
    return m

def set_materials(o, mats):                          # one material per role, slot index == ROLE_ORDER index
    o.data.materials.clear()                         # clearing resets polygon.material_index, so the roles are re-applied
    for m in mats: o.data.materials.append(m)
    slots_by_role(o, ROLE_ORDER)

def slots_by_role(o, roles_present):
    """Rebuild the material slots so polygon.material_index follows the role attribute."""
    bm = bmesh.new(); bm.from_mesh(o.data); lay = bm.faces.layers.int.get('role')
    for f in bm.faces: f.material_index = f[lay]
    bm.to_mesh(o.data); bm.free()

def bake_atlas(joined, size, tile_png, work):
    """Bakes colour, AO, emission and the roughness/metal map into images. Returns the images."""
    imgs = make_images(size)
    # colour
    set_materials(joined, [source_material(r, tile_png) for r in ROLE_ORDER]); t = time.time()
    bake(joined, imgs['color'], 'DIFFUSE_COLOR', samples=1); log('baked colour', round(time.time() - t, 1), 's')
    t = time.time(); bake(joined, imgs['ao'], 'AO', samples=48); log('baked AO', round(time.time() - t, 1), 's')
    set_materials(joined, [emit_material(r, 'emit') for r in ROLE_ORDER]); bake(joined, imgs['emit'], 'EMIT', samples=1)
    set_materials(joined, [emit_material(r, 'orm') for r in ROLE_ORDER]); imgs['orm'].colorspace_settings.name = 'Non-Color'
    bake(joined, imgs['orm'], 'EMIT', samples=1)
    return imgs

def finish_images(imgs, ao_in_colour=0.45, ao_gamma=1.0):
    """Multiply a little AO into the colour, put the AO into the red channel of the ORM map (glTF: R occlusion, G roughness, B metal)."""
    import numpy as np
    def px(i): return np.array(i.pixels[:], dtype=np.float32).reshape(-1, 4)
    col, ao, orm = px(imgs['color']), px(imgs['ao']), px(imgs['orm'])
    a = np.clip(ao[:, 0:1], 0, 1) ** ao_gamma
    col[:, :3] *= (1 - ao_in_colour) + ao_in_colour * a
    imgs['color'].pixels = col.ravel().tolist()
    orm[:, 0:1] = a; orm[:, 3] = 1.0
    imgs['orm'].pixels = orm.ravel().tolist()
    for i in imgs.values(): i.update()

def save_images(imgs, folder):
    for k, i in imgs.items():
        i.filepath_raw = os.path.join(folder, f'atlas_{k}.png'); i.file_format = 'PNG'; i.save()

def final_materials(imgs, tile_img):
    """Two materials: the atlas (base colour, ORM with glTF occlusion, emission) for everything unique, and the repeating roof tiles."""
    m = bpy.data.materials.new('cathedral_atlas'); m.use_nodes = True; nt = m.node_tree
    for n in list(nt.nodes): nt.nodes.remove(n)
    out = nt.nodes.new('ShaderNodeOutputMaterial'); bsdf = nt.nodes.new('ShaderNodeBsdfPrincipled')
    nt.links.new(bsdf.outputs['BSDF'], out.inputs['Surface'])
    def tex(img, cs):
        t = nt.nodes.new('ShaderNodeTexImage'); t.image = img; t.interpolation = 'Linear'; img.colorspace_settings.name = cs; return t
    tc, to, te = tex(imgs['color'], 'sRGB'), tex(imgs['orm'], 'Non-Color'), tex(imgs['emit'], 'sRGB')
    nt.links.new(tc.outputs['Color'], bsdf.inputs['Base Color'])
    sep = nt.nodes.new('ShaderNodeSeparateColor'); nt.links.new(to.outputs['Color'], sep.inputs['Color'])
    nt.links.new(sep.outputs['Green'], bsdf.inputs['Roughness']); nt.links.new(sep.outputs['Blue'], bsdf.inputs['Metallic'])
    nt.links.new(te.outputs['Color'], bsdf.inputs['Emission Color']); bsdf.inputs['Emission Strength'].default_value = 1.0
    g = bpy.data.node_groups.get('glTF Material Output') or bpy.data.node_groups.new('glTF Material Output', 'ShaderNodeTree')
    if 'Occlusion' not in [s.name for s in g.interface.items_tree]: g.interface.new_socket('Occlusion', in_out='INPUT', socket_type='NodeSocketFloat')
    gn = nt.nodes.new('ShaderNodeGroup'); gn.node_tree = g; gn.label = 'glTF Material Output'
    nt.links.new(sep.outputs['Red'], gn.inputs['Occlusion'])
    # roof tiles: one repeating texture, UVs in repeats (3 m per repeat)
    t = bpy.data.materials.new('cathedral_tiles'); t.use_nodes = True; tn = t.node_tree
    for n in list(tn.nodes): tn.nodes.remove(n)
    o2 = tn.nodes.new('ShaderNodeOutputMaterial'); b2 = tn.nodes.new('ShaderNodeBsdfPrincipled'); tn.links.new(b2.outputs['BSDF'], o2.inputs['Surface'])
    ti = tn.nodes.new('ShaderNodeTexImage'); ti.image = tile_img; ti.extension = 'REPEAT'; tile_img.colorspace_settings.name = 'sRGB'
    tn.links.new(ti.outputs['Color'], b2.inputs['Base Color']); b2.inputs['Roughness'].default_value = ROLES['tiles']['rough']; b2.inputs['Metallic'].default_value = ROLES['tiles']['metal']
    return m, t

# ------------------------------------------------------------------ LODs, export, previews
def make_lod(src, name, planar_deg, collapse=1.0):
    """LOD copy: planar dissolve (merges coplanar faces, keeps the shape and the UVs at island borders), then optional collapse."""
    d = src.copy(); d.data = src.data.copy(); d.name = name; bpy.context.scene.collection.objects.link(d)
    m = d.modifiers.new('plan', 'DECIMATE'); m.decimate_type = 'DISSOLVE'; m.angle_limit = math.radians(planar_deg); m.delimit = {'UV', 'MATERIAL'}
    if collapse < 1.0:
        c = d.modifiers.new('col', 'DECIMATE'); c.decimate_type = 'COLLAPSE'; c.ratio = collapse; c.use_collapse_triangulate = True
    t = d.modifiers.new('tri', 'TRIANGULATE')
    evaluated_copy(d); flat_shade(d); return d

def tri_count(o):
    me = o.data; me.calc_loop_triangles(); return len(me.loop_triangles)

def export_glb(objs, path, webp_quality=82):
    _select_only(objs)
    for ob in objs: ob.select_set(True)
    kw = dict(filepath=path, export_format='GLB', use_selection=True, export_apply=False, export_yup=True,
              export_draco_mesh_compression_enable=True, export_draco_mesh_compression_level=7,
              export_draco_position_quantization=14, export_draco_normal_quantization=8, export_draco_texcoord_quantization=12,
              export_image_format='WEBP', export_image_webp_fallback=False, export_image_quality=webp_quality,
              export_materials='EXPORT', export_cameras=False, export_lights=False)
    props = bpy.ops.export_scene.gltf.get_rna_type().properties
    kw = {k: v for k, v in kw.items() if k in props}
    missing = [k for k in ('export_image_quality', 'export_image_format') if k not in props]
    if missing: log('exporter lacks', missing)
    bpy.ops.export_scene.gltf(**kw)
    log('exported', path, os.path.getsize(path) // 1024, 'KB')

def preview_scene(objs, day=True):
    """World light, sun, EEVEE settings for previews."""
    sc = bpy.context.scene; sc.render.engine = 'BLENDER_EEVEE'
    w = bpy.data.worlds.new('w'); sc.world = w; w.use_nodes = True
    bg = w.node_tree.nodes['Background']; bg.inputs['Color'].default_value = (0.55, 0.72, 0.95, 1); bg.inputs['Strength'].default_value = 1.1
    sun = bpy.data.objects.new('sun', bpy.data.lights.new('sun', 'SUN')); sun.data.energy = 4.0; sun.data.angle = math.radians(3)
    sun.rotation_euler = (math.radians(55), 0, math.radians(-40)); bpy.context.scene.collection.objects.link(sun)
    # ground
    g = bpy.data.objects.new('ground', bpy.data.meshes.new('ground')); bpy.context.scene.collection.objects.link(g)
    bm = bmesh.new(); bmesh.ops.create_grid(bm, x_segments=1, y_segments=1, size=300); bm.to_mesh(g.data); bm.free()
    gm = bpy.data.materials.new('ground'); gm.use_nodes = True; gm.node_tree.nodes['Principled BSDF'].inputs['Base Color'].default_value = srgb(0x8a8f78)
    g.data.materials.append(gm)
    if day:
        for m in bpy.data.materials:
            if m.use_nodes and 'Principled BSDF' in m.node_tree.nodes: m.node_tree.nodes['Principled BSDF'].inputs['Emission Strength'].default_value = 0.0
    sc.render.resolution_x, sc.render.resolution_y = 1280, 800; sc.render.image_settings.file_format = 'PNG'
    try: sc.eevee.use_shadows = True
    except Exception: pass
    try: sc.view_settings.view_transform = 'AgX'
    except Exception: pass
    return sun

def render_view(path, eye, target, lens=40, ortho=None):
    sc = bpy.context.scene
    cam = bpy.data.objects.get('cam') or bpy.data.objects.new('cam', bpy.data.cameras.new('cam'))
    if cam.name not in sc.collection.objects: sc.collection.objects.link(cam)
    cam.data.lens = lens; cam.data.clip_end = 2000
    cam.data.type = 'ORTHO' if ortho else 'PERSP'
    if ortho: cam.data.ortho_scale = ortho
    ex, ey, ez = eye; tx, ty, tz = target
    cam.location = Vector((ex, -ez, ey)); d = Vector((tx, -tz, ty)) - cam.location
    cam.rotation_euler = d.to_track_quat('-Z', 'Y').to_euler()
    sc.camera = cam; sc.render.filepath = path; bpy.ops.render.render(write_still=True)
    log('rendered', path)

# ------------------------------------------------------------------ organic shapes (S0004 09): metaball sculpts for statues, clouds, cherubs
MB_K = 1 / 0.574                                     # metaball radius per visible radius (threshold 0.6, stiffness 2; measured)

class Sculpt:
    """Organic closed shell from metaballs, written in GAME coordinates like `Build`. Elements melt into each other (robes, limbs, clouds).
    `into(build, role)` converts it to a mesh (optional decimate) and appends it to a Build as one closed shell of that role.
    Each Sculpt is its own metaball family (unique base name), so separate sculpts never merge."""
    _n = 0
    def __init__(self, res=0.05):
        Sculpt._n += 1; name = f'sculpt{Sculpt._n}x'
        self.mb = bpy.data.metaballs.new(name); self.mb.resolution = res; self.mb.render_resolution = res; self.mb.threshold = 0.6
        self.ob = bpy.data.objects.new(name, self.mb); bpy.context.scene.collection.objects.link(self.ob)
        self.stack = [Matrix.Identity(4)]
    class _At:
        def __init__(s, sc, m): s.sc, s.m = sc, m
        def __enter__(s): s.sc.stack.append(s.sc.stack[-1] @ s.m)
        def __exit__(s, *a): s.sc.stack.pop()
    def at(self, x=0.0, y=0.0, z=0.0, ry=0.0, rx=0.0, rz=0.0, s=1.0):
        """Nested frame: translate, then rotate about y (as Build.at), then x, then z (game axes), uniform scale s."""
        m = Matrix.Translation((x, y, z)) @ Matrix.Rotation(ry, 4, 'Y') @ Matrix.Rotation(rx, 4, 'X') @ Matrix.Rotation(rz, 4, 'Z') @ Matrix.Scale(s, 4)
        return Sculpt._At(self, m)
    _G2B = Matrix(((1, 0, 0, 0), (0, 0, -1, 0), (0, 1, 0, 0), (0, 0, 0, 1)))
    def _el(self, typ, x, y, z, r, ax=0.0, ay=0.0, az=0.0, neg=False, stiff=2.0):
        M = self.stack[-1] @ Matrix.Translation((x, y, z)) @ Matrix.Rotation(ay, 4, 'Y') @ Matrix.Rotation(ax, 4, 'X') @ Matrix.Rotation(az, 4, 'Z')
        sc = M.to_scale()[0]; B = Sculpt._G2B @ M
        e = self.mb.elements.new(); e.type = typ; e.co = B.to_translation(); e.radius = r * sc * MB_K; e.stiffness = stiff
        q = (Sculpt._G2B.to_3x3() @ M.to_3x3().normalized() @ Sculpt._G2B.to_3x3().inverted()).to_quaternion(); e.rotation = q
        e.use_negative = neg
        return e, sc
    def ball(self, x, y, z, r, **k): self._el('BALL', x, y, z, r, **k)
    def ell(self, x, y, z, rx, ry, rz, **k):
        """Ellipsoid with radii along the local game axes x (east), y (up), z (south); ax, ay, az rotate it (radians)."""
        m = max(rx, ry, rz); e, sc = self._el('ELLIPSOID', x, y, z, m, **k)
        e.size_x, e.size_y, e.size_z = rx / m, rz / m, ry / m                 # game y -> blender z, game z -> blender -y
    def seg(self, p0, p1, r, **k):
        """Capsule (limb, fold, scroll) between two local points, radius r."""
        a, b = Vector(p0), Vector(p1); d = b - a; L = d.length / 2; c = (a + b) / 2
        # capsule axis = blender local x; build the game-frame rotation that sends +x to d
        q = Vector((1, 0, 0)).rotation_difference(d.normalized() if L > 1e-6 else Vector((1, 0, 0)))
        M = self.stack[-1] @ Matrix.Translation(c) @ q.to_matrix().to_4x4()
        sc = M.to_scale()[0]; B = Sculpt._G2B @ M
        e = self.mb.elements.new(); e.type = 'CAPSULE'; e.co = B.to_translation(); e.radius = r * sc * MB_K; e.stiffness = k.get('stiff', 2.0)
        R = Sculpt._G2B.to_3x3() @ M.to_3x3().normalized()
        e.rotation = R.to_quaternion(); e.size_x = L * sc; e.use_negative = k.get('neg', False)
    def mesh(self, ratio=1.0):
        """Evaluated metaball surface as a mesh in Blender world coordinates, optionally decimated (collapse ratio)."""
        dg = bpy.context.evaluated_depsgraph_get(); me = bpy.data.meshes.new_from_object(self.ob.evaluated_get(dg))
        bpy.data.objects.remove(self.ob); bpy.data.metaballs.remove(self.mb)
        if ratio < 1.0:
            o = bpy.data.objects.new('dec', me); bpy.context.scene.collection.objects.link(o)
            m = o.modifiers.new('d', 'DECIMATE'); m.ratio = ratio; m.use_collapse_triangulate = True
            evaluated_copy(o); me = o.data; bpy.data.objects.remove(o)
        return me
    def into(self, build, role, ratio=1.0):
        me = self.mesh(ratio); build.add_mesh(me, role); n = len(me.polygons); bpy.data.meshes.remove(me); return n

def _add_mesh(self, me, role=None):
    """Append a mesh (Blender world coordinates) to this Build as shells of one role."""
    vs = [self.bm.verts.new(v.co) for v in me.vertices]
    fs = []
    for p in me.polygons:
        try: f = self.bm.faces.new([vs[i] for i in p.vertices])
        except ValueError: continue
        f[self.lay] = ROLE_ORDER.index(role or self.role); fs.append(f)
    return fs
Build.add_mesh = _add_mesh

# ------------------------------------------------------------------ Gothic details shared by the cathedral and the chapel (S0004 09)
def arc_bar(b, pts, w, d, role='stone', closed=False):
    """Chain of bars through local points (x, y) in the plane z = 0 of the current frame, section w (in plane) x d (depth, along z)."""
    n = len(pts) if closed else len(pts) - 1
    for i in range(n):
        (x0, y0), (x1, y1) = pts[i], pts[(i + 1) % len(pts)]
        b.beam((x0, y0, 0), (x1, y1, 0), d, w, (0, 0, 1), role)

def circle_pts(cx, cy, r, n=12, a0=0.0, a1=2 * math.pi):
    full = abs(a1 - a0 - 2 * math.pi) < 1e-6
    k = n if full else n + 1
    return [(cx + r * math.cos(a0 + (a1 - a0) * i / n), cy + r * math.sin(a0 + (a1 - a0) * i / n)) for i in range(k)]

def tracery(b, w, h, R=1.1, lights=2, z=0.0, bar=0.16, d=0.22, role='stone'):
    """Window tracery in the plane z of the current frame: outer arch of a pointed window (width w, springing h, two-centred radius R*w),
    `lights` sub-lancets with their own pointed heads, and a ring (with an inner quatrefoil cusp) in the head. Bars are w x d."""
    with b.at(0, 0, z, 0):
        lw = w / lights
        for i in range(1, lights):                                            # mullions to the springing of the sub-arches
            x = -w / 2 + i * lw; b.beam((x, 0, 0), (x, h + lw * 0.55, 0), d, bar, (0, 0, 1), role)
        sub_h = h
        for i in range(lights):                                               # sub-arch heads
            cx = -w / 2 + (i + 0.5) * lw
            prof, top = arch_profile(lw, sub_h, 1.0, 4)
            head = [p for p in prof[2:]]                                       # spring -> apex -> spring
            arc_bar(b, [(cx + px, py) for px, py in [(lw / 2, sub_h)] + head + [(-lw / 2, sub_h)]], bar, d, role)
        # ring in the head between the sub-arches and the outer arch
        _, otop = arch_profile(w, h, R)
        sub_top = arch_profile(lw, sub_h, 1.0)[1]
        rr = max(0.2, min((otop - sub_top) * 0.42, w * 0.3)); cy = sub_top + rr * 0.95
        arc_bar(b, circle_pts(0, cy, rr, 12), bar * 0.9, d, role, closed=True)
        for k in range(4):                                                    # quatrefoil cusps: four small rings inside
            a = math.pi / 4 + k * math.pi / 2
            arc_bar(b, circle_pts(rr * 0.45 * math.cos(a), cy + rr * 0.45 * math.sin(a), rr * 0.36, 8), bar * 0.6, d * 0.8, role, closed=True)

def crockets(b, p0, p1, n, s=0.35, role='stone'):
    """Small leaf knobs (pyramids) along a line (gable rake, spire edge) between local points."""
    for i in range(n):
        t = (i + 0.5) / n; x, y, z = (p0[k] + (p1[k] - p0[k]) * t for k in range(3))
        b.pyramid([(x - s / 2, z - s / 2), (x + s / 2, z - s / 2), (x + s / 2, z + s / 2), (x - s / 2, z + s / 2)], y, (x, y + s * 1.1, z), role)

def openwork(b, cut, x0, x1, y0, y1, z, face_ry, t=0.28, role='stone', pitch=None):
    """Pierced Gothic balustrade (parapet) along local x from x0 to x1 at height y0..y1, centred on plane z of the current frame (rotated by face_ry about y).
    Quatrefoil holes cut through; a coping rail on top."""
    with b.at(0, 0, 0, face_ry):
        b.box(x0, x1, y0, y1, z - t / 2, z + t / 2, role)
        b.box(x0 - 0.05, x1 + 0.05, y1, y1 + 0.16, z - t / 2 - 0.08, z + t / 2 + 0.08, role)
    h = y1 - y0; s = h * 0.36; pitch = pitch or h * 0.95
    n = max(1, int((x1 - x0) / pitch)); step = (x1 - x0) / n; cy = (y0 + y1) / 2
    with cut.at(0, 0, 0, face_ry):
        for i in range(n):
            cx = x0 + (i + 0.5) * step
            with cut.at(cx, cy, z, 0):
                cut.prism([(s * (0.6 + 0.4 * abs(math.cos(2 * a))) * math.cos(a), s * (0.6 + 0.4 * abs(math.cos(2 * a))) * math.sin(a)) for a in (2 * math.pi * k / 16 for k in range(16))],
                          -t / 2 - 0.06, t / 2 + 0.06)             # quatrefoil
