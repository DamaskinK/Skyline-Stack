"""St. Urban's tower, Kosice (Renaissance bell tower, 16th-17th c.) as a Draco GLB with LODs (S0004 01).

    Blender -b --factory-startup -P scripts/blender/urban.py -- <out.glb> [--stage geom|full] [--size 2048] [--previews <dir>] [--lods]

Local frame: tower centre at the origin, x along the front of the arcade, ground y = 0. The game places it on the OSM footprint (the man_made=tower way,
centre (43.0, 37.7), rotated 21.5 degrees; minimum rectangle 16.1 x 15.4 m).
From the photos (Wikimedia Commons, see the ticket): a tall square shaft of ochre plaster that narrows a little upward, three cornice bands, small slit
windows below and arched louvred belfry windows above, a frieze of medallions under a steep pyramidal roof of dark tiles with two small dormers, a ball
and an iron cross on top; round the base a low arcaded gallery (Renaissance loggia) with a red-tiled lean-to roof.
"""
import os, sys, math
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import bpy, bmesh
from lib import *
from pipeline import *

argv = cli(); out_glb = argv[0] if argv else '/tmp/urban.glb'
PI = math.pi
# S0004 09: after the restoration (File:UrbanTower2021.jpg) the shaft is white plaster, the roof red tiles with a bell-cast eave and a dormer, a frieze of grey
# sgraffito roundels under the eave, a pointed belfry window, a gilt ball and a wrought-iron cross
STYLES['stone'].update(c1=0xeeebe3, c2=0xe7e3d9, mortar=0xe7e3d9, bw=4.0, rh=1.6, msize=0.0, nz=0.18)           # white plaster of the shaft
STYLES['stone2'].update(c1=0xe3dcc8, c2=0xd7cfb8, mortar=0xcbc3ab, bw=2.0, rh=0.9, msize=0.0, nz=0.25)         # pale plaster of the arcade, trim
PALETTE['copper'] = 0xa94c2e; PALETTE['copperDark'] = 0x8a3c26; PALETTE['copperLight'] = 0xc9703c
ROLES['copper'].update(rough=0.7, metal=0.0)
body = Build('body'); cut = Build('cut'); inl = Build('inlay')

GW, GD = 16.0, 15.4                    # gallery outer width (x) and depth (z)
FLOOR = 1.15                           # podium top: covers the 1 m OSM footprint extrusion that stays under the tower
SH0, SH1 = 9.6, 8.4                    # shaft side at the base / below the roof
Y_SH0, Y_SH1 = 4.4, 26.0

def frustum(b, w0, d0, y0, w1, d1, y1, role, cx=0.0, cz=0.0):
    v = [b.V(cx + sx * w0 / 2, y0, cz + sz * d0 / 2) for sx, sz in ((-1, -1), (1, -1), (1, 1), (-1, 1))]
    v += [b.V(cx + sx * w1 / 2, y1, cz + sz * d1 / 2) for sx, sz in ((-1, -1), (1, -1), (1, 1), (-1, 1))]
    return b._faces([v[0:4], v[4:8]] + [[v[i], v[(i + 1) % 4], v[4 + (i + 1) % 4], v[4 + i]] for i in range(4)], role)

def rarch(w, h, seg=7):
    hw = w / 2; pts = [(-hw, 0), (hw, 0), (hw, h)]
    pts += [(hw * math.cos(PI * k / seg), h + hw * math.sin(PI * k / seg)) for k in range(1, seg)] + [(-hw, h)]
    return pts, h + hw

def build():
    b = body
    # podium (two low steps) and the gallery: ring wall pierced by arches, floor, lean-to roof
    b.box(-GW / 2 - 0.45, GW / 2 + 0.45, 0, 0.55, -GD / 2 - 0.45, GD / 2 + 0.45, 'stone2')
    b.box(-GW / 2 - 0.2, GW / 2 + 0.2, 0.5, FLOOR, -GD / 2 - 0.2, GD / 2 + 0.2, 'stone2')
    wall = 0.7; H = 3.6
    b.box(-GW / 2, GW / 2, FLOOR, FLOOR + H, -GD / 2, -GD / 2 + wall, 'stone2'); b.box(-GW / 2, GW / 2, FLOOR, FLOOR + H, GD / 2 - wall, GD / 2, 'stone2')
    b.box(-GW / 2, -GW / 2 + wall, FLOOR, FLOOR + H, -GD / 2, GD / 2, 'stone2'); b.box(GW / 2 - wall, GW / 2, FLOOR, FLOOR + H, -GD / 2, GD / 2, 'stone2')
    b.box(-GW / 2 - 0.15, GW / 2 + 0.15, FLOOR + H - 0.35, FLOOR + H + 0.1, -GD / 2 - 0.15, GD / 2 + 0.15, 'stone2')      # gallery cornice
    frustum(b, GW + 0.9, GD + 0.9, FLOOR + H + 0.1, SH0 + 0.6, SH0 + 0.6, FLOOR + H + 2.4, 'copper')                         # red lean-to roof (a hip: four slopes), terracotta in the atlas
    # shaft: square frustum, cornices, belfry
    for (y, s, hh) in ((10.8, 0.3, 0.55), (18.2, 0.3, 0.55), (Y_SH1 - 0.6, 0.45, 0.7)):
        w = SH0 + (SH1 - SH0) * (y - Y_SH0) / (Y_SH1 - Y_SH0)
        b.box(-w / 2 - s, w / 2 + s, y, y + hh, -w / 2 - s, w / 2 + s, 'stone2')
    frustum(b, SH0, SH0, FLOOR + 0.1, SH0, SH0, Y_SH0 + 0.3, 'stone')
    frustum(b, SH0, SH0, Y_SH0, SH1, SH1, Y_SH1, 'stone')
    # steep hipped roof with a bell-cast eave, a dormer on the front, gilt ball and iron cross
    frustum(b, SH1 + 1.5, SH1 + 1.5, Y_SH1 - 0.1, SH1 + 0.5, SH1 + 0.5, Y_SH1 + 1.0, 'tiles')
    frustum(b, SH1 + 0.5, SH1 + 0.5, Y_SH1 + 1.0, 0.3, 0.3, Y_SH1 + 9.2, 'tiles')
    with b.at(0, Y_SH1 + 3.2, (SH1 + 0.5) / 2 - 1.2, 0):
        b.box(-0.6, 0.6, 0, 0.7, -0.6, 0.9, 'tiles'); b.prism([(-0.75, 0.7), (0.75, 0.7), (0, 1.0)], -0.6, 1.0, 'tiles')
    with inl.at(0, Y_SH1 + 3.2, (SH1 + 0.5) / 2 - 1.2, 0): inl.box(-0.45, 0.45, 0.12, 0.6, 0.9, 0.95, 'dark')
    with b.at(0, Y_SH1 + 9.1, 0, 0):
        b.lathe([(0, 0), (0.25, 0.0), (0.42, 0.25), (0.45, 0.45), (0.32, 0.68), (0.0, 0.75)], 10, 0, 'gold')
        b.box(-0.06, 0.06, 0.7, 3.0, -0.06, 0.06, 'dark'); b.box(-0.6, 0.6, 2.25, 2.37, -0.05, 0.05, 'dark'); b.box(-0.4, 0.4, 2.7, 2.8, -0.05, 0.05, 'dark')
        for k in range(8):
            a = 2 * PI * k / 8; b.beam((0, 2.3, 0), (0.45 * math.cos(a), 2.3 + 0.45 * math.sin(a), 0), 0.05, 0.05, (0, 0, 1), 'dark')

def openings():
    # arcade: round arches 2.2 wide on the long sides, 7 on x and 6 on z faces
    for face, n, length in ((0, 7, GW), (PI, 7, GW), (PI / 2, 6, GD), (-PI / 2, 6, GD)):
        for i in range(n):
            u = -length / 2 + (i + 0.5) * length / n
            half = (GD if face in (0, PI) else GW) / 2
            if face in (0, PI):
                x, z = u, (half if face == 0 else -half)
            else:
                x, z = (half if face == PI / 2 else -half), u
            prof, top = rarch(length / n - 0.9, 2.1)
            with cut.at(x, FLOOR + 0.05, z, face): cut.prism(prof, -1.2, 0.5)
    # dark interior seen through the arches is the shaft wall itself. Slit windows and belfry windows on all four sides
    for face in (0, PI / 2, PI, -PI / 2):
        w = SH0 + (SH1 - SH0) * (7.5 - Y_SH0) / (Y_SH1 - Y_SH0)
        for (y, ww, hh) in ((7.5, 0.5, 0.95), (13.5, 0.7, 1.3), (16.5, 0.6, 1.0)):
            wf = SH0 + (SH1 - SH0) * (y - Y_SH0) / (Y_SH1 - Y_SH0)
            if y == 16.5: continue
            prof, top = rarch(ww, hh, 5)
            with cut.at(0, y, wf / 2, face): cut.prism(prof, -0.45, 0.5)
            with inl.at(0, y, wf / 2, face): inl.prism(prof, -0.43, -0.3, 'dark')
        wb = SH0 + (SH1 - SH0) * (20.2 - Y_SH0) / (Y_SH1 - Y_SH0)
        prof, top = arch_profile(1.5, 2.2, 1.0, 5)                                                             # pointed belfry window with louvres
        with cut.at(0, 19.6, wb / 2, face): cut.prism(prof, -0.7, 0.5)
        with inl.at(0, 19.6, wb / 2, face):
            inl.prism(prof, -0.68, -0.5, 'dark')
            for k in range(6): inl.box(-0.62, 0.62, 0.4 + k * 0.48, 0.5 + k * 0.48, -0.66, -0.36, 'stone2')
        with body.at(0, 19.6, wb / 2, face): arc_bar(body, [(0.85, 0.0), (0.85, 2.2)] + [(px * 1.13, py) for px, py in prof[3:-1]] + [(-0.85, 2.2), (-0.85, 0.0)], 0.18, 0.12, 'stone2')
        # frieze of sgraffito roundels under the eave: four per face, grey disc in a pale ring
        wm = SH0 + (SH1 - SH0) * (24.6 - Y_SH0) / (Y_SH1 - Y_SH0)
        for dx in (-2.85, -0.95, 0.95, 2.85):
            with inl.at(dx, 24.6, wm / 2, face):
                inl.prism([(0.62 * math.cos(2 * PI * i / 14), 0.62 * math.sin(2 * PI * i / 14)) for i in range(14)], -0.02, 0.06, 'stone2')
                inl.prism([(0.45 * math.cos(2 * PI * i / 14), 0.45 * math.sin(2 * PI * i / 14)) for i in range(14)], 0.04, 0.09, 'dark')
                inl.box(-0.85, 0.85, -0.12, -0.04, -0.02, 0.07, 'stone2')

build(); openings()
VIEWS = {
    'front': ((8, 6, 80), (0, 17, 0), 36),                 # like the Commons photo: looking up from the square
    'front-far': ((-30, 8, 120), (0, 17, 0), 36),
    'nw': ((-50, 16, 46), (0, 15, 0), 38),
    'aerial': ((34, 52, 40), (0, 14, 0), 40),
    'close': ((6, 3, 24), (0, 4, 0), 50),
}
import tempfile
work = os.path.join(tempfile.gettempdir(), 'urban_work'); os.makedirs(work, exist_ok=True); tile_png = os.path.join(work, 'tile_pattern.png')
if (argv[argv.index('--stage') + 1] if '--stage' in argv else 'full') == 'full': write_tile_texture(tile_png, 'red')
assemble('urban', body, cut, inl, argv, out_glb, size=2048, tiling={'tiles': dict(png=tile_png, period=TILE_PERIOD, rough=0.6, metal=0.0)}, views=VIEWS,
         geom_colours={'stone': 0xeeebe3, 'stone2': 0xe3dcc8, 'tiles': 0xa4472c, 'gold': 0xd6aa48, 'dark': 0x2b2d31})
