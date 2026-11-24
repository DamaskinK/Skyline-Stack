// What a level's loaded assets add to the scene: the sky HDRI as image-based light, kit props next to the lobby.
// Everything here is replaced when the level changes.
import * as THREE from 'three';
import { CFG } from './config.js';
import { scene, renderer, setEnvironment, setNearProcedural, setProcOffset, GROUND_Y } from './world.js';
import { buildNearRing } from './near-ring.js';
import { buildMiddleFar } from './far-ring.js';
import { initFacades } from './baked-facades.js';
import { landmarkHide, buildLandmarks, landmarkClear } from './landmarks/index.js';
import { cityById } from './levels.js';
import { towerCircles } from './core/placement.js';
import { traffic } from './world.js';
import { People } from './fx.js';
import { Trams } from './trams.js';
import type { LevelAssets, OsmExtract, Plot, Pt2, Site } from './types.js';

const group = new THREE.Group(); group.name = 'level'; scene.add(group);
export const level: { id: string | null; plotId: string | null; env: THREE.Texture | null } = { id: null, plotId: null, env: null };
let lmRoot: THREE.Object3D | null = null;
let pmrem: THREE.PMREMGenerator | null = null, envRT: THREE.WebGLRenderTarget | null = null;

function fitWidth(obj: THREE.Object3D, width: number): void {
  const size = new THREE.Box3().setFromObject(obj).getSize(new THREE.Vector3());
  obj.scale.setScalar(width / Math.max(size.x, size.z, 1e-3));
}

// Frees what the old level group holds on the GPU. Cached props (cloned GLTF kit) are simply re-uploaded if used again.
function disposeGroup(g: THREE.Object3D): void {
  g.traverse((o) => {
    const mesh = o as THREE.Mesh;
    mesh.geometry?.dispose();
    if ((o as THREE.InstancedMesh).isInstancedMesh) (o as THREE.InstancedMesh).dispose();
    const mats = mesh.material ? (Array.isArray(mesh.material) ? mesh.material : [mesh.material]) : [];
    for (const m of mats) {
      for (const v of Object.values(m)) if (v && (v as THREE.Texture).isTexture) (v as THREE.Texture).dispose();
      m.dispose();
    }
  });
}

// Where a plot lies in the frame of its city (origin = the city's site, x east, z south), metres. Newtown sites are already {x, z}.
export function plotOffset(cityId: string, plot: Pick<Plot, 'site'>): Pt2 {
  const c: Site | undefined = cityById(cityId)?.site; if (!c || !plot?.site) return { x: 0, z: 0 };
  if ('x' in plot.site) { const o = 'x' in c ? c : { x: 0, z: 0 }; return { x: plot.site.x - (o.x || 0), z: plot.site.z - (o.z || 0) }; }
  if (!('lat' in c)) return { x: 0, z: 0 };
  return { x: (plot.site.lon - c.lon) * 111320 * Math.cos(c.lat * Math.PI / 180), z: -(plot.site.lat - c.lat) * 111320 };
}

// With `plot` ({ id, site }) and `plotOsm` (its extract) the scene is built around that plot: the near ring from the extract (origin = plot site),
// the middle/far ring and the landmarks of the city shifted by the plot's offset so they keep their real bearing and distance.
// Street routes of the procedural grid (roads along x = +-44 and z = +-44) in the frame of a shifted city, so people walk on its pavements.
function procRoutes(ox: number, oz: number): { p: number[]; off: number }[] {
  const L = 300, R = 44, off = 6, out: { p: number[]; off: number }[] = [];
  for (const s of [-1, 1]) { out.push({ p: [ox - L, oz + s * R, ox + L, oz + s * R], off }); out.push({ p: [ox + s * R, oz - L, ox + s * R, oz + L], off }); }
  return out;
}

export function applyLevelAssets(id: string, assets: LevelAssets, plot: Plot | null = null, plotOsm: OsmExtract | null = null): void {
  disposeGroup(group); group.clear(); lmRoot = null;
  initFacades(assets);
  level.id = id; level.plotId = plot ? plot.id : null; level.env = assets.sky ?? null; People.setCity(id);
  envRT?.dispose(); envRT = null;
  if (assets.sky) {
    pmrem ??= new THREE.PMREMGenerator(renderer);
    envRT = pmrem.fromEquirectangular(assets.sky);
  }
  setEnvironment(envRT ? envRT.texture : null);
  // a level with an OpenStreetMap near ring replaces the procedural city around the tower
  const osm = plotOsm || assets.osm;
  setNearProcedural(!osm);
  if (!osm) { traffic.setLights(null); Trams.use(null); People.setParked(null); }
  if (osm) {
    const off = plot && plotOsm ? plotOffset(id, plot) : { x: 0, z: 0 };
    // the finished towers of the other plots that stand inside this extract keep their site free (js/core/placement.ts)
    const city = cityById(id), towers = plot && plotOsm && city?.district ? towerCircles(city.site, city.district.plots, plot.id, osm.half) : [];
    const near = buildNearRing(osm, assets, landmarkHide(id), towers);
    group.add(near, buildMiddleFar(plotOsm ? { plot: off, inner: osm.half + 35, clear: landmarkClear(id) } : {}));
    const lm = buildLandmarks(id, assets); if (lm) { lm.position.set(-off.x, 0, -off.z); group.add(lm); lmRoot = lm; }
    traffic.setLights(near.userData.streetLights || null); traffic.setRoutes(near.userData.carRoutes); People.setRoutes(near.userData.walkRoutes);
    Trams.use(near.userData.tram); People.setParked(near.userData.parked);
  }
  // Newtown: the procedural city is the scene; the whole city moves so the plot's site sits at the world origin
  if (!osm) {
    const off = plot ? plotOffset(id, plot) : { x: 0, z: 0 };
    setProcOffset(-off.x, -off.z);
    const lm = buildLandmarks(id, assets); if (lm) { lm.position.set(-off.x, 0, -off.z); group.add(lm); lmRoot = lm; }
    People.setRoutes(procRoutes(-off.x, -off.z));
  } else setProcOffset(0, 0);
  if (assets.bench) {
    for (const s of [-1, 1]) {
      const b = assets.bench.clone(true);
      fitWidth(b, 2.2);
      b.position.set(s * (CFG.W * 0.85 + 2.2), GROUND_Y.walk, CFG.D * 0.65 + 2.6);
      b.traverse((o) => { if ((o as THREE.Mesh).isMesh) { o.castShadow = true; o.receiveShadow = true; } });
      group.add(b);
    }
  }
}

// Where the landmarks of the loaded scene stand in world metres (origin = the plot's site), for the camera pass of the city intro.
// `ids` are the plot's landmarksInView; a landmark group matches when its name is the id or ends with it. Streets (no model) match nothing.
export function landmarkSpots(ids: string[]): Pt2[] {
  if (!lmRoot) return [];
  const out: Pt2[] = [];
  for (const c of lmRoot.children) if (ids.some((id) => c.name === id || c.name.endsWith('-' + id))) out.push({ x: lmRoot.position.x + c.position.x, z: lmRoot.position.z + c.position.z });
  return out;
}
