"""Kosice house modules (S0004 02): the kit the near ring assembles its houses from. Run (ADR 0003):

    Blender -b --factory-startup -P scripts/blender/housekit.py -- assets/levels/kosice/housekit.glb [--previews <dir>]

One node per module, all in a module frame: x along the wall (0..3 m, one bay), y up (0..3.4 m, one storey), z out of the wall (the wall plane is z = 0,
the building lies at z < 0). The game instances a module along every footprint edge (js/house-kit.ts), stretching it a little in x so whole bays fill the wall.
Materials are role classes, not final colours: `kit_plaster` and `kit_accent` are tinted per instance (pastel plaster; accent / roof colour), `kit_detail` carries its own
colours in the vertex colours (frames, stone plinth, railings, doors), `kit_glass` is the window pane (lit at night, per instance). Vertex colours also carry a hand-set
occlusion (reveals and recesses darker), so the geometry reads without textures. Three kits:
  old    Hlavna burgher houses (Wikimedia Commons "Kosice - Hlavna ulica 16": pilaster strips, window surrounds with pediments, cornice, shop portals and an arched gate).
  panel  Czechoslovak prefab blocks of Terasa and Juzna (K 61 on Terasa, Bukovecka: white joint grid, twin windows, loggia and balcony stacks, stair cores, entrance canopy).
  mid    1930s-50s blocks of Kulturpark / Juzna (plaster, stone plinth, tall paired windows, string course).
Every near module has a `_far` partner: a flat plate with painted windows, for the houses beyond the detail radius and for Low.
"""
import os, sys, math
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import bpy, bmesh
from mathutils import Vector
from lib import reset, cli, log, srgb, export_glb, preview_scene, render_view

W, H = 3.0, 3.4
ROLE = {                      # role -> (material class, vertex colour sRGB hex)
    'plaster': ('plaster', 0xffffff), 'accent': ('accent', 0xffffff),
    'trim': ('detail', 0xf0ebdd), 'frame': ('detail', 0xf4f4f0), 'stone': ('detail', 0x8a8478), 'dark': ('detail', 0x2a2d32), 'door': ('detail', 0x5a3c28),
    'metal': ('detail', 0x4b4e54), 'joint': ('detail', 0xeceae2), 'slab': ('detail', 0xb9b5aa), 'glass': ('glass', 0xffffff),
}
CLASSES = ['plaster', 'accent', 'detail', 'glass']
ROLES = list(ROLE)
PI = math.pi

class Mod:
    """One module: faces tagged with a role and a hand-set occlusion; to_object writes UVs (metres), vertex colours and material slots."""
    def __init__(self, name):
        self.name = name; self.bm = bmesh.new(); self.rl = self.bm.faces.layers.int.new('role'); self.al = self.bm.faces.layers.float.new('ao')
    def V(self, x, y, z): return self.bm.verts.new((x, -z, y))                              # game (x east, y up, z south) -> Blender (x, -z, y)
    def face(self, pts, role, ao=1.0, n=None):
        """One polygon, counter-clockwise seen from outside; with `n` (expected normal, game coordinates) the order is flipped when it faces the other way."""
        if n is not None:
            a, b, c = [Vector(p) for p in pts[:3]]; g = (b - a).cross(c - a)
            # game coordinates are right-handed too (x east, y up, z south), so the plain cross product tells the side
            if g.dot(Vector(n)) < 0: pts = pts[::-1]
        try: f = self.bm.faces.new([self.V(*p) for p in pts])
        except ValueError: return None
        f[self.rl] = ROLES.index(role); f[self.al] = ao; return f
    def solid(self, faces, role, ao=1.0):                                                    # closed shell: let Blender orient it
        fs = []
        for pts in faces:
            try: f = self.bm.faces.new([self.V(*p) for p in pts])
            except ValueError: continue
            f[self.rl] = ROLES.index(role); f[self.al] = ao; fs.append(f)
        bmesh.ops.recalc_face_normals(self.bm, faces=fs)
    def sbox(self, x0, x1, y0, y1, z0, z1, role, skip='', ao=None):
        """Box with only the faces that can be seen: skip any of 'f' (+z) 'b' (-z) 'l' (-x) 'r' (+x) 't' (+y) 'u' (-y); ao: {face: occlusion}."""
        ao = ao or {}
        F = {'f': [(x0, y0, z1), (x1, y0, z1), (x1, y1, z1), (x0, y1, z1)], 'b': [(x1, y0, z0), (x0, y0, z0), (x0, y1, z0), (x1, y1, z0)],
             'r': [(x1, y0, z1), (x1, y0, z0), (x1, y1, z0), (x1, y1, z1)], 'l': [(x0, y0, z0), (x0, y0, z1), (x0, y1, z1), (x0, y1, z0)],
             't': [(x0, y1, z1), (x1, y1, z1), (x1, y1, z0), (x0, y1, z0)], 'u': [(x0, y0, z0), (x1, y0, z0), (x1, y0, z1), (x0, y0, z1)]}
        for k, pts in F.items():
            if k not in skip: self.face(pts, role, ao.get(k, 1.0))
    def prism(self, prof, z0, z1, role, ao=1.0):                                             # profile in (x, y) extruded along z
        a = [(x, y, z0) for x, y in prof]; b = [(x, y, z1) for x, y in prof]; n = len(prof)
        self.solid([a, b] + [[a[i], a[(i + 1) % n], b[(i + 1) % n], b[i]] for i in range(n)], role, ao)
    def lprism(self, prof, x0, x1, role, ao=1.0):                                            # profile in (z, y) extruded along x
        a = [(x0, y, z) for z, y in prof]; b = [(x1, y, z) for z, y in prof]; n = len(prof)
        self.solid([a, b] + [[a[i], a[(i + 1) % n], b[(i + 1) % n], b[i]] for i in range(n)], role, ao)
    def strip(self, prof, x0, x1, role, ao=1.0):
        """Open band along x: one quad per segment of the (z, y) profile, walked so that the visible side is on the right (bottom outwards, up the front, back along the top).
        No end caps and no back: neighbouring bays hide them."""
        for (z0, y0), (z1, y1) in zip(prof, prof[1:]):
            self.face([(x0, y0, z0), (x1, y0, z0), (x1, y1, z1), (x0, y1, z1)], role, ao)

    def to_object(self, mats):
        bm = self.bm
        uv = bm.loops.layers.uv.new('UVMap'); col = bm.loops.layers.float_color.new('Col')
        for f in bm.faces:
            n = f.normal; role = ROLES[f[self.rl]]; ao = f[self.al]; cls, hexc = ROLE[role]
            c = srgb(hexc); c = (c[0] * ao, c[1] * ao, c[2] * ao, 1.0)
            f.material_index = CLASSES.index(cls)
            ax, ay, az = abs(n.x), abs(n.y), abs(n.z)                                          # Blender normal: x = game x, y = -game z, z = game y
            for l in f.loops:
                p = l.vert.co; gx, gy, gz = p.x, p.z, -p.y
                if ay >= ax and ay >= az: l[uv].uv = (gx, gy)                                  # faces towards +/-game z: along the wall
                elif ax >= az: l[uv].uv = (gz, gy)                                             # faces towards +/-game x
                else: l[uv].uv = (gx, gz)                                                      # faces up or down
                l[col] = c
        me = bpy.data.meshes.new(self.name); bm.to_mesh(me); bm.free()
        for p in me.polygons: p.use_smooth = False
        ob = bpy.data.objects.new(self.name, me); bpy.context.scene.collection.objects.link(ob)
        for m in mats: me.materials.append(m)
        return ob

# ------------------------------------------------------------------ building blocks
def opening_wall(m, ox0, ox1, oy0, oy1, depth, x0=0.0, x1=W, y0=0.0, y1=H, role='plaster', ao=0.62):
    """Front plate of a bay with a rectangular opening `depth` deep; reveals included. Only the faces that can be seen."""
    z0 = -depth
    if ox0 > x0: m.sbox(x0, ox0, y0, y1, z0, 0, role, skip='blut', ao={'r': ao})
    if x1 > ox1: m.sbox(ox1, x1, y0, y1, z0, 0, role, skip='brut', ao={'l': ao})
    if oy0 > y0: m.sbox(ox0, ox1, y0, oy0, z0, 0, role, skip='blru', ao={'t': ao})
    if y1 > oy1: m.sbox(ox0, ox1, oy1, y1, z0, 0, role, skip='blrt', ao={'u': ao * 0.8})

def pane(m, x0, x1, y0, y1, z, role='glass', ao=1.0): m.face([(x0, y0, z), (x1, y0, z), (x1, y1, z), (x0, y1, z)], role, ao)

def window(m, cx, sill, w, h, depth, mull=1, trans=0, bar=0.06, frame='frame', z_glass=None):
    """Glazed opening with a white frame: glass plane at the back, frame bars in front of it. The opening is already cut in the wall."""
    zg = -depth + 0.02 if z_glass is None else z_glass; x0, x1, y0, y1 = cx - w / 2, cx + w / 2, sill, sill + h
    pane(m, x0, x1, y0, y1, zg)
    zf = zg + 0.05                                                                                # frame bars are flat strips just in front of the glass (a bar's sides are 5 cm deep: not worth triangles)
    def bar_(a0, a1, b0, b1): m.face([(a0, b0, zf), (a1, b0, zf), (a1, b1, zf), (a0, b1, zf)], frame)
    bar_(x0, x1, y0, y0 + bar); bar_(x0, x1, y1 - bar, y1); bar_(x0, x0 + bar, y0 + bar, y1 - bar); bar_(x1 - bar, x1, y0 + bar, y1 - bar)
    for i in range(mull):
        mx = x0 + w * (i + 1) / (mull + 1); bar_(mx - bar / 2, mx + bar / 2, y0 + bar, y1 - bar)
    for i in range(trans):
        my = y0 + h * (i + 1) / (trans + 1); bar_(x0 + bar, x1 - bar, my - bar / 2, my + bar / 2)

def sill_and_surround(m, cx, sill, w, h, pilaster=False, style=None, trim='trim'):
    """Projecting sill, flat surround, optional pediment and pilaster strips of an old-town bay."""
    x0, x1 = cx - w / 2, cx + w / 2
    m.sbox(x0 - 0.12, x1 + 0.12, sill - 0.12, sill, 0, 0.16, trim, skip='b', ao={'u': 0.7})        # sill
    s = 0.11; yb, yt = sill, sill + h
    m.sbox(x0 - s, x0, yb, yt + s, 0, 0.06, trim, skip='blubr'); m.sbox(x1, x1 + s, yb, yt + s, 0, 0.06, trim, skip='blubr'); m.sbox(x0 - s, x1 + s, yt, yt + s, 0, 0.08, trim, skip='blrub')   # surround: flat strips
    if style == 'tri':
        m.prism([(x0 - s - 0.14, yt + s), (x1 + s + 0.14, yt + s), (cx, yt + s + 0.42)], 0, 0.1, trim)
        m.sbox(cx - 0.1, cx + 0.1, yt + s + 0.1, yt + s + 0.28, 0.1, 0.11, 'plaster', skip='blrtub')
    elif style == 'seg':
        r = w / 2 + s + 0.14; pts = [(cx - r, yt + s)] + [(cx - r * math.cos(PI * k / 6), yt + s + 0.3 * math.sin(PI * k / 6)) for k in range(1, 6)] + [(cx + r, yt + s)]
        m.face([(x, y, 0.1) for x, y in pts], 'trim', n=(0, 0, 1))                               # front, then the curved top as quads facing away from the chord
        for (xa, ya), (xb, yb2) in zip(pts, pts[1:]):
            m.face([(xa, ya, 0.0), (xb, yb2, 0.0), (xb, yb2, 0.1), (xa, ya, 0.1)], 'trim', n=(-(yb2 - ya), xb - xa, 0))
        m.face([(pts[0][0], pts[0][1], 0.0), (pts[-1][0], pts[-1][1], 0.0), (pts[-1][0], pts[-1][1], 0.1), (pts[0][0], pts[0][1], 0.1)], 'trim', n=(0, -1, 0))
    elif style == 'cornice':
        m.sbox(x0 - s - 0.12, x1 + s + 0.12, yt + s, yt + s + 0.1, 0, 0.17, trim, skip='b', ao={'u': 0.7})
    if pilaster:
        m.sbox(0, 0.15, 0, H, 0, 0.07, trim, skip='blub'); m.sbox(W - 0.15, W, 0, H, 0, 0.07, trim, skip='brub')

def plate(m, role='plaster', x0=0.0, x1=W, y0=0.0, y1=H):                                         # front face only
    m.sbox(x0, x1, y0, y1, -0.05, 0, role, skip='blrtub')

def far_plate(m, windows, band=None):
    """Distant version: one plate with flat painted windows (a frame-coloured quad with the glass inside it). The quads stand 4 and 8 cm off the plate:
    at 200 m the depth buffer resolves about 5 mm, so smaller gaps would flicker."""
    plate(m); m.sbox(0, W, 0, H, -0.05, 0, 'plaster', skip='flrtu', ao={'b': 0.5})
    for (cx, sill, w, h) in windows:
        m.face([(cx - w / 2 - 0.06, sill - 0.06, 0.04), (cx + w / 2 + 0.06, sill - 0.06, 0.04), (cx + w / 2 + 0.06, sill + h + 0.06, 0.04), (cx - w / 2 - 0.06, sill + h + 0.06, 0.04)], 'frame')
        pane(m, cx - w / 2, cx + w / 2, sill, sill + h, 0.08)
    if band: m.face([(0, band[0], 0.04), (W, band[0], 0.04), (W, band[1], 0.04), (0, band[1], 0.04)], 'trim')

def joints(m, y0=0.0, y1=H):                                                                       # the white joint grid of a prefab wall: left and bottom edge of each panel
    z = 0.03
    m.face([(0, y0, z), (0.05, y0, z), (0.05, y1, z), (0, y1, z)], 'joint'); m.face([(0, y0, z), (W, y0, z), (W, y0 + 0.05, z), (0, y0 + 0.05, z)], 'joint')

MODS = {}
CLOSED = ('old_cornice', 'old_parapet', 'old_dormer', 'pn_edge', 'pn_foot', 'mid_cornice', 'mid_parapet')    # bands and roof pieces get no interior wall
def module(name):
    m = Mod(name); MODS[name] = m; return m
def close_inside(m):
    """Interior wall 0.95 m behind the facade, facing into the house. Without it a camera inside a footprint would look at the back of every recess (thin slivers of reveals,
    frame bars); with it the inside of a house is a plain dim wall, as the walls of the old procedural houses looked from inside."""
    m.sbox(0, W, 0, H, -0.95, -0.9, 'plaster', skip='flrtu', ao={'b': 0.5})

# ================================================================== OLD TOWN (Hlavna)
WIN_W, WIN_H, SILL = 1.1, 1.78, 0.86
for nm, st, pl in (('old_bay_a', None, False), ('old_bay_b', 'cornice', True), ('old_bay_c', 'tri', True), ('old_bay_d', 'seg', True)):
    m = module(nm)
    opening_wall(m, 1.5 - WIN_W / 2, 1.5 + WIN_W / 2, SILL, SILL + WIN_H, 0.22)
    window(m, 1.5, SILL, WIN_W, WIN_H, 0.22, mull=1, trans=1)
    sill_and_surround(m, 1.5, SILL, WIN_W, WIN_H, pl, st)

m = module('old_shop')                                                                             # ground floor: shop portal with fascia, stone plinth
opening_wall(m, 0.35, 2.65, 0.18, 2.72, 0.32, ao=0.55)
pane(m, 0.35, 2.65, 0.18, 2.72, -0.30, 'glass')
m.sbox(0.35, 2.65, 0.18, 0.3, -0.3, -0.14, 'dark', skip='bu'); m.sbox(0.35, 0.5, 0.3, 2.72, -0.3, -0.14, 'frame', skip='bl'); m.sbox(2.5, 2.65, 0.3, 2.72, -0.3, -0.14, 'frame', skip='br')
m.sbox(1.42, 1.58, 0.3, 2.72, -0.3, -0.14, 'frame', skip='b'); m.sbox(0.5, 2.5, 2.4, 2.5, -0.3, -0.14, 'frame', skip='b')
m.sbox(0, W, 0, 0.18, -0.3, 0.07, 'stone', skip='blru', ao={'t': 0.8})                              # plinth
m.sbox(0.18, 2.82, 2.72, 3.12, 0, 0.12, 'trim', skip='bu')                                         # fascia over the portal
m.sbox(0, 0.28, 0.18, 2.72, 0, 0.07, 'trim', skip='blub'); m.sbox(2.72, W, 0.18, 2.72, 0, 0.07, 'trim', skip='brub')
m.sbox(0, W, 3.28, H, 0, 0.1, 'trim', skip='bu')                                                    # string course under the first floor

m = module('old_gate')                                                                             # arched passage / door with a keystone
plate(m)
c0 = (1.5, 1.95)
def arc(r, steps=10): return [(c0[0] + r * math.cos(PI * k / steps), c0[1] + r * math.sin(PI * k / steps)) for k in range(steps + 1)]
m.face([(0.45, 0.0, 0.02), (2.55, 0.0, 0.02)] + [(x, y, 0.02) for x, y in arc(1.05)], 'dark', 0.8)
m.face([(0.6, 0.0, 0.04), (2.4, 0.0, 0.04)] + [(x, y, 0.04) for x, y in arc(0.9)], 'door', 0.9)
ri, ro = arc(1.05), arc(1.2)
for k in range(10):
    a, b, c, d = ri[k], ro[k], ro[k + 1], ri[k + 1]
    m.face([(a[0], a[1], 0.08), (b[0], b[1], 0.08), (c[0], c[1], 0.08), (d[0], d[1], 0.08)], 'trim')
    m.face([(b[0], b[1], 0.0), (c[0], c[1], 0.0), (c[0], c[1], 0.08), (b[0], b[1], 0.08)], 'trim')       # outer edge of the ring
    m.face([(d[0], d[1], 0.0), (a[0], a[1], 0.0), (a[0], a[1], 0.08), (d[0], d[1], 0.08)], 'trim', 0.7)  # inner edge
m.sbox(0.4, 0.55, 0.18, 1.95, 0, 0.08, 'trim', skip='bu'); m.sbox(2.45, 2.6, 0.18, 1.95, 0, 0.08, 'trim', skip='bu')
m.sbox(1.4, 1.6, 3.0, 3.25, 0, 0.12, 'trim', skip='bu')
m.sbox(0, W, 0, 0.18, -0.05, 0.07, 'stone', skip='blru'); m.sbox(0, W, 3.28, H, 0, 0.1, 'trim', skip='bu')

m = module('old_cornice')                                                                          # eaves cornice, 0.52 m high, its top sits at the top of the last storey
m.strip([(-0.05, 0.0), (0.1, 0.0), (0.1, 0.2), (0.3, 0.3), (0.3, 0.42), (0.12, 0.52), (-0.05, 0.52)], 0, W, 'trim', 0.95)
m = module('old_parapet')                                                                          # attic parapet over a flat roof, 0.5 m
m.strip([(-0.05, 0.0), (0.12, 0.0), (0.12, 0.42), (0.2, 0.42), (0.2, 0.5), (-0.05, 0.5), (-0.05, 0.0)], 0, W, 'plaster')

m = module('old_dormer')                                                                           # roof dormer: front face at z = 0, gable roof in the accent colour (the tile colour of the house)
opening_wall(m, 0.22, 1.08, 0.3, 1.02, 0.1, x1=1.3, y1=1.25, ao=0.6)
window(m, 0.65, 0.3, 0.86, 0.72, 0.1, mull=1, bar=0.05)
m.sbox(0.1, 1.2, 0.2, 0.3, 0, 0.1, 'trim', skip='bu')
m.sbox(0, 1.3, 0, 1.25, -1.4, -0.1, 'plaster', skip='fbtu')                                        # cheeks
m.face([(-0.05, 1.25, 0.0), (1.35, 1.25, 0.0), (0.65, 1.9, 0.0)], 'plaster')                        # gable triangle
m.face([(-0.05, 1.25, 0.1), (-0.05, 1.25, -1.55), (0.65, 1.9, -1.55), (0.65, 1.9, 0.1)], 'accent', n=(-0.65, 0.7, 0))
m.face([(1.35, 1.25, -1.55), (1.35, 1.25, 0.1), (0.65, 1.9, 0.1), (0.65, 1.9, -1.55)], 'accent', n=(0.65, 0.7, 0))
far = module('old_far'); far_plate(far, [(1.5, SILL, WIN_W, WIN_H)], band=(3.28, H))
far = module('old_shop_far'); far_plate(far, [(1.5, 0.3, 2.2, 2.3)], band=(2.72, 3.12))

# ================================================================== PANEL BLOCKS (Terasa, Juzna)
PW, PH, PSILL = 1.5, 1.36, 0.9
def panel_window(m, cx=1.5, sill=PSILL, w=PW, h=PH, depth=0.14):
    opening_wall(m, cx - w / 2, cx + w / 2, sill, sill + h, depth, ao=0.6)
    window(m, cx, sill, w, h, depth, mull=1, bar=0.055)
    m.sbox(cx - w / 2 - 0.06, cx + w / 2 + 0.06, sill - 0.07, sill, 0, 0.12, 'slab', skip='b', ao={'u': 0.7})
m = module('pn_win'); panel_window(m); joints(m)
m = module('pn_blank'); panel_window(m, 1.5, 1.2, 0.62, 0.9, 0.1); joints(m)                                 # end wall: small kitchen / stair window
m = module('pn_core')                                                                              # stair core: a tall narrow glazed strip, accent piers
opening_wall(m, 1.0, 2.0, 0.55, 3.0, 0.12, ao=0.6); window(m, 1.5, 0.55, 1.0, 2.45, 0.12, mull=1, trans=3, bar=0.05)
m.sbox(0, 0.5, 0, H, 0, 0.06, 'accent', skip='blrub'); m.sbox(2.5, W, 0, H, 0, 0.06, 'accent', skip='blrub'); joints(m)
m = module('pn_door')                                                                              # entrance: glazed door in the core, canopy slab over it, a step
opening_wall(m, 0.9, 2.1, 0.0, 2.25, 0.25, ao=0.55)
window(m, 1.5, 0.0, 1.2, 2.25, 0.25, mull=1, bar=0.07)
m.sbox(0.5, 2.5, 2.35, 2.5, -0.1, 0.85, 'slab', ao={'u': 0.7}); m.sbox(0.5, 2.5, 2.5, 2.58, 0.77, 0.85, 'metal', skip='b')
m.sbox(0.6, 2.4, 0, 0.15, 0, 0.45, 'slab', skip='bu')
m.sbox(0, 0.5, 0, H, 0, 0.06, 'accent', skip='blrub'); m.sbox(2.5, W, 0, H, 0, 0.06, 'accent', skip='blrub'); joints(m)
m = module('pn_loggia')                                                                            # recessed loggia: slab, back wall with door and window, railing with accent infill
dd = 0.85; opening_wall(m, 0.4, 2.6, 0.3, 3.1, dd, ao=0.5)
m.sbox(0.4, 2.6, 0.0, 0.3, -dd, 0.12, 'slab', skip='bu', ao={'t': 0.9})                              # floor slab (projects 12 cm)
window(m, 1.0, 0.3, 0.8, 2.0, dd, mull=0, trans=2, bar=0.05); window(m, 2.0, 1.0, 0.9, 1.1, dd, mull=1, bar=0.05)
pane(m, 1.4, 1.6, 0.3, 3.1, -dd + 0.02, 'glass', 0.5)                                                # the gap between door and window: dark wall
m.sbox(0.4, 2.6, 0.3, 1.1, 0.02, 0.1, 'accent', skip='bu'); m.sbox(0.4, 2.6, 1.1, 1.18, 0.0, 0.12, 'frame', skip='bu')
joints(m)
m = module('pn_balcony')                                                                           # glazed bay with a projecting balcony (white rail, accent infill)
opening_wall(m, 0.35, 2.65, 0.2, 2.5, 0.14, ao=0.6)
window(m, 1.5, 0.2, 2.3, 2.3, 0.14, mull=2, trans=0, bar=0.05)
m.sbox(0.2, 2.8, 0.0, 0.14, -0.05, 0.85, 'slab', skip='b', ao={'u': 0.7})
m.sbox(0.2, 2.8, 0.14, 1.1, 0.79, 0.85, 'accent', skip='bu'); m.sbox(0.2, 0.26, 0.14, 1.1, 0.0, 0.85, 'frame', skip='b'); m.sbox(2.74, 2.8, 0.14, 1.1, 0.0, 0.85, 'frame', skip='b')
m.sbox(0.2, 2.8, 1.1, 1.16, 0.0, 0.85, 'frame', skip='bu'); joints(m)
m = module('pn_edge')                                                                              # attic band and roof edge, 0.82 m, stands on top of the wall
m.strip([(-0.05, 0.0), (0.12, 0.0), (0.12, 0.7), (0.22, 0.72), (0.22, 0.82), (-0.05, 0.82), (-0.05, 0.0)], 0, W, 'plaster')
m = module('pn_foot'); m.sbox(0, W, 0, 0.5, -0.05, 0.05, 'stone', skip='blrub', ao={'t': 0.8})      # plinth band over the ground storey
far = module('pn_far'); far_plate(far, [(1.5, PSILL, PW, PH)]); joints(far)

# ================================================================== IN-BETWEEN BLOCKS (1930s-50s)
m = module('mid_bay')
opening_wall(m, 0.4, 2.6, 0.95, 2.5, 0.18, ao=0.6)
window(m, 1.5, 0.95, 2.2, 1.55, 0.18, mull=1, trans=1, bar=0.06)
m.sbox(0.35, 2.65, 0.88, 0.95, 0, 0.1, 'trim', skip='b', ao={'u': 0.7}); m.sbox(0, W, 3.2, H, 0, 0.06, 'trim', skip='bu')
m = module('mid_ground')
opening_wall(m, 0.4, 2.6, 0.95, 2.5, 0.2, ao=0.6, y0=0.9)
m.sbox(0, W, 0, 0.9, -0.2, 0.08, 'stone', skip='blru', ao={'t': 0.85})
window(m, 1.5, 0.95, 2.2, 1.55, 0.2, mull=1, trans=1, bar=0.06)
m.sbox(0, W, 3.2, H, 0, 0.06, 'trim', skip='bu')
m = module('mid_door')                                                                             # entrance with canopy and a step
opening_wall(m, 0.8, 2.2, 0.0, 2.3, 0.3, ao=0.5); window(m, 1.5, 0.0, 1.4, 2.3, 0.3, mull=1, bar=0.07)
m.sbox(0.6, 2.4, 2.4, 2.55, -0.1, 0.85, 'slab', ao={'u': 0.7}); m.sbox(0.5, 2.5, 0, 0.14, 0, 0.45, 'slab', skip='bu')
m.sbox(0, W, 3.2, H, 0, 0.06, 'trim', skip='bu')
m = module('mid_cornice'); m.strip([(-0.05, 0.0), (0.1, 0.0), (0.1, 0.12), (0.22, 0.2), (0.22, 0.4), (-0.05, 0.4)], 0, W, 'trim', 0.95)
m = module('mid_parapet'); m.strip([(-0.05, 0.0), (0.1, 0.0), (0.1, 0.5), (0.16, 0.5), (0.16, 0.56), (-0.05, 0.56), (-0.05, 0.0)], 0, W, 'plaster')
far = module('mid_far'); far_plate(far, [(1.0, 0.95, 0.95, 1.55), (2.0, 0.95, 0.95, 1.55)], band=(3.2, H))

# ------------------------------------------------------------------ export and previews
def make_mats():
    mats = []
    for c in CLASSES:
        mt = bpy.data.materials.new(f'kit_{c}'); mt.use_nodes = True
        b = mt.node_tree.nodes['Principled BSDF']; b.inputs['Base Color'].default_value = (0.8, 0.8, 0.8, 1); b.inputs['Roughness'].default_value = 0.9
        mats.append(mt)
    return mats

def preview_mat(cls, tint):
    """Preview material: vertex colour x tint (plaster, accent) or a fixed pane colour (glass)."""
    mt = bpy.data.materials.new(f'pv_{cls}'); mt.use_nodes = True; nt = mt.node_tree; b = nt.nodes['Principled BSDF']; b.inputs['Roughness'].default_value = 0.85
    a = nt.nodes.new('ShaderNodeAttribute'); a.attribute_name = 'Col'
    if cls == 'glass':
        b.inputs['Base Color'].default_value = srgb(0x2e4256); b.inputs['Roughness'].default_value = 0.15
    else:
        mx = nt.nodes.new('ShaderNodeMix'); mx.data_type = 'RGBA'; mx.blend_type = 'MULTIPLY'; mx.inputs[0].default_value = 1.0
        nt.links.new(a.outputs['Color'], mx.inputs[6]); mx.inputs[7].default_value = srgb(tint) if cls in ('plaster', 'accent') else (1, 1, 1, 1)
        nt.links.new(mx.outputs[2], b.inputs['Base Color'])
    return mt

def previews(objs, folder):
    os.makedirs(folder, exist_ok=True)
    src = {o.name: o for o in objs}
    for o in objs: o.hide_render = True; o.hide_viewport = True
    preview_scene(objs)
    sc = bpy.context.scene
    def put(name, x, y, z, ry=0.0, sx=1.0, tint=(0xe8c9b4, 0xb4573c)):
        o = bpy.data.objects.new(name, src[name].data); sc.collection.objects.link(o)
        o.location = (x, -z, y); o.rotation_euler = (0, 0, ry); o.scale = (sx, 1, 1)
        for i, cls in enumerate(CLASSES):
            o.material_slots[i].link = 'OBJECT'; o.material_slots[i].material = preview_mat(cls, tint[0] if cls == 'plaster' else tint[1])
        return o
    def wall(x0, z0, ry, bays, rows, tint):                              # `rows`: list of module-name lists per storey, one name per bay (cycled)
        c, s = math.cos(ry), math.sin(ry)
        for r, names in enumerate(rows):
            for i in range(bays):
                u = i * W; put(names[i % len(names)], x0 + u * c, r * H, z0 - u * s, ry, 1.0, tint)
    def house(x, z, bays, depth, rows, top, tint, flat=True):
        wall(x, z, 0.0, bays, rows, tint)                                    # front, facing +z
        wall(x + bays * W, z, PI / 2, depth, rows, tint)                     # right side, facing +x
        n = len(rows)
        for i in range(bays): put(top, x + i * W, n * H - 0.52 if top.endswith('cornice') and not top.startswith('pn') else n * H, z, 0.0, 1.0, tint)
        for i in range(depth): put(top, x + bays * W, n * H - 0.52 if top.endswith('cornice') and not top.startswith('pn') else n * H, z - i * W, PI / 2, 1.0, tint)
        slab = bpy.data.objects.new('roof', bpy.data.meshes.new('roof')); sc.collection.objects.link(slab)
        bm = bmesh.new(); bmesh.ops.create_cube(bm, size=1.0); bm.to_mesh(slab.data); bm.free()
        slab.scale = (bays * W, depth * W, 0.4); slab.location = (x + bays * W / 2, -(z - depth * W / 2), n * H + 0.0)
        slab.data.materials.append(preview_mat('detail', 0x777777))
    P = lambda a: (a[0], a[1], a[2])
    # old town: three houses side by side (shop, gate, pilaster / pediment storeys)
    pastel = [(0xc9ddc6, 0xb4573c), (0xe9d89a, 0xa84c36), (0xe4a99a, 0x9a5a44)]
    x = 0.0
    for k, bays in enumerate((4, 3, 3)):
        rows = [['old_shop'] if k != 1 else ['old_shop', 'old_gate', 'old_shop'], ['old_bay_c', 'old_bay_d'] if k != 1 else ['old_bay_c', 'old_bay_b'], ['old_bay_b', 'old_bay_a'], ['old_bay_a', 'old_bay_b']][:3 + k % 2]
        house(x, 0, bays, 2, rows, 'old_cornice', pastel[k]); x += bays * W
    render_view(os.path.join(folder, 'old-front.png'), (x * 0.5 + 6, 5.5, 28), (x * 0.5, 7.0, 0), 38)
    render_view(os.path.join(folder, 'old-corner.png'), (x + 14, 4.0, 14), (x - 4, 6.5, 0), 40)
    render_view(os.path.join(folder, 'old-close.png'), (4.0, 2.6, 7.5), (4.5, 4.4, 0), 40)
    for o in list(sc.objects):
        if o.name not in src and o.type == 'MESH' and not o.name.startswith('ground'): bpy.data.objects.remove(o)
    # panel block: core, balcony and loggia stacks, windows; edge on top
    sch = (0xc8c0ae, 0xe0a63a)
    rows = [['pn_door', 'pn_win', 'pn_win', 'pn_win'], ['pn_core', 'pn_win', 'pn_loggia', 'pn_win']] + [['pn_core', 'pn_win', 'pn_loggia', 'pn_win']] * 5
    rows[1:] = [['pn_core', 'pn_win', 'pn_balcony', 'pn_win']] * 4 + [['pn_core', 'pn_win', 'pn_loggia', 'pn_win']] * 2
    house(0, 0, 8, 2, rows, 'pn_edge', sch)
    render_view(os.path.join(folder, 'panel-front.png'), (12, 7.0, 36), (12, 9.0, 0), 38)
    render_view(os.path.join(folder, 'panel-close.png'), (6.0, 4.0, 10), (6.0, 5.2, 0), 40)
    for o in list(sc.objects):
        if o.name not in src and o.type == 'MESH' and not o.name.startswith('ground'): bpy.data.objects.remove(o)
    rows = [['mid_ground'], ['mid_bay'], ['mid_bay'], ['mid_bay']]; rows[0] = ['mid_ground', 'mid_door', 'mid_ground']
    house(0, 0, 6, 2, rows, 'mid_cornice', (0xe6e1d6, 0xb4573c))
    render_view(os.path.join(folder, 'mid-front.png'), (12, 6.0, 30), (9, 6.0, 0), 38)

def main():
    argv = cli(); out = argv[0] if argv else '/tmp/housekit.glb'
    for name, m in MODS.items():
        if name not in CLOSED and not name.endswith('_far'): close_inside(m)
    reset(); mats = make_mats(); objs = [m.to_object(mats) for m in MODS.values()]
    log('triangles', {o.name: sum(len(p.vertices) - 2 for p in o.data.polygons) for o in objs})
    props = bpy.ops.export_scene.gltf.get_rna_type().properties
    log('colour options', [k for k in props.keys() if 'color' in k or 'colour' in k])
    export_glb(objs, out)
    if '--previews' in argv: previews(objs, argv[argv.index('--previews') + 1])

if __name__ == "__main__": main()
