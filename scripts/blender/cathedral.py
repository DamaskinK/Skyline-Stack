"""St. Elisabeth Cathedral, Kosice, as a Draco GLB with three LODs and one atlas (ticket S0001 40).

    Blender -b --factory-startup -P scripts/blender/cathedral.py -- <out.glb> [--size 2048] [--stage geom|full] [--previews <dir>]

Local frame = js/landmarks/kosice.js (x east, z south, ground y = 0): the west front at x = -27, towers at x = -25.5, z = +-15.5,
nave and transept along x, apse to the east ending at x = 29. The game places the model at the OSM footprint centre, rotation 0.
Real building: ~60 m long, nave ridge ~30 m (vault 24 m), north tower 59 m with a green Baroque spire, lower unfinished Matthias tower
to the south with a small Renaissance cap, glazed diamond roof tiles (yellow, green, red, blue, black), rich Gothic portals on the
north, west and south, flying buttresses, pinnacles, a polygonal (5 facet) apse to the east.
"""
import os, sys, math, time
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import bpy, bmesh
import numpy as np
from lib import *

argv = cli()
out_glb = argv[0] if argv else '/tmp/cathedral.glb'
def opt(k, d):
    return argv[argv.index(k) + 1] if k in argv else d
SIZE = int(opt('--size', 2048)); STAGE = opt('--stage', 'full'); PREVIEWS = opt('--previews', None)
PI = math.pi

# ---------------------------------------------------------------- dimensions (m)
NAVE = dict(x0=-20.0, x1=13.5, hw=8.0, eave=19.0, ridge=30.0)        # nave runs through the crossing to the choir
AISLE = dict(x0=-20.0, x1=0.5, z0=8.0, z1=16.0, wall=11.0, roof_hi=15.4)
TRANS = dict(x0=0.5, x1=13.5, z=21.0, eave=19.0, ridge=30.0)
CHOIR = dict(x0=13.5, x1=22.0, hw=7.0, eave=18.0, ridge=27.0)
APSE_R = 7.0
WEST = dict(x0=-27.0, x1=-20.0, hw=10.0, h=23.0, gable=32.0)
TOWER_N = dict(x=-25.5, z=-15.5, s=11.0, shaft=30.0, belfry=7.0, belfry_s=8.6)
TOWER_S = dict(x=-25.5, z=15.5, s=11.0, shaft=31.0)
EAVE_OVER = 0.8

body = Build('body')      # masses, roofs, buttresses, pinnacles: unioned, then windows and portals cut
cut = Build('cut')        # cutters
inl = Build('inlay')      # glass, mullions, doors, spires, finials: not cut

def ridge_roof(b, x0, x1, hw, eave, ridge, over=EAVE_OVER, role='tiles'):
    """House-shaped prism along x: walls up to `eave`, steep roof to `ridge`, eaves overhang. Profile symmetric, so the local-x flip is harmless."""
    run = hw + over; k = (ridge - eave) / hw                       # slope
    prof = [(-hw, 0), (hw, 0), (hw, eave), (hw + over, eave - 0.45), (0, ridge), (-hw - over, eave - 0.45), (-hw, eave)]
    prof = [(p[0], p[1]) for p in prof]
    # the line from the eave tip to the ridge must keep the roof slope: tip height = ridge - k * run
    prof[3] = (hw + over, ridge - k * run); prof[5] = (-hw - over, ridge - k * run)
    with b.at(0, 0, 0, PI / 2): b.prism(prof, x0, x1, role)

def ridge_roof_z(b, cx, z0, z1, hw, eave, ridge, over=EAVE_OVER, role='tiles'):
    """Same along z (transept): local x = world x."""
    k = (ridge - eave) / hw; run = hw + over; t = ridge - k * run
    prof = [(-hw, 0), (hw, 0), (hw, eave), (hw + over, t), (0, ridge), (-hw - over, t), (-hw, eave)]
    with b.at(cx, 0, 0, 0): b.prism(prof, z0, z1, role)

def pinnacle(b, x, z, y0, s=0.9, h=3.0, role='stone'):
    b.cbox(x, z, s, s, y0, y0 + h * 0.35, role)
    b.pyramid([(x - s * 0.62, z - s * 0.62), (x + s * 0.62, z - s * 0.62), (x + s * 0.62, z + s * 0.62), (x - s * 0.62, z + s * 0.62)], y0 + h * 0.35, (x, y0 + h, z), role)
    b.cbox(x, z, s * 0.45, s * 0.45, y0 + h * 0.35, y0 + h * 0.55, role)

def window_cut(x, y, z, face, w, h, depth, R=1.0, r=1.0):
    """Pointed-arch recess in a wall. `face` = outward direction angle (ry); (x,z) = centre of the sill on the wall surface."""
    prof, top = arch_profile(w, h, R)
    with cut.at(x, y, z, face): cut.prism(prof, -depth, 0.6)
    return top

def window_fill(x, y, z, face, w, h, depth, R=1.0, mull=1, rose=True):
    """Glass pane at the back of a recess, mullions and a head ring in stone."""
    prof, top = arch_profile(w, h, R)
    with inl.at(x, y, z, face):
        inl.prism(prof, -depth + 0.02, -depth + 0.16, 'glass')
        for i in range(mull):
            mx = -w / 2 + w * (i + 1) / (mull + 1)
            inl.box(mx - 0.07, mx + 0.07, 0.0, top - 0.6 - abs(mx) * 0.2, -depth + 0.02, -depth + 0.34, 'stone')
        inl.box(-w / 2, w / 2, h * 0.58, h * 0.58 + 0.12, -depth + 0.02, -depth + 0.30, 'stone')

def portal(x, z, face, w, h, layers=4):
    """Stepped Gothic portal: nested pointed-arch recesses (width w, straight part h at the outer one), deeper toward a dark door leaf,
    under a pointed hood with two small pinnacles. Returns the apex height of the outer arch."""
    step = 0.62; top0 = None
    for i in range(layers):
        ww = w - i * step * 2; hh = h - i * 0.3
        depth = 0.3 + i * 0.6
        prof, top = arch_profile(ww, hh, 1.15)
        if top0 is None: top0 = top
        with cut.at(x, 0, z, face): cut.prism(prof, -depth, 0.7)
    prof, top = arch_profile(w - (layers - 1) * step * 2 - 0.3, h - (layers - 1) * 0.3 - 0.3, 1.15)
    d = 0.3 + (layers - 1) * 0.6
    with inl.at(x, 0, z, face): inl.prism(prof, -d + 0.02, -d + 0.2, 'dark')
    tw = w + 1.6
    with body.at(x, 0, z, face): body.prism([(-tw / 2, top0 - 0.9), (tw / 2, top0 - 0.9), (0, top0 + 0.4 + tw * 0.5)], -0.1, 0.5, 'stone')
    for sx in (-1, 1):
        with body.at(x, 0, z, face): pinnacle(body, sx * (tw / 2 + 0.25), 0.2, top0 - 1.6, 0.8, 3.2)
    return top0

# ---------------------------------------------------------------- masses
def build_body():
    b = body
    # nave through the crossing, steep glazed roof; west end hidden behind the front
    ridge_roof(b, NAVE['x0'], NAVE['x1'], NAVE['hw'], NAVE['eave'], NAVE['ridge'])
    # transept
    ridge_roof_z(b, (TRANS['x0'] + TRANS['x1']) / 2, -TRANS['z'], TRANS['z'], (TRANS['x1'] - TRANS['x0']) / 2, TRANS['eave'], TRANS['ridge'])
    # aisles: wall block and low roof sloping from the nave wall, both sides
    for s in (-1, 1):
        a = AISLE
        b.box(a['x0'], a['x1'], 0, a['wall'], min(s * a['z0'], s * a['z1']), max(s * a['z0'], s * a['z1']), 'stone')
        prof = [(a['z0'] - 0.5, a['wall'] - 0.2), (a['z1'], a['wall'] - 0.2), (a['z1'] + 0.9, a['wall'] + 0.35), (a['z0'] - 0.5, a['roof_hi'])]
        with b.at(0, 0, 0, PI / 2 * (-s)): b.prism(prof, a['x0'], a['x1'], 'tiles')
        # string course under the aisle roof and a plinth
        b.box(a['x0'] - 0.25, a['x1'], 0, 0.9, min(s * 7.6, s * 16.25), max(s * 7.6, s * 16.25), 'stone')
    # choir and polygonal apse (5 facets), roofs
    ridge_roof(b, CHOIR['x0'], CHOIR['x1'], CHOIR['hw'], CHOIR['eave'], CHOIR['ridge'])
    pts = [(CHOIR['x1'] + APSE_R * math.cos(math.radians(a)), APSE_R * math.sin(math.radians(a))) for a in (-90, -54, -18, 18, 54, 90)]
    b.plan([(CHOIR['x1'], -APSE_R)] + pts[1:-1] + [(CHOIR['x1'], APSE_R)], 0, CHOIR['eave'], 'stone')
    ap = [(x + (x - CHOIR['x1']) * 0.11, z * 1.11) for x, z in pts]                    # roof base slightly wider (eaves)
    b.pyramid([(CHOIR['x1'], -APSE_R * 1.11)] + ap[1:-1] + [(CHOIR['x1'], APSE_R * 1.11)], CHOIR['eave'] - 0.45, (CHOIR['x1'], CHOIR['ridge'], 0), 'tiles')
    # west front between the towers: block, steep gable with coping, plinth
    w = WEST
    b.box(w['x0'], w['x1'], 0, w['h'], -w['hw'], w['hw'], 'stone')
    with b.at(w['x0'] + 0.5, 0, 0, -PI / 2): b.prism([(-8.6, w['h'] - 0.2), (8.6, w['h'] - 0.2), (0, w['gable'])], -0.5, 0.9, 'stone')
    b.box(w['x0'] - 0.3, w['x1'], 0, 1.0, -w['hw'] + 0.4, w['hw'] - 0.4, 'stone')
    for sz in (-1, 1): pinnacle(b, w['x0'] + 0.3, sz * 8.9, w['h'] - 0.2, 1.1, 3.6)
    # towers
    for T in (TOWER_N, TOWER_S):
        x, z, s = T['x'], T['z'], T['s']; h = T['shaft']
        b.cbox(x, z, s, s, 0, h)
        b.cbox(x, z, s + 0.7, s + 0.7, 0, 1.2)                                         # plinth
        for y in (8.0, 16.5, h - 1.2):                                                 # string courses
            b.cbox(x, z, s + 0.55, s + 0.55, y, y + 0.45)
        b.cbox(x, z, s + 1.1, s + 1.1, h, h + 0.9)                                     # cornice
        for cx in (-1, 1):                                                            # square angle piers with a step, on all four corners
            for cz in (-1, 1):
                px, pz = x + cx * (s / 2), z + cz * (s / 2)
                b.cbox(px, pz, 1.7, 1.7, 0, h * 0.62); b.cbox(px, pz, 1.3, 1.3, h * 0.62, h * 0.86)
                pinnacle(b, px, pz, h * 0.86, 1.0, 3.2)
    # north tower belfry (8.6 square) with a cornice
    T = TOWER_N; b.cbox(T['x'], T['z'], T['belfry_s'], T['belfry_s'], T['shaft'] + 0.9, T['shaft'] + 0.9 + T['belfry'])
    b.cbox(T['x'], T['z'], T['belfry_s'] + 1.0, T['belfry_s'] + 1.0, T['shaft'] + 0.9 + T['belfry'], T['shaft'] + 1.6 + T['belfry'])
    # Matthias tower: unfinished stump, a lower drum
    T = TOWER_S; b.cbox(T['x'], T['z'], 8.8, 8.8, T['shaft'] + 0.9, T['shaft'] + 5.0)
    b.cbox(T['x'], T['z'], 9.8, 9.8, T['shaft'] + 5.0, T['shaft'] + 5.7)
    # aisle piers (buttresses) with pinnacles and flying arches over the aisle roofs; corner piers plain
    a = AISLE; bays = 4; pitch = (a['x1'] - a['x0']) / bays
    for s in (-1, 1):
        for k in range(bays + 1):
            px = a['x0'] + k * pitch + (0.55 if k == 0 else (-0.55 if k == bays else 0))
            pz = s * (a['z1'] + 0.6)
            b.box(px - 0.65, px + 0.65, 0, 12.6, min(s * 15.4, s * 17.5), max(s * 15.4, s * 17.5), 'stone')
            b.box(px - 0.55, px + 0.55, 12.6, 13.4, min(s * 15.7, s * 17.2), max(s * 15.7, s * 17.2), 'stone')
            pinnacle(b, px, pz, 13.4, 1.0, 4.6)
            if 0 < k < bays:                                                          # flying arch: curved bar from the pier top to the nave wall
                n = 7; prev = None
                for i in range(n + 1):
                    t = i / n; zz = 17.0 - 8.9 * t; yy = 13.4 + 4.0 * t + 1.7 * math.sin(math.pi * t) * (1 - t * 0.35)
                    if prev: b.beam((px, prev[1], s * prev[0]), (px, yy, s * zz), 0.75, 0.85, (0, 1, 0))
                    prev = (zz, yy)
                b.box(px - 0.4, px + 0.4, 16.4, 19.3, min(s * 8.0, s * 8.9), max(s * 8.0, s * 8.9), 'stone')   # pier stub on the nave wall
    # transept gable corners and gable pinnacles
    for sx in (TRANS['x0'] + 0.1, TRANS['x1'] - 0.1):
        for sz in (-1, 1):
            pinnacle(b, sx, sz * (TRANS['z'] - 0.15), TRANS['eave'] - 0.2, 1.2, 4.2)
    # nave eave corners at the west end are hidden by the towers; choir and apse buttresses
    for sz in (-1, 1):
        for x in (15.5, 19.5):
            b.box(x - 0.55, x + 0.55, 0, 16.5, min(sz * 6.6, sz * 8.4), max(sz * 6.6, sz * 8.4), 'stone')
            pinnacle(b, x, sz * 7.5, 16.5, 1.1, 4.2)
    for i, (x, z) in enumerate(pts):
        ang = math.atan2(z, x - CHOIR['x1'])
        with b.at(x, 0, z, -ang + PI / 2):
            b.box(-0.6, 0.6, 0, 15.8, -0.2, 1.3, 'stone')
            pinnacle(b, 0, 0.9, 15.8, 1.1, 4.4)
    # ridge crests (copper cap along every ridge)
    b.box(NAVE['x0'], NAVE['x1'], NAVE['ridge'] - 0.2, NAVE['ridge'] + 0.45, -0.28, 0.28, 'copper')
    b.box(CHOIR['x0'], CHOIR['x1'], CHOIR['ridge'] - 0.2, CHOIR['ridge'] + 0.4, -0.25, 0.25, 'copper')
    b.box((TRANS['x0'] + TRANS['x1']) / 2 - 0.28, (TRANS['x0'] + TRANS['x1']) / 2 + 0.28, TRANS['ridge'] - 0.2, TRANS['ridge'] + 0.45, -TRANS['z'], TRANS['z'], 'copper')

# ---------------------------------------------------------------- openings
def build_openings():
    a = AISLE; bays = 4; pitch = (a['x1'] - a['x0']) / bays
    for s in (-1, 1):
        face = PI if s < 0 else 0.0                                # outward direction of the wall: +z (south) = 0, north = pi
        for k in range(bays):
            cx = a['x0'] + (k + 0.5) * pitch
            # aisle window in the outer wall (z = +-16)
            window_cut(cx, 2.4, s * a['z1'], face, 2.5, 5.3, 0.8, 1.05); window_fill(cx, 2.4, s * a['z1'], face, 2.5, 5.3, 0.8, 1.05, 1)
            # clerestory in the nave wall (z = +-8), visible above the aisle roof
            window_cut(cx, 16.0, s * NAVE['hw'], face, 1.7, 1.5, 0.7, 1.1); window_fill(cx, 16.0, s * NAVE['hw'], face, 1.7, 1.5, 0.7, 1.1, 1)
    # nave wall between transept and choir has no clerestory; choir clerestory + windows
    for s in (-1, 1):
        face = PI if s < 0 else 0.0
        for x in (17.5,):
            window_cut(x, 5.0, s * CHOIR['hw'], face, 2.6, 7.2, 0.8, 1.1); window_fill(x, 5.0, s * CHOIR['hw'], face, 2.6, 7.2, 0.8, 1.1, 1)
    # apse: five tall windows, one per facet
    for i in range(5):
        a0 = math.radians(-90 + 36 * i + 18); mx = CHOIR['x1'] + APSE_R * 0.951 * math.cos(a0) / 0.951 * math.cos(math.radians(18)); mz = APSE_R * math.sin(a0) * math.cos(math.radians(18))
        # outward normal of facet i
        nx, nz = math.cos(a0), math.sin(a0); face = math.atan2(nx, nz)
        px = CHOIR['x1'] + APSE_R * math.cos(math.radians(18)) * nx; pz = APSE_R * math.cos(math.radians(18)) * nz
        window_cut(px, 4.2, pz, face, 1.9, 8.2, 0.8, 1.1); window_fill(px, 4.2, pz, face, 1.9, 8.2, 0.8, 1.1, 1)
    # transept gables (north z=-21, south z=+21, x centre 7): big tracery window and a portal each
    cx = (TRANS['x0'] + TRANS['x1']) / 2
    for s in (-1, 1):
        face = PI if s < 0 else 0.0
        zz = s * TRANS['z']
        portal(cx, zz, face, 4.6, 2.0, 4)
        window_cut(cx, 11.8, zz, face, 3.6, 5.0, 0.9, 1.15); window_fill(cx, 11.8, zz, face, 3.6, 5.0, 0.9, 1.15, 2)
        window_cut(cx, 22.4, zz, face, 1.6, 2.2, 0.6, 1.15); window_fill(cx, 22.4, zz, face, 1.6, 2.2, 0.6, 1.15, 1)
    # west front: main portal and the tall west window; north/south faces of the front block
    zf = WEST['x0']; face = -PI / 2
    portal(zf, 0.0, face, 5.6, 2.2, 4)
    window_cut(zf, 14.0, 0.0, face, 4.4, 5.2, 0.9, 1.15); window_fill(zf, 14.0, 0.0, face, 4.4, 5.2, 0.9, 1.15, 2)
    window_cut(zf, 26.4, 0.0, face, 1.8, 2.2, 0.5, 1.2); window_fill(zf, 26.4, 0.0, face, 1.8, 2.2, 0.5, 1.2, 1)
    # towers: lancet slits on every face, belfry louvres on the north tower, a smaller stage on the south one
    for T in (TOWER_N, TOWER_S):
        x, z, s = T['x'], T['z'], T['s']
        for (fx, fz, face) in ((1, 0, PI / 2), (-1, 0, -PI / 2), (0, 1, 0.0), (0, -1, PI)):
            px, pz = x + fx * s / 2, z + fz * s / 2
            for y in (3.2, 11.2, 19.5, 24.4):
                nt = 2 if y < 20 else 1
                for j in range(nt):
                    off = (j - (nt - 1) / 2) * 3.0
                    ox, oz = (0, off) if fx else (off, 0)
                    window_cut(px + ox, y, pz + oz, face, 1.0, 3.2 if y < 20 else 2.6, 0.5, 1.2)
                    prof, top = arch_profile(1.0, 3.2 if y < 20 else 2.6, 1.2)
                    with inl.at(px + ox, y, pz + oz, face): inl.prism(prof, -0.48, -0.38, 'glass')
    T = TOWER_N
    for (fx, fz, face) in ((1, 0, PI / 2), (-1, 0, -PI / 2), (0, 1, 0.0), (0, -1, PI)):
        px, pz = T['x'] + fx * T['belfry_s'] / 2, T['z'] + fz * T['belfry_s'] / 2
        y0 = T['shaft'] + 1.8
        window_cut(px, y0, pz, face, 3.0, 3.6, 0.9, 1.2)
        prof, top = arch_profile(3.0, 3.6, 1.2)
        with inl.at(px, y0, pz, face): inl.prism(prof, -0.85, -0.7, 'dark')
        with inl.at(px, y0, pz, face):
            for i in range(5):
                inl.box(-1.2 + i * 0.6, -1.08 + i * 0.6, 0.4, 3.4, -0.7, -0.45, 'stone')

# ---------------------------------------------------------------- spires and tops (not cut)
def spire(b, x, z, y0, rot=PI / 8, n=12, role='copper'):
    P = [(0, 0), (4.7, 0), (4.7, 0.8), (3.6, 1.5), (2.9, 2.4), (2.8, 3.6), (3.4, 4.8), (4.0, 6.2), (4.1, 7.4), (3.4, 8.8), (2.2, 10.2), (1.3, 11.4), (1.2, 12.8),
         (1.9, 13.0), (1.9, 13.4), (1.2, 13.6), (1.2, 14.6), (1.7, 15.6), (1.2, 16.8), (0.4, 18.4), (0.15, 21)]
    with b.at(x, y0, z, 0): b.lathe(P, n, rot, role)
    with b.at(x, y0, z, 0): b.lathe([(0.0, 21.0), (0.5, 21.0), (0.5, 21.6), (0.0, 22.0)], 6, 0, 'gold')

def build_tops():
    b = inl
    T = TOWER_N; x, z = T['x'], T['z']; y = T['shaft'] + 0.9 + T['belfry'] + 1.6
    spire(b, x, z, y)
    for dx in (-1, 1):
        for dz in (-1, 1):                                                              # four corner turrets of the spire base
            with b.at(x + dx * 4.4, y, z + dz * 4.4, 0):
                b.cbox(0, 0, 1.0, 1.0, 0, 1.4, 'stone'); b.lathe([(0.0, 1.4), (0.85, 1.4), (0.55, 2.8), (0.2, 4.8), (0.0, 5.0)], 6, 0.3, 'copper')
    T = TOWER_S; x, z = T['x'], T['z']; y = T['shaft'] + 5.7
    # small Renaissance cap: low hip with a lantern and a ball
    with b.at(x, y, z, 0):
        b.lathe([(0, 0), (5.6, 0), (5.6, 0.5), (4.5, 1.1), (3.0, 2.0), (2.0, 2.8), (2.1, 3.3), (1.4, 3.5), (1.4, 4.8), (1.9, 5.0), (1.3, 5.8), (0.6, 6.8), (0.1, 8.2)], 8, PI / 8, 'copper')
        b.lathe([(0.0, 8.2), (0.4, 8.2), (0.4, 8.7), (0.0, 9.0)], 6, 0, 'gold')
    # transept and west gable crosses
    for (x, z, y) in ((7.0, -20.9, TRANS['ridge'] - 0.3), (7.0, 20.9, TRANS['ridge'] - 0.3), (WEST['x0'] + 0.6, 0.0, WEST['gable'] - 0.2)):
        with b.at(x, y, z, 0): b.lathe([(0.0, 0), (0.4, 0), (0.4, 0.9), (0.0, 1.3)], 6, 0, 'stone'); b.cbox(0, 0, 0.12, 0.12, 1.2, 2.4, 'gold')
    # sanctus turret over the crossing: slim copper spirelet
    cx = (TRANS['x0'] + TRANS['x1']) / 2
    with b.at(cx, NAVE['ridge'] + 0.4, 0, 0):
        b.cbox(0, 0, 2.2, 2.2, 0, 1.6, 'stone')
        b.lathe([(0.0, 1.6), (1.5, 1.6), (1.0, 3.6), (0.5, 6.5), (0.12, 9.0), (0.0, 9.3)], 8, PI / 8, 'copper')

# ---------------------------------------------------------------- tile pattern (3 m repeat, 0.5 m diamond cells)
def write_tile_pattern(path, px=384, period=3.0):
    cells = 6; L = period / cells * 1.0                       # cell diagonal in metres: 6 cells across the period
    rng = np.random.default_rng(7)
    u = (np.arange(px) + 0.5) / px * period
    U, V = np.meshgrid(u, u)
    a = (U + V) / L; bb = (U - V) / L                           # rotated cell coordinates (a, b)
    ia, ib = np.floor(a).astype(int) % cells, np.floor(bb).astype(int) % cells
    fa, fb = a - np.floor(a), bb - np.floor(bb)
    c = (cells - 1) / 2
    d = np.maximum(np.abs(ia - c), np.abs(ib - c))              # Chebyshev rings around the lozenge centre
    pal = {k: np.array([(PALETTE[k] >> s & 255) / 255 for s in (16, 8, 0)]) for k in ('tileYellow', 'tileGreen', 'tileRed', 'tileBlue', 'tileBlack')}
    img = np.zeros((px, px, 3))
    corner = (np.abs(ia - c) > 2) & (np.abs(ib - c) > 2)
    for k, mask in (('tileRed', d < 1), ('tileYellow', (d >= 1) & (d < 2)), ('tileGreen', (d >= 2)), ('tileBlue', (d >= 2) & ((((ia == 0) | (ia == 5)) & ((ib == 2) | (ib == 3))) | (((ib == 0) | (ib == 5)) & ((ia == 2) | (ia == 3)))))):
        img[mask] = pal[k]
    img[corner] = pal['tileBlack']
    noise = rng.normal(1.0, 0.04, (cells, cells))[ia, ib][..., None]
    edge = np.minimum(np.minimum(fa, 1 - fa), np.minimum(fb, 1 - fb)); img *= (1 - 0.35 * np.clip(1 - edge / 0.06, 0, 1))[..., None] * noise
    # little centre highlight inside each tile
    img *= (0.94 + 0.12 * np.exp(-(((fa - 0.5) ** 2 + (fb - 0.5) ** 2) / 0.05)))[..., None]
    # to sRGB bytes
    rgba = np.concatenate([np.clip(img, 0, 1), np.ones((px, px, 1))], -1)
    im = bpy.data.images.new('tilepat', px, px, alpha=False); im.pixels = rgba[::-1].ravel().tolist(); im.filepath_raw = path; im.file_format = 'PNG'; im.save()
    bpy.data.images.remove(im)

# ---------------------------------------------------------------- assembly
def role_colours_material():
    mats = []
    for role in ROLE_ORDER:
        m = bpy.data.materials.new(f'flat_{role}'); m.use_nodes = True
        col = {'stone': 0xcfc6ae, 'tiles': 0x3d8a52, 'copper': 0x4f9a82, 'gold': 0xe3b34a, 'glass': 0x34506a, 'dark': 0x23272c}[role]
        m.node_tree.nodes['Principled BSDF'].inputs['Base Color'].default_value = srgb(col); m.node_tree.nodes['Principled BSDF'].inputs['Roughness'].default_value = 0.8
        mats.append(m)
    return mats

t0 = time.time()
reset()
build_body(); build_openings(); build_tops()
log('shells built', round(time.time() - t0, 1), 's')
ob = body.object(); co = cut.object(); oi = inl.object()
# 1. union the masses, then cut windows and portals
union_self(ob); log('union', len(ob.data.polygons), 'faces', round(time.time() - t0, 1), 's')
boolean(ob, co, 'DIFFERENCE', True); evaluated_copy(ob); bpy.data.objects.remove(co); log('cut', len(ob.data.polygons), 'faces', round(time.time() - t0, 1), 's')
# faces tagged tiles that are not sloped go back to stone (gable ends, eave undersides)
bm = bmesh.new(); bm.from_mesh(ob.data); lay = bm.faces.layers.int.get('role'); ti = ROLE_ORDER.index('tiles'); si = ROLE_ORDER.index('stone')
if lay is None: raise SystemExit('boolean dropped the role attribute')
for f in bm.faces:
    if f[lay] == ti and not (0.2 < f.normal.z < 0.985): f[lay] = si
bm.to_mesh(ob.data); bm.free()
if '--bevel' in argv: bevel_edges(ob, 0.09, 40, 1); evaluated_copy(ob)
# inlays join the body (they keep their own roles)
for o in (ob, oi): pass
bpy.ops.object.select_all(action='DESELECT'); oi.select_set(True); ob.select_set(True); bpy.context.view_layer.objects.active = ob; bpy.ops.object.join()
mesh_obj = bpy.context.view_layer.objects.active; mesh_obj.name = 'cathedral_LOD0'; mesh_obj.data.name = 'cathedral_LOD0'
merge_close(mesh_obj, 0.003); flat_shade(mesh_obj)
log('LOD0 triangles', tri_count(mesh_obj), 'time', round(time.time() - t0, 1), 's')

if STAGE == 'geom':
    mats = role_colours_material(); mesh_obj.data.materials.clear()
    for m in mats: mesh_obj.data.materials.append(m)
    bm = bmesh.new(); bm.from_mesh(mesh_obj.data); lay = bm.faces.layers.int.get('role')
    for f in bm.faces: f.material_index = f[lay]
    bm.to_mesh(mesh_obj.data); bm.free()
else:
    import tempfile; work = os.path.join(tempfile.gettempdir(), 'cathedral_work'); os.makedirs(work, exist_ok=True)   # intermediate PNGs stay out of the repo
    tile_png = os.path.join(work, 'tile_pattern.png'); write_tile_pattern(tile_png)
    pattern_uv(mesh_obj)
    parts = split_by_role(mesh_obj); bpy.data.objects.remove(mesh_obj)
    tiles_obj = parts.pop('tiles')                                              # roof tiles repeat (own material), everything else shares the atlas
    joined = unwrap_roles(parts, SIZE); joined.name = 'cathedral_LOD0'
    log('atlas coverage', round(uv_coverage(joined) * 100, 1), '% ; texel density', round(texel_density(joined, SIZE), 1), 'px/m')
    tuv = tiles_obj.data.uv_layers.new(name='atlas')
    for l in tuv.data: l.uv = (0.9995, 0.9995)                                  # no atlas space for tiles while baking (they still occlude)
    bpy.ops.object.select_all(action='DESELECT'); tiles_obj.select_set(True); joined.select_set(True); bpy.context.view_layer.objects.active = joined; bpy.ops.object.join()
    joined = bpy.context.view_layer.objects.active
    imgs = bake_atlas(joined, SIZE, tile_png, work)
    finish_images(imgs); save_images(imgs, work)
    tile_img = bpy.data.images.load(tile_png)
    mat_atlas, mat_tiles = final_materials(imgs, tile_img)
    me = joined.data; ti = ROLE_ORDER.index('tiles')
    me.materials.clear(); me.materials.append(mat_atlas); me.materials.append(mat_tiles)             # (clearing slots resets the indices: set them after)
    bm = bmesh.new(); bm.from_mesh(me); lay = bm.faces.layers.int.get('role'); puv = bm.loops.layers.uv['pat']; auv = bm.loops.layers.uv['atlas']
    for f in bm.faces:
        is_t = f[lay] == ti; f.material_index = 1 if is_t else 0
        if is_t:
            for l in f.loops: l[auv].uv = (l[puv].uv.x / TILE_PERIOD, l[puv].uv.y / TILE_PERIOD)
    bm.to_mesh(me); bm.free()
    me.uv_layers.remove(me.uv_layers['pat'])
    mesh_obj = joined
    flat_shade(mesh_obj)

# LODs (shared atlas)
lod1 = make_lod(mesh_obj, 'cathedral_LOD1', 6.0, 0.6); lod2 = make_lod(mesh_obj, 'cathedral_LOD2', 25.0, 0.3)
tris = [tri_count(o) for o in (mesh_obj, lod1, lod2)]
log('triangles LOD0/1/2', tris)
objs = [mesh_obj, lod1, lod2]
if STAGE != 'geom': export_glb(objs, out_glb)
# a root-level view for the previews: hide the LODs that are not shown
if PREVIEWS:
    os.makedirs(PREVIEWS, exist_ok=True)
    preview_scene(objs)
    for o in (lod1, lod2): o.hide_render = True
    VIEWS = {
        'game-nw': ((-70, 12, -62), (-14, 18, 6), 34),         # about the game camera: north-west of the north tower
        'ne': ((78, 40, -62), (0, 14, 0), 34),
        'south': ((14, 22, 95), (2, 16, 0), 38),
        'west': ((-78, 18, 8), (-22, 22, 0), 38),
        'aerial': ((50, 80, 70), (2, 12, 0), 42),
        'portal-west': ((-42, 5, 6), (-27, 6, 0), 45),
        'portal-south': ((12, 6, 40), (7, 8, 21), 40),
        'apse': ((70, 16, -20), (22, 12, 0), 40),
    }
    for name, (eye, tgt, lens) in VIEWS.items(): render_view(os.path.join(PREVIEWS, f'cathedral-{name}.png'), eye, tgt, lens)
    if len(sys.argv) and '--lods' in argv:
        for o in objs: o.hide_render = True
        for i, o in enumerate(objs):
            o.hide_render = False; render_view(os.path.join(PREVIEWS, f'cathedral-lod{i}.png'), (-60, 30, -60), (0, 18, 0), 40); o.hide_render = True
log('done', round(time.time() - t0, 1), 's')
