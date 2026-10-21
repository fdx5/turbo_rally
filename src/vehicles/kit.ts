import * as THREE from 'three';
import { MeshBuilder, extrudeShape, type V3 } from '../art/builder';

/**
 * Vehicle modelling kit: real-car construction (side-profile body, tinted glasshouse with pillars
 * and roof slab, grille/lamps/bumpers, fender lips). Coordinates: +z forward, +y up, x lateral.
 */
export const GLASS_T = '#3E4E77';
export const GLASS_HI = '#9DB8E8';
export const BLACK = '#3A3644';
export const DARKGREY = '#5A566A';
export const CHROME = '#DCE0EA';
export const LAMP = '#FFF6C9';
export const TAILC = '#FF6F8E';
export const AMBER = '#FFB54A';

/** Extrude a side profile [z, y][] across `w` (centred on x). */
export function side(b: MeshBuilder, pts: [number, number][], w: number, color: string, o: { bevel?: number; x?: number; outline?: boolean; glow?: number } = {}) {
  const s = new THREE.Shape();
  pts.forEach(([z, y], i) => (i ? s.lineTo(z, y) : s.moveTo(z, y)));
  s.closePath();
  const bev = o.bevel ?? 0.05;
  const g = extrudeShape(s, Math.max(0.01, w - bev * 2), bev);
  g.rotateY(-Math.PI / 2);
  if (o.x) g.translate(o.x, 0, 0);
  b.add(g, color, { outline: o.outline, glow: o.glow });
}

/** Oriented bar between two points. */
export function bar(b: MeshBuilder, a: V3, c: V3, t: number, color: string, outline = true) {
  const A = new THREE.Vector3(...a);
  const C = new THREE.Vector3(...c);
  const mid = A.clone().add(C).multiplyScalar(0.5);
  const len = A.distanceTo(C);
  const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), C.clone().sub(A).normalize());
  const e = new THREE.Euler().setFromQuaternion(q);
  b.box(t, len + t * 0.6, t, color, { p: [mid.x, mid.y, mid.z], r: [e.x, e.y, e.z], outline }, 0.35, 1);
}

export interface CabinOpts {
  zf: number; // windshield base (front)
  zr: number; // rear glass base
  yb: number; // belt line
  yr: number; // roof
  w: number;
  sf: number; // windshield run (horizontal)
  sr?: number; // rear window run
  color: string;
  bPillars?: number[];
  hatch?: { z: number; l: number };
  roofColor?: string;
  wipers?: boolean;
}
/** Tinted glasshouse + A/B/C pillars + roof slab (+ optional sunroof hatch the driver pops out of). */
export function cabin(b: MeshBuilder, o: CabinOpts) {
  const sr = o.sr ?? 0;
  const xw = o.w * 0.455;
  side(b, [[o.zf, o.yb - 0.02], [o.zf - o.sf, o.yr], [o.zr + sr, o.yr], [o.zr, o.yb - 0.02]], o.w * 0.9, GLASS_T, { bevel: 0.03 });
  // glass highlight streaks on the windshield
  const wz = o.zf - o.sf * 0.5;
  const wy = (o.yb + o.yr) / 2;
  const ang = Math.atan2(o.sf, o.yr - o.yb);
  for (const [dx, wd] of [[-0.18, 0.1], [0.02, 0.05]] as const)
    b.box(wd, (o.yr - o.yb) * 0.75, 0.01, GLASS_HI, { p: [dx * o.w, wy, wz + 0.035], r: [-ang, 0, 0.5], outline: false }, 0.3, 1);
  const rl = o.zf - o.sf - (o.zr + sr) + 0.1;
  b.box(o.w * 0.94, 0.09, rl, o.roofColor ?? o.color, { p: [0, o.yr + 0.035, (o.zf - o.sf + o.zr + sr) / 2] }, 0.4, 2);
  for (const sx of [-1, 1]) {
    bar(b, [sx * xw, o.yb, o.zf], [sx * xw, o.yr + 0.02, o.zf - o.sf], 0.1, o.color);
    bar(b, [sx * xw, o.yb, o.zr], [sx * xw, o.yr + 0.02, o.zr + sr], 0.12, o.color);
    for (const z of o.bPillars ?? []) bar(b, [sx * xw, o.yb, z], [sx * xw, o.yr, z], 0.1, o.color);
  }
  if (o.hatch) {
    b.box(o.w * 0.56, 0.06, o.hatch.l + 0.12, DARKGREY, { p: [0, o.yr + 0.09, o.hatch.z] }, 0.4, 1);
    b.box(o.w * 0.48, 0.07, o.hatch.l, '#2A2433', { p: [0, o.yr + 0.11, o.hatch.z], outline: false }, 0.3, 1);
  }
  if (o.wipers !== false)
    for (const sx of [-0.22, 0.2]) b.box(0.04, 0.02, 0.52, BLACK, { p: [sx * o.w, o.yb + 0.06, o.zf - 0.06], r: [0, 0.9, 0], outline: false }, 0.3, 1);
}

export function lamp(b: MeshBuilder, x: number, y: number, z: number, w: number, h: number, color = LAMP, glow = 2.2, d = 0.06) {
  b.box(w + 0.06, h + 0.06, d, CHROME, { p: [x, y, z - 0.01], outline: false }, 0.35, 1);
  b.box(w, h, d, color, { p: [x, y, z + 0.015], glow }, 0.4, 1);
}
export function grille(b: MeshBuilder, z: number, y: number, w: number, h: number, slats = 3, color = BLACK) {
  b.box(w, h, 0.05, color, { p: [0, y, z] }, 0.35, 1);
  for (let i = 1; i <= slats; i++) b.box(w * 0.92, 0.025, 0.02, CHROME, { p: [0, y - h / 2 + (h * i) / (slats + 1), z + 0.03], outline: false }, 0.3, 1);
}
/** Fender lip (half torus) hugging a wheel, on both sides. */
export function arches(b: MeshBuilder, z: number, r: number, x: number, y: number, color = DARKGREY) {
  for (const sx of [-1, 1]) {
    const g = new THREE.TorusGeometry(r + 0.07, 0.065, 6, 18, Math.PI);
    g.rotateY(Math.PI / 2);
    b.add(g, color, { p: [sx * x, y, z] });
  }
}
export function mirrors(b: MeshBuilder, z: number, y: number, x: number, c = BLACK, tall = false) {
  for (const sx of [-1, 1]) {
    bar(b, [sx * x, y - 0.05, z], [sx * (x + 0.2), y + 0.02, z - 0.05], 0.035, c, false);
    b.box(0.07, tall ? 0.34 : 0.17, tall ? 0.14 : 0.24, c, { p: [sx * (x + 0.24), y + 0.04, z - 0.06] }, 0.4, 1);
  }
}
export function doorLine(b: MeshBuilder, z: number, y0: number, y1: number, x: number, color = BLACK) {
  for (const sx of [-1, 1]) {
    b.box(0.012, y1 - y0, 0.02, color, { p: [sx * x, (y0 + y1) / 2, z], outline: false }, 0.3, 1);
    b.box(0.03, 0.035, 0.16, CHROME, { p: [sx * (x + 0.01), y1 - 0.12, z - 0.18], outline: false }, 0.4, 1);
  }
}
export function plate(b: MeshBuilder, z: number, y: number, facing: 1 | -1) {
  b.box(0.42, 0.12, 0.02, '#F4F6FA', { p: [0, y, z + facing * 0.01], outline: false }, 0.3, 1);
}
export function frame(b: MeshBuilder, z0: number, z1: number, y: number, w = 0.9) {
  for (const sx of [-1, 1]) b.box(0.12, 0.16, z1 - z0, DARKGREY, { p: [sx * w * 0.42, y, (z0 + z1) / 2], outline: false }, 0.3, 1);
  b.box(w, 0.12, 0.12, DARKGREY, { p: [0, y, z0 + 0.1], outline: false }, 0.3, 1);
}

export interface CabOverOpts {
  zf: number;
  len: number;
  y0: number;
  yb: number;
  yr: number;
  w: number;
  color: string;
  lower?: string; // lower front panel colour
  bumper?: string;
  crew?: boolean;
  big?: boolean; // heavy truck face
  hatchZ?: number;
}
/** Korean cab-over truck cab (Porter / Bongo / heavy trucks). Returns rear z of the cab. */
export function cabOver(b: MeshBuilder, o: CabOverOpts) {
  const zr = o.zf - o.len;
  const h = o.yb - o.y0;
  b.box(o.w, h, o.len, o.color, { p: [0, o.y0 + h / 2, (o.zf + zr) / 2] }, 0.14, 3);
  // front face: lower panel + grille band + lamps
  if (o.lower) b.box(o.w - 0.04, h * 0.42, 0.06, o.lower, { p: [0, o.y0 + h * 0.22, o.zf + 0.01] }, 0.3, 1);
  if (o.big) {
    grille(b, o.zf + 0.03, o.y0 + h * 0.55, o.w * 0.66, h * 0.42, 5);
    for (const sx of [-1, 1]) lamp(b, sx * (o.w / 2 - 0.2), o.y0 + h * 0.3, o.zf + 0.03, 0.26, 0.14);
  } else {
    grille(b, o.zf + 0.03, o.y0 + h * 0.62, o.w * 0.5, h * 0.2, 2);
    for (const sx of [-1, 1]) {
      lamp(b, sx * (o.w / 2 - 0.22), o.y0 + h * 0.62, o.zf + 0.03, 0.3, 0.2);
      b.box(0.14, 0.08, 0.05, AMBER, { p: [sx * (o.w / 2 - 0.22), o.y0 + h * 0.4, o.zf + 0.03], glow: 1.4 }, 0.3, 1);
    }
  }
  b.box(o.w + 0.06, 0.2, 0.22, o.bumper ?? DARKGREY, { p: [0, o.y0 - 0.02, o.zf + 0.03] }, 0.4, 2);
  plate(b, o.zf + 0.15, o.y0 - 0.02, 1);
  cabin(b, {
    zf: o.zf - 0.02,
    zr: zr + 0.05,
    yb: o.yb,
    yr: o.yr,
    w: o.w,
    sf: o.big ? 0.12 : 0.26,
    color: o.color,
    bPillars: o.crew ? [o.zf - o.len * 0.52] : [],
    hatch: { z: o.hatchZ ?? o.zf - o.len * 0.62, l: 0.6 },
  });
  mirrors(b, o.zf - 0.12, o.yb + 0.25, o.w / 2, BLACK, true);
  doorLine(b, zr + 0.06, o.y0 + 0.05, o.yb, o.w / 2 + 0.002);
  if (o.crew) doorLine(b, o.zf - o.len * 0.52, o.y0 + 0.05, o.yb, o.w / 2 + 0.002);
  for (const sx of [-1, 1]) b.box(0.12, 0.06, 0.4, BLACK, { p: [sx * (o.w / 2 - 0.02), o.y0 - 0.12, o.zf - 0.35] }, 0.3, 1);
  return zr;
}

export interface SedanOpts {
  color: string;
  w?: number;
  lowerColor?: string;
  hatch?: boolean;
}
/** Mid-size sedan (Sonata / K5 class), shortened for chibi proportions. */
export function sedan(b: MeshBuilder, o: SedanOpts) {
  const w = o.w ?? 1.86;
  side(b, [[-1.6, 0.34], [1.5, 0.34], [1.66, 0.46], [1.68, 0.7], [1.5, 0.84], [0.62, 0.95], [-1.12, 0.99], [-1.56, 0.93], [-1.68, 0.7], [-1.66, 0.45]], w, o.color, { bevel: 0.08 });
  if (o.lowerColor) side(b, [[-1.62, 0.33], [1.52, 0.33], [1.62, 0.45], [-1.66, 0.45]], w + 0.02, o.lowerColor, { bevel: 0.05, outline: false });
  cabin(b, { zf: 0.66, zr: -1.12, yb: 0.95, yr: 1.46, w: w * 0.98, sf: 0.6, sr: 0.42, color: o.color, bPillars: [-0.3], hatch: o.hatch === false ? undefined : { z: -0.28, l: 0.56 } });
  // face
  grille(b, 1.69, 0.52, 0.9, 0.16, 2);
  for (const sx of [-1, 1]) {
    lamp(b, sx * 0.62, 0.72, 1.6, 0.36, 0.11);
    b.box(0.42, 0.1, 0.05, TAILC, { p: [sx * 0.55, 0.8, -1.67], glow: 1.6 }, 0.4, 1);
  }
  b.box(1.3, 0.04, 0.03, TAILC, { p: [0, 0.82, -1.68], glow: 1.2, outline: false }, 0.3, 1);
  plate(b, 1.71, 0.45, 1);
  plate(b, -1.69, 0.56, -1);
  arches(b, 1.05, 0.44, w / 2 - 0.02, 0.44);
  arches(b, -1.05, 0.44, w / 2 - 0.02, 0.44);
  doorLine(b, 0.6, 0.42, 0.95, w / 2 + 0.03);
  doorLine(b, -0.3, 0.42, 0.95, w / 2 + 0.03);
  mirrors(b, 0.55, 1.0, w / 2 - 0.02, o.color);
}
