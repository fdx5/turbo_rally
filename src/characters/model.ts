import * as THREE from 'three';
import { MeshBuilder, extrudeShape, heartShape, starShape, type V3 } from '../art/builder';
import { CHAR_BY_ID, type CharId, type CharacterDef, type Expression } from '../data/characters';
import { buildCosmeticParts, type CosmeticLoadout, type CosmeticParts, type FitCtx, type Sink } from './cosmeticBuild';
import { tierMaterial } from '../art/materials';
import { bakeMerge } from '../art/bake';
import { outlineMaterial } from '../art/toon';
import type { MatKind } from '../data/cosmetics';

export type SocketName = 'head_top' | 'eyes' | 'neck' | 'torso' | 'hips' | 'legs' | 'feet_L' | 'feet_R' | 'wrist_L' | 'wrist_R';
export type Pose = 'sit' | 'stand' | 'scooter' | 'showcase';

const EYE = '#3F3350';
const BLUSH = '#FF9EB8';
const starGeo = extrudeShape(starShape(1, 0.5), 0.3, 0.05);
const heartGeo = extrudeShape(heartShape(1), 0.3, 0.05);

interface Anatomy {
  def: CharacterDef;
  headY: number; // head centre relative to hips
  shoulderY: number;
  hipW: number;
  eyeY: number; // relative to head centre
  eyeX: number;
  eyeR: number;
  faceZ: (x: number, y: number) => number;
}

function anatomy(def: CharacterDef): Anatomy {
  const b = def.body;
  const headY = b.torsoH + b.torsoR * 0.6 + b.headR * 0.82;
  const eyeX = b.headR * 0.36;
  const eyeY = -b.headR * 0.02;
  const R = b.headR;
  return {
    def,
    headY,
    shoulderY: b.torsoH * 0.85 + b.torsoR * 0.25,
    hipW: b.torsoR * 0.55,
    eyeY,
    eyeX,
    eyeR: R * (def.id === 'piyo' ? 0.13 : 0.15),
    faceZ: (x, y) => Math.sqrt(Math.max(0, R * R - x * x - y * y)) * 0.97,
  };
}

/** Builds face sets for all expressions, each a separate small mesh group toggled by visibility. */
function buildFace(a: Anatomy, expr: Expression): MeshBuilder {
  const f = new MeshBuilder();
  const { eyeX, eyeY, eyeR } = a;
  const R = a.def.body.headR;
  const z = (x: number, y: number, lift = 0) => a.faceZ(x, y) + lift;
  const onFace = (x: number, y: number): [number, number, number] => [0, Math.atan2(x, z(x, y)) * 1, 0];
  const eyeOpen = (sx: number, scale = 1) => {
    const x = sx * eyeX;
    const rot = onFace(x, eyeY);
    f.sphere(eyeR * scale, EYE, { p: [x, eyeY, z(x, eyeY) - eyeR * 0.35], s: [1, 1.18, 0.55], r: rot, outline: false }, 16, 12);
    f.sphere(eyeR * 0.38 * scale, '#FFFFFF', { p: [x + eyeR * 0.3, eyeY + eyeR * 0.38, z(x, eyeY) + eyeR * 0.1], s: [1, 1, 0.5], outline: false, noAO: true }, 10, 8);
    f.sphere(eyeR * 0.18 * scale, '#FFFFFF', { p: [x - eyeR * 0.28, eyeY - eyeR * 0.35, z(x, eyeY) + eyeR * 0.05], s: [1, 1, 0.5], outline: false, noAO: true }, 8, 6);
  };
  const arcEye = (sx: number, up: boolean) => {
    const x = sx * eyeX;
    const g = new THREE.TorusGeometry(eyeR * 0.75, eyeR * 0.2, 6, 14, Math.PI);
    if (!up) g.rotateZ(Math.PI);
    f.add(g, EYE, { p: [x, eyeY - (up ? eyeR * 0.3 : -eyeR * 0.3), z(x, eyeY) - 0.01], r: onFace(x, eyeY), outline: false });
  };
  const lineEye = (sx: number, ang: number) => {
    const x = sx * eyeX;
    f.capsule(eyeR * 0.2, eyeR * 1.2, EYE, { p: [x, eyeY, z(x, eyeY)], r: [0, onFace(x, eyeY)[1], Math.PI / 2 + ang], outline: false });
  };
  const blush = () => {
    for (const sx of [-1, 1]) {
      const x = sx * eyeX * 1.45;
      const y = eyeY - R * 0.24;
      f.sphere(R * 0.11, BLUSH, { p: [x, y, z(x, y) - R * 0.04], s: [1.3, 0.75, 0.35], r: onFace(x, y), outline: false, noAO: true }, 12, 8);
    }
  };
  const my = -R * 0.3;
  const mz = z(0, my) + (a.def.id === 'piyo' ? R * 0.18 : 0.0);
  const smile = (open: boolean, big = 1) => {
    if (open) {
      f.sphere(R * 0.11 * big, '#E85D7A', { p: [0, my, mz - R * 0.03], s: [1.2, 0.85, 0.5], outline: false });
      f.sphere(R * 0.06 * big, '#FF9EB0', { p: [0, my - R * 0.035 * big, mz + R * 0.01], s: [1.3, 0.6, 0.4], outline: false });
    } else {
      const g = new THREE.TorusGeometry(R * 0.08, R * 0.022, 6, 12, Math.PI);
      g.rotateZ(Math.PI);
      f.add(g, EYE, { p: [0, my + R * 0.03, mz], outline: false });
    }
  };
  switch (expr) {
    case 'neutral':
      eyeOpen(-1);
      eyeOpen(1);
      smile(false);
      break;
    case 'happy':
      arcEye(-1, true);
      arcEye(1, true);
      smile(true);
      break;
    case 'angry':
      lineEye(-1, -0.45);
      lineEye(1, 0.45);
      f.torus(R * 0.06, R * 0.025, EYE, { p: [0, my, mz], outline: false });
      break;
    case 'surprised':
      eyeOpen(-1, 1.25);
      eyeOpen(1, 1.25);
      f.sphere(R * 0.075, '#E85D7A', { p: [0, my - R * 0.03, mz - R * 0.02], s: [1, 1.2, 0.5], outline: false });
      break;
    case 'win':
      for (const sx of [-1, 1]) {
        const x = sx * eyeX;
        f.add(starGeo, '#FFC93C', { p: [x, eyeY, z(x, eyeY)], s: eyeR * 1.05, r: onFace(x, eyeY), outline: false });
      }
      smile(true, 1.35);
      break;
    case 'lose':
      lineEye(-1, 0.15);
      lineEye(1, -0.15);
      for (const sx of [-1, 1]) f.sphere(eyeR * 0.3, '#8FD3FF', { p: [sx * eyeX, eyeY - eyeR * 1.2, z(sx * eyeX, eyeY) + 0.01], s: [0.8, 1.3, 0.5], outline: false });
      {
        const g = new THREE.TorusGeometry(R * 0.07, R * 0.022, 6, 12, Math.PI);
        f.add(g, EYE, { p: [0, my - R * 0.04, mz], outline: false });
      }
      break;
  }
  blush();
  return f;
}

/** Animal-specific head extras (ears, snout, beak, etc). */
function headExtras(b: MeshBuilder, a: Anatomy) {
  const d = a.def;
  const R = d.body.headR;
  const { main, sub, accent } = d.colors;
  const muzzle = (c: string, s = 1) => {
    const y = -R * 0.28;
    b.sphere(R * 0.28 * s, c, { p: [0, y, a.faceZ(0, y) - R * 0.12], s: [1.25, 0.85, 0.75] });
  };
  switch (d.id) {
    case 'momo': // bunny: long ears with pink inner, little bow
      for (const sx of [-1, 1]) {
        b.capsule(R * 0.2, R * 1.1, main, { p: [sx * R * 0.35, R * 1.25, -R * 0.1], r: [-0.15, 0, sx * -0.18], s: [1, 1, 0.65] });
        b.capsule(R * 0.11, R * 0.85, accent, { p: [sx * R * 0.35, R * 1.25, -R * 0.0], r: [-0.15, 0, sx * -0.18], s: [1, 1, 0.4], outline: false });
      }
      muzzle(sub, 0.8);
      b.sphere(R * 0.06, '#FF7FA8', { p: [0, -R * 0.16, a.faceZ(0, -R * 0.16) + 0.01], outline: false });
      break;
    case 'mungchi': // bear
      for (const sx of [-1, 1]) {
        b.sphere(R * 0.3, main, { p: [sx * R * 0.68, R * 0.68, -R * 0.1], s: [1, 1, 0.7] });
        b.sphere(R * 0.17, sub, { p: [sx * R * 0.68, R * 0.68, R * 0.05], s: [1, 1, 0.4], outline: false });
      }
      muzzle(sub, 1.15);
      b.sphere(R * 0.1, '#5E4040', { p: [0, -R * 0.17, a.faceZ(0, -R * 0.17) + R * 0.05], s: [1.3, 0.9, 0.8], outline: false });
      break;
    case 'piyo': // chick: tuft + beak + tiny wings handled by arms
      for (let k = -1; k <= 1; k++) b.capsule(R * 0.07, R * 0.3, main, { p: [k * R * 0.12, R * 1.02, 0], r: [0, 0, k * 0.5] });
      {
        const y = -R * 0.22;
        b.cone(R * 0.16, R * 0.3, '#FFA94D', { p: [0, y, a.faceZ(0, y) + R * 0.06], r: [Math.PI / 2, 0, 0], s: [1.3, 1, 0.8] }, 10);
      }
      break;
    case 'lulu': // cat
      for (const sx of [-1, 1]) {
        b.cone(R * 0.32, R * 0.55, main, { p: [sx * R * 0.55, R * 0.82, -R * 0.05], r: [0, 0, sx * -0.35], s: [1, 1, 0.6] }, 10);
        b.cone(R * 0.18, R * 0.35, accent, { p: [sx * R * 0.55, R * 0.8, R * 0.08], r: [0, 0, sx * -0.35], s: [1, 1, 0.3], outline: false }, 10);
      }
      b.sphere(R * 0.06, '#FF9EB8', { p: [0, -R * 0.14, a.faceZ(0, -R * 0.14) + 0.01], s: [1.3, 0.9, 0.7], outline: false });
      for (const sx of [-1, 1]) for (const k of [0, 1]) b.capsule(R * 0.012, R * 0.32, '#C9B9D9', { p: [sx * R * 0.48, -R * (0.16 + k * 0.08), a.faceZ(sx * R * 0.45, -R * 0.16) - 0.02], r: [0, 0, Math.PI / 2 + sx * (k ? -0.15 : 0.15)], outline: false });
      break;
    case 'toto': // shiba
      for (const sx of [-1, 1]) {
        b.cone(R * 0.34, R * 0.55, main, { p: [sx * R * 0.55, R * 0.8, -R * 0.08], r: [0, 0, sx * -0.3], s: [1, 1, 0.6] }, 10);
        b.cone(R * 0.2, R * 0.35, '#FFF6E9', { p: [sx * R * 0.55, R * 0.78, R * 0.05], r: [0, 0, sx * -0.3], s: [1, 1, 0.3], outline: false }, 10);
      }
      muzzle('#FFF6E9', 1.1);
      b.sphere(R * 0.09, '#4A3B52', { p: [0, -R * 0.15, a.faceZ(0, -R * 0.15) + R * 0.06], s: [1.3, 1, 0.8], outline: false });
      for (const sx of [-1, 1]) b.sphere(R * 0.07, '#FFF6E9', { p: [sx * R * 0.3, R * 0.28, a.faceZ(sx * R * 0.3, R * 0.28) - 0.01], s: [1.4, 0.8, 0.4], outline: false });
      break;
    case 'piko': {
      // penguin: white face mask, orange beak
      const y = -R * 0.05;
      b.sphere(R * 0.82, '#FFFFFF', { p: [0, y, R * 0.22], s: [1.05, 0.9, 0.85] });
      b.cone(R * 0.14, R * 0.28, '#FFB86B', { p: [0, -R * 0.22, a.faceZ(0, -R * 0.22) + R * 0.12], r: [Math.PI / 2, 0, 0], s: [1.4, 1, 0.7] }, 10);
      break;
    }
    case 'kkang': // dino: back spikes on head + nostrils
      for (let k = 0; k < 3; k++) b.cone(R * 0.14, R * 0.3, accent, { p: [0, R * (0.95 - k * 0.25), -R * (0.15 + k * 0.38)], r: [-0.4 - k * 0.4, 0, 0] }, 8);
      muzzle(main, 1.25);
      for (const sx of [-1, 1]) b.sphere(R * 0.03, '#4A3B52', { p: [sx * R * 0.1, -R * 0.2, a.faceZ(sx * R * 0.1, -R * 0.2) + R * 0.08], outline: false });
      break;
    case 'hana': // fox: big ears with dark tips, white cheeks
      for (const sx of [-1, 1]) {
        b.cone(R * 0.36, R * 0.75, main, { p: [sx * R * 0.55, R * 0.88, -R * 0.08], r: [0, 0, sx * -0.3], s: [1, 1, 0.55] }, 10);
        b.cone(R * 0.14, R * 0.25, '#7A4B3A', { p: [sx * R * 0.72, R * 1.2, -R * 0.08], r: [0, 0, sx * -0.3], s: [1, 1, 0.55], outline: false }, 10);
        b.sphere(R * 0.28, '#FFFFFF', { p: [sx * R * 0.38, -R * 0.3, a.faceZ(sx * R * 0.38, -R * 0.3) - R * 0.18], s: [1.1, 0.7, 0.6] });
      }
      b.sphere(R * 0.07, '#4A3B52', { p: [0, -R * 0.2, a.faceZ(0, -R * 0.2) + R * 0.02], outline: false });
      break;
  }
}

function tailOf(b: MeshBuilder, a: Anatomy) {
  const d = a.def;
  const tr = d.body.torsoR;
  const { main, sub, accent } = d.colors;
  switch (d.id) {
    case 'momo':
      b.sphere(tr * 0.4, '#FFFFFF', { p: [0, tr * 0.3, -tr * 0.95] });
      break;
    case 'mungchi':
      b.sphere(tr * 0.25, main, { p: [0, tr * 0.3, -tr * 0.95] });
      break;
    case 'lulu': {
      const curve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(0, tr * 0.2, -tr * 0.9),
        new THREE.Vector3(0.05, tr * 0.6, -tr * 1.4),
        new THREE.Vector3(0.1, tr * 1.6, -tr * 1.5),
        new THREE.Vector3(0.25, tr * 2.0, -tr * 1.2),
      ]);
      b.add(new THREE.TubeGeometry(curve, 16, tr * 0.12, 8), main);
      b.sphere(tr * 0.14, accent, { p: [0.25, tr * 2.0, -tr * 1.2] });
      break;
    }
    case 'toto': {
      b.torus(tr * 0.32, tr * 0.14, main, { p: [0, tr * 0.8, -tr * 1.0], r: [0, Math.PI / 2, 0] });
      break;
    }
    case 'kkang': {
      const curve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(0, tr * 0.3, -tr * 0.7),
        new THREE.Vector3(0, tr * 0.0, -tr * 1.6),
        new THREE.Vector3(0.2, -tr * 0.1, -tr * 2.4),
      ]);
      const g = new THREE.TubeGeometry(curve, 16, tr * 0.32, 10);
      // taper
      const pos = g.attributes.position as THREE.BufferAttribute;
      for (let i = 0; i < pos.count; i++) {
        const t = Math.floor(i / 11) / 16;
        const cp = curve.getPoint(t);
        const k = 1 - t * 0.75;
        pos.setXYZ(i, cp.x + (pos.getX(i) - cp.x) * k, cp.y + (pos.getY(i) - cp.y) * k, cp.z + (pos.getZ(i) - cp.z) * k);
      }
      g.computeVertexNormals();
      b.add(g, main);
      for (let k = 0; k < 4; k++) b.cone(tr * 0.12, tr * 0.28, accent, { p: [0.03 * k, tr * (0.55 - k * 0.12), -tr * (0.8 + k * 0.45)], r: [-0.6, 0, 0] }, 8);
      break;
    }
    case 'hana': {
      b.sphere(tr * 0.75, main, { p: [0, tr * 0.6, -tr * 1.5], s: [0.75, 0.75, 1.35], r: [0.6, 0, 0] });
      b.sphere(tr * 0.42, '#FFFFFF', { p: [0, tr * 1.25, -tr * 2.2], s: [0.85, 0.85, 1.1], r: [0.6, 0, 0] });
      break;
    }
    case 'piko':
      b.cone(tr * 0.25, tr * 0.3, main, { p: [0, -tr * 0.3, -tr * 0.95], r: [-2.2, 0, 0] }, 8);
      break;
    case 'piyo':
      b.cone(tr * 0.2, tr * 0.3, sub, { p: [0, tr * 0.3, -tr * 0.95], r: [-2.0, 0, 0] }, 8);
      break;
  }
}

export interface CharacterParts {
  root: THREE.Group;
  hips: THREE.Group;
  torso: THREE.Group;
  head: THREE.Group;
  armL: THREE.Group;
  armR: THREE.Group;
  legL: THREE.Group;
  legR: THREE.Group;
  tail: THREE.Group;
  faces: Record<Expression, THREE.Object3D>;
  sockets: Record<SocketName, THREE.Object3D>;
  special: THREE.Mesh[]; // cosmetic meshes with animated materials
  fx: CosmeticParts['fx'];
  height: number;
}

/** Fully articulated chibi character with sockets and cosmetics (§8.1). */
export class CharacterModel {
  def: CharacterDef;
  p: CharacterParts;
  expression: Expression = 'neutral';
  private exprTimer = 0;
  private poseT = -1;
  private poseKind: CharacterDef['pose'] | null = null;
  pose: Pose;
  t = 0;
  baked = false;
  outlines: THREE.Object3D[] = [];
  constructor(id: CharId, loadout: CosmeticLoadout, pose: Pose, outline = true, bake = false) {
    this.def = CHAR_BY_ID[id];
    this.pose = pose;
    this.p = buildParts(this.def, loadout, pose, outline);
    if (bake && pose !== 'showcase') {
      // race LOD: arms/legs frozen in driving pose, merged per material (few draw calls)
      if (pose === 'sit') {
        // popping out of a roof hatch: elbows resting on the hatch rim
        this.p.armL.rotation.set(-0.15, 0, 1.25);
        this.p.armR.rotation.set(-0.15, 0, -1.25);
      } else {
        this.p.armL.rotation.set(-1.05 + (pose === 'stand' ? 0.25 : 0), 0, 0.12);
        this.p.armR.rotation.set(-1.05 + (pose === 'stand' ? 0.25 : 0), 0, -0.12);
      }
      const faces = new Set(Object.values(this.p.faces));
      bakeMerge(this.p.hips, (o) => o === this.p.head);
      bakeMerge(this.p.head, (o) => faces.has(o));
      this.baked = true;
    }
    this.p.root.traverse((o) => {
      if (o.name === 'outline') this.outlines.push(o);
    });
    this.setExpression('neutral');
  }
  setOutlines(v: boolean) {
    for (const o of this.outlines) o.visible = v;
  }
  get root() {
    return this.p.root;
  }
  setExpression(e: Expression, hold = 0) {
    this.expression = e;
    this.exprTimer = hold;
    for (const k of Object.keys(this.p.faces) as Expression[]) this.p.faces[k].visible = k === e;
  }
  playPose() {
    this.poseT = 0;
    this.poseKind = this.def.pose;
  }
  /** steer -1..1, bounce 0..1, lean for drift */
  update(dt: number, s: { steer?: number; speed?: number; boost?: boolean; lean?: number; spin?: boolean; time?: number } = {}) {
    this.t += dt;
    const t = this.t;
    const p = this.p;
    if (this.exprTimer > 0) {
      this.exprTimer -= dt;
      if (this.exprTimer <= 0) this.setExpression('neutral');
    }
    // blink: briefly swap neutral face scale
    const blink = this.expression === 'neutral' && t % 3.7 < 0.12;
    p.faces.neutral.scale.y = blink ? 0.15 : 1;
    const steer = s.steer ?? 0;
    if (this.pose === 'showcase' || this.pose === 'stand') {
      p.hips.position.y = Math.sin(t * 2.2) * 0.02;
      p.head.rotation.z = Math.sin(t * 1.3) * 0.06;
      p.armL.rotation.z = 0.25 + Math.sin(t * 2.2) * 0.05;
      p.armR.rotation.z = -0.25 - Math.sin(t * 2.2) * 0.05;
      p.armL.rotation.x = p.armR.rotation.x = 0;
      p.tail.rotation.y = Math.sin(t * 3) * 0.25;
    }
    if (this.baked) {
      p.hips.rotation.z = -steer * 0.1 - (s.lean ?? 0) * 0.14;
      p.head.rotation.z = -steer * 0.08;
      p.head.rotation.y = -steer * 0.25;
      p.hips.position.y = Math.abs(Math.sin(t * 9)) * 0.02 * Math.min(1, (s.speed ?? 0) / 20);
    } else if (this.pose === 'sit' || this.pose === 'scooter' || this.pose === 'stand') {
      // hands on the wheel, lean into turns
      if (this.pose === 'sit') {
        // elbows on the roof-hatch rim
        p.armL.rotation.x = p.armR.rotation.x = -0.15;
        p.armL.rotation.z = 1.25 + steer * 0.15;
        p.armR.rotation.z = -1.25 + steer * 0.15;
      } else {
        p.armL.rotation.x = -1.05 + (this.pose === 'stand' ? 0.25 : 0);
        p.armR.rotation.x = -1.05 + (this.pose === 'stand' ? 0.25 : 0);
        p.armL.rotation.z = 0.12 + steer * 0.25;
        p.armR.rotation.z = -0.12 + steer * 0.25;
      }
      p.torso.rotation.z = -steer * 0.12 - (s.lean ?? 0) * 0.15;
      p.head.rotation.z = -steer * 0.1;
      p.head.rotation.y = -steer * 0.25;
      p.hips.position.y = Math.abs(Math.sin(t * 9)) * 0.02 * Math.min(1, (s.speed ?? 0) / 20);
      p.tail.rotation.y = Math.sin(t * 6) * 0.3;
    }
    if (this.poseT >= 0) {
      this.poseT += dt;
      const k = this.poseT;
      const e = Math.sin(Math.min(1, k / 1.4) * Math.PI);
      switch (this.poseKind) {
        case 'jump':
          p.hips.position.y = Math.abs(Math.sin(k * 7)) * 0.35 * e;
          p.armL.rotation.z = 2.4 * e;
          p.armR.rotation.z = -2.4 * e;
          break;
        case 'wave':
          p.armR.rotation.z = -2.5 * e;
          p.armR.rotation.x = Math.sin(k * 14) * 0.4 * e;
          break;
        case 'spin':
          p.hips.rotation.y = k * 9 * e;
          break;
        case 'flex':
          p.armL.rotation.z = 1.6 * e;
          p.armR.rotation.z = -1.6 * e;
          p.armL.rotation.x = p.armR.rotation.x = -0.6 * e;
          p.hips.position.y = Math.sin(k * 10) * 0.04 * e;
          break;
        case 'bow':
          p.torso.rotation.x = 0.5 * e;
          p.armL.rotation.z = 0.8 * e;
          p.tail.rotation.y = Math.sin(k * 12) * 0.8 * e;
          break;
        case 'wiggle':
          p.hips.rotation.z = Math.sin(k * 16) * 0.25 * e;
          p.armL.rotation.z = 1.2 + Math.sin(k * 20) * 0.5 * e;
          p.armR.rotation.z = -1.2 - Math.sin(k * 20) * 0.5 * e;
          break;
        case 'roar':
          p.head.rotation.x = -0.4 * e;
          p.armL.rotation.z = 1.2 * e;
          p.armR.rotation.z = -1.2 * e;
          p.hips.scale.setScalar(1 + 0.08 * e);
          break;
        case 'wink':
          p.head.rotation.z = 0.25 * e;
          p.armR.rotation.z = -1.9 * e;
          p.hips.rotation.y = Math.sin(k * 4) * 0.4 * e;
          break;
      }
      if (k > 1.4) {
        this.poseT = -1;
        p.hips.rotation.set(0, 0, 0);
        p.hips.scale.setScalar(1);
        p.torso.rotation.x = 0;
        p.head.rotation.x = 0;
      }
    }
  }
}

function buildParts(def: CharacterDef, loadout: CosmeticLoadout, pose: Pose, outline: boolean): CharacterParts {
  const a = anatomy(def);
  const B = def.body;
  const { main, sub } = def.colors;
  const root = new THREE.Group();
  root.name = 'character:' + def.id;
  const hips = new THREE.Group();
  root.add(hips);
  const torso = new THREE.Group();
  hips.add(torso);
  const head = new THREE.Group();
  head.position.y = a.headY;
  torso.add(head);
  const fit: FitCtx = { def, anatomy: { headY: a.headY, shoulderY: a.shoulderY, eyeX: a.eyeX, eyeY: a.eyeY, faceZ: a.faceZ } };
  const cos: CosmeticParts = buildCosmeticParts(loadout, fit);
  const special: THREE.Mesh[] = [];

  // ---- torso / belly
  const tb = new MeshBuilder();
  tb.capsule(B.torsoR, B.torsoH, main, { p: [0, B.torsoH / 2 + B.torsoR * 0.35, 0], s: [1, 1, 0.92] });
  const bellyY = B.torsoH / 2 + B.torsoR * 0.25;
  tb.sphere(B.torsoR * 0.8, sub, { p: [0, bellyY, B.torsoR * 0.32], s: [0.85, 1.0 + B.torsoH, 0.6], outline: false });
  if (def.id === 'piko') tb.sphere(B.torsoR * 0.92, '#FFFFFF', { p: [0, bellyY, B.torsoR * 0.25], s: [0.85, 1.15, 0.7], outline: false });
  tailOf(tb, a);
  const ts = sinkFor(tb);
  cos.torso.forEach((c) => c(ts));
  addBuilt(torso, tb, outline);
  flush(ts, torso, special, outline);

  // ---- head
  const hb = new MeshBuilder();
  hb.sphere(B.headR, main, { s: [1.04, 0.95, 0.96] }, 28, 22);
  headExtras(hb, a);
  const hs = sinkFor(hb);
  cos.head.forEach((c) => c(hs));
  addBuilt(head, hb, outline);
  flush(hs, head, special, outline);
  const faces = {} as Record<Expression, THREE.Object3D>;
  for (const e of ['neutral', 'happy', 'angry', 'surprised', 'win', 'lose'] as Expression[]) {
    const g = buildFace(a, e).build({ outline: false, ao: false, castShadow: false });
    g.visible = false;
    head.add(g);
    faces[e] = g;
  }

  // ---- arms (pivot at shoulder)
  const mkArm = (sx: number) => {
    const g = new THREE.Group();
    g.position.set(sx * (B.torsoR * 0.95), a.shoulderY, 0);
    const ab = new MeshBuilder();
    const wingy = def.id === 'piyo' || def.id === 'piko';
    if (wingy) {
      ab.sphere(B.armLen * 0.55, main, { p: [sx * 0.04, -B.armLen * 0.4, 0], s: [0.45, 1.1, 0.8], r: [0, 0, sx * 0.25] });
    } else {
      ab.capsule(0.085 + B.torsoR * 0.06, B.armLen, main, { p: [0, -B.armLen / 2 - 0.02, 0] });
      ab.sphere(0.12 + B.torsoR * 0.04, def.id === 'kkang' ? main : sub, { p: [0, -B.armLen - 0.08, 0] });
    }
    const as = sinkFor(ab);
    cos.arm.forEach((c) => c(as, sx));
    addBuilt(g, ab, outline);
    flush(as, g, special, outline);
    const wrist = new THREE.Object3D();
    wrist.position.set(0, -B.armLen - 0.02, 0);
    g.add(wrist);
    torso.add(g);
    return { g, wrist };
  };
  const armL = mkArm(1);
  const armR = mkArm(-1);

  // ---- legs (pivot at hip)
  const mkLeg = (sx: number) => {
    const g = new THREE.Group();
    g.position.set(sx * a.hipW, B.torsoR * 0.35, 0);
    const lb = new MeshBuilder();
    const legR = 0.1 + B.torsoR * 0.08;
    lb.capsule(legR, B.legLen, main, { p: [0, -B.legLen / 2, 0] });
    const footC = def.id === 'piyo' || def.id === 'piko' ? '#FFB067' : sub;
    lb.sphere(legR * 1.25, footC, { p: [0, -B.legLen - legR * 0.3, legR * 0.5], s: [1, 0.7, 1.4] });
    const ls = sinkFor(lb);
    cos.leg.forEach((c) => c(ls, sx));
    addBuilt(g, lb, outline);
    flush(ls, g, special, outline);
    const foot = new THREE.Object3D();
    foot.position.set(0, -B.legLen - legR * 0.3, legR * 0.5);
    g.add(foot);
    hips.add(g);
    return { g, foot };
  };
  const legL = mkLeg(1);
  const legR = mkLeg(-1);
  if (pose === 'sit') {
    legL.g.rotation.x = legR.g.rotation.x = -1.35;
  } else if (pose === 'scooter') {
    legL.g.rotation.x = legR.g.rotation.x = -0.9;
    legL.g.rotation.z = 0.25;
    legR.g.rotation.z = -0.25;
  }
  const tail = new THREE.Group();
  hips.add(tail);


  const sockets = {} as Record<SocketName, THREE.Object3D>;
  const mk = (name: SocketName, parent: THREE.Object3D, p: V3) => {
    const o = new THREE.Object3D();
    o.name = name;
    o.position.set(...p);
    parent.add(o);
    sockets[name] = o;
  };
  mk('head_top', head, [0, B.headR * 0.92, 0]);
  mk('eyes', head, [0, a.eyeY, a.faceZ(0, a.eyeY)]);
  mk('neck', torso, [0, B.torsoH + B.torsoR * 0.55, 0]);
  mk('torso', torso, [0, B.torsoH / 2 + B.torsoR * 0.35, 0]);
  mk('hips', hips, [0, B.torsoR * 0.3, 0]);
  mk('legs', hips, [0, 0, 0]);
  sockets.feet_L = legL.foot;
  sockets.feet_R = legR.foot;
  sockets.wrist_L = armL.wrist;
  sockets.wrist_R = armR.wrist;
  return {
    root,
    hips,
    torso,
    head,
    armL: armL.g,
    armR: armR.g,
    legL: legL.g,
    legR: legR.g,
    tail,
    faces,
    sockets,
    special,
    fx: cos.fx,
    height: a.headY + B.headR * 1.4,
  };
}

function sinkFor(b: MeshBuilder): Sink & { extra: Map<MatKind, MeshBuilder> } {
  const extra = new Map<MatKind, MeshBuilder>();
  return {
    toon: b,
    extra,
    mat: (k: MatKind) => {
      if (k === 'toon') return b;
      let m = extra.get(k);
      if (!m) extra.set(k, (m = new MeshBuilder()));
      return m;
    },
  };
}
function flush(s: ReturnType<typeof sinkFor>, parent: THREE.Object3D, special: THREE.Mesh[], outline: boolean) {
  for (const [k, b] of s.extra) {
    const geo = b.mergedSolid(false);
    if (!geo) continue;
    const m = new THREE.Mesh(geo, tierMaterial(k));
    m.castShadow = true;
    m.userData.matKind = k;
    parent.add(m);
    special.push(m);
    if (outline && k !== 'gem') {
      const hull = b.mergedHull();
      if (hull) parent.add(new THREE.Mesh(hull, outlineMaterial(undefined, 0.8)));
    }
  }
}

function addBuilt(parent: THREE.Object3D, b: MeshBuilder, outline: boolean) {
  const g = b.build({ outline, outlineWidth: 0.9, castShadow: true });
  parent.add(g);
}

void heartGeo;
