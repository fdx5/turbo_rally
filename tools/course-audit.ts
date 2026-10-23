import { TRACKS } from '../src/data/tracks';
import { buildPaths } from '../src/tracks/trackBuilder';
import { KartBody, type PhysWorld } from '../src/physics/kart';
import { AIDriver } from '../src/ai/driver';
import { VEHICLES } from '../src/data/vehicles';
import { CHARACTERS } from '../src/data/characters';

const ids = process.argv[2]?.split(',');
for (const def of TRACKS.filter((t) => !ids || ids.includes(t.id))) {
  const { main, shortcuts } = buildPaths(def);
  const summary = [];
  for (const seed of [0, 5, 17, 29]) {
    const paths = seed === 0 ? [main] : [main, ...shortcuts];
    const world: PhysWorld = {
      main,
      paths,
      lowGravity: (def.lowGravity ?? []).map((g) => [g.u0 * main.length, g.u1 * main.length]),
      voidY: Math.min(...main.py) - 30,
      pads: def.boostPads
        .map((p) => ({ path: main, s: p.u * main.length, t: p.t, halfLen: 4, halfWid: 5 }))
        .concat(
          seed === 0
            ? []
            : shortcuts.flatMap((path, i) =>
                def.shortcuts[i].boostPad
                  ? [{ path, s: path.length * 0.5, t: 0, halfLen: 4, halfWid: 5 }]
                  : [],
              ),
        ),
    };
    const kart = new KartBody(VEHICLES[0].stats, CHARACTERS[0], paths.length),
      ai = new AIDriver(seed || 5, 'balanced', 'normal');
    kart.place(world, 0, 0);
    let travelled = 0,
      last = 0,
      falls = 0,
      step = 0,
      maxDelta = 0;
    const used = new Set<number>();
    for (; step < 120 * 500 && travelled < main.length * 2; step++) {
      const ctl = ai.update(1 / 120, kart, {
        world,
        dangers: [],
        boxes: [],
        playerDist: travelled,
        myDist: travelled,
        hasItem: true,
        wantsBoost: false,
        time: step / 120,
      });
      kart.step(1 / 120, ctl, world);
      if (kart.onPath > 0 && kart.proj.s > 90 && kart.proj.s < paths[kart.onPath].length - 90)
        used.add(kart.onPath);
      let delta = kart.progressS - last;
      if (delta < -main.length / 2) delta += main.length;
      if (delta > main.length / 2) delta -= main.length;
      travelled += delta;
      last = kart.progressS;
      maxDelta = Math.max(maxDelta, Math.abs(delta));
      for (const e of kart.takeEvents()) if (e === 'fall') falls++;
    }
    summary.push({
      seed,
      lap: +(step / 120 / 2).toFixed(2),
      complete: travelled >= main.length * 2,
      falls,
      used: [...used],
      progress: +(travelled / main.length).toFixed(3),
      endPath: kart.onPath,
      endS: +kart.proj.s.toFixed(1),
      maxDelta: +maxDelta.toFixed(1),
    });
  }
  const meanSeconds = summary.reduce((sum, run) => sum + run.lap, 0) / summary.length;
  if (summary.some((run) => !run.complete || run.falls > 0) || meanSeconds < 120 || meanSeconds > 180)
    process.exitCode = 1;
  console.log(
    JSON.stringify({
      id: def.id,
      length: Math.round(main.length),
      laps: def.laps,
      meanSeconds: +meanSeconds.toFixed(2),
      shortcuts: shortcuts.map((p) => ({
        length: Math.round(p.length),
        ratio: +(p.length / (p.mainS1 - p.mainS0)).toFixed(2),
      })),
      runs: summary,
    }),
  );
}
