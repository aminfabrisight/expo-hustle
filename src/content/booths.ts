import type { BoothProfile, HallId } from '../systems/types';

/**
 * Hand-written booth roster (all fictional). The map generator places sponsors first,
 * then these, then fills remaining slots with procedurally named booths.
 * Schema supports any count; the map has ~60 slots today.
 */
export const HALLS: Record<HallId, { name: string; color: string; carpet: string }> = {
  A: { name: 'Hall A · Automation & Robotics', color: '#2f6fd6', carpet: '#3b5f9e' },
  B: { name: 'Hall B · Food & Packaging', color: '#d6452f', carpet: '#9e4a3b' },
  C: { name: 'Hall C · Software & Data', color: '#1f9e6e', carpet: '#2f7d63' },
  D: { name: 'Hall D · Industrial Oddities', color: '#9a52c9', carpet: '#6e4a92' },
};

const b = (p: Omit<BoothProfile, 'freebieStock' | 'restockSec'> & Partial<BoothProfile>): BoothProfile => ({
  freebieStock: 6,
  restockSec: 30,
  ...p,
});

export const BOOTHS: BoothProfile[] = [
  // Hall A — Automation & Robotics
  b({ id: 'robodyne', name: 'RoboDyne', category: 'Robotics', hall: 'A', tagline: 'Arms that never get tired. Unlike you.', colors: ['#1d3557', '#f1faee'], freebie: ['plushie', 'sticker'], freebieStock: 3, restockSec: 50, aggression: 0.3, party: 'mixer', demoSwag: 'powerbank' }),
  b({ id: 'gripzilla', name: 'Gripzilla', category: 'End Effectors', hall: 'A', tagline: 'We grab things. Professionally.', colors: ['#ffb703', '#1d1d1d'], freebie: ['stressball', 'pen'], aggression: 0.7, demoSwag: 'tshirt' }),
  b({ id: 'conveyorama', name: 'Conveyorama', category: 'Conveyors', hall: 'A', tagline: 'Moving things since 1987.', colors: ['#264653', '#e9c46a'], freebie: ['keychain', 'pen'], aggression: 0.5 }),
  b({ id: 'servoworld', name: 'ServoWorld', category: 'Motion Control', hall: 'A', tagline: 'Precision to the micron. Coffee to the brim.', colors: ['#3a0ca3', '#f8f9fa'], freebie: ['coffee', 'cookie'], freebieStock: 8, restockSec: 25, aggression: 0.2 }),
  b({ id: 'palletpal', name: 'PalletPal', category: 'Palletizing', hall: 'A', tagline: 'Stack it like you mean it.', colors: ['#e76f51', '#fff'], freebie: ['candy', 'pen'], freebieStock: 10, aggression: 0.4 }),
  b({ id: 'cobotcafe', name: 'Cobot Café', category: 'Collaborative Robots', hall: 'A', tagline: 'A robot made this latte. Be nice to it.', colors: ['#6a4c93', '#fff'], freebie: ['coffee'], freebieStock: 6, restockSec: 20, aggression: 0.2, wheel: true }),
  b({ id: 'agvexpress', name: 'AGV Express', category: 'Autonomous Vehicles', hall: 'A', tagline: 'Our carts drive better than your cousin.', colors: ['#2a9d8f', '#fff'], freebie: ['sticker', 'candy'], aggression: 0.6, demoSwag: 'bottle' }),
  b({ id: 'torqueking', name: 'Torque King', category: 'Fastening', hall: 'A', tagline: 'Twist responsibly.', colors: ['#c1121f', '#fdf0d5'], freebie: ['keychain'], aggression: 0.85, demoSwag: 'hardhat' }),
  b({ id: 'visionbot', name: 'VisionBot 3000', category: 'Machine Vision', hall: 'A', tagline: 'Sees everything. Judges silently.', colors: ['#0b132b', '#5bc0be'], freebie: ['sticker', 'pen'], aggression: 0.5 }),
  b({ id: 'weldwizards', name: 'Weld Wizards', category: 'Welding', hall: 'A', tagline: 'Sparks fly. Lawsuits do not.', colors: ['#ff7b00', '#1b1b1b'], freebie: ['hardhat', 'pen'], freebieStock: 3, restockSec: 60, aggression: 0.55 }),

  // Hall B — Food & Packaging
  b({ id: 'wrapstar', name: 'WrapStar', category: 'Stretch Wrap', hall: 'B', tagline: 'Wrapped like a mummy. Shipped like a king.', colors: ['#ef476f', '#fff'], freebie: ['candy', 'stressball'], aggression: 0.6 }),
  b({ id: 'cheesetech', name: 'CheeseTech', category: 'Dairy Processing', hall: 'B', tagline: 'Cutting-edge cheese cutting.', colors: ['#ffd166', '#5a3e00'], freebie: ['cookie', 'candy'], freebieStock: 8, restockSec: 20, aggression: 0.3, party: 'mixer' }),
  b({ id: 'boxwell', name: 'BoxWell', category: 'Corrugated', hall: 'B', tagline: 'Thinking inside the box since forever.', colors: ['#b08968', '#fff'], freebie: ['brochure', 'pen'], aggression: 0.5 }),
  b({ id: 'sealdeal', name: 'Seal the Deal', category: 'Sealing Machines', hall: 'B', tagline: 'Heat seals. Firm handshakes.', colors: ['#118ab2', '#fff'], freebie: ['sandwich', 'candy'], freebieStock: 5, restockSec: 40, aggression: 0.75, demoSwag: 'socks' }),
  b({ id: 'bakebot', name: 'BakeBot', category: 'Bakery Automation', hall: 'B', tagline: '10,000 croissants an hour. Zero naps.', colors: ['#f4a261', '#3d1f00'], freebie: ['cookie'], freebieStock: 10, restockSec: 18, aggression: 0.3 }),
  b({ id: 'labelmania', name: 'Label Mania', category: 'Labeling', hall: 'B', tagline: 'We will label anything. Even you.', colors: ['#06d6a0', '#073b4c'], freebie: ['sticker', 'sticker', 'pen'], aggression: 0.4 }),
  b({ id: 'canimals', name: 'Canimals', category: 'Canning Lines', hall: 'B', tagline: 'Yes we can. 1,200 per minute.', colors: ['#8338ec', '#fff'], freebie: ['bottle', 'keychain'], freebieStock: 3, restockSec: 55, aggression: 0.5 }),
  b({ id: 'snackstack', name: 'SnackStack', category: 'Snack Equipment', hall: 'B', tagline: 'Free samples while they last (they will not).', colors: ['#fb5607', '#fff'], freebie: ['candy', 'cookie'], freebieStock: 12, restockSec: 15, aggression: 0.2 }),
  b({ id: 'fillfast', name: 'FillFast', category: 'Liquid Filling', hall: 'B', tagline: 'Glug glug. Profitably.', colors: ['#3a86ff', '#fff'], freebie: ['bottle', 'pen'], freebieStock: 3, aggression: 0.65, demoSwag: 'bottle' }),
  b({ id: 'trayjour', name: 'Trayjour', category: 'Food Trays', hall: 'B', tagline: 'A tray for every occasion.', colors: ['#ffbe0b', '#222'], freebie: ['brochure', 'candy'], aggression: 0.35 }),

  // Hall C — Software & Data
  b({ id: 'dashboardia', name: 'Dashboardia', category: 'Dashboards', hall: 'C', tagline: 'Forty-seven charts. Zero insights.', colors: ['#14213d', '#fca311'], freebie: ['sticker', 'pen'], aggression: 0.95, demoSwag: 'powerbank' }),
  b({ id: 'cloudyerp', name: 'Cloudy ERP', category: 'ERP', hall: 'C', tagline: '87% uptime. We round up.', colors: ['#90e0ef', '#03045e'], freebie: ['pen', 'brochure'], aggression: 0.9, demoSwag: 'headphones' }),
  b({ id: 'synergex', name: 'Synergex', category: 'AI Synergy', hall: 'C', tagline: 'We put AI in it. It being everything.', colors: ['#7209b7', '#fff'], freebie: ['fidget', 'sticker'], aggression: 0.8, demoSwag: 'tshirt' }),
  b({ id: 'mesmerize', name: 'MESmerize', category: 'MES Software', hall: 'C', tagline: 'Your factory, but a spreadsheet.', colors: ['#2b2d42', '#edf2f4'], freebie: ['pen', 'candy'], aggression: 0.7 }),
  b({ id: 'twinly', name: 'Twinly', category: 'Digital Twins', hall: 'C', tagline: 'Your factory has a twin. It is the evil one.', colors: ['#00b4d8', '#fff'], freebie: ['stressball', 'sticker'], aggression: 0.55, party: 'mixer' }),
  b({ id: 'blockchainbox', name: 'BlockChainBox', category: 'Blockchain for Boxes', hall: 'C', tagline: 'Every box. On the chain. Why? Ask later.', colors: ['#f72585', '#fff'], freebie: ['sticker', 'fidget'], aggression: 0.85 }),
  b({ id: 'datalake', name: 'Lake Data Swamp Co.', category: 'Data Lakes', hall: 'C', tagline: 'Dive in. Bring a snorkel.', colors: ['#2d6a4f', '#d8f3dc'], freebie: ['bottle', 'pen'], freebieStock: 4, aggression: 0.5 }),
  b({ id: 'predictive', name: 'Predictive-ish', category: 'Predictive Maintenance', hall: 'C', tagline: 'Something will break. We predicted it.', colors: ['#ff006e', '#fff'], freebie: ['candy', 'pen'], aggression: 0.6, wheel: true }),
  b({ id: 'appforthat', name: 'There’s An App', category: 'Mobile Apps', hall: 'C', tagline: 'For that. And that. And especially that.', colors: ['#4361ee', '#fff'], freebie: ['sticker', 'powerbank'], freebieStock: 4, restockSec: 45, aggression: 0.6 }),

  // Hall D — Industrial Oddities
  b({ id: 'boltsandmore', name: 'Bolts & Fasteners Inc.', category: 'Industrial Fasteners', hall: 'D', tagline: 'Our booth is boring. Our parties are not.', colors: ['#6c757d', '#f8f9fa'], freebie: ['brochure', 'pen'], aggression: 0.1, party: 'rooftop' }),
  b({ id: 'hosehaven', name: 'Hose Haven', category: 'Hydraulic Hoses', hall: 'D', tagline: 'Pressure-tested. Like your patience.', colors: ['#003566', '#ffc300'], freebie: ['keychain', 'candy'], aggression: 0.5 }),
  b({ id: 'grimgrease', name: 'Grim Grease', category: 'Lubricants', hall: 'D', tagline: 'Slippery when wet. And when dry.', colors: ['#283618', '#fefae0'], freebie: ['chicken', 'pen'], freebieStock: 2, restockSec: 60, aggression: 0.45 }),
  b({ id: 'mopmasters', name: 'MopMasters', category: 'Floor Care', hall: 'D', tagline: 'The floor you are walking on? Ours.', colors: ['#48cae4', '#023e8a'], freebie: ['socks', 'candy'], freebieStock: 3, restockSec: 50, aggression: 0.35 }),
  b({ id: 'safetysam', name: 'Safety Sam', category: 'PPE', hall: 'D', tagline: 'Hard hats. Soft hearts.', colors: ['#ffea00', '#222'], freebie: ['hardhat', 'sticker'], freebieStock: 4, restockSec: 45, aggression: 0.3 }),
  b({ id: 'forkliftfm', name: 'Forklift FM', category: 'Material Handling', hall: 'D', tagline: 'Beep beep beep. That is the jingle.', colors: ['#ff9f1c', '#2b2b2b'], freebie: ['keychain', 'candy'], aggression: 0.6, demoSwag: 'tshirt' }),
  b({ id: 'valvevalley', name: 'Valve Valley', category: 'Valves', hall: 'D', tagline: 'Open. Closed. We do both.', colors: ['#540b0e', '#fff3b0'], freebie: ['pen', 'brochure'], aggression: 0.7 }),
  b({ id: 'foamfactory', name: 'The Foam Factory', category: 'Protective Packaging', hall: 'D', tagline: 'Squishy solutions for hard problems.', colors: ['#e9edc9', '#3a5a40'], freebie: ['stressball', 'fidget'], aggression: 0.25 }),
  b({ id: 'compressco', name: 'Compress-O-Matic', category: 'Air Compressors', hall: 'D', tagline: 'Loud. Proud. Pressurized.', colors: ['#1b263b', '#e0e1dd'], freebie: ['candy', 'pen'], aggression: 0.8, demoSwag: 'socks' }),
  b({ id: 'pumpitup', name: 'Pump It Up', category: 'Pumps', hall: 'D', tagline: 'Hype pumps. Also water pumps.', colors: ['#d00000', '#fff'], freebie: ['bottle', 'pen'], freebieStock: 3, aggression: 0.5, wheel: true }),
];

/** Procedural filler for extra slots: "Generic Brochure LLC" energy. */
export const FILLER_PREFIX = ['Global', 'Precision', 'Advanced', 'United', 'Dynamic', 'Integrated', 'Omni', 'Mega', 'Total', 'Smart', 'Hyper', 'Apex', 'Quantum', 'Reliable'];
export const FILLER_NOUN = ['Gasket', 'Sprocket', 'Pallet', 'Bearing', 'Widget', 'Sensor', 'Belt', 'Bracket', 'Shim', 'Caster', 'Flange', 'Nozzle', 'Hinge', 'Coupling'];
export const FILLER_SUFFIX = ['Solutions', 'Systems', 'Group', 'LLC', 'Technologies', '& Sons', 'Dynamics', 'Holdings', 'Partners', 'International'];
export const FILLER_TAGLINES = [
  'Ask us about our brochure.',
  'Industry-leading. According to us.',
  'Visit us at booth {n}. You are here. Great.',
  'Synergy. Solutions. Sandwiches (no sandwiches).',
  'Proudly adequate since 1994.',
  'We also have a website.',
  'Please take a pen. Please.',
];
