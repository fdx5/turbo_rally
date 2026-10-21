import * as THREE from 'three';
import { MeshBuilder } from '../art/builder';
import type { TrackPath } from './path';
import type { ThemeDef } from './themes';
import type { TrackDef } from '../data/tracks';
import { Rng } from '../core/rng';
import { canvas, tex } from '../art/textures';

/**
 * Circuit dressing that makes each course read as a race track: start grandstands with crowd,
 * banner gantries over the road, tyre walls on the outside of sharp corners, flag poles.
 */
const BANNERS = ['TURBO RALLY', '별사탕 SODA', '뭉게 TIRES', 'GO! GO!', '드리프트 GP', 'POWER UP', '쭉쭉 오일', 'FINISH →'];

function bannerAtlas(accent: [string, string]) {
  const [c, g] = canvas(1024, 1024);
  BANNERS.forEach((t, i) => {
    const y = i * 128;
    g.fillStyle = i % 2 ? accent[0] : accent[1];
    g.fillRect(0, y, 1024, 128);
    g.fillStyle = '#FFFFFF';
    g.fillRect(0, y + 8, 1024, 6);
    g.fillRect(0, y + 114, 1024, 6);
    g.font = 'bold 76px "Black Han Sans", "Jua", sans-serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.lineWidth = 10;
    g.strokeStyle = 'rgba(30,43,74,0.85)';
    g.strokeText(t, 512, y + 66);
    g.fillStyle = '#FFFFFF';
    g.fillText(t, 512, y + 66);
  });
  return tex(c);
}

export function buildDressing(def: TrackDef, theme: ThemeDef, main: TrackPath, groundHeight: (x: number, z: number) => number): THREE.Group {
  const out = new THREE.Group();
  const rng = new Rng(def.no * 131);
  const accent = theme.accent ?? [theme.curb[0], '#2F80ED'];
  const b = new MeshBuilder();
  b.detail = 0.8;
  const L = main.length;
  const at = (s: number, t: number, lift = 0) => {
    const v = new THREE.Vector3();
    main.pointAt(s, t, v, lift);
    return v;
  };
  const yawAt = (s: number) => main.headingAt(s);
  const groundAt = (v: THREE.Vector3) => (def.voidWorld ? v.y - 0.5 : Math.min(v.y, groundHeight(v.x, v.z)));

  // ---- grandstands at the start straight (outer side with a wall)
  const side = main.wallL[main.idxAtS(30)] ? -1 : 1;
  for (const s0 of [18, 52]) {
    const i = main.idxAtS(s0);
    const off = (main.halfW[i] + (side < 0 ? main.shoulderL[i] : main.shoulderR[i]) + 5.5) * side;
    const p = at(s0, off);
    const y0 = groundAt(p);
    const g = new MeshBuilder();
    g.detail = 0.6;
    const W = 28;
    for (let k = 0; k < 5; k++) {
      g.box(W, 0.7, 1.6, k % 2 ? '#E9EEF5' : '#D7DFEA', { p: [0, 0.35 + k * 0.75, -k * 1.4] }, 0.15, 1);
      // crowd
      for (let n = 0; n < 16; n++) {
        const cx = -W / 2 + 1 + n * ((W - 2) / 15) + rng.range(-0.3, 0.3);
        const col = rng.pick(['#FF5A36', '#2F80ED', '#FFC93C', '#27C26C', '#FFFFFF', '#8E5BC9', '#FF8A1E']);
        g.capsule(0.28, 0.3, col, { p: [cx, 1.15 + k * 0.75, -k * 1.4], outline: false });
        g.sphere(0.26, '#F6D7B8', { p: [cx, 1.65 + k * 0.75, -k * 1.4], outline: false });
      }
    }
    g.box(W + 1, 0.25, 8.5, accent[1], { p: [0, 6.3, -2.8] }, 0.3, 1);
    for (const sx of [-1, 1]) g.box(0.35, 6.3, 0.35, '#B5BACA', { p: [sx * (W / 2 + 0.3), 3.15, -6.6] }, 0.3, 1);
    g.box(W, 1.1, 0.2, accent[0], { p: [0, 5.6, 1.2] }, 0.2, 1);
    const built = g.build({ outline: true });
    built.position.set(p.x, y0, p.z);
    built.rotation.y = yawAt(s0) + (side < 0 ? -Math.PI / 2 : Math.PI / 2);
    out.add(built);
  }

  // ---- banner gantries over the road
  const atlas = bannerAtlas(accent);
  const bannerMat = new THREE.MeshToonMaterial({ map: atlas });
  const gantries = def.voidWorld ? [0.3, 0.75] : [0.22, 0.5, 0.78];
  gantries.forEach((u, gi) => {
    const s = u * L;
    const i = main.idxAtS(s);
    if (main.gap[i]) return;
    const w = main.halfW[i] + 2.2;
    const base = at(s, 0);
    const gm = new MeshBuilder();
    for (const sx of [-1, 1]) {
      gm.box(0.55, 7.4, 0.55, '#DCE0EA', { p: [sx * w, 3.7, 0] }, 0.25, 1);
      gm.box(1.1, 0.4, 1.1, '#9AA3B5', { p: [sx * w, 0.2, 0] }, 0.3, 1);
    }
    gm.box(w * 2 + 0.6, 0.35, 0.5, '#DCE0EA', { p: [0, 7.5, 0] }, 0.3, 1);
    gm.box(w * 2 + 0.6, 0.35, 0.5, '#DCE0EA', { p: [0, 5.3, 0] }, 0.3, 1);
    const built = gm.build({ outline: true });
    built.position.copy(base);
    built.rotation.y = yawAt(s);
    out.add(built);
    const k = (gi * 3 + 1) % BANNERS.length;
    for (const face of [1, -1]) {
      const pg = new THREE.PlaneGeometry(w * 2 - 0.6, 1.9);
      const uv = pg.attributes.uv as THREE.BufferAttribute;
      for (let n = 0; n < uv.count; n++) uv.setY(n, 1 - (k + 1 - uv.getY(n)) / BANNERS.length);
      const m = new THREE.Mesh(pg, bannerMat);
      m.position.set(0, 6.4, face * 0.27);
      if (face < 0) m.rotation.y = Math.PI;
      built.add(m);
    }
  });

  // ---- tyre walls on the outside of sharp corners & flag poles on straights
  const tyres = new MeshBuilder();
  tyres.detail = 0.6;
  for (let s = 40; s < L - 20; s += 9) {
    const i = main.idxAtS(s);
    const k = main.turnRight(i, 10);
    if (main.gap[i]) continue;
    if (Math.abs(k) > 0.022) {
      const outer = k > 0 ? -1 : 1; // turning right => outside is the left
      if ((outer < 0 ? main.wallL[i] : main.wallR[i]) === 0) continue;
      const lim = main.halfW[i] + (outer < 0 ? main.shoulderL[i] : main.shoulderR[i]);
      for (let n = 0; n < 3; n++) {
        const p = at(s + n * 2.2, (lim + 1.4) * outer);
        const y0 = groundAt(p);
        for (let h = 0; h < 3; h++) tyres.torus(0.5, 0.24, h === 1 ? accent[0] : '#3A3644', { p: [p.x, y0 + 0.26 + h * 0.45, p.z], r: [Math.PI / 2, 0, 0] });
      }
    } else if (rng.chance(0.18) && !def.voidWorld) {
      const sd = rng.chance(0.5) ? -1 : 1;
      if ((sd < 0 ? main.wallL[i] : main.wallR[i]) === 0) continue;
      const lim = main.halfW[i] + (sd < 0 ? main.shoulderL[i] : main.shoulderR[i]);
      const p = at(s, (lim + 2.2) * sd);
      const y0 = groundAt(p);
      tyres.cyl(0.07, 0.07, 5.5, '#DCE0EA', { p: [p.x, y0 + 2.75, p.z] }, 8);
      const yaw = yawAt(s);
      tyres.box(0.05, 1.0, 1.6, rng.pick([accent[0], accent[1], '#FFC93C', '#27C26C']), { p: [p.x - Math.cos(yaw) * 0.8 * 0, y0 + 4.9, p.z], r: [0, yaw + Math.PI / 2, 0], outline: false }, 0.2, 1);
    }
  }
  if (!tyres.isEmpty()) out.add(tyres.build({ outline: true }));
  void b;
  return out;
}
