import { CONFIG } from '../systems/config';
import { activeEvents } from '../systems/director';
import { step } from '../systems/game';
import { fieldFor } from '../systems/npc';
import type { GameState, Input } from '../systems/state';

/**
 * A simple autopilot used by tests to play full rounds headlessly.
 * Strategy: chase known events, otherwise visit booths (grab + chat), rest when tired.
 */
export function runBot(s: GameState, opts: { sprint?: boolean; chatty?: boolean; dt?: number } = {}) {
  const dt = opts.dt ?? 1 / 30;
  let target = -1;
  let guard = 0;
  let pressCooldown = 0;
  while (s.phase === 'playing' && guard++ < 100000) {
    const input: Input = { mx: 0, my: 0, sprint: false, interact: false, action: null, cancel: false };
    pressCooldown -= dt;
    if (s.dialog) {
      input.action = s.dialog.kind === 'swap' ? 0 : s.dialog.options.length - 1;
    } else if (s.channel) {
      if (s.channel.kind === 'wheel' && Math.abs(s.channel.data ?? 1) < 0.2) input.interact = true;
    } else {
      const p = s.player;
      const ctx = s.context;
      if (ctx && pressCooldown <= 0) {
        // Prefer chatting on party-ish booths if chatty, else first enabled action.
        const idx = ctx.actions.findIndex((a) => a.enabled && (opts.chatty ? a.id === 'chat' || a.id === 'claim' : a.id !== 'chat' && a.id !== 'demo'));
        if (idx >= 0) { input.action = idx; pressCooldown = 0.3; }
      }
      if (input.action === null) {
        const ev = activeEvents(s).filter((e) => e.known === 'exact' && !e.playerClaimed && e.boothIdx >= 0 && e.kind !== 'fakevip');
        let goal = -1;
        if (p.energy < 20 && s.map.lounges.length) {
          const l = s.map.lounges[0];
          goal = (l.y + 3) * s.map.w + l.x + 7;
        } else if (ev.length) {
          const e = ev[0];
          goal = Math.floor(e.spot.y) * s.map.w + Math.floor(e.spot.x);
        } else {
          if (target < 0 || reached(s, target)) {
            const b = s.map.booths[s.rng.int(0, s.map.booths.length - 1)];
            const f = b.front[0];
            target = f ? f.y * s.map.w + f.x : -1;
          }
          goal = target;
        }
        if (goal >= 0 && !reached(s, goal)) {
          const f = fieldFor(s.map, goal);
          const ti = Math.floor(p.y) * s.map.w + Math.floor(p.x);
          const cur = f[ti];
          let best = ti;
          for (const n of [ti - 1, ti + 1, ti - s.map.w, ti + s.map.w]) if (f[n] >= 0 && f[n] < f[best]) best = n;
          if (cur < 0) best = goal;
          const tx = (best % s.map.w) + 0.5, ty = Math.floor(best / s.map.w) + 0.5;
          input.mx = tx - p.x; input.my = ty - p.y;
          const l = Math.hypot(input.mx, input.my) || 1;
          input.mx /= l; input.my /= l;
          input.sprint = !!opts.sprint && p.energy > 40;
        }
      }
    }
    step(s, dt, input);
  }
  return guard;
}

function reached(s: GameState, tile: number) {
  const x = (tile % s.map.w) + 0.5, y = Math.floor(tile / s.map.w) + 0.5;
  return Math.hypot(s.player.x - x, s.player.y - y) < 0.8;
}

export const ROUND_STEPS = Math.ceil(CONFIG.roundSeconds * 30);
