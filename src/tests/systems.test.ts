import { describe, expect, it } from 'vitest';
import { RNG } from '../systems/rng';
import { generateMap, bfs, T_FLOOR } from '../systems/map';
import { createGame, step, give, computeContext, doAction, resolveDialog, playerSpeed } from '../systems/game';
import { NO_INPUT, type Input } from '../systems/state';
import { CONFIG } from '../systems/config';
import { addItem, capacity, createInventory, freeSlots, removeItem, cheapestToDrop } from '../systems/inventory';
import { item } from '../content/items';
import { computeScore, pickTitle } from '../systems/score';
import { parseSponsors, sanitizeUrl } from '../content/sponsors';
import { runBot } from './bot';

const idle = (s: ReturnType<typeof createGame>, seconds: number, input: Input = NO_INPUT) => {
  for (let t = 0; t < seconds; t += 0.05) step(s, 0.05, input);
};

describe('seeded RNG', () => {
  it('is deterministic', () => {
    const a = new RNG(42), b = new RNG(42);
    for (let i = 0; i < 50; i++) expect(a.next()).toBe(b.next());
  });
  it('different seeds diverge', () => {
    expect(new RNG(1).next()).not.toBe(new RNG(2).next());
  });
});

describe('map generation & reachability', () => {
  for (const seed of [1, 7, 99, 12345, 2026]) {
    it(`seed ${seed}: 30+ booths, all reachable from the entrance`, () => {
      const map = generateMap(new RNG(seed));
      expect(map.booths.length).toBeGreaterThanOrEqual(30);
      const d = bfs(map, Math.floor(map.spawn.x), Math.floor(map.spawn.y));
      for (const b of map.booths) {
        expect(b.front.length, b.profile.name).toBeGreaterThan(0);
        for (const f of b.front) expect(d[f.y * map.w + f.x]).toBeGreaterThanOrEqual(0);
      }
      // Every interactive fixture has at least one reachable neighbouring tile.
      for (const f of map.fixtures.filter((f) => !['plant', 'sofa'].includes(f.kind))) {
        let ok = false;
        for (let y = f.rect.y - 1; y <= f.rect.y + f.rect.h; y++)
          for (let x = f.rect.x - 1; x <= f.rect.x + f.rect.w; x++)
            if (map.tiles[y * map.w + x] === T_FLOOR && d[y * map.w + x] >= 0) ok = true;
        expect(ok, f.name).toBe(true);
      }
      // Sponsors + FabriSight are placed.
      expect(map.booths.some((b) => b.profile.special === 'fabrisight')).toBe(true);
      expect(map.booths.filter((b) => b.profile.sponsor).length).toBeGreaterThanOrEqual(2);
    });
  }
});

describe('event director', () => {
  it('same seed => identical schedule; different seed => different', () => {
    const sig = (seed: number) => createGame(seed).events.map((e) => `${e.kind}@${e.at.toFixed(2)}#${e.boothIdx}`).join('|');
    expect(sig(5)).toBe(sig(5));
    expect(sig(5)).not.toBe(sig(6));
  });
  it('schedules 8-20 events at reachable spots with 8+ distinct kinds across seeds', () => {
    const kinds = new Set<string>();
    for (const seed of [3, 4, 5, 6]) {
      const s = createGame(seed);
      expect(s.events.length).toBeGreaterThanOrEqual(8);
      expect(s.events.length).toBeLessThanOrEqual(20);
      for (const e of s.events) {
        kinds.add(e.kind);
        expect(s.map.reachable[Math.floor(e.spot.y) * s.map.w + Math.floor(e.spot.x)]).toBe(1);
      }
    }
    expect(kinds.size).toBeGreaterThanOrEqual(8);
  });
  it('events activate, expire, and never linger past their TTL', () => {
    const s = createGame(11);
    const first = [...s.events].sort((a, b) => a.at - b.at)[0];
    idle(s, first.at + 0.2);
    expect(['active', 'leftovers']).toContain(first.state);
    idle(s, first.ttl + 0.5);
    expect(first.state).toBe('ended');
  });
  it('NPC crowds consume limited stock', () => {
    let consumed = 0;
    for (const seed of [21, 22, 23]) {
      const s = createGame(seed);
      const e = s.events.find((ev) => ev.kind === 'charcuterie')!;
      idle(s, e.at + e.ttl - 1);
      consumed += e.maxStock - Math.max(0, e.stock);
    }
    expect(consumed).toBeGreaterThan(0);
  });
});

describe('time', () => {
  it('a round ends cleanly at 6 PM', () => {
    const s = createGame(8);
    idle(s, CONFIG.roundSeconds + 1);
    expect(s.phase).toBe('ended');
    expect(s.endReason).toBe('time');
  });
});

describe('energy', () => {
  it('walking drains, sprinting drains faster, resting recovers, never locks movement', () => {
    const walk = createGame(30);
    const sprint = createGame(30);
    const left: Input = { ...NO_INPUT, mx: -1 };
    idle(walk, 3, { ...left, my: -1 });
    idle(sprint, 3, { ...left, my: -1, sprint: true });
    expect(walk.player.energy).toBeLessThan(walk.player.maxEnergy);
    expect(sprint.player.energy).toBeLessThan(walk.player.energy);

    const s = createGame(31);
    s.player.energy = 0;
    expect(playerSpeed(s, false)).toBeGreaterThan(1);
    const l = s.map.lounges[0];
    s.player.x = l.x + 7.5; s.player.y = l.y + 3.5; // open corner of the lounge
    idle(s, 2);
    expect(s.player.resting).toBe(true);
    expect(s.player.energy).toBeGreaterThan(10);
  });
  it('food restores energy', () => {
    const s = createGame(32);
    s.player.energy = 20;
    give(s, 'pizza');
    expect(s.player.energy).toBe(20 + (item('pizza').energy ?? 0));
  });
});

describe('inventory', () => {
  it('enforces capacity, tote bags add slots, discard works', () => {
    const inv = createInventory(6);
    for (let i = 0; i < 6; i++) expect(addItem(inv, 'pen')).toBe(true);
    expect(addItem(inv, 'pen')).toBe(false);
    expect(addItem(inv, 'tote')).toBe(true); // 0 slots, +1 capacity
    expect(capacity(inv)).toBe(7);
    expect(addItem(inv, 'pen')).toBe(true);
    const tote = inv.items.find((i) => i.id === 'tote')!;
    expect(removeItem(inv, tote.uid)).toBeNull(); // can't drop the bag while it's holding stuff
    const pen = inv.items.find((i) => i.id === 'pen')!;
    expect(removeItem(inv, pen.uid)).not.toBeNull();
    expect(freeSlots(inv)).toBe(1);
    const drop = cheapestToDrop(inv, item('headphones'))!;
    expect(drop.length).toBe(1);
    expect(item(drop[0].id).id).toBe('pen');
  });
  it('full bag opens a swap prompt instead of silently losing loot', () => {
    const s = createGame(40);
    for (let i = 0; i < 6; i++) give(s, 'pen');
    expect(give(s, 'headphones')).toBe(false);
    expect(s.dialog?.kind).toBe('swap');
    resolveDialog(s, 'swap');
    expect(s.inv.items.some((i) => i.id === 'headphones')).toBe(true);
  });
});

describe('relationships & VIP', () => {
  function chatUntilDone(s: ReturnType<typeof createGame>, boothIdx: number) {
    const b = s.map.booths[boothIdx];
    const f = b.front[0];
    for (let i = 0; i < 12 && b.rel < 100; i++) {
      s.player.x = f.x + 0.5; s.player.y = f.y + 0.5;
      b.chatCooldown = 0; b.salesCooldown = 999;
      s.dialog = null;
      const ctx = computeContext(s) ?? { title: '', subtitle: '', icon: '', actions: [], targetType: 'booth' as const, ref: b.idx };
      doAction(s, { ...ctx, targetType: 'booth', ref: b.idx }, 'chat');
      idle(s, CONFIG.interact.chatSec + 0.3);
    }
  }
  it('party booth at 100% grants an invite; non-party booth grants a lead', () => {
    const s = createGame(50);
    s.elapsed = 1; // avoid salesperson grace mechanics interfering
    const host = s.map.booths.find((b) => b.profile.party === 'mixer')!;
    chatUntilDone(s, host.idx);
    expect(host.rel).toBe(100);
    expect(s.invites.length).toBe(1);
    const plain = s.map.booths.find((b) => !b.profile.party && b.profile.aggression < 0.6)!;
    chatUntilDone(s, plain.idx);
    expect(s.stats.leads).toBe(1);
  });
  it('relationship needs repeat visits (cooldown after 2 chats)', () => {
    const s = createGame(51);
    const b = s.map.booths.find((b) => b.profile.party)!;
    const f = b.front[0];
    for (let i = 0; i < 2; i++) {
      s.player.x = f.x + 0.5; s.player.y = f.y + 0.5;
      b.salesCooldown = 999;
      doAction(s, { ...computeContext(s)!, targetType: 'booth', ref: b.idx }, 'chat');
      idle(s, CONFIG.interact.chatSec + 0.3);
    }
    expect(b.chatCooldown).toBeGreaterThan(0);
  });
  it('invites are capped', () => {
    const s = createGame(52);
    const hosts = s.map.booths.filter((b) => b.profile.party);
    expect(hosts.length).toBeGreaterThanOrEqual(3);
    for (const h of hosts) chatUntilDone(s, h.idx);
    expect(s.invites.length).toBe(CONFIG.maxInvites);
  });
});

describe('scoring', () => {
  it('score grows with loot and invites; titles resolve', () => {
    const s = createGame(60);
    const base = computeScore(s).total;
    give(s, 'charcuterie');
    give(s, 'headphones');
    const more = computeScore(s);
    expect(more.total).toBeGreaterThan(base);
    expect(more.loot).toBe(Math.round((15 + 35) * 10 * (s.goldRush ? 1.2 : 1)));
    s.invites.push({ boothIdx: 0, tier: 'rooftop', host: 'x' });
    expect(computeScore(s).influence).toBeGreaterThan(more.influence);
    const t = pickTitle(s.stats, computeScore(s), 1, 0, 1);
    expect(t.title.length).toBeGreaterThan(3);
  });
});

describe('sponsor config', () => {
  it('rejects unsafe URLs and bad entries', () => {
    expect(sanitizeUrl('javascript:alert(1)')).toBeUndefined();
    expect(sanitizeUrl('http://example.com')).toBeUndefined();
    expect(sanitizeUrl('https://example.com/x')).toBe('https://example.com/x');
    const out = parseSponsors({ sponsors: [{ id: 'ok', displayName: 'Ok<script>', colors: ['red'], freebie: ['nope'], freebieStock: 999 }, { id: '' }] });
    expect(out.length).toBe(1);
    expect(out[0].name).toBe('Okscript');
    expect(out[0].freebie).toEqual(['pen']);
    expect(out[0].freebieStock).toBeLessThanOrEqual(8);
  });
});

describe('full rounds (autopilot)', () => {
  it('bots complete rounds on many seeds without errors and with sane outcomes', () => {
    const results: number[] = [];
    let claimed = 0;
    for (let seed = 100; seed < 112; seed++) {
      const s = createGame(seed, seed % 2 ? 'classic' : 'swag', { tutorial: seed % 3 === 0 });
      runBot(s, { sprint: seed % 2 === 0, chatty: seed % 4 === 0 });
      expect(s.phase).toBe('ended');
      expect(Number.isFinite(computeScore(s).total)).toBe(true);
      expect(s.player.energy).toBeGreaterThanOrEqual(0);
      results.push(computeScore(s).total);
      claimed += s.stats.eventsClaimed;
    }
    expect(Math.max(...results)).toBeGreaterThan(300);
    expect(claimed).toBeGreaterThan(3);
  });
});
