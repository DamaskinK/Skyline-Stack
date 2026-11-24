// Pixel-art icons: every icon in the HUD and the menus is a small bitmap drawn as SVG rects on a pixel grid, one palette.
// A bitmap is rows of characters; '.' is empty and every other character is a palette key. Runs of equal pixels become one path piece.
const PAL: Record<string, string> = {
  k: '#0b1026',   // outline
  R: '#ff4d5e', r: '#a8283a', W: '#ffffff', Y: '#ffd34d', y: '#ffd34d', o: '#ff9a4d', D: '#2c3a78', d: '#1a2148',
  S: '#ffd2a6', B: '#52d9ff', b: '#52d9ff', c: '#c8d2e2', w: '#eef3fa', g: '#5a6378', n: '#3a4258', s: '#d8a468', f: '#f2c0a0',
  G: '#3fd07a', L: '#8b97c9', i: '#f1f3ff',
};

type Bitmap = { rows: string[]; pal?: Record<string, string> };
const bm = (rows: string[], pal?: Record<string, string>): Bitmap => ({ rows, pal });

// cloud body, rows 0-8 (16 wide); `c` is the cloud colour
const CLOUD = ['......kkkk......', '....kkccccckk...', '..kkcccccccccck.', '.kcccccccccccck.', 'kccccccccccccck.', 'kcccccccccccccck', 'kcccccccccccccck', '.kcccccccccccck.', '..kkkkkkkkkkkk..'];
const SKY = (below: string[], cloud: string): Bitmap => bm([...CLOUD, ...below], { c: cloud });

const ICONS: Record<string, Bitmap> = {
  heart: bm(['.kkk.kkk.', 'kRRRkRRRk', 'kRWRRRRRk', 'kRRRRRRRk', '.kRRRRRk.', '..kRRRk..', '...kRk...', '....k....']),
  heartOff: bm(['.kkk.kkk.', 'kDDDkDDDk', 'kDDDDDDDk', 'kDDDDDDDk', '.kDDDDDk.', '..kDDDk..', '...kDk...', '....k....']),
  star: bm(['.....k.....', '....kYk....', '....kYk....', '...kYYYk...', 'kkkkYYYkkkk', 'kYYYYYYYYYk', '.kYYYYYYYk.', '..kYYYYYk..', '..kYYkYYk..', '.kYYk.kYYk.', '.kkk...kkk.']),
  starOff: bm(['.....k.....', '....kdk....', '....kdk....', '...kdddk...', 'kkkkdddkkkk', 'kdddddddddk', '.kdddddddk.', '..kdddddk..', '..kddkddk..', '.kddk.kddk.', '.kkk...kkk.'], { k: '#2c3a78' }),
  person: bm(['..kkkkk..', '.kSSSSSk.', '.kSkSkSk.', '.kSSSSSk.', '..kkkkk..', '.kBBBBBk.', 'kBBBBBBBk', 'kBBBBBBBk', 'kBBkkkBBk', '.kkkkkkk.']),
  pause: bm(['kkk.kkk', 'kik.kik', 'kik.kik', 'kik.kik', 'kik.kik', 'kik.kik', 'kik.kik', 'kik.kik', 'kkk.kkk']),
  camera: bm(['.kkkkkkkk......', 'kiiiiiiiik.k...', 'kiiiiiiiik.kk..', 'kiiiiiiiik.kik.', 'kiiiiiiiik.kiik', 'kiiiiiiiik.kik.', 'kiiiiiiiik.kk..', 'kiiiiiiiik.k...', '.kkkkkkkk......']),
  speaker: bm(['....ki...', '...kii...', 'kkkkii...', 'kiiiii...', 'kiiiii...', 'kiiiii...', 'kkkkii...', '...kii...', '....ki...']),
  waves: bm(['.....ki..', '......ki.', '..i...ki.', '...i..ki.', '...i..ki.', '...i..ki.', '..i...ki.', '......ki.', '.....ki..']),
  mute: bm(['.i.....i.', '..i...i..', '...i.i...', '....i....', '...i.i...', '..i...i..', '.i.....i.']),
  anchor: bm(['....kk....', '...kiik...', '....kk....', '..kkiikk..', '....ii....', '....ii....', 'k...ii...k', 'kk..ii..kk', '.kiiiiiik.', '..kiiiik..']),
  lock: bm(['..kkkkk..', '.kiiiiik.', '.ki...ik.', '.ki...ik.', 'kkkkkkkkk', 'kYYYYYYYk', 'kYYYkYYYk', 'kYYYkYYYk', 'kYYYYYYYk', 'kkkkkkkkk']),
  check: bm(['.......kk', '......kGk', '.....kGk.', 'kk..kGk..', 'kGkkGk...', '.kGGk....', '..kk.....']),
  arrow: bm(['......k......', '......kk.....', 'kkkkkkkckk...', 'kccccccccck..', 'kkkkkkkckk...', '......kk.....', '......k......'], { c: '#52d9ff' }),
  sun: bm(['.......oo.......', '.......oo.......', '...o..kkkk..o...', '....okyyyyko....', '....kyyyyyyk....', 'oo.kyyyyyyyyk.oo', 'oo.kyyyyyyyyk.oo', '...kyyyyyyyyk...', '....kyyyyyyk....', '....okyyyyko....', '...o..kkkk..o...', '.......oo.......', '.......oo.......']),
  haze: bm(['......kkkk......', '.....kyyyyk.....', '....kyyyyyyk....', '....kyyyyyyk....', '.....kyyyyk.....', '......kkkk......', '................', '..oo..oo..oo..oo', '.oo..oo..oo..oo.', 'oo..oo..oo..oo..', '................', '..oo..oo..oo..oo', '.oo..oo..oo..oo.', 'oo..oo..oo..oo..']),
  rain: SKY(['................', '..b...b...b.....', '.b...b...b......', '..b...b...b.....', '.b...b...b......'], '#c8d2e2'),
  snow: SKY(['................', '..w...w...w.....', '....w...w...w...', '..w...w...w.....', '....w...w...w...'], '#eef3fa'),
  storm: SKY(['.......yy.......', '......yy........', '.....yyyy.......', '.......yy.......', '......yy........', '......y.........'], '#5a6378'),
  typhoon: SKY(['..bb..bb..bb....', '.bb..bb..bb.....', '..bb..bb..bb....', '.bb..bb..bb.....', '..b...b...b.....'], '#3a4258'),
  sand: bm(['................', '.ssssssssss.ss..', '............s...', 'ssssssssssssss..', '..............s.', '.ssssssssss.ss..', '................']),
  fog: bm(['................', '..ffffffffff....', '................', '....ffffffffff..', '................', '.ffffffffffff...', '................', '...ffffffffff...']),
};
const WX_KEY: Record<string, string> = { Clear: 'sun', Rain: 'rain', Snow: 'snow', Storm: 'storm', 'Heat haze': 'haze', Sandstorm: 'sand', Typhoon: 'typhoon', Fog: 'fog' };

// The SVG of a bitmap, centred on a square canvas. `cls` goes to the <svg>.
function pieces(b: Bitmap, square: boolean): { paths: string; n: number } {
  const w = Math.max(...b.rows.map((r) => r.length)), h = b.rows.length, n = Math.max(w, h);
  const ox = square ? Math.floor((n - w) / 2) : 0, oy = square ? Math.floor((n - h) / 2) : 0, by: Record<string, string> = {};
  b.rows.forEach((row, y) => {
    for (let x = 0; x < row.length;) {
      const ch = row[x]; if (ch === '.') { x++; continue; }
      let e = x; while (e < row.length && row[e] === ch) e++;
      const col = b.pal?.[ch] ?? PAL[ch] ?? '#ff00ff';
      by[col] = (by[col] ?? '') + `M${x + ox} ${y + oy}h${e - x}v1h-${e - x}z`;
      x = e;
    }
  });
  return { paths: Object.entries(by).map(([c, d]) => `<path d="${d}" fill="${c}"/>`).join(''), n };
}
function render(b: Bitmap, cls = ''): string {
  const { paths, n } = pieces(b, true);
  return `<svg viewBox="0 0 ${n} ${n}" class="px ${cls}" style="${size(n)}" shape-rendering="crispEdges" aria-hidden="true">${paths}</svg>`;
}
// Size is whole screen pixels: grid cells x --px (the CSS context sets it).
const size = (n: number, h = n): string => `width:calc(${n} * var(--px, 2px));height:calc(${h} * var(--px, 2px))`;
const flat = (b: Bitmap): string => pieces(b, false).paths;

// Icon by name; unknown names fail loudly (a typo is a bug).
export function pixelIcon(name: string, cls = ''): string {
  const b = ICONS[name]; if (!b) throw new Error(`no pixel icon "${name}"`);
  return render(b, cls);
}
export const heartIcon = (on: boolean): string => pixelIcon(on ? 'heart' : 'heartOff', on ? '' : 'off');
export const starIcon = (on: boolean): string => pixelIcon(on ? 'star' : 'starOff', on ? '' : 'off');
export const weatherIcon = (wx: string): string => pixelIcon(WX_KEY[wx] ?? 'sun');
export const weatherIconNames = Object.keys(WX_KEY);
export const pixelIconNames = Object.keys(ICONS);

// Speaker with sound waves, or crossed out when muted; both layers are in the SVG so the button can toggle `hidden` on `#muteWave` / `#muteX`.
export function muteIcon(): string {
  const sp = ICONS.speaker, wv = ICONS.waves, mu = ICONS.mute;
  return `<svg viewBox="0 0 14 9" class="px" style="${size(14, 9)}" shape-rendering="crispEdges" aria-hidden="true">${flat(sp)}<g id="muteWave" transform="translate(5 0)">${flat(wv)}</g><g id="muteX" transform="translate(5 1)" hidden>${flat(mu)}</g></svg>`;
}
// The wind compass: a pixel disc and an arrow that `#arrow` rotates (angle snapped to 15 degrees by the UI).
export function compassIcon(): string {
  const N = 17, c = 8, cells: string[] = [];
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const d = Math.hypot(x - c, y - c);
    if (d <= 8.4 && d > 7.2) cells.push(`<rect x="${x}" y="${y}" width="1" height="1" fill="#2c3a78"/>`);
    else if (d <= 7.2) cells.push(`<rect x="${x}" y="${y}" width="1" height="1" fill="#0b1026" opacity=".45"/>`);
  }
  const arrow = flat(ICONS.arrow);
  return `<svg id="compass" viewBox="0 0 17 17" class="px" style="${size(17)}" shape-rendering="crispEdges" aria-hidden="true">${cells.join('')}<g id="arrow"><g transform="translate(2 5)">${arrow}</g></g></svg>`;
}
