import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { MeshBVH } from 'three-mesh-bvh';
import { TRACKS } from '../src/data/tracks';
import { buildPaths } from '../src/tracks/trackBuilder';
import { cavernGeometry, cavernMaterial, cavernSections } from '../src/tracks/cavern';

describe('enclosed expedition caverns', () => {
  it('keeps the roof visible from inside, including after scenery material replacement', () => {
    const material = cavernMaterial();
    expect(material.side).toBe(THREE.DoubleSide);
    expect(material.shadowSide).toBe(THREE.DoubleSide);
    expect(material.type).toBe('MeshStandardMaterial');
    expect(material.transparent).toBe(false);
  });

  for (const def of TRACKS.filter((t) => cavernSections(t).length))
    it(`${def.id}: covers every cave lane with a continuous vault and preserves all driving routes`, () => {
      const { main, shortcuts } = buildPaths(def),
        paths = [main, ...shortcuts];
      const origin = new THREE.Vector3(),
        direction = new THREE.Vector3(),
        end = new THREE.Vector3();
      const ray = new THREE.Ray();
      const caves = cavernSections(def).map((zone) => {
        const start = zone.u0 * main.length,
          finish = zone.u1 * main.length;
        const geometry = cavernGeometry(main, paths, start, finish, '#45405B');
        const tree = new MeshBVH(geometry, { indirect: true });
        for (let s = start + 5; s < finish - 5; s += 5) {
          const i = main.idxAtS(s);
          for (const lane of [-0.85, 0, 0.85]) {
            main.pointAt(s, lane * main.halfW[i], origin, 3.5);
            for (const tilt of [-0.28, 0, 0.28]) {
              direction.set(main.hx[i] * tilt, 1, main.hz[i] * tilt).normalize();
              ray.set(origin, direction);
              const hit = tree.raycastFirst(ray, THREE.DoubleSide, 0, 180);
              expect(hit, `${def.id}: open roof at ${s.toFixed(1)}, lane ${lane}`).not.toBeNull();
              expect(hit!.distance, `${def.id}: low roof at ${s}`).toBeGreaterThan(3);
            }
          }
        }
        return { tree, geometry };
      });
      for (const path of paths)
        for (let s = 1; s < path.length - 3; s += 3) {
          const i = path.idxAtS(s);
          if (path.gap[i]) continue;
          for (const lane of [-0.7, 0, 0.7]) {
            path.pointAt(s, lane * path.halfW[i], origin, 0.3);
            ray.set(origin, direction.set(0, 1, 0));
            for (const { tree } of caves)
              expect(
                tree.raycastFirst(ray, THREE.DoubleSide, 0, 4.5),
                `${def.id}: cave intersects a vehicle at ${paths.indexOf(path)}/${s}`,
              ).toBeNull();
            path.pointAt(s, lane * path.halfW[i], origin, 2);
            path.pointAt(s + 2, lane * path.halfW[i], end, 2);
            const length = direction.subVectors(end, origin).length();
            ray.set(origin, direction.normalize());
            for (const { tree } of caves)
              expect(
                tree.raycastFirst(ray, THREE.DoubleSide, 0, length),
                `${def.id}: wall across route at ${paths.indexOf(path)}/${s}`,
              ).toBeNull();
          }
        }
      caves.forEach((c) => c.geometry.dispose());
    });
});
