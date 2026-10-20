import type * as THREE from 'three';
import type { KartBody } from '../physics/kart';
import type { AIDriver } from '../ai/driver';
import type { CharId } from '../data/characters';
import type { CosmeticLoadout } from '../characters/cosmeticBuild';
import type { KartModel } from './kartModel';

export interface ItemStat {
  used: number;
  hits: number;
  gotHit: number;
}
export interface Racer {
  slot: number;
  isPlayer: boolean;
  charId: CharId;
  vehicleId: string;
  name: string;
  loadout: CosmeticLoadout;
  weapons: string[];
  body: KartBody;
  model: KartModel;
  ai: AIDriver | null;
  // items
  items: string[]; // [current, next]
  roulette: { t: number; dur: number; result: string; second?: string } | null;
  orbit: { model: string; count: number; objs: THREE.Object3D[] } | null;
  trailing: { id: string; obj: THREE.Object3D } | null;
  shieldHits: number;
  shieldT: number;
  reflect: boolean;
  knockShield: boolean;
  usesLeft: number; // multi-use boosts (triple sugar)
  gauge: number; // unique skill 0..100
  skillT: number;
  lockTarget: Racer | null;
  // race
  lap: number;
  cp: number;
  raceDist: number;
  prevS: number;
  finished: boolean;
  finishMs: number;
  lapStartMs: number;
  lapTimes: number[];
  bestLap: number;
  position: number;
  lastPosition: number;
  posChangeT: number;
  stats: Record<string, ItemStat>;
  hitsDealt: number;
  hitsTaken: number;
  // misc
  voiceCooldown: number;
  hitFxT: number;
  started: boolean;
  rocketPress: number; // first throttle time during countdown
}

export function stat(r: Racer, id: string): ItemStat {
  return (r.stats[id] ??= { used: 0, hits: 0, gotHit: 0 });
}
