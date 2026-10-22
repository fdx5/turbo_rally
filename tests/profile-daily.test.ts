import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { claimAttendance, newProfile, spinRoulette } from '../shared/progress';
import { useProfile } from '../src/net/profileStore';
import { idbGet, idbSet } from '../src/net/localdb';

vi.mock('../src/net/localdb', () => ({ idbGet: vi.fn(), idbSet: vi.fn() }));
vi.mock('../src/net/api', () => ({ api: vi.fn(), ApiError: class extends Error {}, serverAvailable: vi.fn() }));

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-10-22T14:59:59Z'));
  const profile = newProfile('daily-store');
  claimAttendance(profile);
  spinRoulette(profile, 0);
  useProfile.setState({ profile, member: false, loaded: true });
});
afterEach(() => vi.useRealTimers());

describe('live daily reward state', () => {
  it('enables buttons after midnight without reloading and saves guest rewards', async () => {
    const oldProfile = useProfile.getState().profile;
    vi.setSystemTime(new Date('2026-10-22T15:00:00Z'));
    useProfile.getState().refresh();
    const refreshed = useProfile.getState().profile;
    expect(refreshed.attendance.claimedToday).toBe(false);
    expect(refreshed.daily.roulette).toBe(false);
    expect(oldProfile.attendance.claimedToday).toBe(true);
    expect(oldProfile.daily.roulette).toBe(true);
    expect(idbSet).toHaveBeenCalledWith('guestProfile', refreshed);
    expect(await useProfile.getState().claimAttendance()).toMatchObject({ day: 2 });
    expect(typeof await useProfile.getState().spin()).toBe('object');
    expect(useProfile.getState().profile.attendance.claimedToday).toBe(true);
    expect(useProfile.getState().profile.daily.roulette).toBe(true);
  });

  it('keeps the current state and does not write on repeated refreshes', () => {
    const previous = useProfile.getState().profile;
    useProfile.getState().refresh();
    expect(useProfile.getState().profile).toBe(previous);
    expect(idbSet).not.toHaveBeenCalled();
  });

  it('updates member daily state without writing it into guest storage', () => {
    useProfile.setState({ member: true });
    vi.setSystemTime(new Date('2026-10-22T15:00:00Z'));
    useProfile.getState().refresh();
    expect(useProfile.getState().profile.attendance.claimedToday).toBe(false);
    expect(useProfile.getState().profile.daily.roulette).toBe(false);
    expect(idbSet).not.toHaveBeenCalled();
  });

  it('refreshes an old guest profile when logging out of a member account', async () => {
    vi.mocked(idbGet).mockResolvedValue(structuredClone(useProfile.getState().profile));
    useProfile.setState({ member: true });
    vi.setSystemTime(new Date('2026-10-22T15:00:00Z'));
    await useProfile.getState().logout();
    expect(useProfile.getState().member).toBe(false);
    expect(useProfile.getState().profile.attendance.claimedToday).toBe(false);
    expect(useProfile.getState().profile.daily.roulette).toBe(false);
  });
});
