// Baked far facades (S0004 07): the near modules of the Blender house kit (scripts/blender/housebake.py) rendered into an atlas of colour, normal + occlusion and masks.
// Houses beyond the detail radius of the kit (js/house-kit.ts) and the whole middle ring (js/far-ring.ts) are plain wall quads that repeat a cell of the atlas along the wall:
// the same bays, in the same order and stretched the same way as the near modules, so nothing jumps at the switch. One material, one mesh per ring.
// Cells: _col sRGB colour; _nrm R,G tangent-space normal, B occlusion; _msk R plaster, G accent, B glass (plaster and accent are tinted per house, glass lights up at night).
import * as THREE from 'three';
import { glowMats } from './world.js';
import type { LevelAssets } from './types.js';

export interface Cell { rect: [number, number, number, number]; bays: number; h: number }
interface Meta { size: [number, number]; bay: number; storey: number; cells: Record<string, Cell> }
export const BAY = 3, STOREY = 3.4;
export type FacadeStyle = 'old' | 'panel' | 'mid';

let meta: Meta | null = null, material: THREE.MeshStandardMaterial | null = null;
/** The atlas of the level that is being built, or null when its files are missing (the callers then keep the old flat plates / canvas facades). */
export const facadesReady = (): boolean => !!meta && !!material;

export function initFacades(assets: LevelAssets): void {
  const col = assets.housefacade_col as THREE.Texture | undefined, nrm = assets.housefacade_nrm as THREE.Texture | undefined, msk = assets.housefacade_msk as THREE.Texture | undefined;
  const m = assets.housefacade as Meta | undefined;
  if (!col || !nrm || !msk || !m?.cells) { meta = null; return; }
  for (const t of [nrm, msk]) { t.colorSpace = THREE.NoColorSpace; t.needsUpdate = true; }
  for (const t of [col, nrm, msk]) { t.anisotropy = 8; t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping; }
  meta = m;
  if (!material) material = makeMaterial(col, nrm, msk); else { const u = (material.userData.u as Record<string, { value: THREE.Texture }>); u.tCol.value = col; u.tNrm.value = nrm; u.tMsk.value = msk; }
  material.normalMap = nrm; material.aoMap = nrm;       // only so that the shader chunks are compiled in; the samples are replaced below
}

function makeMaterial(col: THREE.Texture, nrm: THREE.Texture, msk: THREE.Texture): THREE.MeshStandardMaterial {
  const mat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.92, normalMap: nrm, aoMap: nrm, aoMapIntensity: 1.1, emissive: 0xffc477, emissiveIntensity: 0 });
  const u = { tCol: { value: col }, tNrm: { value: nrm }, tMsk: { value: msk } };
  mat.userData.u = u;
  mat.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, u);
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nattribute vec4 aCell; attribute vec3 aPer; attribute vec3 aPlaster; attribute vec3 aAccent;\nvarying vec4 vCell; varying vec3 vPer; varying vec3 vPl; varying vec3 vAc; varying vec2 vLoc;')
      .replace('#include <uv_vertex>', '#include <uv_vertex>\nvCell = aCell; vPer = aPer; vPl = aPlaster; vAc = aAccent; vLoc = uv;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform sampler2D tCol; uniform sampler2D tNrm; uniform sampler2D tMsk;\nvarying vec4 vCell; varying vec3 vPer; varying vec3 vPl; varying vec3 vAc; varying vec2 vLoc;')
      .replace('#include <map_fragment>', `
        vec2 facLp = vLoc / vPer.xy; vec2 facA = vCell.xy + fract(facLp) * vCell.zw;
        vec2 facGx = dFdx(facLp) * vCell.zw, facGy = dFdy(facLp) * vCell.zw;
        vec3 facC = textureGrad(tCol, facA, facGx, facGy).rgb, facNr = textureGrad(tNrm, facA, facGx, facGy).rgb, facM = textureGrad(tMsk, facA, facGx, facGy).rgb;
        vec3 facN = vec3(facNr.xy * 2.0 - 1.0, 0.0); facN.z = sqrt(max(0.05, 1.0 - dot(facN.xy, facN.xy)));
        float facAo = facNr.z;
        diffuseColor.rgb *= facC * (vec3(1.0) + facM.r * (vPl - 1.0) + facM.g * (vAc - 1.0));
        vec2 facBay = floor(vec2(vLoc.x / 3.0, vLoc.y / 3.4) + 0.001);
        float facLit = step(fract(sin(dot(facBay + vPer.z, vec2(12.9898, 78.233))) * 43758.5453), 0.42);`)
      .replace('#include <normal_fragment_maps>', THREE.ShaderChunk.normal_fragment_maps.replace('texture2D( normalMap, vNormalMapUv ).xyz * 2.0 - 1.0', 'facN'))    // the includes are not expanded yet: put the chunk text in
      .replace('#include <aomap_fragment>', THREE.ShaderChunk.aomap_fragment.replace('texture2D( aoMap, vAoMapUv ).r', 'facAo'))
      .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\ntotalEmissiveRadiance *= facM.b * facLit;')
      .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nroughnessFactor = mix(roughnessFactor, 0.3, facM.b);');
  };
  mat.customProgramCacheKey = () => 'baked-facade';
  glowMats.push(mat);
  return mat;
}

/** Wall quads of every far facade of one ring, merged into one mesh. */
export class FacadeBuilder {
  private pos: number[] = []; private nor: number[] = []; private uv: number[] = []; private cell: number[] = []; private per: number[] = [];
  private pl: number[] = []; private ac: number[] = [];
  get empty(): boolean { return this.pos.length === 0; }

  /**
   * One quad: from the point (ox, oz) along the unit vector (tx, tz) for `len` metres, from y0 to y1, facing the outward normal (nx, nz).
   * `bays` whole bays fill the length (stretched like the modules); `phase` shifts the pattern by that many bays; the cell repeats along the wall and up.
   */
  quad(ox: number, oz: number, tx: number, tz: number, nx: number, nz: number, len: number, y0: number, y1: number, cellName: string, bays: number, phase: number,
    plaster: THREE.Color, accent: THREE.Color, seed: number): void {
    const c = meta?.cells[cellName]; if (!c || y1 - y0 < 0.01 || len < 0.05) return;
    const u1 = bays * BAY, v1 = y1 - y0, ux = phase * BAY;
    const P = (u: number, y: number): [number, number, number] => [ox + tx * (u / u1) * len, y, oz + tz * (u / u1) * len];
    const A = P(0, y0), B = P(u1, y0), C = P(u1, y1), D = P(0, y1);
    for (const [p, u, v] of [[A, 0, 0], [B, u1, 0], [C, u1, v1], [A, 0, 0], [C, u1, v1], [D, 0, v1]] as [[number, number, number], number, number][]) {
      this.pos.push(p[0], p[1], p[2]); this.nor.push(nx, 0, nz); this.uv.push(u + ux, v);
      this.cell.push(c.rect[0], c.rect[1], c.rect[2], c.rect[3]); this.per.push(c.bays * BAY, c.h, seed + y0 * 0.37);
      this.pl.push(plaster.r, plaster.g, plaster.b); this.ac.push(accent.r, accent.g, accent.b);
    }
  }
  mesh(group: THREE.Object3D, receive = true, name = 'far-facades'): THREE.Mesh | null {
    if (this.empty || !material) return null;
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(this.nor, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(this.uv, 2)); g.setAttribute('aCell', new THREE.Float32BufferAttribute(this.cell, 4));
    g.setAttribute('aPer', new THREE.Float32BufferAttribute(this.per, 3)); g.setAttribute('aPlaster', new THREE.Float32BufferAttribute(this.pl, 3)); g.setAttribute('aAccent', new THREE.Float32BufferAttribute(this.ac, 3));
    const m = new THREE.Mesh(g, material); m.receiveShadow = receive; m.castShadow = false; m.name = name; group.add(m); return m;
  }
}

/**
 * Walls of one footprint edge as baked quads, with the same module choice as `addHouse` (js/house-kit.ts).
 * (ox, oz) is the start in module direction (tx, tz), (nx, nz) the outward normal; `eh` flips the old-house storey pattern, `q0` is the panel pattern offset.
 */
export interface FacadeWall {
  b: FacadeBuilder; ox: number; oz: number; tx: number; tz: number; nx: number; nz: number; len: number; y0: number; h: number; storeys: number;
  style: FacadeStyle; pitched: boolean; loggia: boolean; end: boolean; eh: number; q0: number; plaster: THREE.Color; accent: THREE.Color; seed: number; foundation?: number; lean?: boolean;
}
export function addFacadeWall(w: FacadeWall): void {
  const bays = Math.max(1, Math.round(w.len / BAY)), { b } = w;
  const q = (y0: number, y1: number, cell: string, phase = 0) => b.quad(w.ox, w.oz, w.tx, w.tz, w.nx, w.nz, w.len, y0, y1, cell, bays, phase, w.plaster, w.accent, w.seed);
  const top = w.y0 + w.h, base = w.y0 + (w.foundation ?? 0);                  // `foundation`: wall that reaches below the ground storey (middle ring)
  const cap = w.lean ? 0 : w.style === 'old' ? 0.52 : w.style === 'mid' ? 0.4 : 0;           // cornice inside the top storey; the panel edge and the parapets stand on top
  if (w.foundation) q(w.y0, base, w.style === 'panel' ? 'pn_blank' : w.style === 'old' ? 'old_upper' : 'mid_upper');
  const ground = w.style === 'old' ? 'old_ground' : w.style === 'mid' ? 'mid_ground' : w.end ? 'pn_blank' : 'pn_ground';
  const ph4 = (w.q0 % 4) / 4, ph2 = (w.eh % 2) / 2;
  q(base, base + STOREY, ground, w.style === 'panel' && !w.end ? ph4 : 0);
  if (w.storeys > 1) {
    const upTop = top - cap;
    if (w.style === 'old') {
      q(base + STOREY, Math.min(upTop, base + 2 * STOREY), 'old_first', ph2);
      if (w.storeys > 2) q(base + 2 * STOREY, upTop, 'old_upper', ph2);
    } else if (w.style === 'mid') q(base + STOREY, upTop, 'mid_upper');
    else q(base + STOREY, upTop, w.end ? 'pn_blank' : w.loggia ? 'pn_loggia' : 'pn_balcony', w.end ? 0 : ph4);
  }
  if (w.lean) return;                                                           // the middle ring leaves out the cornices and parapets: they are a few pixels there
  if (w.style === 'old') { q(top - cap, top, 'old_cornice'); if (!w.pitched) q(top, top + 0.5, 'old_parapet'); }
  else if (w.style === 'mid') { q(top - cap, top, 'mid_cornice'); q(top, top + 0.56, 'mid_parapet'); }
  else q(top, top + 0.82, 'pn_edge');
}
