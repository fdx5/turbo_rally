import * as THREE from 'three';
import { particleAtlas, PShape } from './textures';

let atlas: THREE.Texture | null = null;

const VERT = /* glsl */ `
attribute vec3 aPos;
attribute vec3 aVel;
attribute vec3 aCol;
attribute vec4 aMisc;   // start, life, size, shape
attribute vec4 aExtra;  // gravity, drag, spin, sizeEnd
uniform float uTime;
varying vec2 vUv;
varying vec3 vCol;
varying float vAlpha;
#include <fog_pars_vertex>
void main() {
  float age = uTime - aMisc.x;
  float t = age / aMisc.y;
  if (t < 0.0 || t > 1.0) { gl_Position = vec4(2.0, 2.0, 2.0, 1.0); return; }
  float k = max(aExtra.y, 0.0001);
  vec3 p = aPos + aVel * (1.0 - exp(-k * age)) / k + vec3(0.0, -0.5 * aExtra.x * age * age, 0.0);
  float pop = smoothstep(0.0, 0.08, t);
  float size = mix(aMisc.z, aExtra.w, t) * pop;
  float a = aExtra.z * age;
  vec2 q = position.xy;
  q = vec2(q.x * cos(a) - q.y * sin(a), q.x * sin(a) + q.y * cos(a)) * size;
  vec4 mvPosition = modelViewMatrix * vec4(p, 1.0);
  mvPosition.xy += q;
  gl_Position = projectionMatrix * mvPosition;
  float cell = aMisc.w;
  vUv = (uv + vec2(mod(cell, 4.0), 3.0 - floor(cell / 4.0))) / 4.0;
  vCol = aCol;
  vAlpha = 1.0 - smoothstep(0.65, 1.0, t);
  #include <fog_vertex>
}`;
const FRAG = /* glsl */ `
uniform sampler2D uMap;
varying vec2 vUv;
varying vec3 vCol;
varying float vAlpha;
#include <fog_pars_fragment>
void main() {
  vec4 tx = texture2D(uMap, vUv);
  float al = tx.a * vAlpha;
  if (al < 0.01) discard;
  gl_FragColor = vec4(vCol * tx.rgb, al);
  #include <fog_fragment>
}`;

export interface SpawnOpts {
  pos: THREE.Vector3 | { x: number; y: number; z: number };
  vel?: { x: number; y: number; z: number };
  color: THREE.Color | string;
  life?: number;
  size?: number;
  sizeEnd?: number;
  shape?: PShape;
  gravity?: number;
  drag?: number;
  spin?: number;
  intensity?: number;
}

/** GPU-animated particle pool: each particle is written once at spawn, then simulated in the vertex shader. */
export class Particles {
  mesh: THREE.Mesh;
  private cap: number;
  private head = 0;
  private aPos: THREE.InstancedBufferAttribute;
  private aVel: THREE.InstancedBufferAttribute;
  private aCol: THREE.InstancedBufferAttribute;
  private aMisc: THREE.InstancedBufferAttribute;
  private aExtra: THREE.InstancedBufferAttribute;
  private dirtyMin = Infinity;
  private dirtyMax = -1;
  private uniforms: { uTime: { value: number }; uMap: { value: THREE.Texture } };
  time = 0;
  budget = 1;
  private col = new THREE.Color();

  constructor(cap: number, additive: boolean) {
    this.cap = cap;
    if (!atlas) atlas = particleAtlas();
    const quad = new THREE.PlaneGeometry(1, 1);
    const geo = new THREE.InstancedBufferGeometry();
    geo.index = quad.index;
    geo.setAttribute('position', quad.attributes.position);
    geo.setAttribute('uv', quad.attributes.uv);
    const mk = (n: number) => {
      const a = new THREE.InstancedBufferAttribute(new Float32Array(cap * n), n);
      a.setUsage(THREE.DynamicDrawUsage);
      return a;
    };
    this.aPos = mk(3);
    this.aVel = mk(3);
    this.aCol = mk(3);
    this.aMisc = mk(4);
    this.aExtra = mk(4);
    for (let i = 0; i < cap; i++) this.aMisc.setX(i, -1e9);
    geo.setAttribute('aPos', this.aPos);
    geo.setAttribute('aVel', this.aVel);
    geo.setAttribute('aCol', this.aCol);
    geo.setAttribute('aMisc', this.aMisc);
    geo.setAttribute('aExtra', this.aExtra);
    geo.instanceCount = cap;
    this.uniforms = { uTime: { value: 0 }, uMap: { value: atlas } };
    const mat = new THREE.ShaderMaterial({
      vertexShader: VERT,
      fragmentShader: FRAG,
      uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, {}]),
      transparent: true,
      depthWrite: false,
      blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
      fog: true,
      toneMapped: false,
    });
    mat.uniforms.uTime = this.uniforms.uTime;
    mat.uniforms.uMap = this.uniforms.uMap;
    this.mesh = new THREE.Mesh(geo, mat);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = additive ? 20 : 10;
  }

  spawn(o: SpawnOpts) {
    if (this.budget < 1 && Math.random() > this.budget) return;
    const i = this.head;
    this.head = (this.head + 1) % this.cap;
    this.aPos.setXYZ(i, o.pos.x, o.pos.y, o.pos.z);
    const v = o.vel;
    this.aVel.setXYZ(i, v ? v.x : 0, v ? v.y : 0, v ? v.z : 0);
    this.col.set(o.color as THREE.ColorRepresentation);
    const k = o.intensity ?? 1;
    this.aCol.setXYZ(i, this.col.r * k, this.col.g * k, this.col.b * k);
    const size = o.size ?? 0.5;
    this.aMisc.setXYZW(i, this.time, o.life ?? 0.8, size, o.shape ?? PShape.Dot);
    this.aExtra.setXYZW(i, o.gravity ?? 0, o.drag ?? 0.0001, o.spin ?? 0, o.sizeEnd ?? size);
    if (i < this.dirtyMin) this.dirtyMin = i;
    if (i > this.dirtyMax) this.dirtyMax = i;
  }

  update(time: number) {
    this.time = time;
    this.uniforms.uTime.value = time;
    if (this.dirtyMax >= 0) {
      const off = this.dirtyMin;
      const cnt = this.dirtyMax - this.dirtyMin + 1;
      for (const a of [this.aPos, this.aVel, this.aCol, this.aMisc, this.aExtra]) {
        a.clearUpdateRanges();
        a.addUpdateRange(off * a.itemSize, cnt * a.itemSize);
        a.needsUpdate = true;
      }
      this.dirtyMin = Infinity;
      this.dirtyMax = -1;
    }
  }
}

/** Helper bundle: one normal + one additive pool. */
export class FX {
  normal = new Particles(2600, false);
  glow = new Particles(2600, true);
  group = new THREE.Group();
  constructor() {
    this.group.add(this.normal.mesh, this.glow.mesh);
  }
  update(t: number) {
    this.normal.update(t);
    this.glow.update(t);
  }
  setBudget(b: number) {
    this.normal.budget = b;
    this.glow.budget = b;
  }
  burst(pos: THREE.Vector3, n: number, opts: Partial<SpawnOpts> & { colors: string[]; speed?: number; up?: number; additive?: boolean }) {
    const sys = opts.additive ? this.glow : this.normal;
    const sp = opts.speed ?? 6;
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const e = Math.random() * 2 - 1;
      const r = Math.sqrt(1 - e * e);
      const s = sp * (0.5 + Math.random() * 0.5);
      sys.spawn({
        pos,
        vel: { x: Math.cos(a) * r * s, y: Math.abs(e) * s * 0.6 + (opts.up ?? 3), z: Math.sin(a) * r * s },
        color: opts.colors[i % opts.colors.length],
        life: (opts.life ?? 0.9) * (0.7 + Math.random() * 0.6),
        size: opts.size ?? 0.5,
        sizeEnd: opts.sizeEnd ?? 0.1,
        shape: opts.shape ?? PShape.Dot,
        gravity: opts.gravity ?? 9,
        drag: opts.drag ?? 1.2,
        spin: (Math.random() - 0.5) * (opts.spin ?? 6),
        intensity: opts.intensity,
      });
    }
  }
}
