import { create } from 'zustand';

export type QualityLevel = 'auto' | 'low' | 'medium' | 'high' | 'ultra';
export interface Settings {
  quality: QualityLevel;
  bgm: number;
  sfx: number;
  voice: number;
  voiceMode: 'tts' | 'babble';
  screenShake: boolean;
  autoAccel: boolean;
  touchSteer: 'stick' | 'buttons' | 'tilt';
  restReminder: boolean;
  showFps: boolean;
}
const DEFAULTS: Settings = {
  quality: 'auto',
  bgm: 0.7,
  sfx: 0.85,
  voice: 0.9,
  voiceMode: 'tts',
  screenShake: true,
  autoAccel: true,
  touchSteer: 'stick',
  restReminder: true,
  showFps: false,
};
const KEY = 'tr.settings.v1';
function load(): Settings {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return { ...DEFAULTS, ...JSON.parse(raw) };
  } catch {
    /* storage unavailable */
  }
  return { ...DEFAULTS };
}
export const useSettings = create<Settings & { set: (p: Partial<Settings>) => void }>((set, get) => ({
  ...load(),
  set: (p) => {
    set(p);
    try {
      const { set: _s, ...rest } = get();
      localStorage.setItem(KEY, JSON.stringify(rest));
    } catch {
      /* ignore */
    }
  },
}));
export const BRAND_MODE: 'real' | 'parody' = (import.meta.env.VITE_BRAND_MODE as 'real' | 'parody') || 'real';
