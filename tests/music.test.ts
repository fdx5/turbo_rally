import { describe, expect, it } from 'vitest';
import { TRACKS } from '../src/data/tracks';
import { SONGS, compose } from '../src/audio/music';

describe('expedition soundtrack', () => {
  it('covers every selectable circuit and incidental scene with a playable arrangement', () => {
    for (const id of [...TRACKS.map((track) => track.id), 'menu', 'shop', 'dashboard', 'win', 'lose']) {
      const song = SONGS[id];
      expect(song, `${id} must never start silently`).toBeDefined();
      const bars = compose(song);
      expect(bars.length, id).toBeGreaterThanOrEqual(34);
      for (const bar of bars) {
        expect(bar.chord.every(Number.isFinite), id).toBe(true);
        if (bar.section !== 'I') expect(bar.melody.length, id).toBeGreaterThan(0);
        for (const [step, midi, length] of [...bar.melody, ...bar.counter]) {
          expect(step, id).toBeGreaterThanOrEqual(0);
          expect(step + length, id).toBeLessThanOrEqual(16);
          expect(midi, id).toBeGreaterThanOrEqual(48);
          expect(midi, id).toBeLessThanOrEqual(id.startsWith('t') ? 96 : 108);
        }
      }
    }
  });

  it('gives all sixteen landscapes a distinct written melody', () => {
    const hooks = TRACKS.map((track) => {
      expect(SONGS[track.id].hook?.length, track.id).toBeGreaterThan(5);
      return JSON.stringify(SONGS[track.id].hook);
    });
    expect(new Set(hooks).size).toBe(TRACKS.length);
  });
});
