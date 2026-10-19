import { step } from '../systems/game';
import type { GameState } from '../systems/state';
import { Renderer } from './renderer';
import type { InputState } from './input';
import type { Audio } from './audio';

/** Owns the frame loop: input -> fixed-ish simulation substeps -> render -> HUD notify. */
export class Engine {
  state: GameState | null = null;
  paused = false;
  reducedMotion = false;
  onHud: (() => void) | null = null;
  onEnd: ((s: GameState) => void) | null = null;
  renderer: Renderer;
  private raf = 0;
  private last = 0;
  private hudT = 0;
  private stepT = 0;
  private ended = false;

  constructor(canvas: HTMLCanvasElement, private input: InputState, private audio: Audio) {
    this.renderer = new Renderer(canvas);
  }

  start(s: GameState) {
    this.state = s;
    this.ended = false;
    this.paused = false;
    this.resize();
    cancelAnimationFrame(this.raf);
    this.last = performance.now();
    this.raf = requestAnimationFrame(this.frame);
  }

  stop() {
    cancelAnimationFrame(this.raf);
  }

  resize() {
    this.renderer.resize();
  }

  private frame = (now: number) => {
    this.raf = requestAnimationFrame(this.frame);
    const s = this.state;
    if (!s) return;
    const realDt = Math.min(0.1, (now - this.last) / 1000);
    let dt = realDt;
    this.last = now;
    if (this.paused) {
      this.input.clearEdges();
      dt = 0;
    } else {
      const input = this.input.read();
      // substep for stable collisions on slow frames; edge inputs only on the first substep
      let first = true;
      while (dt > 0) {
        const d = Math.min(dt, 1 / 30);
        step(s, d, first ? input : { ...input, interact: false, action: null, cancel: false });
        first = false;
        dt -= d;
      }
      for (const snd of s.sounds) this.audio.play(snd);
      s.sounds.length = 0;
      if (s.player.moving) {
        this.stepT += realDt;
        if (this.stepT > (s.player.sprinting ? 0.22 : 0.34)) { this.stepT = 0; this.audio.play('step'); }
      }
    }
    this.renderer.render(s, { reducedMotion: this.reducedMotion, time: now / 1000 });
    this.hudT += 1;
    if (this.hudT >= 5 || this.paused) { this.hudT = 0; this.onHud?.(); }
    if (s.phase === 'ended' && !this.ended) {
      this.ended = true;
      this.onEnd?.(s);
    }
  };
}
