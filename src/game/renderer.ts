import { HALLS } from '../content/booths';
import { item } from '../content/items';
import { CONFIG } from '../systems/config';
import { activeEvents } from '../systems/director';
import { center, type BoothInstance, type ExpoMap, type Fixture } from '../systems/map';
import type { GameEvent, GameState, Npc } from '../systems/state';
import type { HallId } from '../systems/types';
import { ASSETS } from '../assets/assets';

/**
 * Canvas 2D renderer. Reads simulation state, never mutates it.
 * Everything is drawn procedurally; swap ASSETS entries for real art later.
 */
const T = CONFIG.tile;
const SIGN_FONT = '"Bungee", "Arial Black", system-ui, sans-serif';
const UI_FONT = '"Barlow Condensed", "Arial Narrow", system-ui, sans-serif';
const EMOJI_FONT = '"Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif';

export interface RenderOpts {
  reducedMotion: boolean;
  time: number;
}

interface Cam { x: number; y: number; scale: number; w: number; h: number }

export class Renderer {
  private ctx: CanvasRenderingContext2D;
  private fog: HTMLCanvasElement;
  private fogCtx: CanvasRenderingContext2D;
  private fogImg: ImageData | null = null;
  private patterns = new Map<string, CanvasPattern>();
  private dpr = 1;
  cam: Cam = { x: 0, y: 0, scale: 1, w: 1, h: 1 };
  /** Screen space covered by HUD (CSS px). The camera keeps the player inside the free area. */
  insets = { top: 0, bottom: 0 };
  private smoothIn = { top: 0, bottom: 0 };

  constructor(private canvas: HTMLCanvasElement) {
    this.ctx = canvas.getContext('2d', { alpha: false })!;
    this.fog = document.createElement('canvas');
    this.fogCtx = this.fog.getContext('2d')!;
  }

  resize() {
    const r = this.canvas.getBoundingClientRect();
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.canvas.width = Math.max(1, Math.round(r.width * this.dpr));
    this.canvas.height = Math.max(1, Math.round(r.height * this.dpr));
    this.cam.w = r.width;
    this.cam.h = r.height;
    // Show ~24 tiles across on desktop, ~13 on phones; at least 11 tiles tall.
    const across = r.width < 640 ? 13 : 24;
    this.cam.scale = Math.min(r.width / (across * T), r.height / (11 * T));
  }

  private pattern(key: string, base: string, fleck: string): CanvasPattern {
    let p = this.patterns.get(key);
    if (p) return p;
    const c = document.createElement('canvas');
    c.width = c.height = 64;
    const g = c.getContext('2d')!;
    g.fillStyle = base;
    g.fillRect(0, 0, 64, 64);
    // carpet flecks, deterministic
    let seed = key.length * 977;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    g.fillStyle = fleck;
    for (let i = 0; i < 70; i++) g.fillRect(Math.floor(rnd() * 64), Math.floor(rnd() * 64), 2, 2);
    g.globalAlpha = 0.18;
    g.strokeStyle = fleck;
    g.lineWidth = 1;
    g.strokeRect(0.5, 0.5, 63, 63);
    p = this.ctx.createPattern(c, 'repeat')!;
    this.patterns.set(key, p);
    return p;
  }

  render(s: GameState, o: RenderOpts) {
    const { ctx, cam } = this;
    const map = s.map;
    // camera follows player, clamped to the map
    const viewW = cam.w / cam.scale, viewH = cam.h / cam.scale;
    const px = s.player.x * T, py = s.player.y * T;
    this.smoothIn.top += (this.insets.top - this.smoothIn.top) * 0.08;
    this.smoothIn.bottom += (this.insets.bottom - this.smoothIn.bottom) * 0.08;
    const topIn = this.smoothIn.top / cam.scale, botIn = this.smoothIn.bottom / cam.scale;
    const freeH = Math.max(T * 4, viewH - topIn - botIn);
    cam.x = clampC(px - viewW / 2, 0, map.w * T - viewW);
    cam.y = clampC(py - topIn - freeH / 2, -topIn, map.h * T - viewH + botIn);

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#14112a';
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    const k = this.dpr * cam.scale;
    ctx.setTransform(k, 0, 0, k, -cam.x * k, -cam.y * k);

    const tx0 = Math.max(0, Math.floor(cam.x / T) - 1), ty0 = Math.max(0, Math.floor(cam.y / T) - 1);
    const tx1 = Math.min(map.w, Math.ceil((cam.x + viewW) / T) + 1), ty1 = Math.min(map.h, Math.ceil((cam.y + viewH) / T) + 2);

    this.drawFloor(map, tx0, ty0, tx1, ty1);
    this.drawHallSigns(map, s);
    for (const l of map.lounges) this.drawLounge(l);
    const inView = (r: { x: number; y: number; w: number; h: number }) => r.x + r.w >= tx0 && r.x <= tx1 && r.y + r.h >= ty0 && r.y <= ty1;
    for (const f of map.fixtures) if (inView(f.rect)) this.drawFixture(f, s, o);
    for (const b of map.booths) if (inView(b.rect)) this.drawBooth(b, s, o);
    this.drawWalls(map, tx0, ty0, tx1, ty1);

    // events (ground markers) — only what you can actually see right now
    for (const e of activeEvents(s)) {
      if (e.boothIdx < 0) continue;
      if (dist(e.spot.x, e.spot.y, s.player.x, s.player.y) > CONFIG.player.visionRadius + 0.6) continue;
      this.drawEventMarker(e, o);
    }

    // characters, depth-sorted
    const actors: { y: number; draw: () => void }[] = [];
    for (const n of s.npcs) {
      if (n.x * T < cam.x - T || n.x * T > cam.x + viewW + T || n.y * T < cam.y - T || n.y * T > cam.y + viewH + 2 * T) continue;
      actors.push({ y: n.y, draw: () => this.drawNpc(n, o) });
    }
    for (const b of map.booths) {
      if (!b.salesPos) continue;
      const sp = b.salesPos;
      if (sp.x * T < cam.x - T || sp.x * T > cam.x + viewW + T || sp.y * T < cam.y - T || sp.y * T > cam.y + viewH + 2 * T) continue;
      const d = dist(sp.x, sp.y, s.player.x, s.player.y);
      actors.push({ y: sp.y, draw: () => this.drawSalesperson(b, d, s, o) });
    }
    actors.push({ y: s.player.y, draw: () => this.drawPlayer(s, o) });
    actors.sort((a, b) => a.y - b.y);
    for (const a of actors) a.draw();

    this.drawFog(s);
    if (s.crowdVision > 0) this.drawCrowdVision(s, o);

    // floaters & particles above fog
    for (const p of s.particles) {
      if (o.reducedMotion) break;
      ctx.save();
      ctx.translate(p.x * T, p.y * T);
      ctx.rotate(p.rot);
      ctx.globalAlpha = Math.max(0, 1 - p.t / p.life);
      ctx.fillStyle = p.color;
      ctx.fillRect(-3, -1.5, 6, 3);
      ctx.restore();
    }
    for (const f of s.floaters) {
      const a = Math.max(0, 1 - f.t / 1.4);
      ctx.globalAlpha = a;
      ctx.font = `${f.big ? 700 : 600} ${f.big ? 17 : 12}px ${UI_FONT}, ${EMOJI_FONT}`;
      ctx.textAlign = 'center';
      ctx.lineWidth = 3;
      ctx.strokeStyle = 'rgba(20,17,42,0.85)';
      ctx.strokeText(f.text, f.x * T, f.y * T);
      ctx.fillStyle = f.color;
      ctx.fillText(f.text, f.x * T, f.y * T);
      ctx.globalAlpha = 1;
    }

    // screen-space overlays
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    this.drawArrows(s, o);
    this.drawVignette(s);
    this.drawCrowdVisionLabel(s);
  }

  // ------------------------------------------------------------ floor & walls

  private drawFloor(map: ExpoMap, x0: number, y0: number, x1: number, y1: number) {
    const ctx = this.ctx;
    // promenade base
    ctx.fillStyle = this.pattern('prom', '#cfc6e0', '#b9aed0');
    ctx.fillRect(x0 * T, y0 * T, (x1 - x0) * T, (y1 - y0) * T);
    // hall carpets (row runs for speed)
    for (let y = y0; y < y1; y++) {
      let runStart = -1, runHall = 0;
      for (let x = x0; x <= x1; x++) {
        const h = x < x1 ? map.halls[y * map.w + x] : 0;
        if (h !== runHall) {
          if (runHall) {
            const hk = (['A', 'B', 'C', 'D'] as HallId[])[runHall - 1];
            ctx.fillStyle = this.pattern('h' + hk, HALLS[hk].carpet, shade(HALLS[hk].carpet, -18));
            ctx.fillRect(runStart * T, y * T, (x - runStart) * T, T);
          }
          runStart = x; runHall = h;
        }
      }
    }
    // promenade lane stripes
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    ctx.fillRect(38.9 * T, 0, 0.2 * T, map.h * T);
    ctx.fillRect(0, 28.9 * T, map.w * T, 0.2 * T);
    // entrance mat
    ctx.fillStyle = '#2b2546';
    ctx.fillRect(34 * T, (map.h - 3) * T, 10 * T, 2 * T);
    ctx.fillStyle = '#ffd23f';
    ctx.font = `14px ${SIGN_FONT}`;
    ctx.textAlign = 'center';
    ctx.fillText('ENTRANCE · PACKED EXPO', 39 * T, (map.h - 1.8) * T);
  }

  private drawWalls(map: ExpoMap, x0: number, y0: number, x1: number, y1: number) {
    const ctx = this.ctx;
    for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) {
      if (map.tiles[y * map.w + x] !== 1) continue;
      ctx.fillStyle = '#2a2444';
      ctx.fillRect(x * T, y * T, T, T);
      ctx.fillStyle = '#3d3563';
      ctx.fillRect(x * T, y * T, T, 6);
    }
    // entrance doors
    if (y1 >= map.h - 1) {
      ctx.fillStyle = '#7fd8ff';
      for (let i = 0; i < 4; i++) ctx.fillRect((35 + i * 2) * T + 4, (map.h - 1) * T + 6, T * 1.6, 10);
    }
  }

  private drawHallSigns(map: ExpoMap, s: GameState) {
    const ctx = this.ctx;
    const spots: [HallId, number, number][] = [['A', 17.5, 24.5], ['B', 60, 24.5], ['C', 17.5, 33.5], ['D', 60, 33.5]];
    for (const [h, x, y] of spots) {
      const info = HALLS[h];
      ctx.save();
      ctx.font = `20px ${SIGN_FONT}`;
      ctx.textAlign = 'center';
      ctx.globalAlpha = 0.9;
      const label = info.name.toUpperCase();
      const w = ctx.measureText(label).width + 30;
      roundRect(ctx, x * T - w / 2, y * T - 20, w, 30, 6);
      ctx.fillStyle = info.color;
      ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.fillText(label, x * T, y * T + 3);
      ctx.restore();
    }
    void map; void s;
  }

  private drawLounge(r: { x: number; y: number; w: number; h: number }) {
    const ctx = this.ctx;
    ctx.fillStyle = this.pattern('lounge', '#3f8f74', '#367c64');
    roundRect(ctx, r.x * T + 2, r.y * T + 2, r.w * T - 4, r.h * T - 4, 10);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.35)';
    ctx.setLineDash([6, 6]);
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.font = `11px ${SIGN_FONT}`;
    ctx.fillStyle = 'rgba(255,255,255,0.8)';
    ctx.textAlign = 'center';
    ctx.fillText('LOUNGE · REST HERE', (r.x + r.w / 2) * T, (r.y + 3.2) * T);
  }

  // ------------------------------------------------------------ booths

  private drawBooth(b: BoothInstance, s: GameState, o: RenderOpts) {
    const ctx = this.ctx;
    const r = b.rect;
    const x = r.x * T, y = r.y * T, w = r.w * T, h = r.h * T;
    const [bg, fg] = b.profile.colors;
    const facingUp = b.front.length > 0 && b.front[0].y < r.y && !b.profile.island;
    const island = !!b.profile.island;

    // shadow + platform
    ctx.fillStyle = 'rgba(10,8,25,0.35)';
    roundRect(ctx, x + 4, y + 6, w - 2, h - 2, 6);
    ctx.fill();
    ctx.fillStyle = mix(bg, '#ffffff', 0.78);
    roundRect(ctx, x + 2, y + 2, w - 4, h - 4, 6);
    ctx.fill();
    ctx.strokeStyle = shade(bg, -10);
    ctx.lineWidth = 2;
    ctx.stroke();

    if (island) {
      // central tower with a big sign
      const tw = w * 0.6, th = h * 0.42;
      const tx = x + (w - tw) / 2, ty = y + h * 0.22;
      ctx.fillStyle = 'rgba(0,0,0,0.25)';
      roundRect(ctx, tx + 5, ty + 8, tw, th, 8); ctx.fill();
      ctx.fillStyle = bg;
      roundRect(ctx, tx, ty, tw, th, 8); ctx.fill();
      if (b.profile.special === 'fabrisight') {
        // a camera "eye" sweeping the floor
        const t = o.reducedMotion ? 0 : s.elapsed;
        ctx.save();
        ctx.beginPath();
        ctx.moveTo(tx + tw / 2, ty + th + 4);
        const a = Math.sin(t * 1.2) * 0.6 + Math.PI / 2;
        ctx.arc(tx + tw / 2, ty + th + 4, T * 1.4, a - 0.35, a + 0.35);
        ctx.closePath();
        ctx.fillStyle = 'rgba(95,225,255,0.22)';
        ctx.fill();
        ctx.restore();
      }
      this.signText(b.profile.name, tx + tw / 2, ty + th / 2 + 2, tw - 10, fg, 16);
      // counters
      ctx.fillStyle = '#f4f1fa';
      roundRect(ctx, x + 10, y + h - 18, w - 20, 10, 4); ctx.fill();
      roundRect(ctx, x + 10, y + 8, w - 20, 8, 4); ctx.fill();
    } else {
      // back wall + header sign
      const wallY = facingUp ? y + h - 14 : y + 2;
      ctx.fillStyle = shade(bg, -25);
      roundRect(ctx, x + 2, wallY, w - 4, 12, 4); ctx.fill();
      const signH = 20;
      const signY = facingUp ? y + h - 26 : y - 6;
      ctx.fillStyle = 'rgba(0,0,0,0.3)';
      roundRect(ctx, x + 6, signY + 5, w - 8, signH, 4); ctx.fill();
      ctx.fillStyle = bg;
      roundRect(ctx, x + 3, signY, w - 6, signH, 4); ctx.fill();
      this.signText(b.profile.name, x + w / 2, signY + 14, w - 12, fg, 11);
      // counter near the front
      const cy = facingUp ? y + 8 : y + h - 18;
      ctx.fillStyle = '#f4f1fa';
      roundRect(ctx, x + 10, cy, w - 20, 10, 3); ctx.fill();
      ctx.fillStyle = shade(bg, 10);
      ctx.fillRect(x + 10, cy + (facingUp ? 0 : 7), w - 20, 3);
      // a little monitor on the counter
      ctx.fillStyle = '#1b1a2e';
      ctx.fillRect(x + w - 28, cy - 8, 12, 8);
      ctx.fillStyle = '#5fe1ff';
      ctx.fillRect(x + w - 27, cy - 7, 10, 6);
    }

    // booth number on the floor
    ctx.font = `600 10px ${UI_FONT}`;
    ctx.fillStyle = 'rgba(30,25,60,0.75)';
    ctx.textAlign = 'left';
    const numY = island ? y + h - 22 : facingUp ? y + h - 30 : y + 26;
    ctx.fillText(b.number, x + 6, numY);

    if (b.profile.sponsor) {
      ctx.font = `700 9px ${UI_FONT}`;
      const label = b.profile.sponsor.label.toUpperCase();
      const lw = ctx.measureText(label).width + 8;
      ctx.fillStyle = 'rgba(255,255,255,0.92)';
      roundRect(ctx, x + w - lw - 6, numY - 9, lw, 12, 3); ctx.fill();
      ctx.fillStyle = '#5b4f7a';
      ctx.textAlign = 'center';
      ctx.fillText(label, x + w - lw / 2 - 6, numY);
    }

    // freebie on the counter — only drawn if you can see it right now
    const c = center(r);
    const visible = dist(c.x, c.y, s.player.x, s.player.y) < CONFIG.player.visionRadius + 1.5;
    if (visible && b.stock > 0) {
      const icon = ASSETS.itemIcon(item(b.profile.freebie[0]));
      const bob = o.reducedMotion ? 0 : Math.sin(s.elapsed * 3 + b.idx) * 2;
      const iy = island ? y + h - 22 : facingUp ? y + 6 : y + h - 22;
      this.emoji(icon, x + 20, iy + bob, 15);
      if (b.profile.wheel && !b.wheelUsed) this.emoji('🎡', x + w / 2, iy + bob, 14);
    }
    // relationship ring
    if (b.rel > 0 && visible) {
      const rx = x + w - 12, ry = island ? y + 14 : facingUp ? y + h - 40 : y + 36;
      ctx.beginPath();
      ctx.arc(rx, ry, 8, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(20,17,42,0.75)';
      ctx.fill();
      ctx.beginPath();
      ctx.arc(rx, ry, 8, -Math.PI / 2, -Math.PI / 2 + (Math.PI * 2 * b.rel) / 100);
      ctx.strokeStyle = b.invited ? '#ff9ef0' : '#5fe1ff';
      ctx.lineWidth = 3;
      ctx.stroke();
      if (b.invited) this.emoji(b.profile.party && s.invites.some((i) => i.boothIdx === b.idx) ? '🎟️' : '📈', rx, ry + 4, 9);
    }
  }

  private signText(text: string, cx: number, cy: number, maxW: number, color: string, size: number) {
    const ctx = this.ctx;
    ctx.textAlign = 'center';
    ctx.fillStyle = color;
    let fs = size;
    ctx.font = `${fs}px ${SIGN_FONT}`;
    while (ctx.measureText(text).width > maxW && fs > 6) {
      fs -= 0.5;
      ctx.font = `${fs}px ${SIGN_FONT}`;
    }
    ctx.fillText(text, cx, cy);
  }

  private drawFixture(f: Fixture, s: GameState, o: RenderOpts) {
    const ctx = this.ctx;
    const r = f.rect;
    const x = r.x * T, y = r.y * T, w = r.w * T, h = r.h * T;
    const shadow = () => { ctx.fillStyle = 'rgba(10,8,25,0.35)'; roundRect(ctx, x + 3, y + 5, w - 2, h - 2, 5); ctx.fill(); };
    switch (f.kind) {
      case 'kiosk': {
        shadow();
        ctx.fillStyle = '#6b3e26';
        roundRect(ctx, x + 2, y + 2, w - 4, h - 4, 8); ctx.fill();
        ctx.fillStyle = '#ffd9a0';
        roundRect(ctx, x + 6, y + 6, w - 12, 14, 4); ctx.fill();
        ctx.font = `10px ${SIGN_FONT}`;
        ctx.fillStyle = '#6b3e26';
        ctx.textAlign = 'center';
        ctx.fillText('COFFEE', x + w / 2, y + 17);
        if ((f.stock ?? 0) > 0) this.emoji('☕', x + w / 2, y + h - 10 + (o.reducedMotion ? 0 : Math.sin(s.elapsed * 3) * 2), 18);
        break;
      }
      case 'info': {
        shadow();
        ctx.fillStyle = '#ffd23f';
        roundRect(ctx, x + 2, y + 2, w - 4, h - 4, 10); ctx.fill();
        ctx.fillStyle = '#2a2444';
        roundRect(ctx, x + 10, y + 10, w - 20, h - 20, 6); ctx.fill();
        ctx.font = `16px ${SIGN_FONT}`;
        ctx.fillStyle = '#ffd23f';
        ctx.textAlign = 'center';
        ctx.fillText('INFO', x + w / 2, y + h / 2 + 6);
        if (!s.infoVisited) this.emoji('🗺️', x + w / 2, y - 4 + (o.reducedMotion ? 0 : Math.sin(s.elapsed * 2.5) * 3), 18);
        break;
      }
      case 'vip': {
        ctx.fillStyle = '#1b1530';
        roundRect(ctx, x, y, w, h, 6); ctx.fill();
        ctx.fillStyle = '#3a1d4f';
        roundRect(ctx, x + 6, y + 6, w - 12, h - 12, 6); ctx.fill();
        // velvet rope
        ctx.strokeStyle = '#c1121f';
        ctx.lineWidth = 4;
        ctx.beginPath();
        for (let i = 0; i <= 4; i++) {
          const px = x + 8 + (i * (w - 16)) / 4;
          if (i === 0) ctx.moveTo(px, y + h - 4); else ctx.quadraticCurveTo(px - (w - 16) / 8, y + h + 6, px, y + h - 4);
        }
        ctx.stroke();
        ctx.fillStyle = '#d4af37';
        for (let i = 0; i <= 4; i++) { ctx.beginPath(); ctx.arc(x + 8 + (i * (w - 16)) / 4, y + h - 4, 5, 0, Math.PI * 2); ctx.fill(); }
        ctx.font = `18px ${SIGN_FONT}`;
        ctx.fillStyle = '#d4af37';
        ctx.textAlign = 'center';
        ctx.fillText('VIP LOUNGE', x + w / 2, y + h / 2);
        ctx.font = `600 12px ${UI_FONT}`;
        ctx.fillStyle = '#f0d9ff';
        ctx.fillText(s.invites.length ? `You're on the list (${s.invites.length})` : 'Opens 6 PM · Invite only', x + w / 2, y + h / 2 + 18);
        break;
      }
      case 'restroom': {
        ctx.fillStyle = '#3b82c4';
        roundRect(ctx, x - 2, y, w + 4, h, 4); ctx.fill();
        this.emoji('🚻', x + w / 2, y + h / 2 + 6, 18);
        break;
      }
      case 'fountain':
        shadow();
        ctx.fillStyle = '#9ad7f0';
        roundRect(ctx, x + 4, y + 4, w - 8, h - 8, 6); ctx.fill();
        this.emoji('💧', x + w / 2, y + h / 2 + 5, 14);
        break;
      case 'charger':
        shadow();
        ctx.fillStyle = '#334155';
        roundRect(ctx, x + 4, y + 2, w - 8, h - 4, 4); ctx.fill();
        this.emoji('🔌', x + w / 2, y + h / 2 + 5, 14);
        break;
      case 'shuttle':
        ctx.fillStyle = '#ffb703';
        roundRect(ctx, x, y + 2, w, h - 4, 6); ctx.fill();
        this.emoji('🚌', x + w / 2, y + h / 2 + 6, 18);
        ctx.font = `9px ${SIGN_FONT}`;
        ctx.fillStyle = '#fff';
        ctx.textAlign = 'center';
        ctx.fillText('SHUTTLE', x + w / 2, y - 4);
        break;
      case 'sofa':
        ctx.fillStyle = 'rgba(10,8,25,0.3)';
        roundRect(ctx, x + 3, y + 6, w, h, 8); ctx.fill();
        ctx.fillStyle = '#e76f51';
        roundRect(ctx, x + 1, y + 2, w - 2, h - 2, 8); ctx.fill();
        ctx.fillStyle = '#f4a261';
        roundRect(ctx, x + 5, y + 8, w - 10, h - 12, 5); ctx.fill();
        break;
      case 'plant':
        this.emoji('🪴', x + w / 2, y + h / 2 + 8, 22);
        break;
    }
  }

  // ------------------------------------------------------------ events

  private drawEventMarker(e: GameEvent, o: RenderOpts) {
    const ctx = this.ctx;
    const x = e.spot.x * T, y = e.spot.y * T;
    const t = performance.now() / 1000;
    const pulse = o.reducedMotion ? 0.5 : (Math.sin(t * 5) + 1) / 2;
    const live = e.state === 'active';
    ctx.save();
    ctx.beginPath();
    ctx.arc(x, y, T * (0.9 + pulse * 0.25), 0, Math.PI * 2);
    ctx.fillStyle = live ? `rgba(255,210,63,${0.18 + pulse * 0.15})` : 'rgba(150,150,170,0.18)';
    ctx.fill();
    ctx.lineWidth = 3;
    ctx.strokeStyle = live ? '#ffd23f' : '#9a96ad';
    ctx.stroke();
    // timer arc
    const frac = Math.max(0, e.remaining / e.ttl);
    ctx.beginPath();
    ctx.arc(x, y, T * 0.72, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * frac);
    ctx.strokeStyle = frac < 0.3 ? '#ff4d6d' : '#ffffff';
    ctx.lineWidth = 4;
    ctx.stroke();
    ctx.restore();
    this.emoji(live ? e.def.icon : e.kind === 'charcuterie' ? '🥨' : '😩', x, y + 8 - (o.reducedMotion ? 0 : pulse * 3), 24);
    // stock pips
    if (e.maxStock < 50) {
      const n = Math.min(12, e.maxStock);
      for (let i = 0; i < n; i++) {
        ctx.fillStyle = i < e.stock ? '#ffd23f' : 'rgba(255,255,255,0.25)';
        ctx.fillRect(x - n * 3.5 + i * 7, y - T * 1.25, 5, 5);
      }
    }
    ctx.font = `700 12px ${UI_FONT}`;
    ctx.textAlign = 'center';
    ctx.lineWidth = 3;
    ctx.strokeStyle = 'rgba(20,17,42,0.9)';
    const label = live ? `${Math.ceil(e.remaining)}s` : e.kind === 'charcuterie' ? 'CRACKERS ONLY' : 'ALL GONE';
    ctx.strokeText(label, x, y + T * 1.35);
    ctx.fillStyle = live ? '#fff' : '#ffb4a2';
    ctx.fillText(label, x, y + T * 1.35);
  }

  // ------------------------------------------------------------ characters

  private person(x: number, y: number, shirt: string, skin: string, walkT: number, dir: number, opts: { hat?: number; suit?: boolean; scale?: number; outline?: string; hoodie?: boolean; reduced?: boolean } = {}) {
    const ctx = this.ctx;
    const sc = opts.scale ?? 1;
    const bob = opts.reduced ? 0 : Math.abs(Math.sin(walkT * 3.2)) * 2 * sc;
    const leg = opts.reduced ? 0 : Math.sin(walkT * 3.2) * 3 * sc;
    ctx.save();
    ctx.translate(x, y);
    // shadow
    ctx.fillStyle = 'rgba(10,8,25,0.35)';
    ctx.beginPath();
    ctx.ellipse(0, 2, 8 * sc, 3.5 * sc, 0, 0, Math.PI * 2);
    ctx.fill();
    // legs
    ctx.fillStyle = opts.suit ? '#1d1b2e' : '#3a3557';
    ctx.fillRect(-4 * sc + leg * 0.4, -6 * sc, 3 * sc, 7 * sc);
    ctx.fillRect(1 * sc - leg * 0.4, -6 * sc, 3 * sc, 7 * sc);
    // body
    ctx.translate(0, -bob);
    if (opts.outline) {
      ctx.fillStyle = opts.outline;
      roundRect(ctx, -7.5 * sc, -19.5 * sc, 15 * sc, 15 * sc, 5 * sc); ctx.fill();
      ctx.beginPath(); ctx.arc(0, -23 * sc, 7.5 * sc, 0, Math.PI * 2); ctx.fill();
    }
    ctx.fillStyle = shirt;
    roundRect(ctx, -6 * sc, -18 * sc, 12 * sc, 13 * sc, 4 * sc); ctx.fill();
    if (opts.suit) {
      ctx.fillStyle = '#fff';
      ctx.beginPath(); ctx.moveTo(-2 * sc, -18 * sc); ctx.lineTo(2 * sc, -18 * sc); ctx.lineTo(0, -12 * sc); ctx.fill();
      ctx.fillStyle = '#e63946';
      ctx.fillRect(-0.8 * sc, -16 * sc, 1.6 * sc, 6 * sc);
    } else {
      // lanyard + badge
      ctx.strokeStyle = 'rgba(255,255,255,0.85)';
      ctx.lineWidth = 1 * sc;
      ctx.beginPath(); ctx.moveTo(-3 * sc, -18 * sc); ctx.lineTo(0, -11 * sc); ctx.lineTo(3 * sc, -18 * sc); ctx.stroke();
      ctx.fillStyle = '#fff';
      ctx.fillRect(-2 * sc, -11 * sc, 4 * sc, 4 * sc);
    }
    // head
    ctx.fillStyle = skin;
    ctx.beginPath(); ctx.arc(0, -23 * sc, 6 * sc, 0, Math.PI * 2); ctx.fill();
    // eyes (facing)
    ctx.fillStyle = '#1b1a2e';
    ctx.fillRect((dir > 0 ? 1 : -3) * sc, -24 * sc, 1.6 * sc, 2 * sc);
    ctx.fillRect((dir > 0 ? 3.4 : -0.6) * sc, -24 * sc, 1.6 * sc, 2 * sc);
    // hair / hats
    const hat = opts.hat ?? 0;
    if (opts.hoodie) {
      ctx.fillStyle = shirt;
      ctx.beginPath(); ctx.arc(0, -24 * sc, 7 * sc, Math.PI, 0); ctx.fill();
    } else if (hat === 1) {
      ctx.fillStyle = '#ffb703';
      ctx.beginPath(); ctx.arc(0, -25 * sc, 6.5 * sc, Math.PI, 0); ctx.fill();
      ctx.fillRect(-7.5 * sc, -25.5 * sc, 15 * sc, 2 * sc);
    } else if (hat === 2) {
      ctx.fillStyle = '#e63946';
      ctx.beginPath(); ctx.arc(0, -25 * sc, 6 * sc, Math.PI, 0); ctx.fill();
      ctx.fillRect(dir > 0 ? 0 : -9 * sc, -26 * sc, 9 * sc, 2 * sc);
    } else {
      ctx.fillStyle = ['#2b2118', '#4a3222', '#c9a26b', '#1b1a2e', '#8a4b2a', '#d9d9d9'][hat % 6];
      ctx.beginPath(); ctx.arc(0, -25 * sc, 6 * sc, Math.PI * 1.05, -0.05); ctx.fill();
    }
    ctx.restore();
  }

  private drawNpc(n: Npc, o: RenderOpts) {
    const x = n.x * T, y = n.y * T;
    if (n.kind === 'ceo') {
      this.person(x, y, '#2b2d42', n.skin, n.walkT, n.dir, { hoodie: true, reduced: o.reducedMotion });
      this.ctx.fillStyle = '#000';
      this.ctx.fillRect(x - 5, y - 25, 10, 3);
    } else if (n.kind === 'scanner') {
      this.person(x, y, '#ff006e', n.skin, n.walkT, n.dir, { hat: 2, reduced: o.reducedMotion });
    } else if (n.kind === 'celebrity') {
      this.person(x, y, '#ffd23f', n.skin, o.reducedMotion ? 0 : n.walkT * 0.3, 1, { hat: 1, scale: 1.15, outline: '#ffffff', reduced: o.reducedMotion });
    } else {
      this.person(x, y, n.color, n.skin, n.walkT, n.dir, { hat: n.hat, reduced: o.reducedMotion });
    }
    if (n.emote) this.bubble(x, y - 38, n.emote, n.kind === 'rumor' || n.kind === 'ceo' ? '#ffffff' : 'rgba(255,255,255,0.92)');
  }

  private drawSalesperson(b: BoothInstance, d: number, s: GameState, o: RenderOpts) {
    const sp = b.salesPos!;
    const x = sp.x * T, y = sp.y * T;
    const warn = d < CONFIG.interact.salesWarnRange && b.salesCooldown <= 0;
    const t = o.reducedMotion ? 0 : s.elapsed;
    this.person(x, y, '#1d1b2e', '#e0ac69', warn ? t * 2 : 0, s.player.x < sp.x ? -1 : 1, { suit: true, reduced: o.reducedMotion });
    if (warn) {
      this.bubble(x, y - 38, s.blitzHall === b.hall ? '📢' : '👋', '#ffe3e3');
      // danger halo
      const ctx = this.ctx;
      ctx.beginPath();
      ctx.arc(x, y, CONFIG.interact.salesTriggerRange * (s.blitzHall === b.hall ? 1.6 : 1) * T, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(255,77,109,0.55)';
      ctx.setLineDash([5, 5]);
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.setLineDash([]);
    }
  }

  private drawPlayer(s: GameState, o: RenderOpts) {
    const p = s.player;
    const x = p.x * T, y = p.y * T;
    const ctx = this.ctx;
    // ring
    ctx.beginPath();
    ctx.ellipse(x, y + 2, 13, 6, 0, 0, Math.PI * 2);
    ctx.strokeStyle = '#ffd23f';
    ctx.lineWidth = 2.5;
    ctx.stroke();
    if (p.sprinting && !o.reducedMotion) {
      ctx.fillStyle = 'rgba(255,255,255,0.5)';
      for (let i = 0; i < 3; i++) {
        ctx.beginPath();
        ctx.arc(x - p.facing * (10 + i * 6), y - 2 + Math.sin(s.elapsed * 30 + i) * 2, 3 - i * 0.7, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    this.person(x, y, '#ffb703', '#f1c27d', p.walkT, p.facing, { scale: 1.12, outline: '#1b1a2e', hoodie: false, hat: 4, reduced: o.reducedMotion });
    ctx.font = `700 10px ${SIGN_FONT}`;
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffd23f';
    ctx.strokeStyle = '#1b1a2e';
    ctx.lineWidth = 3;
    ctx.strokeText('YOU', x, y - 36);
    ctx.fillText('YOU', x, y - 36);
    if (p.energy < CONFIG.player.lowEnergy) this.emoji('💦', x + 12, y - 30 + (o.reducedMotion ? 0 : Math.sin(s.elapsed * 6) * 2), 12);
    else if (p.coffeeBuff > 0) this.emoji('⚡', x + 12, y - 30, 11);
    if (p.bladder >= CONFIG.player.bladderUrgent) this.emoji('🚻', x - 13, y - 30, 11);
    if (p.resting) this.emoji('💤', x + 12, y - 32, 12);
    // channel progress over head
    const c = s.channel;
    if (c) {
      const w = 44;
      ctx.fillStyle = 'rgba(20,17,42,0.85)';
      roundRect(ctx, x - w / 2, y - 54, w, 8, 4); ctx.fill();
      ctx.fillStyle = c.kind === 'demo' || c.kind === 'stunned' ? '#ff4d6d' : '#5fe1ff';
      roundRect(ctx, x - w / 2 + 1, y - 53, (w - 2) * Math.min(1, c.t / c.dur), 6, 3); ctx.fill();
    }
  }

  private bubble(x: number, y: number, text: string, bg: string) {
    const ctx = this.ctx;
    ctx.fillStyle = bg;
    roundRect(ctx, x - 11, y - 11, 22, 18, 7); ctx.fill();
    ctx.beginPath(); ctx.moveTo(x - 3, y + 6); ctx.lineTo(x, y + 11); ctx.lineTo(x + 3, y + 6); ctx.fill();
    if (text === '!') {
      ctx.font = `14px ${SIGN_FONT}`;
      ctx.fillStyle = '#e63946';
      ctx.textAlign = 'center';
      ctx.fillText('!', x, y + 4);
    } else this.emoji(text, x, y + 4, 12);
  }

  private emoji(e: string, x: number, y: number, size: number) {
    const ctx = this.ctx;
    ctx.font = `${size}px ${EMOJI_FONT}`;
    ctx.textAlign = 'center';
    ctx.fillStyle = '#000';
    ctx.fillText(e, x, y);
  }

  // ------------------------------------------------------------ fog & overlays

  private drawFog(s: GameState) {
    // Fog at 3 samples per tile for soft edges; unexplored = dark, explored-but-not-visible = dim.
    const map = s.map;
    const SUB = 3;
    const fw = map.w * SUB, fh = map.h * SUB;
    if (this.fog.width !== fw) { this.fog.width = fw; this.fog.height = fh; this.fogImg = null; }
    if (!this.fogImg) this.fogImg = this.fogCtx.createImageData(fw, fh);
    const d = this.fogImg.data;
    const R = CONFIG.player.visionRadius;
    const px = s.player.x * SUB, py = s.player.y * SUB;
    const Rs = R * SUB, edge = 2 * SUB;
    for (let y = 0; y < fh; y++) {
      const ty = (y / SUB) | 0;
      for (let x = 0; x < fw; x++) {
        // bilinear blend of the four nearest tile "revealed" flags -> soft explored edges
        const fx = (x + 0.5) / SUB - 0.5, fy = (y + 0.5) / SUB - 0.5;
        const x0 = Math.max(0, Math.floor(fx)), y0 = Math.max(0, Math.floor(fy));
        const x1 = Math.min(map.w - 1, x0 + 1), y1 = Math.min(map.h - 1, y0 + 1);
        const ax = Math.min(1, Math.max(0, fx - x0)), ay = Math.min(1, Math.max(0, fy - y0));
        const rv = (s.revealed[y0 * map.w + x0] * (1 - ax) + s.revealed[y0 * map.w + x1] * ax) * (1 - ay)
          + (s.revealed[y1 * map.w + x0] * (1 - ax) + s.revealed[y1 * map.w + x1] * ax) * ay;
        const dd = Math.hypot(x + 0.5 - px, y + 0.5 - py);
        const vis = dd < Rs - edge ? 0 : dd < Rs ? ((dd - (Rs - edge)) / edge) * 120 : 120;
        const a = 235 * (1 - rv) + vis * rv;
        void ty;
        const o = (y * fw + x) * 4;
        d[o] = 20; d[o + 1] = 17; d[o + 2] = 42; d[o + 3] = a;
      }
    }
    this.fogCtx.putImageData(this.fogImg, 0, 0);
    const ctx = this.ctx;
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(this.fog, 0, 0, map.w * T, map.h * T);
  }

  private drawCrowdVision(s: GameState, o: RenderOpts) {
    // Fictional "AI camera" overlay: heat blobs on dense aisles + detection boxes on in-game attendees.
    const ctx = this.ctx;
    const map = s.map;
    const R = 26;
    const a = Math.min(1, s.crowdVision / 1.2);
    const cx = s.player.x, cy = s.player.y;
    ctx.save();
    ctx.globalAlpha = a;
    ctx.fillStyle = 'rgba(4,20,36,0.55)';
    ctx.fillRect((cx - R) * T, (cy - R) * T, R * 2 * T, R * 2 * T);
    // grid
    ctx.strokeStyle = 'rgba(95,225,255,0.12)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let x = Math.floor(cx - R); x <= cx + R; x += 2) { ctx.moveTo(x * T, (cy - R) * T); ctx.lineTo(x * T, (cy + R) * T); }
    for (let y = Math.floor(cy - R); y <= cy + R; y += 2) { ctx.moveTo((cx - R) * T, y * T); ctx.lineTo((cx + R) * T, y * T); }
    ctx.stroke();
    // heat: 3x3 density per tile
    ctx.globalCompositeOperation = 'lighter';
    for (let y = Math.max(1, Math.floor(cy - R)); y < Math.min(map.h - 1, cy + R); y++) {
      for (let x = Math.max(1, Math.floor(cx - R)); x < Math.min(map.w - 1, cx + R); x++) {
        const c = s.crowd[y * map.w + x];
        if (c < 1) continue;
        let dens = 0;
        for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) dens += s.crowd[(y + dy) * map.w + x + dx];
        const col = dens >= 6 ? '255,60,90' : dens >= 3 ? '255,170,40' : '60,200,255';
        const rad = T * (1.2 + Math.min(dens, 8) * 0.35);
        const g = ctx.createRadialGradient((x + 0.5) * T, (y + 0.5) * T, 0, (x + 0.5) * T, (y + 0.5) * T, rad);
        g.addColorStop(0, `rgba(${col},${dens >= 6 ? 0.75 : 0.5})`);
        g.addColorStop(1, `rgba(${col},0)`);
        ctx.fillStyle = g;
        ctx.fillRect((x + 0.5) * T - rad, (y + 0.5) * T - rad, rad * 2, rad * 2);
      }
    }
    ctx.globalCompositeOperation = 'source-over';
    // detection boxes
    ctx.font = `700 9px ${UI_FONT}`;
    ctx.textAlign = 'left';
    for (const n of s.npcs) {
      if (Math.abs(n.x - cx) > R || Math.abs(n.y - cy) > R) continue;
      const bx = n.x * T - 9, by = n.y * T - 32;
      ctx.strokeStyle = n.kind === 'attendee' ? 'rgba(95,225,255,0.9)' : '#ff9ef0';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(bx, by, 18, 34);
      ctx.fillStyle = ctx.strokeStyle;
      ctx.fillText(n.kind === 'attendee' ? 'attendee' : n.kind === 'ceo' ? 'hoodie ⚠' : n.kind, bx, by - 3);
    }
    for (const e of activeEvents(s)) {
      if (dist(e.spot.x, e.spot.y, cx, cy) > R || e.state !== 'active') continue;
      ctx.strokeStyle = '#ffd23f';
      ctx.lineWidth = 3;
      ctx.strokeRect(e.spot.x * T - 22, e.spot.y * T - 22, 44, 44);
      this.emoji(e.def.icon, e.spot.x * T, e.spot.y * T + 8, 22);
      ctx.font = `700 12px ${UI_FONT}`;
      ctx.fillStyle = '#ffd23f';
      ctx.textAlign = 'center';
      ctx.fillText(`${e.def.title.toUpperCase()} · ${Math.ceil(e.remaining)}s`, e.spot.x * T, e.spot.y * T - 28);
    }
    if (!o.reducedMotion) {
      const sy = (cy - R + ((s.elapsed * 16) % (R * 2))) * T;
      ctx.fillStyle = 'rgba(95,225,255,0.3)';
      ctx.fillRect((cx - R) * T, sy, R * 2 * T, 3);
    }
    ctx.restore();
  }

  /** Screen-space label for the FabriSight overlay. */
  private drawCrowdVisionLabel(s: GameState) {
    if (s.crowdVision <= 0) return;
    const ctx = this.ctx;
    const { w, h } = this.cam;
    const text = `FABRISIGHT CROWD VISION · SIMULATED · ${Math.ceil(s.crowdVision)}s`;
    ctx.font = `700 13px ${UI_FONT}`;
    const tw = ctx.measureText(text).width + 20;
    const y = h - this.smoothIn.bottom - 34;
    ctx.fillStyle = 'rgba(4,20,36,0.85)';
    roundRect(ctx, w / 2 - tw / 2, y, tw, 24, 6); ctx.fill();
    ctx.strokeStyle = '#5fe1ff';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.fillStyle = '#5fe1ff';
    ctx.textAlign = 'center';
    ctx.fillText(text, w / 2, y + 16);
  }

  private drawArrows(s: GameState, o: RenderOpts) {
    const ctx = this.ctx;
    const { cam } = this;
    const margin = 34;
    for (const e of activeEvents(s)) {
      if (e.known !== 'exact' || e.playerClaimed || e.state !== 'active' || e.kind === 'demoblitz') continue;
      const sx = (e.spot.x * T - cam.x) * cam.scale, sy = (e.spot.y * T - cam.y) * cam.scale;
      const top = this.smoothIn.top + margin, bot = cam.h - this.smoothIn.bottom - margin;
      if (sx > margin && sx < cam.w - margin && sy > top && sy < bot) continue;
      const cx = cam.w / 2, cy = (top + bot) / 2;
      const ang = Math.atan2(sy - cy, sx - cx);
      const hw = cam.w / 2 - margin, hh = Math.max(20, (bot - top) / 2);
      const k = Math.min(hw / Math.abs(Math.cos(ang) || 1e-6), hh / Math.abs(Math.sin(ang) || 1e-6));
      const ax = cx + Math.cos(ang) * k, ay = cy + Math.sin(ang) * k;
      const pulse = o.reducedMotion ? 0 : Math.sin(performance.now() / 160) * 2;
      ctx.save();
      ctx.translate(ax, ay);
      ctx.fillStyle = e.remaining < 8 ? '#ff4d6d' : '#ffd23f';
      ctx.beginPath(); ctx.arc(0, 0, 18 + pulse, 0, Math.PI * 2); ctx.fill();
      ctx.rotate(ang);
      ctx.beginPath(); ctx.moveTo(26 + pulse, 0); ctx.lineTo(16, -7); ctx.lineTo(16, 7); ctx.fill();
      ctx.restore();
      this.emoji(e.def.icon, ax, ay + 6, 17);
      const m = Math.round(dist(e.spot.x, e.spot.y, s.player.x, s.player.y) * CONFIG.metersPerTile);
      ctx.font = `700 11px ${UI_FONT}`;
      ctx.textAlign = 'center';
      ctx.fillStyle = '#fff';
      ctx.strokeStyle = 'rgba(20,17,42,0.9)';
      ctx.lineWidth = 3;
      const label = `${m}m · ${Math.ceil(e.remaining)}s`;
      ctx.strokeText(label, ax, ay + 32);
      ctx.fillText(label, ax, ay + 32);
    }
  }

  private drawVignette(s: GameState) {
    const ctx = this.ctx;
    const { w, h } = this.cam;
    const low = s.player.energy < CONFIG.player.lowEnergy;
    if (!low) return;
    const g = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.3, w / 2, h / 2, Math.max(w, h) * 0.75);
    g.addColorStop(0, 'rgba(0,0,0,0)');
    g.addColorStop(1, 'rgba(120,0,30,0.45)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  }
}

// ------------------------------------------------------------ minimap (shared by HUD + full map)

export function drawMinimap(ctx: CanvasRenderingContext2D, s: GameState, w: number, h: number, full: boolean) {
  const map = s.map;
  const k = Math.min(w / map.w, h / map.h);
  const ox = (w - map.w * k) / 2, oy = (h - map.h * k) / 2;
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = '#14112a';
  ctx.fillRect(0, 0, w, h);
  const knowLayout = s.infoVisited;
  for (let y = 0; y < map.h; y++) for (let x = 0; x < map.w; x++) {
    const i = y * map.w + x;
    const seen = s.revealed[i];
    if (!seen && !knowLayout) continue;
    const t = map.tiles[i];
    const hall = map.halls[i];
    let c = t === 1 ? '#3d3563' : t === 2 ? '#e8e2f5' : t === 3 ? '#ffd23f' : hall ? ['#3b5f9e', '#9e4a3b', '#2f7d63', '#6e4a92'][hall - 1] : '#8f86a8';
    if (map.lounge[i] && t === 0) c = '#3f8f74';
    ctx.globalAlpha = seen ? 1 : 0.4;
    ctx.fillStyle = c;
    ctx.fillRect(ox + x * k, oy + y * k, Math.ceil(k), Math.ceil(k));
  }
  ctx.globalAlpha = 1;
  if (full) {
    ctx.font = `600 ${Math.max(9, k * 1.6)}px ${UI_FONT}`;
    ctx.textAlign = 'center';
    for (const b of map.booths) {
      if (!b.discovered) continue;
      const c = center(b.rect);
      ctx.fillStyle = '#2a2444';
      ctx.fillText(b.profile.name.length > 14 ? b.profile.name.slice(0, 13) + '…' : b.profile.name, ox + c.x * k, oy + c.y * k + 3);
      if (s.cluesKnown.has(b.idx) && b.profile.party) { ctx.font = `${k * 2.4}px ${EMOJI_FONT}`; ctx.fillText('🎉', ox + c.x * k, oy + (c.y - 1.2) * k); ctx.font = `600 ${Math.max(9, k * 1.6)}px ${UI_FONT}`; }
    }
    for (const f of map.fixtures) {
      const icon = { kiosk: '☕', info: 'ℹ️', restroom: '🚻', shuttle: '🚌', vip: '🥂', fountain: '💧', charger: '🔌' }[f.kind as string];
      if (!icon) continue;
      const c = center(f.rect);
      if (!s.revealed[Math.floor(c.y) * map.w + Math.floor(c.x)] && !knowLayout) continue;
      ctx.font = `${k * 2.2}px ${EMOJI_FONT}`;
      ctx.fillText(icon, ox + c.x * k, oy + c.y * k + k * 0.8);
    }
  }
  // events
  for (const e of activeEvents(s)) {
    if (e.state !== 'active' || e.playerClaimed) continue;
    if (e.known === 'exact') {
      ctx.font = `${full ? k * 3 : 11}px ${EMOJI_FONT}`;
      ctx.textAlign = 'center';
      ctx.fillText(e.def.icon, ox + e.spot.x * k, oy + e.spot.y * k + 4);
    } else if (e.known === 'hall') {
      const c = { A: [18, 13], B: [60, 13], C: [18, 44], D: [60, 44] }[e.hall];
      ctx.fillStyle = 'rgba(255,210,63,0.25)';
      ctx.beginPath(); ctx.arc(ox + c[0] * k, oy + c[1] * k, k * 9, 0, Math.PI * 2); ctx.fill();
      ctx.font = `${full ? k * 3 : 10}px ${EMOJI_FONT}`;
      ctx.textAlign = 'center';
      ctx.fillText('❓', ox + c[0] * k, oy + c[1] * k + 4);
    }
  }
  // player
  ctx.fillStyle = '#ffd23f';
  ctx.strokeStyle = '#14112a';
  ctx.lineWidth = 2;
  ctx.beginPath(); ctx.arc(ox + s.player.x * k, oy + s.player.y * k, Math.max(3, k * 1.1), 0, Math.PI * 2); ctx.fill(); ctx.stroke();
}

// ------------------------------------------------------------ helpers

function clampC(v: number, a: number, b: number) {
  return b < a ? (a + b) / 2 : Math.max(a, Math.min(b, v));
}
function dist(ax: number, ay: number, bx: number, by: number) {
  return Math.hypot(ax - bx, ay - by);
}
export function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function parseColor(c: string): [number, number, number] {
  if (c.startsWith('#')) {
    let h = c.slice(1);
    if (h.length === 3) h = h.split('').map((x) => x + x).join('');
    return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
  }
  const m = c.match(/hsl\((\d+)\s+(\d+)%\s+(\d+)%\)/);
  if (m) return hslToRgb(+m[1], +m[2] / 100, +m[3] / 100);
  return [128, 128, 128];
}
function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  const k = (n: number) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return [Math.round(f(0) * 255), Math.round(f(8) * 255), Math.round(f(4) * 255)];
}
const colorCache = new Map<string, string>();
function shade(c: string, amt: number) {
  const key = c + amt;
  let r = colorCache.get(key);
  if (!r) {
    const [R, G, B] = parseColor(c);
    const f = (v: number) => Math.max(0, Math.min(255, Math.round(v + (amt / 100) * 255)));
    r = `rgb(${f(R)},${f(G)},${f(B)})`;
    colorCache.set(key, r);
  }
  return r;
}
function mix(a: string, b: string, t: number) {
  const key = a + b + t;
  let r = colorCache.get(key);
  if (!r) {
    const A = parseColor(a), B = parseColor(b);
    r = `rgb(${A.map((v, i) => Math.round(v + (B[i] - v) * t)).join(',')})`;
    colorCache.set(key, r);
  }
  return r;
}
