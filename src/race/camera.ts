import * as THREE from 'three';
import { damp, dampAngle } from '../core/math';
import type { KartBody } from '../physics/kart';
import { useSettings } from '../core/settings';

/** Chase camera with speed-FOV, look-back, shake, intro fly-by and finish orbit. */
export class ChaseCam {
  cam: THREE.PerspectiveCamera;
  private pos = new THREE.Vector3();
  private look = new THREE.Vector3();
  private yaw = 0;
  private fov = 70;
  private shakeAmt = 0;
  mode: 'chase' | 'intro' | 'orbit' = 'intro';
  t = 0;
  height = 2.6;
  constructor(cam: THREE.PerspectiveCamera) {
    this.cam = cam;
  }
  snap(b: KartBody) {
    this.yaw = b.yaw;
    this.pos.set(b.x - Math.sin(b.yaw) * 7, b.y + 3, b.z - Math.cos(b.yaw) * 7);
    this.look.set(b.x, b.y + 1.2, b.z);
  }
  shake(a: number) {
    if (!useSettings.getState().screenShake) return;
    this.shakeAmt = Math.max(this.shakeAmt, a);
  }
  update(dt: number, b: KartBody, x: number, y: number, z: number, yaw: number, lookBack: boolean, introCentre?: THREE.Vector3) {
    this.t += dt;
    const c = this.cam;
    if (this.mode === 'intro' && introCentre) {
      const a = this.t * 0.35 + 2.2;
      const r = 26 - this.t * 2.5;
      c.position.set(introCentre.x + Math.sin(a) * r, introCentre.y + 7 - this.t * 0.6, introCentre.z + Math.cos(a) * r);
      c.lookAt(introCentre.x, introCentre.y + 1, introCentre.z);
      c.fov = 60;
      c.updateProjectionMatrix();
      this.snap(b);
      return;
    }
    if (this.mode === 'orbit') {
      const a = this.t * 0.4;
      c.position.set(x + Math.sin(a) * 7.5, y + 2.6, z + Math.cos(a) * 7.5);
      c.lookAt(x, y + 1.3, z);
      c.fov = 55;
      c.updateProjectionMatrix();
      return;
    }
    const sp = Math.abs(b.speed);
    const targetYaw = yaw + (lookBack ? Math.PI : 0) + b.driftVisual * 0.35;
    this.yaw = lookBack ? targetYaw : dampAngle(this.yaw, targetYaw, b.drifting ? 4 : 6, dt);
    const dist = 6.4 + Math.min(sp, 40) * 0.035 - (b.boostT > 0 ? -0.6 : 0);
    const h = this.height + Math.min(sp, 40) * 0.01;
    const fx = Math.sin(this.yaw);
    const fz = Math.cos(this.yaw);
    const tx = x - fx * dist;
    const tz = z - fz * dist;
    const ty = y + h;
    const k = lookBack ? 30 : 9;
    this.pos.x = damp(this.pos.x, tx, k, dt);
    this.pos.z = damp(this.pos.z, tz, k, dt);
    this.pos.y = damp(this.pos.y, ty, b.grounded ? 7 : 3, dt);
    this.look.set(x + fx * 5, y + 1.25, z + fz * 5);
    c.position.copy(this.pos);
    if (this.shakeAmt > 0) {
      c.position.x += (Math.random() - 0.5) * this.shakeAmt;
      c.position.y += (Math.random() - 0.5) * this.shakeAmt;
      this.shakeAmt = Math.max(0, this.shakeAmt - dt * 2.5);
    }
    c.lookAt(this.look);
    const targetFov = 66 + Math.min(sp, 40) * 0.2 + (b.boostT > 0 ? 7 : 0);
    this.fov = damp(this.fov, targetFov, 4, dt);
    c.fov = this.fov;
    c.updateProjectionMatrix();
  }
}
