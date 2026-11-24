// Hooks for the browser check scripts (tests/browser). Nothing here runs unless a script calls it.
import * as THREE from 'three';
import { aimSun, auditProcedural, updateWorld, traffic } from './world.js';
import { PHASES } from './config.js';
import { windClock } from './vegetation.js';
import { auditScene, auditMiddle } from './placement-audit.js';

type V3 = [number, number, number];
export interface DebugHost { renderer: THREE.WebGLRenderer; scene: THREE.Scene; camera: THREE.PerspectiveCamera; loadPlot?: ((n: number, city?: string) => unknown) | null }
declare global { interface Window { __debug: unknown } }

export function installDebug({ renderer, scene, camera, loadPlot = null }: DebugHost) {
  const targets = new Map<string, THREE.WebGLRenderTarget>();
  const cam = new THREE.PerspectiveCamera();
  const target = (w: number, h: number): THREE.WebGLRenderTarget => {
    const k = `${w}x${h}`;
    if (!targets.has(k)) targets.set(k, new THREE.WebGLRenderTarget(w, h, { colorSpace: THREE.SRGBColorSpace }));
    return targets.get(k) as THREE.WebGLRenderTarget;
  };

  // Render the scene from one camera pose into an offscreen target and return its RGBA bytes.
  // The sun is aimed at `sunFocus` the same way the game aims it at the camera's look point.
  const focus = new THREE.Vector3();
  function snap(pos: V3, look: V3, w = 320, h = 180, sunFocus: V3 = look) {
    cam.fov = camera.fov; cam.near = camera.near; cam.far = camera.far; cam.aspect = w / h; cam.updateProjectionMatrix();
    cam.position.set(...pos); cam.lookAt(...look); cam.updateMatrixWorld();
    aimSun(focus.set(...sunFocus));
    const rt = target(w, h), px = new Uint8Array(w * h * 4);
    renderer.setRenderTarget(rt); renderer.render(scene, cam); renderer.setRenderTarget(null);
    renderer.readRenderTargetPixels(rt, 0, 0, w, h, px);
    return px;
  }

  // Share of pixels that change between two renders where nothing in the scene moves. Two kinds:
  //  'depth':  the camera moves 4 mm (sun fixed). A clean scene changes only along edges; z-fighting flips surfaces.
  //  'shadow': the camera stays, the sun's aim point moves 4 cm, as it does every frame while the camera follows the
  //            tower. Stable shadows do not change at all; a swimming shadow map shimmers along every shadow edge.
  function flicker({ kind = 'depth', radius = 44, height = 24, look = [0, 2, 0] as V3, arc = Math.PI * 2, pairs = 12, w = 320, h = 180, tol = 40 } = {}) {
    const out = [], m4 = new THREE.Matrix4(), tp = new THREE.Vector3(), ts = new THREE.Vector3();
    // a pose whose camera sits inside a tree crown shows the crown cut by the near plane, which says nothing about the ground: skip it
    const inTree = (p: V3) => {
      let hit = false;
      scene.traverse((o) => {
        if (hit || !o.userData.tree || !(o instanceof THREE.InstancedMesh)) return;   // trees are instanced meshes
        for (let i = 0; i < o.count && !hit; i++) { o.getMatrixAt(i, m4); m4.decompose(tp, new THREE.Quaternion(), ts); if (Math.hypot(tp.x - p[0], tp.z - p[2]) < 2.6 * ts.x && p[1] < tp.y + 6 * ts.y) hit = true; }
      });
      return hit;
    };
    windClock.frozen = performance.now() / 1000;
    for (let i = 0; i < pairs; i++) {
      const a = (i / pairs) * arc, p: V3 = [Math.cos(a) * radius, height, Math.sin(a) * radius];
      if (inTree(p)) continue;
      let A: Uint8Array, B: Uint8Array;
      if (kind === 'shadow') {
        A = snap(p, look, w, h, look);
        B = snap(p, look, w, h, [look[0] + 0.04, look[1] + 0.03, look[2] - 0.02]);
      } else {
        const d = [0.004, 0.002, -0.004];
        A = snap(p, look, w, h, look);
        B = snap([p[0] + d[0], p[1] + d[1], p[2] + d[2]], look, w, h, look);
      }
      let changed = 0;
      for (let j = 0; j < A.length; j += 4) {
        if (Math.max(Math.abs(A[j] - B[j]), Math.abs(A[j + 1] - B[j + 1]), Math.abs(A[j + 2] - B[j + 2])) > tol) changed++;
      }
      out.push(changed / (w * h));
    }
    aimSun(focus.set(0, 0, 0)); windClock.frozen = null;
    return { skipped: pairs - out.length, max: Math.max(...out, 0), mean: out.reduce((s, v) => s + v, 0) / out.length, perPose: out };
  }

  function info() {
    const gl = renderer.getContext(), ext = gl.getExtension('WEBGL_debug_renderer_info');
    return {
      gpu: ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER),
      calls: renderer.info.render.calls, triangles: renderer.info.render.triangles,
      near: camera.near, far: camera.far,
    };
  }

  // placement audit of the built scene (S0004 00): the near ring's trees, furniture, shops ... against the real size of everything else; counts per category
  function placementAudit() {
    const near = scene.getObjectByName('near-ring');
    if (!near) { const p = auditProcedural(); return { procedural: true, middle: {}, counts: p.counts, byCategory: p.byCategory, planByCategory: {}, mismatches: [], sample: [] }; }
    const a = auditScene(near);
    const mid = scene.getObjectByName('middle-far-ring'), middle = mid ? auditMiddle(mid) : {};
    return { middle, counts: a.counts, byCategory: a.byCategory, planByCategory: a.planFindings, mismatches: a.mismatches, sample: a.findings.slice(0, 8) };
  }

  // footprint of every landmark model of the scene (convex hull of its first LOD in the frame of the scene, x east, z south), to freeze them as data in js/core/landmark-sites.ts
  function landmarkHulls() {
    const root = scene.getObjectByName('kosice-landmarks'), out: Record<string, number[]> = {}; if (!root) return out;
    root.updateMatrixWorld(true);
    const v = new THREE.Vector3();
    for (const g of root.children) {
      const pts = new Map<string, [number, number]>();
      const lod = g.children[0] instanceof THREE.LOD ? (g.children[0] as THREE.LOD).levels[0]?.object : g;
      lod?.traverse((o) => {
        const m = o as THREE.Mesh; if (!m.isMesh) return;
        const a = m.geometry.attributes.position;
        for (let i = 0; i < a.count; i++) { v.fromBufferAttribute(a, i).applyMatrix4(m.matrixWorld); pts.set(`${Math.round(v.x * 4)},${Math.round(v.z * 4)}`, [v.x, v.z]); }
      });
      const P = [...pts.values()].sort((p, q) => p[0] - q[0] || p[1] - q[1]), cr = (o: number[], a: number[], b: number[]) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
      const half = (list: [number, number][]) => { const h: [number, number][] = []; for (const p of list) { while (h.length >= 2 && cr(h[h.length - 2], h[h.length - 1], p) <= 0) h.pop(); h.push(p); } h.pop(); return h; };
      const hull = [...half(P), ...half([...P].reverse())];
      out[g.name] = hull.flatMap((p) => [Math.round(p[0] * 10) / 10, Math.round(p[1] * 10) / 10]);
    }
    return out;
  }
  const trafficStats = () => ({ waiting: traffic.waiting, minGap: traffic.minGap, cars: traffic.count });   // cars that stand at a red light, the smallest centre distance between two cars on one route and direction
  const houseSpots = () => scene.getObjectByName('near-ring')?.userData.houseSpots ?? {};   // nearest old-town / panel / in-between house (S0004 02 screenshot poses)
  // instanced house modules of the near ring: meshes (draw calls, without the shadow pass), instances and triangles per module type
  function houseStats() {
    const near = scene.getObjectByName('near-ring'), per: Record<string, { n: number; tris: number }> = {}; let meshes = 0, tris = 0;
    near?.traverse((o) => {
      const im = o as THREE.InstancedMesh; if (!im.isInstancedMesh || !im.name.includes(':')) return;
      const t = (im.geometry.index ? im.geometry.index.count : im.geometry.attributes.position.count) / 3 * im.count, k = im.name.split(':')[0];
      meshes++; tris += t; (per[k] ??= { n: im.count, tris: 0 }).tris += t;
    });
    return { meshes, tris, per };
  }
  // hide the house module meshes whose name matches `re` (for example 'far:glass'); an empty pattern shows all again
  const hideModules = (re: string) => { const r = re ? new RegExp(re) : null; scene.getObjectByName('near-ring')?.traverse((o) => { if (o.name.includes(':') && (o as THREE.InstancedMesh).isInstancedMesh) o.visible = !(r && r.test(o.name)); }); };
  // S0004 03: where the street detail stands (traffic lights, crossings, bikes, plates, trams) for the screenshot poses, and the hour of the day
  const detailSpots = () => { const n = scene.getObjectByName('near-ring'); const d = n?.userData.plan?.detail; return d ? { lights: d.lights.map((l: { x: number; z: number; arms: unknown[] }) => ({ x: l.x, z: l.z, n: l.arms.length })), zebras: d.zebras.slice(0, 40), signs: n?.userData.plan.items.sign.slice(0, 4), racks: n?.userData.plan.items.rack.slice(0, 4), counts: n?.userData.detailCounts } : null; };
  const setHour = (hour: number) => { for (let i = 0; i < 60; i++) updateWorld(0.5, PHASES[0], { x: 0, z: 0 }, focus, 0, { hour, grade: null }); };
  window.__debug = { detailSpots, setHour, snap, flicker, info, loadPlot, placementAudit, landmarkHulls, trafficStats, houseSpots, houseStats, hideModules };   // loadPlot(n): build the scene of Kosice plot n (0-4) around the tower
}
