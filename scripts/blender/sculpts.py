"""Sculpted figures for the landmark models (S0004 09): robed saints, the Virgin of the Immaculata, cherub heads, putti, clouds.
Built from metaballs (`lib.Sculpt`), in a local frame where the figure stands at the origin, faces +z and is `h` metres tall.
Each function adds elements to a Sculpt; the caller converts it (`Sculpt.into`)."""
import math, random
from lib import Sculpt

def _arms(sc, pose, rnd):
    """Arms of a 1.8 m figure. pose: 'prayer' (hands together at the chest), 'crossed' (over the chest), 'book' (left hand holds a book,
    right hand raised), 'staff' (right hand holds a staff), 'open' (both hands a little out, palms forward), 'child' (carries a child on the left arm)."""
    S = [(-0.21, 1.44, 0.0), (0.21, 1.44, 0.0)]
    if pose == 'prayer': E = [(-0.25, 1.17, 0.08), (0.25, 1.17, 0.08)]; H = [(-0.03, 1.33, 0.22), (0.03, 1.33, 0.22)]
    elif pose == 'crossed': E = [(-0.25, 1.16, 0.1), (0.25, 1.16, 0.1)]; H = [(0.12, 1.32, 0.17), (-0.12, 1.32, 0.17)]
    elif pose == 'book': E = [(-0.27, 1.15, 0.1), (0.3, 1.25, 0.05)]; H = [(-0.12, 1.12, 0.3), (0.36, 1.52, 0.14)]
    elif pose == 'staff': E = [(-0.26, 1.15, 0.05), (0.3, 1.18, 0.1)]; H = [(-0.1, 1.05, 0.2), (0.32, 1.22, 0.32)]
    elif pose == 'child': E = [(-0.27, 1.15, 0.1), (0.26, 1.16, 0.1)]; H = [(-0.05, 1.2, 0.28), (0.12, 1.3, 0.26)]
    else: E = [(-0.3, 1.16, 0.06), (0.3, 1.16, 0.06)]; H = [(-0.36, 0.98, 0.2), (0.36, 0.98, 0.2)]
    for s, e, h in zip(S, E, H):
        sc.seg(s, e, 0.07); sc.seg(e, h, 0.06); sc.ball(*h, 0.055)
        sc.seg((s[0] * 1.1, s[1] - 0.05, s[2] - 0.02), (e[0] * 1.15, e[1] - 0.12, e[2] - 0.02), 0.075)   # sleeve hanging under the arm
    if pose == 'book':
        sc.ell(-0.1, 1.15, 0.34, 0.14, 0.04, 0.11, ax=0.5)
    if pose == 'staff':
        sc.seg((0.32, 0.0, 0.34), (0.32, 2.0, 0.34), 0.03)
    if pose == 'child':                                                       # small child on the left arm
        sc.ell(-0.1, 1.38, 0.3, 0.1, 0.17, 0.09); sc.ball(-0.08, 1.6, 0.31, 0.085); sc.seg((-0.1, 1.3, 0.3), (0.05, 1.22, 0.36), 0.045)

def robed(sc, h=1.8, pose='prayer', seed=0, mantle=True, head_tilt=0.0):
    """Standing robed saint with folds; feet hidden by the hem."""
    rnd = random.Random(seed)
    with sc.at(s=h / 1.8):
        # hem, skirt, body: stacked ellipsoids, a little contrapposto
        lean = rnd.uniform(-0.04, 0.04)
        sc.ell(0, 0.1, 0.02, 0.3, 0.12, 0.25)
        sc.ell(lean, 0.42, 0.0, 0.27, 0.38, 0.2)
        sc.ell(lean * 0.6, 0.86, 0.0, 0.24, 0.36, 0.17)
        sc.ell(0, 1.2, 0.0, 0.22, 0.28, 0.14)
        sc.ell(0, 1.38, 0.0, 0.23, 0.15, 0.14)
        sc.seg((-0.2, 1.45, 0), (0.2, 1.45, 0), 0.085)                           # shoulders
        sc.ball(0, 1.56, 0.0, 0.06)                                               # neck
        with sc.at(0, 1.68, 0.0, rx=head_tilt):
            sc.ell(0, 0, 0.0, 0.095, 0.12, 0.11)                                  # head
            sc.ball(0, -0.01, 0.1, 0.03)                                          # nose
            sc.ell(0, 0.03, -0.03, 0.105, 0.1, 0.1)                               # hair / veil
        # vertical folds down the front and the sides of the robe
        for i in range(5):
            x = -0.2 + i * 0.1 + rnd.uniform(-0.02, 0.02)
            sc.seg((x * 1.25, 0.06, 0.2 - abs(x) * 0.35), (x * 0.9, 0.95 + rnd.uniform(-0.1, 0.1), 0.15 - abs(x) * 0.3), 0.035)
        if mantle:                                                                # mantle: draped over the back, a swag across the front
            sc.ell(0, 1.0, -0.1, 0.26, 0.55, 0.12)
            sc.seg((-0.26, 1.42, 0.02), (0.18, 0.78, 0.2), 0.06)
            sc.seg((0.18, 0.78, 0.2), (0.3, 0.6, 0.1), 0.05)
        _arms(sc, pose, rnd)

def virgin(sc, h=2.2):
    """The Immaculata: the Virgin standing on the globe, hands crossed on the chest, head a little bent, the mantle sweeping out
    to her right and a fold billowing behind (from File:Immaculata (Plague Column)... and File:Sculpture Immaculata - Plague Column.jpg)."""
    with sc.at(s=h / 1.8):
        sc.ell(0.0, 0.12, 0.05, 0.32, 0.13, 0.28)
        sc.ell(0.04, 0.42, 0.0, 0.27, 0.38, 0.2)
        sc.ell(0.02, 0.85, 0.0, 0.22, 0.36, 0.16)
        sc.ell(0, 1.2, 0.0, 0.21, 0.28, 0.14)
        sc.ell(0, 1.38, 0.0, 0.22, 0.15, 0.14)
        sc.seg((-0.2, 1.45, 0), (0.2, 1.45, 0), 0.08)
        sc.ball(0, 1.56, 0.02, 0.06)
        with sc.at(0, 1.68, 0.03, rx=0.25):
            sc.ell(0, 0, 0, 0.095, 0.12, 0.11); sc.ball(0, -0.01, 0.1, 0.03); sc.ell(0, 0.03, -0.035, 0.11, 0.11, 0.1)
            sc.seg((-0.08, 0.02, -0.05), (-0.11, -0.2, -0.06), 0.05); sc.seg((0.08, 0.02, -0.05), (0.11, -0.2, -0.06), 0.05)   # hair on the shoulders
        # mantle swept to the side and behind, knee pushed forward
        sc.ell(0.3, 0.7, -0.05, 0.16, 0.45, 0.14, az=-0.35)
        sc.seg((0.2, 1.35, -0.05), (0.42, 0.55, 0.0), 0.08); sc.seg((0.42, 0.55, 0.0), (0.38, 0.15, 0.08), 0.07)
        sc.ell(-0.05, 0.85, -0.16, 0.22, 0.45, 0.1)
        sc.ball(0.08, 0.68, 0.14, 0.12)                                           # knee under the robe
        for i in range(4):
            x = -0.15 + i * 0.1
            sc.seg((x * 1.2, 0.06, 0.24 - abs(x) * 0.3), (x * 0.8 + 0.05, 1.0, 0.13), 0.032)
        _arms(sc, 'crossed', random.Random(1))
        # crescent moon / serpent coil under the feet
        sc.seg((-0.32, 0.0, 0.0), (0.32, 0.0, 0.05), 0.07)

def cherub_head(sc, x, y, z, r=0.13, face=0.0):
    """Winged cherub head (as on the cloud obelisk): round head with cheeks, two wings spread to the sides. `face` = direction (ry) it looks."""
    with sc.at(x, y, z, face):
        sc.ball(0, 0, 0, r); sc.ball(-r * 0.45, -r * 0.35, r * 0.65, r * 0.42); sc.ball(r * 0.45, -r * 0.35, r * 0.65, r * 0.42)
        sc.ell(0, r * 0.25, -r * 0.1, r * 1.05, r * 0.8, r * 0.95)                # curls
        for s in (-1, 1):
            sc.ell(s * r * 1.5, -r * 0.1, -r * 0.3, r * 0.85, r * 0.42, r * 0.2, az=s * 0.45)
            sc.ell(s * r * 1.9, r * 0.35, -r * 0.35, r * 0.55, r * 0.3, r * 0.15, az=s * 0.8)

def putto(sc, x, y, z, h=0.7, face=0.0, seed=0, wings=True):
    """Small child angel clambering on the clouds: round body, big head, chubby limbs, wings."""
    rnd = random.Random(seed); k = h / 0.7
    with sc.at(x, y, z, face, s=k):
        sc.ell(0, 0.3, 0, 0.12, 0.16, 0.1); sc.ball(0, 0.52, 0.01, 0.1)
        a = rnd.uniform(-0.6, 0.6)
        sc.seg((-0.1, 0.4, 0), (-0.22, 0.4 + 0.15 * math.cos(a), 0.08), 0.04); sc.seg((0.1, 0.4, 0), (0.2, 0.55 + 0.1 * math.sin(a), 0.05), 0.04)
        sc.seg((-0.06, 0.16, 0.02), (-0.12, 0.0, 0.12), 0.05); sc.seg((0.06, 0.16, 0.02), (0.14, 0.05, -0.05), 0.05)
        if wings:
            for s in (-1, 1): sc.ell(s * 0.12, 0.42, -0.1, 0.12, 0.08, 0.04, az=s * 0.6)

def cloud(sc, x, y, z, r, n=6, seed=0, flat=0.7):
    """Billowing cloud: a cluster of balls."""
    rnd = random.Random(seed)
    for i in range(n):
        a = rnd.uniform(0, 2 * math.pi); d = rnd.uniform(0.2, 0.8) * r
        sc.ell(x + d * math.cos(a), y + rnd.uniform(-0.3, 0.3) * r, z + d * math.sin(a), r * rnd.uniform(0.45, 0.7), r * rnd.uniform(0.45, 0.7) * flat, r * rnd.uniform(0.45, 0.7))
