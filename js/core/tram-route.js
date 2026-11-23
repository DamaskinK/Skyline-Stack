// Tram lines from OpenStreetMap, as plain data (no Three.js): chain the loose ways into lines, snap the stops onto a line,
// cut polylines at boxes, and turn a clock into a position along a line (drive, stop for a few seconds, drive on).
// Deterministic: the same time gives the same place. Frame: metres, flat [x, z, x, z, ...] lists.

const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
const ends = (p) => [[p[0], p[1]], [p[p.length - 2], p[p.length - 1]]];
const reverse = (p) => { const q = []; for (let i = p.length - 2; i >= 0; i -= 2) q.push(p[i], p[i + 1]); return q; };

// Joins ways that share an end point (within tol metres) into longer lines. A way is only reversed when it must be, so
// the direction of travel the data gives stays as it is wherever the ways agree.
export function joinWays(ways, tol = 0.6) {
  const rest = ways.filter((p) => p.length >= 4).map((p) => p.slice()), lines = [];
  while (rest.length) {
    let line = rest.shift(), grew = true;
    while (grew) {
      grew = false;
      for (let i = 0; i < rest.length; i++) {
        const [a, b] = ends(line), [c, d] = ends(rest[i]);
        let add = null, front = false;
        if (dist(b, c) <= tol) add = rest[i];
        else if (dist(a, d) <= tol) { add = rest[i]; front = true; }
        else if (dist(b, d) <= tol) add = reverse(rest[i]);
        else if (dist(a, c) <= tol) { add = reverse(rest[i]); front = true; }
        if (!add) continue;
        line = front ? add.concat(line.slice(2)) : line.concat(add.slice(2));
        rest.splice(i, 1); grew = true; break;
      }
    }
    lines.push(line);
  }
  return lines;
}

// Cumulative lengths of a polyline: { p, cum, len }.
export function makeRoute(p) {
  const cum = [0]; for (let i = 2; i < p.length; i += 2) cum.push(cum[cum.length - 1] + Math.hypot(p[i] - p[i - 2], p[i + 1] - p[i - 1]));
  return { p, cum, len: cum[cum.length - 1] };
}
// Point and unit direction at distance s along a route (clamped to its ends): [x, z, dx, dz].
export function pointAt(r, s) {
  s = Math.max(0, Math.min(r.len, s));
  let k = 1; while (k < r.cum.length - 1 && r.cum[k] < s) k++;
  const l = r.cum[k] - r.cum[k - 1] || 1, f = (s - r.cum[k - 1]) / l, x0 = r.p[2 * k - 2], z0 = r.p[2 * k - 1], x1 = r.p[2 * k], z1 = r.p[2 * k + 1];
  return [x0 + (x1 - x0) * f, z0 + (z1 - z0) * f, (x1 - x0) / l, (z1 - z0) / l];
}
// Where a point lies along a route: { s, d } with d the distance from the line to the point.
export function project(r, x, z) {
  let best = { s: 0, d: Infinity };
  for (let i = 0; i + 3 < r.p.length; i += 2) {
    const x0 = r.p[i], z0 = r.p[i + 1], dx = r.p[i + 2] - x0, dz = r.p[i + 3] - z0, l2 = dx * dx + dz * dz || 1;
    const t = Math.max(0, Math.min(1, ((x - x0) * dx + (z - z0) * dz) / l2)), d = Math.hypot(x - x0 - dx * t, z - z0 - dz * t);
    if (d < best.d) best = { s: r.cum[i / 2] + Math.sqrt(l2) * t, d };
  }
  return best;
}
// Distances along the route of the stops that lie within maxD metres of the line, in order, thinned so two stops are never closer than minGap.
export function snapStops(r, stops, maxD = 14, minGap = 60) {
  const s = stops.map(([x, z]) => project(r, x, z)).filter((q) => q.d <= maxD).map((q) => q.s).sort((a, b) => a - b);
  return s.filter((v, i) => i === 0 || v - s[i - 1] >= minGap).filter((v) => v > 5 && v < r.len - 5);
}

// A one-way schedule over a route of length len for a vehicle `span` metres long: the head starts at `span` (the tail at the
// start of the line), drives at `speed` m/s, stands `dwell` seconds at every stop (head at the stop), and starts again at the
// start after `pause` seconds at the end. Returns { period, at(t) } where at(t) is the head's distance along the route and
// `moving` says whether it is driving.
export function makeSchedule(len, stopsS, { span = 0, speed = 9, dwell = 6, pause = 3 } = {}) {
  const marks = stopsS.filter((v) => v > span && v < len);
  const legs = []; let t = 0, s = span;
  for (const m of marks) { const d = (m - s) / speed; legs.push({ t0: t, t1: t + d, s0: s, s1: m }); t += d; legs.push({ t0: t, t1: t + dwell, s0: m, s1: m }); t += dwell; s = m; }
  const d = (len - s) / speed; legs.push({ t0: t, t1: t + d, s0: s, s1: len }); t += d; legs.push({ t0: t, t1: t + pause, s0: len, s1: len }); t += pause;
  const period = t;
  return {
    period,
    at(time) {
      const u = ((time % period) + period) % period;
      const leg = legs.find((q) => u < q.t1) || legs[legs.length - 1], k = leg.t1 > leg.t0 ? (u - leg.t0) / (leg.t1 - leg.t0) : 0;
      return { s: leg.s0 + (leg.s1 - leg.s0) * k, moving: leg.s1 !== leg.s0 };
    },
  };
}

// Pieces of a polyline kept by `keep(x, z)` evaluated at segment midpoints, after cutting every segment at the edges of the given
// boxes ([x0, z0, x1, z1]) so the cut lies exactly on a box edge. Returns a list of polylines (flat lists, at least one segment each).
export function cutPolyline(p, boxes, keep) {
  const out = []; let cur = null;
  for (let i = 0; i + 3 < p.length; i += 2) {
    const x0 = p[i], z0 = p[i + 1], dx = p[i + 2] - x0, dz = p[i + 3] - z0, ts = [0, 1];
    for (const [bx0, bz0, bx1, bz1] of boxes) {
      for (const bx of [bx0, bx1]) if (dx) { const t = (bx - x0) / dx; if (t > 0 && t < 1) ts.push(t); }
      for (const bz of [bz0, bz1]) if (dz) { const t = (bz - z0) / dz; if (t > 0 && t < 1) ts.push(t); }
    }
    ts.sort((a, b) => a - b);
    for (let k = 0; k + 1 < ts.length; k++) {
      const a = ts[k], b = ts[k + 1]; if (b - a < 1e-9) continue;
      const ax = x0 + dx * a, az = z0 + dz * a, bx = x0 + dx * b, bz = z0 + dz * b;
      if (keep((ax + bx) / 2, (az + bz) / 2)) {
        if (cur && Math.hypot(cur[cur.length - 2] - ax, cur[cur.length - 1] - az) < 1e-6) cur.push(bx, bz);
        else { cur = [ax, az, bx, bz]; out.push(cur); }
      } else cur = null;
    }
  }
  return out;
}
export { reverse as reversePolyline };
