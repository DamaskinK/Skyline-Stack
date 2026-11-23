// Small helpers so strict tests can say "this exists" once instead of sprinkling `!`.
import { levelById } from '../../js/levels.js';
import type { Level } from '../../js/types.js';

export function need<T>(x: T | null | undefined, what = 'value'): T {
  if (x == null) throw new Error(`test setup: ${what} is missing`);
  return x;
}
export const levelOf = (id: string): Level => need(levelById(id), `level ${id}`);

import type { RunEvent, RunEventType } from '../../js/types.js';
// The first event of a kind, typed by that kind (undefined when there is none).
export function findEvent<K extends RunEventType>(events: RunEvent[], type: K): Extract<RunEvent, { type: K }> | undefined {
  return events.find((e): e is Extract<RunEvent, { type: K }> => e.type === type);
}
