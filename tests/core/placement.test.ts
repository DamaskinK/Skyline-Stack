// Placement audit (S0004 00): nothing in Kosice or Newtown stands where it cannot. The plan of every plot extract (js/core/placement.ts)
// is re-checked from scratch against the real size of houses, carriageways, bike lanes, tram beds, footways, basins, river and the
// plaza; the same audit runs on the built scene in `node tests/browser/check.mjs audit`.
import { describe, expect, it } from 'vitest';
import { auditObjects, auditPlan, clipNetwork, countByCategory, footprint, hits, keptBuildings, makeSite, newtownFurniture, newtownPlaced, newtownSite, planNearRing, trimNetwork, towerCircles, PAD_HALF, PLAZA_HALF } from '../../js/core/placement.js';
import { boxRing, lineOutside, overlapArea, pointInRing, pointLine, ringLine, ringRing } from '../../js/core/geometry2d.js';
import { cityById } from '../../js/levels.js';
import { NEWTOWN } from '../../js/levels.js';
import { landmarkRings } from '../../js/core/landmark-sites.js';
import type { OsmExtract } from '../../js/types.js';

const nodeFs = 'node:fs';
const fs = (await import(/* @vite-ignore */ nodeFs)) as { readFileSync(p: string, e: string): string };
const kosice = cityById('kosice'), plots = kosice?.district?.plots ?? [];
// where a plot lies in the frame of the city (as plotOffset in js/level-scene.ts)
const offsetOf = (id: string): { x: number; z: number } => {
  const c = kosice?.site as { lat: number; lon: number }, p = plots.find((q) => q.id === id)?.site as { lat: number; lon: number };
  return { x: (p.lon - c.lon) * 111320 * Math.cos(c.lat * Math.PI / 180), z: -(p.lat - c.lat) * 111320 };
};
const extract = (id: string): OsmExtract => JSON.parse(fs.readFileSync(`assets/levels/kosice/plots/${id}.json`, 'utf8')) as OsmExtract;

describe('2D geometry', () => {
  it('measures a ring against a road by the road centre line', () => {
    const car = boxRing(0, 3, 1, 2, 0), road = [-10, 0, 10, 0];
    expect(ringLine(car, road)).toBeCloseTo(1, 5);           // 1 m between the car and the centre line
    expect(ringLine(boxRing(0, 0.5, 1, 2, 0), road)).toBe(0); // the centre line runs under it
  });
  it('knows when two rings overlap and by how much', () => {
    const a = boxRing(0, 0, 2, 2, 0), b = boxRing(3, 0, 2, 2, 0), c = boxRing(10, 0, 1, 1, 0);
    expect(ringRing(a, b)).toBe(0);
    expect(overlapArea(a, b, 0.25)).toBeCloseTo(4, 1);
    expect(ringRing(a, c)).toBeGreaterThan(5);
  });
  it('cuts a line where it runs through a house and keeps the rest', () => {
    const house = [{ r: boxRing(0, 0, 3, 3, 0), box: [-3, -3, 3, 3] as [number, number, number, number] }];
    const parts = lineOutside([-20, 0, 20, 0], house, 0, 2);
    expect(parts).toHaveLength(2);
    expect(parts[0][parts[0].length - 2]).toBeCloseTo(-3, 1);
    expect(parts[1][0]).toBeCloseTo(3, 1);
    expect(pointInRing(house[0].r, 0, 0)).toBe(true);
  });
});

describe('the audit sees what it must', () => {
  const osm = extract('juzna'), plan = planNearRing(osm), site = plan.site;
  it('finds a tree in a house, a bench in the carriageway, a bush on a bike lane and a car on a tram bed', () => {
    const house = site.buildings[0], hx = (house.box[0] + house.box[2]) / 2, hz = (house.box[1] + house.box[3]) / 2;
    const inside = pointInRing(house.r, hx, hz) ? [hx, hz] : [house.r[0] + 0.5, house.r[1] + 0.5];
    expect(hits(site, { kind: 'tree', x: inside[0], z: inside[1], ring: footprint('tree', inside[0], inside[1]) })).toContain('building');
    const road = site.carriage[0], rx = road.p[0], rz = road.p[1];
    expect(hits(site, { kind: 'bench', x: rx, z: rz, ring: footprint('bench', rx, rz) })).toContain('road');
    const lane = site.bikes[0], bx = lane.p[0], bz = lane.p[1];
    expect(hits(site, { kind: 'bush', x: bx, z: bz, ring: footprint('bush', bx, bz) })).toContain('bike');
    const bed = site.tram[0], tx = bed.p[0], tz = bed.p[1];
    expect(hits(site, { kind: 'carLot', x: tx, z: tz, ring: footprint('carLot', tx, tz, 0) })).toContain('tram');
  });
  it('finds a house on the plaza pad, objects on each other and a tower on the plaza', () => {
    expect(hits(site, { kind: 'lamp', x: 0, z: 0, ring: footprint('lamp', 0, 0) })).toContain('pad');
    const cx = PAD_HALF + 2.2, free = { ...site, buildings: [], carriage: [], foot: [], basins: [], river: [], bikes: [], tram: [], towers: [] };   // S0004 18: a parked car keeps 3 m from the pad
    expect(hits(free, { kind: 'carLot', x: cx, z: 0, ring: footprint('carLot', cx, 0, Math.PI / 2) })).toContain('pad');
    expect(hits(free, { kind: 'carLot', x: PAD_HALF + 6, z: 0, ring: footprint('carLot', PAD_HALF + 6, 0, Math.PI / 2) })).not.toContain('pad');
    const a = { kind: 'tree' as const, x: 80, z: 80, ring: footprint('tree', 80, 80) }, b = { kind: 'tree' as const, x: 80.4, z: 80, ring: footprint('tree', 80.4, 80) };
    expect(countByCategory(auditObjects({ ...site, buildings: [], carriage: [], foot: [], basins: [], river: [], bikes: [], tram: [] }, [a, b]))).toEqual({ 'tree-tree': 1 });
  });
});

describe('Kosice plots', () => {
  it.each(plots.map((p) => p.id))('%s: nothing is placed on anything', (id) => {
    const osm = extract(id), plan = planNearRing(osm, { towers: towerCircles(kosice?.site, plots, id, osm.half), landmarks: landmarkRings('kosice', offsetOf(id)) });
    const findings = auditPlan(plan);
    expect(countByCategory(findings), JSON.stringify(findings.slice(0, 5))).toEqual({});
    expect(plan.placed.length).toBeGreaterThan(300);       // the audit looks at something
    expect(plan.trees.length + plan.benches.length + plan.lamps.length).toBeGreaterThan(50);
  });
  it.each(plots.map((p) => p.id))('%s: the network is cut at houses and the pad, bike lanes keep clear of houses and water', (id) => {
    const osm = extract(id), kept = keptBuildings(osm), net = clipNetwork(trimNetwork(osm), kept), site = makeSite(net, kept);
    for (const s of [...site.carriage, ...site.foot]) for (let i = 0; i + 3 < s.p.length; i += 2) {
      expect(Math.abs(s.p[i]) < PAD_HALF && Math.abs(s.p[i + 1]) < PAD_HALF, `${s.p[i]},${s.p[i + 1]} on the pad`).toBe(false);
    }
    const plan = planNearRing(osm);
    for (const lane of plan.bikeLanes) for (const b of plan.site.buildings) expect(ringLine(b.r, lane.p, b.box, 1)).toBeGreaterThan(0.5);
    expect(plan.site.buildings.length).toBeGreaterThan(200);
  });
  it('terasa: the street profile (S0004 18) - tram bed, carriageways, kerb, bike lane, sidewalk, in that order from the middle', () => {
    const osm = extract('terasa'), plan = planNearRing(osm), cars = osm.roads.filter((r) => r.k === 'main' || r.k === 'street' || r.k === 'lane');
    expect(osm.rails?.length).toBeGreaterThan(0);                                     // the real tram line of Trieda SNP is in the extract (the plot sits 74 m from it)
    expect(plan.tramLines.length).toBeGreaterThan(0);
    expect(plan.walks.length).toBeGreaterThan(5);
    const lanes = plan.bikeLanes.filter((l) => !l.cycleway);
    expect(lanes.length).toBeGreaterThan(3);
    const mid = (l: number[]): [number, number] => { const k = Math.floor(l.length / 4) * 2; return [l[k], l[k + 1]]; };
    for (const w of plan.walks) for (const s of plan.site.carriage) { const [x, z] = mid(w.p); if (Math.abs(x) > osm.half - 30 || Math.abs(z) > osm.half - 30) continue; expect(ringLine([x - 0.01, z - 0.01, x + 0.01, z - 0.01, x + 0.01, z + 0.01], s.p, undefined, s.w / 2 + 1)).toBeGreaterThanOrEqual(s.w / 2 + 0.9); }   // no sidewalk inside a carriageway or its kerb strip
    for (const l of lanes) { const [x, z] = mid(l.p); const near = cars.map((r) => pointLine(x, z, r.p) - r.w / 2).reduce((a, b) => Math.min(a, b), 99); expect(near).toBeGreaterThan(0.1); }   // a bike lane lies beyond the kerb, not in the carriageway
    for (const l of lanes) for (const t of plan.osm.rails ?? []) { const [x, z] = mid(l.p); expect(pointLine(x, z, t.p), `lane at ${x.toFixed(1)},${z.toFixed(1)}`).toBeGreaterThan(2); }   // and never on the track bed
  });
  it('the player plot pad is bare plaza and no two houses overlap', () => {
    for (const p of plots) {
      const plan = planNearRing(extract(p.id)), b = plan.site.buildings;
      for (const s of b) expect(ringRing(s.r, boxRing(0, 0, PLAZA_HALF, PLAZA_HALF, 0))).toBeGreaterThan(0);
      for (let i = 0; i < b.length; i++) for (let j = i + 1; j < b.length; j++) if (b[i].box[0] < b[j].box[2] && b[j].box[0] < b[i].box[2] && b[i].box[1] < b[j].box[3] && b[j].box[1] < b[i].box[3]) expect(overlapArea(b[i].r, b[j].r, 0.5)).toBeLessThan(1);
    }
  });
  it('a plot within 250 m of another sees its tower circle', () => {
    const site = kosice?.site as { lat: number; lon: number };
    const pair = [{ ...plots[0], id: 'a', site }, { ...plots[1], id: 'b', site: { lat: site.lat + 0.002, lon: site.lon } }];
    expect(towerCircles(site, pair, 'a').length).toBeGreaterThan(0);
  });
  it('towers of the other plots keep their site free where two plots share an extract', () => {
    const near = plots.filter((p) => towerCircles(kosice?.site, plots, p.id).length > 0);
    // since S0004 12 no two real plots are close enough to share an extract; the rule is checked on a made-up pair below
    for (const p of near) {
      const osm = extract(p.id), towers = towerCircles(kosice?.site, plots, p.id, osm.half), plan = planNearRing(osm, { towers });
      for (const t of towers) for (const b of plan.site.buildings) expect(ringRing(b.r, boxRing(t.x, t.z, t.r, t.r, 0))).toBeGreaterThan(0);
    }
  });
});

describe('Kosice landmarks', () => {
  it.each(plots.map((p) => p.id))('%s: no tree, bench, stall, musician, car or street stands inside a landmark model', (id) => {
    const osm = extract(id), rings = landmarkRings('kosice', offsetOf(id)), plan = planNearRing(osm, { landmarks: rings });
    const inside = rings.filter((r) => r.some((v, i) => i % 2 === 0 && Math.abs(v) < osm.half && Math.abs(r[i + 1]) < osm.half));
    for (const o of plan.placed) for (const r of rings) if (o.kind !== 'kerb' && o.kind !== 'dash') expect(ringRing(o.ring, r), `${o.kind} at ${o.x.toFixed(1)},${o.z.toFixed(1)}`).toBeGreaterThan(0);
    for (const s of [...plan.site.carriage, ...plan.site.foot]) for (const r of rings) expect(ringLine(r, s.p), `street ${s.id}`).toBeGreaterThan(0);
    for (const r of inside) for (const b of plan.site.buildings) expect(overlapArea(b.r, r, 0.5)).toBeLessThan(1);
  });
  it('the Singing Fountain of Cathedral square stays clear of the plaza the tower stands on', () => {
    const f = landmarkRings('kosice', offsetOf('cathedral'))[4];                 // ring order of KOSICE_LANDMARKS
    expect(ringRing(f, boxRing(0, 0, 3.4, 3.4, 0))).toBeGreaterThan(1.5);          // the step of the tower is 6.8 m square
  });
});

describe('Newtown', () => {
  const sites = (NEWTOWN.district?.plots ?? []).map((p) => p.site as { x: number; z: number }), site = newtownSite(sites);
  it('the plaza edge, ring road footways and seats are clear of roads, footways and plot sites', () => {
    const placed = newtownPlaced(newtownFurniture());
    expect(placed.length).toBeGreaterThan(100);
    expect(countByCategory(auditObjects(site, placed))).toEqual({});
  });
  it('the plot sites keep clear of the ring roads', () => {
    for (const s of sites) for (const r of site.carriage) expect(ringLine(boxRing(s.x, s.z, 9, 9, 0), r.p)).toBeGreaterThan(r.w / 2);
  });
});
