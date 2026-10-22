import { describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { finalStats, tuning, displayKmh, displayTopKmh } from '../src/data/statCurves';
import { VEHICLES } from '../src/data/vehicles';
import { CHAR_BY_ID } from '../src/data/characters';
import { KartBody, type PhysWorld } from '../src/physics/kart';
import { TrackPath } from '../src/tracks/path';
import { ItemSystem, type ItemHooks } from '../src/items/itemSystem';
import type { Racer } from '../src/race/types';
import type { TrackWorld } from '../src/tracks/trackBuilder';
import type { FX } from '../src/art/particles';

const path = new TrackPath([[0, 0, 0], [0, 0, 10000]], false, 30, [0, 0]);
const world: PhysWorld = { main: path, paths: [path], pads: [], lowGravity: [], voidY: -50 };
const controls = { steer: 0, throttle: 1, brake: 0, drift: false, driftPress: false };
function body(id: string) {
  const k = new KartBody(finalStats(id, 'lulu'), CHAR_BY_ID.lulu, 1);
  k.place(world, 0, 0);
  return k;
}

describe('vehicle balance', () => {
  it('keeps the entire vehicle roster within a 6% straight-line speed spread', () => {
    const speeds = VEHICLES.map(v => tuning(v.stats).topSpeed);
    expect(Math.max(...speeds) / Math.min(...speeds)).toBeLessThan(1.06);
    expect(body('cybertruck').topSpeed()).toBeGreaterThan(body('yakult').topSpeed());
  });

  it('gives an acceleration kart a real lead off the line, while a speed kart wins a long straight', () => {
    const nimble = body('yakult'), fast = body('cybertruck');
    for (let i = 0; i < 240; i++) {
      nimble.step(1 / 120, controls, world);
      fast.step(1 / 120, controls, world);
    }
    expect(nimble.progressS).toBeGreaterThan(fast.progressS + 3);
    for (let i = 0; i < 120 * 58; i++) {
      nimble.step(1 / 120, controls, world);
      fast.step(1 / 120, controls, world);
    }
    expect(fast.progressS).toBeGreaterThan(nimble.progressS);
    expect(fast.progressS / nimble.progressS).toBeLessThan(1.06);
  });

  it('rewards drift stats through both charge rate and actual mini-turbo duration', () => {
    const nimble = body('scooter'), heavy = body('dump');
    expect(nimble.tune.driftCharge / heavy.tune.driftCharge).toBeGreaterThan(1.25);
    for (const k of [nimble, heavy]) {
      k.speed = 26;
      k.drifting = true;
      k.mtLevel = 3;
      k.step(1 / 120, controls, world);
    }
    expect(nimble.boostT / heavy.boostT).toBeGreaterThan(1.15);
    expect(nimble.boostMult).toBe(heavy.boostMult);
  });

  it('lets offroad vehicles retain more speed on a rough shortcut', () => {
    const rough = body('monster'), road = body('police');
    rough.offroad = road.offroad = true;
    expect(rough.topSpeed()).toBeGreaterThan(road.topSpeed() * 1.2);
  });

  it('shows the actual physical top speed in the selection screen and HUD', () => {
    for (const vehicle of VEHICLES) for (const char of ['lulu', 'piko', 'kkang'] as const) {
      const stats = finalStats(vehicle.id, char);
      expect(displayTopKmh(stats.speed)).toBe(displayKmh(tuning(stats).topSpeed));
    }
  });

  it.each(['spin', 'stop', 'launch'] as const)('gives heavy karts shorter %s hits without shortening shields', (fx) => {
    const light = body('yakult'), heavy = body('excavator');
    for (const k of [light, heavy]) {
      const racer = { body: k, model: { root: new THREE.Group() }, shieldHits: 0, trailing: null, gauge: 0,
        stats: {}, hitsTaken: 0 } as unknown as Racer;
      const hooks = { onHit: vi.fn(), sfx: vi.fn() } as unknown as ItemHooks;
      const particles = { burst: vi.fn() } as unknown as FX;
      const items = new ItemSystem(world as TrackWorld, [racer], particles, hooks);
      expect(items.applyHit(racer, null, 'test-hit', { fx, dur: 1.2, coins: 0 }, false)).toBe(true);
      expect(k.invulT).toBeGreaterThan(1.5);
    }
    expect(fx === 'stop' ? heavy.stopT : heavy.spinT).toBeLessThan((fx === 'stop' ? light.stopT : light.spinT) * .9);
  });
});
