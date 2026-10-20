import { create } from 'zustand';

export interface Standing {
  slot: number;
  name: string;
  charId: string;
  position: number;
  isPlayer: boolean;
  finished: boolean;
}
export interface HudState {
  active: boolean;
  phase: 'loading' | 'intro' | 'countdown' | 'race' | 'finish' | 'done';
  trackName: string;
  countdown: string;
  position: number;
  lap: number;
  laps: number;
  timeMs: number;
  lapFlash: string;
  items: string[];
  rouletteIcon: string | null;
  gauge: number;
  skillIcon: string;
  skillReady: boolean;
  coins: number;
  maxCoins: number;
  kmh: number;
  wrongWay: boolean;
  finalLap: boolean;
  toasts: { id: number; text: string; color?: string }[];
  blindUntil: number;
  flashUntil: number;
  reversed: boolean;
  sealed: boolean;
  mtLevel: number;
  standings: Standing[];
  mode: 'race' | 'timeattack' | 'practice';
  ghostDelta: number | null;
  paused: boolean;
  fps: number;
  draws: number;
  tris: number;
  slip: number;
  boost: boolean;
}
export const useHud = create<HudState & { set: (p: Partial<HudState>) => void; toast: (text: string, color?: string) => void }>((set, get) => ({
  active: false,
  phase: 'loading',
  trackName: '',
  countdown: '',
  position: 1,
  lap: 1,
  laps: 3,
  timeMs: 0,
  lapFlash: '',
  items: [],
  rouletteIcon: null,
  gauge: 0,
  skillIcon: '⚡',
  skillReady: false,
  coins: 0,
  maxCoins: 10,
  kmh: 0,
  wrongWay: false,
  finalLap: false,
  toasts: [],
  blindUntil: 0,
  flashUntil: 0,
  reversed: false,
  sealed: false,
  mtLevel: 0,
  standings: [],
  mode: 'race',
  ghostDelta: null,
  paused: false,
  fps: 0,
  draws: 0,
  tris: 0,
  slip: 0,
  boost: false,
  set: (p) => set(p),
  toast: (text, color) => {
    const id = Math.random();
    set({ toasts: [...get().toasts.slice(-2), { id, text, color }] });
    setTimeout(() => set({ toasts: get().toasts.filter((t) => t.id !== id) }), 1600);
  },
}));
/** minimap canvas is registered by the HUD component and drawn by the race session */
export const minimapRef: { canvas: HTMLCanvasElement | null } = { canvas: null };
