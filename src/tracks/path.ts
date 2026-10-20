import * as THREE from 'three';

export type Vec3T = [number, number, number];
export const enum Surface {
  Road = 0,
  Dirt = 1,
  Ice = 2,
  Water = 3,
  Choco = 4,
  Sand = 5,
  Boost = 6,
}

export interface Ramp {
  s0: number;
  s1: number;
  t0: number;
  t1: number;
  h: number;
  trick: boolean;
}
export interface ZoneRange {
  s0: number;
  s1: number;
  t0: number;
  t1: number;
  surface: Surface;
}

/** Result of projecting a world position onto a path. Reused to avoid GC in the game loop. */
export class Proj {
  idx = 0;
  f = 0;
  s = 0;
  t = 0; // signed lateral offset (right positive)
  dist2 = 0;
  y = 0; // road height at (s,t)
  hx = 0; // horizontal right vector
  hz = 0;
  fx = 0; // forward
  fz = 0;
  fy = 0;
  halfW = 0;
  limitL = 0;
  limitR = 0;
  wallL = true;
  wallR = true;
  gap = false;
  bankTan = 0;
}

/**
 * Sampled Catmull-Rom ribbon with width, bank, walls & gaps. Physics queries (s,t) here instead of
 * using mesh raycasts: fast and stable for 8 karts at 120 Hz (§4.1).
 */
export class TrackPath {
  readonly n: number;
  readonly closed: boolean;
  readonly length: number;
  readonly ds: number;
  px: Float32Array;
  py: Float32Array;
  pz: Float32Array;
  fx: Float32Array;
  fy: Float32Array;
  fz: Float32Array;
  hx: Float32Array;
  hz: Float32Array;
  bankTan: Float32Array;
  halfW: Float32Array;
  shoulderL: Float32Array;
  shoulderR: Float32Array;
  wallL: Uint8Array;
  wallR: Uint8Array;
  gap: Uint8Array;
  ramps: Ramp[] = [];
  zones: ZoneRange[] = [];
  /** For shortcut paths: main-path s at start/end (progress mapping). */
  mainS0 = 0;
  mainS1 = 0;
  baseSurface: Surface = Surface.Road;
  curve: THREE.CatmullRomCurve3;

  constructor(
    points: Vec3T[],
    closed: boolean,
    widths: number | number[],
    banks: number[] | null = null,
    shoulder = 6,
  ) {
    this.closed = closed;
    const v = points.map(([x, y, z]) => new THREE.Vector3(x, y, z));
    this.curve = new THREE.CatmullRomCurve3(v, closed, 'centripetal', 0.5);
    const len = this.curve.getLength();
    const n = Math.max(8, Math.round(len / 1.0));
    this.n = n;
    this.length = len;
    this.ds = len / (closed ? n : n - 1);
    const mk = () => new Float32Array(n);
    this.px = mk();
    this.py = mk();
    this.pz = mk();
    this.fx = mk();
    this.fy = mk();
    this.fz = mk();
    this.hx = mk();
    this.hz = mk();
    this.bankTan = mk();
    this.halfW = mk();
    this.shoulderL = mk();
    this.shoulderR = mk();
    this.wallL = new Uint8Array(n).fill(1);
    this.wallR = new Uint8Array(n).fill(1);
    this.gap = new Uint8Array(n);
    const pts = this.curve.getSpacedPoints(closed ? n : n - 1);
    const cps = points.length;
    for (let i = 0; i < n; i++) {
      const p = pts[i];
      this.px[i] = p.x;
      this.py[i] = p.y;
      this.pz[i] = p.z;
    }
    for (let i = 0; i < n; i++) {
      const a = closed ? (i - 1 + n) % n : Math.max(0, i - 1);
      const b = closed ? (i + 1) % n : Math.min(n - 1, i + 1);
      let dx = this.px[b] - this.px[a];
      let dy = this.py[b] - this.py[a];
      let dz = this.pz[b] - this.pz[a];
      const l = Math.hypot(dx, dy, dz) || 1;
      dx /= l;
      dy /= l;
      dz /= l;
      this.fx[i] = dx;
      this.fy[i] = dy;
      this.fz[i] = dz;
      const hl = Math.hypot(dx, dz) || 1;
      // right = forward x up  (y-up, right-handed): (fx,fz) -> (-fz, fx)
      this.hx[i] = -dz / hl;
      this.hz[i] = dx / hl;
      // interpolate per-control-point width & bank
      const u = i / n;
      const cpF = u * (closed ? cps : cps - 1);
      const c0 = Math.floor(cpF) % cps;
      const c1 = (c0 + 1) % cps;
      const k = cpF - Math.floor(cpF);
      const kk = k * k * (3 - 2 * k);
      const w0 = Array.isArray(widths) ? widths[c0] : widths;
      const w1 = Array.isArray(widths) ? widths[c1] : widths;
      this.halfW[i] = (w0 + (w1 - w0) * kk) / 2;
      if (banks) this.bankTan[i] = Math.tan(((banks[c0] + (banks[c1] - banks[c0]) * kk) * Math.PI) / 180);
      this.shoulderL[i] = shoulder;
      this.shoulderR[i] = shoulder;
    }
    if (!banks) this.autoBank();
  }

  /** Bank into corners automatically (gentle, cute). */
  private autoBank() {
    const n = this.n;
    const curv = new Float32Array(n);
    for (let i = 0; i < n; i++) curv[i] = this.turnRight(i, 6);
    for (let i = 0; i < n; i++) {
      let acc = 0;
      for (let k = -10; k <= 10; k++) acc += curv[this.wrap(i + k)];
      const c = acc / 21;
      // turning right => inner (right, +t) edge lower => negative slope
      this.bankTan[i] = Math.max(-0.16, Math.min(0.16, -c * 7));
    }
  }

  wrap(i: number) {
    const n = this.n;
    if (this.closed) return ((i % n) + n) % n;
    return Math.max(0, Math.min(n - 1, i));
  }
  sAt(i: number) {
    return i * this.ds;
  }
  idxAtS(s: number) {
    if (this.closed) s = ((s % this.length) + this.length) % this.length;
    return this.wrap(Math.round(s / this.ds));
  }
  /** Signed curvature (rad per metre) around sample i; positive = turning right. */
  turnRight(i: number, span = 8) {
    const a = this.wrap(i - span);
    const b = this.wrap(i + span);
    const ha = Math.atan2(this.fx[a], this.fz[a]);
    const hb = Math.atan2(this.fx[b], this.fz[b]);
    const d = Math.atan2(Math.sin(hb - ha), Math.cos(hb - ha));
    // heading (yaw) increases when turning left
    return -d / (2 * span * this.ds);
  }
  /** World position at (s, t). */
  pointAt(s: number, t: number, out: THREE.Vector3, lift = 0) {
    const fi = (this.closed ? ((s % this.length) + this.length) % this.length : Math.max(0, Math.min(this.length, s))) / this.ds;
    const i0 = this.wrap(Math.floor(fi));
    const i1 = this.wrap(i0 + 1);
    const k = fi - Math.floor(fi);
    const x = this.px[i0] + (this.px[i1] - this.px[i0]) * k;
    const y = this.py[i0] + (this.py[i1] - this.py[i0]) * k;
    const z = this.pz[i0] + (this.pz[i1] - this.pz[i0]) * k;
    const hx = this.hx[i0];
    const hz = this.hz[i0];
    out.set(x + hx * t, y + t * this.bankTan[i0] + lift + this.rampHeight(s, t), z + hz * t);
    return out;
  }
  headingAt(s: number) {
    const i = this.idxAtS(s);
    return Math.atan2(this.fx[i], this.fz[i]);
  }

  rampHeight(s: number, t: number): number {
    for (let r = 0; r < this.ramps.length; r++) {
      const rp = this.ramps[r];
      if (s >= rp.s0 && s <= rp.s1 && t >= rp.t0 && t <= rp.t1) {
        const k = (s - rp.s0) / (rp.s1 - rp.s0);
        return rp.h * (k < 0.3 ? (k / 0.3) * (k / 0.3) * 0.3 : k);
      }
    }
    return 0;
  }
  surfaceAt(s: number, t: number): Surface {
    for (let z = 0; z < this.zones.length; z++) {
      const zn = this.zones[z];
      const inS = zn.s0 <= zn.s1 ? s >= zn.s0 && s <= zn.s1 : s >= zn.s0 || s <= zn.s1;
      if (inS && t >= zn.t0 && t <= zn.t1) return zn.surface;
    }
    return this.baseSurface;
  }

  /** Project world (x,y,z) near hint index. Writes into out. */
  project(x: number, y: number, z: number, hint: number, out: Proj, window = 40): Proj {
    const n = this.n;
    let best = -1;
    let bestD = Infinity;
    if (hint < 0) {
      for (let i = 0; i < n; i += 2) {
        const dx = x - this.px[i];
        const dz = z - this.pz[i];
        const dy = (y - this.py[i]) * 2;
        const d = dx * dx + dz * dz + dy * dy;
        if (d < bestD) {
          bestD = d;
          best = i;
        }
      }
      hint = best;
      window = 4;
    }
    for (let k = -window; k <= window; k++) {
      const i = this.closed ? (((hint + k) % n) + n) % n : hint + k;
      if (i < 0 || i >= n) continue;
      const dx = x - this.px[i];
      const dz = z - this.pz[i];
      const dy = (y - this.py[i]) * 1.5;
      const d = dx * dx + dz * dz + dy * dy;
      if (d < bestD) {
        bestD = d;
        best = i;
      }
    }
    // refine on the segment [best, best+1] or [best-1, best]
    let i0 = best;
    let i1 = this.wrap(best + 1);
    {
      const ax = this.px[i1] - this.px[i0];
      const az = this.pz[i1] - this.pz[i0];
      const dot = (x - this.px[i0]) * ax + (z - this.pz[i0]) * az;
      if (dot < 0 && (this.closed || best > 0)) {
        i1 = i0;
        i0 = this.wrap(best - 1);
      }
    }
    const ax = this.px[i1] - this.px[i0];
    const az = this.pz[i1] - this.pz[i0];
    const al = ax * ax + az * az || 1;
    let f = ((x - this.px[i0]) * ax + (z - this.pz[i0]) * az) / al;
    f = f < 0 ? 0 : f > 1 ? 1 : f;
    const cx = this.px[i0] + ax * f;
    const cz = this.pz[i0] + az * f;
    const cy = this.py[i0] + (this.py[i1] - this.py[i0]) * f;
    const hx = this.hx[i0] + (this.hx[i1] - this.hx[i0]) * f;
    const hz = this.hz[i0] + (this.hz[i1] - this.hz[i0]) * f;
    const hl = Math.hypot(hx, hz) || 1;
    out.hx = hx / hl;
    out.hz = hz / hl;
    out.fx = this.fx[i0];
    out.fy = this.fy[i0];
    out.fz = this.fz[i0];
    out.idx = f > 0.5 ? i1 : i0;
    out.f = f;
    out.s = (i0 + f) * this.ds;
    if (this.closed && i1 === 0 && i0 === n - 1) out.s = (n - 1 + f) * this.ds;
    out.t = (x - cx) * out.hx + (z - cz) * out.hz;
    out.dist2 = bestD;
    out.bankTan = this.bankTan[i0];
    out.y = cy + out.t * out.bankTan + this.rampHeight(out.s, out.t);
    out.halfW = this.halfW[i0];
    out.limitL = this.halfW[i0] + this.shoulderL[i0];
    out.limitR = this.halfW[i0] + this.shoulderR[i0];
    out.wallL = this.wallL[i0] === 1;
    out.wallR = this.wallR[i0] === 1;
    out.gap = this.gap[i0] === 1;
    return out;
  }

  rangeIdx(u0: number, u1: number, fn: (i: number) => void) {
    const a = Math.floor(u0 * this.n);
    const b = Math.floor(u1 * this.n);
    if (b >= a) for (let i = a; i <= b; i++) fn(this.wrap(i));
    else {
      for (let i = a; i < this.n; i++) fn(i);
      for (let i = 0; i <= b; i++) fn(i);
    }
  }
}
