import * as THREE from 'three';
import type { TrackDef } from '../data/tracks';
import type { TrackPath } from './path';
import { roadClearance } from './roadClearance';

export function cavernSections(def: TrackDef) {
  return [
    ...(def.adventures ?? []).filter((z) => z.kind !== 'ruins').map((z) => ({ u0: z.u0, u1: z.u1 })),
    ...(def.tunnel ?? []),
  ];
}

/** A continuous rock volume: inner vault, outer vault, floor and thick open portals.
 * Route openings are confined to the flanks; the crown is never removed for a crossing.
 */
export function cavernGeometry(
  main: TrackPath,
  paths: TrackPath[],
  start: number,
  end: number,
  color: string,
) {
  const rows = Math.max(2, Math.ceil((end - start) / 2.5)),
    cols = 32,
    ring = cols + 1;
  const thickness = 2.2;
  const widths: number[] = [],
    banks: number[] = [],
    heights: number[] = [];
  const centres: THREE.Vector3[] = [];
  for (let row = 0; row <= rows; row++) {
    const s = start + (row / rows) * (end - start),
      i = main.idxAtS(s);
    widths.push(main.halfW[i] + Math.max(main.shoulderL[i], main.shoulderR[i]) + 8);
    banks.push(main.bankTan[i]);
    heights.push(18);
    centres.push(main.pointAt(s, 0, new THREE.Vector3()));
  }
  // A crossing deck may need a higher chamber, never a hole cut in the roof.
  const samples: { x: number; y: number; z: number; s: number; path: TrackPath }[] = [];
  const v = new THREE.Vector3();
  for (const path of paths)
    for (let s = 0; s < path.length; s += 4) {
      const i = path.idxAtS(s);
      if (path.gap[i]) continue;
      for (const side of [-0.9, 0, 0.9]) {
        path.pointAt(s, side * path.halfW[i], v);
        samples.push({ x: v.x, y: v.y, z: v.z, s, path });
      }
    }
  for (let pass = 0; pass < 3; pass++) {
    for (let row = 0; row <= rows; row++) {
      const s = start + (row / rows) * (end - start),
        i = main.idxAtS(s),
        c = centres[row];
      const horizontal = Math.hypot(main.fx[i], main.fz[i]) || 1;
      for (const sample of samples) {
        if (
          sample.path === main &&
          Math.min(Math.abs(sample.s - s), main.length - Math.abs(sample.s - s)) < 60
        )
          continue;
        const dx = sample.x - c.x,
          dz = sample.z - c.z;
        if (Math.abs((dx * main.fx[i] + dz * main.fz[i]) / horizontal) > 5) continue;
        const t = dx * main.hx[i] + dz * main.hz[i];
        if (Math.abs(t) > widths[row] - 2) continue;
        const arch = Math.sqrt(Math.max(0.01, 1 - (t / widths[row]) ** 2));
        const ceiling = c.y + t * banks[row] - 4 + arch * (heights[row] + 4);
        if (sample.y + 7 > ceiling && sample.y - 3 < ceiling + thickness)
          heights[row] = Math.max(heights[row], (sample.y + 7 - c.y - t * banks[row] + 4) / arch - 4);
      }
    }
    const previous = heights.slice();
    for (let row = 0; row <= rows; row++)
      for (let j = 0; j <= rows; j++)
        heights[row] = Math.max(
          heights[row],
          previous[j] - ((Math.abs(row - j) * (end - start)) / rows) * 0.5,
        );
  }
  const positions: number[] = [],
    colors: number[] = [],
    indices: number[] = [];
  const baseColor = new THREE.Color(color);
  const vertex = new THREE.Vector3();
  for (let layer = 0; layer < 2; layer++)
    for (let row = 0; row <= rows; row++) {
      const s = start + (row / rows) * (end - start);
      for (let col = 0; col <= cols; col++) {
        const angle = (col / cols) * Math.PI;
        const t = Math.cos(angle) * (widths[row] + layer * thickness);
        // Subtle rock relief preserves the exact crown and shared row seams.
        const relief = Math.sin(row * 1.43 + col * 2.17) * Math.sin(angle) ** 2 * 0.3;
        const lift =
          -4 - layer * thickness + Math.sin(angle) * (heights[row] + 4 + layer * thickness * 2 + relief);
        main.pointAt(s, t, vertex, lift);
        positions.push(vertex.x, vertex.y, vertex.z);
        const shade = (layer ? 0.94 : 0.64) + 0.08 * Math.sin(row * 0.71 + col * 1.27);
        colors.push(baseColor.r * shade, baseColor.g * shade, baseColor.b * shade);
      }
    }
  const layerSize = (rows + 1) * ring;
  const blocksRoad = roadClearance(paths);
  const quad = (a: number, b: number, c: number, d: number) => indices.push(a, b, c, b, d, c);
  const centre = new THREE.Vector3();
  for (let row = 0; row < rows; row++)
    for (let col = 0; col <= cols; col++) {
      const next = (col + 1) % ring;
      const a = row * ring + col,
        b = (row + 1) * ring + col,
        c = row * ring + next,
        d = (row + 1) * ring + next;
      const s = start + ((row + 0.5) / rows) * (end - start),
        i = main.idxAtS(s);
      centre.set(0, 0, 0);
      for (const k of [a, b, c, d]) centre.add(vertex.fromArray(positions, k * 3));
      centre.multiplyScalar(0.25);
      const sideFace =
        col === cols ||
        Math.min(Math.abs(Math.cos((col / cols) * Math.PI)), Math.abs(Math.cos((next / cols) * Math.PI))) *
          widths[row] >
          main.halfW[i] + 2;
      if (sideFace && blocksRoad(centre.x, centre.z, centre.y - 2, centre.y + 2, 2)) continue;
      quad(a, b, c, d);
      quad(a + layerSize, c + layerSize, b + layerSize, d + layerSize);
    }
  // Portal annuli seal shell thickness, while the roadway opening remains unobstructed.
  for (const row of [0, rows])
    for (let col = 0; col <= cols; col++) {
      const a = row * ring + col,
        b = row * ring + ((col + 1) % ring);
      // A fork can run through a portal as well as a chamber flank. Reserve the
      // same vehicle envelope at the portal's thick annulus.
      const corners = [a, b, a + layerSize, b + layerSize].map(k =>
        new THREE.Vector3().fromArray(positions, k * 3));
      centre.set(0, 0, 0);
      corners.forEach(p => centre.add(p));
      centre.multiplyScalar(.25);
      const radius = Math.max(...corners.map(p => Math.hypot(p.x - centre.x, p.z - centre.z)));
      if (blocksRoad(centre.x, centre.z, Math.min(...corners.map(p => p.y)),
        Math.max(...corners.map(p => p.y)), radius + 1)) continue;
      quad(a, b, a + layerSize, b + layerSize);
    }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  geometry.userData.cavern = {
    start,
    end,
    minHeight: Math.min(...heights),
    maxHeight: Math.max(...heights),
    thickness,
  };
  geometry.userData.cavernProfile = { widths, heights };
  return geometry;
}

/** Attach roof details to raised crossing chambers as well as the normal-height vault. */
export function cavernRoofLift(geometry: THREE.BufferGeometry, s: number, t: number) {
  const { start, end } = geometry.userData.cavern;
  const { widths, heights } = geometry.userData.cavernProfile as { widths: number[]; heights: number[] };
  const f = THREE.MathUtils.clamp(
    ((s - start) / (end - start)) * (heights.length - 1),
    0,
    heights.length - 1,
  );
  const a = Math.floor(f),
    b = Math.min(heights.length - 1, a + 1);
  const width = THREE.MathUtils.lerp(widths[a], widths[b], f - a);
  const height = THREE.MathUtils.lerp(heights[a], heights[b], f - a);
  return -4 + Math.sqrt(Math.max(0, 1 - (t / width) ** 2)) * (height + 4);
}

export function cavernMaterial() {
  const material = new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness: 0.96,
    side: THREE.DoubleSide,
  });
  material.shadowSide = THREE.DoubleSide;
  return material;
}
