import { CHARACTERS, type CharId } from '../data/characters';
import { VEHICLES } from '../data/vehicles';
import { COSMETICS, CATEGORIES, type CosCategory } from '../data/cosmetics';
import { WEAPONS } from '../data/items';
import type { Entrant, RaceConfig } from '../race/race';
import type { Profile } from '../../shared/progress';
import type { Difficulty } from '../ai/driver';
import { globalRng } from '../core/rng';
import { TRACK_BY_ID } from '../data/tracks';

/**
 * 8-kart field composition (§4.3): every character races, AI vehicles are 7 distinct ones
 * weighted towards those seen least in the last 5 races, AI wear random cosmetics (shop ads).
 */
export function buildField(p: Profile, mode: RaceConfig['mode'], trackId: string, difficulty: Difficulty, lastOrder: CharId[] | null): RaceConfig {
  const player: Entrant = {
    charId: p.selectedChar,
    vehicleId: p.selectedVehicle,
    loadout: p.equipment[p.selectedChar] ?? {},
    weapons: p.weaponLoadout,
    name: p.nickname || undefined,
  };
  const ai: Entrant[] = [];
  if (mode === 'race') {
    const recent = new Map<string, number>();
    p.recentVehicles.slice(0, 40).forEach((v) => recent.set(v, (recent.get(v) ?? 0) + 1));
    const pool = VEHICLES.filter((v) => v.id !== p.selectedVehicle).map((v) => ({ id: v.id, w: 1 / (1 + (recent.get(v.id) ?? 0)) + globalRng.next() * 0.35 }));
    const chosen: string[] = [];
    while (chosen.length < 7) {
      const tot = pool.reduce((a, b) => a + b.w, 0);
      let x = globalRng.next() * tot;
      let idx = 0;
      for (let i = 0; i < pool.length; i++) {
        x -= pool[i].w;
        if (x <= 0) {
          idx = i;
          break;
        }
      }
      chosen.push(pool.splice(idx, 1)[0].id);
    }
    CHARACTERS.filter((c) => c.id !== p.selectedChar).forEach((c, i) => {
      ai.push({ charId: c.id, vehicleId: chosen[i], loadout: randomLoadout(), weapons: randomWeapons(difficulty) });
    });
  }
  // grid: first race random; afterwards reverse of the previous finishing order
  const entrants = [player, ...ai];
  let gridOrder = entrants.map((_, i) => i);
  if (mode === 'race') {
    if (lastOrder && lastOrder.length === 8) {
      const rev = [...lastOrder].reverse();
      gridOrder = rev.map((cid) => entrants.findIndex((e) => e.charId === cid)).filter((i) => i >= 0);
      if (gridOrder.length !== 8) gridOrder = globalRng.shuffle(entrants.map((_, i) => i));
    } else gridOrder = globalRng.shuffle(entrants.map((_, i) => i));
  }
  return { trackId, mode, difficulty, player, ai, gridOrder, laps: TRACK_BY_ID[trackId]?.laps ?? 3 };
}

function randomLoadout() {
  const lo: Partial<Record<CosCategory, string>> = {};
  for (const cat of CATEGORIES) {
    if (!globalRng.chance(cat.id === 'hat' ? 0.75 : cat.id === 'sunglasses' || cat.id === 'glasses' ? 0.35 : 0.45)) continue;
    if (cat.id === 'glasses' && lo.sunglasses) continue;
    const list = COSMETICS.filter((c) => c.category === cat.id);
    // mostly affordable items, occasionally something shiny to show off (§4.3 "광고")
    const r = globalRng.next();
    const idx = r < 0.55 ? globalRng.int(0, 5) : r < 0.85 ? globalRng.int(6, 10) : r < 0.96 ? globalRng.int(11, 14) : globalRng.int(15, 19);
    lo[cat.id] = list[idx].id;
  }
  return lo;
}
function randomWeapons(d: Difficulty) {
  const n = d === 'easy' ? globalRng.int(0, 1) : d === 'normal' ? globalRng.int(1, 2) : globalRng.int(2, 3);
  return globalRng.shuffle([...WEAPONS]).slice(0, n).map((w) => w.id);
}
