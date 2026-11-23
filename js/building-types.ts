// Building types: the kind of tower a level builds. Pure data, no Three.js or DOM.
// `trait` is a set of multipliers the simulation core applies on top of the difficulty (1 = no change):
//   perfect  width of the perfect window      mass   weight of every floor
//   slide    how far blocks slide on a roof   wind   wind on the hook, the flying block and the tower sway
// `nightVisibility` is a render hint only (Tokyo: at night only the lights show), the core ignores it.
// `facade` names the facade style of the floor mesh, `crown` the top built on a finished tower, `sign` the ground-floor
// shop sign (null: the city name).

import type { BuildingType, BuildingTypeId, Difficulty, Trait } from './types.js';

export const BUILDING_TYPES: Record<BuildingTypeId, BuildingType> = {
  panel: {
    label: 'Panel block', facade: 'panel', variant: 0,
    crown: 'panel', sign: 'POTRAVINY',
    trait: { perfect: 1, mass: 1, slide: 1, wind: 1 },
    nightVisibility: 1,
    hint: 'Plain prefab block. No tricks, learn the swing.',
  },
  hotel: {
    label: 'Mansard hotel', facade: 'hotel', variant: 1,
    crown: 'hotel', sign: null,
    trait: { perfect: 0.65, mass: 1, slide: 1, wind: 1 },
    nightVisibility: 1,
    hint: 'The perfect window is narrower. Aim carefully.',
  },
  office: {
    label: 'Concrete-and-glass office', facade: 'office', variant: 2,
    crown: 'office', sign: null,
    trait: { perfect: 1, mass: 1.5, slide: 1, wind: 1 },
    nightVisibility: 1,
    hint: 'Heavy floors: an offset weighs more on the tower.',
  },
  glass: {
    label: 'Glass skyscraper', facade: 'glass', variant: 0,
    crown: 'glass', sign: null,
    trait: { perfect: 1, mass: 1, slide: 1.6, wind: 1 },
    nightVisibility: 1,
    hint: 'Slippery roofs: your release speed carries the block further.',
  },
  deco: {
    label: 'Art deco tower', facade: 'deco', variant: 1,
    crown: 'deco', sign: null,
    trait: { perfect: 1, mass: 1, slide: 1, wind: 1.5 },
    nightVisibility: 1,
    hint: 'Strong wind between the skyscrapers. Read the gusts.',
  },
  neon: {
    label: 'Neon tower', facade: 'neon', variant: 2,
    crown: 'neon', sign: null,
    trait: { perfect: 1, mass: 1, slide: 1, wind: 1 },
    nightVisibility: 0.25,
    hint: 'Built at night: mostly the lights show, so judge the edge by them.',
  },
};

export const PLAIN_TRAIT: Readonly<Trait> = Object.freeze({ perfect: 1, mass: 1, slide: 1, wind: 1 });
export const isBuildingTypeId = (id: string | null | undefined): id is BuildingTypeId => !!id && Object.hasOwn(BUILDING_TYPES, id);
export const buildingTypeById = (id: string | null | undefined): BuildingType | null => (isBuildingTypeId(id) ? BUILDING_TYPES[id] : null);
export const traitOf = (id: string | null | undefined): Readonly<Trait> => buildingTypeById(id)?.trait ?? PLAIN_TRAIT;

// The difficulty with a building type's trait applied: what the core really uses for one run.
export function applyTrait(diff: Difficulty, id: string | null | undefined): Difficulty {
  const t = traitOf(id);
  return { ...diff, perfect: diff.perfect * t.perfect, wind: diff.wind * t.wind, slide: diff.slide * t.slide, sway: diff.sway, mass: t.mass };
}
