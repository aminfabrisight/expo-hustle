import { describe, expect, it } from 'vitest';
import { bestPerPerson, cleanName, NAME_MAX, type LeaderRow } from '../app/leaderboard';

const row = (id: number, name: string, score: number): LeaderRow => ({ id, name, score, title: 'T', archetype: 'classic', created_at: '' });

describe('leaderboard helpers', () => {
  it('cleans names', () => {
    expect(cleanName('  Amin   K  ')).toBe('Amin K');
    expect(cleanName('<script>x')).toBe('scriptx');
    expect(cleanName('a\u0007b')).toBe('ab');
    expect(cleanName('x'.repeat(50)).length).toBe(NAME_MAX);
    expect(cleanName('   ')).toBe('');
  });
  it('keeps each person once, at their best score', () => {
    const rows = [row(1, 'Amin', 900), row(2, 'Sara', 800), row(3, 'amin ', 700), row(4, 'Lee', 600)];
    expect(bestPerPerson(rows).map((r) => r.id)).toEqual([1, 2, 4]);
  });
});
