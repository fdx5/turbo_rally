import { TRACKS } from '../src/data/tracks';
import { buildPaths } from '../src/tracks/trackBuilder';
import { KartBody, type PhysWorld } from '../src/physics/kart';
import { AIDriver } from '../src/ai/driver';
import { CHARACTERS } from '../src/data/characters';
import { VEHICLES } from '../src/data/vehicles';
let failures = 0;
for (const def of TRACKS.filter((t) => !process.argv[2] || process.argv[2].split(',').includes(t.id))) {
  const { main, shortcuts } = buildPaths(def),
    paths = [main, ...shortcuts];
  const world: PhysWorld = {
    main,
    paths,
    lowGravity: [],
    voidY: Math.min(...main.py) - 30,
    pads: shortcuts.map((path) => ({ path, s: path.length * 0.5, t: 0, halfLen: 4, halfWid: 5 })),
  };
  for (let branch = 1; branch < paths.length; branch++) {
    const path = paths[branch];
    let k: KartBody,
      ai: AIDriver,
      seed = 1;
    for (; ; seed++) {
      k = new KartBody(VEHICLES[0].stats, CHARACTERS[0], paths.length);
      k.place(world, path.mainS0 - 65, 0);
      k.speed = 30;
      ai = new AIDriver(seed, 'balanced', 'normal');
      ai.update(1 / 120, k, {
        world,
        dangers: [],
        boxes: [],
        playerDist: 0,
        myDist: 0,
        hasItem: true,
        wantsBoost: false,
        time: 0,
      });
      if ((ai as unknown as { shortcutPlan: number }).shortcutPlan === branch) break;
      if (seed > 10000) throw new Error('unselectable ' + def.id + '/' + branch);
    }
    let falls = 0,
      used = false,
      complete = false,
      sec = 0;
    for (let i = 0; i < 120 * 140; i++) {
      sec = i / 120;
      const ctl = ai.update(1 / 120, k, {
        world,
        dangers: [],
        boxes: [],
        playerDist: 0,
        myDist: 0,
        hasItem: true,
        wantsBoost: false,
        time: sec,
      });
      k.step(1 / 120, ctl, world);
      if (k.onPath === branch && k.proj.s > path.length * 0.3 && k.proj.s < path.length * 0.7) used = true;
      for (const e of k.takeEvents()) if (e === 'fall') falls++;
      if (used && k.onPath === 0 && k.progressS > path.mainS1 - 80 && k.progressS < path.mainS1 + 250) {
        complete = true;
        break;
      }
    }
    const ok = used && complete && falls === 0;
    if (!ok) failures++;
    console.log(
      JSON.stringify({
        track: def.id,
        branch,
        label: def.shortcuts[branch - 1].label,
        seed,
        ok,
        falls,
        used,
        complete,
        sec: Math.round(sec),
        path: k.onPath,
        s: Math.round(k.proj.s),
      }),
    );
  }
}
if (failures) process.exitCode = 1;
