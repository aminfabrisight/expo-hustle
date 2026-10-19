import { useState } from 'react';
import { ARCHETYPES, ARCHETYPE_ORDER } from '../content/archetypes';
import { PARTY_INFO } from '../content/jokes';
import { SPONSOR_BOOTHS } from '../content/sponsors';
import type { Achievement, ScoreBreakdown, Title } from '../systems/score';
import type { GameState } from '../systems/state';
import type { ArchetypeId } from '../systems/types';
import { HowTo } from './Panels';
import { Leaderboard } from './Leaderboard';
import { NAME_MAX, cleanName } from '../app/leaderboard';

export function TitleScreen(props: {
  arch: ArchetypeId; best: number; bestTitle: string; sound: boolean; reducedMotion: boolean; name: string;
  onArch: (a: ArchetypeId) => void; onPlay: () => void; onToggleSound: () => void; onToggleMotion: () => void; onName: (n: string) => void;
}) {
  const [about, setAbout] = useState(false);
  const [nameError, setNameError] = useState(false);
  const play = () => {
    const n = cleanName(props.name);
    if (!n) { setNameError(true); document.getElementById('player-name')?.focus(); return; }
    if (n !== props.name) props.onName(n);
    props.onPlay();
  };
  return (
    <div className="title-screen">
      <div className="title-inner title-layout">
        <div className="t-hero">
        <div className="lanyard" aria-hidden />
        <div className="hero-badge">
          <div className="badge-hole" aria-hidden />
          <div className="hero-eyebrow">PACKED EXPO · ALL ACCESS</div>
          <h1>EXPO<br />HUSTLE</h1>
          <p className="tagline">9 hours. 800 booths. Free beer somewhere. Good luck.</p>
          <ol className="micro">
            <li><span>👟</span> Move with WASD / arrows (or the stick)</li>
            <li><span>🤲</span> Press E at booths for freebies &amp; chats</li>
            <li><span>⏱</span> Chase timed goodies before the crowd does</li>
          </ol>
          <form className="name-form" onSubmit={(e) => { e.preventDefault(); play(); }}>
            <label htmlFor="player-name">Name on your badge</label>
            <input
              id="player-name" type="text" autoComplete="nickname" maxLength={NAME_MAX} placeholder="e.g. Amin"
              value={props.name} aria-invalid={nameError} aria-describedby="name-hint"
              onChange={(e) => { props.onName(e.target.value); if (nameError) setNameError(false); }}
              autoFocus={!props.name}
            />
            <small id="name-hint" className={nameError ? 'err' : ''}>{nameError ? 'Add a name so we can put you on the leaderboard.' : 'Shown on the shared leaderboard.'}</small>
            <button type="submit" className="btn play" autoFocus={!!props.name}>PLAY</button>
          </form>
          {props.best > 0 && <div className="best">Best: <b>{props.best.toLocaleString()}</b>{props.bestTitle && <> · {props.bestTitle}</>}</div>}
        </div>
        </div>

        <aside className="t-board">
          <Leaderboard myName={props.name} limit={10} heading="Top 10 Hustlers" />
        </aside>

        <div className="arch-pick" role="radiogroup" aria-label="Choose your attendee type">
          <div className="arch-label">Attendee type <span className="muted">(optional)</span></div>
          <div className="arch-grid">
            {ARCHETYPE_ORDER.map((id) => {
              const a = ARCHETYPES[id];
              return (
                <button key={id} role="radio" aria-checked={props.arch === id} className={`arch ${props.arch === id ? 'on' : ''}`} onClick={() => props.onArch(id)}>
                  <span className="arch-icon" aria-hidden>{a.icon}</span>
                  <b>{a.name}</b>
                  <small>{a.blurb}</small>
                </button>
              );
            })}
          </div>
        </div>

        <div className="t-more">
        <div className="title-toggles">
          <button className="btn ghost" onClick={props.onToggleSound}>Sound: {props.sound ? 'On' : 'Off'}</button>
          <button className="btn ghost" onClick={props.onToggleMotion}>Reduced motion: {props.reducedMotion ? 'On' : 'Off'}</button>
          <button className="btn ghost" onClick={() => setAbout((v) => !v)}>{about ? 'Hide' : 'How to play & sponsors'}</button>
        </div>
        {about && (
          <div className="about">
            <HowTo />
            <h3>Sponsors</h3>
            <ul>
              {SPONSOR_BOOTHS.map((sp) => (
                <li key={sp.id}><b>{sp.name}</b> <span className="sponsor-pill">{sp.sponsor?.label}</span> {sp.sponsor?.description}</li>
              ))}
            </ul>
            <p className="muted small">Everything here is fictional game fun: crowds, tickers, badge scans and "analytics" are simulated. The leaderboard stores only the name you type, your score, title and attendee type.</p>
          </div>
        )}
        </div>
      </div>
    </div>
  );
}

export function PartyScreen({ s, onContinue, reduced }: { s: GameState; onContinue: () => void; reduced: boolean }) {
  return (
    <div className="party-screen">
      {!reduced && <div className="confetti-css" aria-hidden>{Array.from({ length: 40 }, (_, i) => <i key={i} style={{ left: `${(i * 37) % 100}%`, animationDelay: `${(i % 10) * 0.25}s`, background: ['#ff4d6d', '#ffd23f', '#5fe1ff', '#6bff8f', '#ff9ef0'][i % 5] }} />)}</div>}
      <div className="party-inner">
        <div className="hero-eyebrow">6:00 PM · AFTER HOURS</div>
        <h1>You're on the list.</h1>
        <div className="party-cards">
          {s.invites.map((i, k) => {
            const info = PARTY_INFO[i.tier];
            return (
              <div className={`party-card ${i.tier}`} key={k}>
                <div className="party-icon" aria-hidden>{info.icon}</div>
                <b>{info.name}</b>
                <span>Hosted by {i.host}</span>
                <span className="muted">{info.where}</span>
                <div className="party-bonus">+{info.bonus}</div>
              </div>
            );
          })}
        </div>
        <p className="muted">{s.invites.some((i) => i.tier === 'rooftop') ? 'The roof has a DJ, a taco truck, and the CEO doing karaoke. Legendary.' : 'Tiny sliders. Loud music. Someone tries to sell you a conveyor belt anyway.'}</p>
        <button className="btn play" onClick={onContinue} autoFocus>See my report card</button>
      </div>
    </div>
  );
}

export interface ReportData {
  score: ScoreBreakdown;
  title: Title;
  miles: number;
  best: number;
  isBest: boolean;
  newAch: Achievement[];
  allAch: Achievement[];
  unlocked: string[];
}

export function ResultsScreen({ s, r, onReplay, onTitle, playerName, lb }: {
  s: GameState; r: ReportData; onReplay: () => void; onTitle: () => void;
  playerName: string; lb: { pending: boolean; id: number | null; error: string | null; retry?: () => void };
}) {
  const [copied, setCopied] = useState('');
  const st = s.stats;
  const lines: [string, string | number][] = [
    ['Miles walked', r.miles.toFixed(1)],
    ['Free drinks', st.drinks],
    ['Free snacks', st.foods],
    ['Useless pens', st.pens],
    ['Salespeople escaped', st.escapes],
    ['Demos endured', st.demos],
    ['VIP invites', s.invites.length],
    ['Actual business leads', st.leads],
    ['Inbox spam acquired', st.spam],
    ['Floor explored', `${Math.round(r.score.explored * 100)}%`],
  ];
  const shareText = `I played EXPO HUSTLE and scored ${r.score.total.toLocaleString()} as "${r.title.title}". ${st.drinks} free drinks, ${st.pens} useless pens, ${st.escapes} salespeople escaped, ${s.invites.length} VIP invites. 9 hours. 800 booths. Free beer somewhere.`;
  const share = async () => {
    try {
      if (navigator.share) { await navigator.share({ title: 'Expo Hustle', text: shareText }); return; }
    } catch { /* fall through to copy */ }
    try {
      await navigator.clipboard.writeText(shareText);
      setCopied('Copied! Paste it anywhere.');
    } catch {
      setCopied('Select the text below and copy it.');
    }
  };
  const max = Math.max(1, r.score.loot, r.score.influence, r.score.survival, r.score.exploration);
  const bars: [string, number, string][] = [['Loot', r.score.loot, 'var(--badge)'], ['Influence', r.score.influence, 'var(--pink)'], ['Survival', r.score.survival, 'var(--mint)'], ['Exploration', r.score.exploration, 'var(--cyan)']];
  return (
    <div className="results-screen">
      <div className="results-inner">
        <div className="report badge-card">
          <div className="badge-hole" aria-hidden />
          <div className="report-stripe">ATTENDEE · {s.arch.name.toUpperCase()}</div>
          <div className="report-name">{playerName || 'YOU'}</div>
          <div className="report-title">{r.title.title}</div>
          <p className="report-caption">{r.title.caption}</p>
          <div className="report-score">
            <span>{r.score.total.toLocaleString()}</span>
            {r.isBest ? <em>NEW BEST!</em> : <small>Best {r.best.toLocaleString()}</small>}
          </div>
          <dl className="report-lines">
            {lines.map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}
          </dl>
          <div className="report-bars">
            {bars.map(([k, v, c]) => (
              <div key={k} className="rbar"><span>{k}</span><div className="rbar-track"><div style={{ width: `${(v / max) * 100}%`, background: c }} /></div><b>{v}</b></div>
            ))}
            {r.score.party > 0 && <div className="muted small">Influence includes +{r.score.party} from after-hours parties.</div>}
          </div>
          <div className="report-foot">{s.endReason === 'left' ? 'Left early. Bold.' : 'Doors closed at 6:00 PM.'} · Floor #{s.seed.toString(36).toUpperCase()}</div>
        </div>
        <div className="results-side">
          <div className="results-buttons">
            <button className="btn play" onClick={onReplay} autoFocus>Again?</button>
            <button className="btn" onClick={share}>Share score</button>
            <button className="btn ghost" onClick={onTitle}>Change attendee type</button>
          </div>
          {copied && <div className="muted small">{copied}</div>}
          {copied.startsWith('Select') && <textarea id="share-text" className="share-text" readOnly value={shareText} />}
          <Leaderboard highlightId={lb.id} myName={playerName} pending={lb.pending} saveError={lb.error} onRetrySave={lb.retry} />
          <h3>Achievements {r.unlocked.length}/{r.allAch.length}</h3>
          <div className="ach-grid">
            {r.allAch.map((a) => {
              const isNew = r.newAch.some((n) => n.id === a.id);
              const got = r.unlocked.includes(a.id);
              return (
                <div key={a.id} className={`ach ${got ? 'got' : ''} ${isNew ? 'new' : ''}`} title={a.desc}>
                  <span aria-hidden>{got ? a.icon : '🔒'}</span>
                  <div><b>{a.name}</b><small>{a.desc}</small></div>
                  {isNew && <em>NEW</em>}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
