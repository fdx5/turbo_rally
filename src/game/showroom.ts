import * as THREE from 'three';
import { makeLights, type Renderer } from '../core/renderer';
import { CharacterModel } from '../characters/model';
import { CHARACTERS, type CharId } from '../data/characters';
import type { CosmeticLoadout } from '../characters/cosmeticBuild';
import { KartModel } from '../race/kartModel';
import { MeshBuilder, starShape, extrudeShape } from '../art/builder';
import { toon } from '../art/toon';
import { FX } from '../art/particles';
import { PShape } from '../art/textures';
import { sharedTime } from '../art/materials';
import { damp } from '../core/math';
import { buildClouds, updateClouds } from '../art/sky';
import { THEMES } from '../tracks/themes';
import { buildSky } from '../art/sky';

export type ShowMode = 'title' | 'menu' | 'characters' | 'vehicle' | 'shop' | 'podium' | 'track';

/** Pastel stage rendered behind every menu (one scene, reconfigured per screen). */
export class Showroom {
  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(36, 16 / 9, 0.1, 3000);
  fx = new FX();
  mode: ShowMode = 'title';
  private stage = new THREE.Group();
  private turntable = new THREE.Group();
  private lineup: CharacterModel[] = [];
  private kart: KartModel | null = null;
  private kartKey = '';
  private shopChar: CharacterModel | null = null;
  private shopKey = '';
  private podium: KartModel[] = [];
  private t = 0;
  private camPos = new THREE.Vector3(0, 3, 11);
  private camLook = new THREE.Vector3(0, 1.2, 0);
  private targetPos = new THREE.Vector3(0, 3, 11);
  private targetLook = new THREE.Vector3(0, 1.2, 0);
  selectedChar: CharId = 'momo';
  spin = 0;
  dragVel = 0;
  private clouds: THREE.InstancedMesh;
  private sky: THREE.Mesh;
  private confettiT = 0;
  private podiumGroup = new THREE.Group();

  constructor(private R: Renderer) {
    const th = THEMES.candy;
    this.sky = buildSky({ ...th, sky: { ...th.sky, top: '#FF9CC7', horizon: '#FFDDEB', bottom: '#FFE9F2' } });
    this.scene.add(this.sky);
    this.scene.fog = new THREE.Fog('#FFE6F0', 60, 400);
    const L = makeLights('#FFF1E4', 1.85, '#FFD3E6', '#FFE8CC', 1.0, 0.2, R.def.shadow || 1024);
    L.sun.position.set(8, 14, 10);
    L.sun.shadow.camera.left = L.sun.shadow.camera.bottom = -14;
    L.sun.shadow.camera.right = L.sun.shadow.camera.top = 14;
    this.scene.add(L.group);
    // floor: big soft disc + candy stage
    const floor = new THREE.Mesh(new THREE.CircleGeometry(300, 64).rotateX(-Math.PI / 2), toon({ color: '#FFCFE2' }));
    floor.receiveShadow = true;
    this.scene.add(floor);
    const b = new MeshBuilder();
    b.cyl(5.2, 5.6, 0.6, '#FFF3F8', { p: [0, 0.3, 0] }, 48);
    b.cyl(4.6, 4.6, 0.12, '#FFC8DD', { p: [0, 0.66, 0] }, 48);
    for (let i = 0; i < 24; i++) {
      const a = (i / 24) * Math.PI * 2;
      b.sphere(0.22, ['#FFADAD', '#FFD6A5', '#FDFFB6', '#B9FBC0', '#A2D2FF', '#CDB4DB'][i % 6], { p: [Math.cos(a) * 5.35, 0.62, Math.sin(a) * 5.35], glow: 1.4 });
    }
    this.stage.add(b.build());
    const deco = new MeshBuilder();
    deco.detail = 0.7;
    const star = extrudeShape(starShape(1, 0.5), 0.4, 0.08);
    for (let i = 0; i < 9; i++) {
      const a = (i / 9) * Math.PI * 2 + 0.3;
      const r = 13 + (i % 3) * 4;
      deco.cyl(0.12, 0.12, 4 + (i % 3), '#FFFFFF', { p: [Math.cos(a) * r, 2 + (i % 3) * 0.5, Math.sin(a) * r - 6] });
      deco.add(star, ['#FFE066', '#FFC8DD', '#A2D2FF'][i % 3], { p: [Math.cos(a) * r, 4.5 + (i % 3), Math.sin(a) * r - 6], s: 1.1 });
      deco.sphere(1.2, ['#FFC8DD', '#B9FBC0', '#CDB4DB', '#A2D2FF'][i % 4], { p: [Math.cos(a + 0.35) * (r + 3), 1, Math.sin(a + 0.35) * (r + 3) - 6], s: [1, 1.2, 1] });
    }
    this.stage.add(deco.build());
    this.scene.add(this.stage, this.turntable, this.podiumGroup);
    this.turntable.position.y = 0.72;
    this.clouds = buildClouds(30, new THREE.Vector3(0, 0, 0), 180, -10, 3);
    this.scene.add(this.clouds, this.fx.group);
  }

  activate() {
    this.R.setSceneCamera(this.scene, this.camera);
  }
  setMode(m: ShowMode) {
    this.mode = m;
    this.lineup.forEach((c) => (c.root.visible = m === 'characters'));
    if (this.kart) this.kart.root.visible = m === 'vehicle' || m === 'menu' || m === 'title';
    if (this.shopChar) this.shopChar.root.visible = m === 'shop';
    this.podiumGroup.visible = m === 'podium';
    this.stage.visible = m !== 'podium';
    switch (m) {
      case 'title':
        this.targetPos.set(5.5, 2.6, 9.5);
        this.targetLook.set(-0.6, 1.4, 0);
        break;
      case 'menu':
        this.targetPos.set(-1.5, 2.8, 11.5);
        this.targetLook.set(-3.6, 1.6, 0);
        break;
      case 'characters':
        this.buildLineup();
        this.targetPos.set(0, 2.6, 12.5);
        this.targetLook.set(0, 1.3, 0);
        break;
      case 'vehicle':
        this.targetPos.set(-3.2, 2.6, 8.8);
        this.targetLook.set(1.4, 1.2, 0);
        break;
      case 'shop':
        this.targetPos.set(0.4, 2.1, 7.2);
        this.targetLook.set(0.9, 1.3, 0);
        break;
      case 'podium':
        this.targetPos.set(0, 3.2, 12);
        this.targetLook.set(0, 1.8, 0);
        break;
      case 'track':
        this.targetPos.set(-6, 5, 10);
        this.targetLook.set(0, 1, 0);
        break;
    }
  }
  private buildLineup() {
    if (this.lineup.length) return;
    CHARACTERS.forEach((c, i) => {
      const m = new CharacterModel(c.id, {}, 'showcase');
      const a = ((i - 3.5) / 7) * 2.2;
      m.root.position.set(Math.sin(a) * 5.4, 0.72, Math.cos(a) * 5.4 - 5.4 + 1.2);
      m.root.rotation.y = -a * 0.6;
      this.scene.add(m.root);
      this.lineup.push(m);
    });
  }
  lineupLoadouts(eq: Partial<Record<CharId, CosmeticLoadout>>) {
    // rebuild members whose loadout changed (cheap enough on demand)
    this.lineup.forEach((m, i) => {
      const id = CHARACTERS[i].id;
      const want = JSON.stringify(eq[id] ?? {});
      if (m.root.userData.lo === want) return;
      const nm = new CharacterModel(id, eq[id] ?? {}, 'showcase');
      nm.root.position.copy(m.root.position);
      nm.root.rotation.copy(m.root.rotation);
      nm.root.userData.lo = want;
      nm.root.visible = m.root.visible;
      this.scene.remove(m.root);
      this.scene.add(nm.root);
      this.lineup[i] = nm;
    });
  }
  pickCharacter(id: CharId) {
    this.selectedChar = id;
    const m = this.lineup[CHARACTERS.findIndex((c) => c.id === id)];
    if (m) {
      m.playPose();
      m.setExpression('happy', 1.6);
      this.burst(m.root.position.clone().add(new THREE.Vector3(0, 2.2, 0)));
    }
  }
  setKart(vehicleId: string, charId: CharId, loadout: CosmeticLoadout) {
    const key = `${vehicleId}|${charId}|${JSON.stringify(loadout)}`;
    if (key === this.kartKey) return;
    this.kartKey = key;
    if (this.kart) this.turntable.remove(this.kart.root);
    this.kart = new KartModel(vehicleId, charId, loadout, { outline: true, decalScale: 1 });
    this.kart.root.position.set(0, 0, 0);
    this.turntable.add(this.kart.root);
    this.kart.root.visible = this.mode === 'vehicle' || this.mode === 'menu' || this.mode === 'title';
    this.kart.root.scale.setScalar(0.001);
    this.kart.root.userData.grow = 0;
  }
  setShopChar(charId: CharId, loadout: CosmeticLoadout) {
    const key = `${charId}|${JSON.stringify(loadout)}`;
    if (key === this.shopKey) return;
    this.shopKey = key;
    const rot = this.shopChar?.root.rotation.y ?? 0;
    if (this.shopChar) this.turntable.remove(this.shopChar.root);
    this.shopChar = new CharacterModel(charId, loadout, 'showcase');
    this.shopChar.root.rotation.y = rot;
    this.shopChar.root.visible = this.mode === 'shop';
    this.turntable.add(this.shopChar.root);
  }
  shopPose() {
    this.shopChar?.playPose();
    this.shopChar?.setExpression('happy', 1.4);
    if (this.shopChar) this.burst(new THREE.Vector3(0, 2.4, 0), 30);
  }
  setPodium(entries: { vehicleId: string; charId: CharId; loadout: CosmeticLoadout; place: number }[]) {
    this.podiumGroup.clear();
    this.podium = [];
    const b = new MeshBuilder();
    const H = [2.2, 1.5, 1.0];
    const X = [0, -3.6, 3.6];
    const C = ['#FFE066', '#E3E8F5', '#FFCFA8'];
    for (let i = 0; i < 3; i++) {
      b.box(3.2, H[i], 3, C[i], { p: [X[i], H[i] / 2, 0] }, 0.12);
      b.box(3.3, 0.2, 3.1, '#FFFFFF', { p: [X[i], H[i] + 0.05, 0] }, 0.4);
    }
    this.podiumGroup.add(b.build());
    for (const e of entries) {
      const i = e.place - 1;
      if (i > 2) continue;
      const k = new KartModel(e.vehicleId, e.charId, e.loadout, { outline: true });
      k.root.position.set(X[i], H[i] + 0.15, 0);
      k.root.rotation.y = 0.25 * (i === 1 ? 1 : i === 2 ? -1 : 0);
      k.root.scale.setScalar(0.85);
      k.setExpression(i === 0 ? 'win' : 'happy', 100);
      this.podiumGroup.add(k.root);
      this.podium.push(k);
    }
    this.confettiT = 6;
  }
  burst(p: THREE.Vector3, n = 24) {
    this.fx.burst(p, n, { colors: ['#FFADAD', '#FFD6A5', '#FDFFB6', '#B9FBC0', '#A2D2FF', '#CDB4DB'], shape: PShape.Star, speed: 6, up: 4, gravity: 8, size: 0.35, life: 1.2, spin: 6 });
  }
  frame(dt: number) {
    this.t += dt;
    sharedTime.value = this.t;
    const k = this.mode === 'shop' || this.mode === 'vehicle' ? 1 : 0.4;
    if (this.mode === 'shop') this.turntable.rotation.y += (this.dragVel + Math.sin(this.t * 0.5) * 0.25) * dt;
    else this.turntable.rotation.y += (this.dragVel + 0.35 * k) * dt;
    this.dragVel *= Math.exp(-dt * 3);
    this.camPos.x = damp(this.camPos.x, this.targetPos.x, 3, dt);
    this.camPos.y = damp(this.camPos.y, this.targetPos.y, 3, dt);
    this.camPos.z = damp(this.camPos.z, this.targetPos.z, 3, dt);
    this.camLook.x = damp(this.camLook.x, this.targetLook.x, 3, dt);
    this.camLook.y = damp(this.camLook.y, this.targetLook.y, 3, dt);
    this.camLook.z = damp(this.camLook.z, this.targetLook.z, 3, dt);
    this.camera.position.copy(this.camPos);
    this.camera.position.x += Math.sin(this.t * 0.3) * 0.15;
    this.camera.lookAt(this.camLook);
    for (const c of this.lineup) {
      c.update(dt);
      const sel = c.def.id === this.selectedChar;
      const s = c.root.scale.x + ((sel ? 1.18 : 1) - c.root.scale.x) * Math.min(1, dt * 8);
      c.root.scale.setScalar(s);
    }
    if (this.kart) {
      const g = (this.kart.root.userData.grow = Math.min(1, (this.kart.root.userData.grow ?? 1) + dt * 3));
      const e = g < 1 ? 1 - Math.pow(1 - g, 3) * Math.cos(g * 9) : 1;
      this.kart.root.scale.setScalar(Math.max(0.001, e));
      this.kart.vehicle.update(dt, { speed: 0, steer: Math.sin(this.t * 0.8) * 0.3, drift: 0, air: false, landT: 0, boost: false, t: this.t, spinAngle: 0, skillT: 0, beacons: true });
      this.kart.character.update(dt, { steer: Math.sin(this.t * 0.8) * 0.3, speed: 0 });
    }
    this.shopChar?.update(dt);
    for (const p of this.podium) {
      p.vehicle.update(dt, { speed: 0, steer: 0, drift: 0, air: false, landT: 0, boost: false, t: this.t, spinAngle: 0, skillT: 0, beacons: true });
      p.character.update(dt, { speed: 0 });
    }
    if (this.mode === 'podium' && this.confettiT > 0) {
      this.confettiT -= dt;
      if (Math.random() < 0.5)
        this.fx.normal.spawn({ pos: { x: (Math.random() - 0.5) * 14, y: 9, z: (Math.random() - 0.5) * 4 }, vel: { x: 0, y: -1.5, z: 0 }, color: ['#FFADAD', '#FFD6A5', '#FDFFB6', '#B9FBC0', '#A2D2FF', '#CDB4DB'][Math.floor(Math.random() * 6)], life: 4, size: 0.3, shape: PShape.Confetti, spin: 6, gravity: 1 });
    }
    if (Math.random() < 0.08) this.fx.glow.spawn({ pos: { x: (Math.random() - 0.5) * 16, y: Math.random() * 5 + 0.5, z: (Math.random() - 0.5) * 10 }, vel: { x: 0, y: 0.3, z: 0 }, color: ['#FFE066', '#FFC8DD', '#A2D2FF'][Math.floor(Math.random() * 3)], life: 2, size: 0.25, sizeEnd: 0, shape: PShape.Sparkle, spin: 2, intensity: 1.6 });
    this.fx.update(this.t);
    updateClouds(this.clouds, this.t, this.camera.position);
    (this.sky.material as THREE.ShaderMaterial).uniforms.uTime.value = this.t;
    this.R.renderer.info.reset();
    this.R.render(dt);
  }
}
