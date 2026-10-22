import * as THREE from 'three';
import { Rng } from '../core/rng';
import { MeshBuilder } from '../art/builder';
import { canvas, tex } from '../art/textures';
import type { ThemeId, TrackDef } from '../data/tracks';
import type { ThemeDef } from './themes';
import type { TrackPath } from './path';

/** Continuous noise avoids repeating conical hills and hard changes between terrain cells. */
export function landNoise(x: number, z: number): number {
  const ix = Math.floor(x),
    iz = Math.floor(z);
  const hash = (a: number, b: number) => {
    const n = Math.sin(a * 127.1 + b * 311.7) * 43758.5453;
    return n - Math.floor(n);
  };
  let u = x - ix,
    v = z - iz;
  u *= u * (3 - 2 * u);
  v *= v * (3 - 2 * v);
  return THREE.MathUtils.lerp(
    THREE.MathUtils.lerp(hash(ix, iz), hash(ix + 1, iz), u),
    THREE.MathUtils.lerp(hash(ix, iz + 1), hash(ix + 1, iz + 1), u),
    v,
  );
}

const ARID = new Set<ThemeId>(['desert', 'canyon', 'volcano', 'clockwork']);
const FROZEN = new Set<ThemeId>(['icecream', 'antarctic']);
const WET = new Set<ThemeId>(['ocean', 'abyss', 'hangang']);

export function backgroundRelief(theme: ThemeId, x: number, z: number) {
  const n = landNoise(x * 0.009, z * 0.009) + 0.45 * landNoise(x * 0.024 + 12, z * 0.024);
  const ridge = 1 - Math.abs(2 * landNoise(x * 0.005, z * 0.005 + 7) - 1);
  const scale =
    FROZEN.has(theme) || theme === 'volcano' ? 75 : theme === 'forest' || theme === 'canyon' ? 48 : 25;
  return n * scale * 0.65 + ridge * ridge * scale * 0.35;
}

/** Small surface grain plus long world-space variation, lit continuously rather than in toon bands. */
export function landscapeMaterial(theme: ThemeId, map?: THREE.Texture, vertexColors = true) {
  const mat = new THREE.MeshStandardMaterial({
    vertexColors,
    map,
    roughness: FROZEN.has(theme) ? 0.62 : 0.94,
    metalness: theme === 'clockwork' ? 0.14 : 0,
  });
  mat.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vLand;')
      .replace(
        '#include <worldpos_vertex>',
        '#include <worldpos_vertex>\nvLand = (modelMatrix * vec4(transformed, 1.0)).xyz;',
      );
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
      varying vec3 vLand;
    `,
      )
      .replace(
        '#include <color_fragment>',
        `#include <color_fragment>
      float broad = sin(vLand.x*.043 + sin(vLand.z*.031)*2.0)*sin(vLand.z*.057);
      float strata = sin(vLand.y*1.35 + sin(vLand.x*.07)*1.3);
      diffuseColor.rgb *= .94 + broad*.065 + ${ARID.has(theme) ? '.055' : '.018'}*strata;
    `,
      );
  };
  mat.customProgramCacheKey = () => `landscape-${theme}`;
  return mat;
}

/** Biome-specific granular bump maps: sand ripples, fractured ice, soil and mineral grain. */
export function groundDetail(theme: ThemeId, seed: number) {
  const [c, g] = canvas(512, 512),
    rng = new Rng(seed + ':detail');
  g.fillStyle = '#888888';
  g.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 6500; i++) {
    const v = rng.int(85, 175);
    g.fillStyle = `rgb(${v},${v},${v})`;
    g.fillRect(rng.range(0, 512), rng.range(0, 512), rng.range(1, 3), rng.range(1, 3));
  }
  if (theme === 'desert' || theme === 'canyon') {
    g.strokeStyle = '#acacac';
    g.lineWidth = 2;
    for (let j = -2; j < 35; j++) {
      g.beginPath();
      for (let x = 0; x <= 512; x += 4) {
        const y = j * 16 + Math.sin((x / 512) * Math.PI * 4) * 6;
        if (!x) g.moveTo(x, y);
        else g.lineTo(x, y);
      }
      g.stroke();
    }
  } else if (FROZEN.has(theme)) {
    g.strokeStyle = '#5b5b5b';
    g.lineWidth = 0.8;
    for (let j = 0; j < 18; j++) {
      let x = rng.range(0, 512),
        y = rng.range(0, 512);
      g.beginPath();
      g.moveTo(x, y);
      for (let k = 0; k < 5; k++) {
        x += rng.range(-28, 28);
        y += rng.range(10, 35);
        g.lineTo(x, y);
      }
      g.stroke();
    }
  }
  return tex(c, true, false);
}

/** Distant mountain ranges and small grounded details, with a strict all-route exclusion. */
export function buildLandscape(
  def: TrackDef,
  theme: ThemeDef,
  paths: TrackPath[],
  centre: THREE.Vector3,
  radius: number,
  ground: (x: number, z: number) => number,
  density: number,
) {
  const out = new THREE.Group();
  out.name = 'natural-landscape';
  const rng = new Rng(def.id + ':landscape');
  const frozen = FROZEN.has(def.theme),
    arid = ARID.has(def.theme);
  const rock = new THREE.Color(frozen ? '#718DA1' : arid ? '#8D6655' : '#68766C');
  const green = new THREE.Color(theme.ground[0]);
  const base = Math.min(...paths[0].py) - 18;
  const rows = 20,
    columns = 192,
    positions: number[] = [],
    colors: number[] = [],
    indices: number[] = [];
  const height = def.theme === 'volcano' ? 240 : frozen ? 220 : def.theme === 'canyon' ? 170 : 135;
  const snow = new THREE.Color('#E7EEF0');
  for (let row = 0; row <= rows; row++) {
    const u = row / rows,
      distance = radius + 140 + u * 660;
    for (let j = 0; j <= columns; j++) {
      const a = (j / columns) * Math.PI * 2,
        x = centre.x + Math.cos(a) * distance,
        z = centre.z + Math.sin(a) * distance;
      const ridge = 0.28 + 0.72 * landNoise(Math.cos(a) * 6 + 20, Math.sin(a) * 6 + 20);
      const h =
        Math.sin(u * Math.PI) ** 1.8 * height * ridge +
        backgroundRelief(def.theme, x, z) * Math.sin(u * Math.PI);
      positions.push(x, base + h, z);
      const color = green.clone().lerp(rock, THREE.MathUtils.smoothstep(h, height * 0.12, height * 0.55));
      if (frozen || (!arid && def.theme !== 'abyss'))
        color.lerp(snow, THREE.MathUtils.smoothstep(h, height * 0.48, height * 0.78));
      color.multiplyScalar(0.86 + 0.14 * landNoise(x * 0.08, z * 0.08));
      colors.push(color.r, color.g, color.b);
      if (row < rows && j < columns) {
        const k = row * (columns + 1) + j,
          next = k + columns + 1;
        indices.push(k, k + 1, next, k + 1, next + 1, next);
      }
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  const horizon = new THREE.Mesh(geo, landscapeMaterial(def.theme));
  horizon.name = 'distant-ranges';
  horizon.receiveShadow = true;
  out.add(horizon);

  if (def.voidWorld) return out;
  const samples: { x: number; z: number; radius: number }[] = [];
  const v = new THREE.Vector3();
  for (const p of paths)
    for (let s = 0; s < p.length; s += 4) {
      p.pointAt(s, 0, v);
      const i = p.idxAtS(s);
      samples.push({ x: v.x, z: v.z, radius: p.halfW[i] + Math.max(p.shoulderL[i], p.shoulderR[i]) + 10 });
    }
  const chunks = new Map<string, MeshBuilder>();
  let placed = 0;
  for (let j = 0; j < Math.round(700 * density); j++) {
    const a = rng.range(0, Math.PI * 2),
      d = rng.range(25, radius + 100);
    const x = centre.x + Math.cos(a) * d,
      z = centre.z + Math.sin(a) * d;
    const r = rng.range(0.45, 2.3);
    if (samples.some((p) => (p.x - x) ** 2 + (p.z - z) ** 2 < (p.radius + r * 2) ** 2)) continue;
    const y = ground(x, z);
    if (def.water && y < def.water.y + 0.3) continue;
    const key = `${Math.floor(x / 110)},${Math.floor(z / 110)}`;
    let detail = chunks.get(key);
    if (!detail) {
      detail = new MeshBuilder();
      detail.detail = 0.65;
      chunks.set(key, detail);
    }
    const stone = new THREE.IcosahedronGeometry(r, 1);
    const pos = stone.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const n = 0.85 + 0.22 * landNoise(pos.getX(i) * 3 + j, pos.getZ(i) * 3);
      pos.setXYZ(i, pos.getX(i) * n, pos.getY(i) * n, pos.getZ(i) * n);
    }
    stone.computeVertexNormals();
    const tint = frozen ? '#C8DCE5' : arid ? '#A17F65' : '#717D70';
    detail.add(stone, tint, { p: [x, y + r * 0.23, z], s: [1.3, 0.65, 1], r: [0, a, 0], outline: false });
    const wooded = ['forest', 'bamboo', 'hangang', 'jeju'].includes(def.theme);
    if (wooded && rng.chance(def.theme === 'forest' ? 0.65 : 0.3)) {
      const height = rng.range(10, 19);
      detail.cyl(
        0.24,
        0.65,
        height * 0.8,
        '#665348',
        {
          p: [x, y + height * 0.4, z],
          r: [0, a, 0.035],
          outline: false,
        },
        8,
      );
      for (const [dx, dy, dz] of [
        [-1.9, 0.6, 1],
        [2, 0.73, -1],
        [0, 0.9, 0],
      ]) {
        const crown = new THREE.IcosahedronGeometry(rng.range(2.7, 3.8), 2);
        const vertices = crown.attributes.position;
        for (let k = 0; k < vertices.count; k++) {
          const wobble = 0.88 + landNoise(vertices.getX(k) * 2 + j, vertices.getZ(k) * 2) * 0.22;
          vertices.setXYZ(k, vertices.getX(k) * wobble, vertices.getY(k) * wobble, vertices.getZ(k) * wobble);
        }
        crown.computeVertexNormals();
        detail.add(crown, rng.pick(['#365F46', '#48754B', '#5C8051', '#406C50']), {
          p: [x + dx, y + height * dy, z + dz],
          s: [1.1, 0.85, 1],
          r: [0, a + dx, 0],
          outline: false,
        });
      }
    }
    if (!arid && !frozen && !WET.has(def.theme)) {
      for (let k = 0; k < 4; k++)
        detail.cone(
          0.08,
          rng.range(0.35, 0.8),
          theme.ground[1],
          {
            p: [x + r * 2 + k * 0.16, y + 0.25, z + 0.3],
            r: [0, k, rng.range(-0.3, 0.3)],
            outline: false,
          },
          4,
        );
    }
    placed++;
  }
  const material = landscapeMaterial(def.theme);
  for (const detail of chunks.values()) {
    const mesh = detail.build({ outline: false, ao: false });
    mesh.traverse((o) => {
      if ((o as THREE.Mesh).isMesh) (o as THREE.Mesh).material = material;
    });
    out.add(mesh);
  }
  out.userData.detailCount = placed;
  return out;
}
