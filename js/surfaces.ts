// CC0 relief maps (Poly Haven, 512 px, see CREDITS.md): normal + roughness for paving, asphalt, plaster, roof tiles, stone.
// Colours stay in the palette textures and vertex colours; these maps only add the small-scale relief and the shine.
// The textures start loading when asked for and appear on the material as soon as the file arrives (no async plumbing).
import * as THREE from 'three';

const loader = new THREE.TextureLoader(), cache = new Map<string, THREE.Texture>();
function load(file: string, repeat: [number, number]): THREE.Texture {
  const key = `${file}@${repeat.join('x')}`;
  const hit = cache.get(key); if (hit) return hit;
  const t = loader.load(`assets/textures/${file}.jpg`);
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(repeat[0], repeat[1]); t.anisotropy = 8;
  t.colorSpace = THREE.NoColorSpace;     // data, not colour
  cache.set(key, t); return t;
}
export type SurfaceName = 'asphalt' | 'cobble' | 'plaster' | 'roof' | 'stone';
export const SURFACES: Record<SurfaceName, string> = {
  asphalt: 'asphalt_02', cobble: 'cobblestone_floor_02', plaster: 'white_plaster_rough_01', roof: 'roof_tiles_14', stone: 'sandstone_blocks_08',
};
// Material options { normalMap, normalScale, roughnessMap } for one surface; `repeat` is how often the map tiles over one uv unit of the mesh.
export interface SurfaceMaps { normalMap: THREE.Texture; normalScale: THREE.Vector2; roughnessMap: THREE.Texture }
export function surface(name: SurfaceName, repeat: number | [number, number] = 1, strength = 1): SurfaceMaps {
  const r: [number, number] = Array.isArray(repeat) ? repeat : [repeat, repeat], f = SURFACES[name];
  return { normalMap: load(`${f}_nor_gl`, r), normalScale: new THREE.Vector2(strength, strength), roughnessMap: load(`${f}_rough`, r) };
}
