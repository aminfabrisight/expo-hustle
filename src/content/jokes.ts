/** Ticker lines. All of these are simulated in-game chatter, never real people. */
export const TICKER_AMBIENT = [
  'Someone found a secret whiskey tasting in Hall C. It was apple juice.',
  'Booth 1842 has run out of free pizza.',
  'An attendee has been trapped in a software demo for 47 minutes.',
  'The cheese situation in Hall B is deteriorating.',
  'BREAKING: Free tote bag supplies are under control.',
  'A man in Hall D has collected 31 pens. He is not okay.',
  'Wi-Fi password is "expo2026". Wi-Fi is not working.',
  'Reminder: the bathrooms near Hall A have no line. Nobody believes this.',
  'Lost: one lanyard, answers to "Badge #4471".',
  'A salesperson in Hall C just said "synergy" for the 400th time today.',
  'Someone is charging four phones off one outlet. Respect.',
  'Hall B smells like popcorn. There is no popcorn.',
  'Update: the robot arm in Hall A is now handing out high fives.',
  'Rumor: the boring fastener booth throws the best party. Rumors are rumors.',
  'Shoe update: your feet have filed a formal complaint.',
  'An attendee asked a booth "what do you actually do?" Booth is still thinking.',
  'Somebody took the last cookie and left the plate. Investigation ongoing.',
  'Free stickers detected in Hall C. Laptops trembling.',
  'Information desk reports 300 questions, all "where is the coffee".',
  'The shuttle runs every 20 minutes, or never. Science is unsure.',
  'Some VIP invitations are not what they seem. Stay vigilant.',
];

export const TICKER_LUNCH = [
  'It is lunchtime. The sandwich line has achieved sentience.',
  'Lunch rush: average sandwich wait now exceeds a demo.',
];

export const TICKER_LATE = [
  'Booths are packing up. Leftover swag is becoming available.',
  'Exhibitors are visibly tired of saying "great question".',
];

export const GRAB_QUIPS_EMPTY = [
  'Empty. A single wrapper remains.',
  'Out of stock. Come back later (they said, lying).',
  'The bowl is empty. You are not the first.',
];

export const DEMO_LINES = [
  '"So if you look at THIS dashboard..."',
  '"...and that is just the free tier!"',
  '"Let me loop in my colleague, he LOVES this part."',
  '"Quick question: what keeps you up at night?"',
  '"We are basically the Uber of conveyor belts."',
];

export const CHAT_LINES = [
  'You nod thoughtfully at a slide.',
  'You both agree supply chains are "a lot right now".',
  'You laugh at a joke about pallets.',
  'You exchange LinkedIn requests with intent.',
  'You discover you both hate the Wi-Fi. Bonding.',
];

export const BOOTH_CLUES: Record<string, string> = {
  mixer: 'Their staff keep checking a "tonight" spreadsheet.',
  sponsored: 'There is a stack of drink tickets behind the counter.',
  rooftop: 'Somebody here mentioned "the roof" and then stopped talking.',
  none: 'Nice people. Party vibes: zero.',
};

export const RUMOR_NPC_LINES = [
  'Psst. I heard {tip}',
  'Don’t tell anyone, but {tip}',
  'My cousin works security. {tip}',
];

export const PARTY_INFO = {
  mixer: { name: 'Standard Mixer', bonus: 250, icon: '🍸', where: 'Hotel Ballroom B, 7 PM' },
  sponsored: { name: 'Sponsored Happy Hour', bonus: 400, icon: '🎉', where: 'Lumen Lounge, 7:30 PM' },
  rooftop: { name: 'Secret Rooftop Party', bonus: 650, icon: '🌃', where: 'The Roof. Bring a jacket. 9 PM' },
} as const;
