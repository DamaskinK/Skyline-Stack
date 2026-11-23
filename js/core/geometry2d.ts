// Plain 2D geometry for the placement rules and the placement audit (no Three.js): polygons, polylines with a width, circles and
// oriented boxes in the ground plane. Frame: metres, flat [x, z, x, z, ...] lists. Deterministic, no allocation tricks.

export type Ring = number[];       // closed polygon, flat, first point not repeated
export type Line = number[];       // open polyline, flat
export type Box4 = [number, number, number, number];   // x0, z0, x1, z1

export function ringBox(p: number[]): Box4 {
  let x0 = Infinity, z0 = Infinity, x1 = -Infinity, z1 = -Infinity;
  for (let i = 0; i < p.length; i += 2) { if (p[i] < x0) x0 = p[i]; if (p[i] > x1) x1 = p[i]; if (p[i + 1] < z0) z0 = p[i + 1]; if (p[i + 1] > z1) z1 = p[i + 1]; }
  return [x0, z0, x1, z1];
}
export const boxHit = (a: Box4, b: Box4, m = 0): boolean => a[0] <= b[2] + m && a[2] >= b[0] - m && a[1] <= b[3] + m && a[3] >= b[1] - m;

export function ringArea(p: Ring): number { let a = 0; for (let i = 0, n = p.length / 2; i < n; i++) { const j = (i + 1) % n; a += p[2 * i] * p[2 * j + 1] - p[2 * j] * p[2 * i + 1]; } return a / 2; }

export function pointInRing(p: Ring, x: number, z: number): boolean {
  let c = false;
  for (let i = 0, n = p.length / 2, j = n - 1; i < n; j = i++) {
    const xi = p[2 * i], zi = p[2 * i + 1], xj = p[2 * j], zj = p[2 * j + 1];
    if ((zi > z) !== (zj > z) && x < (xj - xi) * (z - zi) / (zj - zi) + xi) c = !c;
  }
  return c;
}

// distance from a point to the segment (x0, z0)-(x1, z1)
export function pointSeg(x: number, z: number, x0: number, z0: number, x1: number, z1: number): number {
  const dx = x1 - x0, dz = z1 - z0, l2 = dx * dx + dz * dz;
  const t = l2 > 0 ? Math.max(0, Math.min(1, ((x - x0) * dx + (z - z0) * dz) / l2)) : 0;
  return Math.hypot(x - x0 - dx * t, z - z0 - dz * t);
}
export function pointLine(x: number, z: number, p: Line): number {
  let d = Infinity;
  for (let i = 0; i + 3 < p.length; i += 2) d = Math.min(d, pointSeg(x, z, p[i], p[i + 1], p[i + 2], p[i + 3]));
  return d;
}
const orient = (ax: number, az: number, bx: number, bz: number, cx: number, cz: number): number => (bx - ax) * (cz - az) - (bz - az) * (cx - ax);
export function segsCross(a0x: number, a0z: number, a1x: number, a1z: number, b0x: number, b0z: number, b1x: number, b1z: number): boolean {
  const d1 = orient(b0x, b0z, b1x, b1z, a0x, a0z), d2 = orient(b0x, b0z, b1x, b1z, a1x, a1z), d3 = orient(a0x, a0z, a1x, a1z, b0x, b0z), d4 = orient(a0x, a0z, a1x, a1z, b1x, b1z);
  return ((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) && ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0));
}
export function segSeg(a0x: number, a0z: number, a1x: number, a1z: number, b0x: number, b0z: number, b1x: number, b1z: number): number {
  if (segsCross(a0x, a0z, a1x, a1z, b0x, b0z, b1x, b1z)) return 0;
  return Math.min(pointSeg(a0x, a0z, b0x, b0z, b1x, b1z), pointSeg(a1x, a1z, b0x, b0z, b1x, b1z), pointSeg(b0x, b0z, a0x, a0z, a1x, a1z), pointSeg(b1x, b1z, a0x, a0z, a1x, a1z));
}

// Smallest distance between a ring (its area counts, so 0 when it holds the point or the segment) and the segment.
export function ringSeg(r: Ring, x0: number, z0: number, x1: number, z1: number): number {
  if (pointInRing(r, x0, z0) || pointInRing(r, x1, z1)) return 0;
  let d = Infinity;
  for (let i = 0, n = r.length / 2; i < n; i++) { const j = (i + 1) % n; d = Math.min(d, segSeg(r[2 * i], r[2 * i + 1], r[2 * j], r[2 * j + 1], x0, z0, x1, z1)); if (d === 0) return 0; }
  return d;
}
// Smallest distance between a ring (area counts) and a polyline: how far an object stands from the centre line of a road, with the
// road's half width to be compared with it. `box` (optional) is the ring's bounding box, `reach` the largest distance of interest.
export function ringLine(r: Ring, p: Line, box: Box4 = ringBox(r), reach = Infinity): number {
  let d = Infinity;
  for (let i = 0; i + 3 < p.length; i += 2) {
    const sx0 = Math.min(p[i], p[i + 2]), sx1 = Math.max(p[i], p[i + 2]), sz0 = Math.min(p[i + 1], p[i + 3]), sz1 = Math.max(p[i + 1], p[i + 3]);
    if (sx0 > box[2] + reach || sx1 < box[0] - reach || sz0 > box[3] + reach || sz1 < box[1] - reach) continue;
    d = Math.min(d, ringSeg(r, p[i], p[i + 1], p[i + 2], p[i + 3])); if (d === 0) return 0;
  }
  return d;
}
// Smallest distance between two rings (areas count: 0 when they overlap or one holds the other).
export function ringRing(a: Ring, b: Ring): number {
  if (pointInRing(b, a[0], a[1]) || pointInRing(a, b[0], b[1])) return 0;
  let d = Infinity;
  for (let i = 0, n = a.length / 2; i < n; i++) {
    const j = (i + 1) % n;
    d = Math.min(d, ringSeg(b, a[2 * i], a[2 * i + 1], a[2 * j], a[2 * j + 1])); if (d === 0) return 0;
  }
  return d;
}
// Area shared by two rings, by sampling a grid inside the overlap of their boxes (step metres): good to a fraction of a square metre.
export function overlapArea(a: Ring, b: Ring, step = 0.5): number {
  const A = ringBox(a), B = ringBox(b), x0 = Math.max(A[0], B[0]), x1 = Math.min(A[2], B[2]), z0 = Math.max(A[1], B[1]), z1 = Math.min(A[3], B[3]);
  if (x0 >= x1 || z0 >= z1) return 0;
  let n = 0;
  for (let x = x0 + step / 2; x < x1; x += step) for (let z = z0 + step / 2; z < z1; z += step) if (pointInRing(a, x, z) && pointInRing(b, x, z)) n++;
  return n * step * step;
}

export function circleRing(x: number, z: number, r: number, n = 10): Ring {
  const out: number[] = [];
  for (let i = 0; i < n; i++) { const a = i / n * Math.PI * 2; out.push(x + Math.cos(a) * r, z + Math.sin(a) * r); }
  return out;
}
// Box centred on (x, z) with half sizes hx (local x) and hz (local z), turned by `rot` the way THREE's rotation.y turns an object
// (local +z goes to world (sin rot, cos rot), local +x to (cos rot, -sin rot)).
export function boxRing(x: number, z: number, hx: number, hz: number, rot: number): Ring {
  const c = Math.cos(rot), s = Math.sin(rot), out: number[] = [];
  for (const [u, v] of [[-hx, -hz], [hx, -hz], [hx, hz], [-hx, hz]]) out.push(x + u * c + v * s, z - u * s + v * c);
  return out;
}
// Pieces of a polyline that keep `gap` metres away from every ring (cut at the crossing, found by sampling the segments every
// `step` metres and refining by bisection). Pieces shorter than `minLen` are dropped.
export function lineOutside(p: Line, rings: { r: Ring; box: Box4 }[], gap = 0, minLen = 2, step = 0.5): Line[] {
  const bad = (x: number, z: number): boolean => {
    for (const o of rings) {
      if (x < o.box[0] - gap || x > o.box[2] + gap || z < o.box[1] - gap || z > o.box[3] + gap) continue;
      if (pointInRing(o.r, x, z)) return true;
      if (gap > 0) for (let i = 0, n = o.r.length / 2; i < n; i++) { const j = (i + 1) % n; if (pointSeg(x, z, o.r[2 * i], o.r[2 * i + 1], o.r[2 * j], o.r[2 * j + 1]) < gap) return true; }
    }
    return false;
  };
  const out: Line[] = []; let cur: Line | null = null;
  const flush = (): void => { if (cur && lineLength(cur) >= minLen) out.push(cur); cur = null; };
  const n = p.length / 2;
  if (n < 2) return out;
  if (!bad(p[0], p[1])) cur = [p[0], p[1]];
  for (let i = 0; i + 3 < p.length; i += 2) {
    const x0 = p[i], z0 = p[i + 1], dx = p[i + 2] - x0, dz = p[i + 3] - z0, l = Math.hypot(dx, dz), k = Math.max(1, Math.ceil(l / step));
    let prevBad = bad(x0, z0), px = x0, pz = z0;
    for (let s = 1; s <= k; s++) {
      const x = x0 + dx * s / k, z = z0 + dz * s / k, b = bad(x, z);
      if (b !== prevBad) {
        let lo = 0, hi = 1;                                   // bisect the crossing between the two samples
        for (let it = 0; it < 8; it++) { const m = (lo + hi) / 2; if (bad(px + (x - px) * m, pz + (z - pz) * m) === prevBad) lo = m; else hi = m; }
        const cx = px + (x - px) * lo, cz = pz + (z - pz) * lo;
        if (b) { if (cur) cur.push(cx, cz); flush(); } else cur = [cx, cz];
      }
      prevBad = b; px = x; pz = z;
    }
    if (!prevBad && cur) cur.push(p[i + 2], p[i + 3]);
  }
  flush();
  return out;
}
export function lineLength(p: Line): number { let l = 0; for (let i = 2; i < p.length; i += 2) l += Math.hypot(p[i] - p[i - 2], p[i + 1] - p[i - 1]); return l; }
// Polyline moved sideways by off metres (left of the travel direction for off > 0), like the bike lanes and track edges use it.
export function offsetLine(p: Line, off: number): Line {
  const out: number[] = [], n = p.length / 2;
  for (let i = 0; i < n; i++) {
    const a = Math.max(0, i - 1), b = Math.min(n - 1, i + 1);
    let dx = p[2 * b] - p[2 * a], dz = p[2 * b + 1] - p[2 * a + 1]; const l = Math.hypot(dx, dz) || 1; dx /= l; dz /= l;
    out.push(p[2 * i] - dz * off, p[2 * i + 1] + dx * off);
  }
  return out;
}
