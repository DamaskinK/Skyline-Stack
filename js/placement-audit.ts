// Scene side of the placement audit (ticket S0004 00): reads the placed objects back from the built near ring (instance matrices of the
// trees, hedges, flower beds, street furniture, shopfronts, stalls) and runs the same core audit on them (js/core/placement.ts), then
// compares the counts with the plan the near ring was built from. Used by `check.mjs audit` through __debug.placementAudit().
import * as THREE from 'three';
import { auditPlan, countByCategory, footprint } from './core/placement.js';
import type { Finding, Kind, Placed, Plan } from './core/placement.js';
import { boxHit, ringRing } from './core/geometry2d.js';
import type { Box4 } from './core/geometry2d.js';

const KIND_OF: Record<string, Kind> = {
  'furniture-bin': 'bin', 'furniture-bollard': 'bollard', 'furniture-rack': 'rack', 'furniture-planter': 'planter', 'furniture-kiosk': 'kiosk', 'furniture-stop': 'stop', 'furniture-sign': 'sign',
  'shop-frame': 'shop', 'stall-body': 'stall', 'busker-props': 'busker',
};
// The middle ring (js/far-ring.ts): its footprints against the square of the near ring, the circles round finished towers and landmarks,
// the river, and each other. Findings per category.
export function auditMiddle(mid: THREE.Object3D): Record<string, number> {
  const fp = mid.userData.footprints as { ring: number[]; box: Box4; kind: string }[] | undefined, rules = mid.userData.rules as { near: Box4; clear: number[][]; riverX(z: number): number; riverClear: number } | undefined;
  const out: Record<string, number> = {};
  if (!fp || !rules) return out;
  const bump = (k: string): void => { out[k] = (out[k] || 0) + 1; };
  fp.forEach((a, i) => {
    if (boxHit(a.box, rules.near)) bump('middle-near');
    for (let k = 0; k < a.ring.length; k += 2) if (Math.abs(a.ring[k] - rules.riverX(a.ring[k + 1])) < rules.riverClear) { bump('middle-river'); break; }
    for (const c of rules.clear) if (ringRing(a.ring, c) === 0) { bump('middle-cleared'); break; }
    for (let j = i + 1; j < fp.length; j++) if (boxHit(a.box, fp[j].box) && ringRing(a.ring, fp[j].ring) < 0.5) bump('middle-middle');
  });
  out.count = fp.length;
  return out;
}

export interface SceneAudit { counts: Record<string, number>; findings: Finding[]; byCategory: Record<string, number>; planFindings: Record<string, number>; mismatches: string[] }

export function auditScene(near: THREE.Object3D): SceneAudit {
  const plan = near.userData.plan as Plan | undefined;
  if (!plan) throw new Error('near ring has no plan');
  const placed: Placed[] = [], counts: Record<string, number> = {}, m = new THREE.Matrix4(), q = new THREE.Quaternion(), pos = new THREE.Vector3(), sc = new THREE.Vector3(), e = new THREE.Euler();
  const add = (kind: Kind, x: number, z: number, rot: number, ring?: number[]): void => { placed.push({ kind, x, z, rot, ring: ring || footprint(kind, x, z, rot) }); counts[kind] = (counts[kind] || 0) + 1; };
  near.traverse((o) => {
    const im = o as THREE.InstancedMesh;
    if (!im.isInstancedMesh) return;
    const tag = (im.userData.placed as string | undefined) || KIND_OF[im.name];
    if (!tag) return;
    for (let i = 0; i < im.count; i++) {
      im.getMatrixAt(i, m); m.decompose(pos, q, sc); e.setFromQuaternion(q, 'YXZ');
      if (tag === 'bed') add('bed', pos.x, pos.z, e.y, boxOf(pos.x, pos.z, sc.x / 2, sc.z / 2, e.y));
      else add(tag as Kind, pos.x, pos.z, e.y);
    }
  });
  const findings = auditPlan({ ...plan, placed }), mismatches: string[] = [];
  const planned: Record<string, number> = { tree: plan.trees.length, hedge: plan.hedges.length, bed: plan.beds.length };
  for (const k of Object.keys(plan.items)) planned[k] = plan.items[k].length;
  planned.stall = plan.stalls.length; planned.busker = plan.musicians.length; planned.shop = plan.shops.length;
  // shops, stalls and musicians are shown by the number of finished plots (up to the plan's number); everything else stands as planned
  const byProgress = new Set(['shop', 'stall', 'busker']);
  for (const [k, n] of Object.entries(planned)) { const c = counts[k] || 0; if (byProgress.has(k) ? c > n : c !== n) mismatches.push(`${k}: scene ${c}, plan ${n}`); }
  return { counts, findings, byCategory: countByCategory(findings), planFindings: countByCategory(auditPlan(plan)), mismatches };
}
const boxOf = (x: number, z: number, hx: number, hz: number, rot: number): number[] => {
  const c = Math.cos(rot), s = Math.sin(rot), out: number[] = [];
  for (const [u, v] of [[-hx, -hz], [hx, -hz], [hx, hz], [-hx, hz]]) out.push(x + u * c + v * s, z - u * s + v * c);
  return out;
};
