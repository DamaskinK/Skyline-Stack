// Entry point: wires the game to the interface and runs the frame loop (fixed 120 Hz simulation, free-running render).
import * as THREE from 'three';
import { CFG, phaseAt } from './config.js';
import { renderer, scene, camera, applyQuality, resize, updateWorld } from './world.js';
import { updateCrane, updateMarker } from './entities.js';
import { FX, People, updateWeather, updateBolt } from './fx.js';
import { Sfx, Music } from './audio.js';
import { settings, onSettings } from './settings.js';
import { Game, buildDemo } from './game.js';
import { createUI } from './ui.js';

const game = new Game();
game.camera = camera;
game.ui = createUI(game);
window.__game = game; window.__CFG = CFG; window.__scene = scene;   // handles for automated tests

applyQuality(); resize();
window.addEventListener('resize', resize);
onSettings((k) => { if (k === 'quality') applyQuality(); });

const $flash = document.getElementById('flash'), $vig = document.getElementById('vignette');
const camOffsets = [new THREE.Vector3(9, 4, 22), new THREE.Vector3(22, 4, 9), new THREE.Vector3(0, 19, 9)];
const camPos = new THREE.Vector3(30, 20, 40), camLook = new THREE.Vector3(0, 10, 0);
const tmpOff = new THREE.Vector3(), tmpLook = new THREE.Vector3(), tmpTarget = new THREE.Vector3();
let clock = 0, camY = 8;

function render(rdt) {
  clock += rdt;
  const T = game.tower, b = game.block, playing = game.state === 'play' && T;
  if (T) T.sync(rdt);
  const n = T ? T.n : 0, ph = phaseAt(game.state === 'menu' ? 0 : n);

  // hanging block pops in and tilts a little with the swing
  if (b) {
    b.mesh.position.set(b.x, b.y, b.z);
    if (b.state === 'hang') {
      b.appear = Math.min(1, b.appear + rdt * 4); b.mesh.scale.setScalar(0.6 + 0.4 * b.appear);
      b.mesh.rotation.set(-Math.atan2(b.z - T.bz, CFG.ropeLen) * 0.3, 0, Math.atan2(b.x - T.bx, CFG.ropeLen) * 0.3);
    } else { b.mesh.scale.setScalar(1); b.mesh.rotation.x *= 0.95; b.mesh.rotation.z *= 0.95; }
  }

  // crane follows the tower top; in the menu it idles over the demo tower
  const cx = T ? T.bx : 0, cz = T ? T.bz : 0;
  const craneY = playing ? game.craneY : CFG.FOUND_H + CFG.H * 18;
  const jibY = craneY + CFG.dropGap + CFG.H + CFG.ropeLen;
  const hx = playing && game.hook ? game.hook.x : cx + Math.sin(clock * 1.2) * 2;
  const hz = playing && game.hook ? game.hook.z : cz;
  const hy = b && b.state === 'hang' ? b.y + CFG.H / 2 + 1.2 : (playing ? craneY + CFG.dropGap + CFG.H + 1.6 : craneY + 6);
  updateCrane(cx, cz, jibY, hx, hy, hz, b && b.state === 'hang' ? b : null, clock);
  const top = T && T.n ? T.top() : { x: cx, z: cz };
  const markerOn = !!(playing && b) && Math.max(Math.abs(b.x - top.x), Math.abs(b.z - top.z)) < CFG.W;
  updateMarker(markerOn, b?.x, T ? T.topY() + 0.02 : 0, b?.z, ph.name === 'Fog' ? 0.45 : 0.22);

  // camera
  if (game.state === 'menu') {
    // slow orbit; on wide screens the tower sits right of centre, clear of the menu
    const a = clock * 0.08, k = camera.aspect > 1.1 ? 10 : 0;
    camPos.lerp(tmpTarget.set(Math.cos(a) * 44, 24, Math.sin(a) * 44), Math.min(1, rdt * 2));
    tmpLook.set(-k * Math.sin(a), 17, k * Math.cos(a));
  } else {
    const targetY = T ? T.topY() + 2.5 : 8;
    camY += (targetY - camY) * Math.min(1, rdt * 2.5);
    const off = !T ? tmpOff.set(30, 34, 44) : camOffsets[game.camMode];
    camPos.lerp(tmpTarget.set(cx, camY, cz).add(off), Math.min(1, rdt * 3));
    tmpLook.set(cx, camY - (T ? 0.5 : 6), cz);
  }
  camLook.lerp(tmpLook, Math.min(1, rdt * 3));
  camera.position.copy(camPos);
  if (game.shake > 0) {
    game.shake -= rdt;
    if (settings.shake) { const s = Math.min(0.35, game.shake * 0.25); camera.position.x += Math.sin(clock * 53) * s; camera.position.y += Math.cos(clock * 47) * s; }
  }
  camera.lookAt(camLook);
  camera.updateMatrixWorld();

  updateWorld(rdt, ph, game.wind, camLook, game.flashV);
  game.flashV = Math.max(0, game.flashV - rdt * 2.5);
  $flash.style.opacity = String(Math.min(0.75, game.flashV * 0.8));
  updateBolt(rdt);
  updateWeather(rdt, ph, game.wind, camLook, game.state !== 'menu', clock);

  // the weakest floor blinks red when the tower is close to tipping
  if (T) {
    for (const f of T.f) f.mesh.userData.warn.visible = false;
    const stab = 1 - T.dyn.r, wi = T.dyn.k + 1;
    if (stab < 0.3 && wi >= 0 && wi < T.n) T.f[wi].mesh.userData.warn.visible = Math.sin(clock * 14) > -0.2;
    $vig.style.opacity = stab < 0.3 ? String(0.4 + 0.3 * Math.sin(clock * 6)) : '0';
  } else $vig.style.opacity = '0';

  FX.update(rdt);
  People.update(game.paused ? 0 : rdt, game.wind, !!ph.rain);
  Sfx.ambience(game.wind, ph, game.state === 'play' && !game.paused);
  Music.tension = Math.min(1, n / 60);
  Music.update();
  renderer.render(scene, camera);
  game.ui.update(rdt, Math.atan2(camera.position.z - camLook.z, camera.position.x - camLook.x));
}

buildDemo(); People.setWalkers(9);
let last = performance.now(), acc = 0;
function frame(now) {
  requestAnimationFrame(frame);
  const rdt = Math.min(0.1, (now - last) / 1000); last = now;
  if ((game.state === 'play' || game.state === 'over') && !game.paused) {
    acc += rdt * (game.state === 'play' ? game.timeScale(rdt) : 1);
    let steps = 0;
    while (acc >= CFG.DT && steps < 24) { game.step(CFG.DT); acc -= CFG.DT; steps++; }
    if (steps >= 24) acc = 0;
  } else acc = 0;
  render(rdt);
}
requestAnimationFrame(frame);
