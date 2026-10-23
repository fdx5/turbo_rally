import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { TRACKS } from '../src/data/tracks';
import { BASIC_ITEMS } from '../src/data/items';
import { PAD_BOOST_SECONDS, ITEM_BOOST_SECONDS } from '../src/data/raceTuning';
import { TrackPath, Proj } from '../src/tracks/path';
import { buildPaths } from '../src/tracks/trackBuilder';
import { KartBody, type PhysWorld } from '../src/physics/kart';
import { KartContacts } from '../src/physics/contacts';
import { CHARACTERS } from '../src/data/characters';
import { VEHICLES } from '../src/data/vehicles';
import { recordReplayFrame, sampleReplay } from '../src/race/replay';
import { AIDriver } from '../src/ai/driver';

const idle = { steer: 0, throttle: 0, brake: 0, drift: false, driftPress: false };
const worldFor = (p: TrackPath): PhysWorld => ({
  main: p,
  paths: [p],
  pads: [],
  lowGravity: [],
  voidY: -100,
});
const kart = () => new KartBody(VEHICLES[0].stats, CHARACTERS[0], 1);
const straight = () =>
  new TrackPath(
    [
      [0, 0, 0],
      [0, 0, 1000],
    ],
    false,
    20,
    [0, 0],
  );

describe('adventure driving safety', () => {
  it('provides sixteen distinctive circuits without magnetic-loop roads', () => {
    expect(TRACKS).toHaveLength(16);
    expect(new Set(TRACKS.map((t) => t.theme)).size).toBe(16);
    expect(new Set(TRACKS.map((t) => JSON.stringify(t.points))).size).toBe(16);
    for (const t of TRACKS) expect(t.loops?.length ?? 0, t.id).toBe(0);
  });

  it('provides steep climbs and readable sharp bends without folding the main road edges', () => {
    for (const def of TRACKS) {
      const p = buildPaths(def).main;
      const maxGrade = Math.max(...Array.from(p.fy, (v, i) => Math.abs(v / Math.hypot(p.fx[i], p.fz[i]))));
      expect(maxGrade, def.id).toBeGreaterThan(0.12);
      expect(maxGrade, def.id).toBeLessThan(1.2);
      for (let i = 0; i < p.n; i++)
        expect(Math.abs(p.turnRight(i, 3)) * (p.halfW[i] + 4), def.id).toBeLessThan(0.95);
    }
  });

  it('keeps branch mouths on the main road plane until the two lanes separate', () => {
    const pr = new Proj();
    for (const def of TRACKS) {
      const { main, shortcuts } = buildPaths(def);
      for (const p of shortcuts)
        for (let i = 0; i < p.n; i += 5) {
          const distance = Math.min(i * p.ds, p.length - i * p.ds);
          if (distance > Math.min(130, p.length * 0.29)) continue;
          main.project(p.px[i], p.py[i], p.pz[i], -1, pr);
          // Unrelated flyovers may cross the mouth in plan but on a different deck.
          const connectedS = i * p.ds < p.length / 2 ? p.mainS0 + distance : p.mainS1 - distance;
          const stationDistance = Math.abs(pr.s - connectedS);
          if (stationDistance < 160 && Math.abs(pr.t) < pr.halfW + p.halfW[i] + 4)
            expect(Math.abs(p.py[i] - pr.y), `${def.id} join ${i}`).toBeLessThan(0.2);
        }
    }
  });

  it('blocks fast upward jumps at bridge undersides and catches fast landings', () => {
    const p = new TrackPath(
        [
          [0, 10, 0],
          [0, 10, 100],
        ],
        false,
        20,
        [0, 0],
      ),
      w = worldFor(p),
      k = kart();
    k.place(w, 50, 0);
    k.y = 7.5;
    k.grounded = false;
    k.vy = 100;
    for (let i = 0; i < 6; i++) k.step(1 / 120, idle, w);
    expect(k.y + 1.4).toBeLessThan(10);
    expect(k.vy).toBeLessThanOrEqual(0);
    k.y = 12;
    k.vy = -250;
    k.grounded = false;
    k.step(1 / 120, idle, w);
    expect(k.grounded).toBe(true);
    expect(k.y).toBeCloseTo(10, 4);
  });

  it('never drags or repeatedly penalizes touching karts', () => {
    const p = straight(),
      w = worldFor(p),
      a = kart(),
      b = kart(),
      contact = new KartContacts();
    a.place(w, 50, 0);
    b.place(w, 51, 0);
    a.speed = 32;
    b.speed = 24;
    a.shrinkT = 5;
    const az = a.z,
      bz = b.z;
    let sounds = 0;
    for (let i = 0; i < 600; i++) if (contact.resolve(a, b, '0:1', w)) sounds++;
    expect(a.speed).toBe(32);
    expect(b.speed).toBe(24);
    expect(a.z).toBe(az);
    expect(b.z).toBe(bz);
    expect(a.vl).toBe(0);
    expect(b.vl).toBe(0);
    expect(a.squashT).toBe(0);
    expect(b.squashT).toBe(0);
    expect(sounds).toBe(1);
  });
});

describe('guaranteed item boost', () => {
  it('lasts twice as long as a pad for each sugar charge', () => {
    expect(ITEM_BOOST_SECONDS).toBe(PAD_BOOST_SECONDS * 2);
    for (const item of BASIC_ITEMS)
      if (item.behavior.kind === 'boost') {
        expect(item.behavior.dur, item.id).toBe(PAD_BOOST_SECONDS * 2);
      }
  });
  it('adds all three charges and cannot be shortened by pads or mini-turbos', () => {
    const k = kart(),
      w = worldFor(straight());
    k.place(w, 50, 0);
    for (let i = 0; i < 3; i++) k.boostItem(ITEM_BOOST_SECONDS, 1.35);
    k.boost(PAD_BOOST_SECONDS, 1.35, true);
    k.boost(0.6, 1.2);
    expect(k.itemBoostT).toBe(6);
    expect(k.boostT).toBe(6);
    for (let i = 0; i < 120; i++) k.step(1 / 120, idle, w);
    expect(k.itemBoostT).toBeCloseTo(5, 5);
    expect(k.boostT).toBeCloseTo(5, 5);
  });
  it('preserves paid-for boost time while the kart cannot move', () => {
    const k = kart(),
      w = worldFor(straight());
    k.place(w, 50, 0);
    k.freezeT = 1;
    k.boostItem(2, 1.35);
    for (let i = 0; i < 60; i++) k.step(1 / 120, idle, w);
    expect(k.itemBoostT).toBe(2);
    expect(k.boostT).toBe(2);
    k.freezeT = 0;
    k.step(1 / 120, idle, w);
    expect(k.itemBoostT).toBeCloseTo(2 - 1 / 120, 5);
  });
});

describe('airborne 360 trick and replay contact', () => {
  for (const def of TRACKS)
    it(`${def.id}: completes a 360 trick over its marked road gap`, () => {
      const p = buildPaths(def).main,
        w = worldFor(p),
        k = kart(),
        ai = new AIDriver(5, 'balanced', 'hard');
      k.place(w, def.ramps[0].u * p.length - 70, 0);
      k.speed = 30;
      let maximum = 0,
        performed = false,
        landed = false,
        falls = 0;
      for (let i = 0; i < 1200; i++) {
        const controls = ai.update(1 / 120, k, {
          world: w,
          dangers: [],
          boxes: [],
          playerDist: 0,
          myDist: 0,
          hasItem: true,
          wantsBoost: false,
          time: i / 120,
        });
        if (k.trickReady && k.airT > 0.15 && !k.tricked) controls.driftPress = true;
        k.step(1 / 120, controls, w);
        performed ||= k.tricked;
        maximum = Math.max(maximum, k.trickAngle);
        for (const e of k.takeEvents()) if (e === 'fall') falls++;
        if (performed && k.grounded) {
          landed = true;
          break;
        }
      }
      expect(performed).toBe(true);
      expect(landed).toBe(true);
      expect(maximum).toBeCloseTo(Math.PI * 2, 4);
      expect(falls).toBe(0);
      expect(k.y).toBeCloseTo(k.proj.y, 4);
    });
  it('completes a full air spin without changing the ballistic jump and fits the road on landing', () => {
    const p = straight(),
      w = worldFor(p),
      k = kart();
    k.place(w, 50, 0);
    k.y = 8;
    k.vy = 3;
    k.grounded = false;
    k.airT = 0.2;
    expect(k.startAirTrick()).toBe(true);
    let maximum = 0;
    for (let i = 0; i < 180 && !k.grounded; i++) {
      const vy = k.vy,
        y = k.y;
      k.step(1 / 120, idle, w);
      maximum = Math.max(maximum, k.trickAngle);
      if (!k.grounded) expect(k.y).toBeCloseTo(y + (vy - 34 / 120) / 120, 5);
    }
    expect(maximum).toBeCloseTo(Math.PI * 2, 5);
    expect(k.grounded).toBe(true);
    expect(k.y).toBe(0);
    expect(k.trickAngle).toBe(0);
    expect(k.boostT).toBeGreaterThan(0);
  });
  it('rejects a last-moment spin instead of holding the kart above the road', () => {
    const w = worldFor(straight()),
      k = kart();
    k.place(w, 50, 0);
    k.y = 0.05;
    k.vy = -10;
    k.grounded = false;
    expect(k.startAirTrick()).toBe(false);
    k.step(1 / 120, idle, w);
    expect(k.grounded).toBe(true);
    expect(k.y).toBe(0);
  });
  it('fits replay wheels to steep banked roads rather than interpolating an airborne chord', () => {
    const p = new TrackPath(
        [
          [0, 0, 0],
          [0, 25, 70],
          [0, 25, 140],
        ],
        false,
        20,
        [9, 9, 9],
      ),
      w = worldFor(p),
      k = kart(),
      data: number[] = [];
    k.place(w, 50, 3);
    const s0 = k.proj.s;
    recordReplayFrame(data, k);
    k.place(w, 54, 3);
    const s1 = k.proj.s;
    recordReplayFrame(data, k);
    const pos = new THREE.Vector3(),
      q = new THREE.Quaternion(),
      pr = new Proj();
    expect(sampleReplay(new Float32Array(data), 0.025, [p], pos, q)).toBe(true);
    const expected = p.pointAt((s0 + s1) / 2, 3, new THREE.Vector3());
    pos.addScaledVector(new THREE.Vector3(0, 1, 0).applyQuaternion(q), -0.025);
    expect(pos.distanceTo(expected)).toBeLessThan(0.0001);
    p.project(pos.x, pos.y, pos.z, -1, pr);
    expect(pos.y).toBeCloseTo(pr.y, 4);
  });
  it('records full air-spin orientation and hides recordings from retired layouts', () => {
    const p = straight(),
      w = worldFor(p),
      k = kart(),
      data: number[] = [];
    k.place(w, 50, 0);
    k.y = 8;
    k.grounded = false;
    k.vy = 0;
    k.trickAngle = Math.PI - 0.1;
    recordReplayFrame(data, k);
    k.trickAngle = Math.PI + 0.1;
    recordReplayFrame(data, k);
    const pos = new THREE.Vector3(),
      q = new THREE.Quaternion();
    expect(sampleReplay(new Float32Array(data), 0.025, [p], pos, q)).toBe(true);
    expect(new THREE.Vector3(0, 0, 1).applyQuaternion(q).z).toBeCloseTo(-1, 5);
    expect(sampleReplay(new Float32Array([0, 0, 0, 0, 1, 0, 0, 0]), 0, [p], pos, q)).toBe(false);
  });
  it('uses recorded timestamps when frame intervals vary', () => {
    const p = straight(),
      w = worldFor(p),
      k = kart(),
      data: number[] = [];
    k.place(w, 50, 0);
    k.grounded = false;
    k.y = 8;
    k.vy = 0;
    recordReplayFrame(data, k, 0.04);
    k.z += 8;
    recordReplayFrame(data, k, 0.12);
    const pos = new THREE.Vector3(),
      q = new THREE.Quaternion();
    expect(sampleReplay(new Float32Array(data), 0.08, [p], pos, q)).toBe(true);
    expect(pos.z).toBeCloseTo(k.z - 4, 4);
  });
});
