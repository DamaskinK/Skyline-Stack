// Finished towers of a district (S0002 ticket 04). Every counted plot keeps its tower at the plot's own position in the
// city frame. Seen from the plot being played: inside REAL_M metres the tower is rebuilt from the real floor model
// (foundation, facade blocks, crown); further away it is one instanced box on the far ring.
import * as THREE from 'three';
import { CFG, ENDLESS_COLORS } from './config.js';
import { scene } from './world.js';
import { BUILDING_TYPES } from './building-types.js';
import { makeBlockMesh, makeFoundation, makeCrown } from './entities.js';
import { plotOffset } from './level-scene.js';
import { terrainY } from './far-ring.js';
import { cityById } from './levels.js';
import { plotOf } from './core/district.js';

export const REAL_M = 800;                 // the loaded rings: towers closer than this are built floor by floor
const NEAR_FLAT_M = 300;                   // the near ring is flat; beyond it the ground follows the far-ring terrain
const group = new THREE.Group(); group.name = 'district-towers'; scene.add(group);

function dispose(g) {
  g.traverse((o) => { if (o.isInstancedMesh) { o.geometry.dispose(); o.material.dispose(); o.dispose(); } });
}
export function clearDistrictTowers() { dispose(group); for (const c of [...group.children]) { scene.remove(c); group.remove(c); } }

// A tower built from the real models; `floors` is the best height of that plot.
function realTower(plot, floors, x, y, z, cityName) {
  const g = new THREE.Group(); g.position.set(x, y, z);
  const bt = BUILDING_TYPES[plot.buildingType] || BUILDING_TYPES.panel;
  g.add(makeFoundation(0, 0, plot.buildingType, cityName));
  let top = null;
  for (let i = 0; i < floors; i++) {
    const m = makeBlockMesh(ENDLESS_COLORS[Math.floor(i / 5) % ENDLESS_COLORS.length], false, i % 3, bt.facade);
    m.position.set(0, CFG.FOUND_H + CFG.H * (i + 0.5), 0); g.add(m); top = m;
  }
  if (top) { const crown = makeCrown(plot.buildingType); crown.position.y = CFG.H / 2; top.add(crown); }
  return g;
}

// Show the counted towers of `cityId` seen from `plotId` (the origin of the loaded scene). The plot being played is left out
// unless `withCurrent` (the menu after a result shows it standing on its own site). `plots` = progress map plotId -> { counted, bestHeight }.
// Returns the number of real and instanced towers { real, far }.
export function showDistrictTowers(cityId, plotId, plots, { withCurrent = false } = {}) {
  clearDistrictTowers();
  const city = cityById(cityId), list = city && city.district ? city.district.plots : [];
  const cur = list.find((p) => p.id === plotId), c0 = cur ? plotOffset(cityId, cur) : { x: 0, z: 0 };
  const far = [];
  let real = 0;
  for (const p of list) {
    const st = plotOf(plots, p.id);
    if (!st.counted || st.bestHeight <= 0 || (p.id === plotId && !withCurrent)) continue;
    const o = plotOffset(cityId, p), x = o.x - c0.x, z = o.z - c0.z, d = Math.hypot(x, z);
    const y = d < NEAR_FLAT_M ? 0 : terrainY(o.x, o.z);                 // terrainY works in the city frame
    if (d <= REAL_M) { group.add(realTower(p, st.bestHeight, x, y, z, city.city)); real++; }
    else far.push({ x, y, z, floors: st.bestHeight, type: p.buildingType });
  }
  if (far.length) {
    const geo = new THREE.BoxGeometry(1, 1, 1), mat = new THREE.MeshLambertMaterial({ color: 0xffffff });
    const im = new THREE.InstancedMesh(geo, mat, far.length), m4 = new THREE.Matrix4(), col = new THREE.Color();
    far.forEach((f, i) => {
      const h = CFG.FOUND_H + CFG.H * f.floors, w = CFG.W * 1.15;
      m4.compose(new THREE.Vector3(f.x, f.y + h / 2, f.z), new THREE.Quaternion(), new THREE.Vector3(w, h, w)); im.setMatrixAt(i, m4);
      im.setColorAt(i, col.set(f.type === 'panel' ? 0xd9d4c4 : f.type === 'hotel' ? 0xc9a27a : f.type === 'office' ? 0x8fb4c8 : f.type === 'glass' ? 0x7fa6c0 : 0xd8c9a0));
    });
    im.instanceMatrix.needsUpdate = true; if (im.instanceColor) im.instanceColor.needsUpdate = true;
    im.frustumCulled = false; im.name = 'far-towers'; group.add(im);
  }
  return { real, far: far.length };
}
