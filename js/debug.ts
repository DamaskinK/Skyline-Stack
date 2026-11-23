// Hooks for the browser check scripts (tests/browser). Nothing here runs unless a script calls it.
import * as THREE from 'three';
import { aimSun } from './world.js';
import { windClock } from './vegetation.js';

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

  window.__debug = { snap, flicker, info, loadPlot };   // loadPlot(n): build the scene of Kosice plot n (0-4) around the tower
}
