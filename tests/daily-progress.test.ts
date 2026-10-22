import { afterEach, describe, expect, it, vi } from 'vitest';
import { claimAttendance, newProfile, refreshDaily, spinRoulette, today, weekKey } from '../shared/progress';

afterEach(() => vi.useRealTimers());

describe('Korean daily rewards calendar', () => {
  it('changes date at Korean midnight, including year boundaries', () => {
    expect(today(new Date('2026-10-22T14:59:59Z'))).toBe('2026-10-22');
    expect(today(new Date('2026-10-22T15:00:00Z'))).toBe('2026-10-23');
    expect(today(new Date('2026-12-31T15:00:00Z'))).toBe('2027-01-01');
  });

  it('changes the mission week on Monday in Korea', () => {
    expect(weekKey(new Date('2026-10-25T14:59:59Z'))).toBe('2026-W43');
    expect(weekKey(new Date('2026-10-25T15:00:00Z'))).toBe('2026-W44');
    expect(weekKey(new Date('2027-01-03T15:00:00Z'))).toBe('2027-W1');
  });

  it.each([true, false])('repairs an inconsistent attendance flag (%s) even on the current day', (claimed) => {
    const now = new Date('2026-10-23T03:00:00Z');
    const p = newProfile('daily-flag');
    refreshDaily(p, now);
    p.attendance.last = claimed ? today(now) : '2026-10-22';
    p.attendance.claimedToday = !claimed;
    expect(refreshDaily(p, now)).toBe(true);
    expect(p.attendance.claimedToday).toBe(claimed);
    expect(refreshDaily(p, now)).toBe(false);
  });

  it('allows both rewards after midnight and preserves the attendance streak', () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-10-22T14:59:59Z'));
    const p = newProfile('daily-rollover');
    expect(claimAttendance(p)).toMatchObject({ day: 1, gold: 500 });
    expect(typeof spinRoulette(p, 0)).toBe('object');
    const before = p.gold;
    expect(typeof claimAttendance(p)).toBe('string');
    expect(typeof spinRoulette(p, 0)).toBe('string');
    expect(p.gold).toBe(before);

    vi.setSystemTime(new Date('2026-10-22T15:00:00Z'));
    refreshDaily(p);
    expect(p.attendance.claimedToday).toBe(false);
    expect(p.daily.roulette).toBe(false);
    expect(claimAttendance(p)).toMatchObject({ day: 2, gold: 800 });
    expect(typeof spinRoulette(p, 0)).toBe('object');
    expect(p.gold).toBeGreaterThan(before);
    expect(typeof claimAttendance(p)).toBe('string');
    expect(typeof spinRoulette(p, 0)).toBe('string');
  });

  it('restarts the attendance streak after skipping a Korean calendar day', () => {
    const p = newProfile('daily-gap');
    claimAttendance(p, new Date('2026-10-22T14:59:59Z'));
    expect(claimAttendance(p, new Date('2026-10-23T15:00:00Z'))).toMatchObject({ day: 1 });
  });
});
