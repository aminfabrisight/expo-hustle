import type { Archetype, ArchetypeId } from '../systems/types';

const base = { bagSlots: 6, relMult: 1, lootMult: 1, alertRadius: 11, maxEnergy: 100, drainMult: 1, escapeBonus: false, chatMult: 1 };

export const ARCHETYPES: Record<ArchetypeId, Archetype> = {
  classic: { ...base, id: 'classic', name: 'Regular Attendee', icon: '🪪', blurb: 'Balanced. Hopeful. Wearing new shoes (mistake).' },
  swag: { ...base, id: 'swag', name: 'Swag Hunter', icon: '🎒', blurb: '+2 bag slots. Networking? Never heard of her.', bagSlots: 8, relMult: 0.75 },
  networker: { ...base, id: 'networker', name: 'Networker', icon: '🤝', blurb: 'Faster, stronger relationships. Swag is worth less to you.', relMult: 1.35, lootMult: 0.8, chatMult: 0.8 },
  foodie: { ...base, id: 'foodie', name: 'Free Food Expert', icon: '🍕', blurb: 'Smells snacks from way farther. Lower stamina.', alertRadius: 18, maxEnergy: 85, drainMult: 1.1 },
  engineer: { ...base, id: 'engineer', name: 'Exhausted Engineer', icon: '🥱', blurb: 'Escapes every demo. Chats take longer.', escapeBonus: true, chatMult: 1.3, relMult: 0.9 },
};

export const ARCHETYPE_ORDER: ArchetypeId[] = ['classic', 'swag', 'networker', 'foodie', 'engineer'];
