import * as THREE from 'three';
import { lathe, MeshBuilder } from '../art/builder';
import { outlineMaterial, toon } from '../art/toon';
import type { VehicleModel } from '../vehicles/vehicleModel';

const _m = new THREE.Matrix4();
const _s = new THREE.Matrix4();
const _c = new THREE.Color();

/** All kart wheels in the race rendered with 3 instanced draw calls (§13 draw-call budget). */
export class WheelPool {
  group = new THREE.Group();
  private tire: THREE.InstancedMesh;
  private hub: THREE.InstancedMesh;
  private line: THREE.InstancedMesh;
  private list: { v: VehicleModel; i: number }[] = [];
  constructor(vehicles: VehicleModel[]) {
    let n = 0;
    for (const v of vehicles) n += v.wheels.length;
    const tb = new MeshBuilder();
    const prof: [number, number][] = [
      [0.55, -0.5],
      [0.9, -0.5],
      [1, -0.3],
      [1, 0.3],
      [0.9, 0.5],
      [0.55, 0.5],
    ];
    const tire = lathe(prof, 20);
    tire.rotateZ(Math.PI / 2);
    tb.add(tire, '#5A5470');
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      tb.box(0.85, 0.12, 0.22, '#4E4862', { p: [0, Math.cos(a) * 0.98, Math.sin(a) * 0.98], r: [a, 0, 0], outline: false }, 0.4, 1);
    }
    const hb = new MeshBuilder();
    for (const sx of [-1, 1]) {
      hb.cyl(0.56, 0.56, 0.04, '#FFFFFF', { p: [sx * 0.42, 0, 0], r: [0, 0, Math.PI / 2], outline: false }, 16);
      hb.sphere(0.2, '#FFFFFF', { p: [sx * 0.45, 0, 0], s: [0.5, 1, 1], outline: false });
    }
    this.tire = new THREE.InstancedMesh(tb.mergedSolid(false)!, toon({ vertexColors: true }), n);
    this.hub = new THREE.InstancedMesh(hb.mergedSolid(false)!, toon({ vertexColors: true }), n);
    const hull = tb.mergedHull()!;
    this.line = new THREE.InstancedMesh(hull, outlineMaterial(undefined, 0.8), n);
    for (const m of [this.tire, this.hub, this.line]) {
      m.frustumCulled = false;
      m.castShadow = m !== this.line;
      this.group.add(m);
    }
    let k = 0;
    for (const v of vehicles) {
      v.wheels.forEach((w) => {
        this.list.push({ v, i: k });
        this.hub.setColorAt(k, _c.set(w.spec.hub));
        k++;
      });
    }
    this.hub.instanceColor!.needsUpdate = true;
  }
  update() {
    let k = 0;
    const seen = new Set<VehicleModel>();
    for (const { v } of this.list) {
      if (seen.has(v)) continue;
      seen.add(v);
      // Parent kart pose changed this frame; update ancestors before instancing wheels.
      v.root.updateWorldMatrix(true, true);
      for (const w of v.wheels) {
        _s.makeScale(w.spec.w, w.spec.r, w.spec.r);
        _m.multiplyMatrices(w.spin.matrixWorld, _s);
        const vis = v.root.visible && v.root.parent?.visible !== false;
        if (!vis) _m.makeScale(0, 0, 0);
        this.tire.setMatrixAt(k, _m);
        this.hub.setMatrixAt(k, _m);
        this.line.setMatrixAt(k, _m);
        k++;
      }
    }
    this.tire.instanceMatrix.needsUpdate = true;
    this.hub.instanceMatrix.needsUpdate = true;
    this.line.instanceMatrix.needsUpdate = true;
  }
}
