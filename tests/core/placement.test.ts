// Placement audit (S0004 00): nothing in Kosice or Newtown stands where it cannot. The plan of every plot extract (js/core/placement.ts)
// is re-checked from scratch against the real size of houses, carriageways, bike lanes, tram beds, footways, basins, river and the
// plaza; the same audit runs on the built scene in `node tests/browser/check.mjs audit`.
import { describe, expect, it } from 'vitest';
import { auditObjects, auditPlan, clipNetwork, countByCategory, footprint, hits, keptBuildings, makeSite, newtownFurniture, newtownPlaced, newtownSite, planNearRing, trimNetwork, towerCircles, PAD_HALF, PLAZA_HALF } from '../../js/core/placement.js';
import { boxRing, lineOutside, overlapArea, pointInRing, ringLine, ringRing } from '../../js/core/geometry2d.js';
import { cityById } from '../../js/levels.js';
import { NEWTOWN } from '../../js/levels.js';
import type { OsmExtract } from '../../js/types.js';

const nodeFs = 'node:fs';
const fs = (await import(/* @vite-ignore */ nodeFs)) as { readFileSync(p: string, e: string): string };
const kosice = cityById('kosice'), plots = kosice?.district?.plots ?? [];
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
    const a = { kind: 'tree' as const, x: 80, z: 80, ring: footprint('tree', 80, 80) }, b = { kind: 'tree' as const, x: 80.4, z: 80, ring: footprint('tree', 80.4, 80) };
    expect(countByCategory(auditObjects({ ...site, buildings: [], carriage: [], foot: [], basins: [], river: [], bikes: [], tram: [] }, [a, b]))).toEqual({ 'tree-tree': 1 });
  });
});

describe('Kosice plots', () => {
  it.each(plots.map((p) => p.id))('%s: nothing is placed on anything', (id) => {
    const osm = extract(id), plan = planNearRing(osm, { towers: towerCircles(kosice?.site, plots, id, osm.half) });
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
  it('the player plot pad is bare plaza and no two houses overlap', () => {
    for (const p of plots) {
      const plan = planNearRing(extract(p.id)), b = plan.site.buildings;
      for (const s of b) expect(ringRing(s.r, boxRing(0, 0, PLAZA_HALF, PLAZA_HALF, 0))).toBeGreaterThan(0);
      for (let i = 0; i < b.length; i++) for (let j = i + 1; j < b.length; j++) if (b[i].box[0] < b[j].box[2] && b[j].box[0] < b[i].box[2] && b[i].box[1] < b[j].box[3] && b[j].box[1] < b[i].box[3]) expect(overlapArea(b[i].r, b[j].r, 0.5)).toBeLessThan(1);
    }
  });
  it('towers of the other plots keep their site free where two plots share an extract', () => {
    const near = plots.filter((p) => towerCircles(kosice?.site, plots, p.id).length > 0);
    expect(near.length).toBeGreaterThan(0);                  // Hlavna street and Cathedral square lie within each other's extract
    for (const p of near) {
      const osm = extract(p.id), towers = towerCircles(kosice?.site, plots, p.id, osm.half), plan = planNearRing(osm, { towers });
      for (const t of towers) for (const b of plan.site.buildings) expect(ringRing(b.r, boxRing(t.x, t.z, t.r, t.r, 0))).toBeGreaterThan(0);
    }
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
