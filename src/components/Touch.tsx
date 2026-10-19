import { useRef, useState } from 'react';
import type { InputState } from '../game/input';

/** On-screen thumbstick + SPRINT + ACTION for touch devices. */
export function TouchControls({ input, actionLabel }: { input: InputState; actionLabel: string | null }) {
  const base = useRef<HTMLDivElement>(null);
  const [knob, setKnob] = useState({ x: 0, y: 0 });
  const pid = useRef<number | null>(null);
  const [sprint, setSprint] = useState(false);

  const move = (e: React.PointerEvent) => {
    const el = base.current;
    if (!el || pid.current !== e.pointerId) return;
    const r = el.getBoundingClientRect();
    const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    let dx = e.clientX - cx, dy = e.clientY - cy;
    const max = r.width / 2;
    const len = Math.hypot(dx, dy);
    if (len > max) { dx = (dx / len) * max; dy = (dy / len) * max; }
    setKnob({ x: dx, y: dy });
    const nx = dx / max, ny = dy / max;
    const dead = Math.hypot(nx, ny) < 0.15;
    input.stick.x = dead ? 0 : nx;
    input.stick.y = dead ? 0 : ny;
  };
  const end = (e: React.PointerEvent) => {
    if (pid.current !== e.pointerId) return;
    pid.current = null;
    setKnob({ x: 0, y: 0 });
    input.stick.x = 0;
    input.stick.y = 0;
  };

  return (
    <div className="touch">
      <div
        className="stick"
        ref={base}
        onPointerDown={(e) => { pid.current = e.pointerId; (e.target as HTMLElement).setPointerCapture(e.pointerId); move(e); }}
        onPointerMove={move}
        onPointerUp={end}
        onPointerCancel={end}
        aria-label="Movement stick"
      >
        <div className="knob" style={{ transform: `translate(${knob.x}px, ${knob.y}px)` }} />
      </div>
      <div className="touch-buttons">
        <button
          className={`tbtn sprint ${sprint ? 'on' : ''}`}
          onPointerDown={(e) => { e.preventDefault(); input.touchSprint = true; setSprint(true); }}
          onPointerUp={() => { input.touchSprint = false; setSprint(false); }}
          onPointerCancel={() => { input.touchSprint = false; setSprint(false); }}
          onPointerLeave={() => { input.touchSprint = false; setSprint(false); }}
        >SPRINT</button>
        <button className="tbtn act-btn" disabled={!actionLabel} onPointerDown={(e) => { e.preventDefault(); input.interact(); }}>
          {actionLabel ?? 'ACTION'}
        </button>
      </div>
    </div>
  );
}
