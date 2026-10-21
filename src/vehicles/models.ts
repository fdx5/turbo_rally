import * as THREE from 'three';
import { MeshBuilder, extrudeShape, heartShape, lathe, starShape, type V3 } from '../art/builder';
import { pastel } from '../art/palette';
import {
  FONTS,
  coupangWordmark,
  cyberWord,
  flame,
  hyLogo,
  hyundaiLogo,
  octagon,
  parody,
  policeEmblem,
  recycleMark,
  rocketIcon,
  starOfLife,
  swallowMark,
  teslaT,
  text,
  type Ctx,
} from './decals';
import { roundRect } from '../art/textures';
import { AMBER, BLACK, CHROME, DARKGREY, GLASS_T, LAMP, TAILC, arches, bar, cabOver, cabin, doorLine, frame, grille, lamp, mirrors as kitMirrors, plate, sedan, side } from './kit';

export type Region = 'side' | 'rear' | 'front' | 'roof';
export const REGIONS: Record<Region, [number, number, number, number]> = {
  side: [0, 0, 2048, 512],
  rear: [0, 512, 1024, 512],
  front: [1024, 512, 1024, 256],
  roof: [1024, 768, 1024, 256],
};
export interface DecalPlane {
  region: Region;
  p: V3;
  face: 'L' | 'R' | 'B' | 'F' | 'U';
  w: number;
  h: number;
}
export interface WheelSpec {
  x: number;
  z: number;
  r: number;
  w: number;
  front: boolean;
  hub: string;
}
export interface AnimPart {
  name: 'drum' | 'beacon' | 'ladder' | 'bed' | 'boom' | 'cone' | 'sign' | 'stopArm' | 'compactor' | 'canopy';
  builder: MeshBuilder;
  pivot: V3;
}
export interface VehicleBlueprint {
  body: MeshBuilder;
  parts: AnimPart[];
  wheels: WheelSpec[];
  seat: V3;
  pose: 'sit' | 'stand' | 'scooter';
  decals: DecalPlane[];
  draw: Partial<Record<Region, (g: Ctx, w: number, h: number) => void>>;
  beacons: { p: V3; color: string }[];
  height: number;
  length: number;
}

const DARK = '#5E5873';
const GLASS = '#BFE3FF';
const TIRE = '#5A5470';
const LIGHT = '#FFF6C9';
const TAIL = '#FF7E9E';

function bp(): VehicleBlueprint {
  return { body: new MeshBuilder(), parts: [], wheels: [], seat: [0, 1, 0], pose: 'sit', decals: [], draw: {}, beacons: [], height: 2, length: 3 };
}
function wheels4(v: VehicleBlueprint, zf: number, zr: number, r: number, track = 0.92, w = 0.42, hub = '#FFFFFF') {
  for (const x of [track, -track]) {
    v.wheels.push({ x, z: zf, r, w, front: true, hub });
    v.wheels.push({ x, z: zr, r, w, front: false, hub });
  }
}
function lights(b: MeshBuilder, zFront: number, zRear: number, y: number, x = 0.62, yr = y) {
  for (const s of [-1, 1]) {
    b.sphere(0.17, LIGHT, { p: [s * x, y, zFront], s: [1, 1, 0.6], glow: 2.2 });
    b.box(0.3, 0.16, 0.08, TAIL, { p: [s * x, yr, zRear] }, 0.4);
  }
}
function bumper(b: MeshBuilder, z: number, y: number, w = 1.9, c = '#E9E4F2') {
  b.box(w, 0.26, 0.3, c, { p: [0, y, z] }, 0.45);
}
function chassis(b: MeshBuilder, len: number, w: number, y: number, c = '#8E87A6') {
  b.box(w, 0.28, len, c, { p: [0, y, 0] }, 0.4);
}
/** Open-top cab: shell + windshield frame, leaving room for the driver. */
function openCab(b: MeshBuilder, z: number, y: number, w: number, l: number, h: number, c: string, opts: { glassTint?: string; noGlass?: boolean } = {}) {
  b.box(w, h, l, c, { p: [0, y + h / 2, z] }, 0.28);
  b.box(w * 0.82, 0.12, l * 0.7, pastel('#D8D2E6'), { p: [0, y + h + 0.02, z - 0.05], outline: false });
  if (!opts.noGlass) {
    // windshield frame (A pillars + top bar) with tinted glass
    // low wrap-around windscreen so the driver's face stays visible (§6.2 checklist)
    const gz = z + l / 2 - 0.08;
    for (const s of [-1, 1]) b.capsule(0.05, 0.22, c, { p: [s * (w / 2 - 0.08), y + h + 0.16, gz], r: [-0.35, 0, 0] });
    b.box(w - 0.08, 0.08, 0.09, c, { p: [0, y + h + 0.3, gz - 0.1] }, 0.4);
    b.box(w - 0.22, 0.24, 0.04, opts.glassTint ?? GLASS, { p: [0, y + h + 0.16, gz - 0.05], r: [-0.35, 0, 0], outline: false }, 0.3);
  }
}
function mirrors(b: MeshBuilder, z: number, y: number, x: number, c = DARK) {
  for (const s of [-1, 1]) {
    b.capsule(0.03, 0.25, c, { p: [s * (x + 0.1), y, z], r: [0, 0, s * 1.2], outline: false });
    b.box(0.08, 0.26, 0.18, c, { p: [s * (x + 0.24), y + 0.1, z] }, 0.4);
  }
}
function lightBar(b: MeshBuilder, v: VehicleBlueprint, p: V3, w = 1.1, colors: [string, string] = ['#FF6B8A', '#5AA9FF']) {
  b.box(w, 0.14, 0.3, '#E4E0EE', { p }, 0.4);
  v.beacons.push({ p: [p[0] - w * 0.28, p[1] + 0.12, p[2]], color: colors[0] });
  v.beacons.push({ p: [p[0] + w * 0.28, p[1] + 0.12, p[2]], color: colors[1] });
}

// ---------------------------------------------------------------------------------------------
// Box / body helpers for trucks
function cargoBox(b: MeshBuilder, z0: number, z1: number, y0: number, y1: number, w: number, color: string, trim = '#C9CED9') {
  const len = z0 - z1;
  b.box(w, y1 - y0, len, color, { p: [0, (y0 + y1) / 2, (z0 + z1) / 2] }, 0.05, 2);
  // corner posts, roof rail and bottom rail like an aluminium van body
  for (const sx of [-1, 1]) {
    for (const z of [z0 - 0.03, z1 + 0.03]) b.box(0.07, y1 - y0 + 0.02, 0.07, trim, { p: [sx * (w / 2), (y0 + y1) / 2, z], outline: false }, 0.3, 1);
    b.box(0.05, 0.08, len, trim, { p: [sx * (w / 2 + 0.01), y0 + 0.04, (z0 + z1) / 2], outline: false }, 0.3, 1);
    b.box(0.05, 0.06, len, trim, { p: [sx * (w / 2 + 0.01), y1 - 0.03, (z0 + z1) / 2], outline: false }, 0.3, 1);
    b.box(0.08, 0.05, 0.1, AMBER, { p: [sx * (w / 2 + 0.02), y0 + 0.16, (z0 + z1) / 2], glow: 1.3, outline: false }, 0.3, 1);
  }
  // rear doors: centre seam, hinges, lock bars
  b.box(0.02, y1 - y0 - 0.1, 0.02, trim, { p: [0, (y0 + y1) / 2, z1 - 0.01], outline: false }, 0.3, 1);
  for (const sx of [-0.25, 0.25]) b.box(0.035, y1 - y0 - 0.16, 0.035, CHROME, { p: [sx * w, (y0 + y1) / 2, z1 - 0.025], outline: false }, 0.3, 1);
}
function sideGuard(b: MeshBuilder, z0: number, z1: number, y: number, x: number) {
  for (const sx of [-1, 1]) for (const dy of [0, 0.14]) b.box(0.03, 0.05, z0 - z1, DARKGREY, { p: [sx * x, y + dy, (z0 + z1) / 2], outline: false }, 0.3, 1);
}
function rearLights(b: MeshBuilder, z: number, y: number, x: number) {
  for (const sx of [-1, 1]) {
    b.box(0.26, 0.12, 0.05, TAILC, { p: [sx * x, y, z], glow: 1.6 }, 0.3, 1);
    b.box(0.1, 0.12, 0.05, AMBER, { p: [sx * (x - 0.2), y, z], glow: 1.2 }, 0.3, 1);
  }
}

const BUILDERS: Record<string, () => VehicleBlueprint> = {
  coupang() {
    const v = bp();
    const b = v.body;
    frame(b, -1.75, 1.55, 0.46);
    cabOver(b, { zf: 1.62, len: 1.05, y0: 0.46, yb: 1.1, yr: 1.72, w: 1.84, color: '#FFFFFF', lower: '#E6E9F0' });
    cargoBox(b, 0.44, -1.7, 0.56, 1.86, 1.94, '#FFFFFF');
    sideGuard(b, 0.5, -0.75, 0.48, 0.9);
    rearLights(b, -1.72, 0.52, 0.66);
    b.box(1.9, 0.12, 0.16, DARKGREY, { p: [0, 0.44, -1.74] }, 0.4, 1);
    arches(b, 1.15, 0.44, 0.9, 0.44, '#C9CED9');
    wheels4(v, 1.15, -1.15, 0.44, 0.88, 0.38, '#E6E9F0');
    v.seat = [0, 1.4, 1.15];
    v.decals.push({ region: 'side', p: [0.976, 1.2, -0.63], face: 'L', w: 1.9, h: 1.0 }, { region: 'side', p: [-0.976, 1.2, -0.63], face: 'R', w: 1.9, h: 1.0 });
    v.decals.push({ region: 'rear', p: [0, 1.22, -1.712], face: 'B', w: 1.6, h: 0.9 });
    v.draw.side = (g, w, h) => {
      coupangWordmark(g, w * 0.5, h * 0.4, h * 0.42, w * 0.86);
      rocketIcon(g, w * 0.74, h * 0.76, h * 0.13);
      text(g, parody() ? '로켓배숑' : '로켓배송', w * 0.5, h * 0.76, h * 0.17, '#3DA9F5', { font: FONTS.F_KR });
    };
    v.draw.rear = (g, w, h) => {
      coupangWordmark(g, w * 0.5, h * 0.42, h * 0.32, w * 0.8);
      text(g, parody() ? '로켓배숑' : '로켓배송', w * 0.5, h * 0.74, h * 0.15, '#3DA9F5');
    };
    v.height = 2.0;
    v.length = 3.5;
    return v;
  },
  epost() {
    const v = bp();
    const b = v.body;
    const red = pastel('#E4002B', 0.6);
    frame(b, -1.75, 1.55, 0.46);
    cabOver(b, { zf: 1.62, len: 1.05, y0: 0.46, yb: 1.1, yr: 1.72, w: 1.84, color: red, lower: '#E6E9F0' });
    cargoBox(b, 0.44, -1.7, 0.56, 1.86, 1.94, '#FFFFFF');
    b.box(1.96, 0.26, 2.12, red, { p: [0, 0.72, -0.63], outline: false }, 0.2, 1);
    b.box(1.96, 0.06, 2.12, '#FFD45E', { p: [0, 0.88, -0.63], outline: false }, 0.2, 1);
    sideGuard(b, 0.5, -0.75, 0.48, 0.9);
    rearLights(b, -1.72, 0.52, 0.66);
    arches(b, 1.15, 0.44, 0.9, 0.44, '#C9CED9');
    wheels4(v, 1.15, -1.15, 0.44, 0.88, 0.38, '#E6E9F0');
    v.seat = [0, 1.4, 1.15];
    v.decals.push({ region: 'side', p: [0.986, 1.35, -0.63], face: 'L', w: 1.9, h: 0.7 }, { region: 'side', p: [-0.986, 1.35, -0.63], face: 'R', w: 1.9, h: 0.7 });
    v.decals.push({ region: 'rear', p: [0, 1.3, -1.712], face: 'B', w: 1.5, h: 0.75 });
    v.decals.push({ region: 'front', p: [0, 1.0, 1.65], face: 'F', w: 1.1, h: 0.22 });
    v.draw.side = (g, w, h) => {
      g.fillStyle = '#E4002B';
      g.beginPath();
      g.arc(w * 0.16, h * 0.5, h * 0.38, 0, Math.PI * 2);
      g.fill();
      swallowMark(g, w * 0.16, h * 0.5, h * 0.27);
      text(g, parody() ? '우채국택배' : '우체국택배', w * 0.6, h * 0.5, h * 0.46, '#E4002B', { font: FONTS.F_BLOCK, weight: 400 });
    };
    v.draw.rear = (g, w, h) => {
      swallowMark(g, w * 0.5, h * 0.34, h * 0.2, '#E4002B');
      text(g, parody() ? '우채국택배' : '우체국택배', w * 0.5, h * 0.74, h * 0.2, '#E4002B', { font: FONTS.F_BLOCK, weight: 400 });
    };
    v.draw.front = (g, w, h) => text(g, parody() ? '우채국' : '우체국', w * 0.5, h * 0.5, h * 0.7, '#FFFFFF', { font: FONTS.F_BLOCK, weight: 400 });
    v.height = 2.0;
    v.length = 3.5;
    return v;
  },
  porter() {
    const v = bp();
    const b = v.body;
    const blue = pastel('#2E6FD6', 0.6);
    frame(b, -1.7, 1.55, 0.46);
    cabOver(b, { zf: 1.62, len: 1.05, y0: 0.46, yb: 1.1, yr: 1.72, w: 1.84, color: blue, lower: '#4A4E66' });
    // flatbed with aluminium drop-sides, headboard rack
    b.box(1.92, 0.1, 2.12, '#C9CED9', { p: [0, 0.64, -0.64] }, 0.3, 1);
    for (const sx of [-1, 1]) for (let k = 0; k < 3; k++) {
      b.box(0.05, 0.36, 0.68, '#DCE0EA', { p: [sx * 0.95, 0.87, 0.24 - k * 0.71] }, 0.25, 1);
      b.box(0.06, 0.03, 0.66, '#B5BACA', { p: [sx * 0.97, 0.87, 0.24 - k * 0.71], outline: false }, 0.3, 1);
    }
    b.box(1.92, 0.36, 0.05, '#DCE0EA', { p: [0, 0.87, -1.68] }, 0.25, 1);
    for (const sx of [-0.85, 0.85]) bar(b, [sx, 0.7, 0.47], [sx, 1.82, 0.47], 0.06, '#B5BACA');
    bar(b, [-0.85, 1.82, 0.47], [0.85, 1.82, 0.47], 0.06, '#B5BACA');
    b.box(0.8, 0.6, 0.65, '#E8B67A', { p: [-0.42, 1.0, -0.2] }, 0.12, 1);
    b.box(0.7, 0.5, 0.6, '#E8B67A', { p: [0.45, 0.95, -1.0] }, 0.12, 1);
    b.box(0.6, 0.42, 0.55, '#FFD6A5', { p: [-0.32, 0.9, -1.15] }, 0.12, 1);
    rearLights(b, -1.72, 0.5, 0.66);
    arches(b, 1.15, 0.44, 0.9, 0.44, '#3E4258');
    wheels4(v, 1.15, -1.15, 0.44, 0.88, 0.38, '#E6E9F0');
    v.seat = [0, 1.4, 1.15];
    v.decals.push({ region: 'front', p: [0, 0.75, 1.68], face: 'F', w: 0.6, h: 0.15 });
    v.decals.push({ region: 'side', p: [0.925, 0.8, 1.0], face: 'L', w: 0.72, h: 0.18 }, { region: 'side', p: [-0.925, 0.8, 1.0], face: 'R', w: 0.72, h: 0.18 });
    v.decals.push({ region: 'rear', p: [0, 0.87, -1.71], face: 'B', w: 1.2, h: 0.3 });
    v.draw.front = (g, w, h) => hyundaiLogo(g, w * 0.5, h * 0.5, h * 0.34, '#FFFFFF');
    v.draw.side = (g, w, h) => text(g, parody() ? 'PORTA' : 'PORTER', w * 0.5, h * 0.52, h * 0.72, '#FFFFFF', { font: FONTS.F_ROUND, italic: true });
    v.draw.rear = (g, w, h) => text(g, parody() ? 'HYUNDAE  PORTA' : 'HYUNDAI  PORTER', w * 0.5, h * 0.52, h * 0.5, '#5E5873', { font: FONTS.F_ROUND, spacing: 4 });
    v.height = 2.0;
    v.length = 3.5;
    return v;
  },
  tteokbokki() {
    const v = bp();
    const b = v.body;
    const red = pastel('#E8343C', 0.6);
    frame(b, -1.75, 1.55, 0.46);
    cabOver(b, { zf: 1.62, len: 1.05, y0: 0.46, yb: 1.1, yr: 1.72, w: 1.84, color: '#FFFFFF', lower: '#E6E9F0' });
    cargoBox(b, 0.44, -1.7, 0.56, 1.7, 1.94, red, '#B8222A');
    // serving hatch on the left (kerb) side with counter + striped awning
    b.box(0.03, 0.5, 1.4, '#3A2E40', { p: [0.975, 1.2, -0.62], outline: false }, 0.3, 1);
    b.box(0.25, 0.06, 1.45, '#FFF6E9', { p: [1.05, 0.93, -0.62] }, 0.4, 1);
    for (let k = 0; k < 6; k++) b.box(0.5, 0.04, 0.25, k % 2 ? '#FFFFFF' : '#FF9F43', { p: [1.18, 1.6, -1.25 + k * 0.25], r: [0, 0, -0.35], outline: false }, 0.3, 1);
    b.cyl(0.42, 0.36, 0.18, '#5E5873', { p: [0.55, 0.97, -0.62] }, 14);
    for (let k = 0; k < 7; k++) b.capsule(0.06, 0.16, '#FF5E5E', { p: [0.55 + Math.cos(k) * 0.22, 1.08, -0.62 + Math.sin(k) * 0.22], r: [0, k, Math.PI / 2], outline: false });
    // roof signboard
    b.box(1.5, 0.42, 0.1, '#FFF6E9', { p: [0, 1.95, -0.6] }, 0.2, 1);
    for (const sx of [-0.6, 0.6]) b.cyl(0.03, 0.03, 0.25, '#C9C2D6', { p: [sx, 1.75, -0.6] }, 6);
    rearLights(b, -1.72, 0.52, 0.66);
    arches(b, 1.15, 0.44, 0.9, 0.44, '#C9CED9');
    wheels4(v, 1.15, -1.15, 0.44, 0.88, 0.38, '#E6E9F0');
    v.seat = [0, 1.4, 1.15];
    v.decals.push({ region: 'roof', p: [0, 1.95, -0.54], face: 'F', w: 1.4, h: 0.35 });
    v.decals.push({ region: 'roof', p: [0, 1.95, -0.66], face: 'B', w: 1.4, h: 0.35 });
    v.decals.push({ region: 'side', p: [-0.976, 1.15, -0.63], face: 'R', w: 1.9, h: 0.7 });
    v.decals.push({ region: 'rear', p: [0, 1.15, -1.712], face: 'B', w: 1.5, h: 0.75 });
    v.draw.roof = (g, w, h) => {
      text(g, '떡볶이', w * 0.36, h * 0.52, h * 0.78, '#E8343C', { font: FONTS.F_BLOCK, weight: 400 });
      text(g, '매콤달콤', w * 0.78, h * 0.52, h * 0.42, '#FF8A3D');
    };
    v.draw.side = (g, w, h) => {
      text(g, '떡볶이', w * 0.35, h * 0.48, h * 0.62, '#FFF6E9', { font: FONTS.F_KR, stroke: '#B8222A' });
      text(g, '튀김 · 순대 · 어묵', w * 0.76, h * 0.5, h * 0.24, '#FFE066');
    };
    v.draw.rear = (g, w, h) => text(g, '떡볶이 1인분 ♥', w * 0.5, h * 0.5, h * 0.22, '#FFF6E9');
    v.height = 2.2;
    v.length = 3.5;
    return v;
  },
  garbage() {
    const v = bp();
    const b = v.body;
    const green = pastel('#2FA05A', 0.7);
    frame(b, -1.8, 1.7, 0.5);
    cabOver(b, { zf: 1.82, len: 1.05, y0: 0.5, yb: 1.18, yr: 1.84, w: 1.9, color: '#FFFFFF', lower: green, big: true });
    // compactor body: rounded-top box + hopper tailgate
    b.box(1.96, 1.38, 2.05, green, { p: [0, 1.25, -0.38] }, 0.12, 2);
    for (let k = 0; k < 5; k++) for (const sx of [-1, 1]) b.box(0.05, 1.2, 0.06, pastel('#2A8C4E', 0.6), { p: [sx * 0.99, 1.25, 0.45 - k * 0.42], outline: false }, 0.3, 1);
    const comp = new MeshBuilder();
    comp.box(1.9, 1.3, 0.55, '#FFFFFF', { p: [0, -0.1, -0.26] }, 0.2, 2);
    comp.box(1.5, 0.35, 0.3, '#5E5873', { p: [0, -0.6, -0.5] }, 0.3, 1);
    comp.box(1.92, 0.12, 0.6, green, { p: [0, 0.5, -0.26], outline: false }, 0.3, 1);
    v.parts.push({ name: 'compactor', builder: comp, pivot: [0, 1.4, -1.4] });
    v.beacons.push({ p: [0.6, 2.0, 1.5], color: '#FFB067' }, { p: [-0.6, 2.0, 1.5], color: '#FFB067' });
    b.box(1.5, 0.1, 0.25, '#E4E0EE', { p: [0, 1.92, 1.5] }, 0.4, 1);
    rearLights(b, -2.0, 0.6, 0.7);
    arches(b, 1.3, 0.47, 0.92, 0.47, '#C9CED9');
    wheels4(v, 1.3, -1.15, 0.47, 0.9, 0.42, '#E6E9F0');
    v.seat = [0, 1.52, 1.35];
    v.decals.push({ region: 'side', p: [1.0, 1.25, -0.38], face: 'L', w: 1.8, h: 0.75 }, { region: 'side', p: [-1.0, 1.25, -0.38], face: 'R', w: 1.8, h: 0.75 });
    v.draw.side = (g, w, h) => {
      recycleMark(g, w * 0.15, h * 0.5, h * 0.3);
      text(g, '깨끗한 우리동네', w * 0.6, h * 0.5, h * 0.3, '#FFFFFF', { font: FONTS.F_KR });
    };
    v.height = 2.2;
    v.length = 3.9;
    return v;
  },
  dump() {
    const v = bp();
    const b = v.body;
    const yel = pastel('#FFB703', 0.6);
    frame(b, -2.0, 1.8, 0.62, 1.0);
    cabOver(b, { zf: 2.0, len: 1.05, y0: 0.62, yb: 1.36, yr: 2.02, w: 2.0, color: yel, lower: '#4A4E66', big: true });
    const bed = new MeshBuilder();
    bed.box(2.0, 0.14, 2.35, yel, { p: [0, 0, -1.17] }, 0.3, 1);
    for (const sx of [-1, 1]) bed.box(0.12, 0.8, 2.35, yel, { p: [sx * 0.96, 0.4, -1.17] }, 0.2, 1);
    bed.box(2.0, 0.95, 0.14, yel, { p: [0, 0.47, -0.02] }, 0.2, 1);
    bed.box(1.9, 0.7, 0.12, yel, { p: [0, 0.38, -2.32], r: [0.15, 0, 0] }, 0.2, 1);
    for (let k = 0; k < 5; k++) for (const sx of [-1, 1]) bed.box(0.06, 0.8, 0.08, pastel('#E09B00', 0.5), { p: [sx * 1.03, 0.4, -0.2 - k * 0.5], outline: false }, 0.3, 1);
    bed.box(1.8, 0.35, 1.9, '#F2D49B', { p: [0, 0.6, -1.2] }, 0.6, 2);
    v.parts.push({ name: 'bed', builder: bed, pivot: [0, 1.05, 0.8] });
    rearLights(b, -2.05, 0.75, 0.75);
    arches(b, 1.45, 0.55, 1.0, 0.55, '#3E4258');
    for (const s of [-1, 1]) {
      v.wheels.push({ x: s * 1.0, z: 1.45, r: 0.55, w: 0.48, front: true, hub: '#5E5873' });
      v.wheels.push({ x: s * 1.0, z: -0.75, r: 0.55, w: 0.48, front: false, hub: '#5E5873' });
      v.wheels.push({ x: s * 1.0, z: -1.6, r: 0.55, w: 0.48, front: false, hub: '#5E5873' });
    }
    v.seat = [0, 1.7, 1.5];
    v.decals.push({ region: 'side', p: [1.02, 1.6, -1.2], face: 'L', w: 1.4, h: 0.35 }, { region: 'side', p: [-1.02, 1.6, -1.2], face: 'R', w: 1.4, h: 0.35 });
    v.draw.side = (g, w, h) => text(g, '뚝딱건설', w * 0.5, h * 0.52, h * 0.7, '#5E5873', { font: FONTS.F_BLOCK, weight: 400 });
    v.height = 2.4;
    v.length = 4.1;
    return v;
  },
  remicon() {
    const v = bp();
    const b = v.body;
    const org = pastel('#FF8C42', 0.6);
    frame(b, -2.1, 1.8, 0.62, 1.0);
    cabOver(b, { zf: 2.0, len: 1.05, y0: 0.62, yb: 1.36, yr: 2.02, w: 2.0, color: '#FFFFFF', lower: org, big: true });
    b.box(1.6, 0.5, 0.4, '#9C95B2', { p: [0, 1.0, 0.8] }, 0.3, 1);
    b.box(0.9, 0.9, 0.5, '#9C95B2', { p: [0, 1.45, -2.0] }, 0.3, 1);
    b.cone(0.45, 0.6, '#9C95B2', { p: [0, 1.95, -2.05], r: [Math.PI, 0, 0] }, 12);
    bar(b, [0, 1.1, -2.2], [0, 0.7, -2.7], 0.16, '#C9C2D6');
    const drum = new MeshBuilder();
    drum.add(lathe([[0.2, -1.4], [0.6, -1.33], [0.92, -0.75], [0.98, 0], [0.92, 0.6], [0.6, 1.2], [0.3, 1.38]], 22), '#FFFFFF');
    for (let k = -3; k <= 3; k++) {
      const t = new THREE.TorusGeometry(0.97 - Math.abs(k) * 0.07, 0.05, 6, 22);
      t.rotateX(Math.PI / 2);
      t.rotateY(k * 0.5);
      drum.add(t, org, { p: [0, k * 0.36, 0], s: [1, 0.6, 1], outline: false });
    }
    v.parts.push({ name: 'drum', builder: drum, pivot: [0, 1.6, -0.75] });
    rearLights(b, -2.15, 0.75, 0.75);
    arches(b, 1.45, 0.5, 1.0, 0.5, '#3E4258');
    for (const s of [-1, 1]) {
      v.wheels.push({ x: s * 1.0, z: 1.45, r: 0.5, w: 0.45, front: true, hub: '#E6E9F0' });
      v.wheels.push({ x: s * 1.0, z: -0.75, r: 0.5, w: 0.45, front: false, hub: '#E6E9F0' });
      v.wheels.push({ x: s * 1.0, z: -1.55, r: 0.5, w: 0.45, front: false, hub: '#E6E9F0' });
    }
    v.seat = [0, 1.7, 1.5];
    v.decals.push({ region: 'side', p: [1.0, 0.95, 1.5], face: 'L', w: 0.95, h: 0.24 }, { region: 'side', p: [-1.0, 0.95, 1.5], face: 'R', w: 0.95, h: 0.24 });
    v.draw.side = (g, w, h) => text(g, '뚝딱 레미콘', w * 0.5, h * 0.5, h * 0.7, '#FFFFFF', { font: FONTS.F_BLOCK, weight: 400 });
    v.height = 2.6;
    v.length = 4.3;
    return v;
  },
  firetruck() {
    const v = bp();
    const b = v.body;
    const red = pastel('#E8343C', 0.55);
    frame(b, -2.0, 1.8, 0.58, 1.0);
    cabOver(b, { zf: 2.0, len: 1.5, y0: 0.58, yb: 1.3, yr: 1.98, w: 2.0, color: red, lower: '#E6E9F0', big: true, crew: true, hatchZ: 1.0 });
    b.box(2.02, 0.12, 1.52, '#FFFFFF', { p: [0, 1.12, 1.25], outline: false }, 0.2, 1);
    // equipment body with roller shutters
    b.box(2.04, 1.4, 2.4, red, { p: [0, 1.28, -0.75] }, 0.08, 2);
    for (const sx of [-1, 1]) {
      for (let k = 0; k < 3; k++) {
        b.box(0.03, 1.0, 0.68, '#DCE0EA', { p: [sx * 1.03, 1.32, 0.12 - k * 0.78] }, 0.2, 1);
        for (let r = 0; r < 8; r++) b.box(0.035, 0.015, 0.66, '#B5BACA', { p: [sx * 1.045, 0.9 + r * 0.11, 0.12 - k * 0.78], outline: false }, 0.3, 1);
      }
      b.box(0.04, 0.1, 2.4, '#FFFFFF', { p: [sx * 1.03, 0.7, -0.75], outline: false }, 0.3, 1);
    }
    const ladder = new MeshBuilder();
    for (const sx of [-0.38, 0.38]) ladder.box(0.08, 0.1, 3.2, '#DCE0EA', { p: [sx, 0, -0.3] }, 0.4, 1);
    for (let z = -1.8; z <= 1.2; z += 0.3) ladder.cyl(0.03, 0.03, 0.76, '#DCE0EA', { p: [0, 0, z], r: [0, 0, Math.PI / 2], outline: false }, 8);
    v.parts.push({ name: 'ladder', builder: ladder, pivot: [0.45, 2.08, -0.75] });
    b.cyl(0.12, 0.16, 0.5, '#DCE0EA', { p: [-0.55, 2.15, -0.1], r: [1.1, 0, 0] });
    b.box(1.6, 0.12, 0.3, '#E4E0EE', { p: [0, 2.05, 1.7] }, 0.4, 1);
    v.beacons.push({ p: [-0.45, 2.17, 1.7], color: '#FF6B8A' }, { p: [0.45, 2.17, 1.7], color: '#5AA9FF' });
    rearLights(b, -1.97, 0.8, 0.75);
    arches(b, 1.45, 0.5, 1.0, 0.5, '#3E4258');
    for (const s of [-1, 1]) {
      v.wheels.push({ x: s * 1.0, z: 1.45, r: 0.5, w: 0.45, front: true, hub: '#E6E9F0' });
      v.wheels.push({ x: s * 1.0, z: -1.2, r: 0.5, w: 0.45, front: false, hub: '#E6E9F0' });
    }
    v.seat = [0, 1.66, 1.0];
    v.decals.push({ region: 'side', p: [1.012, 1.82, -0.75], face: 'L', w: 2.2, h: 0.36 }, { region: 'side', p: [-1.012, 1.82, -0.75], face: 'R', w: 2.2, h: 0.36 });
    v.decals.push({ region: 'front', p: [0, 1.17, 2.05], face: 'F', w: 1.2, h: 0.24 });
    v.decals.push({ region: 'rear', p: [0, 1.4, -1.97], face: 'B', w: 1.5, h: 0.75 });
    v.draw.side = (g, w, h) => {
      text(g, '119', w * 0.2, h * 0.5, h * 0.82, '#FFFFFF', { font: FONTS.F_ROUND, stroke: '#C2272F' });
      text(g, '소방', w * 0.62, h * 0.5, h * 0.72, '#FFFFFF', { font: FONTS.F_BLOCK, weight: 400 });
    };
    v.draw.front = (g, w, h) => text(g, '119 소방', w * 0.5, h * 0.52, h * 0.7, '#E8343C', { font: FONTS.F_BLOCK, weight: 400 });
    v.draw.rear = (g, w, h) => {
      text(g, '119', w * 0.5, h * 0.4, h * 0.42, '#FFFFFF', { font: FONTS.F_ROUND });
      text(g, '소방차', w * 0.5, h * 0.78, h * 0.2, '#FFE9A8', { font: FONTS.F_BLOCK, weight: 400 });
    };
    v.height = 2.4;
    v.length = 4.1;
    return v;
  },
  police() {
    const v = bp();
    const b = v.body;
    const blue = pastel('#1E4FA8', 0.5);
    sedan(b, { color: '#FFFFFF', lowerColor: blue });
    b.box(1.9, 0.08, 3.0, '#FFD45E', { p: [0, 0.5, -0.05], outline: false }, 0.3, 1);
    b.box(1.45, 0.14, 0.32, '#E4E0EE', { p: [0, 1.57, 0.2] }, 0.4, 1);
    v.beacons.push({ p: [-0.42, 1.68, 0.2], color: '#FF6B8A' }, { p: [0.42, 1.68, 0.2], color: '#5AA9FF' });
    wheels4(v, 1.05, -1.05, 0.44, 0.88, 0.36, '#E6E9F0');
    v.seat = [0, 1.15, -0.28];
    v.decals.push({ region: 'side', p: [0.944, 0.72, -0.05], face: 'L', w: 2.5, h: 0.42 }, { region: 'side', p: [-0.944, 0.72, -0.05], face: 'R', w: 2.5, h: 0.42 });
    v.decals.push({ region: 'rear', p: [0, 0.78, -1.695], face: 'B', w: 0.8, h: 0.2 });
    v.decals.push({ region: 'roof', p: [0, 1.51, 0.5], face: 'U', w: 0.9, h: 0.25 });
    v.draw.side = (g, w, h) => {
      policeEmblem(g, w * 0.12, h * 0.5, h * 0.4);
      text(g, 'POLICE', w * 0.45, h * 0.5, h * 0.6, '#1E4FA8', { font: FONTS.F_ROUND });
      text(g, '경찰', w * 0.82, h * 0.5, h * 0.55, '#1E4FA8', { font: FONTS.F_BLOCK, weight: 400 });
    };
    v.draw.rear = (g, w, h) => text(g, 'POLICE 경찰', w * 0.5, h * 0.52, h * 0.7, '#1E4FA8', { font: FONTS.F_BLOCK, weight: 400 });
    v.draw.roof = (g, w, h) => text(g, '112', w * 0.5, h * 0.52, h * 0.8, '#1E4FA8', { font: FONTS.F_ROUND });
    v.height = 1.8;
    v.length = 3.4;
    return v;
  },
  taxi() {
    const v = bp();
    const b = v.body;
    const orange = pastel('#EE7F2D', 0.5);
    sedan(b, { color: orange });
    const sign = new MeshBuilder();
    sign.box(0.62, 0.24, 0.3, '#FFF6C9', { glow: 1.5 }, 0.3, 1);
    sign.box(0.66, 0.06, 0.34, '#3A3644', { p: [0, -0.14, 0] }, 0.3, 1);
    v.parts.push({ name: 'sign', builder: sign, pivot: [0, 1.66, 0.25] });
    wheels4(v, 1.05, -1.05, 0.44, 0.88, 0.36, '#E6E9F0');
    v.seat = [0, 1.15, -0.32];
    v.decals.push({ region: 'side', p: [0.944, 0.66, 0.15], face: 'L', w: 2.1, h: 0.35 }, { region: 'side', p: [-0.944, 0.66, 0.15], face: 'R', w: 2.1, h: 0.35 });
    v.decals.push({ region: 'front', p: [0, 1.66, 0.41], face: 'F', w: 0.58, h: 0.145 });
    v.decals.push({ region: 'front', p: [0, 1.66, 0.09], face: 'B', w: 0.58, h: 0.145 });
    v.draw.side = (g, w, h) => {
      text(g, '서울택시', w * 0.35, h * 0.5, h * 0.62, '#FFFFFF', { font: FONTS.F_BLOCK, weight: 400 });
      text(g, 'SEOUL TAXI', w * 0.76, h * 0.52, h * 0.32, '#FFFFFF', { font: FONTS.F_ROUND });
    };
    v.draw.front = (g, w, h) => text(g, 'TAXI', w * 0.5, h * 0.52, h * 0.8, '#E8743B', { font: FONTS.F_ROUND });
    v.height = 1.8;
    v.length = 3.4;
    return v;
  },
  cybertruck() {
    const v = bp();
    const b = v.body;
    const steel = '#CDD2DC';
    side(b, [[-1.7, 0.4], [1.7, 0.4], [1.78, 0.8], [0.12, 1.52], [-1.7, 1.06]], 1.9, steel, { bevel: 0.03 });
    // tinted side glass & windshield following the ridge
    side(b, [[1.0, 1.1], [0.14, 1.47], [-0.82, 1.27], [-0.82, 1.1]], 1.93, GLASS_T, { bevel: 0.01, outline: false });
    const ang = Math.atan2(1.52 - 0.8, 1.78 - 0.12);
    b.box(1.74, 0.03, 1.0, GLASS_T, { p: [0, 1.365, 0.56], r: [ang, 0, 0], outline: false }, 0.2, 1);
    // armour flares around square wheel wells
    for (const z of [1.08, -1.08]) for (const sx of [-1, 1]) {
      b.box(0.1, 0.12, 1.05, '#8E93A0', { p: [sx * 0.96, 0.98, z] }, 0.3, 1);
      bar(b, [sx * 0.96, 0.42, z + 0.52], [sx * 0.96, 0.95, z + 0.52], 0.1, '#8E93A0');
      bar(b, [sx * 0.96, 0.42, z - 0.52], [sx * 0.96, 0.95, z - 0.52], 0.1, '#8E93A0');
    }
    b.box(1.86, 0.05, 0.05, '#FFFFFF', { p: [0, 0.8, 1.79], glow: 3 }, 0.3, 1);
    b.box(1.86, 0.05, 0.05, TAILC, { p: [0, 1.04, -1.72], glow: 2 }, 0.3, 1);
    b.box(1.86, 0.12, 0.1, '#3A3E48', { p: [0, 0.42, 0] }, 0.3, 1);
    b.box(0.86, 0.06, 0.62, '#2A2433', { p: [0, 1.5, 0.0], outline: false }, 0.3, 1);
    wheels4(v, 1.08, -1.08, 0.46, 0.9, 0.4, '#7C8394');
    v.seat = [0, 1.12, 0.0];
    v.decals.push({ region: 'rear', p: [0, 0.72, -1.715], face: 'B', w: 1.5, h: 0.24 });
    v.decals.push({ region: 'front', p: [0, 0.6, 1.745], face: 'F', w: 0.7, h: 0.175 });
    v.draw.rear = (g, w, h) => cyberWord(g, w * 0.5, h * 0.55, h * 0.6);
    v.draw.front = (g, w, h) => teslaT(g, w * 0.5, h * 0.5, h * 0.36, parody() ? '#7C8394' : '#E31937');
    v.height = 1.7;
    v.length = 3.5;
    return v;
  },
  ambulance() {
    const v = bp();
    const b = v.body;
    const red = pastel('#E8343C', 0.5);
    // one-box van (Solati/Starex class): short nose, tall patient compartment
    side(b, [[-1.85, 0.4], [1.62, 0.4], [1.82, 0.52], [1.86, 0.86], [1.62, 1.06], [1.28, 1.12], [-1.85, 1.12]], 1.92, '#FFFFFF', { bevel: 0.08 });
    b.box(1.94, 0.9, 2.3, '#FFFFFF', { p: [0, 1.57, -0.7] }, 0.12, 2);
    cabin(b, { zf: 1.28, zr: 0.45, yb: 1.12, yr: 1.98, w: 1.92, sf: 0.36, color: '#FFFFFF', hatch: { z: 0.55, l: 0.5 } });
    for (const sx of [-1, 1]) {
      b.box(0.03, 0.3, 0.55, '#DDE6F0', { p: [sx * 0.975, 1.6, -0.55], outline: false }, 0.3, 1);
    }
    b.box(1.98, 0.14, 3.6, red, { p: [0, 0.96, -0.12], outline: false }, 0.2, 1);
    b.box(1.98, 0.05, 3.6, '#FF9F43', { p: [0, 1.06, -0.12], outline: false }, 0.2, 1);
    grille(b, 1.87, 0.7, 0.8, 0.14, 2);
    for (const sx of [-1, 1]) lamp(b, sx * 0.66, 0.84, 1.8, 0.3, 0.12);
    plate(b, 1.88, 0.5, 1);
    rearLights(b, -1.86, 0.9, 0.78);
    b.box(1.5, 0.12, 0.28, '#E4E0EE', { p: [0, 2.08, 0.3] }, 0.4, 1);
    v.beacons.push({ p: [-0.45, 2.2, 0.3], color: '#FF6B8A' }, { p: [0.45, 2.2, 0.3], color: '#FF6B8A' });
    arches(b, 1.15, 0.44, 0.95, 0.44);
    arches(b, -1.15, 0.44, 0.95, 0.44);
    kitMirrors(b, 1.15, 1.3, 0.96);
    doorLine(b, 0.45, 0.45, 1.12, 0.97);
    wheels4(v, 1.15, -1.15, 0.44, 0.9, 0.38, '#E6E9F0');
    v.seat = [0, 1.66, 0.52];
    v.decals.push({ region: 'side', p: [0.976, 1.48, -0.95], face: 'L', w: 1.6, h: 0.42 }, { region: 'side', p: [-0.976, 1.48, -0.95], face: 'R', w: 1.6, h: 0.42 });
    v.decals.push({ region: 'rear', p: [0, 1.5, -1.862], face: 'B', w: 1.3, h: 0.65 });
    v.draw.side = (g, w, h) => {
      starOfLife(g, w * 0.14, h * 0.5, h * 0.42);
      text(g, '119 구급', w * 0.58, h * 0.5, h * 0.62, '#E8343C', { font: FONTS.F_BLOCK, weight: 400 });
    };
    v.draw.rear = (g, w, h) => {
      starOfLife(g, w * 0.5, h * 0.36, h * 0.26);
      text(g, '119 구급', w * 0.5, h * 0.8, h * 0.2, '#E8343C', { font: FONTS.F_BLOCK, weight: 400 });
    };
    v.height = 2.2;
    v.length = 3.8;
    return v;
  },
  icecream() {
    const v = bp();
    const b = v.body;
    const pink = '#FFC8DD';
    const sky = '#A2D2FF';
    side(b, [[-1.85, 0.4], [1.62, 0.4], [1.82, 0.52], [1.86, 0.86], [1.62, 1.06], [1.28, 1.12], [-1.85, 1.12]], 1.92, sky, { bevel: 0.08 });
    b.box(1.94, 0.9, 2.3, pink, { p: [0, 1.57, -0.7] }, 0.12, 2);
    cabin(b, { zf: 1.28, zr: 0.45, yb: 1.12, yr: 1.98, w: 1.92, sf: 0.36, color: sky, hatch: { z: 0.55, l: 0.5 } });
    // serving window (kerb side = left) with awning & counter
    b.box(0.03, 0.5, 1.3, '#3A2E40', { p: [0.975, 1.55, -0.7], outline: false }, 0.3, 1);
    b.box(0.22, 0.05, 1.35, '#FFF6E9', { p: [1.05, 1.28, -0.7] }, 0.4, 1);
    for (let k = 0; k < 6; k++) b.box(0.45, 0.04, 0.24, k % 2 ? '#FFFFFF' : '#FF8FB8', { p: [1.16, 1.9, -1.3 + k * 0.24], r: [0, 0, -0.4], outline: false }, 0.3, 1);
    grille(b, 1.87, 0.7, 0.8, 0.14, 2);
    for (const sx of [-1, 1]) lamp(b, sx * 0.66, 0.84, 1.8, 0.3, 0.12);
    rearLights(b, -1.86, 0.9, 0.78);
    const cone = new MeshBuilder();
    cone.add(lathe([[0, 0], [0.32, 0.85], [0, 0.85]], 14).rotateX(Math.PI).translate(0, 0.85, 0), '#E8C79A');
    cone.sphere(0.4, '#FFC8DD', { p: [0, 1.0, 0] });
    cone.sphere(0.32, '#B9FBC0', { p: [0, 1.33, 0] });
    cone.sphere(0.11, '#FF6B8A', { p: [0, 1.66, 0] });
    v.parts.push({ name: 'cone', builder: cone, pivot: [0, 2.02, -1.15] });
    arches(b, 1.15, 0.44, 0.95, 0.44);
    arches(b, -1.15, 0.44, 0.95, 0.44);
    kitMirrors(b, 1.15, 1.3, 0.96);
    wheels4(v, 1.15, -1.15, 0.44, 0.9, 0.38, '#FFFFFF');
    v.seat = [0, 1.66, 0.52];
    v.decals.push({ region: 'side', p: [-0.976, 1.55, -0.7], face: 'R', w: 2.0, h: 0.6 });
    v.decals.push({ region: 'rear', p: [0, 1.5, -1.862], face: 'B', w: 1.4, h: 0.7 });
    v.draw.side = (g, w, h) => {
      text(g, 'ICE CREAM', w * 0.5, h * 0.4, h * 0.42, '#FF6B9E', { font: FONTS.F_ROUND, stroke: '#FFFFFF' });
      text(g, '달콤 아이스크림', w * 0.5, h * 0.78, h * 0.22, '#5AA9FF');
    };
    v.draw.rear = (g, w, h) => text(g, 'YUMMY ♥', w * 0.5, h * 0.5, h * 0.32, '#FF6B9E', { font: FONTS.F_ROUND });
    v.height = 2.9;
    v.length = 3.8;
    return v;
  },
  seoulbus() {
    const v = bp();
    const b = v.body;
    const blue = pastel('#2E7BD6', 0.5);
    // low-floor city bus: white skirt, big glass band, blue upper body
    b.box(2.0, 0.55, 4.7, '#FFFFFF', { p: [0, 0.68, 0] }, 0.18, 2);
    side(b, [[-2.35, 0.94], [2.32, 0.94], [2.38, 1.78], [-2.35, 1.78]], 1.96, GLASS_T, { bevel: 0.02 });
    b.box(2.0, 0.42, 4.7, blue, { p: [0, 1.98, 0] }, 0.14, 2);
    for (let k = 0; k < 7; k++) for (const sx of [-1, 1]) b.box(0.05, 0.86, 0.1, blue, { p: [sx * 0.99, 1.36, 1.7 - k * 0.66], outline: false }, 0.3, 1);
    // doors on the kerb side (right = -x)
    for (const z of [1.75, -0.2]) b.box(0.04, 1.3, 0.62, '#2A3456', { p: [-1.0, 1.08, z], outline: false }, 0.2, 1);
    b.box(1.6, 0.26, 0.05, '#2B2B3A', { p: [0, 2.0, 2.36] }, 0.3, 1);
    b.box(1.1, 0.35, 1.3, '#E9EEF5', { p: [0, 2.3, -1.0] }, 0.3, 1);
    b.box(0.95, 0.06, 0.8, '#2A2433', { p: [0, 2.22, 1.6], outline: false }, 0.3, 1);
    b.box(1.04, 0.05, 0.9, DARKGREY, { p: [0, 2.2, 1.6] }, 0.3, 1);
    for (const sx of [-1, 1]) lamp(b, sx * 0.7, 0.72, 2.36, 0.3, 0.14);
    b.box(2.04, 0.18, 0.18, DARKGREY, { p: [0, 0.48, 2.38] }, 0.4, 1);
    rearLights(b, -2.36, 0.8, 0.75);
    kitMirrors(b, 2.2, 1.8, 1.0, BLACK, true);
    arches(b, 1.45, 0.48, 1.0, 0.48);
    arches(b, -1.35, 0.48, 1.0, 0.48);
    wheels4(v, 1.45, -1.35, 0.48, 0.92, 0.42, '#E6E9F0');
    v.seat = [0, 1.9, 1.6];
    v.decals.push({ region: 'side', p: [1.001, 0.72, -0.3], face: 'L', w: 2.6, h: 0.42 }, { region: 'side', p: [-1.001, 0.72, 0.6], face: 'R', w: 1.8, h: 0.3 });
    v.decals.push({ region: 'front', p: [0, 2.0, 2.388], face: 'F', w: 1.5, h: 0.24 });
    v.decals.push({ region: 'rear', p: [0, 1.4, -2.352], face: 'B', w: 1.4, h: 0.7 });
    v.draw.side = (g, w, h) => {
      g.fillStyle = '#2E7BD6';
      g.beginPath();
      g.arc(w * 0.1, h * 0.5, h * 0.38, 0, Math.PI * 2);
      g.fill();
      text(g, 'B', w * 0.1, h * 0.52, h * 0.52, '#FFFFFF', { font: FONTS.F_ROUND });
      text(g, '서울', w * 0.32, h * 0.5, h * 0.62, '#2E7BD6', { font: FONTS.F_BLOCK, weight: 400 });
      text(g, '472', w * 0.68, h * 0.5, h * 0.72, '#2E7BD6', { font: FONTS.F_ROUND });
    };
    v.draw.front = (g, w, h) => {
      g.fillStyle = '#2B2B3A';
      g.fillRect(0, 0, w, h);
      text(g, '472 광화문 ▶', w * 0.5, h * 0.52, h * 0.6, '#FFB067', { font: FONTS.F_BLOCK, weight: 400 });
    };
    v.draw.rear = (g, w, h) => {
      text(g, '472', w * 0.5, h * 0.36, h * 0.36, '#FFFFFF', { font: FONTS.F_ROUND, stroke: '#2E7BD6' });
      text(g, '서울 시내버스', w * 0.5, h * 0.76, h * 0.18, '#2E7BD6', { font: FONTS.F_BLOCK, weight: 400 });
    };
    v.height = 2.6;
    v.length = 4.8;
    return v;
  },
  schoolbus() {
    const v = bp();
    const b = v.body;
    const yel = pastel('#FFC21A', 0.5);
    // County-class minibus: short bonnet, tall glasshouse
    side(b, [[-1.95, 0.42], [1.72, 0.42], [1.95, 0.55], [1.98, 0.92], [1.62, 1.06], [-1.95, 1.06]], 1.94, yel, { bevel: 0.08 });
    b.box(1.98, 0.08, 3.9, BLACK, { p: [0, 1.04, -0.12], outline: false }, 0.3, 1);
    cabin(b, { zf: 1.62, zr: -1.95, yb: 1.06, yr: 1.86, w: 1.94, sf: 0.25, color: yel, bPillars: [0.9, 0.2, -0.5, -1.2], hatch: { z: 1.0, l: 0.5 } });
    grille(b, 1.99, 0.68, 0.7, 0.16, 2);
    for (const sx of [-1, 1]) lamp(b, sx * 0.68, 0.8, 1.9, 0.26, 0.16);
    b.box(2.02, 0.16, 0.18, BLACK, { p: [0, 0.44, 1.98] }, 0.4, 1);
    const stop = new MeshBuilder();
    stop.cyl(0.3, 0.3, 0.05, '#F2545B', { r: [0, 0, Math.PI / 2] }, 8);
    stop.cyl(0.07, 0.07, 0.06, '#FFFFFF', { r: [0, 0, Math.PI / 2] }, 8);
    v.parts.push({ name: 'stopArm', builder: stop, pivot: [1.0, 1.25, 0.95] });
    rearLights(b, -1.97, 0.8, 0.75);
    kitMirrors(b, 1.7, 1.25, 0.98, BLACK, true);
    arches(b, 1.25, 0.46, 0.98, 0.46);
    arches(b, -1.25, 0.46, 0.98, 0.46);
    wheels4(v, 1.25, -1.25, 0.46, 0.9, 0.4, '#E6E9F0');
    v.seat = [0, 1.56, 1.0];
    v.decals.push({ region: 'side', p: [0.981, 0.78, -0.4], face: 'L', w: 2.2, h: 0.36 }, { region: 'side', p: [-0.981, 0.78, -0.4], face: 'R', w: 2.2, h: 0.36 });
    v.decals.push({ region: 'rear', p: [0, 1.45, -1.982], face: 'B', w: 1.4, h: 0.7 });
    v.draw.side = (g, w, h) => {
      text(g, '어린이 보호차량', w * 0.45, h * 0.5, h * 0.55, '#4A3B52', { font: FONTS.F_BLOCK, weight: 400 });
      octagon(g, w * 0.9, h * 0.5, h * 0.38);
    };
    v.draw.rear = (g, w, h) => {
      g.fillStyle = '#FFFFFF';
      roundRect(g, w * 0.08, h * 0.15, w * 0.84, h * 0.7, h * 0.12);
      text(g, '어린이', w * 0.5, h * 0.36, h * 0.26, '#E8343C', { font: FONTS.F_BLOCK, weight: 400 });
      text(g, '보호차량', w * 0.5, h * 0.66, h * 0.26, '#E8343C', { font: FONTS.F_BLOCK, weight: 400 });
    };
    v.height = 2.2;
    v.length = 4.0;
    return v;
  },
  monster() {
    const v = bp();
    const b = v.body;
    const purple = '#C5A8E8';
    // lifted pickup body
    side(b, [[-1.6, 1.12], [1.48, 1.12], [1.62, 1.26], [1.64, 1.52], [1.42, 1.64], [0.55, 1.7], [-1.6, 1.7]], 1.86, purple, { bevel: 0.07 });
    cabin(b, { zf: 0.55, zr: -0.3, yb: 1.7, yr: 2.2, w: 1.82, sf: 0.36, sr: 0.08, color: purple, hatch: { z: 0.05, l: 0.45 } });
    for (const sx of [-1, 1]) b.box(0.08, 0.32, 1.2, purple, { p: [sx * 0.89, 1.86, -0.95] }, 0.3, 1);
    b.box(1.86, 0.32, 0.08, purple, { p: [0, 1.86, -1.56] }, 0.3, 1);
    bar(b, [-0.8, 1.72, -0.42], [-0.8, 2.36, -0.42], 0.08, '#FFFFFF');
    bar(b, [0.8, 1.72, -0.42], [0.8, 2.36, -0.42], 0.08, '#FFFFFF');
    bar(b, [-0.8, 2.36, -0.42], [0.8, 2.36, -0.42], 0.08, '#FFFFFF');
    for (const sx of [-0.45, -0.15, 0.15, 0.45]) b.sphere(0.09, LAMP, { p: [sx, 2.42, -0.42], glow: 2 });
    grille(b, 1.65, 1.36, 0.9, 0.2, 3);
    for (const sx of [-1, 1]) lamp(b, sx * 0.64, 1.42, 1.6, 0.28, 0.14);
    b.box(1.5, 0.3, 2.3, '#5E5873', { p: [0, 0.98, 0] }, 0.3, 1);
    for (const sx of [-1, 1]) for (const z of [-1, 1]) {
      bar(b, [sx * 0.6, 0.95, z * 1.05], [sx * 0.95, 0.55, z * 1.05], 0.12, '#E9E4F2');
      b.cyl(0.06, 0.06, 0.6, '#FFE066', { p: [sx * 0.7, 0.85, z * 1.05 + 0.2], r: [0, 0, sx * 0.5] }, 8);
    }
    rearLights(b, -1.61, 1.45, 0.66);
    for (const s of [-1, 1]) {
      v.wheels.push({ x: s * 1.15, z: 1.05, r: 0.85, w: 0.7, front: true, hub: '#FFE066' });
      v.wheels.push({ x: s * 1.15, z: -1.05, r: 0.85, w: 0.7, front: false, hub: '#FFE066' });
    }
    v.seat = [0, 1.9, 0.05];
    v.decals.push({ region: 'side', p: [0.936, 1.4, 0], face: 'L', w: 2.8, h: 0.5 }, { region: 'side', p: [-0.936, 1.4, 0], face: 'R', w: 2.8, h: 0.5 });
    v.draw.side = (g, w, h) => {
      flame(g, w * 0.04, h * 0.6, h * 0.55);
      flame(g, w * 0.42, h * 0.62, h * 0.45, ['#A2D2FF', '#B9FBC0', '#FFFFFF']);
      text(g, 'MONSTER', w * 0.82, h * 0.5, h * 0.42, '#FFFFFF', { font: FONTS.F_ROUND, stroke: '#9D7BC9' });
    };
    v.height = 2.7;
    v.length = 3.4;
    return v;
  },
  excavator() {
    const v = bp();
    const b = v.body;
    const yel = pastel('#FFB703', 0.6);
    // wheeled excavator: carrier, slewing ring, house, operator cab, counterweight
    b.box(1.8, 0.42, 2.7, '#5E5873', { p: [0, 0.72, 0] }, 0.2, 1);
    b.box(2.0, 0.12, 0.5, '#7C7690', { p: [0, 0.55, 1.55] }, 0.3, 1);
    b.cyl(0.85, 0.9, 0.22, '#3A3644', { p: [0, 1.04, -0.05] }, 22);
    b.box(1.9, 0.75, 2.1, yel, { p: [0.0, 1.52, -0.25] }, 0.14, 2);
    b.box(1.9, 0.62, 0.55, '#5E5873', { p: [0, 1.5, -1.3] }, 0.3, 1);
    cabin(b, { zf: 0.85, zr: 0.0, yb: 1.88, yr: 2.6, w: 0.9, sf: 0.1, color: yel, hatch: { z: 0.4, l: 0.45 } });
    for (const sx of [0.38]) b.box(0.08, 0.6, 0.08, yel, { p: [sx, 2.2, 0.4] }, 0.3, 1);
    for (let k = 0; k < 4; k++) b.box(0.6, 0.03, 0.08, '#3A3644', { p: [-0.45, 1.92, -0.4 - k * 0.2], outline: false }, 0.3, 1);
    const boom = new MeshBuilder();
    boom.box(0.3, 0.32, 1.9, yel, { p: [0, 0.55, 0.85], r: [-0.55, 0, 0] }, 0.35, 1);
    boom.box(0.26, 0.26, 1.3, yel, { p: [0, 0.75, 2.05], r: [0.8, 0, 0] }, 0.35, 1);
    boom.cyl(0.06, 0.06, 1.0, '#DCE0EA', { p: [0, 0.3, 0.9], r: [-0.9, 0, 0] }, 8);
    boom.box(0.75, 0.45, 0.55, '#8E87A6', { p: [0, 0.2, 2.45], r: [0.4, 0, 0] }, 0.3, 1);
    for (let k = -1; k <= 1; k++) boom.cone(0.07, 0.2, '#C9C2D6', { p: [k * 0.25, -0.05, 2.7], r: [Math.PI, 0, 0], outline: false }, 6);
    v.parts.push({ name: 'boom', builder: boom, pivot: [-0.45, 1.6, 0.6] });
    for (const sx of [-1, 1]) lamp(b, sx * 0.6, 1.62, 0.83, 0.2, 0.12);
    for (const s of [-1, 1]) {
      v.wheels.push({ x: s * 0.62, z: 0.95, r: 0.46, w: 0.36, front: true, hub: yel });
      v.wheels.push({ x: s * 1.0, z: 0.95, r: 0.46, w: 0.36, front: true, hub: yel });
      v.wheels.push({ x: s * 0.62, z: -0.95, r: 0.46, w: 0.36, front: false, hub: yel });
      v.wheels.push({ x: s * 1.0, z: -0.95, r: 0.46, w: 0.36, front: false, hub: yel });
    }
    v.seat = [0, 2.28, 0.42];
    v.decals.push({ region: 'side', p: [0.956, 1.5, -0.45], face: 'L', w: 1.4, h: 0.35 }, { region: 'side', p: [-0.956, 1.5, -0.45], face: 'R', w: 1.4, h: 0.35 });
    v.draw.side = (g, w, h) => text(g, 'TURBO DIG', w * 0.5, h * 0.52, h * 0.6, '#5E5873', { font: FONTS.F_ROUND });
    v.height = 2.9;
    v.length = 3.6;
    return v;
  },

  yakult() {
    const v = bp();
    const b = v.body;
    chassis(b, 2.3, 1.3, 0.42, '#C9C2D6');
    b.box(1.45, 1.0, 1.25, '#FFF8EC', { p: [0, 0.98, 0.45] }, 0.22);
    b.box(1.5, 0.18, 1.3, '#F7931E', { p: [0, 1.52, 0.45] }, 0.45);
    b.box(1.48, 0.12, 1.28, '#F7931E', { p: [0, 0.6, 0.45] }, 0.3);
    b.box(1.2, 0.12, 0.9, '#E9E4F2', { p: [0, 0.6, -0.65] }, 0.4); // standing deck
    b.capsule(0.05, 1.0, '#C9C2D6', { p: [0, 1.25, -0.25], r: [0, 0, Math.PI / 2] }); // handle bar
    for (const s of [-1, 1]) b.capsule(0.05, 0.7, '#C9C2D6', { p: [s * 0.5, 0.95, -0.25], r: [0.1, 0, 0] });
    b.sphere(0.15, LIGHT, { p: [0.45, 0.8, 1.1], glow: 2 });
    b.sphere(0.15, LIGHT, { p: [-0.45, 0.8, 1.1], glow: 2 });
    for (const s of [-1, 1]) {
      v.wheels.push({ x: s * 0.68, z: 0.75, r: 0.34, w: 0.3, front: true, hub: '#F7931E' });
      v.wheels.push({ x: s * 0.62, z: -0.75, r: 0.34, w: 0.3, front: false, hub: '#F7931E' });
    }
    v.pose = 'stand';
    v.seat = [0, 0.98, -0.7];
    v.decals.push({ region: 'side', p: [0.731, 1.0, 0.45], face: 'L', w: 1.15, h: 0.575 }, { region: 'side', p: [-0.731, 1.0, 0.45], face: 'R', w: 1.15, h: 0.575 });
    v.decals.push({ region: 'front', p: [0, 1.05, 1.081], face: 'F', w: 1.2, h: 0.3 });
    v.draw.side = (g, w, h) => {
      hyLogo(g, w * 0.3, h * 0.48, h * 0.8);
      text(g, '프레시 매니저', w * 0.68, h * 0.38, h * 0.22, '#F7931E');
      text(g, parody() ? '야구르트' : '야쿠르트', w * 0.68, h * 0.7, h * 0.24, '#8DC63F');
    };
    v.draw.front = (g, w, h) => hyLogo(g, w * 0.5, h * 0.5, h * 0.9);
    v.height = 1.85;
    v.length = 2.3;
    return v;
  },

  golfcart() {
    const v = bp();
    const b = v.body;
    const mint = '#B9FBC0';
    chassis(b, 2.4, 1.4, 0.42, '#E9E4F2');
    b.box(1.5, 0.5, 0.8, '#FFFFFF', { p: [0, 0.72, 0.85] }, 0.42);
    b.box(1.5, 0.35, 0.6, mint, { p: [0, 0.65, -0.25] }, 0.4);
    b.box(1.4, 0.5, 0.15, mint, { p: [0, 0.98, -0.5] }, 0.4);
    b.box(1.6, 0.12, 2.0, mint, { p: [0, 2.25, 0.05] }, 0.4); // canopy
    b.box(1.66, 0.06, 2.06, '#FFFFFF', { p: [0, 2.33, 0.05] }, 0.4);
    for (const [x, z] of [[0.7, 0.75], [-0.7, 0.75], [0.7, -0.75], [-0.7, -0.75]]) b.cyl(0.04, 0.04, 1.4, '#FFFFFF', { p: [x, 1.55, z] }, 8);
    b.box(1.2, 0.22, 0.05, GLASS, { p: [0, 1.12, 0.84], r: [-0.25, 0, 0], outline: false }, 0.3);
    // golf bag
    b.cyl(0.25, 0.22, 0.9, '#FF9EC7', { p: [0, 1.1, -0.95], r: [-0.25, 0, 0] }, 14);
    for (let k = 0; k < 3; k++) b.cyl(0.03, 0.03, 0.5, '#C9C2D6', { p: [-0.1 + k * 0.1, 1.7, -1.05], r: [-0.25, 0, 0] }, 6);
    for (let k = 0; k < 3; k++) b.sphere(0.07, '#5E5873', { p: [-0.1 + k * 0.1, 1.95, -1.1], outline: false });
    lights(b, 1.25, -1.2, 0.72, 0.5);
    for (const s of [-1, 1]) {
      v.wheels.push({ x: s * 0.72, z: 0.8, r: 0.36, w: 0.32, front: true, hub: '#FFFFFF' });
      v.wheels.push({ x: s * 0.72, z: -0.8, r: 0.36, w: 0.32, front: false, hub: '#FFFFFF' });
    }
    v.seat = [0, 0.82, -0.05];
    v.decals.push({ region: 'front', p: [0, 0.72, 1.255], face: 'F', w: 1.0, h: 0.25 });
    v.decals.push({ region: 'side', p: [0.761, 0.7, 0.85], face: 'L', w: 0.7, h: 0.175 }, { region: 'side', p: [-0.761, 0.7, 0.85], face: 'R', w: 0.7, h: 0.175 });
    v.draw.front = (g, w, h) => text(g, '⛳ GOLF', w * 0.5, h * 0.52, h * 0.6, '#7BD389', { font: FONTS.F_ROUND });
    v.draw.side = (g, w, h) => text(g, 'NICE SHOT!', w * 0.5, h * 0.52, h * 0.6, '#7BD389', { font: FONTS.F_ROUND });
    v.height = 2.35;
    v.length = 2.5;
    return v;
  },

  scooter() {
    const v = bp();
    const b = v.body;
    const red = '#FF9EB5';
    b.box(0.7, 0.25, 1.9, '#E9E4F2', { p: [0, 0.5, -0.1] }, 0.45);
    b.box(0.75, 0.75, 0.5, red, { p: [0, 0.85, 0.75], r: [-0.25, 0, 0] }, 0.4);
    b.capsule(0.05, 0.6, '#C9C2D6', { p: [0, 1.35, 0.85], r: [-0.3, 0, 0] });
    b.capsule(0.05, 0.75, '#5E5873', { p: [0, 1.65, 0.75], r: [0, 0, Math.PI / 2] });
    b.sphere(0.16, LIGHT, { p: [0, 1.35, 1.05], glow: 2.2 });
    b.capsule(0.32, 0.6, red, { p: [0, 0.85, -0.4], r: [Math.PI / 2, 0, 0] }); // seat body
    // delivery box
    b.box(0.95, 0.85, 0.9, '#FFFFFF', { p: [0, 1.45, -1.05] }, 0.2);
    b.box(0.97, 0.15, 0.92, red, { p: [0, 1.9, -1.05] }, 0.4);
    v.wheels.push({ x: 0, z: 1.0, r: 0.38, w: 0.3, front: true, hub: red });
    v.wheels.push({ x: 0.62, z: -1.0, r: 0.38, w: 0.3, front: false, hub: red });
    v.wheels.push({ x: -0.62, z: -1.0, r: 0.38, w: 0.3, front: false, hub: red });
    b.box(1.5, 0.12, 0.3, '#C9C2D6', { p: [0, 0.45, -1.0] }, 0.4);
    v.pose = 'scooter';
    v.seat = [0, 1.05, -0.3];
    v.decals.push({ region: 'side', p: [0.476, 1.45, -1.05], face: 'L', w: 0.85, h: 0.425 }, { region: 'side', p: [-0.476, 1.45, -1.05], face: 'R', w: 0.85, h: 0.425 });
    v.decals.push({ region: 'rear', p: [0, 1.45, -1.501], face: 'B', w: 0.85, h: 0.425 });
    v.draw.side = (g, w, h) => {
      text(g, '빠른배달', w * 0.5, h * 0.38, h * 0.36, '#FF6B9E');
      text(g, '🛵 30분 OK', w * 0.5, h * 0.75, h * 0.22, '#5E5873');
    };
    v.draw.rear = (g, w, h) => text(g, '배달중 ♥', w * 0.5, h * 0.5, h * 0.3, '#FF6B9E');
    v.height = 2.0;
    v.length = 2.6;
    return v;
  },
};

export function vehicleBlueprint(id: string): VehicleBlueprint {
  const fn = BUILDERS[id] ?? BUILDERS.coupang;
  return fn();
}

// silence unused helpers for some builds
void heartShape;
void starShape;
