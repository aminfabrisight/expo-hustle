import raw from './sponsors.json';
import { ITEMS } from './items';
import type { BoothProfile, HallId, PartyTier } from '../systems/types';

const HALL_IDS: HallId[] = ['A', 'B', 'C', 'D'];
const TIERS: PartyTier[] = ['mixer', 'sponsored', 'rooftop'];

/** Only plain https URLs pass. Anything else (javascript:, data:, http:) is dropped. */
export function sanitizeUrl(u: unknown): string | undefined {
  if (typeof u !== 'string' || !u.trim()) return undefined;
  try {
    const url = new URL(u.trim());
    return url.protocol === 'https:' ? url.toString() : undefined;
  } catch {
    return undefined;
  }
}

/** Strip control chars/markup-ish characters and clamp length. Text is rendered as text anyway. */
export function sanitizeText(s: unknown, max = 140): string {
  if (typeof s !== 'string') return '';
  return s.replace(/[\u0000-\u001f<>]/g, '').trim().slice(0, max);
}

function sanitizeColor(c: unknown, fallback: string): string {
  return typeof c === 'string' && /^#[0-9a-fA-F]{3,8}$/.test(c) ? c : fallback;
}

export function parseSponsors(data: unknown): BoothProfile[] {
  const list = (data as { sponsors?: unknown[] })?.sponsors;
  if (!Array.isArray(list)) return [];
  const out: BoothProfile[] = [];
  for (const s of list as Record<string, unknown>[]) {
    const id = sanitizeText(s.id, 40).replace(/[^a-z0-9_-]/gi, '');
    const name = sanitizeText(s.displayName, 32);
    if (!id || !name) continue;
    const colors = Array.isArray(s.colors) ? s.colors : [];
    const freebie = (Array.isArray(s.freebie) ? s.freebie : []).filter((f): f is string => typeof f === 'string' && !!ITEMS[f]);
    out.push({
      id,
      name,
      category: 'Sponsor',
      hall: HALL_IDS.includes(s.hall as HallId) ? (s.hall as HallId) : undefined,
      tagline: sanitizeText(s.tagline, 80),
      colors: [sanitizeColor(colors[0], '#222222'), sanitizeColor(colors[1], '#ffffff')],
      freebie: freebie.length ? freebie : ['pen'],
      // Comparable gameplay value: sponsors cannot buy bigger stock than normal booths.
      freebieStock: Math.min(8, Math.max(1, Number(s.freebieStock) || 5)),
      restockSec: Math.max(15, Number(s.restockSec) || 30),
      aggression: Math.min(1, Math.max(0, Number(s.aggression) || 0)),
      party: TIERS.includes(s.party as PartyTier) ? (s.party as PartyTier) : undefined,
      wheel: !!s.wheel,
      island: !!s.island,
      special: s.special === 'fabrisight' ? 'fabrisight' : undefined,
      sponsor: {
        id,
        label: sanitizeText(s.label, 20) || 'Sponsored',
        description: sanitizeText(s.description, 280),
        url: sanitizeUrl(s.url),
        logoUrl: sanitizeUrl(s.logoUrl),
      },
    });
  }
  return out;
}

export const SPONSOR_BOOTHS = parseSponsors(raw);
