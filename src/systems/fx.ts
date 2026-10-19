import type { GameState, Toast } from './state';

/** Feedback helpers. They only append to state queues; the UI/audio layers drain them. */
export function toast(s: GameState, text: string, icon = '💬', tone: Toast['tone'] = 'info') {
  s.toasts.push({ id: s.nextId++, text, icon, tone, t: 0 });
  if (s.toasts.length > 4) s.toasts.splice(0, s.toasts.length - 4);
}

export function floater(s: GameState, text: string, color = '#fff', big = false, x = s.player.x, y = s.player.y - 0.9) {
  // Stack simultaneous popups instead of drawing them on top of each other.
  const fresh = s.floaters.filter((f) => f.t < 0.25).length;
  s.floaters.push({ x, y: y - fresh * 0.55, text, color, t: 0, big });
}

export function sound(s: GameState, name: string) {
  if (s.sounds.length < 12) s.sounds.push(name);
}

export function tick(s: GameState, text: string, urgent = false) {
  if (urgent) s.ticker.queue.unshift(text);
  else s.ticker.queue.push(text);
  if (s.ticker.queue.length > 6) s.ticker.queue.length = 6;
}

const CONFETTI = ['#ff3d7f', '#ffd23f', '#3ec1ff', '#6bff8f', '#b67bff', '#ff8a3d'];

export function confetti(s: GameState, x = s.player.x, y = s.player.y, n = 40) {
  for (let i = 0; i < n; i++) {
    const a = s.rng.range(0, Math.PI * 2);
    const v = s.rng.range(2, 7);
    s.particles.push({ x, y: y - 0.5, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 4, color: s.rng.pick(CONFETTI), t: 0, life: s.rng.range(0.9, 1.6), rot: s.rng.range(0, 6) });
  }
}

export function fmt(template: string, vars: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? '');
}
