// Hooks for the browser check scripts (tests/browser). Nothing here runs unless a script calls it.
import * as THREE from 'three';
import { aimSun } from './world.js';

export function installDebug({ renderer, scene, camera }) {
  const targets = new Map();
  const cam = new THREE.PerspectiveCamera();
  const target = (w, h) => {
    const k = `${w}x${h}`;
    if (!targets.has(k)) targets.set(k, new THREE.WebGLRenderTarget(w, h, { colorSpace: THREE.SRGBColorSpace }));
    return targets.get(k);
  };

  // Render the scene from one camera pose into an offscreen target and return its RGBA bytes.
  // The sun is aimed at `sunFocus` the same way the game aims it at the camera's look point.
  const focus = new THREE.Vector3();
  function snap(pos, look, w = 320, h = 180, sunFocus = look) {
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
  function flicker({ kind = 'depth', radius = 44, height = 24, look = [0, 2, 0], arc = Math.PI * 2, pairs = 12, w = 320, h = 180, tol = 40 } = {}) {
    const out = [];
    for (let i = 0; i < pairs; i++) {
      const a = (i / pairs) * arc, p = [Math.cos(a) * radius, height, Math.sin(a) * radius];
      let A, B;
      if (kind === 'shadow') {
        A = snap(p, look, w, h, look);
        B = snap(p, look, w, h, [look[0] + 0.04, look[1] + 0.03, look[2] - 0.02]);
      } else {
        const d = [0.004, 0.002, -0.004];
        A = snap(p, look, w, h, look);
        B = snap(p.map((v, k) => v + d[k]), look, w, h, look);
      }
      let changed = 0;
      for (let j = 0; j < A.length; j += 4) {
        if (Math.max(Math.abs(A[j] - B[j]), Math.abs(A[j + 1] - B[j + 1]), Math.abs(A[j + 2] - B[j + 2])) > tol) changed++;
      }
      out.push(changed / (w * h));
    }
    aimSun(focus.set(0, 0, 0));
    return { max: Math.max(...out), mean: out.reduce((s, v) => s + v, 0) / out.length, perPose: out };
  }

  function info() {
    const gl = renderer.getContext(), ext = gl.getExtension('WEBGL_debug_renderer_info');
    return {
      gpu: ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER),
      calls: renderer.info.render.calls, triangles: renderer.info.render.triangles,
      near: camera.near, far: camera.far,
    };
  }

  window.__debug = { snap, flicker, info };
}
