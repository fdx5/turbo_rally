import type { KartBody, PhysWorld } from './kart';
import { Proj } from '../tracks/path';

const projection = new Proj();

/** Non-damaging contact: separate lanes without transferring momentum or status effects. */
export class KartContacts {
  private touching = new Set<string>();

  resolve(a: KartBody, b: KartBody, key: string, world: PhysWorld): boolean {
    const dx = b.x - a.x,
      dy = b.y - a.y,
      dz = b.z - a.z;
    const radius = a.radius * (a.shrinkT > 0 ? 0.6 : 1) + b.radius * (b.shrinkT > 0 ? 0.6 : 1);
    const distance = Math.hypot(dx, dy, dz);
    if (distance > radius + 0.5 || a.respawnT > 0 || b.respawnT > 0 || a.ghostT > 0 || b.ghostT > 0) {
      this.touching.delete(key);
      return false;
    }
    if (
      distance >= radius ||
      !a.grounded ||
      !b.grounded ||
      a.onPath !== b.onPath ||
      a.loopActive !== b.loopActive
    )
      return false;
    const entered = !this.touching.has(key);
    this.touching.add(key);
    // Each kart stays on its own road plane. Rear impacts never carry the other kart forward.
    const ah = a.proj;
    const bh = b.proj;
    const alignment = ah.hx * bh.hx + ah.hz * bh.hz;
    if (alignment < 0.5) return entered;
    const lateral = dx * ah.hx + dz * ah.hz;
    const direction = lateral < -0.001 ? -1 : 1;
    const forward2 = Math.max(0, distance * distance - lateral * lateral);
    const needed = Math.max(0, Math.sqrt(Math.max(0, radius * radius - forward2)) - Math.abs(lateral)) + 0.01;
    this.move(a, (-direction * needed) / 2, world);
    this.move(b, (direction * needed) / 2, world);
    return entered;
  }

  private move(k: KartBody, offset: number, world: PhysWorld) {
    const p = world.paths[k.onPath];
    const bound = Math.max(0, k.proj.halfW - k.radius - 0.25);
    const target = Math.max(-bound, Math.min(bound, k.proj.t + offset));
    const shift = target - k.proj.t;
    k.x += k.proj.hx * shift;
    k.z += k.proj.hz * shift;
    p.project(k.x, k.y, k.z, k.hints[k.onPath], projection, 4);
    if (k.grounded) k.y = k.lastGroundY = projection.y;
    Object.assign(k.proj, projection);
  }
}
