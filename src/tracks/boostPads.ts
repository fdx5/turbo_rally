import * as THREE from 'three';
import type { TrackPath } from './path';

/** A subdivided decal follows slope, banking, ramps and loop normals vertex by vertex. */
export function boostPadGeometry(path: TrackPath, s: number, t: number, halfLen: number, halfWidth: number, lift = 0.14): THREE.BufferGeometry {
  const rows = 18, cols = 8;
  const positions: number[] = [], uv: number[] = [], indices: number[] = [];
  const v = new THREE.Vector3();
  for (let row = 0; row <= rows; row++) {
    for (let col = 0; col <= cols; col++) {
      path.pointAt(s - halfLen + row / rows * halfLen * 2, t - halfWidth + col / cols * halfWidth * 2, v, lift);
      positions.push(v.x, v.y, v.z);
      uv.push(col / cols, row / rows);
      if (row < rows && col < cols) {
        const a = row * (cols + 1) + col, b = a + cols + 1;
        indices.push(a, a + 1, b, a + 1, b + 1, b);
      }
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}
