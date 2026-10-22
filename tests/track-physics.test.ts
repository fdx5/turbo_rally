import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { TRACKS } from '../src/data/tracks';
import { CHARACTERS } from '../src/data/characters';
import { VEHICLES } from '../src/data/vehicles';
import { TrackPath, Proj } from '../src/tracks/path';
import { buildPaths } from '../src/tracks/trackBuilder';
import { KartBody, type PhysWorld } from '../src/physics/kart';
import { groundPose } from '../src/race/groundPose';
import { AIDriver } from '../src/ai/driver';
import { WheelPool } from '../src/race/wheelPool';
import type { VehicleModel } from '../src/vehicles/vehicleModel';

const idle = { steer: 0, throttle: 0, brake: 0, drift: false, driftPress: false };
const body = (n = 1) => new KartBody(VEHICLES[0].stats, CHARACTERS[0], n);
const worldFor = (main: TrackPath): PhysWorld => ({ main, paths: [main], pads: [], lowGravity: [], voidY: -50 });

describe('road contact', () => {
  it('moves pooled wheels with the current parent pose rather than the previous frame', () => {
    const parent = new THREE.Group(), root = new THREE.Group(), wheel = new THREE.Group(), spin = new THREE.Group();
    parent.add(root);
    root.add(wheel);
    wheel.position.y = 0.45;
    wheel.add(spin);
    parent.updateMatrixWorld(true);
    const vehicle = { root, wheels: [{ g: wheel, spin, spec: { r: 0.45, w: 0.3, hub: '#FFFFFF' } }] } as unknown as VehicleModel;
    const pool = new WheelPool([vehicle]);
    parent.position.set(10, 3, 5);
    parent.rotation.y = 0.7;
    pool.update();
    const matrix = new THREE.Matrix4();
    (pool.group.children[0] as THREE.InstancedMesh).getMatrixAt(0, matrix);
    expect(new THREE.Vector3().setFromMatrixPosition(matrix).distanceTo(new THREE.Vector3(10, 3.45, 5))).toBeLessThan(0.00001);
  });
  it('keeps projected and displayed heights continuous across all banked tracks', () => {
    const v = new THREE.Vector3(), pr = new Proj();
    for (const def of TRACKS) {
      const { main, shortcuts } = buildPaths(def);
      for (const path of [main, ...shortcuts]) {
        for (let i = 0; i < path.n - 1; i += 7) {
          for (const side of [-0.9, 0, 0.9]) {
            if (path.loopAt((i + 0.37) * path.ds)) continue;
            path.pointAt((i + 0.37) * path.ds, side * path.halfW[i], v);
            path.project(v.x, v.y, v.z, i, pr);
            expect(Math.abs(pr.y - v.y), `${def.id} sample ${i}`).toBeLessThan(0.025);
          }
        }
      }
    }
  });

  it('fits the wheel plane to banking and hills in forward, reverse and sideways headings', () => {
    const p = new TrackPath([[0, 0, 0], [0, 10, 100]], false, 20, [8, 8]);
    const pr = p.project(0, 5, 50, -1, new Proj());
    for (const yaw of [0, Math.PI / 2, Math.PI, -Math.PI / 2, 0.7]) {
      const pose = groundPose(pr, yaw);
      const rotation = new THREE.Euler(pose.pitch, 0, pose.roll);
      const normal = new THREE.Vector3(0, 1, 0).applyEuler(rotation).applyAxisAngle(new THREE.Vector3(0, 1, 0), yaw);
      const expected = new THREE.Vector3(pr.bankTan, 1, -0.1).normalize();
      expect(normal.distanceTo(expected)).toBeLessThan(0.001);
    }
  });

  it('recomputes banked contact height after wall correction', () => {
    const p = new TrackPath([[0, 0, 0], [0, 0, 100]], false, 20, [9, 9], 2);
    const w = worldFor(p), k = body();
    k.place(w, 50, -13);
    k.step(1 / 120, idle, w);
    const pr = p.project(k.x, k.y, k.z, -1, new Proj());
    expect(Math.abs(pr.t)).toBeLessThan(12);
    expect(k.y).toBeCloseTo(pr.y, 5);
  });

  it('does not teleport a falling kart up through the underside of a road', () => {
    const p = new TrackPath([[0, 10, 0], [0, 10, 100]], false, 20, [0, 0]);
    const w = worldFor(p), k = body();
    k.place(w, 50, 0);
    k.y = 7;
    k.grounded = false;
    k.vy = -4;
    k.step(1 / 120, idle, w);
    expect(k.grounded).toBe(false);
    expect(k.y).toBeLessThan(7);
  });

  it('lands from high jumps without snapping to a distant ramp or bank', () => {
    const p = new TrackPath([[0, 0, 0], [0, 0, 100]], false, 20, [0, 0]);
    const w = worldFor(p), k = body();
    k.place(w, 50, 0);
    k.y = 12;
    k.grounded = false;
    for (let i = 0; i < 180; i++) k.step(1 / 120, idle, w);
    expect(k.grounded).toBe(true);
    expect(k.y).toBe(0);
  });

  it('matches collision gaps to the missing rendered segments', () => {
    const p = new TrackPath([[0, 0, 0], [0, 0, 100]], false, 20, [0, 0]);
    p.gap[50] = 1;
    const v = p.pointAt(49.5 * p.ds, 0, new THREE.Vector3());
    expect(p.project(v.x, v.y, v.z, 49, new Proj()).gap).toBe(true);
  });

  it('includes ramp slope in the contact normal', () => {
    const p = new TrackPath([[0, 0, 0], [0, 0, 100]], false, 20, [0, 0]);
    p.ramps.push({ s0: 40, s1: 50, t0: -5, t1: 5, h: 3, trick: true });
    const pr = p.project(0, 2, 46, -1, new Proj());
    expect(pr.fy / Math.hypot(pr.fx, pr.fz)).toBeCloseTo(0.3, 4);
  });

  it('keeps shortcut bends wide enough to avoid folded road edges', () => {
    for (const def of TRACKS) {
      for (const path of buildPaths(def).shortcuts) {
        for (let i = 0; i < path.n; i++) {
          expect(Math.abs(path.turnRight(i, 2)) * path.halfW[i], `${def.id} shortcut ${i}`).toBeLessThan(0.7);
        }
      }
    }
  });
});

describe('all-track driving regression', () => {
  for (const def of TRACKS) {
    for (const vehicle of def.id === 't8' ? VEHICLES : [VEHICLES[0]]) {
    it(`${def.id}/${vehicle.id}: completes a lap with finite positions and stable grounded contact`, () => {
      const { main, shortcuts } = buildPaths(def);
      const world: PhysWorld = { main, paths: [main, ...shortcuts], pads: [],
        lowGravity: (def.lowGravity ?? []).map(g => [g.u0 * main.length, g.u1 * main.length]),
        voidY: Math.min(...main.py) - 25 };
      const k = new KartBody(vehicle.stats, CHARACTERS[0], world.paths.length), ai = new AIDriver(5, 'balanced', 'hard');
      k.place(world, 0, 0);
      let travelled = 0, last = 0, falls = 0;
      const pr = new Proj();
      for (let step = 0; step < 120 * 120 && travelled < main.length; step++) {
        const ctl = ai.update(1 / 120, k, { world, dangers: [], boxes: [], playerDist: travelled,
          myDist: travelled, hasItem: true, wantsBoost: false, time: step / 120 });
        k.step(1 / 120, ctl, world);
        for (const e of k.takeEvents()) if (e === 'fall') falls++;
        let delta = k.progressS - last;
        if (delta < -main.length / 2) delta += main.length;
        if (delta > main.length / 2) delta -= main.length;
        travelled += delta;
        last = k.progressS;
        expect(Number.isFinite(k.x + k.y + k.z)).toBe(true);
        if (k.grounded && k.respawnT <= 0 && !k.loopActive) {
          world.paths[k.onPath].project(k.x, k.y, k.z, k.hints[k.onPath], pr);
          expect(Math.abs(k.y - pr.y)).toBeLessThan(0.025);
        }
      }
      console.log(`${def.id}/${vehicle.id}: distance=${Math.round(travelled)} falls=${falls}`);
      expect(travelled).toBeGreaterThanOrEqual(main.length);
      expect(falls).toBe(0);
    });
    }
  }
});
