import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { TrackDef } from '../data/tracks';
import type { TrackPath } from './path';
import { itemBoxTexture } from '../art/textures';
import { outlineMaterial, toon } from '../art/toon';

const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _e = new THREE.Euler();
const _s = new THREE.Vector3();
const _p = new THREE.Vector3();

/** Pastel rainbow "?" cubes in rows across the road (§5.1). */
export class ItemBoxes {
  pos: THREE.Vector3[] = [];
  active: boolean[] = [];
  timer: number[] = [];
  mesh: THREE.InstancedMesh;
  outline: THREE.InstancedMesh;
  core: THREE.InstancedMesh;
  group = new THREE.Group();
  constructor(def: TrackDef, main: TrackPath) {
    const L = main.length;
    for (const u of def.itemRows) {
      const s = u * L;
      const i = main.idxAtS(s);
      const hw = main.halfW[i];
      const n = hw * 2 >= 18 ? 5 : 4;
      for (let k = 0; k < n; k++) {
        const t = -hw + 2.6 + ((hw * 2 - 5.2) * k) / (n - 1);
        const p = new THREE.Vector3();
        main.pointAt(s, t, p, 1.25);
        this.pos.push(p);
        this.active.push(true);
        this.timer.push(0);
      }
    }
    const n = this.pos.length;
    const geo = new RoundedBoxGeometry(1.6, 1.6, 1.6, 3, 0.32);
    const mat = toon({ map: itemBoxTexture(), transparent: true, opacity: 0.9, emissive: '#ffffff', emissiveIntensity: 0.12 });
    this.mesh = new THREE.InstancedMesh(geo, mat, n);
    this.mesh.castShadow = true;
    this.outline = new THREE.InstancedMesh(geo, outlineMaterial('#FF9EC7', 1), n);
    const star = new THREE.OctahedronGeometry(0.45, 0);
    this.core = new THREE.InstancedMesh(star, new THREE.MeshBasicMaterial({ color: new THREE.Color('#FFF6C9').multiplyScalar(2.2), toneMapped: false }), n);
    for (const m of [this.mesh, this.outline, this.core]) m.frustumCulled = false;
    this.group.add(this.core, this.mesh, this.outline);
  }
  update(t: number, dt: number) {
    for (let i = 0; i < this.pos.length; i++) {
      let sc = 1;
      if (!this.active[i]) {
        this.timer[i] -= dt;
        if (this.timer[i] <= 0) {
          this.active[i] = true;
          this.timer[i] = -0.45; // pop-in animation timer
        }
        sc = 0;
      } else if (this.timer[i] < 0) {
        this.timer[i] = Math.min(0, this.timer[i] + dt);
        const k = 1 + this.timer[i] / 0.45;
        sc = k < 0.7 ? (k / 0.7) * 1.25 : 1.25 - ((k - 0.7) / 0.3) * 0.25; // "뽀용~" overshoot
      }
      const p = this.pos[i];
      _p.set(p.x, p.y + Math.sin(t * 2.2 + i) * 0.25, p.z);
      _e.set(t * 0.7 + i, t * 1.1 + i * 0.5, 0);
      _q.setFromEuler(_e);
      _s.setScalar(sc);
      _m.compose(_p, _q, _s);
      this.mesh.setMatrixAt(i, _m);
      this.outline.setMatrixAt(i, _m);
      _e.set(0, -t * 3, 0);
      _q.setFromEuler(_e);
      _s.setScalar(sc * (0.9 + Math.sin(t * 6 + i) * 0.1));
      _m.compose(_p, _q, _s);
      this.core.setMatrixAt(i, _m);
    }
    this.mesh.instanceMatrix.needsUpdate = true;
    this.outline.instanceMatrix.needsUpdate = true;
    this.core.instanceMatrix.needsUpdate = true;
  }
  /** returns index of collected box or -1 */
  collect(x: number, y: number, z: number, r: number): number {
    for (let i = 0; i < this.pos.length; i++) {
      if (!this.active[i] || this.timer[i] < -0.3) continue;
      const p = this.pos[i];
      const dx = p.x - x;
      const dy = p.y - y - 0.6;
      const dz = p.z - z;
      if (dx * dx + dz * dz < (r + 0.9) ** 2 && Math.abs(dy) < 2.2) {
        this.active[i] = false;
        this.timer[i] = 3;
        return i;
      }
    }
    return -1;
  }
}

/** 별사탕 (konpeito star candy) coins. */
export class Coins {
  pos: THREE.Vector3[] = [];
  active: boolean[] = [];
  timer: number[] = [];
  mesh: THREE.InstancedMesh;
  constructor(def: TrackDef, main: TrackPath) {
    const L = main.length;
    for (const c of def.coins) {
      for (let k = 0; k < c.n; k++) {
        const p = new THREE.Vector3();
        main.pointAt(c.u * L + k * 3.2, c.t, p, 0.9);
        this.pos.push(p);
        this.active.push(true);
        this.timer.push(0);
      }
    }
    const parts: THREE.BufferGeometry[] = [new THREE.IcosahedronGeometry(0.38, 1)];
    const ico = new THREE.IcosahedronGeometry(1, 0);
    const vp = ico.attributes.position;
    const seen = new Set<string>();
    for (let i = 0; i < vp.count; i++) {
      const v = new THREE.Vector3().fromBufferAttribute(vp, i).normalize();
      const k = v.toArray().map((x) => x.toFixed(2)).join();
      if (seen.has(k)) continue;
      seen.add(k);
      const cone = new THREE.ConeGeometry(0.13, 0.22, 6);
      cone.translate(0, 0.42, 0);
      cone.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), v));
      parts.push(cone);
    }
    const geo = mergeGeometries(parts.map((g) => {
      const c = g.index ? g.toNonIndexed() : g;
      c.deleteAttribute('uv');
      return c;
    }))!;
    geo.computeVertexNormals();
    const mat = toon({ color: '#ffffff', emissive: '#ffffff', emissiveIntensity: 0.25, rim: 1.5 });
    this.mesh = new THREE.InstancedMesh(geo, mat, this.pos.length);
    const cols = ['#FFC8DD', '#FDFFB6', '#A2D2FF', '#B9FBC0', '#CDB4DB', '#FFD6A5'];
    for (let i = 0; i < this.pos.length; i++) this.mesh.setColorAt(i, new THREE.Color(cols[i % cols.length]));
    this.mesh.castShadow = true;
    this.mesh.frustumCulled = false;
  }
  update(t: number, dt: number) {
    for (let i = 0; i < this.pos.length; i++) {
      let sc = 1;
      if (!this.active[i]) {
        this.timer[i] -= dt;
        if (this.timer[i] <= 0) this.active[i] = true;
        sc = 0;
      }
      const p = this.pos[i];
      _p.set(p.x, p.y + Math.sin(t * 3 + i * 0.7) * 0.15, p.z);
      _e.set(0.4, t * 2.5 + i, 0);
      _q.setFromEuler(_e);
      _s.setScalar(sc);
      _m.compose(_p, _q, _s);
      this.mesh.setMatrixAt(i, _m);
    }
    this.mesh.instanceMatrix.needsUpdate = true;
  }
  collect(x: number, y: number, z: number, r: number): number {
    for (let i = 0; i < this.pos.length; i++) {
      if (!this.active[i]) continue;
      const p = this.pos[i];
      const dx = p.x - x;
      const dz = p.z - z;
      if (dx * dx + dz * dz < (r + 0.55) ** 2 && Math.abs(p.y - y - 0.6) < 2) {
        this.active[i] = false;
        this.timer[i] = 12;
        return i;
      }
    }
    return -1;
  }
}
