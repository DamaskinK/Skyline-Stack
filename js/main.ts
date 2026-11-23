// Entry point: wires the game to the interface and runs the frame loop (fixed 120 Hz simulation, free-running render).
import * as THREE from 'three';
import { CFG, CAM_OFFSETS } from './config.js';
import { renderer, scene, camera, applyQuality, resize, updateWorld } from './world.js';
import { dayAt } from './core/dayarc.js';
import { introPose } from './core/intro-path.js';
import { updateCrane, updateMarker } from './entities.js';
import { FX, People, updateWeather, updateBolt } from './fx.js';
import { Sfx } from './audio.js';
import { Music } from './music.js';
import { Trams } from './trams.js';
import { settings, onSettings } from './settings.js';
import { Game } from './game.js';
import { createUI } from './ui.js';
import { installDebug } from './debug.js';
import { DISTRICT_CITIES } from './levels.js';
import { applyPostQuality, resizePost, renderFrame, post } from './post.js';

// Handles the browser checks reach through window.
declare global {
  interface Window { __music: unknown; __sfx: unknown; __game: unknown; __CFG: unknown; __scene: unknown; __post: unknown }
}

const game = new Game();
game.camera = camera;
game.ui = createUI(game);
Music.bind(game);
window.__music = Music;   // director state, log and levels for the browser checks
window.__sfx = Sfx;
window.__game = game; window.__CFG = CFG; window.__scene = scene;   // handles for automated tests
installDebug({ renderer, scene, camera, loadPlot: (n, city = 'kosice') => game.loadPlot(city, (DISTRICT_CITIES.find((c) => c.id === city)?.district?.plots[n] as { id: string }).id) });

applyQuality(); People.applyTraffic(); resize(); applyPostQuality();
window.addEventListener('resize', () => { resize(); resizePost(); });
// the car count follows the preset and the finished plots
onSettings((k) => { if (k === 'quality') { applyQuality(); People.applyTraffic(); applyPostQuality(); } });
window.__post = post;

const $flash = document.getElementById('flash') as HTMLElement, $vig = document.getElementById('vignette') as HTMLElement;   // both live in index.html
const camOffsets = CAM_OFFSETS.map((o) => new THREE.Vector3(...o));
const camPos = new THREE.Vector3(30, 20, 40), camLook = new THREE.Vector3(0, 10, 0);
const tmpOff = new THREE.Vector3(), tmpLook = new THREE.Vector3(), tmpTarget = new THREE.Vector3();
let clock = 0, camY = 8, fovGoal = 50;
const CFG_LOW_LIFT = 5, CFG_LOW_FOV = 8;   // metres the look-at point rises and degrees the field of view opens at floor 0, fading out by floor 10

function render(rdt: number) {
  clock += rdt;
  const T = game.tower, bv = game.blockView, b = bv ? game.block : null, playing = game.state === 'play' && T;
  game.syncTower(rdt);
  const n = T ? T.n : 0, ph = game.state === 'menu' ? game.weather : game.run ? game.run.wx : game.weather;

  // hanging block pops in and tilts a little with the swing
  if (b && bv && T) {
    const mesh = bv.mesh;
    mesh.position.set(b.x, b.y, b.z);
    if (b.state === 'hang') {
      bv.appear = Math.min(1, bv.appear + rdt * 4); mesh.scale.setScalar(0.6 + 0.4 * bv.appear);
      mesh.rotation.set(-Math.atan2(b.z - T.bz, CFG.ropeLen) * 0.3, 0, Math.atan2(b.x - T.bx, CFG.ropeLen) * 0.3);
    } else { mesh.scale.setScalar(1); mesh.rotation.x *= 0.95; mesh.rotation.z *= 0.95; }
  }

  // crane follows the tower top; in the menu it idles over the demo tower
  const cx = T ? T.bx : 0, cz = T ? T.bz : 0;
  const craneY = playing ? game.craneY : CFG.FOUND_H + CFG.H * 10;
  const jibY = craneY + CFG.dropGap + CFG.H + CFG.ropeLen;
  const hx = playing && game.hook ? game.hook.x : cx + Math.sin(clock * 1.2) * 2;
  const hz = playing && game.hook ? game.hook.z : cz;
  const hy = b && b.state === 'hang' ? b.y + CFG.H / 2 + 1.2 : (playing ? craneY + CFG.dropGap + CFG.H + 1.6 : craneY + 6);
  updateCrane(cx, cz, jibY, hx, hy, hz, b && b.state === 'hang' ? b : null, b && bv ? bv.mesh : null, clock);
  const top = T && T.n ? T.top() : { x: cx, z: cz };
  const markerOn = !!(playing && b) && Math.max(Math.abs(b.x - top.x), Math.abs(b.z - top.z)) < CFG.W;
  updateMarker(markerOn, b?.x ?? 0, T ? T.topY() + 0.02 : 0, b?.z ?? 0, ph.name === 'Fog' ? 0.45 : 0.22);

  // camera
  if (game.intro) {
    // city intro: the camera follows the pass over the landmarks (skipped or finished by the UI)
    const it = game.intro; it.t += rdt;
    const q = introPose(it.keys, it.t / it.dur);
    camPos.set(...q.p); camLook.set(...q.l); tmpLook.copy(camLook);
    if (it.t >= it.dur) it.done();
  } else if (game.state === 'menu') {
    // slow fly-over of the loaded city: a wide orbit that rises and sinks; on wide screens the tower sits right of centre, clear of the menu
    const a = clock * 0.06, k = camera.aspect > 1.1 ? 10 : 0, r = 48 + 6 * Math.sin(clock * 0.05), h = 25 + 4 * Math.sin(clock * 0.11);
    camPos.lerp(tmpTarget.set(Math.cos(a) * r, h, Math.sin(a) * r), Math.min(1, rdt * 2));
    tmpLook.set(-k * Math.sin(a), 19, k * Math.cos(a));
  } else {
    const targetY = T ? T.topY() + 4.5 : 8;
    camY += (targetY - camY) * Math.min(1, rdt * 2.5);
    const off = !T ? tmpOff.set(30, 34, 44) : camOffsets[game.camMode];
    camPos.lerp(tmpTarget.set(cx, camY, cz).add(off), Math.min(1, rdt * 3));
    // low tower: look a little higher and open the field of view, so the skyline and the cathedral spire are not cut off at floor 0
    const low = T && game.camMode < 2 ? Math.max(0, 1 - T.n / 10) : 0;
    tmpLook.set(cx, camY - (T ? 0.5 : 6) + CFG_LOW_LIFT * low, cz);
    fovGoal = 50 + CFG_LOW_FOV * low;
  }
  if (!game.intro) camLook.lerp(tmpLook, Math.min(1, rdt * 3));
  if (game.intro || game.state === 'menu') fovGoal = 50;
  if (Math.abs(camera.fov - fovGoal) > 0.01) { camera.fov += (fovGoal - camera.fov) * Math.min(1, rdt * 3); camera.updateProjectionMatrix(); }
  camera.position.copy(camPos);
  if (game.shake > 0) {
    game.shake -= rdt;
    if (settings.shake) { const s = Math.min(0.35, game.shake * 0.25); camera.position.x += Math.sin(clock * 53) * s; camera.position.y += Math.cos(clock * 47) * s; }
  }
  camera.lookAt(camLook);
  camera.updateMatrixWorld();

  updateWorld(rdt, ph, game.wind, camLook, game.flashV, game.state !== 'menu' && game.run ? dayAt(game.run.level, n, game.run.endless) : undefined);
  game.flashV = Math.max(0, game.flashV - rdt * 2.5);
  $flash.style.opacity = String(Math.min(0.75, game.flashV * 0.8));
  updateBolt(rdt);
  updateWeather(rdt, ph, game.wind, camLook, game.state !== 'menu', clock);

  // the weakest floor blinks red when the tower is close to tipping
  if (T) {
    for (const m of game.floorMeshes) m.userData.warn.visible = false;
    const stab = 1 - T.dyn.r, wi = T.dyn.k + 1;
    if (stab < 0.3 && wi >= 0 && wi < game.floorMeshes.length) game.floorMeshes[wi].userData.warn.visible = Math.sin(clock * 14) > -0.2;
    $vig.style.opacity = stab < 0.3 ? String(0.4 + 0.3 * Math.sin(clock * 6)) : '0';
  } else $vig.style.opacity = '0';

  FX.update(rdt);
  People.update(game.paused ? 0 : rdt, game.wind, !!ph.rain);
  Trams.update(game.paused ? 0 : rdt);
  Sfx.ambience(game.wind, ph, game.state === 'play' && !game.paused);
  Music.update();
  renderFrame();
  game.ui.update(rdt, Math.atan2(camera.position.z - camLook.z, camera.position.x - camLook.x));
}

People.setWalkers(9);   // the menu demo tower is built by the UI (ui.ts loadMenuScene)
let last = performance.now(), acc = 0;
function frame(now: number) {
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
