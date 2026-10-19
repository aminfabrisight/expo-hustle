# Expo Hustle

> 9 hours. 800 booths. Free beer somewhere. Good luck.

A funny, instantly playable browser arcade game about surviving a giant trade show. Explore a fog-covered expo floor, chase timed free food and swag before the crowd eats it, dodge salespeople, manage energy and bag space, build booth relationships for VIP party invites, and finish with a shareable report card. One round is 4 real minutes (9 AM to 6 PM on the show clock).

## Quick start

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # typecheck + production build into dist/
npm run build:single   # one self-contained HTML file in dist-single/ (easy to host anywhere)
npm test           # deterministic unit + simulation tests (vitest)
```

Node 18+ recommended. No backend, no sign-up, no tracking.

## How to play

| | Desktop | Phone / tablet |
|---|---|---|
| Move | WASD / arrow keys | drag the on-screen stick |
| Sprint (drains energy fast) | hold Shift | hold SPRINT |
| Main action at a booth/event | E / Space | big yellow action button |
| Other actions | 1 – 4 | tap the buttons on the badge card |
| Bag / Journal / Map | I / J / M | tap 🎒 / 🤝 / minimap |
| Pause / cancel | Esc | ❚❚ |

- **Energy** drains as you walk (much faster when sprinting). Rest in a green **lounge**, eat, or drink coffee. At zero you slow down but never stop.
- **Morale** slowly drains; snacks, swag, selfies and parties raise it; demos and empty trays lower it.
- **Bag**: swag takes slots (6 by default; tote bags and backpacks add more). Food is eaten on the spot. Only swag still in your bag at 6 PM counts. A full bag offers a swap.
- **Timed events** appear all day. Nearby or already-discovered spots announce themselves; far ones arrive as rumors in the ticker ("somewhere in Hall C"). Crowds of NPCs rush them and eat the stock.
- **Networking**: "Chat & network" at a booth raises its relationship by 20% (takes a few seconds; moving cancels). After two chats the booth needs a break, so you have to come back. At 100% you get a **VIP invite** if they host a party (max 2), otherwise an Actual Business Lead. Gossipy attendees 💬 and the info desk reveal which booths host parties.
- **Hazards**: salespeople in suits wave when you get close; step into their dashed circle and they pitch you. Badge scanners chase you with chocolate. Too much coffee means a restroom detour.

Score = **Loot** (swag + snacks) + **Influence** (connections, leads, party invites) + **Survival** (energy, morale, escapes) + **Exploration** (floor revealed, secrets found).

## What's in the game

- Seeded procedural floor: 4 themed halls, 68 booths (40 hand-written fictional exhibitors, 3 sample sponsors incl. FabriSight, procedural filler), lounges, coffee kiosks, info desk, restrooms, fountains, chargers, a cross-hall shuttle and a VIP lounge.
- Fog of war with soft edges; explored areas stay dimly visible, but goodies are only shown where you can currently see.
- ~70 wandering NPCs (more at lunch) with flow-field pathfinding, crowd slow-down, emotes, rumor-spreaders.
- Event director scheduling roughly 10–15 surprises per round on a deliberate day curve (the closing frenzy hits three booths at once): Great Charcuterie Dash (with Cheese Betrayal crackers), Free Beer Stampede (beer or mocktail), Swag Drop, Lunch Mirage, Pizza Drop, Espresso Cart, Badge Scanner Ambush, Incognito CEO, Booth Celebrity, Fake VIP Lounge, Demo Blitz, Last 30-Minute Frenzy, plus a Last Day Gold Rush run modifier, salesperson traps, the expo shuttle and non-sequential booth numbering (the Endless Aisle).
- Five archetypes, prize-wheel timing mini-game, relationship journal, 12 ending titles, 16 achievements, local best score, Web Share / copy-to-clipboard.
- First-run playable tutorial (move, grab coffee, sprint, chase a timed charcuterie dash).
- Procedural WebAudio sound effects, reduced-motion mode, pause on tab blur, keyboard + touch controls.

## Project layout

```
src/
  app/          React shell (App.tsx state machine: title → playing → party → results), styles, storage
  components/   HUD, badge cards, dialogs, panels (bag/journal/map/pause), touch controls, screens
  game/         renderer.ts (Canvas 2D), engine.ts (frame loop), input.ts, audio.ts
  systems/      pure simulation: rng, config, map, npc, director (events), game (rules), inventory, score
  content/      data: booths, items, events, jokes/ticker, archetypes, sponsors.json
  assets/       asset abstraction (emoji/procedural today)
  tests/        vitest: systems, every event kind, autopilot full rounds, optional balance report
```

The simulation in `systems/` has no DOM access: it's deterministic for a given seed and input stream, which is what the tests rely on. Rendering only reads state. Run `BALANCE=1 npx vitest run src/tests/balance.test.ts` to print a balance table from autopilot rounds.

## Customizing

- **Pacing & tuning**: `src/systems/config.ts` (round length, speeds, drain rates, chat length, sales cooldowns, NPC counts).
- **Booths**: `src/content/booths.ts`. Add entries; the map places sponsors first, then these, then procedural filler.
- **Items / rewards**: `src/content/items.ts`. **Events & copy**: `src/content/events.ts` (+ the day plan in `systems/director.ts`). **Jokes & ticker**: `src/content/jokes.ts`. **Titles & achievements**: `src/systems/score.ts`.
- **Sponsors**: `src/content/sponsors.json`. Fields: `id`, `displayName`, `hall`, `island`, `colors`, `tagline`, `description`, `url` (https only, opened only when a player clicks "Learn more"), `logoUrl` (official asset only), `freebie`, `freebieStock` (capped at 8 so sponsors can't buy better odds), `party`, `wheel`, `label`. Everything is validated and sanitized in `sponsors.ts`. Sponsor booths are labeled "Sponsored" on the floor and on their card.
- **FabriSight**: the booth uses plain-text branding (no logo invented). Interacting turns on "Crowd Vision" for 8 seconds: a fictional heat map and detection boxes over the in-game crowd, labeled as simulated. Add an official logo URL and a site link in `sponsors.json` if wanted.
- **Art**: all visuals are procedural canvas drawings and emoji. `src/assets/assets.ts` is the swap point for item icons; characters, booths and fixtures live in `renderer.ts` methods (`person`, `drawBooth`, `drawFixture`) so they can be replaced with sprites one at a time.

## Privacy & fairness

No accounts, analytics, ads or network calls beyond Google Fonts. Badge scans, crowd analytics, rumors and ticker messages are all simulated game content. Settings, best score and achievements live in your browser's localStorage only.

## Known limitations / deferred (M4)

- The after-hours VIP party is a celebratory interstitial with bonus points, not a playable level yet.
- Leaderboards are local only (no backend adapter yet); no live/multiplayer events.
- Phone battery, daily challenges, friends' hints and custom expo maps are not implemented. Bathrooms exist via the coffee bladder meter.
- The shareable report card is text (Web Share / clipboard), not a generated PNG.
- Emoji rendering depends on the device's emoji font.
- `?debug` in the URL exposes `window.__expo` (live game state) for automated smoke tests.
