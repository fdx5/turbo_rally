import * as THREE from 'three';
import { REGIONS, vehicleBlueprint, type VehicleBlueprint } from './models';
import { setRegionW } from './decals';
import { canvas, tex } from '../art/textures';
import { glow, outlineMaterial, toon } from '../art/toon';
import { lathe, MeshBuilder } from '../art/builder';
import { bakeMerge } from '../art/bake';

const ATLAS_W = 2048;
const ATLAS_H = 1024;

function fitRect(region: [number, number, number, number], aspect: number): [number, number, number, number] {
  const [x, y, w, h] = region;
  if (w / h > aspect) {
    const nw = h * aspect;
    return [x + (w - nw) / 2, y, nw, h];
  }
  const nh = w / aspect;
  return [x, y + (h - nh) / 2, w, nh];
}

/** Draw all decal regions into one atlas, then build one merged decal mesh (1 draw call). */
function buildDecals(bp: VehicleBlueprint, scale: number): THREE.Mesh | null {
  if (!bp.decals.length) return null;
  const W = Math.round(ATLAS_W * scale);
  const H = Math.round(ATLAS_H * scale);
  const [c, g] = canvas(W, H);
  const used = new Map<string, [number, number, number, number]>();
  const geos: THREE.BufferGeometry[] = [];
  for (const d of bp.decals) {
    const key = d.region + ':' + (d.w / d.h).toFixed(3);
    let rect = used.get(key);
    if (!rect) {
      const reg = REGIONS[d.region];
      rect = fitRect([reg[0] * scale, reg[1] * scale, reg[2] * scale, reg[3] * scale], d.w / d.h);
      used.set(key, rect);
      const fn = bp.draw[d.region];
      if (fn) {
        g.save();
        g.beginPath();
        g.rect(rect[0], rect[1], rect[2], rect[3]);
        g.clip();
        g.translate(rect[0], rect[1]);
        setRegionW(rect[2]);
        fn(g, rect[2], rect[3]);
        setRegionW(Infinity);
        g.restore();
      }
    }
    const pg = new THREE.PlaneGeometry(d.w, d.h);
    const uv = pg.attributes.uv as THREE.BufferAttribute;
    const [rx, ry, rw, rh] = rect;
    for (let i = 0; i < uv.count; i++) {
      const u = uv.getX(i);
      const v = uv.getY(i);
      uv.setXY(i, (rx + u * rw) / W, 1 - (ry + (1 - v) * rh) / H);
    }
    const m = new THREE.Matrix4();
    const rot = new THREE.Euler();
    switch (d.face) {
      case 'L':
        rot.set(0, Math.PI / 2, 0);
        break;
      case 'R':
        rot.set(0, -Math.PI / 2, 0);
        break;
      case 'B':
        rot.set(0, Math.PI, 0);
        break;
      case 'U':
        rot.set(-Math.PI / 2, 0, 0);
        break;
      default:
        rot.set(0, 0, 0);
    }
    m.compose(new THREE.Vector3(...d.p), new THREE.Quaternion().setFromEuler(rot), new THREE.Vector3(1, 1, 1));
    pg.applyMatrix4(m);
    geos.push(pg);
  }
  const merged = geos.length === 1 ? geos[0] : mergePlanes(geos);
  const t = tex(c);
  const mat = new THREE.MeshToonMaterial({
    map: t,
    transparent: true,
    alphaTest: 0.35,
    polygonOffset: true,
    polygonOffsetFactor: -3,
    polygonOffsetUnits: -3,
    gradientMap: (toon({}) as THREE.MeshToonMaterial).gradientMap,
  });
  const mesh = new THREE.Mesh(merged, mat);
  mesh.name = 'decals';
  mesh.renderOrder = 2;
  return mesh;
}
function mergePlanes(geos: THREE.BufferGeometry[]): THREE.BufferGeometry {
  const pos: number[] = [];
  const nor: number[] = [];
  const uv: number[] = [];
  const idx: number[] = [];
  let off = 0;
  for (const g of geos) {
    const p = g.attributes.position as THREE.BufferAttribute;
    const n = g.attributes.normal as THREE.BufferAttribute;
    const u = g.attributes.uv as THREE.BufferAttribute;
    for (let i = 0; i < p.count; i++) {
      pos.push(p.getX(i), p.getY(i), p.getZ(i));
      nor.push(n.getX(i), n.getY(i), n.getZ(i));
      uv.push(u.getX(i), u.getY(i));
    }
    const ix = g.index!;
    for (let i = 0; i < ix.count; i++) idx.push(ix.getX(i) + off);
    off += p.count;
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  out.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  out.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  out.setIndex(idx);
  return out;
}

const wheelCache = new Map<string, THREE.Group>();
function wheelMesh(r: number, w: number, hub: string, outline: boolean): THREE.Group {
  const key = `${r.toFixed(2)}:${w.toFixed(2)}:${hub}:${outline}`;
  const hit = wheelCache.get(key);
  if (hit) return hit.clone();
  const b = new MeshBuilder();
  const prof: [number, number][] = [
    [r * 0.55, -w / 2],
    [r * 0.9, -w / 2],
    [r, -w / 2 + w * 0.2],
    [r, w / 2 - w * 0.2],
    [r * 0.9, w / 2],
    [r * 0.55, w / 2],
  ];
  const tire = lathe(prof, 22);
  tire.rotateZ(Math.PI / 2);
  b.add(tire, '#5A5470');
  // tread bumps
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    b.box(w * 0.85, r * 0.12, r * 0.22, '#4E4862', { p: [0, Math.cos(a) * r * 0.98, Math.sin(a) * r * 0.98], r: [a, 0, 0], outline: false }, 0.4, 1);
  }
  for (const sx of [-1, 1]) {
    b.cyl(r * 0.56, r * 0.56, 0.04, hub, { p: [sx * w * 0.42, 0, 0], r: [0, 0, Math.PI / 2], outline: false }, 18);
    b.sphere(r * 0.2, '#FFFFFF', { p: [sx * w * 0.45, 0, 0], s: [0.5, 1, 1], outline: false });
  }
  const g = b.build({ outline, outlineWidth: 0.8, ao: false });
  wheelCache.set(key, g);
  return g.clone();
}

export interface KartVisualState {
  speed: number;
  steer: number;
  drift: number; // -1..1 drift direction
  air: boolean;
  landT: number; // squash timer
  boost: boolean;
  t: number;
  spinAngle: number;
  skillT: number; // >0 while skill anim plays
  beacons: boolean;
}

/** Runtime vehicle: merged body + decals + animated parts + wheels (§7.1 animations). */
export class VehicleModel {
  root = new THREE.Group();
  body = new THREE.Group();
  seat = new THREE.Object3D();
  bp: VehicleBlueprint;
  wheels: { g: THREE.Group; spec: VehicleBlueprint['wheels'][number]; spin: THREE.Group }[] = [];
  parts: Record<string, THREE.Group> = {};
  beaconMeshes: THREE.Mesh[] = [];
  outlines: THREE.Object3D[] = [];
  private wheelSpin = 0;
  pooled: boolean;
  constructor(id: string, opts: { outline?: boolean; decalScale?: number; pooledWheels?: boolean } = {}) {
    this.pooled = !!opts.pooledWheels;
    const outline = opts.outline !== false;
    this.bp = vehicleBlueprint(id);
    const bp = this.bp;
    this.root.add(this.body);
    this.root.name = 'vehicle:' + id;
    const built = bp.body.build({ outline, outlineWidth: 1.0 });
    this.body.add(built);
    built.traverse((o) => {
      if (o.name === 'outline') this.outlines.push(o);
    });
    const decals = buildDecals(bp, opts.decalScale ?? 1);
    if (decals) this.body.add(decals);
    for (const p of bp.parts) {
      const pivot = new THREE.Group();
      pivot.position.set(...p.pivot);
      const g = p.builder.build({ outline });
      pivot.add(g);
      g.traverse((o) => {
        if (o.name === 'outline') this.outlines.push(o);
      });
      this.body.add(pivot);
      this.parts[p.name] = pivot;
    }
    for (const bc of bp.beacons) {
      const m = new THREE.Mesh(new THREE.SphereGeometry(0.13, 12, 8), glow(bc.color, 2.6));
      m.position.set(...bc.p);
      m.scale.set(1.3, 0.8, 1.3);
      this.body.add(m);
      this.beaconMeshes.push(m);
    }
    this.seat.position.set(...bp.seat);
    this.body.add(this.seat);
    for (const w of bp.wheels) {
      const g = new THREE.Group();
      g.position.set(w.x, w.r, w.z);
      const spin = new THREE.Group();
      if (!this.pooled) {
        const mesh = wheelMesh(w.r, w.w, w.hub, outline);
        spin.add(mesh);
        mesh.traverse((o) => {
          if (o.name === 'outline') this.outlines.push(o);
        });
      }
      g.add(spin);
      this.root.add(g);
      this.wheels.push({ g, spec: w, spin });
    }
    this.root.traverse((o) => {
      if ((o as THREE.Mesh).isMesh && o.name !== 'outline') o.castShadow = true;
    });
    // batch static body meshes (keeps animated parts, decals and beacons separate)
    const keep = new Set<THREE.Object3D>([...Object.values(this.parts), ...this.beaconMeshes, this.seat]);
    bakeMerge(this.body, (o) => keep.has(o) || o.name === 'decals');
    this.outlines = [];
    this.root.traverse((o) => {
      if (o.name === 'outline') this.outlines.push(o);
    });
  }
  setOutlines(v: boolean) {
    for (const o of this.outlines) o.visible = v;
  }
  update(dt: number, s: KartVisualState) {
    const r0 = this.bp.wheels[0]?.r ?? 0.45;
    this.wheelSpin += (s.speed / r0) * dt;
    for (const w of this.wheels) {
      w.spin.rotation.x = this.wheelSpin * (r0 / w.spec.r);
      if (w.spec.front) w.g.rotation.y = s.steer * 0.45 + s.drift * 0.25;
      w.g.position.y = w.spec.r + (s.air ? -0.12 : 0);
    }
    // body: lean into drift, squash & stretch on landing, slight boost pitch
    const squash = s.landT > 0 ? Math.sin((1 - s.landT / 0.25) * Math.PI) * 0.12 : 0;
    this.body.scale.set(1 + squash * 0.6, 1 - squash, 1 + squash * 0.6);
    this.body.rotation.z = THREE.MathUtils.lerp(this.body.rotation.z, -s.steer * 0.05 - s.drift * 0.1, Math.min(1, dt * 8));
    this.body.rotation.x = THREE.MathUtils.lerp(this.body.rotation.x, s.boost ? -0.05 : s.air ? -0.08 : 0, Math.min(1, dt * 6));
    this.body.position.y = Math.sin(s.t * 30) * 0.012 * Math.min(1, s.speed / 15);
    const P = this.parts;
    if (P.drum) P.drum.rotation.x += dt * (s.skillT > 0 ? 18 : 2.5);
    if (P.drum) P.drum.rotation.z = 0.3;
    if (P.cone) P.cone.rotation.y += dt * (s.skillT > 0 ? 12 : 1.2);
    if (P.ladder) P.ladder.rotation.x = s.skillT > 0 ? -0.35 : 0;
    if (P.bed) P.bed.rotation.x = THREE.MathUtils.lerp(P.bed.rotation.x, s.skillT > 0 ? -0.7 : 0, Math.min(1, dt * 6));
    if (P.boom) P.boom.rotation.y = s.skillT > 0 ? Math.sin(s.t * 14) * 1.2 : Math.sin(s.t * 1.5) * 0.08;
    if (P.sign) P.sign.scale.setScalar(1 + Math.sin(s.t * 6) * 0.05);
    if (P.stopArm) P.stopArm.rotation.y = THREE.MathUtils.lerp(P.stopArm.rotation.y, s.skillT > 0 ? -1.5 : 0, Math.min(1, dt * 8));
    if (P.compactor) P.compactor.rotation.x = s.skillT > 0 ? Math.sin(s.t * 10) * 0.3 : 0;
    const blink = Math.floor(s.t * 6) % 2 === 0;
    this.beaconMeshes.forEach((m, i) => (m.visible = s.beacons || this.bp.beacons.length === 0 ? (i % 2 === 0 ? blink : !blink) : true));
  }
}

export { outlineMaterial };
