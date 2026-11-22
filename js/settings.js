// Player settings and high scores, kept in this browser's localStorage.
const KEY = 'tb3d_settings_v2';
const SCORES = 'tb3d_scores_v2';

const DEFAULTS = { difficulty: 'normal', sfx: 0.7, music: 0.35, quality: 'high', shake: true, hints: true, muted: false, camera: 0 };

function read(key) { try { return JSON.parse(localStorage.getItem(key)); } catch { return null; } }
function write(key, v) { try { localStorage.setItem(key, JSON.stringify(v)); } catch { /* storage blocked: settings last for this visit only */ } }

export const settings = { ...DEFAULTS, ...(read(KEY) || {}) };
const listeners = [];
export function onSettings(fn) { listeners.push(fn); }
export function setSetting(k, v) { settings[k] = v; write(KEY, settings); for (const fn of listeners) fn(k, v); }

export function loadScores() { return read(SCORES) || {}; }
export function addScore(mode, entry) {
  const all = loadScores(); const list = all[mode] || [];
  list.push(entry); list.sort((a, b) => b.score - a.score); all[mode] = list.slice(0, 10);
  write(SCORES, all); return all[mode];
}
export function resetScores() { write(SCORES, {}); }
