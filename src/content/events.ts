import type { EventDef, EventKind } from '../systems/types';

/** Event catalog. Copy supports {hall} and {booth} placeholders. */
export const EVENTS: Record<EventKind, EventDef> = {
  charcuterie: {
    kind: 'charcuterie', title: 'Great Charcuterie Dash', icon: '🧀', ttl: [24, 32], stock: [6, 9], attract: 0.35,
    rumors: ['Rumor: {hall} has charcuterie. It might already be gone.', 'Someone in {hall} is carrying a suspiciously large cheese board.'],
    announce: ['CHARCUTERIE at {booth}! The prosciutto will not last.', 'Cheese board deployed at {booth}. Godspeed.'],
    late: ['Crackers. Again.', 'Only a single grape remains. It judges you.'],
  },
  beer: {
    kind: 'beer', title: 'Free Beer Stampede', icon: '🍺', ttl: [20, 30], stock: [10, 14], attract: 0.5,
    rumors: ['Happy hour whispers coming from {hall}.', 'Someone heard a keg tap in {hall}. Mocktails too, apparently.'],
    announce: ['HAPPY HOUR at {booth}! Beer and mocktails, first come first served.', 'The tap is open at {booth}. The stampede has begun.'],
    late: ['The tap wheezes. Empty.', 'You arrive to a sad foam puddle.'],
  },
  swagdrop: {
    kind: 'swagdrop', title: 'Swag Drop', icon: '🎁', ttl: [26, 34], stock: [5, 7], attract: 0.3,
    rumors: ['A pallet of premium swag was spotted heading to {hall}.'],
    announce: ['SWAG DROP at {booth}! Premium stuff, very limited.', '{booth} is throwing headphones into the crowd. Allegedly.'],
    late: ['All gone. Someone got three.', 'Swag drop over. Here is a pen as consolation.'],
  },
  lunch: {
    kind: 'lunch', title: 'Lunch Mirage', icon: '🍕', ttl: [22, 30], stock: [5, 8], attract: 0.3,
    rumors: ['Rumor: free pizza in {hall}! (Rumors are 60% accurate.)', 'A delivery guy with 12 pizza boxes was seen near {hall}.'],
    announce: ['Free lunch at {booth}! Allegedly.', 'Pizza boxes stacked at {booth}. Are they full though?'],
    late: ['An empty tray. A single olive. Despair.'],
  },
  pizza: {
    kind: 'pizza', title: 'Pizza Drop', icon: '🍕', ttl: [22, 28], stock: [6, 9], attract: 0.35,
    rumors: ['The smell of pepperoni drifts out of {hall}.'],
    announce: ['HOT PIZZA at {booth}. Not a drill.'],
    late: ['Just crusts. Somebody ate the middles.'],
  },
  espresso: {
    kind: 'espresso', title: 'Espresso Cart', icon: '☕', ttl: [22, 30], stock: [6, 10], attract: 0.2,
    rumors: ['A barista with a cart is rolling through {hall}.'],
    announce: ['Espresso cart at {booth}! Triple shots for everyone.'],
    late: ['The barista has rolled away into legend.'],
  },
  scanner: {
    kind: 'scanner', title: 'Badge Scanner Ambush', icon: '📟', ttl: [35, 45], stock: [99, 99], attract: 0,
    rumors: ['Warning: a badge scanner with a chocolate bowl is prowling {hall}.'],
    announce: ['A badge scanner is roaming {hall}. They have chocolate. And your inbox.'],
    late: ['The scanner has found someone else.'],
  },
  ceo: {
    kind: 'ceo', title: 'Incognito CEO', icon: '🕶️', ttl: [45, 55], stock: [1, 1], attract: 0,
    rumors: ['Someone in a hoodie in {hall} is definitely a billionaire.', 'A CEO is wandering {hall} pretending to be a normal attendee.'],
    announce: ['An incognito CEO is wandering {hall}. Find the hoodie.'],
    late: ['The CEO left for a "quick call" on a yacht.'],
  },
  celebrity: {
    kind: 'celebrity', title: 'Booth Celebrity', icon: '⭐', ttl: [28, 36], stock: [7, 10], attract: 0.4,
    rumors: ['The Reality TV Forklift Champion is signing autographs in {hall}!'],
    announce: ['CELEBRITY at {booth}: the Reality TV Forklift Champion! Selfies!'],
    late: ['The celebrity has left. Their cardboard cutout remains.'],
  },
  fakevip: {
    kind: 'fakevip', title: 'Exclusive VIP Lounge', icon: '🥂', ttl: [28, 36], stock: [99, 99], attract: 0.15,
    rumors: ['Psst. Exclusive VIP lounge opening at {hall}. Very exclusive. Probably.'],
    announce: ['EXCLUSIVE VIP LOUNGE at {booth}! Totally a party! Come now!'],
    late: ['The "lounge" has packed up its PowerPoint.'],
  },
  frenzy: {
    kind: 'frenzy', title: 'Last 30-Minute Frenzy', icon: '📦', ttl: [16, 22], stock: [3, 5], attract: 0.25,
    rumors: ['Booths in {hall} are dumping leftovers before closing!'],
    announce: ['{booth} is giving away EVERYTHING before closing!'],
    late: ['Packed up. Even the carpet is gone.'],
  },
  demoblitz: {
    kind: 'demoblitz', title: 'Demo Blitz', icon: '📢', ttl: [30, 30], stock: [99, 99], attract: 0,
    rumors: ['Sales quotas are due. Every salesperson in {hall} is feeling bold.'],
    announce: ['DEMO BLITZ in {hall}! Salespeople are extra aggressive. Watch your step.'],
    late: [],
  },
};

/** What each event hands out on a successful claim. */
export const EVENT_REWARD: Partial<Record<EventKind, string[]>> = {
  charcuterie: ['charcuterie'],
  beer: ['beer'],
  swagdrop: ['headphones', 'backpack', 'drone', 'powerbank'],
  lunch: ['pizza', 'coldpizza', 'coldpizza'],
  pizza: ['pizza'],
  espresso: ['espresso'],
  celebrity: [],
  frenzy: ['display', 'plushie', 'tshirt', 'socks', 'chicken', 'sandwich'],
};
