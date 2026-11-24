// Builds the near-ring map of a level from OpenStreetMap (Overpass API) into compact JSON.
//   node scripts/build-osm-level.mjs [kosice]           one big extract around the city site (assets/levels/<id>/osm.json)
//   node scripts/build-osm-level.mjs <id> plots         one compact extract per district plot (assets/levels/<id>/plots/<plotId>.json)
// Fixed parameters live in LEVELS below. The script is the source of truth; the JSON in assets/levels/<id>/ is generated.
// Data (c) OpenStreetMap contributors, ODbL. Output frame: metres, x = east, z = south (north is -z), origin = build site.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const LEVELS = {
  kosice: {
    site: { lat: 48.72100, lon: 21.25755 },   // keep in sync with js/levels.js
    half: 300,                               // bbox half-size in metres
    keep: 290,                               // keep features that touch this square around the site (metres)
    landmarks: [                             // for orientation checks and later camera work
      { id: 'st-elisabeth', lat: 48.72028, lon: 21.25811 },     // centre of the cathedral footprint in the data
      { id: 'state-theatre', lat: 48.72173, lon: 21.25733 },    // National Theatre Kosice footprint
    ],
    // S0004 13: modern building kit. `m` of a building: 'barracks' inside a named area of renovated barracks (Kasarne/Kulturpark: white plaster,
    // arched windows, dark metal roofs); 'office' for office / hotel blocks of 4+ levels or 900+ m2 and shops of 3+ levels or 2500+ m2 (Aupark) outside the historic core;
    // 'resi' for apartment blocks built since 1995 (start_date) or named residential projects (Safranova zahrada, KZC Residence). The core stays old town.
    styleAreas: [{ name: /Kulturpark|Kas[aá]rne/i, m: 'barracks' }],
    historicCore: { lat: 48.72028, lon: 21.25811, r: 420 },
  },
};
const PLOT_HALF = 260, PLOT_KEEP = 250;       // plot extract: a 500 m square around the plot site (the middle ring takes over beyond it)
const MIRRORS = ['https://lz4.overpass-api.de/api/interpreter', 'https://overpass-api.de/api/interpreter', 'https://overpass.kumi.systems/api/interpreter', 'https://maps.mail.ru/osm/tools/overpass/api/interpreter'];

const id = process.argv[2] || 'kosice';
const plotsMode = process.argv[3] === 'plots';
const L = LEVELS[id]; if (!L) throw new Error(`unknown level ${id}`);
// js/levels.ts is TypeScript: bundle it to a temp file first (esbuild is a dev dependency).
const { buildSync } = await import('esbuild');
const levelsOut = path.join(os.tmpdir(), `levels-${process.pid}.mjs`);
buildSync({ entryPoints: [path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'js', 'levels.ts')], bundle: true, format: 'esm', outfile: levelsOut, logLevel: 'silent' });
const { LEVELS: GAME_LEVELS } = await import(levelsOut);
fs.rmSync(levelsOut, { force: true });
const plotList = plotsMode ? GAME_LEVELS.find((l) => l.id === id).district.plots.filter((pl) => !process.env.ONLY_PLOT || process.env.ONLY_PLOT.split(',').includes(pl.id)) : [];   // ONLY_PLOT=terasa,juzna rebuilds just those extracts
const bboxOf = (site, half) => {
  const dLat = half / 111320, dLon = half / (111320 * Math.cos(site.lat * Math.PI / 180));
  return [site.lat - dLat, site.lon - dLon, site.lat + dLat, site.lon + dLon].map((v) => v.toFixed(5)).join(',');
};
const boxes = plotsMode ? plotList.map((pl) => bboxOf(pl.site, PLOT_HALF + 10)) : [bboxOf(L.site, L.half)];
const query = `[out:json][timeout:120];
(${boxes.map((bb) => `way["highway"](${bb});
 way["building"](${bb});
 way["leisure"~"^(park|garden|pitch|playground)$"](${bb});
 way["landuse"~"^(grass|recreation_ground|village_green)$"](${bb});
 way["natural"~"^(water|wood)$"](${bb});
 way["railway"="tram"](${bb});
 node["railway"="tram_stop"](${bb});
 node["public_transport"="stop_position"]["tram"="yes"](${bb});
 way["amenity"="parking"](${bb});`).join('\n ')}
);
out geom tags;`;

async function fetchOverpass() {
  for (let attempt = 0; attempt < 6; attempt++) {
    const url = MIRRORS[attempt % MIRRORS.length];
    try {
      const r = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded', 'user-agent': 'skyline-stack-level-build/1.0' }, body: 'data=' + encodeURIComponent(query) });
      const t = await r.text();
      if (r.ok && t.startsWith('{')) return JSON.parse(t);
      console.error(`${url}: HTTP ${r.status}`);
    } catch (e) { console.error(`${url}: ${e.message}`); }
    await new Promise((s) => setTimeout(s, 4000 * (1 + attempt)));
  }
  return null;
}

// Fallback when every Overpass mirror is down (S0004 12): the main OSM API (api.openstreetmap.org/api/0.6/map) serves raw data for small boxes.
// One request per plot box (500 m square, well under the 0.25 deg2 limit), 2 s apart, with this script's own User-Agent (usage policy: no bulk).
// The XML is converted to the same raw shape as `out geom tags` and filtered like the Overpass query above. Multipolygon relations: the outer ways of
// simple ones (one outer ring) keep the relation's tags.
const UA = 'skyline-stack-level-build/1.0';
const attr = (s, k) => { const m = s.match(new RegExp(`\\b${k}="([^"]*)"`)); return m ? m[1] : null; };
const unesc = (v) => v.replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
function parseOsmXml(xml) {
  const nodes = new Map(), ways = [], rels = [];
  const tagsOf = (body) => { const t = {}; for (const m of body.matchAll(/<tag k="([^"]*)" v="([^"]*)"\s*\/>/g)) t[unesc(m[1])] = unesc(m[2]); return t; };
  for (const m of xml.matchAll(/<node ([^>]*?)(\/>|>([\s\S]*?)<\/node>)/g)) nodes.set(attr(m[1], 'id'), { lat: +attr(m[1], 'lat'), lon: +attr(m[1], 'lon'), tags: m[3] ? tagsOf(m[3]) : {} });
  for (const m of xml.matchAll(/<way ([^>]*?)>([\s\S]*?)<\/way>/g)) ways.push({ id: +attr(m[1], 'id'), refs: [...m[2].matchAll(/<nd ref="(\d+)"/g)].map((x) => x[1]), tags: tagsOf(m[2]) });
  for (const m of xml.matchAll(/<relation ([^>]*?)>([\s\S]*?)<\/relation>/g)) rels.push({ id: +attr(m[1], 'id'), tags: tagsOf(m[2]), outer: [...m[2].matchAll(/<member type="way" ref="(\d+)" role="outer"/g)].map((x) => +x[1]) });
  return { nodes, ways, rels };
}
const wanted = (t) => t.highway || t.building || /^(park|garden|pitch|playground)$/.test(t.leisure || '') || /^(grass|recreation_ground|village_green)$/.test(t.landuse || '') || /^(water|wood)$/.test(t.natural || '') || t.railway === 'tram' || t.amenity === 'parking';
async function fetchOsmApi() {
  const raw = { elements: [] }, seenIds = new Set();
  for (const pl of plotList) {
    const [s, w, n, e] = bboxOf(pl.site, PLOT_HALF + 10).split(',');
    const url = `https://api.openstreetmap.org/api/0.6/map?bbox=${w},${s},${e},${n}`;
    let xml = null;
    for (let attempt = 0; attempt < 3 && !xml; attempt++) {
      await new Promise((r) => setTimeout(r, 2000 * (1 + attempt * 3)));
      try { const r = await fetch(url, { headers: { 'user-agent': UA } }); if (r.ok) xml = await r.text(); else console.error(`OSM API ${pl.id}: HTTP ${r.status}`); } catch (err) { console.error(`OSM API ${pl.id}: ${err.message}`); }
    }
    if (!xml) return null;
    const { nodes, ways, rels } = parseOsmXml(xml);
    const geomOf = (wy) => wy.refs.map((r) => nodes.get(r)).filter(Boolean).map((p) => ({ lat: p.lat, lon: p.lon }));
    const byId = new Map(ways.map((wy) => [wy.id, wy]));
    for (const rel of rels) if (rel.tags.type === 'multipolygon' && rel.outer.length === 1 && byId.has(rel.outer[0])) { const wy = byId.get(rel.outer[0]); if (!Object.keys(wy.tags).length) wy.tags = { ...rel.tags }; }
    for (const wy of ways) {
      if (!wanted(wy.tags) || seenIds.has('w' + wy.id)) continue;
      seenIds.add('w' + wy.id); raw.elements.push({ type: 'way', id: wy.id, tags: wy.tags, geometry: geomOf(wy) });
    }
    for (const [id, p] of nodes) if ((p.tags.railway === 'tram_stop' || (p.tags.public_transport === 'stop_position' && p.tags.tram === 'yes')) && !seenIds.has('n' + id)) { seenIds.add('n' + id); raw.elements.push({ type: 'node', id: +id, lat: p.lat, lon: p.lon, tags: p.tags }); }
    console.error(`OSM API ${pl.id}: ${ways.length} ways, ${nodes.size} nodes`);
  }
  return raw;
}

const cache = process.env.OSM_RAW;   // optional: path of a saved raw response, to rebuild without the network
const raw = cache && fs.existsSync(cache) ? JSON.parse(fs.readFileSync(cache, 'utf8')) : (await fetchOverpass()) || (plotsMode ? await fetchOsmApi() : null);
if (!raw) throw new Error('Overpass and the OSM API are unavailable');
if (cache && !fs.existsSync(cache)) fs.writeFileSync(cache, JSON.stringify(raw));

const r1 = (v) => Math.round(v * 10) / 10;
const mLat = 111320;
const closed = (geom) => geom.length > 3 && geom[0].lat === geom.at(-1).lat && geom[0].lon === geom.at(-1).lon;
const area = (p) => { let a = 0; for (let i = 0, n = p.length / 2; i < n; i++) { const j = (i + 1) % n; a += p[2 * i] * p[2 * j + 1] - p[2 * j] * p[2 * i + 1]; } return a / 2; };


// road type -> [class, width in metres]
const ROAD = {
  motorway: ['main', 12], trunk: ['main', 12], primary: ['main', 11], secondary: ['main', 10], tertiary: ['street', 8],
  unclassified: ['street', 7], residential: ['street', 7], living_street: ['street', 6], service: ['lane', 4.5],
  pedestrian: ['walk', 6], footway: ['path', 2.5], path: ['path', 2], cycleway: ['path', 2.5], steps: ['path', 2], track: ['path', 3],
};
// S0004 13: which buildings get the modern kit (see styleAreas / historicCore above)
const inPoly = (ring, lat, lon) => { let c = false; for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) { const a = ring[i], b = ring[j]; if ((a.lat > lat) !== (b.lat > lat) && lon < (b.lon - a.lon) * (lat - a.lat) / (b.lat - a.lat) + a.lon) c = !c; } return c; };
const styleRings = (L.styleAreas || []).flatMap((s) => raw.elements.filter((w) => w.type === 'way' && w.geometry && w.tags?.name && s.name.test(w.tags.name) && closed(w.geometry)).map((w) => ({ ring: w.geometry, m: s.m })));
function modernClass(t, geom, a, lv) {
  if (a < 40 || /^(garage|garages|shed|roof|carport|service|church|chapel|cathedral)$/.test(t.building) || t.historic || t.heritage) return null;
  const lat = geom.reduce((s, g) => s + g.lat, 0) / geom.length, lon = geom.reduce((s, g) => s + g.lon, 0) / geom.length;
  for (const s of styleRings) if (inPoly(s.ring, lat, lon)) return s.m;
  const hc = L.historicCore;
  if (hc && Math.hypot((lat - hc.lat) * mLat, (lon - hc.lon) * mLat * Math.cos(hc.lat * Math.PI / 180)) < hc.r) return null;
  const year = parseInt(t.start_date, 10);
  if (year && year < 1960) return null;
  if (/^(office|hotel)$/.test(t.building) || t.office) return (lv >= 4 || a >= 900) ? 'office' : null;
  if (/^(commercial|retail)$/.test(t.building)) return (lv >= 3 || a >= 2500) ? 'office' : null;          // shops: only the big glass boxes (Aupark), not the corner stores
  if (/^(apartments|residential|yes)$/.test(t.building) && !t.amenity && !t.shop && ((year >= 1995) || (t.name && t.building !== 'yes') || (t.name && lv >= 3 && lv <= 8))) return 'resi';
  return null;
}
function extract(site, keep, outId) {
  const mLon = 111320 * Math.cos(site.lat * Math.PI / 180);
  const toXZ = (g) => [(g.lon - site.lon) * mLon, -(g.lat - site.lat) * mLat];
  const flat = (geom) => geom.flatMap((g) => { const [x, z] = toXZ(g); return [r1(x), r1(z)]; });
  const near = (p) => { for (let i = 0; i < p.length; i += 2) if (Math.abs(p[i]) < keep && Math.abs(p[i + 1]) < keep) return true; return false; };
  const seen = new Set();
  const out = { id: outId, source: 'OpenStreetMap contributors, ODbL', site, half: keep, frame: 'metres, x east, z south, origin = site', roads: [], rails: [], stops: [], parking: [], buildings: [], parks: [], water: [], names: [] };

  for (const w of raw.elements) {
    if (w.type === 'node' && w.lat != null && !seen.has('n' + w.id)) {   // tram stops: a point on the line
      seen.add('n' + w.id);
      const [x, z] = toXZ(w);
      if (Math.abs(x) < keep && Math.abs(z) < keep && !out.stops.some((q) => Math.hypot(q[0] - x, q[1] - z) < 12)) out.stops.push([r1(x), r1(z)]);
      continue;
    }
    if (w.type !== 'way' || !w.geometry || seen.has(w.id)) continue;
    seen.add(w.id);
    const t = w.tags || {}, p = flat(w.geometry);
    if (!near(p)) continue;
    if (t.name && (t.highway === 'pedestrian' || /Hlavn|Elisab|Divadl|Theatre|Dom/i.test(t.name))) out.names.push({ name: t.name, at: [p[0], p[1]] });
    if (t.building && closed(w.geometry)) {
      if (area(p) > 0) { const q = []; for (let i = p.length - 2; i >= 0; i -= 2) q.push(p[i], p[i + 1]); p.splice(0, p.length, ...q); }   // one winding: clockwise seen from above
      p.length -= 2;                                                  // drop the repeated closing point
      let h = parseFloat(t.height); if (!(h > 0)) { const lv = parseFloat(t['building:levels']); h = lv > 0 ? lv * 3.1 + 1.5 : 0; }
      const b = { p, h: h ? r1(h) : 0 };
      const lv = parseFloat(t['building:levels']);
      if (lv > 0) b.lv = lv;
      if (t.building === 'apartments' || t.building === 'residential' || t.building === 'dormitory') b.a = 1;     // flats: prefab blocks on the estates
      if (t.amenity === 'place_of_worship' || t.building === 'cathedral' || t.building === 'church') b.k = 'church';
      else if (t.amenity === 'theatre') b.k = 'theatre';
      if (t.name && (b.k || t.man_made === 'tower')) b.n = t.name;                // towers keep their name too (St. Urban's tower is hidden by name behind its Blender model)
      const m = modernClass(t, w.geometry, Math.abs(area(p)), lv);
      if (m && !b.k) b.m = m;
      out.buildings.push(b);
    } else if (t.highway && ROAD[t.highway]) {
      const [k, w0] = ROAD[t.highway]; const lanes = parseFloat(t.lanes);
      // one-way: 'yes' runs along the way, '-1' against it; roundabouts and motorway links are one-way by default (S0004 15)
      const ow = /^(yes|true|1)$/.test(t.oneway) || t.junction === 'roundabout' ? 1 : t.oneway === '-1' ? -1 : 0;
      const LANE_W = 3.4;                                              // a real city lane is 3.0 - 3.5 m; a carriageway is lanes x lane width (the tag `width` wins)
      const wd = parseFloat(t.width) || (lanes > 0 && k !== 'path' ? Math.max(w0, lanes * LANE_W) : w0);
      const r = { k, w: r1(wd), p }; if (t.bridge) r.br = 1; if (t.tunnel) continue; if (t.name) r.n = t.name;
      if (ow && (k === 'main' || k === 'street' || k === 'lane')) r.ow = ow;
      if (lanes > 0 && (k === 'main' || k === 'street')) r.ln = lanes;                   // lanes of this way (all directions together)
      const cyc = Object.keys(t).filter((x) => x.startsWith('cycleway')).map((x) => t[x]).concat(t.bicycle === 'designated' ? ['lane'] : []);
      if (t.highway === 'cycleway') r.bike = 2; else if (cyc.some((v) => v && v !== 'no' && v !== 'none')) r.bike = 1;   // 2: own cycle path, 1: lane on the street
      out.roads.push(r);
    } else if (t.railway === 'tram') out.rails.push({ p });
    else if (t.amenity === 'parking' && closed(w.geometry)) { p.length -= 2; out.parking.push({ p }); }
    else if (closed(w.geometry) && (t.natural === 'water')) { p.length -= 2; out.water.push({ p }); }
    else if (closed(w.geometry) && (t.leisure || t.landuse || t.natural === 'wood')) { p.length -= 2; out.parks.push({ p, k: t.leisure === 'pitch' ? 'pitch' : t.natural === 'wood' ? 'wood' : 'park' }); }
  }
  // a pool or atrium water polygon inside a building footprint is not open water: drop it (the placement audit flags a house on water)
  const inside = (pt, ring) => { let c = false; for (let i = 0, n = ring.length / 2, j = n - 1; i < n; j = i++) { const xi = ring[2 * i], zi = ring[2 * i + 1], xj = ring[2 * j], zj = ring[2 * j + 1]; if ((zi > pt[1]) !== (zj > pt[1]) && pt[0] < (xj - xi) * (pt[1] - zi) / (zj - zi) + xi) c = !c; } return c; };
  out.water = out.water.filter((wt) => { const n = wt.p.length / 2; let cx = 0, cz = 0; for (let i = 0; i < wt.p.length; i += 2) { cx += wt.p[i] / n; cz += wt.p[i + 1] / n; } return !out.buildings.some((b) => inside([cx, cz], b.p)); });
  out.landmarks = L.landmarks.map((lm) => { const [x, z] = toXZ(lm); return { id: lm.id, at: [r1(x), r1(z)], dist: Math.round(Math.hypot(x, z)), bearing: Math.round((Math.atan2(x, -z) * 180 / Math.PI + 360) % 360) }; });

  return { out, toXZ };
}
const here = path.dirname(fileURLToPath(import.meta.url));
const levelDir = path.join(here, '..', 'assets', 'levels', id);
if (plotsMode) {
  const dir = path.join(levelDir, 'plots'); fs.mkdirSync(dir, { recursive: true });
  let total = 0;
  for (const pl of plotList) {
    const { out } = extract(pl.site, PLOT_KEEP, `${id}/${pl.id}`);
    const s = JSON.stringify(out); fs.writeFileSync(path.join(dir, `${pl.id}.json`), s); total += s.length;
    console.log(`${pl.id}: ${(s.length / 1024).toFixed(0)} KB, roads ${out.roads.length}, buildings ${out.buildings.length} (apartments ${out.buildings.filter((b) => b.a).length}, height ${out.buildings.filter((b) => b.h).length}), parks ${out.parks.length}, water ${out.water.length}, rails ${out.rails.length}, tram stops ${out.stops.length}, car parks ${out.parking.length}; landmarks ${out.landmarks.map((l) => `${l.id} ${l.dist} m @${l.bearing}`).join(', ')}`);
  }
  console.log(`total ${(total / 1024).toFixed(0)} KB`);
} else {
  const { out, toXZ } = extract(L.site, L.keep, id);
  fs.mkdirSync(levelDir, { recursive: true });
  fs.writeFileSync(path.join(levelDir, 'osm.json'), JSON.stringify(out));
  for (const lm of L.landmarks) { const [x, z] = toXZ(lm); console.log(`${lm.id}: x ${x.toFixed(0)} z ${z.toFixed(0)} dist ${Math.hypot(x, z).toFixed(0)} m, bearing ${((Math.atan2(x, -z) * 180 / Math.PI + 360) % 360).toFixed(0)} deg from north`); }
  console.log(`roads ${out.roads.length}, buildings ${out.buildings.length} (with height ${out.buildings.filter((b) => b.h).length}), parks ${out.parks.length}, water ${out.water.length}, rails ${out.rails.length}`);
}
