// What a level's loaded assets add to the scene: the sky HDRI as image-based light, kit props next to the lobby.
// Everything here is replaced when the level changes.
import * as THREE from 'three';
import { CFG } from './config.js';
import { scene, renderer, setEnvironment, setNearProcedural, GROUND_Y } from './world.js';
import { buildNearRing } from './near-ring.js';
import { buildMiddleFar } from './far-ring.js';
import { landmarkHide, buildLandmarks } from './landmarks/index.js';
import { traffic } from './world.js';
import { People } from './fx.js';

const group = new THREE.Group(); group.name = 'level'; scene.add(group);
export const level = { id: null, env: null };
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

export function applyLevelAssets(id, assets) {
  disposeGroup(group); group.clear();
  level.id = id; level.env = assets.sky || null; People.setCity(id);
  envRT?.dispose(); envRT = null;
  if (assets.sky) {
    pmrem ??= new THREE.PMREMGenerator(renderer);
    envRT = pmrem.fromEquirectangular(assets.sky);
  }
  setEnvironment(envRT ? envRT.texture : null);
  // a level with an OpenStreetMap near ring replaces the procedural city around the tower
  setNearProcedural(!assets.osm);
  if (assets.osm) {
    const near = buildNearRing(assets.osm, assets, landmarkHide(id));
    group.add(near, buildMiddleFar());
    const lm = buildLandmarks(id, assets); if (lm) group.add(lm);
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
