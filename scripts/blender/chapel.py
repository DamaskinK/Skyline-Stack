"""St. Michael's chapel, Kosice (Gothic, 14th c., next to the cathedral) as a Draco GLB with LODs (S0004 01).

    Blender -b --factory-startup -P scripts/blender/chapel.py -- <out.glb> [--stage geom|full] [--size 2048] [--previews <dir>] [--lods]

Local frame: nave along x, apse to the east (+x), ground y = 0; the game places it on the OSM footprint (minimum rectangle 20.1 x 15.1 m at 13 degrees,
centre (63.1, 120.6)). From the photos (Wikimedia Commons, see the ticket): whitewashed walls with dark stone buttresses and plinth, tall pointed
windows with tracery, a polygonal apse, a very steep roof of glazed diamonds (dark brown with a yellow lattice), a stair turret with a pointed
stone roof at the north-west corner.
"""
import os, sys, math
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import bpy, bmesh
from lib import *
from pipeline import *

argv = cli(); out_glb = argv[0] if argv else '/tmp/chapel.glb'
PI = math.pi
STYLES['stone'].update(c1=0x7b7064, c2=0x5f564c, mortar=0x453f36, bw=0.75, rh=0.38, msize=0.016, nz=0.3)          # dark dressed stone of buttresses, plinth, turret
STYLES['stone2'].update(c1=0xe9e5d9, c2=0xdcd7c8, mortar=0xd2cdbd, bw=3.0, rh=1.2, msize=0.0, nz=0.35)          # whitewashed plaster
body = Build('body'); cut = Build('cut'); inl = Build('inlay')

X0, XA = -10.05, 4.2                 # west end, start of the apse
HW = 5.9                             # half width wall to wall
EAVE, RIDGE = 8.4, 17.6
APSE_R = HW

def pointed(w, h, R=1.15): return arch_profile(w, h, R)

def window(x, z, face, w=1.5, h=4.2, depth=0.5):
    prof, top = pointed(w, h)
    with cut.at(x, 2.4, z, face): cut.prism(prof, -depth, 0.8)
    with inl.at(x, 2.4, z, face):
        inl.prism(prof, -depth + 0.02, -depth + 0.14, 'glass')
        tracery(inl, w, h, 1.15, 2, z=-depth + 0.24, bar=0.1, d=0.16, role='stone')                  # S0004 09: two lights and a ring with a quatrefoil
    # dark dressed-stone surround of the opening (File:Kaplnka_svätého_Michala_Koszyce_2SM.jpg): a frame proud of the whitewash
    outer, otop = arch_profile(w + 0.7, h, (w * 1.15 + 0.35) / (w + 0.7))
    with body.at(x, 2.4, z, face):
        body.box(-(w / 2 + 0.35), w / 2 + 0.35, -0.35, 0.0, 0.0, 0.14, 'stone')                       # sill
        for sgn in (-1, 1): body.box(sgn * (w / 2 + 0.35) - 0.175 * (1 + sgn) + 0.0, sgn * (w / 2 + 0.35) + 0.175 * (1 - sgn), 0.0, h, 0.0, 0.12, 'stone')
        arc_bar(body, [(px, py) for px, py in outer[2:]] , 0.35, 0.24, 'stone')

def buttress(x, z, face, w=0.95, proj=1.05, h=7.4):
    # side profile in (outward, y): wedge-capped block; frame turned so local -x is outward
    with body.at(x, 0, z, face + PI / 2):
        body.prism([(0.2, 0), (-proj, 0), (-proj, h - 1.4), (-0.25, h + 0.25), (0.2, h + 0.25)], -w / 2, w / 2, 'stone')

def build():
    b = body
    # nave and apse: walls (whitewash) on a dark plinth
    b.box(X0, XA, 0, EAVE, -HW, HW, 'stone2')
    pts = [(XA + APSE_R * math.cos(math.radians(a)), APSE_R * math.sin(math.radians(a))) for a in (-90, -54, -18, 18, 54, 90)]
    b.plan([(XA, -APSE_R)] + pts[1:-1] + [(XA, APSE_R)], 0, EAVE, 'stone2')
    b.box(X0 - 0.15, XA, 0, 0.9, -HW - 0.15, HW + 0.15, 'stone')
    b.plan([(XA, -APSE_R - 0.15)] + [(x + (x - XA) * 0.03, z * 1.03) for x, z in pts[1:-1]] + [(XA, APSE_R + 0.15)], 0, 0.9, 'stone')
    # roof: ridge along x, gable at the west end, hip over the apse (diamond tiles)
    over = 0.5; k = (RIDGE - EAVE) / HW; tz = RIDGE - k * (HW + over)
    with b.at(0, 0, 0, PI / 2): b.prism([(-HW, EAVE - 0.2), (HW, EAVE - 0.2), (HW + over, tz), (0, RIDGE), (-HW - over, tz)], X0 - 0.3, XA, 'tiles')
    ap = [(x + (x - XA) * 0.12, z * 1.12) for x, z in pts]
    b.pyramid([(XA, -APSE_R * 1.12)] + ap[1:-1] + [(XA, APSE_R * 1.12)], EAVE - 0.2 + (tz - (EAVE - 0.2)) * 0.0, (XA, RIDGE, 0), 'tiles')
    # west gable wall above the eaves (stone2) with a stepped coping
    with b.at(0, 0, 0, PI / 2): b.prism([(-HW, EAVE - 0.2), (HW, EAVE - 0.2), (0, RIDGE - 0.2)], X0 - 0.3, X0 + 0.2, 'stone2')
    # buttresses: nave sides at the window piers, apse corners, west corners
    for z0, face in ((-HW, PI + PI), (HW, 0)):
        for x in (-7.8, -3.9, 0.0):
            buttress(x, z0, PI if z0 < 0 else 0, h=7.0)
    # the polygon corners are at angles -54, -18, 18, 54 (between facets): buttresses there
    for a in (-54, -18, 18, 54):
        r = math.radians(a); cx, cz = XA + (APSE_R) * math.cos(r), APSE_R * math.sin(r)
        buttress(cx, cz, PI / 2 - r + PI / 2 * 0 + 0, h=7.0)
    buttress(X0 - 0.15, -HW, PI, 1.0, 1.0, 7.4); buttress(X0 - 0.15, HW, 0, 1.0, 1.0, 7.4)
    # stair turret at the north-west corner (north = -z): square stone shaft, pointed stone roof
    tx, tz0 = X0 + 1.4, -HW - 1.2
    b.box(tx - 1.5, tx + 1.5, 0, 13.0, tz0 - 1.5, tz0 + 1.5, 'stone')
    b.pyramid([(tx - 1.8, tz0 - 1.8), (tx + 1.8, tz0 - 1.8), (tx + 1.8, tz0 + 1.8), (tx - 1.8, tz0 + 1.8)], 13.0, (tx, 19.5, tz0), 'stone')
    b.box(tx - 1.7, tx + 1.7, 12.6, 13.0, tz0 - 1.7, tz0 + 1.7, 'stone')
    with b.at(tx, 19.4, tz0, 0): b.lathe([(0, 0), (0.22, 0), (0.18, 0.5), (0, 0.55)], 6, 0, 'gold')

def openings():
    # nave: 3 tall windows per side between the buttresses, apse: one per facet except the two outer ones, west: small window above the porch
    for z0, face in ((-HW, PI), (HW, 0)):
        for x in (-5.85, -1.95, 1.95):
            window(x, z0, face)
    fr = APSE_R * math.cos(math.radians(18))
    for a in (-36, 0, 36):
        r = math.radians(a); window(XA + fr * math.cos(r) + 0.0, fr * math.sin(r), PI / 2 - r + 0.0)
    prof, top = arch_profile(1.0, 1.6, 1.2)
    with cut.at(X0, 9.5, 0, -PI / 2): cut.prism(prof, -0.4, 0.6)
    with inl.at(X0, 9.5, 0, -PI / 2): inl.prism(prof, -0.38, -0.25, 'glass')
    # west door (pointed, stone surround is the buttress pair)
    prof, top = arch_profile(1.8, 2.6, 1.15)
    with cut.at(X0, 0.9, 0, -PI / 2): cut.prism(prof, -0.8, 0.6)
    with inl.at(X0, 0.9, 0, -PI / 2): inl.prism(prof, -0.78, -0.62, 'dark')

build(); openings()
VIEWS = {
    'ne': ((46, 12, -42), (0, 8, 0), 38),               # as the Commons photo: from the north-east, apse and roof
    'se': ((38, 7, 42), (0, 8, 0), 38),
    'west': ((-44, 9, 14), (-4, 8, -1), 38),
    'aerial': ((30, 40, 30), (0, 7, 0), 40),
    'close': ((12, 3, 18), (2, 4, 4), 50),
}
import tempfile
work = os.path.join(tempfile.gettempdir(), 'chapel_work'); os.makedirs(work, exist_ok=True); tile_png = os.path.join(work, 'tile_pattern.png')
if (argv[argv.index('--stage') + 1] if '--stage' in argv else 'full') == 'full': write_tile_texture(tile_png, 'chapel')
assemble('chapel', body, cut, inl, argv, out_glb, size=2048, tiling={'tiles': dict(png=tile_png, period=TILE_PERIOD, rough=0.5, metal=0.05)}, views=VIEWS,
         geom_colours={'stone': 0x7b7064, 'stone2': 0xe9e5d9, 'tiles': 0x7a5a3a, 'gold': 0xd6aa48, 'glass': 0x34506a, 'dark': 0x23272c})
