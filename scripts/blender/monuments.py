"""Immaculata (Marian plague column, 1720-23) and the Singing Fountain (1986) of Kosice (S0004 01).

    Blender -b --factory-startup -P scripts/blender/monuments.py -- <out.glb> --which immaculata|fountain [--stage geom|full] [--size 1024] [--previews <dir>]

Immaculata (local frame: column axis at the origin, ground y = 0), from the Commons photos: stepped round base, a pedestal with four saints at the corners
and cherubs, a tall slender shaft, a gilded globe with the Virgin on it and a halo of gold stars; pale limestone. About 13 m tall.
Fountain (local frame: z along the long axis of the OSM water polygon, 12.5 x 23.9 m, centre of the polygon at the origin): the granite rim and the water of the
basin (raised 8 / 15 cm over the near ring's own basin, which the near ring drops when it touches the build pad) and the rows of nozzles with white jets.
"""
import os, sys, math
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import bpy, bmesh
from lib import *
from pipeline import *

argv = cli(); out_glb = argv[0] if argv else '/tmp/monument.glb'
WHICH = argv[argv.index('--which') + 1] if '--which' in argv else 'immaculata'
PI = math.pi
body = Build('body'); cut = Build('cut'); inl = Build('inlay')

def ring_pts(cx, cz, r, n, rot=0.0): return [(cx + r * math.cos(rot + 2 * PI * i / n), cz + r * math.sin(rot + 2 * PI * i / n)) for i in range(n)]

def figure(b, x, y, z, h, w=0.4, role='stone'):
    """Simple robed figure: a tapered body, shoulders, head."""
    with b.at(x, y, z, 0):
        b.lathe([(0, 0), (w, 0), (w * 0.8, h * 0.45), (w * 0.62, h * 0.72), (w * 0.4, h * 0.8), (0.0, h * 0.8)], 8, 0, role)
        b.lathe([(0, h * 0.78), (w * 0.34, h * 0.8), (w * 0.3, h * 0.93), (w * 0.12, h), (0, h)], 8, 0, role)

if WHICH == 'immaculata':
    # S0004 09 remodel from File:Sculpture Immaculata - Plague Column.jpg and File:Immaculata (Plague Column) - Old Town - Kosice - Slovakia (36398204192).jpg:
    # a stepped terrace, a big square pedestal with a moulded cornice and corner volutes carrying four saints (St. Joseph with the Child, a bishop,
    # a king, a monk), a second stage, an obelisk of billowing clouds covered with winged cherub heads and putti, the gilded globe, the Virgin with crossed
    # hands and the gold halo of twelve stars. Pale limestone. About 14.6 m. The terrace stays inside the old octagon (x, z within 3.6, |x| + |z| <= 5.1),
    # the hull js/core/landmark-sites.ts keeps.
    import sculpts as SC
    STYLES['stone'].update(c1=0xd9d2c1, c2=0xcbc3b0, mortar=0xb9b19d, bw=1.1, rh=0.45, msize=0.004, nz=0.35)    # dressed blocks of the terrace and pedestal
    STYLES['stone2'].update(c1=0xd4ccba, c2=0xcdc5b2, mortar=0xcdc5b2, bw=0.7, rh=0.35, msize=0.0, nz=0.45)    # carved stone: no joints, weathered
    b = body
    def chamfer_sq(h, c):                                                    # square of half-width h with corners cut at |x| + |z| = c
        return [(h, -(c - h)), (h, c - h), (c - h, h), (-(c - h), h), (-h, c - h), (-h, -(c - h)), (-(c - h), -h), (c - h, -h)]
    # terrace: three steps
    y = 0.0
    for h, c, dh in ((3.5, 5.0, 0.22), (3.1, 4.5, 0.22), (2.7, 4.0, 0.22)):
        b.plan(chamfer_sq(h, c), y, y + dh, 'stone'); b.plan(chamfer_sq(h + 0.04, c + 0.05), y + dh - 0.06, y + dh, 'stone'); y += dh
    T = y
    # low parapet round the terrace corners (the iron railing between them is left out), with ball finials
    for sx in (-1, 1):
        for sz in (-1, 1):
            with b.at(sx * 2.1, T, sz * 2.1, 0):
                b.cbox(0, 0, 0.55, 0.55, 0, 0.75, 'stone'); b.cbox(0, 0, 0.68, 0.68, 0.75, 0.86, 'stone')
                b.lathe([(0, 0.86), (0.12, 0.86), (0.2, 0.98), (0.17, 1.1), (0, 1.16)], 8, 0, 'stone')
    # main pedestal: plinth, die with recessed panels, cornice
    P0 = T; b.box(-1.55, 1.55, P0, P0 + 0.35, -1.55, 1.55, 'stone'); b.box(-1.45, 1.45, P0 + 0.35, P0 + 0.5, -1.45, 1.45, 'stone')
    b.box(-1.25, 1.25, P0 + 0.5, P0 + 2.5, -1.25, 1.25, 'stone')
    for k in range(4):
        with cut.at(0, P0 + 0.85, 0, k * PI / 2): cut.box(-0.8, 0.8, 0, 1.3, 1.25 - 0.06, 1.4, 'stone')            # sunk panels
        with inl.at(0, P0 + 0.85, 0, k * PI / 2): inl.box(-0.55, 0.55, 0.25, 1.05, 1.18, 1.21, 'gold')              # gilded inscription plates
    b.box(-1.4, 1.4, P0 + 2.5, P0 + 2.65, -1.4, 1.4, 'stone'); b.box(-1.6, 1.6, P0 + 2.65, P0 + 2.9, -1.6, 1.6, 'stone')
    b.box(-1.5, 1.5, P0 + 2.9, P0 + 3.0, -1.5, 1.5, 'stone')
    # corner volutes (horizontal scroll drums facing out on the diagonals) carrying the saints
    for k, (sx, sz) in enumerate(((1, 1), (-1, 1), (-1, -1), (1, -1))):
        ang = math.atan2(sx, sz)
        with b.at(sx * 1.55, P0, sz * 1.55, ang):
            b.box(-0.45, 0.45, 0, 0.3, -0.5, 0.6, 'stone')
            b.prism([(0.52 * math.cos(2 * PI * i / 16), 0.95 + 0.52 * math.sin(2 * PI * i / 16)) for i in range(16)], -0.32, 0.32, 'stone')   # scroll drum, axis along the facing
            for sgn in (-1, 1):
                b.prism([(0.3 * math.cos(2 * PI * i / 12), 0.95 + 0.3 * math.sin(2 * PI * i / 12)) for i in range(12)], sgn * 0.32, sgn * 0.42, 'stone')  # scroll eye
            b.box(-0.42, 0.42, 1.25, 1.55, -0.55, 0.42, 'stone')                                        # top of the volute: base for the saint
            b.box(-0.47, 0.47, 1.55, 1.65, -0.6, 0.47, 'stone')
    for k, (sx, sz, pose) in enumerate(((1, 1, 'child'), (-1, 1, 'staff'), (-1, -1, 'book'), (1, -1, 'prayer'))):
        sc = Sculpt(0.035); ang = math.atan2(sx, sz)
        with sc.at(sx * 1.55, P0 + 1.63, sz * 1.55, ang): SC.robed(sc, 2.35, pose, seed=k + 3)
        sc.into(inl, 'stone2', 0.2)
    # second stage: smaller block with a moulded top
    Q0 = P0 + 3.0
    b.box(-1.05, 1.05, Q0, Q0 + 0.7, -1.05, 1.05, 'stone'); b.box(-1.15, 1.15, Q0 + 0.7, Q0 + 0.85, -1.15, 1.15, 'stone')
    # the cloud obelisk: a tapering core of billowing clouds, cherub heads in spirals, putti clambering up
    C0 = Q0 + 0.85; CH = 7.2
    sc = Sculpt(0.06)
    import random as _r; rnd = _r.Random(5)
    n = 34
    for i in range(n):
        t = i / (n - 1); yy = C0 + 0.3 + t * (CH - 0.6); rr = 0.9 - 0.45 * t
        sc.ell(0, yy, 0, rr * 0.62, 0.4, rr * 0.62)                                                        # core
        for j in range(2):
            a = i * 2.4 + j * PI + rnd.uniform(-0.4, 0.4)
            sc.ell(rr * 0.62 * math.cos(a), yy + rnd.uniform(-0.1, 0.1), rr * 0.62 * math.sin(a), rr * rnd.uniform(0.42, 0.55), rr * 0.33, rr * rnd.uniform(0.42, 0.55), ay=a)
    sc.into(inl, 'stone2', 0.16)
    sc = Sculpt(0.022)
    for i in range(18):                                                                                   # cherub heads on the clouds
        t = (i + 0.5) / 18; yy = C0 + 0.5 + t * (CH - 1.2); rr = 0.9 - 0.45 * t
        a = i * 2.2 + 0.3
        SC.cherub_head(sc, (rr * 1.08) * math.sin(a), yy, (rr * 1.08) * math.cos(a), 0.17, face=a)
    sc.into(inl, 'stone2', 0.15)
    sc = Sculpt(0.03)
    for i in range(6):                                                                                    # putti
        t = (i + 0.3) / 6; yy = C0 + 0.2 + t * (CH - 1.8); rr = 0.85 - 0.45 * t
        a = i * 1.05 + 0.8
        SC.putto(sc, rr * math.sin(a), yy, rr * math.cos(a), 0.85, face=a, seed=i)
    sc.into(inl, 'stone2', 0.25)
    # gilded globe, the Virgin, the halo of twelve stars
    G = C0 + CH
    with b.at(0, G + 0.4, 0, 0): b.lathe([(0, -0.38), (0.21, -0.33), (0.33, -0.19), (0.38, 0), (0.33, 0.19), (0.21, 0.33), (0, 0.38)], 14, 0, 'gold')
    sc = Sculpt(0.028)
    with sc.at(0, G + 0.78, 0, 0): SC.virgin(sc, 2.3)
    sc.into(inl, 'stone2', 0.35)
    with inl.at(0, G + 0.78 + 2.3 * 0.95, -0.05, 0):
        R = 0.62
        for k in range(12):                                                                               # stars (flat 5-point stars on a thin ring)
            a = 2 * PI * k / 12; cx, cy = R * math.cos(a), R * math.sin(a) * 0.35 + 0.15
            star = [((0.11 if j % 2 == 0 else 0.045) * math.cos(PI / 2 + PI * j / 5), (0.11 if j % 2 == 0 else 0.045) * math.sin(PI / 2 + PI * j / 5)) for j in range(10)]
            with inl.at(cx, cy, R * math.sin(a), 0): inl.prism(star, -0.025, 0.025, 'gold')
        ring = [(R * math.cos(2 * PI * k / 24), R * math.sin(2 * PI * k / 24)) for k in range(24)]
        for k in range(24):
            (x0, z0), (x1, z1) = ring[k], ring[(k + 1) % 24]
            inl.beam((x0, 0.15 + z0 * 0.35, z0), (x1, 0.15 + z1 * 0.35, z1), 0.025, 0.025, (0, 1, 0), 'gold')
    views = {'front': ((14, 7, 30), (0, 7, 0), 36), 'low': ((4.5, 1.6, 9), (0, 7, 0), 45), 'top': ((3.5, 14, 6), (0, 13.2, 0), 40),
             'far': ((60, 14, 90), (0, 7, 0), 36), 'game': ((-40, 18, 60), (0, 7, 0), 30), 'base': ((5, 3, 6), (0, 2.5, 0), 45)}
    size = 1024; geom = {'stone': 0xd8d1c0, 'stone2': 0xc9c1ae, 'gold': 0xe3b34a}
    name = 'immaculata'
    LODS = ((3.0, 0.35), (15.0, 0.12))
else:
    STYLES['stone'].update(c1=0x4d5256, c2=0x42464a, mortar=0x3a3d40, bw=2.0, rh=1.0, msize=0.0, nz=0.2)                     # dark granite
    STYLES['stone2'].update(c1=0xe8f2f6, c2=0xdce9ef, mortar=0xdce9ef, bw=1.0, rh=1.0, msize=0.0, nz=0.1)                   # spray white
    b = body; WL = 0.40
    PALETTE['glass'] = 0x4f8fb5; ROLES['glass'].update(rough=0.15, emit=(0x6a8fb0, 0.5))
    # The basin: the OSM water polygon (12.5 x 23.9 m) drawn here too, because the near ring drops small water that touches the player's pad (js/core/placement.ts),
    # as it does on the cathedral plot. Where the near ring does draw it (water 0.32, rim 0.55) this one sits 8 and 15 cm above it, so nothing shares a plane.
    HX, HZ, RW = 6.25, 11.95, 0.45
    b.box(HX - RW, HX + RW, 0, 0.70, -HZ - RW, HZ + RW, 'stone'); b.box(-HX - RW, -HX + RW, 0, 0.70, -HZ - RW, HZ + RW, 'stone')
    b.box(-HX + RW, HX - RW, 0, 0.70, HZ - RW, HZ + RW, 'stone'); b.box(-HX + RW, HX - RW, 0, 0.70, -HZ - RW, -HZ + RW, 'stone')
    b.box(-HX + RW, HX - RW, 0.28, 0.40, -HZ + RW, HZ - RW, 'glass')
    # jet clusters along the long axis
    # The jets are NOT modelled here: they are animated translucent water in js/landmarks/fountain-jets.ts (a baked cone reads as a grey spike). That file lists the same nozzles.
    def jet(x, z, h, r=0.09, top=0.28): pass
    zs = (-7.5, 0.0, 7.5)
    for zc in zs:
        b.plan(ring_pts(0, zc, 2.6, 14), WL - 0.05, WL + 0.12, 'stone')                                           # granite ring plate round a cluster
        jet(0, zc, 3.4, 0.1, 0.34)
        for x, z in ring_pts(0, zc, 1.1, 6): jet(x, z, 2.1, 0.08, 0.26)
        for x, z in ring_pts(0, zc, 2.0, 12, PI / 12): jet(x, z, 1.1, 0.06, 0.2)
    for z in (-3.75, 3.75):
        b.plan(ring_pts(0, z, 1.0, 10), WL - 0.05, WL + 0.12, 'stone'); jet(0, z, 2.6, 0.08, 0.28)
    for sx in (-1, 1):                                                                                           # side rows of small jets, spray arcs
        for i in range(-5, 6):
            b.plan(ring_pts(sx * 4.2, i * 2.0, 0.3, 6), WL - 0.03, WL + 0.1, 'stone'); jet(sx * 4.2, i * 2.0, 1.0 + 0.15 * (i % 3), 0.05, 0.16)
    views = {'front': ((-4, 8, 34), (0, 1, 0), 40), 'low': ((-3, 1.4, 18), (0, 1.5, 0), 40), 'aerial': ((20, 26, 22), (0, 0, 0), 40)}
    size = 1024; geom = {'stone': 0x4d5256, 'stone2': 0xe8f2f6, 'glass': 0x4f8fb5}
    name = 'fountain'
    ROLES['stone2'].update(emit=(0x6f7f88, 0.6))
    ROLES['glass']['density'] = 0.3
    LODS = ((6.0, 0.6), (25.0, 0.3))

assemble(name, body, cut, inl, argv, out_glb, size=size, tiling={}, views=views, geom_colours=geom, union=(WHICH != 'fountain'), lods=LODS, flat_roles=('stone2',) if WHICH == 'immaculata' else ())
