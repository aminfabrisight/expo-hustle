import { PARTY_INFO } from '../content/jokes';
import { CONFIG } from './config';
import { bagValue } from './inventory';
import type { GameState, Stats } from './state';

export interface ScoreBreakdown {
  loot: number;
  influence: number;
  survival: number;
  exploration: number;
  party: number;
  total: number;
  lootValue: number;
  explored: number; // 0..1
}

export function exploredFraction(s: GameState): number {
  let seen = 0;
  const walk = s.map.walkTiles;
  for (const i of walk) if (s.revealed[i]) seen++;
  return walk.length ? seen / walk.length : 0;
}

/** Composite score: Loot + Influence + Survival + Exploration (+ party bonus). */
export function computeScore(s: GameState): ScoreBreakdown {
  const mult = s.arch.lootMult * (s.goldRush ? 1.2 : 1);
  const lootValue = (s.stats.consumedLoot + bagValue(s.inv)) * mult;
  const loot = Math.round(lootValue * 10);
  const party = s.invites.reduce((sum, i) => sum + PARTY_INFO[i.tier].bonus, 0);
  const influence = Math.round(s.player.connections * 12 + s.stats.leads * 60) + party;
  const survival = Math.max(0, Math.round(s.player.energy * 1.5 + s.player.morale * 3 + s.stats.escapes * 30 - s.stats.spam * 15));
  const explored = exploredFraction(s);
  const exploration = Math.round(explored * 400 + s.stats.secrets * 50);
  return { loot, influence, survival, exploration, party, total: loot + influence + survival + exploration, lootValue, explored };
}

export function milesWalked(s: GameState): number {
  return (s.player.distance * CONFIG.metersPerTile) / 1609.34;
}

export interface Title { title: string; caption: string }

/** First matching rule wins. Order = comedic priority. */
export function pickTitle(st: Stats, sc: ScoreBreakdown, invites: number, connections: number, miles: number): Title {
  const dollars = Math.max(1, Math.round(st.snackDollars));
  const R: [boolean, Title][] = [
    [invites >= 1 && sc.lootValue >= 60 && sc.total >= 1600, { title: 'Expo Legend', caption: 'Swag, snacks AND a VIP wristband. Exhibitors will speak of you in hushed tones.' }],
    [st.charcuterie >= 2, { title: 'Charcuterie King', caption: `You ate ${st.charcuterie} cheese boards. The brie fears you.` }],
    [invites >= 2 || connections >= 22, { title: 'Networking Menace', caption: `${connections} connections. Your LinkedIn will never recover.` }],
    [st.spam >= 3, { title: 'Badge Scan Victim', caption: `Scanned ${st.spam} times for chocolate. Your inbox is now a landfill.` }],
    [st.swag >= 17, { title: 'The Swag Goblin', caption: `${st.swag} pieces of swag. You hissed at a tote bag.` }],
    [st.drinks + st.foods >= 14, { title: 'Professional Freeloader', caption: `${st.drinks + st.foods} free snacks and drinks. Lunch budget: untouched.` }],
    [st.escapes >= 4, { title: "Salesperson's Nightmare", caption: `Escaped ${st.escapes} demos. Several quotas are now in jeopardy.` }],
    [st.demos >= 3, { title: 'Demo Hostage', caption: `You sat through ${st.demos} demos. You now understand ERP. Sort of.` }],
    [st.minEnergy <= 3, { title: 'The Exhausted Engineer', caption: 'You hit zero energy and kept walking. Your shoes want a divorce.' }],
    [st.brochures >= 4, { title: 'The Brochure Archivist', caption: `${st.brochures} brochures. A paper trail for the ages.` }],
    [sc.explored < 0.3, { title: 'The Lost Tourist', caption: 'You saw roughly one hallway. It was a nice hallway.' }],
    [true, { title: 'The Walking Expense Report', caption: `You spent $1,800 attending a show and came home with $${dollars} in free snacks.` }],
  ];
  const t = R.find(([ok]) => ok)![1];
  return { ...t, caption: t.caption + (miles > 3 ? ` Also: ${miles.toFixed(1)} miles. Your feet filed a complaint.` : '') };
}

export interface Achievement { id: string; name: string; desc: string; icon: string }

export const ACHIEVEMENTS: (Achievement & { test: (s: GameState) => boolean })[] = [
  { id: 'cheese', name: 'Cheese Whisperer', desc: 'Win a charcuterie dash.', icon: '🧀', test: (s) => s.stats.charcuterie > 0 },
  { id: 'crackers', name: 'Crackers. Again.', desc: 'Arrive after the cheese is gone.', icon: '🥨', test: (s) => s.stats.crackers > 0 },
  { id: 'pens', name: 'Pen Pal', desc: 'Carry 4 useless pens at once.', icon: '🖊️', test: (s) => s.inv.items.filter((i) => i.id === 'pen').length >= 4 },
  { id: 'vip', name: 'On the List', desc: 'Earn a VIP invite.', icon: '🎟️', test: (s) => s.invites.length > 0 },
  { id: 'roof', name: 'Up on the Roof', desc: 'Get invited to the secret rooftop party.', icon: '🌃', test: (s) => s.invites.some((i) => i.tier === 'rooftop') },
  { id: 'escape', name: 'Houdini of Hall C', desc: 'Escape 3 salespeople.', icon: '🏃', test: (s) => s.stats.escapes >= 3 },
  { id: 'hostage', name: 'Demo Hostage', desc: 'Sit through 2 demos.', icon: '📊', test: (s) => s.stats.demos >= 2 },
  { id: 'spam', name: 'Inbox Zero (Never Again)', desc: 'Get badge-scanned for chocolate.', icon: '📧', test: (s) => s.stats.spam > 0 },
  { id: 'ceo', name: 'Hoodie Diplomacy', desc: 'Find the incognito CEO.', icon: '🕶️', test: (s) => s.stats.ceoMet },
  { id: 'fake', name: 'It Was a Demo', desc: 'Fall for the fake VIP lounge.', icon: '🥂', test: (s) => s.stats.fakeVip > 0 },
  { id: 'shuttle', name: 'Public Transit Enjoyer', desc: 'Ride the expo shuttle.', icon: '🚌', test: (s) => s.stats.shuttleRides > 0 },
  { id: 'relief', name: 'Sweet Relief', desc: 'Make it to the restroom in time.', icon: '🚻', test: (s) => s.stats.restroom > 0 },
  { id: 'crowd', name: 'See What the Crowd Is Doing', desc: 'Use Crowd Vision at the FabriSight booth.', icon: '📡', test: (s) => s.stats.crowdVision > 0 },
  { id: 'explorer', name: 'Cartographer', desc: 'Explore 75% of the floor.', icon: '🗺️', test: (s) => exploredFraction(s) >= 0.75 },
  { id: 'selfie', name: 'Forklift Fan', desc: 'Take a selfie with the booth celebrity.', icon: '🤳', test: (s) => s.stats.selfies > 0 },
  { id: 'drone', name: 'Why Is There a Drone', desc: 'Leave with premium swag in your bag.', icon: '🚁', test: (s) => s.inv.items.some((i) => ['drone', 'headphones', 'backpack', 'powerbank', 'display'].includes(i.id)) },
];
