// Where things may stand in an OpenStreetMap near ring, as plain data (no Three.js), and the audit that proves it.
// One `Site` holds every ground obstacle by its real size (buildings, carriageways by their width, bike lanes, tram beds, footways,
// basins with their rim, river, the player's plaza pad, finished district towers). Every placement rule of the near ring, the street
// life, the vegetation and the trams asks the site, so no rule can forget a kind of obstacle. `auditPlan` re-checks the finished plan
// from scratch (all objects against all obstacles and each other) and returns findings per category: Vitest runs it on every plot
// extract, the browser check runs it on the objects of the built scene.
// Frame: metres, x east, z south, origin = the plot's site = the tower. Deterministic: no random numbers, only position hashes.
import { cutPolyline, joinWays, makeRoute, pointAt, snapStops } from './tram-route.js';
import type { Route } from './tram-route.js';
import {
  boxHit, boxRing, circleRing, lineLength, lineOutside, offsetLine, overlapArea, pointInRing, pointLine, ringArea, ringBox,
  ringLine, ringRing,
} from './geometry2d.js';
import type { Box4, Line, Ring } from './geometry2d.js';
import { planCrossings, planMarkings } from './street-detail.js';
import type { Detail } from './street-detail.js';
import type { OsmBuilding, OsmExtract, OsmPoly, OsmRoad, Site as MapSite } from '../types.js';

export const PLAZA_HALF = 14;            // paved square around the tower
export const PAD_HALF = PLAZA_HALF + 2;  // nothing of the street network enters this square: the foundation stands on bare plaza
export const CLEAR = 24;                 // no buildings closer than this to the origin
export const BASIN_MAX = 1500;           // m2: water polygons smaller than this are fountains / pools (basin with a rim), larger ones are river
export const RIM_W = 0.9;                // stone rim of a basin, centred on the water edge
export const BED_W = 3.2;                // tram track bed
export const TOWER_R = 5;                // a finished district tower of another plot: foundation, step and canopy stand inside this circle (the step is 6.8 m square)
export const TOWER_MARGIN = 3;           // houses, trees and furniture keep this far from that circle; roads and footways keep their half width plus 0.5 m
export const hash = (x: number, z: number): number => { const s = Math.sin(x * 12.9898 + z * 78.233) * 43758.5453; return s - Math.floor(s); };
export const insideRing = pointInRing;
export const polyArea = ringArea;

// ── what stands where, with the sizes the renderers really draw ──
export interface Obs { r: Ring; box: Box4 }
export interface Strip { p: Line; w: number; box: Box4; id: number }
export interface Circle { x: number; z: number; r: number }
const strip = (p: Line, w: number, id: number): Strip => { const b = ringBox(p); return { p, w, id, box: [b[0] - w / 2, b[1] - w / 2, b[2] + w / 2, b[3] + w / 2] }; };
const obs = (r: Ring): Obs => ({ r, box: ringBox(r) });

export interface Site {
  half: number;
  buildings: (Obs & { i: number; n?: string })[];      // i = index in osm.buildings
  carriage: Strip[];                                   // main / street / lane, drawn as ribbons of their width
  foot: Strip[];                                       // walk / path (cycleways included: they are footways with `bike`)
  basins: Obs[];                                       // water under BASIN_MAX: rim 0.9 m centred on the edge
  river: Obs[];                                        // bigger water
  bikes: Strip[];                                      // bike lanes planned on the streets (filled by planBikes)
  tram: Strip[];                                       // track beds (filled by planTram)
  towers: Circle[];                                    // finished towers of other plots inside this extract
  landmarks: Obs[];                                    // footprints of the hand-built landmark models (js/core/landmark-sites.ts): fountain rim, column base, cathedral ...
}

// The street network without the pad square around the tower (S0002 10: no road, footway, rail or bike lane under the foundation);
// rails are also cut where the extract ends, so a line never floats over the middle ring. Small water touching the pad is dropped.
export function trimNetwork(osm: OsmExtract, towers: Circle[] = []): OsmExtract {
  const edge: Box4 = [-osm.half, -osm.half, osm.half, osm.half];
  // the pad grows by half the width of what is cut, so a ribbon never reaches into the plaza with its corners
  const roads: OsmRoad[] = [];
  for (const r of osm.roads) {
    const g = PAD_HALF + r.w / 2, pad: Box4 = [-g, -g, g, g];
    for (const p of cutPolyline(r.p, [pad], (x, z) => !(Math.abs(x) < g && Math.abs(z) < g))) roads.push({ ...r, p });
  }
  const g = PAD_HALF + BED_W / 2, pad: Box4 = [-g, -g, g, g], rails: OsmPoly[] = [];
  for (const r of osm.rails || []) for (const p of cutPolyline(r.p, [pad, edge], (x, z) => !(Math.abs(x) < g && Math.abs(z) < g) && Math.abs(x) < osm.half && Math.abs(z) < osm.half)) rails.push({ p });
  const small = (w: OsmPoly): boolean => Math.abs(polyArea(w.p)) < BASIN_MAX;
  const touchesPad = (w: OsmPoly): boolean => { for (let i = 0; i < w.p.length; i += 2) if (Math.abs(w.p[i]) < PAD_HALF + 2 && Math.abs(w.p[i + 1]) < PAD_HALF + 2) return true; return pointInRing(w.p, 0, 0); };
  const onTower = (w: OsmPoly): boolean => towers.some((t) => ringRing(w.p, circleRing(t.x, t.z, t.r + TOWER_MARGIN + RIM_W, 12)) === 0);
  return { ...osm, roads, rails, water: osm.water.filter((w) => !(small(w) && (touchesPad(w) || onTower(w)))) };
}

// Indices of the footprints that become houses: none within CLEAR of the tower, and where two footprints overlap (OpenStreetMap often
// holds a building and its parts twice) the smaller one is dropped. (A footprint replaced by a hand-built landmark still counts as an
// obstacle; the renderer just does not draw it.)
export function keptBuildings(osm: OsmExtract, towers: Circle[] = [], landmarks: Ring[] = []): number[] {
  const cand: number[] = [];
  osm.buildings.forEach((bd, i) => {
    const p = bd.p; if (p.length < 6) return;
    let near = Infinity; for (let k = 0; k < p.length; k += 2) near = Math.min(near, Math.hypot(p[k], p[k + 1]));
    if (near < CLEAR || pointInRing(p, 0, 0)) return;
    if (towers.some((t) => ringRing(p, circleRing(t.x, t.z, t.r + TOWER_MARGIN, 12)) === 0)) return;
    if (landmarks.some((l) => ringRing(p, l) === 0)) return;                   // a model stands there (its own OSM footprint included)
    cand.push(i);
  });
  const boxes = cand.map((i) => ringBox(osm.buildings[i].p)), areas = cand.map((i) => Math.abs(polyArea(osm.buildings[i].p))), gone = new Set<number>();
  for (let a = 0; a < cand.length; a++) for (let b = a + 1; b < cand.length; b++) {
    if (gone.has(a) || gone.has(b) || !boxHit(boxes[a], boxes[b])) continue;
    const small = areas[a] <= areas[b] ? a : b, ov = overlapArea(osm.buildings[cand[a]].p, osm.buildings[cand[b]].p, 0.5);
    if (ov > Math.max(1, 0.1 * areas[small])) gone.add(small);
  }
  return cand.filter((_, k) => !gone.has(k));
}

// A street, lane or footway is cut wherever it runs through a house (the house wins): carriageways keep 80 % of their half width
// clear of a wall (a car in the right lane is 1.75 m off the centre and 2 m wide), footways 0.6 m (a walker is 0.5 m off the centre).
// Cars, people, bike lanes and furniture all follow the cut lines.
export function clipNetwork(osm: OsmExtract, kept: number[], towers: Circle[] = [], landmarks: Ring[] = []): OsmExtract {
  const houses = [...kept.map((i) => obs(osm.buildings[i].p)), ...landmarks.map(obs)], roads: OsmRoad[] = [], posts = towers.map((t) => obs(circleRing(t.x, t.z, t.r, 12)));
  for (const r of osm.roads) {
    const gap = r.k === 'walk' || r.k === 'path' ? 0.6 : r.w / 2 * 0.8;
    let parts = lineOutside(r.p, houses, gap, 2);
    if (posts.length) parts = parts.flatMap((p) => lineOutside(p, posts, r.w / 2 + 0.5, 2));     // a finished tower of another plot: no street under it
    if (parts.length === 1 && parts[0].length === r.p.length && parts[0].every((v, k) => v === r.p[k])) roads.push(r);
    else for (const p of parts) roads.push({ ...r, p });
  }
  return { ...osm, roads };
}

// The finished towers of the other plots of a district as circles round their sites, in the frame of the plot being played.
// `city` is the city's site (the frame of plotOffset in js/level-scene.ts); only towers that fall inside the extract are returned.
export function towerCircles(city: MapSite | undefined, plots: { id: string; site: MapSite }[], playedId: string, half = 250): Circle[] {
  const me = plots.find((p) => p.id === playedId); if (!me || !city) return [];
  const at = (q: MapSite): { x: number; z: number } => ('x' in q ? { x: q.x, z: q.z } : { x: q.lon * 111320 * Math.cos(('lat' in city ? city.lat : q.lat) * Math.PI / 180), z: -q.lat * 111320 });
  const o = at(me.site), out: Circle[] = [];
  for (const q of plots) {
    if (q.id === playedId) continue;
    const p = at(q.site), x = p.x - o.x, z = p.z - o.z;
    if (Math.abs(x) < half + 20 && Math.abs(z) < half + 20) out.push({ x, z, r: TOWER_R });
  }
  return out;
}

export function makeSite(osm: OsmExtract, kept: number[] = keptBuildings(osm), towers: Circle[] = [], landmarks: Ring[] = []): Site {
  const roads = osm.roads;
  return {
    half: osm.half,
    buildings: kept.map((i) => ({ ...obs(osm.buildings[i].p), i, n: (osm.buildings[i] as OsmBuilding).n })),
    carriage: roads.map((r, id) => ({ r, id })).filter(({ r }) => r.k === 'main' || r.k === 'street' || r.k === 'lane').map(({ r, id }) => strip(r.p, r.w, id)),
    foot: roads.map((r, id) => ({ r, id })).filter(({ r }) => r.k === 'walk' || r.k === 'path').map(({ r, id }) => strip(r.p, r.w, id)),
    basins: osm.water.filter((g) => Math.abs(polyArea(g.p)) < BASIN_MAX).map((g) => obs(g.p)),
    river: osm.water.filter((g) => Math.abs(polyArea(g.p)) >= BASIN_MAX).map((g) => obs(g.p)),
    bikes: [], tram: [], towers, landmarks: landmarks.map(obs),
  };
}

// ── the kinds of things that are placed, and what each must keep away from ──
export type Kind = 'person' | 'sitter' | 'tree' | 'hedge' | 'bed' | 'bush' | 'lamp' | 'carStreet' | 'carLot' | 'bench' | 'bin' | 'bollard' | 'rack' | 'planter' | 'kiosk' | 'stop' | 'sign'
  | 'shop' | 'terrace' | 'busker' | 'pole' | 'platform' | 'padSlab' | 'tower' | 'bikeLane' | 'tramBed' | 'block'
  | 'kerb' | 'zebra' | 'dash' | 'manhole' | 'drain' | 'tlight';
// Clearances in metres between the object's footprint and the real edge of the obstacle (undefined = that obstacle does not matter).
// foot: 'full' = the whole width of the footway, number = that many metres from its centre line. Objects never overlap each other (`solid`).
interface Rule { b?: number; road?: number; foot?: 'full' | number; bike?: number; tram?: number; basin?: number; river?: number; pad?: boolean; tower?: boolean; solid?: boolean }
export const RULES: Record<Kind, Rule> = {
  person: { b: 0.1, road: 0.1, bike: 0.1, tram: 0.1, basin: 0.3, river: 0.3, pad: false, tower: true, solid: true },    // someone standing: never inside a bench, bin or kiosk
  sitter: { b: 0.1, road: 0.1, bike: 0.1, tram: 0.1, basin: 0.3, river: 0.3, pad: false, tower: true },    // someone sitting on a bench: the bench is under them, so not solid
  tree: { b: 0.4, road: 0.3, foot: 'full', bike: 0.2, tram: 0.2, basin: 0.3, river: 0.3, pad: true, tower: true, solid: true },
  hedge: { b: 0.2, road: 0.2, foot: 'full', bike: 0.2, tram: 0.2, basin: 0.3, river: 0.3, pad: true, tower: true },
  bed: { b: 0.4, road: 0.3, foot: 'full', bike: 0.2, tram: 0.2, basin: 0.3, river: 0.3, pad: true, tower: true, solid: true },
  bush: { b: 0.2, road: 0.2, foot: 0.3, bike: 0.2, tram: 0.2, basin: 0.3, river: 0.3, pad: true, tower: true, solid: true },
  lamp: { b: 0.2, road: 0.2, foot: 0.3, bike: 0.2, tram: 0.2, basin: 0.3, river: 0.3, pad: true, tower: true, solid: true },
  carStreet: { b: 0.2, bike: 0.1, tram: 0.1, basin: 0.3, river: 0.3, foot: 0.3, pad: true, tower: true, solid: true },
  carLot: { b: 0.2, road: 0.1, bike: 0.1, tram: 0.1, basin: 0.3, river: 0.3, foot: 0.3, pad: true, tower: true, solid: true },
  bench: { b: 0.2, road: 0.2, foot: 0.3, bike: 0.2, tram: 0.2, basin: 0.3, river: 0.3, pad: true, tower: true, solid: true },
  bin: { b: 0.1, road: 0.2, foot: 0.3, bike: 0.2, tram: 0.2, basin: 0.3, river: 0.3, pad: true, tower: true, solid: true },
  bollard: { b: 0.1, road: 0.1, foot: 0.3, bike: 0.1, tram: 0.1, basin: 0.2, river: 0.3, pad: true, tower: true, solid: true },
  rack: { b: 0.2, road: 0.2, foot: 0.3, bike: 0.2, tram: 0.2, basin: 0.3, river: 0.3, pad: true, tower: true, solid: true },
  planter: { b: 0.2, road: 0.2, foot: 0.3, bike: 0.2, tram: 0.2, basin: 0.3, river: 0.3, pad: true, tower: true, solid: true },
  kiosk: { b: 0.2, road: 0.2, foot: 0.3, bike: 0.2, tram: 0.2, basin: 0.3, river: 0.3, pad: true, tower: true, solid: true },
  stop: { b: 0.2, road: 0.2, foot: 0.3, bike: 0.2, tram: 0.2, basin: 0.3, river: 0.3, pad: true, tower: true, solid: true },
  sign: { b: 0.1, road: 0.1, foot: 0.3, bike: 0.1, tram: 0.1, basin: 0.3, river: 0.3, pad: true, tower: true, solid: true },
  shop: { road: 0.1, bike: 0.1, tram: 0.1, basin: 0.3, river: 0.3, pad: true, tower: true },            // stands against a wall: the wall is its host
  terrace: { b: 0.2, road: 0.2, foot: 0.3, bike: 0.2, tram: 0.2, basin: 0.3, river: 0.3, pad: true, tower: true, solid: true },
  busker: { b: 0.2, road: 0.2, foot: 0.3, bike: 0.2, tram: 0.2, basin: 0.3, river: 0.3, pad: true, tower: true, solid: true },
  pole: { b: 0.1, road: 0.1, bike: 0.1, basin: 0.3, river: 0.3, pad: true, tower: true },
  platform: { b: 0.2, bike: 0.1, basin: 0.3, river: 0.3, pad: true, tower: true },
  padSlab: { b: 0, road: 0, foot: 'full', bike: 0, tram: 0, basin: 0, river: 0 },                                 // the plaza the tower stands on
  block: { road: 0.5, foot: 'full', tower: true, solid: true },                                                   // a house of the procedural city (Newtown)
  tower: { b: TOWER_MARGIN, road: 0.5, foot: 'full', bike: 0.2, tram: 0.2, basin: TOWER_MARGIN, river: TOWER_MARGIN },   // a finished tower of another plot (its circle)
  bikeLane: { b: 0.1, basin: 0.5, river: 0.5, tram: 0.1, pad: true, tower: true },
  tramBed: { b: 0.1, basin: 0.3, river: 0.3, pad: true, tower: true },
  // street detail (S0004 03): kerbs stand on the edge of their own carriageway and are cut where another street, a lane, a bed or water is
  kerb: { b: 0, road: 0, bike: 0, tram: 0, basin: 0.3, river: 0.3, pad: true, tower: true },
  zebra: { b: 0.2, road: 0, bike: 0.1, tram: 0.1, basin: 0.3, river: 0.3, pad: true, tower: true, solid: true },     // paint on its own street: nothing else stands on it
  dash: { b: 0.1, road: 0, bike: 0.1, tram: 0.1, basin: 0.3, river: 0.3, pad: true, tower: true },
  manhole: { b: 0.2, road: 0, bike: 0.1, tram: 0.1, basin: 0.3, river: 0.3, pad: true, tower: true },
  drain: { b: 0.2, road: 0, bike: 0.1, tram: 0.1, basin: 0.3, river: 0.3, pad: true, tower: true },
  tlight: { b: 0.2, road: 0.2, foot: 0.3, bike: 0.2, tram: 0.2, basin: 0.3, river: 0.3, pad: true, tower: true, solid: true },
};

export interface Placed { kind: Kind; x: number; z: number; ring: Ring; rot?: number; own?: number }   // own: index of the carriageway the object belongs to (exempt)
const padHit = (ring: Ring): boolean => { const b = ringBox(ring); return b[2] > -PAD_HALF && b[0] < PAD_HALF && b[3] > -PAD_HALF && b[1] < PAD_HALF; };

// What an object would run into: the list of obstacle categories it overlaps or comes too close to ([] = free).
export function hits(site: Site, o: Placed): string[] {
  const rule = RULES[o.kind], ring = o.ring, box = ringBox(ring), out: string[] = [];
  if (rule.b !== undefined) for (const b of site.buildings) { if (boxHit(box, b.box, rule.b) && ringRing(ring, b.r) < rule.b) { out.push('building'); break; } }
  if (rule.b !== undefined) {              // the finished tower of the next plot stands 6 m from the Singing Fountain of Cathedral square (real geometry): its circle may come within 0.5 m of a landmark
    const lb = o.kind === 'tower' ? Math.min(rule.b, 0.5) : rule.b;
    for (const b of site.landmarks ?? []) { if (boxHit(box, b.box, lb) && ringRing(ring, b.r) < lb) { out.push('landmark'); break; } }
  }
  if (rule.road !== undefined) for (const s of site.carriage) {
    if (s.id === o.own || !boxHit(box, s.box, rule.road)) continue;
    if (ringLine(ring, s.p, box, s.w / 2 + rule.road) < s.w / 2 + rule.road) { out.push('road'); break; }
  }
  if (rule.foot !== undefined) for (const s of site.foot) {
    const reach = rule.foot === 'full' ? s.w / 2 + 0.2 : rule.foot;
    if (!boxHit(box, s.box, reach)) continue;
    if (ringLine(ring, s.p, box, reach) < reach) { out.push('footway'); break; }
  }
  if (rule.bike !== undefined) for (const s of site.bikes) { if (boxHit(box, s.box, rule.bike) && ringLine(ring, s.p, box, s.w / 2 + rule.bike) < s.w / 2 + rule.bike) { out.push('bike'); break; } }
  if (rule.tram !== undefined) for (const s of site.tram) { if (boxHit(box, s.box, rule.tram) && ringLine(ring, s.p, box, s.w / 2 + rule.tram) < s.w / 2 + rule.tram) { out.push('tram'); break; } }
  if (rule.basin !== undefined) for (const b of site.basins) { if (boxHit(box, b.box, RIM_W / 2 + rule.basin) && ringRing(ring, b.r) < RIM_W / 2 + rule.basin) { out.push('basin'); break; } }
  if (rule.river !== undefined) for (const b of site.river) { if (boxHit(box, b.box, rule.river) && ringRing(ring, b.r) < rule.river) { out.push('river'); break; } }
  if (rule.pad && padHit(ring)) out.push('pad');
  if (rule.tower) for (const t of site.towers) { if (ringRing(ring, circleRing(t.x, t.z, t.r + TOWER_MARGIN, 12)) === 0) { out.push('tower'); break; } }
  return out;
}

// ── footprints of the things we place ──
const OBB: Record<string, [number, number]> = {          // half length (local x), half depth (local z), metres
  bench: [1.0, 0.35], bin: [0.3, 0.3], bollard: [0.12, 0.12], rack: [0.8, 0.9], planter: [0.6, 0.6], kiosk: [1.2, 1.0], stop: [1.8, 0.9], sign: [0.15, 0.15],
  shop: [1.7, 0.3], terrace: [1.5, 1.0], busker: [0.8, 0.4], carStreet: [0.95, 2.2], carLot: [0.95, 2.2],
};
export const footprint = (kind: Kind, x: number, z: number, rot = 0): Ring => {
  if (kind === 'tree') return circleRing(x, z, 0.5, 8);
  if (kind === 'person' || kind === 'sitter') return circleRing(x, z, 0.3, 6);
  if (kind === 'lamp') return circleRing(x, z, 0.2, 6);
  if (kind === 'bush') return circleRing(x, z, 0.6, 8);
  if (kind === 'pole') return circleRing(x, z, 0.15, 6);
  if (kind === 'hedge') return boxRing(x, z, 0.7, 0.45, rot);
  const [hx, hz] = OBB[kind] || [0.5, 0.5];
  return boxRing(x, z, hx, hz, rot);
};

export interface Finding { cat: string; kind: string; x: number; z: number; with?: string; amount?: number }
// Everything that was placed, grouped by what it is; the renderers draw exactly these.
export interface Plan {
  osm: OsmExtract;                                     // the network as drawn: trimmed at the pad and cut at houses
  site: Site;
  trees: [number, number, number, number][]; hedges: [number, number, number, number][]; beds: [number, number, number, number, number][]; bushes: [number, number][];
  lamps: number[][]; cars: number[][]; carKinds: ('street' | 'lot')[];
  bikeLanes: { p: Line; w: number; cycleway: boolean }[]; bikeRoutes: { p: Line; len: number; d: number }[];
  items: Record<string, number[][]>; benches: number[][]; shops: { x: number; z: number; rot: number; d: number }[]; terraces: { x: number; z: number; rot: number }[]; musicians: { x: number; z: number; rot: number }[];
  sit: { x: number; z: number; rot: number }[]; stand: { x: number; z: number; rot: number; mate: boolean }[];
  tramLines: Route[]; tramBeds: { p: Line; paved: boolean }[]; poles: [number, number, number][]; platforms: { x: number; z: number; r: number; s: number; line: number }[];
  detail: Detail;                                      // kerbs, crossings, markings, manholes, traffic lights (js/core/street-detail.ts)
  placed: Placed[];                                    // every object above as a footprint, for the audit
  routes: { car: Line[]; carInfo: { ow: number; w: number; ln: number }[]; walk: Line[]; bike: Line[] };   // carInfo[i]: one-way direction (0 = two-way), carriageway width and lanes of car[i]
  dropped: Record<string, number>;
}

const lineLen = lineLength;
const dOf = (p: number[]): number => { let d = Infinity; for (let i = 0; i < p.length; i += 2) d = Math.min(d, Math.hypot(p[i], p[i + 1])); return d; };

export function planNearRing(osm0: OsmExtract, opts: { towers?: Circle[]; landmarks?: Ring[] } = {}): Plan {
  const towers = opts.towers || [], lms = opts.landmarks || [], kept = keptBuildings(osm0, towers, lms), osm = clipNetwork(trimNetwork(osm0, towers), kept, towers, lms), site = makeSite(osm, kept, towers, lms);
  const plan: Plan = {
    osm, site, trees: [], hedges: [], beds: [], bushes: [], lamps: [], cars: [], carKinds: [], bikeLanes: [], bikeRoutes: [], items: { bin: [], bollard: [], rack: [], planter: [], kiosk: [], stop: [], sign: [] }, benches: [],
    shops: [], terraces: [], musicians: [], sit: [], stand: [], tramLines: [], tramBeds: [], poles: [], platforms: [], detail: null as unknown as Detail, placed: [], routes: { car: [], carInfo: [], walk: [], bike: [] }, dropped: {},
  };
  const bbIn = (x: number, z: number, m = 0): boolean => Math.abs(x) < osm.half - m && Math.abs(z) < osm.half - m;
  const clearPlaza = (x: number, z: number): boolean => Math.abs(x) < PLAZA_HALF + 2 && Math.abs(z) < PLAZA_HALF + 2;
  const drop = (k: string): void => { plan.dropped[k] = (plan.dropped[k] || 0) + 1; };
  // try to place: the object is kept (and registered as a footprint) only when the site has room for it
  const place = (kind: Kind, x: number, z: number, rot = 0, own?: number, ring?: Ring): boolean => {
    const o: Placed = { kind, x, z, rot, own, ring: ring || footprint(kind, x, z, rot) };
    if (hits(site, o).length) { drop(kind); return false; }
    plan.placed.push(o); return true;
  };
  const solidFree = (kind: Kind, x: number, z: number, rot = 0, own?: number, ring?: Ring): boolean => {      // also clear of the solid objects already placed
    const o: Placed = { kind, x, z, rot, own, ring: ring || footprint(kind, x, z, rot) };
    if (hits(site, o).length) { drop(kind); return false; }
    if (RULES[kind].solid) { const b = ringBox(o.ring); for (const q of plan.placed) if (RULES[q.kind].solid && Math.abs(q.x - x) < 6 && Math.abs(q.z - z) < 6 && boxHit(b, ringBox(q.ring), 0.05) && ringRing(o.ring, q.ring) < 0.05) { drop(kind); return false; } }
    plan.placed.push(o); return true;
  };

  // ── tram lines first (they are obstacles for everything else) ──
  planTram(osm, plan, bbIn, solidFree);
  // ── street detail (S0004 03): crossings and lights first (the bike lanes stop short of them), kerbs and markings after the lanes ──
  const zebraRings: Ring[] = [];
  const dctx = {
    isCarriage: (r: OsmRoad) => r.k === 'main' || r.k === 'street' || r.k === 'lane', bbIn, clearPlaza,
    place: (kind: Kind, x: number, z: number, rot: number, own: number | undefined, ring: Ring, solid: boolean): boolean => {
      if (!solid) {       // paint does not run across a crossing
        for (const zr of zebraRings) if (ringRing(ring, zr) < 0.4) return false;
        return place(kind, x, z, rot, own, ring);
      }
      const ok = solidFree(kind, x, z, rot, own, ring); if (ok && kind === 'zebra') zebraRings.push(ring); return ok;
    },
  };
  plan.detail = planCrossings(osm, dctx);
  planBikes(osm, plan, zebraRings);
  planMarkings(osm, dctx, plan.detail);

  // ── vegetation in the parks ──
  for (const g of osm.parks) {
    if (g.k === 'pitch') continue;
    const [x0, z0, x1, z1] = ringBox(g.p), step = g.k === 'wood' ? 5 : 9;
    for (let x = x0; x < x1; x += step) for (let z = z0; z < z1; z += step) {
      const jx = x + (hash(x, z) - 0.5) * step * 0.8, jz = z + (hash(z, x) - 0.5) * step * 0.8;
      if (!bbIn(jx, jz, 10) || clearPlaza(jx, jz) || !pointInRing(g.p, jx, jz)) continue;
      if (solidFree('tree', jx, jz)) plan.trees.push([jx, jz, 0.8 + hash(jx, jz) * 0.7, Math.floor(hash(jz, jx) * 3)]);
    }
    for (let i = 0; i < g.p.length; i += 12) if (plan.bushes.length < 70 && bbIn(g.p[i], g.p[i + 1], 10) && !clearPlaza(g.p[i], g.p[i + 1])) { if (solidFree('bush', g.p[i], g.p[i + 1])) plan.bushes.push([g.p[i], g.p[i + 1]]); }
  }
  // hedge rows: lumps 1.3 m apart, half a metre inside the kerb, on about every second long edge of the bigger parks
  for (const g of osm.parks) {
    if (g.k === 'pitch' || Math.abs(polyArea(g.p)) < 200) continue;
    const sg = polyArea(g.p) >= 0 ? 1 : -1;
    for (let i = 0, n = g.p.length / 2; i < n; i++) {
      const j = (i + 1) % n, x0 = g.p[2 * i], z0 = g.p[2 * i + 1], dx = g.p[2 * j] - x0, dz = g.p[2 * j + 1] - z0, l = Math.hypot(dx, dz);
      if (l < 6 || hash(x0, z0) < 0.5 || plan.hedges.length > 420) continue;
      const nx = -dz / l * sg, nz = dx / l * sg, gap = 1.25;
      for (let s = 0.8; s < l - 0.8; s += gap) {
        const x = x0 + dx / l * s + nx * 0.55, z = z0 + dz / l * s + nz * 0.55, rot = Math.atan2(dx, dz) + Math.PI / 2;
        if (bbIn(x, z, 10) && !clearPlaza(x, z) && pointInRing(g.p, x, z) && place('hedge', x, z, rot)) plan.hedges.push([x, z, rot, 0.85 + hash(x, z) * 0.3]);
      }
    }
  }
  for (const g of osm.parks) {   // flower beds: a few per bigger park, away from the trees
    if (g.k === 'pitch' || g.k === 'wood' || Math.abs(polyArea(g.p)) < 250) continue;
    const [x0, z0, x1, z1] = ringBox(g.p); let got = 0;
    for (let k = 0; k < 60 && got < 2 && plan.beds.length < 36; k++) {
      const x = x0 + hash(k, x0) * (x1 - x0), z = z0 + hash(z0, k) * (z1 - z0), r = hash(x, z) * Math.PI;
      if (!bbIn(x, z, 12) || clearPlaza(x, z)) continue;
      const ok = [[2.2, 0], [-2.2, 0], [0, 1.2], [0, -1.2]].every(([u, v]) => pointInRing(g.p, x + u * Math.cos(r) + v * Math.sin(r), z - u * Math.sin(r) + v * Math.cos(r)));
      if (!ok || plan.trees.some((q) => Math.hypot(q[0] - x, q[1] - z) < 3.2) || plan.beds.some((q) => Math.hypot(q[0] - x, q[1] - z) < 8)) continue;
      if (solidFree('bed', x, z, r, undefined, boxRing(x, z, 1.8, 0.85, r))) { plan.beds.push([x, z, r, 3.6, 1.7]); got++; }
    }
  }

  // ── street lights and parked cars along the streets ──
  let carN = 0;
  osm.roads.forEach((r, ri) => {
    if (r.k !== 'main' && r.k !== 'street') return;
    const gap = r.k === 'main' ? 30 : 46;
    let acc = 6;
    for (let i = 0; i + 3 < r.p.length; i += 2) {
      const x0 = r.p[i], z0 = r.p[i + 1], dx = r.p[i + 2] - x0, dz = r.p[i + 3] - z0, l = Math.hypot(dx, dz);
      if (l < 1) continue;
      const tx = dx / l, tz = dz / l, nx = -tz, nz = tx, rot = Math.atan2(tx, tz);
      for (let s = acc; s < l; s += gap) {
        const x = x0 + tx * s, z = z0 + tz * s, side = (Math.floor(x * 7 + z * 3) & 1) ? 1 : -1, off = r.w / 2 + 1.2;
        const lx = x + nx * off * side, lz = z + nz * off * side;
        if (plan.lamps.length < 40 && bbIn(lx, lz, 8) && !clearPlaza(lx, lz) && solidFree('lamp', lx, lz)) plan.lamps.push([lx, 0.03, lz, Math.atan2(-nx * side, -nz * side)]);
        const t = hash(x, z);
        if (t < 0.7 && carN < 120 && r.w >= 5.5) {
          const cx = x + tx * 9 - nx * (r.w / 2 - 1.3) * side, cz = z + tz * 9 - nz * (r.w / 2 - 1.3) * side, crot = rot + (t < 0.27 ? 0 : Math.PI);
          if (bbIn(cx, cz, 8) && !clearPlaza(cx, cz) && solidFree('carStreet', cx, cz, crot, ri)) { plan.cars.push([cx, 0.04, cz, crot]); plan.carKinds.push('street'); carN++; }
        }
      }
      acc = ((acc - l) % gap + gap) % gap;
    }
  });
  // parked cars in the car parks: bays in rows along the long side of the lot, about two thirds taken
  for (const g of osm.parking || []) {
    if (Math.abs(polyArea(g.p)) < 120) continue;
    const n = g.p.length / 2; let cx = 0, cz = 0, sxx = 0, szz = 0, sxz = 0;
    for (let i = 0; i < n; i++) { cx += g.p[2 * i]; cz += g.p[2 * i + 1]; } cx /= n; cz /= n;
    for (let i = 0; i < n; i++) { const dx = g.p[2 * i] - cx, dz = g.p[2 * i + 1] - cz; sxx += dx * dx; szz += dz * dz; sxz += dx * dz; }
    const th = 0.5 * Math.atan2(2 * sxz, sxx - szz), ux = Math.cos(th), uz = Math.sin(th), vx = -uz, vz = ux;
    let u0 = 1e9, u1 = -1e9, v0 = 1e9, v1 = -1e9;
    for (let i = 0; i < n; i++) { const dx = g.p[2 * i] - cx, dz = g.p[2 * i + 1] - cz, u = dx * ux + dz * uz, v = dx * vx + dz * vz; u0 = Math.min(u0, u); u1 = Math.max(u1, u); v0 = Math.min(v0, v); v1 = Math.max(v1, v); }
    for (let v = v0 + 2.8; v < v1 - 2.4; v += 5.4) for (let u = u0 + 1.6; u < u1 - 1.6; u += 2.7) {
      const x = cx + ux * u + vx * v, z = cz + uz * u + vz * v;
      if (hash(x * 1.3, z * 0.7) > 0.66 || !bbIn(x, z, 8) || clearPlaza(x, z) || !pointInRing(g.p, x, z)) continue;
      const ok = [[1.2, 0], [-1.2, 0], [0, 2.4], [0, -2.4]].every(([a, b]) => pointInRing(g.p, x + ux * a + vx * b, z + uz * a + vz * b));
      const crot = Math.atan2(vx, vz) + (hash(z, x) < 0.5 ? 0 : Math.PI);
      if (ok && solidFree('carLot', x, z, crot)) { plan.cars.push([x, 0.074, z, crot]); plan.carKinds.push('lot'); }
    }
  }
  const order = plan.cars.map((_, i) => i).sort((a, b) => Math.hypot(plan.cars[a][0], plan.cars[a][2]) - Math.hypot(plan.cars[b][0], plan.cars[b][2]));
  plan.cars = order.map((i) => plan.cars[i]); plan.carKinds = order.map((i) => plan.carKinds[i]);

  planStreetLife(osm, plan, bbIn, clearPlaza, solidFree);
  planRoutes(osm, plan);
  return plan;
}

// ── bike lanes ──
function planBikes(osm: OsmExtract, plan: Plan, crossings: Ring[] = []): void {
  const { site } = plan, obstacles = [...site.buildings.map((b) => ({ r: b.r, box: b.box })), ...site.basins, ...site.river, ...crossings.map((r) => ({ r, box: ringBox(r) }))];
  const cut = (p: Line, w: number): Line[] => lineOutside(p, obstacles, w / 2 + 0.3, 8);
  const lenOf = lineLen;
  const add = (p: Line, w: number, cycleway: boolean, route: boolean): void => {
    for (const q of cut(p, w)) {
      plan.bikeLanes.push({ p: q, w, cycleway }); site.bikes.push(strip(q, w, plan.bikeLanes.length));
      if (route) plan.bikeRoutes.push({ p: q, len: lenOf(q), d: dOf(q) });
    }
  };
  for (const r of osm.roads) if (r.bike === 2 && lenOf(r.p) >= 20) add(r.p, r.w, true, true);
  let lanes = osm.roads.filter((r) => r.k === 'street' && r.bike === 1 && lenOf(r.p) > 40);
  if (lanes.length < 5) {
    const extra = osm.roads.filter((r) => r.k === 'street' && !r.bike && r.w >= 7 && lenOf(r.p) > 70).map((r) => ({ r, d: dOf(r.p) })).filter((o) => o.d > 22 && o.d < 190).sort((a, b) => a.d - b.d);
    lanes = lanes.concat(extra.slice(0, 5 - lanes.length).map((o) => o.r));
  }
  lanes.forEach((r, k) => {
    for (const side of [1, -1]) {
      const p0 = offsetLine(r.p, side * (r.w / 2 - 0.95)), p = side > 0 ? p0 : (() => { const q: number[] = []; for (let i = p0.length - 2; i >= 0; i -= 2) q.push(p0[i], p0[i + 1]); return q; })();
      add(p, 1.5, false, k < 4);
    }
  });
}

// ── tram lines: beds, poles, platforms ──
function planTram(osm: OsmExtract, plan: Plan, bbIn: (x: number, z: number, m?: number) => boolean, free: (kind: Kind, x: number, z: number, rot?: number, own?: number, ring?: Ring) => boolean): void {
  const { site } = plan;
  const lines = joinWays((osm.rails || []).map((r) => r.p)).map(makeRoute).filter((r) => r.len > 12);
  plan.tramLines = lines;
  lines.forEach((r) => site.tram.push(strip(r.p, BED_W, 0)));
  const roads = osm.roads.filter((r) => r.k === 'main' || r.k === 'street' || r.k === 'lane');
  const nearRoad = (x: number, z: number): boolean => roads.some((r) => pointLine(x, z, r.p) < r.w / 2 + 2.5);
  for (const r of lines) {
    let run: number[] = [], kind: boolean | null = null;
    const flush = (): void => { if (run.length >= 4) plan.tramBeds.push({ p: run, paved: !!kind }); run = []; };
    for (let i = 0; i + 3 < r.p.length; i += 2) {
      const k = nearRoad((r.p[i] + r.p[i + 2]) / 2, (r.p[i + 1] + r.p[i + 3]) / 2);
      if (kind !== null && k !== kind) flush();
      if (!run.length) run.push(r.p[i], r.p[i + 1]);
      run.push(r.p[i + 2], r.p[i + 3]); kind = k;
    }
    flush();
  }
  // poles on alternate sides every 36 m; a pole is dropped when its spot is taken (the line is never moved)
  lines.forEach((r) => {
    for (let s = 12, k = 0; s < r.len - 6; s += 36, k++) {
      const [x, z, dx, dz] = pointAt(r, s), side = k % 2 ? 1 : -1, px = x - dz * 2.4 * side, pz = z + dx * 2.4 * side;
      if (!bbIn(px, pz, 2) || (Math.abs(px) < PLAZA_HALF + 2 && Math.abs(pz) < PLAZA_HALF + 2)) continue;
      if (free('pole', px, pz)) plan.poles.push([px, pz, Math.atan2(dz * side, -dx * side)]);
    }
  });
  // stops: a platform on one side of the line with a small shelter
  lines.forEach((r, li) => {
    for (const s0 of snapStops(r, osm.stops || [], 16, 60)) {
      // the platform and its shelter are straight: it stands where the line turns less than 10 degrees over its 14 m, moved along the line (up to 9 m) when the stop itself is on a bend
      for (const shift of [0, 3, -3, 6, -6, 9, -9]) {
        const s = s0 + shift; if (s < 8 || s > r.len - 8) continue;
        const a = pointAt(r, s - 7), b = pointAt(r, s + 7); if (a[2] * b[2] + a[3] * b[3] < Math.cos(10 * Math.PI / 180)) continue;
        const side = Math.sin(r.len * 12.9 + s * 0.37) > 0 ? 1 : -1, [x, z, dx, dz] = pointAt(r, s), nx = -dz * side, nz = dx * side, o = 2.7;
        const ring = boxRing(x + nx * o, z + nz * o, 1.2, 7, Math.atan2(dx, dz));
        if (plan.platforms.some((q) => Math.hypot(q.x - (x + nx * o), q.z - (z + nz * o)) < 15)) continue;      // two platforms never overlap
        if (!free('platform', x + nx * o, z + nz * o, 0, undefined, ring)) continue;
        plan.platforms.push({ x: x + nx * o, z: z + nz * o, r: 7, s, line: li }); break;
      }
    }
  });
}

// ── street furniture, shops, cafe terraces, musicians ──
function planStreetLife(osm: OsmExtract, plan: Plan, bbIn: (x: number, z: number, m?: number) => boolean, clearPlaza: (x: number, z: number) => boolean,
  free: (kind: Kind, x: number, z: number, rot?: number, own?: number, ring?: Ring) => boolean): void {
  const { site } = plan;
  const Y = 0.05;
  const walks = osm.roads.filter((r) => (r.k === 'walk' || r.k === 'path') && !r.bike).map((r) => ({ r, d: dOf(r.p), len: lineLen(r.p) })).filter((o) => o.len > 25 && o.d < 200).sort((a, b) => a.d - b.d);
  const KINDS = ['bench', 'bin', 'planter', 'bench', 'rack', 'bollard', 'bin', 'bench', 'planter'] as const;
  const { items, benches, sit, stand } = plan;
  let idx = 0, kiosks = 0;
  for (const { r } of walks) {
    if (items.bin.length + benches.length > 150) break;
    let acc = 8 + hash(r.p[0], r.p[1]) * 10;
    for (let i = 0; i + 3 < r.p.length; i += 2) {
      const x0 = r.p[i], z0 = r.p[i + 1], dx = r.p[i + 2] - x0, dz = r.p[i + 3] - z0, l = Math.hypot(dx, dz); if (l < 1) continue;
      const tx = dx / l, tz = dz / l, nx = -tz, nz = tx;
      for (let s = acc; s < l; s += 17 + hash(s, idx) * 8) {
        const kind = KINDS[idx++ % KINDS.length], side = (idx & 1) ? 1 : -1, off = r.w / 2 + 0.9;
        const x = x0 + tx * s + nx * off * side, z = z0 + tz * s + nz * off * side;
        if (!bbIn(x, z, 10) || clearPlaza(x, z)) continue;
        const faceRoad = Math.atan2(nx * side, nz * side), th = Math.atan2(-tz, tx) + (side > 0 ? Math.PI : 0);
        const rot = kind === 'bench' ? th : kind === 'rack' ? Math.atan2(-tz, tx) : faceRoad;
        if (!free(kind, x, z, rot)) continue;
        if (kind === 'bench') {
          benches.push([x, Y, z, th]);
          if (hash(x, z) < 0.6) sit.push({ x: x + tx * 0.4, z: z + tz * 0.4, rot: th });
          if (hash(z, x) < 0.35) sit.push({ x: x - tx * 0.45, z: z - tz * 0.45, rot: th });
        } else items[kind].push([x, Y, z, rot]);
        if (kind === 'planter' && hash(x, z) < 0.5) stand.push({ x: x + nx * -side * 1.6, z: z + nz * -side * 1.6, rot: faceRoad + Math.PI, mate: true });
        if (kiosks < 4 && hash(z, x) < 0.06 && Math.hypot(x, z) > 20) {
          const kx = x + nx * side * 1.6, kz = z + nz * side * 1.6;
          if (free('kiosk', kx, kz, faceRoad + Math.PI)) { items.kiosk.push([kx, Y, kz, faceRoad + Math.PI]); stand.push({ x: kx - nx * side * 1.3 + tx * 1.4, z: kz - nz * side * 1.3 + tz * 1.4, rot: faceRoad + Math.PI, mate: true }); kiosks++; }
        }
      }
      acc = ((acc - l) % 20 + 20) % 20;
    }
  }
  // bollards around the basins, a few
  for (const b of site.basins) {
    for (let i = 0, n = b.r.length / 2; i < n; i += 3) {
      const x = b.r[2 * i], z = b.r[2 * i + 1], d = Math.hypot(x, z) || 1, bx = x + (x / d) * 0.8, bz = z + (z / d) * 0.8;
      if (!clearPlaza(bx, bz) && bbIn(bx, bz, 10) && items.bollard.length < 80 && free('bollard', bx, bz, 0)) items.bollard.push([bx, Y, bz, 0]);
    }
  }
  // bus stops and street signs on streets
  let stops = 0, signs = 0;
  for (const r of osm.roads.filter((q) => q.k === 'street' && q.w >= 6)) {
    const d = dOf(r.p); if (d < 25 || d > 190) continue;
    for (let i = 0; i + 3 < r.p.length; i += 2) {
      const x0 = r.p[i], z0 = r.p[i + 1], dx = r.p[i + 2] - x0, dz = r.p[i + 3] - z0, l = Math.hypot(dx, dz); if (l < 30) continue;
      const tx = dx / l, tz = dz / l, nx = -tz, nz = tx, side = hash(x0, z0) < 0.5 ? 1 : -1, off = r.w / 2 + 2.2;
      const x = x0 + tx * l * 0.5 + nx * off * side, z = z0 + tz * l * 0.5 + nz * off * side;
      if (!bbIn(x, z, 10) || clearPlaza(x, z)) continue;
      if (stops < 3 && l > 45) {
        const rot = Math.atan2(nx * side, nz * side) + Math.PI;
        if (free('stop', x, z, rot)) { items.stop.push([x, Y, z, rot]); stops++; stand.push({ x: x - nx * side * 1.4, z: z - nz * side * 1.4, rot: Math.atan2(-nx * side, -nz * side), mate: false }); }
      } else if (signs < 14) {
        const sx = x0 + tx * 3 + nx * (r.w / 2 + 0.6) * side, sz = z0 + tz * 3 + nz * (r.w / 2 + 0.6) * side, rot = Math.atan2(tx, tz);
        if (bbIn(sx, sz, 10) && !clearPlaza(sx, sz) && free('sign', sx, sz, rot)) { items.sign.push([sx, Y, sz, rot]); signs++; }
      }
    }
  }
  // shopfronts on the walls beside the streets (a street's side where a wall is within 9 m), cafe terraces in front of them (as on Hlavna in summer) and a street musician
  const taken = [...Object.values(items).flat(), ...benches].map((q) => [q[0], q[2]]);
  const clearOf = (x: number, z: number, m: number): boolean => taken.every(([a, b]) => Math.hypot(a - x, b - z) > m);
  const shopSpots: { x: number; z: number; rot: number; d: number }[] = [];
  const spotRoads = osm.roads.filter((r) => r.k !== 'main' && r.k !== 'rail' && lineLen(r.p) > 20).map((r) => ({ r, d: dOf(r.p) })).filter((q) => q.d < 170).sort((a, b) => a.d - b.d);
  for (const { r } of spotRoads) {
    for (let i = 0; i + 3 < r.p.length; i += 2) {
      const x0 = r.p[i], z0 = r.p[i + 1], dx = r.p[i + 2] - x0, dz = r.p[i + 3] - z0, l = Math.hypot(dx, dz); if (l < 8) continue;
      const tx = dx / l, tz = dz / l;
      for (let s = 4 + hash(x0, z0) * 6; s < l - 3; s += 11 + hash(s, z0) * 5) for (const side of [1, -1]) {
        const nx = -tz * side, nz = tx * side, px = x0 + tx * s, pz = z0 + tz * s;
        for (let t = r.w / 2 + 1.2; t < r.w / 2 + 9; t += 0.6) {
          const wx = px + nx * t, wz = pz + nz * t; if (!bbIn(wx, wz, 12)) break;
          if (clearPlaza(wx, wz)) break;
          if (site.buildings.some((b) => boxHit([wx, wz, wx, wz], b.box) && pointInRing(b.r, wx, wz))) {
            const fx = px + nx * (t - 0.35), fz = pz + nz * (t - 0.35), rot = Math.atan2(-nx, -nz);
            if (t > r.w / 2 + 1.8 && shopSpots.every((q) => Math.hypot(q.x - fx, q.z - fz) > 9) && free('shop', fx, fz, rot)) shopSpots.push({ x: fx, z: fz, rot, d: Math.hypot(fx, fz) });
            break;
          }
        }
      }
    }
  }
  shopSpots.sort((a, b) => a.d - b.d); shopSpots.length = Math.min(shopSpots.length, 16); plan.shops = shopSpots;
  // the plan keeps only the shops that are shown at most; the others never stand in the scene, so they are not audited
  plan.placed = plan.placed.filter((o) => o.kind !== 'shop' || shopSpots.some((q) => q.x === o.x && q.z === o.z));
  const cand: { x: number; z: number; rot: number; d: number }[] = [];
  const probe = (x: number, z: number): boolean => bbIn(x, z, 10) && !clearPlaza(x, z) && !hits(site, { kind: 'terrace', x, z, ring: circleRing(x, z, 0.3, 6) }).length;
  for (const { r } of walks) {
    for (let i = 0; i + 3 < r.p.length; i += 2) {
      const x0 = r.p[i], z0 = r.p[i + 1], dx = r.p[i + 2] - x0, dz = r.p[i + 3] - z0, l = Math.hypot(dx, dz); if (l < 6) continue;
      const tx = dx / l, tz = dz / l;
      for (let s = 3 + hash(z0, x0) * 5; s < l - 2; s += 13) {
        const side: number = ((cand.length + i) & 1) ? 1 : -1, off = r.w / 2 + 2.6, x: number = x0 + tx * s - tz * side * off, z: number = z0 + tz * s + tx * side * off, rot = Math.atan2(tz * side, -tx * side) + Math.PI;
        if (probe(x, z) && clearOf(x, z, 3.5) && Math.hypot(x, z) > 13 && cand.every((q) => Math.hypot(q.x - x, q.z - z) > 7)) cand.push({ x, z, rot, d: Math.hypot(x, z) });
      }
    }
  }
  cand.sort((a, b) => a.d - b.d);
  const roomy = (q: { x: number; z: number }): boolean => { let k = 0; for (let a = 0; a < 8; a++) if (probe(q.x + Math.cos(a * 0.785) * 3.6, q.z + Math.sin(a * 0.785) * 3.6)) k++; return k >= 7; };
  const roomyList = cand.filter((q) => roomy(q));
  const musicians = [roomyList[1] || roomyList[0]].filter((q) => q);       // few: one busker per district
  // people who sit or stand: only where a person fits (not in a carriageway, on a lane, in a basin)
  const fits = (q: { x: number; z: number }): boolean => !hits(site, { kind: 'sitter', x: q.x, z: q.z, ring: footprint('sitter', q.x, q.z) }).length;
  plan.sit = plan.sit.filter(fits);
  for (const q of plan.sit) plan.placed.push({ kind: 'sitter', x: q.x, z: q.z, ring: footprint('sitter', q.x, q.z) });
  // standing people go through the same test as furniture (clear of benches, bins, kiosks, trees); a chatting mate 0.9 m ahead must fit too
  plan.stand = plan.stand.filter((q) => {
    if (!free('person', q.x, q.z, q.rot)) return false;
    if (q.mate && !free('person', q.x + Math.sin(q.rot) * 0.9, q.z + Math.cos(q.rot) * 0.9, q.rot)) q.mate = false;
    return true;
  });
  // cafe terraces: a table group with a parasol on the footway in front of a shopfront (the shop faces the street, so the terrace sits 2 m out)
  for (const s of shopSpots) {
    if (plan.terraces.length >= 8) break;
    const x = s.x + Math.sin(s.rot) * 2.0, z = s.z + Math.cos(s.rot) * 2.0;
    if (clearOf(x, z, 2.5) && free('terrace', x, z, s.rot)) plan.terraces.push({ x, z, rot: s.rot });
  }
  for (const q of musicians) { if (free('busker', q.x, q.z, q.rot)) plan.musicians.push(q); }
}

// ── routes of the moving people and cars ──
function planRoutes(osm: OsmExtract, plan: Plan): void {
  const cars = osm.roads.filter((r) => (r.k === 'main' || r.k === 'street' || (r.k === 'lane' && r.w >= 4)) && r.w >= 4 && lineLen(r.p) > 40)
    .map((r) => ({ r, d: dOf(r.p) })).filter((q) => q.d < 220).sort((a, b) => a.d - b.d).slice(0, 18);
  plan.routes.car = cars.map((q) => q.r.p);
  plan.routes.carInfo = cars.map(({ r }) => ({ ow: r.ow || 0, w: r.w, ln: r.ln || Math.max(1, Math.round(r.w / 3.4)) }));
  plan.routes.walk = osm.roads.filter((r) => r.k === 'walk' || r.k === 'path').map((r) => ({ p: r.p, len: lineLen(r.p), d: dOf(r.p) })).filter((r) => r.len > 30 && r.d > 18 && r.d < 160).sort((a, b) => a.d - b.d).slice(0, 24).map((r) => r.p);
  plan.routes.bike = plan.bikeRoutes.map((r) => r.p);
}

// ── the audit: everything in the plan against everything, from scratch ──
// Every object against the obstacles of the site and the solid ones against each other (a 8 m grid finds the neighbours).
export function auditObjects(site: Site, all: Placed[]): Finding[] {
  const out: Finding[] = [];
  for (const o of all) for (const cat of hits(site, o)) out.push({ cat: `${o.kind}-${cat}`, kind: o.kind, x: o.x, z: o.z });
  const cell = new Map<string, Placed[]>(), key = (o: Placed): string => `${Math.floor(o.x / 8)},${Math.floor(o.z / 8)}`;
  for (const o of all) if (RULES[o.kind].solid) { const k = key(o); (cell.get(k) || cell.set(k, []).get(k) as Placed[]).push(o); }
  for (const [k, list] of cell) {
    const [cx, cz] = k.split(',').map(Number);
    for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) {
      const other = cell.get(`${cx + dx},${cz + dz}`); if (!other) continue;
      for (const a of list) for (const b of other) {
        if (a === b || (a.x > b.x || (a.x === b.x && a.z >= b.z))) continue;
        if (ringRing(a.ring, b.ring) < 0.05) out.push({ cat: `${a.kind}-${b.kind}`, kind: a.kind, x: a.x, z: a.z, with: b.kind });
      }
    }
  }
  return out;
}

export function auditPlan(plan: Plan, extra: Placed[] = []): Finding[] {
  const site = plan.site, all = [...plan.placed, ...extra, { kind: 'padSlab' as Kind, x: 0, z: 0, ring: boxRing(0, 0, PLAZA_HALF, PLAZA_HALF, 0) },
    ...site.towers.map((t): Placed => ({ kind: 'tower', x: t.x, z: t.z, ring: circleRing(t.x, t.z, t.r, 12) }))];
  const out = auditObjects(site, all);
  // houses against houses, houses on carriageways, bike lanes and tram beds
  const B = site.buildings;
  for (let i = 0; i < B.length; i++) for (let j = i + 1; j < B.length; j++) {
    if (!boxHit(B[i].box, B[j].box)) continue;
    const a = overlapArea(B[i].r, B[j].r, 0.5); if (a > 1) out.push({ cat: 'building-building', kind: 'building', x: B[i].box[0], z: B[i].box[1], amount: a });
  }
  for (const b of B) {
    for (const s of site.carriage) {
      if (!boxHit(b.box, s.box)) continue;
      const d = ringLine(b.r, s.p, b.box, s.w / 2);
      void d;
      if (ringCoreHit(b.r, s)) out.push({ cat: 'building-road', kind: 'building', x: b.box[0], z: b.box[1] });
    }
    for (const s of site.bikes) if (boxHit(b.box, s.box) && ringLine(b.r, s.p, b.box, s.w / 2) < s.w / 2) out.push({ cat: 'building-bike', kind: 'building', x: b.box[0], z: b.box[1] });
    for (const s of site.tram) if (boxHit(b.box, s.box) && ringLine(b.r, s.p, b.box, s.w / 2) < s.w / 2) out.push({ cat: 'building-tram', kind: 'building', x: b.box[0], z: b.box[1] });
    for (const w of [...site.basins, ...site.river]) if (boxHit(b.box, w.box) && ringRing(b.r, w.r) === 0) out.push({ cat: 'building-water', kind: 'building', x: b.box[0], z: b.box[1] });
    for (const l of site.landmarks ?? []) if (boxHit(b.box, l.box) && overlapArea(b.r, l.r, 0.5) > 1) out.push({ cat: 'building-landmark', kind: 'building', x: b.box[0], z: b.box[1] });
    for (const t of site.towers) if (ringRing(b.r, circleRing(t.x, t.z, t.r + TOWER_MARGIN, 12)) === 0) out.push({ cat: 'building-tower', kind: 'building', x: b.box[0], z: b.box[1] });
  }
  // moving things: routes must stay off houses and out of water
  for (const [name, list] of [['car', plan.routes.car], ['walk', plan.routes.walk], ['bike', plan.routes.bike]] as [string, Line[]][]) {
    for (const p of list) {
      const inB = routeLenInside(p, B), inW = routeLenInside(p, [...site.basins, ...site.river]);
      if (inB > 1) out.push({ cat: `route-${name}-building`, kind: name, x: p[0], z: p[1], amount: inB });
      if (inW > 1) out.push({ cat: `route-${name}-water`, kind: name, x: p[0], z: p[1], amount: inW });
    }
  }
  return out;
}
// Does the building come closer to the centre line than 75 % of the half width (deeper than a kerb)? The width is a guess
// from the road class, so a building that only grazes it is not a finding.
function ringCoreHit(r: Ring, s: Strip): boolean { return ringLine(r, s.p, ringBox(r), s.w / 2 * 0.75) < s.w / 2 * 0.75; }
// metres of a route inside rings, sampled every 0.5 m
function routeLenInside(p: Line, rings: { r: Ring; box: Box4 }[]): number {
  let n = 0;
  for (let i = 0; i + 3 < p.length; i += 2) {
    const x0 = p[i], z0 = p[i + 1], dx = p[i + 2] - x0, dz = p[i + 3] - z0, l = Math.hypot(dx, dz), k = Math.max(1, Math.ceil(l / 0.5));
    for (let s = 0; s < k; s++) {
      const x = x0 + dx * (s + 0.5) / k, z = z0 + dz * (s + 0.5) / k;
      if (rings.some((o) => x >= o.box[0] && x <= o.box[2] && z >= o.box[1] && z <= o.box[3] && pointInRing(o.r, x, z))) n += l / k;
    }
  }
  return n;
}
export function countByCategory(f: Finding[]): Record<string, number> { const o: Record<string, number> = {}; for (const x of f) o[x.cat] = (o[x.cat] || 0) + 1; return o; }

// ── Newtown: the procedural city (js/world.ts) as data ──
// Roads run along x = +-44 and z = +-44 (9 m wide, 640 m long) with a 3 m footway on each side; a 73 m plaza lies at the origin and 18 m pads
// under the other plots. The furniture of the plaza edge and the ring roads is laid out here (no random numbers); trees and blocks are drawn
// from world.ts's random stream and audited from the built scene (`procPlaced` there).
export const NEWTOWN_GRID = { road: 44, w: 9, len: 640, walk: 3, plaza: 36.5, pad: 9, hedge: 35.8 };   // hedge: the row stands on the plaza, a hand clear of the footway that starts at 36.5
export interface NewtownFurniture { bushes: [number, number][]; lamps: [number, number, number][]; benches: [number, number, number][]; beds: [number, number][]; lights: [number, number][] }
export function newtownFurniture(): NewtownFurniture {
  const { road: ROAD, w: ROAD_W } = NEWTOWN_GRID, out: NewtownFurniture = { bushes: [], lamps: [], benches: [], beds: [[-26, -26], [26, -26], [-26, 26], [26, 26]], lights: [] };
  for (let k = -33; k <= 33; k += 3) for (const s of [-1, 1]) { if (Math.abs(k) > 6) { out.bushes.push([k, s * NEWTOWN_GRID.hedge]); out.bushes.push([s * NEWTOWN_GRID.hedge, k]); } }
  for (let k = -30; k <= 30; k += 12) for (const s of [-1, 1]) { out.lamps.push([k, s * 34, s > 0 ? Math.PI : 0]); out.lamps.push([s * 34, k, s > 0 ? -Math.PI / 2 : Math.PI / 2]); }
  for (let k = -150; k <= 150; k += 22) for (const s of [-1, 1]) for (const o of [-1, 1]) {
    if (Math.abs(k) < 40 || Math.abs(Math.abs(k) - ROAD) < ROAD_W / 2 + 0.5) continue;      // none in the carriageway of the street that crosses the footway
    out.lamps.push([k, s * ROAD + o * (ROAD_W / 2 + 0.6), o > 0 ? Math.PI : 0]); out.lamps.push([s * ROAD + o * (ROAD_W / 2 + 0.6), k, o > 0 ? -Math.PI / 2 : Math.PI / 2]);
  }
  for (let k = -24; k <= 24; k += 16) for (const s of [-1, 1]) { out.benches.push([k + 4, s * 32, s > 0 ? Math.PI : 0]); out.benches.push([s * 32, k + 4, s > 0 ? -Math.PI / 2 : Math.PI / 2]); }
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) out.lights.push([sx * (ROAD + ROAD_W / 2 + 0.8), sz * (ROAD + ROAD_W / 2 + 0.8)]);
  return out;
}
// The static parts of Newtown as a Site: the ring roads, their footways, and the sites of the five plots (pads and finished towers) as tower circles.
export function newtownSite(plots: { x: number; z: number }[]): Site {
  const { road: R, w: W, len: L, walk: SW, pad } = NEWTOWN_GRID, carriage: Strip[] = [], foot: Strip[] = [];
  let id = 0;
  for (const s of [-1, 1]) {
    carriage.push(strip([-L / 2, s * R, L / 2, s * R], W, id++), strip([s * R, -L / 2, s * R, L / 2], W, id++));
    for (const o of [-1, 1]) { const c = s * R + o * (W / 2 + SW / 2); foot.push(strip([-L / 2, c, L / 2, c], SW, id++), strip([c, -L / 2, c, L / 2], SW, id++)); }
  }
  return { half: L / 2, buildings: [], carriage, foot, basins: [], river: [], bikes: [], tram: [], landmarks: [], towers: plots.map((p) => ({ x: p.x, z: p.z, r: pad })) };
}

// Footprints of the deterministic Newtown furniture, ready for `hits`.
export function newtownPlaced(f: NewtownFurniture): Placed[] {
  const out: Placed[] = [];
  for (const [x, z] of f.bushes) out.push({ kind: 'hedge', x, z, rot: Math.abs(x) === NEWTOWN_GRID.hedge ? Math.PI / 2 : 0, ring: boxRing(x, z, 0.7, 0.45, Math.abs(x) === NEWTOWN_GRID.hedge ? Math.PI / 2 : 0) });
  for (const [x, z, r] of f.lamps) out.push({ kind: 'lamp', x, z, rot: r, ring: footprint('lamp', x, z, r) });
  for (const [x, z, r] of f.benches) out.push({ kind: 'bench', x, z, rot: r, ring: footprint('bench', x, z, r) });
  f.beds.forEach(([x, z], i) => out.push({ kind: 'bed', x, z, rot: i * 0.8, ring: boxRing(x, z, 2.75, 1.6, i * 0.8) }));
  for (const [x, z] of f.lights) out.push({ kind: 'pole', x, z, ring: footprint('pole', x, z) });
  return out;
}
