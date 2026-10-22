import * as THREE from 'three';
import { cloudTexture } from './textures';
import { Rng } from '../core/rng';
import type { ThemeDef } from '../tracks/themes';

/** Gradient sky dome with sun glow, optional stars & aurora ribbons. */
export function buildSky(theme: ThemeDef): THREE.Mesh {
  const s = theme.sky;
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
    toneMapped: false,
    uniforms: {
      uTop: { value: new THREE.Color(s.top) },
      uHorizon: { value: new THREE.Color(s.horizon) },
      uBottom: { value: new THREE.Color(s.bottom) },
      uSun: { value: new THREE.Color(s.sun) },
      uSunDir: { value: new THREE.Vector3(...s.sunDir).normalize() },
      uStars: { value: s.stars ? 1 : 0 },
      uAurora: { value: s.aurora ? 1 : 0 },
      uTime: { value: 0 },
    },
    vertexShader: /* glsl */ `
      varying vec3 vDir;
      void main() {
        vDir = normalize(position);
        vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        gl_Position = p.xyww;
      }`,
    fragmentShader: /* glsl */ `
      uniform vec3 uTop, uHorizon, uBottom, uSun, uSunDir;
      uniform float uStars, uAurora, uTime;
      varying vec3 vDir;
      float hash(vec3 p) { return fract(sin(dot(p, vec3(12.9898, 78.233, 37.719))) * 43758.5453); }
      float cloudNoise(vec2 p) {
        vec2 i=floor(p), f=fract(p); f=f*f*(3.0-2.0*f);
        return mix(mix(hash(vec3(i,0.0)),hash(vec3(i+vec2(1,0),0.0)),f.x),
          mix(hash(vec3(i+vec2(0,1),0.0)),hash(vec3(i+vec2(1,1),0.0)),f.x),f.y);
      }
      void main() {
        vec3 d = normalize(vDir);
        float h = d.y;
        vec3 col = h > 0.0 ? mix(uHorizon, uTop, pow(smoothstep(0.0, 0.75, h), 0.8)) : mix(uHorizon, uBottom, smoothstep(0.0, -0.25, h));
        float sd = max(dot(d, uSunDir), 0.0);
        col += uSun * (smoothstep(.99965,.9999,sd)*1.2 + pow(sd,72.0)*.22 + pow(sd,12.0)*.07);
        // A high, thin cloud deck sits behind the lower cloud billboards.
        if(h > .035 && uStars < .5) {
          vec2 cp=d.xz/(h+.24)*2.8+vec2(uTime*.004,0.0);
          float n=cloudNoise(cp)*.58+cloudNoise(cp*2.1)*.28+cloudNoise(cp*4.3)*.14;
          float cloud=smoothstep(.53,.78,n)*smoothstep(.035,.22,h)*.55;
          vec3 litCloud=mix(uHorizon*.88,vec3(1.0,.985,.96),.45+sd*.3);
          col=mix(col,litCloud,cloud);
        }
        if (uStars > 0.5 && h > 0.05) {
          vec3 grid = d * 420.0;
          vec3 cell = floor(grid);
          float r = hash(cell);
          float tw = 0.6 + 0.4 * sin(uTime * 2.0 + r * 40.0);
          float point = 1.0-smoothstep(.08,.24,length(fract(grid)-vec3(.5)));
          col += step(.91,r) * point * tw * smoothstep(0.05, 0.4, h) * vec3(1.0, 0.95, 1.0);
        }
        if (uAurora > 0.5 && h > 0.1) {
          float band = sin(d.x * 6.0 + uTime * 0.25 + sin(d.z * 4.0 + uTime * 0.15) * 1.5);
          float a = smoothstep(0.55, 1.0, band) * smoothstep(0.12, 0.35, h) * smoothstep(0.85, 0.45, h);
          vec3 ac = mix(vec3(0.6, 1.0, 0.85), vec3(0.85, 0.7, 1.0), 0.5 + 0.5 * sin(d.x * 3.0 + uTime * 0.2));
          col = mix(col, ac, a * 0.55);
        }
        gl_FragColor = vec4(col, 1.0);
      }`,
  });
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(1500, 32, 16), mat);
  mesh.renderOrder = -10;
  mesh.frustumCulled = false;
  return mesh;
}

/** Puffy billboard clouds drifting slowly around the track. */
export function buildClouds(count: number, centre: THREE.Vector3, radius: number, yBase: number, seed = 5): THREE.InstancedMesh {
  const mat = new THREE.MeshBasicMaterial({
    map: cloudTexture(),
    transparent: true,
    depthWrite: false,
    fog: true,
    toneMapped: false,
    side: THREE.DoubleSide,
  });
  const geo = new THREE.PlaneGeometry(1, 0.5);
  const im = new THREE.InstancedMesh(geo, mat, count);
  const r = new Rng(seed);
  const m = new THREE.Matrix4();
  const data: { a: number; d: number; y: number; s: number; sp: number }[] = [];
  for (let i = 0; i < count; i++) {
    data.push({ a: r.range(0, Math.PI * 2), d: radius * r.range(0.6, 1.6), y: yBase + r.range(40, 140), s: r.range(50, 120), sp: r.range(0.004, 0.012) });
  }
  im.userData.clouds = data;
  im.userData.centre = centre.clone();
  im.frustumCulled = false;
  im.renderOrder = -5;
  updateClouds(im, 0, new THREE.Vector3());
  void m;
  return im;
}
const _m = new THREE.Matrix4();
const _p = new THREE.Vector3();
const _q = new THREE.Quaternion();
const _s = new THREE.Vector3();
const _e = new THREE.Euler();
export function updateClouds(im: THREE.InstancedMesh, t: number, cam: THREE.Vector3) {
  const data = im.userData.clouds as { a: number; d: number; y: number; s: number; sp: number }[];
  const c = im.userData.centre as THREE.Vector3;
  for (let i = 0; i < data.length; i++) {
    const d = data[i];
    const a = d.a + t * d.sp;
    _p.set(c.x + Math.cos(a) * d.d, d.y, c.z + Math.sin(a) * d.d);
    _e.set(0, Math.atan2(cam.x - _p.x, cam.z - _p.z), 0);
    _q.setFromEuler(_e);
    _s.set(d.s, d.s, 1);
    _m.compose(_p, _q, _s);
    im.setMatrixAt(i, _m);
  }
  im.instanceMatrix.needsUpdate = true;
}

/** Animated wave normals with sky/sun reflections; a separate emissive flow for lava. */
export function buildWater(color: string, size: number, y: number, centre: THREE.Vector3, theme?: ThemeDef, lava = false): THREE.Mesh {
  const mat = new THREE.ShaderMaterial({
    fog: true,
    transparent: false,
    uniforms: THREE.UniformsUtils.merge([
      THREE.UniformsLib.fog,
      { uColor: { value: new THREE.Color(color) }, uTime: { value: 0 },
        uHorizon: { value: new THREE.Color(theme?.sky.horizon ?? '#C2DFEA') },
        uSky: { value: new THREE.Color(theme?.sky.top ?? '#548DAD') },
        uSunDir: { value: new THREE.Vector3(...(theme?.sky.sunDir ?? [.4,.7,.3])).normalize() },
        uLava: { value: lava ? 1 : 0 } },
    ]),
    vertexShader: /* glsl */ `
      varying vec3 vW;
      #include <fog_pars_vertex>
      void main() {
        vec4 w = modelMatrix * vec4(position, 1.0);
        vW = w.xyz;
        vec4 mvPosition = viewMatrix * w;
        gl_Position = projectionMatrix * mvPosition;
        #include <fog_vertex>
      }`,
    fragmentShader: /* glsl */ `
      uniform vec3 uColor; uniform float uTime;
      uniform vec3 uHorizon, uSky, uSunDir;
      uniform float uLava;
      varying vec3 vW;
      #include <fog_pars_fragment>
      void main() {
        vec2 p = vW.xz;
        float a=p.x*.12+p.y*.07+uTime*.48;
        float b=p.x*-.19+p.y*.21-uTime*.62;
        float c=p.x*.53+p.y*.39+uTime*.83;
        vec3 normal=normalize(vec3(-cos(a)*.12-cos(b)*-.065-cos(c)*.035,1.0,
          -cos(a)*.07-cos(b)*.075-cos(c)*.026));
        vec3 view=normalize(cameraPosition-vW);
        float fresnel=.035+.78*pow(1.0-max(dot(normal,view),0.0),4.0);
        vec3 reflection=reflect(-view,normal);
        vec3 sky=mix(uHorizon,uSky,smoothstep(0.0,.75,reflection.y));
        float swell=.5+.5*sin(a)*sin(b);
        vec3 col=mix(uColor*(.68+swell*.24),sky,fresnel);
        float sun=pow(max(dot(reflect(-uSunDir,normal),view),0.0),160.0);
        col+=vec3(1.0,.94,.8)*sun*.8;
        float foam=smoothstep(.94,1.0,sin(a*.7+sin(b)*.8)*sin(b*.6));
        col=mix(col,vec3(.78,.9,.92),foam*.13);
        if(uLava>.5) {
          float crust=smoothstep(-.2,.65,sin(a*.4+sin(b*.5))*.6+sin(b*.7)*.4);
          col=mix(vec3(.22,.055,.027),uColor*1.25,crust);
          col+=vec3(1.0,.38,.04)*pow(crust,8.0)*.35;
        }
        gl_FragColor = vec4(col, 1.0);
        #include <fog_fragment>
      }`,
  });
  const m = new THREE.Mesh(new THREE.PlaneGeometry(size, size, 1, 1).rotateX(-Math.PI / 2), mat);
  m.position.set(centre.x, y, centre.z);
  m.receiveShadow = false;
  return m;
}
