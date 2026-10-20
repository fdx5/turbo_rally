import { create } from 'zustand';
import type { Difficulty } from '../ai/driver';
import type { CharId } from '../data/characters';
import type { RaceResult } from '../race/race';
import type { RaceApplyOutput } from '../../shared/progress';

export type Screen =
  | 'loading'
  | 'title'
  | 'menu'
  | 'mode'
  | 'track'
  | 'character'
  | 'vehicle'
  | 'race'
  | 'results'
  | 'shop'
  | 'dashboard'
  | 'settings'
  | 'missions'
  | 'profile';
export type Modal = 'login' | 'signup' | 'promo' | 'gate' | 'attendance' | 'roulette' | 'rest' | null;

interface AppState {
  screen: Screen;
  prev: Screen[];
  modal: Modal;
  mode: 'race' | 'timeattack' | 'practice';
  difficulty: Difficulty;
  trackId: string;
  lastResult: { result: RaceResult; out: RaceApplyOutput | null } | null;
  lastFinishOrder: CharId[] | null;
  loadingMsg: string;
  loadingPct: number;
  go: (s: Screen) => void;
  back: () => void;
  set: (p: Partial<AppState>) => void;
}
export const useApp = create<AppState>((set, get) => ({
  screen: 'loading',
  prev: [],
  modal: null,
  mode: 'race',
  difficulty: 'normal',
  trackId: 't1',
  lastResult: null,
  lastFinishOrder: null,
  loadingMsg: '',
  loadingPct: 0,
  go: (s) => set({ prev: [...get().prev.slice(-12), get().screen], screen: s }),
  back: () => {
    const p = [...get().prev];
    const s = p.pop() ?? 'menu';
    set({ screen: s === 'race' || s === 'loading' ? 'menu' : s, prev: p });
  },
  set: (p) => set(p),
}));
