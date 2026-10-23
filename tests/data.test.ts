import { describe, expect, it } from 'vitest';
import { VEHICLES, STAT_KEYS } from '../src/data/vehicles';
import { CHARACTERS } from '../src/data/characters';
import { BASIC_ITEMS, ITEM_ODDS, WEAPONS } from '../src/data/items';
import { TRACKS } from '../src/data/tracks';
import { TrackPath } from '../src/tracks/path';

describe('catalog', () => {
  it('has 20 vehicles each summing to 33', () => {
    expect(VEHICLES).toHaveLength(20);
    for (const v of VEHICLES) expect(STAT_KEYS.reduce((a, k) => a + v.stats[k], 0), v.id).toBe(33);
  });
  it('has 8 characters, 12 items, 40 weapons, 8x12 odds', () => {
    expect(CHARACTERS).toHaveLength(8);
    expect(BASIC_ITEMS).toHaveLength(12);
    expect(WEAPONS).toHaveLength(40);
    expect(ITEM_ODDS).toHaveLength(8);
    for (const r of ITEM_ODDS) expect(r).toHaveLength(12);
  });
  it('tracks have sensible lap lengths', () => {
    for (const t of TRACKS) {
      const p = new TrackPath(t.points, true, t.width);
      console.log(t.id, Math.round(p.length));
      expect(p.length).toBeGreaterThan(4000);
      expect(p.length).toBeLessThan(6000);
    }
  });
});
