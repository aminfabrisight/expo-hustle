import type { ArchetypeId } from '../systems/types';

/** localStorage wrapper that never throws (private mode, blocked storage, sandboxed frames). */
const KEY = 'expo-hustle:v1';

export interface Saved {
  sound: boolean;
  reducedMotion: boolean;
  archetype: ArchetypeId;
  tutorialDone: boolean;
  best: number;
  bestTitle: string;
  runs: number;
  achievements: string[];
}

const defaults = (): Saved => ({
  sound: true,
  reducedMotion: typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches,
  archetype: 'classic',
  tutorialDone: false,
  best: 0,
  bestTitle: '',
  runs: 0,
  achievements: [],
});

export function load(): Saved {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return defaults();
    return { ...defaults(), ...JSON.parse(raw) };
  } catch {
    return defaults();
  }
}

export function save(s: Saved) {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    /* storage unavailable: settings just won't persist */
  }
}
