// A low-poly pedestrian: head with hair or head covering, torso, swinging arms and legs, hands, shoes.
// One merged, vertex-coloured mesh per person (one draw call, 200-400 triangles). Arms and legs swing in the vertex
// shader: every vertex carries a limb id, so a person costs no extra draw calls and no skeleton.
import * as THREE from 'three';
import type { Outfit } from './styles.js';

type Rnd = () => number;
type Col = number | number[];

const pick = <T>(list: T[], rnd: Rnd): T => list[Math.floor(rnd() * list.length)];
const col = (v: Col, rnd: Rnd): number => (Array.isArray(v) ? pick(v, rnd) : v);
const box = (w: number, h: number, d: number, x: number, y: number, z: number) => new THREE.BoxGeometry(w, h, d).translate(x, y, z);

const HIP = 0.58, SHOULDER = 1.0;
// limb ids: 0 body, 1 left arm, 2 right arm, 3 left leg, 4 right leg

export function buildFigure(o: Outfit, skin: number, rnd: Rnd = Math.random): THREE.BufferGeometry {
  const parts: [THREE.BufferGeometry, number, number][] = [];
  const add = (g: THREE.BufferGeometry, c: number, limb = 0) => parts.push([g, c, limb]);
  const top = col(o.top, rnd), bottom = col(o.bottom ?? 0x23252b, rnd), shoes = col(o.shoes ?? 0x2a2a2a, rnd);
  const hair = col(o.hair ?? 0x2b1d14, rnd);
  const garment = o.garment || 'trousers', coat = o.coat || 'none', coatC = coat !== 'none' ? col(o.coatCol ?? top, rnd) : top;
  const outer = coat !== 'none' ? coatC : top;                         // what the arms and torso show
  const longSleeves = (o.sleeves || 'long') === 'long' || coat !== 'none';
  const ampScale = garment === 'robe' ? 0.2 : coat === 'long' ? 0.45 : garment === 'skirt' ? 0.7 : 1;

  // legs and shoes (o.sit: thighs forward, shins down, no swing)
  for (const [sx, limb] of [[-1, 3], [1, 4]]) {
    if (o.ride) continue;                                                // a cyclist's legs are separate pedalling meshes (js/fx.ts)
    if (o.sit && garment !== 'robe') {
      const legC = garment === 'skirt' ? col(o.tights ?? skin, rnd) : bottom;
      add(box(0.11, 0.11, 0.42, sx * 0.075, 0.53, 0.2), legC, 0); add(box(0.1, 0.5, 0.1, sx * 0.075, 0.28, 0.4), legC, 0); add(box(0.12, 0.07, 0.19, sx * 0.075, 0.035, 0.44), shoes, 0);
      continue;
    }
    if (garment === 'robe') add(box(0.12, 0.07, 0.19, sx * 0.07, 0.035, 0.03), shoes, 0);
    else {
      const legC = garment === 'skirt' ? col(o.tights ?? skin, rnd) : bottom;
      add(box(0.11, 0.5, 0.11, sx * 0.075, 0.33, 0), legC, limb);
      add(box(0.12, 0.07, 0.19, sx * 0.075, 0.035, 0.03), shoes, limb);
    }
  }
  if (garment === 'skirt') add(new THREE.CylinderGeometry(0.17, 0.22, 0.3, 8).translate(0, 0.58, 0), bottom);
  if (garment === 'robe') add(new THREE.CylinderGeometry(0.17, 0.23, 0.95, 8).translate(0, 0.55, 0), col(o.robe ?? top, rnd));

  // torso, coat, vest
  add(box(0.3, 0.44, 0.17, 0, 0.79, 0), garment === 'robe' ? col(o.robe ?? top, rnd) : top);
  if (coat !== 'none') {
    const bottomY = coat === 'long' ? 0.32 : 0.5, h = 1.02 - bottomY;
    add(box(0.33, h, 0.2, 0, bottomY + h / 2, 0), coatC);
  }
  if (o.vest) {
    const v = col(o.vest, rnd);
    add(box(0.32, 0.32, 0.19, 0, 0.82, 0), v);
    add(box(0.05, 0.32, 0.2, 0, 0.82, 0), o.vestTrim ?? 0xd9a73a);   // embroidered front edge
    add(box(0.33, 0.04, 0.2, 0, 0.67, 0), o.vestTrim ?? 0xd9a73a);   // hem band
  }
  if (o.tie) add(box(0.045, 0.22, 0.01, 0, 0.88, 0.1 + (coat !== 'none' ? 0.012 : 0)), o.tie);
  const scarf = o.scarf ? col(o.scarf, rnd) : null;
  if (scarf) { add(new THREE.CylinderGeometry(0.125, 0.14, 0.08, 8).translate(0, 1.03, 0), scarf); add(box(0.06, 0.2, 0.02, 0.05, 0.92, 0.11), scarf); }

  // arms: sleeve, bare forearm for short sleeves, hand
  for (const [sx, limb] of [[-1, 1], [1, 2]]) {
    const x = sx * 0.2;
    if (longSleeves) add(box(0.085, 0.4, 0.085, x, SHOULDER - 0.2, 0), outer, limb);
    else { add(box(0.085, 0.2, 0.085, x, SHOULDER - 0.1, 0), top, limb); add(box(0.07, 0.2, 0.07, x, SHOULDER - 0.3, 0), skin, limb); }
    add(box(0.075, 0.075, 0.075, x, SHOULDER - 0.44, 0), skin, limb);
  }

  // bags
  if (o.bag === 'backpack') add(box(0.24, 0.3, 0.11, 0, 0.82, -0.14), col(o.bagCol ?? 0x23252b, rnd));
  else if (o.bag === 'shoulder') { const b = col(o.bagCol ?? 0x4a3426, rnd); add(box(0.14, 0.16, 0.07, 0.19, 0.64, 0.02), b); add(box(0.03, 0.46, 0.02, 0.07, 0.86, 0.1), b); }

  // head, hair, headwear
  add(box(0.06, 0.07, 0.06, 0, 1.06, 0), skin);
  add(new THREE.SphereGeometry(0.125, 8, 6).scale(0.95, 1.05, 1).translate(0, 1.18, 0), skin);
  add(box(0.025, 0.03, 0.02, 0.045, 1.19, 0.125), 0x2b1d14); add(box(0.025, 0.03, 0.02, -0.045, 1.19, 0.125), 0x2b1d14);   // eyes
  const cap = (r: number, y: number, c: number, t = 0.55) => add(new THREE.SphereGeometry(r, 8, 4, 0, Math.PI * 2, 0, Math.PI * t).translate(0, y, 0), c);
  const head = o.headwear;
  if (head === 'ghutra') {
    const w = col(o.headCol ?? 0xffffff, rnd);
    cap(0.145, 1.19, w, 0.6); add(box(0.3, 0.2, 0.09, 0, 1.1, -0.1), w); add(box(0.03, 0.18, 0.2, 0.14, 1.12, -0.02), w); add(box(0.03, 0.18, 0.2, -0.14, 1.12, -0.02), w);
    add(new THREE.TorusGeometry(0.145, 0.014, 4, 10).rotateX(Math.PI / 2).translate(0, 1.27, 0), 0x1c1c1c);   // agal
  } else if (head === 'hijab') {
    const w = col(o.headCol ?? 0x1c1c22, rnd);
    cap(0.145, 1.19, w, 0.62); add(box(0.3, 0.34, 0.1, 0, 1.03, -0.1), w); add(box(0.03, 0.3, 0.2, 0.14, 1.08, -0.02), w); add(box(0.03, 0.3, 0.2, -0.14, 1.08, -0.02), w);
  } else {
    const hs = o.hairStyle || 'short';
    if (hs !== 'none') {
      cap(0.138, 1.19, hair, 0.5);
      add(box(0.27, 0.16, 0.06, 0, 1.17, -0.1), hair);                   // back of the head
      if (hs === 'long') add(box(0.27, 0.3, 0.07, 0, 1.03, -0.11), hair);
      if (hs === 'bun') add(new THREE.SphereGeometry(0.06, 6, 4).translate(0, 1.33, -0.07), hair);
    }
    if (o.hat === 'beanie') { const c = col(o.hatCol ?? 0xe74c3c, rnd); cap(0.15, 1.2, c, 0.55); add(new THREE.SphereGeometry(0.04, 5, 4).translate(0, 1.34, 0), c); }
    else if (o.hat === 'cap') { const c = col(o.hatCol ?? 0x23252b, rnd); cap(0.145, 1.2, c, 0.5); add(box(0.2, 0.02, 0.1, 0, 1.22, 0.14), c); }
  }

  // merge, adding the per-vertex limb id
  let count = 0; const gs = parts.map(([g, c, l]): [THREE.BufferGeometry, THREE.Color, number] => { const n = g.index ? g.toNonIndexed() : g; count += n.attributes.position.count; return [n, new THREE.Color(c), l]; });
  const pos = new Float32Array(count * 3), nor = new Float32Array(count * 3), cl = new Float32Array(count * 3), limb = new Float32Array(count);
  let off = 0;
  for (const [g, c, l] of gs) {
    const n = g.attributes.position.count;
    pos.set(g.attributes.position.array, off * 3); nor.set(g.attributes.normal.array, off * 3);
    for (let i = 0; i < n; i++) { cl[(off + i) * 3] = c.r; cl[(off + i) * 3 + 1] = c.g; cl[(off + i) * 3 + 2] = c.b; limb[off + i] = l; }
    off += n;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(cl, 3)); geo.setAttribute('aLimb', new THREE.BufferAttribute(limb, 1));
  geo.userData.tris = count / 3; geo.userData.amp = ampScale;
  geo.userData.legCol = garment === 'skirt' ? col(o.tights ?? skin, rnd) : bottom; geo.userData.shoeCol = shoes;   // for the separate legs of a cyclist
  geo.computeBoundingSphere();
  return geo;
}

// swing: sin(uPhase) * uAmp radians about the hip or shoulder; uRaise lifts the right arm (holding an umbrella)
const SWING = `
  float limb = aLimb, ang = 0.0, pv = limb < 2.5 ? ${SHOULDER.toFixed(2)} : ${HIP.toFixed(2)};
  if (limb > 0.5) { float s = sin(uPhase) * uAmp; ang = limb < 1.5 ? s : limb < 2.5 ? (uRaise > 0.5 ? 3.0 : -s) : limb < 3.5 ? -s : s; }
  mat2 limbR = mat2(cos(ang), sin(ang), -sin(ang), cos(ang));`;
export function makeFigureMaterial() {
  const u = { uPhase: { value: 0 }, uAmp: { value: 0 }, uRaise: { value: 0 } };
  const m = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.8 });
  m.userData.u = u;
  m.onBeforeCompile = (sh: { uniforms: Record<string, unknown>; vertexShader: string }) => {
    Object.assign(sh.uniforms, u);
    sh.vertexShader = sh.vertexShader
      .replace('void main() {', 'attribute float aLimb; uniform float uPhase, uAmp, uRaise;\nvoid main() {')
      .replace('#include <beginnormal_vertex>', `#include <beginnormal_vertex>\n${SWING}\n if (limb > 0.5) objectNormal.yz = limbR * objectNormal.yz;`)
      .replace('#include <begin_vertex>', '#include <begin_vertex>\n if (limb > 0.5) transformed.yz = limbR * (transformed.yz - vec2(pv, 0.0)) + vec2(pv, 0.0);');
  };
  m.customProgramCacheKey = () => 'figure-limbs';
  return m;
}
