// Shared types for content (data) and simulation state.

export type ItemKind = 'food' | 'drink' | 'swag';

export interface ItemDef {
  id: string;
  name: string;
  icon: string; // emoji placeholder; swap via assets/sprites
  kind: ItemKind;
  loot: number; // nominal loot value
  slots: number; // bag slots (0 for consumables)
  energy?: number;
  morale?: number;
  connections?: number;
  coffee?: boolean; // speed buff + bladder
  bagBonus?: number; // tote bags literally give you more bag
  tags?: string[]; // 'pen', 'brochure', 'premium', 'charcuterie', 'spam'...
  flavor?: string; // pickup quip
}

export type HallId = 'A' | 'B' | 'C' | 'D';

export interface BoothProfile {
  id: string;
  name: string;
  category: string;
  hall?: HallId; // preferred hall
  tagline: string;
  colors: [string, string]; // sign bg, sign text
  freebie: string[]; // item ids, chosen by weight order
  freebieStock: number;
  restockSec: number;
  aggression: number; // 0..1 salesperson pushiness
  party?: PartyTier; // hidden VIP party host
  demoSwag?: string; // item id awarded for sitting through a demo
  wheel?: boolean; // prize-wheel mini challenge
  sponsor?: SponsorInfo;
  special?: 'fabrisight';
  island?: boolean; // big standalone booth
}

export type PartyTier = 'mixer' | 'sponsored' | 'rooftop';

export interface SponsorInfo {
  id: string;
  label: string; // shown as "Sponsored"
  description: string;
  url?: string; // validated https URL, opened only on deliberate click
  logoUrl?: string; // optional official asset
}

export type ArchetypeId = 'classic' | 'swag' | 'networker' | 'foodie' | 'engineer';

export interface Archetype {
  id: ArchetypeId;
  name: string;
  icon: string;
  blurb: string;
  bagSlots: number;
  relMult: number;
  lootMult: number;
  alertRadius: number;
  maxEnergy: number;
  drainMult: number;
  escapeBonus: boolean;
  chatMult: number; // chat duration multiplier
}

export type EventKind =
  | 'charcuterie'
  | 'beer'
  | 'swagdrop'
  | 'lunch'
  | 'scanner'
  | 'ceo'
  | 'celebrity'
  | 'fakevip'
  | 'pizza'
  | 'espresso'
  | 'frenzy'
  | 'demoblitz';

export interface EventDef {
  kind: EventKind;
  title: string;
  icon: string;
  ttl: [number, number]; // real seconds
  stock: [number, number];
  attract: number; // fraction of NPCs that rush it
  rumors: string[];
  announce: string[];
  late: string[]; // shown when you arrive and it's gone
}

export interface Vec {
  x: number;
  y: number;
}
