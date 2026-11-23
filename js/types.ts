// Shared types of the simulation core and the game data (S0003). Pure types, no runtime code.
// Later batches import from here: `import type { Level, Plot } from './types.js'`.

// ---- Weather ----
export type WeatherKind = 'clear' | 'rain' | 'snow' | 'storm' | 'fog' | 'heatHaze' | 'sandstorm' | 'typhoon';

// One row of the weather table (config.js): physics numbers, sky look and the hint text.
export interface Weather {
  kind: WeatherKind; name: string;
  mu: number; base: number; gust: number;                    // friction, base wind, gust size
  top: number; bot: number; cover: number; cloud: number;    // sky top / horizon colours (0xRRGGBB), cloud cover, cloud colour
  sun: number; sunCol: number; hemi: number; night: number;  // light strength and colour, hemisphere light, how lit the windows are
  fog: [number, number]; sunDir: [number, number, number]; text: string;
  rain?: boolean; snow?: boolean; lightning?: boolean; gustEvent?: boolean;
}
// The weather at a floor: a table row plus idx, mult (strength) and seg (unique number per segment run).
export interface WeatherCycle extends Weather { idx: number; mult: number }
export interface WeatherPhase extends WeatherCycle { seg: number }
export interface WeatherSegment { fromFloor: number; kind: WeatherKind }
// The next weather change after a floor.
export interface NextWeather { at: number; left: number; wx: WeatherCycle }

// ---- Difficulty and building types ----
export type DifficultyId = 'easy' | 'normal' | 'hard';
export interface Difficulty {
  label: string; lives: number; perfect: number; good: number; swingAmp: number; swingSpeed: number;
  wind: number; sway: number; slide: number; score: number; desc: string;
  meters: { crane: number; wind: number; precision: number; lives: number };
  mass?: number;                                              // set by applyTrait only
}
export type BuildingTypeId = 'panel' | 'hotel' | 'office' | 'glass' | 'deco' | 'neon';
export interface Trait { perfect: number; mass: number; slide: number; wind: number }
export interface BuildingType {
  label: string; facade: string; variant: number; crown: string; sign: string | null;
  trait: Trait; nightVisibility: number; hint: string;
}
// A falling block's kind (config.js BTYPES), not to be confused with a BuildingType.
export type BlockKind = 'normal' | 'heavy' | 'light' | 'bouncy' | 'golden';
export interface BlockType { m: number; color: number; label: string; hint: string; bouncy?: boolean; golden?: boolean }

// ---- Levels, cities and plots ----
export interface DayArc { start: number; end: number }
export interface Grade { gain?: number[]; lift?: number[]; contrast?: number; saturation?: number; vignette?: number }
export interface LatLon { lat: number; lon: number }
export interface GridXZ { x: number; z: number }
export type Site = LatLon | GridXZ;
export interface PlotRequire { maxLivesLost?: number; minPerfectShare?: number }
export interface Plot {
  id: string; name: string; site: Site; buildingType: BuildingTypeId; target: number; require: PlotRequire;
  windScale: number; weather: WeatherSegment[]; landmarksInView: string[];
}
export interface District { goal: number; plots: Plot[] }
export interface Landmark { id: string; name: string; x: number; z: number; r: number }
// One city: a LEVELS entry (the real ones, only Kosice built) or Newtown. Unbuilt cities carry only the base fields.
export interface Level {
  id: string; city: string; country: string; order?: number; target: number; built: boolean;
  fictional?: boolean; openFromStart?: boolean;
  buildingType?: BuildingTypeId; site?: Site;
  weather?: WeatherSegment[]; events?: RunEventKind[];
  dayArc?: DayArc; grade?: Grade; palette?: unknown; track?: unknown;
  landmarks?: (string | Landmark)[]; rings?: { near: unknown; middle: unknown; far: unknown };
  district?: District;
}

// ---- A run ----
export type BlockState = 'hang' | 'fall';
export interface Block {
  state: BlockState; type: BlockKind; m: number; bouncy: boolean; golden: boolean;
  x: number; y: number; z: number; vx: number; vy: number; vz: number; lastVrx: number; lastVrz: number; bounced?: boolean;
}
export interface Vec3 { x: number; y: number; z: number }
export interface RunOptions { bx?: number; bz?: number; level?: Level | null; endless?: boolean; buildingType?: BuildingTypeId | null; windScale?: number }

// The result of a finished run (Run.end).
export interface RunResult {
  score: number; floors: number; pop: number; perfects: number; landings: number;
  completed: boolean; stars: number; livesLost: number;
}
// The shape the district rules read from a finished attempt.
export interface PlotResult { height: number; reached: boolean; livesLost: number; perfects: number; landings: number }
// What starsFor reads.
export type StarInput = Pick<PlotResult, 'reached' | 'livesLost' | 'perfects' | 'landings'>;

// Events the core collects with drain(); each carries `t` (run time in seconds). Only the kinds a level lists may happen.
export type RunEventKind = 'lightning' | 'quake' | 'sandstormGust';
export type RunEvent = { t: number } & (
  | { type: 'drop' } | { type: 'anchor' } | { type: 'goldenNext' } | { type: 'anchorGained' } | { type: 'quake' }
  | { type: 'gustWarning' } | { type: 'lightningWarning' }
  | { type: 'weather'; floor: number; kind: WeatherKind }
  | { type: 'lightning'; x: number; y: number; z: number } | { type: 'gust'; x: number; y: number; z: number }
  | { type: 'spawn'; block: BlockKind; floor: number }
  | { type: 'bounce'; x: number; y: number; z: number }
  | { type: 'slip'; offset: number; p: Vec3; v: Vec3; av: Vec3 }
  | { type: 'miss'; p: Vec3; v: Vec3 }
  | { type: 'land'; kind: 'perfect' | 'good' | 'risky'; offset: number; golden: boolean; combo: number; floor: number; x: number; z: number; roofY: number }
  | { type: 'quakeWarning'; floor: number }
  | { type: 'collapse'; from: number; count: number; items: CollapseItem[] }
  | { type: 'lifeLost'; reason: string | null; lives: number }
  | { type: 'target'; target: number; stars: number; livesLost: number }
  | { type: 'over'; result: RunResult }
);
export type RunEventType = RunEvent['type'];

// ---- Progress stores (localStorage, see settings.js) ----
export interface LevelProgress { stars: number; bestHeight: number }
export interface EndlessEntry { score: number; floors?: number; [key: string]: unknown }
export interface Progress { v: 1; levels: Record<string, LevelProgress>; opened: string[]; endless: Record<string, EndlessEntry[]> }
export interface PlotState { stars: number; bestHeight: number; residents: number; counted: boolean }
export type PlotStates = Record<string, PlotState>;
export interface CityProgress { plots: PlotStates; opened: boolean; goalReached: boolean }
export interface DistrictProgress { v: 2; cities: Record<string, CityProgress> }
export interface DistrictTotals { stars: number; maxStars: number; residents: number; goal: number; counted: number; plots: number }

export type QualityId = 'low' | 'medium' | 'high';
export interface Settings {
  difficulty: DifficultyId; sfx: number; music: number; quality: QualityId;
  shake: boolean; hints: boolean; muted: boolean; camera: number;
}

// ---- Physics (js/physics.ts) ----
export interface Vec2 { x: number; z: number }
export interface Wind { x: number; z: number; speed: number; angle: number; trend: number }
export interface Hook { x: number; z: number; vx: number; vz: number }
export interface StaticPose { x: number; z: number }
export interface Pose { x: number; z: number; vx: number; vz: number }
export interface TowerFloor { x: number; z: number; m: number; type: BlockKind }
export type FlyResult = { type: 'miss'; how: string } | { type: 'bounce' } | { type: 'land'; dx: number; dz: number; vrx: number; vrz: number };
export interface CollapseItem { index: number; type: BlockKind; p: Vec3; v: Vec3; av: Vec3 }
export interface CollapseInfo { from: number; count: number; items: CollapseItem[] }

// ── Rendering: OpenStreetMap extract of a plot (assets/levels/<city>/plots/<plot>.json, scripts/build-osm-level.mjs) ──
// Polygons and polylines are flat [x0, z0, x1, z1, ...] in metres (x east, z south, origin = the plot's site).
export type RoadKind = 'main' | 'street' | 'lane' | 'walk' | 'path' | 'rail';
export interface OsmRoad { k: RoadKind; w: number; p: number[]; n?: string; bike?: number; br?: number }
export interface OsmPoly { p: number[] }
export interface OsmBuilding extends OsmPoly { h?: number; lv?: number; a?: number; k?: 'theatre' | 'church'; n?: string }
export interface OsmPark extends OsmPoly { k?: 'pitch' | 'park' | 'wood' }
export interface OsmExtract {
  id?: string; source?: string; site?: Site; half: number; frame?: string;
  roads: OsmRoad[]; rails?: OsmPoly[]; stops?: [number, number][]; parking?: OsmPoly[];
  buildings: OsmBuilding[]; parks: OsmPark[]; water: OsmPoly[];
  names?: { name: string; at: [number, number] }[]; landmarks?: unknown;
}
// What a level's loaded assets hold (by manifest id): the sky HDRI, kit glTF scenes and textures, the OSM extract.
// Values are typed where the code reads them; glTF kit pieces are Object3D, textures THREE.Texture.
export type LevelAssets = Record<string, unknown> & { sky?: import('three').Texture; osm?: OsmExtract } & Partial<Record<'bench' | 'bush' | 'streetlight' | 'car_sedan' | 'car_hatchback', import('three').Object3D>>;
export interface Pt2 { x: number; z: number }
