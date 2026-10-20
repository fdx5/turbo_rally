import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import type { MatKind } from '../data/cosmetics';
import { toon } from './toon';

let envTex: THREE.Texture | null = null;
/** Soft studio environment for metals/gems (generated once from RoomEnvironment). */
export function initEnv(renderer: THREE.WebGLRenderer) {
  if (envTex) return envTex;
  const pm = new THREE.PMREMGenerator(renderer);
  envTex = pm.fromScene(new RoomEnvironment(), 0.04).texture;
  pm.dispose();
  return envTex;
}
export const sharedTime = { value: 0 };

function sweep(m: THREE.Material, strength: number) {
  const prev = m.onBeforeCompile;
  m.onBeforeCompile = (sh, r) => {
    prev?.call(m, sh, r);
    sh.uniforms.uTime = sharedTime;
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform float uTime;')
      .replace(
        '#include <opaque_fragment>',
        `{
          vec3 vd = normalize(vViewPosition);
          float band = sin((vViewPosition.x + vViewPosition.y) * 2.2 - uTime * 3.0);
          float glint = smoothstep(0.93, 1.0, band);
          float fres = pow(1.0 - clamp(dot(normal, vd), 0.0, 1.0), 2.0);
          outgoingLight += vec3(1.0, 0.96, 0.98) * (glint * ${strength.toFixed(2)} + fres * 0.15);
        }
        #include <opaque_fragment>`,
      );
  };
  m.customProgramCacheKey = () => 'sweep' + strength;
}

const cache = new Map<string, THREE.Material>();
export function tierMaterial(kind: MatKind): THREE.Material {
  const hit = cache.get(kind);
  if (hit) return hit;
  let m: THREE.Material;
  switch (kind) {
    case 'pearl': {
      const p = new THREE.MeshPhysicalMaterial({
        vertexColors: true,
        roughness: 0.32,
        metalness: 0.1,
        iridescence: 0.9,
        iridescenceIOR: 1.6,
        sheen: 0.6,
        sheenColor: new THREE.Color('#FFE6F7'),
        envMap: envTex,
        envMapIntensity: 1.0,
      });
      sweep(p, 0.45);
      m = p;
      break;
    }
    case 'metal': {
      const p = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.2, metalness: 0.95, envMap: envTex, envMapIntensity: 1.3 });
      sweep(p, 0.5);
      m = p;
      break;
    }
    case 'gold':
    case 'rosegold': {
      const p = new THREE.MeshStandardMaterial({
        vertexColors: true,
        roughness: 0.18,
        metalness: 1.0,
        envMap: envTex,
        envMapIntensity: 1.6,
        emissive: new THREE.Color(kind === 'gold' ? '#4a3200' : '#4a2018'),
        emissiveIntensity: 0.35,
      });
      sweep(p, 0.8);
      m = p;
      break;
    }
    case 'gem': {
      const p = new THREE.MeshStandardMaterial({
        vertexColors: true,
        roughness: 0.05,
        metalness: 0.3,
        envMap: envTex,
        envMapIntensity: 2.2,
        flatShading: true,
        emissive: new THREE.Color('#ffffff'),
        emissiveIntensity: 0.25,
        transparent: true,
        opacity: 0.92,
      });
      sweep(p, 1.2);
      m = p;
      break;
    }
    case 'holo': {
      const p = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.25, metalness: 0.4, envMap: envTex, envMapIntensity: 1.0 });
      p.onBeforeCompile = (sh) => {
        sh.uniforms.uTime = sharedTime;
        sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nuniform float uTime;').replace(
          '#include <opaque_fragment>',
          `{
            vec3 vd = normalize(vViewPosition);
            float f = dot(normal, vd);
            vec3 holo = 0.5 + 0.5 * cos(6.2831 * (vec3(0.0, 0.33, 0.67) + f * 1.3 + uTime * 0.35 + vViewPosition.y * 0.6));
            holo = mix(holo, vec3(1.0, 0.85, 1.0), 0.35);
            outgoingLight = mix(outgoingLight, holo * 1.15, 0.55) + holo * 0.25 * pow(1.0 - abs(f), 2.0);
          }
          #include <opaque_fragment>`,
        );
      };
      p.customProgramCacheKey = () => 'holo';
      m = p;
      break;
    }
    default:
      m = toon({ vertexColors: true });
  }
  m.userData.uTime = sharedTime;
  cache.set(kind, m);
  return m;
}
