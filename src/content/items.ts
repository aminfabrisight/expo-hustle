import type { ItemDef } from '../systems/types';

/** Every pickup in the game. Tune numbers here. */
export const ITEMS: Record<string, ItemDef> = {
  // --- Consumables (eaten on the spot, no bag slots) ---
  coffee: { id: 'coffee', name: 'Booth Coffee', icon: '☕', kind: 'drink', loot: 2, slots: 0, energy: 12, morale: 5, coffee: true, flavor: 'Tastes like ambition and burnt beans.' },
  cookie: { id: 'cookie', name: 'Giant Cookie', icon: '🍪', kind: 'food', loot: 1, slots: 0, energy: 6, morale: 5, flavor: 'Branded. With icing. Bold.' },
  candy: { id: 'candy', name: 'Candy Bowl Raid', icon: '🍬', kind: 'food', loot: 1, slots: 0, energy: 3, morale: 2, flavor: 'You took four. Nobody saw.' },
  pizza: { id: 'pizza', name: 'Free Pizza', icon: '🍕', kind: 'food', loot: 3, slots: 0, energy: 16, morale: 10, flavor: 'Hot. Actually hot. A miracle.' },
  coldpizza: { id: 'coldpizza', name: 'Cold Leftover Pizza', icon: '🍕', kind: 'food', loot: 1, slots: 0, energy: 6, morale: 1, flavor: 'Room temperature. Room was cold.' },
  charcuterie: { id: 'charcuterie', name: 'Charcuterie Platter', icon: '🧀', kind: 'food', loot: 15, slots: 0, energy: 15, morale: 20, tags: ['charcuterie'], flavor: 'Prosciutto. Brie. Destiny.' },
  crackers: { id: 'crackers', name: 'Just Crackers', icon: '🥨', kind: 'food', loot: 1, slots: 0, energy: 3, morale: -3, tags: ['crackers'], flavor: 'Crackers. Again.' },
  beer: { id: 'beer', name: 'Free Drink (beer or mocktail)', icon: '🍺', kind: 'drink', loot: 4, slots: 0, energy: 4, morale: 30, connections: 4, tags: ['drink'], flavor: 'Happy hour came early. Hydrate responsibly.' },
  espresso: { id: 'espresso', name: 'Triple Espresso', icon: '☕', kind: 'drink', loot: 3, slots: 0, energy: 20, morale: 6, coffee: true, flavor: 'You can hear colors now.' },
  water: { id: 'water', name: 'Fountain Water', icon: '💧', kind: 'drink', loot: 0, slots: 0, energy: 6, morale: 1, flavor: 'Free. Truly free.' },
  chocolate: { id: 'chocolate', name: 'One (1) Tiny Chocolate', icon: '🍫', kind: 'food', loot: 1, slots: 0, energy: 2, morale: 3, tags: ['spam'], flavor: 'Badge scanned. Inbox doomed.' },
  sandwich: { id: 'sandwich', name: 'Mystery Sandwich', icon: '🥪', kind: 'food', loot: 2, slots: 0, energy: 14, morale: 6, flavor: 'Turkey? Probably turkey.' },

  // --- Swag (goes in the bag) ---
  pen: { id: 'pen', name: 'Useless Pen', icon: '🖊️', kind: 'swag', loot: 1, slots: 1, tags: ['pen'], flavor: 'Pen #{n}. It does not write.' },
  brochure: { id: 'brochure', name: 'Glossy Brochure', icon: '📄', kind: 'swag', loot: 0, slots: 1, tags: ['brochure'], flavor: '+0 loot. You own a brochure now.' },
  sticker: { id: 'sticker', name: 'Laptop Sticker', icon: '🏷️', kind: 'swag', loot: 2, slots: 1, flavor: 'Your laptop gains +1 personality.' },
  keychain: { id: 'keychain', name: 'Bottle-Opener Keychain', icon: '🔑', kind: 'swag', loot: 2, slots: 1, flavor: 'Opens bottles. Opens doors? No.' },
  stressball: { id: 'stressball', name: 'Stress Ball (Shaped Like a Gear)', icon: '⚙️', kind: 'swag', loot: 3, slots: 1, flavor: 'Squeeze when the demo starts.' },
  tote: { id: 'tote', name: 'Tote Bag', icon: '👜', kind: 'swag', loot: 2, slots: 0, bagBonus: 1, flavor: 'A bag for your bag. +1 slot.' },
  socks: { id: 'socks', name: 'Branded Socks', icon: '🧦', kind: 'swag', loot: 6, slots: 1, flavor: 'The finest trade-show currency.' },
  bottle: { id: 'bottle', name: 'Water Bottle', icon: '🧴', kind: 'swag', loot: 5, slots: 1, flavor: 'Your 14th. This one is teal.' },
  tshirt: { id: 'tshirt', name: 'XXL Event T-Shirt', icon: '👕', kind: 'swag', loot: 6, slots: 1, flavor: 'Only XXL left. It is a dress now.' },
  fidget: { id: 'fidget', name: 'Fidget Spinner (2017 stock)', icon: '🌀', kind: 'swag', loot: 3, slots: 1, flavor: 'Vintage, technically.' },
  chicken: { id: 'chicken', name: 'Rubber Chicken', icon: '🐔', kind: 'swag', loot: 7, slots: 1, flavor: 'Nobody knows why. Everybody wants one.' },
  powerbank: { id: 'powerbank', name: 'Power Bank', icon: '🔋', kind: 'swag', loot: 12, slots: 1, tags: ['premium'], flavor: 'Actually useful. Suspicious.' },
  headphones: { id: 'headphones', name: 'Fancy Headphones', icon: '🎧', kind: 'swag', loot: 35, slots: 2, tags: ['premium'], flavor: 'Noise-cancelling. Cancel the demo noise.' },
  backpack: { id: 'backpack', name: 'Premium Backpack', icon: '🎒', kind: 'swag', loot: 28, slots: 1, bagBonus: 1, tags: ['premium'], flavor: 'Holds more swag. The cycle continues.' },
  drone: { id: 'drone', name: 'A Whole Drone', icon: '🚁', kind: 'swag', loot: 40, slots: 2, tags: ['premium'], flavor: 'A drone. Why. How. Yes.' },
  hardhat: { id: 'hardhat', name: 'Mini Hard Hat', icon: '⛑️', kind: 'swag', loot: 8, slots: 1, flavor: 'Safety first. Style second. Swag always.' },
  plushie: { id: 'plushie', name: 'Robot Plushie', icon: '🤖', kind: 'swag', loot: 9, slots: 1, flavor: 'It has a QR code for a heart.' },
  display: { id: 'display', name: 'Leftover Booth Display', icon: '🪧', kind: 'swag', loot: 22, slots: 3, tags: ['premium'], flavor: 'It is enormous. You are committed.' },
  card: { id: 'card', name: 'Business Card (Podcast)', icon: '📇', kind: 'swag', loot: 1, slots: 1, flavor: 'He hosts a podcast. Of course he does.' },
};

export function item(id: string): ItemDef {
  const it = ITEMS[id];
  if (!it) throw new Error(`Unknown item ${id}`);
  return it;
}
