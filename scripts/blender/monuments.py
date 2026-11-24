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
    STYLES['stone'].update(c1=0xd8d1c0, c2=0xc9c1ae, mortar=0xbfb7a4, bw=1.2, rh=0.6, msize=0.004, nz=0.4)
    STYLES['stone2'].update(c1=0xc9c1ae, c2=0xb8af9b, mortar=0xb0a792, bw=1.0, rh=0.5, msize=0.004, nz=0.4)
    b = body
    # stepped octagonal base (3 steps), pedestal with corner volutes
    for i, (r, h) in enumerate(((3.6, 0.3), (3.1, 0.35), (2.6, 0.35))):
        y0 = sum(hh for _, hh in ((3.6, 0.3), (3.1, 0.35), (2.6, 0.35))[:i]); b.plan(ring_pts(0, 0, r / math.cos(PI / 8), 8, PI / 8), y0, y0 + h, 'stone2')
    Y = 1.0
    b.box(-1.55, 1.55, Y, Y + 0.45, -1.55, 1.55, 'stone')                                    # pedestal plinth
    b.box(-1.15, 1.15, Y + 0.45, Y + 3.4, -1.15, 1.15, 'stone')                              # pedestal
    b.box(-1.5, 1.5, Y + 3.4, Y + 3.8, -1.5, 1.5, 'stone')                                   # cornice
    for sx in (-1, 1):
        for sz in (-1, 1):
            figure(b, sx * 1.65, Y + 0.45, sz * 1.65, 2.3, 0.38, 'stone2')                   # saints at the corners
            b.cbox(sx * 1.45, sz * 1.45, 0.5, 0.5, Y + 0.45, Y + 0.95, 'stone')
    # shaft with capital and a cloud of cherubs under the globe
    b.lathe([(0, Y + 3.8), (0.62, Y + 3.8), (0.5, Y + 4.1), (0.42, Y + 8.2), (0.55, Y + 8.4), (0.7, Y + 8.7), (0.0, Y + 8.7)], 12, 0, 'stone')
    b.lathe([(0, Y + 8.7), (0.95, Y + 8.7), (1.0, Y + 9.15), (0.75, Y + 9.6), (0.0, Y + 9.7)], 10, 0, 'stone2')        # cloud
    for k in range(4):
        a = k * PI / 2 + PI / 4; figure(b, math.cos(a) * 0.85, Y + 8.9, math.sin(a) * 0.85, 0.75, 0.16, 'stone')
    # gilded globe, the Virgin, halo of stars
    with b.at(0, Y + 10.3, 0, 0): b.lathe([(0, -0.55), (0.3, -0.45), (0.55, 0), (0.3, 0.45), (0, 0.55)], 10, 0, 'gold')
    figure(b, 0, Y + 10.75, 0, 2.2, 0.42, 'stone')
    with b.at(0, Y + 13.2, 0, 0):
        b.lathe([(0.52, 0), (0.58, 0), (0.58, 0.07), (0.52, 0.07)], 14, 0, 'gold')                                          # halo ring
        for k in range(8):
            a = k * PI / 4
            b.cbox(math.cos(a) * 0.55, math.sin(a) * 0.55, 0.13, 0.13, 0.07, 0.2, 'gold')
    views = {'front': ((18, 8, 36), (0, 7, 0), 36), 'low': ((6, 1.5, 12), (0, 8, 0), 45), 'top': ((5, 12.5, 9), (0, 11.5, 0), 40), 'far': ((60, 14, 90), (0, 7, 0), 36)}
    size = 1024; geom = {'stone': 0xd8d1c0, 'stone2': 0xc9c1ae, 'gold': 0xe3b34a}
    name = 'immaculata'
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

assemble(name, body, cut, inl, argv, out_glb, size=size, tiling={}, views=views, geom_colours=geom, union=(WHICH != 'fountain'))
