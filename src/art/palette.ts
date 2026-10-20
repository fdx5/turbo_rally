import * as THREE from 'three';

export const PAL = {
  cream: '#FFF6E9',
  pink: '#FFC8DD',
  lavender: '#CDB4DB',
  sky: '#A2D2FF',
  mint: '#B9FBC0',
  lemon: '#FDFFB6',
  peach: '#FFD6A5',
  coral: '#FFADAD',
  white: '#FFFFFF',
  ink: '#4A3B52',
} as const;

const tmp = new THREE.Color();
const hsl = { h: 0, s: 0, l: 0 };
/** Pastel-correct a brand colour: lift lightness slightly and drop saturation a touch (§6.1). */
export function pastel(hex: string, amount = 1): string {
  tmp.set(hex).getHSL(hsl);
  hsl.l = hsl.l + (0.92 - hsl.l) * 0.18 * amount;
  hsl.s = hsl.s * (1 - 0.12 * amount);
  return '#' + tmp.setHSL(hsl.h, hsl.s, hsl.l).getHexString();
}
export function shade(hex: string, f: number): string {
  tmp.set(hex).multiplyScalar(f);
  return '#' + tmp.getHexString();
}
export function mix(a: string, b: string, t: number): string {
  return '#' + tmp.set(a).lerp(new THREE.Color(b), t).getHexString();
}
