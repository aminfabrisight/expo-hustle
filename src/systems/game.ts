import { ARCHETYPES } from '../content/archetypes';
import { EVENT_REWARD } from '../content/events';
import { item } from '../content/items';
import { BOOTH_CLUES, CHAT_LINES, DEMO_LINES, GRAB_QUIPS_EMPTY, PARTY_INFO, RUMOR_NPC_LINES, TICKER_AMBIENT, TICKER_LATE, TICKER_LUNCH } from '../content/jokes';
import { CONFIG, formatClock, gameMinutes } from './config';
import { activeEvents, buildSchedule, eventLabel, produceTip, updateDirector } from './director';
import { confetti, floater, fmt, sound, tick, toast } from './fx';
import { addItem, canFit, cheapestToDrop, createInventory, removeItem, usedSlots } from './inventory';
import { center, distToRect, generateMap, isSolid, nearestWalkable, type BoothInstance, type Fixture } from './map';
import { crowdAround, spawnNpcs, updateNpcs } from './npc';
import { RNG } from './rng';
import type { Channel, Context, ContextAction, GameEvent, GameState, Input, Npc, Stats } from './state';
import type { ArchetypeId, PartyTier } from './types';

export interface GameOptions {
  tutorial?: boolean;
  goldRush?: boolean;
}

const SNACK_PRICE: Record<string, number> = { coffee: 5, cookie: 3, candy: 1, pizza: 6, coldpizza: 2, charcuterie: 28, crackers: 1, beer: 9, espresso: 6, water: 0, chocolate: 1, sandwich: 9 };

function emptyStats(): Stats {
  return {
    pens: 0, brochures: 0, drinks: 0, foods: 0, swag: 0, escapes: 0, demos: 0, spam: 0, charcuterie: 0, crackers: 0,
    leads: 0, chats: 0, eventsClaimed: 0, lateArrivals: 0, selfies: 0, ceoMet: false, shuttleRides: 0, restroom: 0,
    minEnergy: 100, sprintTime: 0, fakeVip: 0, wheelWins: 0, wheelSpins: 0, consumedLoot: 0, snackDollars: 0,
    premium: 0, secrets: 0, coffees: 0, caughtBySales: 0, rumorsHeard: 0, droppedItems: 0, crowdVision: 0,
  };
}

export function createGame(seed: number, archId: ArchetypeId = 'classic', opts: GameOptions = {}): GameState {
  const rng = new RNG(seed);
  const map = generateMap(rng.fork(1));
  const arch = ARCHETYPES[archId];
  const s: GameState = {
    seed, rng, map, arch,
    elapsed: 0, phase: 'playing', endReason: null,
    player: {
      x: map.spawn.x, y: map.spawn.y, energy: arch.maxEnergy, maxEnergy: arch.maxEnergy, morale: 50,
      moving: false, sprinting: false, resting: false, coffeeBuff: 0, bladder: 0, urgentWarned: false,
      distance: 0, facing: 1, walkT: 0, connections: 0,
    },
    inv: createInventory(arch.bagSlots),
    npcs: [], events: [], channel: null, dialog: null, toasts: [], floaters: [], particles: [], sounds: [],
    revealed: new Uint8Array(map.w * map.h), crowd: new Uint8Array(map.w * map.h),
    crowdVision: 0, crowdVisionCooldown: 0, infoVisited: false, infoTipCooldown: 0, fixtureCooldown: {},
    invites: [], cluesKnown: new Set(), stats: emptyStats(),
    ticker: { text: 'Welcome to PACKED EXPO. Doors are open. The coffee is hot (for now).', t: 0, queue: [] },
    tutorial: opts.tutorial ? 0 : -1, tutorialT: 0,
    goldRush: opts.goldRush ?? rng.chance(0.18),
    lunchCrowdAdded: false, blitzHall: null, blitzT: 0, context: null, nextId: 1,
  };
  if (s.goldRush) for (const b of map.booths) { b.profile = { ...b.profile }; b.stock = Math.ceil(b.stock * 1.5); }
  spawnNpcs(s, CONFIG.npc.baseCount);
  s.events = buildSchedule(s);
  reveal(s);
  toast(s, 'Welcome to PACKED EXPO. You have one day, two feet, and zero self-control near free cheese.', '🎪', 'info');
  if (s.goldRush) toast(s, 'LAST DAY GOLD RUSH: exhibitors are dumping extra stock. Loot is worth more!', '💰', 'rare');
  return s;
}

// ---------------------------------------------------------------- main tick

export function step(s: GameState, dtRaw: number, input: Input) {
  if (s.phase !== 'playing') return;
  const dt = Math.min(dtRaw, 0.1);
  ageFx(s, dt);
  if (s.dialog) {
    // Choices pause the world (they're quick), but never trap you: every dialog has an exit option.
    if (input.action !== null && s.dialog.options[input.action]) resolveDialog(s, s.dialog.options[input.action].id);
    else if (input.cancel) resolveDialog(s, s.dialog.options[s.dialog.options.length - 1].id);
    return;
  }
  s.elapsed += dt;

  updatePlayer(s, dt, input);
  const consumed = updateChannel(s, dt, input);
  updateNpcs(s, dt);
  updateDirector(s, dt);
  updateWorld(s, dt);
  reveal(s);
  checkHazards(s);
  updateTutorial(s, dt);
  updateTicker(s, dt);
  s.context = computeContext(s);

  if (!consumed && !s.channel && !s.dialog && s.context) {
    const acts = s.context.actions;
    let chosen: ContextAction | undefined;
    if (input.action !== null) chosen = acts[input.action];
    else if (input.interact) chosen = acts.find((a) => a.enabled);
    if (chosen && chosen.enabled) doAction(s, s.context, chosen.id);
    else if (chosen && !chosen.enabled && chosen.hint) floater(s, chosen.hint, '#ffd6a5');
  }

  if (s.elapsed >= CONFIG.roundSeconds) endRun(s, 'time');
}

export function endRun(s: GameState, reason: 'time' | 'left') {
  if (s.phase === 'ended') return;
  s.phase = 'ended';
  s.endReason = reason;
  s.channel = null;
  s.dialog = null;
  sound(s, 'end');
}

function ageFx(s: GameState, dt: number) {
  for (const t of s.toasts) t.t += dt;
  s.toasts = s.toasts.filter((t) => t.t < 4.5);
  for (const f of s.floaters) { f.t += dt; f.y -= dt * 0.9; }
  s.floaters = s.floaters.filter((f) => f.t < 1.4);
  for (const p of s.particles) { p.t += dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 12 * dt; p.vx *= 0.98; p.rot += dt * 8; }
  s.particles = s.particles.filter((p) => p.t < p.life);
}

// ---------------------------------------------------------------- player

function collides(s: GameState, x: number, y: number): boolean {
  const r = CONFIG.player.radius;
  for (let ty = Math.floor(y - r); ty <= Math.floor(y + r); ty++)
    for (let tx = Math.floor(x - r); tx <= Math.floor(x + r); tx++) if (isSolid(s.map, tx, ty)) return true;
  return false;
}

function inLounge(s: GameState) {
  return s.map.lounge[Math.floor(s.player.y) * s.map.w + Math.floor(s.player.x)] === 1;
}

export function playerSpeed(s: GameState, sprinting: boolean): number {
  const P = CONFIG.player;
  const p = s.player;
  let sp = P.walkSpeed;
  if (sprinting) sp *= P.sprintMult;
  if (p.energy < P.lowEnergy) sp *= P.exhaustedMult;
  if (p.coffeeBuff > 0) sp *= P.coffeeSpeedMult;
  const crowd = crowdAround(s, p.x, p.y);
  sp *= Math.max(CONFIG.npc.crowdSlowMin, 1 - crowd * CONFIG.npc.crowdSlowPerNpc * (sprinting ? 0.7 : 1));
  const used = usedSlots(s.inv);
  if (used > 3) sp *= 1 - (used - 3) * P.bagSpeedPenaltyPerSlot;
  if (p.bladder >= P.bladderUrgent) sp *= 0.88;
  return Math.max(1.2, sp); // never fully locked
}

function updatePlayer(s: GameState, dt: number, input: Input) {
  const P = CONFIG.player;
  const p = s.player;
  let mx = input.mx, my = input.my;
  const len = Math.hypot(mx, my);
  if (len > 1) { mx /= len; my /= len; }
  let wantsMove = len > 0.15;

  if (s.channel && wantsMove) {
    if (s.channel.cancelable) cancelChannel(s);
    else wantsMove = false;
  }
  if (s.channel && input.cancel && s.channel.cancelable) cancelChannel(s);

  p.moving = wantsMove;
  p.sprinting = wantsMove && input.sprint && p.energy > P.minSprintEnergy;
  const drain = s.arch.drainMult;
  if (p.moving) {
    const sp = playerSpeed(s, p.sprinting);
    const dx = mx * sp * dt, dy = my * sp * dt;
    const ox = p.x, oy = p.y;
    if (!collides(s, p.x + dx, p.y)) p.x += dx;
    if (!collides(s, p.x, p.y + dy)) p.y += dy;
    p.distance += Math.hypot(p.x - ox, p.y - oy);
    if (Math.abs(mx) > 0.1) p.facing = mx < 0 ? -1 : 1;
    p.walkT += dt * sp;
    p.energy -= (p.sprinting ? P.sprintDrain : P.walkDrain) * drain * dt;
    if (p.sprinting) s.stats.sprintTime += dt;
  } else {
    p.energy += P.idleRegen * dt;
  }
  p.resting = !p.moving && !s.channel && inLounge(s);
  if (p.resting) {
    p.energy += P.restRegen * dt;
    p.morale += 0.5 * dt;
  }
  p.morale -= P.moraleDecay * dt;
  if (p.coffeeBuff > 0) p.coffeeBuff -= dt;
  if (p.bladder >= P.bladderUrgent) {
    p.morale -= 0.25 * dt;
    if (!p.urgentWarned) {
      p.urgentWarned = true;
      toast(s, 'Too much coffee. You urgently need a restroom 🚻 (east or west end of the main aisle).', '🚻', 'bad');
      sound(s, 'warn');
    }
  }
  p.energy = clamp(p.energy, 0, p.maxEnergy);
  p.morale = clamp(p.morale, 0, 100);
  s.stats.minEnergy = Math.min(s.stats.minEnergy, p.energy);
  // Safety net: never stay stuck inside geometry.
  if (collides(s, p.x, p.y)) {
    const w = nearestWalkable(s.map, p.x, p.y);
    p.x = w.x; p.y = w.y;
  }
}

function clamp(v: number, a: number, b: number) {
  return Math.max(a, Math.min(b, v));
}

// ---------------------------------------------------------------- world

function updateWorld(s: GameState, dt: number) {
  for (const b of s.map.booths) {
    if (b.chatCooldown > 0) b.chatCooldown -= dt;
    if (b.salesCooldown > 0) b.salesCooldown -= dt;
    if (b.stock < b.profile.freebieStock) {
      b.restock += dt;
      if (b.restock >= b.profile.restockSec) {
        b.restock = 0;
        b.stock = Math.min(b.profile.freebieStock, b.stock + Math.ceil(b.profile.freebieStock / 2));
      }
    }
  }
  for (const f of s.map.fixtures) {
    if (f.kind === 'kiosk' && (f.stock ?? 0) < 6) {
      f.restock = (f.restock ?? 0) + dt;
      if (f.restock >= 22) { f.restock = 0; f.stock = 6; }
    }
  }
  for (const k in s.fixtureCooldown) if (s.fixtureCooldown[k] > 0) s.fixtureCooldown[k] -= dt;
  if (s.crowdVision > 0) s.crowdVision -= dt;
  if (s.crowdVisionCooldown > 0) s.crowdVisionCooldown -= dt;
  if (s.infoTipCooldown > 0) s.infoTipCooldown -= dt;
  if (!s.lunchCrowdAdded && gameMinutes(s.elapsed) >= 11 * 60 + 45) {
    s.lunchCrowdAdded = true;
    spawnNpcs(s, CONFIG.npc.lunchExtra, true);
    tick(s, 'The lunch crowd has arrived. Aisles are now 40% elbows.', true);
  }
}

function reveal(s: GameState) {
  const { map, player: p } = s;
  const R = CONFIG.player.visionRadius;
  const x0 = Math.max(0, Math.floor(p.x - R)), x1 = Math.min(map.w - 1, Math.ceil(p.x + R));
  const y0 = Math.max(0, Math.floor(p.y - R)), y1 = Math.min(map.h - 1, Math.ceil(p.y + R));
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
    if ((x + 0.5 - p.x) ** 2 + (y + 0.5 - p.y) ** 2 <= R * R) s.revealed[y * map.w + x] = 1;
  }
  for (const b of map.booths) {
    if (b.discovered) continue;
    const c = center(b.rect);
    if (Math.hypot(c.x - p.x, c.y - p.y) < R + 1) b.discovered = true;
  }
  for (const e of s.events) {
    if ((e.state === 'active' || e.state === 'leftovers') && e.known !== 'exact' && Math.hypot(e.spot.x - p.x, e.spot.y - p.y) < R) {
      e.known = 'exact';
      if (e.state === 'active' && !e.playerClaimed) { floater(s, `${e.def.icon} ${e.def.title}!`, '#ffe066'); sound(s, 'blip'); }
    }
  }
}

/** Is the player's current view of a world point "live" (within vision)? */
export function isVisible(s: GameState, x: number, y: number): boolean {
  return Math.hypot(x - s.player.x, y - s.player.y) <= CONFIG.player.visionRadius + 0.5;
}

// ---------------------------------------------------------------- hazards

function checkHazards(s: GameState) {
  if (s.channel || s.dialog || s.elapsed < 20) return;
  const p = s.player;
  for (const n of s.npcs) {
    if (n.kind === 'scanner' && (n.scanCooldown ?? 0) <= 0 && Math.hypot(n.x - p.x, n.y - p.y) < 0.8) {
      s.dialog = {
        kind: 'scanner', ref: n.id, icon: '📟',
        title: 'Badge Scanner Ambush!',
        body: '"Hi! Can I scan your badge? You get a chocolate!" (In-game only. No real data is collected.)',
        options: [
          { id: 'take', label: 'Take the chocolate (get scanned)', hint: '+snack, +inbox spam' },
          { id: 'hide', label: 'Hide your badge behind a brochure', hint: '-4 morale, escape' },
        ],
      };
      sound(s, 'sales');
      return;
    }
  }
  if ((s.fixtureCooldown.__sales ?? 0) > 0) return;
  for (const b of s.map.booths) {
    if (!b.salesPos || b.salesCooldown > 0) continue;
    const blitz = s.blitzHall === b.hall;
    const range = CONFIG.interact.salesTriggerRange * (blitz ? 1.6 : 1);
    if (Math.hypot(b.salesPos.x - p.x, b.salesPos.y - p.y) > range) continue;
    if (!s.rng.chance(Math.min(0.95, b.profile.aggression * (blitz ? 1.35 : 1)))) {
      b.salesCooldown = 6;
      continue;
    }
    s.stats.caughtBySales++;
    s.fixtureCooldown.__sales = s.blitzHall === b.hall ? 6 : 14; // breathing room between pitches
    s.dialog = {
      kind: 'sales', ref: b.idx, icon: '🙋',
      title: `${b.profile.name} salesperson spotted you!`,
      body: `"Hey! Got a second? Just a quick 2-minute demo!" ${b.profile.demoSwag ? `(They have ${item(b.profile.demoSwag).icon} ${item(b.profile.demoSwag).name}.)` : ''}`,
      options: [
        { id: 'listen', label: 'Sure, show me the demo', hint: `costs time, maybe swag, +relationship` },
        { id: 'call', label: 'Fake an urgent phone call', hint: s.arch.escapeBonus ? 'always works for you' : 'usually works' },
        { id: 'run', label: 'Point behind them and run', hint: '-energy, -morale, guaranteed' },
      ],
    };
    sound(s, 'sales');
    return;
  }
}

export function resolveDialog(s: GameState, optionId: string) {
  const d = s.dialog;
  if (!d) return;
  s.dialog = null;
  const P = s.player;
  if (d.kind === 'sales') {
    const b = s.map.booths[d.ref];
    b.salesCooldown = CONFIG.interact.salesCooldownSec;
    if (optionId === 'listen') startDemo(s, b);
    else if (optionId === 'call') {
      if (s.arch.escapeBonus || s.rng.chance(0.7)) {
        s.stats.escapes++;
        toast(s, s.rng.pick(['"Sorry, my forklift is double-parked."', '"Oh no, my cat is calling."', '"That’s my boss. Gotta go synergize."']), '📱', 'good');
        floater(s, 'Escaped!', '#7dffb0');
        sound(s, 'escape');
      } else {
        P.morale -= 6;
        toast(s, 'They wait politely for your "call" to end. Awkward.', '😬', 'bad');
        setChannel(s, { kind: 'stunned', t: 0, dur: 1.4, label: 'Pretending to be on the phone...', sub: '', ref: -1, cancelable: false });
        sound(s, 'fail');
      }
    } else {
      s.stats.escapes++;
      P.morale -= 3;
      P.energy = Math.max(0, P.energy - 6);
      P.coffeeBuff = Math.max(P.coffeeBuff, 2.5);
      floater(s, 'Escaped! (barely)', '#7dffb0');
      sound(s, 'escape');
    }
  } else if (d.kind === 'scanner') {
    const n = s.npcs.find((n) => n.id === d.ref);
    if (optionId === 'take') {
      give(s, 'chocolate');
      s.stats.spam++;
      toast(s, `📧 You are now subscribed to ${s.rng.int(6, 19)} newsletters.`, '📧', 'bad');
      if (n) n.scanCooldown = 30;
    } else {
      P.morale -= 4;
      s.stats.escapes++;
      floater(s, 'Badge hidden!', '#7dffb0');
      if (n) n.scanCooldown = 18;
    }
  } else if (d.kind === 'swap') {
    const pl = d.payload!;
    if (optionId === 'swap' && pl.itemId) {
      for (const uid of pl.drop ?? []) if (removeItem(s.inv, uid)) s.stats.droppedItems++;
      if (give(s, pl.itemId)) consumeSource(s, pl.source, pl.refIdx ?? -1);
    } else {
      toast(s, 'You leave it behind. It will haunt you.', '🫥', 'info');
    }
  }
}

function consumeSource(s: GameState, source: 'booth' | 'event' | 'fixture' | undefined, ref: number) {
  if (source === 'booth') {
    const b = s.map.booths[ref];
    if (b) { b.stock = Math.max(0, b.stock - 1); b.visited = true; }
  } else if (source === 'event') {
    const e = s.events.find((e) => e.id === ref);
    if (e) { e.stock = Math.max(0, e.stock - 1); e.playerClaimed = true; s.stats.eventsClaimed++; }
  }
}

// ---------------------------------------------------------------- rewards

/** Give an item. Consumables apply instantly; swag needs bag space (else a swap prompt). Returns true if received. */
export function give(s: GameState, id: string, source?: 'booth' | 'event' | 'fixture', refIdx?: number): boolean {
  const def = item(id);
  const p = s.player;
  if (def.kind !== 'swag') {
    p.energy = clamp(p.energy + (def.energy ?? 0), 0, p.maxEnergy);
    p.morale = clamp(p.morale + (def.morale ?? 0), 0, 100);
    if (def.connections) p.connections += def.connections;
    if (def.coffee) {
      p.coffeeBuff = CONFIG.player.coffeeBuffSec;
      p.bladder = Math.min(100, p.bladder + CONFIG.player.bladderPerCoffee);
      s.stats.coffees++;
    }
    s.stats.consumedLoot += def.loot;
    s.stats.snackDollars += SNACK_PRICE[id] ?? 2;
    if (def.kind === 'drink') s.stats.drinks++; else s.stats.foods++;
    floater(s, `${def.icon} +${Math.round(def.loot * 10 * s.arch.lootMult)}${def.energy ? `  ⚡+${def.energy}` : ''}`, '#ffe066');
    if (def.flavor && !s.floaters.some((f) => f.t < 0.25 && f.color === '#ffffff')) floater(s, def.flavor, '#ffffff', false, p.x, p.y - 1.5);
    sound(s, def.tags?.includes('charcuterie') ? 'rare' : 'pickup');
    return true;
  }
  if (!canFit(s.inv, def)) {
    const drop = cheapestToDrop(s.inv, def);
    const names = drop?.map((d) => `${item(d.id).icon} ${item(d.id).name}`).join(' + ');
    s.dialog = {
      kind: 'swap', ref: -1, icon: '🎒',
      title: 'Bag full!',
      body: `${def.icon} ${def.name} (worth ${def.loot * 10}) needs ${def.slots} slot${def.slots > 1 ? 's' : ''}.`,
      options: drop
        ? [{ id: 'swap', label: `Drop ${names} and take it` }, { id: 'leave', label: 'Leave it behind' }]
        : [{ id: 'leave', label: 'No room, even after dropping stuff. Leave it.' }],
      payload: { itemId: id, source, refIdx, drop: drop?.map((d) => d.uid) },
    };
    sound(s, 'warn');
    return false;
  }
  addItem(s.inv, id);
  s.stats.swag++;
  if (def.tags?.includes('pen')) s.stats.pens++;
  if (def.tags?.includes('brochure')) s.stats.brochures++;
  const premium = def.tags?.includes('premium');
  if (premium) { s.stats.premium++; confetti(s); }
  const flavor = (def.flavor ?? '').replace('{n}', String(s.stats.pens));
  floater(s, `${def.icon} +${Math.round(def.loot * 10 * s.arch.lootMult)}`, premium ? '#ff9ef0' : '#ffe066', premium);
  if (flavor) floater(s, flavor, '#ffffff', false, p.x, p.y - 1.5);
  sound(s, premium ? 'rare' : 'pickup');
  return true;
}

export function dropItem(s: GameState, uid: number): boolean {
  const it = removeItem(s.inv, uid);
  if (!it) {
    toast(s, 'Empty the bag before ditching the bag.', '👜', 'info');
    return false;
  }
  s.stats.droppedItems++;
  floater(s, `Dropped ${item(it.id).icon}`, '#cccccc');
  sound(s, 'drop');
  return true;
}

// ---------------------------------------------------------------- context & actions

function queueAt(s: GameState, e: GameEvent): number {
  let q = 0;
  for (const n of s.npcs) if (n.kind === 'attendee' && Math.hypot(n.x - e.spot.x, n.y - e.spot.y) < 2.2) q++;
  return q;
}

function boothActions(s: GameState, b: BoothInstance): ContextAction[] {
  const acts: ContextAction[] = [];
  const icons = [...new Set(b.profile.freebie)].map((f) => item(f).icon).join('');
  if (b.profile.special === 'fabrisight') {
    acts.push({ id: 'crowd', label: 'Crowd Vision', icon: '📡', enabled: s.crowdVisionCooldown <= 0, hint: s.crowdVisionCooldown > 0 ? `Recharging (${Math.ceil(s.crowdVisionCooldown)}s)` : 'See where crowds and events are' });
  }
  acts.push(b.stock > 0
    ? { id: 'grab', label: `Grab freebie ${icons}`, icon: '🤲', enabled: true, hint: `${b.stock} left` }
    : { id: 'grab', label: `Grab freebie ${icons}`, icon: '🤲', enabled: false, hint: 'Empty. Restocking...' });
  const maxed = b.rel >= 100;
  acts.push({
    id: 'chat', label: 'Chat & network', icon: '🤝',
    enabled: !maxed && b.chatCooldown <= 0,
    hint: maxed ? 'Already besties' : b.chatCooldown > 0 ? `They're busy. Back in ${Math.ceil(b.chatCooldown)}s` : `Relationship ${Math.round(b.rel)}%`,
  });
  if (b.profile.demoSwag && !b.demoDone) acts.push({ id: 'demo', label: `Sit through demo (win ${item(b.profile.demoSwag).icon})`, icon: '📊', enabled: true, hint: 'Costs time' });
  if (b.profile.wheel && !b.wheelUsed) acts.push({ id: 'wheel', label: 'Spin the prize wheel', icon: '🎡', enabled: true, hint: 'Quick timing game' });
  return acts;
}

function eventClaimAction(s: GameState, e: GameEvent): ContextAction {
  const q = queueAt(s, e);
  const qh = q > 0 ? `${q} in line` : 'No line!';
  if (e.playerClaimed) return { id: 'claim', label: 'You already got yours', icon: e.def.icon, enabled: false, hint: 'One per customer. Allegedly.' };
  if (e.kind === 'fakevip') return { id: 'fakevip', label: 'Enter the VIP lounge', icon: '🥂', enabled: true, hint: 'Exclusive! Probably!' };
  if (e.state === 'leftovers') {
    const label = e.kind === 'charcuterie' ? 'Take what is left' : e.kind === 'swagdrop' ? 'Check for leftovers' : 'Check anyway';
    return { id: 'claim', label, icon: e.def.icon, enabled: true, hint: 'Looks picked over' };
  }
  const labels: Partial<Record<string, string>> = {
    charcuterie: 'Grab charcuterie', beer: 'Get a drink (beer or mocktail)', swagdrop: 'Grab premium swag', lunch: 'Grab free lunch',
    pizza: 'Grab hot pizza', espresso: 'Get a triple espresso', celebrity: 'Line up for a selfie', frenzy: 'Grab leftover loot',
  };
  return { id: 'claim', label: labels[e.kind] ?? 'Grab it', icon: e.def.icon, enabled: true, hint: `${qh} · ${Math.ceil(e.remaining)}s left` };
}

function sponsorInfo(b: BoothInstance) {
  const sp = b.profile.sponsor;
  return sp ? { label: sp.label, description: sp.description, url: sp.url } : undefined;
}

function boothContext(s: GameState, b: BoothInstance, extra: ContextAction[] = [], e?: GameEvent): Context {
  const clue = b.chats > 0 || s.cluesKnown.has(b.idx) ? BOOTH_CLUES[b.profile.party ?? 'none'] : undefined;
  return {
    title: e ? `${e.def.icon} ${e.def.title}` : b.profile.name,
    subtitle: e ? `${b.profile.name} · ${b.number}` : `${b.number} · ${b.profile.category} · "${b.profile.tagline}"`,
    icon: e ? e.def.icon : '🏪',
    actions: [...extra, ...boothActions(s, b)],
    targetType: e ? 'event' : 'booth', ref: e ? e.id : b.idx,
    sponsor: sponsorInfo(b), rel: b.chats > 0 ? b.rel : undefined, clue,
  };
}

function fixtureContext(s: GameState, f: Fixture, fi: number): Context | null {
  const cd = s.fixtureCooldown[f.id] ?? 0;
  const base = { title: f.name, subtitle: '', icon: '📍', targetType: 'fixture' as const, ref: fi };
  switch (f.kind) {
    case 'kiosk':
      return { ...base, icon: '☕', subtitle: 'Free coffee + cookie. Restocks every so often.', actions: [{ id: 'kiosk', label: 'Grab coffee & a cookie', icon: '☕', enabled: (f.stock ?? 0) > 0, hint: (f.stock ?? 0) > 0 ? `${f.stock} left` : 'Out! Barista is crying.' }] };
    case 'info':
      return { ...base, icon: 'ℹ️', subtitle: 'Volunteers who know things.', actions: s.infoVisited
        ? [{ id: 'tip', label: 'Ask for a tip', icon: '🗣️', enabled: s.infoTipCooldown <= 0, hint: s.infoTipCooldown > 0 ? `Back in ${Math.ceil(s.infoTipCooldown)}s` : 'They hear everything' }]
        : [{ id: 'map', label: 'Grab a floor map', icon: '🗺️', enabled: true, hint: 'Unlocks the minimap' }] };
    case 'fountain':
      return { ...base, icon: '💧', subtitle: 'Hydration station.', actions: [{ id: 'water', label: 'Drink water', icon: '💧', enabled: cd <= 0, hint: cd > 0 ? 'You are still sloshing' : '+energy' }] };
    case 'restroom':
      return { ...base, icon: '🚻', subtitle: s.player.bladder > 50 ? 'Thank goodness.' : 'You do not need to go. Yet.', actions: [{ id: 'restroom', label: 'Use the restroom', icon: '🚻', enabled: true }] };
    case 'shuttle':
      return { ...base, icon: '🚌', subtitle: 'Cross the whole hall. Small wait.', actions: [{ id: 'shuttle', label: 'Ride the shuttle', icon: '🚌', enabled: true, hint: `~${CONFIG.interact.shuttleWaitSec.toFixed(0)}s wait` }] };
    case 'charger':
      return { ...base, icon: '🔌', subtitle: 'Four outlets, eleven phones.', actions: [{ id: 'charge', label: 'Charge your phone', icon: '🔌', enabled: cd <= 0, hint: cd > 0 ? 'Already at 100%' : '+morale' }] };
    case 'vip':
      return { ...base, icon: '🥂', subtitle: s.invites.length ? `You have ${s.invites.length} invite${s.invites.length > 1 ? 's' : ''}. See you after 6 PM.` : 'Invite only. Make friends at booths to get in.', actions: [{ id: 'vip', label: 'Peek past the velvet rope', icon: '👀', enabled: true }] };
    default:
      return null;
  }
}

function npcContext(s: GameState, n: Npc): Context | null {
  if (n.kind === 'rumor' && n.rumorCooldown <= 0)
    return { title: 'Chatty Attendee', subtitle: 'Has "heard things".', icon: '💬', targetType: 'npc', ref: n.id, actions: [{ id: 'gossip', label: 'Listen to gossip', icon: '👂', enabled: true }] };
  if (n.kind === 'ceo' && !n.talked)
    return { title: 'Guy in a Hoodie', subtitle: 'Sunglasses indoors. Very relaxed. Suspiciously expensive sneakers.', icon: '🕶️', targetType: 'npc', ref: n.id, actions: [{ id: 'ceo', label: 'Strike up a conversation', icon: '🗣️', enabled: true, hint: 'Could be a VIP lead' }] };
  return null;
}

export function computeContext(s: GameState): Context | null {
  const p = s.player;
  const R = CONFIG.interact.range;
  // 1. Live events at your feet
  let bestE: GameEvent | null = null, bestED = 1.9;
  for (const e of activeEvents(s)) {
    if (e.boothIdx < 0) continue;
    const d = Math.hypot(e.spot.x - p.x, e.spot.y - p.y);
    if (d < bestED) { bestED = d; bestE = e; }
  }
  if (bestE) {
    const b = s.map.booths[bestE.boothIdx];
    return boothContext(s, b, [eventClaimAction(s, bestE)], bestE);
  }
  // 2. Special NPCs
  for (const n of s.npcs) {
    if ((n.kind === 'rumor' || n.kind === 'ceo') && Math.hypot(n.x - p.x, n.y - p.y) < 1.4) {
      const c = npcContext(s, n);
      if (c) return c;
    }
  }
  // 3. Booths and fixtures, nearest first
  let best: { d: number; ctx: () => Context | null } | null = null;
  for (const b of s.map.booths) {
    const d = distToRect(p, b.rect);
    if (d < R && (!best || d < best.d)) best = { d, ctx: () => boothContext(s, b) };
  }
  s.map.fixtures.forEach((f, fi) => {
    if (f.kind === 'plant' || f.kind === 'sofa') return;
    const d = distToRect(p, f.rect);
    if (d < R && (!best || d < best.d)) best = { d, ctx: () => fixtureContext(s, f, fi) };
  });
  return best ? (best as { ctx: () => Context | null }).ctx() : null;
}

function setChannel(s: GameState, c: Channel) {
  s.channel = c;
}

function cancelChannel(s: GameState) {
  const c = s.channel;
  if (!c) return;
  s.channel = null;
  if (c.kind === 'chat') floater(s, 'Conversation abandoned', '#ffb4a2');
  else if (c.kind === 'demo') {
    s.stats.escapes++;
    s.player.morale -= 2;
    floater(s, 'You back away mid-sentence...', '#7dffb0');
    sound(s, 'escape');
  } else if (c.kind === 'queue') floater(s, 'Left the line', '#ffb4a2');
  else if (c.kind === 'wheel') finishWheel(s, c, true);
}

export function doAction(s: GameState, ctx: Context, id: string) {
  const p = s.player;
  const booth = ctx.targetType === 'booth' ? s.map.booths[ctx.ref] : ctx.targetType === 'event' ? s.map.booths[s.events.find((e) => e.id === ctx.ref)!.boothIdx] : null;
  switch (id) {
    case 'claim': {
      const e = s.events.find((ev) => ev.id === ctx.ref)!;
      const q = e.state === 'active' ? queueAt(s, e) : 0;
      const dur = 0.5 + Math.min(q * 0.35, 4);
      setChannel(s, { kind: 'queue', t: 0, dur, label: q > 0 ? `Waiting in line (${q} ahead)` : 'Grabbing...', sub: e.def.title, ref: e.id, cancelable: true });
      break;
    }
    case 'fakevip': {
      const e = s.events.find((ev) => ev.id === ctx.ref)!;
      setChannel(s, { kind: 'fakevip', t: 0, dur: 4, label: 'Entering the VIP lounge...', sub: 'Wait. Is that a projector?', ref: e.id, cancelable: true });
      break;
    }
    case 'grab':
      setChannel(s, { kind: 'grab', t: 0, dur: CONFIG.interact.grabSec, label: 'Grabbing freebie...', sub: booth!.profile.name, ref: booth!.idx, cancelable: true });
      break;
    case 'chat':
      setChannel(s, { kind: 'chat', t: 0, dur: CONFIG.interact.chatSec * s.arch.chatMult, label: `Chatting with ${booth!.profile.name}`, sub: s.rng.pick(CHAT_LINES), ref: booth!.idx, cancelable: true });
      sound(s, 'blip');
      break;
    case 'demo':
      startDemo(s, booth!);
      break;
    case 'wheel':
      s.stats.wheelSpins++;
      setChannel(s, { kind: 'wheel', t: 0, dur: 6, label: 'Prize wheel! Press E / tap to stop in the green', sub: booth!.profile.name, ref: booth!.idx, cancelable: true, data: 0 });
      sound(s, 'blip');
      break;
    case 'crowd':
      s.crowdVision = 8;
      s.crowdVisionCooldown = 45;
      s.stats.crowdVision++;
      if (s.stats.crowdVision === 1) s.stats.secrets++;
      p.morale += 3;
      for (const e of activeEvents(s)) if (Math.hypot(e.spot.x - p.x, e.spot.y - p.y) < 40 && e.boothIdx >= 0) e.known = 'exact';
      toast(s, 'FabriSight Crowd Vision: see what the crowd is doing. (Fictional in-game heat map.)', '📡', 'rare');
      sound(s, 'rare');
      break;
    case 'kiosk': {
      const f = s.map.fixtures[ctx.ref];
      f.stock = (f.stock ?? 1) - 1;
      give(s, 'coffee');
      give(s, 'cookie');
      break;
    }
    case 'map':
      s.infoVisited = true;
      s.stats.secrets++;
      for (const b of s.map.booths) b.discovered = true;
      toast(s, 'Floor map acquired! Booths are now on your map (M). Events still need scouting.', '🗺️', 'good');
      sound(s, 'pickup');
      break;
    case 'tip':
      s.infoTipCooldown = 35;
      s.stats.rumorsHeard++;
      toast(s, `Info desk: "${capital(produceTip(s))}"`, '🗣️', 'info');
      sound(s, 'blip');
      break;
    case 'water':
      s.fixtureCooldown[s.map.fixtures[ctx.ref].id] = 20;
      give(s, 'water');
      break;
    case 'restroom':
      setChannel(s, { kind: 'restroom', t: 0, dur: CONFIG.interact.restroomSec, label: 'Using the restroom...', sub: 'There is a line. Of course there is.', ref: ctx.ref, cancelable: true });
      break;
    case 'shuttle':
      setChannel(s, { kind: 'shuttle', t: 0, dur: CONFIG.interact.shuttleWaitSec, label: 'Waiting for the shuttle...', sub: 'It is "two minutes away".', ref: ctx.ref, cancelable: true });
      break;
    case 'charge':
      s.fixtureCooldown[s.map.fixtures[ctx.ref].id] = 60;
      p.morale += 5;
      floater(s, '🔋 Phone 100%. Inner peace 12%.', '#a0e7ff');
      sound(s, 'pickup');
      break;
    case 'vip':
      toast(s, s.invites.length ? `The bouncer nods. "See you tonight." (${s.invites.map((i) => PARTY_INFO[i.tier].name).join(', ')})` : 'A bouncer looks at your badge, then at you. "Invite only." Build relationships at booths.', '🥂', 'info');
      break;
    case 'gossip': {
      const n = s.npcs.find((n) => n.id === ctx.ref);
      if (n) n.rumorCooldown = 40;
      s.stats.rumorsHeard++;
      toast(s, fmt(s.rng.pick(RUMOR_NPC_LINES), { tip: produceTip(s) }), '💬', 'info');
      sound(s, 'blip');
      break;
    }
    case 'ceo':
      setChannel(s, { kind: 'ceo', t: 0, dur: 3.5 * s.arch.chatMult, label: 'Chatting with the hoodie guy...', sub: '"I just like to walk the floor, you know?"', ref: ctx.ref, cancelable: true });
      break;
  }
}

function capital(t: string) {
  return t.charAt(0).toUpperCase() + t.slice(1);
}

function startDemo(s: GameState, b: BoothInstance) {
  setChannel(s, { kind: 'demo', t: 0, dur: CONFIG.interact.demoSec, label: `${b.profile.name} demo in progress`, sub: s.rng.pick(DEMO_LINES), ref: b.idx, cancelable: true });
  sound(s, 'blip');
}

// ---------------------------------------------------------------- channels

function updateChannel(s: GameState, dt: number, input: Input): boolean {
  const c = s.channel;
  if (!c) return false;
  c.t += dt;
  if (c.kind === 'wheel') {
    c.data = Math.sin(c.t * 4.4);
    if ((input.interact || input.action !== null) && c.t > 0.2) { s.channel = null; finishWheel(s, c, false); return true; }
  }
  if (c.kind === 'demo' && Math.floor(c.t / 1.6) !== Math.floor((c.t - dt) / 1.6)) c.sub = s.rng.pick(DEMO_LINES);
  if (c.t < c.dur) return input.interact;
  s.channel = null;
  completeChannel(s, c);
  return true;
}

function finishWheel(s: GameState, c: Channel, timeout: boolean) {
  const b = s.map.booths[c.ref];
  b.wheelUsed = true;
  const m = c.data ?? 1;
  if (!timeout && Math.abs(m) < 0.24) {
    s.stats.wheelWins++;
    const prize = s.rng.pick(['powerbank', 'socks', 'chicken', 'plushie', 'tshirt']);
    toast(s, `WHEEL WIN! ${b.profile.name} hands you a prize.`, '🎡', 'rare');
    confetti(s);
    give(s, prize, 'fixture');
  } else {
    toast(s, 'The wheel lands on "PEN". It is always pen.', '🎡', 'info');
    give(s, 'pen', 'fixture');
  }
}

function completeChannel(s: GameState, c: Channel) {
  const p = s.player;
  switch (c.kind) {
    case 'grab': {
      const b = s.map.booths[c.ref];
      if (b.stock <= 0) { floater(s, s.rng.pick(GRAB_QUIPS_EMPTY), '#ffb4a2'); sound(s, 'fail'); return; }
      const id = s.rng.pick(b.profile.freebie);
      if (give(s, id, 'booth', b.idx)) { b.stock--; b.visited = true; }
      break;
    }
    case 'chat': finishChat(s, s.map.booths[c.ref]); break;
    case 'demo': {
      const b = s.map.booths[c.ref];
      s.stats.demos++;
      b.demoDone = true;
      p.morale -= 6;
      p.connections += 1;
      b.rel = Math.min(100, b.rel + 10 * s.arch.relMult);
      toast(s, `Demo survived. You now know more about ${b.profile.category.toLowerCase()} than anyone should.`, '📊', 'info');
      give(s, b.profile.demoSwag ?? 'sticker', 'booth', b.idx);
      checkInvite(s, b);
      break;
    }
    case 'queue': claimEvent(s, c.ref); break;
    case 'fakevip': {
      const e = s.events.find((e) => e.id === c.ref);
      if (e) e.playerClaimed = true;
      s.stats.fakeVip++;
      if (s.stats.fakeVip === 1) s.stats.secrets++;
      p.morale -= 5;
      p.connections += 1;
      toast(s, 'The "VIP lounge" was a product webinar with sparkling water. You got a brochure.', '🥂', 'bad');
      give(s, 'brochure');
      sound(s, 'fail');
      break;
    }
    case 'restroom': {
      const relief = p.bladder > 50;
      p.morale += relief ? 8 : 1;
      p.bladder = 0;
      p.urgentWarned = false;
      s.stats.restroom++;
      floater(s, relief ? 'Sweet relief. +8 morale' : 'Well, that was a trip.', '#a0e7ff');
      break;
    }
    case 'shuttle': {
      const f = s.map.fixtures[c.ref];
      const dest = s.map.fixtures.find((x) => x.id === f.link);
      if (dest) {
        const w = nearestWalkable(s.map, dest.rect.x + 1, dest.rect.y - 0.6);
        p.x = w.x; p.y = w.y;
        s.stats.shuttleRides++;
        toast(s, 'Shuttle ride! You crossed the hall while sitting down. Revolutionary.', '🚌', 'good');
        sound(s, 'whoosh');
      }
      break;
    }
    case 'ceo': finishCeo(s, c.ref); break;
    case 'wheel': finishWheel(s, c, true); break;
    case 'stunned': {
      s.stats.escapes++;
      floater(s, 'Finally free.', '#7dffb0');
      break;
    }
  }
}

function finishChat(s: GameState, b: BoothInstance) {
  const p = s.player;
  b.chats++;
  s.stats.chats++;
  p.connections += 1;
  p.morale += 2;
  const before = b.rel;
  b.rel = Math.min(100, b.rel + CONFIG.interact.chatGain * s.arch.relMult);
  floater(s, `🤝 ${b.profile.name} ${Math.round(before)}% → ${Math.round(b.rel)}%`, '#9ef0ff');
  if (b.chats === 1) toast(s, `${b.profile.name}: ${BOOTH_CLUES[b.profile.party ?? 'none']}`, '🔎', 'info');
  if (b.rel < 100 && b.chats % CONFIG.interact.chatsBeforeCooldown === 0) {
    b.chatCooldown = CONFIG.interact.chatCooldownSec;
    toast(s, `${b.profile.name} has to talk to other people. Come back in a bit.`, '⏳', 'info');
  }
  sound(s, 'pickup');
  checkInvite(s, b);
}

function checkInvite(s: GameState, b: BoothInstance) {
  if (b.rel < 100 || b.invited) return;
  b.invited = true;
  if (b.profile.party && s.invites.length < CONFIG.maxInvites) {
    grantInvite(s, b.profile.party, b.profile.name, b.idx);
  } else {
    s.stats.leads++;
    s.player.connections += 2;
    toast(s, b.profile.party ? `${b.profile.name} invites you too, but you are double-booked. You got an Actual Business Lead instead.` : `No party at ${b.profile.name}, but you got an Actual Business Lead™. Rare!`, '📈', 'good');
    sound(s, 'rare');
  }
}

function grantInvite(s: GameState, tier: PartyTier, host: string, boothIdx: number) {
  s.invites.push({ boothIdx, tier, host });
  const info = PARTY_INFO[tier];
  toast(s, `VIP INVITE: ${info.name} by ${host}! ${info.where}`, '🎟️', 'rare');
  floater(s, `🎟️ VIP INVITE +${info.bonus}`, '#ff9ef0', true);
  confetti(s, s.player.x, s.player.y, 70);
  sound(s, 'fanfare');
}

function finishCeo(s: GameState, npcId: number) {
  const n = s.npcs.find((n) => n.id === npcId);
  if (n) n.talked = true;
  s.stats.ceoMet = true;
  s.stats.secrets++;
  s.player.connections += 3;
  const chance = (s.arch.id === 'networker' ? 0.8 : 0.55) + (s.player.connections >= 8 ? 0.15 : 0);
  if (s.invites.length < CONFIG.maxInvites && !s.invites.some((i) => i.tier === 'rooftop') && s.rng.chance(chance)) {
    toast(s, 'The hoodie guy is the CEO. "You’re fun. Come to the roof tonight."', '🕶️', 'rare');
    grantInvite(s, 'rooftop', 'The Incognito CEO', -1);
  } else {
    const roof = s.map.booths.find((b) => b.profile.party === 'rooftop');
    if (roof) s.cluesKnown.add(roof.idx);
    toast(s, `He gives you a business card. It is for his podcast. He mentions ${roof ? roof.profile.name : 'a booth'} throws a great rooftop party.`, '📇', 'info');
    give(s, 'card');
  }
}

function claimEvent(s: GameState, id: number) {
  const e = s.events.find((ev) => ev.id === id);
  const p = s.player;
  if (!e || e.state === 'ended' || e.state === 'scheduled') { floater(s, 'It vanished. Like a mirage.', '#ffb4a2'); sound(s, 'fail'); return; }
  if (Math.hypot(e.spot.x - p.x, e.spot.y - p.y) > 2.6) return;
  if (e.playerClaimed) return;
  if (e.state === 'leftovers' || e.stock <= 0) {
    e.playerClaimed = true;
    s.stats.lateArrivals++;
    if (e.kind === 'charcuterie') { s.stats.crackers++; give(s, 'crackers'); toast(s, 'Cheese betrayal. The board is bare. Crackers. Again.', '🥨', 'bad'); }
    else if (e.kind === 'swagdrop') { toast(s, 'All gone. Someone got three. Here is a pen as consolation.', '🖊️', 'bad'); give(s, 'pen'); }
    else { p.morale -= 4; toast(s, s.rng.pick(e.def.late.length ? e.def.late : ['Gone.']), '😩', 'bad'); }
    sound(s, 'fail');
    return;
  }
  let reward: string | null = null;
  switch (e.kind) {
    case 'celebrity':
      e.stock--; e.playerClaimed = true; s.stats.eventsClaimed++; s.stats.selfies++;
      if (s.stats.selfies === 1) s.stats.secrets++;
      p.morale += 15; p.connections += 2;
      toast(s, 'Selfie with the Reality TV Forklift Champion! They signed your badge. +15 morale', '🤳', 'rare');
      confetti(s);
      sound(s, 'rare');
      return;
    case 'lunch':
      reward = e.lunchOutcome === 'cold' ? 'coldpizza' : 'pizza';
      if (e.lunchOutcome === 'cold') toast(s, 'Lunch Mirage: it was real pizza... from 9 AM.', '🍕', 'info');
      break;
    case 'charcuterie': reward = 'charcuterie'; s.stats.charcuterie++; confetti(s, p.x, p.y, 30); break;
    default: {
      const pool = EVENT_REWARD[e.kind];
      reward = pool && pool.length ? s.rng.pick(pool) : null;
    }
  }
  if (!reward) return;
  if (give(s, reward, 'event', e.id)) {
    e.stock--;
    e.playerClaimed = true;
    s.stats.eventsClaimed++;
  }
}

// ---------------------------------------------------------------- tutorial & ticker

export const TUTORIAL_STEPS = [
  'Move with WASD / arrow keys (or drag the stick)',
  'Grab coffee ☕ at the kiosk next to you: walk up, press E',
  'Hold Shift (or SPRINT) to run. It burns energy fast!',
  'Goodies expire! Follow ⏱ markers and arrows before the crowd eats everything.',
];

function updateTutorial(s: GameState, dt: number) {
  if (s.tutorial < 0) return;
  if (s.tutorial === 0 && s.player.distance > 2.5) s.tutorial = 1;
  else if (s.tutorial === 1 && s.stats.coffees > 0) s.tutorial = 2;
  else if (s.tutorial === 2 && s.stats.sprintTime > 0.7) { s.tutorial = 3; s.tutorialT = 0; }
  else if (s.tutorial === 3) { s.tutorialT += dt; if (s.tutorialT > 8) s.tutorial = -1; }
  // Don't let the tutorial block forever.
  if (s.elapsed > 45) s.tutorial = -1;
}

function updateTicker(s: GameState, dt: number) {
  s.ticker.t += dt;
  const min = gameMinutes(s.elapsed);
  if (s.ticker.t > 6.5 || (s.ticker.queue.length && s.ticker.t > 3.2)) {
    s.ticker.t = 0;
    let next = s.ticker.queue.shift();
    if (!next) {
      const pool = min > 11.75 * 60 && min < 13.5 * 60 && s.rng.chance(0.35) ? TICKER_LUNCH : min > 17 * 60 && s.rng.chance(0.5) ? TICKER_LATE : TICKER_AMBIENT;
      next = s.rng.pick(pool);
    }
    s.ticker.text = next;
  }
}

// ---------------------------------------------------------------- objective hint

export function objective(s: GameState): { text: string; icon: string } {
  if (s.tutorial >= 0) return { text: TUTORIAL_STEPS[s.tutorial], icon: '👟' };
  const p = s.player;
  if (p.bladder >= CONFIG.player.bladderUrgent) return { text: 'Find a restroom 🚻 (ends of the main cross-aisle)', icon: '🚻' };
  const known = activeEvents(s).filter((e) => e.known === 'exact' && e.state === 'active' && !e.playerClaimed && e.kind !== 'demoblitz' && e.kind !== 'scanner');
  if (known.length) {
    known.sort((a, b) => Math.hypot(a.spot.x - p.x, a.spot.y - p.y) - Math.hypot(b.spot.x - p.x, b.spot.y - p.y));
    const e = known[0];
    const d = Math.round(Math.hypot(e.spot.x - p.x, e.spot.y - p.y) * CONFIG.metersPerTile);
    return { text: `${e.def.title} at ${eventLabel(s, e)} · ${d}m · ${Math.ceil(e.remaining)}s left`, icon: e.def.icon };
  }
  if (p.energy < 25) return { text: 'Running on fumes. Rest in a lounge 🛋️ or find coffee ☕', icon: '🥵' };
  const hallRumor = activeEvents(s).find((e) => e.known === 'hall' && e.state === 'active');
  if (hallRumor) return { text: `Rumor: ${hallRumor.def.title} somewhere in Hall ${hallRumor.hall}`, icon: '👂' };
  const close = s.map.booths.filter((b) => b.rel > 0 && b.rel < 100).sort((a, b) => b.rel - a.rel)[0];
  if (close) return { text: `${close.profile.name} relationship ${Math.round(close.rel)}%. Keep chatting for a VIP shot.`, icon: '🤝' };
  if (!s.infoVisited) return { text: 'Grab a floor map at the Information Desk ℹ️ (center)', icon: 'ℹ️' };
  return { text: 'Explore, chat at booths, and listen for rumors 💬', icon: '🧭' };
}

export function clockText(s: GameState) {
  return formatClock(gameMinutes(s.elapsed));
}
