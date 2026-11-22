// Builds the near-ring map of a level from OpenStreetMap (Overpass API) into compact JSON.
//   node scripts/build-osm-level.mjs [kosice]
// Fixed parameters live in LEVELS below. The script is the source of truth; the JSON in assets/levels/<id>/ is generated.
// Data (c) OpenStreetMap contributors, ODbL. Output frame: metres, x = east, z = south (north is -z), origin = build site.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const LEVELS = {
  kosice: {
    site: { lat: 48.7206, lon: 21.2578 },   // keep in sync with js/levels.js
    half: 300,                               // bbox half-size in metres
    keep: 290,                               // keep features that touch this square around the site (metres)
    landmarks: [                             // for orientation checks and later camera work
      { id: 'st-elisabeth', lat: 48.72028, lon: 21.25811 },     // centre of the cathedral footprint in the data
      { id: 'state-theatre', lat: 48.72173, lon: 21.25733 },    // National Theatre Kosice footprint
    ],
  },
};
const MIRRORS = ['https://overpass-api.de/api/interpreter', 'https://overpass.kumi.systems/api/interpreter', 'https://maps.mail.ru/osm/tools/overpass/api/interpreter'];

const id = process.argv[2] || 'kosice';
const L = LEVELS[id]; if (!L) throw new Error(`unknown level ${id}`);
const mLat = 111320, mLon = 111320 * Math.cos(L.site.lat * Math.PI / 180);
const dLat = L.half / mLat, dLon = L.half / mLon;
const bb = [L.site.lat - dLat, L.site.lon - dLon, L.site.lat + dLat, L.site.lon + dLon].map((v) => v.toFixed(5)).join(',');
const query = `[out:json][timeout:90];
(way["highway"](${bb});
 way["building"](${bb});
 way["leisure"~"^(park|garden|pitch|playground)$"](${bb});
 way["landuse"~"^(grass|recreation_ground|village_green)$"](${bb});
 way["natural"~"^(water|wood)$"](${bb});
 way["railway"="tram"](${bb});
);
out geom tags;`;

async function fetchOverpass() {
  for (let attempt = 0; attempt < 12; attempt++) {
    const url = MIRRORS[attempt % MIRRORS.length];
    try {
      const r = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded', 'user-agent': 'skyline-stack-level-build/1.0' }, body: 'data=' + encodeURIComponent(query) });
      const t = await r.text();
      if (r.ok && t.startsWith('{')) return JSON.parse(t);
      console.error(`${url}: HTTP ${r.status}`);
    } catch (e) { console.error(`${url}: ${e.message}`); }
    await new Promise((s) => setTimeout(s, 4000 * (1 + attempt)));
  }
  throw new Error('Overpass unavailable');
}

const cache = process.env.OSM_RAW;   // optional: path of a saved raw response, to rebuild without the network
const raw = cache && fs.existsSync(cache) ? JSON.parse(fs.readFileSync(cache, 'utf8')) : await fetchOverpass();
if (cache && !fs.existsSync(cache)) fs.writeFileSync(cache, JSON.stringify(raw));

const r1 = (v) => Math.round(v * 10) / 10;
const toXZ = (g) => [(g.lon - L.site.lon) * mLon, -(g.lat - L.site.lat) * mLat];
const flat = (geom) => geom.flatMap((g) => { const [x, z] = toXZ(g); return [r1(x), r1(z)]; });
const near = (p) => { for (let i = 0; i < p.length; i += 2) if (Math.abs(p[i]) < L.keep && Math.abs(p[i + 1]) < L.keep) return true; return false; };
const closed = (geom) => geom.length > 3 && geom[0].lat === geom.at(-1).lat && geom[0].lon === geom.at(-1).lon;
const area = (p) => { let a = 0; for (let i = 0, n = p.length / 2; i < n; i++) { const j = (i + 1) % n; a += p[2 * i] * p[2 * j + 1] - p[2 * j] * p[2 * i + 1]; } return a / 2; };

// road type -> [class, width in metres]
const ROAD = {
  motorway: ['main', 12], trunk: ['main', 12], primary: ['main', 11], secondary: ['main', 10], tertiary: ['street', 8],
  unclassified: ['street', 7], residential: ['street', 7], living_street: ['street', 6], service: ['lane', 4.5],
  pedestrian: ['walk', 6], footway: ['path', 2.5], path: ['path', 2], cycleway: ['path', 2.5], steps: ['path', 2], track: ['path', 3],
};
const out = { id, source: 'OpenStreetMap contributors, ODbL', site: L.site, half: L.keep, frame: 'metres, x east, z south, origin = site', roads: [], rails: [], buildings: [], parks: [], water: [], names: [] };

for (const w of raw.elements) {
  if (w.type !== 'way' || !w.geometry) continue;
  const t = w.tags || {}, p = flat(w.geometry);
  if (!near(p)) continue;
  if (t.name && (t.highway === 'pedestrian' || /Hlavn|Elisab|Divadl|Theatre|Dom/i.test(t.name))) out.names.push({ name: t.name, at: [p[0], p[1]] });
  if (t.building && closed(w.geometry)) {
    if (area(p) > 0) { const q = []; for (let i = p.length - 2; i >= 0; i -= 2) q.push(p[i], p[i + 1]); p.splice(0, p.length, ...q); }   // one winding: clockwise seen from above
    p.length -= 2;                                                  // drop the repeated closing point
    let h = parseFloat(t.height); if (!(h > 0)) { const lv = parseFloat(t['building:levels']); h = lv > 0 ? lv * 3.1 + 1.5 : 0; }
    const b = { p, h: h ? r1(h) : 0 };
    if (t.amenity === 'place_of_worship' || t.building === 'cathedral' || t.building === 'church') b.k = 'church';
    else if (t.amenity === 'theatre') b.k = 'theatre';
    if (t.name && b.k) b.n = t.name;
    out.buildings.push(b);
  } else if (t.highway && ROAD[t.highway]) {
    const [k, w0] = ROAD[t.highway]; const lanes = parseFloat(t.lanes);
    const wd = parseFloat(t.width) || (lanes > 0 && k !== 'path' ? Math.max(w0, lanes * 3.2) : w0);
    const r = { k, w: r1(wd), p }; if (t.bridge) r.br = 1; if (t.tunnel) continue; if (t.name) r.n = t.name;
    out.roads.push(r);
  } else if (t.railway === 'tram') out.rails.push({ p });
  else if (closed(w.geometry) && (t.natural === 'water')) { p.length -= 2; out.water.push({ p }); }
  else if (closed(w.geometry) && (t.leisure || t.landuse || t.natural === 'wood')) { p.length -= 2; out.parks.push({ p, k: t.leisure === 'pitch' ? 'pitch' : t.natural === 'wood' ? 'wood' : 'park' }); }
}
out.landmarks = L.landmarks.map((lm) => { const [x, z] = toXZ(lm); return { id: lm.id, at: [r1(x), r1(z)], dist: Math.round(Math.hypot(x, z)), bearing: Math.round((Math.atan2(x, -z) * 180 / Math.PI + 360) % 360) }; });
const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'assets', 'levels', id);
fs.mkdirSync(dir, { recursive: true });
fs.writeFileSync(path.join(dir, 'osm.json'), JSON.stringify(out));
for (const lm of L.landmarks) { const [x, z] = toXZ(lm); console.log(`${lm.id}: x ${x.toFixed(0)} z ${z.toFixed(0)} dist ${Math.hypot(x, z).toFixed(0)} m, bearing ${((Math.atan2(x, -z) * 180 / Math.PI + 360) % 360).toFixed(0)} deg from north`); }
console.log(`roads ${out.roads.length}, buildings ${out.buildings.length} (with height ${out.buildings.filter((b) => b.h).length}), parks ${out.parks.length}, water ${out.water.length}, rails ${out.rails.length}`);
console.log('names', JSON.stringify(out.names.slice(0, 12)));
