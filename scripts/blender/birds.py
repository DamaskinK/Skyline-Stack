"""City birds (S0004 16): feral pigeons, common swifts and hooded crows for the sky and the roofs of Kosice. Run (ADR 0003):

    Blender -b --factory-startup -P scripts/blender/birds.py -- assets/models/birds.glb [--previews <dir>]

Every bird is lofted from rings along its body (game frame: x to the right wing, y up, z forward = the beak) with wings as thin cambered airfoils
(six points per span station: leading edge, two on top, trailing edge, two below), so the top and the underside carry their own vertex colours
(pigeon wing bars on top, a pale underwing below). Wings hinge at the shoulder and the wrist; a pose is the angles of those two joints.
One mesh per species and level of detail, with morph targets (shape keys) for the flap: base = glide, `up` = top of the upstroke, `down` = bottom
of the downstroke; the game blends them per instance (InstancedMesh.setMorphAt). The sitting pigeon is its own mesh (folded wings, legs) with
`peck` (head down to the ground) and `look` (head turned) keys.
References (Wikimedia Commons): File:Feral pigeon in flight.jpg, File:Columba livia -flight-4.jpg, File:Pigeon on a roof (24068035560).jpg,
File:Common Swift 2025 07 18 01.jpg, File:Apus apus 01.jpg, File:Hooded crow (Corvus cornix cornix) in flight Kemeri.jpg.
Sizes: pigeon 32 cm long, 65 cm span; swift 17 cm, 42 cm; hooded crow 47 cm, 98 cm.
No texture: one material `bird` with vertex colours (sRGB hex below, converted to linear).
"""
import os, sys, math
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import bpy, bmesh
from mathutils import Vector, Matrix
from lib import reset, cli, log, srgb, export_glb, preview_scene, render_view

PI = math.pi
R = math.radians

def lerp(a, b, t): return a + (b - a) * t
def mix(c0, c1, t): return tuple(lerp(a, b, t) for a, b in zip(c0, c1))
def C(h): c = srgb(h); return (c[0], c[1], c[2])

class Mesh:
    """Vertex list + faces + per-vertex colour; the topology must not depend on the pose (shape keys)."""
    def __init__(self): self.v = []; self.c = []; self.f = []
    def add(self, p, col): self.v.append(tuple(p)); self.c.append(col); return len(self.v) - 1
    def quad(self, a, b, c, d): self.f.append((a, b, c, d))
    def tri(self, a, b, c): self.f.append((a, b, c))

# ------------------------------------------------------------------ body loft
def loft(m, stations, n, colour, xf=None):
    """stations: (z, half width, half height, y centre). Ring vertex k at angle 2 pi k / n from the top (k = 0) clockwise seen from behind.
    colour(i, k, p) -> rgb. xf(i, p) moves a point of station i (head turns, pecking). Both ends closed by a cap vertex."""
    rings = []
    for i, (z, w, h, yc) in enumerate(stations):
        ring = []
        for k in range(n):
            a = 2 * PI * k / n; p = Vector((w * math.sin(a), yc + h * math.cos(a), z))
            col = colour(i, k, p)
            if xf: p = xf(i, p)
            ring.append(m.add(p, col))
        rings.append(ring)
    for r0, r1 in zip(rings, rings[1:]):
        for k in range(n): m.quad(r0[k], r1[k], r1[(k + 1) % n], r0[(k + 1) % n])
    for ring, (z, w, h, yc), i, sgn in ((rings[0], stations[0], 0, -1), (rings[-1], stations[-1], len(stations) - 1, 1)):
        p = Vector((0, yc, z + sgn * 0.002)); col = colour(i, 0, p)
        if xf: p = xf(i, p)
        c = m.add(p, col)
        for k in range(n):
            a, b = ring[k], ring[(k + 1) % n]
            m.tri(a, b, c) if sgn > 0 else m.tri(b, a, c)
    return rings

# ------------------------------------------------------------------ wings
def rot(axis, a): return Matrix.Rotation(a, 3, axis)

def wing(m, side, root, plan, pose, colour, wrist_u):
    """One wing. plan: (u, leading edge z, trailing edge z, thickness) from the shoulder out; u is the span distance.
    pose: dict(sa, sb, wa, wb, tw): shoulder flap (up +), shoulder sweep (forward +), wrist flap, wrist sweep, tip twist (nose down +).
    Airfoil ring per station: LE, top 30 %, top 70 %, TE, bottom 70 %, bottom 30 %. colour(si, j, u, frac) -> rgb (j = ring index)."""
    Ms = rot('Y', -pose['sb']) @ rot('Z', pose['sa'])                         # shoulder: flap about the body axis (up +), sweep about y (forward +)
    Mw = rot('Y', -pose['wb']) @ rot('Z', pose['wa'])
    wrist = Vector((wrist_u, 0, 0))
    rings = []
    for si, (u, le, te, th) in enumerate(plan):
        ch = le - te; fr = [0.0, 0.3, 0.7, 1.0, 0.7, 0.3]; up = [0, 1, 1, 0, -1, -1]
        camber = 0.06 * ch
        ring = []
        for j in range(6):
            z = le - fr[j] * ch
            y = (math.sin(PI * fr[j]) * (camber + up[j] * th * 0.5)) if 0 < j < 3 or j > 3 else 0.0
            if j in (4, 5): y = math.sin(PI * fr[j]) * (camber * 0.6 - th * 0.5)
            p = Vector((u, y, z))
            col = colour(si, j, u / plan[-1][0], fr[j])
            # twist about the span axis grows towards the tip (washout), then the wrist and the shoulder
            t = pose.get('tw', 0.0) * max(0.0, (u - wrist_u) / max(1e-6, plan[-1][0] - wrist_u))
            p = rot('X', t) @ p
            if u > wrist_u: p = wrist + Mw @ (p - wrist)
            p = Ms @ p
            p = Vector((side * (p.x + root[0]), p.y + root[1], p.z + root[2]))      # mirror for the left wing, then to the shoulder
            ring.append(m.add(p, col))
        rings.append(ring)
    for r0, r1 in zip(rings, rings[1:]):
        for j in range(6):
            a, b, c, d = r0[j], r0[(j + 1) % 6], r1[(j + 1) % 6], r1[j]
            m.quad(a, b, c, d) if side > 0 else m.quad(d, c, b, a)
    # root and tip caps (fans)
    for ring, flip in ((rings[0], side < 0), (rings[-1], side > 0)):
        tri = [(ring[0], ring[1], ring[5]), (ring[1], ring[2], ring[5]), (ring[2], ring[4], ring[5]), (ring[2], ring[3], ring[4])]
        for a, b, c in tri: m.tri(a, b, c) if flip else m.tri(c, b, a)
    return rings

def sheet(m, rows, colour, thick=0.006, flip=False):
    """Thin closed plate from rows of (x, y, z) points (front to back): a top and a bottom layer and the rim. Tails and fingers."""
    top, bot = [], []
    for ri, row in enumerate(rows):
        top.append([m.add(Vector(p) + Vector((0, thick / 2, 0)), colour(ri, ci, True)) for ci, p in enumerate(row)])
        bot.append([m.add(Vector(p) - Vector((0, thick / 2, 0)), colour(ri, ci, False)) for ci, p in enumerate(row)])
    for r0, r1, b0, b1 in zip(top, top[1:], bot, bot[1:]):
        for c in range(len(r0) - 1):
            m.quad(r0[c], r0[c + 1], r1[c + 1], r1[c]); m.quad(b1[c], b1[c + 1], b0[c + 1], b0[c])
    n = len(rows[0])
    rim = [(0, c) for c in range(n)] + [(r, n - 1) for r in range(1, len(rows))] + [(len(rows) - 1, c) for c in range(n - 2, -1, -1)] + [(r, 0) for r in range(len(rows) - 2, 0, -1)]
    for (ra, ca), (rb, cb) in zip(rim, rim[1:] + rim[:1]):
        m.quad(top[ra][ca], bot[ra][ca], bot[rb][cb], top[rb][cb]) if not flip else m.quad(top[rb][cb], bot[rb][cb], bot[ra][ca], top[ra][ca])

# ------------------------------------------------------------------ species
PIG = dict(head=C(0x464b57), neck_g=C(0x3f6a55), neck_p=C(0x5e4a6c), breast=C(0x5f6370), belly=C(0x7a7e89), back=C(0x7b818d), rump=C(0xa9adb5),
           wing=C(0x858b97), bar=C(0x1e2026), prim=C(0x3b3f48), under=C(0xaeb2ba), tail=C(0x666b76), band=C(0x1f2126), beak=C(0x2e2a2a),
           cere=C(0xe8e4dc), leg=C(0xc0505a))
SWI = dict(body=C(0x2c2826), throat=C(0x8a837a), wing=C(0x332f2c), under=C(0x45403b), edge=C(0x5a544e))
CRO = dict(black=C(0x18181c), grey=C(0x8e8c88), greyd=C(0x6e6c68), wing=C(0x1e1e24), under=C(0x2a2a30))

def pigeon_fly(pose, detail):
    m = Mesh(); n = 8 if detail else 5
    st = [(-0.08, 0.02, 0.015, 0.006), (-0.058, 0.036, 0.033, 0.0), (-0.028, 0.05, 0.05, -0.004), (0.005, 0.054, 0.056, 0.0), (0.036, 0.048, 0.05, 0.006),
          (0.062, 0.034, 0.036, 0.016), (0.08, 0.026, 0.028, 0.022), (0.1, 0.025, 0.025, 0.026), (0.118, 0.018, 0.018, 0.025), (0.128, 0.008, 0.007, 0.022), (0.142, 0.002, 0.002, 0.019)]
    if not detail: st = [st[i] for i in (0, 2, 4, 6, 8, 10)]
    zs = [s[0] for s in st]
    def col(i, k, p):
        z = p.z; topness = (p.y - st[i][3]) / max(1e-6, st[i][2])
        if z > 0.124: return PIG['beak'] if z > 0.13 else PIG['cere']
        if z > 0.085: return PIG['head']
        if z > 0.045: return mix(PIG['neck_p'], PIG['neck_g'], 0.5 + 0.5 * math.sin(k * 1.7)) if topness > -0.4 else PIG['breast']
        if z < -0.045 and topness > 0.3: return PIG['rump']
        return mix(PIG['belly'], PIG['back'], 0.5 + 0.5 * topness)
    loft(m, st, n, col)
    plan = [(0.0, 0.03, -0.065, 0.016), (0.06, 0.036, -0.08, 0.012), (0.12, 0.036, -0.08, 0.008), (0.18, 0.02, -0.078, 0.005), (0.235, -0.01, -0.08, 0.003),
            (0.278, -0.05, -0.085, 0.002), (0.3, -0.088, -0.093, 0.001)]
    if not detail: plan = [plan[i] for i in (0, 2, 4, 6)]
    def wcol(si, j, f, fr):
        if j in (4, 5): return PIG['under'] if f < 0.75 else mix(PIG['under'], PIG['prim'], 0.6)
        if f > 0.55: return PIG['prim']
        if j == 2 and 0.05 < f < 0.42: return PIG['bar']
        if j == 3 and f < 0.5: return mix(PIG['wing'], PIG['prim'], 0.5)
        return PIG['wing']
    for side in (1, -1): wing(m, side, (0.028, 0.026, 0.016), plan, pose, wcol, 0.12)
    tail = [[(-0.02, 0.006, -0.072), (0.0, 0.01, -0.072), (0.02, 0.006, -0.072)], [(-0.042, 0.004, -0.15), (0.0, 0.008, -0.155), (0.042, 0.004, -0.15)],
            [(-0.046, 0.004, -0.172), (0.0, 0.008, -0.182), (0.046, 0.004, -0.172)]]
    sp = pose.get('tail', 1.0)
    tail = [[(x * sp, y, z) for x, y, z in row] for row in tail]
    sheet(m, tail, lambda r, c, top: PIG['band'] if r == 2 else (PIG['tail'] if top else PIG['under']), 0.008)
    return m

def swift_fly(pose, detail):
    m = Mesh(); n = 7 if detail else 5
    st = [(-0.06, 0.01, 0.009, 0.004), (-0.035, 0.022, 0.02, 0.0), (0.0, 0.026, 0.024, 0.0), (0.03, 0.024, 0.022, 0.003), (0.055, 0.019, 0.018, 0.006),
          (0.072, 0.013, 0.012, 0.006), (0.084, 0.002, 0.002, 0.004)]
    if not detail: st = [st[i] for i in (0, 2, 4, 6)]
    def col(i, k, p):
        if p.z > 0.045 and p.y < st[i][3] - 0.2 * st[i][2]: return SWI['throat']
        return SWI['body']
    loft(m, st, n, col)
    plan = [(0.0, 0.02, -0.02, 0.008), (0.025, 0.03, -0.022, 0.006), (0.05, 0.028, -0.025, 0.005), (0.1, 0.0, -0.04, 0.003), (0.15, -0.04, -0.062, 0.002),
            (0.19, -0.08, -0.09, 0.001), (0.205, -0.105, -0.108, 0.001)]
    if not detail: plan = [plan[i] for i in (0, 2, 4, 6)]
    def wcol(si, j, f, fr): return SWI['under'] if j in (4, 5) else (SWI['edge'] if j == 3 else SWI['wing'])
    for side in (1, -1): wing(m, side, (0.018, 0.01, 0.015), plan, pose, wcol, 0.05)
    tail = [[(-0.009, 0.004, -0.055), (0.0, 0.005, -0.055), (0.009, 0.004, -0.055)], [(-0.016, 0.003, -0.09), (0.0, 0.004, -0.078), (0.016, 0.003, -0.09)],
            [(-0.022, 0.003, -0.115), (0.0, 0.004, -0.082), (0.022, 0.003, -0.115)]]
    sheet(m, tail, lambda r, c, top: SWI['body'], 0.004)
    return m

def crow_fly(pose, detail):
    m = Mesh(); n = 8 if detail else 5
    st = [(-0.16, 0.03, 0.022, 0.008), (-0.12, 0.055, 0.05, 0.0), (-0.06, 0.075, 0.075, -0.005), (0.0, 0.078, 0.08, 0.0), (0.06, 0.065, 0.068, 0.01),
          (0.11, 0.045, 0.05, 0.022), (0.15, 0.042, 0.045, 0.028), (0.19, 0.036, 0.036, 0.03), (0.22, 0.02, 0.018, 0.026), (0.255, 0.006, 0.006, 0.018), (0.275, 0.001, 0.001, 0.012)]
    if not detail: st = [st[i] for i in (0, 2, 4, 6, 8, 10)]
    def col(i, k, p):
        if p.z > 0.09: return CRO['black']
        if p.z > 0.05 and p.y < st[i][3]: return CRO['black']                # black bib
        return CRO['grey'] if p.y > st[i][3] - 0.3 * st[i][2] else CRO['greyd']
    loft(m, st, n, col)
    plan = [(0.0, 0.06, -0.12, 0.022), (0.08, 0.075, -0.15, 0.016), (0.17, 0.07, -0.15, 0.011), (0.26, 0.06, -0.135, 0.007), (0.34, 0.045, -0.115, 0.004),
            (0.37, 0.03, -0.1, 0.003)]
    if not detail: plan = [plan[i] for i in (0, 2, 4, 5)]
    def wcol(si, j, f, fr): return CRO['under'] if j in (4, 5) else CRO['wing']
    for side in (1, -1):
        rings = wing(m, side, (0.045, 0.03, 0.03), plan, pose, wcol, 0.17)
        if detail:                                                               # fingered primaries: four slotted feathers from the tip station
            tip = rings[-1]; le = Vector(m.v[tip[0]]); te = Vector(m.v[tip[3]])
            out = (le - Vector(m.v[rings[-2][0]])).normalized()
            for f in range(4):
                a = le.lerp(te, 0.12 + f * 0.24); d = (out + (te - le).normalized() * (0.15 * f - 0.05)).normalized()
                L = 0.1 - 0.012 * f; w2 = 0.011
                perp = (te - le).normalized() * w2
                rows = [[a - perp, a, a + perp], [a + d * L * 0.6 - perp * 0.9, a + d * L * 0.6, a + d * L * 0.6 + perp * 0.9], [a + d * L - perp * 0.2, a + d * L, a + d * L + perp * 0.2]]
                sheet(m, [[tuple(p) for p in r] for r in rows], lambda r, c, top: CRO['wing'] if top else CRO['under'], 0.003, flip=side < 0)
    tail = [[(-0.03, 0.01, -0.15), (0.0, 0.014, -0.15), (0.03, 0.01, -0.15)], [(-0.055, 0.008, -0.27), (0.0, 0.012, -0.28), (0.055, 0.008, -0.27)],
            [(-0.045, 0.008, -0.33), (0.0, 0.012, -0.345), (0.045, 0.008, -0.33)]]
    sheet(m, tail, lambda r, c, top: CRO['black'], 0.01)
    return m

def pigeon_sit(pose, detail=True):
    """Sitting / walking pigeon: plump body tilted up 18 degrees, wings folded along the sides over the tail, short red legs. Origin = between the feet."""
    m = Mesh(); n = 8
    tilt = R(18); leg = 0.035
    st = [(-0.1, 0.02, 0.018, 0.0), (-0.07, 0.042, 0.04, 0.0), (-0.03, 0.058, 0.058, 0.0), (0.01, 0.06, 0.062, 0.002), (0.045, 0.052, 0.058, 0.012),
          (0.07, 0.036, 0.042, 0.032), (0.085, 0.028, 0.032, 0.056), (0.098, 0.027, 0.027, 0.078), (0.118, 0.02, 0.02, 0.08), (0.132, 0.009, 0.008, 0.077), (0.148, 0.002, 0.002, 0.074)]
    peck, look = pose.get('peck', 0.0), pose.get('look', 0.0)
    pivot = Vector((0, 0.03, 0.06))
    def xf(i, p):
        q = Vector(p)
        if i >= 5:                                                               # neck and head: pecking bends them down about the base of the neck, looking turns them
            k = min(1.0, (i - 4) / 3)
            q = pivot + rot('X', R(85) * peck * k) @ rot('Y', R(50) * look * k) @ (q - pivot)
        q = rot('X', -tilt) @ q                                                  # body tilt: tail down, breast up (x axis, nose up)
        return q + Vector((0, leg + 0.05, 0))
    def col(i, k, p):
        z = p.z; topness = (p.y - st[i][3]) / max(1e-6, st[i][2])
        if z > 0.128: return PIG['beak'] if z > 0.136 else PIG['cere']
        if i >= 7: return PIG['head']
        if i >= 4: return mix(PIG['neck_p'], PIG['neck_g'], 0.5 + 0.5 * math.sin(k * 1.7)) if topness > -0.5 or i >= 5 else PIG['breast']
        if z < -0.06 and topness > 0.3: return PIG['rump']
        return mix(PIG['belly'], PIG['back'], 0.5 + 0.5 * topness)
    loft(m, st, n, col, xf)
    T = lambda p: rot('X', -tilt) @ Vector(p) + Vector((0, leg + 0.05, 0))
    for side in (1, -1):                                                         # folded wing: a curved plate on the flank, from the shoulder over the tail
        rows = []
        for zz, yy, xx, hh in ((0.04, 0.03, 0.05, 0.03), (0.0, 0.02, 0.06, 0.045), (-0.05, 0.015, 0.052, 0.045), (-0.1, 0.012, 0.035, 0.03), (-0.165, 0.012, 0.012, 0.012)):
            rows.append([tuple(T((side * (xx - 0.004), yy + hh, zz))), tuple(T((side * (xx + 0.006), yy, zz))), tuple(T((side * (xx - 0.006), yy - hh * 0.8, zz)))])
        def wc(r, c, top, side=side):
            if r >= 3: return PIG['prim']
            if r in (1, 2) and c == 1: return PIG['bar']
            return PIG['wing']
        sheet(m, rows, wc, 0.006, flip=side < 0)
    tail = [[(-0.018, 0.012, -0.09), (0.0, 0.014, -0.09), (0.018, 0.012, -0.09)], [(-0.024, 0.008, -0.16), (0.0, 0.01, -0.165), (0.024, 0.008, -0.16)],
            [(-0.024, 0.008, -0.185), (0.0, 0.01, -0.19), (0.024, 0.008, -0.185)]]
    sheet(m, [[tuple(T(p)) for p in row] for row in tail], lambda r, c, top: PIG['band'] if r == 2 else PIG['tail'], 0.007)
    for side in (1, -1):                                                         # legs: three-sided prisms, toes as a flat triangle
        x = side * 0.018; b = [m.add((x + 0.006 * math.cos(a), 0.0, 0.004 + 0.006 * math.sin(a)), PIG['leg']) for a in (0, 2.1, 4.2)]
        t = [m.add((x + 0.005 * math.cos(a), leg + 0.012, 0.0 + 0.005 * math.sin(a)), PIG['leg']) for a in (0, 2.1, 4.2)]
        for k in range(3): m.quad(b[k], b[(k + 1) % 3], t[(k + 1) % 3], t[k])
        f = [m.add(p, PIG['leg']) for p in ((x - 0.012, 0.002, 0.03), (x + 0.012, 0.002, 0.03), (x, 0.002, -0.012))]
        m.tri(f[0], f[2], f[1])
    return m

# ------------------------------------------------------------------ objects
POSES = {
    'pigeon': dict(glide=dict(sa=R(6), sb=0.0, wa=R(-3), wb=R(-6), tw=R(4)), up=dict(sa=R(62), sb=R(-8), wa=R(-28), wb=R(-34), tw=R(-10), tail=0.8),
                   down=dict(sa=R(-48), sb=R(12), wa=R(14), wb=R(4), tw=R(16), tail=1.2)),
    'swift': dict(glide=dict(sa=R(2), sb=0.0, wa=R(-2), wb=R(-4), tw=0.0), up=dict(sa=R(32), sb=R(-4), wa=R(-12), wb=R(-10), tw=R(-6)),
                  down=dict(sa=R(-26), sb=R(4), wa=R(8), wb=R(2), tw=R(8))),
    'crow': dict(glide=dict(sa=R(4), sb=0.0, wa=R(2), wb=R(-4), tw=R(3)), up=dict(sa=R(48), sb=R(-6), wa=R(-24), wb=R(-26), tw=R(-8)),
                 down=dict(sa=R(-40), sb=R(10), wa=R(16), wb=R(6), tw=R(12))),
}
BUILD = {'pigeon': pigeon_fly, 'swift': swift_fly, 'crow': crow_fly}

def to_object(name, meshes, mat):
    """meshes: [(key name or None for the basis, Mesh)], same topology. Vertex colours from the basis."""
    base = meshes[0][1]
    me = bpy.data.meshes.new(name)
    me.from_pydata([(x, -z, y) for x, y, z in base.v], [], base.f)               # game (x, y, z) -> Blender (x, -z, y)
    me.validate(); me.update()
    bm = bmesh.new(); bm.from_mesh(me); bmesh.ops.recalc_face_normals(bm, faces=bm.faces); bm.to_mesh(me); bm.free()   # every shell outward (the keys share the winding)
    col = me.color_attributes.new('Col', 'FLOAT_COLOR', 'POINT')
    for i, c in enumerate(base.c): col.data[i].color = (c[0], c[1], c[2], 1.0)
    for p in me.polygons: p.use_smooth = True
    ob = bpy.data.objects.new(name, me); bpy.context.scene.collection.objects.link(ob)
    me.materials.append(mat)
    if len(meshes) > 1:
        ob.shape_key_add(name='Basis', from_mix=False)
        for key, mm in meshes[1:]:
            assert len(mm.v) == len(base.v), (name, key)
            sk = ob.shape_key_add(name=key, from_mix=False)
            for i, (x, y, z) in enumerate(mm.v): sk.data[i].co = (x, -z, y)
    return ob

def make_mat():
    mt = bpy.data.materials.new('bird'); mt.use_nodes = True; nt = mt.node_tree
    b = nt.nodes['Principled BSDF']; b.inputs['Roughness'].default_value = 0.78
    a = nt.nodes.new('ShaderNodeAttribute'); a.attribute_name = 'Col'
    nt.links.new(a.outputs['Color'], b.inputs['Base Color'])
    return mt

def build_all():
    mat = make_mat(); objs = []
    for sp, fn in BUILD.items():
        for lod, detail in ((0, True), (1, False)):
            P = POSES[sp]
            objs.append(to_object(f'{sp}_fly{lod}', [(None, fn(P['glide'], detail)), ('up', fn(P['up'], detail)), ('down', fn(P['down'], detail))], mat))
    objs.append(to_object('pigeon_sit0', [(None, pigeon_sit({})), ('peck', pigeon_sit({'peck': 1.0})), ('look', pigeon_sit({'look': 1.0}))], mat))
    for o in objs: log(o.name, 'tris', sum(len(p.vertices) - 2 for p in o.data.polygons), 'verts', len(o.data.vertices))
    return objs

def previews(objs, folder):
    """Each species in its three flight poses and both LODs (6x scale so 0.3 m birds fill a 1280x800 frame), the sitting pigeon in its three keys."""
    os.makedirs(folder, exist_ok=True)
    preview_scene(objs)
    sc = bpy.context.scene; mat = bpy.data.materials['bird']
    for o in objs: o.hide_render = True
    def show(m, name, x, y, z, ry=0.0, s=6.0):
        o = to_object('pv_' + name, [(None, m)], mat); o.location = (x, -z, y); o.rotation_euler = (0, 0, ry); o.scale = (s, s, s); return o
    for row, sp in enumerate(('pigeon', 'swift', 'crow')):
        P = POSES[sp]; k = 0.75 if sp == 'crow' else 1.0
        for i, key in enumerate(('glide', 'up', 'down')): show(BUILD[sp](P[key], True), f'{sp}{key}', i * 4.5, 3.0, -row * 4.5, s=6.0 * k)
        show(BUILD[sp](P['glide'], False), f'{sp}lod1', 13.5, 3.0, -row * 4.5, s=6.0 * k)
    for i, pz in enumerate(({}, {'peck': 1.0}, {'look': 1.0})): show(pigeon_sit(pz), f'sit{i}', i * 4.5, 0.0, 6.0, ry=0.4)
    render_view(os.path.join(folder, 'fly-top.png'), (7.0, 26.0, -3.0), (7.0, 3.0, -4.6), 30)
    render_view(os.path.join(folder, 'fly-below.png'), (7.0, -14.0, 6.0), (7.0, 3.0, -4.6), 30)
    render_view(os.path.join(folder, 'fly-front.png'), (7.0, 5.0, 22.0), (7.0, 3.0, -4.6), 30)
    render_view(os.path.join(folder, 'fly-3q.png'), (20.0, 12.0, 14.0), (7.0, 3.0, -4.6), 32)
    render_view(os.path.join(folder, 'sit.png'), (4.5, 2.2, 15.5), (4.5, 0.5, 6.0), 30)
    render_view(os.path.join(folder, 'sit-side.png'), (-6.0, 1.6, 8.0), (1.0, 0.6, 6.0), 30)
    render_view(os.path.join(folder, 'fly-close.png'), (2.0, 5.5, 4.5), (2.2, 3.0, 0.0), 40)

def main():
    argv = cli(); out = argv[0] if argv else '/tmp/birds.glb'
    reset(); objs = build_all()
    export_glb(objs, out)
    if '--previews' in argv: previews(objs, argv[argv.index('--previews') + 1])

if __name__ == "__main__": main()
