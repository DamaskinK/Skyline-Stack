// Building types: the kind of tower a level builds. Pure data, no Three.js or DOM.
// `trait` is a set of multipliers the simulation core applies on top of the difficulty (1 = no change):
//   perfect  width of the perfect window      mass   weight of every floor
//   slide    how far blocks slide on a roof   wind   wind on the hook, the flying block and the tower sway
// `nightVisibility` is a render hint only (Tokyo: at night only the lights show), the core ignores it.
// `facade` names the facade style the floor mesh uses; types without their own look use 'default' for now.

export const BUILDING_TYPES = {
  panel: {
    label: 'Panel block', facade: 'panel', variant: 0,
    trait: { perfect: 1, mass: 1, slide: 1, wind: 1 },
    nightVisibility: 1,
    hint: 'Plain prefab block. No tricks, learn the swing.',
  },
  hotel: {
    label: 'Mansard hotel', facade: 'default', variant: 1,
    trait: { perfect: 0.65, mass: 1, slide: 1, wind: 1 },
    nightVisibility: 1,
    hint: 'The perfect window is narrower. Aim carefully.',
  },
  office: {
    label: 'Concrete-and-glass office', facade: 'default', variant: 2,
    trait: { perfect: 1, mass: 1.5, slide: 1, wind: 1 },
    nightVisibility: 1,
    hint: 'Heavy floors: an offset weighs more on the tower.',
  },
  glass: {
    label: 'Glass skyscraper', facade: 'default', variant: 0,
    trait: { perfect: 1, mass: 1, slide: 1.6, wind: 1 },
    nightVisibility: 1,
    hint: 'Slippery roofs: your release speed carries the block further.',
  },
  deco: {
    label: 'Art deco tower', facade: 'default', variant: 1,
    trait: { perfect: 1, mass: 1, slide: 1, wind: 1.5 },
    nightVisibility: 1,
    hint: 'Strong wind between the skyscrapers. Read the gusts.',
  },
  neon: {
    label: 'Neon tower', facade: 'default', variant: 2,
    trait: { perfect: 1, mass: 1, slide: 1, wind: 1 },
    nightVisibility: 0.25,
    hint: 'Built at night: mostly the lights show, so judge the edge by them.',
  },
};

export const PLAIN_TRAIT = Object.freeze({ perfect: 1, mass: 1, slide: 1, wind: 1 });
export const buildingTypeById = (id) => BUILDING_TYPES[id] || null;
export const traitOf = (id) => (BUILDING_TYPES[id] ? BUILDING_TYPES[id].trait : PLAIN_TRAIT);

// The difficulty with a building type's trait applied: what the core really uses for one run.
export function applyTrait(diff, id) {
  const t = traitOf(id);
  return { ...diff, perfect: diff.perfect * t.perfect, wind: diff.wind * t.wind, slide: diff.slide * t.slide, sway: diff.sway, mass: t.mass };
}
