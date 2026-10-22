import { CHAR_BY_ID, type CharId } from './characters';
import { STAT_KEYS, VEHICLE_BY_ID, type Stats } from './vehicles';

export function finalStats(vehicleId: string, charId: CharId): Stats {
  const v = VEHICLE_BY_ID[vehicleId].stats;
  const m = CHAR_BY_ID[charId].mods;
  const out = { ...v };
  for (const k of STAT_KEYS) out[k] = Math.max(1, Math.min(10, v[k] + (m[k] ?? 0)));
  return out;
}

const L = (a: number, b: number, stat: number) => a + ((b - a) * (stat - 1)) / 9;

/** Physical tuning derived from 1..10 stats (internal units: metres / seconds). */
export interface Tuning {
  topSpeed: number; // m/s
  accelTime: number; // s to reach top speed
  turnRate: number; // rad/s at mid speed
  mass: number;
  driftTurn: number; // rad/s base drift yaw
  driftCharge: number; // charge-rate multiplier
  driftDuration: number; // mini-turbo duration multiplier
  offroadFactor: number; // fraction of top speed on offroad
  stunDuration: number; // weight-based spin/stop/launch duration multiplier
}
export function tuning(st: Stats): Tuning {
  return {
    // Keep a straight-line advantage without making speed outweigh every other stat.
    topSpeed: L(29.8, 32.2, st.speed),
    accelTime: L(3.4, 1.35, st.accel),
    turnRate: L(1.55, 2.35, st.handling),
    mass: L(0.7, 1.6, st.weight),
    driftTurn: L(1.15, 1.75, st.drift),
    driftCharge: L(0.8, 1.4, st.drift),
    driftDuration: L(0.9, 1.25, st.drift),
    offroadFactor: L(0.55, 0.9, st.offroad),
    stunDuration: L(1, 0.8, st.weight),
  };
}
/** Use the same physical speed for the HUD and vehicle selection. */
export const displayKmh = (ms: number) => Math.round(ms * 3.6);
export const displayTopKmh = (stat: number) => displayKmh(L(29.8, 32.2, stat));
