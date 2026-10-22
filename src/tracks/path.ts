import * as THREE from 'three';

export type Vec3T = [number, number, number];
/** Round designer corners while retaining open-route endpoints for clean junctions. */
export function roundRoute(points: Vec3T[], closed: boolean, passes = 2): Vec3T[] {
  let result = points;
  for (let pass = 0; pass < passes; pass++) {
    const next: Vec3T[] = closed ? [] : [result[0]];
    const count = closed ? result.length : result.length - 1;
    for (let i = 0; i < count; i++) {
      const a = result[i], b = result[(i + 1) % result.length];
      next.push(a.map((v, k) => v * 0.75 + b[k] * 0.25) as Vec3T, a.map((v, k) => v * 0.25 + b[k] * 0.75) as Vec3T);
    }
    if (!closed) next.push(result[result.length - 1]);
    result = next;
  }
  return result;
}
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

export interface RoadFrame {
  x: number; y: number; z: number;
  fx: number; fy: number; fz: number;
  hx: number; hz: number;
  ux: number; uy: number; uz: number;
  metric: number;
}
export const roadFrame = (): RoadFrame => ({ x: 0, y: 0, z: 0, fx: 0, fy: 0, fz: 1, hx: -1, hz: 0, ux: 0, uy: 1, uz: 0, metric: 1 });

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
  loops: { s0: number; s1: number; radius: number }[] = [];
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
      const u = i / (closed ? n : n - 1);
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
    if (this.loopAt(s)) {
      this.frameAt(s, frameScratch);
      const f = frameScratch;
      return out.set(f.x + f.hx * t + f.ux * lift, f.y + f.uy * lift, f.z + f.hz * t + f.uz * lift);
    }
    const fi = (this.closed ? ((s % this.length) + this.length) % this.length : Math.max(0, Math.min(this.length, s))) / this.ds;
    const i0 = this.wrap(Math.floor(fi));
    const i1 = this.wrap(i0 + 1);
    const k = fi - Math.floor(fi);
    const x = this.px[i0] + (this.px[i1] - this.px[i0]) * k;
    const y = this.py[i0] + (this.py[i1] - this.py[i0]) * k;
    const z = this.pz[i0] + (this.pz[i1] - this.pz[i0]) * k;
    const hx = this.hx[i0] + (this.hx[i1] - this.hx[i0]) * k;
    const hz = this.hz[i0] + (this.hz[i1] - this.hz[i0]) * k;
    const bank = this.bankTan[i0] + (this.bankTan[i1] - this.bankTan[i0]) * k;
    out.set(x + hx * t, y + t * bank + lift + this.rampHeight(s, t), z + hz * t);
    return out;
  }

  loopAt(s: number) {
    if (this.closed) s = ((s % this.length) + this.length) % this.length;
    return this.loops.find(loop => s >= loop.s0 && s < loop.s1);
  }

  /** Magnetic loop frame. Progress remains monotonic even while the road is upside down. */
  frameAt(s: number, out: RoadFrame): RoadFrame {
    if (this.closed) s = ((s % this.length) + this.length) % this.length;
    const fi = Math.max(0, Math.min(this.length, s)) / this.ds;
    const a = this.wrap(Math.floor(fi)), b = this.wrap(a + 1), k = fi - Math.floor(fi);
    out.x = this.px[a] + (this.px[b] - this.px[a]) * k;
    out.y = this.py[a] + (this.py[b] - this.py[a]) * k;
    out.z = this.pz[a] + (this.pz[b] - this.pz[a]) * k;
    let fx = this.fx[a] + (this.fx[b] - this.fx[a]) * k;
    let fy = this.fy[a] + (this.fy[b] - this.fy[a]) * k;
    let fz = this.fz[a] + (this.fz[b] - this.fz[a]) * k;
    const horizontal = Math.hypot(fx, fz) || 1;
    const dx = fx / horizontal, dz = fz / horizontal;
    out.hx = -dz; out.hz = dx;
    const loop = this.loopAt(s);
    if (loop) {
      const angle = (s - loop.s0) / (loop.s1 - loop.s0) * Math.PI * 2;
      const bend = loop.radius * Math.PI * 2 / (loop.s1 - loop.s0);
      out.x += dx * loop.radius * Math.sin(angle);
      out.z += dz * loop.radius * Math.sin(angle);
      out.y += loop.radius * (1 - Math.cos(angle));
      fx = dx * (1 + bend * Math.cos(angle));
      fz = dz * (1 + bend * Math.cos(angle));
      fy = fy / horizontal + bend * Math.sin(angle);
    }
    out.metric = Math.hypot(fx, fy, fz) || 1;
    out.fx = fx / out.metric; out.fy = fy / out.metric; out.fz = fz / out.metric;
    out.ux = -out.hz * out.fy;
    out.uy = out.hz * out.fx - out.hx * out.fz;
    out.uz = out.hx * out.fy;
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
        const t = dx * this.hx[i] + dz * this.hz[i];
        const surfaceY = this.py[i] + t * this.bankTan[i] + this.rampHeight(i * this.ds, t);
        const dy = Math.max(0, Math.abs(y - surfaceY) - 3) * 2;
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
      const t = dx * this.hx[i] + dz * this.hz[i];
      const surfaceY = this.py[i] + t * this.bankTan[i] + this.rampHeight(i * this.ds, t);
      const dy = Math.max(0, Math.abs(y - surfaceY) - 3) * 1.5;
      const d = dx * dx + dz * dz + dy * dy;
      if (d < bestD) {
        bestD = d;
        best = i;
      }
    }
    // Invert the same bilinear ribbon used by pointAt/rendering. Centre-line-only
    // projection shifts contact along steep banked hairpins and can bury a wheel.
    let i0 = best, i1 = this.wrap(best + 1), f = 0, residual = Infinity;
    for (let offset = -3; offset <= 2; offset++) {
      const a = this.wrap(best + offset), b = this.wrap(a + 1);
      if (a === b) continue;
      const ax = this.px[b] - this.px[a], az = this.pz[b] - this.pz[a];
      const dhx = this.hx[b] - this.hx[a], dhz = this.hz[b] - this.hz[a];
      let q = Math.max(0, Math.min(1, ((x - this.px[a]) * ax + (z - this.pz[a]) * az) / (ax * ax + az * az || 1)));
      let lateral = (x - this.px[a] - ax * q) * this.hx[a] + (z - this.pz[a] - az * q) * this.hz[a];
      for (let iteration = 0; iteration < 4; iteration++) {
        const hx = this.hx[a] + dhx * q, hz = this.hz[a] + dhz * q;
        const dx = ax + dhx * lateral, dz = az + dhz * lateral;
        const rx = this.px[a] + ax * q + hx * lateral - x;
        const rz = this.pz[a] + az * q + hz * lateral - z;
        const determinant = dx * hz - dz * hx;
        if (Math.abs(determinant) < 0.00001) break;
        q = Math.max(0, Math.min(1, q - (rx * hz - rz * hx) / determinant));
        const nhx = this.hx[a] + dhx * q, nhz = this.hz[a] + dhz * q;
        lateral = ((x - this.px[a] - ax * q) * nhx + (z - this.pz[a] - az * q) * nhz) / (nhx * nhx + nhz * nhz || 1);
      }
      const ex = this.px[a] + ax * q + (this.hx[a] + dhx * q) * lateral - x;
      const ez = this.pz[a] + az * q + (this.hz[a] + dhz * q) * lateral - z;
      const surfaceY = this.py[a] + (this.py[b] - this.py[a]) * q + lateral * (this.bankTan[a] + (this.bankTan[b] - this.bankTan[a]) * q) + this.rampHeight((a + q) * this.ds, lateral);
      const dy = Math.max(0, Math.abs(y - surfaceY) - 3);
      const score = ex * ex + ez * ez + dy * dy + Math.abs(surfaceY - y) * 0.0000001;
      if (score < residual) { residual = score; i0 = a; i1 = b; f = q; }
    }
    const ax = this.px[i1] - this.px[i0];
    const az = this.pz[i1] - this.pz[i0];
    const al = ax * ax + az * az || 1;
    const cx = this.px[i0] + ax * f;
    const cz = this.pz[i0] + az * f;
    const cy = this.py[i0] + (this.py[i1] - this.py[i0]) * f;
    const hx = this.hx[i0] + (this.hx[i1] - this.hx[i0]) * f;
    const hz = this.hz[i0] + (this.hz[i1] - this.hz[i0]) * f;
    const hl = Math.hypot(hx, hz) || 1;
    out.hx = hx / hl;
    out.hz = hz / hl;
    // Surface tangent includes the ramp, so wheels follow its incline too.
    const horizontal = Math.sqrt(al);
    let grade = (this.py[i1] - this.py[i0]) / horizontal;
    out.idx = f > 0.5 ? i1 : i0;
    out.f = f;
    out.s = (i0 + f) * this.ds;
    if (this.closed && i1 === 0 && i0 === n - 1) out.s = (n - 1 + f) * this.ds;
    out.t = (x - cx) * out.hx + (z - cz) * out.hz;
    out.dist2 = (x - cx) ** 2 + (z - cz) ** 2;
    out.bankTan = this.bankTan[i0] + (this.bankTan[i1] - this.bankTan[i0]) * f;
    out.y = cy + out.t * out.bankTan + this.rampHeight(out.s, out.t);
    grade += out.t * (this.bankTan[i1] - this.bankTan[i0]) / horizontal;
    for (const ramp of this.ramps) {
      if (out.s >= ramp.s0 && out.s <= ramp.s1 && out.t >= ramp.t0 && out.t <= ramp.t1) {
        const k = (out.s - ramp.s0) / (ramp.s1 - ramp.s0);
        grade += ramp.h / (ramp.s1 - ramp.s0) * (k < 0.3 ? 2 * k / 0.3 : 1);
        break;
      }
    }
    const tangentLength = Math.sqrt(1 + grade * grade);
    out.fx = ax / horizontal / tangentLength;
    out.fy = grade / tangentLength;
    out.fz = az / horizontal / tangentLength;
    out.halfW = this.halfW[i0] + (this.halfW[i1] - this.halfW[i0]) * f;
    out.limitL = out.halfW + this.shoulderL[i0] + (this.shoulderL[i1] - this.shoulderL[i0]) * f;
    out.limitR = out.halfW + this.shoulderR[i0] + (this.shoulderR[i1] - this.shoulderR[i0]) * f;
    out.wallL = this.wallL[i0] === 1;
    out.wallR = this.wallR[i0] === 1;
    // A rendered segment is absent when either endpoint belongs to a gap.
    out.gap = this.gap[i0] === 1 || this.gap[i1] === 1;
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
const frameScratch = roadFrame();
