// The game adapter: owns one simulation run (js/core/run.js) and turns its events into meshes, effects, sound and UI.
// The rules live in the core; this file only draws and plays them. It reports to `this.ui`, which main.js connects.
import * as THREE from 'three';
import { CFG, DIFFICULTY, BTYPES, ENDLESS_COLORS, phaseAt } from './config.js';
import { Run, CALM_WIND } from './core/run.js';
import { scene } from './world.js';
import { BUILDING_TYPES } from './building-types.js';
import { makeBlockMesh, makeFoundation, makeRoof, makeCrown } from './entities.js';
import { FX, People, strikeBolt } from './fx.js';
import { Sfx } from './audio.js';
import { Music } from './music.js';
import { settings, loadScores, saveLevelResult } from './settings.js';
import { levelById, cityById } from './levels.js';
import { loadLevelAssets, loadPlotExtract } from './assets.js';
import { applyLevelAssets, level } from './level-scene.js';

export class Game {
  constructor() {
    this.state = 'menu'; this.mode = 'endless'; this.paused = false;
    this.objects = []; this.debris = []; this.keys = {}; this.camMode = 0;
    this.flashV = 0; this.shake = 0;
    this.diffKey = settings.difficulty; this.diff = DIFFICULTY[this.diffKey];
    this.ui = null; this.camera = null;
    this.run = null; this.floorMeshes = []; this.floorViews = []; this.blockView = null;
  }

  // Read-only views of the run, used by the frame loop and the HUD.
  get tower() { return this.run ? this.run.tower : null; }
  get block() { return this.run ? this.run.block : null; }
  get hook() { return this.run ? this.run.hook : null; }
  get wind() { return this.run ? this.run.wind : CALM_WIND; }
  get craneY() { return this.run ? this.run.craneY : CFG.FOUND_H; }
  get lives() { return this.run ? this.run.lives : this.diff.lives; }
  get combo() { return this.run ? this.run.combo : 0; }
  get goldenNext() { return this.run ? this.run.goldenNext : false; }
  get anchors() { return this.run ? this.run.anchors : 0; }
  get score() { return this.run ? this.run.score : 0; }
  get pop() { return this.run ? this.run.pop : 0; }
  get perfects() { return this.run ? this.run.perfects : 0; }
  get focus() { return this.run ? this.run.focus : 1; }
  get weather() { return this.run ? this.run.wx : phaseAt(0); }
  get drops() { return this.run ? this.run.drops : 0; }

  get levelId() { return level.id; }
  // Fetch a level's assets and put them in the scene. Resolves to the list of files that failed (may be empty).
  async loadLevel(id, onProgress) {
    const { assets, errors } = await loadLevelAssets(id, onProgress, (aid, v) => { if (aid === 'music') Music.provide(id, v); });
    applyLevelAssets(id, assets);
    return errors;
  }

  // Build the scene of one district plot of a city (near ring from the plot's own extract, rings and landmarks offset to it).
  // Resolves to the list of files that failed. Ticket 04 calls this before game.start().
  async loadPlot(cityId, plotId, onProgress) {
    const plot = (cityById(cityId)?.district?.plots || []).find((p) => p.id === plotId);
    if (!plot) throw new Error(`No plot "${plotId}" in ${cityId}`);
    const [{ assets, errors }, osm] = await Promise.all([
      loadLevelAssets(cityId, onProgress, (aid, v) => { if (aid === 'music') Music.provide(cityId, v); }), loadPlotExtract(cityId, plotId)]);
    applyLevelAssets(cityId, assets, plot, osm);
    return errors;
  }

  start(mode = this.mode, diffKey = settings.difficulty, levelId = 'kosice') {
    this.clear();
    this.mode = mode; this.diffKey = diffKey; this.diff = DIFFICULTY[diffKey] || DIFFICULTY.normal;
    this.cityId = levelId; this.levelDef = mode === 'level' ? levelById(levelId) : null;
    this.prevBest = mode === 'level' ? 0 : (loadScores(levelId)[0]?.score || 0);
    this.state = 'play'; this.paused = false; this.saved = false;
    People.setWalkers(9);
    // Endless runs on the chosen city: its weather segments loop and only its events happen
    this.run = new Run(this.diff, { level: levelById(levelId), endless: mode !== 'level' });
    this.objects.push(makeFoundation(0, 0, this.run.buildingType, this.levelDef ? this.levelDef.city : (levelById(levelId) || {}).city));
    this.ui.showHud();
  }
  clear() {
    for (const m of this.floorMeshes) scene.remove(m);
    for (const o of this.objects) scene.remove(o);
    for (const d of this.debris) scene.remove(d.mesh);
    if (this.blockView) scene.remove(this.blockView.mesh);
    People.clear();
    this.objects = []; this.debris = []; this.floorMeshes = []; this.floorViews = []; this.blockView = null; this.run = null;
  }

  drop() { if (this.state === 'play' && !this.paused && this.run) this.run.drop(); }
  useAnchor() { if (this.state === 'play' && !this.paused && this.run) this.run.useAnchor(); }
  focusActive() { return !!(CFG.features.focus && this.keys.focus && this.focus > 0 && this.state === 'play' && !this.paused); }
  timeScale(rdt) { return this.run ? this.run.timeScale(rdt, this.focusActive()) : 1; }

  step(dt) {
    if (this.run) { this.run.step(dt); for (const ev of this.run.drain()) this.handle(ev); }
    this.stepDebris(dt);
  }

  // One core event -> what the player sees and hears.
  handle(ev) {
    Music.event(ev.type);
    switch (ev.type) {
      case 'spawn': {
        const bt = BTYPES[ev.block];
        const color = ev.block !== 'normal' ? bt.color : ENDLESS_COLORS[Math.floor(ev.floor / 5) % ENDLESS_COLORS.length];
        this.blockView = { mesh: makeBlockMesh(color, bt.golden, ev.floor % 3, ev.block === 'normal' ? this.facadeStyle() : ''), appear: 0 };
        break;
      }
      case 'drop': Sfx.drop(); break;
      case 'anchor': this.ui.popup('ANCHOR', '#52d9ff'); Sfx.anchor(); break;
      case 'lightningWarning': this.flashV = Math.max(this.flashV, 0.25); this.ui.banner('Lightning incoming', 1.5); Sfx.rumble(); break;
      case 'lightning': this.flashV = 1; strikeBolt(ev.x, ev.y, ev.z); Sfx.thunder(); break;
      case 'bounce': this.ui.popup('BOING', '#ff5fa2', true); Sfx.bounce(); FX.dust({ x: ev.x, y: ev.y, z: ev.z }, 0.5); break;
      case 'slip': this.blockToDebris({ ...ev }); Sfx.miss(); break;
      case 'miss': this.blockToDebris({ ...ev, av: { x: 1, y: 0.5, z: -1.5 } }); Sfx.miss(); break;
      case 'land': this.onLand(ev); break;
      case 'goldenNext': this.ui.banner('Golden block next', 2); break;
      case 'anchorGained': this.ui.banner('+1 anchor', 2); break;
      case 'weather': this.ui.weather(this.run.wx); Sfx.whoosh(); break;
      case 'gustWarning': this.ui.banner('Sandstorm gust incoming', 1.5); Sfx.rumble(); break;
      case 'gust': this.shake = Math.max(this.shake, 0.4); Sfx.whoosh(); break;
      case 'quakeWarning': this.ui.banner(`Earthquake at floor ${ev.floor}`, 3); break;
      case 'quake': this.shake = CFG.quakeTime; this.ui.banner('EARTHQUAKE', CFG.quakeTime); Sfx.crash(); break;
      case 'collapse': {
        const meshes = this.floorMeshes.splice(ev.from); this.floorViews.splice(ev.from);
        ev.items.forEach((it, j) => this.addDebris({ mesh: meshes[j], p: it.p, v: it.v, av: it.av }));
        this.shake = 0.8; this.flashV = Math.max(this.flashV, 0.3);
        if (ev.items[0]) FX.dust(ev.items[0].p, 2);
        Sfx.crash();
        this.ui.popup(`COLLAPSE −${ev.count}`, '#ff4d5e');
        break;
      }
      case 'lifeLost': if (ev.reason) this.ui.popup(ev.reason, '#ff4d5e'); break;
      case 'target': this.ui.popup('TARGET REACHED', '#ffd34d'); Sfx.golden(); break;
      case 'over': this.gameOver(ev.result); break;
      default: break;
    }
  }

  onLand(ev) {
    const T = this.tower, mesh = this.blockView.mesh, p = T.pose(ev.floor);
    this.floorMeshes.push(mesh);
    this.floorViews.push({ vis: { x: ev.x - p.x, z: ev.z - p.z }, squash: 0.25 });   // visual slide from contact to final spot
    this.blockView = null;
    const perfect = ev.kind === 'perfect', good = ev.kind !== 'risky';
    const roof = { x: ev.x, y: ev.roofY, z: ev.z };
    FX.dust({ x: roof.x, y: roof.y - CFG.H, z: roof.z }, perfect ? 0.7 : 1);
    Sfx.land(perfect, ev.combo);
    People.arrive(mesh, perfect ? 4 : good ? 2 : 1, this.camera);
    this.ui.bumpFloor();
    if (perfect) {
      FX.sparks(roof); FX.ring(new THREE.Vector3(roof.x, roof.y + 0.05, roof.z), 0xffd34d);
      this.ui.popup(ev.combo > 1 ? `PERFECT ×${ev.combo}` : 'PERFECT', '#ffb627');
    } else if (good) this.ui.popup('GOOD', '#5dff9b');
    else { this.ui.popup('RISKY', '#ff4d5e'); this.shake = Math.max(this.shake, 0.25); }
    if (ev.golden) { this.ui.popup('GOLDEN · CALM', '#ffd34d', true); Sfx.golden(); FX.ring(new THREE.Vector3(roof.x, roof.y + 0.05, roof.z), 0xffffff); }
  }

  // Facade style of the current building type; special blocks keep their own colour and plain facade.
  facadeStyle() { const t = BUILDING_TYPES[this.run && this.run.buildingType]; return t ? t.facade : ''; }

  blockToDebris(ev) {
    if (!this.blockView) return;
    this.addDebris({ mesh: this.blockView.mesh, p: ev.p, v: ev.v, av: ev.av });
    this.blockView = null;
  }
  addDebris(it) {
    it.mesh.position.set(it.p.x, it.p.y, it.p.z); it.mesh.userData.warn.visible = false;
    this.debris.push({ mesh: it.mesh, p: it.mesh.position, v: { ...it.v }, av: { ...it.av }, t: 0 });
  }
  stepDebris(dt) {
    for (const d of this.debris) {
      d.t += dt;
      d.v.y -= CFG.G * dt;
      d.p.x += d.v.x * dt; d.p.y += d.v.y * dt; d.p.z += d.v.z * dt;
      d.mesh.rotation.x += d.av.x * dt; d.mesh.rotation.y += d.av.y * dt; d.mesh.rotation.z += d.av.z * dt;
      if (d.p.y < CFG.H / 2) {
        if (!d.landed) { d.landed = true; FX.dust(d.p, 1.2); Sfx.thud(); }
        d.p.y = CFG.H / 2; d.v.y *= -0.2; d.v.x *= 0.7; d.v.z *= 0.7; d.av.x *= 0.5; d.av.y *= 0.5; d.av.z *= 0.5;
      }
    }
    this.debris = this.debris.filter((d) => { if (d.t < 9) return true; scene.remove(d.mesh); return false; });
  }

  // Copy the simulated tower onto its meshes: sway, tilt, the slide after landing and the landing squash.
  syncTower(dt) {
    const T = this.tower; if (!T) return;
    const decay = Math.exp(-dt * 14);
    for (let i = 0; i < T.n; i++) {
      const mesh = this.floorMeshes[i], v = this.floorViews[i], p = T.pose(i), slope = T.slope(i);
      v.vis.x *= decay; v.vis.z *= decay;
      mesh.position.set(p.x + v.vis.x, T.yc(i), p.z + v.vis.z);
      mesh.rotation.set(T.s.z * slope, 0, -T.s.x * slope);
      if (v.squash > 0) { v.squash = Math.max(0, v.squash - dt); const k = v.squash / 0.25; mesh.scale.set(1 + 0.08 * k, 1 - 0.14 * k, 1 + 0.08 * k); }
      else mesh.scale.set(1, 1, 1);
    }
  }

  gameOver(result) {
    if (this.state === 'over' || this.state === 'menu') return;
    this.state = 'over';
    this.lastResult = { ...result, diff: this.diffKey };
    if (this.levelDef) {
      saveLevelResult(this.levelDef.id, result.stars, result.floors);
      if (result.completed) {
        const top = this.floorMeshes[this.floorMeshes.length - 1];
        if (top) { const crown = makeCrown(this.run.buildingType); crown.position.y = CFG.H / 2; top.add(crown); }
        Sfx.fanfare();
        setTimeout(() => { if (this.state === 'over') this.ui.levelDone(this.lastResult, this.levelDef); }, 1400);
        return;
      }
    }
    Sfx.over();
    setTimeout(() => { if (this.state === 'over') this.ui.gameOver(this.lastResult, !this.levelDef && this.lastResult.score > this.prevBest && this.lastResult.score > 0); }, 1400);
  }
}

// Tower shown behind the main menu.
let demo = [];
const DEMO_FLOORS = 10;   // floors are 2.8 tall now, so fewer of them fill the same skyline
export function buildDemo(levelId = 'kosice') {
  clearDemo();
  const lv = levelById(levelId) || levelById('kosice'), type = lv.buildingType || 'panel', bt = BUILDING_TYPES[type];
  demo.push(makeFoundation(0, 0, type, lv.city));
  for (let i = 0; i < DEMO_FLOORS; i++) {
    const m = makeBlockMesh(ENDLESS_COLORS[Math.floor(i / 5) % ENDLESS_COLORS.length], false, i % 3, bt.facade);
    m.position.set(Math.sin(i * 1.7) * 0.25, CFG.FOUND_H + CFG.H * (i + 0.5), Math.cos(i * 1.3) * 0.2); demo.push(m);
  }
  demo.push(makeRoof(new THREE.Vector3(0, CFG.FOUND_H + CFG.H * DEMO_FLOORS, 0), type));
}
export function clearDemo() { for (const o of demo) scene.remove(o); demo = []; }
