"""Modern Kosice modules (S0004 13): renovated barracks of Kulturpark, new flats, office blocks. Run (ADR 0003):

    Blender -b --factory-startup -P scripts/blender/modernkit.py -- assets/levels/kosice/modernkit.glb [--previews <dir>]

Same module frame, material classes and conventions as scripts/blender/housekit.py (one 3 m bay, one 3.4 m storey; x along the wall, y up, z out of it;
`kit_plaster` and `kit_accent` tinted per instance, `kit_detail` with vertex colours and a hand-set occlusion, `kit_glass` lit per instance at night).
The game merges these modules into the house kit (js/house-kit.ts) and picks them by the `m` class of an OSM building (scripts/build-osm-level.mjs).
References (Wikimedia Commons, looked at, not stored):
  barracks  "Kasarne-Kulturpark - panoramio" (1)-(5), "Kulturpark Kasarne Kosice 2013", "Podvecer v Kulturparku Kasarne": white plaster, rusticated ground floor
            under a strong cordon, segmental-arch windows with dark grey frames and a small keystone, sill courses, dark metal gable roofs.
  resi      the new blocks behind Kulturpark (Safranova zahrada, KZC Residence; red / white render in "Kasarne-Kulturpark (2)"): white render with dark cladding strips,
            large anthracite windows, balconies with glass rails, glazed ground floor, flat roof with a thin coping.
  office    "Aupark Tower - juh" (curtain wall, vertical coloured glass panels and fins), "Tatra Banka Kosice" (grid of piers, ribbon glazing),
            "Namestie osloboditelov KE" (Aupark: tall glazed lobby, canopy): curtain wall bays with aluminium mullions, a fin or a coloured panel, recessed lobby, roof screen.
"""
import os, sys, math
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import bpy, bmesh
import housekit as hk
from housekit import Mod, opening_wall, window, pane, plate, close_inside, W, H, PI
from lib import reset, cli, log, srgb, export_glb, preview_scene, render_view

# extra detail roles (appended: the indices of the house kit roles stay the same)
for k, v in {'dkframe': ('detail', 0x33363b), 'alu': ('detail', 0xa9afb5), 'spandrel': ('detail', 0x27313b), 'railglass': ('detail', 0x8aa1ad),
             'white': ('detail', 0xe9e8e3), 'cap': ('detail', 0x6d7278), 'ksstone': ('detail', 0xd9d4c8)}.items():
    if k not in hk.ROLE: hk.ROLE[k] = v; hk.ROLES.append(k)

MODS = {}
CLOSED = ('bk_cornice', 'rs_edge', 'of_edge')
def module(name):
    m = Mod(name); MODS[name] = m; return m

# ------------------------------------------------------------------ helpers
def arch_pts(cx, hw, ys, rise, n=8):
    """Points of a segmental arch from (cx - hw, ys) over the apex (cx, ys + rise) to (cx + hw, ys); also the centre of its circle."""
    R = (hw * hw + rise * rise) / (2 * rise); cy = ys + rise - R
    a0, a1 = math.atan2(ys - cy, -hw), math.atan2(ys - cy, hw)
    return [(cx + R * math.cos(a0 + (a1 - a0) * t / n), cy + R * math.sin(a0 + (a1 - a0) * t / n)) for t in range(n + 1)], (cx, cy)

def arch_wall(m, cx, w, y0, ys, rise, depth, ylo=0.0, yhi=H, role='plaster', ao=0.6):
    """Front plate of a bay with a segmental-arch opening (sill y0, springing ys, apex ys + rise), `depth` deep, with its reveals."""
    ox0, ox1, zb = cx - w / 2, cx + w / 2, -depth
    m.sbox(0, ox0, ylo, yhi, zb, 0, role, skip='blut', ao={'r': ao}); m.sbox(ox1, W, ylo, yhi, zb, 0, role, skip='brut', ao={'l': ao})
    if y0 > ylo: m.sbox(ox0, ox1, ylo, y0, zb, 0, role, skip='blru', ao={'t': ao})
    pts, (ccx, ccy) = arch_pts(cx, w / 2, ys, rise)
    for (ax, ay), (bx, by) in zip(pts, pts[1:]):
        m.face([(ax, ay, 0), (bx, by, 0), (bx, yhi, 0), (ax, yhi, 0)], role, 1.0, n=(0, 0, 1))
        mx, my = (ax + bx) / 2, (ay + by) / 2
        m.face([(ax, ay, 0), (ax, ay, zb), (bx, by, zb), (bx, by, 0)], role, ao * 0.8, n=(ccx - mx, ccy - my, 0))
    return pts

def arch_window(m, cx, w, y0, ys, rise, depth, bar=0.07, frame='dkframe', mull=True):
    """Glass and frame of a segmental-arch opening cut by arch_wall: casements, a transom at the springing, the arched head."""
    zg = -depth + 0.02; zf = zg + 0.05; ox0, ox1 = cx - w / 2, cx + w / 2
    pts, (ccx, ccy) = arch_pts(cx, w / 2, ys, rise)
    m.face([(ox0, y0, zg), (ox1, y0, zg)] + [(x, y, zg) for x, y in reversed(pts)], 'glass', n=(0, 0, 1))
    def bar_(a0, a1, b0, b1): m.face([(a0, b0, zf), (a1, b0, zf), (a1, b1, zf), (a0, b1, zf)], frame)
    bar_(ox0, ox1, y0, y0 + bar); bar_(ox0, ox0 + bar, y0 + bar, ys); bar_(ox1 - bar, ox1, y0 + bar, ys)
    bar_(ox0 + bar, ox1 - bar, ys - bar / 2, ys + bar / 2)
    if mull: bar_(cx - bar / 2, cx + bar / 2, y0 + bar, ys - bar / 2)
    for (ax, ay), (bx, by) in zip(pts, pts[1:]):                                     # arched head: a band along the arc, inwards by `bar`
        def inn(x, y): d = math.hypot(x - ccx, y - ccy); return (x + (ccx - x) / d * bar, y + (ccy - y) / d * bar)
        ia, ib = inn(ax, ay), inn(bx, by)
        m.face([(ia[0], ia[1], zf), (ib[0], ib[1], zf), (bx, by, zf), (ax, ay, zf)], frame, n=(0, 0, 1))

def rustic(m, ylo, yhi, holes, course=0.4, gap=0.05, proj=0.04):
    """Rusticated plaster: courses of blocks standing `proj` off the wall with dark joints between them, cut round the openings (x0, x1, y0, y1)."""
    y = ylo
    while y < yhi - 0.05:
        ya, yb = y + gap / 2, min(yhi, y + course) - gap / 2; xs = [(0.0, W)]
        for (hx0, hx1, hy0, hy1) in holes:
            if yb > hy0 and ya < hy1:
                nxt = []
                for (a, b) in xs:
                    if hx0 > a: nxt.append((a, min(b, hx0)))
                    if hx1 < b: nxt.append((max(a, hx1), b))
                xs = nxt
        for (a, b) in xs:
            if b - a > 0.05: m.sbox(a, b, ya, yb, -0.02, proj, 'plaster', skip='b' + ('l' if a <= 0 else '') + ('r' if b >= W else ''), ao={'u': 0.75, 't': 0.95, 'l': 0.8, 'r': 0.8})
        y += course

def far_wall(m, rects, base='plaster'):
    """Distant version: one plate with painted openings (role, x0, x1, y0, y1, dz). Quads stand 4 cm and more off the plate (flicker check, ADR 0003)."""
    m.sbox(0, W, 0, H, -0.05, 0, base, skip='blrtub'); m.sbox(0, W, 0, H, -0.05, 0, base, skip='flrtu', ao={'b': 0.5})
    for role, x0, x1, y0, y1, dz in rects: m.face([(x0, y0, dz), (x1, y0, dz), (x1, y1, dz), (x0, y1, dz)], role)

# ================================================================== RENOVATED BARRACKS (Kulturpark)
BW, BSILL, BSPR, BRISE = 1.05, 0.95, 2.5, 0.24
m = module('bk_ground')                                                         # rusticated base, arched window, stone plinth, cordon on top
arch_wall(m, 1.5, 1.1, 1.0, 2.4, 0.28, 0.3, ylo=0.42, yhi=3.05)
arch_window(m, 1.5, 1.1, 1.0, 2.4, 0.28, 0.3)
rustic(m, 0.42, 3.05, [(1.5 - 0.55, 1.5 + 0.55, 1.0, 2.68)])
m.sbox(0.85, 2.15, 0.9, 1.0, 0, 0.14, 'ksstone', skip='b', ao={'u': 0.7})               # sill
m.sbox(1.38, 1.62, 2.56, 2.86, 0.0, 0.08, 'ksstone', skip='bu')                          # keystone
m.sbox(0, W, 0, 0.42, -0.3, 0.08, 'stone', skip='blru', ao={'t': 0.85})                   # plinth
m.strip([(-0.02, 3.05), (0.1, 3.05), (0.1, 3.14), (0.2, 3.24), (0.2, 3.4), (-0.02, 3.4)], 0, W, 'trim', 0.95)     # cordon cornice over the base

m = module('bk_door')                                                          # arched entrance in the rusticated base
arch_wall(m, 1.5, 1.5, 0.0, 2.2, 0.55, 0.35, ylo=0.0, yhi=3.05, ao=0.55)
rustic(m, 0.0, 3.05, [(0.75, 2.25, 0.0, 2.78)])
zq = -0.35 + 0.02
pts, _ = arch_pts(1.5, 0.75, 2.2, 0.55)
m.face([(0.75, 0.0, zq), (2.25, 0.0, zq), (2.25, 2.2, zq), (0.75, 2.2, zq)], 'door', 0.85)                    # door leaves
m.face([(x, y, zq + 0.01) for x, y in [(0.75, 2.2), (2.25, 2.2)] + list(reversed(pts))[1:-1]], 'glass', n=(0, 0, 1))   # fanlight
m.face([(1.48, 0.0, zq + 0.04), (1.52, 0.0, zq + 0.04), (1.52, 2.2, zq + 0.04), (1.48, 2.2, zq + 0.04)], 'dkframe')
m.face([(0.75, 2.16, zq + 0.04), (2.25, 2.16, zq + 0.04), (2.25, 2.24, zq + 0.04), (0.75, 2.24, zq + 0.04)], 'dkframe')
m.sbox(1.36, 1.64, 2.7, 3.0, 0.0, 0.1, 'ksstone', skip='bu')
m.sbox(0.6, 2.4, 0.0, 0.14, 0, 0.5, 'stone', skip='bu')                                 # step
m.strip([(-0.02, 3.05), (0.1, 3.05), (0.1, 3.14), (0.2, 3.24), (0.2, 3.4), (-0.02, 3.4)], 0, W, 'trim', 0.95)

m = module('bk_bay')                                                           # upper storey: segmental-arch window, keystone, sill course
arch_wall(m, 1.5, BW, BSILL, BSPR, BRISE, 0.26)
arch_window(m, 1.5, BW, BSILL, BSPR, BRISE, 0.26)
m.sbox(0, W, BSILL - 0.1, BSILL, 0, 0.07, 'trim', skip='b', ao={'u': 0.75})   # sill course, continuous along the wall
m.sbox(1.4, 1.6, BSPR + BRISE - 0.06, BSPR + BRISE + 0.18, 0.0, 0.06, 'ksstone', skip='bu')

m = module('bk_bay_b')                                                         # variant: rectangular window with a flat lintel (the smaller barracks)
opening_wall(m, 1.5 - 0.55, 1.5 + 0.55, 1.0, 2.7, 0.24, ao=0.6)
window(m, 1.5, 1.0, 1.1, 1.7, 0.24, mull=1, trans=1, bar=0.07, frame='dkframe')
m.sbox(0, W, 0.9, 1.0, 0, 0.07, 'trim', skip='b', ao={'u': 0.75})
m.sbox(0.85, 2.15, 2.7, 2.84, 0, 0.06, 'trim', skip='bu')

m = module('bk_cornice')                                                       # eaves cornice, 0.5 m, its top at the top of the last storey
m.strip([(-0.05, 0.0), (0.08, 0.0), (0.08, 0.16), (0.2, 0.22), (0.3, 0.36), (0.3, 0.44), (0.12, 0.5), (-0.05, 0.5)], 0, W, 'trim', 0.95)

far = module('bk_far'); far_wall(far, [('dkframe', 0.92, 2.08, BSILL - 0.02, BSPR + BRISE, 0.04), ('glass', 0.99, 2.01, BSILL + 0.05, BSPR + BRISE - 0.06, 0.08), ('trim', 0, W, BSILL - 0.1, BSILL, 0.04)])
far = module('bk_ground_far'); far_wall(far, [('stone', 0, W, 0, 0.42, 0.04), ('dkframe', 0.92, 2.08, 0.98, 2.68, 0.04), ('glass', 0.99, 2.01, 1.05, 2.6, 0.08), ('trim', 0, W, 3.05, H, 0.04)])

# ================================================================== NEW FLATS (white render, dark cladding, glass balconies)
m = module('rs_win')                                                           # large window off centre, cladding strip at the right edge
opening_wall(m, 0.3, 2.1, 0.55, 2.8, 0.2, ao=0.6)
window(m, 1.2, 0.55, 1.8, 2.25, 0.2, mull=1, trans=0, bar=0.06, frame='dkframe')
m.face([(0.3, 1.0, -0.12), (2.1, 1.0, -0.12), (2.1, 1.05, -0.12), (0.3, 1.05, -0.12)], 'metal')   # french-window rail
m.sbox(2.3, W, 0, H, -0.02, 0.05, 'accent', skip='bu', ao={'l': 0.8})                        # cladding strip
m.sbox(0.24, 2.16, 0.48, 0.55, 0, 0.06, 'cap', skip='b', ao={'u': 0.7})                      # metal sill

m = module('rs_balcony')                                                       # door-and-window wall behind a projecting slab with a glass rail
opening_wall(m, 0.25, 2.75, 0.06, 2.8, 0.18, ao=0.6)
window(m, 1.5, 0.06, 2.5, 2.74, 0.18, mull=2, trans=0, bar=0.06, frame='dkframe')
D = 1.15
m.sbox(0.0, W, -0.06, 0.12, -0.05, D, 'white', skip='b', ao={'u': 0.6})                     # slab (the next storey's slab is its ceiling)
m.sbox(0.04, W - 0.04, 0.12, 1.1, D - 0.06, D - 0.04, 'railglass', skip='btu', ao={'b': 0.75, 'f': 0.95})   # glass rail
m.sbox(0.0, W, 1.1, 1.15, D - 0.08, D, 'cap', skip='b')                                      # handrail
m.sbox(W - 0.06, W, 0.12, 2.9, 0.0, D, 'accent', skip='bu', ao={'l': 0.8})                    # privacy screen between balconies (cladding colour)

m = module('rs_ground')                                                        # glazed ground floor (shop or lobby), fascia in the cladding colour
opening_wall(m, 0.18, 2.82, 0.12, 2.95, 0.3, ao=0.55)
window(m, 1.5, 0.12, 2.64, 2.83, 0.3, mull=2, trans=0, bar=0.07, frame='dkframe')
m.sbox(0, W, 2.95, H, -0.02, 0.06, 'accent', skip='bu', ao={'u': 0.7})
m.sbox(0, W, 0, 0.12, -0.3, 0.03, 'cap', skip='blru')

m = module('rs_door')                                                          # recessed entrance with a slab canopy
opening_wall(m, 0.6, 2.4, 0.0, 2.6, 0.6, ao=0.5)
window(m, 1.5, 0.0, 1.8, 2.6, 0.6, mull=1, trans=1, bar=0.08, frame='dkframe')
m.sbox(0.3, 2.7, 2.6, 2.78, -0.1, 0.85, 'white', ao={'u': 0.65})
m.sbox(0, W, 2.95, H, -0.02, 0.06, 'accent', skip='bu', ao={'u': 0.7})

m = module('rs_edge')                                                          # thin roof coping: render band with a metal cap, stands on top of the wall
m.strip([(-0.02, 0.0), (0.04, 0.0), (0.04, 0.42), (0.08, 0.42), (0.08, 0.48), (-0.02, 0.48)], 0, W, 'plaster', 0.97)

far = module('rs_far'); far_wall(far, [('dkframe', 0.26, 2.14, 0.5, 2.84, 0.04), ('glass', 0.32, 2.08, 0.56, 2.78, 0.08), ('accent', 2.3, W, 0, H, 0.04)])
far = module('rs_ground_far'); far_wall(far, [('dkframe', 0.14, 2.86, 0.08, 2.99, 0.04), ('glass', 0.2, 2.8, 0.14, 2.93, 0.08), ('accent', 0, W, 2.99, H, 0.04)])

# ================================================================== OFFICES (curtain wall, fins, ribbon windows, lobby)
SP0, SP1 = 0.55, 3.1                                                           # vision glass between the spandrels
def curtain(m, panel=False, fin=False):
    """Curtain-wall bay: dark spandrel glass at the slab, vision glass, aluminium mullions at the bay edges and the middle; transoms as flat strips."""
    zg = -0.08
    m.face([(0, 0, zg), (W, 0, zg), (W, SP0, zg), (0, SP0, zg)], 'spandrel'); m.face([(0, SP1, zg), (W, SP1, zg), (W, H, zg), (0, H, zg)], 'spandrel')
    if panel:
        pane(m, 0, 1.5, SP0, SP1, zg); m.face([(1.5, SP0, zg + 0.04), (W, SP0, zg + 0.04), (W, SP1, zg + 0.04), (1.5, SP1, zg + 0.04)], 'accent', 0.95)
    else: pane(m, 0, W, SP0, SP1, zg)
    for x0, x1 in ((0, 0.05), (W - 0.05, W), (1.47, 1.53)):
        m.sbox(x0, x1, 0, H, zg, 0.06, 'alu', skip='btu' + ('l' if x0 == 0 else '') + ('r' if x1 == W else ''), ao={'l': 0.85, 'r': 0.85})
    for y in (SP0, SP1):
        m.face([(0.05, y - 0.03, -0.03), (W - 0.05, y - 0.03, -0.03), (W - 0.05, y + 0.03, -0.03), (0.05, y + 0.03, -0.03)], 'alu')
    if fin: m.sbox(1.45, 1.55, 0, H, 0.06, 0.5, 'accent', skip='btu', ao={'l': 0.85, 'r': 0.85})
m = module('of_cw'); curtain(m)
m = module('of_fin'); curtain(m, fin=True)
m = module('of_panel'); curtain(m, panel=True)

m = module('of_band')                                                          # ribbon glazing between solid spandrels (the older office blocks, Tatra banka grid)
m.sbox(0, W, 0, 1.0, -0.22, 0, 'plaster', skip='blru', ao={'t': 0.6}); m.sbox(0, W, 3.1, H, -0.22, 0, 'plaster', skip='blrt', ao={'u': 0.5})
m.sbox(0, 0.06, 1.0, 3.1, -0.22, 0.0, 'plaster', skip='blub', ao={'r': 0.6}); m.sbox(W - 0.06, W, 1.0, 3.1, -0.22, 0.0, 'plaster', skip='brub', ao={'l': 0.6})
window(m, 1.5, 1.0, W - 0.12, 2.1, 0.22, mull=2, trans=0, bar=0.05, frame='alu')

m = module('of_lobby')                                                         # tall recessed glazing behind a pier, fascia band
DL = 0.7
m.sbox(0, 0.45, 0, 3.0, -DL, 0, 'plaster', skip='bu', ao={'r': 0.85, 'l': 0.85})                # pier
pane(m, 0.45, W, 0.0, 3.0, -DL + 0.02)
for x in (0.45, 1.25, 2.1, W - 0.04):
    m.face([(x, 0, -DL + 0.07), (x + 0.06, 0, -DL + 0.07), (x + 0.06, 3.0, -DL + 0.07), (x, 3.0, -DL + 0.07)], 'alu')
m.face([(0.45, 2.5, -DL + 0.07), (W, 2.5, -DL + 0.07), (W, 2.56, -DL + 0.07), (0.45, 2.56, -DL + 0.07)], 'alu')
m.sbox(0, W, 3.0, H, -DL, 0.04, 'plaster', ao={'u': 0.55})                                 # fascia: its underside is the soffit of the arcade
m.sbox(0, W, -0.02, 0.0, -DL, 0.0, 'cap', skip='blrbu')                                      # floor of the arcade (a thin plate just above the street)

m = module('of_entry')                                                         # entrance: glass doors in the recess, canopy
m.sbox(0, 0.3, 0, 3.0, -DL, 0, 'plaster', skip='bu', ao={'r': 0.85, 'l': 0.85}); m.sbox(W - 0.3, W, 0, 3.0, -DL, 0, 'plaster', skip='bu', ao={'r': 0.85, 'l': 0.85})
pane(m, 0.3, W - 0.3, 0.0, 3.0, -DL + 0.02)
for x in (0.3, 0.9, 1.47, 2.04, W - 0.36):
    m.face([(x, 0, -DL + 0.07), (x + 0.06, 0, -DL + 0.07), (x + 0.06, 2.4, -DL + 0.07), (x, 2.4, -DL + 0.07)], 'dkframe')
m.face([(0.3, 2.4, -DL + 0.07), (W - 0.3, 2.4, -DL + 0.07), (W - 0.3, 2.48, -DL + 0.07), (0.3, 2.48, -DL + 0.07)], 'dkframe')
m.sbox(0, W, 3.0, H, -DL, 0.04, 'plaster', ao={'u': 0.55})
m.sbox(0.1, W - 0.1, 2.75, 2.9, 0.04, 0.85, 'white', skip='b', ao={'u': 0.6})                 # canopy
m.sbox(0, W, -0.02, 0.0, -DL, 0.0, 'cap', skip='blrbu')

m = module('of_edge')                                                          # roof screen over the curtain wall, aluminium cap; stands on top of the wall
m.strip([(-0.08, 0.0), (0.06, 0.0), (0.06, 0.9), (0.1, 0.9), (0.1, 0.98), (-0.08, 0.98)], 0, W, 'accent', 0.95)

far = module('of_far'); far_wall(far, [('spandrel', 0, W, 0, H, 0.04), ('glass', 0.05, W - 0.05, SP0, SP1, 0.08), ('alu', 1.47, 1.53, 0, H, 0.12)], base='plaster')
far = module('of_lobby_far'); far_wall(far, [('glass', 0.45, W, 0, 3.0, 0.04)])

# ------------------------------------------------------------------ export and previews
def previews(objs, folder):
    os.makedirs(folder, exist_ok=True)
    src = {o.name: o for o in objs}
    for o in objs: o.hide_render = True; o.hide_viewport = True
    preview_scene(objs)
    sc = bpy.context.scene
    def put(name, x, y, z, ry=0.0, tint=(0xffffff, 0xffffff)):
        o = bpy.data.objects.new(name, src[name].data); sc.collection.objects.link(o)
        o.location = (x, -z, y); o.rotation_euler = (0, 0, ry)
        for i, cls in enumerate(hk.CLASSES):
            o.material_slots[i].link = 'OBJECT'; o.material_slots[i].material = hk.preview_mat(cls, tint[0] if cls == 'plaster' else tint[1])
        return o
    def block(x, z, bays, depth, storeys, ground, upper, top, top_y, tint, roof=None):
        """Front (facing +z) and right side (facing +x); `ground`/`upper`: function (bay, side) -> module name."""
        for side, (ox, oz, ry, nb) in enumerate(((x, z, 0.0, bays), (x + bays * W, z, PI / 2, depth))):
            c, s = math.cos(ry), math.sin(ry)
            for i in range(nb):
                u = i * W
                for st in range(storeys):
                    put(ground(i, side, nb) if st == 0 else upper(i, side, nb, st), ox + u * c, st * H, oz - u * s, ry, tint)
                if top: put(top, ox + u * c, top_y, oz - u * s, ry, tint)
        hgt = storeys * H
        slab = bpy.data.objects.new('roof', bpy.data.meshes.new('roof')); sc.collection.objects.link(slab)
        bm = bmesh.new()
        if roof:                                                   # gable roof along the front
            r = depth * W / 2; v = [bm.verts.new(p) for p in [(x - 0.3, -(z + 0.3), hgt), (x + bays * W + 0.3, -(z + 0.3), hgt), (x + bays * W + 0.3, -(z - r), hgt + r * 0.75), (x - 0.3, -(z - r), hgt + r * 0.75),
                                                                  (x - 0.3, -(z - 2 * r - 0.3), hgt), (x + bays * W + 0.3, -(z - 2 * r - 0.3), hgt)]]
            bm.faces.new([v[0], v[1], v[2], v[3]]); bm.faces.new([v[3], v[2], v[5], v[4]])
            g1 = [bm.verts.new(p) for p in [(x + bays * W, -z, hgt), (x + bays * W, -(z - 2 * r), hgt), (x + bays * W, -(z - r), hgt + r * 0.75)]]; bm.faces.new(g1)
        else:
            bmesh.ops.create_cube(bm, size=1.0); bmesh.ops.scale(bm, verts=bm.verts, vec=(bays * W, depth * W, 0.3))
            bmesh.ops.translate(bm, verts=bm.verts, vec=(x + bays * W / 2, -(z - depth * W / 2), hgt - 0.15))
        bm.to_mesh(slab.data); bm.free()
        rm = bpy.data.materials.new('roofpv'); rm.use_nodes = True; b = rm.node_tree.nodes['Principled BSDF']
        b.inputs['Base Color'].default_value = srgb(roof or 0x777777); b.inputs['Roughness'].default_value = 0.5 if roof else 0.9; b.inputs['Metallic'].default_value = 0.4 if roof else 0.0
        slab.data.materials.append(rm)
    def clear():
        for o in list(sc.objects):
            if o.name not in src and o.type == 'MESH' and not o.name.startswith('ground'): bpy.data.objects.remove(o)
    # barracks: 8 bays x 4 deep, 4 storeys (Kasarne main block), gable roof in dark metal
    block(0, 0, 8, 4, 4, lambda i, s, n: 'bk_door' if s == 0 and i == 4 else 'bk_ground', lambda i, s, n, st: 'bk_bay', 'bk_cornice', 4 * H - 0.5, (0xf2f0ea, 0x4a4e53), roof=0x4a4e53)
    render_view(os.path.join(folder, 'bk-front.png'), (12, 6.0, 34), (12, 7.5, 0), 38)
    render_view(os.path.join(folder, 'bk-corner.png'), (38, 4.0, 18), (20, 7.0, -4), 40)
    render_view(os.path.join(folder, 'bk-close.png'), (13.5, 2.0, 7.5), (13.5, 3.2, 0), 40)
    clear()
    block(0, 0, 8, 4, 3, lambda i, s, n: 'bk_ground', lambda i, s, n, st: 'bk_bay_b', 'bk_cornice', 3 * H - 0.5, (0xf4f3ef, 0x4a4e53), roof=0x4a4e53)
    render_view(os.path.join(folder, 'bk-b-corner.png'), (38, 4.0, 18), (20, 6.0, -4), 40)
    clear()
    # flats: 7 bays x 4 deep, 6 storeys; balconies every third bay, glazed ground floor, door in the middle
    block(0, 0, 7, 4, 6, lambda i, s, n: 'rs_door' if s == 0 and i == 3 else 'rs_ground', lambda i, s, n, st: 'rs_win' if s == 1 else ('rs_balcony' if i % 3 == 0 else 'rs_win'), 'rs_edge', 6 * H, (0xf1f1ee, 0x3c4046))
    render_view(os.path.join(folder, 'rs-front.png'), (10.5, 8.0, 38), (10.5, 10.0, 0), 38)
    render_view(os.path.join(folder, 'rs-corner.png'), (36, 5.0, 20), (18, 9.0, -4), 40)
    render_view(os.path.join(folder, 'rs-close.png'), (5.0, 4.5, 8.5), (5.0, 5.4, 0), 40)
    clear()
    # office: 6 bays x 5 deep, 10 storeys, curtain wall with fins (front) and coloured panels (side), lobby with entrance
    block(0, 0, 6, 5, 10, lambda i, s, n: 'of_entry' if s == 0 and i == 3 else 'of_lobby', lambda i, s, n, st: ('of_fin' if i % 2 else 'of_cw') if s == 0 else ('of_panel' if (i + st) % 3 == 0 else 'of_cw'), 'of_edge', 10 * H, (0xc8ccd0, 0x7fb23a))
    render_view(os.path.join(folder, 'of-corner.png'), (40, 6.0, 30), (12, 15.0, -6), 40)
    render_view(os.path.join(folder, 'of-close.png'), (9.0, 2.2, 9.0), (9.0, 3.4, 0), 40)
    clear()
    block(0, 0, 6, 4, 6, lambda i, s, n: 'of_entry' if s == 0 and i == 3 else 'of_lobby', lambda i, s, n, st: 'of_band', 'of_edge', 6 * H, (0xb9b5ae, 0x9aa0a6))
    render_view(os.path.join(folder, 'of-band-corner.png'), (36, 5.0, 24), (12, 9.0, -6), 40)

def main():
    argv = cli(); out = argv[0] if argv else '/tmp/modernkit.glb'
    for name, m in MODS.items():
        if name not in CLOSED and not name.endswith('_far'): close_inside(m)
    reset(); mats = hk.make_mats(); objs = [m.to_object(mats) for m in MODS.values()]
    log('triangles', {o.name: sum(len(p.vertices) - 2 for p in o.data.polygons) for o in objs})
    export_glb(objs, out)
    if '--previews' in argv: previews(objs, argv[argv.index('--previews') + 1])

if __name__ == "__main__": main()
