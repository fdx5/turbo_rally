import * as THREE from 'three';
import type { TrackPath } from './path';

/** Reserve a full vehicle envelope around every road. */
export function roadClearance(paths: TrackPath[]) {
  const samples: { x: number; y: number; z: number; width: number; rise: number; path: TrackPath }[] = [];
  const p = new THREE.Vector3();
  for (const path of paths)
    for (let s = 0; s < path.length; s += 3) {
      const i = path.idxAtS(s);
      if (path.gap[i]) continue;
      path.pointAt(s, 0, p);
      const width = path.halfW[i] + Math.max(path.shoulderL[i], path.shoulderR[i]) + 2;
      samples.push({ x: p.x, y: p.y, z: p.z, width, rise: Math.abs(path.bankTan[i]) * width, path });
    }
  return (x: number, z: number, bottom: number, top: number, radius: number, ignore?: TrackPath) =>
    samples.some(
      (p) =>
        p.path !== ignore &&
        bottom < p.y + p.rise + 4 &&
        top > p.y - p.rise - 0.4 &&
        (x - p.x) ** 2 + (z - p.z) ** 2 < (p.width + radius) ** 2,
    );
}
