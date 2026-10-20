import { clamp, wrapAngle } from '../core/math';
import { Rng } from '../core/rng';
import type { KartControls, KartBody, PhysWorld } from '../physics/kart';
import type { TrackPath } from '../tracks/path';
import type { CharacterDef } from '../data/characters';

export type Difficulty = 'easy' | 'normal' | 'hard';
export const DIFF: Record<Difficulty, { speed: number; noise: number; drift: number; aggro: number; shortcut: number; rubber: number; reaction: number; goldMul: number; label: string }> = {
  easy: { speed: 0.9, noise: 0.18, drift: 0.35, aggro: 0.35, shortcut: 0.1, rubber: 0.04, reaction: 0.6, goldMul: 1.0, label: '쉬움' },
  normal: { speed: 0.965, noise: 0.08, drift: 0.7, aggro: 0.6, shortcut: 0.35, rubber: 0.02, reaction: 0.35, goldMul: 1.25, label: '보통' },
  hard: { speed: 1.0, noise: 0.03, drift: 0.95, aggro: 0.85, shortcut: 0.75, rubber: 0.015, reaction: 0.18, goldMul: 1.5, label: '어려움' },
};

export interface AIContext {
  world: PhysWorld;
  /** world positions of hazards/traps to avoid this frame */
  dangers: { x: number; z: number; r: number }[];
  boxes: { x: number; z: number; active: boolean }[];
  playerDist: number;
  myDist: number;
  hasItem: boolean;
  wantsBoost: boolean;
  time: number;
}

/** AI racer: follows one of three racing lines, drifts for mini-turbos, takes shortcuts (§4.4). */
export class AIDriver {
  ctl: KartControls = { steer: 0, throttle: 1, brake: 0, drift: false, driftPress: false };
  line: number; // -1 inside .. 0 centre .. +1 outside
  private lineTarget: number;
  private rng: Rng;
  private noiseT = 0;
  private noise = 0;
  private shortcutPlan = -1; // index into world.paths
  private shortcutDecidedFor = -1;
  private driftHold = 0;
  private stuckT = 0;
  private reverseT = 0;
  personality: CharacterDef['personality'];
  d: (typeof DIFF)[Difficulty];
  lineSwitchT = 0;
  constructor(seed: number, personality: CharacterDef['personality'], difficulty: Difficulty) {
    this.rng = new Rng(seed);
    this.personality = personality;
    this.d = DIFF[difficulty];
    this.line = this.rng.pick([-1, 0, 0, 1]);
    this.lineTarget = this.line;
  }

  update(dt: number, k: KartBody, ctx: AIContext): KartControls {
    const w = ctx.world;
    const main = w.main;
    const c = this.ctl;
    c.driftPress = false;
    // rubber band (gentle, §4.4)
    const gap = clamp((ctx.playerDist - ctx.myDist) / 180, -1, 1);
    k.rubber = this.d.speed * (1 + gap * this.d.rubber);

    // ---- choose path: shortcut or main
    let path: TrackPath = main;
    let pathIdx = 0;
    if (w.paths.length > 1) {
      for (let i = 1; i < w.paths.length; i++) {
        const sp = w.paths[i];
        const L = main.length;
        const s0 = ((sp.mainS0 % L) + L) % L;
        const dist = ((s0 - k.progressS + L) % L);
        if (dist < 60 && dist > 20 && this.shortcutDecidedFor !== i) {
          this.shortcutDecidedFor = i;
          const offroadShortcut = sp.baseSurface !== 0;
          const p = this.d.shortcut * (offroadShortcut ? (ctx.wantsBoost ? 1.2 : 0.4) : 1);
          this.shortcutPlan = this.rng.chance(p) ? i : -1;
        }
        if (k.onPath === i) {
          path = sp;
          pathIdx = i;
        }
      }
    }
    // ---- target point ahead
    const lookAhead = 7 + Math.abs(k.speed) * 0.42;
    let tx: number;
    let tz: number;
    let curv: number;
    if (pathIdx > 0 || (this.shortcutPlan > 0 && this.nearShortcutStart(k, w))) {
      const sp = pathIdx > 0 ? path : w.paths[this.shortcutPlan];
      const pr = sp === path ? k.proj : null;
      const sNow = pr ? pr.s : 0;
      const sT = Math.min(sp.length - 0.5, sNow + lookAhead);
      const i = sp.idxAtS(sT);
      tx = sp.px[i];
      tz = sp.pz[i];
      curv = sp.turnRight(i, 6);
    } else {
      const sAhead = k.progressS + lookAhead;
      const i = main.idxAtS(sAhead);
      curv = main.turnRight(main.idxAtS(k.progressS + lookAhead * 1.6), 10);
      // racing line: inside of upcoming corner = right side if turning right
      this.lineSwitchT -= dt;
      if (this.lineSwitchT <= 0) {
        this.lineSwitchT = this.rng.range(4, 9);
        if (this.rng.chance(0.3)) this.line = this.rng.pick([-1, 0, 1]);
      }
      const inside = Math.sign(curv) * Math.min(1, Math.abs(curv) * 60);
      let off = (this.line === -1 ? inside : this.line === 1 ? -inside * 0.6 : inside * 0.3) * main.halfW[i] * 0.6;
      // seek item boxes when empty-handed
      if (!ctx.hasItem) {
        let best = Infinity;
        for (const b of ctx.boxes) {
          if (!b.active) continue;
          const dx = b.x - k.x;
          const dz = b.z - k.z;
          const d2 = dx * dx + dz * dz;
          const ahead = dx * Math.sin(k.yaw) + dz * Math.cos(k.yaw);
          if (ahead > 4 && d2 < 50 * 50 && d2 < best) {
            best = d2;
            off = (dx - main.px[i] + k.x) * main.hx[i] + (dz - main.pz[i] + k.z) * main.hz[i];
          }
        }
      }
      // avoid dangers on our line
      for (const dz of ctx.dangers) {
        const ex = dz.x - k.x;
        const ez = dz.z - k.z;
        const ahead = ex * Math.sin(k.yaw) + ez * Math.cos(k.yaw);
        if (ahead > 0 && ahead < 28) {
          const lat = ex * -Math.cos(k.yaw) + ez * Math.sin(k.yaw);
          if (Math.abs(lat) < dz.r + 2.2) off += (lat > 0 ? -1 : 1) * (dz.r + 3);
        }
      }
      off = clamp(off, -main.halfW[i] + 2, main.halfW[i] - 2);
      this.lineTarget += (off - this.lineTarget) * Math.min(1, dt * 2.5);
      tx = main.px[i] + main.hx[i] * this.lineTarget;
      tz = main.pz[i] + main.hz[i] * this.lineTarget;
    }
    // ---- steering towards target
    const desired = Math.atan2(tx - k.x, tz - k.z);
    let err = wrapAngle(desired - k.yaw);
    this.noiseT -= dt;
    if (this.noiseT <= 0) {
      this.noiseT = this.rng.range(0.4, 1.2);
      this.noise = this.rng.range(-1, 1) * this.d.noise;
    }
    if (k.blindT > 0) err += Math.sin(ctx.time * 3.1) * 0.35;
    let steer = clamp(-err * 2.4 + this.noise, -1, 1);
    // ---- drift for mini-turbos on corners
    const sharp = Math.abs(curv) > 0.022 && k.speed > 16;
    if (!k.drifting && sharp && this.driftHold <= 0 && this.rng.chance(this.d.drift * dt * 4)) {
      c.driftPress = true;
      c.drift = true;
      steer = Math.sign(curv) || 1;
      this.driftHold = 0.6;
    }
    if (k.drifting) {
      this.driftHold -= dt;
      // keep holding while still cornering; release at level 2-3 or when straightening
      const want = Math.abs(curv) > 0.01 || k.mtLevel < 1;
      c.drift = want && this.driftHold > -2.6;
      if (k.mtLevel >= (this.d.drift > 0.9 ? 3 : 2) && Math.abs(curv) < 0.016) c.drift = false;
      // steering during drift: modulate towards target
      steer = clamp(-err * 2.0 + k.driftDir * 0.25, -1, 1);
    } else {
      c.drift = false;
      this.driftHold -= dt;
    }
    // ---- throttle / unstuck
    c.throttle = 1;
    c.brake = 0;
    if (Math.abs(err) > 1.2 && k.speed > 14) c.throttle = 0.4;
    if (k.speed < 2 && k.controllable) this.stuckT += dt;
    else this.stuckT = 0;
    if (this.stuckT > 1.2) {
      this.reverseT = 0.9;
      this.stuckT = 0;
    }
    if (this.reverseT > 0) {
      this.reverseT -= dt;
      c.throttle = 0;
      c.brake = 1;
      steer = -steer;
    }
    c.steer = steer;
    return c;
  }
  private nearShortcutStart(k: KartBody, w: PhysWorld) {
    const sp = w.paths[this.shortcutPlan];
    if (!sp) return false;
    const L = w.main.length;
    const s0 = ((sp.mainS0 % L) + L) % L;
    const d = (s0 + 10 - k.progressS + L) % L;
    return d < 26;
  }
}
