import { create } from 'zustand';
import {
  applyRace,
  buy as buyLocal,
  claimAttendance,
  claimMission,
  equip as equipLocal,
  newProfile,
  refreshDaily,
  setLoadout,
  spinRoulette,
  type Profile,
  type RaceApplyInput,
  type RaceApplyOutput,
} from '../../shared/progress';
import { validateRace } from '../../shared/economy';
import { idbGet, idbSet } from './localdb';
import { api, ApiError, serverAvailable } from './api';
import type { CharId } from '../data/characters';
import type { CosCategory } from '../data/cosmetics';

/**
 * Player profile state. Guests run the shared rules locally (IndexedDB); members send every
 * state change to /api which recomputes gold server-side (§12.2) and returns the new profile.
 */
interface ProfileState {
  profile: Profile;
  loaded: boolean;
  member: boolean;
  server: boolean;
  busy: boolean;
  load: () => Promise<void>;
  save: () => void;
  mutate: (fn: (p: Profile) => void) => void;
  raceStart: (trackId: string, mode: string, difficulty: string) => Promise<{ raceId: string; token: string | null; t0: number }>;
  raceFinish: (ticket: { raceId: string; token: string | null; t0: number }, input: RaceApplyInput) => Promise<RaceApplyOutput | null>;
  buy: (itemId: string) => Promise<string | null>;
  equip: (charId: CharId, itemId: string | null, cat: CosCategory) => Promise<string | null>;
  setLoadout: (ids: string[]) => Promise<string | null>;
  select: (charId: CharId, vehicleId: string) => void;
  claimMission: (id: string) => Promise<string | null>;
  claimAttendance: () => Promise<ReturnType<typeof claimAttendance>>;
  spin: () => Promise<ReturnType<typeof spinRoulette>>;
  signup: (username: string, password: string, nickname: string) => Promise<string | null>;
  login: (username: string, password: string, remember: boolean) => Promise<string | null>;
  logout: () => Promise<void>;
}
const KEY = 'guestProfile';
const uid = () => (crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2) + Date.now().toString(36));

export const useProfile = create<ProfileState>((set, get) => ({
  profile: newProfile(uid()),
  loaded: false,
  member: false,
  server: false,
  busy: false,
  async load() {
    const server = await serverAvailable();
    set({ server });
    let guest = await idbGet<Profile>(KEY);
    if (!guest) {
      guest = newProfile(uid());
      if (server) api('guest/start', { guestId: guest.guestId }).catch(() => {});
    }
    refreshDaily(guest);
    if (server) {
      try {
        const me = await api<{ profile: Profile } | null>('auth/me');
        if (me?.profile) {
          refreshDaily(me.profile);
          set({ profile: me.profile, member: true, loaded: true });
          return;
        }
      } catch {
        /* not logged in */
      }
    }
    set({ profile: guest, member: false, loaded: true });
    get().save();
  },
  save() {
    if (!get().member) idbSet(KEY, get().profile);
  },
  mutate(fn) {
    const p = structuredClone(get().profile);
    fn(p);
    set({ profile: p });
    get().save();
  },
  async raceStart(trackId, mode, difficulty) {
    const t0 = Date.now();
    if (get().member) {
      try {
        const r = await api<{ raceId: string; token: string }>('race/start', { trackId, mode, difficulty });
        return { ...r, t0 };
      } catch {
        /* offline: fall through */
      }
    }
    return { raceId: uid(), token: null, t0 };
  },
  async raceFinish(ticket, input) {
    if (get().member && ticket.token) {
      try {
        const r = await api<{ profile: Profile; out: RaceApplyOutput }>('race/finish', { ...input, raceId: ticket.raceId, token: ticket.token });
        set({ profile: r.profile });
        return r.out;
      } catch (e) {
        console.warn('race/finish rejected', e);
        return null;
      }
    }
    const err = validateRace({ ...input, laps: Math.max(1, input.lapTimes.length) }, Date.now() - ticket.t0);
    if (err && input.mode !== 'practice') {
      console.warn('local validation rejected race:', err);
      return null;
    }
    const p = structuredClone(get().profile);
    const out = applyRace(p, { ...input, id: ticket.raceId });
    set({ profile: p });
    get().save();
    return out;
  },
  async buy(itemId) {
    if (!get().member) return '회원 전용 기능이에요! 회원가입하면 상점을 이용할 수 있어요 🛍️';
    try {
      const r = await api<{ profile: Profile }>('shop/buy', { itemId });
      set({ profile: r.profile });
      return null;
    } catch (e) {
      return (e as Error).message;
    }
  },
  async equip(charId, itemId, cat) {
    const p = structuredClone(get().profile);
    const err = equipLocal(p, charId, itemId, cat);
    if (err) return err;
    set({ profile: p });
    if (get().member) api('shop/equip', { charId, itemId, cat }).catch(() => {});
    else get().save();
    return null;
  },
  async setLoadout(ids) {
    const p = structuredClone(get().profile);
    setLoadout(p, ids);
    set({ profile: p });
    if (get().member) api('shop/equip', { loadout: p.weaponLoadout }).catch(() => {});
    else get().save();
    return null;
  },
  select(charId, vehicleId) {
    get().mutate((p) => {
      p.selectedChar = charId;
      p.selectedVehicle = vehicleId;
    });
    if (get().member) api('shop/equip', { select: { charId, vehicleId } }).catch(() => {});
  },
  async claimMission(id) {
    if (get().member) {
      try {
        const r = await api<{ profile: Profile }>('progress/missions', { id });
        set({ profile: r.profile });
        return null;
      } catch (e) {
        return (e as Error).message;
      }
    }
    const p = structuredClone(get().profile);
    const err = claimMission(p, id);
    if (!err) {
      set({ profile: p });
      get().save();
    }
    return err;
  },
  async claimAttendance() {
    if (get().member) {
      try {
        const r = await api<{ profile: Profile; result: ReturnType<typeof claimAttendance> }>('progress/daily', { action: 'attendance' });
        set({ profile: r.profile });
        return r.result;
      } catch (e) {
        return (e as Error).message;
      }
    }
    const p = structuredClone(get().profile);
    const res = claimAttendance(p);
    if (typeof res !== 'string') {
      set({ profile: p });
      get().save();
    }
    return res;
  },
  async spin() {
    if (get().member) {
      try {
        const r = await api<{ profile: Profile; result: ReturnType<typeof spinRoulette> }>('progress/daily', { action: 'roulette' });
        set({ profile: r.profile });
        return r.result;
      } catch (e) {
        return (e as Error).message;
      }
    }
    const p = structuredClone(get().profile);
    const res = spinRoulette(p);
    if (typeof res !== 'string') {
      set({ profile: p });
      get().save();
    }
    return res;
  },
  async signup(username, password, nickname) {
    try {
      const guest = get().profile;
      const r = await api<{ profile: Profile }>('auth/signup', { username, password, nickname, guestId: guest.guestId });
      // migrate guest progress (§11.2)
      let profile = r.profile;
      try {
        const m = await api<{ profile: Profile }>('guest/migrate', { guest });
        profile = m.profile;
      } catch {
        /* keep fresh profile */
      }
      set({ profile, member: true });
      return null;
    } catch (e) {
      return e instanceof ApiError ? e.message : '서버에 연결할 수 없어요. 잠시 후 다시 시도해 주세요.';
    }
  },
  async login(username, password, remember) {
    try {
      const r = await api<{ profile: Profile }>('auth/login', { username, password, remember });
      refreshDaily(r.profile);
      set({ profile: r.profile, member: true });
      return null;
    } catch (e) {
      return e instanceof ApiError ? e.message : '서버에 연결할 수 없어요.';
    }
  },
  async logout() {
    try {
      await api('auth/logout', {});
    } catch {
      /* ignore */
    }
    const guest = (await idbGet<Profile>(KEY)) ?? newProfile(uid());
    set({ profile: guest, member: false });
  },
}));
