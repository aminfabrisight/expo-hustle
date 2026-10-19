import type { ExpoMap } from './map';
import type { Inventory } from './inventory';
import type { RNG } from './rng';
import type { Archetype, EventDef, EventKind, HallId, PartyTier, Vec } from './types';

export type NpcKind = 'attendee' | 'rumor' | 'ceo' | 'scanner' | 'celebrity';

export interface Npc {
  id: number;
  kind: NpcKind;
  x: number;
  y: number;
  ox: number; // per-NPC offset inside a tile so crowds don't walk in single file
  oy: number;
  wx: number; // current waypoint
  wy: number;
  target: number; // tile index
  wait: number;
  speed: number;
  color: string;
  skin: string;
  hat: number;
  eventId: number; // -1 none
  emote: string;
  emoteT: number;
  rumorCooldown: number;
  dir: number; // -1 left, 1 right (sprite facing)
  walkT: number;
  homeHall?: HallId;
  chasing?: boolean;
  scanCooldown?: number;
  talked?: boolean;
}

export interface GameEvent {
  id: number;
  kind: EventKind;
  def: EventDef;
  at: number; // spawn time (round seconds)
  ttl: number;
  boothIdx: number; // -1 for roaming/hall events
  hall: HallId;
  spot: Vec; // world tile coords (float center)
  stock: number;
  maxStock: number;
  state: 'scheduled' | 'active' | 'leftovers' | 'ended';
  remaining: number;
  known: 'none' | 'hall' | 'exact';
  npcId: number;
  lunchOutcome?: 'real' | 'cold' | 'empty';
  playerClaimed: boolean;
  scripted?: boolean;
}

export type ChannelKind = 'grab' | 'chat' | 'demo' | 'restroom' | 'shuttle' | 'queue' | 'ceo' | 'wheel' | 'stunned' | 'fakevip';

export interface Channel {
  kind: ChannelKind;
  t: number;
  dur: number;
  label: string;
  sub: string;
  ref: number; // booth idx / event id / npc id / fixture index
  cancelable: boolean;
  data?: number; // wheel marker etc
}

export interface DialogOption {
  id: string;
  label: string;
  hint?: string;
}

export interface Dialog {
  kind: 'sales' | 'scanner' | 'swap';
  title: string;
  body: string;
  icon: string;
  options: DialogOption[];
  ref: number;
  payload?: { itemId?: string; source?: 'booth' | 'event' | 'fixture'; refIdx?: number; drop?: number[] };
}

export interface Toast { id: number; text: string; icon: string; tone: 'good' | 'bad' | 'info' | 'rare' | 'event'; t: number }
export interface Floater { x: number; y: number; text: string; color: string; t: number; big?: boolean }
export interface Particle { x: number; y: number; vx: number; vy: number; color: string; t: number; life: number; rot: number }

export interface Invite { boothIdx: number; tier: PartyTier; host: string }

export interface Stats {
  pens: number; brochures: number; drinks: number; foods: number; swag: number;
  escapes: number; demos: number; spam: number; charcuterie: number; crackers: number;
  leads: number; chats: number; eventsClaimed: number; lateArrivals: number; selfies: number;
  ceoMet: boolean; shuttleRides: number; restroom: number; minEnergy: number; sprintTime: number;
  fakeVip: number; wheelWins: number; wheelSpins: number; consumedLoot: number; snackDollars: number;
  premium: number; secrets: number; coffees: number; caughtBySales: number; rumorsHeard: number;
  droppedItems: number; crowdVision: number;
}

export interface ContextAction {
  id: string;
  label: string;
  icon: string;
  enabled: boolean;
  hint?: string;
}

export interface Context {
  title: string;
  subtitle: string;
  icon: string;
  actions: ContextAction[];
  targetType: 'booth' | 'fixture' | 'event' | 'npc';
  ref: number;
  sponsor?: { label: string; description: string; url?: string };
  rel?: number;
  clue?: string;
}

export interface Player {
  x: number; y: number;
  energy: number; maxEnergy: number; morale: number;
  moving: boolean; sprinting: boolean; resting: boolean;
  coffeeBuff: number; bladder: number; urgentWarned: boolean;
  distance: number; facing: number; walkT: number;
  connections: number;
}

export interface GameState {
  seed: number;
  rng: RNG;
  map: ExpoMap;
  arch: Archetype;
  elapsed: number;
  phase: 'playing' | 'ended';
  endReason: 'time' | 'left' | null;
  player: Player;
  inv: Inventory;
  npcs: Npc[];
  events: GameEvent[];
  channel: Channel | null;
  dialog: Dialog | null;
  toasts: Toast[];
  floaters: Floater[];
  particles: Particle[];
  sounds: string[];
  revealed: Uint8Array;
  crowd: Uint8Array; // NPC count per tile, refreshed each tick
  crowdVision: number; // FabriSight overlay seconds remaining
  crowdVisionCooldown: number;
  infoVisited: boolean;
  infoTipCooldown: number;
  fixtureCooldown: Record<string, number>;
  invites: Invite[];
  cluesKnown: Set<number>; // booth idx with revealed party clue
  stats: Stats;
  ticker: { text: string; t: number; queue: string[] };
  tutorial: number; // -1 = done/off
  tutorialT: number;
  goldRush: boolean;
  lunchCrowdAdded: boolean;
  blitzHall: HallId | null;
  blitzT: number;
  context: Context | null;
  nextId: number;
}

export interface Input {
  mx: number; // -1..1
  my: number;
  sprint: boolean;
  interact: boolean; // edge-triggered primary action
  action: number | null; // edge-triggered 0-based action index
  cancel: boolean;
}

export const NO_INPUT: Input = { mx: 0, my: 0, sprint: false, interact: false, action: null, cancel: false };
