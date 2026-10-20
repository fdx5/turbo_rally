import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

const _m = new THREE.Matrix4();
const _inv = new THREE.Matrix4();

/**
 * Collapse every static mesh under `root` into one mesh per material (draw-call batching).
 * Meshes for which `keep(o)` is true (animated parts, faces, decals) are left untouched.
 */
export function bakeMerge(root: THREE.Object3D, keep: (o: THREE.Object3D) => boolean): THREE.Group {
  root.updateMatrixWorld(true);
  _inv.copy(root.matrixWorld).invert();
  const buckets = new Map<THREE.Material, { geos: THREE.BufferGeometry[]; names: Set<string>; cast: boolean }>();
  const remove: THREE.Object3D[] = [];
  const visit = (o: THREE.Object3D) => {
    if (o !== root && keep(o)) return;
    const mesh = o as THREE.Mesh;
    if (mesh.isMesh && !(mesh as THREE.InstancedMesh).isInstancedMesh) {
      const mat = mesh.material as THREE.Material;
      let b = buckets.get(mat);
      if (!b) buckets.set(mat, (b = { geos: [], names: new Set(), cast: false }));
      _m.multiplyMatrices(_inv, mesh.matrixWorld);
      const g = mesh.geometry.clone().applyMatrix4(_m);
      if (_m.determinant() < 0) {
        // mirrored transform: flip winding
        const idx = g.index;
        if (idx) for (let i = 0; i < idx.count; i += 3) {
          const a = idx.getX(i + 1);
          idx.setX(i + 1, idx.getX(i + 2));
          idx.setX(i + 2, a);
        }
      }
      b.geos.push(g.index ? g : g);
      b.names.add(mesh.name);
      b.cast ||= mesh.castShadow;
      remove.push(mesh);
    }
    for (const c of o.children) visit(c);
  };
  visit(root);
  for (const r of remove) r.parent?.remove(r);
  const out = new THREE.Group();
  out.name = 'baked';
  for (const [mat, b] of buckets) {
    const indexed = b.geos.filter((g) => g.index);
    const nonIdx = b.geos.filter((g) => !g.index);
    for (const list of [indexed, nonIdx]) {
      if (!list.length) continue;
      const g = list.length === 1 ? list[0] : mergeGeometries(list, false);
      if (!g) continue;
      g.computeBoundingSphere();
      const m = new THREE.Mesh(g, mat);
      m.name = b.names.has('outline') ? 'outline' : [...b.names][0] || 'baked';
      m.castShadow = b.cast && m.name !== 'outline';
      m.receiveShadow = m.name !== 'outline';
      out.add(m);
    }
  }
  root.add(out);
  return out;
}
