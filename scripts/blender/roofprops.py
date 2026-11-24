"""Roof props of Kosice (S0004 16): what stands on the flat roofs of the panel blocks and on the tile roofs of the old town. Run (ADR 0003):

    Blender -b --factory-startup -P scripts/blender/roofprops.py -- assets/levels/kosice/roofprops.glb [--previews <dir>]

Writes next to the GLB the tiling roof textures: `roof_membrane_{col,nrm}.webp` (bitumen sheets of a panel roof: 1 m strips with lapped seams, staggered end laps,
darker patches of fresh bitumen, dirt and ponding stains; 8 m period) and `roof_tiles_{col,nrm}.webp` (old-town clay plain tiles: rows that sag and wander a little,
every tile its own tint and tilt, lichen and soot; 4 m period, the UV scale of the near-ring roofs).
Modules (game frame: x along the roof's long axis, y up, z across; origin at the foot, centred), one node each, one material `prop` with vertex colours that carry a hand-set
occlusion (contact shadow at the foot, recesses darker):
  panel roofs   lift (lift machine room over a stair core), stair (stair exit with a mono-pitch slab), vents (a plinth with three capped ventilation heads),
                pipe (soil vent pipe with a cowl), antenna (TV mast with two Yagi arrays), dish (satellite dish on a wall bracket stand), drain (roof outlet with a grate),
                hatch (roof hatch)
  tile roofs    chimney (plastered stack with a brick top, a concrete cap on four posts), skylight (roof window in a tin frame, lies in the roof plane),
                gutter (1 m of half-round gutter, stretched along the eaves), downpipe (1 m)
Edges of the boxy modules are bevelled (2-3 cm). Panel roof references: Commons File:Panelák Košice.jpg (masts and machine rooms on the blocks behind),
File:Krajový typ panelového domu K 61 na sídlisku Terasa, Košice.JPG; old town: File:Hlavna street in kosice january 2019.jpg, File:040 01 Staré Mesto, Slovakia - panoramio (3).jpg.
"""
import os, sys, math
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import bpy, bmesh
import numpy as np
from mathutils import Vector
from lib import reset, cli, log, srgb, export_glb, preview_scene, render_view, bevel_edges, evaluated_copy

PI = math.pi
def C(h): c = srgb(h); return (c[0], c[1], c[2])

class M:
    """Faces with a colour each; occlusion is applied per vertex from the height (contact shadow) and per face (`ao`)."""
    def __init__(self, name, foot=0.35):
        self.name = name; self.v = []; self.f = []; self.fc = []; self.foot = foot
    def V(self, p): self.v.append(tuple(p)); return len(self.v) - 1
    def face(self, pts, col, ao=1.0):
        self.f.append([self.V(p) for p in pts]); self.fc.append(tuple(c * ao for c in col))
    def box(self, x0, x1, y0, y1, z0, z1, col, skip='', ao=None):
        ao = ao or {}
        F = {'f': [(x0, y0, z1), (x1, y0, z1), (x1, y1, z1), (x0, y1, z1)], 'b': [(x1, y0, z0), (x0, y0, z0), (x0, y1, z0), (x1, y1, z0)],
             'r': [(x1, y0, z1), (x1, y0, z0), (x1, y1, z0), (x1, y1, z1)], 'l': [(x0, y0, z0), (x0, y0, z1), (x0, y1, z1), (x0, y1, z0)],
             't': [(x0, y1, z1), (x1, y1, z1), (x1, y1, z0), (x0, y1, z0)], 'u': [(x0, y0, z0), (x1, y0, z0), (x1, y0, z1), (x0, y0, z1)]}
        for k, pts in F.items():
            if k not in skip: self.face(pts, col, ao.get(k, 0.86 if k in 'fblr' else (1.0 if k == 't' else 0.6)))
    def cbox(self, cx, cz, sx, sz, y0, y1, col, skip='u', ao=None): self.box(cx - sx / 2, cx + sx / 2, y0, y1, cz - sz / 2, cz + sz / 2, col, skip, ao)
    def lathe(self, prof, n, col, at=(0, 0, 0), cap=True, ao=1.0):
        """Profile (radius, y) bottom to top about the y axis through `at`."""
        rings = [[(at[0] + r * math.cos(2 * PI * k / n), at[1] + y, at[2] + r * math.sin(2 * PI * k / n)) for k in range(n)] for r, y in prof]
        for a, b in zip(rings, rings[1:]):
            for k in range(n): self.face([a[k], a[(k + 1) % n], b[(k + 1) % n], b[k]], col, ao)
        if cap and prof[-1][0] > 1e-4: self.face(rings[-1][::-1], col, ao)
    def beam(self, p0, p1, w, col, up=(0, 1, 0)):
        p0, p1 = Vector(p0), Vector(p1); d = (p1 - p0).normalized(); u = Vector(up)
        if abs(d.dot(u)) > 0.9: u = Vector((1, 0, 0))
        s = d.cross(u).normalized() * (w / 2); t = d.cross(s).normalized() * (w / 2)
        q = [s + t, -s + t, -s - t, s - t]
        a = [p0 + o for o in q]; b = [p1 + o for o in q]
        for k in range(4): self.face([a[k], a[(k + 1) % 4], b[(k + 1) % 4], b[k]], col, 0.9)
        self.face(b, col); self.face(a[::-1], col)

    def to_object(self, mat, bevel=0.0):
        me = bpy.data.meshes.new(self.name)
        me.from_pydata([(x, -z, y) for x, y, z in self.v], [], self.f); me.validate(); me.update()
        bm = bmesh.new(); bm.from_mesh(me); bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=0.0005); bmesh.ops.recalc_face_normals(bm, faces=bm.faces); bm.to_mesh(me); bm.free()
        ob = bpy.data.objects.new(self.name, me); bpy.context.scene.collection.objects.link(ob); me.materials.append(mat)
        # colours per face corner, so faces keep their own colour across shared vertices
        col = me.color_attributes.new('Col', 'FLOAT_COLOR', 'CORNER')
        # faces were merged by remove_doubles; match them back by centre to the source faces
        src = {}
        for f, c in zip(self.f, self.fc):
            cen = sum((Vector(self.v[i]) for i in f), Vector()) / len(f); src[(round(cen.x, 3), round(-cen.z, 3), round(cen.y, 3))] = c
        for p in me.polygons:
            k = (round(p.center.x, 3), round(p.center.y, 3), round(p.center.z, 3)); c = src.get(k, (0.5, 0.5, 0.5))
            for li in p.loop_indices:
                z = me.vertices[me.loops[li].vertex_index].co.z
                occ = 0.62 + 0.38 * min(1.0, max(0.0, z / self.foot)) if self.foot > 0 else 1.0
                col.data[li].color = (c[0] * occ, c[1] * occ, c[2] * occ, 1.0)
        for p in me.polygons: p.use_smooth = False
        if bevel > 0:
            bevel_edges(ob, bevel, 40, 1); evaluated_copy(ob)
        return ob

# ------------------------------------------------------------------ colours (sRGB)
CONC, CONC_D, COPING = C(0xb9b5ab), C(0x8f8b82), C(0xa19d93)
STEEL, STEEL_D, DOOR = C(0x9aa0a4), C(0x55595d), C(0x5d6a62)
DARK, WHITE, RUST = C(0x2c2e30), C(0xe9e9e4), C(0x7a5a44)
PLASTER, BRICK, MORTAR, TIN = C(0xd9cdb6), C(0x9a4a34), C(0x6a5a50), C(0x6d7377)

def lift():
    m = M('lift', 0.5)
    m.cbox(0, 0, 3.4, 2.4, 0, 2.5, CONC)                                              # machine room: precast concrete box
    m.cbox(0, 0, 3.66, 2.66, 2.5, 2.68, COPING, skip='')                                # roof slab with a drip overhang
    m.box(-1.25, -0.35, 0.05, 2.05, 1.2, 1.24, DOOR, skip='bu', ao={'f': 0.95})        # steel door on the +z face, 4 cm proud
    m.box(-0.42, -0.36, 1.0, 1.08, 1.24, 1.3, STEEL_D, skip='bu')                       # handle
    m.box(1.7, 1.74, 1.5, 2.2, -0.6, 0.5, DARK, skip='lu')                              # louvre on the +x face: dark opening and slats
    for k in range(6): m.box(1.74, 1.8, 1.52 + k * 0.115, 1.56 + k * 0.115, -0.6, 0.5, STEEL, skip='lu')
    m.cbox(0.9, -0.5, 0.36, 0.36, 2.68, 3.2, STEEL_D)                                   # exhaust cowl on the roof
    m.cbox(0.9, -0.5, 0.5, 0.5, 3.2, 3.26, STEEL, skip='')
    return m

def stair():
    m = M('stair', 0.5)
    m.cbox(0, 0, 2.4, 2.2, 0, 2.2, CONC)
    hi, lo = 2.55, 2.3                                                                  # mono-pitch slab falling to -z
    xs, zs = 1.32, 1.22
    m.face([(-xs, hi, zs), (xs, hi, zs), (xs, lo, -zs), (-xs, lo, -zs)], COPING, 1.0)
    m.face([(-xs, hi - 0.12, zs), (-xs, lo - 0.12, -zs), (xs, lo - 0.12, -zs), (xs, hi - 0.12, zs)], COPING, 0.55)
    for s in (-1, 1): m.face([(s * xs, hi - 0.12, zs), (s * xs, hi, zs), (s * xs, lo, -zs), (s * xs, lo - 0.12, -zs)], COPING, 0.85)
    m.face([(-xs, hi - 0.12, zs), (xs, hi - 0.12, zs), (xs, hi, zs), (-xs, hi, zs)], COPING, 0.9)
    m.face([(xs, lo - 0.12, -zs), (-xs, lo - 0.12, -zs), (-xs, lo, -zs), (xs, lo, -zs)], COPING, 0.8)
    m.face([(-1.2, 2.2, 1.1), (1.2, 2.2, 1.1), (1.2, hi - 0.12, 1.1), (-1.2, hi - 0.12, 1.1)], CONC, 0.86)   # fill under the slab, front
    m.face([(1.2, 2.2, -1.1), (-1.2, 2.2, -1.1), (-1.2, lo - 0.12, -1.1), (1.2, lo - 0.12, -1.1)], CONC, 0.86)
    for s in (-1, 1): m.face([(s * 1.2, 2.2, 1.1), (s * 1.2, hi - 0.12, 1.1), (s * 1.2, lo - 0.12, -1.1), (s * 1.2, 2.2, -1.1)][:: s], CONC, 0.86)
    m.box(-0.45, 0.45, 0.05, 2.0, 1.1, 1.14, DOOR, skip='bu', ao={'f': 0.95})
    m.box(0.3, 0.36, 1.0, 1.08, 1.14, 1.2, STEEL_D, skip='bu')
    return m

def vents():
    m = M('vents', 0.3)
    m.cbox(0, 0, 2.2, 0.7, 0, 0.25, CONC_D)
    for x in (-0.7, 0.0, 0.7):
        m.cbox(x, 0, 0.46, 0.46, 0.25, 1.05, CONC)
        m.cbox(x, 0, 0.3, 0.3, 1.05, 1.06, DARK, skip='u')                              # the flue under the cap: dark
        for px in (-0.19, 0.19):
            for pz in (-0.19, 0.19): m.cbox(x + px, pz, 0.06, 0.06, 1.05, 1.2, CONC)
        m.cbox(x, 0, 0.62, 0.62, 1.2, 1.28, COPING, skip='')
    return m

def pipe():
    m = M('pipe', 0.25)
    m.lathe([(0.11, 0.0), (0.11, 0.06), (0.075, 0.08), (0.075, 0.95)], 10, STEEL_D, cap=False)
    m.lathe([(0.075, 0.95), (0.16, 1.02), (0.16, 1.08), (0.0, 1.16)], 10, STEEL)
    return m

def antenna():
    m = M('antenna', 0.2)
    m.cbox(0, 0, 0.7, 0.7, 0, 0.12, CONC_D, skip='')                                   # ballast block
    m.beam((0, 0.12, 0), (0, 3.4, 0), 0.05, STEEL)
    for k in range(3):                                                                  # guy wires down to the block corners (thin bars)
        a = 2 * PI * k / 3 + 0.3; m.beam((0, 2.2, 0), (0.33 * math.cos(a), 0.12, 0.33 * math.sin(a)), 0.012, STEEL_D)
    for y, L, n in ((3.25, 1.5, 9), (2.6, 1.1, 7)):                                     # two Yagi arrays pointing along +x: boom and elements
        m.beam((-0.25, y, 0), (L - 0.25, y, 0), 0.03, STEEL)
        for i in range(n):
            x = -0.2 + i * (L - 0.1) / (n - 1); w = 0.62 - 0.3 * i / (n - 1)
            m.beam((x, y, -w / 2), (x, y, w / 2), 0.014, STEEL)
    m.beam((0, 3.4, 0), (0, 3.9, 0), 0.025, STEEL)
    m.beam((-0.45, 3.85, 0), (0.45, 3.85, 0), 0.014, STEEL)
    return m

def dish():
    m = M('dish', 0.15)
    m.cbox(0, 0, 0.55, 0.55, 0, 0.1, CONC_D, skip='')
    m.beam((0, 0.1, 0), (0, 0.95, 0), 0.05, STEEL_D)
    n = 14; tilt = math.radians(28); R = 0.42; ctr = Vector((0, 1.05, 0.08))
    prof = [(R * t, 0.18 * (t * t)) for t in (0.0, 0.35, 0.65, 0.85, 1.0)]
    ax = Vector((0, math.sin(tilt), math.cos(tilt)))                                    # the dish looks south-up (+z)
    u = Vector((1, 0, 0)); v = ax.cross(u).normalized()
    def P(r, h, a): return ctr + ax * h + (u * math.cos(a) + v * math.sin(a)) * r
    rings = [[P(r, h, 2 * PI * k / n) for k in range(n)] for r, h in prof]
    for a, b in zip(rings, rings[1:]):
        for k in range(n):
            m.face([a[k], b[k], b[(k + 1) % n], a[(k + 1) % n]], WHITE, 1.0)           # the concave face
            m.face([a[k], a[(k + 1) % n], b[(k + 1) % n], b[k]], (0.8, 0.8, 0.79), 0.8)  # the back
    m.beam(P(0, 0.02, 0), P(0, 0.52, 0) - v * 0.12, 0.025, STEEL_D)                     # arm to the LNB
    lnb = P(0, 0.52, 0) - v * 0.12; m.beam(lnb - ax * 0.06, lnb + ax * 0.06, 0.06, DARK)
    return m

def drain():
    m = M('drain', 0.0)
    m.cbox(0, 0, 0.56, 0.56, 0.0, 0.05, CONC_D, skip='u')
    m.cbox(0, 0, 0.34, 0.34, 0.05, 0.07, DARK, skip='u')
    for k in range(4): m.cbox(-0.12 + k * 0.08, 0, 0.025, 0.32, 0.07, 0.085, STEEL_D, skip='u')
    return m

def hatch():
    m = M('hatch', 0.25)
    m.cbox(0, 0, 0.95, 0.95, 0, 0.45, CONC)
    m.cbox(0, 0, 1.05, 1.05, 0.45, 0.55, STEEL, skip='')
    return m

def chimney():
    """Old-town chimney: origin at the foot on the ridge line, 2.2 m above it (the game sinks it into the roof); plastered shaft, brick head, cap on posts."""
    m = M('chimney', 0.0)
    m.cbox(0, 0, 0.62, 0.48, -1.2, 1.55, PLASTER)
    m.cbox(0, 0, 0.72, 0.58, 1.55, 1.65, PLASTER, skip='')                               # plaster band
    m.cbox(0, 0, 0.64, 0.5, 1.65, 1.84, BRICK, skip='')                                    # brick head in two courses, the upper one stepped out
    m.cbox(0, 0, 0.7, 0.56, 1.84, 2.05, BRICK, skip='')
    m.cbox(0, 0, 0.36, 0.24, 2.05, 2.06, DARK, skip='u')                                 # flue
    for px in (-0.26, 0.26):
        for pz in (-0.19, 0.19): m.cbox(px, pz, 0.07, 0.07, 2.05, 2.28, BRICK)
    m.cbox(0, 0, 0.82, 0.66, 2.28, 2.36, COPING, skip='')                                 # concrete cap
    return m

def skylight():
    """Roof window in the roof plane (x along the slope's horizontal, z up the slope), 0.78 x 1.18 m, frame 6 cm proud of the tiles."""
    m = M('skylight', 0.0)
    m.box(-0.45, 0.45, 0.0, 0.07, -0.65, 0.65, TIN, skip='u')                           # tin flashing and frame
    m.box(-0.36, 0.36, 0.07, 0.075, -0.55, 0.55, C(0x2a3c4e), skip='u')                  # glass
    m.box(-0.45, 0.45, 0.07, 0.11, 0.55, 0.65, TIN, skip='u')                            # top bar
    return m

def gutter():
    m = M('gutter', 0.0)
    n = 6; r = 0.07
    pts = [(r * math.cos(PI + PI * k / (n - 1)) , r * math.sin(PI + PI * k / (n - 1))) for k in range(n)]   # half round, open at the top (z, y)
    for (z0, y0), (z1, y1) in zip(pts, pts[1:]):
        m.face([(0, y0, z0), (1, y0, z0), (1, y1, z1), (0, y1, z1)], TIN, 0.9)
        m.face([(0, y1 + 0.005, z1), (1, y1 + 0.005, z1), (1, y0 + 0.005, z0), (0, y0 + 0.005, z0)], C(0x4a4f53), 0.6)
    m.box(0, 1, -0.005, 0.012, -r - 0.012, -r + 0.004, TIN)                             # roll on the outer lip
    return m

def downpipe():
    m = M('downpipe', 0.0)
    m.lathe([(0.05, 0.0), (0.05, 1.0)], 8, TIN, cap=False)
    return m

MODS = {'lift': (lift, 0.03), 'stair': (stair, 0.03), 'vents': (vents, 0.015), 'pipe': (pipe, 0), 'antenna': (antenna, 0), 'dish': (dish, 0), 'drain': (drain, 0),
        'hatch': (hatch, 0.02), 'chimney': (chimney, 0), 'skylight': (skylight, 0), 'gutter': (gutter, 0), 'downpipe': (downpipe, 0)}

# ------------------------------------------------------------------ textures
def _noise(px, cells, seed, octaves=3):
    rng = np.random.default_rng(seed); out = np.zeros((px, px)); amp = 1.0; tot = 0.0
    for o in range(octaves):
        n = cells * 2 ** o; g = rng.random((n, n))
        u = (np.arange(px) + 0.5) / px * n; i0 = np.floor(u).astype(int); f = u - i0; f = f * f * (3 - 2 * f); i1 = (i0 + 1) % n
        a = g[i0][:, i0] * (1 - f)[None, :] + g[i0][:, i1] * f[None, :]
        b = g[i1][:, i0] * (1 - f)[None, :] + g[i1][:, i1] * f[None, :]
        out += amp * (a * (1 - f)[:, None] + b * f[:, None]); tot += amp; amp *= 0.5
    return out / tot

def _rgb(h): return np.array([(h >> s & 255) / 255 for s in (16, 8, 0)])

def _save_webp(path, arr, colour=True, quality=86):
    h, w = arr.shape[:2]
    rgba = np.concatenate([np.clip(arr, 0, 1), np.ones((h, w, 1))], -1)
    im = bpy.data.images.new(os.path.basename(path), w, h, alpha=False)
    if not colour: im.colorspace_settings.name = 'Non-Color'
    im.pixels.foreach_set(rgba[::-1].astype(np.float32).ravel())
    sc = bpy.context.scene; s = sc.render.image_settings; s.file_format = 'WEBP'; s.quality = quality; s.color_mode = 'RGB'
    im.save_render(path, scene=sc); bpy.data.images.remove(im)
    log('texture', path, os.path.getsize(path) // 1024, 'KB')

def _normal(height, metres_per_px, strength=1.0):
    gx = (np.roll(height, -1, 1) - np.roll(height, 1, 1)) / (2 * metres_per_px)
    gy = (np.roll(height, -1, 0) - np.roll(height, 1, 0)) / (2 * metres_per_px)
    n = np.stack([-gx * strength, gy * strength, np.ones_like(height)], -1)          # image rows run down: v up = -row
    n /= np.linalg.norm(n, axis=-1, keepdims=True)
    return n * 0.5 + 0.5

def membrane(folder, px=1024, period=8.0, seed=11):
    """Bitumen roll roofing of a panel-block roof, silver-grey paint weathered to grey: 1 m strips along u with 8 cm laps, end laps every 5-7 m, patches, dirt."""
    rng = np.random.default_rng(seed); mpp = period / px
    u = (np.arange(px) + 0.5) * mpp; U, V = np.meshgrid(u, u)
    strip = np.floor(V).astype(int); fv = V - strip
    lap = np.clip(1 - np.abs(fv - 0.04) / 0.04, 0, 1)                                    # seam ridge
    height = 0.004 * lap
    endoff = rng.random(8) * period
    for s in range(8):                                                                   # end laps of each strip
        m = strip == s; d = np.abs(((U - endoff[s]) + period / 2) % period - period / 2)
        height[m] += 0.003 * np.clip(1 - d[m] / 0.05, 0, 1)
    base = _rgb(0x8f8e89)[None, None] * (0.9 + 0.2 * _noise(px, 4, seed + 1))[..., None]
    base *= (0.96 + 0.08 * _noise(px, 64, seed + 2, 2))[..., None]                     # granules
    seam = (1 - 0.14 * lap)[..., None]; img = base * seam
    for k in range(4):                                                                   # patches of fresh dark bitumen, raised edges
        cx, cy = rng.random(2) * period; w, h = 0.5 + rng.random() * 1.8, 0.4 + rng.random() * 1.2
        dx = np.abs(((U - cx) + period / 2) % period - period / 2) - w / 2; dy = np.abs(((V - cy) + period / 2) % period - period / 2) - h / 2
        inside = (dx < 0) & (dy < 0); edge = inside & (np.maximum(dx, dy) > -0.04)
        col = _rgb(0x7c7b76) if k % 2 else _rgb(0x86857f)
        img[inside] = col * (0.9 + 0.2 * _noise(px, 32, seed + 10 + k, 2)[inside])[..., None]; img[edge] *= 0.85
        height[inside] += 0.002; height[edge] += 0.002
    dirt = _noise(px, 3, seed + 5)                                                       # ponding stains and soot: low-frequency darkening with rings
    stain = np.clip((dirt - 0.58) / 0.12, 0, 1); ring = np.clip(1 - np.abs(dirt - 0.6) / 0.015, 0, 1)
    img *= (1 - 0.18 * stain - 0.12 * ring)[..., None]
    img *= (0.94 + 0.06 * _noise(px, 12, seed + 6))[..., None]
    _save_webp(os.path.join(folder, 'roof_membrane_col.webp'), img)
    _save_webp(os.path.join(folder, 'roof_membrane_nrm.webp'), _normal(height, mpp, 1.0), colour=False, quality=90)

def tiles(folder, px=1024, period=4.0, seed=5):
    """Old-town clay plain tiles (bobrovka): 18 cm courses, 17 cm wide tiles with a segmental tail, rows offset by half a tile, a slow sag and wander per row,
    every tile tilted and tinted a little, lichen (grey-green) and soot in the laps. v = up the slope (image rows run down the slope)."""
    rng = np.random.default_rng(seed); mpp = period / px
    u = (np.arange(px) + 0.5) * mpp; U, V = np.meshgrid(u, u[::-1])                      # V grows up the image = up the slope
    rows = round(period / 0.18); rh = period / rows; cols = round(period / 0.17); tw = period / cols
    wander = 0.018 * np.sin(2 * PI * (U / period * 2 + rng.random())) + 0.012 * (_noise(px, 6, seed + 1) - 0.5)   # rows sag and wander (metres)
    Vw = V + wander
    r = np.floor(Vw / rh).astype(int); fy = Vw / rh - r; rr = r % rows
    off = (rr % 2) * 0.5 + (rng.random(rows) * 0.16 - 0.08)[rr]                           # half-bond plus a little random shift per course
    c = np.floor(U / tw + off).astype(int); fx = U / tw + off - c; cc = c % cols
    tint = rng.normal(1.0, 0.045, (rows, cols)); hue = rng.random((rows, cols)); tilt = rng.normal(0, 0.25, (rows, cols))
    red, brown, pale = _rgb(0xa9502f), _rgb(0x8a4630), _rgb(0xb86a44)
    hh = hue[rr, cc][..., None]
    img = (red * (1 - hh) + brown * hh) * tint[rr, cc][..., None]
    img = np.where((hue[rr, cc] > 0.95)[..., None], (pale * 0.6 + red * 0.4) * tint[rr, cc][..., None], img)
    # tail: the lower edge of a tile is a flat segment; the tile above covers the top 60 %, so the visible part is fy 0..0.45 of each course
    tail = 0.06 * (1 - (2 * fx - 1) ** 2)
    vis = fy                                                                              # 0 at the lower edge
    edge_x = np.minimum(fx, 1 - fx)
    gap = np.clip(1 - edge_x / 0.04, 0, 1)
    height = 0.012 * vis + 0.004 * tilt[rr, cc] * (fx - 0.5) - 0.006 * gap
    lower = np.clip((vis - tail) / 0.08, 0, 1)
    img *= (0.55 + 0.45 * lower)[..., None]                                               # shadow under the course above
    img *= (1 - 0.4 * gap)[..., None]
    img *= (0.88 + 0.2 * vis)[..., None]
    lich = _noise(px, 8, seed + 3, 3); moss = np.clip((lich - 0.62) / 0.1, 0, 1) * np.clip(1 - vis * 1.5, 0, 1)
    img = img * (1 - 0.55 * moss[..., None]) + _rgb(0x6d7458)[None, None] * 0.55 * moss[..., None]
    spots = (_noise(px, 96, seed + 4, 1) > 0.88) * (_noise(px, 5, seed + 6) > 0.62)
    img = np.where(spots[..., None], img * 0.75 + _rgb(0x9a9a78) * 0.25, img)                 # lichen rosettes
    soot = _noise(px, 2, seed + 7); img *= (0.9 + 0.12 * soot)[..., None]
    _save_webp(os.path.join(folder, 'roof_tiles_col.webp'), img)
    _save_webp(os.path.join(folder, 'roof_tiles_nrm.webp'), _normal(height, mpp, 1.0), colour=False, quality=90)

# ------------------------------------------------------------------ main
def make_mat():
    mt = bpy.data.materials.new('prop'); mt.use_nodes = True; nt = mt.node_tree
    b = nt.nodes['Principled BSDF']; b.inputs['Roughness'].default_value = 0.85
    a = nt.nodes.new('ShaderNodeAttribute'); a.attribute_name = 'Col'; nt.links.new(a.outputs['Color'], b.inputs['Base Color'])
    return mt

def previews(objs, folder):
    os.makedirs(folder, exist_ok=True); preview_scene(objs); sc = bpy.context.scene
    for o in objs: o.hide_render = True
    def put(name, x, y, z, ry=0.0):
        s = bpy.data.objects[name]; o = s.copy(); sc.collection.objects.link(o); o.hide_render = False; o.location = (x, -z, y); o.rotation_euler = (0, 0, ry); return o
    slab = bpy.data.objects.new('slab', bpy.data.meshes.new('slab')); sc.collection.objects.link(slab)
    bm = bmesh.new(); bmesh.ops.create_cube(bm, size=1.0); bm.to_mesh(slab.data); bm.free(); slab.scale = (24, 12, 0.2); slab.location = (0, 0, -0.1)
    mm = bpy.data.materials.new('mem'); mm.use_nodes = True; tx = mm.node_tree.nodes.new('ShaderNodeTexImage')
    tx.image = bpy.data.images.load(os.path.join(folder, '..', 'tex', 'roof_membrane_col.webp')) if os.path.exists(os.path.join(folder, '..', 'tex', 'roof_membrane_col.webp')) else None
    if tx.image: mm.node_tree.links.new(tx.outputs['Color'], mm.node_tree.nodes['Principled BSDF'].inputs['Base Color'])
    slab.data.materials.append(mm)
    put('lift', -6, 0, -1.5); put('stair', 2, 0, -2); put('vents', 6, 0, 2.5); put('pipe', -2, 0, 3); put('pipe', 4.5, 0, -4.2); put('antenna', 8, 0, -3)
    put('dish', -9, 0, 3.5); put('drain', 0, 0, 1.5); put('hatch', -2.5, 0, -3.8); put('chimney', -9.5, 0, -4.5); put('skylight', 9.5, 0, 4.5)
    g = put('gutter', -6, 0.3, 5.5); g.scale = (6, 1, 1)
    render_view(os.path.join(folder, 'props-3q.png'), (14, 9, 16), (0, 1.0, 0), 32)
    render_view(os.path.join(folder, 'props-top.png'), (0, 30, 9), (0, 0, 0), 32)
    render_view(os.path.join(folder, 'props-close.png'), (-1.0, 3.2, 6.0), (-5.5, 1.3, -1.5), 34)

def main():
    argv = cli(); out = argv[0] if argv else '/tmp/roofprops.glb'; folder = os.path.dirname(os.path.abspath(out))
    reset(); mat = make_mat()
    objs = [fn().to_object(mat, bev) for name, (fn, bev) in MODS.items()]
    for o in objs:
        o.data.validate(); log(o.name, 'tris', sum(len(p.vertices) - 2 for p in o.data.polygons))
    export_glb(objs, out)
    if '--textures' in argv or not os.path.exists(os.path.join(folder, 'roof_tiles_col.webp')):
        membrane(folder); tiles(folder)
    if '--previews' in argv:
        pv = argv[argv.index('--previews') + 1]; os.makedirs(os.path.join(pv, 'tex'), exist_ok=True)
        for f in ('roof_membrane_col.webp', 'roof_tiles_col.webp'):
            import shutil; shutil.copy(os.path.join(folder, f), os.path.join(pv, 'tex', f))
        previews(objs, os.path.join(pv, 'props'))

if __name__ == "__main__": main()
