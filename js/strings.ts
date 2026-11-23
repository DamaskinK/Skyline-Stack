// Every text the player reads, in one place, so Slovak or Russian can be added later.
// Static texts in index.html carry data-t="key" (inner HTML) or data-t-aria="key" (aria-label); applyStrings() fills them.
// Dynamic texts are the functions at the bottom. Voice: short, plain, sentence case; buttons say what they do.

export const UI: Record<string, string> = {
  'common.back': 'Back',
  'title.tagline': 'Stack. Balance. Beat the weather.',
  'title.foot': 'Enter to choose · arrow keys to move · Esc to go back',
  'menu.play': 'Play', 'menu.scores': 'High scores', 'menu.settings': 'Settings', 'menu.help': 'How to play',

  'new.title': 'New Game', 'new.endless': 'Endless', 'new.districts': 'Districts', 'new.difficulty': 'Difficulty', 'new.start': 'Start game',
  'diff.easy': 'Easy', 'diff.normal': 'Normal', 'diff.hard': 'Hard',

  'set.title': 'Settings', 'set.difficulty': 'Default difficulty', 'set.music': 'Music', 'set.sfx': 'Sound effects',
  'set.graphics': 'Graphics quality', 'set.low': 'Low', 'set.medium': 'Medium', 'set.high': 'High',
  'set.camera': 'Camera', 'set.front': 'Front', 'set.side': 'Side', 'set.top': 'Top',
  'set.shake': 'Screen shake', 'set.hints': 'Tips and hints', 'set.on': 'On', 'set.off': 'Off',
  'set.scores': 'High scores', 'set.reset': 'Reset',

  'scores.title': 'High Scores',

  'help.title': 'How to Play', 'help.controls': 'Controls', 'help.landing': 'Landing', 'help.blocks': 'Blocks', 'help.types': 'Building types', 'help.weather': 'Weather',
  'help.controlsList':
    '<li><kbd>Space</kbd> or <kbd>Click</kbd> drops the block</li>'
    + '<li>Hold <kbd>Shift</kbd> for slow-mo. It refills by itself.</li>'
    + '<li><kbd>A</kbd> anchors the tower: no sway for 3 s</li>'
    + '<li><kbd>C</kbd> camera · <kbd>P</kbd> pause · <kbd>M</kbd> mute</li>',
  'help.landingList':
    '<li><b class="c-amber">Perfect</b> centred: builds a combo, calms the tower, refills slow-mo</li>'
    + '<li><b class="c-ok">Good</b> close enough</li>'
    + '<li><b class="c-bad">Risky</b> the offset makes the tower lean</li>'
    + '<li>More than half a block off and it slips. That costs a life.</li>',
  'help.weatherNote': 'Each city has its own weather by floor and its own events. A warning comes before every hit.',

  'load.title': 'Loading',
  'intro.skip': 'Space or click to skip',
  'pause.title': 'Paused', 'pause.resume': 'Resume', 'pause.restart': 'Restart', 'pause.quit': 'Quit to menu',
  'plot.toMap': 'Back to district map', 'plot.retry': 'Retry',
  'over.record': 'New record', 'over.name': 'Your name for the high scores', 'over.save': 'Save', 'over.menu': 'Menu',

  'hud.score': 'Score', 'hud.residents': 'Residents', 'hud.floor': 'Floor', 'hud.wind': 'Wind', 'hud.stability': 'Stability',
  'hud.slowmo': 'Slow-mo', 'hud.slowmoKey': '[Shift]', 'hud.anchor': 'Anchor', 'hud.anchorKey': '[A]', 'hud.next': 'Next',
  'hud.hint': 'Tap or press Space when the block is over the tower',
  'hud.camera': 'Change camera', 'hud.pause': 'Pause', 'hud.lives': 'Lives',
};

export const S = {
  // title and new game
  bestTower: (score: number, floors: number): string => `Best tower <b>${score}</b> · ${floors} floors`,
  noRecords: 'No records yet. Be the first.',
  endlessNote: (newtown: boolean): string =>
    `Endless: one tower on the ${newtown ? 'Newtown plaza' : 'Kosice city centre plot'}, as high as you can. The weather keeps changing as you climb. Play districts from the cards below.`,
  endlessKosice: ['Endless · Kosice', 'No target, as high as you can'] as const,
  endlessNewtown: ['Endless · Newtown', 'The made-up city, open from the start'] as const,
  districtCard: (fictional: boolean, country: string, goal: number): string => `${fictional ? 'Made-up city' : country} · 5 plots · goal ${goal} residents`,
  districtClosed: (country: string): string => `${country} · opened, not built yet`,
  meterLbl: { crane: 'Crane', wind: 'Wind', precision: 'Precision', lives: 'Lives' },

  // loading
  fetching: 'Fetching the city...',
  madeUpCity: 'Made-up city',
  menuLoading: (city: string): string => `Loading ${city}...`,
  introPlot: (place: string, n: number, total: number): string => `${place} · plot ${n} of ${total}`,
  filesFailed: (names: string): string => `Some files did not load (${names}). Playing without them.`,
  loadFailed: (msg: string): string => `Could not load the city: ${msg}. Playing the basic scene.`,

  // settings
  resetConfirm: 'Sure? Click again', resetDone: 'Done',
  muteOn: 'Mute sound', muteOff: 'Unmute sound',

  // scores
  noScores: 'No scores yet. Your first tower goes here.',
  floorsShort: (n: number): string => `${n} fl`,
  defaultName: 'Player', saved: 'Saved',

  // game over and plot result
  gameOver: 'Game Over', levelFailed: (city: string): string => `${city} failed`, playAgain: 'Play again', retry: 'Retry',
  stat: { score: 'Score', height: 'Height', residents: 'Residents', stars: 'Stars', perfects: 'Perfects', livesLost: 'Lives lost', bonus: 'Bonus', bestHere: 'Best here' },
  floors: (n: number): string => `${n} floors`,
  none: 'None',
  plotBuilt: (name: string): string => `${name} built`, plotNotCounted: (name: string): string => `${name} not counted`,
  counted: 'Counted', notCounted: 'Not counted',
  metRequirement: (req: string): string => `You met the requirement: ${req}.`,
  neededRequirement: (why: string, req: string): string => `${why}. Needed: ${req}.`,
  whyShort: (target: number, best: number): string => `the tower did not reach ${target} floors (best ${best})`,
  whyLives: (lost: number, max: number): string => `${lost} lives lost, the limit is ${max}`,
  whyPerfect: (share: number, need: number): string => `${share} % perfect landings, ${need} % needed`,
  bonusView: 'View +20 %', bonusSkyline: 'Skyline +15 %',
  starsOf: (n: number): string => `${n} of 3 stars`,
  districtLine: (city: string, res: number, goal: number): string => `${city} district · residents <b>${res}</b> / ${goal}`,
  residentsProgress: 'Residents towards the goal',
  plotsBuilt: (c: number, p: number, s: number, ms: number): string => `${c} / ${p} plots built · ${s} / ${ms} stars`,
  goalReached: 'Goal reached', goalReachedEarlier: 'Goal reached earlier',
  nextCityOpened: (city: string): string => `Next city opened: ${city}.`, nextCityOpenedPlain: 'Next city opened.', noNextCity: 'Newtown has no next city. Keep building it.',

  // district map
  mapTitle: (city: string): string => `${city} District`,
  mapSubReal: 'Five plots from the outskirts to the centre. Reach the residents goal to open the next city.',
  mapSubFictional: 'A made-up city. Build outward from the edge estate to the plaza.',
  mapResidents: (res: number, goal: number, reached: boolean): string => `Residents <b>${res}</b> / ${goal}${reached ? ' · goal reached' : ''}`,
  plotAria: (n: number, name: string, kind: string): string => `Plot ${n}: ${name}, ${kind}`,
  kind: { built: 'built', open: 'open', locked: 'locked' },
  tag: (label: string): string => label,
  plotMeta: (target: number, rate: number): string => `${target} floors · ${rate} residents per floor`,
  countIt: (req: string): string => `To count it: ${req}.`,
  statusBuilt: (res: number, best: number): string => `Built · ${res} residents · best ${best} fl`,
  statusOpenMissed: (best: number): string => `Open · best so far ${best} fl, requirement missed`,
  statusOpen: 'Open', statusLocked: 'Locked · build the plot before it first',
  whyBuilt: 'Built earlier. Build the plots before it first to play it again.', whyNotBuilt: 'This city is not built yet.',
  play: 'Play', replay: 'Replay',
  viewBonus: (pct: number, names: string, floors: number): string => `<b class="c-ok">View +${pct} %</b> sees ${names} from ${floors} floors up`,
  noView: '<b>View</b> no landmark in sight here',
  skyline: (pct: number, m: number, diff: number): string => `<b class="c-ok">Skyline +${pct} %</b> a built tower within ${m} m that differs by ${diff}+ floors`,
  req: {
    reach: (n: number): string => `reach ${n} floors`,
    lives: (n: number): string => `lose at most ${n} ${n === 1 ? 'life' : 'lives'}`,
    perfect: (pct: number): string => `at least ${pct} % perfect landings`,
  },
  landmarks: { 'st-elisabeth': 'St Elisabeth Cathedral', 'state-theatre': 'State Theatre', hlavna: 'Hlavna street', 'clock-tower': 'the Meridian Clock Tower', 'lantern-bridge': 'the Lantern Bridge' } as Record<string, string>,

  // HUD
  hudTarget: (n: number, t: number): string => `Target ${n} / ${t}`,
  hudLivesMax: (max: number, lost: number): string => `Lose at most ${max}: lost ${lost}`,
  hudPerfect: (need: number, now: number): string => `${need} % perfect: ${now} %`,
  hudNoReq: 'No extra requirement',
  meters: (n: number): string => `${n} m`,
  combo: (x: number): string => `Combo ×${x}`, goldenNext: 'Golden next',
  trendUp: 'Gusting ▲', trendDown: 'Easing ▼', trendSteady: 'Steady',
  nextWeather: (name: string, left: number): string => `${name} in ${left} fl`,
  hintNow: (h: string): string => `Now: ${h}`, hintNext: (h: string): string => `Next: ${h}`,

  // in-world popups and banners
  pop: {
    reasons: { 'SLIPPED OFF': 'Slipped off', MISS: 'Miss' } as Record<string, string>,
    anchor: 'Anchor', boing: 'Boing', collapse: (n: number): string => `Collapse −${n}`, target: 'Target reached',
    perfect: (combo: number): string => (combo > 1 ? `Perfect ×${combo}` : 'Perfect'), good: 'Good', risky: 'Risky', golden: 'Golden · calm',
  },
  banner: {
    lightning: 'Lightning incoming', goldenNext: 'Golden block next', anchorGained: '+1 anchor', gust: 'Sandstorm gust incoming',
    quakeWarning: (floor: number): string => `Earthquake at floor ${floor}`, quake: 'Earthquake',
  },
};

/** Fills every [data-t] (inner HTML) and [data-t-aria] (aria-label) element of the page. */
export function applyStrings(root: ParentNode = document): void {
  for (const el of root.querySelectorAll<HTMLElement>('[data-t]')) { const v = UI[el.dataset.t as string]; if (v != null) el.innerHTML = v; }
  for (const el of root.querySelectorAll<HTMLElement>('[data-t-aria]')) { const v = UI[el.dataset.tAria as string]; if (v != null) el.setAttribute('aria-label', v); }
}
