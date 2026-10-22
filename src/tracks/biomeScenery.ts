import * as THREE from 'three';
import { MeshBuilder } from '../art/builder';
import { Rng } from '../core/rng';
import type { TrackDef } from '../data/tracks';
import type { TrackPath } from './path';
import { landscapeMaterial } from './landscape';

/** Large, distinctive silhouettes for all sixteen expeditions, outside every route corridor. */
export function buildBiomeScenery(
  def: TrackDef,
  paths: TrackPath[],
  ground: (x: number, z: number) => number,
) {
  const out = new THREE.Group();
  out.name = `biome-${def.theme}`;
  const b = new MeshBuilder();
  b.detail = 0.8;
  const rng = new Rng(`${def.id}:biome`),
    main = paths[0];
  const corridors: { x: number; z: number; radius: number }[] = [];
  const scratch = new THREE.Vector3();
  for (const path of paths)
    for (let s = 0; s < path.length; s += path.loopAt(s) ? 0.3 : 3) {
      path.pointAt(s, 0, scratch);
      const i = path.idxAtS(s);
      corridors.push({
        x: scratch.x,
        z: scratch.z,
        radius: path.halfW[i] + Math.max(path.shoulderL[i], path.shoulderR[i]),
      });
    }
  for (let j = 0; j < 24; j++) {
    const s = ((j + 0.5) / 24) * main.length,
      side = j % 2 ? -1 : 1;
    let p: THREE.Vector3 | null = null;
    for (let attempt = 0; attempt < 5; attempt++) {
      const candidate = main.pointAt(s, side * (48 + attempt * 18), new THREE.Vector3());
      if (corridors.every((c) => Math.hypot(c.x - candidate.x, c.z - candidate.z) > c.radius + 23)) {
        p = candidate;
        break;
      }
    }
    if (!p) continue;
    const x = p.x,
      z = p.z,
      y = def.voidWorld ? p.y - 18 : ground(x, z),
      h = rng.range(32, 58);
    const pos = (dx = 0, dy = 0, dz = 0): [number, number, number] => [x + dx, y + dy, z + dz];
    const o = { outline: false };
    if (def.theme === 'forest') {
      b.cyl(3.5, 6, h, '#725C44', { ...o, p: pos(0, h / 2) }, 8);
      for (const [dx, dy, dz, r] of [
        [0, h, 0, 19],
        [-12, h - 8, 3, 13],
        [10, h - 5, -7, 14],
      ])
        b.sphere(r, j % 2 ? '#35865F' : '#74AC63', { ...o, p: pos(dx, dy, dz), s: [1, 0.65, 1] }, 10, 7);
      for (let root = 0; root < 5; root++) {
        const a = root * Math.PI * 0.4;
        b.cone(
          3.2,
          16,
          '#725C44',
          { ...o, p: pos(Math.cos(a) * 5, 5, Math.sin(a) * 5), r: [Math.sin(a) * 0.6, 0, Math.cos(a) * 0.6] },
          5,
        );
      }
      for (let k = 0; k < 5; k++)
        b.sphere(
          0.2,
          '#D7FF97',
          { ...o, p: pos(rng.range(-16, 16), rng.range(5, 25), rng.range(-16, 16)), glow: 2 },
          6,
          5,
        );
    } else if (def.theme === 'desert') {
      if (j % 3 === 0) {
        b.cone(22, 36, '#D5A264', { ...o, p: pos(0, 18), r: [0, Math.PI / 4, 0] }, 4);
        b.cone(6, 10, '#FFF1AD', { ...o, p: pos(0, 31), r: [0, Math.PI / 4, 0] }, 4);
      } else {
        if (j % 4 === 0) {
          b.sphere(19, '#E8C98A', { ...o, p: pos(0, 0.5), s: [1, 0.07, 0.75] }, 12, 6);
          b.sphere(16, '#48BFAD', { ...o, p: pos(0, 1.1), s: [1, 0.035, 0.7] }, 16, 8);
          b.sphere(9, '#79DFCA', { ...o, p: pos(0, 1.5), s: [1, 0.025, 0.65] }, 12, 6);
          for (const dx of [-12, 12]) {
            b.cyl(0.65, 1.1, 10, '#B48A57', { ...o, p: pos(dx, 5, 5) }, 7);
            for (let leaf = 0; leaf < 5; leaf++)
              b.sphere(
                5,
                '#4C986F',
                {
                  ...o,
                  p: pos(dx + Math.cos(leaf * 1.26) * 3, 10, 5 + Math.sin(leaf * 1.26) * 3),
                  s: [1, 0.12, 0.35],
                  r: [0, -leaf * 1.26, 0.2],
                },
                8,
                5,
              );
          }
        } else b.sphere(18, '#E1B06D', { ...o, p: pos(0, 1), s: [1, 0.32, 0.7] }, 10, 6);
        b.cyl(1.5, 2.5, 12, '#54916B', { ...o, p: pos(0, 6) }, 7);
        b.capsule(1.3, 5, '#54916B', { ...o, p: pos(4, 6), r: [0, 0, -0.65] });
        b.capsule(1.2, 4, '#54916B', { ...o, p: pos(-3, 8), r: [0, 0, 0.65] });
      }
    } else if (def.theme === 'antarctic') {
      b.cyl(14, 20, 7, '#C9E9F4', { ...o, p: pos(0, 3.5) }, 7);
      if (j % 4 === 0) {
        b.box(18, 7, 10, '#E69648', { ...o, p: pos(0, 10.5) }, 0.05, 1);
        b.box(16, 2, 11, '#EEF5F8', { ...o, p: pos(0, 15) }, 0.05, 1);
        for (const dx of [-5, 0, 5]) b.box(3, 2.5, 0.15, '#2C6384', { ...o, p: pos(dx, 11, 5.1) }, 0.05, 1);
        b.cyl(0.18, 0.18, 12, '#E8EDF1', { ...o, p: pos(8, 19) }, 6);
        b.box(4, 2, 0.1, '#FFC760', { ...o, p: pos(10, 24) }, 0.01, 1);
      } else
        for (let k = 0; k < 4; k++) {
          const dx = k * 3 - 4.5;
          b.sphere(1.2, '#243849', { ...o, p: pos(dx, 8), s: [0.75, 1.3, 0.8] }, 8, 6);
          b.sphere(0.8, '#F7FDFF', { ...o, p: pos(dx, 7.8, 0.5), s: [0.7, 1.1, 0.5] }, 8, 6);
          b.cone(0.3, 0.7, '#FFBC58', { ...o, p: pos(dx, 8.8, 1), r: [Math.PI / 2, 0, 0] }, 6);
        }
    } else if (def.theme === 'ocean') {
      b.sphere(21, '#D9D0A0', { ...o, p: pos(0, 1), s: [1, 0.18, 0.8] }, 12, 6);
      for (let k = 0; k < 6; k++) {
        const a = (k * Math.PI) / 3;
        b.cone(3, 12, '#FF9D94', { ...o, p: pos(Math.cos(a) * 12, 7, Math.sin(a) * 12), r: [0, a, 0.35] }, 5);
      }
      if (j % 3 === 0) {
        b.cyl(3, 5, 24, '#F6EEE0', { ...o, p: pos(0, 13) }, 10);
        b.cyl(4, 4, 4, '#E8776A', { ...o, p: pos(0, 27) }, 10);
        b.cone(5, 4, '#526D85', { ...o, p: pos(0, 31) }, 10);
      }
    } else if (def.theme === 'clockwork') {
      b.cyl(5, 7, h, '#725E60', { ...o, p: pos(0, h / 2) }, 10);
      const cy = h * 0.75;
      b.torus(12, 2, '#D8AA68', { ...o, p: pos(0, cy) });
      b.cyl(3, 3, 4, '#70D3CE', { ...o, p: pos(0, cy), r: [Math.PI / 2, 0, 0] }, 10);
      for (let k = 0; k < 12; k++) {
        const a = (k * Math.PI) / 6;
        b.box(
          4,
          5,
          4,
          '#D8AA68',
          { ...o, p: pos(Math.sin(a) * 13, cy + Math.cos(a) * 13), r: [0, 0, -a] },
          0.06,
          1,
        );
      }
      for (let k = 0; k < 3; k++)
        b.sphere(3 + k, '#D1C7C0', { ...o, p: pos(1 + k * 2, h + 5 + k * 7), s: [1, 0.6, 1] }, 8, 6);
    } else if (def.theme === 'canyon') {
      for (let layer = 0; layer < 5; layer++)
        b.cyl(
          13 - layer * 1.5,
          17 - layer * 1.5,
          10,
          layer % 2 ? '#D4956E' : '#A85D48',
          { ...o, p: pos(0, 5 + layer * 10) },
          7,
        );
      b.cyl(7, 10, 6, '#E4B58A', { ...o, p: pos(0, 53) }, 7);
    } else if (def.theme === 'abyss') {
      for (let k = 0; k < 6; k++) {
        const a = (k * Math.PI) / 3;
        b.cyl(
          0.7,
          1.7,
          12,
          '#6A729F',
          { ...o, p: pos(Math.cos(a) * 9, 6, Math.sin(a) * 9), r: [Math.sin(a) * 0.3, 0, Math.cos(a) * 0.3] },
          6,
        );
        b.sphere(
          3.5,
          '#86FFE5',
          { ...o, p: pos(Math.cos(a) * 11, 13, Math.sin(a) * 11), s: [1, 0.6, 1], glow: 1.4 },
          8,
          6,
        );
      }
      b.sphere(6, '#9E9BEE', { ...o, p: pos(0, 25), s: [1, 0.5, 1], glow: 1.2 }, 10, 7);
      for (let k = 0; k < 5; k++)
        b.cyl(0.12, 0.12, 8, '#B3F8F4', { ...o, p: pos(k * 2 - 4, 18), glow: 1.4 }, 6);
    } else if (def.theme === 'bamboo') {
      for (let k = 0; k < 9; k++) {
        const dx = ((k % 3) - 1) * 6,
          dz = (Math.floor(k / 3) - 1) * 6,
          height = 25 + (k % 3) * 5;
        b.cyl(0.7, 1.1, height, '#5A9368', { ...o, p: pos(dx, height / 2, dz) }, 6);
        for (let n = 1; n < 6; n++)
          b.cyl(0.85, 0.85, 0.18, '#B8CEA0', { ...o, p: pos(dx, (n * height) / 6, dz) }, 6);
        b.sphere(6, '#77AA7D', { ...o, p: pos(dx, height, dz), s: [1, 0.25, 0.7] }, 7, 5);
      }
      b.box(5, 3, 5, '#F7CF82', { ...o, p: pos(0, 8), glow: 1.2 }, 0.1, 1);
      b.cone(5, 2, '#677789', { ...o, p: pos(0, 10.5), r: [0, Math.PI / 4, 0] }, 4);
    } else if (def.theme === 'candy') {
      b.cyl(16, 7, 18, '#B28782', { ...o, p: pos(0, 12) }, 8);
      b.sphere(19, '#FFD0E5', { ...o, p: pos(0, 22), s: [1, 0.35, 1] }, 12, 8);
      b.cyl(0.7, 0.7, 20, '#FFF6DD', { ...o, p: pos(0, 36) }, 8);
      b.torus(8, 2.5, j % 2 ? '#FF90BF' : '#8FD7F3', { ...o, p: pos(0, 47) });
    } else if (def.theme === 'hangang') {
      b.cyl(3, 5, 28, '#ADC5D9', { ...o, p: pos(0, 14) }, 8);
      b.torus(13, 1, '#E3F8FF', { ...o, p: pos(0, 24), r: [0, 0, Math.PI / 2] });
      b.sphere(5, '#F0BA78', { ...o, p: pos(0, 33), s: [1, 0.3, 1] }, 8, 6);
    } else if (def.theme === 'neon') {
      b.box(16, h + 15, 14, '#293A60', { ...o, p: pos(0, (h + 15) / 2) }, 0.04, 1);
      for (let k = 0; k < 6; k++)
        b.box(
          16.2,
          0.6,
          14.2,
          k % 2 ? '#6DF9FC' : '#F4A2EB',
          { ...o, p: pos(0, 8 + k * 8), glow: 1.6 },
          0.03,
          1,
        );
      b.torus(12, 0.4, '#8EF7FF', { ...o, p: pos(0, h + 23), r: [Math.PI / 2, 0, 0], glow: 1.7 });
    } else if (def.theme === 'cavern') {
      for (let k = 0; k < 7; k++)
        b.cone(
          3 + (k % 3),
          20 + (k % 3) * 7,
          k % 2 ? '#85EED9' : '#B39AF1',
          {
            ...o,
            p: pos(((k % 3) - 1) * 6, 10 + (k % 3) * 3, Math.floor(k / 3) * 5 - 5),
            r: [0, k, k % 2 ? 0.18 : -0.18],
          },
          5,
        );
    } else if (def.theme === 'volcano') {
      b.cyl(8, 22, 34, '#57414C', { ...o, p: pos(0, 17) }, 9);
      b.torus(8, 1, '#FF9B3E', { ...o, p: pos(0, 34), r: [Math.PI / 2, 0, 0], glow: 1.8 });
      for (let k = 0; k < 6; k++)
        b.sphere(
          1.5,
          '#FFC26B',
          { ...o, p: pos(Math.sin(k) * 12, 40 + Math.sin(k) * 10, Math.cos(k) * 8), glow: 2 },
          6,
          5,
        );
    } else if (def.theme === 'icecream') {
      b.cyl(15, 22, 10, '#B8DBEF', { ...o, p: pos(0, 5) }, 7);
      b.cone(14, h, '#B6E4F9', { ...o, p: pos(0, 10 + h / 2), r: [0, j, 0.1] }, 5);
      b.cone(7, h * 0.75, '#E7F8FF', { ...o, p: pos(12, 8 + h * 0.375), r: [0, j, -0.15] }, 5);
    } else if (def.theme === 'jeju') {
      b.cyl(14, 19, h, '#74867C', { ...o, p: pos(0, h / 2) }, 7);
      b.sphere(17, '#8EB97B', { ...o, p: pos(0, h), s: [1, 0.22, 1] }, 10, 6);
      for (const dx of [-9, 9]) b.cyl(2.5, 3, 15, '#B9C4A7', { ...o, p: pos(dx, h + 7.5) }, 8);
      b.box(24, 3, 7, '#C3CEB1', { ...o, p: pos(0, h + 16) }, 0.1, 1);
    } else if (def.theme === 'rainbow') {
      b.sphere(15, j % 2 ? '#D5AAE9' : '#9DBDEB', { ...o, p: pos(0, 25) }, 14, 10);
      b.torus(21, 0.6, '#FFE5A1', { ...o, p: pos(0, 25), r: [Math.PI / 2, 0, 0.4], glow: 1.4 });
      for (let k = 0; k < 3; k++)
        b.sphere(
          1.4,
          '#FFF7C7',
          { ...o, p: pos(20 * Math.cos(k * 2), 40 + k * 6, 20 * Math.sin(k * 2)), glow: 1.8 },
          6,
          5,
        );
    }
    out.userData.landmarks = (out.userData.landmarks ?? 0) + 1;
  }
  const built = b.build({ outline: false });
  built.traverse((object) => {
    const mesh = object as THREE.Mesh;
    if (mesh.isMesh && mesh.name === 'solid') mesh.material = landscapeMaterial(def.theme);
  });
  out.add(built);
  return out;
}
