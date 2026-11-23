// Finished towers of a district (S0002 ticket 04). Every counted plot keeps its tower at the plot's own position in the
// city frame. Seen from the plot being played: inside REAL_M metres the tower is rebuilt from the real floor model
// (foundation, facade blocks, crown); further away it is one instanced box on the far ring.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { CFG, ENDLESS_COLORS } from './config.js';
import { scene } from './world.js';
import { BUILDING_TYPES } from './building-types.js';
import { makeBlockMesh, makeFoundation, makeCrown } from './entities.js';
import { plotOffset } from './level-scene.js';
import { terrainY } from './far-ring.js';
import { cityById } from './levels.js';
import { plotOf } from './core/district.js';
import { People } from './fx.js';
import { glowMats } from './world.js';
import type { BuildingTypeId, Plot, PlotStates } from './types.js';

export const REAL_M = 800;                 // the loaded rings: towers closer than this are built floor by floor
const NEAR_FLAT_M = 300;                   // the near ring is flat; beyond it the ground follows the far-ring terrain
const FAR_COLOR: Record<string, number> = { panel: 0xd9d4c4, hotel: 0xc9a27a, office: 0x8fb4c8, glass: 0x7fa6c0, deco: 0xd8c9a0 };
const farGlow = new THREE.MeshStandardMaterial({ color: 0xffe7b0, emissive: 0xffc468, emissiveIntensity: 0.5, roughness: 0.6, fog: false });   // no fog: the haze would swallow a tower at 1-2 km
glowMats.push(farGlow);                    // lit top: world.js brightens it as night falls (it stays a little warm by day)
const HAZE = new THREE.Color(0x9fb4c4);
const group = new THREE.Group(); group.name = 'district-towers'; scene.add(group);

function dispose(g: THREE.Object3D): void {
  g.traverse((o) => {
    if ((o as THREE.InstancedMesh).isInstancedMesh) { const im = o as THREE.InstancedMesh; im.geometry.dispose(); (im.material as THREE.Material).dispose(); im.dispose(); }
    else if ((o as THREE.Mesh).isMesh) (o as THREE.Mesh).geometry.dispose();                        // a real tower owns its merged geometry; its materials are shared
  });
}
export function clearDistrictTowers(): void { dispose(group); for (const c of [...group.children]) { scene.remove(c); group.remove(c); } }

// Merges every mesh below `src` into one mesh per material (the tower is static): a 30-floor tower is a handful of draw calls instead of
// hundreds. Multi-material meshes (the foundation box) are split by their groups. Positions are baked relative to `src`.
function mergeByMaterial(src: THREE.Object3D): THREE.Group {
  src.updateMatrixWorld(true);
  const inv = new THREE.Matrix4().copy(src.matrixWorld).invert(), buckets = new Map<string, { mat: THREE.Material; cast: boolean; recv: boolean; geos: THREE.BufferGeometry[] }>(), out = new THREE.Group();
  src.traverse((o) => {
    const mh = o as THREE.Mesh;
    if (!mh.isMesh || !o.visible) return;
    const rel = new THREE.Matrix4().multiplyMatrices(inv, o.matrixWorld), geo = mh.geometry;
    type Range = { start: number; count: number };
    const parts: [THREE.Material, Range][] = Array.isArray(mh.material) ? geo.groups.map((g) => [(mh.material as THREE.Material[])[g.materialIndex as number], g]) : [[mh.material, { start: 0, count: geo.index ? geo.index.count : Infinity }]];
    for (const [mat, g] of parts) {
      const sub = new THREE.BufferGeometry(); for (const k of ['position', 'normal', 'uv', 'color']) if (geo.attributes[k]) sub.setAttribute(k, geo.attributes[k]);
      if (geo.index) sub.setIndex(Array.from(geo.index.array.slice(g.start, g.start + g.count)));
      if (!sub.attributes.uv) sub.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(sub.attributes.position.count * 2), 2));
      const flat = sub.index ? sub.toNonIndexed() : sub;                         // one layout for all (boxes are indexed, icospheres are not)
      flat.applyMatrix4(rel);
      const key = mat.uuid + (o.castShadow ? 'c' : '') + (o.receiveShadow ? 'r' : '');
      if (!buckets.has(key)) buckets.set(key, { mat, cast: o.castShadow, recv: o.receiveShadow, geos: [] });
      (buckets.get(key) as { geos: THREE.BufferGeometry[] }).geos.push(flat);
    }
  });
  for (const { mat, cast, recv, geos } of buckets.values()) {
    const m = new THREE.Mesh(mergeGeometries(geos) as THREE.BufferGeometry, mat); m.castShadow = cast; m.receiveShadow = recv; out.add(m);
  }
  return out;
}

// A tower built from the real models; `floors` is the best height of that plot.
function realTower(plot: Plot, floors: number, x: number, y: number, z: number, cityName: string): THREE.Group {
  const g = new THREE.Group();
  const bt = BUILDING_TYPES[plot.buildingType] || BUILDING_TYPES.panel;
  g.add(makeFoundation(0, 0, plot.buildingType, cityName));
  let top: THREE.Object3D | null = null;
  for (let i = 0; i < floors; i++) {
    const m = makeBlockMesh(ENDLESS_COLORS[Math.floor(i / 5) % ENDLESS_COLORS.length], false, i % 3, bt.facade);
    m.position.set(0, CFG.FOUND_H + CFG.H * (i + 0.5), 0); g.add(m); top = m;
  }
  if (top) { const crown = makeCrown(plot.buildingType); crown.position.y = CFG.H / 2; top.add(crown); }
  const merged = mergeByMaterial(g); merged.position.set(x, y, z);
  return merged;
}

// Far finished towers (beyond REAL_M): the real height as a readable silhouette. The shaft widens with distance so it still reads
// at 1-2 km, a lit crown (two floors, glowing at night) and a thin mast with a beacon on top.
interface FarTower { x: number; y: number; z: number; floors: number; type: BuildingTypeId }
function addFarTowers(far: FarTower[]): void {
  const m4 = new THREE.Matrix4(), col = new THREE.Color(), q = new THREE.Quaternion(), V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
  const body = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshLambertMaterial({ color: 0xffffff, emissive: 0x58606a, fog: false }), far.length);
  const crown = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), farGlow, far.length);
  const mast = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), farGlow, far.length);
  far.forEach((f, i) => {
    const h = CFG.FOUND_H + CFG.H * f.floors, w = CFG.W * 1.15 + Math.hypot(f.x, f.z) * 0.009, ch = CFG.H * 3.5;
    m4.compose(V(f.x, f.y + (h - ch) / 2, f.z), q, V(w, h - ch, w)); body.setMatrixAt(i, m4);
    body.setColorAt(i, col.set(FAR_COLOR[f.type] || 0xd8c9a0).lerp(HAZE, 0.3));
    m4.compose(V(f.x, f.y + h - ch / 2, f.z), q, V(w * 1.08, ch, w * 1.08)); crown.setMatrixAt(i, m4);
    const mh = Math.max(8, w * 2.2); m4.compose(V(f.x, f.y + h + mh / 2, f.z), q, V(w * 0.12, mh, w * 0.12)); mast.setMatrixAt(i, m4);
  });
  for (const im of [body, crown, mast]) { im.instanceMatrix.needsUpdate = true; im.frustumCulled = false; im.castShadow = false; }
  if (body.instanceColor) body.instanceColor.needsUpdate = true;
  body.name = 'far-towers'; crown.name = 'far-towers-lit'; mast.name = 'far-towers-mast';
  group.add(body, crown, mast);
}

// Show the counted towers of `cityId` seen from `plotId` (the origin of the loaded scene). The plot being played is left out
// unless `withCurrent` (the menu after a result shows it standing on its own site). `plots` = progress map plotId -> { counted, bestHeight }.
// Returns the number of real and instanced towers { real, far }.
export function showDistrictTowers(cityId: string, plotId: string | null, plots: PlotStates, { withCurrent = false } = {}): { real: number; far: number } {
  clearDistrictTowers();
  const city = cityById(cityId), list = city && city.district ? city.district.plots : [];
  const cur = list.find((p) => p.id === plotId), c0 = cur ? plotOffset(cityId, cur) : { x: 0, z: 0 };
  const far: FarTower[] = [];
  let real = 0;
  for (const p of list) {
    const st = plotOf(plots, p.id);
    if (!st.counted || st.bestHeight <= 0 || (p.id === plotId && !withCurrent)) continue;
    const o = plotOffset(cityId, p), x = o.x - c0.x, z = o.z - c0.z, d = Math.hypot(x, z);
    const y = d < NEAR_FLAT_M ? 0 : terrainY(o.x, o.z);                 // terrainY works in the city frame
    if (d <= REAL_M) { group.add(realTower(p, st.bestHeight, x, y, z, (city as { city: string }).city)); real++; }
    else far.push({ x, y, z, floors: st.bestHeight, type: p.buildingType });
  }
  if (far.length) addFarTowers(far);
  // the district comes alive with its finished plots (ticket 06): people, traffic, shops, stalls, musicians
  People.setDistrictLife(list.filter((p) => plotOf(plots, p.id).counted).length);
  return { real, far: far.length };
}
