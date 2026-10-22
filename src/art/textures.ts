import * as THREE from 'three';
import { Rng } from '../core/rng';

export function canvas(w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return [c, c.getContext('2d')!];
}
export function tex(c: HTMLCanvasElement, repeat = false, srgb = true): THREE.CanvasTexture {
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 16;
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.generateMipmaps = true;
  t.minFilter = THREE.LinearMipmapLinearFilter;
  return t;
}

/** Road surface: pastel asphalt with speckles, white edge lines and dashed centre. u = along, v = across. */
export function roadTexture(o: { base: string; speck: string; line: string; edge: string; rainbow?: boolean }, seed = 1) {
  const S = 1024;
  const [c, g] = canvas(S, S);
  const r = new Rng(seed);
  if (o.rainbow) {
    const cols = ['#FF6B6B', '#FFA94D', '#FFD43B', '#69DB7C', '#4DABF7', '#9775FA', '#F783AC'];
    const h = S / cols.length;
    cols.forEach((col, i) => {
      g.fillStyle = col;
      g.fillRect(0, i * h, S, h + 1);
    });
    g.globalAlpha = 0.18;
    for (let i = 0; i < 2400; i++) {
      g.fillStyle = '#FFFFFF';
      g.fillRect(r.range(0, S), r.range(0, S), r.range(1, 3), r.range(1, 3));
    }
    g.globalAlpha = 1;
  } else {
    g.fillStyle = o.base;
    g.fillRect(0, 0, S, S);
    // fine asphalt grain (two scales)
    for (let i = 0; i < 26000; i++) {
      const light = r.chance(0.5);
      g.fillStyle = light ? '#FFFFFF' : o.speck;
      g.globalAlpha = light ? r.range(0.04, 0.12) : r.range(0.15, 0.4);
      const sz = r.range(1, 2.6);
      g.fillRect(r.range(0, S), r.range(0, S), sz, sz);
    }
    // subtle tyre wear bands along the racing lanes
    g.globalAlpha = 0.07;
    g.fillStyle = '#000000';
    for (const v of [0.3, 0.42, 0.58, 0.7]) g.fillRect(0, v * S - 18, S, 36);
    // tar crack seams
    g.globalAlpha = 0.12;
    g.strokeStyle = '#000000';
    g.lineWidth = 1.5;
    for (let i = 0; i < 10; i++) {
      g.beginPath();
      let x = r.range(0, S);
      let y = r.range(0, S);
      g.moveTo(x, y);
      for (let k = 0; k < 6; k++) {
        x += r.range(-30, 30);
        y += r.range(-30, 30);
        g.lineTo(x, y);
      }
      g.stroke();
    }
    g.globalAlpha = 1;
    // centre dashes (along x = u)
    g.fillStyle = o.line;
    g.globalAlpha = 0.92;
    for (let x = 0; x < S; x += 256) roundRect(g, x + 32, S / 2 - 11, 144, 22, 8);
    g.globalAlpha = 1;
  }
  // Edge markings use world-space ribbons so junctions can have clean openings.
  return tex(c, true);
}

export function roundRect(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number, stroke = false) {
  g.beginPath();
  g.moveTo(x + r, y);
  g.arcTo(x + w, y, x + w, y + h, r);
  g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r);
  g.arcTo(x, y, x + w, y, r);
  g.closePath();
  if (stroke) g.stroke();
  else g.fill();
}

/** Ground texture: soft noise blotches tinted by vertex colour. */
export function groundTexture(seed = 3) {
  const [c, g] = canvas(512, 512);
  const r = new Rng(seed);
  g.fillStyle = '#FFFFFF';
  g.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 700; i++) {
    const x = r.range(0, 512);
    const y = r.range(0, 512);
    const rad = r.range(4, 22);
    const grd = g.createRadialGradient(x, y, 0, x, y, rad);
    const v = r.chance(0.5) ? 255 : 228;
    grd.addColorStop(0, `rgba(${v},${v},${v},0.5)`);
    grd.addColorStop(1, `rgba(${v},${v},${v},0)`);
    g.fillStyle = grd;
    g.fillRect(x - rad, y - rad, rad * 2, rad * 2);
  }
  // tiny grass ticks / sparkles
  for (let i = 0; i < 2600; i++) {
    g.fillStyle = r.chance(0.6) ? `rgba(255,255,255,${r.range(0.12, 0.3)})` : `rgba(90,110,80,${r.range(0.03, 0.07)})`;
    g.fillRect(r.range(0, 512), r.range(0, 512), r.range(1, 3), r.range(2, 5));
  }
  return tex(c, true);
}

/** Item box face: rainbow gradient frame with a bubbly "?". */
export function itemBoxTexture() {
  const [c, g] = canvas(256, 256);
  const grd = g.createLinearGradient(0, 0, 256, 256);
  ['#FFADAD', '#FFD6A5', '#FDFFB6', '#B9FBC0', '#A2D2FF', '#CDB4DB'].forEach((col, i, a) => grd.addColorStop(i / (a.length - 1), col));
  g.fillStyle = grd;
  g.fillRect(0, 0, 256, 256);
  g.fillStyle = 'rgba(255,255,255,0.55)';
  roundRect(g, 22, 22, 212, 212, 40);
  g.font = 'bold 170px "Jua", "Arial Rounded MT Bold", sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.lineWidth = 16;
  g.strokeStyle = '#FF8FB8';
  g.strokeText('?', 128, 140);
  g.fillStyle = '#FFFFFF';
  g.fillText('?', 128, 140);
  return tex(c);
}

/** Fake item box: same but the ribbon colour is subtly off and the "?" is upside-down-ish (§5.2 #12). */
export function fakeBoxTexture() {
  const [c, g] = canvas(256, 256);
  const grd = g.createLinearGradient(0, 0, 256, 256);
  ['#FFB3B3', '#FFD0A0', '#F7F7B0', '#BFF5C0', '#A8CCFF', '#D5B4DB'].forEach((col, i, a) => grd.addColorStop(i / (a.length - 1), col));
  g.fillStyle = grd;
  g.fillRect(0, 0, 256, 256);
  g.fillStyle = 'rgba(255,255,255,0.5)';
  roundRect(g, 22, 22, 212, 212, 40);
  g.save();
  g.translate(128, 132);
  g.rotate(Math.PI);
  g.font = 'bold 170px "Jua", sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.lineWidth = 16;
  g.strokeStyle = '#FF6E9C';
  g.strokeText('?', 0, 0);
  g.fillStyle = '#FFFFFF';
  g.fillText('?', 0, 0);
  g.restore();
  return tex(c);
}

/** Boost pad: chevrons in rainbow colours (scrolls via texture offset). */
export function boostPadTexture() {
  const [c, g] = canvas(512, 512);
  g.fillStyle = '#101C36'; g.fillRect(0, 0, 512, 512);
  g.strokeStyle = '#FFF16A'; g.lineWidth = 22; g.strokeRect(15, 15, 482, 482);
  g.strokeStyle = '#39F6EF'; g.lineWidth = 8; g.strokeRect(36, 36, 440, 440);
  for (let i = 0; i < 4; i++) {
    const y = 76 + i * 96;
    g.beginPath(); g.moveTo(78, y + 50); g.lineTo(256, y - 10); g.lineTo(434, y + 50);
    g.lineTo(434, y + 82); g.lineTo(256, y + 22); g.lineTo(78, y + 82); g.closePath();
    g.fillStyle = i % 2 ? '#FFFFFF' : '#CEFF43'; g.fill();
  }
  return tex(c, false);
}

export function cloudTexture() {
  const [c, g] = canvas(256, 128);
  const r = new Rng(9);
  for (let i = 0; i < 14; i++) {
    const x = 40 + r.range(0, 176);
    const y = 70 + r.range(-20, 20) - Math.sin(((x - 40) / 176) * Math.PI) * 18;
    const rad = r.range(22, 40);
    const grd = g.createRadialGradient(x, y - rad * 0.3, rad * 0.2, x, y, rad);
    grd.addColorStop(0, 'rgba(255,255,255,1)');
    grd.addColorStop(0.8, 'rgba(250,246,255,0.95)');
    grd.addColorStop(1, 'rgba(240,232,255,0)');
    g.fillStyle = grd;
    g.beginPath();
    g.arc(x, y, rad, 0, Math.PI * 2);
    g.fill();
  }
  return tex(c);
}

/** 4x4 particle atlas: soft dot, star, heart, sparkle, ring, petal, snow, smoke... */
export function particleAtlas() {
  const S = 64;
  const [c, g] = canvas(S * 4, S * 4);
  const cell = (i: number, draw: (cx: number, cy: number, s: number) => void) => {
    const cx = (i % 4) * S + S / 2;
    const cy = Math.floor(i / 4) * S + S / 2;
    g.save();
    draw(cx, cy, S / 2 - 3);
    g.restore();
  };
  // 0 soft dot
  cell(0, (x, y, s) => {
    const grd = g.createRadialGradient(x, y, 0, x, y, s);
    grd.addColorStop(0, 'rgba(255,255,255,1)');
    grd.addColorStop(0.5, 'rgba(255,255,255,0.6)');
    grd.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grd;
    g.fillRect(x - s, y - s, s * 2, s * 2);
  });
  // 1 star
  cell(1, (x, y, s) => {
    g.fillStyle = '#fff';
    g.beginPath();
    for (let i = 0; i < 10; i++) {
      const rr = i % 2 ? s * 0.45 : s;
      const a = (i / 10) * Math.PI * 2 - Math.PI / 2;
      g.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
    }
    g.closePath();
    g.fill();
  });
  // 2 heart
  cell(2, (x, y, s) => {
    g.fillStyle = '#fff';
    g.beginPath();
    g.moveTo(x, y + s * 0.8);
    g.bezierCurveTo(x - s * 1.2, y - s * 0.1, x - s * 0.5, y - s * 1.0, x, y - s * 0.35);
    g.bezierCurveTo(x + s * 0.5, y - s * 1.0, x + s * 1.2, y - s * 0.1, x, y + s * 0.8);
    g.fill();
  });
  // 3 sparkle (4-point)
  cell(3, (x, y, s) => {
    g.fillStyle = '#fff';
    g.beginPath();
    g.moveTo(x, y - s);
    g.quadraticCurveTo(x, y, x + s, y);
    g.quadraticCurveTo(x, y, x, y + s);
    g.quadraticCurveTo(x, y, x - s, y);
    g.quadraticCurveTo(x, y, x, y - s);
    g.fill();
  });
  // 4 ring
  cell(4, (x, y, s) => {
    g.strokeStyle = '#fff';
    g.lineWidth = 6;
    g.beginPath();
    g.arc(x, y, s - 4, 0, Math.PI * 2);
    g.stroke();
  });
  // 5 petal
  cell(5, (x, y, s) => {
    g.fillStyle = '#fff';
    g.beginPath();
    g.ellipse(x, y, s * 0.5, s * 0.9, 0.4, 0, Math.PI * 2);
    g.fill();
  });
  // 6 snowflake (soft dot w/ cross)
  cell(6, (x, y, s) => {
    g.strokeStyle = '#fff';
    g.lineWidth = 5;
    g.lineCap = 'round';
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * Math.PI;
      g.beginPath();
      g.moveTo(x - Math.cos(a) * s * 0.8, y - Math.sin(a) * s * 0.8);
      g.lineTo(x + Math.cos(a) * s * 0.8, y + Math.sin(a) * s * 0.8);
      g.stroke();
    }
  });
  // 7 puff (smoke)
  cell(7, (x, y, s) => {
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2;
      const grd = g.createRadialGradient(x + Math.cos(a) * s * 0.35, y + Math.sin(a) * s * 0.35, 0, x + Math.cos(a) * s * 0.35, y + Math.sin(a) * s * 0.35, s * 0.6);
      grd.addColorStop(0, 'rgba(255,255,255,0.9)');
      grd.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = grd;
      g.fillRect(x - s, y - s, s * 2, s * 2);
    }
  });
  // 8 confetti rect
  cell(8, (x, y, s) => {
    g.fillStyle = '#fff';
    roundRect(g, x - s * 0.35, y - s * 0.7, s * 0.7, s * 1.4, 4);
  });
  // 9 streak (speed line)
  cell(9, (x, y, s) => {
    const grd = g.createLinearGradient(x, y - s, x, y + s);
    grd.addColorStop(0, 'rgba(255,255,255,0)');
    grd.addColorStop(0.5, 'rgba(255,255,255,1)');
    grd.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grd;
    g.fillRect(x - 3, y - s, 6, s * 2);
  });
  // 10 musical note
  cell(10, (x, y, s) => {
    g.fillStyle = '#fff';
    g.beginPath();
    g.ellipse(x - s * 0.3, y + s * 0.5, s * 0.35, s * 0.26, -0.4, 0, Math.PI * 2);
    g.fill();
    g.fillRect(x - s * 0.02, y - s * 0.8, s * 0.14, s * 1.35);
    g.fillRect(x - s * 0.02, y - s * 0.8, s * 0.6, s * 0.18);
  });
  // 11 drop
  cell(11, (x, y, s) => {
    g.fillStyle = '#fff';
    g.beginPath();
    g.moveTo(x, y - s);
    g.bezierCurveTo(x + s * 0.8, y, x + s * 0.6, y + s * 0.9, x, y + s * 0.9);
    g.bezierCurveTo(x - s * 0.6, y + s * 0.9, x - s * 0.8, y, x, y - s);
    g.fill();
  });
  // 12 "Z" (sleep)
  cell(12, (x, y, s) => {
    g.fillStyle = '#fff';
    g.font = `bold ${s * 1.6}px sans-serif`;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText('Z', x, y);
  });
  const t = tex(c);
  t.generateMipmaps = true;
  return t;
}
export const enum PShape {
  Dot = 0,
  Star = 1,
  Heart = 2,
  Sparkle = 3,
  Ring = 4,
  Petal = 5,
  Snow = 6,
  Puff = 7,
  Confetti = 8,
  Streak = 9,
  Note = 10,
  Drop = 11,
  Zzz = 12,
}
