import * as THREE from 'three';
import type { HazardDef } from '../data/tracks';
import type { TrackWorld } from './trackBuilder';
import { MeshBuilder, extrudeShape, starShape } from '../art/builder';
import { Rng } from '../core/rng';

export interface HazardHit {
  x: number;
  z: number;
  y: number;
  r: number;
  kind: 'spin' | 'push' | 'slow';
}

function model(kind: string): THREE.Object3D {
  const b = new MeshBuilder();
  switch (kind) {
    case 'donut':
      b.torus(1.5, 0.75, '#F2C185', { r: [0, Math.PI / 2, 0] });
      b.torus(1.5, 0.55, '#FF9EC7', { p: [0.25, 0, 0], r: [0, Math.PI / 2, 0], s: [1, 1, 0.8] });
      for (let i = 0; i < 10; i++) b.capsule(0.06, 0.2, ['#FFFFFF', '#A2D2FF', '#FDFFB6'][i % 3], { p: [0.75, Math.cos(i * 0.63) * 1.5, Math.sin(i * 0.63) * 1.5], r: [i, 0, 0], outline: false });
      break;
    case 'snowball':
      b.sphere(2, '#FFFFFF');
      break;
    case 'tangerine':
      b.sphere(1.3, '#FFA94D');
      b.sphere(0.25, '#7BD389', { p: [0, 1.25, 0], s: [1.6, 0.4, 0.8] });
      break;
    case 'gourd':
      b.sphere(1.6, '#F3F0D8', { s: [1, 0.9, 1] });
      b.cyl(0.12, 0.15, 0.5, '#8B9A6A', { p: [0, 1.5, 0] });
      break;
    case 'duckboat':
      b.box(2.6, 1.2, 3.6, '#FFFFFF', { p: [0, 0.6, 0] }, 0.35);
      b.sphere(0.9, '#FFE066', { p: [0, 2.1, 1.0] });
      b.sphere(1.1, '#FFE066', { p: [0, 1.4, 0.2], s: [1, 0.9, 1.3] });
      b.cone(0.3, 0.5, '#FFA94D', { p: [0, 2.0, 1.85], r: [Math.PI / 2, 0, 0] }, 8);
      for (const sx of [-1, 1]) b.sphere(0.12, '#4A3B52', { p: [sx * 0.35, 2.3, 1.7], outline: false });
      break;
    case 'bus':
      b.box(2.4, 2.4, 7, '#7FB8F0', { p: [0, 1.6, 0] }, 0.18);
      b.box(2.44, 0.8, 6.0, '#D9EEFF', { p: [0, 2.1, -0.2], outline: false }, 0.2);
      for (const z of [-2.4, 2.4]) for (const x of [-1.1, 1.1]) b.cyl(0.55, 0.55, 0.5, '#5A5470', { p: [x, 0.55, z], r: [0, 0, Math.PI / 2] });
      b.box(1.8, 0.4, 0.1, '#FFB067', { p: [0, 2.6, 3.52], glow: 1.5 });
      break;
    case 'crane':
      b.box(1.2, 1.2, 1.2, '#FFE066', { p: [0, 0, 0] }, 0.2);
      b.box(1.0, 0.9, 1.0, '#FFB067', { p: [0, -0.4, 0] }, 0.2);
      break;
    case 'crate':
      b.box(2, 2, 2, '#E8B67A', {}, 0.15);
      b.box(2.05, 0.3, 2.05, '#FFB067', { outline: false }, 0.3);
      break;
    case 'kite':
      b.box(2.2, 2.6, 0.12, '#FF8A8A', { r: [0, 0, Math.PI / 4] }, 0.2);
      b.box(1.5, 0.12, 0.14, '#7FB3FF', { r: [0, 0, Math.PI / 4] }, 0.3);
      b.box(0.12, 1.5, 0.14, '#7FB3FF', { r: [0, 0, Math.PI / 4] }, 0.3);
      b.sphere(0.4, '#FFE066', { p: [0, 0, 0.1] });
      break;
    case 'stars': {
      const st = extrudeShape(starShape(1, 0.5), 0.5, 0.1);
      b.cyl(0.4, 0.5, 1.6, '#FFFFFF', { p: [0, 0.8, 0] });
      b.box(0.4, 0.4, 0, '#FFFFFF', {}, 0.2);
      for (const sx of [-1, 1]) {
        b.capsule(0.18, 0, '#FFFFFF', { p: [0, 1.5, 0] });
        b.add(st, '#FFE066', { p: [sx * 0, 1.5, 0], s: 0.01 });
      }
      break;
    }
  }
  return b.build({ outline: true });
}

/** Moving track gimmicks (§10.3 기믹). Each returns hit circles each frame. */
export class Hazards {
  group = new THREE.Group();
  private items: { def: HazardDef; objs: THREE.Object3D[]; data: number[]; rng: Rng }[] = [];
  hits: HazardHit[] = [];
  waveActive = false;
  waveRange: [number, number] = [0, 0];
  private waveMesh: THREE.Mesh | null = null;
  constructor(private world: TrackWorld) {
    const L = world.main.length;
    const rng = new Rng(world.def.no * 77);
    for (const h of world.def.hazards) {
      const objs: THREE.Object3D[] = [];
      switch (h.type) {
        case 'roller':
          objs.push(model(h.model));
          break;
        case 'crosser':
          for (let k = 0; k < (h.model === 'duckboat' ? 3 : 1); k++) objs.push(model(h.model));
          break;
        case 'swinger': {
          const g = new THREE.Group();
          const tower = new MeshBuilder();
          tower.box(1.4, 18, 1.4, '#FFE066', { p: [0, 9, 0] }, 0.1);
          const arm = new MeshBuilder();
          arm.box(h.len * 2, 1, 1, '#FFE066', { p: [h.len, 0, 0] }, 0.2);
          const armG = arm.build();
          armG.position.y = 17;
          const hook = model('crane');
          hook.position.set(h.len * 2 - 1, -12.5, 0);
          const cable = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 12, 6), new THREE.MeshBasicMaterial({ color: '#5E5873' }));
          cable.position.set(h.len * 2 - 1, -6.5, 0);
          armG.add(hook, cable);
          g.add(tower.build(), armG);
          g.userData.arm = armG;
          objs.push(g);
          break;
        }
        case 'dropper':
          for (let k = 0; k < 3; k++) objs.push(model('crate'));
          break;
        case 'spinner': {
          const g = new THREE.Group();
          const b = new MeshBuilder();
          b.cyl(0.6, 0.8, 2.2, '#FFFFFF', { p: [0, 1.1, 0] });
          const st = extrudeShape(starShape(1, 0.5), 0.5, 0.1);
          const arm = new MeshBuilder();
          arm.capsule(0.25, h.len * 2, '#F3EAFF', { p: [0, 1.6, 0], r: [0, 0, Math.PI / 2] });
          for (const sx of [-1, 1]) arm.add(st, '#FFE066', { p: [sx * h.len, 1.6, 0], s: 1.4, glow: 0 });
          const armG = arm.build();
          g.add(b.build(), armG);
          g.userData.arm = armG;
          objs.push(g);
          break;
        }
        case 'kite':
          objs.push(model('kite'));
          break;
        case 'downhill':
          for (let k = 0; k < 3; k++) objs.push(model(h.model));
          break;
        case 'wave': {
          this.waveRange = [h.u0 * L, h.u1 * L];
          const geo = new THREE.PlaneGeometry(1, 1, 1, 1).rotateX(-Math.PI / 2);
          const m = new THREE.Mesh(
            geo,
            new THREE.MeshBasicMaterial({ color: '#B9F0FF', transparent: true, opacity: 0.75, depthWrite: false, side: THREE.DoubleSide }),
          );
          this.waveMesh = m;
          this.group.add(m);
          break;
        }
      }
      for (const o of objs) this.group.add(o);
      this.items.push({ def: h, objs, data: objs.map(() => 0), rng: new Rng(rng.int(0, 1e6)) });
    }
  }
  update(t: number) {
    const m = this.world.main;
    const L = m.length;
    const v = new THREE.Vector3();
    this.hits.length = 0;
    for (const it of this.items) {
      const h = it.def;
      switch (h.type) {
        case 'roller': {
          const s = h.u * L;
          const i = m.idxAtS(s);
          const lat = Math.sin((t / h.period) * Math.PI * 2) * (m.halfW[i] - 1.5);
          m.pointAt(s, lat, v, h.radius);
          const o = it.objs[0];
          o.position.copy(v);
          o.rotation.y = Math.atan2(m.fx[i], m.fz[i]);
          o.rotation.x = 0;
          o.children[0].rotation.x = lat * 0.6;
          this.hits.push({ x: v.x, z: v.z, y: v.y, r: h.radius + 0.4, kind: 'spin' });
          break;
        }
        case 'crosser': {
          const s = h.u * L;
          const i = m.idxAtS(s);
          const hw = m.halfW[i] + m.shoulderL[i] + 14;
          it.objs.forEach((o, k) => {
            const ph = ((t + k * 1.1) / h.period) % 1;
            const lat = -hw + ph * hw * 2;
            m.pointAt(s + (k - 1) * 4.5 * (h.model === 'duckboat' ? 1 : 0), lat, v, 0);
            o.position.copy(v);
            o.rotation.y = Math.atan2(m.hx[i], m.hz[i]);
            o.position.y += h.model === 'duckboat' ? Math.sin(t * 6 + k) * 0.1 : 0;
            o.visible = Math.abs(lat) < hw - 1;
            if (o.visible && Math.abs(lat) < m.halfW[i] + m.shoulderL[i] + 2) this.hits.push({ x: v.x, z: v.z, y: v.y, r: h.radius, kind: 'push' });
          });
          break;
        }
        case 'swinger': {
          const s = h.u * L;
          const i = m.idxAtS(s);
          const off = m.halfW[i] + m.shoulderR[i] + 2.5;
          m.pointAt(s, off, v, 0);
          const g = it.objs[0];
          g.position.copy(v);
          g.position.y = m.py[i] - 0.5;
          const yawRoad = Math.atan2(m.hx[i], m.hz[i]);
          const swing = Math.PI + Math.sin((t / h.period) * Math.PI * 2) * 0.9;
          (g.userData.arm as THREE.Object3D).rotation.y = yawRoad + swing - Math.PI / 2;
          const armG = g.userData.arm as THREE.Object3D;
          const hookWorld = new THREE.Vector3(h.len * 2 - 1, -12.5, 0).applyEuler(armG.rotation).add(g.position).add(new THREE.Vector3(0, 17, 0));
          this.hits.push({ x: hookWorld.x, z: hookWorld.z, y: m.py[i], r: 1.8, kind: 'spin' });
          break;
        }
        case 'dropper': {
          const s0 = h.u0 * L;
          const s1 = h.u1 * L;
          it.objs.forEach((o, k) => {
            const cyc = (t + k * (h.interval / 3) * 3) / (h.interval * 3);
            const n = Math.floor(cyc);
            const ph = cyc - n;
            const r = new Rng(n * 31 + k);
            const s = s0 + r.next() * (s1 - s0);
            const i = m.idxAtS(s);
            const lat = r.range(-m.halfW[i] + 2, m.halfW[i] - 2);
            m.pointAt(s, lat, v, 0);
            const fall = Math.max(0, 1 - ph * 3);
            o.position.set(v.x, v.y + 1 + fall * fall * 25, v.z);
            o.rotation.y = n;
            o.visible = ph < 0.8;
            if (o.visible && fall < 0.15) this.hits.push({ x: v.x, z: v.z, y: v.y, r: 1.6, kind: 'spin' });
          });
          break;
        }
        case 'spinner': {
          const s = h.u * L;
          const i = m.idxAtS(s);
          m.pointAt(s, 0, v, 0);
          const g = it.objs[0];
          g.position.copy(v);
          const a = (t / h.period) * Math.PI * 2;
          (g.userData.arm as THREE.Object3D).rotation.y = a;
          for (const sx of [-1, 1]) {
            const px = v.x + Math.cos(a) * h.len * sx;
            const pz = v.z - Math.sin(a) * h.len * sx;
            this.hits.push({ x: px, z: pz, y: v.y, r: 1.6, kind: 'spin' });
          }
          this.hits.push({ x: v.x, z: v.z, y: v.y, r: 1.0, kind: 'push' });
          void i;
          break;
        }
        case 'kite': {
          const s = h.u * L;
          const i = m.idxAtS(s);
          const ph = (t / h.period) * Math.PI * 2;
          const lat = Math.sin(ph) * (m.halfW[i] - 1);
          const height = 1.4 + (1 + Math.cos(ph * 2)) * 3.5;
          m.pointAt(s + Math.cos(ph) * 10, lat, v, height);
          const o = it.objs[0];
          o.position.copy(v);
          o.rotation.y = ph;
          o.rotation.z = Math.sin(ph * 3) * 0.3;
          if (height < 2.4) this.hits.push({ x: v.x, z: v.z, y: v.y - height, r: 1.5, kind: 'spin' });
          break;
        }
        case 'downhill': {
          const s0 = h.u0 * L;
          const s1 = h.u1 * L;
          it.objs.forEach((o, k) => {
            const ph = ((t + (k * h.interval * 3) / 3) / (h.interval * 3)) % 1;
            const s = s1 - ph * (s1 - s0);
            const r = new Rng(Math.floor((t + k * h.interval) / (h.interval * 3)) * 7 + k);
            const i = m.idxAtS(s);
            const lat = r.range(-m.halfW[i] + 2, m.halfW[i] - 2);
            m.pointAt(s, lat, v, h.radius);
            o.position.copy(v);
            o.rotation.x -= 0.15;
            o.rotation.y = Math.atan2(m.fx[i], m.fz[i]);
            o.visible = ph > 0.03 && ph < 0.97;
            if (o.visible) this.hits.push({ x: v.x, z: v.z, y: v.y, r: h.radius + 0.4, kind: 'spin' });
          });
          break;
        }
        case 'wave': {
          const ph = (t / h.period) % 1;
          const mesh = this.waveMesh!;
          const sMid = (this.waveRange[0] + this.waveRange[1]) / 2;
          const i = m.idxAtS(sMid);
          const cover = ph < 0.55 ? 0 : ph < 0.7 ? (ph - 0.55) / 0.15 : ph < 0.85 ? 1 : 1 - (ph - 0.85) / 0.15;
          this.waveActive = cover > 0.5;
          const hw = m.halfW[i] + m.shoulderR[i];
          const width = cover * hw * 2 + 0.01;
          m.pointAt(sMid, hw - width / 2, v, 0.12 + Math.sin(t * 5) * 0.05);
          mesh.position.copy(v);
          mesh.rotation.set(0, Math.atan2(m.fx[i], m.fz[i]), 0);
          mesh.scale.set(width, 1, this.waveRange[1] - this.waveRange[0]);
          mesh.visible = cover > 0.02;
          break;
        }
      }
    }
  }
}
