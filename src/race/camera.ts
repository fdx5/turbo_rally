import * as THREE from 'three';
import { damp, dampAngle } from '../core/math';
import type { KartBody } from '../physics/kart';
import { useSettings } from '../core/settings';
import { Proj } from '../tracks/path';
import { roadCollider } from '../physics/roadCollider';
import type { PhysWorld } from '../physics/kart';
import { MeshBVH } from 'three-mesh-bvh';
const WORLD_UP = new THREE.Vector3(0, 1, 0);
const LENS_CORNERS = [
  [-0.38, -0.28],
  [0.38, -0.28],
  [-0.38, 0.28],
  [0.38, 0.28],
  [0, 0],
] as const;
type CameraWorld = PhysWorld & { group?: THREE.Group; groundHeight?: (x: number, z: number) => number };

/** Chase camera with speed-FOV, look-back, shake, intro fly-by and finish orbit. */
export class ChaseCam {
  cam: THREE.PerspectiveCamera;
  private pos = new THREE.Vector3();
  private look = new THREE.Vector3();
  private yaw = 0;
  private fov = 70;
  private shakeAmt = 0;
  private grade = 0;
  private projection = new Proj();
  private anchor = new THREE.Vector3();
  private hit = new THREE.Vector3();
  private otherHit = new THREE.Vector3();
  private probe = new THREE.Vector3();
  private roadMeshes: { bvh: MeshBVH; inverse: THREE.Matrix4; matrix: THREE.Matrix4 }[] = [];
  private ray = new THREE.Ray();
  private localRay = new THREE.Ray();
  private direction = new THREE.Vector3();
  mode: 'chase' | 'intro' | 'orbit' = 'intro';
  t = 0;
  height = 2.6;
  constructor(
    cam: THREE.PerspectiveCamera,
    private world?: CameraWorld,
  ) {
    this.cam = cam;
    world?.group?.updateMatrixWorld(true);
    world?.group?.traverse((object) => {
      const mesh = object as THREE.Mesh;
      if (mesh.isMesh && (mesh.name === 'road' || mesh.name === 'launch-ramp')) {
        const matrix = mesh.matrixWorld.clone();
        this.roadMeshes.push({
          bvh: new MeshBVH(mesh.geometry, { indirect: true }),
          matrix,
          inverse: matrix.clone().invert(),
        });
      }
    });
  }
  private intersectRoad(from: THREE.Vector3, to: THREE.Vector3, out: THREE.Vector3) {
    if (!this.roadMeshes.length) {
      const collider = roadCollider(this.world!);
      let found = false,
        distance = Infinity;
      for (const underside of [false, true])
        if (collider.sweep(from, to, underside, this.otherHit) && this.otherHit.distanceTo(from) < distance) {
          distance = this.otherHit.distanceTo(from);
          out.copy(this.otherHit);
          found = true;
        }
      return found;
    }
    const length = this.direction.subVectors(to, from).length();
    if (length < 0.00001) return false;
    this.ray.set(from, this.direction.divideScalar(length));
    let distance = length,
      found = false;
    for (const surface of this.roadMeshes) {
      this.localRay.copy(this.ray).applyMatrix4(surface.inverse);
      const hit = surface.bvh.raycastFirst(this.localRay, THREE.DoubleSide, 0.0001);
      if (!hit) continue;
      hit.point.applyMatrix4(surface.matrix);
      const d = hit.point.distanceTo(from);
      if (d < distance) {
        distance = d;
        out.copy(hit.point);
        found = true;
      }
    }
    return found;
  }
  snap(b: KartBody) {
    this.yaw = b.yaw;
    this.pos.set(b.x - Math.sin(b.yaw) * 7, b.y + 3, b.z - Math.cos(b.yaw) * 7);
    this.look.set(b.x, b.y + 1.2, b.z);
    this.grade = b.grounded ? b.proj.fy / Math.max(0.2, Math.hypot(b.proj.fx, b.proj.fz)) : 0;
  }
  /** Query the occupied route near the kart, never snap up onto an overhead crossing. */
  private floorAt(point: THREE.Vector3, b: KartBody) {
    const world = this.world;
    if (!world) return -Infinity;
    let floor = (world.groundHeight?.(point.x, point.z) ?? -Infinity) + 0.7;
    const path = world.paths[b.onPath] ?? world.main;
    const hint = path.idxAtS(b.onPath === 0 ? b.progressS : b.proj.s);
    const p = path.project(point.x, point.y, point.z, hint, this.projection, 32, Infinity);
    if (!p.gap && Math.abs(p.t) <= Math.max(p.limitL, p.limitR) + 0.5 && (b.grounded || b.y >= p.y - 3))
      floor = Math.max(floor, p.y + 1.15);
    return floor;
  }
  /** Resolve the camera boom against both sides of actual road triangles and terrain. */
  private protectCamera(b: KartBody, x: number, y: number, z: number) {
    if (!this.world) return;
    const pos = this.cam.position;
    pos.y = Math.max(pos.y, this.floorAt(pos, b));
    this.anchor.set(x, y + 1.15, z);
    // Resolve again after shortening: on a convex crest, shortening can put the
    // lens over a DIFFERENT (higher) part of the same road.
    for (let pass = 0; pass < 5; pass++) {
      pos.y = Math.max(pos.y, this.floorAt(pos, b));
      let fraction = 1;
      const length = pos.distanceTo(this.anchor);
      for (const [offset, vertical] of LENS_CORNERS) {
        this.probe.copy(pos);
        const dx = pos.x - x,
          dz = pos.z - z,
          horizontal = Math.hypot(dx, dz) || 1;
        this.probe.x += (dz / horizontal) * offset;
        this.probe.z -= (dx / horizontal) * offset;
        this.probe.y += vertical;
        if (this.intersectRoad(this.anchor, this.probe, this.hit))
          fraction = Math.min(
            fraction,
            Math.max(0, (this.hit.distanceTo(this.anchor) - 0.65) / Math.max(length, 0.01)),
          );
      }
      if (this.world.groundHeight)
        for (let i = 1; i <= 12; i++) {
          const t = i / 12;
          this.otherHit.lerpVectors(this.anchor, pos, t);
          if (this.otherHit.y < this.world.groundHeight(this.otherHit.x, this.otherHit.z) + 0.45) {
            fraction = Math.min(fraction, Math.max(0, t - 0.09));
            break;
          }
        }
      if (fraction >= 1) break;
      pos.lerpVectors(this.anchor, pos, fraction);
      if (pass === 4) pos.copy(this.anchor);
    }
    this.pos.copy(pos);
  }
  shake(a: number) {
    if (!useSettings.getState().screenShake) return;
    this.shakeAmt = Math.max(this.shakeAmt, a);
  }
  update(
    dt: number,
    b: KartBody,
    x: number,
    y: number,
    z: number,
    yaw: number,
    lookBack: boolean,
    introCentre?: THREE.Vector3,
  ) {
    this.t += dt;
    const c = this.cam;
    if (b.loopActive && this.mode === 'chase') {
      const f = b.loopFrame;
      const distance = 9;
      const direction = lookBack ? -1 : 1;
      this.pos.set(
        x - f.fx * distance * direction + f.ux * 3.4,
        y - f.fy * distance * direction + f.uy * 3.4,
        z - f.fz * distance * direction + f.uz * 3.4,
      );
      this.look.set(
        x + f.fx * 12 * direction + f.ux,
        y + f.fy * 12 * direction + f.uy,
        z + f.fz * 12 * direction + f.uz,
      );
      c.up.set(f.ux, f.uy, f.uz);
      c.position.copy(this.pos);
      c.lookAt(this.look);
      this.yaw = yaw;
      return;
    }
    c.up.lerp(WORLD_UP, Math.min(1, dt * 5)).normalize();
    if (this.mode === 'intro' && introCentre) {
      // stay inside the road corridor so roadside props never clip the lens
      const a = this.t * 0.45 + 2.2;
      const r = Math.max(7, 13 - this.t * 1.6);
      c.position.set(
        introCentre.x + Math.sin(a) * r,
        introCentre.y + 5.5 - this.t * 0.4,
        introCentre.z + Math.cos(a) * r,
      );
      this.protectCamera(b, x, y, z);
      c.lookAt(introCentre.x, introCentre.y + 1, introCentre.z);
      c.fov = 60;
      c.updateProjectionMatrix();
      this.snap(b);
      return;
    }
    if (this.mode === 'orbit') {
      const a = this.t * 0.4;
      c.position.set(x + Math.sin(a) * 7.5, y + 2.6, z + Math.cos(a) * 7.5);
      this.protectCamera(b, x, y, z);
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
    const horizontal = Math.hypot(b.proj.fx, b.proj.fz) || 1;
    const targetGrade = b.grounded ? b.proj.fy / horizontal : 0;
    this.grade = damp(this.grade, targetGrade, 10, dt);
    const alongRoad = (fx * b.proj.fx + fz * b.proj.fz) / horizontal;
    // A downhill rear camera belongs ABOVE the higher road behind the kart.
    const ty = y + h - this.grade * dist * alongRoad;
    const k = lookBack ? 30 : 9;
    this.pos.x = damp(this.pos.x, tx, k, dt);
    this.pos.z = damp(this.pos.z, tz, k, dt);
    this.pos.y = damp(this.pos.y, ty, b.grounded ? 7 : 3, dt);
    this.look.set(x + fx * 5, y + 1.25 + this.grade * 5 * alongRoad, z + fz * 5);
    c.position.copy(this.pos);
    if (this.shakeAmt > 0) {
      c.position.x += (Math.random() - 0.5) * this.shakeAmt;
      c.position.y += (Math.random() - 0.5) * this.shakeAmt;
      this.shakeAmt = Math.max(0, this.shakeAmt - dt * 2.5);
    }
    this.protectCamera(b, x, y, z);
    c.lookAt(this.look);
    const targetFov = 66 + Math.min(sp, 40) * 0.2 + (b.boostT > 0 ? 7 : 0);
    this.fov = damp(this.fov, targetFov, 4, dt);
    c.fov = this.fov;
    c.updateProjectionMatrix();
  }
}
