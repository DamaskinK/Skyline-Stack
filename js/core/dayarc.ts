// Time of day as data: a level's `dayArc: { start, end }` (hours, 24 h clock) is walked from its first to its last floor.
// Pure maths, no Three.js. The renderer (world.js) turns the hour into sun, sky and glow.
export const ENDLESS_LOOP = 60;   // floors one Endless day lasts: start -> end -> back to start, smoothly
export interface DayArc { start: number; end: number }
export interface DayLevel { target?: number; dayArc?: DayArc; grade?: unknown }
export const DEFAULT_ARC: DayArc = { start: 14, end: 14 };

// Progress 0..1 along the arc. A level counts floors towards its target; Endless loops a smooth there-and-back wave.
export function arcProgress(level: DayLevel | null | undefined, n: number, endless = false): number {
  if (!level) return 0;
  if (endless || !level.target) return 0.5 - 0.5 * Math.cos((2 * Math.PI * (n % ENDLESS_LOOP)) / ENDLESS_LOOP);
  return Math.min(1, Math.max(0, n / level.target));
}

// { hour, t, grade } for a floor count. A level without an arc (or no level) sits at a fixed afternoon.
export function dayAt(level: DayLevel | null | undefined, n: number, endless = false) {
  const arc = (level && level.dayArc) || DEFAULT_ARC, t = arcProgress(level, n, endless);
  return { hour: arc.start + (arc.end - arc.start) * t, t, grade: (level && level.grade) || null };
}
