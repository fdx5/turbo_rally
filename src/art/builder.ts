import * as THREE from 'three';
import { mergeGeometries, mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { glow, outlineMaterial, toon } from './toon';

export type V3 = [number, number, number];
export interface PartOpts {
  p?: V3;
  r?: V3;
  s?: V3 | number;
  glow?: number; // glow intensity (>0 => unlit emissive bucket)
  outline?: boolean;
  noAO?: boolean;
}

const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _e = new THREE.Euler();
const _v = new THREE.Vector3();
const _s = new THREE.Vector3();
const _c = new THREE.Color();

export function matrixOf(o: PartOpts): THREE.Matrix4 {
  _e.set(...(o.r ?? [0, 0, 0]));
  _q.setFromEuler(_e);
  const s = o.s ?? 1;
  if (typeof s === 'number') _s.set(s, s, s);
  else _s.set(s[0], s[1], s[2]);
  return _m.compose(_v.set(...(o.p ?? [0, 0, 0])), _q, _s);
}

function normalize(geo: THREE.BufferGeometry, color: THREE.ColorRepresentation, m: THREE.Matrix4): THREE.BufferGeometry {
  let g = geo.index ? geo : mergeVertices(geo);
  g = g.clone();
  for (const k of Object.keys(g.attributes)) if (k !== 'position' && k !== 'normal') g.deleteAttribute(k);
  if (!g.attributes.normal) g.computeVertexNormals();
  g.applyMatrix4(m);
  const n = g.attributes.position.count;
  const col = new Float32Array(n * 3);
  _c.set(color);
  for (let i = 0; i < n; i++) col.set([_c.r, _c.g, _c.b], i * 3);
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return g;
}

/**
 * Collects primitives into a single vertex-coloured toon mesh (1 draw call), an optional smooth-normal
 * outline hull, and an unlit glow mesh for bloom. This is the core of the procedural modeller (§6.2-2).
 */
export class MeshBuilder {
  /** Tessellation multiplier (props use < 1 to respect the triangle budget). */
  detail = 1;
  private seg(n: number, min = 6) {
    return Math.max(min, Math.round(n * this.detail));
  }
  private solid: THREE.BufferGeometry[] = [];
  private hull: THREE.BufferGeometry[] = [];
  private glowParts: THREE.BufferGeometry[] = [];
  add(geo: THREE.BufferGeometry, color: THREE.ColorRepresentation, o: PartOpts = {}) {
    const g = normalize(geo, color, matrixOf(o));
    if (o.glow) {
      const col = g.attributes.color as THREE.BufferAttribute;
      for (let i = 0; i < col.count; i++) col.setXYZ(i, col.getX(i) * o.glow, col.getY(i) * o.glow, col.getZ(i) * o.glow);
      this.glowParts.push(g);
      return this;
    }
    if (o.noAO) g.userData.noAO = true;
    this.solid.push(g);
    if (o.outline !== false) this.hull.push(g);
    return this;
  }
  /** Rounded box helper (radius relative to smallest dimension). */
  box(w: number, h: number, d: number, color: THREE.ColorRepresentation, o: PartOpts = {}, radius = 0.25, seg = 3) {
    const r = Math.min(w, h, d) * radius;
    return this.add(new RoundedBoxGeometry(w, h, d, Math.max(1, Math.round(seg * this.detail)), r), color, o);
  }
  sphere(r: number, color: THREE.ColorRepresentation, o: PartOpts = {}, ws = 18, hs = 14) {
    return this.add(new THREE.SphereGeometry(r, this.seg(ws), this.seg(hs, 5)), color, o);
  }
  capsule(r: number, len: number, color: THREE.ColorRepresentation, o: PartOpts = {}) {
    return this.add(new THREE.CapsuleGeometry(r, len, this.seg(6, 3), this.seg(14)), color, o);
  }
  cyl(rt: number, rb: number, h: number, color: THREE.ColorRepresentation, o: PartOpts = {}, seg = 18) {
    return this.add(new THREE.CylinderGeometry(rt, rb, h, this.seg(seg), 1), color, o);
  }
  torus(r: number, t: number, color: THREE.ColorRepresentation, o: PartOpts = {}) {
    return this.add(new THREE.TorusGeometry(r, t, this.seg(10, 5), this.seg(24)), color, o);
  }
  cone(r: number, h: number, color: THREE.ColorRepresentation, o: PartOpts = {}, seg = 16) {
    return this.add(new THREE.ConeGeometry(r, h, this.seg(seg), 1), color, o);
  }
  /** Raw normalised parts (for static batching into chunk meshes). */
  parts() {
    return { solid: this.solid, hull: this.hull, glow: this.glowParts };
  }
  isEmpty() {
    return this.solid.length + this.glowParts.length === 0;
  }
  mergedSolid(ao = true): THREE.BufferGeometry | null {
    if (!this.solid.length) return null;
    const g = mergeGeometries(this.solid, false)!;
    if (ao) bakeAO(g);
    g.computeBoundingSphere();
    return g;
  }
  mergedHull(): THREE.BufferGeometry | null {
    if (!this.hull.length) return null;
    const parts = this.hull.map((h) => {
      const c = h.clone();
      c.deleteAttribute('normal');
      const m = mergeVertices(c, 1e-4);
      m.computeVertexNormals();
      return m;
    });
    const g = mergeGeometries(parts, false)!;
    g.computeBoundingSphere();
    return g;
  }
  mergedGlow(): THREE.BufferGeometry | null {
    return this.glowParts.length ? mergeGeometries(this.glowParts, false) : null;
  }
  build(opts: { outline?: boolean; outlineWidth?: number; castShadow?: boolean; ao?: boolean } = {}): THREE.Group {
    const group = new THREE.Group();
    const solid = this.mergedSolid(opts.ao !== false);
    if (solid) {
      const mesh = new THREE.Mesh(solid, toon({ vertexColors: true }));
      mesh.castShadow = opts.castShadow !== false;
      mesh.receiveShadow = true;
      mesh.name = 'solid';
      group.add(mesh);
    }
    if (opts.outline !== false) {
      const hull = this.mergedHull();
      if (hull) {
        const o = new THREE.Mesh(hull, outlineMaterial(undefined, opts.outlineWidth ?? 1));
        o.name = 'outline';
        group.add(o);
      }
    }
    const g = this.mergedGlow();
    if (g) {
      const gm = new THREE.Mesh(g, glowVC);
      gm.name = 'glow';
      group.add(gm);
    }
    return group;
  }
}
const glowVC = glow(0xffffff, 1, true);

/** Cheap vertex-colour ambient occlusion: darken towards the bottom of the object. */
export function bakeAO(g: THREE.BufferGeometry, strength = 0.22) {
  g.computeBoundingBox();
  const bb = g.boundingBox!;
  const h = Math.max(0.001, bb.max.y - bb.min.y);
  const pos = g.attributes.position as THREE.BufferAttribute;
  const col = g.attributes.color as THREE.BufferAttribute;
  const nor = g.attributes.normal as THREE.BufferAttribute;
  for (let i = 0; i < pos.count; i++) {
    const t = Math.min(1, (pos.getY(i) - bb.min.y) / (h * 0.55));
    const down = Math.max(0, -nor.getY(i)) * 0.12;
    const f = 1 - strength * (1 - t * t * (3 - 2 * t)) - down;
    col.setXYZ(i, col.getX(i) * f, col.getY(i) * f, col.getZ(i) * f);
  }
}

/** Lathe from a 2D profile (x=radius, y=height) — great for rounded bodies, cones, bottles. */
export function lathe(profile: [number, number][], seg = 20): THREE.BufferGeometry {
  return new THREE.LatheGeometry(
    profile.map(([x, y]) => new THREE.Vector2(x, y)),
    seg,
  );
}
/** Extruded rounded 2D shape (star, heart...). */
export function extrudeShape(shape: THREE.Shape, depth: number, bevel = 0.04): THREE.BufferGeometry {
  const g = new THREE.ExtrudeGeometry(shape, {
    depth,
    bevelEnabled: true,
    bevelThickness: bevel,
    bevelSize: bevel,
    bevelSegments: 3,
    curveSegments: 10,
  });
  g.translate(0, 0, -depth / 2);
  return g;
}
export function starShape(outer = 1, inner = 0.48, points = 5): THREE.Shape {
  const s = new THREE.Shape();
  for (let i = 0; i < points * 2; i++) {
    const r = i % 2 ? inner : outer;
    const a = (i / (points * 2)) * Math.PI * 2 + Math.PI / 2;
    const x = Math.cos(a) * r;
    const y = Math.sin(a) * r;
    if (i === 0) s.moveTo(x, y);
    else s.lineTo(x, y);
  }
  s.closePath();
  return s;
}
export function heartShape(size = 1): THREE.Shape {
  const s = new THREE.Shape();
  const k = size;
  s.moveTo(0, -0.9 * k);
  s.bezierCurveTo(0.2 * k, -0.6 * k, 1.0 * k, -0.2 * k, 1.0 * k, 0.3 * k);
  s.bezierCurveTo(1.0 * k, 0.8 * k, 0.35 * k, 1.0 * k, 0, 0.55 * k);
  s.bezierCurveTo(-0.35 * k, 1.0 * k, -1.0 * k, 0.8 * k, -1.0 * k, 0.3 * k);
  s.bezierCurveTo(-1.0 * k, -0.2 * k, -0.2 * k, -0.6 * k, 0, -0.9 * k);
  return s;
}
