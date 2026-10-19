/**
 * Shared leaderboard backed by a Supabase table (expo_leaderboard), talked to over its REST API
 * with plain fetch, so there's no extra dependency. The publishable key is safe to ship in the
 * browser: row-level security only allows reading and adding validated rows (no edits/deletes).
 *
 * Override with VITE_SUPABASE_URL / VITE_SUPABASE_KEY at build time to point at another project.
 */
const env = (import.meta as unknown as { env?: Record<string, string | undefined> }).env ?? {};
export const LB_URL = env.VITE_SUPABASE_URL || 'https://kbwfcjnifwmuxncktutp.supabase.co';
export const LB_KEY = env.VITE_SUPABASE_KEY || 'sb_publishable_UfZ3nDfGaFO34NdCGv3ZNw_iXq-1NjI';
const TABLE = 'expo_leaderboard';

export interface LeaderRow {
  id: number;
  name: string;
  score: number;
  title: string;
  archetype: string;
  created_at: string;
}

export interface NewEntry {
  name: string;
  score: number;
  title: string;
  archetype: string;
}

export const NAME_MAX = 20;

/** Trim, drop control characters and markup brackets, collapse spaces, clamp length. */
export function cleanName(raw: string): string {
  return raw.replace(/[\u0000-\u001f\u007f<>]/g, '').replace(/\s+/g, ' ').trim().slice(0, NAME_MAX);
}

function headers(extra: Record<string, string> = {}) {
  const auth: Record<string, string> = LB_KEY.startsWith('sb_') ? {} : { Authorization: `Bearer ${LB_KEY}` };
  return { apikey: LB_KEY, ...auth, 'Content-Type': 'application/json', ...extra };
}

async function withTimeout<T>(p: (signal: AbortSignal) => Promise<T>, ms = 8000): Promise<T> {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), ms);
  try {
    return await p(ctl.signal);
  } finally {
    clearTimeout(t);
  }
}

export async function submitScore(e: NewEntry): Promise<LeaderRow> {
  const body = {
    name: cleanName(e.name) || 'Anonymous Attendee',
    score: Math.max(0, Math.min(20000, Math.round(e.score))),
    title: e.title.slice(0, 40),
    archetype: e.archetype.slice(0, 24),
  };
  return withTimeout(async (signal) => {
    const res = await fetch(`${LB_URL}/rest/v1/${TABLE}`, {
      method: 'POST',
      headers: headers({ Prefer: 'return=representation' }),
      body: JSON.stringify(body),
      signal,
    });
    if (!res.ok) throw new Error(`Save failed (${res.status})`);
    const rows = (await res.json()) as LeaderRow[];
    return rows[0];
  });
}

/** Raw top runs, highest first. */
export async function fetchTopRuns(limit = 300): Promise<LeaderRow[]> {
  return withTimeout(async (signal) => {
    const res = await fetch(`${LB_URL}/rest/v1/${TABLE}?select=id,name,score,title,archetype,created_at&order=score.desc,created_at.asc&limit=${limit}`, {
      headers: headers(),
      signal,
    });
    if (!res.ok) throw new Error(`Load failed (${res.status})`);
    return (await res.json()) as LeaderRow[];
  });
}

/** One row per person (their best run), case-insensitive on name. Input must be sorted by score desc. */
export function bestPerPerson(rows: LeaderRow[]): LeaderRow[] {
  const seen = new Set<string>();
  const out: LeaderRow[] = [];
  for (const r of rows) {
    const k = r.name.trim().toLowerCase();
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(r);
  }
  return out;
}
