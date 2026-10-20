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
  offroadFactor: number; // fraction of top speed on offroad
}
export function tuning(st: Stats): Tuning {
  return {
    topSpeed: L(26.5, 33.5, st.speed),
    accelTime: L(3.2, 1.6, st.accel),
    turnRate: L(1.55, 2.35, st.handling),
    mass: L(0.7, 1.6, st.weight),
    driftTurn: L(1.15, 1.75, st.drift),
    driftCharge: L(0.85, 1.18, st.drift),
    offroadFactor: L(0.42, 0.8, st.offroad),
  };
}
/** Display speed (km/h) — 1 → 80 km/h, 10 → 115 km/h at top speed. */
export const displayKmh = (ms: number) =>
  Math.round(ms <= 26.5 ? ms * (80 / 26.5) : 80 + (ms - 26.5) * (35 / 7));
export const displayTopKmh = (stat: number) => Math.round(L(80, 115, stat));
