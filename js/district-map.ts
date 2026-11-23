// District map screen (S0002 ticket 05): a stylised top-down map of one city's five plots, the path from the outskirts to
// the centre, a card per plot (type, target, requirement, bonuses, stars) and the residents bar towards the goal.
// Plot positions come from the plot data (lat/lon, or x/z metres for Newtown); nothing is placed by hand.
import { BUILDING_TYPES } from './building-types.js';
import { cityById } from './levels.js';
import { loadDistrictProgress } from './settings.js';
import { cityProgress } from './core/district-progress.js';
import { isPlotOpen, nextPlot, plotOf, plotBonuses, plotResidents, districtTotals, RESIDENTS_PER_FLOOR, DEFAULT_RESIDENTS_PER_FLOOR,
  VIEW_BONUS, VIEW_MIN_FLOORS, SKYLINE_BONUS, SKYLINE_MIN_DIFF, SKYLINE_RADIUS_M } from './core/district.js';
import type { District, GridXZ, Level, Plot, PlotStates, PlotState } from './types.js';

const esc = (s: unknown): string => String(s).replace(/[<>&"]/g, '');
const STAR = (on: boolean): string => `<svg viewBox="0 0 24 24" class="${on ? '' : 'off'}" aria-hidden="true"><path d="M12 2l3 6.5 7 .9-5.2 4.8 1.4 7L12 17.6 5.8 21.2l1.4-7L2 9.4l7-.9z" fill="#ffd34d" stroke="#000" stroke-width="1.5" stroke-linejoin="round"/></svg>`;
const LANDMARK_NAMES: Record<string, string> = { 'st-elisabeth': 'St Elisabeth Cathedral', 'state-theatre': 'State Theatre', hlavna: 'Hlavna street', 'clock-tower': 'the Meridian Clock Tower', 'lantern-bridge': 'the Lantern Bridge' };
const landmarkName = (id: string): string => LANDMARK_NAMES[id] || id.replace(/-/g, ' ').replace(/^./, (c) => c.toUpperCase());

export function requirementText(plot: Pick<Plot, 'target' | 'require'>): string {
  const q = plot.require || {};
  const parts = [`reach ${plot.target} floors`];
  if (q.maxLivesLost != null) parts.push(`lose at most ${q.maxLivesLost} ${q.maxLivesLost === 1 ? 'life' : 'lives'}`);
  if (q.minPerfectShare != null) parts.push(`at least ${Math.round(q.minPerfectShare * 100)} % perfect landings`);
  return parts.join(', ');
}

// Plot coordinates in metres east/north of the first plot, then fitted into a W x H box with padding (aspect kept).
export function layoutPlots(plots: Pick<Plot, 'site'>[], W = 640, H = 400, pad = 70): { x: number; y: number }[] {
  const raw = plots.map((p) => {
    const s = p.site;
    return 'lat' in s && s.lat != null ? { x: s.lon * Math.cos(s.lat * Math.PI / 180), y: -s.lat } : { x: (s as GridXZ).x, y: (s as GridXZ).z };
  });
  const xs = raw.map((r) => r.x), ys = raw.map((r) => r.y);
  const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
  const k = Math.min((W - 2 * pad) / Math.max(x1 - x0, 1e-9), (H - 2 * pad) / Math.max(y1 - y0, 1e-9));
  const ox = (W - (x1 - x0) * k) / 2, oy = (H - (y1 - y0) * k) / 2;
  return raw.map((r) => ({ x: ox + (r.x - x0) * k, y: oy + (r.y - y0) * k }));
}

export interface DistrictMapHandlers { onPlay: (cityId: string, plotId: string) => void; onBack?: () => void }
export interface DistrictMap { render(id?: string, opts?: { focusNext?: boolean }): { next: Plot | null } }

export function createDistrictMap({ onPlay, onBack }: DistrictMapHandlers): DistrictMap {
  const root = document.querySelector('#sMap') as HTMLElement;
  const $ = (s: string): HTMLElement => root.querySelector(s) as HTMLElement;
  let cityId = 'kosice', selected: string | null = null;

  function stateOf(city: Level, plots: PlotStates, p: Plot): { st: PlotState; open: boolean; kind: 'built' | 'open' | 'locked' } {
    const st = plotOf(plots, p.id), open = isPlotOpen(city.district as District, plots, p.id);
    return { st, open, kind: st.counted ? 'built' : open ? 'open' : 'locked' };
  }

  function bonusLines(plot: Plot): string {
    const b = plotBonuses(plot);
    const view = b.view
      ? `<li><b class="c-ok">VIEW +${Math.round(VIEW_BONUS * 100)} %</b> sees ${plot.landmarksInView.map(landmarkName).map(esc).join(', ')} from ${VIEW_MIN_FLOORS} floors up</li>`
      : '<li class="off"><b>VIEW</b> no landmark in sight here</li>';
    const sky = `<li><b class="c-ok">SKYLINE +${Math.round(SKYLINE_BONUS * 100)} %</b> a built tower within ${SKYLINE_RADIUS_M} m that differs by ${SKYLINE_MIN_DIFF}+ floors</li>`;
    return view + sky;
  }

  function render(id = cityId, { focusNext = false }: { focusNext?: boolean } = {}): { next: Plot | null } {
    cityId = id;
    const city = cityById(id) as Level, d = city.district as District;
    const progress = cityProgress(loadDistrictProgress(), id), plots = progress.plots;
    const tot = districtTotals(d, plots), next = nextPlot(d, plots);
    if (focusNext && next) selected = next.id;
    if (!selected || !d.plots.some((p) => p.id === selected)) selected = (next || d.plots[d.plots.length - 1]).id;
    const playable = !!city.built;

    $('#mapTitle').textContent = `${city.city.toUpperCase()} DISTRICT`;
    $('#mapSub').textContent = city.fictional ? 'A made-up city. Build outward from the edge estate to the plaza.' : 'Five plots from the outskirts to the centre. Reach the residents goal to open the next city.';
    const pct = Math.min(100, Math.round(tot.residents / tot.goal * 100));
    $('#mapRes').innerHTML = `<div class="lbl">RESIDENTS <b>${tot.residents}</b> / ${tot.goal}${progress.goalReached || tot.residents >= tot.goal ? ' · GOAL REACHED' : ''}</div>`
      + `<div class="bar res" role="progressbar" aria-label="Residents towards the goal" aria-valuemin="0" aria-valuemax="${tot.goal}" aria-valuenow="${tot.residents}"><i style="width:${pct}%"></i></div>`
      + `<div class="lbl">${tot.counted} / ${tot.plots} PLOTS BUILT · ${tot.stars} / ${tot.maxStars} STARS</div>`;

    // map: path + faint rings around the centre plot, markers as real buttons over the SVG
    const pos = layoutPlots(d.plots), W = 640, H = 400, c = pos[pos.length - 1];
    const path = pos.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
    const rings = [90, 190, 300].map((r) => `<circle cx="${c.x.toFixed(1)}" cy="${c.y.toFixed(1)}" r="${r}" class="ring"/>`).join('');
    const segs = pos.slice(1).map((p, i) => {
      const a = pos[i], built = plotOf(plots, d.plots[i].id).counted;
      return `<line x1="${a.x.toFixed(1)}" y1="${a.y.toFixed(1)}" x2="${p.x.toFixed(1)}" y2="${p.y.toFixed(1)}" class="seg ${built ? 'done' : ''}"/>`;
    }).join('');
    $('#mapArt').innerHTML = `<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid meet" aria-hidden="true">`
      + `<rect width="${W}" height="${H}" class="ground"/>${rings}<polyline points="${path}" class="road"/>${segs}</svg>`
      + d.plots.map((p, i) => {
        const s = stateOf(city, plots, p);
        return `<button type="button" class="pin ${s.kind}${p.id === selected ? ' sel' : ''}" data-plot="${esc(p.id)}" style="left:${(pos[i].x / W * 100).toFixed(2)}%;top:${(pos[i].y / H * 100).toFixed(2)}%" `
          + `aria-label="Plot ${i + 1}: ${esc(p.name)}, ${s.kind === 'locked' ? 'locked' : s.kind}"><span>${i + 1}</span></button>`
          + `<span class="pinlbl${i % 2 ? "" : " up"}" style="left:${(pos[i].x / W * 100).toFixed(2)}%;top:${(pos[i].y / H * 100).toFixed(2)}%">${esc(p.name)}</span>`;
      }).join('');

    $('#plotCards').innerHTML = d.plots.map((p, i) => {
      const s = stateOf(city, plots, p), t = BUILDING_TYPES[p.buildingType] || { label: p.buildingType };
      const rate = RESIDENTS_PER_FLOOR[p.buildingType] ?? DEFAULT_RESIDENTS_PER_FLOOR;
      const status = s.kind === 'built' ? `BUILT · ${plotResidents(d, plots, p.id)} residents · best ${s.st.bestHeight} fl`
        : s.kind === 'open' ? (s.st.bestHeight ? `OPEN · best so far ${s.st.bestHeight} fl, requirement missed` : 'OPEN') : 'LOCKED · build the plot before it first';
      const why = !s.open ? (s.kind === 'built' ? 'Built earlier. Counted plots before it first to play it again.' : '')
        : !playable ? 'This city is not built yet.' : '';
      return `<article class="pcard ${s.kind}${p.id === selected ? ' sel' : ''}" data-plot="${esc(p.id)}" aria-label="${esc(p.name)}">`
        + `<header><span class="num">${i + 1}</span><b>${esc(p.name).toUpperCase()}</b><span class="stars sm" role="img" aria-label="${s.st.stars} of 3 stars">${[1, 2, 3].map((n) => STAR(n <= s.st.stars)).join('')}</span></header>`
        + `<div class="meta"><span class="tag">${esc(t.label).toUpperCase()}</span><span>${p.target} floors · ${rate} residents per floor</span></div>`
        + `<p class="req">Count it: ${requirementText(p)}.</p>`
        + `<ul class="bon">${bonusLines(p)}</ul>`
        + `<div class="foot2"><span class="st">${status}</span>`
        + (s.open ? `<button type="button" class="btn sm${s.kind === 'open' && (next && next.id === p.id) ? '' : ' ghost'}" data-play="${esc(p.id)}"${playable ? '' : ' disabled'}>${s.kind === 'built' ? 'REPLAY' : 'PLAY'} ▶</button>` : '')
        + `</div>${why ? `<p class="why">${why}</p>` : ''}</article>`;
    }).join('');

    for (const el of root.querySelectorAll<HTMLElement>('[data-plot]')) el.addEventListener('click', (e) => {
      if ((e.target as Element).closest('[data-play]')) return;
      selected = el.dataset.plot as string; render();
      const card = root.querySelector(`.pcard[data-plot="${selected}"]`);
      if (card) card.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    });
    for (const b of root.querySelectorAll<HTMLElement>('[data-play]')) b.addEventListener('click', () => onPlay(cityId, b.dataset.play as string));
    return { next };
  }

  $('#mapBack').addEventListener('click', () => onBack && onBack());
  return { render };
}
