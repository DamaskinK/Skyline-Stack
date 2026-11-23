// One landmark module per city. A module exports `hide` (OSM building names its models replace) and `build()` (a Group in the ring frame).
import * as kosice from './kosice.js';
import * as newtown from './newtown.js';

const SETS = { kosice, newtown };
export const landmarkHide = (id) => SETS[id]?.hide || null;
export const buildLandmarks = (id, assets) => SETS[id]?.build(assets) || null;
export const landmarkClear = (id) => SETS[id]?.clearance || [];
