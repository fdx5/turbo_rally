import * as THREE from 'three';
import { cloudTexture } from './textures';
import { Rng } from '../core/rng';
import type { ThemeDef } from '../tracks/themes';

/** Gradient sky dome with sun glow, optional stars & aurora ribbons. */
export function buildSky(theme: ThemeDef): THREE.Mesh {
  const s = theme.sky;
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
    toneMapped: false,
    uniforms: {
      uTop: { value: new THREE.Color(s.top) },
      uHorizon: { value: new THREE.Color(s.horizon) },
      uBottom: { value: new THREE.Color(s.bottom) },
      uSun: { value: new THREE.Color(s.sun) },
      uSunDir: { value: new THREE.Vector3(...s.sunDir).normalize() },
      uStars: { value: s.stars ? 1 : 0 },
      uAurora: { value: s.aurora ? 1 : 0 },
      uTime: { value: 0 },
    },
    vertexShader: /* glsl */ `
      varying vec3 vDir;
      void main() {
        vDir = normalize(position);
        vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        gl_Position = p.xyww;
      }`,
    fragmentShader: /* glsl */ `
      uniform vec3 uTop, uHorizon, uBottom, uSun, uSunDir;
      uniform float uStars, uAurora, uTime;
      varying vec3 vDir;
      float hash(vec3 p) { return fract(sin(dot(p, vec3(12.9898, 78.233, 37.719))) * 43758.5453); }
      void main() {
        vec3 d = normalize(vDir);
        float h = d.y;
        vec3 col = h > 0.0 ? mix(uHorizon, uTop, pow(smoothstep(0.0, 0.75, h), 0.8)) : mix(uHorizon, uBottom, smoothstep(0.0, -0.25, h));
        float sd = max(dot(d, uSunDir), 0.0);
        col += uSun * (pow(sd, 400.0) * 1.6 + pow(sd, 18.0) * 0.28);
        if (uStars > 0.5 && h > 0.05) {
          vec3 cell = floor(d * 140.0);
          float r = hash(cell);
          float tw = 0.6 + 0.4 * sin(uTime * 2.0 + r * 40.0);
          col += step(0.985, r) * tw * smoothstep(0.05, 0.4, h) * vec3(1.0, 0.95, 1.0);
        }
        if (uAurora > 0.5 && h > 0.1) {
          float band = sin(d.x * 6.0 + uTime * 0.25 + sin(d.z * 4.0 + uTime * 0.15) * 1.5);
          float a = smoothstep(0.55, 1.0, band) * smoothstep(0.12, 0.35, h) * smoothstep(0.85, 0.45, h);
          vec3 ac = mix(vec3(0.6, 1.0, 0.85), vec3(0.85, 0.7, 1.0), 0.5 + 0.5 * sin(d.x * 3.0 + uTime * 0.2));
          col = mix(col, ac, a * 0.55);
        }
        gl_FragColor = vec4(col, 1.0);
      }`,
  });
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(1500, 32, 16), mat);
  mesh.renderOrder = -10;
  mesh.frustumCulled = false;
  return mesh;
}

/** Puffy billboard clouds drifting slowly around the track. */
export function buildClouds(count: number, centre: THREE.Vector3, radius: number, yBase: number, seed = 5): THREE.InstancedMesh {
  const mat = new THREE.MeshBasicMaterial({
    map: cloudTexture(),
    transparent: true,
    depthWrite: false,
    fog: true,
    toneMapped: false,
    side: THREE.DoubleSide,
  });
  const geo = new THREE.PlaneGeometry(1, 0.5);
  const im = new THREE.InstancedMesh(geo, mat, count);
  const r = new Rng(seed);
  const m = new THREE.Matrix4();
  const data: { a: number; d: number; y: number; s: number; sp: number }[] = [];
  for (let i = 0; i < count; i++) {
    data.push({ a: r.range(0, Math.PI * 2), d: radius * r.range(0.6, 1.6), y: yBase + r.range(40, 140), s: r.range(50, 120), sp: r.range(0.004, 0.012) });
  }
  im.userData.clouds = data;
  im.userData.centre = centre.clone();
  im.frustumCulled = false;
  im.renderOrder = -5;
  updateClouds(im, 0, new THREE.Vector3());
  void m;
  return im;
}
const _m = new THREE.Matrix4();
const _p = new THREE.Vector3();
const _q = new THREE.Quaternion();
const _s = new THREE.Vector3();
const _e = new THREE.Euler();
export function updateClouds(im: THREE.InstancedMesh, t: number, cam: THREE.Vector3) {
  const data = im.userData.clouds as { a: number; d: number; y: number; s: number; sp: number }[];
  const c = im.userData.centre as THREE.Vector3;
  for (let i = 0; i < data.length; i++) {
    const d = data[i];
    const a = d.a + t * d.sp;
    _p.set(c.x + Math.cos(a) * d.d, d.y, c.z + Math.sin(a) * d.d);
    _e.set(0, Math.atan2(cam.x - _p.x, cam.z - _p.z), 0);
    _q.setFromEuler(_e);
    _s.set(d.s, d.s, 1);
    _m.compose(_p, _q, _s);
    im.setMatrixAt(i, _m);
  }
  im.instanceMatrix.needsUpdate = true;
}

/** Stylised toon water: banded shoreline foam + moving sparkle ripples. */
export function buildWater(color: string, size: number, y: number, centre: THREE.Vector3): THREE.Mesh {
  const mat = new THREE.ShaderMaterial({
    fog: true,
    transparent: false,
    uniforms: THREE.UniformsUtils.merge([
      THREE.UniformsLib.fog,
      { uColor: { value: new THREE.Color(color) }, uTime: { value: 0 } },
    ]),
    vertexShader: /* glsl */ `
      varying vec3 vW;
      #include <fog_pars_vertex>
      void main() {
        vec4 w = modelMatrix * vec4(position, 1.0);
        vW = w.xyz;
        vec4 mvPosition = viewMatrix * w;
        gl_Position = projectionMatrix * mvPosition;
        #include <fog_vertex>
      }`,
    fragmentShader: /* glsl */ `
      uniform vec3 uColor; uniform float uTime;
      varying vec3 vW;
      #include <fog_pars_fragment>
      float n2(vec2 p) { return sin(p.x) * sin(p.y); }
      void main() {
        vec2 p = vW.xz * 0.08;
        float w = n2(p * 1.3 + vec2(uTime * 0.6, uTime * 0.4)) + n2(p * 2.1 - vec2(uTime * 0.5, -uTime * 0.3)) * 0.6;
        float stripe = smoothstep(0.75, 0.95, w);
        vec3 col = mix(uColor * 0.92, uColor * 1.08, smoothstep(-1.0, 1.0, w));
        col = mix(col, vec3(1.0), stripe * 0.65);
        gl_FragColor = vec4(col, 1.0);
        #include <fog_fragment>
      }`,
  });
  const m = new THREE.Mesh(new THREE.PlaneGeometry(size, size, 1, 1).rotateX(-Math.PI / 2), mat);
  m.position.set(centre.x, y, centre.z);
  m.receiveShadow = false;
  return m;
}
