import { CONFIG } from './config';
import { bfs, nearestWalkable, type ExpoMap } from './map';
import type { GameEvent, GameState, Npc, NpcKind } from './state';
import type { HallId, Vec } from './types';

// Distance fields to target tiles, cached per map. NPCs follow the gradient downhill.
const fieldCache = new WeakMap<ExpoMap, Map<number, Int16Array>>();

export function fieldFor(map: ExpoMap, tile: number): Int16Array {
  let cache = fieldCache.get(map);
  if (!cache) { cache = new Map(); fieldCache.set(map, cache); }
  let f = cache.get(tile);
  if (!f) {
    if (cache.size > 220) cache.clear();
    f = bfs(map, tile % map.w, Math.floor(tile / map.w));
    cache.set(tile, f);
  }
  return f;
}

const SHIRTS = ['#e63946', '#457b9d', '#2a9d8f', '#e9c46a', '#f4a261', '#8d99ae', '#6d597a', '#b5838d', '#3d5a80', '#ee6c4d', '#81b29a', '#f2cc8f', '#577590', '#90be6d'];
const SKINS = ['#f1c27d', '#e0ac69', '#c68642', '#8d5524', '#ffdbac', '#a1665e'];

export function makeNpc(s: GameState, kind: NpcKind, at: Vec): Npc {
  const rng = s.rng;
  const n: Npc = {
    id: s.nextId++, kind, x: at.x, y: at.y,
    ox: rng.range(-0.32, 0.32), oy: rng.range(-0.32, 0.32),
    wx: at.x, wy: at.y, target: -1, wait: rng.range(0, 2),
    speed: CONFIG.npc.speed * rng.range(0.8, 1.15),
    color: rng.pick(SHIRTS), skin: rng.pick(SKINS), hat: rng.int(0, 5),
    eventId: -1, emote: '', emoteT: 0, rumorCooldown: 0, dir: 1, walkT: rng.range(0, 6),
  };
  if (kind === 'rumor') n.emote = '💬';
  if (kind === 'ceo') { n.color = '#2b2d42'; n.speed = 1.9; }
  if (kind === 'scanner') { n.color = '#ff006e'; n.speed = 3.0; n.scanCooldown = 3; }
  if (kind === 'celebrity') { n.color = '#ffd23f'; n.speed = 0; }
  return n;
}

function randomWalkTile(s: GameState): number {
  return s.rng.pick(s.map.walkTiles);
}

export function spawnNpcs(s: GameState, count: number, atEntrance = false) {
  for (let i = 0; i < count; i++) {
    let p: Vec;
    if (atEntrance) p = { x: s.map.spawn.x + s.rng.range(-3, 3), y: s.map.spawn.y - s.rng.range(0, 1) };
    else {
      const t = randomWalkTile(s);
      p = { x: (t % s.map.w) + 0.5, y: Math.floor(t / s.map.w) + 0.5 };
    }
    p = nearestWalkable(s.map, p.x, p.y);
    const kind: NpcKind = !atEntrance && i % 11 === 5 ? 'rumor' : 'attendee';
    s.npcs.push(makeNpc(s, kind, p));
  }
}

export function spawnSpecialNpc(s: GameState, kind: NpcKind, hall: HallId, at?: Vec): Npc {
  let p = at;
  if (!p) {
    const tiles = s.map.walkTiles.filter((t) => s.map.halls[t] === ['A', 'B', 'C', 'D'].indexOf(hall) + 1);
    const t = s.rng.pick(tiles.length ? tiles : s.map.walkTiles);
    p = { x: (t % s.map.w) + 0.5, y: Math.floor(t / s.map.w) + 0.5 };
  }
  const n = makeNpc(s, kind, p);
  n.homeHall = hall;
  if (kind === 'celebrity') { n.emote = '⭐'; n.ox = 0; n.oy = -0.3; n.y -= 0.3; }
  if (kind === 'ceo') n.emote = '🕶️';
  if (kind === 'scanner') n.emote = '📟';
  s.npcs.push(n);
  return n;
}

export function removeNpc(s: GameState, id: number) {
  s.npcs = s.npcs.filter((n) => n.id !== id);
}

/** Pull a share of nearby attendees toward a fresh giveaway. Unknown events still cause visible crowd movement. */
export function rushTo(s: GameState, e: GameEvent) {
  const tile = Math.floor(e.spot.y) * s.map.w + Math.floor(e.spot.x);
  for (const n of s.npcs) {
    if (n.kind !== 'attendee' || n.eventId >= 0) continue;
    const d = Math.hypot(n.x - e.spot.x, n.y - e.spot.y);
    if (d > 36) continue;
    const p = e.def.attract * (d < 14 ? 1.6 : 1);
    if (s.rng.chance(p)) {
      n.target = tile;
      n.eventId = e.id;
      n.wait = s.rng.range(0, 1.5);
      n.emote = '!';
      n.emoteT = 2;
    }
  }
}

function pickTarget(s: GameState, n: Npc) {
  const r = s.rng.next();
  const { map } = s;
  if (n.homeHall) {
    const hi = ['A', 'B', 'C', 'D'].indexOf(n.homeHall) + 1;
    const booths = map.booths.filter((b) => b.hall === n.homeHall && b.front.length);
    if (booths.length && r < 0.8) {
      const f = s.rng.pick(s.rng.pick(booths).front);
      n.target = f.y * map.w + f.x;
      return;
    }
    const tiles = map.walkTiles.filter((t) => map.halls[t] === hi);
    n.target = s.rng.pick(tiles.length ? tiles : map.walkTiles);
    return;
  }
  if (r < 0.7) {
    const b = s.rng.pick(map.booths);
    if (b.front.length) {
      const f = s.rng.pick(b.front);
      n.target = f.y * map.w + f.x;
      return;
    }
  }
  n.target = randomWalkTile(s);
}

export function updateNpcs(s: GameState, dt: number) {
  const { map } = s;
  s.crowd.fill(0);
  for (const n of s.npcs) {
    if (n.emoteT > 0) {
      n.emoteT -= dt;
      if (n.emoteT <= 0 && n.kind === 'attendee') n.emote = '';
    }
    if (n.kind === 'rumor') {
      n.rumorCooldown -= dt;
      n.emote = n.rumorCooldown <= 0 ? '💬' : '';
    }
    if (n.scanCooldown !== undefined && n.scanCooldown > 0) n.scanCooldown -= dt;
    if (n.kind === 'celebrity') { n.walkT += dt; continue; }

    // Badge scanners hunt you when they see you.
    if (n.kind === 'scanner') {
      const dp = Math.hypot(s.player.x - n.x, s.player.y - n.y);
      n.chasing = dp < 7 && (n.scanCooldown ?? 0) <= 0;
      if (n.chasing) {
        const pt = Math.floor(s.player.y) * map.w + Math.floor(s.player.x);
        if (n.target !== pt) { n.target = pt; n.wait = 0; }
      }
    }

    const ti = Math.floor(n.y) * map.w + Math.floor(n.x);
    if (n.kind === 'attendee' && ti >= 0 && ti < s.crowd.length && s.crowd[ti] < 255) s.crowd[ti]++;

    if (n.wait > 0) {
      n.wait -= dt;
      if (n.wait <= 0 && n.eventId >= 0) {
        const e = s.events.find((ev) => ev.id === n.eventId);
        if (e && Math.hypot(n.x - e.spot.x, n.y - e.spot.y) < 2.2) {
          // Grab the goodie (or discover the sad empty tray), then wander off.
          if (e.state === 'active' && e.stock > 0) {
            e.stock--;
            n.emote = e.def.icon; n.emoteT = 2.5;
          } else { n.emote = '😩'; n.emoteT = 2; }
          n.eventId = -1;
          n.target = -1;
          n.wait = s.rng.range(0.5, 2);
        }
      }
      continue;
    }
    if (n.target < 0) pickTarget(s, n);
    const field = fieldFor(map, n.target);
    const dx = n.wx - n.x, dy = n.wy - n.y;
    const dist = Math.hypot(dx, dy);
    if (dist < 0.06) {
      const cur = field[ti];
      if (cur < 0) {
        const w = nearestWalkable(map, n.x, n.y);
        n.x = n.wx = w.x; n.y = n.wy = w.y;
        n.target = -1;
        continue;
      }
      if (cur === 0) {
        // Arrived.
        n.target = -1;
        if (n.eventId >= 0) n.wait = s.rng.range(0.3, 1.4);
        else n.wait = n.kind === 'scanner' ? 0.5 : s.rng.range(1.5, 6);
        continue;
      }
      const x = ti % map.w, y = Math.floor(ti / map.w);
      const opts: number[] = [];
      if (x > 0 && field[ti - 1] === cur - 1) opts.push(ti - 1);
      if (x < map.w - 1 && field[ti + 1] === cur - 1) opts.push(ti + 1);
      if (y > 0 && field[ti - map.w] === cur - 1) opts.push(ti - map.w);
      if (y < map.h - 1 && field[ti + map.w] === cur - 1) opts.push(ti + map.w);
      const nt = opts.length ? opts[(n.id + cur) % opts.length] : ti;
      const last = field[nt] === 0;
      n.wx = (nt % map.w) + 0.5 + (last ? n.ox * 1.6 : n.ox);
      n.wy = Math.floor(nt / map.w) + 0.5 + (last ? n.oy * 1.6 : n.oy);
      // keep inside the tile
      n.wx = Math.min(Math.floor(n.wx) + 0.92, Math.max(Math.floor(n.wx) + 0.08, n.wx));
      n.wy = Math.min(Math.floor(n.wy) + 0.92, Math.max(Math.floor(n.wy) + 0.08, n.wy));
      continue;
    }
    const sp = n.speed * (n.eventId >= 0 ? 1.3 : 1) * (n.chasing ? 1.15 : 1);
    const step = Math.min(dist, sp * dt);
    n.x += (dx / dist) * step;
    n.y += (dy / dist) * step;
    if (Math.abs(dx) > 0.01) n.dir = dx < 0 ? -1 : 1;
    n.walkT += dt * sp;
  }
}

/** How many attendees are packed around a tile (3x3), for slowing the player. */
export function crowdAround(s: GameState, x: number, y: number): number {
  const tx = Math.floor(x), ty = Math.floor(y);
  let c = 0;
  for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
    const nx = tx + dx, ny = ty + dy;
    if (nx < 0 || ny < 0 || nx >= s.map.w || ny >= s.map.h) continue;
    c += s.crowd[ny * s.map.w + nx];
  }
  return c;
}
