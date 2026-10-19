/** Tiny procedural WebAudio sound kit — no files to download. Starts after first user gesture. */
type Note = [freq: number, dur: number, type?: OscillatorType, gain?: number, slideTo?: number];

const SOUNDS: Record<string, Note[]> = {
  pickup: [[660, 0.06, 'square', 0.06], [990, 0.08, 'square', 0.05]],
  rare: [[523, 0.08, 'triangle', 0.09], [659, 0.08, 'triangle', 0.09], [784, 0.08, 'triangle', 0.09], [1047, 0.18, 'triangle', 0.09]],
  fanfare: [[392, 0.1, 'square', 0.06], [523, 0.1, 'square', 0.06], [659, 0.1, 'square', 0.06], [784, 0.12, 'square', 0.06], [1047, 0.3, 'triangle', 0.08]],
  alert: [[880, 0.07, 'sine', 0.08], [0, 0.04], [880, 0.07, 'sine', 0.08], [1175, 0.12, 'sine', 0.08]],
  blip: [[740, 0.05, 'sine', 0.06]],
  warn: [[300, 0.12, 'sawtooth', 0.04], [240, 0.16, 'sawtooth', 0.04]],
  fail: [[392, 0.14, 'triangle', 0.08], [370, 0.14, 'triangle', 0.08], [349, 0.14, 'triangle', 0.08], [330, 0.4, 'triangle', 0.08, 300]],
  sales: [[784, 0.12, 'sine', 0.08], [622, 0.2, 'sine', 0.08]],
  escape: [[400, 0.12, 'square', 0.04, 1200]],
  whoosh: [[200, 0.35, 'sawtooth', 0.03, 900]],
  drop: [[220, 0.08, 'square', 0.04, 120]],
  end: [[523, 0.12, 'triangle', 0.08], [392, 0.12, 'triangle', 0.08], [523, 0.3, 'triangle', 0.08]],
  step: [[120, 0.025, 'triangle', 0.025]],
};

export class Audio {
  private ctx: AudioContext | null = null;
  enabled = true;

  unlock() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') void this.ctx.resume();
      return;
    }
    try {
      const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new AC();
    } catch {
      this.ctx = null;
    }
  }

  play(name: string) {
    if (!this.enabled || !this.ctx) return;
    const notes = SOUNDS[name];
    if (!notes) return;
    const ac = this.ctx;
    let t = ac.currentTime;
    for (const [f, d, type = 'sine', g = 0.06, slide] of notes) {
      if (f > 0) {
        const o = ac.createOscillator();
        const gain = ac.createGain();
        o.type = type;
        o.frequency.setValueAtTime(f, t);
        if (slide) o.frequency.exponentialRampToValueAtTime(slide, t + d);
        gain.gain.setValueAtTime(g, t);
        gain.gain.exponentialRampToValueAtTime(0.0001, t + d);
        o.connect(gain).connect(ac.destination);
        o.start(t);
        o.stop(t + d + 0.02);
      }
      t += d;
    }
  }
}
