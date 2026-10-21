import * as THREE from 'three';
import { buildTrackWorld, type TrackWorld } from '../tracks/trackBuilder';
import { TRACK_BY_ID } from '../data/tracks';
import { ItemBoxes, Coins } from '../tracks/pickups';
import { Hazards } from '../tracks/hazards';
import { KartBody, type KartControls } from '../physics/kart';
import { finalStats, displayKmh } from '../data/statCurves';
import { CHAR_BY_ID, type CharId } from '../data/characters';
import { VEHICLE_BY_ID } from '../data/vehicles';
import { AIDriver, type Difficulty } from '../ai/driver';
import { KartModel } from './kartModel';
import { ItemSystem } from '../items/itemSystem';
import { ALL_ITEMS, SKILLS } from '../data/items';
import { FX } from '../art/particles';
import { PShape } from '../art/textures';
import { ChaseCam } from './camera';
import { WheelPool } from './wheelPool';
import type { Racer, ItemStat } from './types';
import { stat } from './types';
import type { CosmeticLoadout } from '../characters/cosmeticBuild';
import { makeLights, type Renderer } from '../core/renderer';
import { input } from '../core/input';
import { audio } from '../audio/engine';
import { music } from '../audio/music';
import { say, preloadVoices } from '../audio/voice';
import { EngineVoice } from '../audio/kartEngine';
import { Ambience } from '../audio/ambience';
import { useHud, minimapRef, type Standing } from '../ui/hudStore';
import { updateClouds } from '../art/sky';
import { sharedTime } from '../art/materials';
import type { SfxId } from '../audio/sfx';
import { globalRng } from '../core/rng';
import { useSettings } from '../core/settings';

export interface Entrant {
  charId: CharId;
  vehicleId: string;
  loadout: CosmeticLoadout;
  weapons: string[];
  name?: string;
}
export interface RaceConfig {
  trackId: string;
  mode: 'race' | 'timeattack' | 'practice';
  difficulty: Difficulty;
  player: Entrant;
  ai: Entrant[];
  gridOrder?: number[]; // slot order front -> back
  laps: number;
  ghost?: Float32Array | null;
}
export interface RaceResult {
  trackId: string;
  mode: RaceConfig['mode'];
  difficulty: Difficulty;
  charId: CharId;
  vehicleId: string;
  position: number;
  totalMs: number;
  bestLapMs: number;
  lapTimes: number[];
  coins: number;
  entrants: { slot: number; charId: CharId; vehicleId: string; name: string; isPlayer: boolean; position: number; totalMs: number }[];
  itemStats: Record<string, ItemStat>;
  mt3: number;
  hitsDealt: number;
  ghost: Float32Array | null;
  startedAt: number;
  finishedAt: number;
  finishOrder: number[];
}

const STEP = 1 / 120;
const CHAR_COLORS: Record<string, string> = { momo: '#FF8FB8', mungchi: '#C89B7B', piyo: '#FFD43B', lulu: '#B9A6E8', toto: '#F4A261', piko: '#5AA9FF', kkang: '#6CC57C', hana: '#FF8A3D' };

export class RaceSession {
  cfg: RaceConfig;
  world: TrackWorld;
  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(70, 16 / 9, 0.3, 2600);
  chase: ChaseCam;
  racers: Racer[] = [];
  player!: Racer;
  boxes: ItemBoxes;
  coins: Coins;
  hazards: Hazards;
  items: ItemSystem;
  fx = new FX();
  wheels: WheelPool;
  sun: THREE.DirectionalLight;
  engines = new Map<Racer, EngineVoice>();
  ambience = new Ambience();
  phase: 'intro' | 'countdown' | 'race' | 'finish' | 'done' = 'intro';
  phaseT = 0;
  raceMs = 0;
  time = 0;
  private acc = 0;
  private hudT = 0;
  private mapT = 0;
  private mapBg: HTMLCanvasElement | null = null;
  private mapXf = { sx: 1, ox: 0, oz: 0 };
  private ctl: KartControls = { steer: 0, throttle: 0, brake: 0, drift: false, driftPress: false };
  private finalLapShown = false;
  private dangers: { x: number; z: number; r: number }[] = [];
  private wrongWayBeep = 0;
  private ghostRec: number[] = [];
  private ghostT = 0;
  private ghost: { model: KartModel; data: Float32Array } | null = null;
  private mt3 = 0;
  finishOrder: number[] = [];
  onFinish: ((r: RaceResult) => void) | null = null;
  startedAt = Date.now();
  paused = false;
  autoplay = false;
  falls: Record<number, number> = {};
  debugCam: { pos: THREE.Vector3; look: THREE.Vector3 } | null = null;
  private ambientT = 0;
  private lastCountdown = '';

  constructor(cfg: RaceConfig, private R: Renderer) {
    this.cfg = cfg;
    const def = TRACK_BY_ID[cfg.trackId];
    const q = R.def;
    this.world = buildTrackWorld(def, { props: q.props, outlines: q.outlines });
    this.scene.add(this.world.group);
    const th = this.world.theme;
    this.scene.fog = new THREE.Fog(th.fog.color, th.fog.near, th.fog.far);
    const L = makeLights(th.light.sun, th.light.sunI, th.light.hemiSky, th.light.hemiGround, th.light.hemiI, th.light.amb, q.shadow);
    this.sun = L.sun;
    this.scene.add(L.group);
    this.boxes = new ItemBoxes(def, this.world.main);
    this.coins = new Coins(def, this.world.main);
    this.scene.add(this.boxes.group, this.coins.mesh);
    this.hazards = new Hazards(this.world);
    this.scene.add(this.hazards.group);
    this.chase = new ChaseCam(this.camera);
    this.fx.setBudget(q.particles);
    this.scene.add(this.fx.group);

    // ---- entrants & grid
    const entrants: Entrant[] = cfg.mode === 'race' ? [cfg.player, ...cfg.ai] : [cfg.player];
    const order = cfg.gridOrder && cfg.gridOrder.length === entrants.length ? cfg.gridOrder : entrants.map((_, i) => i);
    entrants.forEach((e, slot) => {
      const ch = CHAR_BY_ID[e.charId];
      const st = finalStats(e.vehicleId, e.charId);
      const body = new KartBody(st, ch, this.world.paths.length);
      const isPlayer = slot === 0;
      const model = new KartModel(e.vehicleId, e.charId, e.loadout, { outline: true, decalScale: isPlayer ? 1 : 0.75, pooledWheels: true });
      model.addToScene(this.scene);
      const r: Racer = {
        slot,
        isPlayer,
        charId: e.charId,
        vehicleId: e.vehicleId,
        name: e.name ?? ch.name,
        loadout: e.loadout,
        weapons: e.weapons,
        body,
        model,
        ai: isPlayer ? null : new AIDriver(slot * 977 + Date.now(), ch.personality, cfg.difficulty),
        items: [],
        roulette: null,
        orbit: null,
        trailing: null,
        shieldHits: 0,
        shieldT: 0,
        reflect: false,
        knockShield: false,
        usesLeft: 0,
        gauge: 0,
        skillT: 0,
        lockTarget: null,
        lap: 0,
        cp: 0,
        raceDist: 0,
        prevS: 0,
        finished: false,
        finishMs: 0,
        lapStartMs: 0,
        lapTimes: [],
        bestLap: 0,
        position: slot + 1,
        lastPosition: slot + 1,
        posChangeT: 0,
        stats: {},
        hitsDealt: 0,
        hitsTaken: 0,
        voiceCooldown: 0,
        hitFxT: 0,
        started: false,
        rocketPress: -1,
      };
      this.racers.push(r);
      if (isPlayer) this.player = r;
    });
    const main = this.world.main;
    order.forEach((slot, gi) => {
      const r = this.racers[slot];
      const row = Math.floor(gi / 2);
      const s = -9 - row * 7.5 - (gi % 2) * 3.5;
      const t = (gi % 2 === 0 ? -1 : 1) * Math.min(4.2, main.halfW[0] - 2.5);
      r.body.place(this.world, main.length + s, t);
      r.position = gi + 1;
      r.raceDist = r.body.progressS;
      r.prevS = r.body.progressS;
    });
    this.wheels = new WheelPool(this.racers.map((r) => r.model.vehicle));
    this.scene.add(this.wheels.group);
    this.items = new ItemSystem(this.world, this.racers, this.fx, {
      sfx: (id, pos, vol) => this.sfx(id, pos, vol),
      onHit: (v, a, itemId) => this.onHit(v, a, itemId),
      onBlocked: (v) => {
        if (v.isPlayer) useHud.getState().toast('막았다! 🛡️', '#5AA9FF');
      },
      shake: (amt, who) => {
        if (who.isPlayer || this.near(who, 25)) this.chase.shake(amt);
      },
      toast: (who, text) => {
        if (who.isPlayer) useHud.getState().toast(text);
      },
      screen: (who, kind, dur) => {
        if (!who.isPlayer) return;
        const until = performance.now() + dur * 1000;
        useHud.getState().set(kind === 'blind' ? { blindUntil: until } : { flashUntil: until });
      },
    });
    this.scene.add(this.items.group);
    if (cfg.mode === 'timeattack') this.player.items = ['sugar3'];
    if (cfg.mode === 'timeattack') this.items.prepareHeld(this.player);
    if (cfg.ghost && cfg.ghost.length > 8) {
      const gm = new KartModel(cfg.player.vehicleId, cfg.player.charId, {}, { outline: false, decalScale: 0.5 });
      gm.root.traverse((o) => {
        const m = o as THREE.Mesh;
        if (m.isMesh) {
          m.material = ghostMat;
          m.castShadow = false;
        }
      });
      this.scene.add(gm.root);
      this.ghost = { model: gm, data: cfg.ghost };
    }
    this.chase.snap(this.player.body);
    R.setSceneCamera(this.scene, this.camera);
    this.buildMinimap();
    useHud.getState().set({
      active: true,
      phase: 'intro',
      trackName: def.name,
      laps: cfg.laps,
      lap: 1,
      timeMs: 0,
      items: [],
      gauge: 0,
      coins: 0,
      maxCoins: this.player.body.maxCoins,
      mode: cfg.mode,
      skillIcon: SKILLS[VEHICLE_BY_ID[cfg.player.vehicleId].skill.id]?.icon ?? '⚡',
      finalLap: false,
      wrongWay: false,
      countdown: '',
      ghostDelta: null,
      paused: false,
      blindUntil: 0,
      flashUntil: 0,
    });
  }

  start() {
    preloadVoices(this.racers.map((r) => r.charId));
    music.play(this.world.def.id, 1.5);
    this.ambience.start(this.world.theme.ambience);
    for (const r of this.racers) {
      if (r.isPlayer || this.racers.indexOf(r) < 4) this.engines.set(r, new EngineVoice(VEHICLE_BY_ID[r.vehicleId].engine));
    }
    this.phase = 'intro';
    this.phaseT = 0;
    this.chase.mode = 'intro';
  }

  private sfx(id: SfxId, pos?: THREE.Vector3, vol = 1) {
    if (!pos) {
      audio.play(id, { vol });
      return;
    }
    const cam = this.camera.position;
    const d = pos.distanceTo(cam);
    if (d > 90) return;
    const att = Math.max(0.15, 1 - d / 90);
    const right = new THREE.Vector3().setFromMatrixColumn(this.camera.matrixWorld, 0);
    const pan = right.dot(pos.clone().sub(cam).normalize()) * 0.8;
    audio.play(id, { vol: vol * att, pan });
  }
  private near(r: Racer, d: number) {
    return r.model.root.position.distanceTo(this.player.model.root.position) < d;
  }
  private voice(r: Racer, line: Parameters<typeof say>[1], chance = 1) {
    if (r.voiceCooldown > 0 || Math.random() > chance) return;
    if (!r.isPlayer && !this.near(r, 30)) return;
    r.voiceCooldown = r.isPlayer ? 1.5 : 4;
    const vol = r.isPlayer ? 1 : 0.55;
    say(r.charId, line, { tts: r.isPlayer && (line === 'start' || line === 'win'), vol });
  }
  private onHit(v: Racer, a: Racer | null, itemId: string) {
    v.model.setExpression('angry', 1.6);
    this.sfx('hit', v.model.root.position);
    this.voice(v, 'ouch', v.isPlayer ? 1 : 0.5);
    if (v.isPlayer) {
      this.chase.shake(0.35);
      if ('vibrate' in navigator) navigator.vibrate?.(80);
    }
    if (a && a !== v) {
      a.model.setExpression('happy', 1.4);
      this.voice(a, 'hitOther', a.isPlayer ? 0.8 : 0.3);
      if (a.isPlayer) useHud.getState().toast(`${ALL_ITEMS[itemId]?.name ?? ''} 명중! 🎯`, '#FF8FB8');
    }
  }

  // ------------------------------------------------------------------ main loop
  frame(dtRaw: number) {
    const dt = Math.min(dtRaw, 0.25);
    if (this.paused) {
      this.render(0);
      return;
    }
    this.time += dt;
    sharedTime.value = this.time;
    this.phaseT += dt;
    input.update();
    const inp = input.state;
    const hud = useHud.getState();

    // ---- phases
    if (this.phase === 'intro') {
      if (this.phaseT > 3.6 || input.consume('any')) {
        this.phase = 'countdown';
        this.phaseT = 0;
        this.chase.mode = 'chase';
        this.chase.snap(this.player.body);
        hud.set({ phase: 'countdown' });
        this.voice(this.player, 'start');
      }
    } else if (this.phase === 'countdown') {
      const n = 3 - Math.floor(this.phaseT);
      const label = this.phaseT >= 3 ? 'GO!' : String(n);
      if (label !== this.lastCountdown) {
        this.lastCountdown = label;
        hud.set({ countdown: label });
        this.sfx(label === 'GO!' ? 'go' : 'beep');
      }
      // rocket start window: "2" is shown during [1,2)
      for (const r of this.racers) {
        const pressing = r.isPlayer ? inp.throttle > 0 : r.ai && this.phaseT > 1.2 + (r.slot % 3) * 0.25 && globalRng.chance(0.5);
        if (pressing && r.rocketPress < 0) r.rocketPress = this.phaseT;
        if (!pressing && r.isPlayer && this.phaseT < 2) r.rocketPress = -1;
      }
      if (this.phaseT >= 3) {
        this.phase = 'race';
        this.phaseT = 0;
        hud.set({ phase: 'race' });
        setTimeout(() => useHud.getState().set({ countdown: '' }), 700);
        for (const r of this.racers) {
          r.started = true;
          if (r.rocketPress >= 1.0 && r.rocketPress < 2.0) {
            r.body.boost(1.2, 1.35);
            if (r.isPlayer) {
              this.sfx('rocketStart');
              hud.toast('로켓 스타트! 🚀', '#FFB067');
            }
          } else if (r.rocketPress >= 0 && r.rocketPress < 1.0) {
            r.body.spinT = 0.8;
            if (r.isPlayer) {
              this.sfx('overheat');
              hud.toast('엔진 과열! 💨', '#9E9AB0');
            }
          }
        }
      }
    }
    const racing = this.phase === 'race' || this.phase === 'finish';

    // ---- player controls
    const pc = this.ctl;
    pc.steer = inp.steer;
    pc.throttle = inp.throttle;
    pc.brake = inp.brake;
    pc.drift = inp.drift;
    pc.driftPress = input.consume('driftPress');
    if (racing && !this.player.finished) {
      if (input.consume('item')) {
        if (this.player.roulette) this.items.updateRoulette(this.player, 0, true);
        else this.items.useItem(this.player);
      }
      if (input.consume('skill') && this.player.gauge >= 100) this.fireSkill(this.player);
    } else {
      input.consume('item');
      input.consume('skill');
    }
    if (this.player.finished && this.cfg.mode !== 'practice') {
      // auto-drive after the line
      const aiTmp = (this.player.ai ??= new AIDriver(1, 'balanced', 'easy'));
      Object.assign(pc, aiTmp.update(dt, this.player.body, this.aiCtx(this.player)));
      pc.throttle = 0.6;
    }

    // ---- fixed-step physics
    this.refreshAiShared();
    this.acc += dt;
    let steps = 0;
    while (this.acc >= STEP && steps < 32) {
      this.acc -= STEP;
      steps++;
      this.stepPhysics(STEP, racing, pc);
      pc.driftPress = false;
    }
    const alpha = this.acc / STEP;

    // ---- per-frame systems
    if (racing) {
      this.raceMs += dt * 1000;
      this.updateRace(dt);
    }
    this.boxes.update(this.time, dt);
    this.coins.update(this.time, dt);
    this.hazards.update(this.time);
    // visuals
    for (const r of this.racers) {
      const ctl = r.isPlayer ? pc : (r.ai?.ctl ?? pc);
      r.model.update(dt, r.body, alpha, this.time, this.fx, { steer: ctl.steer, throttle: ctl.throttle });
      const d = r.model.root.position.distanceTo(this.camera.position);
      r.model.setLOD(d, this.R.def.farOutline);
    }
    this.items.update(dt);
    this.wheels.update();
    this.updateGhost(dt);
    this.updateCamera(dt, alpha, inp.lookBack);
    this.updateAudio();
    this.ambientParticles(dt);
    this.fx.update(this.time);
    updateClouds(this.world.clouds, this.time, this.camera.position);
    (this.world.sky.material as THREE.ShaderMaterial).uniforms.uTime.value = this.time;
    if (this.world.water) (this.world.water.material as THREE.ShaderMaterial).uniforms.uTime.value = this.time;
    this.world.padTex.offset.y = -this.time * 2.2;
    // shadow camera follows player
    const pp = this.player.model.root.position;
    const sd = new THREE.Vector3(...this.world.theme.sky.sunDir).normalize();
    this.sun.position.set(pp.x + sd.x * 80, pp.y + sd.y * 80, pp.z + sd.z * 80);
    this.sun.target.position.copy(pp);
    // chunk outline LOD
    const far = this.R.def.farOutline * 3;
    for (const c of this.world.chunks) if (c.outline) c.outline.visible = c.centre.distanceTo(this.camera.position) < far + 60;
    this.hudT -= dt;
    if (this.hudT <= 0) {
      this.hudT = 1 / 20;
      this.pushHud();
    }
    this.mapT -= dt;
    if (this.mapT <= 0) {
      this.mapT = 1 / 30;
      this.drawMinimap();
    }
    this.render(dt);
  }

  private render(dt: number) {
    this.R.renderer.info.reset();
    this.R.render(dt);
    if (useSettings.getState().rearMirror && (this.phase === 'race' || this.phase === 'countdown')) this.renderMirror();
  }

  /** Rear-view mirror: second view of the scene into a small top-right viewport (scissored). */
  private rearCam = new THREE.PerspectiveCamera(55, 2.8, 0.5, 320);
  private renderMirror() {
    const r = this.R.renderer;
    const { x, y, w, h } = mirrorRect();
    const b = this.player.body;
    const fx = Math.sin(b.yaw);
    const fz = Math.cos(b.yaw);
    const p = this.player.model.root.position;
    const top = this.player.model.vehicle.bp.height;
    this.rearCam.aspect = w / h;
    this.rearCam.updateProjectionMatrix();
    this.rearCam.position.set(p.x + fx * 0.6, p.y + top + 0.9, p.z + fz * 0.6);
    this.rearCam.lookAt(p.x - fx * 25, p.y + 1.0, p.z - fz * 25);
    const H = window.innerHeight;
    const shadowAuto = r.shadowMap.autoUpdate;
    r.shadowMap.autoUpdate = false;
    r.setScissorTest(true);
    r.setScissor(x, H - y - h, w, h);
    r.setViewport(x, H - y - h, w, h);
    r.clear(true, true, false);
    r.render(this.scene, this.rearCam);
    r.setScissorTest(false);
    r.setViewport(0, 0, window.innerWidth, H);
    r.shadowMap.autoUpdate = shadowAuto;
  }

  private stepPhysics(h: number, racing: boolean, pc: KartControls) {
    const frozen: KartControls = { steer: 0, throttle: 0, brake: 0, drift: false, driftPress: false };
    for (const r of this.racers) {
      let c: KartControls;
      if (!racing) c = frozen;
      else if (r.isPlayer && !(this.autoplay && r.ai)) c = pc;
      else c = r.ai!.update(h, r.body, this.aiCtx(r));
      r.body.step(h, c, this.world);
      for (const e of r.body.takeEvents()) this.kartEvent(r, e);
    }
    // kart vs kart
    const n = this.racers.length;
    for (let i = 0; i < n; i++)
      for (let j = i + 1; j < n; j++) {
        const a = this.racers[i].body;
        const b = this.racers[j].body;
        const dx = b.x - a.x;
        const dz = b.z - a.z;
        const d2 = dx * dx + dz * dz;
        const rr = (a.radius + b.radius) * (a.shrinkT > 0 || b.shrinkT > 0 ? 0.8 : 1);
        if (d2 < rr * rr && Math.abs(a.y - b.y) < 2.2 && a.ghostT <= 0 && b.ghostT <= 0 && a.respawnT <= 0 && b.respawnT <= 0) {
          const d = Math.sqrt(d2) || 0.01;
          const nx = dx / d;
          const nz = dz / d;
          const over = rr - d;
          const ma = a.mass * (a.heavy ? 1.33 : 1) * (a.starT > 0 ? 5 : 1);
          const mb = b.mass * (b.heavy ? 1.33 : 1) * (b.starT > 0 ? 5 : 1);
          const ka = mb / (ma + mb);
          const kb = ma / (ma + mb);
          a.x -= nx * over * ka;
          a.z -= nz * over * ka;
          b.x += nx * over * kb;
          b.z += nz * over * kb;
          // lateral shove
          const pushA = 7 * ka;
          const pushB = 7 * kb;
          const ra = -(nx * -Math.cos(a.yaw) + nz * Math.sin(a.yaw));
          const rb = nx * -Math.cos(b.yaw) + nz * Math.sin(b.yaw);
          a.vl += Math.sign(ra) * -pushA * 0.6;
          b.vl += Math.sign(rb) * -pushB * 0.6;
          // squash: a big kart landing on a shrunk one
          if (a.shrinkT > 0 && b.shrinkT <= 0) a.squashT = 2;
          if (b.shrinkT > 0 && a.shrinkT <= 0) b.squashT = 2;
          const ra2 = this.racers[i];
          const rb2 = this.racers[j];
          if (ra2.isPlayer || rb2.isPlayer) this.sfx('bump', ra2.model.root.position);
        }
      }
  }

  private boxCtx: { x: number; z: number; active: boolean }[] = [];
  private refreshAiShared() {
    this.dangers.length = 0;
    this.items.dangers(this.dangers);
    for (const h of this.hazards.hits) this.dangers.push({ x: h.x, z: h.z, r: h.r });
    if (this.boxCtx.length !== this.boxes.pos.length) this.boxCtx = this.boxes.pos.map((p) => ({ x: p.x, z: p.z, active: true }));
    for (let i = 0; i < this.boxCtx.length; i++) this.boxCtx[i].active = this.boxes.active[i];
  }
  private ctxObj = {
    world: null as unknown as TrackWorld,
    dangers: [] as { x: number; z: number; r: number }[],
    boxes: [] as { x: number; z: number; active: boolean }[],
    playerDist: 0,
    myDist: 0,
    hasItem: false,
    wantsBoost: false,
    time: 0,
  };
  private aiCtx(r: Racer) {
    const c = this.ctxObj;
    c.world = this.world;
    c.dangers = this.dangers;
    c.boxes = this.boxCtx;
    c.playerDist = this.player.raceDist;
    c.myDist = r.raceDist;
    c.hasItem = r.items.length > 0 || !!r.roulette;
    c.wantsBoost = r.items.length > 0 && ALL_ITEMS[r.items[0]]?.behavior.kind === 'boost';
    c.time = this.time;
    return c;
  }

  private kartEvent(r: Racer, e: string) {
    const p = r.model.root.position;
    const me = r.isPlayer;
    switch (e) {
      case 'wall':
        this.sfx('wall', p, me ? 1 : 0.6);
        if (me) this.chase.shake(0.12);
        this.fx.burst(p.clone().add(new THREE.Vector3(0, 0.8, 0)), 6, { colors: ['#FFFFFF', '#FFE066'], shape: PShape.Star, speed: 4, size: 0.4 });
        break;
      case 'bigLand':
        this.sfx('land', p, me ? 1 : 0.5);
        this.fx.burst(p.clone(), 10, { colors: ['#FFFFFF'], shape: PShape.Puff, speed: 4, up: 0.5, gravity: 0, size: 0.9, sizeEnd: 1.8, life: 0.5 });
        break;
      case 'hop':
        if (me) this.sfx('hop', p, 0.8);
        break;
      case 'mt1':
      case 'mt2':
      case 'mt3':
        if (me) this.sfx(e as SfxId, p);
        if (e === 'mt3') r === this.player && this.mt3++;
        break;
      case 'mtRelease': {
        const lv = Math.min(3, Math.max(1, Math.round((r.body.boostMult - 1.15) / 0.05)));
        r.gauge = Math.min(100, r.gauge + [8, 14, 22][lv - 1] * (r.charId === 'lulu' ? 1.1 : 1));
        if (me) {
          this.sfx('boost', p, 0.8);
          this.voice(r, 'boost', 0.25);
        }
        break;
      }
      case 'pad':
        this.sfx('pad', p, me ? 1 : 0.5);
        break;
      case 'trick':
        r.model.setExpression('happy', 1);
        if (me) {
          this.sfx('trick', p);
          useHud.getState().toast('트릭! ✨', '#CDB4DB');
        }
        this.fx.burst(p.clone().add(new THREE.Vector3(0, 1.5, 0)), 14, { colors: ['#FFE066', '#FFC8DD', '#A2D2FF'], shape: PShape.Star, speed: 5, additive: true, intensity: 2 });
        break;
      case 'fall':
        this.falls[r.slot] = (this.falls[r.slot] ?? 0) + 1;
        this.sfx('fall', p, me ? 1 : 0.5);
        if (this.world.def.water) this.sfx('splash', p, me ? 1 : 0.5);
        setTimeout(() => this.sfx('fairy', p, me ? 1 : 0.4), 400);
        r.model.setExpression('surprised', 1.5);
        break;
      case 'respawned':
        break;
    }
  }

  private fireSkill(r: Racer) {
    if (r.gauge < 100 || r.body.respawnT > 0) return;
    r.gauge = 0;
    const skill = VEHICLE_BY_ID[r.vehicleId].skill.id;
    this.items.useSkill(r, skill);
    r.model.setExpression('happy', 1.5);
    this.voice(r, 'skill', r.isPlayer ? 1 : 0.5);
    if (r.isPlayer) useHud.getState().toast(`${VEHICLE_BY_ID[r.vehicleId].skill.name}!`, '#FFB067');
  }

  private updateRace(dt: number) {
    const L = this.world.main.length;
    const laps = this.cfg.laps;
    for (const r of this.racers) {
      const b = r.body;
      if (r.voiceCooldown > 0) r.voiceCooldown -= dt;
      // gauge passive charge 1%/s (+10% for 루루)
      if (!r.finished) r.gauge = Math.min(100, r.gauge + dt * 1.0 * (r.charId === 'lulu' ? 1.1 : 1));
      // roulette
      if (r.roulette) {
        const done = this.items.updateRoulette(r, dt, false);
        if (done && r.isPlayer) this.sfx('itemGet');
      }
      // pickups
      if (b.respawnT <= 0) {
        const bi = this.boxes.collect(b.x, b.y, b.z, b.radius);
        if (bi >= 0) {
          const bp = this.boxes.pos[bi];
          this.fx.burst(bp.clone(), 26, { colors: ['#FFADAD', '#FFD6A5', '#FDFFB6', '#B9FBC0', '#A2D2FF', '#CDB4DB'], shape: PShape.Star, speed: 9, up: 4, gravity: 10, size: 0.55 });
          this.fx.burst(bp.clone(), 10, { colors: ['#FFFFFF'], shape: PShape.Puff, speed: 4, gravity: 0, size: 1, sizeEnd: 2, life: 0.4 });
          this.sfx('boxPop', bp, r.isPlayer ? 1 : 0.5);
          if (this.cfg.mode !== 'timeattack' && r.items.length < 2 && !r.roulette) {
            this.items.startRoulette(r);
            if (r.isPlayer) this.sfx('roulette');
          }
        }
        const ci = this.coins.collect(b.x, b.y, b.z, b.radius);
        if (ci >= 0) {
          if (b.coins < b.maxCoins) b.coins++;
          r.gauge = Math.min(100, r.gauge + 3);
          if (r.isPlayer) this.sfx('coin');
          this.fx.burst(this.coins.pos[ci].clone(), 8, { colors: ['#FFF3B8', '#FFFFFF'], shape: PShape.Sparkle, speed: 4, additive: true, intensity: 2, size: 0.4 });
        }
      }
      // hazards
      if (b.respawnT <= 0 && b.invulT <= 0 && b.starT <= 0 && b.ghostT <= 0 && b.glideT <= 0) {
        for (const h of this.hazards.hits) {
          const dx = h.x - b.x;
          const dz = h.z - b.z;
          if (dx * dx + dz * dz < (h.r + 1.1) ** 2 && Math.abs(h.y - b.y) < 3.5) {
            if (h.kind === 'spin') this.items.applyHit(r, null, 'hazard', { fx: 'spin', dur: 1.0, coins: 2 }, false);
            else {
              const d = Math.hypot(dx, dz) || 1;
              b.x -= (dx / d) * 1.5;
              b.z -= (dz / d) * 1.5;
              b.speed *= 0.6;
              b.vl += (Math.random() < 0.5 ? -1 : 1) * 6;
              if (r.isPlayer) this.sfx('bump', r.model.root.position);
            }
            break;
          }
        }
      }
      if (this.hazards.waveActive && !b.iceWalker) {
        const [s0, s1] = this.hazards.waveRange;
        if (b.progressS > s0 && b.progressS < s1 && b.proj.t > -2) {
          b.slowT = 0.15;
          b.slowAmt = 0.72;
        }
      }
      // slipstream
      if (b.speed > 20 && !r.finished) {
        let drafting = false;
        for (const o of this.racers) {
          if (o === r) continue;
          const dx = o.body.x - b.x;
          const dz = o.body.z - b.z;
          const ahead = dx * Math.sin(b.yaw) + dz * Math.cos(b.yaw);
          const lat = dx * -Math.cos(b.yaw) + dz * Math.sin(b.yaw);
          if (ahead > 2.5 && ahead < 14 && Math.abs(lat) < 1.8) {
            drafting = true;
            break;
          }
        }
        if (drafting) {
          b.slipstreamT += dt * 2;
          if (r.isPlayer && Math.random() < 0.6) {
            const p = r.model.root.position;
            this.fx.normal.spawn({ pos: { x: p.x + (Math.random() - 0.5) * 3, y: p.y + 0.5 + Math.random() * 2, z: p.z + (Math.random() - 0.5) * 3 }, vel: { x: -Math.sin(b.yaw) * 25, y: 0, z: -Math.cos(b.yaw) * 25 }, color: '#FFFFFF', life: 0.3, size: 1.6, sizeEnd: 1.6, shape: PShape.Streak });
          }
          if (b.slipstreamT > 1.5 * 2) {
            b.slipstreamT = 0;
            b.boost(0.8, 1.25);
            if (r.isPlayer) {
              this.sfx('slip');
              useHud.getState().toast('슬립스트림! 💨', '#A2D2FF');
            }
          }
        } else b.slipstreamT = Math.max(0, b.slipstreamT - dt);
      }
      // laps & progress
      const s = b.progressS;
      const prev = r.prevS;
      if (s > 0.2 * L && s < 0.8 * L) r.cp = Math.max(r.cp, s < 0.5 * L ? 1 : 2);
      if (prev > 0.8 * L && s < 0.2 * L) {
        if (r.lap === 0 || r.cp >= 2) {
          r.lap++;
          r.cp = 0;
          if (r.lap >= 2) {
            const lt = this.raceMs - r.lapStartMs;
            r.lapTimes.push(lt);
            r.bestLap = r.bestLap ? Math.min(r.bestLap, lt) : lt;
            if (r.isPlayer && r.lap <= laps) {
              this.sfx('lap');
              useHud.getState().set({ lapFlash: fmt(lt) });
              setTimeout(() => useHud.getState().set({ lapFlash: '' }), 2200);
            }
          }
          r.lapStartMs = this.raceMs;
          if (r.lap > laps && !r.finished) this.finishRacer(r);
          if (r.isPlayer && r.lap === laps && !this.finalLapShown && laps > 1) {
            this.finalLapShown = true;
            this.sfx('finalLap');
            music.setTempo(1.08);
            useHud.getState().set({ finalLap: true });
            setTimeout(() => useHud.getState().set({ finalLap: false }), 2400);
          }
        }
      } else if (prev < 0.2 * L && s > 0.8 * L && r.lap > 0) {
        r.lap--;
        r.cp = 2;
      }
      r.prevS = s;
      r.raceDist = r.finished ? 1e9 - r.finishMs : r.lap * L + s;
      // AI item / skill usage
      if (r.ai && !r.finished) this.aiItems(r, dt);
      // wrong way
      if (r.isPlayer) {
        const ww = b.wrongWayT > 1.2;
        if (ww) {
          this.wrongWayBeep -= dt;
          if (this.wrongWayBeep <= 0) {
            this.wrongWayBeep = 2.2;
            this.sfx('wrongWay');
          }
        }
        useHud.getState().wrongWay !== ww && useHud.getState().set({ wrongWay: ww });
      }
    }
    // ranking
    const sorted = [...this.racers].sort((a, b) => b.raceDist - a.raceDist);
    sorted.forEach((r, i) => {
      const np = i + 1;
      if (np !== r.position) {
        if (np < r.position && r.started) {
          if (np === 1 || r.isPlayer) this.voice(r, 'overtake', r.isPlayer ? 0.35 : 0.15);
        } else if (r.isPlayer && np > r.position) this.voice(r, 'overtaken', 0.3);
        r.lastPosition = r.position;
        r.position = np;
        r.posChangeT = 0.6;
      }
    });
    // race end conditions
    if (this.phase === 'finish') {
      const first = Math.min(...this.racers.filter((r) => r.finished).map((r) => r.finishMs));
      const allDone = this.racers.every((r) => r.finished);
      if (allDone || this.phaseT > 4.5 || this.raceMs - first > 30000) this.endRace();
    }
    // ghost recording
    if (this.cfg.mode === 'timeattack' && !this.player.finished) {
      this.ghostT -= dt;
      if (this.ghostT <= 0) {
        this.ghostT = 0.05;
        const b = this.player.body;
        this.ghostRec.push(b.x, b.y, b.z, b.yaw);
      }
    }
  }

  private aiItems(r: Racer, dt: number) {
    const ai = r.ai!;
    const aggro = ai.d.aggro * (ai.personality === 'aggressive' ? 1.25 : ai.personality === 'defensive' ? 0.7 : 1);
    if (r.gauge >= 100 && globalRng.chance(dt * 0.6 * aggro)) this.fireSkill(r);
    if (!r.items.length || r.roulette) return;
    const def = ALL_ITEMS[r.items[0]];
    const b = def.behavior;
    let use = false;
    const behindClose = this.racers.some((o) => o !== r && r.raceDist - o.raceDist > 0 && r.raceDist - o.raceDist < 18);
    const aheadClose = this.racers.some((o) => o !== r && o.raceDist - r.raceDist > 4 && o.raceDist - r.raceDist < 45);
    switch (b.kind) {
      case 'boost':
      case 'glide':
      case 'autopilot':
      case 'teleport':
        use = Math.abs(this.world.main.turnRight(this.world.main.idxAtS(r.body.progressS + 25), 10)) < 0.012 && globalRng.chance(dt * 1.2);
        break;
      case 'projectile':
        use = b.motion === 'homing' || b.motion === 'leader' || b.motion === 'rain' || b.motion === 'trackFly' ? globalRng.chance(dt * 0.5 * aggro) : b.motion === 'rollBack' ? behindClose && globalRng.chance(dt * 2) : aheadClose && globalRng.chance(dt * 1.5 * aggro);
        break;
      case 'trap':
      case 'zone':
        use = (behindClose && globalRng.chance(dt * 1.2)) || globalRng.chance(dt * 0.08);
        break;
      case 'shield':
      case 'intangible':
        use = behindClose ? globalRng.chance(dt * 0.8) : globalRng.chance(dt * 0.05);
        break;
      default:
        use = globalRng.chance(dt * 0.4 * aggro);
    }
    if (use) this.items.useItem(r);
  }

  private finishRacer(r: Racer) {
    r.finished = true;
    r.finishMs = this.raceMs;
    this.finishOrder.push(r.slot);
    if (r.isPlayer) {
      this.phase = 'finish';
      this.phaseT = 0;
      this.chase.mode = 'orbit';
      this.chase.t = 0;
      const pos = this.cfg.mode === 'race' ? this.finishOrder.length : 1;
      const good = pos <= 3;
      music.stop(0.3);
      music.jingle(good ? 'fanfare' : 'aww');
      setTimeout(() => music.play(good ? 'win' : 'lose', 1), 2400);
      r.model.setExpression(good ? 'win' : 'lose', 10);
      say(r.charId, good ? 'win' : 'lose', { tts: true });
      this.sfx('confetti');
      if ('vibrate' in navigator) navigator.vibrate?.([60, 40, 60]);
      for (let k = 0; k < 6; k++)
        setTimeout(() => this.fx.burst(r.model.root.position.clone().add(new THREE.Vector3(0, 5, 0)), 40, { colors: ['#FFADAD', '#FFD6A5', '#FDFFB6', '#B9FBC0', '#A2D2FF', '#CDB4DB'], shape: PShape.Confetti, speed: 12, up: 8, gravity: 6, drag: 1.5, size: 0.45, life: 2.2, spin: 10 }), k * 250);
      useHud.getState().set({ phase: 'finish' });
    } else {
      r.model.setExpression(this.finishOrder.length <= 3 ? 'win' : 'happy', 6);
    }
  }

  private endRace() {
    if (this.phase === 'done') return;
    this.phase = 'done';
    // estimate finishing times for those still racing (§4.2)
    const L = this.world.main.length;
    const total = this.cfg.laps * L + L;
    const unfinished = this.racers.filter((r) => !r.finished).sort((a, b) => b.raceDist - a.raceDist);
    for (const r of unfinished) {
      const covered = Math.max(1, r.lap * L + r.body.progressS - L);
      const avgSpeed = covered / Math.max(1, this.raceMs);
      const remain = Math.max(0, total - (r.lap * L + r.body.progressS));
      r.finished = true;
      r.finishMs = this.raceMs + remain / Math.max(0.01, avgSpeed);
      this.finishOrder.push(r.slot);
    }
    const ordered = this.finishOrder.map((s) => this.racers[s]);
    ordered.forEach((r, i) => (r.position = i + 1));
    const p = this.player;
    const res: RaceResult = {
      trackId: this.cfg.trackId,
      mode: this.cfg.mode,
      difficulty: this.cfg.difficulty,
      charId: p.charId,
      vehicleId: p.vehicleId,
      position: p.position,
      totalMs: Math.round(p.finishMs),
      bestLapMs: Math.round(p.bestLap || p.finishMs / this.cfg.laps),
      lapTimes: p.lapTimes.map((x) => Math.round(x)),
      coins: p.body.coins,
      entrants: this.racers.map((r) => ({ slot: r.slot, charId: r.charId, vehicleId: r.vehicleId, name: r.name, isPlayer: r.isPlayer, position: r.position, totalMs: Math.round(r.finishMs) })),
      itemStats: p.stats,
      mt3: this.mt3,
      hitsDealt: p.hitsDealt,
      ghost: this.cfg.mode === 'timeattack' ? new Float32Array(this.ghostRec) : null,
      startedAt: this.startedAt,
      finishedAt: Date.now(),
      finishOrder: [...this.finishOrder],
    };
    useHud.getState().set({ phase: 'done' });
    this.onFinish?.(res);
  }

  private updateGhost(dt: number) {
    if (!this.ghost) return;
    const d = this.ghost.data;
    const frames = d.length / 4;
    const t = (this.raceMs / 1000) / 0.05;
    const i = Math.min(frames - 2, Math.floor(t));
    const k = Math.min(1, t - i);
    if (this.phase === 'intro' || this.phase === 'countdown') {
      this.ghost.model.root.visible = false;
      return;
    }
    this.ghost.model.root.visible = i < frames - 2;
    const g = this.ghost.model.root;
    g.position.set(d[i * 4] + (d[i * 4 + 4] - d[i * 4]) * k, d[i * 4 + 1] + (d[i * 4 + 5] - d[i * 4 + 1]) * k, d[i * 4 + 2] + (d[i * 4 + 6] - d[i * 4 + 2]) * k);
    g.rotation.y = d[i * 4 + 3];
    void dt;
  }

  private updateCamera(dt: number, alpha: number, lookBack: boolean) {
    const b = this.player.body;
    const x = b.px + (b.x - b.px) * alpha;
    const y = b.py + (b.y - b.py) * alpha;
    const z = b.pz + (b.z - b.pz) * alpha;
    let dy = b.yaw - b.pyaw;
    if (dy > Math.PI) dy -= Math.PI * 2;
    if (dy < -Math.PI) dy += Math.PI * 2;
    const yaw = b.pyaw + dy * alpha;
    this.chase.height = 2.3 + this.player.model.vehicle.bp.height * 0.35;
    // intro: orbit grid centre
    const m = this.world.main;
    const c = new THREE.Vector3();
    m.pointAt(m.length - 25, 0, c);
    this.chase.update(dt, b, x, y, z, yaw, lookBack && this.phase === 'race', c);
    if (this.debugCam) {
      this.camera.position.copy(this.debugCam.pos);
      this.camera.lookAt(this.debugCam.look);
    }
  }

  private updateAudio() {
    const cam = this.camera.position;
    const right = new THREE.Vector3().setFromMatrixColumn(this.camera.matrixWorld, 0);
    for (const [r, eng] of this.engines) {
      const p = r.model.root.position;
      const d = p.distanceTo(cam);
      const vol = r.isPlayer ? 1 : Math.max(0, 1 - d / 40) * 0.6;
      const pan = r.isPlayer ? 0 : right.dot(p.clone().sub(cam).normalize());
      const top = r.body.tune.topSpeed;
      const ctl = r.isPlayer ? this.ctl : r.ai?.ctl;
      eng.update(Math.abs(r.body.speed) / top, ctl?.throttle ?? 0, this.phase === 'done' ? 0 : vol, pan, r.body.drifting && r.body.grounded, r.body.boostT > 0);
    }
  }

  private ambientParticles(dt: number) {
    const kind = this.world.theme.particles;
    if (!kind) return;
    this.ambientT -= dt;
    if (this.ambientT > 0) return;
    this.ambientT = kind === 'snow' ? 0.02 : 0.06;
    const c = this.camera.position;
    const f = new THREE.Vector3();
    this.camera.getWorldDirection(f);
    const p = { x: c.x + f.x * 20 + (Math.random() - 0.5) * 50, y: c.y + 10 + Math.random() * 8, z: c.z + f.z * 20 + (Math.random() - 0.5) * 50 };
    switch (kind) {
      case 'petals':
        this.fx.normal.spawn({ pos: p, vel: { x: 1.5, y: -1.5, z: 0.5 }, color: Math.random() < 0.5 ? '#FFC8DD' : '#FFE3EF', life: 6, size: 0.35, shape: PShape.Petal, spin: 3 });
        break;
      case 'snow':
        this.fx.normal.spawn({ pos: p, vel: { x: 0.6, y: -2.2, z: 0.3 }, color: '#FFFFFF', life: 6, size: 0.25, shape: PShape.Dot, spin: 1 });
        break;
      case 'leaves':
        this.fx.normal.spawn({ pos: p, vel: { x: 1, y: -1.2, z: 0.6 }, color: Math.random() < 0.5 ? '#FFB86B' : '#FF8A8A', life: 6, size: 0.35, shape: PShape.Petal, spin: 4 });
        break;
      case 'sparkle':
        this.fx.glow.spawn({ pos: p, vel: { x: 0, y: -0.4, z: 0 }, color: ['#FFE066', '#FFC8DD', '#A2D2FF'][Math.floor(Math.random() * 3)], life: 3, size: 0.3, sizeEnd: 0, shape: PShape.Sparkle, spin: 2, intensity: 1.6 });
        break;
      case 'bubbles':
        this.fx.normal.spawn({ pos: { x: p.x, y: c.y - 2, z: p.z }, vel: { x: 0, y: 1.2, z: 0 }, color: '#DFF8FF', life: 4, size: 0.4, shape: PShape.Ring });
        break;
    }
  }

  private pushHud() {
    const p = this.player;
    const hud = useHud.getState();
    const st: Standing[] = [...this.racers]
      .sort((a, b) => a.position - b.position)
      .map((r) => ({ slot: r.slot, name: r.name, charId: r.charId, position: r.position, isPlayer: r.isPlayer, finished: r.finished }));
    let rouletteIcon: string | null = null;
    if (p.roulette) {
      const keys = ['sugar', 'jelly', 'heart', 'bubble', 'pudding', 'cotton', 'rainbow', 'fakebox', 'comet', 'mini'];
      rouletteIcon = ALL_ITEMS[keys[Math.floor(this.time * 18) % keys.length]].icon;
    }
    let ghostDelta: number | null = null;
    if (this.ghost) {
      // compare progress vs ghost frame
      ghostDelta = null;
    }
    const info = this.R.renderer.info.render;
    hud.set({
      position: p.position,
      lap: Math.max(1, Math.min(this.cfg.laps, p.lap)),
      timeMs: this.phase === 'race' || this.phase === 'finish' ? (p.finished ? p.finishMs : this.raceMs) : 0,
      items: p.items.slice(),
      rouletteIcon,
      gauge: p.gauge,
      skillReady: p.gauge >= 100,
      coins: p.body.coins,
      kmh: displayKmh(Math.abs(p.body.speed)),
      reversed: p.body.reverseT > 0,
      sealed: p.body.sealT > 0,
      mtLevel: p.body.drifting ? p.body.mtLevel : 0,
      standings: st,
      ghostDelta,
      draws: info.calls,
      tris: info.triangles,
      boost: p.body.boostT > 0,
      slip: p.body.slipstreamT,
    });
  }

  // ------------------------------------------------------------------ minimap
  private buildMinimap() {
    const m = this.world.main;
    let minX = Infinity;
    let maxX = -Infinity;
    let minZ = Infinity;
    let maxZ = -Infinity;
    for (let i = 0; i < m.n; i++) {
      minX = Math.min(minX, m.px[i]);
      maxX = Math.max(maxX, m.px[i]);
      minZ = Math.min(minZ, m.pz[i]);
      maxZ = Math.max(maxZ, m.pz[i]);
    }
    const S = 440; // 2x backing store for a crisp map on hi-dpi screens
    const pad = 40;
    const sx = (S - pad * 2) / Math.max(maxX - minX, maxZ - minZ);
    this.mapXf = { sx, ox: pad - minX * sx + (S - pad * 2 - (maxX - minX) * sx) / 2, oz: pad - minZ * sx + (S - pad * 2 - (maxZ - minZ) * sx) / 2 };
    const c = document.createElement('canvas');
    c.width = c.height = S;
    const g = c.getContext('2d')!;
    const draw = (p: typeof m, w: number, col: string) => {
      g.beginPath();
      for (let i = 0; i < p.n; i += 2) {
        const x = p.px[i] * sx + this.mapXf.ox;
        const y = p.pz[i] * sx + this.mapXf.oz;
        if (i === 0) g.moveTo(x, y);
        else g.lineTo(x, y);
      }
      if (p.closed) g.closePath();
      g.lineWidth = w;
      g.strokeStyle = col;
      g.lineJoin = 'round';
      g.lineCap = 'round';
      g.stroke();
    };
    draw(m, 34, '#0E1630');
    for (const s of this.world.shortcuts) draw(s, 18, '#0E1630');
    for (const s of this.world.shortcuts) draw(s, 9, '#FFC93C');
    draw(m, 22, '#F4F7FC');
    // start/finish line: checkered bar across the road
    const x0 = m.px[0] * sx + this.mapXf.ox;
    const y0 = m.pz[0] * sx + this.mapXf.oz;
    const h0 = Math.atan2(m.px[2] - m.px[0], m.pz[2] - m.pz[0]);
    g.save();
    g.translate(x0, y0);
    g.rotate(-h0);
    for (let k = 0; k < 4; k++)
      for (let j = 0; j < 2; j++) {
        g.fillStyle = (k + j) % 2 ? '#1E2B4A' : '#FFFFFF';
        g.fillRect(-12 + k * 6, -6 + j * 6, 6, 6);
      }
    g.restore();
    this.mapBg = c;
  }
  private drawMinimap() {
    const c = minimapRef.canvas;
    if (!c || !this.mapBg) return;
    const g = c.getContext('2d')!;
    g.clearRect(0, 0, c.width, c.height);
    g.drawImage(this.mapBg, 0, 0, c.width, c.height);
    const k = c.width / this.mapBg.width;
    const px = (x: number) => (x * this.mapXf.sx + this.mapXf.ox) * k;
    const pz = (z: number) => (z * this.mapXf.sx + this.mapXf.oz) * k;
    if (this.ghost?.model.root.visible) {
      const gp = this.ghost.model.root.position;
      g.beginPath();
      g.arc(px(gp.x), pz(gp.z), 9, 0, Math.PI * 2);
      g.fillStyle = 'rgba(162,210,255,0.75)';
      g.fill();
    }
    // rivals: character-coloured dots with a dark rim so they read on the white road
    for (const r of this.racers) {
      if (r.isPlayer) continue;
      g.beginPath();
      g.arc(px(r.body.x), pz(r.body.z), 13, 0, Math.PI * 2);
      g.fillStyle = CHAR_COLORS[r.charId];
      g.fill();
      g.lineWidth = 4;
      g.strokeStyle = '#1E2B4A';
      g.stroke();
    }
    // player: pulsing halo + heading arrow, drawn on top
    const p = this.player.body;
    const x = px(p.x);
    const y = pz(p.z);
    const pulse = (performance.now() % 1200) / 1200;
    g.beginPath();
    g.arc(x, y, 20 + pulse * 22, 0, Math.PI * 2);
    g.fillStyle = `rgba(255,90,54,${0.45 * (1 - pulse)})`;
    g.fill();
    g.save();
    g.translate(x, y);
    g.rotate(-p.yaw);
    g.beginPath();
    g.moveTo(0, 28);
    g.lineTo(20, -17);
    g.lineTo(0, -7);
    g.lineTo(-20, -17);
    g.closePath();
    g.lineJoin = 'round';
    g.lineWidth = 8;
    g.strokeStyle = '#FFFFFF';
    g.stroke();
    g.fillStyle = '#FF5A36';
    g.fill();
    g.restore();
  }

  dispose() {
    for (const e of this.engines.values()) e.dispose();
    this.engines.clear();
    this.ambience.stop();
    this.items.clear();
    this.scene.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.isMesh) m.geometry?.dispose();
    });
    useHud.getState().set({ active: false });
  }
}

const ghostMat = new THREE.MeshBasicMaterial({ color: '#BFE3FF', transparent: true, opacity: 0.38, depthWrite: false });
/** Mirror rectangle in CSS px (top-left origin); the HUD frame uses the same formula. */
export function mirrorRect() {
  const W = window.innerWidth;
  const w = Math.round(Math.min(380, Math.max(220, W * 0.26)));
  const h = Math.round(w * 0.34);
  return { x: W - w - 16, y: 12, w, h };
}
export function fmt(ms: number) {
  const m = Math.floor(ms / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  const c = Math.floor((ms % 1000) / 10);
  return `${m}:${String(s).padStart(2, '0')}.${String(c).padStart(2, '0')}`;
}
void useSettings;
