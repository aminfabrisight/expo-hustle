/** Central tuning knobs. Change pacing here, not inside systems. */
export const CONFIG = {
  /** Real seconds for one expo day (9 AM -> 6 PM). 240s = 4 minutes. */
  roundSeconds: 240,
  dayStartMin: 9 * 60,
  dayEndMin: 18 * 60,

  tile: 32, // world pixels per tile (renderer only)
  metersPerTile: 6, // used for the comedic "miles walked" stat

  player: {
    radius: 0.32,
    walkSpeed: 4.6, // tiles / sec
    sprintMult: 1.65,
    exhaustedMult: 0.62, // below lowEnergy
    lowEnergy: 18,
    minSprintEnergy: 6,
    walkDrain: 0.4, // energy / sec while walking
    sprintDrain: 2.3, // energy / sec while sprinting
    idleRegen: 0.15,
    restRegen: 7, // in a lounge, standing still
    moraleDecay: 0.13, // morale / sec, the slow grind of expo life
    visionRadius: 7.5, // tiles
    coffeeBuffSec: 18,
    coffeeSpeedMult: 1.22,
    bladderPerCoffee: 34,
    bladderUrgent: 85,
    bagSpeedPenaltyPerSlot: 0.025, // per slot above 3
  },

  interact: {
    range: 1.25, // tiles from booth edge
    grabSec: 0.45,
    chatSec: 4.2,
    chatGain: 20,
    chatsBeforeCooldown: 2,
    chatCooldownSec: 22,
    restroomSec: 1.6,
    salesTriggerRange: 1.3,
    salesWarnRange: 4,
    salesCooldownSec: 45,
    demoSec: 5,
    shuttleWaitSec: 2.2,
  },

  npc: {
    baseCount: 64,
    lunchExtra: 18,
    speed: 2.6,
    crowdSlowPerNpc: 0.07,
    crowdSlowMin: 0.5,
  },

  maxInvites: 2,
  baseBagSlots: 6,
};

export function gameMinutes(elapsedSec: number): number {
  const { roundSeconds, dayStartMin, dayEndMin } = CONFIG;
  return dayStartMin + (dayEndMin - dayStartMin) * Math.min(1, elapsedSec / roundSeconds);
}

/** Convert a game clock time (minutes since midnight) into round seconds. */
export function secAtClock(min: number): number {
  const { roundSeconds, dayStartMin, dayEndMin } = CONFIG;
  return ((min - dayStartMin) / (dayEndMin - dayStartMin)) * roundSeconds;
}

export function formatClock(min: number): string {
  const h24 = Math.floor(min / 60);
  const m = Math.floor(min % 60);
  const h = ((h24 + 11) % 12) + 1;
  return `${h}:${m.toString().padStart(2, '0')} ${h24 >= 12 ? 'PM' : 'AM'}`;
}
