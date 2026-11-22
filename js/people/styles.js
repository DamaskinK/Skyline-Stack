// Clothing styles per city: pure data, no Three.js. Everyday, modern wear first; a few traditional or festive details.
// An outfit has a weight `w` and fields:
//   garment  'trousers' | 'skirt' | 'robe'          (default trousers)
//   top, bottom, shoes   colour lists (one is picked)
//   sleeves  'long' | 'short'; coat 'none' | 'jacket' | 'long'; coatCol colours (default: top)
//   vest colours (a waistcoat over the top, e.g. embroidered), vestTrim colour
//   hair colours + hairStyle 'short' | 'long' | 'bun' | 'none'; hat 'none' | 'beanie' | 'cap'; hatCol colours
//   headwear 'ghutra' | 'hijab' (traditional head covering, colours in headCol), scarf colours (optional)
//   tie colour (suit), bag 'backpack' | 'shoulder' | 'none', bagCol colours, scale (children < 1), tights colours (skirts)
// Colour lists are numbers (0xRRGGBB). `cold` outfits are added automatically in snow (see dressForCold in fx.js).

export const SKIN = [0xffd9b8, 0xf0c29a, 0xd9a273, 0xb07a4f, 0x8a5a3a];
const SKIN_EURO = [0xffd9b8, 0xf0c29a, 0xf6cfa8, 0xd9a273];
const SKIN_DUBAI = [0xd9a273, 0xb07a4f, 0xf0c29a, 0x8a5a3a];
const SKIN_NY = [0xffd9b8, 0xd9a273, 0xb07a4f, 0x8a5a3a, 0x6b4430];
const SKIN_TOKYO = [0xf6cfa8, 0xf0c29a, 0xffd9b8];

const HAIR_DARK = [0x2b1d14, 0x3a2a1c, 0x14100c, 0x4a3426];
const HAIR_MIX = [0x2b1d14, 0x6a4a2a, 0xb9893a, 0x14100c, 0xc9c2b8, 0x8a4a2a];
const HAIR_BLACK = [0x14100c, 0x1d1712, 0x2b1d14];

const JEANS = [0x2f4a73, 0x3b5b8c, 0x1f2f4a, 0x4b4b52];
const DARK = [0x23252b, 0x2f3340, 0x3a3a3a, 0x1b2236];
const SHOES = [0x2a2a2a, 0x4a3426, 0xeeeeee, 0x1c2b4a];
const BRIGHT = [0xe74c3c, 0x3498db, 0xf1c40f, 0x2ecc71, 0xff7f50, 0x1abc9c, 0xffffff, 0xd96a8a];
const MUTED = [0x7a8aa0, 0x9a7a5a, 0x8a9a7a, 0xb0b0b0, 0x5a6a80, 0xa86a5a];
const COATS = [0x3a3f4a, 0x6a4a32, 0x2f4a52, 0x8a2f3a, 0x4a5a3a, 0xb0a08a];

export const STYLES = {
  // Slovak and Czech everyday wear: jackets, some long coats and scarves, a few folk details (embroidered vest, kerchief).
  kosice: {
    outfits: [
      { w: 5, top: BRIGHT, bottom: JEANS, shoes: SHOES, hair: HAIR_MIX, hairStyle: 'short', sleeves: 'short', bag: 'shoulder' },
      { w: 3, top: MUTED, bottom: DARK, shoes: SHOES, hair: HAIR_MIX, hairStyle: 'long', sleeves: 'long', coat: 'jacket', coatCol: COATS, scarf: BRIGHT },
      { w: 2, top: BRIGHT, bottom: JEANS, shoes: SHOES, hair: HAIR_MIX, hairStyle: 'bun', garment: 'skirt', tights: DARK, sleeves: 'long', coat: 'long', coatCol: COATS, scarf: MUTED },
      { w: 2, top: MUTED, bottom: JEANS, shoes: SHOES, hair: HAIR_MIX, hairStyle: 'short', sleeves: 'long', coat: 'jacket', coatCol: COATS, hat: 'beanie', hatCol: BRIGHT },
      { w: 2, top: [0xffffff, 0xf3ead8], bottom: DARK, shoes: SHOES, hair: HAIR_MIX, hairStyle: 'short', sleeves: 'long', bag: 'backpack', bagCol: BRIGHT },
      { w: 1, top: [0xf3ead8, 0xffffff], bottom: [0x2f3340, 0x1f2f4a], shoes: [0x2a2a2a, 0x4a3426], hair: HAIR_MIX, hairStyle: 'short', sleeves: 'long', vest: [0x2a2530, 0x7a1f2b], vestTrim: 0xd9a73a, folk: true },
      { w: 1, top: [0xffffff, 0xf3ead8], bottom: [0x7a1f2b, 0x24406b, 0x2a2530], shoes: [0x4a3426, 0x2a2a2a], hair: HAIR_MIX, hairStyle: 'long', garment: 'skirt', tights: [0xf3ead8], sleeves: 'short', vest: [0x24406b, 0x7a1f2b], vestTrim: 0xe6c24a, scarf: [0xd23a4a, 0xe6c24a], folk: true },
      { w: 1, top: BRIGHT, bottom: JEANS, shoes: SHOES, hair: HAIR_MIX, hairStyle: 'short', sleeves: 'long', coat: 'jacket', coatCol: BRIGHT, scale: 0.68, bag: 'backpack', bagCol: BRIGHT },
    ],
  },
  prague: null, // set below: same family as Kosice with a few more coats
  // Urban casual and business.
  berlin: {
    outfits: [
      { w: 4, top: [0x23252b, 0x3a3f4a, 0x6a7a8a], bottom: DARK, shoes: SHOES, hair: HAIR_MIX, hairStyle: 'short', sleeves: 'long', coat: 'jacket', coatCol: [0x23252b, 0x3a3f4a, 0x2f4a52], bag: 'shoulder' },
      { w: 3, top: [0xffffff, 0xcfe0f0], bottom: [0x23252b, 0x1b2236], shoes: [0x1c1c1c, 0x4a3426], hair: HAIR_MIX, hairStyle: 'short', sleeves: 'long', tie: 0x3a4a8a, coat: 'long', coatCol: [0x23252b, 0x5a5a62] },
      { w: 3, top: BRIGHT, bottom: JEANS, shoes: SHOES, hair: HAIR_MIX, hairStyle: 'long', sleeves: 'short', bag: 'backpack', bagCol: DARK },
      { w: 2, top: MUTED, bottom: JEANS, shoes: SHOES, hair: HAIR_MIX, hairStyle: 'bun', sleeves: 'long', hat: 'beanie', hatCol: DARK },
    ],
  },
  // Modern wear mixed with traditional dress: kandura with ghutra, abaya with hijab.
  dubai: {
    outfits: [
      { w: 4, garment: 'robe', robe: [0xffffff, 0xf3ead8], top: [0xffffff], shoes: [0x8a6a3a, 0x2a2a2a], hair: HAIR_BLACK, hairStyle: 'none', headwear: 'ghutra', headCol: [0xffffff, 0xf3f3f3], sleeves: 'long' },
      { w: 3, garment: 'robe', robe: [0x1c1c22, 0x23252b], top: [0x1c1c22], shoes: [0x2a2a2a], hair: HAIR_BLACK, hairStyle: 'none', headwear: 'hijab', headCol: [0x1c1c22], sleeves: 'long', bag: 'shoulder', bagCol: [0x8a6a3a, 0xd9c8a0] },
      { w: 3, top: [0xffffff, 0xf3ead8, 0x9ac0e0], bottom: [0xc9b99a, 0x3a4a6a, 0x23252b], shoes: SHOES, hair: HAIR_DARK, hairStyle: 'short', sleeves: 'short' },
      { w: 2, top: [0xf3ead8, 0xe0b38a], bottom: [0xf3ead8, 0x3a4a6a], shoes: SHOES, hair: HAIR_DARK, hairStyle: 'long', garment: 'skirt', tights: SKIN_DUBAI, sleeves: 'long' },
      { w: 2, top: [0x23252b, 0xffffff], bottom: [0x23252b], shoes: [0x1c1c1c], hair: HAIR_DARK, hairStyle: 'short', sleeves: 'long', tie: 0x8a2f3a },
    ],
  },
  // Business and street wear.
  'new-york': {
    outfits: [
      { w: 4, top: [0xffffff, 0xcfe0f0], bottom: [0x23252b, 0x1b2236], shoes: [0x1c1c1c], hair: HAIR_MIX, hairStyle: 'short', sleeves: 'long', tie: 0x8a2f3a, coat: 'long', coatCol: [0x23252b, 0x2f3340, 0xb0a08a], bag: 'shoulder', bagCol: DARK },
      { w: 3, top: BRIGHT, bottom: JEANS, shoes: [0xeeeeee, 0x2a2a2a], hair: HAIR_MIX, hairStyle: 'short', sleeves: 'long', hat: 'cap', hatCol: BRIGHT },
      { w: 3, top: [0x23252b, 0xb02a3a, 0x3a6a4a], bottom: JEANS, shoes: [0xeeeeee], hair: HAIR_MIX, hairStyle: 'long', sleeves: 'long', coat: 'jacket', coatCol: [0x23252b, 0x8a6a2a, 0x2f4a52] },
      { w: 2, top: MUTED, bottom: DARK, shoes: SHOES, hair: HAIR_MIX, hairStyle: 'bun', sleeves: 'short', bag: 'backpack', bagCol: BRIGHT },
    ],
  },
  // Business suits, school uniforms, street fashion.
  tokyo: {
    outfits: [
      { w: 4, top: [0xffffff], bottom: [0x23252b, 0x1b2236], shoes: [0x1c1c1c], hair: HAIR_BLACK, hairStyle: 'short', sleeves: 'long', tie: 0x24406b, coat: 'jacket', coatCol: [0x23252b, 0x2f3340, 0x3a3f4a], bag: 'shoulder', bagCol: DARK },
      { w: 3, top: [0xffffff], bottom: [0x2f3a5a, 0x6a6a72], shoes: [0x1c1c1c, 0x4a3426], hair: HAIR_BLACK, hairStyle: 'short', sleeves: 'long', tie: 0xb02a3a, coat: 'jacket', coatCol: [0x1f2a4a], bag: 'backpack', bagCol: [0x23252b, 0x4a3426], scale: 0.9 },
      { w: 3, top: [0xffffff], bottom: [0x2f3a5a, 0x6a6a72], shoes: [0x1c1c1c, 0x4a3426], hair: HAIR_BLACK, hairStyle: 'long', garment: 'skirt', tights: [0x1c1c22, 0xf3ead8], sleeves: 'long', tie: 0xb02a3a, coat: 'jacket', coatCol: [0x1f2a4a], bag: 'backpack', bagCol: [0x23252b, 0x4a3426], scale: 0.9 },
      { w: 3, top: [0xf1c40f, 0xe74c3c, 0x6ab0e0, 0xf3ead8], bottom: [0x23252b, 0x3b5b8c], shoes: [0xeeeeee, 0xe74c3c], hair: [0x14100c, 0x6a4a2a, 0x8a4a2a], hairStyle: 'long', sleeves: 'long', coat: 'jacket', coatCol: [0xf3ead8, 0x8a9a7a, 0xd96a8a], hat: 'cap', hatCol: DARK },
      { w: 2, top: MUTED, bottom: JEANS, shoes: [0xeeeeee], hair: HAIR_BLACK, hairStyle: 'bun', sleeves: 'short', bag: 'shoulder', bagCol: BRIGHT },
    ],
  },
};
STYLES.prague = { outfits: STYLES.kosice.outfits.map((o) => (o.coat === 'none' || !o.coat ? o : { ...o, w: o.w + 1 })) };

// Warm layer for snow: wrap any outfit that has no coat in a jacket, add a scarf or hat. Robes stay as they are.
export function dressForCold(o, rnd) {
  if (o.garment === 'robe' || o.folk) return { ...o, sleeves: 'long' };
  const out = { ...o, sleeves: 'long' };
  if (!out.coat || out.coat === 'none') { out.coat = 'jacket'; out.coatCol = COATS; }
  if (!out.scarf && rnd() < 0.7) out.scarf = BRIGHT;
  if (!out.hat && rnd() < 0.5) { out.hat = 'beanie'; out.hatCol = BRIGHT; }
  return out;
}

export function styleFor(cityId) { return STYLES[cityId] || STYLES.kosice; }
export function skinFor(cityId) {
  return { kosice: SKIN_EURO, prague: SKIN_EURO, berlin: SKIN_EURO.concat([0xb07a4f]), dubai: SKIN_DUBAI, 'new-york': SKIN_NY, tokyo: SKIN_TOKYO }[cityId] || SKIN;
}
