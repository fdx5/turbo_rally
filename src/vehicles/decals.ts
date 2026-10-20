import { BRAND_MODE } from '../core/settings';
import { roundRect } from '../art/textures';

/**
 * Brand decals drawn as vector paths on canvas (§6.2-4). Every brand mark lives here so
 * BRAND_MODE=parody swaps all of them in one place (§7.1 trademark option).
 */
export const parody = () => BRAND_MODE === 'parody';
export type Ctx = CanvasRenderingContext2D;
let regionW = Infinity;
/** Width of the decal region currently being drawn (text auto-shrinks to stay inside). */
export function setRegionW(w: number) {
  regionW = w;
}

const F_ROUND = '"Fredoka", "Jua", "Arial Rounded MT Bold", sans-serif';
const F_KR = '"Jua", "Do Hyeon", sans-serif';
const F_BLOCK = '"Do Hyeon", "Jua", sans-serif';

export function text(g: Ctx, s: string, x: number, y: number, size: number, color: string, o: { font?: string; weight?: number; align?: CanvasTextAlign; stroke?: string; strokeW?: number; italic?: boolean; spacing?: number; maxW?: number } = {}) {
  g.save();
  const font = (sz: number) => `${o.italic ? 'italic ' : ''}${o.weight ?? 700} ${sz}px ${o.font ?? F_KR}`;
  g.font = font(size);
  if (o.spacing) (g as unknown as { letterSpacing: string }).letterSpacing = `${o.spacing}px`;
  const align = o.align ?? 'center';
  const room = align === 'center' ? 2 * Math.min(x, regionW - x) : align === 'left' || align === 'start' ? regionW - x : x;
  const maxW = Math.min(o.maxW ?? Infinity, room * 0.96);
  const mw = g.measureText(s).width;
  if (mw > maxW) {
    size = (size * maxW) / mw;
    g.font = font(size);
  }
  g.textAlign = o.align ?? 'center';
  g.textBaseline = 'middle';
  if (o.stroke) {
    g.lineJoin = 'round';
    g.lineWidth = o.strokeW ?? size * 0.16;
    g.strokeStyle = o.stroke;
    g.strokeText(s, x, y);
  }
  g.fillStyle = color;
  g.fillText(s, x, y);
  g.restore();
}

/** Multi-colour lowercase wordmark (coupang-style). */
export function coupangWordmark(g: Ctx, x: number, y: number, size: number, maxW = Infinity) {
  const word = parody() ? 'cuppang' : 'coupang';
  const cols = ['#8C2E1E', '#E8382D', '#F2A31A', '#8CC63F', '#2EB24B', '#1C9AD6', '#2E5FB0'];
  g.save();
  g.font = `700 ${size}px ${F_ROUND}`;
  const tw = g.measureText(word).width;
  if (tw > maxW) {
    size = (size * maxW) / tw;
    g.font = `700 ${size}px ${F_ROUND}`;
  }
  g.textBaseline = 'middle';
  const widths = [...word].map((ch) => g.measureText(ch).width * 0.96);
  let cx = x - widths.reduce((a, b) => a + b, 0) / 2;
  [...word].forEach((ch, i) => {
    g.fillStyle = cols[i % cols.length];
    g.fillText(ch, cx, y);
    cx += widths[i];
  });
  g.restore();
}

export function rocketIcon(g: Ctx, x: number, y: number, s: number, color = '#3DA9F5') {
  g.save();
  g.translate(x, y);
  g.rotate(-0.6);
  g.fillStyle = color;
  g.beginPath();
  g.moveTo(0, -s);
  g.quadraticCurveTo(s * 0.45, -s * 0.5, s * 0.35, s * 0.45);
  g.lineTo(-s * 0.35, s * 0.45);
  g.quadraticCurveTo(-s * 0.45, -s * 0.5, 0, -s);
  g.fill();
  g.beginPath();
  g.moveTo(-s * 0.35, s * 0.1);
  g.lineTo(-s * 0.65, s * 0.6);
  g.lineTo(-s * 0.3, s * 0.45);
  g.moveTo(s * 0.35, s * 0.1);
  g.lineTo(s * 0.65, s * 0.6);
  g.lineTo(s * 0.3, s * 0.45);
  g.fill();
  g.fillStyle = '#FFFFFF';
  g.beginPath();
  g.arc(0, -s * 0.35, s * 0.15, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = '#FFB067';
  g.beginPath();
  g.moveTo(-s * 0.2, s * 0.5);
  g.quadraticCurveTo(0, s * 1.2, s * 0.2, s * 0.5);
  g.fill();
  g.restore();
}

/** Korea Post-style swallow mark (stylised, drawn with curves). */
export function swallowMark(g: Ctx, x: number, y: number, s: number, color = '#FFFFFF') {
  g.save();
  g.translate(x, y);
  g.fillStyle = color;
  g.beginPath();
  // wings (sweeping arcs)
  g.moveTo(-s, -s * 0.15);
  g.quadraticCurveTo(-s * 0.2, -s * 0.85, s * 0.9, -s * 0.6);
  g.quadraticCurveTo(s * 0.1, -s * 0.45, -s * 0.1, s * 0.05);
  g.quadraticCurveTo(-s * 0.45, -s * 0.2, -s, -s * 0.15);
  g.fill();
  g.beginPath();
  g.moveTo(-s * 0.85, s * 0.35);
  g.quadraticCurveTo(-s * 0.1, -s * 0.2, s * 0.95, s * 0.05);
  g.quadraticCurveTo(s * 0.15, s * 0.15, -s * 0.05, s * 0.55);
  g.quadraticCurveTo(-s * 0.4, s * 0.35, -s * 0.85, s * 0.35);
  g.fill();
  g.restore();
}

export function hyLogo(g: Ctx, x: number, y: number, size: number) {
  text(g, parody() ? 'hi' : 'hy', x, y, size, '#F7931E', { font: F_ROUND, weight: 700 });
}

export function teslaT(g: Ctx, x: number, y: number, s: number, color = '#E31937') {
  g.save();
  g.translate(x, y);
  g.fillStyle = color;
  g.beginPath();
  g.moveTo(-s, -s * 0.75);
  g.quadraticCurveTo(0, -s * 1.0, s, -s * 0.75);
  g.lineTo(s * 0.85, -s * 0.55);
  g.quadraticCurveTo(s * 0.35, -s * 0.72, s * 0.15, -s * 0.6);
  g.lineTo(s * 0.12, s);
  g.lineTo(-s * 0.12, s);
  g.lineTo(-s * 0.15, -s * 0.6);
  g.quadraticCurveTo(-s * 0.35, -s * 0.72, -s * 0.85, -s * 0.55);
  g.closePath();
  g.fill();
  g.restore();
}

/** Angular stencil wordmark. */
export function cyberWord(g: Ctx, x: number, y: number, size: number, color = '#3B3F4A') {
  text(g, parody() ? 'CYBORTRUCK' : 'CYBERTRUCK', x, y, size, color, { font: '"Do Hyeon", sans-serif', weight: 400, spacing: size * 0.25 });
}

export function hyundaiLogo(g: Ctx, x: number, y: number, s: number, color = '#FFFFFF') {
  g.save();
  g.translate(x, y);
  g.strokeStyle = color;
  g.lineWidth = s * 0.14;
  g.beginPath();
  g.ellipse(0, 0, s * 1.4, s * 0.85, 0, 0, Math.PI * 2);
  g.stroke();
  g.fillStyle = color;
  g.transform(1, 0, -0.35, 1, 0, 0);
  g.fillRect(-s * 0.6, -s * 0.55, s * 0.24, s * 1.1);
  g.fillRect(s * 0.36, -s * 0.55, s * 0.24, s * 1.1);
  g.fillRect(-s * 0.4, -s * 0.12, s * 0.8, s * 0.22);
  g.restore();
}

export function starOfLife(g: Ctx, x: number, y: number, s: number) {
  g.save();
  g.translate(x, y);
  g.fillStyle = '#2F80ED';
  for (let i = 0; i < 3; i++) {
    g.save();
    g.rotate((i * Math.PI) / 3);
    roundRect(g, -s * 0.22, -s, s * 0.44, s * 2, s * 0.08);
    g.restore();
  }
  g.strokeStyle = '#FFFFFF';
  g.lineWidth = s * 0.08;
  g.beginPath();
  g.moveTo(0, -s * 0.7);
  g.lineTo(0, s * 0.7);
  g.stroke();
  g.beginPath();
  for (let k = 0; k <= 20; k++) {
    const t = k / 20;
    g.lineTo(Math.sin(t * Math.PI * 3) * s * 0.18, -s * 0.6 + t * s * 1.2);
  }
  g.stroke();
  g.restore();
}

export function policeEmblem(g: Ctx, x: number, y: number, s: number) {
  g.save();
  g.translate(x, y);
  g.fillStyle = '#FFD45E';
  g.beginPath();
  for (let i = 0; i < 10; i++) {
    const r = i % 2 ? s * 0.6 : s;
    const a = (i / 10) * Math.PI * 2 - Math.PI / 2;
    g.lineTo(Math.cos(a) * r, Math.sin(a) * r);
  }
  g.closePath();
  g.fill();
  g.fillStyle = '#1E4FA8';
  g.beginPath();
  g.arc(0, 0, s * 0.45, 0, Math.PI * 2);
  g.fill();
  text(g, '경', 0, s * 0.03, s * 0.55, '#FFFFFF', { font: F_BLOCK, weight: 400 });
  g.restore();
}

export function recycleMark(g: Ctx, x: number, y: number, s: number, color = '#FFFFFF') {
  g.save();
  g.translate(x, y);
  g.strokeStyle = color;
  g.fillStyle = color;
  g.lineWidth = s * 0.22;
  g.lineCap = 'round';
  for (let i = 0; i < 3; i++) {
    g.save();
    g.rotate((i * Math.PI * 2) / 3);
    g.beginPath();
    g.moveTo(-s * 0.5, s * 0.55);
    g.lineTo(s * 0.25, s * 0.55);
    g.stroke();
    g.beginPath();
    g.moveTo(s * 0.55, s * 0.55);
    g.lineTo(s * 0.2, s * 0.25);
    g.lineTo(s * 0.2, s * 0.85);
    g.closePath();
    g.fill();
    g.restore();
  }
  g.restore();
}

export function octagon(g: Ctx, x: number, y: number, s: number, label = 'STOP') {
  g.save();
  g.translate(x, y);
  g.fillStyle = '#FFFFFF';
  g.beginPath();
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2 + Math.PI / 8;
    g.lineTo(Math.cos(a) * s * 1.08, Math.sin(a) * s * 1.08);
  }
  g.fill();
  g.fillStyle = '#F2545B';
  g.beginPath();
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2 + Math.PI / 8;
    g.lineTo(Math.cos(a) * s, Math.sin(a) * s);
  }
  g.fill();
  text(g, label, 0, s * 0.04, s * 0.62, '#FFFFFF', { font: F_ROUND });
  g.restore();
}

export function flame(g: Ctx, x: number, y: number, s: number, cols = ['#FFB3C7', '#FFD6A5', '#FDFFB6']) {
  cols.forEach((c, k) => {
    const sc = 1 - k * 0.28;
    g.fillStyle = c;
    g.beginPath();
    g.moveTo(x, y + s * 0.2 * sc);
    for (let i = 0; i < 4; i++) {
      const fx = x + (i + 1) * s * 0.55 * sc;
      g.quadraticCurveTo(fx - s * 0.3 * sc, y - s * (0.9 - i * 0.12) * sc, fx, y - s * 0.15 * sc);
    }
    g.quadraticCurveTo(x + s * 2.6 * sc, y + s * 0.4 * sc, x + s * 2.0 * sc, y + s * 0.55 * sc);
    g.quadraticCurveTo(x + s * 0.8 * sc, y + s * 0.7 * sc, x, y + s * 0.2 * sc);
    g.fill();
  });
}

export const FONTS = { F_ROUND, F_KR, F_BLOCK };
