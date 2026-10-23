import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { ShortcutDef, SurfaceName, TrackDef } from '../data/tracks';
import { Proj, Surface, TrackPath, roadFrame, roundRoute, type Vec3T } from './path';
import { THEMES, type ThemeDef } from './themes';
import { glow, outlineMaterial, toon } from '../art/toon';
import { boostPadTexture, canvas, groundTexture, roadTexture, roundRect, tex } from '../art/textures';
import { buildProp } from '../art/props';
import { MeshBuilder } from '../art/builder';
import { Rng } from '../core/rng';
import { buildClouds, buildSky, buildWater } from '../art/sky';
import { buildDressing } from './dressing';
import { boostPadGeometry } from './boostPads';
import { buildAdventureWorld } from './adventureWorld';
import { roadClearance } from './roadClearance';
import { cavernGeometry, cavernMaterial } from './cavern';
import { backgroundRelief, buildLandscape, groundDetail, landscapeMaterial } from './landscape';

const SURF: Record<SurfaceName | 'road', Surface> = {
  road: Surface.Road,
  dirt: Surface.Dirt,
  ice: Surface.Ice,
  water: Surface.Water,
  choco: Surface.Choco,
  sand: Surface.Sand,
};
const SURF_COLOR: Partial<Record<SurfaceName, string>> = {
  dirt: '#E7C99A',
  ice: '#D9F1FF',
  choco: '#9B6A4F',
  sand: '#F4DDAA',
  water: '#9ED8F0',
};

export interface BoostPad {
  path: TrackPath;
  s: number;
  t: number;
  halfLen: number;
  halfWid: number;
}

export interface TrackWorld {
  def: TrackDef;
  theme: ThemeDef;
  main: TrackPath;
  shortcuts: TrackPath[];
  paths: TrackPath[];
  group: THREE.Group;
  pads: BoostPad[];
  centre: THREE.Vector3;
  radius: number;
  sky: THREE.Mesh;
  clouds: THREE.InstancedMesh;
  water: THREE.Mesh | null;
  padTex: THREE.Texture;
  chunks: { mesh: THREE.Object3D; outline: THREE.Object3D | null; centre: THREE.Vector3 }[];
  lowGravity: [number, number][];
  groundHeight: (x: number, z: number) => number;
  voidY: number;
}

export function buildPaths(def: TrackDef): { main: TrackPath; shortcuts: TrackPath[] } {
  const main = new TrackPath(def.points, true, def.width, null, def.shoulder ?? 6.5);
  const L = main.length;
  for (const grade of def.grades ?? [])
    main.rangeIdx(grade.u0, grade.u1, (i) => {
      const u = ((i * main.ds) / L - grade.u0) / (grade.u1 - grade.u0);
      main.py[i] += grade.h * Math.sin(Math.PI * u) ** 2;
    });
  if (def.grades?.length)
    for (let i = 0; i < main.n; i++) {
      const a = main.wrap(i - 1),
        b = main.wrap(i + 1);
      const dx = main.px[b] - main.px[a],
        dy = main.py[b] - main.py[a],
        dz = main.pz[b] - main.pz[a];
      const length = Math.hypot(dx, dy, dz) || 1;
      main.fx[i] = dx / length;
      main.fy[i] = dy / length;
      main.fz[i] = dz / length;
    }
  main.loops = (def.loops ?? []).map((l) => ({ s0: l.u0 * L, s1: l.u1 * L, radius: l.radius }));
  for (const loop of main.loops)
    main.rangeIdx(loop.s0 / L, loop.s1 / L, (i) => {
      main.bankTan[i] = 0;
    });
  for (const nw of def.noWall ?? []) {
    main.rangeIdx(nw.u0, nw.u1, (i) => {
      if (nw.side !== 'R') main.wallL[i] = 0;
      if (nw.side !== 'L') main.wallR[i] = 0;
      if (nw.side !== 'R') main.shoulderL[i] = 1.5;
      if (nw.side !== 'L') main.shoulderR[i] = 1.5;
    });
  }
  for (const g of def.gaps ?? []) main.rangeIdx(g.u0, g.u1, (i) => (main.gap[i] = 1));
  for (const r of def.ramps) {
    main.ramps.push({ s0: r.u * L - r.len, s1: r.u * L, t0: r.t0 ?? -6, t1: r.t1 ?? 6, h: r.h, trick: true });
  }
  for (const z of def.zones) {
    main.zones.push({ s0: z.u0 * L, s1: z.u1 * L, t0: z.t0, t1: z.t1, surface: SURF[z.surface] });
  }
  const shortcuts = def.shortcuts.map((sc) => buildShortcut(main, sc));
  // open the main walls where a shortcut leaves/joins (visual + physics handled by ribbon union)
  return { main, shortcuts };
}

function buildShortcut(main: TrackPath, sc: ShortcutDef): TrackPath {
  const L = main.length;
  const a = new THREE.Vector3();
  const b = new THREE.Vector3();
  main.pointAt(sc.fromU * L, 0, a);
  main.pointAt(sc.toU * L, 0, b);
  // Long tangent overlaps prevent tight hooks and folded ribbon edges at joins.
  const overlap = 90;
  const a0 = new THREE.Vector3();
  const b1 = new THREE.Vector3();
  main.pointAt(sc.fromU * L - overlap, 0, a0);
  main.pointAt(sc.toU * L + overlap, 0, b1);
  const via = sc.via.map(([x, y, z], i): Vec3T => {
    const k = (i + 1) / (sc.via.length + 1);
    return [x, y || a.y + (b.y - a.y) * k, z];
  });
  const pts: Vec3T[] = [[a0.x, a0.y, a0.z], [a.x, a.y, a.z], ...via,
    [b.x, b.y, b.z], [b1.x, b1.y, b1.z]];
  const rounded = roundRoute(pts, false);
  const p = new TrackPath(
    rounded,
    false,
    sc.width,
    rounded.map(() => 0),
    1.2,
  );
  p.mainS0 = sc.fromU * L - overlap;
  p.mainS1 = sc.toU * L + overlap;
  // Match the main road plane at both mouths, easing back to a flat shortcut.
  const join = new Proj();
  for (let i = 0; i < p.n; i++) {
    const distance = Math.min(i * p.ds, p.length - i * p.ds);
    const endInfluence =
      1 - THREE.MathUtils.smoothstep(distance, Math.min(360, p.length * 0.45), Math.min(480, p.length * 0.5));
    if (endInfluence <= 0) continue;
    const joinHint = main.idxAtS(i * p.ds < p.length / 2 ? p.mainS0 + distance : p.mainS1 - distance);
    main.project(p.px[i], main.py[joinHint], p.pz[i], joinHint, join, 160, 3, false);
    // Keep the ENTIRE shared junction in one plane. A branch only climbs after its
    // full width clears the main road; otherwise its deck/railing cuts through traffic.
    const sharedWidth = join.halfW + p.halfW[i] + p.shoulderL[i] + 4;
    const lateralBlend = 1 - THREE.MathUtils.smoothstep(Math.abs(join.t), sharedWidth, sharedWidth + 24);
    const blend = Math.max(1 - THREE.MathUtils.smoothstep(distance, 0, overlap), lateralBlend * endInfluence);
    p.py[i] += (join.y - p.py[i]) * blend;
    if (blend > 0.999)
      for (let pass = 0; pass < 3; pass++) {
        main.project(p.px[i], p.py[i], p.pz[i], join.idx, join, 4, 3, false);
        p.py[i] = join.y;
      }
    const h = Math.hypot(join.fx, join.fz) || 1;
    const gx = ((join.fx / h) * join.fy) / h + join.hx * join.bankTan;
    const gz = ((join.fz / h) * join.fy) / h + join.hz * join.bankTan;
    p.bankTan[i] = (gx * p.hx[i] + gz * p.hz[i]) * blend;
  }
  for (let i = 0; i < p.n; i++) {
    const a = p.wrap(i - 1), b = p.wrap(i + 1);
    const dx = p.px[b] - p.px[a], dy = p.py[b] - p.py[a], dz = p.pz[b] - p.pz[a];
    const length = Math.hypot(dx, dy, dz) || 1;
    p.fx[i] = dx / length;
    p.fy[i] = dy / length;
    p.fz[i] = dz / length;
  }
  p.baseSurface = SURF[sc.surface];
  // Narrow the inside of a branch hairpin smoothly rather than folding a wide ribbon.
  const safeWidths = new Float32Array(p.n);
  for (let i = 0; i < p.n; i++)
    safeWidths[i] = Math.min(sc.width / 2, Math.max(3.6, 0.6 / Math.max(0.001, Math.abs(p.turnRight(i, 2)))));
  for (let i = 0; i < p.n; i++) {
    let width = safeWidths[i];
    for (let j = -10; j <= 10; j++) width = Math.min(width, safeWidths[p.wrap(i + j)] + Math.abs(j) * 0.08);
    p.halfW[i] = width;
  }
  p.loops = (sc.loops ?? []).map((l) => ({ s0: l.u0 * p.length, s1: l.u1 * p.length, radius: l.radius }));
  // Preserve physical stationing at the common ribbons. A single linear mapping
  // across a short cut used to jump the ranking/progress backwards at its merge.
  p.mainProgress = new Float32Array(p.n);
  let leave = 0, enter = p.n - 1;
  for (const side of [0, 1]) {
    for (let n = 0; n < p.n / 2; n++) {
      const i = side ? p.n - 1 - n : n;
      const distance = n * p.ds;
      const expected = side ? p.mainS1 - distance : p.mainS0 + distance;
      main.project(p.px[i], p.py[i], p.pz[i], main.idxAtS(expected), join, 100, 3, false);
      if (Math.abs(join.t) > join.halfW + p.halfW[i] + 8 || Math.abs(join.y - p.py[i]) > .5) break;
      p.mainProgress[i] = join.s;
      if (side) enter = i; else leave = i;
    }
  }
  const startS = p.mainProgress[leave], endS = p.mainProgress[enter];
  for (let i = leave + 1; i < enter; i++) p.mainProgress[i] = startS + (endS - startS) * (i - leave) / (enter - leave);
  return p;
}

// ---------------------------------------------------------------------------------------------
// Geometry helpers
// ---------------------------------------------------------------------------------------------

/** Ribbon between lateral offsets tA..tB. */
function ribbon(
  path: TrackPath,
  tA: (i: number) => number,
  tB: (i: number) => number,
  yOff: number,
  opts: {
    uvScale?: number;
    skipGap?: boolean;
    include?: (i: number) => boolean;
    color?: (i: number, side: 0 | 1) => THREE.Color | null;
    range?: [number, number];
  } = {},
): THREE.BufferGeometry | null {
  const pos: number[] = [];
  const uv: number[] = [];
  const col: number[] = [];
  const idx: number[] = [];
  const n = path.n;
  const segCount = path.closed ? n : n - 1;
  let vi = 0;
  let prevValid = false;
  const uvS = opts.uvScale ?? 1 / 24;
  const [r0, r1] = opts.range ?? [0, segCount];
  const vertex = new THREE.Vector3();
  for (let k = r0; k <= r1; k++) {
    const i = path.wrap(k);
    const valid = !(opts.skipGap && path.gap[i]) && (!opts.include || opts.include(i));
    if (valid) {
      for (const side of [0, 1] as const) {
        const t = side === 0 ? tA(i) : tB(i);
        path.pointAt(i * path.ds, t, vertex, yOff);
        pos.push(vertex.x, vertex.y, vertex.z);
        uv.push(k * path.ds * uvS, side);
        if (opts.color) {
          const c = opts.color(i, side) ?? new THREE.Color(1, 1, 1);
          col.push(c.r, c.g, c.b);
        }
      }
      if (prevValid) {
        const a = vi - 2;
        idx.push(a, a + 1, vi, a + 1, vi + 1, vi);
      }
      vi += 2;
    }
    prevValid = valid;
  }
  if (!idx.length) return null;
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  if (opts.color) g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

/** Extrude a 2D profile (lateral outward, up) along a path edge. Non-indexed segments for crisp stripes. */
function edgeExtrude(
  path: TrackPath,
  side: 1 | -1,
  profile: [number, number][],
  include: (i: number) => boolean,
  colorAt: (s: number) => string,
  base: (i: number) => number,
): { solid: THREE.BufferGeometry; hull: THREE.BufferGeometry } | null {
  const n = path.n;
  const segCount = path.closed ? n : n - 1;
  // profile normals (2D)
  const pn: [number, number][] = profile.map((_, j) => {
    const a = profile[Math.max(0, j - 1)];
    const b = profile[Math.min(profile.length - 1, j + 1)];
    const dx = b[0] - a[0];
    const dy = b[1] - a[1];
    const l = Math.hypot(dx, dy) || 1;
    return [-dy / l, dx / l];
  });
  const pos: number[] = [];
  const nor: number[] = [];
  const col: number[] = [];
  const hpos: number[] = [];
  const hnor: number[] = [];
  const hidx: number[] = [];
  const c = new THREE.Color();
  const vertex = new THREE.Vector3();
  const frame = roadFrame();
  const ring = (i: number, out: number[], outN: number[]) => {
    const t0 = base(i) * side;
    for (let j = 0; j < profile.length; j++) {
      const [o, h] = profile[j];
      const t = t0 + o * side;
      path.pointAt(i * path.ds, t, vertex, h);
      out.push(vertex.x, vertex.y, vertex.z);
      const [nx, ny] = pn[j];
      path.frameAt(i * path.ds, frame);
      outN.push(frame.hx * nx * side + frame.ux * ny, frame.uy * ny, frame.hz * nx * side + frame.uz * ny);
    }
  };
  const P = profile.length;
  let hullRings = 0;
  let hullFlip: boolean | null = null;
  let prevIn = false;
  for (let k = 0; k < segCount; k++) {
    const i0 = path.wrap(k);
    const i1 = path.wrap(k + 1);
    const inc = include(i0) && include(i1);
    if (!inc) {
      prevIn = false;
      continue;
    }
    const r0: number[] = [];
    const n0: number[] = [];
    const r1: number[] = [];
    const n1: number[] = [];
    ring(i0, r0, n0);
    ring(i1, r1, n1);
    c.set(colorAt(k * path.ds));
    for (let j = 0; j < P - 1; j++) {
      const quad = [
        [r0, n0, j],
        [r1, n1, j],
        [r0, n0, j + 1],
        [r0, n0, j + 1],
        [r1, n1, j],
        [r1, n1, j + 1],
      ] as const;
      for (let q = 0; q < 6; q += 3) {
        // orient each triangle so its geometric normal agrees with the profile normal
        const tri = [quad[q], quad[q + 1], quad[q + 2]];
        const P0 = tri.map(([r, , jj]) => [r[jj * 3], r[jj * 3 + 1], r[jj * 3 + 2]]);
        const ax = P0[1][0] - P0[0][0],
          ay = P0[1][1] - P0[0][1],
          az = P0[1][2] - P0[0][2];
        const bx = P0[2][0] - P0[0][0],
          by = P0[2][1] - P0[0][1],
          bz = P0[2][2] - P0[0][2];
        const gx = ay * bz - az * by,
          gy = az * bx - ax * bz,
          gz = ax * by - ay * bx;
        const [, n0q, j0q] = tri[0];
        const d = gx * n0q[j0q * 3] + gy * n0q[j0q * 3 + 1] + gz * n0q[j0q * 3 + 2];
        if (d < 0) [tri[1], tri[2]] = [tri[2], tri[1]];
        if (hullFlip === null) hullFlip = d < 0;
        for (const [r, nn, jj] of tri) {
          pos.push(r[jj * 3], r[jj * 3 + 1], r[jj * 3 + 2]);
          nor.push(nn[jj * 3], nn[jj * 3 + 1], nn[jj * 3 + 2]);
          col.push(c.r, c.g, c.b);
        }
      }
    }
    // hull rings (indexed, shared)
    if (!prevIn) {
      hpos.push(...r0);
      hnor.push(...n0);
      hullRings++;
    }
    hpos.push(...r1);
    hnor.push(...n1);
    const a = (hullRings - 1) * P;
    const b = hullRings * P;
    for (let j = 0; j < P - 1; j++) {
      if (hullFlip) hidx.push(a + j, a + j + 1, b + j, a + j + 1, b + j + 1, b + j);
      else hidx.push(a + j, b + j, a + j + 1, a + j + 1, b + j, b + j + 1);
    }
    hullRings++;
    prevIn = true;
  }
  if (!pos.length) return null;
  const solid = new THREE.BufferGeometry();
  solid.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  solid.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  solid.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  const hull = new THREE.BufferGeometry();
  hull.setAttribute('position', new THREE.Float32BufferAttribute(hpos, 3));
  hull.setAttribute('normal', new THREE.Float32BufferAttribute(hnor, 3));
  hull.setAttribute('color', new THREE.Float32BufferAttribute(new Float32Array(hpos.length).fill(0.85), 3));
  hull.setIndex(hidx);
  return { solid, hull };
}

const WALL_PROFILES: Record<ThemeDef['wall']['style'], [number, number][]> = {
  candy: [
    [0, -0.6],
    [0.05, 0.3],
    [0.15, 0.75],
    [0.45, 0.95],
    [0.75, 0.75],
    [0.85, 0.3],
    [0.9, -0.6],
  ],
  fence: [
    [0, -0.6],
    [0, 0.9],
    [0.1, 1.05],
    [0.25, 1.05],
    [0.35, 0.9],
    [0.35, -0.6],
  ],
  neon: [
    [0, -0.6],
    [0, 0.95],
    [0.15, 1.1],
    [0.55, 1.1],
    [0.7, 0.95],
    [0.7, -0.6],
  ],
  stone: [
    [0, -0.6],
    [0.05, 1.1],
    [0.25, 1.35],
    [0.8, 1.35],
    [1.0, 1.1],
    [1.05, -0.6],
  ],
  barrier: [
    [0, -0.6],
    [0.0, 0.25],
    [0.25, 0.5],
    [0.32, 1.05],
    [0.6, 1.05],
    [0.67, 0.5],
    [0.92, 0.25],
    [0.92, -0.6],
  ],
  snow: [
    [0, -0.6],
    [0.1, 0.5],
    [0.4, 0.95],
    [0.9, 1.05],
    [1.4, 0.8],
    [1.7, 0.2],
    [1.8, -0.6],
  ],
  basalt: [
    [0, -0.6],
    [0.05, 0.8],
    [0.2, 1.0],
    [0.7, 1.0],
    [0.9, 0.8],
    [0.95, -0.6],
  ],
  cloud: [
    [0, -0.6],
    [0.2, 0.55],
    [0.6, 0.85],
    [1.1, 0.7],
    [1.4, 0.2],
    [1.5, -0.6],
  ],
};

// ---------------------------------------------------------------------------------------------

export function buildTrackWorld(def: TrackDef, quality: { props: number; outlines: boolean }): TrackWorld {
  const theme = THEMES[def.theme];
  const { main, shortcuts } = buildPaths(def);
  const paths = [main, ...shortcuts];
  const blocksRoad = roadClearance(paths);
  const group = new THREE.Group();
  group.name = 'track';
  const rng = new Rng(def.id);
  const L = main.length;

  // bounds
  const bb = new THREE.Box3();
  for (let i = 0; i < main.n; i++) bb.expandByPoint(new THREE.Vector3(main.px[i], main.py[i], main.pz[i]));
  const centre = bb.getCenter(new THREE.Vector3());
  const radius = Math.max(bb.max.x - bb.min.x, bb.max.z - bb.min.z) / 2 + 40;
  let minY = Infinity;
  for (let i = 0; i < main.n; i++) minY = Math.min(minY, main.py[i]);

  // ---------- road ----------
  const roadTex = roadTexture(theme.road, def.no);
  const roadMat = toon({ map: roadTex, rim: 0.2 });
  // Open curb/edge markings where another road joins instead of drawing a stripe across it.
  const edgeMasks = new Map<TrackPath, Map<number, Uint8Array>>();
  const edgeVisible = (path: TrackPath, i: number, side: number, offset = 0.5) => {
    let sides = edgeMasks.get(path);
    if (!sides) edgeMasks.set(path, (sides = new Map()));
    const key = side * (100 + offset * 10);
    let mask = sides.get(key);
    if (!mask) sides.set(key, (mask = new Uint8Array(path.n)));
    if (mask[i]) return mask[i] === 1;
    const t = side * (path.halfW[i] + offset);
    const x = path.px[i] + path.hx[i] * t;
    const z = path.pz[i] + path.hz[i] * t;
    const y = path.py[i] + t * path.bankTan[i];
    for (const other of paths) {
      if (other === path) continue;
      other.project(x, y, z, -1, tmpProj);
      if (!tmpProj.gap && tmpProj.dist2 < (tmpProj.halfW + 0.8) ** 2 && Math.abs(tmpProj.y - y) < 1.2) {
        mask[i] = 2;
        return false;
      }
    }
    mask[i] = 1;
    return true;
  };
  for (const p of paths) {
    const isMain = p === main;
    const surfCol = !isMain && p.baseSurface !== Surface.Road ? surfaceColor(p.baseSurface) : null;
    const g = ribbon(
      p,
      (i) => -p.halfW[i],
      (i) => p.halfW[i],
      0.0 + (isMain ? 0 : 0.02),
      { skipGap: true },
    );
    if (!g) continue;
    let mat: THREE.Material = roadMat;
    if (surfCol) {
      const [c, g2] = canvas(128, 128);
      g2.fillStyle = surfCol;
      g2.fillRect(0, 0, 128, 128);
      const r2 = new Rng(3);
      for (let i = 0; i < 300; i++) {
        g2.fillStyle = `rgba(255,255,255,${r2.range(0.05, 0.25)})`;
        g2.fillRect(r2.range(0, 128), r2.range(0, 128), 3, 3);
        g2.fillStyle = `rgba(120,80,60,${r2.range(0.03, 0.12)})`;
        g2.fillRect(r2.range(0, 128), r2.range(0, 128), 3, 3);
      }
      const tx = tex(c, true);
      tx.repeat.set(1, 1);
      mat = toon({ map: tx, rim: 0.2 });
    }
    const m = new THREE.Mesh(g, mat);
    m.receiveShadow = true;
    m.name = 'road';
    group.add(m);
  }

  // zones painted on road (ice/choco/sand) as overlay ribbons
  for (const z of def.zones) {
    const colStr = SURF_COLOR[z.surface] ?? '#ffffff';
    const s0 = z.u0 * L;
    const s1 = z.u1 * L;
    const g = ribbon(
      main,
      (i) => Math.max(-main.halfW[i] - main.shoulderL[i], z.t0),
      (i) => Math.min(main.halfW[i] + main.shoulderR[i], z.t1),
      0.035,
      { range: [Math.floor(s0 / main.ds), Math.floor(s1 / main.ds)], skipGap: true },
    );
    if (!g) continue;
    const mat =
      z.surface === 'ice'
        ? new THREE.MeshToonMaterial({
            color: colStr,
            gradientMap: (roadMat as THREE.MeshToonMaterial).gradientMap,
            transparent: true,
            opacity: 0.85,
            emissive: '#5a7a9a',
            emissiveIntensity: 0.15,
          })
        : toon({ color: colStr, rim: 0.3 });
    const m = new THREE.Mesh(g, mat);
    m.receiveShadow = true;
    group.add(m);
  }

  // ---------- curbs ----------
  const curbA = new THREE.Color(theme.curb[0]);
  const curbB = new THREE.Color(theme.curb[1]);
  for (const p of paths) {
    const cw = p === main ? 1.3 : 0.7;
    for (const side of [-1, 1]) {
      const g = ribbon(
        p,
        (i) => (side < 0 ? -p.halfW[i] - cw : p.halfW[i]),
        (i) => (side < 0 ? -p.halfW[i] : p.halfW[i] + cw),
        0.04,
        {
          skipGap: true,
          include: (i) => edgeVisible(p, i, side),
          color: (i) => (Math.floor((i * p.ds) / 3) % 2 ? curbA : curbB),
        },
      );
      if (!g) continue;
      const m = new THREE.Mesh(g, toon({ vertexColors: true, rim: 0.3 }));
      m.receiveShadow = true;
      m.name = 'curb';
      group.add(m);
      // A dark keyline and bright inset stay legible on grass, snow and night scenery.
      for (const [width, inset, color, lift] of [
        [0.55, 0.15, '#293445', 0.045],
        [0.22, 0.3, theme.road.edge, 0.055],
      ] as const) {
        const marking = ribbon(
          p,
          (i) => side * (p.halfW[i] - inset) - width / 2,
          (i) => side * (p.halfW[i] - inset) + width / 2,
          lift,
          { skipGap: true, include: (i) => edgeVisible(p, i, side) },
        );
        if (marking) {
          const line = new THREE.Mesh(marking, new THREE.MeshBasicMaterial({ color }));
          line.name = 'road-edge';
          group.add(line);
        }
      }
    }
  }
  if (theme.road.glowEdge) {
    for (const side of [-1, 1]) {
      const g = ribbon(
        main,
        (i) => side * main.halfW[i] - 0.25,
        (i) => side * main.halfW[i] + 0.25,
        0.06,
        { skipGap: true },
      );
      if (g) group.add(new THREE.Mesh(g, glow(theme.road.glowEdge, 1.8)));
    }
  }

  // ---------- shoulders ----------
  const shoulderTex = groundTexture(def.no + 10);
  const shoulderMat = toon({ color: theme.shoulder, map: shoulderTex, rim: 0.1 });
  for (const p of paths) {
    for (const side of [-1, 1]) {
      const g = ribbon(
        p,
        (i) => (side < 0 ? -p.halfW[i] - p.shoulderL[i] - 1.5 : p.halfW[i] + 1.0),
        (i) => (side < 0 ? -p.halfW[i] - 1.0 : p.halfW[i] + p.shoulderR[i] + 1.5),
        -0.02,
        {
          skipGap: true,
          uvScale: 1 / 8,
          include: (i) =>
            edgeVisible(p, i, side, 0.5) && edgeVisible(p, i, side, 3.5) && edgeVisible(p, i, side, 6),
        },
      );
      if (!g) continue;
      const m = new THREE.Mesh(g, shoulderMat);
      m.receiveShadow = true;
      group.add(m);
    }
  }

  // ---------- walls ----------
  const insideShortcut = (x: number, y: number, z: number) => {
    for (const sp of shortcuts) {
      for (let i = 0; i < sp.n; i += 1) {
        const dx = x - sp.px[i];
        const dz = z - sp.pz[i];
        const lim = sp.halfW[i] + sp.shoulderL[i] + 1.5;
        if (dx * dx + dz * dz < lim * lim && Math.abs(y - sp.py[i]) < 3) return true;
      }
    }
    return false;
  };
  const prof = WALL_PROFILES[theme.wall.style];
  const wallBits: { solid: THREE.BufferGeometry; hull: THREE.BufferGeometry }[] = [];
  for (const p of paths) {
    for (const side of [-1, 1] as const) {
      const flags = side < 0 ? p.wallL : p.wallR;
      const visible = new Uint8Array(p.n);
      for (let i = 0; i < p.n; i++) {
        if (!flags[i] || p.gap[i]) continue;
        const lim = side < 0 ? p.halfW[i] + p.shoulderL[i] : p.halfW[i] + p.shoulderR[i];
        const x = p.px[i] + p.hx[i] * lim * side;
        const z = p.pz[i] + p.hz[i] * lim * side;
        if (p === main && insideShortcut(x, p.py[i] + lim * side * p.bankTan[i], z)) continue;
        if (p !== main) {
          // shortcut walls: fade out near both joins
          const s = i * p.ds;
          if (s < 14 || s > p.length - 14) continue;
          // also skip where it sits on the main road
          const mp = main.project(x, p.py[i], z, -1, tmpProj);
          if (Math.abs(mp.t) < mp.limitL + 0.5 && Math.abs(mp.y - p.py[i]) < 3) continue;
        }
        visible[i] = 1;
      }
      const stripe =
        theme.wall.style === 'candy' || theme.wall.style === 'barrier' || theme.wall.style === 'neon';
      const res = edgeExtrude(
        p,
        side,
        p === main ? prof : WALL_PROFILES.fence,
        (i) => visible[i] === 1,
        (s) =>
          stripe
            ? Math.floor(s / 2.5) % 2
              ? theme.wall.a
              : theme.wall.b
            : Math.floor(s / 6) % 2
              ? theme.wall.a
              : theme.wall.b,
        (i) => (side < 0 ? p.halfW[i] + p.shoulderL[i] : p.halfW[i] + p.shoulderR[i]),
      );
      if (res) wallBits.push(res);
    }
  }
  if (wallBits.length) {
    const solid = mergeGeometries(wallBits.map((w) => w.solid));
    const wm = new THREE.Mesh(solid, toon({ vertexColors: true }));
    wm.castShadow = true;
    wm.receiveShadow = true;
    group.add(wm);
    if (quality.outlines) {
      const hull = mergeGeometries(wallBits.map((w) => w.hull));
      group.add(
        new THREE.Mesh(hull, outlineMaterial(theme.wall.style === 'neon' ? '#2c2450' : undefined, 0.8)),
      );
    }
    if (theme.wall.style === 'neon') {
      // glowing top strip
      for (const side of [-1, 1] as const) {
        const res = edgeExtrude(
          main,
          side,
          [
            [0.15, 1.12],
            [0.55, 1.12],
          ],
          (i) => main.wallL[i] === 1 && main.wallR[i] === 1,
          () => theme.wall.b,
          (i) => main.halfW[i] + main.shoulderL[i],
        );
        if (res) group.add(new THREE.Mesh(res.solid, glow(theme.wall.b, 2.2, false)));
      }
    }
  }

  // ---------- terrain / ground ----------
  const nearest = makeNearest(paths);
  const lowSides = (i: number, side: number) => (side < 0 ? main.wallL[i] === 0 : main.wallR[i] === 0);
  const bridgeRanges = (def.bridge ?? []).map((b) => [b.u0 * L, b.u1 * L] as [number, number]);
  const inBridge = (s: number) => bridgeRanges.some(([a, b]) => s >= a && s <= b);
  const waterY = def.water?.y ?? -100;
  const lowY = def.water ? waterY - 4 : minY - 30;
  const hills = (x: number, z: number) => backgroundRelief(def.theme, x, z);
  let groundHeight = (x: number, z: number): number => {
    const nr = nearest(x, z);
    const p = nr.path;
    const i = nr.i;
    // Terrain must clear the LOWER banked shoulder, not just the road centre.
    const outer = p.halfW[i] + Math.max(p.shoulderL[i], p.shoulderR[i]) + 1.5;
    const roadY = p.py[i] - Math.abs(p.bankTan[i]) * outer;
    const d = nr.d - (p.halfW[i] + Math.max(p.shoulderL[i], p.shoulderR[i]));
    let h: number;
    const sideLow = p === main && (lowSides(i, nr.side) || inBridge(i * p.ds) || p.gap[i] === 1);
    if (def.voidWorld) return -999;
    if (sideLow) {
      h = THREE.MathUtils.lerp(roadY - 0.8, lowY, THREE.MathUtils.smoothstep(d, -2, 6));
    } else {
      const natural = minY - 0.5 + hills(x, z) * THREE.MathUtils.smoothstep(d, 30, 160);
      h = THREE.MathUtils.lerp(roadY - 0.7, natural, THREE.MathUtils.smoothstep(d, 2, 40));
      if (def.water?.area === 'all' && d > 70)
        h = THREE.MathUtils.lerp(h, lowY, THREE.MathUtils.smoothstep(d, 70, 110));
      if (def.water?.area === 'side' && def.theme === 'hangang') {
        // the Han river runs along the north edge of the park
        const riverZ = 175 * 1.35;
        if (z > riverZ) h = THREE.MathUtils.lerp(h, lowY, THREE.MathUtils.smoothstep(z, riverZ, riverZ + 14));
      }
    }
    // A bridge must span an actual valley; keeping terrain at road-centre height
    // underneath it made the former decks read as solid, vertical mesas.
    if (p === main && d < 85) {
      for (const [a, b] of bridgeRanges) {
        const s = i * p.ds;
        if (s >= a && s <= b) {
          const blend =
            THREE.MathUtils.smoothstep(s, a, a + 18) * (1 - THREE.MathUtils.smoothstep(s, b - 18, b));
          h = Math.min(h, THREE.MathUtils.lerp(h, lowY, blend));
        }
      }
    }
    return h;
  };
  let water: THREE.Mesh | null = null;
  if (!def.voidWorld) {
    const size = radius * 2 + 900;
    const res = quality.props < .7 ? 200 : quality.props < 1 ? 256 : 320;
    const g = new THREE.PlaneGeometry(size, size, res, res).rotateX(-Math.PI / 2);
    const pos = g.attributes.position as THREE.BufferAttribute;
    const cols = new Float32Array(pos.count * 3);
    const c0 = new THREE.Color(theme.ground[0]);
    const c1 = new THREE.Color(theme.ground[1]);
    const c2 = new THREE.Color(theme.ground[2]);
    const sandC = new THREE.Color('#FFEFC7');
    const tmp = new THREE.Color();
    for (let k = 0; k < pos.count; k++) {
      const x = pos.getX(k) + centre.x;
      const z = pos.getZ(k) + centre.z;
      const h = groundHeight(x, z);
      pos.setXYZ(k, x, h, z);
      const nz = Math.sin(x * 0.05) * Math.cos(z * 0.043) + Math.sin(x * 0.13 + z * 0.11) * 0.5;
      tmp.copy(c0).lerp(c1, THREE.MathUtils.smoothstep(nz, -0.4, 0.6));
      if (Math.sin(x * 0.021 + 2) * Math.sin(z * 0.017) > 0.55) tmp.lerp(c2, 0.6);
      if (def.water && h < waterY + 1.6)
        tmp.lerp(sandC, THREE.MathUtils.smoothstep(h, waterY + 1.6, waterY + 0.2));
      cols.set([tmp.r, tmp.g, tmp.b], k * 3);
    }
    // Each terrain triangle spans several metres. Lower every vertex of cells touching
    // a road corridor so coarse terrain cannot interpolate up through banked turns/hills.
    const spacing = size / res;
    const margin = Math.SQRT2 * spacing;
    for (const p of paths) {
      for (let i = 0; i < p.n; i += 2) {
        const reach = p.halfW[i] + Math.max(p.shoulderL[i], p.shoulderR[i]) + margin;
        const cap = p.py[i] - Math.abs(p.bankTan[i]) * (reach - margin + 1.5) - 1.0;
        const cx = p.px[i],
          cz = p.pz[i];
        const ix = Math.round((cx - centre.x + size / 2) / spacing);
        const iz = Math.round((cz - centre.z + size / 2) / spacing);
        const cells = Math.ceil(reach / spacing);
        for (let row = Math.max(0, iz - cells); row <= Math.min(res, iz + cells); row++) {
          for (let col = Math.max(0, ix - cells); col <= Math.min(res, ix + cells); col++) {
            const k = row * (res + 1) + col;
            if ((pos.getX(k) - cx) ** 2 + (pos.getZ(k) - cz) ** 2 <= reach * reach) {
              pos.setY(k, Math.min(pos.getY(k), cap));
            }
          }
        }
      }
    }
    g.setAttribute('color', new THREE.BufferAttribute(cols, 3));
    g.computeVertexNormals();
    // Exposed slopes show mineral colour; flatter ground retains soil/snow/vegetation.
    const normals = g.attributes.normal;
    const mineral = new THREE.Color(
      ['icecream', 'antarctic'].includes(def.theme) ? '#819EAF' :
      ['desert', 'canyon', 'volcano'].includes(def.theme) ? '#9B7866' : '#758176');
    for (let k = 0; k < pos.count; k++) {
      const slope = THREE.MathUtils.smoothstep(1 - normals.getY(k), .12, .65) * .6;
      tmp.fromArray(cols, k * 3).lerp(mineral, slope);
      cols.set([tmp.r, tmp.g, tmp.b], k * 3);
    }
    const gt = groundTexture(def.no);
    gt.repeat.set(size / 24, size / 24);
    const groundMat = landscapeMaterial(def.theme, gt);
    const detail = groundDetail(def.theme, def.no);
    detail.repeat.set(size / 16, size / 16);
    groundMat.bumpMap = detail;
    groundMat.bumpScale = ['icecream', 'antarctic'].includes(def.theme) ? .12 : .24;
    const ground = new THREE.Mesh(g, groundMat);
    ground.receiveShadow = true;
    ground.name = 'ground';
    group.add(ground);
    // Props and road verges must sit on the final triangles, including clearance cuts.
    groundHeight = (x, z) => {
      const gx = THREE.MathUtils.clamp((x - centre.x + size / 2) / spacing, 0, res - 0.00001);
      const gz = THREE.MathUtils.clamp((z - centre.z + size / 2) / spacing, 0, res - 0.00001);
      const col = Math.floor(gx),
        row = Math.floor(gz);
      const u = gx - col,
        v = gz - row;
      const a = row * (res + 1) + col,
        b = a + res + 1,
        d = a + 1,
        c = b + 1;
      return u + v <= 1
        ? pos.getY(a) + u * (pos.getY(d) - pos.getY(a)) + v * (pos.getY(b) - pos.getY(a))
        : pos.getY(c) + (1 - u) * (pos.getY(b) - pos.getY(c)) + (1 - v) * (pos.getY(d) - pos.getY(c));
    };
    if (def.water) {
      water = buildWater(def.water.color, size, waterY, centre, theme, def.theme === 'volcano');
      group.add(water);
    }
  } else {
    // cloud sea far below
    const cloudSea = new THREE.Mesh(
      new THREE.PlaneGeometry(4000, 4000).rotateX(-Math.PI / 2),
      new THREE.MeshBasicMaterial({ color: '#FFF4FD', fog: true }),
    );
    cloudSea.position.set(centre.x, minY - 60, centre.z);
    group.add(cloudSea);
  }

  // Shallow deck edges on EVERY elevated road. Extending a branch skirt to the
  // terrain below created giant shoulder-coloured curtains across the lower road.
  const vergeMat = toon({
    color: new THREE.Color(theme.shoulder).multiplyScalar(0.72),
    rim: 0.1,
    side: THREE.DoubleSide,
  });
  for (const path of paths) {
    for (const side of [-1, 1]) {
      const g = ribbon(
        path,
        (i) => side * (path.halfW[i] + (side < 0 ? path.shoulderL[i] : path.shoulderR[i]) + 1.5),
        (i) => side * (path.halfW[i] + (side < 0 ? path.shoulderL[i] : path.shoulderR[i]) + 3.2),
        -0.025,
        {
          skipGap: true,
          include: (i) => {
            if (path.loopAt(i * path.ds) || !edgeVisible(path, i, side, 5) || !edgeVisible(path, i, side, 8)) return false;
            const t = side * (path.halfW[i] + (side < 0 ? path.shoulderL[i] : path.shoulderR[i]) + 2.4);
            const edge = path.pointAt(i * path.ds, t, new THREE.Vector3(), -0.025);
            return !blocksRoad(edge.x, edge.z, edge.y - 1.6, edge.y + 0.1, 1.2, path);
          },
        },
      );
      if (!g) continue;
      const pos = g.attributes.position as THREE.BufferAttribute;
      for (let v = 1; v < pos.count; v += 2) {
        const topY = pos.getY(v - 1);
        const bridge =
          def.voidWorld || path !== main ||
          (path === main && inBridge(path.project(pos.getX(v), topY, pos.getZ(v), -1, tmpProj).s));
        pos.setY(
          v,
          bridge ? topY - 1.6 : Math.max(topY - 1.6, Math.min(topY - 0.25, groundHeight(pos.getX(v), pos.getZ(v)) - 0.08)),
        );
      }
      g.computeVertexNormals();
      const mesh = new THREE.Mesh(g, vergeMat);
      mesh.name = 'road-foundation';
      mesh.receiveShadow = true;
      group.add(mesh);
    }
  }

  // ---------- bridge decks / void decks / pillars ----------
  {
    const b = new MeshBuilder();
    b.detail = 0.7;
    const deckRanges: [number, number][] = def.voidWorld
      ? [[0, main.n]]
      : bridgeRanges.map(([a, c]) => [Math.floor(a / main.ds), Math.floor(c / main.ds)]);
    for (const [a, c] of deckRanges) {
      const g = ribbon(
        main,
        (i) => -main.halfW[i] - main.shoulderL[i] - 1.2,
        (i) => main.halfW[i] + main.shoulderR[i] + 1.2,
        -1.6,
        { range: [a, c], skipGap: true },
      );
      if (g) {
        g.scale(1, 1, 1);
        const under = new THREE.Mesh(
          g,
          toon({ color: def.voidWorld ? '#E9DDFF' : '#E4DDEE', side: THREE.DoubleSide }),
        );
        group.add(under);
      }
      for (let i = a; i <= c; i += 16) {
        const k = main.wrap(i);
        if (main.gap[k] || main.loopAt(k * main.ds)) continue;
        const x = main.px[k];
        const z = main.pz[k];
        const y = main.py[k];
        if (def.voidWorld) {
          // fluffy cloud clusters under the rainbow road
          for (let q = 0; q < 3; q++)
            b.sphere(rng.range(2.5, 4.5), '#FFFFFF', {
              p: [x + rng.range(-8, 8), y - 3 - rng.range(0, 2), z + rng.range(-8, 8)],
            });
        } else {
          const bottom = lowY - 2;
          const hgt = y - 1.6 - bottom;
          for (const sd of [-1, 1]) {
            const t = sd * (main.halfW[k] - 2);
            if (blocksRoad(x + main.hx[k] * t, z + main.hz[k] * t, bottom, y - 1.6, 1.5)) continue;
            b.cyl(1.0, 1.3, hgt, '#D9D2EA', {
              p: [x + main.hx[k] * t, bottom + hgt / 2, z + main.hz[k] * t],
            });
          }
        }
      }
    }
    for (const path of shortcuts) {
      const g = ribbon(
        path,
        (i) => -path.halfW[i] - path.shoulderL[i] - 1.2,
        (i) => path.halfW[i] + path.shoulderR[i] + 1.2,
        -1.5,
      );
      if (g) {
        const deck = new THREE.Mesh(
          g,
          toon({ color: def.voidWorld ? '#BDB6E2' : '#8A94AA', side: THREE.DoubleSide }),
        );
        deck.name = 'branch-deck';
        group.add(deck);
      }
    }
    // rainbow-world side skirts so decks read as thick candy slabs
    if (!b.isEmpty()) group.add(b.build({ outline: quality.outlines }));
  }

  // ---------- tunnels ----------
  for (const tn of def.tunnel ?? []) {
    const b = new MeshBuilder();
    b.detail = 0.8;
    const s0 = tn.u0 * L;
    const s1 = tn.u1 * L;
    const tmp = new THREE.Vector3();
    for (let s = s0; s <= s1; s += 7) {
      const i = main.idxAtS(s);
      const yaw = Math.atan2(main.fx[i], main.fz[i]);
      main.pointAt(s, 0, tmp);
      const w = main.halfW[i] + main.shoulderL[i] + 1.5;
      b.add(new THREE.TorusGeometry(w, 0.55, 8, 24, Math.PI), Math.round(s / 7) % 2 ? '#7DF9FF' : '#FF7EC8', {
        p: [tmp.x, tmp.y, tmp.z],
        r: [0, yaw + Math.PI / 2, 0],
        glow: 1.8,
      });
    }
    const shell = new THREE.Mesh(cavernGeometry(main, paths, s0, s1, '#45405B'), cavernMaterial());
    shell.name = 'exploration-cavern';
    shell.castShadow = true;
    shell.receiveShadow = true;
    group.add(shell);
    for (const u of [.25, .75]) {
      const p = main.pointAt(s0 + (s1 - s0) * u, 0, new THREE.Vector3(), 9);
      const lamp = new THREE.PointLight('#9EDBE7', 110, 95, 1.2);
      lamp.position.copy(p);
      group.add(lamp);
    }
    group.add(b.build({ outline: false }));
  }

  // ---------- start gate & line ----------
  group.add(buildStartGate(main, theme));

  // ---------- ramps ----------
  for (const r of main.ramps) group.add(buildRamp(main, r.s0, r.s1, r.t0, r.t1, r.h));

  // ---------- boost pads ----------
  const padTex = boostPadTexture();
  padTex.wrapS = padTex.wrapT = THREE.RepeatWrapping;
  const pads: BoostPad[] = [];
  const padMat = new THREE.MeshBasicMaterial({
    map: padTex,
    toneMapped: false,
    polygonOffset: true,
    polygonOffsetFactor: -4,
    polygonOffsetUnits: -4,
  });
  const addPad = (path: TrackPath, s: number, t: number) => {
    const halfLen = 6;
    const halfWid = Math.min(5.4, path.halfW[path.idxAtS(s)] - 0.8);
    pads.push({ path, s, t, halfLen, halfWid });
    const g = boostPadGeometry(path, s, t, halfLen, halfWid);
    const m = new THREE.Mesh(g, padMat);
    m.name = 'boost-pad';
    group.add(m);
  };
  for (const bp of def.boostPads) addPad(main, bp.u * L, bp.t);
  def.shortcuts.forEach((sc, k) => {
    if (sc.boostPad) addPad(shortcuts[k], shortcuts[k].length * 0.5, 0);
  });

  // ---------- props (static batched into spatial chunks) ----------
  const chunks = scatterProps(
    def,
    theme,
    main,
    paths,
    nearest,
    groundHeight,
    rng,
    quality,
    centre,
    radius,
    minY,
  );
  for (const c of chunks) {
    group.add(c.mesh);
    if (c.outline) group.add(c.outline);
  }

  // ---------- circuit dressing (grandstands, gantries, tyre walls, flags) ----------
  group.add(buildDressing(def, theme, main, groundHeight, paths));
  group.add(buildAdventureWorld(def, paths, theme, groundHeight));
  group.add(buildLandscape(def, theme, paths, centre, radius, groundHeight, quality.props));

  // ---------- sky ----------
  const sky = buildSky(theme);
  group.add(sky);
  const clouds = buildClouds(theme.clouds, centre, radius + 260, minY + (def.voidWorld ? -50 : 0), def.no);
  group.add(clouds);

  return {
    def,
    theme,
    main,
    shortcuts,
    paths,
    group,
    pads,
    centre,
    radius,
    sky,
    clouds,
    water,
    padTex,
    chunks,
    lowGravity: (def.lowGravity ?? []).map((g) => [g.u0 * L, g.u1 * L]),
    groundHeight,
    voidY: def.voidWorld ? minY - 25 : def.water ? waterY - 0.5 : minY - 20,
  };
}

const tmpProj = new Proj();

function surfaceColor(s: Surface): string {
  switch (s) {
    case Surface.Dirt:
      return '#E7C99A';
    case Surface.Sand:
      return '#F4DDAA';
    case Surface.Choco:
      return '#9B6A4F';
    case Surface.Ice:
      return '#D9F1FF';
    default:
      return '#ddd';
  }
}

/** Nearest path sample (horizontal) with a coarse spatial hash. */
function makeNearest(paths: TrackPath[]) {
  const cell = 24;
  const map = new Map<string, [TrackPath, number][]>();
  for (const p of paths)
    for (let i = 0; i < p.n; i++) {
      const k = `${Math.floor(p.px[i] / cell)},${Math.floor(p.pz[i] / cell)}`;
      let a = map.get(k);
      if (!a) map.set(k, (a = []));
      a.push([p, i]);
    }
  const res = { path: paths[0], i: 0, d: 0, side: 1 };
  return (x: number, z: number) => {
    const cx = Math.floor(x / cell);
    const cz = Math.floor(z / cell);
    let best = Infinity;
    for (let ring = 0; ring < 12; ring++) {
      for (let dx = -ring; dx <= ring; dx++)
        for (let dz = -ring; dz <= ring; dz++) {
          if (Math.max(Math.abs(dx), Math.abs(dz)) !== ring) continue;
          const a = map.get(`${cx + dx},${cz + dz}`);
          if (!a) continue;
          for (const [p, i] of a) {
            const ex = x - p.px[i];
            const ez = z - p.pz[i];
            const d = ex * ex + ez * ez;
            if (d < best) {
              best = d;
              res.path = p;
              res.i = i;
              res.side = ex * p.hx[i] + ez * p.hz[i] >= 0 ? 1 : -1;
            }
          }
        }
      if (best < Infinity && Math.sqrt(best) < ring * cell - cell) break;
    }
    if (best === Infinity) {
      res.d = 9999;
      return res;
    }
    res.d = Math.sqrt(best);
    return res;
  };
}

function scatterProps(
  def: TrackDef,
  theme: ThemeDef,
  main: TrackPath,
  paths: TrackPath[],
  nearest: ReturnType<typeof makeNearest>,
  groundHeight: (x: number, z: number) => number,
  rng: Rng,
  quality: { props: number; outlines: boolean },
  centre: THREE.Vector3,
  radius: number,
  minY: number,
) {
  const CH = 110;
  const buckets = new Map<
    string,
    {
      solid: THREE.BufferGeometry[];
      hull: THREE.BufferGeometry[];
      glow: THREE.BufferGeometry[];
      c: THREE.Vector3;
      n: number;
    }
  >();
  const variants = new Map<string, ReturnType<MeshBuilder['parts']>>();
  const getVariant = (name: string, v: number, detail: number) => {
    const key = name + v + detail;
    let p = variants.get(key);
    if (!p) {
      p = buildProp(name, v * 7919 + def.no, detail).parts();
      variants.set(key, p);
    }
    return p;
  };
  const m4 = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const e = new THREE.Euler();
  const place = (name: string, x: number, y: number, z: number, yaw: number, s: number, detail: number) => {
    const parts = getVariant(name, rng.int(0, 2), detail);
    e.set(0, yaw, 0);
    q.setFromEuler(e);
    m4.compose(new THREE.Vector3(x, y, z), q, new THREE.Vector3(s, s, s));
    const key = `${Math.floor(x / CH)},${Math.floor(z / CH)}`;
    let bk = buckets.get(key);
    if (!bk) buckets.set(key, (bk = { solid: [], hull: [], glow: [], c: new THREE.Vector3(), n: 0 }));
    bk.c.add(new THREE.Vector3(x, y, z));
    bk.n++;
    for (const g of parts.solid) bk.solid.push(g.clone().applyMatrix4(m4));
    for (const g of parts.hull) bk.hull.push(g.clone().applyMatrix4(m4));
    for (const g of parts.glow) bk.glow.push(g.clone().applyMatrix4(m4));
  };
  const clearOf = (x: number, z: number, margin: number) => {
    for (const path of paths)
      for (const loop of path.loops) {
        const point = new THREE.Vector3();
        for (let s = loop.s0; s <= loop.s1; s += 0.5) {
          path.pointAt(s, 0, point);
          if (Math.hypot(point.x - x, point.z - z) < path.halfW[path.idxAtS(s)] + 6 + margin) return false;
        }
      }
    const nr = nearest(x, z);
    const p = nr.path;
    const lim = p.halfW[nr.i] + Math.max(p.shoulderL[nr.i], p.shoulderR[nr.i]);
    return nr.d > lim + margin;
  };
  // roadside props
  const step = 10 / quality.props;
  for (let s = 0; s < main.length; s += step * rng.range(0.7, 1.3)) {
    const i = main.idxAtS(s);
    for (const side of [-1, 1]) {
      if (rng.chance(0.25)) continue;
      if ((side < 0 ? main.wallL[i] : main.wallR[i]) === 0 && !def.voidWorld) continue;
      const lim = main.halfW[i] + (side < 0 ? main.shoulderL[i] : main.shoulderR[i]);
      const name = rng.pick(theme.props);
      const footprint =
        (
          { tower: 14, cookieHouse: 9, hanok: 10, container: 7, scaffold: 7, busStop: 5 } as Record<
            string,
            number
          >
        )[name] ?? 4;
      const off = lim + footprint + rng.range(4, 10) + (rng.chance(0.4) ? rng.range(6, 28) : 0);
      const x = main.px[i] + main.hx[i] * off * side;
      const z = main.pz[i] + main.hz[i] * off * side;
      if (!clearOf(x, z, footprint + 2)) continue;
      const y = def.voidWorld ? main.py[i] - 0.4 : groundHeight(x, z) - 0.1;
      if (def.voidWorld && off > lim + 6) continue;
      place(name, x, y, z, rng.range(0, Math.PI * 2), rng.range(0.85, 1.2), 0.9);
    }
  }
  // infield / outfield fill
  const fillN = Math.round(70 * quality.props);
  for (let k = 0; k < fillN && !def.voidWorld; k++) {
    const a = rng.range(0, Math.PI * 2);
    const d = rng.range(0, radius + 120);
    const x = centre.x + Math.cos(a) * d;
    const z = centre.z + Math.sin(a) * d;
    if (!clearOf(x, z, 8)) continue;
    const y = groundHeight(x, z);
    if (def.water && y < def.water.y + 0.3) continue;
    place(rng.pick(theme.props), x, y - 0.1, z, rng.range(0, 6.28), rng.range(0.9, 1.4), 0.75);
  }
  // landmarks
  for (const lm of theme.landmarks) {
    for (let tries = 0; tries < 30; tries++) {
      const a = rng.range(0, Math.PI * 2);
      const d = radius + rng.range(60, 220);
      const x = centre.x + Math.cos(a) * d;
      const z = centre.z + Math.sin(a) * d;
      if (!clearOf(x, z, 50)) continue;
      const y = def.voidWorld ? minY - rng.range(10, 30) : groundHeight(x, z);
      place(lm, x, y, z, Math.atan2(centre.x - x, centre.z - z), 1, 1);
      break;
    }
  }
  const out: { mesh: THREE.Object3D; outline: THREE.Object3D | null; centre: THREE.Vector3 }[] = [];
  const solidMat = landscapeMaterial(def.theme);
  const glowMat = glow(0xffffff, 1, true);
  for (const bk of buckets.values()) {
    const g = new THREE.Group();
    if (bk.solid.length) {
      const sg = mergeGeometries(bk.solid)!;
      const sm = new THREE.Mesh(sg, solidMat);
      sm.castShadow = true;
      sm.receiveShadow = true;
      g.add(sm);
    }
    if (bk.glow.length) g.add(new THREE.Mesh(mergeGeometries(bk.glow)!, glowMat));
    let outline: THREE.Object3D | null = null;
    if (quality.outlines && bk.hull.length) {
      outline = new THREE.Mesh(mergeGeometries(bk.hull)!, outlineMaterial(undefined, 0.9));
    }
    out.push({ mesh: g, outline, centre: bk.c.divideScalar(bk.n) });
  }
  return out;
}

function buildStartGate(main: TrackPath, theme: ThemeDef): THREE.Group {
  const g = new THREE.Group();
  const p = new THREE.Vector3();
  main.pointAt(0, 0, p);
  const yaw = Math.atan2(main.fx[0], main.fz[0]);
  const w = main.halfW[0] + main.shoulderL[0] + 1;
  const b = new MeshBuilder();
  for (const sd of [-1, 1]) {
    b.capsule(0.7, 7, theme.curb[0], { p: [sd * w, 4, 0] });
    b.sphere(1.0, '#FFFFFF', { p: [sd * w, 8.4, 0] });
    for (let k = 0; k < 4; k++)
      b.sphere(0.9, ['#FFADAD', '#A2D2FF', '#FDFFB6', '#B9FBC0'][k], {
        p: [sd * w + Math.cos(k * 1.6) * 1.2, 10 + k * 0.3, Math.sin(k * 1.6) * 1.2],
        s: [1, 1.2, 1],
      });
  }
  b.box(w * 2 + 1, 2.4, 0.8, '#FFFFFF', { p: [0, 8.2, 0] }, 0.3);
  const built = b.build();
  g.add(built);
  // banner text
  const [c, ctx] = canvas(1024, 128);
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, 1024, 128);
  for (let x = 0; x < 1024; x += 32) {
    for (let y = 0; y < 128; y += 32) {
      if ((x / 32 + y / 32) % 2 === 0 && (x < 160 || x > 864)) {
        ctx.fillStyle = '#5B4E8F';
        ctx.fillRect(x, y, 32, 32);
      }
    }
  }
  ctx.font = 'bold 84px "Jua", "Arial Rounded MT Bold", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineWidth = 12;
  ctx.strokeStyle = '#FF8FB8';
  ctx.strokeText('TURBO RALLY', 512, 68);
  ctx.fillStyle = '#FFE066';
  ctx.fillText('TURBO RALLY', 512, 68);
  const bannerMat = new THREE.MeshBasicMaterial({ map: tex(c), toneMapped: false });
  for (const sd of [1, -1]) {
    const plane = new THREE.Mesh(new THREE.PlaneGeometry(w * 2, 2.1), bannerMat);
    plane.position.set(0, 8.2, sd * 0.42);
    if (sd < 0) plane.rotation.y = Math.PI;
    g.add(plane);
  }
  // checkered start line
  const [c2, ctx2] = canvas(256, 32);
  for (let x = 0; x < 256; x += 16)
    for (let y = 0; y < 32; y += 16) {
      ctx2.fillStyle = (x / 16 + y / 16) % 2 ? '#FFFFFF' : '#5B4E8F';
      ctx2.fillRect(x, y, 16, 16);
    }
  const line = new THREE.Mesh(
    new THREE.PlaneGeometry(main.halfW[0] * 2, 2).rotateX(-Math.PI / 2),
    new THREE.MeshToonMaterial({ map: tex(c2), polygonOffset: true, polygonOffsetFactor: -2 }),
  );
  line.position.set(0, 0.06, 0);
  line.receiveShadow = true;
  g.add(line);
  g.position.copy(p);
  g.rotation.y = yaw;
  void roundRect;
  return g;
}

function buildRamp(
  main: TrackPath,
  s0: number,
  s1: number,
  t0: number,
  t1: number,
  h: number,
): THREE.Object3D {
  const cols = ['#FFADAD', '#FFD6A5', '#FDFFB6', '#B9FBC0', '#A2D2FF', '#CDB4DB'];
  const pos: number[] = [];
  const col: number[] = [];
  const c = new THREE.Color();
  const steps = 12;
  const P = (s: number, t: number, top: boolean) => {
    const v = new THREE.Vector3();
    main.pointAt(s, t, v, 0);
    if (!top) v.y -= main.rampHeight(s, t);
    return v;
  };
  const tri = (a: THREE.Vector3, b: THREE.Vector3, d: THREE.Vector3, color: string) => {
    c.set(color);
    pos.push(a.x, a.y, a.z, b.x, b.y, b.z, d.x, d.y, d.z);
    for (let k = 0; k < 3; k++) col.push(c.r, c.g, c.b);
  };
  const lanes = 6;
  for (let k = 0; k < steps; k++) {
    const sa = s0 + ((s1 - s0) * k) / steps + 0.001;
    const sb = s0 + ((s1 - s0) * (k + 1)) / steps - 0.001;
    for (let l = 0; l < lanes; l++) {
      const ta = t0 + ((t1 - t0) * l) / lanes;
      const tb = t0 + ((t1 - t0) * (l + 1)) / lanes;
      const color = cols[l % cols.length];
      const a = P(sa, ta, true);
      const b2 = P(sa, tb, true);
      const d = P(sb, ta, true);
      const e2 = P(sb, tb, true);
      tri(a, d, b2, color);
      tri(b2, d, e2, color);
    }
    // sides
    for (const t of [t0, t1]) {
      const a = P(sa, t, true);
      const b2 = P(sb, t, true);
      const a0 = P(sa, t, false);
      const b0 = P(sb, t, false);
      tri(a0, b0, a, '#FFFFFF');
      tri(a, b0, b2, '#FFFFFF');
    }
  }
  // back face
  for (let l = 0; l < lanes; l++) {
    const ta = t0 + ((t1 - t0) * l) / lanes;
    const tb = t0 + ((t1 - t0) * (l + 1)) / lanes;
    const a = P(s1 - 0.001, ta, true);
    const b2 = P(s1 - 0.001, tb, true);
    const a0 = P(s1 - 0.001, ta, false);
    const b0 = P(s1 - 0.001, tb, false);
    tri(a, a0, b2, '#FFFFFF');
    tri(b2, a0, b0, '#FFFFFF');
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.computeVertexNormals();
  const m = new THREE.Mesh(g, toon({ vertexColors: true, side: THREE.DoubleSide }));
  m.name = 'launch-ramp';
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}
