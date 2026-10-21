import * as THREE from 'three';
import { BloomEffect, EffectComposer, EffectPass, RenderPass, SMAAEffect, SMAAPreset, VignetteEffect } from 'postprocessing';
import { outlineUniforms } from '../art/toon';
import { initEnv } from '../art/materials';
import type { QualityLevel } from './settings';

export type Preset = Exclude<QualityLevel, 'auto'>;
export interface PresetDef {
  dpr: number;
  minDpr: number; // supersampling floor on 1x displays (sharper image)
  shadow: number;
  bloom: boolean;
  smaa: boolean;
  particles: number;
  props: number;
  outlines: boolean;
  farOutline: number;
}
export const PRESETS: Record<Preset, PresetDef> = {
  low: { dpr: 0.75, minDpr: 0.75, shadow: 0, bloom: false, smaa: false, particles: 0.35, props: 0.45, outlines: true, farOutline: 18 },
  medium: { dpr: 1.25, minDpr: 1.0, shadow: 1024, bloom: true, smaa: false, particles: 0.65, props: 0.75, outlines: true, farOutline: 35 },
  high: { dpr: 1.75, minDpr: 1.3, shadow: 2048, bloom: true, smaa: true, particles: 1, props: 1, outlines: true, farOutline: 60 },
  ultra: { dpr: 2.0, minDpr: 1.6, shadow: 4096, bloom: true, smaa: true, particles: 1.2, props: 1.25, outlines: true, farOutline: 120 },
};
const ORDER: Preset[] = ['low', 'medium', 'high', 'ultra'];
export const isMobile = /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent) || (navigator.maxTouchPoints > 1 && /Mac/.test(navigator.userAgent));

/** Owns the WebGL renderer + postprocessing chain + automatic quality scaling (§13). */
export class Renderer {
  renderer: THREE.WebGLRenderer;
  composer: EffectComposer;
  renderPass: RenderPass;
  effectPass: EffectPass | null = null;
  bloom: BloomEffect;
  smaa: SMAAEffect;
  vignette: VignetteEffect;
  preset: Preset;
  auto: boolean;
  dprScale = 1;
  private frameTimes: number[] = [];
  private cooldown = 3;
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  onPresetChange: ((p: Preset) => void) | null = null;

  constructor(canvasEl: HTMLCanvasElement, quality: QualityLevel) {
    this.renderer = new THREE.WebGLRenderer({ canvas: canvasEl, antialias: false, powerPreference: 'high-performance', stencil: false, depth: true });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.NoToneMapping;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    initEnv(this.renderer);
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(70, 16 / 9, 0.3, 2400);
    this.composer = new EffectComposer(this.renderer, { frameBufferType: THREE.HalfFloatType, multisampling: 0 });
    this.renderPass = new RenderPass(this.scene, this.camera);
    this.composer.addPass(this.renderPass);
    this.bloom = new BloomEffect({ luminanceThreshold: 1.0, luminanceSmoothing: 0.25, intensity: 0.85, mipmapBlur: true, radius: 0.7 });
    this.smaa = new SMAAEffect({ preset: SMAAPreset.HIGH });
    this.vignette = new VignetteEffect({ darkness: 0.28, offset: 0.35 });
    this.auto = quality === 'auto';
    this.preset = quality === 'auto' ? (isMobile ? 'medium' : 'high') : quality;
    this.applyPreset();
    window.addEventListener('resize', () => this.resize());
    this.resize();
  }
  get def() {
    return PRESETS[this.preset];
  }
  setQuality(q: QualityLevel) {
    this.auto = q === 'auto';
    this.preset = q === 'auto' ? this.startPreset : q;
    this.dprScale = 1;
    this.applyPreset();
  }
  setSceneCamera(scene: THREE.Scene, camera: THREE.PerspectiveCamera) {
    this.scene = scene;
    this.camera = camera;
    this.renderPass.mainScene = scene;
    this.renderPass.mainCamera = camera;
    this.rebuildEffects();
    this.resize();
    this.settleUntil = performance.now() + 4000;
    this.frameTimes.length = 0;
  }
  private rebuildEffects() {
    if (this.effectPass) {
      this.composer.removePass(this.effectPass);
      this.effectPass.dispose();
    }
    const d = this.def;
    const fx = [] as (BloomEffect | SMAAEffect | VignetteEffect)[];
    if (d.bloom) fx.push(this.bloom);
    if (d.smaa) fx.push(this.smaa);
    fx.push(this.vignette);
    this.effectPass = new EffectPass(this.camera, ...fx);
    this.composer.addPass(this.effectPass);
  }
  applyPreset() {
    const d = this.def;
    this.renderer.shadowMap.enabled = d.shadow > 0;
    this.rebuildEffects();
    this.resize();
    this.onPresetChange?.(this.preset);
  }
  resize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    const dpr = Math.min(Math.max(window.devicePixelRatio || 1, this.def.minDpr), this.def.dpr) * this.dprScale;
    this.renderer.setPixelRatio(Math.max(0.5, dpr));
    this.renderer.setSize(w, h, false);
    this.composer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    const pr = this.renderer.getPixelRatio();
    outlineUniforms.uResolution.value.set(w * pr, h * pr);
    outlineUniforms.uOutlinePx.value = 2.0 * Math.max(0.75, pr * 0.85);
  }
  render(dt: number) {
    this.composer.render(dt);
  }
  /** Auto quality: watch 120-frame average; step down (pixel ratio → shadows → bloom → particles) (§13). */
  /** Ignore hitches right after a scene switch (track build / menu change). */
  private settleUntil = 0;
  private floor(): Preset {
    return isMobile ? 'low' : 'medium';
  }
  private startPreset: Preset = isMobile ? 'medium' : 'high';
  /**
   * Auto quality: uses the MEDIAN frame time over 3 s (robust to 60 Hz vsync jitter and loading
   * hitches). Steps down only below ~50 fps, steps back up when there is headroom (§13).
   */
  sample(frameMs: number) {
    if (!this.auto) return;
    const now = performance.now();
    if (frameMs > 100 || now < this.settleUntil) {
      this.frameTimes.length = 0;
      return;
    }
    this.frameTimes.push(frameMs);
    if (this.frameTimes.length < 180) return;
    const sorted = [...this.frameTimes].sort((x, y) => x - y);
    const med = sorted[sorted.length >> 1];
    this.frameTimes.length = 0;
    const i = ORDER.indexOf(this.preset);
    if (med > 20) {
      if (this.dprScale > 0.85) {
        this.dprScale = Math.max(0.8, this.dprScale - 0.1);
        this.resize();
      } else if (i > ORDER.indexOf(this.floor())) {
        this.preset = ORDER[i - 1];
        this.dprScale = 1;
        this.applyPreset();
      }
      this.settleUntil = now + 2000;
    } else if (med < 13.5) {
      if (this.dprScale < 1) {
        this.dprScale = Math.min(1, this.dprScale + 0.1);
        this.resize();
      } else if (i < ORDER.indexOf(this.startPreset)) {
        this.preset = ORDER[i + 1];
        this.applyPreset();
      }
      this.settleUntil = now + 3000;
    }
  }
  get renderScale() {
    return this.renderer.getPixelRatio();
  }

}

export function makeLights(sunColor: string, sunI: number, hemiSky: string, hemiGround: string, hemiI: number, amb: number, shadowSize: number) {
  const g = new THREE.Group();
  const sun = new THREE.DirectionalLight(sunColor, sunI);
  sun.castShadow = shadowSize > 0;
  sun.shadow.mapSize.set(shadowSize || 512, shadowSize || 512);
  sun.shadow.camera.near = 1;
  sun.shadow.camera.far = 220;
  const S = 45;
  sun.shadow.camera.left = -S;
  sun.shadow.camera.right = S;
  sun.shadow.camera.top = S;
  sun.shadow.camera.bottom = -S;
  sun.shadow.bias = -0.0006;
  sun.shadow.normalBias = 0.04;
  sun.shadow.radius = 3;
  g.add(sun, sun.target);
  g.add(new THREE.HemisphereLight(hemiSky, hemiGround, hemiI));
  g.add(new THREE.AmbientLight('#ffffff', amb));
  return { group: g, sun };
}
