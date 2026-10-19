import { useCallback, useEffect, useState } from 'react';
import { ARCHETYPES } from '../content/archetypes';
import { bestPerPerson, fetchTopRuns, type LeaderRow } from '../app/leaderboard';
import type { ArchetypeId } from '../systems/types';

type Status = 'loading' | 'ready' | 'error';

/**
 * Shared leaderboard: everyone's best run with their title.
 * `highlightId` marks the run just played; `myName` marks the viewer's own best row.
 * `pending` keeps it in "saving" state until the just-played run has been written.
 */
export function Leaderboard({ highlightId, myName, pending, saveError, onRetrySave, limit = 25, heading = 'Leaderboard' }: {
  highlightId?: number | null;
  myName?: string;
  pending?: boolean;
  saveError?: string | null;
  onRetrySave?: () => void;
  limit?: number;
  heading?: string;
}) {
  const [rows, setRows] = useState<LeaderRow[]>([]);
  const [status, setStatus] = useState<Status>('loading');

  const load = useCallback(async () => {
    setStatus('loading');
    try {
      setRows(bestPerPerson(await fetchTopRuns()));
      setStatus('ready');
    } catch {
      setStatus('error');
    }
  }, []);

  // Reload once the run has been saved so it shows up in the list.
  useEffect(() => { if (!pending) void load(); }, [pending, highlightId, load]);

  const me = myName?.trim().toLowerCase();
  const myIndex = me ? rows.findIndex((r) => r.name.trim().toLowerCase() === me) : -1;
  const shown = rows.slice(0, limit);
  const meOutside = myIndex >= limit ? rows[myIndex] : null;

  return (
    <section className="leaderboard" aria-label="Leaderboard">
      <div className="lb-head">
        <h3>{heading}</h3>
        <button className="link-btn" onClick={() => void load()} disabled={status === 'loading' || pending}>Refresh</button>
      </div>
      <p className="muted small lb-sub">Everyone's best run. Ties go to whoever got there first.</p>

      {saveError && (
        <div className="lb-note bad">
          Your score didn't save: {saveError}. {onRetrySave && <button className="link-btn" onClick={onRetrySave}>Try again</button>}
        </div>
      )}
      {pending && <div className="lb-note">Saving your score…</div>}
      {status === 'error' && !pending && (
        <div className="lb-note bad">Couldn't load the leaderboard. Check your connection, then <button className="link-btn" onClick={() => void load()}>try again</button>.</div>
      )}
      {status === 'loading' && !pending && rows.length === 0 && <div className="lb-note">Loading scores…</div>}
      {status === 'ready' && rows.length === 0 && <div className="lb-note">No scores yet. Be the first legend on the floor.</div>}

      {shown.length > 0 && (
        <ol className="lb-list">
          {shown.map((r, i) => <Row key={r.id} r={r} rank={i + 1} isNew={r.id === highlightId} isMe={i === myIndex} />)}
          {meOutside && (
            <>
              <li className="lb-gap" aria-hidden>⋯</li>
              <Row r={meOutside} rank={myIndex + 1} isNew={meOutside.id === highlightId} isMe />
            </>
          )}
        </ol>
      )}
    </section>
  );
}

function Row({ r, rank, isNew, isMe }: { r: LeaderRow; rank: number; isNew: boolean; isMe: boolean }) {
  const arch = ARCHETYPES[r.archetype as ArchetypeId];
  const medal = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : null;
  return (
    <li className={`lb-row ${isMe ? 'me' : ''} ${isNew ? 'new' : ''}`}>
      <span className="lb-rank">{medal ?? rank}</span>
      <span className="lb-who">
        <b>{r.name}{isMe && <em> · you</em>}</b>
        <small>{r.title}{arch ? ` · ${arch.icon} ${arch.name}` : ''}</small>
      </span>
      <span className="lb-score">{r.score.toLocaleString()}</span>
    </li>
  );
}
