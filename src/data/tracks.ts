import { ADVENTURE_TRACKS } from './adventureTracks';
import type { Vec3T } from '../tracks/path';

export type ThemeId =
  | 'candy'
  | 'hangang'
  | 'neon'
  | 'hanok'
  | 'construction'
  | 'icecream'
  | 'jeju'
  | 'rainbow'
  | 'cavern'
  | 'volcano'
  | 'forest'
  | 'desert'
  | 'antarctic'
  | 'ocean'
  | 'clockwork'
  | 'canyon'
  | 'abyss'
  | 'bamboo';
export type SurfaceName = 'dirt' | 'ice' | 'water' | 'choco' | 'sand';

export type HazardDef =
  | {
      type: 'roller';
      model: 'donut' | 'snowball' | 'tangerine' | 'gourd';
      u: number;
      period: number;
      radius: number;
    }
  | { type: 'crosser'; model: 'duckboat' | 'bus'; u: number; period: number; radius: number }
  | { type: 'swinger'; model: 'crane'; u: number; period: number; len: number }
  | { type: 'dropper'; model: 'crate'; u0: number; u1: number; interval: number }
  | { type: 'spinner'; model: 'stars'; u: number; period: number; len: number }
  | { type: 'wave'; u0: number; u1: number; period: number }
  | { type: 'kite'; u: number; period: number }
  | {
      type: 'downhill';
      model: 'gourd' | 'snowball' | 'tangerine';
      u0: number;
      u1: number;
      interval: number;
      radius: number;
    };

export interface ShortcutDef {
  fromU: number;
  toU: number;
  via: Vec3T[];
  width: number;
  surface: SurfaceName | 'road';
  boostPad?: boolean;
  label?: string;
  loops?: { u0: number; u1: number; radius: number }[];
}

export interface TrackDef {
  id: string;
  no: number;
  name: string;
  theme: ThemeId;
  bpm: number;
  desc: string;
  points: Vec3T[];
  width: number | number[];
  shoulder?: number;
  boostPads: { u: number; t: number }[];
  ramps: { u: number; len: number; h: number; t0?: number; t1?: number }[];
  itemRows: number[];
  coins: { u: number; t: number; n: number }[];
  zones: { u0: number; u1: number; t0: number; t1: number; surface: SurfaceName }[];
  noWall?: { u0: number; u1: number; side: 'L' | 'R' | 'both' }[];
  gaps?: { u0: number; u1: number }[];
  shortcuts: ShortcutDef[];
  hazards: HazardDef[];
  lowGravity?: { u0: number; u1: number }[];
  tunnel?: { u0: number; u1: number }[];
  bridge?: { u0: number; u1: number }[];
  voidWorld?: boolean;
  water?: { y: number; color: string; area?: 'all' | 'side' };
  medals: { gold: number; silver: number; bronze: number };
  par: number;
  grades?: { u0: number; u1: number; h: number }[];
  loops?: { u0: number; u1: number; radius: number }[];
  adventures?: { u0: number; u1: number; kind: 'cave' | 'lava' | 'glacier' | 'ruins' }[];
}

export const TRACKS: TrackDef[] = ADVENTURE_TRACKS;
export const TRACK_BY_ID: Record<string, TrackDef> = Object.fromEntries(TRACKS.map((t) => [t.id, t]));
