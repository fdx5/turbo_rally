import * as THREE from 'three';

let gradient: THREE.DataTexture | null = null;
/** 3-band toon ramp (§6.1) — soft pastel shadows, never black. */
export function toonRamp(): THREE.DataTexture {
  if (gradient) return gradient;
  const steps = [150, 205, 255];
  const data = new Uint8Array(steps.length * 4);
  steps.forEach((v, i) => data.set([v, v, v, 255], i * 4));
  gradient = new THREE.DataTexture(data, steps.length, 1, THREE.RGBAFormat);
  gradient.minFilter = THREE.NearestFilter;
  gradient.magFilter = THREE.NearestFilter;
  gradient.needsUpdate = true;
  return gradient;
}

export const rimUniforms = {
  uRimColor: { value: new THREE.Color('#fff4fb') },
  uRimStrength: { value: 0.38 },
};

function addRim(mat: THREE.Material, strength = 1) {
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uRimColor = rimUniforms.uRimColor;
    shader.uniforms.uRimStrength = rimUniforms.uRimStrength;
    shader.uniforms.uRimLocal = { value: strength };
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        '#include <common>\nuniform vec3 uRimColor; uniform float uRimStrength; uniform float uRimLocal;',
      )
      .replace(
        '#include <opaque_fragment>',
        `{
          vec3 vd = normalize(vViewPosition);
          float rim = pow(1.0 - clamp(dot(normal, vd), 0.0, 1.0), 3.0);
          rim = smoothstep(0.35, 0.6, rim);
          outgoingLight += uRimColor * rim * uRimStrength * uRimLocal * (0.5 + 0.5 * diffuseColor.rgb);
        }
        #include <opaque_fragment>`,
      );
  };
  mat.customProgramCacheKey = () => 'toonrim' + strength;
}

export interface ToonOpts {
  color?: THREE.ColorRepresentation;
  vertexColors?: boolean;
  map?: THREE.Texture | null;
  transparent?: boolean;
  opacity?: number;
  emissive?: THREE.ColorRepresentation;
  emissiveIntensity?: number;
  rim?: number;
  side?: THREE.Side;
}
const cache = new Map<string, THREE.MeshToonMaterial>();
export function toon(opts: ToonOpts = {}): THREE.MeshToonMaterial {
  const key = !opts.map && !opts.transparent ? JSON.stringify(opts) : '';
  if (key && cache.has(key)) return cache.get(key)!;
  const m = new THREE.MeshToonMaterial({
    color: opts.color ?? 0xffffff,
    vertexColors: !!opts.vertexColors,
    gradientMap: toonRamp(),
    map: opts.map ?? null,
    transparent: !!opts.transparent,
    opacity: opts.opacity ?? 1,
    emissive: opts.emissive ?? 0x000000,
    emissiveIntensity: opts.emissiveIntensity ?? 1,
    side: opts.side ?? THREE.FrontSide,
  });
  addRim(m, opts.rim ?? 1);
  if (key) cache.set(key, m);
  return m;
}

/** Unlit glowing material for lights / sparkles — values > 1 feed the bloom pass. */
export function glow(color: THREE.ColorRepresentation, intensity = 2.2, vertexColors = false): THREE.MeshBasicMaterial {
  const c = new THREE.Color(color).multiplyScalar(intensity);
  return new THREE.MeshBasicMaterial({ color: c, toneMapped: false, vertexColors });
}

/** Screen-space-ish inverted hull outline. Colour comes from the darkened vertex colour (never pure black). */
export const outlineUniforms = {
  uOutlinePx: { value: 2.0 },
  uResolution: { value: new THREE.Vector2(1280, 720) },
};
const outlineCache = new Map<string, THREE.MeshBasicMaterial>();
export function outlineMaterial(color?: THREE.ColorRepresentation, widthScale = 1): THREE.MeshBasicMaterial {
  const key = (color === undefined ? 'vc' : new THREE.Color(color).getHexString()) + widthScale;
  const hit = outlineCache.get(key);
  if (hit) return hit;
  const m = new THREE.MeshBasicMaterial({
    color: color === undefined ? 0xffffff : color,
    vertexColors: color === undefined,
    side: THREE.BackSide,
  });
  m.onBeforeCompile = (shader) => {
    shader.uniforms.uOutlinePx = outlineUniforms.uOutlinePx;
    shader.uniforms.uResolution = outlineUniforms.uResolution;
    shader.uniforms.uWidthScale = { value: widthScale };
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nuniform float uOutlinePx; uniform vec2 uResolution; uniform float uWidthScale;')
      .replace(
        '#include <project_vertex>',
        `vec4 mvPosition = vec4(transformed, 1.0);
        vec3 on = normal;
        #ifdef USE_INSTANCING
          mvPosition = instanceMatrix * mvPosition;
          on = mat3(instanceMatrix) * on;
        #endif
        mvPosition = modelViewMatrix * mvPosition;
        vec3 vn = normalize(normalMatrix * on);
        vec4 clip = projectionMatrix * mvPosition;
        vec2 cn = normalize((projectionMatrix * vec4(vn, 0.0)).xy + 1e-5);
        float dist = max(-mvPosition.z, 0.1);
        float px = uOutlinePx * uWidthScale * clamp(14.0 / dist, 0.35, 1.0);
        clip.xy += cn * px / uResolution * 2.0 * clip.w;
        gl_Position = clip;`,
      );
    if (color === undefined) {
      shader.fragmentShader = shader.fragmentShader.replace(
        '#include <color_fragment>',
        '#include <color_fragment>\n diffuseColor.rgb *= vec3(0.42, 0.36, 0.48);',
      );
    }
  };
  m.customProgramCacheKey = () => 'outline' + (color === undefined ? 'vc' : 'c') + widthScale;
  outlineCache.set(key, m);
  return m;
}
