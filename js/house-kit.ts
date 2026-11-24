// The Blender house kit (assets/levels/kosice/housekit.glb, built by scripts/blender/housekit.py) assembled along OpenStreetMap footprints (S0004 02).
// A module is one bay (3 m of wall, one 3.4 m storey). Every footprint edge gets whole bays, stretched a little in x so they fill the wall; the walls of a house are
// instances, never geometry of their own: one InstancedMesh per module and material class, so draw calls stay in budget however many houses stand.
// Module frame: x along the wall, y up, z out of the wall. Material classes: plaster and accent are tinted per instance, detail has fixed vertex colours,
// glass is the window pane (the instance colour says lit or dark at night).
import * as THREE from 'three';
import { glowMats } from './world.js';
import { surface } from './surfaces.js';
import { hash } from './core/placement.js';
import { addFacadeWall, facadesReady } from './baked-facades.js';
import type { FacadeBuilder } from './baked-facades.js';

export const BAY = 3.0, STOREY = 3.4;
export type Style = 'old' | 'panel' | 'mid' | 'barracks' | 'resi' | 'office';     // the last three: modern kit (scripts/blender/modernkit.py, S0004 13)
type Cls = 'plaster' | 'accent' | 'detail' | 'glass';
const CLASSES: Cls[] = ['plaster', 'accent', 'detail', 'glass'];

// Czechoslovak panel blocks after renovation (as the Terasa and Juzna estates look): wall colour, colour of loggia fillings, stair cores and edge piers
export const PANEL_SCHEMES: [number, number][] = [
  [0xc9c2b0, 0xe0a63a], [0xd8d5cb, 0x8fae5a], [0xe9e2c8, 0xd9743c], [0x9aa3ad, 0xe8d27a], [0xeeeeea, 0x5f8fb5], [0xd7c2a5, 0xb55a4c], [0xcfd3c8, 0xd9b04a],
];

interface Part { geo: THREE.BufferGeometry; cls: Cls }
interface Batch { m: number[]; plaster: number[]; accent: number[]; lit: number[] }

export class HouseKit {
  private parts = new Map<string, Part[]>();
  private batches = new Map<string, Batch>();
  private mats: Record<Cls, THREE.MeshStandardMaterial>;
  private c = new THREE.Color();
  private constructor(root: THREE.Object3D) {
    this.load(root);                                 // every module is a direct child of the scene (a Mesh, or a Group of one Mesh per material class)
    const plaster = (accent: boolean) => new THREE.MeshStandardMaterial({ vertexColors: true, roughness: accent ? 0.88 : 0.93, ...surface('plaster', [0.4, 0.4], 0.5) });
    const glass = new THREE.MeshStandardMaterial({ vertexColors: true, color: 0x56708a, roughness: 0.32, metalness: 0.0, envMapIntensity: 0.7, emissive: 0xffc477, emissiveIntensity: 0 });
    // the instance colour of a pane is its lit state (1 = light on, 0.8 = dark); the glow of the night only reaches the lit ones
    glass.onBeforeCompile = (sh) => { sh.fragmentShader = sh.fragmentShader.replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n totalEmissiveRadiance *= smoothstep(0.88, 0.97, vColor.r);'); };
    this.mats = { plaster: plaster(false), accent: plaster(true), detail: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9 }), glass };
    glowMats.push(glass);
  }
  private load(root: THREE.Object3D): void {
    root.updateMatrixWorld(true);
    for (const node of root.children) {
      const list: Part[] = [];
      node.traverse((o) => {
        const mesh = o as THREE.Mesh;
        if (!mesh.isMesh) return;
        const name = (Array.isArray(mesh.material) ? mesh.material[0] : mesh.material).name;
        const cls = CLASSES.find((c) => name.includes(c));
        if (cls) list.push({ geo: mesh.geometry.clone().applyMatrix4(mesh.matrixWorld), cls });
      });
      if (list.length) this.parts.set(node.name, list);
    }
  }
  /** `modern`: the modern modules (modernkit.glb, S0004 13); without them the modern styles fall back to the in-between kit. */
  static from(root: THREE.Object3D | null | undefined, modern?: THREE.Object3D | null): HouseKit | null {
    if (!root) return null;
    const k = new HouseKit(root);
    if (modern) k.load(modern);
    return k.parts.has('old_bay_a') && k.parts.has('pn_win') && k.parts.has('mid_bay') ? k : null;
  }
  get modern(): boolean { return this.parts.has('bk_bay') && this.parts.has('rs_win') && this.parts.has('of_cw'); }
  get count(): number { let n = 0; for (const b of this.batches.values()) n += b.lit.length; return n; }

  /** One module instance: origin at the left foot of the bay, local +z along the outward normal (rotation `rot` about y), stretched `sx` along the wall. */
  add(mod: string, x: number, y: number, z: number, rot: number, sx: number, plaster: THREE.Color, accent: THREE.Color | null, lit: number): void {
    let b = this.batches.get(mod); if (!b) this.batches.set(mod, b = { m: [], plaster: [], accent: [], lit: [] });
    const c = Math.cos(rot), s = Math.sin(rot);
    b.m.push(c * sx, 0, -s * sx, 0, 0, 1, 0, 0, s, 0, c, 0, x, y, z, 1);
    b.plaster.push(plaster.r, plaster.g, plaster.b);
    const a = accent ?? plaster; b.accent.push(a.r, a.g, a.b); b.lit.push(lit);
  }

  /** The instanced meshes of everything added so far, into `group`. They receive shadows but do not cast any. */
  build(group: THREE.Object3D): void {
    for (const [name, b] of this.batches) {
      const n = b.lit.length; if (!n) continue;
      for (const part of this.parts.get(name) ?? []) {
        const im = new THREE.InstancedMesh(part.geo.clone(), this.mats[part.cls], n);
        (im.instanceMatrix.array as Float32Array).set(b.m);
        if (part.cls === 'plaster' || part.cls === 'accent') {
          const col = new Float32Array(n * 3); col.set(part.cls === 'plaster' ? b.plaster : b.accent);
          im.instanceColor = new THREE.InstancedBufferAttribute(col, 3);
        } else if (part.cls === 'glass') {
          const col = new Float32Array(n * 3); for (let i = 0; i < n; i++) col.fill(b.lit[i], i * 3, i * 3 + 3);
          im.instanceColor = new THREE.InstancedBufferAttribute(col, 3);
        }
        im.castShadow = false; im.receiveShadow = true; im.name = `${name}:${part.cls}`;      // the shadow comes from a plain proxy of the walls (near-ring.ts): 2 triangles per wall instead of a whole bay
        im.frustumCulled = false;                    // the bounding sphere of an InstancedMesh is the whole ring anyway
        group.add(im);
      }
    }
    this.batches.clear();
  }
}

export interface HouseSpec {
  p: number[];                    // footprint ring [x, z, x, z ...]
  sign: number;                   // +1 for counter-clockwise rings (polyArea >= 0)
  style: Style;
  storeys: number;
  h: number;                      // wall height
  pitched: boolean;               // old house with a tiled roof: cornice only, no parapet
  near: boolean;                  // within the detail radius: full modules, else flat `_far` plates
  plaster: THREE.Color;           // wall tint (pastel plaster, panel base colour)
  accent: THREE.Color;            // roof tint (old), loggia / core colour (panel)
  seed: number;                   // hash of the house, for the pattern of bays
  loggia: boolean;                // panel: loggia stacks (true) or projecting balconies (false)
  gate: boolean;                  // old: this house has an arched passage on its longest edge
  far?: FacadeBuilder;            // beyond the detail radius: baked wall quads of the atlas (js/baked-facades.ts) instead of flat `_far` modules, when the atlas is loaded
}
export interface Edge { x0: number; z0: number; x1: number; z1: number }

/** Fill the wall of every footprint edge with modules. Returns the edges that are too short for a bay (the caller draws them as plain wall). */
export function addHouse(kit: HouseKit, s: HouseSpec): Edge[] {
  const { p, sign, storeys, h, near } = s, n = p.length / 2, short: Edge[] = [];
  const style: Style = (s.style === 'barracks' || s.style === 'resi' || s.style === 'office') && !kit.modern ? 'mid' : s.style;
  // longest edge: the arched gate of an old house and the entrance of a panel block go there
  let best = -1, bl = 0;
  for (let i = 0; i < n; i++) { const j = (i + 1) % n, l = Math.hypot(p[2 * j] - p[2 * i], p[2 * j + 1] - p[2 * i + 1]); if (l > bl) { bl = l; best = i; } }
  const bj = (best + 1) % n, ax = bl > 0 ? [(p[2 * bj] - p[2 * best]) / bl, (p[2 * bj + 1] - p[2 * best + 1]) / bl] : [1, 0];
  const lit = (a: number, b: number, c: number) => (hash(a * 1.7 + c, b * 2.3 + s.seed * 50) < 0.42 ? 1 : 0.8);
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n, x0 = p[2 * i], z0 = p[2 * i + 1], x1 = p[2 * j], z1 = p[2 * j + 1], dx = x1 - x0, dz = z1 - z0, l = Math.hypot(dx, dz);
    if (l < 2.3) { if (l > 0.05) short.push({ x0, z0, x1, z1 }); continue; }
    const nx = dz / l * sign, nz = -dx / l * sign;                       // outward normal
    const tx = nz, tz = -nx;                                              // module x axis: local +z = outward normal, so x runs against the edge for ccw rings
    const fwd = tx * dx + tz * dz > 0, ox = fwd ? x0 : x1, oz = fwd ? z0 : z1, rot = Math.atan2(nx, nz);
    const bays = Math.max(1, Math.round(l / BAY)), sx = l / (bays * BAY);
    // overshoot of the projecting cornice / roof edge at a convex corner, so two cornices meet in a mitre instead of leaving a notch
    const k = fwd ? j : i, a = (k + n - 1) % n, b = (k + 1) % n;          // corner at the far end (in x direction): vertex k between edges a->k and k->b
    const e1x = p[2 * k] - p[2 * a], e1z = p[2 * k + 1] - p[2 * a + 1], e2x = p[2 * b] - p[2 * k], e2z = p[2 * b + 1] - p[2 * k + 1];
    const turn = Math.atan2(e1x * e2z - e1z * e2x, e1x * e2x + e1z * e2z) * sign;      // > 0: convex corner
    const ov = turn > 0.09 && turn < 1.75 ? Math.min(0.5, 0.3 * Math.tan(turn / 2)) : 0;
    const eh = hash(x0 + i, z0 - i) , pl = s.plaster, ac = s.accent;
    if (!near && s.far && facadesReady()) {                               // same bays, same pattern as the modules below, drawn as repeating atlas cells
      addFacadeWall({ b: s.far, ox, oz, tx, tz, nx, nz, len: l, y0: 0, h, storeys, style, pitched: s.pitched, loggia: s.loggia, end: Math.abs((dx * ax[0] + dz * ax[1]) / l) < 0.5 && l < 0.7 * bl, eh: eh > 0.5 ? 1 : 0, q0: s.seed * 4 | 0, plaster: pl, accent: ac, seed: s.seed * 50 + i });
      continue;
    }
    const put = (mod: string, bay: number, y: number, stretch = 0) => {
      const u = bay * BAY * sx, last = bay === bays - 1 && stretch > 0;
      kit.add(mod, ox + tx * u, y, oz + tz * u, rot, last ? (BAY * sx + stretch) / BAY : sx, pl, ac, lit(bay, y, i));
    };
    const end = Math.abs((dx * ax[0] + dz * ax[1]) / l) < 0.5 && l < 0.7 * bl, q0 = s.seed * 4 | 0;     // end wall across the long axis; pattern offset (same as addFacadeWall)
    const door = (bay: number) => bays >= 3 && i === best && bay === Math.floor(bays / 2);
    for (let bay = 0; bay < bays; bay++) {
      for (let st = 0; st < storeys; st++) {
        const y = st * STOREY; let mod: string;
        if (style === 'old') {
          if (!near) mod = st === 0 ? 'old_shop_far' : 'old_far';
          else if (st === 0) mod = s.gate && i === best && bays >= 3 && bay === Math.floor(bays / 2) ? 'old_gate' : 'old_shop';
          else if (st === 1) mod = (bay + (eh > 0.5 ? 1 : 0)) % 2 ? 'old_bay_c' : 'old_bay_d';
          else mod = (bay + (eh > 0.5 ? 1 : 0)) % 2 ? 'old_bay_b' : 'old_bay_a';
        } else if (style === 'panel') {
          if (!near) mod = 'pn_far';
          else if (end) mod = 'pn_blank';
          else {
            const q = (bay + q0) % 4;
            if (q === 0) mod = st === 0 ? 'pn_door' : 'pn_core';
            else if (q === 2 && st > 0) mod = s.loggia ? 'pn_loggia' : 'pn_balcony';
            else mod = 'pn_win';
          }
        } else if (style === 'barracks') {                                   // renovated barracks: rusticated base, arched (or plain) windows
          if (!near) mod = st === 0 ? 'bk_ground_far' : 'bk_far';
          else if (st === 0) mod = door(bay) ? 'bk_door' : 'bk_ground';
          else mod = s.loggia ? 'bk_bay' : 'bk_bay_b';
        } else if (style === 'resi') {                                       // new flats: glazed ground floor, balcony every third bay of a long side
          if (!near) mod = st === 0 ? 'rs_ground_far' : 'rs_far';
          else if (st === 0) mod = door(bay) ? 'rs_door' : 'rs_ground';
          else mod = !end && (bay + q0) % 3 === 0 ? 'rs_balcony' : 'rs_win';
        } else if (style === 'office') {                                     // offices: lobby; curtain wall with fins (long sides) and coloured panels (ends), or ribbon glazing
          if (!near) mod = st === 0 ? 'of_lobby_far' : 'of_far';
          else if (st === 0) mod = door(bay) ? 'of_entry' : 'of_lobby';
          else if (!s.loggia) mod = 'of_band';
          else mod = end ? ((bay + q0) % 3 === 0 ? 'of_panel' : 'of_cw') : ((bay + q0) % 2 === 0 ? 'of_fin' : 'of_cw');
        } else {
          if (!near) mod = 'mid_far';
          else if (st === 0) mod = bays >= 3 && i === best && bay === Math.floor(bays / 2) ? 'mid_door' : 'mid_ground';
          else mod = 'mid_bay';
        }
        put(mod, bay, y);
        if (style === 'panel' && near && st === 0) put('pn_foot', bay, y);
      }
      // top: cornice (old, mid) / attic band (panel), with a parapet over flat roofs
      if (!near) continue;                                                 // beyond the detail radius the roof line is part of the flat plate
      if (style === 'old') { put('old_cornice', bay, h - 0.52, ov); if (!s.pitched) put('old_parapet', bay, h, ov); }
      else if (style === 'mid') { put('mid_cornice', bay, h - 0.4, ov); put('mid_parapet', bay, h, ov); }
      else if (style === 'barracks') { put('bk_cornice', bay, h - 0.5, ov); if (!s.pitched) put('old_parapet', bay, h, ov); }
      else if (style === 'resi') put('rs_edge', bay, h, ov);
      else if (style === 'office') put('of_edge', bay, h, ov);
      else put('pn_edge', bay, h, ov);
    }
  }
  return short;
}

/** Roof geometry of a hip roof, for dormers: centre, ridge axis, half length / width, rise, ridge half length. */
export interface RoofInfo { cx: number; cz: number; ax: [number, number]; hu: number; hv: number; rh: number; rl: number; h: number }

/** Dormers on the long slopes of a hip roof: a few per slope, evenly spaced along the ridge, never nearer than 1.2 m to a hip. */
export function addDormers(kit: HouseKit, r: RoofInfo, accent: THREE.Color, plaster: THREE.Color, seed: number): void {
  if (r.hv < 3.4 || r.rh < 2.0 || r.rl < 2.2) return;
  const count = Math.max(1, Math.min(4, Math.floor((r.rl * 2) / 6.5)));
  const perp: [number, number] = [-r.ax[1], r.ax[0]];
  for (const side of [-1, 1]) {
    if (hash(seed * 7.1 + side, r.cx) < 0.18) continue;
    for (let k = 0; k < count; k++) {
      const u = (-(count - 1) / 2 + k) * Math.min(6.5, (r.rl * 2 - 2.4) / Math.max(1, count - 0.2));
      const v = r.hv * 0.56;                                               // distance from the ridge line to the front face of the dormer
      const roofY = r.h + r.rh * (1 - v / r.hv);                           // roof surface under the front face
      const out: [number, number] = [perp[0] * side, perp[1] * side], rot = Math.atan2(out[0], out[1]);
      // module x axis = rot applied to (1,0,0) = (cos, -sin): put the left foot half a dormer (0.65 m) to the left of the centre line
      const cx = r.cx + r.ax[0] * u + out[0] * v, cz = r.cz + r.ax[1] * u + out[1] * v, c = Math.cos(rot), sn = Math.sin(rot);
      kit.add('old_dormer', cx - c * 0.65, roofY - 0.12, cz + sn * 0.65, rot, 1, plaster, accent, hash(u, seed + side) < 0.42 ? 1 : 0.8);
    }
  }
}
