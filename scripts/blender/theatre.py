"""State Theatre Kosice (neo-baroque, Adolf Lang, 1899) as a Draco GLB with three LODs (S0004 01).

    Blender -b --factory-startup -P scripts/blender/theatre.py -- <out.glb> [--stage geom|full] [--size 2048] [--previews <dir>] [--lods]

Local frame = js/landmarks/kosice.ts: facade at z = +26 looking +z (towards the singing fountain and the cathedral), width 33 (x), body z -14..26,
stage house behind to z = -26. The game places the model at the OSM footprint centre, rotated 18 degrees.
From the photos (Wikimedia Commons, see the ticket comments): cream plaster, rusticated ground floor with arched doors, a projecting central bay
whose first floor is a loggia of three tall arches between paired columns, a balustraded balcony, an entablature and a triangular pediment with a
lunette; two round corner pavilions with dark copper domes; behind them a big drum with arched windows and a dark grey-green copper dome with a lantern;
bronze statues on the cornice; dark roofs; two small domed turrets at the rear corners.
"""
import os, sys, math
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import bpy, bmesh
from lib import *
from pipeline import *

argv = cli(); out_glb = argv[0] if argv else '/tmp/theatre.glb'
PI = math.pi
PALETTE['copper'] = 0x4b6256; PALETTE['copperDark'] = 0x3c4f45; PALETTE['copperLight'] = 0x62796b; PALETTE['gold'] = 0xd6aa48
STYLES["stone"].update(c1=0xf4ecd0, c2=0xeadfbc, mortar=0xe0d4aa, bw=2.4, rh=1.0, msize=0.0, nz=0.12)
STYLES['stone2'].update(c1=0xe9dfc2, c2=0xddd2b1, mortar=0xb9ad8e, bw=40.0, rh=0.9, msize=0.0, nz=0.12)

body = Build('body'); cut = Build('cut'); inl = Build('inlay')

# ---------------------------------------------------------------- helpers
def rarch(w, h, seg=8):
    hw = w / 2; pts = [(-hw, 0), (hw, 0), (hw, h)]
    pts += [(hw * math.cos(PI * k / seg), h + hw * math.sin(PI * k / seg)) for k in range(1, seg)]
    pts += [(-hw, h)]
    return pts, h + hw

def opening(x, y, z, face, w, h, depth=0.55, glass=True, mull=True, role_back='glass', sill=None):
    """Round-headed recess in a wall: (x, y, z) = centre of the sill on the wall surface, `face` = outward direction (ry)."""
    prof, top = rarch(w, h)
    with cut.at(x, y, z, face): cut.prism(prof, -depth, 0.5)
    if glass:
        with inl.at(x, y, z, face):
            inl.prism(prof, -depth + 0.02, -depth + 0.14, role_back)
            if mull:
                inl.box(-0.05, 0.05, 0.0, top - 0.2, -depth + 0.02, -depth + 0.3, 'stone')
                inl.box(-w / 2, w / 2, h * 0.62, h * 0.62 + 0.1, -depth + 0.02, -depth + 0.28, 'stone')
    if sill:
        with body.at(x, y, z, face): body.box(-w / 2 - 0.25, w / 2 + 0.25, -0.18, 0.0, 0.0, 0.5, 'stone')
    return top

def surround(x, y, z, face, w, h, t=0.3, d=0.22):
    """Moulded frame round a round-headed opening (stone ring), proud of the wall."""
    prof, top = rarch(w + 2 * t, h)
    inner, _ = rarch(w, h)
    outer = [(px * 1.0, py) for px, py in prof]
    with body.at(x, y, z, face): body.prism([(px, py) for px, py in prof], 0.0, d, 'stone')

def pillar_ring(b, cx, cz, r, n, y0, y1, role='stone', rot=0.0):
    b.plan([(cx + r * math.cos(rot + 2 * PI * i / n), cz + r * math.sin(rot + 2 * PI * i / n)) for i in range(n)], y0, y1, role)

def statue(b, x, y, z, h=2.4, role='copper'):
    b.cbox(x, z, 0.8, 0.8, y, y + 0.7, 'stone')                                  # plinth
    b.lathe([(0.0, y + 0.7), (0.34, y + 0.7), (0.3, y + 1.6), (0.22, y + h - 0.5), (0.0, y + h - 0.5)], 6, 0, role)          # body
    b.lathe([(0.0, y + h - 0.55), (0.2, y + h - 0.45), (0.17, y + h - 0.1), (0.0, y + h)], 6, 0, role)                       # head

def dome(b, x, y, z, r, rot=0.0, n=16, role='copper', lantern=True, gold=True, tall=1.0):
    """Baroque dome: drum-less lathe with a lantern and a ball."""
    s = r / 10.0
    prof = [(0, 0), (10.4, 0), (10.4, 0.5), (9.8, 2.2), (8.4, 4.6), (6.2, 6.8), (3.6, 8.4), (1.9, 9.3)]
    if lantern: prof += [(1.9, 9.8), (2.4, 10.1), (2.4, 11), (1.5, 11.5), (1.5, 12.4), (0.7, 13.0), (0.15, 15.2)]
    else: prof += [(0.2, 9.9)]
    with b.at(x, y, z, 0): b.lathe([(rr * s, hh * s * tall) for rr, hh in prof], n, rot, role)
    if gold:
        top = (15.2 if lantern else 9.9) * s * tall
        with b.at(x, y + top, z, 0): b.lathe([(0, -0.1), (0.35, 0.0), (0.45, 0.45), (0.3, 0.8), (0.0, 0.95)], 6, 0, 'gold')

# ---------------------------------------------------------------- dimensions (m)
HW = 16.5; Z0 = -14.0; Z1 = 23.4
GROUND = 5.8; CORN = 15.5; PAV_H = 17.5
AV_HW = 7.6; AV_Z = 26.0                         # central projecting bay
STAGE = dict(hw=10.0, z0=-26.0, z1=-6.0, h=23.0)
PAV = [(-12.3, 19.8), (12.3, 19.8)]; PAV_R = 4.3
DRUM = dict(x=0.0, z=4.0, r=9.0, y0=CORN, y1=CORN + 5.6)

def build():
    b = body
    # --- masses
    b.box(-HW, HW, 0, CORN, Z0, Z1, 'stone')                                                  # main block
    b.box(-HW - 0.35, HW + 0.35, 0, 0.7, Z0 - 0.35, Z1 + 0.35, 'stone')                      # plinth
    b.box(-HW - 0.5, HW + 0.5, CORN - 0.3, CORN + 0.2, Z0 - 0.5, Z1 + 0.5, 'stone')            # cornice
    b.box(-HW - 0.9, HW + 0.9, CORN + 0.2, CORN + 0.6, Z0 - 0.9, Z1 + 0.9, 'stone')
    b.box(-HW + 0.3, HW - 0.3, CORN + 0.6, CORN + 1.3, Z1 - 0.4, Z1, 'stone')                 # parapet along the front (balusters are a cut pattern below)
    b.box(-HW - 0.2, HW + 0.2, GROUND - 0.25, GROUND + 0.2, Z0 - 0.2, Z1 + 0.2, 'stone')     # string course over the rusticated ground floor
    b.box(-HW - 0.2, HW + 0.2, GROUND + 5.4, GROUND + 5.7, Z0 - 0.2, Z1 + 0.2, 'stone')      # string course under the cornice
    # shallow dark roof behind the parapets
    with b.at(0, 0, 0, 0): b.prism([(-HW, CORN + 0.2), (HW, CORN + 0.2), (0, CORN + 4.2)], Z0 + 2, Z1 - 3, 'dark')
    # stage house with a hipped dark roof
    S = STAGE
    b.box(-S['hw'], S['hw'], 0, S['h'], S['z0'], S['z1'], 'stone')
    b.box(-S['hw'] - 0.5, S['hw'] + 0.5, S['h'] - 0.3, S['h'] + 0.3, S['z0'] - 0.5, S['z1'] + 0.5, 'stone')
    b.pyramid([(-S['hw'] - 0.5, S['z0'] - 0.5), (S['hw'] + 0.5, S['z0'] - 0.5), (S['hw'] + 0.5, S['z1'] + 0.5), (-S['hw'] - 0.5, S['z1'] + 0.5)], S['h'] + 0.3, (0, S['h'] + 4.0, (S['z0'] + S['z1']) / 2), 'dark')
    # rear corner turrets with small copper domes
    for sx in (-1, 1):
        b.plan([(sx * 14.0 + 2.2 * math.cos(2 * PI * i / 10), -11.5 + 2.2 * math.sin(2 * PI * i / 10)) for i in range(10)], CORN, CORN + 2.2, 'stone')
        dome(b, sx * 14.0, CORN + 2.2, -11.5, 2.4, n=10, lantern=False)
    # --- front: central bay (avant-corps) with the loggia, pavilions, steps
    b.box(-AV_HW, AV_HW, 0, CORN - 0.3, Z1 - 0.1, AV_Z, 'stone')
    b.box(-AV_HW - 0.45, AV_HW + 0.45, 0, 0.7, Z1 - 0.1, AV_Z + 0.35, 'stone')                  # plinth of the bay
    b.box(-AV_HW - 0.6, AV_HW + 0.6, CORN - 0.4, CORN + 0.4, Z1 - 0.1, AV_Z + 0.6, 'stone')    # entablature
    b.box(-AV_HW - 0.6, AV_HW + 0.6, GROUND - 0.25, GROUND + 0.2, Z1 - 0.1, AV_Z + 0.4, 'stone')
    # pediment: triangular, with a cornice, over the bay
    b.prism([(-AV_HW - 0.9, CORN + 0.4), (AV_HW + 0.9, CORN + 0.4), (0, CORN + 4.6)], Z1 - 0.1, AV_Z + 0.6, 'stone')
    # paired columns in front of the loggia (first floor), pilasters at the ends
    for sx in (-1, 1):
        for dx in (2.1, 2.9):
            with b.at(sx * dx, 0, AV_Z - 0.2, 0):
                b.lathe([(0.0, GROUND + 0.25), (0.55, GROUND + 0.25), (0.45, GROUND + 0.55), (0.4, GROUND + 4.9), (0.5, GROUND + 5.0), (0.55, GROUND + 5.4), (0.0, GROUND + 5.4)], 10, 0, 'stone')
        b.box(sx * (AV_HW - 0.5) - 0.5, sx * (AV_HW - 0.5) + 0.5, GROUND + 0.2, GROUND + 5.4, AV_Z - 0.2, AV_Z + 0.15, 'stone')
    # balcony slab and balustrade in front of the loggia
    b.box(-AV_HW + 0.2, AV_HW - 0.2, GROUND + 0.2, GROUND + 0.5, AV_Z, AV_Z + 0.6, 'stone')
    b.box(-AV_HW + 0.25, AV_HW - 0.25, GROUND + 0.5, GROUND + 1.55, AV_Z + 0.35, AV_Z + 0.55, 'stone')
    # steps
    for i in range(3): b.box(-AV_HW - 0.8 + i * 0.2, AV_HW + 0.8 - i * 0.2, 0, 0.17 * (3 - i), AV_Z + 0.2, AV_Z + 0.2 + 0.5 * (3 - i), 'stone')
    # corner pavilions: round, with a cornice ring
    for (px, pz) in PAV:
        pillar_ring(b, px, pz, PAV_R, 12, 0, PAV_H, 'stone', rot=PI / 12)
        pillar_ring(b, px, pz, PAV_R + 0.4, 12, GROUND - 0.25, GROUND + 0.2, 'stone', rot=PI / 12)
        pillar_ring(b, px, pz, PAV_R + 0.55, 12, PAV_H - 0.7, PAV_H + 0.15, 'stone', rot=PI / 12)
        pillar_ring(b, px, pz, PAV_R + 0.3, 12, GROUND + 5.0, GROUND + 5.4, 'stone', rot=PI / 12)
        dome(b, px, PAV_H + 0.15, pz, 4.4, n=12, tall=1.15)
    # --- drum and central dome over the auditorium
    D = DRUM
    pillar_ring(b, D['x'], D['z'], D['r'], 16, D['y0'], D['y1'], 'stone', rot=PI / 16)
    pillar_ring(b, D['x'], D['z'], D['r'] + 0.45, 16, D['y1'] - 0.5, D['y1'] + 0.25, 'stone', rot=PI / 16)
    pillar_ring(b, D['x'], D['z'], D['r'] + 0.3, 16, D['y0'] + 1.0, D['y0'] + 1.4, 'stone', rot=PI / 16)
    dome(b, D['x'], D['y1'] + 0.25, D['z'], 9.6, n=16, tall=1.18)
    # statues on the cornice and the pediment
    for sx in (-1, 1):
        for zz in (-6.0, 4.0, 14.0): statue(b, sx * (HW - 0.4), CORN + 0.6, zz, 2.3)
        statue(b, sx * (AV_HW + 0.3), CORN + 0.4, AV_Z + 0.1, 2.6)
    statue(b, 0.0, CORN + 4.6, AV_Z - 0.2, 3.0)                                                  # group on the pediment apex

def build_openings():
    # front, central bay: ground floor three round-headed doors/windows, first floor loggia (deep recesses between the paired columns)
    for i, x in enumerate((-4.9, 0.0, 4.9)):
        opening(x, 0.7, AV_Z, 0, 2.6, 3.6, 0.7, mull=(i != 1), role_back='dark' if i == 1 else 'glass')
        # first-floor loggia
        opening(x, GROUND + 0.5, AV_Z, 0, 2.7, 4.3, 1.6, mull=True)
    # lunette in the pediment (round window) with a gold ring
    with inl.at(0, CORN + 2.0, AV_Z + 0.55, 0):
        inl.prism([(1.1 * math.cos(2 * PI * i / 12), 1.1 * math.sin(2 * PI * i / 12)) for i in range(12)], 0.0, 0.15, 'gold')
        inl.prism([(0.8 * math.cos(2 * PI * i / 12), 0.8 * math.sin(2 * PI * i / 12)) for i in range(12)], 0.1, 0.2, 'glass')
    # pavilions: three windows per floor on the front half, facets of the 12-gon face 0, +-30, +-60 degrees
    fr = PAV_R * math.cos(PI / 12)
    for (px, pz) in PAV:
        for k in (-2, -1, 0, 1, 2):
            a = k * PI / 6
            x = px + fr * math.sin(a); z = pz + fr * math.cos(a)
            if k in (-2, 2): continue                                                         # outermost facets meet the side walls
            opening(x, 0.8, z, a, 1.5, 3.1, 0.5, mull=False)
            opening(x, GROUND + 0.9, z, a, 1.4, 3.3, 0.5, mull=True)
            opening(x, PAV_H - 5.2, z, a, 1.2, 2.5, 0.45, mull=False)
    # sides of the main block: ground floor windows, first floor tall windows, attic small windows
    for sx in (-1, 1):
        face = sx * PI / 2
        for zz in (-9.0, -3.0, 3.0, 9.0):
            opening(sx * HW, 1.0, zz, face, 1.5, 2.6, 0.5, mull=False)
            opening(sx * HW, GROUND + 0.9, zz, face, 1.8, 4.1, 0.55, mull=True)
            opening(sx * HW, GROUND + 7.7, zz, face, 1.0, 1.1, 0.4, mull=False)
    # rear wall: tall windows
    for x in (-11.0, -5.5, 5.5, 11.0):
        opening(x, GROUND + 0.9, Z0, PI, 1.8, 4.1, 0.55, mull=True); opening(x, 1.0, Z0, PI, 1.5, 2.6, 0.5, mull=False)
    # stage house: tall windows on the sides, dark gates
    for sx in (-1, 1):
        for zz in (-22.0, -16.0, -10.0):
            for y in (3.0, 10.0, 17.0): opening(sx * STAGE['hw'], y, zz, sx * PI / 2, 1.3, 3.0, 0.4, mull=False)
    # drum: round-headed windows round the drum
    D = DRUM
    for i in range(16):
        a = (i + 0.0) * 2 * PI / 16                                                           # facet normals at multiples of 22.5 degrees
        x = D['x'] + D['r'] * math.cos(PI / 16) * math.cos(a); z = D['z'] + D['r'] * math.cos(PI / 16) * math.sin(a)
        if i % 2 == 0: opening(x, D['y0'] + 1.3, z, PI / 2 - a, 1.6, 2.2, 0.5, mull=True)
    # grooves of the rusticated ground floor (every 0.95 m): front bay, sides, rear
    for k in range(5):
        y = 0.9 + k * 0.95
        cut.box(-AV_HW, AV_HW, y, y + 0.1, AV_Z - 0.12, AV_Z + 0.5, 'stone')
        for sx in (-1, 1): cut.box(sx * HW - 0.12, sx * HW + 0.5, y, y + 0.1, Z0, Z1 - 8, 'stone') if sx > 0 else cut.box(sx * HW - 0.5, sx * HW + 0.12, y, y + 0.1, Z0, Z1 - 8, 'stone')
        cut.box(-HW, HW, y, y + 0.1, Z0 - 0.5, Z0 + 0.12, 'stone')

build(); build_openings()

VIEWS = {
    'front': ((-8, 4, 70), (0, 14, 0), 36),                  # from the singing fountain, as in the photo
    'front-low': ((-30, 2.5, 52), (0, 14, 20), 36),
    'nw': ((-64, 24, 46), (0, 14, 0), 36),
    'rear': ((14, 10, -70), (0, 14, -5), 36),
    'aerial': ((60, 60, 60), (0, 12, 0), 42),
    'close': ((6, 4, 42), (0, 10, 28), 45),
}
assemble('theatre', body, cut, inl, argv, out_glb, size=2048, tiling={}, views=VIEWS,
         geom_colours={'stone': 0xf1e8cc, 'stone2': 0xe9dfc2, 'tiles': 0x444444, 'copper': 0x56705f, 'gold': 0xd6aa48, 'glass': 0x34506a, 'dark': 0x2b2d31})
