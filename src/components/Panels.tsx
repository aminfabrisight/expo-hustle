import { useEffect, useRef } from 'react';
import { item } from '../content/items';
import { BOOTH_CLUES, PARTY_INFO } from '../content/jokes';
import { capacity, usedSlots } from '../systems/inventory';
import type { GameState } from '../systems/state';
import { drawMinimap } from '../game/renderer';
import { CONFIG } from '../systems/config';

function Panel({ title, onClose, children, wide }: { title: string; onClose: () => void; children: React.ReactNode; wide?: boolean }) {
  return (
    <div className="panel-wrap" onClick={onClose}>
      <div className={`panel ${wide ? 'wide' : ''}`} role="dialog" aria-modal="true" aria-label={title} onClick={(e) => e.stopPropagation()}>
        <div className="panel-head">
          <h2>{title}</h2>
          <button className="close" onClick={onClose} aria-label="Close">✕</button>
        </div>
        <div className="panel-body">{children}</div>
        <div className="panel-foot">Game is paused while this is open.</div>
      </div>
    </div>
  );
}

export function BagPanel({ s, onClose, onDrop }: { s: GameState; onClose: () => void; onDrop: (uid: number) => void }) {
  const used = usedSlots(s.inv), cap = capacity(s.inv);
  const slots: React.ReactNode[] = [];
  for (const b of s.inv.items) {
    const d = item(b.id);
    slots.push(
      <div key={b.uid} className={`bag-item ${d.tags?.includes('premium') ? 'premium' : ''}`} style={{ gridColumn: `span ${Math.max(1, d.slots)}` }}>
        <div className="bag-icon" aria-hidden>{d.icon}</div>
        <div className="bag-name">{d.name}</div>
        <div className="bag-meta">{d.loot * 10} pts · {d.slots === 0 ? 'no slot' : `${d.slots} slot${d.slots > 1 ? 's' : ''}`}{d.bagBonus ? ` · +${d.bagBonus} capacity` : ''}</div>
        <button className="link-btn" onClick={() => onDrop(b.uid)}>Drop</button>
      </div>,
    );
  }
  for (let i = used; i < cap; i++) slots.push(<div key={'e' + i} className="bag-item empty">empty</div>);
  return (
    <Panel title={`Your Bag · ${used}/${cap} slots`} onClose={onClose}>
      <p className="muted">Swag counts toward your Loot score only if it is still in the bag at 6 PM. Food is eaten on the spot. Bags over 3 slots slow you down a bit.</p>
      <div className="bag-grid">{slots}</div>
    </Panel>
  );
}

export function JournalPanel({ s, onClose }: { s: GameState; onClose: () => void }) {
  const known = s.map.booths.filter((b) => b.rel > 0 || s.cluesKnown.has(b.idx)).sort((a, b) => b.rel - a.rel);
  return (
    <Panel title="Networking Journal" onClose={onClose}>
      <section>
        <h3>VIP invites ({s.invites.length}/{CONFIG.maxInvites})</h3>
        {s.invites.length === 0 ? <p className="muted">None yet. Chat at booths until a relationship hits 100%. Some booths host parties, and the info desk and gossipy attendees 💬 know which.</p> : (
          <ul className="invite-list">
            {s.invites.map((i, k) => (
              <li key={k}><span aria-hidden>{PARTY_INFO[i.tier].icon}</span> <b>{PARTY_INFO[i.tier].name}</b> · hosted by {i.host} · {PARTY_INFO[i.tier].where}</li>
            ))}
          </ul>
        )}
      </section>
      <section>
        <h3>Relationships</h3>
        {known.length === 0 ? <p className="muted">You haven't talked to anyone yet. Walk up to a booth and pick "Chat & network".</p> : (
          <ul className="rel-list">
            {known.map((b) => (
              <li key={b.idx}>
                <div className="rel-row">
                  <b>{b.profile.name}</b>
                  <span className="muted">{b.number}</span>
                  <div className="rel-track"><div style={{ width: `${b.rel}%` }} /></div>
                  <span>{Math.round(b.rel)}%</span>
                </div>
                <div className="muted small">{b.chats > 0 || s.cluesKnown.has(b.idx) ? BOOTH_CLUES[b.profile.party ?? 'none'] : ''}{b.chatCooldown > 0 ? ` · busy for ${Math.ceil(b.chatCooldown)}s` : ''}</div>
              </li>
            ))}
          </ul>
        )}
      </section>
      <section>
        <h3>Today so far</h3>
        <div className="mini-stats">
          <span>🍽️ {s.stats.foods + s.stats.drinks} snacks</span>
          <span>🏃 {s.stats.escapes} escapes</span>
          <span>📊 {s.stats.demos} demos</span>
          <span>📧 {s.stats.spam} spam</span>
          <span>🖊️ {s.stats.pens} pens</span>
          <span>📈 {s.stats.leads} leads</span>
        </div>
      </section>
    </Panel>
  );
}

export function MapPanel({ s, onClose }: { s: GameState; onClose: () => void }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = c.clientWidth, h = c.clientHeight;
    c.width = w * dpr; c.height = h * dpr;
    const ctx = c.getContext('2d')!;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    drawMinimap(ctx, s, w, h, true);
  }, [s]);
  return (
    <Panel title="PACKED EXPO · Floor Map" onClose={onClose} wide>
      {!s.infoVisited && <p className="muted">Only what you've explored is shown. Grab a floor map at the Information Desk ℹ️ in the middle to see every booth.</p>}
      <canvas ref={ref} className="bigmap" />
      <p className="muted small">❓ = rumored event somewhere in that hall · 🎉 = known party host · yellow dot = you</p>
    </Panel>
  );
}

export function PauseMenu(props: {
  sound: boolean; reducedMotion: boolean;
  onResume: () => void; onToggleSound: () => void; onToggleMotion: () => void; onLeave: () => void; onRestart: () => void; onQuit: () => void;
}) {
  return (
    <Panel title="Paused" onClose={props.onResume}>
      <div className="menu-col">
        <button className="btn big" onClick={props.onResume} autoFocus>Resume</button>
        <button className="btn" onClick={props.onToggleSound}>Sound: {props.sound ? 'On' : 'Off'}</button>
        <button className="btn" onClick={props.onToggleMotion}>Reduced motion: {props.reducedMotion ? 'On' : 'Off'}</button>
        <button className="btn" onClick={props.onLeave}>Leave the expo early (score now)</button>
        <button className="btn" onClick={props.onRestart}>Restart with a new floor</button>
        <button className="btn ghost" onClick={props.onQuit}>Back to title</button>
      </div>
      <HowTo />
    </Panel>
  );
}

export function HowTo() {
  return (
    <div className="howto">
      <h3>Controls</h3>
      <ul>
        <li><kbd>WASD</kbd>/<kbd>Arrows</kbd> move · <kbd>Shift</kbd> sprint</li>
        <li><kbd>E</kbd>/<kbd>Space</kbd> main action · <kbd>1</kbd>–<kbd>4</kbd> other actions</li>
        <li><kbd>I</kbd> bag · <kbd>J</kbd> journal · <kbd>M</kbd> map · <kbd>Esc</kbd> pause / cancel</li>
        <li>On phones: drag the stick, hold SPRINT, tap the action buttons.</li>
      </ul>
    </div>
  );
}
