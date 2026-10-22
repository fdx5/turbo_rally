import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { ChaseCam } from '../src/race/camera';
import { TRACKS } from '../src/data/tracks';
import { buildPaths } from '../src/tracks/trackBuilder';
import { Proj } from '../src/tracks/path';
import { KartBody, type PhysWorld } from '../src/physics/kart';
import { VEHICLES } from '../src/data/vehicles';
import { CHARACTERS } from '../src/data/characters';
import { roadCollider } from '../src/physics/roadCollider';

describe('road-aware chase camera', () => {
  it('uses rendered triangles for overhead clearance without lifting the camera onto another deck', () => {
    const { main, shortcuts } = buildPaths(TRACKS[0]);
    const group = new THREE.Group();
    const body = new KartBody(VEHICLES[0].stats, CHARACTERS[0], 1);
    const world = { main, paths: [main, ...shortcuts], pads: [], lowGravity: [], voidY: -1000, group };
    body.place(world, main.length * 0.04, 0);
    const bridge = new THREE.Mesh(new THREE.PlaneGeometry(50, 50).rotateX(-Math.PI / 2));
    bridge.name = 'road';
    bridge.position.set(body.x, body.y + 2.9, body.z);
    group.add(bridge);
    const cam = new THREE.PerspectiveCamera(70, 16 / 9, 0.3, 2600);
    const chase = new ChaseCam(cam, world);
    chase.mode = 'chase';
    chase.snap(body);
    for (let i = 0; i < 30; i++) chase.update(1 / 60, body, body.x, body.y, body.z, body.yaw, false);
    expect(cam.position.y).toBeLessThan(body.y + 2.7);
    expect(cam.position.y).toBeGreaterThan(body.y + 0.8);
  });

  it('keeps the lens and its sightline above steep descents on all main roads and branches', () => {
    const projection = new Proj(),
      hit = new THREE.Vector3(),
      anchor = new THREE.Vector3();
    let descents = 0;
    for (const def of TRACKS) {
      const { main, shortcuts } = buildPaths(def);
      const paths = [main, ...shortcuts];
      const world: PhysWorld = { main, paths, pads: [], lowGravity: [], voidY: -1000 };
      const body = new KartBody(VEHICLES[0].stats, CHARACTERS[0], 1);
      const cam = new THREE.PerspectiveCamera(70, 16 / 9, 0.3, 2600);
      const chase = new ChaseCam(cam, world);
      chase.mode = 'chase';
      for (let k = 0; k < paths.length; k++) {
        const path = paths[k];
        for (let i = 12; i < path.n - 12; i += 6) {
          if (path.fy[i] > -0.3 || path.gap[i]) continue;
          descents++;
          for (const lookBack of [false, true]) {
            path.pointAt(i * path.ds, 0, anchor);
            body.x = anchor.x;
            body.y = anchor.y;
            body.z = anchor.z;
            body.onPath = k;
            body.progressS = i * path.ds;
            path.project(body.x, body.y, body.z, i, body.proj);
            body.yaw = path.headingAt(i * path.ds);
            body.grounded = true;
            body.speed = 65;
            body.boostT = 1;
            chase.snap(body);
            for (let frame = 0; frame < 8; frame++)
              chase.update(1 / 60, body, body.x, body.y, body.z, body.yaw, lookBack);
            const p = path.project(
              cam.position.x,
              cam.position.y,
              cam.position.z,
              i,
              projection,
              32,
              Infinity,
            );
            if (!p.gap && Math.abs(p.t) < p.halfW)
              expect(cam.position.y - p.y, `${def.id}/${k}/${i}`).toBeGreaterThan(0.3);
            anchor.set(body.x, body.y + 1.15, body.z);
            for (const underside of [false, true])
              expect(
                roadCollider(world).sweep(anchor, cam.position, underside, hit),
                `${def.id}/${k}/${i} occluded`,
              ).toBe(false);
          }
        }
      }
    }
    expect(descents).toBeGreaterThan(300);
  });
});
