import { it } from 'vitest';
import { createGame } from '../systems/game';
import { computeScore, pickTitle, milesWalked } from '../systems/score';
import { runBot } from './bot';

// Not an assertion test: prints a balance table when BALANCE=1.
it.runIf((globalThis as { process?: { env: Record<string, string | undefined> } }).process?.env.BALANCE === '1')('balance report', () => {
  for (let seed = 200; seed < 216; seed++) {
    const s = createGame(seed, 'classic');
    runBot(s, { sprint: seed % 2 === 0, chatty: seed % 3 === 0 });
    const sc = computeScore(s);
    const t = pickTitle(s.stats, sc, s.invites.length, s.player.connections, milesWalked(s));
    console.log(seed, `total=${sc.total} loot=${sc.loot} inf=${sc.influence} surv=${sc.survival} expl=${sc.explored.toFixed(2)} ev=${s.stats.eventsClaimed}/${s.events.length} late=${s.stats.lateArrivals} inv=${s.invites.length} minE=${s.stats.minEnergy.toFixed(0)} E=${s.player.energy.toFixed(0)} M=${s.player.morale.toFixed(0)} miles=${milesWalked(s).toFixed(1)} sales=${s.stats.caughtBySales} spam=${s.stats.spam} | ${t.title}`);
  }
}, 120000);
