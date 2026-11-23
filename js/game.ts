// The game adapter: owns one simulation run (js/core/run.js) and turns its events into meshes, effects, sound and UI.
// The rules live in the core; this file only draws and plays them. It reports to `this.ui`, which main.js connects.
import * as THREE from 'three';
import { CFG, DIFFICULTY, BTYPES, ENDLESS_COLORS, phaseAt } from './config.js';
import { Run, CALM_WIND } from './core/run.js';
import { scene } from './world.js';
import { BUILDING_TYPES, buildingTypeById } from './building-types.js';
import { makeBlockMesh, makeFoundation, makeRoof, makeCrown } from './entities.js';
import { FX, People, strikeBolt } from './fx.js';
import { Sfx } from './audio.js';
import { Music } from './music.js';
import { S } from './strings.js';
import { settings, loadScores, loadDistrictProgress, saveDistrictResult } from './settings.js';
import { levelById, cityById, nextLevel } from './levels.js';
import { resultCounts, plotStars, plotResidents, towerBonuses, districtTotals, nextPlot, plotOf } from './core/district.js';
import { cityProgress } from './core/district-progress.js';
import { showDistrictTowers, clearDistrictTowers } from './district-towers.js';
import { loadLevelAssets, loadPlotExtract } from './assets.js';
import type { AssetError } from './assets.js';
import { applyLevelAssets, level } from './level-scene.js';
import type { Block, District, DifficultyId, Difficulty, Hook, Level, Plot, PlotResult, RunEvent, RunResult, Vec3, Wind, WeatherCycle, DistrictTotals, LevelAssets, OsmExtract } from './types.js';
import type { Tower } from './physics.js';

type Mesh = ReturnType<typeof makeBlockMesh>;
export type GameState = 'menu' | 'play' | 'over';
export type GameMode = 'endless' | 'level' | 'plot';
interface BlockView { mesh: Mesh; appear: number }
interface FloorView { vis: { x: number; z: number }; squash: number }
interface Debris { mesh: Mesh; p: THREE.Vector3; v: Vec3; av: Vec3; t: number; landed?: boolean }
interface DebrisSource { mesh: Mesh; p: Vec3; v: Vec3; av: Vec3 }

// What a finished run shows: the core result plus the difficulty it was played on.
export interface GameResult extends RunResult { diff: DifficultyId }
// A plot run adds what the district rules made of it.
export interface PlotGameResult extends GameResult {
  plotId: string | null; counts: boolean; stars: number; plot: PlotResult; best: number; residents: number;
  bonuses: { view: boolean; skyline: boolean }; totals: DistrictTotals; goalReached: boolean; goalNew: boolean;
  nextCity: Level | null; nextPlot: Plot | null;
}

// The part of the UI (js/ui.ts) that the game reports to; main.js connects it.
export interface GameUi {
  showHud(): void;
  popup(text: string, color: string, small?: boolean): void;
  banner(text: string, seconds: number): void;
  weather(ph: WeatherCycle): void;
  bumpFloor(): void;
  plotDone(r: PlotGameResult, plot: Plot, city: Level): void;
  gameOver(r: GameResult, record: boolean): void;
  update(rdt: number, camAz: number): void;
  show(id: string, push?: boolean): void;
  toMenu(): void;
}

export class Game {
  state: GameState = 'menu'; mode: GameMode = 'endless'; paused = false;
  objects: THREE.Object3D[] = []; debris: Debris[] = []; keys: { focus?: boolean } = {}; camMode = 0;
  flashV = 0; shake = 0;
  diffKey: DifficultyId = settings.difficulty; diff: Difficulty = DIFFICULTY[settings.difficulty];
  // Both are set by main.js right after the game is made, before anything runs.
  ui = null as unknown as GameUi; camera: THREE.PerspectiveCamera | null = null;
  run: Run | null = null; floorMeshes: Mesh[] = []; floorViews: FloorView[] = []; blockView: BlockView | null = null;
  cityId: string | null = null; plotId: string | null = null; plotDef: Plot | null = null; levelDef: Level | null = null;
  prevBest = 0; saved = false; lastResult: GameResult | PlotGameResult | null = null;

  // Read-only views of the run, used by the frame loop and the HUD.
  get tower(): Tower | null { return this.run ? this.run.tower : null; }
  get block(): Block | null { return this.run ? this.run.block : null; }
  get hook(): Hook | null { return this.run ? this.run.hook : null; }
  get wind(): Wind { return this.run ? this.run.wind : CALM_WIND; }
  get craneY(): number { return this.run ? this.run.craneY : CFG.FOUND_H; }
  get lives(): number { return this.run ? this.run.lives : this.diff.lives; }
  get combo(): number { return this.run ? this.run.combo : 0; }
  get goldenNext(): boolean { return this.run ? this.run.goldenNext : false; }
  get anchors(): number { return this.run ? this.run.anchors : 0; }
  get score(): number { return this.run ? this.run.score : 0; }
  get pop(): number { return this.run ? this.run.pop : 0; }
  get perfects(): number { return this.run ? this.run.perfects : 0; }
  get focus(): number { return this.run ? this.run.focus : 1; }
  get weather(): WeatherCycle { return this.run ? this.run.wx : phaseAt(0); }
  get drops(): number { return this.run ? this.run.drops : 0; }

  get levelId(): string | null { return level.id; }
  get loadedPlotId(): string | null { return level.plotId; }
  // Fetch a level's assets and put them in the scene. Resolves to the list of files that failed (may be empty).
  async loadLevel(id: string, onProgress?: (fraction: number) => void): Promise<AssetError[]> {
    const { assets, errors } = await loadLevelAssets(id, onProgress, (aid, v) => { if (aid === 'music') Music.provide(id, v); });
    applyLevelAssets(id, assets as LevelAssets);
    return errors;
  }

  // Build the scene of one district plot of a city (near ring from the plot's own extract, rings and landmarks offset to it).
  // Resolves to the list of files that failed. Ticket 04 calls this before game.start().
  async loadPlot(cityId: string, plotId: string, onProgress?: (fraction: number) => void): Promise<AssetError[]> {
    const plot = (cityById(cityId)?.district?.plots || []).find((p) => p.id === plotId);
    if (!plot) throw new Error(`No plot "${plotId}" in ${cityId}`);
    // a real city has one OpenStreetMap extract per plot; fictional Newtown is the procedural city and has none
    const [{ assets, errors }, osm] = await Promise.all([
      loadLevelAssets(cityId, onProgress, (aid, v) => { if (aid === 'music') Music.provide(cityId, v); }), 'x' in plot.site ? null : loadPlotExtract(cityId, plotId)]);
    // the loaded files are typed by manifest id in LevelAssets; the extract is the plot's OSM json
    applyLevelAssets(cityId, assets as LevelAssets, plot, osm as OsmExtract | null);
    showDistrictTowers(cityId, plotId, cityProgress(loadDistrictProgress(), cityId).plots);
    return errors;
  }

  // Start a district plot (the scene of the plot must be loaded with loadPlot): its type, target, requirement, wind and weather.
  startPlot(cityId: string, plotId: string, diffKey: DifficultyId = settings.difficulty): void {
    const city = cityById(cityId) as Level, plot = (city.district as District).plots.find((p) => p.id === plotId) as Plot;
    this.clear();
    this.mode = 'plot'; this.diffKey = diffKey; this.diff = DIFFICULTY[diffKey] || DIFFICULTY.normal;
    this.cityId = cityId; this.plotId = plotId; this.plotDef = plot;
    // a level-shaped definition from the city (day arc, grade) with the plot's own target, type and weather; no events yet
    this.levelDef = { ...city, target: plot.target, weather: plot.weather, buildingType: plot.buildingType, events: [] };
    this.prevBest = 0; this.state = 'play'; this.paused = false; this.saved = false;
    People.setWalkers(9);
    this.run = new Run(this.diff, { level: this.levelDef, endless: false, windScale: plot.windScale });
    this.objects.push(makeFoundation(0, 0, plot.buildingType, city.city));
    this.ui.showHud();
  }

  start(mode: GameMode = this.mode, diffKey: DifficultyId = settings.difficulty, levelId = 'kosice'): void {
    this.clear(); this.plotDef = null; this.plotId = null;
    this.mode = mode; this.diffKey = diffKey; this.diff = DIFFICULTY[diffKey] || DIFFICULTY.normal;
    this.cityId = levelId; this.levelDef = mode === 'level' ? cityById(levelId) : null;
    this.prevBest = mode === 'level' ? 0 : (loadScores(levelId)[0]?.score || 0);
    this.state = 'play'; this.paused = false; this.saved = false;
    People.setWalkers(9);
    // Endless runs on the chosen city: its weather segments loop and only its events happen
    this.run = new Run(this.diff, { level: cityById(levelId), endless: mode !== 'level' });
    this.objects.push(makeFoundation(0, 0, this.run.buildingType ?? undefined, cityById(levelId)?.city));
    this.ui.showHud();
  }
  clear(): void {
    for (const m of this.floorMeshes) scene.remove(m);
    for (const o of this.objects) scene.remove(o);
    for (const d of this.debris) scene.remove(d.mesh);
    if (this.blockView) scene.remove(this.blockView.mesh);
    People.clear();
    this.objects = []; this.debris = []; this.floorMeshes = []; this.floorViews = []; this.blockView = null; this.run = null;
  }

  drop(): void { if (this.state === 'play' && !this.paused && this.run) this.run.drop(); }
  useAnchor(): void { if (this.state === 'play' && !this.paused && this.run) this.run.useAnchor(); }
  focusActive(): boolean { return !!(CFG.features.focus && this.keys.focus && this.focus > 0 && this.state === 'play' && !this.paused); }
  timeScale(rdt: number): number { return this.run ? this.run.timeScale(rdt, this.focusActive()) : 1; }

  step(dt: number): void {
    if (this.run) { this.run.step(dt); for (const ev of this.run.drain()) this.handle(ev); }
    this.stepDebris(dt);
  }

  // One core event -> what the player sees and hears.
  handle(ev: RunEvent): void {
    Music.event(ev.type);
    switch (ev.type) {
      case 'spawn': {
        const bt = BTYPES[ev.block];
        const color = ev.block !== 'normal' ? bt.color : ENDLESS_COLORS[Math.floor(ev.floor / 5) % ENDLESS_COLORS.length];
        this.blockView = { mesh: makeBlockMesh(color, bt.golden, ev.floor % 3, ev.block === 'normal' ? this.facadeStyle() : ''), appear: 0 };
        break;
      }
      case 'drop': Sfx.drop(); break;
      case 'anchor': this.ui.popup(S.pop.anchor, '#52d9ff'); Sfx.anchor(); break;
      case 'lightningWarning': this.flashV = Math.max(this.flashV, 0.25); this.ui.banner(S.banner.lightning, 1.5); Sfx.rumble(); break;
      case 'lightning': this.flashV = 1; strikeBolt(ev.x, ev.y, ev.z); Sfx.thunder(); break;
      case 'bounce': this.ui.popup(S.pop.boing, '#ff5fa2', true); Sfx.bounce(); FX.dust({ x: ev.x, y: ev.y, z: ev.z }, 0.5); break;
      case 'slip': this.blockToDebris({ ...ev }); Sfx.miss(); break;
      case 'miss': this.blockToDebris({ ...ev, av: { x: 1, y: 0.5, z: -1.5 } }); Sfx.miss(); break;
      case 'land': this.onLand(ev); break;
      case 'goldenNext': this.ui.banner(S.banner.goldenNext, 2); break;
      case 'anchorGained': this.ui.banner(S.banner.anchorGained, 2); break;
      case 'weather': this.ui.weather((this.run as Run).wx); Sfx.whoosh(); break;
      case 'gustWarning': this.ui.banner(S.banner.gust, 1.5); Sfx.rumble(); break;
      case 'gust': this.shake = Math.max(this.shake, 0.4); Sfx.whoosh(); break;
      case 'quakeWarning': this.ui.banner(S.banner.quakeWarning(ev.floor), 3); break;
      case 'quake': this.shake = CFG.quakeTime; this.ui.banner(S.banner.quake, CFG.quakeTime); Sfx.crash(); break;
      case 'collapse': {
        const meshes = this.floorMeshes.splice(ev.from); this.floorViews.splice(ev.from);
        ev.items.forEach((it, j) => this.addDebris({ mesh: meshes[j], p: it.p, v: it.v, av: it.av }));
        this.shake = 0.8; this.flashV = Math.max(this.flashV, 0.3);
        if (ev.items[0]) FX.dust(ev.items[0].p, 2);
        Sfx.crash();
        this.ui.popup(S.pop.collapse(ev.count), '#ff4d5e');
        break;
      }
      case 'lifeLost': if (ev.reason) this.ui.popup(S.pop.reasons[ev.reason] ?? ev.reason, '#ff4d5e'); break;
      case 'target': this.ui.popup(S.pop.target, '#ffd34d'); Sfx.golden(); break;
      case 'over': this.gameOver(ev.result); break;
      default: break;
    }
  }

  onLand(ev: Extract<RunEvent, { type: 'land' }>): void {
    const T = this.tower as Tower, mesh = (this.blockView as BlockView).mesh, p = T.pose(ev.floor);
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
      this.ui.popup(S.pop.perfect(ev.combo), '#ffb627');
    } else if (good) this.ui.popup(S.pop.good, '#5dff9b');
    else { this.ui.popup(S.pop.risky, '#ff4d5e'); this.shake = Math.max(this.shake, 0.25); }
    if (ev.golden) { this.ui.popup(S.pop.golden, '#ffd34d', true); Sfx.golden(); FX.ring(new THREE.Vector3(roof.x, roof.y + 0.05, roof.z), 0xffffff); }
  }

  // Facade style of the current building type; special blocks keep their own colour and plain facade.
  facadeStyle(): string { const t = buildingTypeById(this.run && this.run.buildingType); return t ? t.facade : ''; }

  blockToDebris(ev: { p: Vec3; v: Vec3; av: Vec3 }): void {
    if (!this.blockView) return;
    this.addDebris({ mesh: this.blockView.mesh, p: ev.p, v: ev.v, av: ev.av });
    this.blockView = null;
  }
  addDebris(it: DebrisSource): void {
    it.mesh.position.set(it.p.x, it.p.y, it.p.z); it.mesh.userData.warn.visible = false;
    this.debris.push({ mesh: it.mesh, p: it.mesh.position, v: { ...it.v }, av: { ...it.av }, t: 0 });
  }
  stepDebris(dt: number): void {
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
  syncTower(dt: number): void {
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

  // A plot run ended: does it count, save it with the district helpers, then show the plot result.
  finishPlot(result: RunResult): void {
    const cityId = this.cityId as string, plotId = this.plotId as string;
    const city = cityById(cityId) as Level, plot = this.plotDef as Plot, district = city.district as District;
    const r = { height: result.floors, reached: result.completed, livesLost: result.livesLost, perfects: result.perfects, landings: result.landings };
    const counts = resultCounts(plot, r), before = cityProgress(loadDistrictProgress(), cityId);
    const after = saveDistrictResult(cityId, plotId, r);
    const tot = districtTotals(district, after.plots), st = plotOf(after.plots, plotId);
    this.lastResult = {
      ...result, diff: this.diffKey, plotId: this.plotId, counts, stars: plotStars(plot, r), plot: r,
      best: st.bestHeight, residents: plotResidents(district, after.plots, plotId), bonuses: towerBonuses(district, after.plots, plotId),
      totals: tot, goalReached: after.goalReached, goalNew: after.goalReached && !before.goalReached,
      nextCity: nextLevel(cityId), nextPlot: nextPlot(district, after.plots),
    };
    if (result.completed) {
      const top = this.floorMeshes[this.floorMeshes.length - 1];
      if (top) { const crown = makeCrown(plot.buildingType); crown.position.y = CFG.H / 2; top.add(crown); }
    }
    if (counts) Sfx.fanfare(); else Sfx.over();
    setTimeout(() => { if (this.state === 'over') this.ui.plotDone(this.lastResult as PlotGameResult, plot, city); }, 1400);
  }

  gameOver(result: RunResult): void {
    if (this.state === 'over' || this.state === 'menu') return;
    this.state = 'over';
    this.lastResult = { ...result, diff: this.diffKey };
    if (this.plotDef) { this.finishPlot(result); return; }
    Sfx.over();
    setTimeout(() => { if (this.state === 'over') this.ui.gameOver(this.lastResult as GameResult, !this.levelDef && (this.lastResult as GameResult).score > this.prevBest && (this.lastResult as GameResult).score > 0); }, 1400);
  }
}

// Tower shown behind the main menu.
let demo: THREE.Object3D[] = [];
const DEMO_FLOORS = 10;   // floors are 2.8 tall now, so fewer of them fill the same skyline
export function buildDemo(levelId = 'kosice'): void {
  clearDemo();
  const lv = (levelById(levelId) || levelById('kosice')) as Level, type = lv.buildingType || 'panel', bt = BUILDING_TYPES[type];
  demo.push(makeFoundation(0, 0, type, lv.city));
  for (let i = 0; i < DEMO_FLOORS; i++) {
    const m = makeBlockMesh(ENDLESS_COLORS[Math.floor(i / 5) % ENDLESS_COLORS.length], false, i % 3, bt.facade);
    m.position.set(Math.sin(i * 1.7) * 0.25, CFG.FOUND_H + CFG.H * (i + 0.5), Math.cos(i * 1.3) * 0.2); demo.push(m);
  }
  demo.push(makeRoof(new THREE.Vector3(0, CFG.FOUND_H + CFG.H * DEMO_FLOORS, 0), type));
}
export function clearDemo(): void { for (const o of demo) scene.remove(o); demo = []; }
