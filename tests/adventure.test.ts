import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { TRACKS } from '../src/data/tracks';
import { buildPaths } from '../src/tracks/trackBuilder';
import { roadFrame } from '../src/tracks/path';
import { boostPadGeometry } from '../src/tracks/boostPads';
import { KartBody, type PhysWorld } from '../src/physics/kart';
import { VEHICLES } from '../src/data/vehicles';
import { CHARACTERS } from '../src/data/characters';
import { AIDriver } from '../src/ai/driver';

describe('adventure circuits', () => {
  it('replaces every layout with elevation, independent route choices and real jump gaps', () => {
    for (const def of TRACKS) {
      const { main, shortcuts } = buildPaths(def);
      expect(Math.max(...main.py) - Math.min(...main.py), def.id).toBeGreaterThan(55);
      expect(shortcuts.length, def.id).toBeGreaterThanOrEqual(2);
      expect(def.gaps?.length, def.id).toBeGreaterThan(0);
      expect(def.ramps.length, def.id).toBeGreaterThan(0);
      for (const gap of def.gaps ?? []) {
        const ramp = def.ramps.find(r => r.u < gap.u0 && gap.u0 - r.u < 0.005);
        expect(ramp, def.id).toBeDefined();
      }
    }
  });

  it('keeps boost artwork entirely above the rendered banked/hilly/ramped road', () => {
    const actual = new THREE.Vector3(), base = new THREE.Vector3();
    for (const def of TRACKS) {
      const { main, shortcuts } = buildPaths(def);
      const pads = def.boostPads.map(p => ({ path: main, s: p.u * main.length, t: p.t }));
      for (const path of shortcuts) pads.push({ path, s: path.length * 0.5, t: 0 });
      for (const { path, s, t } of pads) {
        const width = Math.min(5.4, path.halfW[path.idxAtS(s)] - 0.8);
        const g = boostPadGeometry(path, s, t, 6, width);
        const pos = g.attributes.position, uv = g.attributes.uv;
        let minimumLift = Infinity;
        for (let v = 0; v < pos.count; v++) {
          actual.fromBufferAttribute(pos, v);
          path.pointAt(s - 6 + uv.getY(v) * 12, t - width + uv.getX(v) * width * 2, base);
          minimumLift = Math.min(minimumLift, actual.distanceTo(base));
        }
        expect(minimumLift, def.id).toBeGreaterThan(0.139);
        g.dispose();
      }
    }
  });

  for (const def of TRACKS.filter(t => t.loops?.length)) {
    it(`${def.id}: drives a complete inverted loop and leaves on the road`, () => {
      const { main } = buildPaths(def), loop = main.loops[0];
      const world: PhysWorld = { main, paths: [main], pads: [], lowGravity: [], voidY: Math.min(...main.py) - 25 };
      const k = new KartBody(VEHICLES[0].stats, CHARACTERS[0], 1);
      k.place(world, loop.s0 - 1, 0); k.speed = 28;
      let entered = false, inverted = false;
      for (let n = 0; n < 2000 && k.progressS <= loop.s1 + 3; n++) {
        k.step(1 / 120, { steer: 0, throttle: 1, brake: 0, drift: false, driftPress: false }, world);
        entered ||= k.loopActive;
        inverted ||= k.loopActive && k.loopFrame.uy < -0.95;
        expect(Number.isFinite(k.x + k.y + k.z)).toBe(true);
        expect(k.respawnT).toBeLessThanOrEqual(0);
      }
      expect(entered).toBe(true); expect(inverted).toBe(true);
      expect(k.progressS).toBeGreaterThan(loop.s1);
      expect(k.loopActive).toBe(false); expect(k.grounded).toBe(true);
      const frame = main.frameAt((loop.s0 + loop.s1) / 2, roadFrame());
      expect(frame.uy).toBeLessThan(-0.95);
      expect(Math.hypot(frame.ux, frame.uy, frame.uz)).toBeCloseTo(1, 5);
    });
  }

  for (const def of TRACKS) for (const [index, path] of buildPaths(def).shortcuts.entries()) {
    it(`${def.id}: optional route ${index + 1} is independently drivable`, () => {
      const world: PhysWorld = { main: path, paths: [path], pads: [], lowGravity: [], voidY: Math.min(...path.py) - 25 };
      const k = new KartBody(VEHICLES[0].stats, CHARACTERS[0], 1), ai = new AIDriver(5, 'balanced', 'hard');
      k.place(world, 1, 0);
      let falls = 0;
      for (let n = 0; n < 14400 && k.progressS < path.length - 5; n++) {
        k.step(1 / 120, ai.update(1 / 120, k, { world, dangers: [], boxes: [], playerDist: 0, myDist: 0, hasItem: true, wantsBoost: false, time: n / 120 }), world);
        for (const e of k.takeEvents()) if (e === 'fall') falls++;
      }
      expect(k.progressS).toBeGreaterThanOrEqual(path.length - 5);
      expect(falls).toBe(0);
    });
  }
});
