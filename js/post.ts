// Post-processing: ambient occlusion (High), bloom (Medium and High), tone mapping and a per-level colour grade.
// Low renders straight to the screen with no passes, to stay fast on phones.
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { GTAOPass } from 'three/addons/postprocessing/GTAOPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { renderer, scene, camera, atm, maxPixelRatio } from './world.js';
import { settings } from './settings.js';
import type { Grade, QualityId } from './types.js';

// Grade in display space, after tone mapping: lift / gain tint, contrast, saturation, vignette.
export type FullGrade = { lift: number[]; gain: number[]; contrast: number; saturation: number; vignette: number };
export const DEFAULT_GRADE: FullGrade = { lift: [0, 0, 0], gain: [1, 1, 1], contrast: 1.06, saturation: 1.08, vignette: 0.22 };
const GradeShader = {
  uniforms: {
    tDiffuse: { value: null }, lift: { value: new THREE.Vector3() }, gain: { value: new THREE.Vector3(1, 1, 1) },
    contrast: { value: 1 }, saturation: { value: 1 }, vignette: { value: 0 },
  },
  vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
  fragmentShader: `
    uniform sampler2D tDiffuse; uniform vec3 lift; uniform vec3 gain; uniform float contrast; uniform float saturation; uniform float vignette;
    varying vec2 vUv;
    void main(){
      vec4 c = texture2D(tDiffuse, vUv);
      vec3 col = c.rgb * gain + lift * (1.0 - c.rgb);
      col = (col - 0.5) * contrast + 0.5;
      float l = dot(col, vec3(0.2126, 0.7152, 0.0722));
      col = mix(vec3(l), col, saturation);
      vec2 d = vUv - 0.5; col *= 1.0 - vignette * smoothstep(0.25, 0.85, dot(d, d) * 2.2);
      gl_FragColor = vec4(clamp(col, 0.0, 1.0), c.a);
    }`,
};

let composer: EffectComposer | null = null, gtao: GTAOPass | null = null, bloom: UnrealBloomPass | null = null, grade: ShaderPass | null = null, mode: QualityId | null = null;
const size = new THREE.Vector2();

function build(q: QualityId): void {
  composer?.passes.forEach((p) => p.dispose?.()); composer?.dispose(); gtao?.dispose?.();
  composer?.renderTarget1?.dispose?.();
  composer = null; gtao = null; bloom = null; grade = null;
  if (q === 'low') return;
  renderer.getSize(size);
  // MSAA is the costliest part on a big screen: 2 samples on a Retina-class render scale look as clean as 4 at ratio 1
  const target = new THREE.WebGLRenderTarget(size.x, size.y, { type: THREE.HalfFloatType, samples: maxPixelRatio(q) >= 1.25 ? 2 : 4 });
  composer = new EffectComposer(renderer, target);
  composer.setPixelRatio(renderer.getPixelRatio()); composer.setSize(size.x, size.y);
  composer.addPass(new RenderPass(scene, camera));
  if (q === 'high') {
    gtao = new GTAOPass(scene, camera, size.x, size.y);
    gtao.updateGtaoMaterial({ radius: 1.5, distanceExponent: 1.5, thickness: 2, scale: 1.5, samples: 12, distanceFallOff: 1 });   // stronger contact shadows under eaves, trees and benches
    gtao.blendIntensity = 1.0;
    // AO is soft by nature: compute it at half resolution (a quarter of the pixels)
    const gtaoSetSize = gtao.setSize.bind(gtao);
    gtao.setSize = (w, h) => gtaoSetSize(Math.max(1, w >> 1), Math.max(1, h >> 1));
    gtao.setSize(size.x * renderer.getPixelRatio(), size.y * renderer.getPixelRatio());
    // GTAO's normal/depth pass draws sprites and depthWrite:false meshes (dust, rings, glass) as solid squares: hide them there
    const hide = (o: THREE.Object3D & { isSprite?: boolean; material?: THREE.Material | THREE.Material[] }) => o.isSprite || (o.material && !Array.isArray(o.material) && o.material.transparent && o.material.depthWrite === false);
    const baseOverride = gtao.overrideVisibility.bind(gtao);
    gtao.overrideVisibility = function () {
      baseOverride();
      this.scene.traverse((o) => { if (hide(o)) o.visible = false; });
    };
    composer.addPass(gtao);
  }
  bloom = new UnrealBloomPass(new THREE.Vector2(size.x, size.y), 0.55, 0.45, 0.82);
  composer.addPass(bloom);
  composer.addPass(new OutputPass());
  grade = new ShaderPass(GradeShader);
  composer.addPass(grade);
  setGrade(currentGrade);
}

let currentGrade: FullGrade = DEFAULT_GRADE;
export function setGrade(g: Grade): void {
  currentGrade = { ...DEFAULT_GRADE, ...g };
  if (!grade) return;
  const u = grade.uniforms;
  u.lift.value.set(...currentGrade.lift); u.gain.value.set(...currentGrade.gain);
  u.contrast.value = currentGrade.contrast; u.saturation.value = currentGrade.saturation; u.vignette.value = currentGrade.vignette;
}

export function applyPostQuality() { if (mode !== settings.quality) { mode = settings.quality; build(mode); slow = 0; fast = 0; lastT = 0; } }
export function resizePost() { if (!composer) return; renderer.getSize(size); composer.setPixelRatio(renderer.getPixelRatio()); composer.setSize(size.x, size.y); }
// renderer.info counts the whole frame (all passes), not only the last full-screen pass
renderer.info.autoReset = false;
// Each frame: the level's grade, warmed by the sunset glow, and bloom that takes the lit windows up as night comes.
let gradeSrc: Grade | null = null;
function tuneFrame() {
  if (atm.grade !== gradeSrc) { gradeSrc = atm.grade; setGrade(gradeSrc || DEFAULT_GRADE); }
  if (!grade) return;
  const g = currentGrade, d = atm.dusk, u = grade.uniforms;
  u.gain.value.set(g.gain[0] * (1 + 0.06 * d), g.gain[1], g.gain[2] * (1 - 0.05 * d));
  u.saturation.value = g.saturation * (1 + 0.08 * d);
  (bloom as UnrealBloomPass).strength = 0.55 + 0.15 * atm.night; (bloom as UnrealBloomPass).threshold = 0.82 - 0.06 * atm.night;
}
// Dynamic resolution: if frames keep missing 60 fps, step the render scale down (to 1.0 at the lowest); after a long
// stretch of comfortable frames step it back up, waiting longer each time it had to come down again.
let slow = 0, fast = 0, lastT = 0, holdUp = 4;
function tuneResolution() {
  const now = performance.now(), dt = now - lastT; lastT = now;
  if (settings.quality === 'low' || dt > 250 || dt <= 0) { slow = 0; fast = 0; return; }   // tab hidden, loading hitch: ignore
  const pr = renderer.getPixelRatio(), cap = maxPixelRatio();
  if (dt > 21) { slow++; fast = 0; } else if (dt < 12.5) { fast += dt; slow = 0; } else { slow = Math.max(0, slow - 1); }
  let next = pr;
  if (slow >= 8 && pr > 1) { next = Math.max(1, pr - 0.25); holdUp = Math.min(30, holdUp * 2); }
  else if (fast > holdUp * 1000 && pr < cap) next = Math.min(cap, pr + 0.25);
  if (next !== pr) { slow = 0; fast = 0; renderer.setPixelRatio(next); resizePost(); }
}
export function renderFrame() { tuneResolution(); renderer.info.reset(); tuneFrame(); if (composer) composer.render(); else renderer.render(scene, camera); }
export const post = { get passes() { return composer ? composer.passes.map((p) => p.constructor.name) : []; } };
