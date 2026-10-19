import { EVENTS } from '../content/events';
import { HALLS } from '../content/booths';
import { CONFIG, secAtClock } from './config';
import { center, nearestWalkable, type BoothInstance } from './map';
import type { GameEvent, GameState } from './state';
import type { EventKind, HallId, Vec } from './types';
import { fmt, sound, tick, toast } from './fx';
import { rushTo, spawnSpecialNpc, removeNpc } from './npc';
import { RNG } from './rng';

const STOCKLESS: EventKind[] = ['scanner', 'ceo', 'demoblitz', 'fakevip'];

interface Plan { kind: EventKind; clock: [number, number]; chance?: number; scripted?: boolean }

/** The day's shape: small perks early, lunch chaos, networking mid-day, happy hour late, frenzy at close. */
export function dayPlan(goldRush: boolean, tutorial: boolean): Plan[] {
  const p: Plan[] = [
    tutorial ? { kind: 'charcuterie', clock: [9 * 60 + 50, 9 * 60 + 50], scripted: true } : { kind: 'charcuterie', clock: [9 * 60 + 45, 10 * 60 + 30] },
    { kind: 'espresso', clock: [10 * 60 + 20, 11 * 60] },
    { kind: 'scanner', clock: [10 * 60 + 40, 11 * 60 + 30] },
    { kind: 'swagdrop', clock: [11 * 60 + 10, 11 * 60 + 50] },
    { kind: 'demoblitz', clock: [11 * 60 + 30, 15 * 60] },
    { kind: 'lunch', clock: [12 * 60, 12 * 60 + 30] },
    { kind: 'pizza', clock: [12 * 60 + 40, 13 * 60 + 20], chance: 0.5 },
    { kind: 'ceo', clock: [13 * 60, 14 * 60] },
    { kind: 'fakevip', clock: [13 * 60 + 30, 15 * 60 + 30] },
    { kind: 'celebrity', clock: [14 * 60, 15 * 60] },
    { kind: 'charcuterie', clock: [14 * 60 + 30, 15 * 60 + 30], chance: 0.5 },
    { kind: 'swagdrop', clock: [15 * 60, 15 * 60 + 40], chance: 0.4 },
    { kind: 'scanner', clock: [15 * 60 + 20, 16 * 60], chance: 0.35 },
    { kind: 'beer', clock: [16 * 60, 16 * 60 + 40] },
    { kind: 'frenzy', clock: [17 * 60 + 30, 17 * 60 + 30] },
    { kind: 'frenzy', clock: [17 * 60 + 30, 17 * 60 + 30] },
    { kind: 'frenzy', clock: [17 * 60 + 32, 17 * 60 + 32] },
  ];
  if (goldRush) p.push({ kind: 'frenzy', clock: [15 * 60, 15 * 60 + 20] });
  return p;
}

function boothSpot(b: BoothInstance): Vec {
  const f = b.front[Math.floor(b.front.length / 2)];
  return { x: f.x + 0.5, y: f.y + 0.5 };
}

const ROAMING: EventKind[] = ['scanner', 'ceo', 'demoblitz'];

export function buildSchedule(s: GameState): GameEvent[] {
  const rng = s.rng.fork(1337);
  const plans = dayPlan(s.goldRush, s.tutorial >= 0);
  const out: GameEvent[] = [];
  const minGap = 5;
  let lastAt = -99;
  const sorted = plans
    .filter((p) => p.chance === undefined || rng.chance(p.chance))
    .map((p) => ({ p, at: secAtClock(rng.range(p.clock[0], p.clock[1])) }))
    .sort((a, b) => a.at - b.at);
  const usable = s.map.booths.filter((b) => b.front.length > 0);
  for (const { p, at: rawAt } of sorted) {
    const def = EVENTS[p.kind];
    // Keep surprises from stacking up on top of each other (frenzy is the deliberate exception).
    const at = p.kind === 'frenzy' ? rawAt : Math.max(rawAt, lastAt + minGap);
    if (at > CONFIG.roundSeconds - 6) continue;
    lastAt = Math.max(lastAt, at);
    const ttl = rng.range(def.ttl[0], def.ttl[1]);
    let boothIdx = -1;
    let hall: HallId;
    let spot: Vec;
    if (ROAMING.includes(p.kind)) {
      hall = rng.pick(['A', 'B', 'C', 'D'] as HallId[]);
      spot = hallCenter(s, hall);
    } else {
      // No two events on the same booth (or right next to each other) while both are live.
      const busy = out.filter((e) => e.boothIdx >= 0 && e.at < at + ttl && e.at + e.ttl > at);
      let pool = usable.filter((b) => busy.every((e) => Math.hypot(boothSpot(b).x - e.spot.x, boothSpot(b).y - e.spot.y) > 9));
      if (p.scripted) {
        // Opening dash: far enough to need a decision, close enough to be possible.
        const sp = s.map.spawn;
        const ring = pool.filter((b) => { const d = Math.hypot(boothSpot(b).x - sp.x, boothSpot(b).y - sp.y); return d > 18 && d < 30; });
        if (ring.length) pool = ring;
      }
      if (!pool.length) pool = usable;
      const b = rng.pick(pool);
      boothIdx = b.idx;
      hall = b.hall;
      spot = boothSpot(b);
    }
    const stock = rng.int(def.stock[0], def.stock[1]);
    out.push({
      id: s.nextId++, kind: p.kind, def, at, ttl, boothIdx, hall, spot,
      stock: s.goldRush && !STOCKLESS.includes(p.kind) ? Math.round(stock * 1.3) : stock,
      maxStock: stock, state: 'scheduled', remaining: ttl, known: 'none', npcId: -1, playerClaimed: false, scripted: p.scripted,
    });
  }
  return out;
}

function hallCenter(s: GameState, hall: HallId): Vec {
  const c = { A: { x: 18, y: 20 }, B: { x: 60, y: 20 }, C: { x: 18, y: 44 }, D: { x: 60, y: 44 } }[hall];
  return nearestWalkable(s.map, c.x, c.y);
}

function eventVars(s: GameState, e: GameEvent) {
  const b = e.boothIdx >= 0 ? s.map.booths[e.boothIdx] : null;
  return { hall: HALLS[e.hall].name.split(' · ')[0], booth: b ? `${b.profile.name} (${b.number})` : HALLS[e.hall].name.split(' · ')[0] };
}

export function updateDirector(s: GameState, dt: number) {
  for (const e of s.events) {
    if (e.state === 'scheduled' && s.elapsed >= e.at) spawn(s, e);
    if (e.state === 'active' || e.state === 'leftovers') {
      e.remaining -= dt;
      // Roaming events: the marker follows the NPC.
      if (e.npcId >= 0) {
        const n = s.npcs.find((n) => n.id === e.npcId);
        if (n) e.spot = { x: n.x, y: n.y };
      }
      if (e.state === 'active' && e.stock <= 0 && !STOCKLESS.includes(e.kind)) {
        e.state = 'leftovers';
        if (e.known === 'exact' && !e.playerClaimed) {
          tick(s, e.kind === 'charcuterie' ? 'The cheese situation has collapsed. Crackers only.' : `${e.def.title}: all gone.`, true);
        }
      }
      if (e.remaining <= 0) end(s, e);
    }
  }
  if (s.blitzT > 0) {
    s.blitzT -= dt;
    if (s.blitzT <= 0) s.blitzHall = null;
  }
}

function spawn(s: GameState, e: GameEvent) {
  e.state = 'active';
  e.remaining = e.ttl;
  const vars = eventVars(s, e);
  if (e.kind === 'lunch') {
    const r = s.rng.next();
    e.lunchOutcome = r < 0.4 ? 'real' : r < 0.78 ? 'cold' : 'empty';
    if (e.lunchOutcome === 'empty') e.stock = 0;
  }
  if (e.kind === 'ceo' || e.kind === 'scanner') {
    const n = spawnSpecialNpc(s, e.kind, e.hall);
    e.npcId = n.id;
    e.spot = { x: n.x, y: n.y };
  }
  if (e.kind === 'celebrity') {
    const n = spawnSpecialNpc(s, 'celebrity', e.hall, e.spot);
    e.npcId = -1; // static, marker stays on the booth
    n.eventId = e.id;
  }
  if (e.kind === 'demoblitz') {
    s.blitzHall = e.hall;
    s.blitzT = e.ttl;
  }
  if (e.def.attract > 0) rushTo(s, e);

  // Who hears about it? Nearby or already-discovered places get a toast; far/unknown ones get a rumor (sometimes).
  const d = Math.hypot(e.spot.x - s.player.x, e.spot.y - s.player.y);
  const booth = e.boothIdx >= 0 ? s.map.booths[e.boothIdx] : null;
  const roaming = e.kind === 'scanner' || e.kind === 'ceo' || e.kind === 'demoblitz';
  if (e.scripted || d <= s.arch.alertRadius || (booth && booth.discovered)) {
    e.known = roaming ? 'hall' : 'exact';
    toast(s, fmt(s.rng.pick(e.def.announce), vars), e.def.icon, 'event');
    sound(s, 'alert');
  } else if (roaming || s.rng.chance(0.55)) {
    e.known = 'hall';
    tick(s, fmt(s.rng.pick(e.def.rumors), vars), true);
    if (roaming) toast(s, fmt(s.rng.pick(e.def.announce), vars), e.def.icon, 'event');
    sound(s, 'blip');
  }
  if (e.scripted) tick(s, fmt(e.def.rumors[0], vars), true);
}

function end(s: GameState, e: GameEvent) {
  e.state = 'ended';
  if (e.npcId >= 0) removeNpc(s, e.npcId);
  if (e.kind === 'celebrity') s.npcs = s.npcs.filter((n) => !(n.kind === 'celebrity' && n.eventId === e.id));
  for (const n of s.npcs) if (n.eventId === e.id) { n.eventId = -1; n.wait = 0; n.target = -1; }
  if (e.kind === 'demoblitz') { s.blitzHall = null; s.blitzT = 0; }
}

export function activeEvents(s: GameState) {
  return s.events.filter((e) => e.state === 'active' || e.state === 'leftovers');
}

/** A believable tip: an active event you don't know about yet, else a party clue. */
export function produceTip(s: GameState, rng: RNG = s.rng): string {
  const unknown = activeEvents(s).filter((e) => e.known !== 'exact' && e.state === 'active');
  if (unknown.length) {
    const e = rng.pick(unknown);
    const roaming = e.kind === 'scanner' || e.kind === 'ceo' || e.kind === 'demoblitz';
    e.known = roaming ? 'hall' : 'exact';
    const v = eventVars(s, e);
    return roaming ? `${e.def.title} in ${v.hall}.` : `${e.def.title} at ${v.booth}. Hurry.`;
  }
  const hosts = s.map.booths.filter((b) => b.profile.party && !s.cluesKnown.has(b.idx));
  if (hosts.length) {
    const b = rng.pick(hosts);
    s.cluesKnown.add(b.idx);
    const tier = b.profile.party!;
    const what = tier === 'rooftop' ? 'the SECRET ROOFTOP party' : tier === 'sponsored' ? 'a sponsored happy hour' : 'a mixer tonight';
    return `${b.profile.name} (${b.number}) is hosting ${what}. Get on their good side.`;
  }
  return 'the coffee near the entrance restocks faster than anyone admits.';
}

export function eventLabel(s: GameState, e: GameEvent): string {
  return eventVars(s, e).booth;
}

export { boothSpot, center };
