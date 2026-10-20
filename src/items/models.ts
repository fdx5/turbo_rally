import * as THREE from 'three';
import { MeshBuilder, extrudeShape, heartShape, lathe, starShape } from '../art/builder';
import type { Model } from '../data/items';
import { fakeBoxTexture } from '../art/textures';
import { toon } from '../art/toon';

const STAR = extrudeShape(starShape(1, 0.5), 0.35, 0.08);
const HEART = extrudeShape(heartShape(1), 0.4, 0.1);

function build(model: Model): THREE.Object3D {
  const b = new MeshBuilder();
  b.detail = 0.8;
  switch (model) {
    case 'jelly':
      b.sphere(0.55, '#7BE0A0', { s: [1, 0.9, 1] });
      b.sphere(0.16, '#FFFFFF', { p: [0.2, 0.25, 0.35], outline: false });
      break;
    case 'heart':
      b.add(HEART, '#FF7EB3', { s: 0.55, r: [0, Math.PI / 2, Math.PI] });
      break;
    case 'letter':
      b.box(0.9, 0.6, 0.12, '#FFF6E9', {}, 0.2);
      b.add(HEART, '#FF6B8A', { p: [0, 0, 0.08], s: 0.18, r: [0, 0, Math.PI] });
      break;
    case 'comet':
    case 'meteor':
      b.add(STAR, model === 'comet' ? '#FFE066' : '#FFB067', { s: 0.9, glow: model === 'comet' ? 2.2 : 0 });
      if (model === 'meteor') b.sphere(0.7, '#B39BCF');
      break;
    case 'crown':
      b.cyl(0.55, 0.45, 0.5, '#FFD45E', {});
      for (let i = 0; i < 5; i++) b.cone(0.12, 0.3, '#FFD45E', { p: [Math.cos(i * 1.26) * 0.5, 0.4, Math.sin(i * 1.26) * 0.5] }, 6);
      b.sphere(0.15, '#7DF9FF', { p: [0, 0.1, 0.55], glow: 2 });
      break;
    case 'pudding':
      b.add(lathe([[0, 0], [0.6, 0], [0.52, 0.5], [0.45, 0.6], [0, 0.62]], 16), '#FFD98A');
      b.sphere(0.45, '#A0603C', { p: [0, 0.6, 0], s: [1, 0.25, 1] });
      break;
    case 'fakebox': {
      const g = new THREE.Group();
      const m = new THREE.Mesh(new THREE.BoxGeometry(1.5, 1.5, 1.5), toon({ map: fakeBoxTexture(), transparent: true, opacity: 0.9 }));
      m.position.y = 0.9;
      g.add(m);
      return g;
    }
    case 'bubble':
      return bubbleMesh(0.8, '#BFE9FF');
    case 'balloon':
      b.sphere(0.5, '#8FD3FF', { s: [1, 1.1, 1] });
      b.cone(0.1, 0.18, '#8FD3FF', { p: [0, -0.6, 0], r: [Math.PI, 0, 0] }, 8);
      break;
    case 'marshmallow':
      b.cyl(0.4, 0.4, 0.55, '#FFF6FA', {});
      break;
    case 'honey':
      b.add(lathe([[0, 0], [0.5, 0.05], [0.55, 0.45], [0.35, 0.7], [0.4, 0.8], [0, 0.8]], 14), '#FFC93C');
      b.cyl(0.38, 0.38, 0.1, '#C98E5A', { p: [0, 0.82, 0] });
      break;
    case 'acorn':
      b.sphere(0.3, '#C98E5A', { s: [1, 1.2, 1] });
      b.sphere(0.32, '#8B5E3C', { p: [0, 0.22, 0], s: [1, 0.55, 1] });
      break;
    case 'popcorn':
      for (let i = 0; i < 7; i++) b.sphere(0.22, i % 2 ? '#FFF6C9' : '#FFFFFF', { p: [Math.cos(i) * 0.25, 0.25 + (i % 3) * 0.12, Math.sin(i) * 0.25] });
      break;
    case 'yoyo':
      b.cyl(0.5, 0.5, 0.12, '#FF8FB8', { p: [0.1, 0, 0], r: [0, 0, Math.PI / 2] });
      b.cyl(0.5, 0.5, 0.12, '#FF8FB8', { p: [-0.1, 0, 0], r: [0, 0, Math.PI / 2] });
      break;
    case 'duck':
      b.sphere(0.5, '#FFE066', { s: [1, 0.8, 1.2] });
      b.sphere(0.3, '#FFE066', { p: [0, 0.45, 0.35] });
      b.cone(0.1, 0.2, '#FFA94D', { p: [0, 0.42, 0.68], r: [Math.PI / 2, 0, 0] }, 8);
      break;
    case 'top':
      b.cone(0.6, 0.9, '#B9A6FF', { r: [Math.PI, 0, 0] });
      b.cyl(0.62, 0.62, 0.15, '#FFC8DD', { p: [0, 0.45, 0] });
      b.cyl(0.08, 0.08, 0.4, '#5E5873', { p: [0, 0.7, 0] }, 8);
      break;
    case 'snowball':
      b.sphere(0.55, '#FFFFFF');
      break;
    case 'magnet':
      b.add(new THREE.TorusGeometry(0.4, 0.15, 8, 16, Math.PI), '#FF6B6B', { r: [0, 0, Math.PI] });
      b.box(0.3, 0.2, 0.3, '#DDE3EE', { p: [0.4, 0.1, 0] }, 0.3);
      b.box(0.3, 0.2, 0.3, '#DDE3EE', { p: [-0.4, 0.1, 0] }, 0.3);
      break;
    case 'sheep':
      for (let i = 0; i < 6; i++) b.sphere(0.32, '#FFFFFF', { p: [Math.cos(i) * 0.3, 0.1 + (i % 2) * 0.15, Math.sin(i) * 0.35] });
      b.sphere(0.25, '#5E5873', { p: [0, 0.15, 0.55] });
      break;
    case 'mushroom':
      b.sphere(0.55, '#B9A6FF', { p: [0, 0.3, 0], s: [1, 0.6, 1] });
      for (let i = 0; i < 4; i++) b.sphere(0.1, '#FFFFFF', { p: [Math.cos(i * 1.6) * 0.35, 0.5, Math.sin(i * 1.6) * 0.35], outline: false });
      b.cyl(0.18, 0.22, 0.4, '#FFF6E9', { p: [0, 0, 0] });
      break;
    case 'bee':
      b.sphere(0.32, '#FFE066', { s: [1, 1, 1.3] });
      b.torus(0.3, 0.06, '#5E5873', { r: [0, 0, 0] });
      for (const sx of [-1, 1]) b.sphere(0.2, '#E8F7FF', { p: [sx * 0.25, 0.3, 0], s: [0.4, 0.8, 1], outline: false });
      break;
    case 'beachball':
      ['#FF8A80', '#FFFFFF', '#5AA9FF', '#FFFFFF', '#FFE066', '#FFFFFF'].forEach((c, i) => b.add(new THREE.SphereGeometry(2.6, 10, 12, (i / 6) * Math.PI * 2, Math.PI / 3), c, { outline: i === 0 }));
      break;
    case 'missile':
      b.capsule(0.22, 0.6, '#FF9EC7', { r: [Math.PI / 2, 0, 0] });
      for (let i = 0; i < 3; i++) b.box(0.05, 0.25, 0.2, '#FFFFFF', { p: [Math.cos(i * 2.1) * 0.22, Math.sin(i * 2.1) * 0.22, -0.35], r: [0, 0, i * 2.1] }, 0.3);
      break;
    case 'dragon':
      for (let i = 0; i < 7; i++) b.sphere(0.55 - i * 0.05, i % 2 ? '#FFD45E' : '#FF8A65', { p: [Math.sin(i * 0.9) * 0.4, Math.cos(i * 0.6) * 0.2, -i * 0.7] });
      b.sphere(0.65, '#FFD45E', { p: [0, 0.1, 0.6] });
      for (const sx of [-1, 1]) b.cone(0.12, 0.5, '#FF8A65', { p: [sx * 0.3, 0.7, 0.5], r: [-0.4, 0, 0] }, 6);
      break;
    case 'box':
    case 'deliverybox':
      b.box(0.8, 0.6, 0.6, model === 'box' ? '#D9A066' : '#FFFFFF', {}, 0.12);
      b.box(0.82, 0.1, 0.62, model === 'box' ? '#3DA9F5' : '#FF6B9E', { outline: false }, 0.3);
      break;
    case 'yogurt':
      b.add(lathe([[0, 0], [0.3, 0], [0.32, 0.4], [0.22, 0.6], [0.24, 0.75], [0, 0.75]], 14), '#FFF8EC');
      b.cyl(0.25, 0.25, 0.06, '#F7931E', { p: [0, 0.78, 0] });
      break;
    case 'trashbag':
      b.sphere(0.5, '#6CC57C', { s: [1, 1.1, 1] });
      b.cone(0.15, 0.3, '#6CC57C', { p: [0, 0.6, 0] }, 8);
      break;
    case 'icecream':
      b.add(lathe([[0, 0], [0.25, 0.6], [0, 0.6]], 12).rotateX(Math.PI).translate(0, 0.6, 0), '#E8C79A', { r: [Math.PI / 2, 0, 0] });
      b.sphere(0.3, '#FFC8DD', { p: [0, 0, 0.5] });
      break;
    case 'tteok':
      b.cyl(0.03, 0.03, 1.2, '#E8C79A', { r: [Math.PI / 2, 0, 0] }, 6);
      for (let i = 0; i < 4; i++) b.capsule(0.12, 0.15, '#FF5E5E', { p: [0, 0, -0.35 + i * 0.22], r: [0, 0, Math.PI / 2] });
      break;
    case 'golfball':
      b.sphere(0.3, '#FFFFFF');
      break;
    case 'gum':
      b.sphere(2.2, '#FF9EC7', { s: [1.6, 1, 0.4] });
      break;
    case 'stop':
      b.cyl(1.2, 1.2, 0.15, '#F2545B', { p: [0, 2.2, 0], r: [Math.PI / 2, 0, 0] }, 8);
      b.cyl(0.08, 0.08, 2.2, '#C9C2D6', { p: [0, 1.1, 0] }, 8);
      b.box(7, 0.6, 0.3, '#FFFFFF', { p: [0, 0.6, 0] }, 0.3);
      b.box(1, 0.6, 0.32, '#F2545B', { p: [-2, 0.6, 0] }, 0.3);
      b.box(1, 0.6, 0.32, '#F2545B', { p: [2, 0.6, 0] }, 0.3);
      break;
    default:
      b.sphere(0.5, '#FFFFFF');
  }
  return b.build({ outline: true, outlineWidth: 0.8 });
}

const cache = new Map<string, THREE.Object3D>();
export function itemModel(model: Model): THREE.Object3D {
  let base = cache.get(model);
  if (!base) cache.set(model, (base = build(model)));
  return base.clone();
}

/** Fresnel soap-bubble (shields, bubble gun, float). */
export function bubbleMesh(r: number, tint = '#CDEBFF'): THREE.Mesh {
  const m = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    uniforms: { uTint: { value: new THREE.Color(tint) }, uTime: { value: 0 } },
    vertexShader: `varying vec3 vN; varying vec3 vV; void main(){ vec4 mv = modelViewMatrix*vec4(position,1.0); vN = normalize(normalMatrix*normal); vV = normalize(-mv.xyz); gl_Position = projectionMatrix*mv; }`,
    fragmentShader: `uniform vec3 uTint; uniform float uTime; varying vec3 vN; varying vec3 vV;
      void main(){ float f = pow(1.0 - abs(dot(vN, vV)), 2.2);
        vec3 irid = 0.5 + 0.5*cos(6.2831*(vec3(0.0,0.33,0.67) + f*1.5 + uTime*0.2));
        vec3 col = mix(uTint, irid, 0.45) * (0.6 + f) ;
        gl_FragColor = vec4(col * 1.2, 0.12 + f*0.65); }`,
  });
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(r, 24, 16), m);
  mesh.renderOrder = 30;
  return mesh;
}

/** Flat tinted puddle disc for zones. */
export function puddleMesh(radius: number, color: string, kind: 'puddle' | 'mound' | 'swirl' = 'puddle'): THREE.Object3D {
  if (kind === 'mound') {
    const b = new MeshBuilder();
    b.sphere(radius, color, { s: [1, 0.35, 1] });
    return b.build({ outline: true });
  }
  const g = new THREE.CircleGeometry(radius, 28).rotateX(-Math.PI / 2);
  const pos = g.attributes.position as THREE.BufferAttribute;
  for (let i = 1; i < pos.count; i++) {
    const x = pos.getX(i);
    const z = pos.getZ(i);
    const a = Math.atan2(z, x);
    const k = 1 + Math.sin(a * 5) * 0.08 + Math.sin(a * 3 + 1) * 0.06;
    pos.setX(i, x * k);
    pos.setZ(i, z * k);
  }
  const mat =
    kind === 'swirl'
      ? new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(1.4), transparent: true, opacity: 0.8, toneMapped: false, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4 })
      : new THREE.MeshToonMaterial({ color, transparent: true, opacity: 0.92, polygonOffset: true, polygonOffsetFactor: -4, gradientMap: (toon({}) as THREE.MeshToonMaterial).gradientMap });
  const m = new THREE.Mesh(g, mat);
  m.receiveShadow = true;
  return m;
}
export { STAR as starGeo, HEART as heartGeo };
