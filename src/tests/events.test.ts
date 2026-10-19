import { describe, expect, it } from 'vitest';
import { EVENTS } from '../content/events';
import { computeContext, createGame, doAction, step } from '../systems/game';
import { NO_INPUT, type GameState } from '../systems/state';
import type { EventKind } from '../systems/types';

/** Re-purpose the first booth event in the schedule as `kind`, spawning right now. */
function forceEvent(s: GameState, kind: EventKind) {
  const e = s.events.find((ev) => ev.boothIdx >= 0)!;
  const def = EVENTS[kind];
  Object.assign(e, { kind, def, at: s.elapsed + 0.01, ttl: 40, remaining: 40, stock: 10, maxStock: 10, state: 'scheduled', known: 'none', playerClaimed: false });
  if (kind === 'ceo' || kind === 'scanner') e.boothIdx = -1;
  s.events = [e];
  return e;
}

function run(s: GameState, sec: number) {
  for (let t = 0; t < sec; t += 0.05) step(s, 0.05, NO_INPUT);
}

function standAt(s: GameState, x: number, y: number) {
  s.player.x = x;
  s.player.y = y;
  for (const b of s.map.booths) b.salesCooldown = 999; // keep salespeople out of these tests
}

describe('each event kind works end-to-end', () => {
  const claimable: [EventKind, (s: GameState) => boolean][] = [
    ['charcuterie', (s) => s.stats.charcuterie === 1],
    ['beer', (s) => s.stats.drinks >= 1 && s.player.connections >= 4],
    ['swagdrop', (s) => s.stats.premium === 1 || s.dialog?.kind === 'swap'],
    ['lunch', (s) => s.stats.foods >= 1 || s.stats.lateArrivals === 1],
    ['pizza', (s) => s.stats.foods >= 1],
    ['espresso', (s) => s.stats.coffees === 1],
    ['celebrity', (s) => s.stats.selfies === 1],
    ['frenzy', (s) => s.stats.eventsClaimed === 1],
  ];
  for (const [kind, ok] of claimable) {
    it(`${kind}: spawns, can be claimed, then expires`, () => {
      const s = createGame(900 + kind.length);
      s.elapsed = 30;
      const e = forceEvent(s, kind);
      run(s, 0.2);
      // (a Lunch Mirage can legitimately spawn as an empty tray)
      expect(kind === 'lunch' ? ['active', 'leftovers'] : ['active']).toContain(e.state);
      standAt(s, e.spot.x + 0.4, e.spot.y);
      run(s, 0.1);
      const ctx = computeContext(s)!;
      expect(ctx.targetType).toBe('event');
      doAction(s, ctx, 'claim');
      run(s, 6);
      expect(ok(s), `${kind} reward`).toBe(true);
      run(s, 45);
      expect(e.state).toBe('ended');
    });
  }

  it('late arrival to charcuterie gets crackers (cheese betrayal)', () => {
    const s = createGame(950);
    s.elapsed = 30;
    const e = forceEvent(s, 'charcuterie');
    run(s, 0.2);
    e.stock = 0;
    run(s, 0.1);
    expect(e.state).toBe('leftovers');
    standAt(s, e.spot.x + 0.4, e.spot.y);
    run(s, 0.1);
    doAction(s, computeContext(s)!, 'claim');
    run(s, 2);
    expect(s.stats.crackers).toBe(1);
  });

  it('fake VIP lounge turns out to be a demo', () => {
    const s = createGame(951);
    s.elapsed = 30;
    const e = forceEvent(s, 'fakevip');
    run(s, 0.2);
    standAt(s, e.spot.x + 0.4, e.spot.y);
    run(s, 0.1);
    doAction(s, computeContext(s)!, 'fakevip');
    run(s, 5);
    expect(s.stats.fakeVip).toBe(1);
    expect(s.inv.items.some((i) => i.id === 'brochure')).toBe(true);
  });

  it('incognito CEO can be found and talked to', () => {
    const s = createGame(952);
    s.elapsed = 30;
    const e = forceEvent(s, 'ceo');
    run(s, 0.2);
    const ceo = s.npcs.find((n) => n.kind === 'ceo')!;
    expect(ceo).toBeTruthy();
    standAt(s, ceo.x, ceo.y);
    ceo.speed = 0;
    run(s, 0.05);
    const ctx = computeContext(s)!;
    expect(ctx.targetType).toBe('npc');
    doAction(s, ctx, 'ceo');
    run(s, 5);
    expect(s.stats.ceoMet).toBe(true);
    expect(s.invites.length + s.inv.items.filter((i) => i.id === 'card').length).toBeGreaterThan(0);
    void e;
  });

  it('badge scanner ambush triggers a skippable choice', () => {
    const s = createGame(953);
    s.elapsed = 30;
    forceEvent(s, 'scanner');
    run(s, 0.2);
    const sc = s.npcs.find((n) => n.kind === 'scanner')!;
    sc.scanCooldown = 0;
    standAt(s, sc.x, sc.y);
    run(s, 0.1);
    expect(s.dialog?.kind).toBe('scanner');
    step(s, 0.05, { ...NO_INPUT, action: 0 });
    expect(s.stats.spam).toBe(1);
  });

  it('salesperson trap offers escape options and never locks the player', () => {
    const s = createGame(954);
    s.elapsed = 30;
    const b = s.map.booths.find((b) => b.salesPos)!;
    b.profile = { ...b.profile, aggression: 1 };
    s.player.x = b.salesPos!.x; s.player.y = b.salesPos!.y;
    run(s, 0.1);
    expect(s.dialog?.kind).toBe('sales');
    expect(s.dialog!.options.length).toBe(3);
    step(s, 0.05, { ...NO_INPUT, action: 2 }); // point and run
    expect(s.dialog).toBeNull();
    expect(s.stats.escapes).toBe(1);
  });

  it('shuttle moves you across the hall', () => {
    const s = createGame(955);
    s.elapsed = 30;
    const f = s.map.fixtures.find((f) => f.id === 'shuttle-sw')!;
    standAt(s, f.rect.x + 1, f.rect.y - 0.5);
    run(s, 0.05);
    const ctx = computeContext(s)!;
    doAction(s, ctx, 'shuttle');
    run(s, 3);
    expect(s.player.x).toBeGreaterThan(60);
    expect(s.stats.shuttleRides).toBe(1);
  });
});
