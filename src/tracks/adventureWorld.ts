import * as THREE from 'three';
import { MeshBuilder } from '../art/builder';
import { canvas, roundRect, tex } from '../art/textures';
import { glow, toon } from '../art/toon';
import { sharedTime } from '../art/materials';
import { Rng } from '../core/rng';
import type { TrackDef } from '../data/tracks';
import { TrackPath, roadFrame } from './path';
import type { ThemeDef } from './themes';
import { buildBiomeScenery } from './biomeScenery';
import { roadClearance } from './roadClearance';

const UP = new THREE.Vector3(0, 1, 0);
const at = (p: TrackPath, s: number, t = 0, lift = 0) => p.pointAt(s, t, new THREE.Vector3(), lift);

function beam(
  b: MeshBuilder,
  a: THREE.Vector3,
  c: THREE.Vector3,
  r: number,
  color: string,
  emissive = false,
) {
  const direction = c.clone().sub(a);
  const geometry = new THREE.CylinderGeometry(r, r, direction.length(), 6);
  geometry.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(UP, direction.normalize()));
  geometry.translate((a.x + c.x) / 2, (a.y + c.y) / 2, (a.z + c.z) / 2);
  b.add(geometry, color, { outline: false, glow: emissive ? 1.5 : undefined });
}

function sign(label: string, detail: string, color: string, width = 17): THREE.Group {
  const out = new THREE.Group();
  const [c, g] = canvas(1024, 256);
  g.fillStyle = '#111E36';
  roundRect(g, 0, 0, 1024, 256, 28);
  g.strokeStyle = color;
  g.lineWidth = 14;
  roundRect(g, 14, 14, 996, 228, 22, true);
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillStyle = '#FFFFFF';
  g.font = 'bold 72px "Jua", sans-serif';
  g.fillText(label, 512, 98, 930);
  g.fillStyle = color;
  g.font = 'bold 42px "Jua", sans-serif';
  g.fillText(detail, 512, 187, 930);
  const board = new THREE.Mesh(
    new THREE.PlaneGeometry(width, width / 4),
    new THREE.MeshBasicMaterial({ map: tex(c), side: THREE.DoubleSide, toneMapped: false }),
  );
  out.add(board);
  return out;
}

/** Distinct exploration scenery, readable route choices and structures with real clearance. */
export function buildAdventureWorld(
  def: TrackDef,
  paths: TrackPath[],
  theme: ThemeDef,
  ground: (x: number, z: number) => number,
): THREE.Group {
  const out = new THREE.Group();
  out.name = 'adventure-world';
  const main = paths[0],
    L = main.length;
  const rng = new Rng(def.id + ':adventure');
  const solids = new MeshBuilder(),
    details = new MeshBuilder();
  solids.detail = 0.55;
  details.detail = 0.6;
  const accent = def.theme === 'volcano' ? '#FFB43B' : def.theme === 'cavern' ? '#76FCE0' : theme.curb[0];
  out.add(buildBiomeScenery(def, paths, ground));
  const blocksRoad = roadClearance(paths);

  // Suspension bridges visibly span valleys; towers and cables stay outside the roadway.
  for (const bridge of def.bridge ?? []) {
    const start = bridge.u0 * L,
      end = bridge.u1 * L;
    for (const side of [-1, 1]) {
      let previous: THREE.Vector3 | null = null;
      const n = Math.ceil((end - start) / 14);
      for (let j = 0; j <= n; j++) {
        const s = start + ((end - start) * j) / n,
          i = main.idxAtS(s);
        const t = side * (main.halfW[i] + 5);
        const deck = at(main, s, t, 0.5),
          cable = deck.clone();
        cable.y += 5 + 18 * Math.cos((j / n) * Math.PI) ** 2;
        if (previous) beam(details, previous, cable, 0.22, accent);
        beam(details, deck, cable, 0.09, '#D7E8F4');
        previous = cable;
        if (j === 0 || j === n) {
          solids.box(
            1.5,
            27,
            1.5,
            '#B7C5D6',
            { p: [deck.x, deck.y + 12.5, deck.z], outline: false },
            0.06,
            1,
          );
          const top = at(main, s, 0, 25);
          beam(
            solids,
            top.clone().add(new THREE.Vector3(main.hx[i] * t, 0, main.hz[i] * t)),
            top,
            0.6,
            '#CFE0EC',
          );
        }
      }
    }
  }

  for (const zone of def.adventures ?? []) {
    const start = zone.u0 * L,
      end = zone.u1 * L;
    const cave = zone.kind !== 'ruins';
    const ice = zone.kind === 'glacier',
      lava = zone.kind === 'lava';
    const forest = def.theme === 'forest' || def.theme === 'bamboo';
    const desert = def.theme === 'desert' || def.theme === 'canyon';
    const rock =
      def.theme === 'abyss'
        ? '#28526A'
        : forest
          ? '#5B5641'
          : desert
            ? '#A97457'
            : ice
              ? '#74ADD2'
              : lava
                ? '#3E3444'
                : '#4C4363';
    const light =
      def.theme === 'abyss'
        ? '#93FFE0'
        : forest
          ? '#D5F7A1'
          : desert
            ? '#FFDA9C'
            : ice
              ? '#79F8FF'
              : lava
                ? '#FF8735'
                : '#A18CFF';
    const radius = 24;
    if (cave) {
      const rows = Math.ceil((end - start) / 4),
        cols = 20;
      const pos: number[] = [],
        colors: number[] = [],
        indices: number[] = [];
      const color = new THREE.Color(rock);
      for (let row = 0; row <= rows; row++) {
        const s = start + (row / rows) * (end - start);
        for (let col = 0; col <= cols; col++) {
          const angle = (col / cols) * Math.PI;
          const irregular = radius + 1.3 * Math.sin(row * 1.7 + col * 2.3);
          const p = at(main, s, Math.cos(angle) * irregular, Math.sin(angle) * irregular * 0.82 - 1);
          pos.push(p.x, p.y, p.z);
          const shade = 0.8 + 0.22 * Math.sin(row * 1.7 + col * 2.3);
          colors.push(color.r * shade, color.g * shade, color.b * shade);
          if (row < rows && col < cols) {
            const a = row * (cols + 1) + col,
              b = a + cols + 1;
            const q0 = at(main, s, Math.cos(angle) * radius, Math.sin(angle) * radius * 0.82 - 1);
            if (!blocksRoad(q0.x, q0.z, q0.y - 3, q0.y + 3, 3, main))
              indices.push(a, b, a + 1, a + 1, b, b + 1);
          }
        }
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      g.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
      g.setIndex(indices);
      g.computeVertexNormals();
      const shell = new THREE.Mesh(g, toon({ vertexColors: true, side: THREE.DoubleSide, rim: 0.15 }));
      shell.name = 'exploration-cavern';
      shell.receiveShadow = true;
      out.add(shell);
    }
    for (let s = start; s <= end; s += 13) {
      for (const side of [-1, 1]) {
        const p = at(main, s, side * (cave ? 22 : 24), -1);
        const h = rng.range(7, 15);
        if (blocksRoad(p.x, p.z, p.y, p.y + h, 4, main)) continue;
        if (zone.kind === 'ruins') {
          solids.cyl(1.8, 2.4, h, '#9EAD9D', { p: [p.x, p.y + h / 2, p.z], outline: false }, 8);
          solids.box(5, 1.5, 5, '#BED0B5', { p: [p.x, p.y + h, p.z], outline: false }, 0.06, 1);
        } else {
          solids.cone(
            rng.range(2, 4),
            h,
            ice ? '#A7DFF0' : rock,
            { p: [p.x, p.y + h / 2, p.z], r: [0, rng.range(0, 6), side * 0.18], outline: false },
            5,
          );
          details.cone(
            0.65,
            h * 0.5,
            light,
            { p: [p.x + side * 1.5, p.y + h * 0.3, p.z], glow: 1.3, outline: false },
            5,
          );
          if (cave && Math.floor(s / 13) % 2 === 0) {
            const roof = at(main, s, side * 6, 18);
            if (blocksRoad(roof.x, roof.z, roof.y - 5, roof.y + 1, 1.8, main)) continue;
            solids.cone(
              1.3,
              5,
              rock,
              { p: [roof.x, roof.y - 2, roof.z], r: [Math.PI, 0, 0], outline: false },
              5,
            );
          }
        }
      }
    }
    for (const u of [0.18, 0.72]) {
      const p = at(main, start + (end - start) * u, 0, 10);
      const lamp = new THREE.PointLight(light, lava ? 30 : 45, 45, 1.2);
      lamp.position.copy(p);
      out.add(lamp);
    }
    const entrance = sign(
      ice ? '빙하 동굴' : lava ? '화산 심연' : zone.kind === 'ruins' ? '폭포 유적' : '수정 동굴',
      '탐험 구간',
      light,
      13,
    );
    entrance.position.copy(at(main, start - 9, 0, 9));
    entrance.rotation.y = main.headingAt(start) + Math.PI;
    out.add(entrance);
  }

  // Split directions are shown before each fork; multiple choices at the same junction
  // share one gantry so signs never overlap or hide one another.
  const forks = new Map<number, { label: string; side: number; height: number }[]>();
  def.shortcuts.forEach((branch, index) => {
    const s = branch.fromU * L,
      i = main.idxAtS(s),
      p = branch.via[0];
    const side = Math.sign((p[0] - main.px[i]) * main.hx[i] + (p[2] - main.pz[i]) * main.hz[i]);
    const choices = forks.get(branch.fromU) ?? [];
    choices.push({ label: branch.label ?? `탐험길 ${index + 1}`, side, height: Math.round(p[1]) });
    forks.set(branch.fromU, choices);
  });
  for (const [u, choices] of forks) {
    const s = u * L - 85;
    const label = choices.map((c) => `${c.side < 0 ? '↖' : '↗'} ${c.label}`).join('   ');
    const board = sign(
      label,
      `↑ 본선 계속  ·  갈림길 ${choices.length + 1}개`,
      '#D8FF66',
      choices.length > 1 ? 28 : 22,
    );
    board.position.copy(at(main, s, 0, 9));
    board.rotation.y = main.headingAt(s) + Math.PI;
    out.add(board);
  }

  for (const gap of def.gaps ?? []) {
    const board = sign('JUMP  >>>', '공중에서 Space / 드리프트 → 360° 트릭', '#FFE45B', 19);
    const s = gap.u0 * L - 35;
    board.position.copy(at(main, s, 0, 9));
    board.rotation.y = main.headingAt(s) + Math.PI;
    out.add(board);
  }
  const bends = Array.from({ length: main.n }, (_, i) => ({
    s: i * main.ds,
    turn: Math.abs(main.turnRight(i, 8)),
  })).sort((a, b) => b.turn - a.turn);
  const marked: number[] = [];
  for (const bend of bends) {
    if (marked.length >= 2) break;
    if (bend.s < L * 0.13 || bend.s > L * 0.86 || marked.some((s) => Math.abs(s - bend.s) < L * 0.18))
      continue;
    const s = bend.s - 32;
    const board = sign('급커브', '감속 후 드리프트로 부드럽게', '#FFC561', 15);
    board.position.copy(at(main, s, 0, 8));
    board.rotation.y = main.headingAt(s) + Math.PI;
    out.add(board);
    marked.push(bend.s);
  }
  for (const grade of def.grades ?? []) {
    const s = grade.u0 * L - 25;
    const board = sign('급경사', '오르막 너머 내리막 · 시야 확보', '#8CE8D4', 16);
    board.position.copy(at(main, s, 0, 8));
    board.rotation.y = main.headingAt(s) + Math.PI;
    out.add(board);
  }

  // Tall silhouettes give every biome a distinct skyline and make elevation legible.
  for (let j = 0; j < 12; j++) {
    const s = ((j + 0.4) / 12) * L,
      side = j % 2 ? -1 : 1;
    const p = at(main, s, side * rng.range(62, 110));
    if (
      paths.some((path) => {
        const i = path.idxAtS((s / L) * path.length);
        return Math.hypot(p.x - path.px[i], p.z - path.pz[i]) < 36;
      })
    )
      continue;
    const y = def.voidWorld ? p.y - rng.range(25, 45) : ground(p.x, p.z);
    const h = rng.range(40, 85);
    if (blocksRoad(p.x, p.z, y, y + h + 35, 36)) continue;
    if (def.theme === 'volcano') {
      solids.cyl(7, 34, h, '#4B3945', { p: [p.x, y + h / 2, p.z], outline: false }, 9);
      details.torus(7, 1.2, '#FF7230', {
        p: [p.x, y + h, p.z],
        r: [Math.PI / 2, 0, 0],
        glow: 2,
        outline: false,
      });
      details.cyl(6.5, 6.5, 0.3, '#FFB33D', { p: [p.x, y + h, p.z], glow: 2.3, outline: false }, 12);
      for (let k = 0; k < 4; k++)
        solids.sphere(
          4 + k * 2,
          '#6E5666',
          { p: [p.x + k * 2, y + h + 8 + k * 8, p.z], outline: false },
          8,
          6,
        );
    } else if (def.theme === 'icecream' || def.theme === 'cavern') {
      const color = def.theme === 'icecream' ? '#A9DEF4' : '#6F6596';
      solids.cone(
        rng.range(9, 19),
        h,
        color,
        { p: [p.x, y + h / 2, p.z], r: [0, j, side * 0.1], outline: false },
        5,
      );
      details.cone(
        3,
        h * 0.55,
        def.theme === 'icecream' ? '#A3FFFF' : '#BA9AFF',
        { p: [p.x + 9, y + h * 0.3, p.z], glow: 1.4, outline: false },
        5,
      );
    } else if (def.voidWorld || def.theme === 'candy') {
      solids.cyl(15, 5, 20, def.voidWorld ? '#AA8DBF' : '#B78871', { p: [p.x, y, p.z], outline: false }, 7);
      solids.sphere(
        16,
        def.voidWorld ? '#DCCBFF' : '#BAE494',
        { p: [p.x, y + 9, p.z], s: [1, 0.35, 1], outline: false },
        10,
        6,
      );
      details.torus(10, 0.25, '#FFECA3', { p: [p.x, y + 25, p.z], glow: 1.5, outline: false });
    } else if (def.theme !== 'neon') {
      solids.cyl(12, 23, h, '#819690', { p: [p.x, y + h / 2, p.z], outline: false }, 7);
      solids.sphere(15, '#8AB97B', { p: [p.x, y + h, p.z], s: [1, 0.3, 1], outline: false }, 8, 6);
      if (j % 3 === 0) {
        const fall = new THREE.Mesh(
          new THREE.PlaneGeometry(9, h * 0.85),
          new THREE.ShaderMaterial({
            transparent: true,
            side: THREE.DoubleSide,
            depthWrite: false,
            uniforms: { uTime: sharedTime },
            vertexShader:
              'varying vec2 vUv; void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',
            fragmentShader:
              'uniform float uTime; varying vec2 vUv; void main(){float s=sin(vUv.x*65.+sin(vUv.y*12.+uTime*8.))*0.08; float f=pow(sin(vUv.y*38.+uTime*10.)*.5+.5,9.)*.25; gl_FragColor=vec4(vec3(.32,.82,.92)+s+f,.72);}',
          }),
        );
        fall.position.set(p.x, y + h * 0.57, p.z + 13);
        fall.rotation.y = main.headingAt(s);
        out.add(fall);
      }
    }
  }
  out.add(solids.build({ outline: false }), details.build({ outline: false, castShadow: false }));
  return out;
}
