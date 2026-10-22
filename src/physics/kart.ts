import { clamp, wrapAngle } from '../core/math';
import { Proj, Surface, roadFrame, type TrackPath } from '../tracks/path';
import type { BoostPad } from '../tracks/trackBuilder';
import { tuning, type Tuning } from '../data/statCurves';
import type { Stats } from '../data/vehicles';
import type { CharacterDef } from '../data/characters';
import * as THREE from 'three';
import { roadCollider } from './roadCollider';
import { PAD_BOOST_SECONDS, ITEM_BOOST_SECONDS } from '../data/raceTuning';

export interface KartControls {
  steer: number;
  throttle: number;
  brake: number;
  drift: boolean;
  driftPress: boolean;
}
export interface PhysWorld {
  main: TrackPath;
  paths: TrackPath[];
  pads: BoostPad[];
  lowGravity: [number, number][];
  voidY: number;
}
export const MT_LEVELS = [
  { t: 0.6, dur: 0.6, mult: 1.2, color: '#A2D2FF', gauge: 8 },
  { t: 1.3, dur: 1.1, mult: 1.25, color: '#FFD6A5', gauge: 14 },
  { t: 2.1, dur: 1.7, mult: 1.3, color: '#CDB4DB', gauge: 22 },
];
const G = 34;
const sweepFrom = new THREE.Vector3(),
  sweepTo = new THREE.Vector3(),
  sweepHit = new THREE.Vector3();

export type KartEvent =
  | 'wall'
  | 'land'
  | 'bigLand'
  | 'hop'
  | 'driftStart'
  | 'mt1'
  | 'mt2'
  | 'mt3'
  | 'mtRelease'
  | 'pad'
  | 'trick'
  | 'fall'
  | 'respawned'
  | 'slipstream'
  | 'offroad';

/** Arcade kart body (§4.1). All state is plain numbers — no allocation in the step. */
export class KartBody {
  // pose
  x = 0;
  y = 0;
  z = 0;
  yaw = 0;
  px = 0;
  py = 0;
  pz = 0;
  pyaw = 0;
  speed = 0;
  vy = 0;
  vl = 0; // lateral slide velocity
  grounded = true;
  loopActive = false;
  loopFrame = roadFrame();
  airT = 0;
  landT = 0;
  // track tracking
  hints: number[];
  onPath = 0; // index into world.paths
  proj = new Proj();
  progressS = 0; // main-path arc length (wrapped)
  lastGroundY = 0;
  surface: Surface = Surface.Road;
  offroad = false;
  safeS = 0;
  safeT = 0;
  safeTimer = 0;
  // drift / mini turbo
  hopT = 0;
  drifting = false;
  driftDir = 0;
  driftCharge = 0;
  mtLevel = 0;
  driftVisual = 0;
  // boosts
  boostT = 0;
  itemBoostT = 0;
  boostMult = 1;
  boostIgnoreOffroad = false;
  // statuses (seconds remaining)
  spinT = 0;
  spinAngle = 0;
  stopT = 0;
  slowT = 0;
  slowAmt = 1;
  slipT = 0;
  floatT = 0;
  freezeT = 0;
  reverseT = 0;
  sleepT = 0;
  wobbleT = 0;
  shrinkT = 0;
  squashT = 0;
  blindT = 0;
  flashT = 0;
  sealT = 0;
  pullT = 0;
  invulT = 0;
  starT = 0;
  starMult = 1;
  starScale = 1;
  ghostT = 0;
  glideT = 0;
  autoT = 0;
  autoMult = 1;
  trickReady = false;
  tricked = false;
  trickAngle = 0;
  prevTrickAngle = 0;
  private trickClock = 0;
  private trickDuration = 0;
  respawnT = 0;
  wrongWayT = 0;
  slipstreamT = 0;
  coins = 0;
  maxCoins = 10;
  rubber = 1; // AI rubber-band multiplier
  tune: Tuning;
  stats: Stats;
  mass: number;
  radius = 1.25;
  chargeMul = 1;
  trickMul = 1;
  recoverMul = 1;
  iceWalker = false;
  heavy = false;
  events: KartEvent[] = [];
  private eventsBuf: KartEvent[] = [];

  constructor(stats: Stats, char: CharacterDef, nPaths: number) {
    this.stats = stats;
    this.tune = tuning(stats);
    this.mass = this.tune.mass;
    this.hints = new Array(nPaths).fill(-1);
    const p = char.passive.id;
    if (p === 'quickCharge') this.chargeMul = 1.1;
    if (p === 'trickBoost') this.trickMul = 1.15;
    if (p === 'quickRecover') this.recoverMul = 0.8;
    if (p === 'iceWalker') this.iceWalker = true;
    if (p === 'heavyBody') this.heavy = true;
    if (p === 'coinMax') this.maxCoins = 12;
  }

  place(world: PhysWorld, s: number, t: number) {
    const m = world.main;
    const i = m.idxAtS(s);
    this.x = m.px[i] + m.hx[i] * t;
    this.z = m.pz[i] + m.hz[i] * t;
    this.y = m.py[i] + t * m.bankTan[i];
    this.yaw = Math.atan2(m.fx[i], m.fz[i]);
    this.px = this.x;
    this.py = this.y;
    this.pz = this.z;
    this.pyaw = this.yaw;
    this.speed = 0;
    this.vy = 0;
    this.vl = 0;
    this.hints.fill(-1);
    this.hints[0] = i;
    this.onPath = 0;
    this.loopActive = false;
    this.tricked = false;
    this.trickAngle = this.prevTrickAngle = this.trickClock = this.trickDuration = 0;
    m.project(this.x, this.y, this.z, i, this.proj);
    this.y = this.proj.y;
    this.py = this.y;
    this.lastGroundY = this.y;
    this.grounded = true;
    this.progressS = ((s % m.length) + m.length) % m.length;
    this.safeS = this.progressS;
    this.safeT = t;
  }

  get controllable() {
    return (
      this.spinT <= 0 &&
      this.stopT <= 0 &&
      this.freezeT <= 0 &&
      this.floatT <= 0 &&
      this.respawnT <= 0 &&
      this.sleepT <= 0
    );
  }
  get invulnerable() {
    return this.invulT > 0 || this.starT > 0 || this.ghostT > 0 || this.respawnT > 0;
  }
  boost(dur: number, mult: number, ignoreOffroad = false) {
    if (this.boostT <= 0 || mult >= this.boostMult) this.boostMult = mult;
    this.boostT = Math.max(this.boostT, dur);
    this.boostIgnoreOffroad = ignoreOffroad || this.boostIgnoreOffroad;
    const top = this.tune.topSpeed * mult;
    if (this.speed < top * 0.92) this.speed = Math.max(this.speed, Math.min(top * 0.92, this.speed + 9));
  }
  boostItem(duration: number, mult: number) {
    this.itemBoostT += Math.max(ITEM_BOOST_SECONDS, duration);
    this.boost(this.itemBoostT, mult, true);
  }
  startAirTrick() {
    if (this.grounded || this.tricked || this.respawnT > 0) return false;
    const height = Math.max(0, this.y - this.proj.y);
    const remaining = (this.vy + Math.sqrt(this.vy * this.vy + 2 * G * height)) / G;
    if (remaining < 0.4) return false;
    this.trickClock = this.trickAngle = this.prevTrickAngle = 0;
    this.trickDuration = Math.min(0.65, remaining * 0.8);
    this.tricked = true;
    this.trickReady = false;
    this.emit('trick');
    return true;
  }
  private emit(e: KartEvent) {
    this.eventsBuf.push(e);
  }
  /** swap & return events emitted since last call */
  takeEvents(): KartEvent[] {
    const out = this.eventsBuf;
    this.eventsBuf = this.events;
    this.events = out;
    this.eventsBuf.length = 0;
    return out;
  }

  topSpeed(): number {
    let top = this.tune.topSpeed * (1 + 0.01 * Math.min(this.coins, this.maxCoins)) * this.rubber;
    if (this.shrinkT > 0) top *= 0.7;
    if (this.squashT > 0) top *= 0.6;
    if (this.slowT > 0) top *= this.slowAmt;
    const ignoreOff = this.boostT > 0 && this.boostIgnoreOffroad;
    if (this.offroad && !ignoreOff && this.starT <= 0 && this.glideT <= 0) top *= this.tune.offroadFactor;
    if (this.boostT > 0) top *= this.boostMult;
    if (this.starT > 0) top *= this.starMult;
    if (this.autoT > 0) top *= this.autoMult;
    return top;
  }

  step(dt: number, c: KartControls, world: PhysWorld) {
    this.px = this.x;
    this.py = this.y;
    this.pz = this.z;
    this.pyaw = this.yaw;
    this.prevTrickAngle = this.trickAngle;
    if (this.trickDuration > 0) {
      this.trickClock = Math.min(this.trickDuration, this.trickClock + dt);
      const u = this.trickClock / this.trickDuration;
      this.trickAngle = u * u * (3 - 2 * u) * Math.PI * 2;
    }
    this.tickStatuses(dt);

    if (this.respawnT > 0) {
      this.respawnT -= dt;
      if (this.respawnT <= 0) {
        this.place(world, this.safeS, this.safeT);
        this.invulT = 1.5;
        this.emit('respawned');
      } else {
        // carried by the cloud fairy towards the safe point
        const m = world.main;
        const i = m.idxAtS(this.safeS);
        const k = 1 - Math.exp(-dt * 3);
        this.x += (m.px[i] + m.hx[i] * this.safeT - this.x) * k;
        this.z += (m.pz[i] + m.hz[i] * this.safeT - this.z) * k;
        this.y += (m.py[i] + 3 - this.y) * k;
        this.yaw += wrapAngle(Math.atan2(m.fx[i], m.fz[i]) - this.yaw) * k;
      }
      return;
    }

    const currentPath = world.paths[this.onPath];
    if (currentPath.loopAt(this.onPath === 0 ? this.progressS : this.proj.s) && (this.grounded || this.loopActive)) {
      this.stepLoop(dt, c, world, currentPath);
      return;
    }
    this.loopActive = false;

    const can = this.controllable;
    let steer = can ? c.steer : 0;
    if (this.reverseT > 0) steer = -steer;
    if (this.wobbleT > 0) steer = clamp(steer + Math.sin(this.wobbleT * 22) * 0.75, -1, 1);
    let throttle = can ? c.throttle : 0;
    let brake = can ? c.brake : 0;
    if (this.autoT > 0) {
      throttle = 1;
      brake = 0;
    }
    if (this.sleepT > 0) throttle = 0;

    const top = this.topSpeed();
    const T = this.tune;
    // --- longitudinal
    if (this.spinT > 0 || this.stopT > 0 || this.floatT > 0) {
      this.speed *= Math.exp(-dt * (this.stopT > 0 ? 6 : 2.2));
    } else if (brake > 0 && this.speed > 0.5) {
      this.speed -= 28 * dt;
    } else if (brake > 0) {
      this.speed = Math.max(-9, this.speed - 12 * dt);
    } else if (throttle > 0) {
      const accel = (T.topSpeed / T.accelTime) * (1.35 - 0.7 * clamp(this.speed / Math.max(1, top), 0, 1));
      if (this.speed < top) this.speed = Math.min(top, this.speed + accel * throttle * dt);
    } else {
      this.speed -= Math.sign(this.speed) * Math.min(Math.abs(this.speed), (this.grounded ? 5 : 1) * dt);
    }
    if (this.speed > top) this.speed -= (this.speed - top) * (this.offroad ? 3.5 : 1.6) * dt;
    if (this.freezeT > 0) this.speed *= Math.exp(-dt * 0.4);

    // --- drift hop & mini turbo
    if (c.driftPress && can && this.grounded && this.speed > 9 && this.hopT <= 0 && !this.drifting) {
      this.hopT = 0.22;
      this.vy = 4.2;
      this.grounded = false;
      this.emit('hop');
      if (Math.abs(steer) > 0.2) {
        this.drifting = true;
        this.driftDir = Math.sign(steer);
        this.driftCharge = 0;
        this.mtLevel = 0;
        this.emit('driftStart');
      }
    }
    if (c.driftPress && !this.grounded && this.airT > 0.15 && this.trickReady) {
      this.startAirTrick();
    }
    if (this.hopT > 0) {
      this.hopT -= dt;
      if (!this.drifting && Math.abs(steer) > 0.3 && c.drift) {
        this.drifting = true;
        this.driftDir = Math.sign(steer);
        this.driftCharge = 0;
        this.mtLevel = 0;
        this.emit('driftStart');
      }
    }
    if (this.drifting) {
      if (!c.drift || this.speed < 7 || !can) {
        if (this.mtLevel > 0 && can) {
          const L = MT_LEVELS[this.mtLevel - 1];
          this.boost(L.dur, L.mult);
          this.emit('mtRelease');
        }
        this.drifting = false;
        this.driftCharge = 0;
        this.mtLevel = 0;
      } else if (this.grounded) {
        const inward = Math.max(0, steer * this.driftDir);
        this.driftCharge += dt * T.driftCharge * this.chargeMul * (0.75 + 0.6 * inward);
        const lv =
          this.driftCharge >= MT_LEVELS[2].t
            ? 3
            : this.driftCharge >= MT_LEVELS[1].t
              ? 2
              : this.driftCharge >= MT_LEVELS[0].t
                ? 1
                : 0;
        if (lv > this.mtLevel) {
          this.mtLevel = lv;
          this.emit(lv === 1 ? 'mt1' : lv === 2 ? 'mt2' : 'mt3');
        }
      }
    }
    this.driftVisual +=
      ((this.drifting ? this.driftDir * 0.42 : 0) - this.driftVisual) * Math.min(1, dt * 10);

    // --- steering (yaw increases to the left)
    const sp = Math.abs(this.speed);
    let yawRate: number;
    if (this.drifting) {
      const k = steer * this.driftDir; // -1 (outward) .. +1 (inward)
      yawRate = -this.driftDir * T.driftTurn * (0.72 + 0.42 * k) * clamp(sp / 14, 0.4, 1);
    } else {
      const f = clamp(sp / 7, 0, 1) * (1 - 0.22 * clamp((sp - 22) / 14, 0, 1));
      yawRate = -steer * T.turnRate * f * (this.speed < 0 ? -1 : 1);
      if (!this.grounded) yawRate *= 0.45;
    }
    if (this.spinT > 0) {
      this.spinAngle += dt * 14;
    } else this.spinAngle *= Math.exp(-dt * 12);
    const ice = (this.surface === Surface.Ice || this.surface === Surface.Water) && !this.iceWalker;
    const slippery = ice || this.slipT > 0 || this.freezeT > 0;
    if (slippery) yawRate *= 0.65;
    this.yaw = wrapAngle(this.yaw + yawRate * dt);
    // lateral slide (ice / slip / bumps)
    const grip = this.freezeT > 0 ? 0.6 : slippery ? 1.4 : 9;
    if (slippery) this.vl += -steer * sp * 0.25 * dt;
    this.vl *= Math.exp(-grip * dt);
    if (this.pullT > 0) this.speed = Math.min(this.speed, -6);

    // --- integrate horizontal
    const fx = Math.sin(this.yaw);
    const fz = Math.cos(this.yaw);
    const rx = -fz;
    const rz = fx;
    let vx = fx * this.speed + rx * this.vl;
    let vz = fz * this.speed + rz * this.vl;
    if (this.floatT > 0) {
      vx *= 0.2;
      vz *= 0.2;
    }
    this.x += vx * dt;
    this.z += vz * dt;

    // --- vertical / ground
    const previousPath = this.onPath,
      previousS = this.proj.s,
      previousT = this.proj.t;
    const ground = this.groundQuery(world);
    let g = G;
    for (const [a, b] of world.lowGravity) if (this.progressS >= a && this.progressS <= b) g = 11;
    if (this.glideT > 0) {
      g = 0;
      this.vy =
        this.vy * Math.exp(-dt * 3) + (ground !== null ? (ground + 4.5 - this.y) * 2.5 * dt * 10 : 0) * 0;
      if (ground !== null) this.y += (ground + 4.5 - this.y) * Math.min(1, dt * 3);
    }
    if (this.floatT > 0) {
      g = 0;
      if (ground !== null) this.y += (ground + 2.5 - this.y) * Math.min(1, dt * 4);
      this.vy = 0;
    }
    const prevY = this.y;
    this.vy -= g * dt;
    let ny = this.y + this.vy * dt;
    const wasGrounded = this.grounded;
    const rampLip =
      previousPath === this.onPath &&
      world.paths[this.onPath].ramps.some(
        (r) => previousS <= r.s1 && this.proj.s > r.s1 && previousT >= r.t0 && previousT <= r.t1,
      );
    if (ground !== null) {
      const slopeV = (ground - this.lastGroundY) / dt;
      // Ordinary hills use road adhesion. Only marked ramps, gaps and player hops launch.
      const snap = wasGrounded && this.hopT <= 0 && !rampLip && ny - ground < 0.6;
      if (ny <= ground || snap) {
        if (!wasGrounded) {
          const big = this.airT > 0.45;
          this.landT = 0.25;
          this.emit(big ? 'bigLand' : 'land');
          if (this.tricked) {
            this.boost(0.8 * this.trickMul, 1.3);
            this.tricked = false;
          }
        }
        ny = ground;
        this.vy = clamp(slopeV, 0, 14);
        this.grounded = true;
        this.airT = 0;
        this.trickReady = false;
        this.trickAngle = this.prevTrickAngle = this.trickClock = this.trickDuration = 0;
      } else {
        if (wasGrounded && rampLip) {
          // launched off a ramp lip
          this.vy = Math.max(this.vy, 3.5);
          this.trickReady = true;
        }
        this.grounded = false;
      }
      this.lastGroundY = ground;
    } else {
      this.grounded = false;
      if (wasGrounded && rampLip) {
        this.vy = Math.max(this.vy, 3.5);
        this.trickReady = true;
      }
    }
    if (!this.grounded) {
      this.airT += dt;
      if (this.airT > 0.25 && this.vy > 0) this.trickReady = true;
    }
    this.y = this.glideT > 0 || this.floatT > 0 ? this.y : ny;
    if (!wasGrounded && this.respawnT <= 0) {
      const collider = roadCollider(world);
      // Test the head against bridge undersides before the feet can pass through.
      const clearance = 1.4 * (this.shrinkT > 0 ? 0.6 : 1);
      sweepFrom.set(this.px, this.py + clearance, this.pz);
      sweepTo.set(this.x, this.y + clearance, this.z);
      if (collider.sweep(sweepFrom, sweepTo, true, sweepHit)) {
        this.x = sweepHit.x;
        this.z = sweepHit.z;
        this.y = sweepHit.y - clearance - 0.035;
        this.vy = Math.min(0, -Math.abs(this.vy) * 0.15);
        this.grounded = false;
      } else {
        sweepFrom.set(this.px, this.py, this.pz);
        sweepTo.set(this.x, this.y, this.z);
        if (collider.sweep(sweepFrom, sweepTo, false, sweepHit)) {
          this.x = sweepHit.x;
          this.y = sweepHit.y;
          this.z = sweepHit.z;
          this.vy = 0;
          this.grounded = true;
          this.airT = 0;
          this.landT = 0.25;
          const contact = this.groundQuery(world);
          if (contact !== null && Math.abs(contact - this.y) < 0.2) this.y = contact;
          this.lastGroundY = this.y;
        }
      }
    }
    void prevY;
    if (this.landT > 0) this.landT -= dt;

    if (this.y < world.voidY) {
      this.emit('fall');
      this.respawnT = 1.5;
      this.speed = 0;
      this.drifting = false;
      this.coins = Math.max(0, this.coins - 2);
      return;
    }

    // --- pads & safe point & wrong-way
    if (this.grounded) {
      const p = world.paths[this.onPath];
      for (const pad of world.pads) {
        if (pad.path !== p) continue;
        const ds = this.proj.s - pad.s;
        if (Math.abs(ds) < pad.halfLen && Math.abs(this.proj.t - pad.t) < pad.halfWid + 0.6) {
          if (this.boostT < 0.9) this.emit('pad');
          this.boost(PAD_BOOST_SECONDS, 1.35, true);
        }
      }
      this.safeTimer -= dt;
      if (
        this.safeTimer <= 0 &&
        this.onPath === 0 &&
        !this.offroad &&
        Math.abs(this.proj.t) < this.proj.halfW - 2 &&
        !this.proj.gap
      ) {
        this.safeTimer = 0.5;
        this.safeS = this.proj.s;
        this.safeT = this.proj.t * 0.5;
      }
    }
    const m = world.main;
    const mi = m.idxAtS(this.progressS);
    const dot = fx * m.fx[mi] + fz * m.fz[mi];
    if (dot < -0.35 && this.speed > 4) this.wrongWayT += dt;
    else this.wrongWayT = Math.max(0, this.wrongWayT - dt * 2);
  }

  private stepLoop(dt: number, c: KartControls, world: PhysWorld, path: TrackPath) {
    this.loopActive = true;
    this.drifting = false;
    this.driftVisual = 0;
    this.hopT = 0;
    this.grounded = true;
    this.vy = 0;
    this.airT = 0;
    this.offroad = false;
    let s = this.onPath === 0 ? this.progressS : this.proj.s;
    path.frameAt(s, this.loopFrame);
    const top = this.topSpeed();
    const target = c.brake > 0 ? 15 : Math.max(24, top);
    this.speed += (target - this.speed) * Math.min(1, dt * 2.4);
    s += (Math.max(15, this.speed) * dt) / this.loopFrame.metric;
    this.proj.t = clamp(
      this.proj.t + c.steer * dt * 7,
      -this.proj.halfW + this.radius,
      this.proj.halfW - this.radius,
    );
    path.frameAt(s, this.loopFrame);
    const f = this.loopFrame;
    this.x = f.x + f.hx * this.proj.t;
    this.y = f.y;
    this.z = f.z + f.hz * this.proj.t;
    this.proj.s = s;
    this.hints[this.onPath] = path.idxAtS(s);
    this.yaw = path.headingAt(s);
    this.lastGroundY = this.y;
    if (this.onPath === 0) this.progressS = s;
    else
      this.progressS =
        (path.mainS0 + ((path.mainS1 - path.mainS0) * s) / path.length + world.main.length) %
        world.main.length;
    if (!path.loopAt(s)) {
      this.loopActive = false;
      path.project(this.x, this.y, this.z, path.idxAtS(s), this.proj, 4);
      this.y = this.proj.y;
      this.lastGroundY = this.y;
    }
  }

  /** Find drivable ribbon under the kart, resolve walls. Returns ground height or null (void). */
  private groundQuery(world: PhysWorld): number | null {
    const paths = world.paths;
    const guidePath = this.onPath,
      guideS = this.proj.s;
    const tolerance = (p: TrackPath, k: number) =>
      k === guidePath && p.ramps.some((r) => Math.abs(guideS - r.s1) < 6) ? 9 : 3;
    let best = -1;
    let bestScore = Infinity;
    const pr = this.proj;
    for (let k = 0; k < paths.length; k++) {
      const p = paths[k];
      const hint = this.hints[k];
      if (k > 0 && hint < 0) {
        // shortcut: cheap bounding test against its endpoints region
        const dx = this.x - p.px[p.n >> 1];
        const dz = this.z - p.pz[p.n >> 1];
        if (dx * dx + dz * dz > (p.length * 0.75 + 20) ** 2) continue;
      }
      p.project(this.x, this.y, this.z, hint, pr, k === 0 ? 40 : 30, tolerance(p, k));
      this.hints[k] = pr.idx;
      const lim = pr.t < 0 ? pr.limitL : pr.limitR;
      const reachable = pr.y - this.y <= (this.grounded ? 1.2 : 0.6);
      // The base ribbon under a stunt is only a progress guide, never a hidden floor.
      const inside = pr.dist2 <= lim * lim && !pr.gap && !p.loopAt(pr.s) && reachable;
      if (k > 0 && (pr.s < 0.5 || pr.s > p.length - 0.5)) continue;
      const score = inside
        ? Math.abs(pr.t) / lim + Math.abs(pr.y - this.y) * 0.02 - (k === this.onPath ? 0.18 : 0)
        : 10 + Math.sqrt(pr.dist2) - lim + Math.abs(pr.y - this.y);
      if (score < bestScore) {
        bestScore = score;
        best = k;
      }
    }
    if (best < 0) best = 0;
    const p = paths[best];
    p.project(this.x, this.y, this.z, this.hints[best], pr, 40, tolerance(p, best));
    this.hints[best] = pr.idx;
    this.onPath = best;
    // progress on main path
    if (best === 0) this.progressS = pr.s;
    else {
      const k = pr.s / p.length;
      const L = world.main.length;
      let s = p.mainS0 + (p.mainS1 - p.mainS0) * k;
      s = ((s % L) + L) % L;
      this.progressS = s;
    }
    const lim = pr.t < 0 ? pr.limitL : pr.limitR;
    const wall = pr.t < 0 ? pr.wallL : pr.wallR;
    // surface
    const absT = Math.abs(pr.t);
    let surf = p.surfaceAt(pr.s, pr.t);
    this.offroad = false;
    if (best > 0 && p.baseSurface !== Surface.Road)
      this.offroad = surf === Surface.Dirt || surf === Surface.Sand || surf === Surface.Choco;
    if (absT > pr.halfW + 1.2) {
      this.offroad = true;
      if (surf === Surface.Road) surf = Surface.Dirt;
    }
    if (surf === Surface.Choco || surf === Surface.Sand) this.offroad = true;
    this.surface = surf;
    if (pr.gap) return null;
    if (p.loopAt(pr.s)) return null;
    // Never pull a falling kart through the underside of a bridge or an unrelated path.
    if (pr.y - this.y > (this.grounded ? 1.2 : 0.6)) return null;
    if (!p.closed && (pr.s < 0.001 || pr.s > p.length - 0.001) && pr.dist2 > pr.t * pr.t + 0.25) return null;
    if (absT > lim) {
      if (this.y > pr.y + 1.6) return null;
      if (wall && !this.isInsideOther(world, best)) {
        // push back inside & bounce
        const sgn = Math.sign(pr.t);
        const over = absT - (lim - 0.02);
        this.x -= pr.hx * sgn * over;
        this.z -= pr.hz * sgn * over;
        const fx = Math.sin(this.yaw);
        const fz = Math.cos(this.yaw);
        const into = (fx * pr.hx + fz * pr.hz) * sgn; // >0 heading into wall
        if (into > 0.05 || Math.abs(this.vl) > 1) {
          if (into > 0.25 && this.speed > 8) this.emit('wall');
          this.speed *= 1 - 0.55 * clamp(into, 0, 1);
          this.vl = -sgn * Math.max(2.5, Math.abs(this.vl) * 0.5) * (into > 0.2 ? 1 : 0.4);
          // steer the nose back along the track
          const pathYaw = Math.atan2(pr.fx, pr.fz);
          const back = wrapAngle(pathYaw + (this.speed < 0 ? Math.PI : 0) - this.yaw);
          this.yaw += back * clamp(into, 0, 1) * 0.35;
        }
        // Reproject after the push: banked walls have a different height at the corrected position.
        p.project(this.x, this.y, this.z, pr.idx, pr, 4);
        return pr.y;
      }
      if (!wall) return null;
    }
    return pr.y;
  }
  private isInsideOther(world: PhysWorld, cur: number): boolean {
    for (let k = 0; k < world.paths.length; k++) {
      if (k === cur || this.hints[k] < 0) continue;
      const p = world.paths[k];
      const pr = tmp;
      p.project(this.x, this.y, this.z, this.hints[k], pr, 20);
      const lim = pr.t < 0 ? pr.limitL : pr.limitR;
      if (
        pr.dist2 <= lim * lim &&
        !pr.gap &&
        Math.abs(pr.y - this.y) < 2 &&
        (k === 0 || (pr.s > 0.5 && pr.s < p.length - 0.5))
      )
        return true;
    }
    return false;
  }

  private tickStatuses(dt: number) {
    const dec = (v: number) => (v > 0 ? v - dt : 0);
    if (this.spinT > 0) this.spinT -= dt * (1 / this.recoverMul);
    if (this.stopT > 0) this.stopT -= dt * (1 / this.recoverMul);
    this.slowT = dec(this.slowT);
    this.slipT = dec(this.slipT);
    this.floatT = dec(this.floatT);
    this.freezeT = dec(this.freezeT);
    this.reverseT = dec(this.reverseT);
    this.sleepT = dec(this.sleepT);
    this.wobbleT = dec(this.wobbleT);
    this.shrinkT = dec(this.shrinkT);
    this.squashT = dec(this.squashT);
    this.blindT = dec(this.blindT);
    this.flashT = dec(this.flashT);
    this.sealT = dec(this.sealT);
    this.pullT = dec(this.pullT);
    this.invulT = dec(this.invulT);
    this.starT = dec(this.starT);
    this.ghostT = dec(this.ghostT);
    this.glideT = dec(this.glideT);
    this.autoT = dec(this.autoT);
    if (this.itemBoostT > 0 && this.controllable) this.itemBoostT = Math.max(0, this.itemBoostT - dt);
    if (this.boostT > 0) {
      this.boostT -= dt;
      this.boostT = Math.max(this.boostT, this.itemBoostT);
      if (this.boostT <= 0) {
        this.boostMult = 1;
        this.boostIgnoreOffroad = false;
      }
    }
    if (this.slipstreamT > 0) this.slipstreamT -= dt;
  }
}
const tmp = new Proj();
