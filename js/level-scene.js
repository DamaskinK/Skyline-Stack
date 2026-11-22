// What a level's loaded assets add to the scene. For now: kit props next to the lobby, and the sky HDRI kept
// for image-based lighting (used by the post-processing ticket). Everything here is removed when the level changes.
import * as THREE from 'three';
import { CFG } from './config.js';
import { scene } from './world.js';

const group = new THREE.Group(); group.name = 'level'; scene.add(group);
export const level = { id: null, env: null };

function fitWidth(obj, width) {
  const size = new THREE.Box3().setFromObject(obj).getSize(new THREE.Vector3());
  obj.scale.setScalar(width / Math.max(size.x, size.z, 1e-3));
}

export function applyLevelAssets(id, assets) {
  group.clear();
  level.id = id; level.env = assets.sky || null;
  if (assets.bench) {
    for (const s of [-1, 1]) {
      const b = assets.bench.clone(true);
      fitWidth(b, 2.2);
      b.position.set(s * (CFG.W * 0.85 + 2.2), 0.25, CFG.D * 0.65 + 2.6);
      b.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
      group.add(b);
    }
  }
}
