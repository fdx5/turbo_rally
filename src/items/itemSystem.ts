import * as THREE from 'three';
import { ALL_ITEMS, BASIC_ITEMS, ITEM_ODDS, SKILLS, WEAPON_BY_ID, type Behavior, type Hit, type ItemDef, type Model } from '../data/items';
import type { Racer } from '../race/types';
import { stat } from '../race/types';
import type { TrackWorld } from '../tracks/trackBuilder';
import { itemModel, puddleMesh } from './models';
import type { FX } from '../art/particles';
import { PShape } from '../art/textures';
import { globalRng } from '../core/rng';
import { clamp, wrapAngle } from '../core/math';
import type { SfxId } from '../audio/sfx';

export interface ItemHooks {
  sfx: (id: SfxId, pos?: THREE.Vector3, vol?: number) => void;
  onHit: (victim: Racer, attacker: Racer | null, itemId: string, hit: Hit) => void;
  onBlocked: (victim: Racer) => void;
  shake: (amount: number, who: Racer) => void;
  toast: (who: Racer, text: string) => void;
  screen: (who: Racer, kind: 'blind' | 'flash', dur: number) => void;
}

interface Proj {
  id: string;
  owner: Racer;
  b: Extract<Behavior, { kind: 'projectile' }>;
  obj: THREE.Object3D;
  pos: THREE.Vector3;
  dir: THREE.Vector3;
  speed: number;
  life: number;
  bounces: number;
  pierce: number;
  hitSet: Set<Racer>;
  target: Racer | null;
  s: number; // track arc length (for track-following motions)
  t: number;
  hint: number;
  phase: number;
  age: number;
  vy: number;
  dest?: THREE.Vector3;
  dead: boolean;
  reflected: boolean;
}
interface Trap {
  id: string;
  owner: Racer | null;
  b: Extract<Behavior, { kind: 'trap' }>;
  obj: THREE.Object3D;
  pos: THREE.Vector3;
  r: number;
  life: number;
  dead: boolean;
  armT: number;
}
interface Zone {
  id: string;
  owner: Racer | null;
  pos: THREE.Vector3;
  r: number;
  life: number;
  hit: Hit;
  obj: THREE.Object3D;
  wall: boolean;
  pull: boolean;
  cooldown: Map<Racer, number>;
  normal: THREE.Vector3;
}

const _v = new THREE.Vector3();
const _w = new THREE.Vector3();

export class ItemSystem {
  group = new THREE.Group();
  projs: Proj[] = [];
  traps: Trap[] = [];
  zones: Zone[] = [];
  private pending: { t: number; fn: () => void }[] = [];
  time = 0;
  constructor(
    private world: TrackWorld,
    private racers: Racer[],
    private fx: FX,
    private hooks: ItemHooks,
  ) {}

  // ------------------------------------------------------------------ roulette
  /** Pick an item for rank (1-based), blending equipped shop weapons into the pool (§5.1/§5.3). */
  rollItem(r: Racer): string {
    const rank = r.position || 8;
    const odds = ITEM_ODDS[clamp(rank, 1, 8) - 1];
    const pool: [string, number][] = BASIC_ITEMS.map((it, i) => [it.id, odds[i]]);
    for (const wid of r.weapons) {
      const w = WEAPON_BY_ID[wid];
      if (!w) continue;
      if (rank < w.allowedRanks[0] || rank > w.allowedRanks[1]) continue;
      // ultimate (#40) only for ranks 8..3; strong ones get rarer near the front
      const front = 1 - (rank - 1) / 7;
      const wgt = w.rarityWeight * 1.1 * (1 - front * (w.power - 1) * 0.18);
      if (wgt > 0) pool.push([wid, wgt]);
    }
    const total = pool.reduce((a, [, w]) => a + w, 0);
    let x = globalRng.next() * total;
    for (const [id, w] of pool) {
      x -= w;
      if (x <= 0) return id;
    }
    return pool[0][0];
  }
  startRoulette(r: Racer) {
    if (r.roulette || r.items.length >= 2) return;
    const result = this.rollItem(r);
    const second = r.items.length === 0 && r.charId === 'hana' && globalRng.chance(0.1) ? this.rollItem(r) : undefined;
    r.roulette = { t: 0, dur: 1.2, result, second };
  }
  updateRoulette(r: Racer, dt: number, stopEarly: boolean): boolean {
    const ro = r.roulette;
    if (!ro) return false;
    ro.t += dt;
    if (stopEarly && ro.t > 0.35) ro.t = Math.max(ro.t, ro.dur);
    if (ro.t >= ro.dur) {
      r.items.push(ro.result);
      if (ro.second && r.items.length < 2) r.items.push(ro.second);
      r.roulette = null;
      this.prepareHeld(r);
      return true;
    }
    return false;
  }
  /** Triple items orbit the kart; pudding can be held behind as a shield. */
  prepareHeld(r: Racer) {
    const id = r.items[0];
    if (!id) return;
    const def = ALL_ITEMS[id];
    if (def.behavior.kind === 'projectile' && def.behavior.orbit && !r.orbit) {
      const n = def.behavior.count ?? 3;
      const objs: THREE.Object3D[] = [];
      for (let i = 0; i < n; i++) {
        const o = itemModel(def.behavior.model);
        o.scale.setScalar(0.8);
        this.group.add(o);
        objs.push(o);
      }
      r.orbit = { model: def.behavior.model, count: n, objs };
    }
    if (def.behavior.kind === 'boost' && def.behavior.uses) r.usesLeft = def.behavior.uses;
    if (def.behavior.kind === 'trap' && def.behavior.heldShield && !r.trailing) {
      const o = itemModel(def.behavior.model);
      this.group.add(o);
      r.trailing = { id, obj: o };
    }
  }

  // ------------------------------------------------------------------ usage
  canUse(r: Racer) {
    return r.items.length > 0 && !r.roulette && r.body.sealT <= 0 && r.body.respawnT <= 0;
  }
  useItem(r: Racer) {
    if (!this.canUse(r)) return false;
    const id = r.items[0];
    const def = ALL_ITEMS[id];
    stat(r, id).used++;
    let consumed = true;
    if (def.behavior.kind === 'boost' && r.usesLeft > 1) {
      r.usesLeft--;
      consumed = false;
    }
    if (def.behavior.kind === 'projectile' && def.behavior.orbit && r.orbit) {
      const o = r.orbit.objs.pop();
      if (o) this.group.remove(o);
      r.orbit.count--;
      this.fire(r, id, { ...def.behavior, count: 1 });
      if (r.orbit.count > 0) consumed = false;
      else r.orbit = null;
    } else {
      this.execute(r, id, def.behavior, def);
    }
    if (r.trailing && r.trailing.id === id) {
      this.group.remove(r.trailing.obj);
      r.trailing = null;
    }
    if (consumed) {
      r.items.shift();
      r.usesLeft = 0;
      this.prepareHeld(r);
    }
    return true;
  }
  useSkill(r: Racer, vehicleSkill: string) {
    const def = SKILLS[vehicleSkill];
    if (!def) return;
    stat(r, def.id).used++;
    r.skillT = 2.5;
    this.hooks.sfx('skill', r.model.root.position);
    this.execute(r, def.id, def.behavior, def);
  }

  private execute(r: Racer, id: string, b: Behavior, def: ItemDef) {
    const body = r.body;
    const pos = r.model.root.position;
    switch (b.kind) {
      case 'boost':
        body.boostItem(b.dur, b.mult);
        this.hooks.sfx('boost', pos);
        break;
      case 'shield':
        r.shieldHits = b.hits;
        r.shieldT = b.dur;
        r.reflect = !!b.reflect;
        r.knockShield = !!b.knock;
        this.hooks.sfx('shield', pos);
        break;
      case 'invincible':
        body.starT = b.dur;
        body.starMult = b.mult;
        body.starScale = b.scale ?? 1;
        if (b.cleanse) this.cleanse(r);
        if (b.pushRadius) this.areaRadius(r, b.pushRadius, { fx: 'push', dur: 0.6 }, id);
        this.hooks.sfx(id === 'rainbow' ? 'star' : 'boost', pos);
        break;
      case 'intangible':
        body.ghostT = b.dur;
        this.hooks.sfx('teleport', pos);
        break;
      case 'projectile':
        this.fire(r, id, b);
        break;
      case 'trap':
        this.dropTrap(r, id, b);
        break;
      case 'zone':
        this.dropZone(r, id, b);
        break;
      case 'area':
        this.area(r, id, b);
        break;
      case 'teleport': {
        const w = this.world.main;
        const s = body.progressS + b.dist;
        const i = w.idxAtS(s);
        this.spawnZoneAt(r, id, pos.clone(), 3, 4, { fx: 'spin', dur: 1, coins: 2 }, '#B9A6FF', 'swirl');
        body.x = w.px[i];
        body.z = w.pz[i];
        body.y = w.py[i] + 0.5;
        body.px = body.x;
        body.pz = body.z;
        body.py = body.y;
        body.yaw = Math.atan2(w.fx[i], w.fz[i]);
        body.hints.fill(-1);
        body.hints[0] = i;
        this.fx.burst(new THREE.Vector3(body.x, body.y + 1, body.z), 24, { colors: ['#B9A6FF', '#FFC8DD', '#FFFFFF'], shape: PShape.Sparkle, additive: true, intensity: 2 });
        this.hooks.sfx('teleport', pos);
        break;
      }
      case 'glide':
        body.glideT = b.dur;
        body.boost(b.dur, 1.25, true);
        this.hooks.sfx('boost', pos);
        break;
      case 'autopilot':
        body.autoT = b.dur;
        body.autoMult = b.mult;
        body.starT = Math.max(body.starT, b.dur * 0.5);
        body.starMult = 1;
        this.hooks.sfx('boost', pos);
        break;
      case 'steal': {
        let best: Racer | null = null;
        let bd = Infinity;
        for (const o of this.racers) {
          if (o === r || !o.items.length) continue;
          const d = o.model.root.position.distanceToSquared(pos);
          if (d < bd) {
            bd = d;
            best = o;
          }
        }
        if (best) {
          const it = best.items.shift()!;
          if (best.orbit) {
            best.orbit.objs.forEach((o) => this.group.remove(o));
            best.orbit = null;
          }
          if (best.trailing) {
            this.group.remove(best.trailing.obj);
            best.trailing = null;
          }
          if (r.items.length < 2) r.items.push(it);
          this.prepareHeld(r);
          this.hooks.toast(best, '아이템을 뺏겼어요!');
          this.hooks.toast(r, `${ALL_ITEMS[it].name} 획득!`);
        }
        this.hooks.sfx('zap', pos);
        break;
      }
      case 'lucky': {
        const rank = r.position;
        const pool = rank <= 2 ? ['bubble', 'pudding', 'fakebox', 'jelly'] : rank <= 5 ? ['heart', 'jelly3', 'sugar', 'bubble'] : ['sugar3', 'heart', 'rainbow', 'mini'];
        if (r.items.length < 2) r.items.push(globalRng.pick(pool));
        this.prepareHeld(r);
        this.hooks.sfx('itemGet', pos);
        break;
      }
      case 'lockon': {
        const tgt = this.racerAhead(r, 1)[0] ?? null;
        r.lockTarget = tgt;
        body.boost(b.dur, 1.45, true);
        body.starT = Math.max(body.starT, 0.2);
        this.hooks.sfx('siren', pos);
        break;
      }
      case 'stomp':
        body.vy = 14;
        body.grounded = false;
        this.pending.push({
          t: this.time + 0.85,
          fn: () => {
            this.areaRadius(r, b.radius, b.hit, id);
            this.fx.burst(r.model.root.position.clone(), 30, { colors: ['#FFD6A5', '#FFFFFF', '#CDB4DB'], shape: PShape.Puff, speed: 12, up: 1, gravity: 2, size: 1.2, sizeEnd: 2 });
            this.hooks.sfx('stomp', r.model.root.position);
            this.hooks.shake(0.6, r);
          },
        });
        break;
      case 'suck': {
        // vacuum nearby coins from other karts, then throw a bag bomb
        for (const o of this.racers) {
          if (o === r) continue;
          if (o.model.root.position.distanceTo(pos) < b.radius && o.body.coins > 0) {
            const n = Math.min(2, o.body.coins);
            o.body.coins -= n;
            body.coins = Math.min(body.maxCoins, body.coins + n);
          }
        }
        if (b.then) this.pending.push({ t: this.time + 0.4, fn: () => this.execute(r, id, b.then!, def) });
        this.hooks.sfx('zap', pos);
        break;
      }
    }
  }
  private cleanse(r: Racer) {
    const b = r.body;
    b.spinT = b.stopT = b.slowT = b.slipT = b.freezeT = b.reverseT = b.sleepT = b.wobbleT = b.shrinkT = b.blindT = b.sealT = 0;
  }

  // ------------------------------------------------------------------ projectiles
  private fire(r: Racer, id: string, b: Extract<Behavior, { kind: 'projectile' }>) {
    const n = b.count ?? 1;
    const body = r.body;
    const fwd = new THREE.Vector3(Math.sin(body.yaw), 0, Math.cos(body.yaw));
    const right = new THREE.Vector3(-fwd.z, 0, fwd.x);
    const targets = b.target === 'ahead2' ? this.racerAhead(r, 2) : b.target === 'ahead' ? this.racerAhead(r, 1) : b.target === 'leader' ? [this.leader(r)] : [];
    for (let k = 0; k < n; k++) {
      if (b.motion === 'rain') {
        this.pending.push({ t: this.time + 0.25 * k, fn: () => this.meteor(r, id, b, 40 + globalRng.range(0, 160)) });
        continue;
      }
      const back = b.motion === 'rollBack';
      const spread = n > 1 && b.motion === 'straight' ? (k - (n - 1) / 2) * 0.12 : 0;
      const dir = (back ? fwd.clone().negate() : fwd.clone()).applyAxisAngle(new THREE.Vector3(0, 1, 0), spread);
      const start = r.model.root.position.clone().addScaledVector(dir, 2.6).add(new THREE.Vector3(0, 0.7, 0));
      if (n > 1 && b.motion === 'homing') start.addScaledVector(right, (k - (n - 1) / 2) * 1.2);
      const obj = itemModel(b.model);
      obj.position.copy(start);
      this.group.add(obj);
      let target: Racer | null = null;
      if (b.target === 'random') {
        const ahead = this.racers.filter((o) => o !== r && o.position < r.position);
        const pool = ahead.length ? ahead : this.racers.filter((o) => o !== r);
        target = pool[(k + globalRng.int(0, 99)) % pool.length] ?? null;
      } else target = targets[k % Math.max(1, targets.length)] ?? null;
      const p: Proj = {
        id,
        owner: r,
        b,
        obj,
        pos: start,
        dir,
        speed: b.speed ?? 40,
        life: b.life ?? 6,
        bounces: b.bounces ?? 0,
        pierce: b.pierce ?? 1,
        hitSet: new Set(),
        target,
        s: body.progressS + (back ? -3 : 3),
        t: body.proj.t,
        hint: -1,
        phase: 0,
        age: 0,
        vy: 0,
        dead: false,
        reflected: false,
      };
      if (b.motion === 'lob') {
        const dist = 26 + k * 6;
        const dest = new THREE.Vector3();
        this.world.main.pointAt(body.progressS + dist, body.proj.t + (k - (n - 1) / 2) * 4, dest, 0);
        p.dest = dest;
        p.vy = 13;
        const flight = (2 * p.vy) / 34;
        p.speed = start.distanceTo(dest) / flight;
        p.dir.copy(dest).sub(start).setY(0).normalize();
      }
      this.projs.push(p);
    }
    const s: SfxId = b.motion === 'homing' ? (b.model === 'heart' || b.model === 'letter' ? 'heart' : 'throw') : b.motion === 'leader' ? 'comet' : b.model === 'jelly' || b.model === 'golfball' ? 'jelly' : 'throw';
    this.hooks.sfx(s, r.model.root.position);
  }
  private meteor(r: Racer, id: string, b: Extract<Behavior, { kind: 'projectile' }>, ahead: number) {
    const dest = new THREE.Vector3();
    const s = r.body.progressS + ahead;
    const i = this.world.main.idxAtS(s);
    this.world.main.pointAt(s, globalRng.range(-this.world.main.halfW[i] + 2, this.world.main.halfW[i] - 2), dest, 0);
    const obj = itemModel(b.model);
    obj.position.set(dest.x, dest.y + 40, dest.z);
    this.group.add(obj);
    this.projs.push({ id, owner: r, b, obj, pos: obj.position.clone(), dir: new THREE.Vector3(0, -1, 0), speed: 40, life: 3, bounces: 0, pierce: 9, hitSet: new Set(), target: null, s, t: 0, hint: -1, phase: 0, age: 0, vy: -40, dest, dead: false, reflected: false });
  }
  private racerAhead(r: Racer, n: number): Racer[] {
    const sorted = [...this.racers].sort((a, b) => a.position - b.position);
    const out: Racer[] = [];
    for (let p = r.position - 1; p >= 1 && out.length < n; p--) {
      const o = sorted[p - 1];
      if (o && o !== r) out.push(o);
    }
    if (!out.length) {
      // already first: target the one right behind instead
      const behind = sorted[r.position];
      if (behind) out.push(behind);
    }
    return out;
  }
  private leader(r: Racer): Racer {
    const first = this.racers.find((o) => o.position === 1)!;
    return first === r ? (this.racers.find((o) => o.position === 2) ?? r) : first;
  }

  private dropTrap(r: Racer, id: string, b: Extract<Behavior, { kind: 'trap' }>) {
    const n = b.count ?? 1;
    const body = r.body;
    for (let k = 0; k < n; k++) {
      const pos = new THREE.Vector3();
      const sc = b.scatter ?? 0;
      this.world.main.pointAt(body.progressS - 3.5 - (sc ? globalRng.range(0, sc) : 0), body.proj.t + (sc ? globalRng.range(-sc, sc) : 0), pos, 0);
      if (!sc) pos.set(body.x - Math.sin(body.yaw) * 2.8, body.y, body.z - Math.cos(body.yaw) * 2.8);
      const obj = itemModel(b.model);
      obj.position.copy(pos);
      this.group.add(obj);
      this.traps.push({ id, owner: r, b, obj, pos, r: b.radius ?? 1.3, life: b.life ?? 60, dead: false, armT: 0.4 });
    }
    this.hooks.sfx('plop', r.model.root.position);
  }
  private dropZone(r: Racer, id: string, b: Extract<Behavior, { kind: 'zone' }>) {
    const body = r.body;
    if (b.at === 'trail') {
      const steps = Math.ceil(b.dur / 0.25);
      for (let k = 0; k < steps; k++) {
        this.pending.push({
          t: this.time + k * 0.25,
          fn: () => {
            const p = new THREE.Vector3(r.body.x - Math.sin(r.body.yaw) * 2.5, r.body.y, r.body.z - Math.cos(r.body.yaw) * 2.5);
            this.spawnZoneAt(r, id, p, b.radius, 4, b.hit, b.tint, 'puddle');
          },
        });
      }
      return;
    }
    const pos = new THREE.Vector3(body.x - Math.sin(body.yaw) * (3 + b.radius), body.y, body.z - Math.cos(body.yaw) * (3 + b.radius));
    const z = this.spawnZoneAt(r, id, pos, b.radius, b.dur, b.hit, b.tint, b.pull ? 'swirl' : b.model === 'sand' ? 'mound' : 'puddle', b.wall, b.pull, b.model);
    z.normal.set(Math.sin(body.yaw), 0, Math.cos(body.yaw));
    if (b.wall) z.obj.rotation.y = body.yaw;
    this.hooks.sfx(b.model === 'sand' ? 'splash' : 'plop', r.model.root.position);
  }
  private spawnZoneAt(r: Racer | null, id: string, pos: THREE.Vector3, radius: number, dur: number, hit: Hit, tint: string, kind: 'puddle' | 'mound' | 'swirl', wall = false, pull = false, model?: Model): Zone {
    let obj: THREE.Object3D;
    if (wall && model) {
      obj = itemModel(model);
    } else obj = puddleMesh(radius, tint, kind);
    obj.position.copy(pos).add(new THREE.Vector3(0, 0.06, 0));
    this.group.add(obj);
    const z: Zone = { id, owner: r, pos, r: radius, life: dur, hit, obj, wall, pull, cooldown: new Map(), normal: new THREE.Vector3(0, 0, 1) };
    this.zones.push(z);
    return z;
  }

  private area(r: Racer, id: string, b: Extract<Behavior, { kind: 'area' }>) {
    const body = r.body;
    const pos = r.model.root.position;
    const fwd = _v.set(Math.sin(body.yaw), 0, Math.cos(body.yaw));
    const L = this.world.main.length;
    const victims: Racer[] = [];
    for (const o of this.racers) {
      if (o === r) continue;
      const d = _w.copy(o.model.root.position).sub(pos);
      const dist = d.length();
      switch (b.shape) {
        case 'cone':
          if (dist < (b.range ?? 30) && d.normalize().dot(fwd) > 0.82) victims.push(o);
          break;
        case 'beam': {
          const along = d.dot(fwd);
          const lat = Math.sqrt(Math.max(0, dist * dist - along * along));
          if (along > 0 && along < (b.range ?? 60) && lat < 2.4) victims.push(o);
          break;
        }
        case 'radius':
          if (dist < (b.range ?? 10)) victims.push(o);
          break;
        case 'aheadRange': {
          const ds = (((o.raceDist - r.raceDist) % L) + L) % L;
          if (o.raceDist > r.raceDist && o.raceDist - r.raceDist < (b.range ?? 300)) victims.push(o);
          void ds;
          break;
        }
        case 'allOthers':
          if (id === 'w_legend' && r.position < 3) break;
          victims.push(o);
          break;
        case 'aheadAll':
          if (o.position < r.position) victims.push(o);
          break;
        case 'aheadN':
          break;
      }
    }
    if (b.shape === 'aheadN') victims.push(...this.racerAhead(r, b.n ?? 1));
    // visuals
    if (b.shape === 'cone' || b.shape === 'beam') {
      for (let i = 0; i < 40; i++) {
        const a = (Math.random() - 0.5) * (b.shape === 'cone' ? 0.9 : 0.08);
        const sp = 30 + Math.random() * 20;
        const dir = fwd.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), a);
        const col = id === 'waterCannon' ? '#9ED8F0' : id === 'w_flash' ? '#FFFFFF' : ['#FFADAD', '#FFD6A5', '#FDFFB6', '#B9FBC0', '#A2D2FF', '#CDB4DB'][i % 6];
        this.fx.glow.spawn({ pos: pos.clone().add(new THREE.Vector3(0, 1.2, 0)), vel: { x: dir.x * sp, y: Math.random() * 2, z: dir.z * sp }, color: col, life: (b.range ?? 30) / sp, size: id === 'waterCannon' ? 0.9 : 0.6, sizeEnd: 1.4, shape: id === 'waterCannon' ? PShape.Drop : PShape.Dot, intensity: 1.8 });
      }
    } else if (b.shape === 'radius') {
      this.fx.burst(pos.clone().add(new THREE.Vector3(0, 1, 0)), 36, { colors: id === 'emp' ? ['#7DF9FF', '#FFFFFF'] : ['#FFE066', '#FFFFFF', '#FFC8DD'], shape: id === 'emp' ? PShape.Sparkle : PShape.Ring, speed: (b.range ?? 10) * 1.6, up: 0, gravity: 0, additive: true, intensity: 2, size: 0.8 });
    }
    const sfx: SfxId = id === 'emp' ? 'zap' : id === 'honkWave' ? 'honk' : id === 'waterCannon' ? 'splash' : id === 'cotton' ? 'cloud' : id === 'mini' || id === 'w_thundercloud' ? 'shrink' : id === 'w_flash' ? 'confetti' : 'zap';
    this.hooks.sfx(sfx, pos);
    victims.forEach((o, i) => {
      const hit: Hit = { ...b.hit };
      if (b.byRank) hit.dur = 3 + ((8 - o.position) / 7) * 3; // leader shrinks longest
      const delay = id === 'w_legend' ? i * 0.35 : b.shape === 'allOthers' || b.shape === 'aheadAll' || b.shape === 'aheadN' ? 0.1 + i * 0.04 : 0;
      const run = () => {
        if (hit.fx === 'blind') {
          this.hooks.screen(o, 'blind', hit.dur);
          o.body.blindT = hit.dur;
          return;
        }
        if (id === 'w_legend' || id === 'w_thundercloud' || id === 'mini') {
          this.fx.burst(o.model.root.position.clone().add(new THREE.Vector3(0, 6, 0)), 12, { colors: id === 'w_legend' ? ['#FFE066', '#FFFFFF'] : ['#FFE066', '#A2D2FF'], shape: id === 'w_legend' ? PShape.Star : PShape.Sparkle, speed: 4, up: -8, gravity: 20, additive: true, intensity: 2.2 });
        }
        this.applyHit(o, r, id, hit, false);
      };
      if (delay > 0) this.pending.push({ t: this.time + delay, fn: run });
      else run();
    });
  }
  private areaRadius(r: Racer, radius: number, hit: Hit, id: string) {
    for (const o of this.racers) {
      if (o === r) continue;
      if (o.model.root.position.distanceTo(r.model.root.position) < radius) this.applyHit(o, r, id, hit, false);
    }
  }

  // ------------------------------------------------------------------ hit resolution
  /** Apply a hit honouring invulnerability, shields and reflection. Returns true if it landed. */
  applyHit(v: Racer, attacker: Racer | null, itemId: string, hit: Hit, projectile: boolean, proj?: Proj): boolean {
    const b = v.body;
    if (hit.fx === 'push') {
      if (attacker && b.starT <= 0) {
        const d = _v.copy(v.model.root.position).sub(attacker.model.root.position).setY(0).normalize();
        const right = Math.sin(b.yaw) * d.z - Math.cos(b.yaw) * d.x;
        b.vl += (right > 0 ? -1 : 1) * 9;
        b.speed *= 0.8;
      }
      return true;
    }
    if (b.invulnerable) return false;
    if (v.shieldHits > 0) {
      v.shieldHits--;
      if (v.reflect && proj && projectile && attacker) {
        proj.dir.negate();
        proj.target = attacker;
        proj.owner = v;
        proj.reflected = true;
        proj.hitSet.clear();
      }
      if (v.shieldHits <= 0) v.shieldT = 0;
      this.hooks.onBlocked(v);
      this.hooks.sfx('shieldBreak', v.model.root.position);
      return false;
    }
    if (projectile && v.trailing && proj && proj.dir.dot(_v.set(Math.sin(b.yaw), 0, Math.cos(b.yaw))) > 0.3) {
      // pudding held behind blocks one hit from behind
      this.group.remove(v.trailing.obj);
      v.items.shift();
      v.trailing = null;
      this.hooks.sfx('splat', v.model.root.position);
      return false;
    }
    const isStun = hit.fx === 'spin' || hit.fx === 'stop' || hit.fx === 'launch';
    const dur = hit.dur * (isStun ? b.tune.stunDuration : 1);
    switch (hit.fx) {
      case 'spin':
        b.spinT = dur;
        break;
      case 'stop':
        b.stopT = dur;
        b.vy = 9;
        b.grounded = false;
        break;
      case 'launch':
        b.spinT = dur;
        b.vy = 11;
        b.grounded = false;
        break;
      case 'slow':
        b.slowT = dur;
        b.slowAmt = hit.amt ?? 0.55;
        break;
      case 'slip':
        b.slipT = dur;
        b.vl += (Math.random() < 0.5 ? -1 : 1) * 6;
        break;
      case 'float':
        b.floatT = dur;
        break;
      case 'freeze':
        b.freezeT = dur;
        this.hooks.sfx('freeze', v.model.root.position);
        break;
      case 'reverse':
        b.reverseT = dur;
        break;
      case 'sleep':
        b.sleepT = dur;
        this.hooks.sfx('sleep', v.model.root.position);
        break;
      case 'wobble':
        b.wobbleT = dur;
        this.hooks.toast(v, '맵다!');
        break;
      case 'shrink':
        b.shrinkT = dur;
        break;
      case 'squash':
        b.squashT = dur;
        break;
      case 'flash':
        this.hooks.screen(v, 'flash', dur);
        b.blindT = dur * 0.6;
        break;
      case 'blind':
        this.hooks.screen(v, 'blind', dur);
        b.blindT = dur;
        break;
      case 'seal':
        b.sealT = dur;
        b.slowT = 0.8;
        b.slowAmt = 0.7;
        break;
      case 'pull':
        b.pullT = dur;
        break;
    }
    if (isStun) {
      b.drifting = false;
      b.boostT = 0;
      b.invulT = dur + 1.5; // §5.2 post-hit invulnerability
      const lost = Math.min(b.coins, hit.coins ?? 3);
      b.coins -= lost;
      for (let i = 0; i < lost; i++)
        this.fx.normal.spawn({ pos: v.model.root.position.clone().add(new THREE.Vector3(0, 1.2, 0)), vel: { x: (Math.random() - 0.5) * 8, y: 6 + Math.random() * 3, z: (Math.random() - 0.5) * 8 }, color: ['#FFC8DD', '#FDFFB6', '#A2D2FF'][i % 3], life: 0.9, size: 0.5, sizeEnd: 0.3, shape: PShape.Star, gravity: 18, spin: 8 });
    }
    // gauge refills a bit when hit (comeback, §5.4)
    v.gauge = Math.min(100, v.gauge + 10);
    stat(v, itemId).gotHit++;
    if (attacker && attacker !== v) {
      stat(attacker, itemId).hits++;
      attacker.hitsDealt++;
    }
    v.hitsTaken++;
    this.hooks.onHit(v, attacker, itemId, hit);
    this.fx.burst(v.model.root.position.clone().add(new THREE.Vector3(0, 1.5, 0)), 14, { colors: ['#FFE066', '#FFFFFF', '#FFC8DD'], shape: PShape.Star, speed: 6, up: 3, gravity: 6, additive: true, intensity: 2, size: 0.5 });
    return true;
  }

  // ------------------------------------------------------------------ update
  update(dt: number) {
    this.time += dt;
    for (let i = this.pending.length - 1; i >= 0; i--) {
      if (this.pending[i].t <= this.time) {
        const p = this.pending[i];
        this.pending.splice(i, 1);
        p.fn();
      }
    }
    const main = this.world.main;
    // racers: shields, orbiting items, trailing items, lock-on
    for (const r of this.racers) {
      if (r.shieldT > 0) {
        r.shieldT -= dt;
        if (r.shieldT <= 0) r.shieldHits = 0;
      }
      r.model.showShield(r.shieldHits > 0);
      if (r.skillT > 0) r.skillT -= dt;
      const rp = r.model.root.position;
      if (r.orbit) {
        r.orbit.objs.forEach((o, k) => {
          const a = this.time * 5 + (k / r.orbit!.objs.length) * Math.PI * 2;
          o.position.set(rp.x + Math.cos(a) * 2.2, rp.y + 0.8, rp.z + Math.sin(a) * 2.2);
          o.rotation.y = a;
        });
        // orbiting items act as a shield too
        for (const p of this.projs) {
          if (p.owner === r || p.dead) continue;
          for (const o of r.orbit.objs) {
            if (o.position.distanceTo(p.pos) < 1.4) {
              p.dead = true;
              this.pop(p.pos, ['#B9FBC0', '#FFFFFF']);
            }
          }
        }
      }
      if (r.trailing) {
        const b = r.body;
        r.trailing.obj.position.set(rp.x - Math.sin(b.yaw) * 2.4, rp.y + 0.1, rp.z - Math.cos(b.yaw) * 2.4);
        r.trailing.obj.rotation.y = b.yaw;
      }
      if (r.lockTarget) {
        const tgt = r.lockTarget;
        const d = _v.copy(tgt.model.root.position).sub(rp);
        if (r.body.boostT <= 0 || d.length() > 120) r.lockTarget = null;
        else {
          const want = Math.atan2(d.x, d.z);
          r.body.yaw += wrapAngle(want - r.body.yaw) * Math.min(1, dt * 2.5);
          if (d.length() < 2.6) {
            this.applyHit(tgt, r, 'sirenChase', { fx: 'spin', dur: 1.2, coins: 3 }, false);
            r.lockTarget = null;
          }
        }
      }
      // star / knock-shield contact
      if (r.body.starT > 0 || (r.knockShield && r.shieldHits > 0)) {
        for (const o of this.racers) {
          if (o === r) continue;
          const sc = r.body.starScale > 1 ? 1.6 : 1;
          if (o.model.root.position.distanceTo(rp) < 2.4 * sc && !o.body.invulnerable) {
            if (r.body.starT > 0) this.applyHit(o, r, r.body.starScale > 1 ? 'busRush' : 'rainbow', { fx: 'launch', dur: 1.0, coins: 2 }, false);
            else this.applyHit(o, r, 'w_superbubble', { fx: 'push', dur: 0.5 }, false);
          }
        }
      }
    }
    // projectiles
    for (const p of this.projs) {
      if (p.dead) continue;
      p.age += dt;
      p.life -= dt;
      if (p.life <= 0) {
        p.dead = true;
        if (p.b.motion === 'lob' || p.b.aoe) this.explode(p);
        continue;
      }
      this.moveProj(p, dt);
      if (p.dead) continue;
      p.obj.position.copy(p.pos);
      p.obj.rotation.y += dt * (p.b.motion === 'wander' ? 18 : 3);
      // trails
      if (Math.random() < 0.5)
        this.fx.glow.spawn({ pos: p.pos, vel: { x: 0, y: 0.5, z: 0 }, color: p.b.model === 'heart' || p.b.model === 'letter' ? '#FF9EC7' : p.b.model === 'comet' || p.b.model === 'crown' ? '#FFE066' : '#FFFFFF', life: 0.35, size: p.b.motion === 'leader' ? 1.2 : 0.4, sizeEnd: 0, shape: p.b.model === 'heart' ? PShape.Heart : PShape.Sparkle, intensity: 1.8 });
      // collisions with karts
      if (p.b.motion !== 'lob' && p.b.motion !== 'rain' && !(p.b.motion === 'leader' && p.phase === 0)) {
        const rad = (p.b.radius ?? 0.8) + 1.2;
        for (const o of this.racers) {
          if (p.hitSet.has(o)) continue;
          if (o === p.owner && p.age < 0.6 && !p.reflected) continue;
          if (o === p.owner && p.b.motion === 'boomerang') continue;
          const d2 = o.model.root.position.distanceToSquared(_w.copy(p.pos).setY(p.pos.y - 0.4));
          if (d2 < rad * rad) {
            p.hitSet.add(o);
            const landed = this.applyHit(o, p.owner, p.id, p.b.hit, true, p);
            if (p.reflected && !landed) continue;
            if (landed || !o.body.invulnerable) {
              p.pierce--;
              if (p.b.aoe) this.explode(p);
              if (p.pierce <= 0 && !p.reflected) {
                p.dead = true;
                this.pop(p.pos, ['#FFFFFF', '#FFE066', '#FFC8DD']);
              }
            }
          }
        }
        // projectile vs trap
        for (const t of this.traps) {
          if (!t.dead && t.pos.distanceToSquared(p.pos) < 2.2 * 2.2 && p.b.motion !== 'trackFly') {
            t.dead = true;
            p.pierce--;
            this.pop(t.pos, ['#FFFFFF', '#FFD98A']);
            if (p.pierce <= 0) p.dead = true;
          }
        }
      }
    }
    // traps
    for (const t of this.traps) {
      if (t.dead) continue;
      t.life -= dt;
      t.armT -= dt;
      if (t.life <= 0) {
        t.dead = true;
        continue;
      }
      if (t.b.model === 'fakebox') t.obj.rotation.y += dt * 1.5;
      if (t.armT > 0) continue;
      const rad = t.b.proximity ?? t.r + 1.0;
      for (const o of this.racers) {
        const d = o.model.root.position.distanceTo(t.pos);
        if (d < rad) {
          t.dead = true;
          if (this.applyHit(o, t.owner, t.id, t.b.hit, false)) this.hooks.sfx(t.b.model === 'popcorn' ? 'poof' : 'splat', t.pos);
          this.pop(t.pos, t.b.model === 'pudding' ? ['#FFD98A', '#A0603C'] : ['#FFFFFF', '#FFE066']);
          break;
        }
      }
    }
    // zones
    for (const z of this.zones) {
      if (z.life <= 0) continue;
      z.life -= dt;
      const fade = Math.min(1, z.life / 0.5);
      z.obj.scale.setScalar(Math.min(1, (this.time % 1000) > 0 ? fade : 1));
      if (z.pull) z.obj.rotation.y += dt * 4;
      for (const o of this.racers) {
        if (o === z.owner && z.life > (z.wall ? 0 : 1e9)) continue;
        const d = _v.copy(o.model.root.position).sub(z.pos);
        d.y = 0;
        const dist = d.length();
        if (dist > z.r + 1) continue;
        if (o === z.owner) continue;
        if (z.pull && dist > 0.5) {
          o.body.x -= (d.x / dist) * 9 * dt;
          o.body.z -= (d.z / dist) * 9 * dt;
        }
        const cd = z.cooldown.get(o) ?? 0;
        if (cd > this.time) continue;
        z.cooldown.set(o, this.time + (z.wall ? 1.5 : 0.35));
        if (z.wall) {
          o.body.speed = -Math.abs(o.body.speed) * 0.3;
          this.hooks.sfx('wall', o.model.root.position);
        }
        this.applyHit(o, z.owner, z.id, z.hit, false);
      }
    }
    // cleanup
    const keep = <T extends { dead?: boolean; life: number; obj: THREE.Object3D }>(arr: T[]) =>
      arr.filter((x) => {
        const alive = !(x.dead ?? false) && x.life > 0;
        if (!alive) this.group.remove(x.obj);
        return alive;
      });
    this.projs = keep(this.projs);
    this.traps = keep(this.traps);
    this.zones = keep(this.zones as (Zone & { dead?: boolean })[]);
    void main;
  }

  private moveProj(p: Proj, dt: number) {
    const main = this.world.main;
    const L = main.length;
    switch (p.b.motion) {
      case 'straight': {
        p.pos.addScaledVector(p.dir, p.speed * dt);
        const pr = main.project(p.pos.x, p.pos.y, p.pos.z, p.hint, tmpProj);
        p.hint = pr.idx;
        const lim = pr.t < 0 ? pr.limitL : pr.limitR;
        if (Math.abs(pr.t) > lim - 0.6) {
          if ((pr.t < 0 ? pr.wallL : pr.wallR) && p.bounces > 0) {
            // reflect across path direction
            const n = _v.set(pr.hx, 0, pr.hz).multiplyScalar(Math.sign(pr.t));
            p.dir.addScaledVector(n, -2 * p.dir.dot(n)).normalize();
            p.pos.addScaledVector(n, -(Math.abs(pr.t) - lim + 0.7));
            p.bounces--;
            this.hooks.sfx('jellyBounce', p.pos, 0.6);
          } else if (Math.abs(pr.t) > lim + 2) p.dead = true;
        }
        p.pos.y += (pr.y + 0.6 - p.pos.y) * Math.min(1, dt * 12);
        break;
      }
      case 'homing':
      case 'centerline':
      case 'trackFly':
      case 'leader': {
        const tgt = p.target;
        const fly = p.b.motion === 'leader' ? 14 : p.b.motion === 'trackFly' ? 3 : 0.7;
        if (p.b.motion === 'homing' && tgt && tgt.model.root.position.distanceTo(p.pos) < 22) p.phase = 2;
        if (p.b.motion === 'leader' && tgt && Math.abs(tgt.raceDist - this.distOf(p)) < 6) p.phase = 2;
        if (p.phase < 2) {
          p.s += p.speed * dt;
          const i = main.idxAtS(p.s);
          let tt = p.t;
          if (tgt && p.b.motion !== 'centerline') tt += ((tgt.body.proj.t ?? 0) - tt) * Math.min(1, dt * 2);
          else tt += (0 - tt) * Math.min(1, dt * 1.5);
          p.t = tt;
          main.pointAt(p.s, tt, _w, fly);
          p.dir.copy(_w).sub(p.pos).normalize();
          p.pos.copy(_w);
          void i;
          if (p.b.motion === 'leader') p.phase = 1;
        } else if (tgt) {
          const tp = _w.copy(tgt.model.root.position).add(_v.set(0, 0.8, 0));
          const d = tp.sub(p.pos);
          const len = d.length();
          const sp = Math.max(p.speed, tgt.body.speed + 12);
          p.pos.addScaledVector(d.normalize(), Math.min(len, sp * dt));
          if (p.b.motion === 'leader' && len < 3) {
            this.explode(p);
            p.dead = true;
          }
        }
        if (p.b.motion === 'leader' && p.age > (p.b.life ?? 20) - 0.1) p.dead = true;
        break;
      }
      case 'lob': {
        p.pos.addScaledVector(p.dir, p.speed * dt);
        p.vy -= 34 * dt;
        p.pos.y += p.vy * dt;
        if (p.dest && p.vy < 0 && p.pos.y <= p.dest.y + 0.4) {
          p.dead = true;
          this.explode(p);
        }
        break;
      }
      case 'rain': {
        p.pos.y -= 40 * dt;
        if (p.dest && p.pos.y <= p.dest.y + 0.5) {
          p.dead = true;
          this.explode(p);
        }
        break;
      }
      case 'rollBack': {
        p.s -= p.speed * dt;
        main.pointAt(p.s, p.t, _w, (p.b.radius ?? 1) * (p.b.model === 'beachball' ? 1 : 0.4));
        p.pos.copy(_w);
        p.obj.rotation.x -= dt * 4;
        if (p.b.model === 'pudding') p.obj.scale.set(6, 2.4, 2);
        break;
      }
      case 'boomerang': {
        const owner = p.owner;
        if (p.age < 1.4) p.pos.addScaledVector(p.dir, p.speed * dt * (1 - p.age / 1.6));
        else {
          const d = _w.copy(owner.model.root.position).add(_v.set(0, 0.8, 0)).sub(p.pos);
          if (d.length() < 2) p.dead = true;
          p.pos.addScaledVector(d.normalize(), p.speed * dt);
          if (p.age > 1.45 && p.phase === 0) {
            p.hitSet.clear();
            p.phase = 1;
          }
        }
        const pr = main.project(p.pos.x, p.pos.y, p.pos.z, p.hint, tmpProj);
        p.hint = pr.idx;
        p.pos.y += (pr.y + 0.9 - p.pos.y) * Math.min(1, dt * 10);
        break;
      }
      case 'wander': {
        p.s += p.speed * dt * (Math.sin(p.age * 0.7) > -0.3 ? 1 : -1);
        p.t = Math.sin(p.age * 1.3) * (main.halfW[main.idxAtS(p.s)] - 2);
        main.pointAt(p.s, p.t, _w, 0.5);
        p.pos.copy(_w);
        break;
      }
    }
    void L;
  }
  private distOf(p: Proj) {
    const r = p.target;
    if (!r) return 0;
    return r.raceDist - (((r.body.progressS - p.s) % this.world.main.length) + this.world.main.length) % this.world.main.length;
  }
  private explode(p: Proj) {
    const aoe = p.b.aoe ?? 0;
    const pos = p.pos.clone();
    this.pop(pos, p.b.model === 'balloon' ? ['#9ED8F0', '#FFFFFF'] : p.b.model === 'comet' || p.b.model === 'crown' ? ['#FFE066', '#FFFFFF', '#FFC8DD'] : ['#FFFFFF', '#FFD6A5', '#CDB4DB'], aoe > 6 ? 60 : 30);
    this.hooks.sfx(p.b.model === 'balloon' ? 'splash' : 'poof', pos);
    if (aoe > 0)
      for (const o of this.racers) {
        if (o.model.root.position.distanceTo(pos) < aoe + 1) {
          if (o === p.owner && p.b.motion !== 'lob') continue;
          if (o === p.owner && p.age < 0.2) continue;
          this.applyHit(o, p.owner, p.id, p.b.hit, false);
        }
      }
    if (p.b.zone) this.spawnZoneAt(p.owner, p.id, pos.setY(pos.y - 0.4), p.b.zone.radius, p.b.zone.dur, p.b.zone.hit, p.b.zone.tint, 'puddle');
    if (p.b.model === 'crown' && p.owner) p.owner.body.coins = Math.min(p.owner.body.maxCoins, p.owner.body.coins + 3);
  }
  private pop(pos: THREE.Vector3, colors: string[], n = 22) {
    this.fx.burst(pos.clone(), n, { colors, shape: PShape.Star, speed: 9, up: 4, gravity: 12, size: 0.55, sizeEnd: 0.1, additive: false });
    this.fx.burst(pos.clone(), Math.round(n / 2), { colors: ['#FFFFFF'], shape: PShape.Puff, speed: 5, up: 1, gravity: 0, size: 1.2, sizeEnd: 2.4, life: 0.6 });
  }

  /** dangers for AI avoidance */
  dangers(out: { x: number; z: number; r: number }[]) {
    for (const t of this.traps) if (!t.dead) out.push({ x: t.pos.x, z: t.pos.z, r: t.r });
    for (const z of this.zones) if (z.life > 0) out.push({ x: z.pos.x, z: z.pos.z, r: z.r });
  }
  clear() {
    for (const x of [...this.projs, ...this.traps, ...this.zones]) this.group.remove(x.obj);
    this.projs = [];
    this.traps = [];
    this.zones = [];
  }
}
import { Proj as PathProj } from '../tracks/path';
const tmpProj = new PathProj();
