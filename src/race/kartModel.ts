import * as THREE from 'three';
import { VehicleModel } from '../vehicles/vehicleModel';
import { CharacterModel } from '../characters/model';
import type { CharId, Expression } from '../data/characters';
import type { CosmeticLoadout } from '../characters/cosmeticBuild';
import { bubbleMesh, starGeo } from '../items/models';
import type { KartBody } from '../physics/kart';
import { MT_LEVELS } from '../physics/kart';
import type { FX } from '../art/particles';
import { PShape } from '../art/textures';
import { groundPose } from './groundPose';

const RAINBOW = ['#FFADAD', '#FFD6A5', '#FDFFB6', '#B9FBC0', '#A2D2FF', '#CDB4DB'];

/** Ribbon trail (boost / mythic cosmetics). */
class Trail {
  mesh: THREE.Mesh;
  private pts: THREE.Vector3[] = [];
  private n = 28;
  private pos: Float32Array;
  private alpha: Float32Array;
  private width: number;
  constructor(colorA: string, colorB: string, width = 0.9) {
    this.width = width;
    this.pos = new Float32Array(this.n * 2 * 3);
    this.alpha = new Float32Array(this.n * 2);
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('aAlpha', new THREE.BufferAttribute(this.alpha, 1).setUsage(THREE.DynamicDrawUsage));
    const uv = new Float32Array(this.n * 2 * 2);
    for (let i = 0; i < this.n; i++) {
      uv.set([i / (this.n - 1), 0, i / (this.n - 1), 1], i * 4);
    }
    g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    const idx: number[] = [];
    for (let i = 0; i < this.n - 1; i++) {
      const a = i * 2;
      idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
    }
    g.setIndex(idx);
    const mat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
      uniforms: {
        uA: { value: new THREE.Color(colorA) },
        uB: { value: new THREE.Color(colorB) },
        uTime: { value: 0 },
      },
      vertexShader: `attribute float aAlpha; varying float vA; varying vec2 vUv; void main(){ vA = aAlpha; vUv = uv; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0);} `,
      fragmentShader: `uniform vec3 uA; uniform vec3 uB; uniform float uTime; varying float vA; varying vec2 vUv;
        void main(){ vec3 rb = 0.55 + 0.45*cos(6.2831*(vec3(0.0,0.33,0.67) + vUv.x*1.5 - uTime*1.5));
          vec3 c = mix(mix(uA,uB,vUv.y), rb, 0.5); float edge = 1.0 - abs(vUv.y-0.5)*2.0;
          gl_FragColor = vec4(c*1.3, vA * smoothstep(0.0,0.6,edge) * 0.8); }`,
    });
    this.mesh = new THREE.Mesh(g, mat);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 15;
  }
  update(p: THREE.Vector3, right: THREE.Vector3, on: boolean, t: number) {
    if (on || this.pts.length) {
      this.pts.unshift(p.clone());
      if (this.pts.length > this.n || (!on && this.pts.length)) this.pts.pop();
      if (!on && this.pts.length) this.pts.pop();
    }
    const m = this.pts.length;
    for (let i = 0; i < this.n; i++) {
      const q = this.pts[Math.min(i, m - 1)] ?? p;
      const w = this.width * (1 - i / this.n);
      this.pos.set(
        [q.x - right.x * w, q.y, q.z - right.z * w, q.x + right.x * w, q.y, q.z + right.z * w],
        i * 6,
      );
      const a = i < m ? 1 - i / this.n : 0;
      this.alpha[i * 2] = this.alpha[i * 2 + 1] = a;
    }
    this.mesh.geometry.attributes.position.needsUpdate = true;
    this.mesh.geometry.attributes.aAlpha.needsUpdate = true;
    (this.mesh.material as THREE.ShaderMaterial).uniforms.uTime.value = t;
    this.mesh.visible = m > 1;
  }
}

const _v = new THREE.Vector3();
const _r = new THREE.Vector3();
const _w = new THREE.Vector3();
const _basis = new THREE.Matrix4();
const _forward = new THREE.Vector3();
const _up = new THREE.Vector3();
const _left = new THREE.Vector3();

/** Visual kart: vehicle + seated character + status effect attachments. */
export class KartModel {
  root = new THREE.Group();
  inner = new THREE.Group();
  vehicle: VehicleModel;
  character: CharacterModel;
  shield: THREE.Mesh;
  bubble: THREE.Mesh;
  ice: THREE.Mesh;
  stars: THREE.Group;
  trail: Trail;
  cosTrail: Trail | null = null;
  cloud: THREE.Group;
  aura: string | null = null;
  scaleTarget = 1;
  private sc = 1;
  private expr: Expression = 'neutral';
  private sparkT = 0;
  constructor(
    vehicleId: string,
    charId: CharId,
    loadout: CosmeticLoadout,
    opts: { outline?: boolean; decalScale?: number; pooledWheels?: boolean },
  ) {
    this.vehicle = new VehicleModel(vehicleId, opts);
    this.character = new CharacterModel(charId, loadout, this.vehicle.bp.pose, opts.outline !== false, true);
    this.vehicle.seat.add(this.character.root);
    this.inner.add(this.vehicle.root);
    this.root.add(this.inner);
    this.shield = bubbleMesh(2.1, '#CDEBFF');
    this.shield.visible = false;
    this.root.add(this.shield);
    this.shield.position.y = 1.1;
    this.bubble = bubbleMesh(2.4, '#E9D8FF');
    this.bubble.visible = false;
    this.bubble.position.y = 1.2;
    this.root.add(this.bubble);
    this.ice = new THREE.Mesh(
      new THREE.BoxGeometry(2.6, 2.4, 3.6),
      new THREE.MeshToonMaterial({ color: '#CDEBFF', transparent: true, opacity: 0.55, depthWrite: false }),
    );
    this.ice.position.y = 1.1;
    this.ice.visible = false;
    this.root.add(this.ice);
    this.stars = new THREE.Group();
    for (let i = 0; i < 4; i++) {
      const s = new THREE.Mesh(
        starGeo,
        new THREE.MeshBasicMaterial({
          color: new THREE.Color('#FFE066').multiplyScalar(1.8),
          toneMapped: false,
        }),
      );
      s.scale.setScalar(0.22);
      this.stars.add(s);
    }
    this.stars.visible = false;
    this.root.add(this.stars);
    this.trail = new Trail('#FFC8DD', '#A2D2FF', 0.75);
    // cloud fairy "뭉게" (respawn)
    this.cloud = new THREE.Group();
    const cm = new THREE.MeshToonMaterial({ color: '#FFFFFF' });
    for (let i = 0; i < 5; i++) {
      const s = new THREE.Mesh(new THREE.SphereGeometry(0.6 + (i % 2) * 0.2, 14, 10), cm);
      s.position.set((i - 2) * 0.55, Math.sin(i) * 0.2, 0);
      this.cloud.add(s);
    }
    const eyeM = new THREE.MeshBasicMaterial({ color: '#4A3B52' });
    for (const sx of [-0.25, 0.25]) {
      const e = new THREE.Mesh(new THREE.SphereGeometry(0.09, 8, 6), eyeM);
      e.position.set(sx, 0.15, 0.62);
      this.cloud.add(e);
    }
    this.cloud.visible = false;
    this.root.add(this.cloud);
    for (const f of this.character.p.fx) {
      if (f.kind === 'trail') this.cosTrail = new Trail('#FFE066', f.color, 0.45);
      if (f.kind === 'aura' || f.kind === 'sparkle' || f.kind === 'flame' || f.kind === 'float')
        this.aura = f.kind;
    }
  }
  setExpression(e: Expression, hold = 1.2) {
    if (this.expr === e && e === 'neutral') return;
    this.expr = e;
    this.character.setExpression(e, hold);
    if (hold > 0) setTimeout(() => (this.expr = 'neutral'), hold * 1000);
  }
  setLOD(dist: number, farOutline: number) {
    const near = dist < farOutline;
    this.vehicle.setOutlines(near);
    this.character.setOutlines(near);
  }

  update(
    dt: number,
    b: KartBody,
    alpha: number,
    t: number,
    fx: FX | null,
    input: { steer: number; throttle: number },
  ) {
    const x = b.px + (b.x - b.px) * alpha;
    const y = b.py + (b.y - b.py) * alpha;
    const z = b.pz + (b.z - b.pz) * alpha;
    let dy = b.yaw - b.pyaw;
    if (dy > Math.PI) dy -= Math.PI * 2;
    if (dy < -Math.PI) dy += Math.PI * 2;
    const yaw = b.pyaw + dy * alpha;
    this.root.position.set(x, y + 0.06, z);
    this.root.rotation.set(0, yaw, 0);
    // pitch / roll from the ground ribbon
    const pr = b.proj;
    const pose = groundPose(pr, yaw);
    const targetPitch = b.grounded ? pose.pitch : -b.vy * 0.012;
    const targetRoll = b.grounded ? pose.roll : 0;
    // Fit the wheels immediately on contact; smoothing here buries them in changing slopes.
    const blend = b.grounded ? 1 : 1 - Math.exp(-dt * 10);
    this.inner.rotation.x += (targetPitch - this.inner.rotation.x) * blend;
    this.inner.rotation.z += (targetRoll - this.inner.rotation.z) * blend;
    this.inner.rotation.y = 0;
    // Drift/spin around the fitted road normal, preserving contact on banked corners.
    const trick = b.prevTrickAngle + (b.trickAngle - b.prevTrickAngle) * alpha;
    this.vehicle.root.rotation.y = b.driftVisual + b.spinAngle + trick;
    if (b.loopActive) {
      const f = b.loopFrame;
      _forward.set(f.fx, f.fy, f.fz);
      _up.set(f.ux, f.uy, f.uz);
      _left.crossVectors(_up, _forward).normalize();
      _basis.makeBasis(_left, _up, _forward);
      this.root.quaternion.setFromRotationMatrix(_basis);
      this.root.position.set(x + f.ux * 0.06, y + f.uy * 0.06, z + f.uz * 0.06);
      this.inner.rotation.set(0, 0, 0);
      this.vehicle.root.rotation.y = 0;
    }
    // scale: shrink / squash / star scale
    this.scaleTarget = (b.shrinkT > 0 ? 0.6 : 1) * (b.starScale > 1 && b.starT > 0 ? b.starScale : 1);
    this.sc += (this.scaleTarget - this.sc) * Math.min(1, dt * 8);
    this.inner.scale.set(this.sc, this.sc * (b.squashT > 0 ? 0.35 : 1), this.sc);
    // invulnerability blink / ghost
    const blink = (b.invulT > 0 && b.starT <= 0) || b.ghostT > 0;
    this.inner.visible = !blink || Math.floor(t * 16) % 2 === 0;
    this.vehicle.update(dt, {
      speed: b.speed,
      steer: input.steer,
      drift: b.driftVisual * 2.3,
      air: !b.grounded,
      landT: b.landT,
      boost: b.boostT > 0,
      t,
      spinAngle: b.spinAngle,
      skillT: 0,
      beacons: true,
    });
    this.character.update(dt, { steer: input.steer, speed: b.speed, lean: b.driftVisual * 2, time: t });
    // attachments
    this.shield.visible = false;
    this.bubble.visible = b.floatT > 0;
    this.ice.visible = b.freezeT > 0;
    this.stars.visible = b.spinT > 0 || b.stopT > 0;
    if (this.stars.visible) {
      this.stars.children.forEach((s, i) => {
        const a = t * 6 + (i * Math.PI) / 2;
        s.position.set(Math.cos(a) * 0.9, 2.6 + Math.sin(t * 8 + i) * 0.1, Math.sin(a) * 0.9);
        s.rotation.y = a;
      });
    }
    for (const m of [this.shield, this.bubble]) (m.material as THREE.ShaderMaterial).uniforms.uTime.value = t;
    this.cloud.visible = b.respawnT > 0;
    if (this.cloud.visible) {
      this.cloud.position.set(0, 3.2 + Math.sin(t * 4) * 0.2, 0);
      this.cloud.rotation.y = Math.sin(t * 2) * 0.2;
    }
    // world-space helpers
    _r.set(-Math.cos(yaw), 0, Math.sin(yaw));
    _v.set(x - Math.sin(yaw) * 1.6, y + 0.45, z - Math.cos(yaw) * 1.6);
    this.trail.update(_v, _r, b.boostT > 0 || b.starT > 0, t);
    if (this.cosTrail) {
      _w.set(x - Math.sin(yaw) * 1.4, y + 1.6, z - Math.cos(yaw) * 1.4);
      this.cosTrail.update(_w, _r, Math.abs(b.speed) > 5, t);
    }
    if (!fx) return;
    // particles: drift sparks, boost flames, star sparkles, dust
    this.sparkT -= dt;
    if (this.sparkT > 0) return;
    this.sparkT = 1 / 50;
    const fxv = { x: 0, y: 0, z: 0 };
    if (b.drifting && b.grounded) {
      const lv = b.mtLevel;
      const col = lv === 0 ? '#FFFFFF' : MT_LEVELS[lv - 1].color;
      for (const side of [-1, 1]) {
        const wx = x - Math.sin(yaw) * 1.1 + _r.x * side * 0.95;
        const wz = z - Math.cos(yaw) * 1.1 + _r.z * side * 0.95;
        fxv.x = -Math.sin(yaw) * 2 + (Math.random() - 0.5) * 4 + _r.x * side * 2;
        fxv.y = 2 + Math.random() * 3;
        fxv.z = -Math.cos(yaw) * 2 + (Math.random() - 0.5) * 4 + _r.z * side * 2;
        fx.glow.spawn({
          pos: { x: wx, y: y + 0.15, z: wz },
          vel: fxv,
          color: col,
          life: 0.35,
          size: lv === 3 ? 0.42 : 0.28,
          sizeEnd: 0.05,
          shape: lv === 3 && Math.random() < 0.4 ? PShape.Star : PShape.Sparkle,
          gravity: 12,
          drag: 2,
          spin: 8,
          intensity: 2.2,
        });
      }
    }
    if (b.boostT > 0 || b.starT > 0) {
      const ex = x - Math.sin(yaw) * 1.7;
      const ez = z - Math.cos(yaw) * 1.7;
      fxv.x = -Math.sin(yaw) * 6 + (Math.random() - 0.5) * 2;
      fxv.y = 0.5 + Math.random();
      fxv.z = -Math.cos(yaw) * 6 + (Math.random() - 0.5) * 2;
      fx.glow.spawn({
        pos: { x: ex, y: y + 0.55, z: ez },
        vel: fxv,
        color:
          b.starT > 0 ? RAINBOW[Math.floor(Math.random() * 6)] : Math.random() < 0.5 ? '#FFB86B' : '#FFE9A8',
        life: 0.3,
        size: 0.6,
        sizeEnd: 0.1,
        shape: PShape.Dot,
        drag: 3,
        intensity: 2.4,
      });
    }
    if (b.starT > 0 && Math.random() < 0.6) {
      fx.glow.spawn({
        pos: {
          x: x + (Math.random() - 0.5) * 2.5,
          y: y + Math.random() * 2.5,
          z: z + (Math.random() - 0.5) * 2.5,
        },
        vel: { x: 0, y: 1.5, z: 0 },
        color: RAINBOW[Math.floor(Math.random() * 6)],
        life: 0.6,
        size: 0.5,
        sizeEnd: 0,
        shape: PShape.Star,
        spin: 4,
        intensity: 2,
      });
    }
    if (b.offroad && b.grounded && Math.abs(b.speed) > 8 && Math.random() < 0.5) {
      fx.normal.spawn({
        pos: { x: x - Math.sin(yaw) * 1.4, y: y + 0.2, z: z - Math.cos(yaw) * 1.4 },
        vel: { x: (Math.random() - 0.5) * 2, y: 1.5, z: (Math.random() - 0.5) * 2 },
        color: '#F4E3C3',
        life: 0.6,
        size: 0.6,
        sizeEnd: 1.4,
        shape: PShape.Puff,
        drag: 2,
      });
    }
    if (b.sleepT > 0 && Math.random() < 0.1)
      fx.normal.spawn({
        pos: { x, y: y + 2.6, z },
        vel: { x: 0.4, y: 1.2, z: 0 },
        color: '#A2D2FF',
        life: 1.2,
        size: 0.5,
        sizeEnd: 0.8,
        shape: PShape.Zzz,
      });
    if (b.wobbleT > 0 && Math.random() < 0.3)
      fx.glow.spawn({
        pos: { x, y: y + 2.3, z },
        vel: { x: (Math.random() - 0.5) * 2, y: 2, z: (Math.random() - 0.5) * 2 },
        color: '#FF6B6B',
        life: 0.5,
        size: 0.35,
        sizeEnd: 0,
        shape: PShape.Drop,
        intensity: 1.6,
      });
    if (this.aura && Math.random() < 0.35) {
      const col =
        this.aura === 'flame'
          ? '#FFB067'
          : this.aura === 'aura'
            ? RAINBOW[Math.floor(Math.random() * 6)]
            : '#FFF3B8';
      fx.glow.spawn({
        pos: {
          x: x + (Math.random() - 0.5) * 1.5,
          y: y + 1 + Math.random() * 1.5,
          z: z + (Math.random() - 0.5) * 1.5,
        },
        vel: { x: 0, y: 0.8, z: 0 },
        color: col,
        life: 0.8,
        size: 0.25,
        sizeEnd: 0,
        shape: PShape.Sparkle,
        spin: 3,
        intensity: 2,
      });
    }
  }
  /** shield bubble visual toggle (driven by racer shield state) */
  showShield(v: boolean) {
    this.shield.visible = v;
  }
  addToScene(scene: THREE.Object3D) {
    scene.add(this.root, this.trail.mesh);
    if (this.cosTrail) scene.add(this.cosTrail.mesh);
  }
}
