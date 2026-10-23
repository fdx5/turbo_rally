import { describe, expect, it } from 'vitest';
import { TRACKS } from '../src/data/tracks';
import { TRACK_LAYOUT_VERSION } from '../src/data/trackLayout';
import { buildPaths } from '../src/tracks/trackBuilder';
import { buildField } from '../src/game/raceSetup';
import { newProfile, refreshDaily } from '../shared/progress';
import { minLapMs, validateRace } from '../shared/economy';

describe('expedition race configuration', () => {
  it('uses sixteen different distances, varied launch stations and both race lengths', () => {
    expect(new Set(TRACKS.map((t) => Math.round(t.lengthM))).size).toBe(16);
    expect(new Set(TRACKS.map((t) => t.laps))).toEqual(new Set([3, 4]));
    expect(new Set(TRACKS.map((t) => Math.round(t.ramps[0].u * 10))).size).toBeGreaterThan(5);
    for (const t of TRACKS) {
      expect(t.lapTargetMs).toBeGreaterThanOrEqual(120000);
      expect(t.lapTargetMs).toBeLessThanOrEqual(180000);
      expect(buildField(newProfile('lap-config'), 'practice', t.id, 'normal', null).laps).toBe(t.laps);
      expect(minLapMs(t.id)).toBe(Math.round(t.medals.gold / t.laps / 1.8));
      const { main, shortcuts } = buildPaths(t);
      expect(Math.abs(main.length - t.lengthM)).toBeLessThan(1);
      expect(
        shortcuts.some((p) => p.length < (p.mainS1 - p.mainS0) * 0.85),
        t.id,
      ).toBe(true);
      for (const p of shortcuts) {
        expect(p.mainS0, t.id).toBeGreaterThan(0);
        expect(p.mainS1, t.id).toBeLessThan(main.length);
        expect(p.mainS1, t.id).toBeGreaterThan(p.mainS0);
      }
    }
  });
  it('validates three- and four-lap results against each course', () => {
    for (const trackId of ['t2', 't3']) {
      const t = TRACKS.find((t) => t.id === trackId)!;
      const result = {
        trackId,
        mode: 'race' as const,
        position: 1,
        coins: 0,
        totalMs: t.lapTargetMs * t.laps,
        lapTimes: Array(t.laps).fill(t.lapTargetMs),
        laps: t.laps,
      };
      expect(validateRace(result, result.totalMs + 5000)).toBeNull();
      expect(validateRace({ ...result, lapTimes: result.lapTimes.slice(1) }, result.totalMs + 5000)).toBe(
        'bad laps',
      );
    }
  });
  it('keeps progression and history while excluding obsolete best times', () => {
    const p = newProfile('old-layout');
    p.stars.t1 = 7;
    p.bestRace.t1 = { pos: 1, ms: 150000, lap: 50000 };
    p.bestTA.t1 = { ms: 150000, lap: 50000, charId: 'momo', vehicleId: 'coupang', at: 1 };
    p.bestTA.t2 = {
      ms: 530000,
      lap: 130000,
      charId: 'momo',
      vehicleId: 'coupang',
      at: 2,
      layoutVersion: TRACK_LAYOUT_VERSION,
    };
    refreshDaily(p);
    expect(p.bestRace.t1).toBeUndefined();
    expect(p.bestTA.t1).toBeUndefined();
    expect(p.bestTA.t2.ms).toBe(530000);
    expect(p.stars.t1).toBe(7);
    expect(p.unlockedTracks).toContain('t1');
  });
});
