// One landmark module per city. A module exports `hide` (OSM building names its models replace) and `build()` (a Group in the ring frame).
import type * as THREE from 'three';
import * as kosice from './kosice.js';
import * as newtown from './newtown.js';

import type { LevelAssets } from '../types.js';

interface LandmarkSet { hide: Set<string> | null; build(assets?: LevelAssets): THREE.Group; clearance: { x: number; z: number; r: number }[] }
const SETS: Record<string, LandmarkSet> = { kosice, newtown };
export const landmarkHide = (id: string) => SETS[id]?.hide || null;
export const buildLandmarks = (id: string, assets?: LevelAssets) => SETS[id]?.build(assets) || null;
export const landmarkClear = (id: string) => SETS[id]?.clearance || [];
