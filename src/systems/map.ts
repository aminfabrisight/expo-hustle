import { RNG } from './rng';
import type { BoothProfile, HallId, Vec } from './types';
import { BOOTHS, FILLER_NOUN, FILLER_PREFIX, FILLER_SUFFIX, FILLER_TAGLINES } from '../content/booths';
import { SPONSOR_BOOTHS } from '../content/sponsors';

export const T_FLOOR = 0;
export const T_WALL = 1;
export const T_BOOTH = 2;
export const T_FIXTURE = 3;

export interface Rect { x: number; y: number; w: number; h: number }

export interface BoothInstance {
  idx: number;
  profile: BoothProfile;
  rect: Rect;
  number: string;
  hall: HallId;
  front: Vec[]; // walkable tiles in front of the booth (tile coords)
  // runtime
  stock: number;
  restock: number;
  rel: number;
  chats: number;
  chatCooldown: number;
  salesCooldown: number;
  salesPos?: Vec; // salesperson stands here (world tile coords, float)
  discovered: boolean;
  visited: boolean;
  invited: boolean;
  wheelUsed: boolean;
  demoDone: boolean;
}

export type FixtureKind = 'kiosk' | 'info' | 'fountain' | 'charger' | 'restroom' | 'shuttle' | 'vip' | 'plant' | 'sofa';

export interface Fixture {
  id: string;
  kind: FixtureKind;
  rect: Rect;
  solid: boolean;
  name: string;
  hall?: HallId;
  link?: string; // shuttle destination id
  stock?: number;
  restock?: number;
}

export interface ExpoMap {
  w: number;
  h: number;
  tiles: Uint8Array;
  halls: Uint8Array; // 0=promenade, 1..4 = A..D
  lounge: Uint8Array; // 1 = rest zone
  booths: BoothInstance[];
  fixtures: Fixture[];
  lounges: Rect[];
  spawn: Vec;
  reachable: Uint8Array;
  walkTiles: number[]; // indices of reachable floor tiles
}

export const MAP_W = 78;
export const MAP_H = 58;
const HALL_KEYS: HallId[] = ['A', 'B', 'C', 'D'];

/** Quadrant layout: A top-left, B top-right, C bottom-left, D bottom-right. */
const QUADS: Record<HallId, { x0: number; y0: number; rows: number[] }> = {
  A: { x0: 1, y0: 1, rows: [2, 11] },
  B: { x0: 43, y0: 1, rows: [2, 11] },
  C: { x0: 1, y0: 32, rows: [5, 14] },
  D: { x0: 43, y0: 32, rows: [5, 14] },
};
const BLOCK_COLS = [2, 13, 24];
const BOOTH_W = 4;
const BOOTH_H = 3;

export function hallAt(map: ExpoMap, x: number, y: number): HallId | null {
  const h = map.halls[Math.floor(y) * map.w + Math.floor(x)];
  return h ? HALL_KEYS[h - 1] : null;
}

export function isSolid(map: ExpoMap, tx: number, ty: number): boolean {
  if (tx < 0 || ty < 0 || tx >= map.w || ty >= map.h) return true;
  return map.tiles[ty * map.w + tx] !== T_FLOOR;
}

function fill(map: ExpoMap, r: Rect, t: number) {
  for (let y = r.y; y < r.y + r.h; y++) for (let x = r.x; x < r.x + r.w; x++) map.tiles[y * map.w + x] = t;
}

export function generateMap(rng: RNG): ExpoMap {
  const w = MAP_W, h = MAP_H;
  const map: ExpoMap = {
    w, h,
    tiles: new Uint8Array(w * h),
    halls: new Uint8Array(w * h),
    lounge: new Uint8Array(w * h),
    booths: [], fixtures: [], lounges: [],
    spawn: { x: 37.5, y: h - 2.5 },
    reachable: new Uint8Array(w * h),
    walkTiles: [],
  };
  // walls
  for (let x = 0; x < w; x++) { map.tiles[x] = T_WALL; map.tiles[(h - 1) * w + x] = T_WALL; }
  for (let y = 0; y < h; y++) { map.tiles[y * w] = T_WALL; map.tiles[y * w + w - 1] = T_WALL; }
  // hall membership
  HALL_KEYS.forEach((k, i) => {
    const q = QUADS[k];
    for (let y = q.y0; y < q.y0 + 25; y++) for (let x = q.x0; x < q.x0 + 34; x++) if (y > 0 && y < h - 1 && x > 0 && x < w - 1) map.halls[y * w + x] = i + 1;
  });

  // --- fixed landmarks ---
  const addFix = (f: Fixture) => { map.fixtures.push(f); if (f.solid) fill(map, f.rect, T_FIXTURE); };
  addFix({ id: 'info', kind: 'info', rect: { x: 37, y: 27, w: 4, h: 3 }, solid: true, name: 'Information Desk' });
  addFix({ id: 'vip', kind: 'vip', rect: { x: 35, y: 1, w: 8, h: 4 }, solid: true, name: 'VIP Lounge (opens 6 PM)' });
  addFix({ id: 'kiosk-entrance', kind: 'kiosk', rect: { x: 40, y: 50, w: 2, h: 2 }, solid: true, name: 'Entrance Coffee Kiosk', stock: 6, restock: 0 });
  addFix({ id: 'kiosk-north', kind: 'kiosk', rect: { x: 36, y: 13, w: 2, h: 2 }, solid: true, name: 'North Coffee Kiosk', stock: 6, restock: 0 });
  addFix({ id: 'rr-west', kind: 'restroom', rect: { x: 1, y: 27, w: 1, h: 4 }, solid: true, name: 'Restrooms (West)' });
  addFix({ id: 'rr-east', kind: 'restroom', rect: { x: w - 2, y: 27, w: 1, h: 4 }, solid: true, name: 'Restrooms (East)' });
  addFix({ id: 'fountain-1', kind: 'fountain', rect: { x: 35, y: 21, w: 1, h: 1 }, solid: true, name: 'Water Fountain' });
  addFix({ id: 'fountain-2', kind: 'fountain', rect: { x: 42, y: 40, w: 1, h: 1 }, solid: true, name: 'Water Fountain' });
  addFix({ id: 'shuttle-sw', kind: 'shuttle', rect: { x: 2, y: h - 3, w: 2, h: 1 }, solid: true, name: 'Expo Shuttle (to NE)', link: 'shuttle-ne' });
  addFix({ id: 'shuttle-ne', kind: 'shuttle', rect: { x: w - 3, y: 21, w: 2, h: 1 }, solid: true, name: 'Expo Shuttle (to SW)', link: 'shuttle-sw' });

  // --- booth slots per quadrant ---
  type Slot = { hall: HallId; rect: Rect; facing: 'up' | 'down'; block: number };
  const blocks: { hall: HallId; rect: Rect; id: number }[] = [];
  let bid = 0;
  for (const k of HALL_KEYS) {
    const q = QUADS[k];
    for (const ry of q.rows) for (const cx of BLOCK_COLS) blocks.push({ hall: k, rect: { x: q.x0 + cx, y: q.y0 + ry, w: 8, h: 6 }, id: bid++ });
  }
  // Each quadrant gets one lounge block (rest area, sometimes a kiosk + charger).
  const loungeBlocks = new Set<number>();
  for (const k of HALL_KEYS) loungeBlocks.add(rng.pick(blocks.filter((b) => b.hall === k)).id);
  // Islands: sponsors flagged island take whole blocks in their preferred hall.
  const islandSponsors = SPONSOR_BOOTHS.filter((s) => s.island);
  const islandBlocks = new Map<number, BoothProfile>();
  for (const sp of islandSponsors) {
    const pool = blocks.filter((b) => !loungeBlocks.has(b.id) && !islandBlocks.has(b.id) && (!sp.hall || b.hall === sp.hall));
    // FabriSight goes nearest the entrance/promenade for visibility.
    pool.sort((a, b) => dist2(center(a.rect), { x: 38, y: 40 }) - dist2(center(b.rect), { x: 38, y: 40 }));
    const pickFrom = sp.special === 'fabrisight' ? pool.slice(0, 1) : pool;
    if (pickFrom.length) islandBlocks.set(rng.pick(pickFrom).id, sp);
  }

  const slots: Slot[] = [];
  for (const blk of blocks) {
    if (loungeBlocks.has(blk.id)) {
      const r = blk.rect;
      map.lounges.push(r);
      for (let y = r.y; y < r.y + r.h; y++) for (let x = r.x; x < r.x + r.w; x++) map.lounge[y * w + x] = 1;
      addFix({ id: `sofa-${blk.id}a`, kind: 'sofa', rect: { x: r.x + 1, y: r.y + 1, w: 3, h: 1 }, solid: true, name: 'Comfy Sofa' });
      addFix({ id: `sofa-${blk.id}b`, kind: 'sofa', rect: { x: r.x + 4, y: r.y + 4, w: 3, h: 1 }, solid: true, name: 'Comfy Sofa' });
      addFix({ id: `charger-${blk.id}`, kind: 'charger', rect: { x: r.x + 6, y: r.y + 1, w: 1, h: 1 }, solid: true, name: 'Charging Station', hall: blk.hall });
      addFix({ id: `plant-${blk.id}`, kind: 'plant', rect: { x: r.x, y: r.y + 4, w: 1, h: 1 }, solid: true, name: 'Plant' });
      continue;
    }
    if (islandBlocks.has(blk.id)) continue; // placed below
    const r = blk.rect;
    for (let i = 0; i < 2; i++) {
      slots.push({ hall: blk.hall, rect: { x: r.x + i * BOOTH_W, y: r.y, w: BOOTH_W, h: BOOTH_H }, facing: 'up', block: blk.id });
      slots.push({ hall: blk.hall, rect: { x: r.x + i * BOOTH_W, y: r.y + BOOTH_H, w: BOOTH_W, h: BOOTH_H }, facing: 'down', block: blk.id });
    }
  }
  // Open up a few random slots as shortcuts/nooks.
  rng.shuffle(slots);
  const openCount = 6;
  const opened = slots.splice(0, openCount);
  for (const s of opened) if (rng.chance(0.5)) addFix({ id: `plant-s${s.rect.x}-${s.rect.y}`, kind: 'plant', rect: { x: s.rect.x + 1, y: s.rect.y + 1, w: 1, h: 1 }, solid: true, name: 'Decorative Ficus' });

  // --- assign booth profiles ---
  const usedNumbers = new Set<string>();
  const makeNumber = (hall: HallId) => {
    let n: string;
    do {
      // The Endless Aisle: numbering is famously non-sequential.
      n = `${hall}-${rng.chance(0.08) ? 1842 + rng.int(0, 7) : rng.int(100, 999)}`;
    } while (usedNumbers.has(n));
    usedNumbers.add(n);
    return n;
  };
  const addBooth = (profile: BoothProfile, rect: Rect, hall: HallId, front: Vec[]) => {
    fill(map, rect, T_BOOTH);
    map.booths.push({
      idx: map.booths.length, profile, rect, hall, front,
      number: makeNumber(hall),
      stock: profile.freebieStock, restock: 0, rel: 0, chats: 0, chatCooldown: 0, salesCooldown: 0,
      discovered: false, visited: false, invited: false, wheelUsed: false, demoDone: false,
    });
  };

  for (const [blkId, sp] of islandBlocks) {
    const blk = blocks[blkId];
    const r = { x: blk.rect.x + 1, y: blk.rect.y + 1, w: 6, h: 4 };
    addBooth(sp, r, blk.hall, ringTiles(r));
  }

  const normalSponsors = SPONSOR_BOOTHS.filter((s) => !s.island);
  const roster = [...BOOTHS];
  const fillerRng = rng.fork(77);
  const takeSlot = (pred: (s: Slot) => boolean) => {
    const i = slots.findIndex(pred);
    return i >= 0 ? slots.splice(i, 1)[0] : slots.shift();
  };
  const frontOf = (s: Slot): Vec[] => {
    const y = s.facing === 'up' ? s.rect.y - 1 : s.rect.y + s.rect.h;
    const out: Vec[] = [];
    for (let x = s.rect.x; x < s.rect.x + s.rect.w; x++) out.push({ x, y });
    return out;
  };
  for (const sp of normalSponsors) {
    const s = takeSlot((sl) => !sp.hall || sl.hall === sp.hall);
    if (s) addBooth(sp, s.rect, s.hall, frontOf(s));
  }
  for (const p of roster) {
    if (!slots.length) break;
    const s = takeSlot((sl) => !p.hall || sl.hall === p.hall);
    if (s) addBooth(p, s.rect, s.hall, frontOf(s));
  }
  let fi = 0;
  while (slots.length) {
    const s = slots.shift()!;
    const name = `${fillerRng.pick(FILLER_PREFIX)} ${fillerRng.pick(FILLER_NOUN)} ${fillerRng.pick(FILLER_SUFFIX)}`;
    const tagline = fillerRng.pick(FILLER_TAGLINES).replace('{n}', String(fillerRng.int(100, 2999)));
    const hue = fillerRng.int(0, 359);
    addBooth({
      id: `filler-${fi++}`, name, category: 'Exhibitor', tagline,
      colors: [`hsl(${hue} 35% 38%)`, '#ffffff'],
      freebie: fillerRng.pick([['pen'], ['brochure', 'pen'], ['candy'], ['keychain', 'pen'], ['sticker'], ['candy', 'brochure']]),
      freebieStock: fillerRng.int(3, 7), restockSec: 40, aggression: fillerRng.range(0.1, 0.8),
    }, s.rect, s.hall, frontOf(s));
  }

  // Salespeople stand in front of pushy booths.
  for (const b of map.booths) {
    if (b.profile.aggression >= 0.65 && b.front.length) {
      const f = b.front[Math.floor(b.front.length / 2)];
      b.salesPos = { x: f.x + 0.5, y: f.y + 0.5 };
    }
  }

  computeReachability(map);
  return map;
}

function ringTiles(r: Rect): Vec[] {
  const out: Vec[] = [];
  for (let x = r.x; x < r.x + r.w; x++) { out.push({ x, y: r.y - 1 }); out.push({ x, y: r.y + r.h }); }
  for (let y = r.y; y < r.y + r.h; y++) { out.push({ x: r.x - 1, y }); out.push({ x: r.x + r.w, y }); }
  return out;
}

export function center(r: Rect): Vec {
  return { x: r.x + r.w / 2, y: r.y + r.h / 2 };
}

function dist2(a: Vec, b: Vec) {
  return (a.x - b.x) ** 2 + (a.y - b.y) ** 2;
}

export function computeReachability(map: ExpoMap) {
  const d = bfs(map, Math.floor(map.spawn.x), Math.floor(map.spawn.y));
  map.walkTiles = [];
  for (let i = 0; i < d.length; i++) {
    map.reachable[i] = d[i] >= 0 ? 1 : 0;
    if (d[i] >= 0) map.walkTiles.push(i);
  }
  // Booth fronts must be reachable; drop unreachable front tiles (and the booth if none remain).
  for (const b of map.booths) b.front = b.front.filter((f) => map.reachable[f.y * map.w + f.x]);
}

/** Breadth-first distance field from a tile; -1 = unreachable. 4-connected. */
export function bfs(map: ExpoMap, sx: number, sy: number): Int16Array {
  const { w, h } = map;
  const dist = new Int16Array(w * h).fill(-1);
  if (isSolid(map, sx, sy)) return dist;
  const q = new Int32Array(w * h);
  let head = 0, tail = 0;
  const s = sy * w + sx;
  dist[s] = 0;
  q[tail++] = s;
  while (head < tail) {
    const i = q[head++];
    const x = i % w, y = (i - x) / w;
    const nd = dist[i] + 1;
    if (x > 0 && dist[i - 1] < 0 && map.tiles[i - 1] === T_FLOOR) { dist[i - 1] = nd; q[tail++] = i - 1; }
    if (x < w - 1 && dist[i + 1] < 0 && map.tiles[i + 1] === T_FLOOR) { dist[i + 1] = nd; q[tail++] = i + 1; }
    if (y > 0 && dist[i - w] < 0 && map.tiles[i - w] === T_FLOOR) { dist[i - w] = nd; q[tail++] = i - w; }
    if (y < h - 1 && dist[i + w] < 0 && map.tiles[i + w] === T_FLOOR) { dist[i + w] = nd; q[tail++] = i + w; }
  }
  return dist;
}

/** Nearest reachable floor tile to a point (used for unstuck + spot validation). */
export function nearestWalkable(map: ExpoMap, x: number, y: number): Vec {
  const tx = Math.floor(x), ty = Math.floor(y);
  for (let r = 0; r < 20; r++) {
    for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
      if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
      const nx = tx + dx, ny = ty + dy;
      if (nx >= 0 && ny >= 0 && nx < map.w && ny < map.h && map.reachable[ny * map.w + nx]) return { x: nx + 0.5, y: ny + 0.5 };
    }
  }
  return { ...map.spawn };
}

/** Distance from point to rect (tile units), 0 if inside. */
export function distToRect(p: Vec, r: Rect): number {
  const dx = Math.max(r.x - p.x, 0, p.x - (r.x + r.w));
  const dy = Math.max(r.y - p.y, 0, p.y - (r.y + r.h));
  return Math.hypot(dx, dy);
}
