// Camera pass of the city intro: a smooth path from where the camera is now, past each landmark in view, to the start pose of the run.
// Pure maths (no Three.js), so it is the same every time and can be tested.
export type V3 = [number, number, number];
export interface Pose { p: V3; l: V3 }   // camera position and the point it looks at
export interface Spot { x: number; z: number }

const HOLD = 1.6, PER_SPOT = 2.4, MAX = 9;   // seconds: first move, per landmark, never longer than this
export const introDuration = (spots: number): number => Math.min(MAX, HOLD + 2.2 + PER_SPOT * spots);

// A viewpoint beside a landmark: 55 m away, on the plot's side but turned 35 degrees (alternating) so the tower is not in the way.
function viewOf(s: Spot, i: number): Pose {
  const len = Math.hypot(s.x, s.z) || 1, a = Math.atan2(-s.z / len, -s.x / len) + (i % 2 ? -1 : 1) * 0.61;
  return { p: [s.x + Math.cos(a) * 55, 26, s.z + Math.sin(a) * 55], l: [s.x, 14, s.z] };
}

export function introKeys(start: Pose, spots: Spot[], end: Pose): Pose[] {
  const sorted = [...spots].sort((a, b) => Math.atan2(a.z, a.x) - Math.atan2(b.z, b.x));
  if (!sorted.length) {   // no landmark in view: a quarter turn round the plot
    const a0 = Math.atan2(start.p[2], start.p[0]), r = 46;
    return [start, { p: [Math.cos(a0 + 0.9) * r, 24, Math.sin(a0 + 0.9) * r], l: [0, 10, 0] }, end];
  }
  return [start, ...sorted.map(viewOf), end];
}

function cr(p0: number, p1: number, p2: number, p3: number, t: number): number {   // Catmull-Rom segment between p1 and p2
  return 0.5 * (2 * p1 + (p2 - p0) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t * t + (-p0 + 3 * p1 - 3 * p2 + p3) * t * t * t);
}
const smooth = (u: number): number => u * u * (3 - 2 * u);

// u in 0..1 along the whole pass (eased at both ends); the path goes through every key.
export function introPose(keys: Pose[], u: number): Pose {
  const n = keys.length - 1, x = Math.min(1, Math.max(0, smooth(Math.min(1, Math.max(0, u))))) * n;
  const i = Math.min(n - 1, Math.floor(x)), t = x - i;
  const k = (j: number): Pose => keys[Math.min(n, Math.max(0, j))];
  const at = (f: (q: Pose) => V3): V3 => [0, 1, 2].map((c) => cr(f(k(i - 1))[c], f(k(i))[c], f(k(i + 1))[c], f(k(i + 2))[c], t)) as V3;
  return { p: at((q) => q.p), l: at((q) => q.l) };
}
