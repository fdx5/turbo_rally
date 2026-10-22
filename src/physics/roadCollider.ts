import * as THREE from 'three';
import type { TrackPath } from '../tracks/path';
import type { PhysWorld } from './kart';

interface Face {
  a: THREE.Vector3;
  b: THREE.Vector3;
  c: THREE.Vector3;
  normal: THREE.Vector3;
}
const CELL = 24;
const edge = new THREE.Vector3(),
  direction = new THREE.Vector3(),
  hit = new THREE.Vector3();
const ray = new THREE.Ray();

/** Swept collision against the same sampled, banked, gapped road triangles as rendering. */
export class RoadCollider {
  private cells = new Map<string, Face[]>();
  constructor(paths: TrackPath[]) {
    for (const p of paths)
      for (let i = 0; i < (p.closed ? p.n : p.n - 1); i++) {
        const j = p.wrap(i + 1);
        if (p.gap[i] || p.gap[j]) continue;
        const left = (k: number) => -p.halfW[k] - p.shoulderL[k];
        const right = (k: number) => p.halfW[k] + p.shoulderR[k];
        // Split at the centre to preserve the plane of both shoulders on steep banks.
        for (const [a, b] of [
          [left, () => 0],
          [() => 0, right],
        ]) {
          const s0 = i * p.ds,
            s1 = (i + 1) * p.ds;
          const v0 = p.pointAt(s0, a(i), new THREE.Vector3());
          const v1 = p.pointAt(s0, b(i), new THREE.Vector3());
          const v2 = p.pointAt(s1, a(j), new THREE.Vector3());
          const v3 = p.pointAt(s1, b(j), new THREE.Vector3());
          // The road mesh lies BELOW the separate takeoff ramp. Do not invent a
          // sloping closing face after the lip that would catch and cancel a jump.
          v0.y -= p.rampHeight(s0, a(i));
          v1.y -= p.rampHeight(s0, b(i));
          v2.y -= p.rampHeight(s1, a(j));
          v3.y -= p.rampHeight(s1, b(j));
          this.add(v0, v1, v2);
          this.add(v1, v3, v2);
        }
      }
    for (const p of paths)
      for (const ramp of p.ramps) {
        for (let row = 0; row < 12; row++)
          for (let lane = 0; lane < 6; lane++) {
            const s0 = ramp.s0 + ((ramp.s1 - ramp.s0) * row) / 12 + 0.001;
            const s1 = ramp.s0 + ((ramp.s1 - ramp.s0) * (row + 1)) / 12 - 0.001;
            const t0 = ramp.t0 + ((ramp.t1 - ramp.t0) * lane) / 6;
            const t1 = ramp.t0 + ((ramp.t1 - ramp.t0) * (lane + 1)) / 6;
            const a = p.pointAt(s0, t0, new THREE.Vector3()),
              b = p.pointAt(s0, t1, new THREE.Vector3());
            const c = p.pointAt(s1, t0, new THREE.Vector3()),
              d = p.pointAt(s1, t1, new THREE.Vector3());
            this.add(a, b, c);
            this.add(b, d, c);
          }
      }
  }
  private add(a: THREE.Vector3, b: THREE.Vector3, c: THREE.Vector3) {
    const normal = b.clone().sub(a).cross(edge.copy(c).sub(a)).normalize();
    const face = { a, b, c, normal };
    for (
      let x = Math.floor(Math.min(a.x, b.x, c.x) / CELL);
      x <= Math.floor(Math.max(a.x, b.x, c.x) / CELL);
      x++
    )
      for (
        let z = Math.floor(Math.min(a.z, b.z, c.z) / CELL);
        z <= Math.floor(Math.max(a.z, b.z, c.z) / CELL);
        z++
      ) {
        const key = `${x}:${z}`,
          cell = this.cells.get(key) ?? [];
        cell.push(face);
        this.cells.set(key, cell);
      }
  }
  sweep(from: THREE.Vector3, to: THREE.Vector3, underside: boolean, result: THREE.Vector3): boolean {
    direction.copy(to).sub(from);
    const length = direction.length();
    if (length < 0.000001) return false;
    direction.divideScalar(length);
    ray.set(from, direction);
    let nearest = length + 0.00001,
      found = false;
    for (
      let x = Math.floor(Math.min(from.x, to.x) / CELL);
      x <= Math.floor(Math.max(from.x, to.x) / CELL);
      x++
    )
      for (
        let z = Math.floor(Math.min(from.z, to.z) / CELL);
        z <= Math.floor(Math.max(from.z, to.z) / CELL);
        z++
      ) {
        for (const f of this.cells.get(`${x}:${z}`) ?? []) {
          // A free-flying kart cannot latch onto an inverted stunt from outside.
          if (f.normal.y < 0.12 || direction.dot(f.normal) > 0 !== underside) continue;
          if (!ray.intersectTriangle(f.a, f.b, f.c, false, hit)) continue;
          const distance = hit.distanceTo(from);
          if (distance < nearest) {
            nearest = distance;
            result.copy(hit);
            found = true;
          }
        }
      }
    return found;
  }
}

const cache = new WeakMap<PhysWorld, RoadCollider>();
export function roadCollider(world: PhysWorld) {
  let collider = cache.get(world);
  if (!collider) {
    collider = new RoadCollider(world.paths);
    cache.set(world, collider);
  }
  return collider;
}
