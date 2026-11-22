// Landmarks of Kosice, built by hand from low-poly parts: St. Elisabeth Cathedral with St. Urban's tower and St. Michael's chapel,
// the State Theatre and, in front of it, the Immaculata column and the Singing Fountain. They stand at their real spots (OSM footprints,
// frame of the rings: x east, z south, origin = build site), so the OSM footprints of these buildings are hidden (`hide`).
import * as THREE from 'three';
import { Parts, landmarkMaterials, lathe, box, cyl, extrude, archShape, roundArch, gableRoof, shedRoof, stretchUV } from './style.js';

// OSM names of the footprints the models replace
export const hide = new Set(['Dóm svätej Alžbety', 'Kaplnka sv. Michala', 'Národné divadlo Košice']);
// centre and rotation (about y; local +z turns to (sin, cos)) taken from the minimum-area rectangle of each footprint
const AT = {
  cathedral: { x: 29.1, z: 36.9, rot: 0 },                        // long axis east-west, apse to the east, towers at the west end
  theatre: { x: -34.2, z: -127.1, rot: 18 * Math.PI / 180 },      // front faces +z local = south-south-east, towards the site
  chapel: { x: 44.7, z: 76.1, rot: 13 * Math.PI / 180 },
  urban: { x: -9, z: 44 },
};

// ring of columns / half cylinders helper
const ring = (n, r, f) => { for (let i = 0; i < n; i++) { const a = (i / n) * Math.PI * 2; f(Math.cos(a) * r, Math.sin(a) * r, a); } };

// Baroque spire (lathe, 8 facets): neck, big onion, lantern, small onion, needle. y from 0, about 21 m tall.
const SPIRE = [[0, 0], [4.7, 0], [4.7, 0.8], [3.6, 1.5], [2.9, 2.4], [2.8, 3.6], [3.4, 4.8], [4.0, 6.2], [4.1, 7.4], [3.4, 8.8], [2.2, 10.2], [1.3, 11.4], [1.2, 12.8], [1.9, 13.0], [1.9, 13.4], [1.2, 13.6],
  [1.2, 14.6], [1.7, 15.6], [1.2, 16.8], [0.4, 18.4], [0.15, 21]];

function cathedral(parts) {
  // --- nave, aisles, transept, choir, apse ---
  const bay = 6;
  parts.add(box(27, 19, 16), 'gothic', { x: -5.5, y: 0, wall: bay });                             // nave (x -19..8, z +-8)
  for (const s of [-1, 1]) {
    parts.add(box(27, 11, 8), 'gothic', { x: -5.5, z: s * 12, wall: bay });                        // aisles (z 8..16)
    const r = shedRoof(27, 8, 4.2); parts.add(r, 'tiles', { x: -5.5, y: 11, z: s * 8, ry: s > 0 ? 0 : Math.PI });
  }
  parts.add(box(10, 19, 42), 'gothic', { x: 7, wall: bay });                                       // transept (x 2..12, z +-21)
  parts.add(box(10, 18, 14), 'gothic', { x: 17, wall: bay });                                      // choir (x 12..22, z +-7)
  const apse = new THREE.CylinderGeometry(7, 7, 18, 8, 1, false, 0, Math.PI).translate(0, 9, 0);   // half octagon, east end
  parts.add(apse, 'gothic', { x: 22, ry: -Math.PI / 2 }); parts.add(new THREE.CircleGeometry(7, 8, 0, Math.PI).rotateX(-Math.PI / 2), 'stone', { x: 22, y: 18, ry: -Math.PI / 2 });
  // glazed roofs: nave and transept (ridge 31), choir (27), apse cone
  let g = gableRoof(30, 9.5, 12.5, 4);
  for (const s of g.slopes) parts.add(s, 'tiles', { x: -5.5, y: 19 }); for (const e of g.ends) parts.add(e, 'stone', { x: -5.5, y: 19 });
  g = gableRoof(44, 6.5, 12.5, 4);
  for (const s of g.slopes) parts.add(s, 'tiles', { x: 7, y: 19, ry: Math.PI / 2 }); for (const e of g.ends) parts.add(e, 'stone', { x: 7, y: 19, ry: Math.PI / 2 });
  g = gableRoof(24, 8.2, 9, 4);
  for (const s of g.slopes) parts.add(s, 'tiles', { x: 17, y: 18 }); parts.add(g.ends[0], 'stone', { x: 17, y: 18 });
  parts.add(stretchUV(new THREE.ConeGeometry(8.2, 9, 8, 1, false, 0, Math.PI).translate(0, 4.5, 0), 6, 2), 'tiles', { x: 22, y: 18, ry: -Math.PI / 2 });
  // buttresses along aisles, choir and apse
  for (const s of [-1, 1]) for (let i = 0; i < 5; i++) parts.add(box(1.1, 12.5, 1.5), 'stone', { x: -17 + i * 6, z: s * 16.5 });
  for (const s of [-1, 1]) for (let i = 0; i < 3; i++) parts.add(box(1, 19, 1.2), 'stone', { x: 14 + i * 4, z: s * 7.4 });
  for (let i = 1; i < 4; i++) { const a = -Math.PI / 2 + (i / 4) * Math.PI; parts.add(box(1.1, 19.5, 1.2), 'stone', { x: 22 + Math.cos(a) * 7.5, z: Math.sin(a) * 7.5, ry: -a }); }
  // pinnacles on nave corners and transept
  for (const [x, z] of [[-18, -8.5], [-18, 8.5], [7.5, -8.5], [7.5, 8.5], [7, -21.2], [7, 21.2]]) parts.add(cyl(0.6, 0.0, 3.2, 4), 'stone', { x, y: 19, z });
  // --- west front: gabled middle between the towers, portal ---
  parts.add(box(7, 23, 20), 'gothic', { x: -23.5, wall: bay });
  parts.add(extrude([[-10, 0], [10, 0], [0, 6.5]], 7), 'stone', { x: -23.5, y: 23, ry: Math.PI / 2 });
  parts.add(archShape(4, 6, 2.4, 1), 'dark', { x: -27.1, y: 0, ry: -Math.PI / 2 });
  parts.add(archShape(5.4, 7.2, 2.8, 0.6), 'stoneGrey', { x: -27.05, y: 0, ry: -Math.PI / 2 });
  parts.add(archShape(3.8, 5.8, 2.3, 1), 'dark', { x: -27.2, y: 0, ry: -Math.PI / 2 });
  parts.add(archShape(3, 9, 3.6, 0.6), 'glass', { x: -27.15, y: 13, ry: -Math.PI / 2 });          // rose-window stand-in: tall west window
  // --- north tower (z -15.5): shaft 30, belfry 8, Baroque spire to 59 ---
  parts.add(box(11, 30, 11), 'tower', { x: -25.5, z: -15.5, wall: 5, vs: 9 });
  parts.add(box(12, 1, 12), 'stone', { x: -25.5, y: 30, z: -15.5 });
  parts.add(box(8.6, 7, 8.6), 'tower', { x: -25.5, y: 31, z: -15.5, wall: 4.3, vs: 7 });
  parts.add(box(9.6, 1, 9.6), 'stone', { x: -25.5, y: 38, z: -15.5 });
  parts.add(lathe(SPIRE, 8), 'copper', { x: -25.5, y: 39, z: -15.5 });
  parts.add(new THREE.SphereGeometry(0.5, 6, 4), 'gold', { x: -25.5, y: 59.6, z: -15.5 });
  for (const [dx, dz] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) parts.add(cyl(0.7, 0, 4, 4), 'copper', { x: -25.5 + dx * 4.4, y: 39, z: -15.5 + dz * 4.4 });
  // --- south (Matthias) tower (z +15.5): unfinished, lower, with a low copper cap ---
  parts.add(box(11, 31, 11), 'tower', { x: -25.5, z: 15.5, wall: 5, vs: 9 });
  parts.add(box(12, 1, 12), 'stone', { x: -25.5, y: 31, z: 15.5 });
  parts.add(box(8.8, 4, 8.8), 'tower', { x: -25.5, y: 32, z: 15.5, wall: 4.4, vs: 4 });
  parts.add(cyl(6.6, 0.8, 4.2, 4), 'copperDark', { x: -25.5, y: 36, z: 15.5, ry: Math.PI / 4 });
}

function urbanTower(parts) {                                                                       // bell tower, ~30 m, free-standing next to the west front
  parts.add(box(8, 20, 8), 'tower', { wall: 4, vs: 9 });
  parts.add(box(9, 1, 9), 'stone', { y: 20 });
  parts.add(cyl(3.6, 3.6, 5, 8), 'stone', { y: 21 });
  parts.add(lathe([[0, 0], [4, 0], [4, 0.6], [2.6, 1.6], [2.3, 2.6], [2.9, 3.6], [3.0, 4.4], [2.2, 5.6], [1.2, 6.6], [0.9, 7.4], [1.2, 7.7], [0.8, 8.6], [0.1, 10]], 8), 'copperDark', { y: 26 });
  parts.add(new THREE.SphereGeometry(0.35, 6, 4), 'gold', { y: 36.2 });
}

function chapel(parts) {                                                                           // St. Michael's chapel, 20 x 15 m, apse east
  parts.add(box(14, 7.5, 13), 'tower', { x: -2, wall: 5, vs: 9 });
  const g = gableRoof(16, 7.4, 5, 4);
  for (const s of g.slopes) parts.add(s, 'redTile', { x: -2, y: 7.5 }); for (const e of g.ends) parts.add(e, 'stone', { x: -2, y: 7.5 });
  parts.add(new THREE.CylinderGeometry(4.2, 4.2, 7.5, 6, 1, false, 0, Math.PI).translate(0, 3.75, 0), 'tower', { x: 5, ry: -Math.PI / 2 });
  parts.add(stretchUV(new THREE.ConeGeometry(4.6, 4, 6, 1, false, 0, Math.PI).translate(0, 2, 0), 3, 1), 'redTile', { x: 5, y: 7.5, ry: -Math.PI / 2 });
  parts.add(box(2.2, 4, 2.2), 'stone', { x: -8, y: 7.5 }); parts.add(cyl(1.6, 0, 3.4, 4), 'copperDark', { x: -8, y: 11.5, ry: Math.PI / 4 });
}

function theatre(parts) {
  // local frame: facade at z = +26 looking +z, width 33 (x), depth 52; ground 0
  const bay = 5.5;
  parts.add(box(33, 15, 40), 'cream', { z: 6, wall: bay });                                         // main body (z -14..26)
  parts.add(box(33.6, 0.9, 40.6), 'cream_flat', { y: 15, z: 6 });                                    // cornice
  parts.add(box(33, 1.0, 40), 'redTile', { y: 15.9, z: 6, sx: 0.96, sz: 0.96 });                     // flat roof (grey-red membrane, hidden by parapet)
  parts.add(box(20, 23, 20), 'wing', { z: -16, wall: 4, vs: 9 });                                    // stage house (z -26..-6)
  parts.add(box(20.8, 0.9, 20.8), 'cream_flat', { y: 23, z: -16 });
  for (const s of [-1, 1]) {
    parts.add(box(7.4, 17.5, 8), 'cream', { x: s * 13, z: 22.6, wall: bay });                       // corner pavilions of the front
    parts.add(box(8.2, 0.9, 8.8), 'cream_flat', { x: s * 13, y: 17.5, z: 22.6 });
    parts.add(lathe([[0, 0], [3.9, 0], [3.9, 0.5], [3.4, 1.4], [3.9, 2.6], [3.3, 4], [2.0, 5.2], [0.8, 6.0], [0.7, 6.8], [0.2, 8.4]], 10), 'copper', { x: s * 13, y: 18.4, z: 22.6 });
    parts.add(new THREE.SphereGeometry(0.35, 6, 4), 'gold', { x: s * 13, y: 26.9, z: 22.6 });
  }
  // rear corner domes (small)
  for (const s of [-1, 1]) parts.add(lathe([[0, 0], [2.6, 0], [2.4, 1], [1.5, 2.4], [0.5, 3.1], [0.1, 4]], 8), 'copper', { x: s * 14, y: 16.8, z: -12.5 });
  // portico: podium and steps, six columns, entablature, pediment with a sculpture group
  parts.add(box(15, 1.6, 6), 'stoneGrey', { z: 28.6 }); parts.add(box(15, 0.8, 7.4), 'stoneGrey', { z: 29.1 });
  parts.add(box(14, 11, 1.2), 'cream', { z: 26.6, wall: bay });                                       // front wall behind the columns
  for (let i = 0; i < 6; i++) { const x = -6 + i * 2.4; parts.add(cyl(0.62, 0.55, 10, 8), 'column', { x, y: 1.6, z: 29.6 }); parts.add(box(1.7, 0.5, 1.7), 'column', { x, y: 11.6, z: 29.6 }); parts.add(box(1.5, 0.4, 1.5), 'column', { x, y: 1.6, z: 29.6 }); }
  parts.add(box(15, 1.6, 6.2), 'cream_flat', { y: 12.1, z: 29.1 });
  parts.add(extrude([[-7.8, 0], [7.8, 0], [0, 3.4]], 6.2), 'cream_flat', { y: 13.7, z: 29.1 });
  parts.add(extrude([[-6, 0.3], [6, 0.3], [0, 2.6]], 0.2), 'stoneGrey', { y: 13.7, z: 32.3 });
  parts.add(cyl(0.5, 0.35, 1.8, 6), 'bronze', { y: 17.1, z: 29.1 }); parts.add(new THREE.SphereGeometry(0.45, 6, 4), 'bronze', { y: 19.2, z: 29.1 });
  for (const s of [-1, 1]) { parts.add(cyl(0.4, 0.3, 1.5, 6), 'bronze', { x: s * 7.3, y: 13.7, z: 29.1 }); parts.add(new THREE.SphereGeometry(0.38, 6, 4), 'bronze', { x: s * 7.3, y: 15.3, z: 29.1 }); }
  parts.add(archShape(3, 5.2, 0.01, 0.8), 'dark', { y: 1.6, z: 27.35 });                 // main door
  // statues along the cornice
  for (let i = 0; i < 9; i++) { const x = -13 + i * 3.25; if (Math.abs(x) < 8) continue; parts.add(cyl(0.45, 0.3, 1.6, 5), 'bronze', { x, y: 16.1, z: 25.8 }); parts.add(new THREE.SphereGeometry(0.36, 5, 4), 'bronze', { x, y: 17.9, z: 25.8 }); }
  // central drum and dome over the auditorium
  parts.add(cyl(10, 10, 4.6, 12), 'cream_flat', { y: 15.9, z: 4 });
  for (let i = 0; i < 12; i++) { const a = (i / 12) * Math.PI * 2 + Math.PI / 12; parts.add(archShape(1.6, 2.2, 0, 0.5), 'glass', { x: Math.cos(a) * 10.05, y: 17.3, z: 4 + Math.sin(a) * 10.05, ry: Math.PI / 2 - a }); }
  parts.add(lathe([[0, 0], [10.4, 0], [10.4, 0.5], [9.8, 2.2], [8.4, 4.6], [6.2, 6.8], [3.6, 8.4], [1.9, 9.3], [1.9, 9.8], [2.4, 10.1], [2.4, 11], [1.5, 11.5], [1.5, 12.4], [0.7, 13.0], [0.15, 15.2]], 12), 'copper', { y: 20.5, z: 4 });
  parts.add(new THREE.SphereGeometry(0.45, 6, 4), 'gold', { y: 35.7, z: 4 });
}

function plagueColumn(parts) {                                                                     // Immaculata: stepped plinth, column, gilded figure
  parts.add(cyl(2.4, 2.0, 0.6, 8), 'stoneGrey'); parts.add(cyl(1.7, 1.4, 1.2, 8), 'stoneGrey', { y: 0.6 });
  parts.add(box(2, 2.6, 2), 'stoneGrey', { y: 1.8 }); parts.add(cyl(0.38, 0.3, 4.6, 6), 'cream_flat', { y: 4.4 });
  parts.add(cyl(0.55, 0.4, 0.8, 6), 'cream_flat', { y: 9 }); parts.add(cyl(0.3, 0.2, 1.5, 5), 'gold', { y: 9.8 }); parts.add(new THREE.SphereGeometry(0.22, 5, 4), 'gold', { y: 11.5 });
}
function fountain(parts) {                                                                         // Singing Fountain: round basin, water, glass-like jets
  parts.add(cyl(4.6, 4.4, 0.7, 12), 'stoneGrey'); parts.add(cyl(4.1, 4.1, 0.05, 12), 'water', { y: 0.55 });
  parts.add(cyl(0.2, 0.2, 3.2, 5), 'water', { y: 0.6 });
  ring(6, 2.2, (x, z) => parts.add(cyl(0.12, 0.12, 1.6, 4), 'water', { x, y: 0.6, z }));
}

export function build() {
  const mats = landmarkMaterials(), root = new THREE.Group(); root.name = 'kosice-landmarks';
  const place = (name, a, fn, extra) => {
    const g = new THREE.Group(); g.name = name; g.position.set(a.x, 0, a.z); g.rotation.y = a.rot || 0;
    const p = new Parts(); fn(p); p.build(mats, g); root.add(g); return g;
  };
  const cat = place('st-elisabeth', AT.cathedral, cathedral);
  place('st-urban', { x: AT.urban.x, z: AT.urban.z }, urbanTower);
  place('st-michael-chapel', AT.chapel, chapel);
  const th = place('state-theatre', AT.theatre, theatre);
  // Immaculata column and Singing Fountain stand on the theatre's axis in front of it (local +z), outside the 28 m plaza
  const axis = (d) => ({ x: AT.theatre.x + Math.sin(AT.theatre.rot) * d, z: AT.theatre.z + Math.cos(AT.theatre.rot) * d });
  place('fountain', axis(40), fountain);
  place('immaculata', axis(55), plagueColumn);
  root.userData.stats = { cathedral: cat.userData.tris, theatre: th.userData.tris };
  return root;
}
