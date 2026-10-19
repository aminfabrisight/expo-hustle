import type { Input } from '../systems/state';

/** Collects keyboard + touch input into the simulation's Input shape. Edge-triggered keys are consumed per frame. */
export class InputState {
  private keys = new Set<string>();
  private pressedInteract = false;
  private pressedAction: number | null = null;
  private pressedCancel = false;
  stick = { x: 0, y: 0 };
  touchSprint = false;
  onKey: ((key: string) => void) | null = null;

  private down = (e: KeyboardEvent) => {
    const k = e.key.toLowerCase();
    const target = e.target as HTMLElement | null;
    if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) return;
    if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' '].includes(k)) e.preventDefault();
    if (!e.repeat) {
      if (k === 'e' || k === ' ' || k === 'enter') this.pressedInteract = true;
      if (['1', '2', '3', '4'].includes(k)) this.pressedAction = Number(k) - 1;
      if (k === 'escape') this.pressedCancel = true;
      this.onKey?.(k);
    }
    this.keys.add(k);
  };
  private up = (e: KeyboardEvent) => this.keys.delete(e.key.toLowerCase());
  private blur = () => this.keys.clear();

  attach() {
    window.addEventListener('keydown', this.down);
    window.addEventListener('keyup', this.up);
    window.addEventListener('blur', this.blur);
  }
  detach() {
    window.removeEventListener('keydown', this.down);
    window.removeEventListener('keyup', this.up);
    window.removeEventListener('blur', this.blur);
  }

  interact() { this.pressedInteract = true; }
  action(i: number) { this.pressedAction = i; }
  cancel() { this.pressedCancel = true; }

  read(): Input {
    const k = this.keys;
    let mx = (k.has('d') || k.has('arrowright') ? 1 : 0) - (k.has('a') || k.has('arrowleft') ? 1 : 0);
    let my = (k.has('s') || k.has('arrowdown') ? 1 : 0) - (k.has('w') || k.has('arrowup') ? 1 : 0);
    if (Math.abs(this.stick.x) + Math.abs(this.stick.y) > 0.05) { mx = this.stick.x; my = this.stick.y; }
    const input: Input = {
      mx, my,
      sprint: k.has('shift') || this.touchSprint,
      interact: this.pressedInteract,
      action: this.pressedAction,
      cancel: this.pressedCancel,
    };
    this.pressedInteract = false;
    this.pressedAction = null;
    this.pressedCancel = false;
    return input;
  }

  clearEdges() {
    this.pressedInteract = false;
    this.pressedAction = null;
    this.pressedCancel = false;
  }
}
