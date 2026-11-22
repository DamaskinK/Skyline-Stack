// Player settings and progress, kept in this browser's localStorage.
const KEY = 'tb3d_settings_v2';
const PROGRESS = 'tb3d_progress_v3';
import { sanitize, recordLevel, recordEndless } from './core/stars.js';
import { LEVELS } from './levels.js';

const DEFAULTS = { difficulty: 'normal', sfx: 0.7, music: 0.35, quality: 'high', shake: true, hints: true, muted: false, camera: 0 };

function read(key) { try { return JSON.parse(localStorage.getItem(key)); } catch { return null; } }
function write(key, v) { try { localStorage.setItem(key, JSON.stringify(v)); } catch { /* storage blocked: settings last for this visit only */ } }

export const settings = { ...DEFAULTS, ...(read(KEY) || {}) };
const listeners = [];
export function onSettings(fn) { listeners.push(fn); }
export function setSetting(k, v) { settings[k] = v; write(KEY, settings); for (const fn of listeners) fn(k, v); }

// Progress (best stars, best height, opened levels, Endless scores per city) lives under its own versioned key.
// The old City-score key tb3d_scores_v2 is never read, so a bad or old value cannot break the game.
export function loadProgress() { return sanitize(read(PROGRESS)); }
function saveProgress(p) { write(PROGRESS, p); return p; }
export function saveLevelResult(levelId, stars, height) { return saveProgress(recordLevel(loadProgress(), LEVELS, levelId, { stars, height })); }
export function loadScores(cityId = 'kosice') { return loadProgress().endless[cityId] || []; }
export function addScore(cityId, entry) { return saveProgress(recordEndless(loadProgress(), cityId, entry)).endless[cityId]; }
export function resetScores() { const p = loadProgress(); p.endless = {}; saveProgress(p); }
