// Player settings and progress, kept in this browser's localStorage.
const KEY = 'tb3d_settings_v2';
const PROGRESS = 'tb3d_progress_v3';
import type { DistrictProgress, PlotResult, EndlessEntry, Progress, Settings } from './types.js';
import { sanitize, recordLevel, recordEndless } from './core/stars.js';
import { LEVELS, levelById, cityById, nextLevel } from './levels.js';
import { sanitizeDistrict, recordCityPlot, migrateFromLevels, cityProgress } from './core/district-progress.js';

const DEFAULTS: Settings = { difficulty: 'normal', sfx: 0.7, music: 0.35, quality: 'medium', shake: true, hints: true, muted: false, camera: 0 };

function read(key: string): unknown { try { return JSON.parse(localStorage.getItem(key) ?? 'null'); } catch { return null; } }
function write(key: string, v: unknown): void { try { localStorage.setItem(key, JSON.stringify(v)); } catch { /* storage blocked: settings last for this visit only */ } }

export const settings: Settings = { ...DEFAULTS, ...((read(KEY) as Partial<Settings> | null) || {}) };
const listeners: SettingsListener[] = [];
export type SettingsListener = <K extends keyof Settings>(key: K, value: Settings[K]) => void;
export function onSettings(fn: SettingsListener): void { listeners.push(fn); }
export function setSetting<K extends keyof Settings>(k: K, v: Settings[K]): void { settings[k] = v; write(KEY, settings); for (const fn of listeners) fn(k, v); }

// Progress (best stars, best height, opened levels, Endless scores per city) lives under its own versioned key.
// The old City-score key tb3d_scores_v2 is never read, so a bad or old value cannot break the game.
export function loadProgress(): Progress { return sanitize(read(PROGRESS)); }
function saveProgress(p: Progress): Progress { write(PROGRESS, p); return p; }
export function saveLevelResult(levelId: string, stars: number, height: number): Progress { return saveProgress(recordLevel(loadProgress(), LEVELS, levelId, { stars, height })); }
export function loadScores(cityId = 'kosice'): EndlessEntry[] { return loadProgress().endless[cityId] || []; }
export function addScore(cityId: string, entry: EndlessEntry): EndlessEntry[] | undefined { return saveProgress(recordEndless(loadProgress(), cityId, entry)).endless[cityId]; }
export function resetScores(): void { const p = loadProgress(); p.endless = {}; saveProgress(p); }

// District progress (S0002): per city, per plot. Own versioned key; the S0001 key above stays as it is (Endless scores
// and level stars still live there). The first load without district data carries Kosice level progress onto its last plot.
const DISTRICT = 'tb3d_district_v1';
export function loadDistrictProgress(): DistrictProgress {
  const p = sanitizeDistrict(read(DISTRICT));
  const kosice = levelById('kosice')?.district;
  if (!kosice) throw new Error('levels.js has no Kosice district');
  return migrateFromLevels(p, loadProgress(), 'kosice', kosice);
}
export function saveDistrictResult(cityId: string, plotId: string, result: PlotResult) {
  const district = cityById(cityId)?.district;
  if (!district) throw new Error(`no district for city ${cityId}`);
  const next = recordCityPlot(loadDistrictProgress(), cityId, district, plotId, result, nextLevel(cityId)?.id || null);
  write(DISTRICT, next);
  return cityProgress(next, cityId);
}
