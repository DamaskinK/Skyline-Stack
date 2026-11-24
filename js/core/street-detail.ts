// The detail of the streets of an OpenStreetMap near ring, as plain data (S0004 03): kerbs along every carriageway edge (cut at the mouths of
// side streets), zebra crossings and stop lines at junctions, dashed centre lines, manholes, gully drains, traffic lights at the bigger
// junctions (with the phases the cars obey). Every piece is a footprint that goes through the placement rules (js/core/placement.ts), so none
// lies on a house, a bike lane, a tram bed, in water or on the player's pad, and the audit checks them with everything else.
// Deterministic: position hashes only.
import { boxRing, circleRing, lineLength, offsetLine } from './geometry2d.js';
import type { Line, Ring } from './geometry2d.js';
import type { OsmExtract, OsmRoad } from '../types.js';

const hash = (x: number, z: number): number => { const s = Math.sin(x * 12.9898 + z * 78.233) * 43758.5453; return s - Math.floor(s); };
export type DetailKind = 'kerb' | 'zebra' | 'dash' | 'manhole' | 'drain' | 'tlight';
export interface Arm { x: number; z: number; tx: number; tz: number; w: number; ri: number; i: number; dir: 1 | -1 }     // one street leaving a junction: first vertex, unit direction away from it, width
export interface Junction { x: number; z: number; arms: Arm[]; clear: number }                 // clear: metres from the centre to where the arms start to be plain street
export interface LightArm { x: number; z: number; rot: number; tx: number; tz: number; group: 0 | 1; stop: number }   // pole position, facing, direction away from the junction, stop line distance
export interface Light { x: number; z: number; arms: LightArm[]; offset: number }
export interface Detail {
  kerbs: number[][];                                   // x0, z0, x1, z1 (straight pieces of about 3 m)
  zebras: { x: number; z: number; rot: number; w: number }[];     // rot: direction of the street (THREE rotation.y: local +z along it), w: width of the street
  stopLines: { x: number; z: number; rot: number; w: number }[];
  dashes: number[][];                                  // x0, z0, x1, z1
  manholes: number[][]; drains: number[][];            // x, z, rot
  lights: Light[]; junctions: number;
}
export const PHASE = { period: 32, green: 13, amber: 2 };    // seconds: group 0 green 0-13, amber 13-15, red to 32; group 1 runs half a period later
// 0 green, 1 amber, 2 red for a group of a light at time t
export function lightState(light: Light, group: 0 | 1, t: number): 0 | 1 | 2 {
  const u = (((t + light.offset + group * PHASE.period / 2) % PHASE.period) + PHASE.period) % PHASE.period;
  return u < PHASE.green ? 0 : u < PHASE.green + PHASE.amber ? 1 : 2;
}

export interface Ctx {
  isCarriage(r: OsmRoad): boolean;
  // can the footprint stand here (kind rules of placement.ts)? registers it as placed when yes
  place(kind: DetailKind, x: number, z: number, rot: number, own: number | undefined, ring: Ring, solid: boolean): boolean;
  bbIn(x: number, z: number, m?: number): boolean;
  clearPlaza(x: number, z: number): boolean;
}

// point at distance d along the polyline from vertex i toward dir (+1 / -1)
function walk(p: Line, i: number, dir: 1 | -1, d: number): [number, number] {
  let x = p[2 * i], z = p[2 * i + 1], left = d, k = i;
  while (left > 1e-6) {
    const j = k + dir; if (j < 0 || j >= p.length / 2) break;
    const nx = p[2 * j], nz = p[2 * j + 1], l = Math.hypot(nx - x, nz - z);
    if (l >= left) { x += (nx - x) * left / l; z += (nz - z) * left / l; left = 0; } else { x = nx; z = nz; left -= l; k = j; }
  }
  return [x, z];
}

export function findJunctions(osm: OsmExtract): Junction[] {
  const nodes = new Map<string, { x: number; z: number; arms: Arm[] }>(), key = (x: number, z: number): string => `${Math.round(x * 2)},${Math.round(z * 2)}`;
  osm.roads.forEach((r, ri) => {
    if (r.k !== 'main' && r.k !== 'street' && r.k !== 'lane') return;
    const n = r.p.length / 2;
    for (let i = 0; i < n; i++) {
      const x = r.p[2 * i], z = r.p[2 * i + 1], k = key(x, z);
      const node = nodes.get(k) || nodes.set(k, { x, z, arms: [] }).get(k) as { x: number; z: number; arms: Arm[] };
      for (const dir of [-1, 1] as const) {
        if (i + dir < 0 || i + dir >= n) continue;
        const [qx, qz] = walk(r.p, i, dir, 8), l = Math.hypot(qx - x, qz - z); if (l < 1) continue;
        node.arms.push({ x, z, tx: (qx - x) / l, tz: (qz - z) / l, w: r.w, ri, i, dir });
      }
    }
  });
  const out: Junction[] = [];
  for (const nd of nodes.values()) {
    if (nd.arms.length < 3) continue;
    out.push({ x: nd.x, z: nd.z, arms: nd.arms, clear: Math.max(...nd.arms.map((a) => a.w)) / 2 + 0.8 });
  }
  return out;
}

// Phase 1 (before the bike lanes, which stop short of the crossings): zebra crossings, stop lines and traffic lights at the junctions.
export function planCrossings(osm: OsmExtract, ctx: Ctx): Detail {
  const d: Detail = { kerbs: [], zebras: [], stopLines: [], dashes: [], manholes: [], drains: [], lights: [], junctions: 0 };
  const roads = osm.roads;
  const junctions = findJunctions(osm); d.junctions = junctions.length;
  const dist0 = (x: number, z: number): number => Math.hypot(x, z);

  // ── traffic lights and zebra crossings at junctions, nearest to the tower first ──
  const nearJ = junctions.filter((j) => ctx.bbIn(j.x, j.z, 14) && !ctx.clearPlaza(j.x, j.z)).sort((a, b) => dist0(a.x, a.z) - dist0(b.x, b.z));
  let lit = 0;
  for (const j of nearJ) {
    const wide = j.arms.filter((a) => a.w >= 6.5).length, big = wide >= 3 && j.arms.length >= 3 && j.arms.every((a) => a.w >= 4.5 || a.w <= 3);
    const wantLight = big && lit < 4 && dist0(j.x, j.z) < 190;
    const lightArms: LightArm[] = [];
    const first = j.arms.find((a) => a.w >= 6.5) || j.arms[0];
    for (const a of j.arms) {
      if (a.w < 5.5) continue;
      let cx = 0, cz = 0, tx = 0, tz = 0, rot = 0, ok = false, used = 0;
      for (const extra of [2.2, 3.4, 4.8]) {         // the crossing steps back from the junction until it clears the crossing street
        [cx, cz] = walk(roads[a.ri].p, a.i, a.dir, j.clear + extra);
        const dx = cx - a.x, dz = cz - a.z, l = Math.hypot(dx, dz) || 1; tx = dx / l; tz = dz / l; rot = Math.atan2(tx, tz);
        if (ctx.place('zebra', cx, cz, rot, a.ri, boxRing(cx, cz, a.w / 2 - 0.35, 1.7, rot), true)) { ok = true; used = extra; break; }
      }
      if (ok) {
        d.zebras.push({ x: cx, z: cz, rot, w: a.w - 0.7 });
        if (wantLight) {
          // stop line a little before the zebra; the pole stands beside the carriageway on the incoming traffic's right
          const sd = j.clear + used + 2.8, sx = a.x + tx * sd, sz = a.z + tz * sd;
          d.stopLines.push({ x: sx, z: sz, rot, w: Math.max(1.2, a.w / 2 - 1.9) });      // stops short of the bike lane at the kerb
          const side = tx * first.tz - tz * first.tx >= 0 ? 1 : -1;      // tie-break only: both sides are tried
          for (const sgn of [side, -side]) {
            const px = a.x + tx * (sd - 0.4) - tz * sgn * (a.w / 2 + 0.9), pz = a.z + tz * (sd - 0.4) + tx * sgn * (a.w / 2 + 0.9);
            if (ctx.place('tlight', px, pz, rot, undefined, circleRing(px, pz, 0.25, 6), true)) { lightArms.push({ x: px, z: pz, rot, tx, tz, group: 0, stop: sd }); break; }
          }
        }
      }
    }
    if (wantLight && lightArms.length >= 2) {
      // arms roughly in line with the first one share a phase, the others the opposite phase
      const f = lightArms[0];
      for (const la of lightArms) la.group = Math.abs(la.tx * f.tx + la.tz * f.tz) > 0.6 ? 0 : 1;
      d.lights.push({ x: j.x, z: j.z, arms: lightArms, offset: Math.floor(hash(j.x, j.z) * PHASE.period) }); lit++;
    }
  }

  return d;
}

// Phase 2 (after the bike lanes): kerbs, centre lines, manholes, drains along every carriageway.
export function planMarkings(osm: OsmExtract, ctx: Ctx, d: Detail): Detail {
  const roads = osm.roads, car = (r: OsmRoad): boolean => ctx.isCarriage(r);
  roads.forEach((r, ri) => {
    if (!car(r)) return;
    const len = lineLength(r.p); if (len < 4) return;
    // kerbs on both edges, pieces of at most 3 m, only where the site lets a kerb stand
    for (const side of [1, -1]) {
      const e = offsetLine(r.p, side * (r.w / 2 + 0.09));
      for (let i = 0; i + 3 < e.length; i += 2) {
        const sx = e[i], sz = e[i + 1], dx = e[i + 2] - sx, dz = e[i + 3] - sz, l = Math.hypot(dx, dz); if (l < 0.3) continue;
        const n = Math.ceil(l / 3), tx = dx / l, tz = dz / l, rot = Math.atan2(tx, tz);
        for (let k = 0; k < n; k++) {
          const a = l * k / n, b = l * (k + 1) / n, x0 = sx + tx * a, z0 = sz + tz * a, x1 = sx + tx * b, z1 = sz + tz * b, mx = (x0 + x1) / 2, mz = (z0 + z1) / 2;
          if (!ctx.bbIn(mx, mz, 4) || ctx.clearPlaza(mx, mz)) continue;
          if (ctx.place('kerb', mx, mz, rot, ri, boxRing(mx, mz, 0.09, (b - a) / 2, rot), false)) d.kerbs.push([x0, z0, x1, z1]);
        }
      }
    }
    if (r.k === 'lane' && r.w < 4) return;
    // dashed centre line of the wider streets: 3 m dash, 6 m gap, kept off junctions, crossings, bike lanes, tram beds
    // two-way: one dashed centre line; one-way with several lanes: a dashed divider between the lanes (S0004 15); a single one-way lane has none
    const nl = r.ow ? (r.ln || Math.max(1, Math.round(r.w / 3.4))) : 1;
    const offs: number[] = r.ow ? Array.from({ length: nl - 1 }, (_, k) => (k + 1) * r.w / nl - r.w / 2) : [0];
    if (r.w >= 5.5) for (const off of offs) {
      const lp = off ? offsetLine(r.p, off) : r.p;
      let acc = 2 + hash(r.p[0], r.p[1]) * 3;
      for (let i = 0; i + 3 < lp.length; i += 2) {
        const x0 = lp[i], z0 = lp[i + 1], dx = lp[i + 2] - x0, dz = lp[i + 3] - z0, l = Math.hypot(dx, dz); if (l < 0.5) continue;
        const tx = dx / l, tz = dz / l, rot = Math.atan2(tx, tz);
        let s = acc;
        for (; s + 3 < l; s += 9) {
          const mx = x0 + tx * (s + 1.5), mz = z0 + tz * (s + 1.5);
          if (!ctx.bbIn(mx, mz, 4) || ctx.clearPlaza(mx, mz)) continue;
          if (ctx.place('dash', mx, mz, rot, ri, boxRing(mx, mz, 0.1, 1.5, rot), false)) d.dashes.push([x0 + tx * s, z0 + tz * s, x0 + tx * (s + 3), z0 + tz * (s + 3)]);
        }
        acc = Math.max(0, s - l);                       // a negative start would pull the next dash back across the bend
      }
    }
    // manholes in the lane, gully drains at the kerb
    for (let s = 12 + hash(r.p[1], r.p[0]) * 20, k = 0; s < len - 8; s += 38, k++) {
      const [x, z] = alongAt(r.p, s), [x2, z2] = alongAt(r.p, s + 1), tl = Math.hypot(x2 - x, z2 - z) || 1, tx = (x2 - x) / tl, tz = (z2 - z) / tl, rot = Math.atan2(tx, tz);
      const lat = (k % 2 ? 1 : -1) * r.w * 0.2, mx = x - tz * lat, mz = z + tx * lat;
      if (ctx.bbIn(mx, mz, 6) && !ctx.clearPlaza(mx, mz) && ctx.place('manhole', mx, mz, rot, ri, circleRing(mx, mz, 0.4, 8), false)) d.manholes.push([mx, mz, rot]);
    }
    if (r.w >= 5) for (let s = 20 + hash(r.p[0], r.p[1]) * 14, k = 0; s < len - 8; s += 27, k++) {
      const [x, z] = alongAt(r.p, s), [x2, z2] = alongAt(r.p, s + 1), tl = Math.hypot(x2 - x, z2 - z) || 1, tx = (x2 - x) / tl, tz = (z2 - z) / tl, rot = Math.atan2(tx, tz);
      const lat = (k % 2 ? 1 : -1) * (r.w / 2 - 0.4), mx = x - tz * lat, mz = z + tx * lat;
      if (ctx.bbIn(mx, mz, 6) && !ctx.clearPlaza(mx, mz) && ctx.place('drain', mx, mz, rot, ri, boxRing(mx, mz, 0.2, 0.4, rot), false)) d.drains.push([mx, mz, rot]);
    }
  });
  return d;
}

function alongAt(p: Line, s: number): [number, number] {
  let left = s;
  for (let i = 0; i + 3 < p.length; i += 2) {
    const l = Math.hypot(p[i + 2] - p[i], p[i + 3] - p[i + 1]);
    if (left <= l) return [p[i] + (p[i + 2] - p[i]) * left / Math.max(l, 1e-6), p[i + 1] + (p[i + 3] - p[i + 1]) * left / Math.max(l, 1e-6)];
    left -= l;
  }
  return [p[p.length - 2], p[p.length - 1]];
}
