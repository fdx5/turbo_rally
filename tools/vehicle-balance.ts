/** Deterministic solo driving benchmark. No weapons, coins, contact or catch-up.
 * npx tsx tools/vehicle-balance.ts test-results/vehicle-balance/before.json
 * Identical seeds/characters/controllers on every course isolate vehicle tuning.
 * These are lap-time comparisons, not multiplayer win-rate estimates.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { TRACKS } from '../src/data/tracks';
import { VEHICLES } from '../src/data/vehicles';
import { CHAR_BY_ID } from '../src/data/characters';
import { finalStats } from '../src/data/statCurves';
import { buildPaths } from '../src/tracks/trackBuilder';
import { KartBody, type PhysWorld } from '../src/physics/kart';
import { AIDriver } from '../src/ai/driver';

const seeds = [5, 77, 321];
const rows: { track: string; vehicle: string; seed: number; seconds: number; falls: number }[] = [];
for (const track of TRACKS) {
  const { main, shortcuts } = buildPaths(track);
  const world: PhysWorld = {
    main, paths: [main, ...shortcuts],
    pads: [
      ...track.boostPads.map(p => ({ path: main, s: p.u * main.length, t: p.t, halfWid: Math.min(5.4, main.halfW[main.idxAtS(p.u * main.length)] - .8), halfLen: 6 })),
      ...shortcuts.flatMap((p, i) => track.shortcuts[i].boostPad ? [{ path: p, s: p.length * .5, t: 0, halfWid: Math.min(5.4, p.halfW[p.idxAtS(p.length * .5)] - .8), halfLen: 6 }] : []),
    ],
    lowGravity: (track.lowGravity ?? []).map(g => [g.u0 * main.length, g.u1 * main.length]),
    voidY: Math.min(...main.py) - 25,
  };
  for (const vehicle of VEHICLES) for (const seed of seeds) {
    const body = new KartBody(finalStats(vehicle.id, 'lulu'), CHAR_BY_ID.lulu, world.paths.length);
    const driver = new AIDriver(seed, 'balanced', 'hard');
    body.place(world, 0, 0);
    let distance = 0, last = 0, falls = 0, step = 0;
    while (step < 120 * 180 && distance < main.length) {
      const controls = driver.update(1 / 120, body, { world, dangers: [], boxes: [], playerDist: distance,
        myDist: distance, hasItem: true, wantsBoost: false, time: step / 120 });
      body.step(1 / 120, controls, world);
      for (const event of body.takeEvents()) if (event === 'fall') falls++;
      let delta = body.progressS - last;
      if (delta < -main.length / 2) delta += main.length;
      if (delta > main.length / 2) delta -= main.length;
      distance += delta;
      last = body.progressS;
      step++;
    }
    if (distance < main.length) throw new Error(`${track.id}/${vehicle.id}/${seed} did not finish`);
    rows.push({ track: track.id, vehicle: vehicle.id, seed, seconds: step / 120, falls });
  }
  console.log(`${track.id}: ${VEHICLES.length * seeds.length} laps completed`);
}
const averages = VEHICLES.map(v => {
  const laps = rows.filter(r => r.vehicle === v.id);
  return { vehicle: v.id, name: v.name, speed: v.stats.speed,
    meanSeconds: laps.reduce((n, r) => n + r.seconds, 0) / laps.length,
    falls: laps.reduce((n, r) => n + r.falls, 0) };
}).sort((a, b) => a.meanSeconds - b.meanSeconds);
const summary = {
  conditions: { seeds, character: 'lulu', difficulty: 'hard', dt: 1 / 120, laps: rows.length, items: false, coins: false, contact: false, catchUp: false },
  meanSpreadPercent: (averages.at(-1)!.meanSeconds / averages[0].meanSeconds - 1) * 100,
  averages, rows,
};
const output = process.argv[2] ?? 'test-results/vehicle-balance/latest.json';
mkdirSync(dirname(output), { recursive: true });
writeFileSync(output, JSON.stringify(summary, null, 2));
console.log(JSON.stringify({ meanSpreadPercent: summary.meanSpreadPercent, averages }, null, 2));
