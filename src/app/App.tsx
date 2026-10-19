import { useCallback, useEffect, useLayoutEffect, useReducer, useRef, useState } from 'react';
import { Audio } from '../game/audio';
import { Engine } from '../game/engine';
import { InputState } from '../game/input';
import { createGame, dropItem, endRun } from '../systems/game';
import { randomSeed } from '../systems/rng';
import { ACHIEVEMENTS, computeScore, milesWalked, pickTitle } from '../systems/score';
import type { GameState } from '../systems/state';
import type { ArchetypeId } from '../systems/types';
import { ChannelBar, ContextCard, DialogCard, Minimap, Objective, Ticker, Toasts, TopBar } from '../components/HUD';
import { BagPanel, JournalPanel, MapPanel, PauseMenu } from '../components/Panels';
import { PartyScreen, ResultsScreen, TitleScreen, type ReportData } from '../components/Screens';
import { TouchControls } from '../components/Touch';
import { load, save, type Saved } from './storage';

type Screen = 'title' | 'playing' | 'party' | 'results';
type PanelKind = null | 'bag' | 'journal' | 'map' | 'pause';

const isTouchDevice = () => typeof window !== 'undefined' && !!window.matchMedia?.('(pointer: coarse)').matches;

export default function App() {
  const [saved, setSaved] = useState<Saved>(() => load());
  const [screen, setScreen] = useState<Screen>('title');
  const [panel, setPanel] = useState<PanelKind>(null);
  const [report, setReport] = useState<ReportData | null>(null);
  const [touch, setTouch] = useState(isTouchDevice);
  const [runId, setRunId] = useState(0);
  const [, force] = useReducer((x: number) => x + 1, 0);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<Engine | null>(null);
  const inputRef = useRef(new InputState());
  const audioRef = useRef(new Audio());
  const stateRef = useRef<GameState | null>(null);
  const savedRef = useRef(saved);
  savedRef.current = saved;
  const panelRef = useRef(panel);
  panelRef.current = panel;
  const screenRef = useRef(screen);
  screenRef.current = screen;

  const persist = useCallback((patch: Partial<Saved>) => {
    setSaved((prev) => {
      const next = { ...prev, ...patch };
      save(next);
      return next;
    });
  }, []);

  useEffect(() => { audioRef.current.enabled = saved.sound; }, [saved.sound]);
  useEffect(() => { if (engineRef.current) engineRef.current.reducedMotion = saved.reducedMotion; }, [saved.reducedMotion]);
  useEffect(() => { document.documentElement.dataset.motion = saved.reducedMotion ? 'reduced' : 'full'; }, [saved.reducedMotion]);

  // Engine paused whenever a panel is open.
  useEffect(() => { if (engineRef.current) engineRef.current.paused = panel !== null; }, [panel]);

  const finishRun = useCallback((s: GameState) => {
    const sv = savedRef.current;
    const score = computeScore(s);
    const miles = milesWalked(s);
    const title = pickTitle(s.stats, score, s.invites.length, s.player.connections, miles);
    const got = ACHIEVEMENTS.filter((a) => a.test(s)).map((a) => a.id);
    const newIds = got.filter((id) => !sv.achievements.includes(id));
    const unlocked = [...new Set([...sv.achievements, ...got])];
    const isBest = score.total > sv.best;
    const strip = ({ id, name, desc, icon }: (typeof ACHIEVEMENTS)[number]) => ({ id, name, desc, icon });
    setReport({
      score, title, miles, best: Math.max(sv.best, score.total), isBest,
      newAch: ACHIEVEMENTS.filter((a) => newIds.includes(a.id)).map(strip),
      allAch: ACHIEVEMENTS.map(strip),
      unlocked,
    });
    persist({
      best: Math.max(sv.best, score.total),
      bestTitle: isBest ? title.title : sv.bestTitle,
      runs: sv.runs + 1,
      achievements: unlocked,
      tutorialDone: true,
    });
    setPanel(null);
    setScreen(s.invites.length > 0 ? 'party' : 'results');
  }, [persist]);

  const startRun = useCallback(() => {
    audioRef.current.unlock();
    const s = createGame(randomSeed(), savedRef.current.archetype, { tutorial: !savedRef.current.tutorialDone });
    stateRef.current = s;
    // ?debug in the URL exposes the live state for automated smoke tests.
    if (location.search.includes('debug')) (window as unknown as { __expo: GameState }).__expo = s;
    setReport(null);
    setPanel(null);
    setRunId((n) => n + 1);
    setScreen('playing');
  }, []);

  // Boot the engine once the canvas exists for a run.
  useEffect(() => {
    if (screen !== 'playing' || !canvasRef.current || !stateRef.current) return;
    const engine = new Engine(canvasRef.current, inputRef.current, audioRef.current);
    engine.reducedMotion = savedRef.current.reducedMotion;
    engine.onHud = force;
    engine.onEnd = (s) => finishRun(s);
    engineRef.current = engine;
    engine.start(stateRef.current);
    const onResize = () => engine.resize();
    window.addEventListener('resize', onResize);
    return () => {
      engine.stop();
      window.removeEventListener('resize', onResize);
      engineRef.current = null;
    };
  }, [screen, runId, finishRun]);

  // Keyboard shortcuts for panels + pause.
  useEffect(() => {
    const input = inputRef.current;
    input.attach();
    input.onKey = (k) => {
      if (screenRef.current !== 'playing') return;
      const s = stateRef.current;
      const open = panelRef.current;
      if (k === 'escape') {
        if (open) { setPanel(null); return; }
        if (s && (s.channel || s.dialog)) return; // engine handles cancel
        setPanel('pause');
        return;
      }
      if (s?.dialog) return;
      const toggle = (p: PanelKind) => setPanel((cur) => (cur === p ? null : cur === null || cur !== 'pause' ? p : cur));
      if (k === 'i' || k === 'tab' || k === 'b') toggle('bag');
      if (k === 'j') toggle('journal');
      if (k === 'm') toggle('map');
      if (k === 'p') toggle('pause');
    };
    const onTouch = () => setTouch(true);
    window.addEventListener('touchstart', onTouch, { once: true, passive: true });
    const onTab = (e: KeyboardEvent) => { if (e.key === 'Tab' && screenRef.current === 'playing') e.preventDefault(); };
    window.addEventListener('keydown', onTab);
    return () => { input.detach(); window.removeEventListener('keydown', onTab); };
  }, []);

  // Pause when the tab is hidden or the window loses focus (don't punish interruptions).
  useEffect(() => {
    const pause = () => { if (screenRef.current === 'playing' && !panelRef.current) setPanel('pause'); };
    const onVis = () => { if (document.hidden) pause(); };
    document.addEventListener('visibilitychange', onVis);
    window.addEventListener('blur', pause);
    return () => { document.removeEventListener('visibilitychange', onVis); window.removeEventListener('blur', pause); };
  }, []);

  // Tell the renderer how much of the screen the HUD covers so the player stays in the open.
  const hudTopRef = useRef<HTMLDivElement>(null);
  const hudBottomRef = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const e = engineRef.current;
    if (!e) return;
    const top = hudTopRef.current?.offsetHeight ?? 0;
    const bottomCard = hudBottomRef.current ? hudBottomRef.current.offsetHeight : 0;
    const vh = window.innerHeight;
    const bottom = Math.min(vh * 0.45, Math.max(touch ? 170 : 0, bottomCard - 12));
    e.renderer.insets = { top: Math.min(vh * 0.3, top + 6), bottom };
  });

  const s = stateRef.current;

  if (screen === 'title') {
    return (
      <TitleScreen
        arch={saved.archetype} best={saved.best} bestTitle={saved.bestTitle} sound={saved.sound} reducedMotion={saved.reducedMotion}
        onArch={(a: ArchetypeId) => persist({ archetype: a })}
        onPlay={startRun}
        onToggleSound={() => persist({ sound: !saved.sound })}
        onToggleMotion={() => persist({ reducedMotion: !saved.reducedMotion })}
      />
    );
  }
  if (screen === 'party' && s) return <PartyScreen s={s} reduced={saved.reducedMotion} onContinue={() => setScreen('results')} />;
  if (screen === 'results' && s && report) return <ResultsScreen s={s} r={report} onReplay={startRun} onTitle={() => setScreen('title')} />;

  const input = inputRef.current;
  const primary = s?.context?.actions.find((a) => a.enabled);
  const touchLabel = s?.channel?.kind === 'wheel' ? 'STOP!' : s?.channel || s?.dialog ? null : primary ? `${primary.icon} ${primary.label.split(' (')[0]}` : null;

  return (
    <div className={`game ${touch ? 'is-touch' : ''}`}>
      <canvas ref={canvasRef} className="world" aria-label="Expo floor" />
      {s && (
        <>
          <div className="hud-top" ref={hudTopRef}>
            <TopBar s={s} onPause={() => setPanel('pause')} onBag={() => setPanel('bag')} onJournal={() => setPanel('journal')} onMap={() => setPanel('map')} />
            <Ticker s={s} />
            <div className="hud-row">
              <Objective s={s} />
              <Minimap s={s} onOpen={() => setPanel('map')} />
            </div>
          </div>
          <Toasts s={s} />
          <div className="hud-bottom" ref={hudBottomRef}>
            <ChannelBar s={s} onCancel={() => input.cancel()} onStop={() => input.interact()} />
            <ContextCard s={s} touch={touch} onAction={(i) => input.action(i)} />
          </div>
          <DialogCard s={s} onPick={(i) => input.action(i)} />
          {touch && !panel && <TouchControls input={input} actionLabel={touchLabel} />}
          {panel === 'bag' && <BagPanel s={s} onClose={() => setPanel(null)} onDrop={(uid) => { dropItem(s, uid); force(); }} />}
          {panel === 'journal' && <JournalPanel s={s} onClose={() => setPanel(null)} />}
          {panel === 'map' && <MapPanel s={s} onClose={() => setPanel(null)} />}
          {panel === 'pause' && (
            <PauseMenu
              sound={saved.sound} reducedMotion={saved.reducedMotion}
              onResume={() => setPanel(null)}
              onToggleSound={() => persist({ sound: !saved.sound })}
              onToggleMotion={() => persist({ reducedMotion: !saved.reducedMotion })}
              onLeave={() => { setPanel(null); endRun(s, 'left'); }}
              onRestart={startRun}
              onQuit={() => { setPanel(null); setScreen('title'); }}
            />
          )}
        </>
      )}
    </div>
  );
}
