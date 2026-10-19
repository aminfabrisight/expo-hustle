import { useEffect, useRef } from 'react';
import { CONFIG, gameMinutes } from '../systems/config';
import { clockText, objective } from '../systems/game';
import { capacity, usedSlots } from '../systems/inventory';
import { computeScore } from '../systems/score';
import type { GameState } from '../systems/state';
import { drawMinimap } from '../game/renderer';

interface HudProps {
  s: GameState;
  onPause: () => void;
  onBag: () => void;
  onJournal: () => void;
  onMap: () => void;
}

export function TopBar({ s, onPause, onBag, onJournal, onMap }: HudProps) {
  const p = s.player;
  const dayFrac = Math.min(1, s.elapsed / CONFIG.roundSeconds);
  const late = gameMinutes(s.elapsed) >= 17 * 60;
  const score = computeScore(s).total;
  const used = usedSlots(s.inv), cap = capacity(s.inv);
  return (
    <div className="topbar">
      <div className="clock" aria-label="Show clock">
        <div className={`clock-time ${late ? 'late' : ''}`}>{clockText(s)}</div>
        <div className="clock-track" aria-hidden><div style={{ width: `${dayFrac * 100}%` }} /></div>
      </div>
      <div className="meters">
        <Meter label="Energy" icon="⚡" value={p.energy} max={p.maxEnergy} tone={p.energy < CONFIG.player.lowEnergy ? 'danger' : 'energy'} />
        <Meter label="Morale" icon="😄" value={p.morale} max={100} tone={p.morale < 25 ? 'danger' : 'morale'} />
      </div>
      <div className="stats">
        <button className="chip" onClick={onBag} title="Bag (I)"><span>🎒</span><b className={used >= cap ? 'full' : ''}>{used}/{cap}</b></button>
        <button className="chip" onClick={onJournal} title="Journal (J)"><span>🤝</span><b>{p.connections}</b>{s.invites.length > 0 && <><span>🎟️</span><b>{s.invites.length}</b></>}</button>
        <button className="chip hide-sm" onClick={onMap} title="Map (M)"><span>🗺️</span></button>
        <div className="chip score" title="Score"><b>{score.toLocaleString()}</b><span className="pts">pts</span></div>
        <button className="chip icon-only" onClick={onPause} aria-label="Pause (Esc)">❚❚</button>
      </div>
    </div>
  );
}

function Meter({ label, icon, value, max, tone }: { label: string; icon: string; value: number; max: number; tone: string }) {
  const pct = Math.max(0, Math.min(100, (value / max) * 100));
  return (
    <div className={`meter ${tone}`} role="meter" aria-label={label} aria-valuenow={Math.round(value)} aria-valuemin={0} aria-valuemax={max}>
      <span className="meter-icon" aria-hidden>{icon}</span>
      <div className="meter-track"><div className="meter-fill" style={{ width: `${pct}%` }} /></div>
      <span className="meter-num">{Math.round(value)}</span>
    </div>
  );
}

export function Ticker({ s }: { s: GameState }) {
  return (
    <div className="ticker" aria-live="polite">
      <span className="ticker-tag">FLOOR CHATTER</span>
      <span className="ticker-text" key={s.ticker.text}>{s.ticker.text}</span>
    </div>
  );
}

export function Objective({ s }: { s: GameState }) {
  const o = objective(s);
  return (
    <div className={`objective ${s.tutorial >= 0 ? 'tutorial' : ''}`}>
      <span aria-hidden>{o.icon}</span>
      <span>{o.text}</span>
      {s.goldRush && <span className="gold">GOLD RUSH</span>}
      {s.blitzHall && <span className="blitz">DEMO BLITZ · HALL {s.blitzHall}</span>}
    </div>
  );
}

export function Toasts({ s }: { s: GameState }) {
  return (
    <div className="toasts" aria-live="polite">
      {s.toasts.map((t) => (
        <div key={t.id} className={`toast ${t.tone}`} style={{ opacity: t.t > 3.8 ? Math.max(0, 1 - (t.t - 3.8) / 0.7) : 1 }}>
          <span className="toast-icon" aria-hidden>{t.icon}</span>
          <span>{t.text}</span>
        </div>
      ))}
    </div>
  );
}

export function Minimap({ s, onOpen }: { s: GameState; onOpen: () => void }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = c.clientWidth, h = c.clientHeight;
    if (c.width !== w * dpr) { c.width = w * dpr; c.height = h * dpr; }
    const ctx = c.getContext('2d')!;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    drawMinimap(ctx, s, w, h, false);
  });
  if (!s.infoVisited) return null;
  return (
    <button className="minimap" onClick={onOpen} aria-label="Open map (M)">
      <canvas ref={ref} />
    </button>
  );
}

export function ContextCard({ s, onAction, touch }: { s: GameState; onAction: (i: number) => void; touch: boolean }) {
  const c = s.context;
  if (!c || s.channel || s.dialog) return null;
  const primary = c.actions.findIndex((a) => a.enabled);
  return (
    <div className="context badge-card">
      <div className="badge-hole" aria-hidden />
      <div className="context-head">
        <div className="context-title">{c.title}</div>
        {c.sponsor && <span className="sponsor-pill">{c.sponsor.label}</span>}
      </div>
      <div className="context-sub">{c.subtitle}</div>
      {c.rel !== undefined && (
        <div className="rel">
          <span>Relationship</span>
          <div className="rel-track"><div style={{ width: `${c.rel}%` }} /></div>
          <b>{Math.round(c.rel)}%</b>
        </div>
      )}
      {c.clue && <div className="clue">🔎 {c.clue}</div>}
      <div className="actions">
        {c.actions.map((a, i) => (
          <button key={a.id + i} className={`act ${i === primary ? 'primary' : ''}`} disabled={!a.enabled} onClick={() => onAction(i)}>
            {!touch && <kbd>{i === primary ? 'E' : i + 1}</kbd>}
            <span className="act-label">{a.icon} {a.label}</span>
            {a.hint && <small>{a.hint}</small>}
          </button>
        ))}
      </div>
      {c.sponsor && (
        <div className="sponsor-note">
          {c.sponsor.description}
          {c.sponsor.url && <> <a href={c.sponsor.url} target="_blank" rel="noopener noreferrer">Learn more ↗</a></>}
        </div>
      )}
    </div>
  );
}

export function ChannelBar({ s, onCancel, onStop }: { s: GameState; onCancel: () => void; onStop: () => void }) {
  const c = s.channel;
  if (!c) return null;
  if (c.kind === 'wheel') {
    const m = c.data ?? 0;
    return (
      <div className="channel wheel">
        <div className="channel-label">🎡 {c.label}</div>
        <div className="wheel-track">
          <div className="wheel-zone" />
          <div className="wheel-marker" style={{ left: `${50 + m * 46}%` }} />
        </div>
        <div className="channel-buttons">
          <button className="act primary" onClick={onStop}>STOP!</button>
        </div>
      </div>
    );
  }
  return (
    <div className={`channel ${c.kind === 'demo' || c.kind === 'stunned' ? 'danger' : ''}`}>
      <div className="channel-label">{c.label}</div>
      <div className="channel-sub">{c.sub}</div>
      <div className="channel-track"><div style={{ width: `${Math.min(100, (c.t / c.dur) * 100)}%` }} /></div>
      {c.cancelable && <button className="link-btn" onClick={onCancel}>{c.kind === 'demo' ? 'Back away slowly (Esc / move)' : 'Cancel (Esc / move)'}</button>}
    </div>
  );
}

export function DialogCard({ s, onPick }: { s: GameState; onPick: (i: number) => void }) {
  const d = s.dialog;
  if (!d) return null;
  return (
    <div className="dialog-wrap">
      <div className={`dialog badge-card ${d.kind}`} role="dialog" aria-modal="true" aria-label={d.title}>
        <div className="badge-hole" aria-hidden />
        <div className="dialog-icon" aria-hidden>{d.icon}</div>
        <h2>{d.title}</h2>
        <p>{d.body}</p>
        <div className="actions col">
          {d.options.map((o, i) => (
            <button key={o.id} className={`act ${i === 0 ? 'primary' : ''}`} onClick={() => onPick(i)} autoFocus={i === 0}>
              <kbd>{i + 1}</kbd>
              <span className="act-label">{o.label}</span>
              {o.hint && <small>{o.hint}</small>}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
