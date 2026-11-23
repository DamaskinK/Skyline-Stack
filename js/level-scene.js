// What a level's loaded assets add to the scene: the sky HDRI as image-based light, kit props next to the lobby.
// Everything here is replaced when the level changes.
import * as THREE from 'three';
import { CFG } from './config.js';
import { scene, renderer, setEnvironment, setNearProcedural, GROUND_Y } from './world.js';
import { buildNearRing } from './near-ring.js';
import { buildMiddleFar } from './far-ring.js';
import { landmarkHide, buildLandmarks, landmarkClear } from './landmarks/index.js';
import { levelById } from './levels.js';
import { traffic } from './world.js';
import { People } from './fx.js';

const group = new THREE.Group(); group.name = 'level'; scene.add(group);
export const level = { id: null, plotId: null, env: null };
let pmrem = null, envRT = null;

function fitWidth(obj, width) {
  const size = new THREE.Box3().setFromObject(obj).getSize(new THREE.Vector3());
  obj.scale.setScalar(width / Math.max(size.x, size.z, 1e-3));
}

// Frees what the old level group holds on the GPU. Cached props (cloned GLTF kit) are simply re-uploaded if used again.
function disposeGroup(g) {
  g.traverse((o) => {
    o.geometry?.dispose();
    for (const m of [].concat(o.material || [])) {
      for (const v of Object.values(m)) if (v && v.isTexture) v.dispose();
      m.dispose();
    }
  });
}

// Where a plot lies in the frame of its city (origin = the city's site, x east, z south), metres.
export function plotOffset(cityId, plot) {
  const c = levelById(cityId)?.site; if (!c || !plot?.site) return { x: 0, z: 0 };
  return { x: (plot.site.lon - c.lon) * 111320 * Math.cos(c.lat * Math.PI / 180), z: -(plot.site.lat - c.lat) * 111320 };
}

// With `plot` ({ id, site }) and `plotOsm` (its extract) the scene is built around that plot: the near ring from the extract (origin = plot site),
// the middle/far ring and the landmarks of the city shifted by the plot's offset so they keep their real bearing and distance.
export function applyLevelAssets(id, assets, plot = null, plotOsm = null) {
  disposeGroup(group); group.clear();
  level.id = id; level.plotId = plot ? plot.id : null; level.env = assets.sky || null; People.setCity(id);
  envRT?.dispose(); envRT = null;
  if (assets.sky) {
    pmrem ??= new THREE.PMREMGenerator(renderer);
    envRT = pmrem.fromEquirectangular(assets.sky);
  }
  setEnvironment(envRT ? envRT.texture : null);
  // a level with an OpenStreetMap near ring replaces the procedural city around the tower
  const osm = plotOsm || assets.osm;
  setNearProcedural(!osm);
  if (osm) {
    const off = plotOsm ? plotOffset(id, plot) : { x: 0, z: 0 };
    const near = buildNearRing(osm, assets, landmarkHide(id));
    group.add(near, buildMiddleFar(plotOsm ? { plot: off, inner: osm.half + 35, clear: landmarkClear(id) } : {}));
    const lm = buildLandmarks(id, assets); if (lm) { lm.position.set(-off.x, 0, -off.z); group.add(lm); }
    traffic.setRoutes(near.userData.carRoutes); People.setRoutes(near.userData.walkRoutes);
  }
  if (assets.bench) {
    for (const s of [-1, 1]) {
      const b = assets.bench.clone(true);
      fitWidth(b, 2.2);
      b.position.set(s * (CFG.W * 0.85 + 2.2), GROUND_Y.walk, CFG.D * 0.65 + 2.6);
      b.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
      group.add(b);
    }
  }
}
