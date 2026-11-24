"""St. Elisabeth Cathedral, Kosice, as a Draco GLB with three LODs and one atlas (ticket S0001 40).

    Blender -b --factory-startup -P scripts/blender/cathedral.py -- <out.glb> [--size 2048] [--stage geom|full] [--previews <dir>]

Local frame = js/landmarks/kosice.js (x east, z south, ground y = 0): the west front at x = -27, towers at x = -25.5, z = +-15.5,
nave and transept along x, apse to the east ending at x = 29. The game places the model at the OSM footprint centre, rotation 0.
Real building: ~60 m long, nave ridge ~30 m (vault 24 m), north tower 59 m: square shaft, octagonal stage with corner turrets and a black and gold
Baroque crown with four clocks; lower Matthias tower to the south with a pierced gallery and a steep slate pyramid; a black ridge spire over the crossing;
glazed tiles in a terracotta field with zigzag bands; three equal gables (west, north, south) with crocketed copings and rich portals (the north one twin
with a trumeau and statues), pierced galleries along the eaves, traceried windows, pinnacled buttresses, a polygonal (5 facet) apse to the east.
Remodelled in S0004 09 against the photos listed in the ticket comments.
"""
import os, sys, math, time
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import bpy, bmesh
import numpy as np
from lib import *
from pipeline import *

import sculpts as SC
argv = cli()
out_glb = argv[0] if argv else '/tmp/cathedral.glb'
PI = math.pi
# S0004 09 (photos: File:Kosice - St. Elisabeth Cathedral - North tower.JPG, File:St. Elisabeth Cathedral - Old Town - Kosice - Slovakia (36169946860).jpg,
# File:Elisabeth Cathedral Kosice Portal.jpeg, File:Cathedral of St Elizabeth Košice, Staré Mesto, Slovakia.jpg): the metal roofs are dark slate grey (role 'copper'),
# the Baroque crown of the north tower and the ridge spire are black (role 'dark') with gilded ornament; statues are carved stone without joints ('stone2').
PALETTE['copper'] = 0x3d4248; PALETTE['copperDark'] = 0x33383e; PALETTE['copperLight'] = 0x4a4f55
ROLES['copper'].update(rough=0.55, metal=0.15, emit=(0x14171a, 1.0)); ROLES['dark'].update(rough=0.45, metal=0.2)
PALETTE['dark'] = 0x1d1f22
STYLES['stone2'].update(c1=0xc9bfa9, c2=0xbdb39d, mortar=0xbdb39d, bw=0.8, rh=0.4, msize=0.0, nz=0.45)

# ---------------------------------------------------------------- dimensions (m)
NAVE = dict(x0=-20.0, x1=13.5, hw=8.0, eave=19.0, ridge=30.0)        # nave runs through the crossing to the choir
AISLE = dict(x0=-20.0, x1=0.5, z0=8.0, z1=16.0, wall=11.0, roof_hi=12.8)
TRANS = dict(x0=0.5, x1=13.5, z=21.0, eave=19.0, ridge=30.0)
CHOIR = dict(x0=13.5, x1=22.0, hw=7.0, eave=18.0, ridge=27.0)
APSE_R = 7.0
WEST = dict(x0=-27.0, x1=-20.0, hw=10.0, h=23.0, gable=32.0)
TOWER_N = dict(x=-25.5, z=-15.5, s=11.0, shaft=31.0, oct_top=44.0, oct_r=4.4)
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
        if mull >= 1 and w >= 1.6:                                       # S0004 09: tracery (sub-lancets, ring with quatrefoil) instead of a plain mullion cross
            tracery(inl, w, h, R, mull + 1, z=-depth + 0.28, bar=0.15 if w < 3 else 0.18, d=0.2, role='stone2')
        else:
            inl.box(-0.07, 0.07, 0.0, top - 0.5, -depth + 0.02, -depth + 0.3, 'stone2')

def gallery(cx, cz, face, half, y0, y1, t=0.26):
    """Pierced Gothic gallery (lib.openwork) centred on the point (cx, cz), running along the wall whose outward direction is `face`."""
    c, sn = math.cos(face), math.sin(face)
    lz = cx * sn + cz * c; lx = cx * c - cz * sn
    openwork(body, cut, lx - half, lx + half, y0, y1, lz, face, t)

FIGS = []                                                                     # (x, y, z, ry, h, pose, seed): statues added as one sculpt at the end

def portal(x, z, face, w, h, layers=4, twin=False):
    """Stepped Gothic portal: nested pointed-arch recesses (width w, straight part h at the outer one), deeper toward the door,
    under a crocketed ogee hood with a finial and two pinnacles; `twin`: two doors with a trumeau and a statue on it, a tympanum with three figures
    (as the north portal, File:Elisabeth Cathedral Kosice Portal.jpeg); statues on corbels in the outer jambs. Returns the apex height of the outer arch."""
    step = 0.62; top0 = None
    for i in range(layers):
        ww = w - i * step * 2; hh = h - i * 0.3
        depth = 0.3 + i * 0.6
        prof, top = arch_profile(ww, hh, 1.15)
        if top0 is None: top0 = top
        with cut.at(x, 0, z, face): cut.prism(prof, -depth, 0.7)
    iw = w - (layers - 1) * step * 2; ih = h - (layers - 1) * 0.3
    prof, itop = arch_profile(iw - 0.3, ih - 0.3, 1.15)
    d = 0.3 + (layers - 1) * 0.6
    door_h = min(ih + 0.6, 3.6)
    with inl.at(x, 0, z, face):
        inl.prism(prof, -d + 0.02, -d + 0.2, 'dark')
        if twin:
            inl.box(-0.3, 0.3, 0, door_h, -d + 0.02, -d + 0.55, 'stone')                          # trumeau
            inl.box(-iw / 2, iw / 2, door_h, door_h + 0.35, -d + 0.02, -d + 0.45, 'stone')          # lintel
            inl.box(-iw / 2, iw / 2, door_h + 0.35, itop, -d + 0.05, -d + 0.25, 'stone2')           # tympanum
            FIGS.append((x, z, face, (0, 1.1, -d + 0.6), 1.25, 'prayer', 11))
            for k, fx in enumerate((-0.32, 0.0, 0.32)):
                FIGS.append((x, z, face, (fx * iw, door_h + 0.4, -d + 0.4), 0.95, ('open', 'crossed', 'book')[k], 20 + k))
    for sx in (-1, 1):                                                                           # jamb statues on corbels with canopies
        jx = sx * (w / 2 - 0.35)
        with inl.at(x, 0, z, face):
            inl.box(jx - 0.32, jx + 0.32, 1.7, 1.95, 0.05, 0.55, 'stone')
            inl.pyramid([(jx - 0.34, 0.0), (jx + 0.34, 0.0), (jx + 0.34, 0.6), (jx - 0.34, 0.6)], 3.55, (jx, 4.4, 0.3), 'stone')
        FIGS.append((x, z, face, (jx, 1.95, 0.3), 1.5, ('staff', 'book')[(sx + 1) // 2], 30 + sx))
    # ogee hood: concave from the springers, convex to the apex, crockets and a finial
    tw = w + 1.4; y0 = top0 - 1.2; apex = top0 + 2.6
    pts = []
    for i in range(11):
        t = i / 10; xx = (1 - t) * tw / 2
        yy = y0 + (apex - y0) * (0.5 - 0.5 * math.cos(math.pi * t))
        pts.append((xx, yy))
    with body.at(x, 0, z, face):
        for sgn in (-1, 1):
            arc_bar(body, [(sgn * px, py) for px, py in pts], 0.45, 0.6, 'stone')
        with body.at(0, 0, 0.3, 0):
            for sgn in (-1, 1):
                for i in range(1, 10, 2):
                    px, py = pts[i]; crockets(body, (sgn * px, py + 0.15, 0.0), (sgn * px, py + 0.15, 0.0), 1, 0.4)
        pinnacle(body, 0, 0.3, apex - 0.2, 0.6, 2.6)
    for sx in (-1, 1):
        with body.at(x, 0, z, face): pinnacle(body, sx * (tw / 2 + 0.25), 0.2, top0 - 1.6, 0.8, 3.6)
    return top0

def gable_dress(cx, cz, face, hw, y_eave, y_ridge, panels=True):
    """Gable front (S0004 09): moulded coping with crockets along both rakes, blind tracery panels (vertical ribs) on the gable field,
    a pierced gallery along the gable foot. The gable plane is z = 0 of the frame (cx, cz, face)."""
    with body.at(cx, 0, cz, face):
        for sgn in (-1, 1):
            body.beam((sgn * hw, y_eave, 0.15), (0, y_ridge + 0.2, 0.15), 0.5, 0.55, (0, 0, 1), 'stone')
            crockets(body, (sgn * hw * 0.95, y_eave + 0.95, 0.2), (sgn * 0.6, y_ridge + 0.1, 0.2), 8, 0.5)
        if panels:
            k = (y_ridge - y_eave) / hw
            n = int(hw / 1.1)
            for i in range(-n, n + 1):
                xx = i * hw / (n + 0.5); top = y_ridge - k * abs(xx) - 0.7
                if top - y_eave > 0.8: body.box(xx - 0.08, xx + 0.08, y_eave + 0.3, top, 0.0, 0.16, 'stone')

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
        # low lean-to roof hidden behind a pierced gallery on the aisle wall (S0004 09: the photos show a terrace balustrade at ~11 m, not a tiled skirt)
        prof = [(a['z0'] - 0.5, a['wall'] - 0.2), (a['z1'] - 0.3, a['wall'] - 0.2), (a['z1'] - 0.3, a['wall'] + 0.1), (a['z0'] - 0.5, a['roof_hi'])]
        with b.at(0, 0, 0, PI / 2 * (-s)): b.prism(prof, *((a['x0'], a['x1']) if s < 0 else (-a['x1'], -a['x0'])), 'tiles')   # S0004 09: the south one sat east of the transept
        if s > 0: openwork(b, cut, a['x0'], a['x1'], a['wall'] - 0.3, a['wall'] + 0.95, a['z1'] - 0.12, 0.0, 0.26)
        else: openwork(b, cut, -a['x1'], -a['x0'], a['wall'] - 0.3, a['wall'] + 0.95, a['z1'] - 0.12, PI, 0.26)
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
    # north tower (S0004 09, File:Kosice - St. Elisabeth Cathedral - North tower.JPG): above the square shaft an octagonal stone stage with a traceried frieze,
    # four small octagonal corner turrets on the diagonals; the black Baroque crown sits on it (build_tops)
    T = TOWER_N; x, z = T['x'], T['z']; r = T['oct_r'] / math.cos(PI / 8); y0 = T['shaft'] + 0.9; y1 = T['oct_top']
    def octo(rr, ya, yb, cx=x, cz=z, role='stone'): b.plan([(cx + rr * math.cos(PI / 8 + i * PI / 4), cz + rr * math.sin(PI / 8 + i * PI / 4)) for i in range(8)], ya, yb, role)
    octo(r, y0, y1); octo(r + 0.3, y0, y0 + 0.8); octo(r + 0.25, y1 - 1.6, y1 - 1.2); octo(r + 0.45, y1 - 0.3, y1 + 0.2)
    for dx in (-1, 1):
        for dz in (-1, 1):
            tx, tz = x + dx * 3.75, z + dz * 3.75
            octo(1.15, y0, y1 - 1.6, tx, tz); octo(1.35, y1 - 1.6, y1 - 1.25, tx, tz)
    # Matthias tower (south): the shaft ends in a pierced gallery with corner pinnacles, a steep slate pyramid with dormers rises inside it
    T = TOWER_S; x, z, sq = T['x'], T['z'], T['s'] + 1.1; yb = T['shaft'] + 0.9
    for face in (0.0, PI / 2, PI, -PI / 2):
        fx, fz = math.sin(face), math.cos(face)
        gallery(x + fx * (sq / 2 - 0.2), z + fz * (sq / 2 - 0.2), face, sq / 2 - 0.6, yb, yb + 1.25, 0.3)
    for dx in (-1, 1):
        for dz in (-1, 1): pinnacle(b, x + dx * (sq / 2 - 0.4), z + dz * (sq / 2 - 0.4), yb, 0.9, 3.4)
    # aisle piers (buttresses) with pinnacles and flying arches over the aisle roofs; corner piers plain
    a = AISLE; bays = 4; pitch = (a['x1'] - a['x0']) / bays
    for s in (-1, 1):
        for k in range(bays + 1):
            px = a['x0'] + k * pitch + (0.55 if k == 0 else (-0.55 if k == bays else 0))
            pz = s * (a['z1'] + 0.6)
            b.box(px - 0.65, px + 0.65, 0, 12.6, min(s * 15.4, s * 17.5), max(s * 15.4, s * 17.5), 'stone')
            b.box(px - 0.55, px + 0.55, 12.6, 13.4, min(s * 15.7, s * 17.2), max(s * 15.7, s * 17.2), 'stone')
            pinnacle(b, px, pz, 13.4, 1.0, 4.6)
            if 0 < k < bays:                                                          # buttress of the upper wall rising through the eave gallery, with a pinnacle
                b.box(px - 0.45, px + 0.45, a['roof_hi'] - 1.0, 19.6, min(s * 8.0, s * 9.1), max(s * 8.0, s * 9.1), 'stone')
                pinnacle(b, px, s * 8.6, 19.6, 0.9, 4.2)
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
    # S0004 09: the three equal gables (west, north, south) dressed with crocketed copings and blind tracery; galleries along the eaves and across the transept fronts
    w = WEST; gable_dress(w['x0'] - 0.4, 0.0, -PI / 2, 8.6, w['h'] - 0.2, w['gable'])
    k = (TRANS['ridge'] - TRANS['eave']) / ((TRANS['x1'] - TRANS['x0']) / 2); thw = (TRANS['x1'] - TRANS['x0']) / 2 + EAVE_OVER
    for sz in (-1, 1):
        face = 0.0 if sz > 0 else PI
        gable_dress(7.0, sz * TRANS['z'], face, thw, TRANS['ridge'] - k * thw, TRANS['ridge'])
        gallery(7.0, sz * (TRANS['z'] + 0.15), face, 5.6, 9.9, 11.1, 0.28)                       # under the big window
        gallery(7.0, sz * (TRANS['z'] + 0.15), face, 5.9, TRANS['eave'] - 0.9, TRANS['eave'] + 0.2, 0.28)   # at the foot of the gable
        gallery(-9.75, sz * 8.45, face, 10.2, NAVE['eave'] - 0.5, NAVE['eave'] + 0.6, 0.26)     # nave eave
        gallery(17.75, sz * 7.45, face, 4.2, CHOIR['eave'] - 0.5, CHOIR['eave'] + 0.6, 0.26)    # choir eave
    gallery(w['x0'] - 0.15, 0.0, -PI / 2, 7.6, 10.0, 11.2, 0.28)                                    # west front, under the window
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
            window_cut(cx, 13.2, s * NAVE['hw'], face, 2.4, 2.4, 0.7, 1.05); window_fill(cx, 13.2, s * NAVE['hw'], face, 2.4, 2.4, 0.7, 1.05, 1)
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
        portal(cx, zz, face, 4.6 if s > 0 else 5.6, 2.0 if s > 0 else 3.2, 4, twin=(s < 0))
        window_cut(cx, 11.8, zz, face, 3.6, 5.0, 0.9, 1.15); window_fill(cx, 11.8, zz, face, 3.6, 5.0, 0.9, 1.15, 2)
        window_cut(cx, 22.4, zz, face, 1.6, 2.2, 0.6, 1.15); window_fill(cx, 22.4, zz, face, 1.6, 2.2, 0.6, 1.15, 1)
    # west front: main portal and the tall west window; north/south faces of the front block
    zf = WEST['x0']; face = -PI / 2
    portal(zf, 0.0, face, 6.0, 3.2, 4, twin=True)
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
    T = TOWER_N                                                                         # octagonal stage: tall belfry lancets with louvres on the four cardinal faces
    for face in (0.0, PI / 2, PI, -PI / 2):
        px, pz = T['x'] + math.sin(face) * T['oct_r'], T['z'] + math.cos(face) * T['oct_r']
        y0 = T['shaft'] + 2.2
        window_cut(px, y0, pz, face, 1.9, 5.6, 0.8, 1.15)
        prof, top = arch_profile(1.9, 5.6, 1.15)
        with inl.at(px, y0, pz, face):
            inl.prism(prof, -0.78, -0.66, 'dark')
            for i in range(9): inl.box(-0.95, 0.95, 0.5 + i * 0.6, 0.62 + i * 0.6, -0.66, -0.5, 'stone2')
            tracery(inl, 1.9, 5.6, 1.15, 2, z=-0.35, bar=0.14, d=0.18, role='stone2')
    T = TOWER_N; x, z = T['x'], T['z']                                                 # traceried frieze under the cornice of the octagon
    for i in range(8):
        fa = i * PI / 4                                                                 # outward directions of the octagon faces (sin, cos)
        px, pz = x + math.sin(fa) * T['oct_r'], z + math.cos(fa) * T['oct_r']
        with cut.at(px, T['oct_top'] - 1.1, pz, fa):
            for j in range(3):
                prof, _ = arch_profile(0.8, 0.15, 1.0, 3)
                with cut.at(-1.0 + j * 1.0, 0, 0, 0): cut.prism(prof, -0.12, 0.4)

# ---------------------------------------------------------------- spires and tops (not cut)
def spire(b, x, z, y0, rot=PI / 8, n=12, role='copper'):
    P = [(0, 0), (4.7, 0), (4.7, 0.8), (3.6, 1.5), (2.9, 2.4), (2.8, 3.6), (3.4, 4.8), (4.0, 6.2), (4.1, 7.4), (3.4, 8.8), (2.2, 10.2), (1.3, 11.4), (1.2, 12.8),
         (1.9, 13.0), (1.9, 13.4), (1.2, 13.6), (1.2, 14.6), (1.7, 15.6), (1.2, 16.8), (0.4, 18.4), (0.15, 21)]
    with b.at(x, y0, z, 0): b.lathe(P, n, rot, role)
    with b.at(x, y0, z, 0): b.lathe([(0.0, 21.0), (0.5, 21.0), (0.5, 21.6), (0.0, 22.0)], 6, 0, 'gold')

def ring_beams(b, cx, y, cz, r, n, w, d, role, rot=0.0):
    pts = [(cx + r * math.cos(rot + 2 * PI * i / n), cz + r * math.sin(rot + 2 * PI * i / n)) for i in range(n)]
    for i in range(n):
        (x0, z0), (x1, z1) = pts[i], pts[(i + 1) % n]
        b.beam((x0, y, z0), (x1, y, z1), w, d, (0, 1, 0), role)

def baroque_crown(b, x, z, y):
    """Black Baroque crown of the north tower (1775), File:Kosice - St. Elisabeth Cathedral - North tower.JPG: octagonal gallery storey with gilded
    cartouches over arched openings, a cornice, an octagonal bell-shaped dome with gilded rocaille ribs and four clocks in gilded frames, an open lantern,
    a small cupola, a gilt ball and a cross. About 15 m, black sheet metal and gold."""
    oc = lambda rr: [(x + rr * math.cos(PI / 8 + i * PI / 4), z + rr * math.sin(PI / 8 + i * PI / 4)) for i in range(8)]
    b.plan(oc(5.05), y, y + 0.35, 'dark'); b.plan(oc(4.7), y + 0.35, y + 2.6, 'dark'); b.plan(oc(5.15), y + 2.6, y + 3.05, 'dark')
    for i in range(8):                                                                   # arched openings (dark recess look) with gilded cartouches above
        fa = i * PI / 4; r_in = 4.7 * math.cos(PI / 8)
        with b.at(x + math.sin(fa) * r_in, y + 0.55, z + math.cos(fa) * r_in, fa):
            prof, top = arch_profile(1.5, 1.0, 0.6, 4)
            b.prism(prof, 0.0, 0.06, 'glass')
            arc_bar(b, [(0.95, 0.0), (0.95, 1.0)] + [(0.95 * math.cos(PI * k / 6), 1.0 + 0.7 * math.sin(PI * k / 6)) for k in range(7)] + [(-0.95, 0.0)], 0.12, 0.1, 'gold')
            b.box(-0.6, 0.6, 1.85, 2.05, 0.0, 0.12, 'gold'); b.box(-0.2, 0.2, 1.75, 2.25, 0.0, 0.16, 'gold')
    ring_beams(b, x, y + 2.5, z, 4.95, 8, 0.12, 0.12, 'gold', PI / 8)
    # bell dome
    D = y + 3.05
    prof = [(0, 0), (4.75, 0), (4.6, 0.6), (4.25, 1.6), (3.6, 2.7), (2.7, 3.6), (2.05, 4.1), (1.95, 4.35), (0.0, 4.35)]
    with b.at(x, D, z, 0): b.lathe(prof, 8, PI / 8, 'dark')
    for i in range(8):                                                                   # gilded ribs on the dome corners and S-scrolls on the faces
        a = PI / 8 + i * PI / 4
        pts = [(x + (rr + 0.06) * math.cos(a), D + yy, z + (rr + 0.06) * math.sin(a)) for rr, yy in prof[1:7]]
        for k in range(len(pts) - 1): b.beam(pts[k], pts[k + 1], 0.16, 0.1, (0, 1, 0), 'gold')
        if i % 2 == 0: continue
        fa = a + PI / 8
        for sgn in (-1, 1):
            sp = [(x + (rr * math.cos(PI / 8) + 0.05) * math.cos(fa) + sgn * (0.5 + 0.35 * math.sin(k)) * -math.sin(fa), D + yy, z + (rr * math.cos(PI / 8) + 0.05) * math.sin(fa) + sgn * (0.5 + 0.35 * math.sin(k)) * math.cos(fa))
                  for k, (rr, yy) in enumerate(prof[1:6])]
            for k in range(len(sp) - 1): b.beam(sp[k], sp[k + 1], 0.13, 0.08, (0, 1, 0), 'gold')
    for face in (0.0, PI / 2, PI, -PI / 2):                                              # clocks in gilded frames on the cardinal faces of the dome
        with b.at(x + math.sin(face) * 3.3, D + 0.4, z + math.cos(face) * 3.3, face):
            b.box(-1.25, 1.25, 0, 2.5, -0.6, 1.0, 'dark')
            disc = [(1.0 * math.cos(2 * PI * k / 16), 1.4 + 1.0 * math.sin(2 * PI * k / 16)) for k in range(16)]
            b.prism(disc, 0.95, 1.08, 'stone2')
            arc_bar(b, disc + [disc[0]], 0.14, 0.18, 'gold')
            b.beam((0, 1.4, 1.1), (0.0, 2.05, 1.1), 0.07, 0.05, (0, 0, 1), 'dark'); b.beam((0, 1.4, 1.1), (0.45, 1.2, 1.1), 0.07, 0.05, (0, 0, 1), 'dark')
            for sgn in (-1, 1): b.beam((sgn * 1.25, 2.4, 1.0), (sgn * 0.3, 2.95, 1.0), 0.18, 0.12, (0, 0, 1), 'gold')
    # open lantern, cornice, small cupola, ball and cross
    L = D + 4.35
    lo = lambda rr: [(x + rr * math.cos(PI / 8 + i * PI / 4), z + rr * math.sin(PI / 8 + i * PI / 4)) for i in range(8)]
    b.plan(lo(2.15), L, L + 0.3, 'dark')
    for i in range(8):
        cx, cz = lo(1.85)[i]; b.cbox(cx, cz, 0.32, 0.32, L + 0.3, L + 2.5, 'dark')
    b.plan(lo(1.35), L + 0.3, L + 2.5, 'glass')
    ring_beams(b, x, L + 1.9, z, 1.95, 8, 0.12, 0.12, 'gold', PI / 8)
    b.plan(lo(2.35), L + 2.5, L + 2.95, 'dark'); ring_beams(b, x, L + 2.7, z, 2.4, 8, 0.12, 0.14, 'gold', PI / 8)
    with b.at(x, L + 2.95, z, 0):
        b.lathe([(0, 0), (2.0, 0), (1.85, 0.5), (1.3, 1.1), (0.6, 1.45), (0.35, 1.6), (0.45, 1.85), (0.0, 1.95)], 8, PI / 8, 'dark')
        b.lathe([(0, 1.9), (0.3, 1.95), (0.38, 2.2), (0.3, 2.45), (0, 2.5)], 8, 0, 'gold')
        b.cbox(0, 0, 0.12, 0.12, 2.45, 4.5, 'gold'); b.box(-0.55, 0.55, 3.75, 3.87, -0.06, 0.06, 'gold'); b.box(-0.06, 0.06, 3.75, 3.87, -0.55, 0.55, 'gold')
    return L + 2.95 + 4.5

def build_tops():
    b = inl
    T = TOWER_N; x, z = T['x'], T['z']; y = T['oct_top'] + 0.2
    top = baroque_crown(b, x, z, y); log('north tower top', round(top, 1), 'm')
    for dx in (-1, 1):
        for dz in (-1, 1):                                                              # four corner turrets: black caps with gilded bands
            tx, tz = x + dx * 3.75, z + dz * 3.75; ty = T['oct_top'] - 1.25
            with b.at(tx, ty, tz, 0):
                b.lathe([(0.0, 0.0), (1.25, 0.0), (1.25, 0.9), (1.4, 1.1), (1.0, 1.7), (0.45, 2.3), (0.3, 2.6), (0.4, 2.85), (0.0, 3.0)], 8, PI / 8, 'dark')
                b.lathe([(0.0, 0.4), (1.3, 0.4), (1.3, 0.6), (0.0, 0.6)], 8, PI / 8, 'gold')
                b.lathe([(0.0, 2.95), (0.15, 2.95), (0.15, 3.6), (0.0, 3.7)], 6, 0, 'gold')
    T = TOWER_S; x, z = T['x'], T['z']; y = T['shaft'] + 0.9
    # Matthias tower: steep slate pyramid inside the gallery, small dormers, gilt finial (File:St. Elisabeth Cathedral - Old Town ... (36169946860).jpg)
    with b.at(x, y, z, 0):
        b.lathe([(0, 0), (5.2, 0), (5.2, 0.4), (4.9, 1.0), (3.6, 4.2), (1.8, 8.2), (0.15, 11.5), (0, 11.6)], 4, PI / 4, 'copper')
        for face in (0.0, PI / 2, PI, -PI / 2):
            with b.at(math.sin(face) * 3.6, 3.0, math.cos(face) * 3.6, face):
                b.box(-0.55, 0.55, 0, 1.1, -0.8, 0.6, 'copper'); b.prism([(-0.7, 1.1), (0.7, 1.1), (0, 1.8)], -0.8, 0.7, 'copper')
                b.box(-0.35, 0.35, 0.15, 0.95, 0.6, 0.65, 'glass')
        b.lathe([(0.0, 11.5), (0.25, 11.6), (0.3, 11.9), (0.0, 12.1)], 6, 0, 'gold'); b.cbox(0, 0, 0.1, 0.1, 12.0, 13.4, 'gold')
    # transept and west gable crosses
    for (x, z, y) in ((7.0, -20.9, TRANS['ridge'] - 0.3), (7.0, 20.9, TRANS['ridge'] - 0.3), (WEST['x0'] + 0.6, 0.0, WEST['gable'] - 0.2)):
        with b.at(x, y, z, 0): b.lathe([(0.0, 0), (0.4, 0), (0.4, 0.9), (0.0, 1.3)], 6, 0, 'stone'); b.cbox(0, 0, 0.12, 0.12, 1.2, 2.4, 'gold')
    # ridge spire over the crossing (File:Cathedral of St Elizabeth Košice, Staré Mesto, Slovakia.jpg): tall, black, an open octagonal lantern ringed by
    # pinnacles, a needle spire with crockets on its eight edges, gilt ball and cross; its top level with the north tower's lantern (~50 m)
    cx = (TRANS['x0'] + TRANS['x1']) / 2; Y = NAVE['ridge'] - 0.6
    with b.at(cx, Y, 0, 0):
        oc = lambda rr: [(rr * math.cos(PI / 8 + i * PI / 4), rr * math.sin(PI / 8 + i * PI / 4)) for i in range(8)]
        b.plan(oc(1.9), 0, 1.6, 'dark'); b.plan(oc(2.1), 1.6, 1.9, 'dark')
        for i in range(8):
            px, pz = oc(1.7)[i]; b.cbox(px, pz, 0.28, 0.28, 1.9, 5.2, 'dark')
            ox, oz = oc(2.15)[i]
            b.cbox(ox, oz, 0.3, 0.3, 1.9, 4.4, 'dark'); b.pyramid([(ox - 0.2, oz - 0.2), (ox + 0.2, oz - 0.2), (ox + 0.2, oz + 0.2), (ox - 0.2, oz + 0.2)], 4.4, (ox, 6.4, oz), 'dark')
        b.plan(oc(1.15), 1.9, 5.2, 'glass')
        b.plan(oc(1.95), 5.2, 5.6, 'dark')
        b.lathe([(0, 5.6), (1.75, 5.6), (0.18, 19.6), (0, 19.8)], 8, PI / 8, 'dark')
        for i in range(8):
            a = PI / 8 + i * PI / 4
            crockets(b, (1.6 * math.cos(a), 6.6, 1.6 * math.sin(a)), (0.35 * math.cos(a), 17.6, 0.35 * math.sin(a)), 6, 0.3, 'dark')
        b.lathe([(0.0, 19.6), (0.3, 19.7), (0.32, 20.0), (0.0, 20.2)], 6, 0, 'gold'); b.cbox(0, 0, 0.1, 0.1, 20.1, 21.6, 'gold'); b.box(-0.4, 0.4, 21.0, 21.1, -0.05, 0.05, 'gold')

# ---------------------------------------------------------------- assembly (pipeline.py)
reset()
t0 = time.time()
build_body(); build_openings(); build_tops()
sc = Sculpt(0.03)                                                                     # portal statues: carved figures (lib.Sculpt), one shell set
for (x, z, face, (lx, ly, lz), h, pose, seed) in FIGS:
    with sc.at(x, 0, z, face):
        with sc.at(lx, ly, lz): SC.robed(sc, h, pose, seed=seed)
log('portal statues', len(FIGS), 'faces', sc.into(inl, 'stone2', 0.2))
log('shells built', round(time.time() - t0, 1), 's')
import tempfile
work = os.path.join(tempfile.gettempdir(), 'cathedral_work'); os.makedirs(work, exist_ok=True)
tile_png, stone_png, stone_n = (os.path.join(work, n) for n in ('tile_pattern.png', 'stone.png', 'stone_n.png'))
if (argv[argv.index('--stage') + 1] if '--stage' in argv else 'full') == 'full':
    write_tile_texture(tile_png, 'cathedral')
    # S0004 09: pale grey-beige sandstone with a patchwork of dark grey and reddish blocks (File:Elisabeth Cathedral Kosice Portal.jpeg, File:Kosice - St. Elisabeth Cathedral - North tower.JPG)
    write_stone_texture(stone_png, stone_n, period=3.2, px=1024, course=0.4, c1=0xb0a691, c2=0xa29884, mortar=0x928979, seed=11, block=(0.5, 1.2),
                        accents=((0.05, 0x6a645c), (0.03, 0x86705f), (0.06, 0x938a7b)))
tiling = {
    'tiles': dict(png=tile_png, period=TILE_PERIOD, rough=ROLES['tiles']['rough'], metal=ROLES['tiles']['metal']),
    'stone': dict(png=stone_png, normal=stone_n, period=3.2, rough=0.9, metal=0.0, ao=True),
}
VIEWS = {
    'game-nw': ((-70, 12, -62), (-14, 18, 6), 34),         # about the game camera: north-west of the north tower
    'ne': ((78, 40, -62), (0, 14, 0), 34),
    'south': ((14, 22, 95), (2, 16, 0), 38),
    'west': ((-78, 18, 8), (-22, 22, 0), 38),
    'aerial': ((50, 80, 70), (2, 12, 0), 42),
    'portal-west': ((-46, 4, 4), (-27, 6.5, 0), 40),
    'tower-top': ((-62, 52, -48), (-25.5, 50, -15.5), 45),
    'north': ((-52, 4, -78), (-8, 22, -8), 28),
    'portal-north': ((14, 4, -46), (7, 7, -21), 40),
    'portal-south': ((12, 6, 40), (7, 8, 21), 40),
    'apse': ((70, 16, -20), (22, 12, 0), 40),
    'close-wall': ((-4, 4, 33), (4, 6, 21), 45),           # a few metres from the south transept wall: stone sharpness
}
assemble('cathedral', body, cut, inl, argv, out_glb, size=2048, tiling=tiling, views=VIEWS, lods=((6.0, 0.4), (25.0, 0.1)),
         geom_colours={'stone': 0xb2a68e, 'stone2': 0xc9bfa9, 'tiles': 0x9a4e33, 'copper': 0x3d4248, 'gold': 0xe3b34a, 'glass': 0x34506a, 'dark': 0x23272c})
