import { useApp } from '../game/app';
import { useProfile } from '../net/profileStore';
import { getShell } from '../game/shell';
import { buildField } from '../game/raceSetup';
import { useHud } from './hudStore';
import { idbGet, idbSet } from '../net/localdb';
import { api } from '../net/api';
import type { Difficulty } from '../ai/driver';
import type { CharId } from '../data/characters';
import { music } from '../audio/music';
import { audio } from '../audio/engine';
import { requestGameFullscreen } from '../core/mobileDisplay';

function b64(f: Float32Array) {
  const u = new Uint8Array(f.buffer);
  let s = '';
  for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode(...u.subarray(i, i + 0x8000));
  return btoa(s);
}
export function unb64(s: string) {
  const bin = atob(s);
  const u = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
  return new Float32Array(u.buffer);
}

// everything except PCs: phones/tablets (incl. iPadOS, which reports a Mac UA)
const isMobile =
  typeof window !== 'undefined' &&
  (/Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent) || (/Macintosh/.test(navigator.userAgent) && navigator.maxTouchPoints > 1) || (matchMedia('(pointer: coarse)').matches && navigator.maxTouchPoints > 0));
/** Mobile only: go fullscreen + landscape on race start (must run inside the tap's user gesture). */
function mobileFullscreen() {
  if (!isMobile || document.fullscreenElement || matchMedia('(display-mode: standalone)').matches) return;
  void requestGameFullscreen(false);
}

/** Validates guest gates (§11.2), prepares the 8-kart field, and runs a race session. */
export async function startRaceFlow(trackId: string, mode: 'race' | 'timeattack' | 'practice', difficulty: Difficulty, ghostOverride?: Float32Array | null) {
  mobileFullscreen();
  const app = useApp.getState();
  const ps = useProfile.getState();
  const p = ps.profile;
  await audio.unlock();
  if (!ps.member && ps.server) {
    if (mode === 'race' && p.guestRaces >= 5) {
      app.set({ modal: 'gate' });
      return;
    }
    if (mode === 'timeattack' && (Object.values(p.daily.ta).reduce((a, b) => a + b, 0) >= 3)) {
      app.set({ modal: 'gate' });
      return;
    }
  }
  const cfg = buildField(p, mode, trackId, difficulty, mode === 'race' ? app.lastFinishOrder : null);
  if (mode === 'timeattack') {
    let ghost: Float32Array | null = ghostOverride ?? null;
    if (!ghost) {
      const local = await idbGet<string>(`ghost:${trackId}`);
      if (local) ghost = unb64(local);
    }
    cfg.ghost = ghost;
  }
  useHud.getState().set({ active: true, phase: 'loading', trackName: '' });
  app.set({ screen: 'race' });
  music.stop(0.4);
  const ticket = await ps.raceStart(trackId, mode, difficulty);
  // let the loading card paint before the heavy synchronous build
  await new Promise((r) => setTimeout(r, 60));
  const shell = getShell();
  shell.startRace(cfg, async (res) => {
    const order = res.finishOrder.map((slot) => res.entrants.find((e) => e.slot === slot)!.charId as CharId);
    if (mode === 'race') useApp.getState().set({ lastFinishOrder: order });
    const out = await useProfile.getState().raceFinish(ticket, {
      id: ticket.raceId,
      mode,
      trackId,
      difficulty,
      charId: res.charId,
      vehicleId: res.vehicleId,
      position: res.position,
      totalMs: res.totalMs,
      bestLapMs: res.bestLapMs,
      lapTimes: res.lapTimes,
      coins: res.coins,
      mt3: res.mt3,
      hitsDealt: res.hitsDealt,
      entrants: res.entrants.map((e) => ({ charId: e.charId, vehicleId: e.vehicleId, name: e.name, isPlayer: e.isPlayer, position: e.position, totalMs: e.totalMs })),
      items: res.itemStats,
    });
    if (mode === 'timeattack' && res.ghost && out?.personalBest) {
      const g = b64(res.ghost);
      idbSet(`ghost:${trackId}`, g);
      if (useProfile.getState().member) api('timeattack/submit', { trackId, totalMs: res.totalMs, bestLapMs: res.bestLapMs, vehicleId: res.vehicleId, charId: res.charId, ghost: g, raceId: ticket.raceId, token: ticket.token }).catch(() => {});
    }
    useApp.getState().set({ lastResult: { result: res, out } });
    setTimeout(() => {
      const sh = getShell();
      const prof = useProfile.getState().profile;
      sh.endRace();
      const eq = (c: string) => (res.entrants.find((e) => e.charId === c)?.isPlayer ? (prof.equipment[c as CharId] ?? {}) : {});
      sh.showroom.setPodium(
        res.entrants.filter((e) => e.position <= 3).map((e) => ({ vehicleId: e.vehicleId, charId: e.charId as CharId, loadout: eq(e.charId), place: e.position })),
      );
      sh.showroom.setMode('podium');
      useApp.getState().set({ screen: 'results' });
    }, 900);
  });
}
