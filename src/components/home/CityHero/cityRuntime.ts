// Akıllı şehir GLB'sinin (v2, beyaz maket) çalışma zamanı: atmosfer, shader'lar ve kamera.
// Post-process (MSAA'lı HDR hedef + bloom) kaldırıldı: kare süresini ikiye katlayıp fare hareketinde kasma yapıyordu.
// Çizim doğrudan tuvale, tarayıcının kendi antialias'ıyla yapılır, vinyet CSS ile verilir.
import * as THREE from 'three';

type Vec3 = number[];

export interface CityConfig {
  hero: { position: Vec3; target: Vec3; fov: number };
  cableCar: {
    instancedMesh: string;
    speed?: number;
    tracks: { points: Vec3[]; gondolas: number }[];
  };
}

export type Quality = 'high' | 'medium' | 'low';

const DEG = Math.PI / 180;
const clamp01 = (value: number) => Math.min(1, Math.max(0, value));
const lerp = THREE.MathUtils.lerp;
const lerpColor = (from: string, to: string, t: number) => new THREE.Color(from).lerp(new THREE.Color(to), t);

const POSTER_ASPECT = 16 / 9;

// Hero kamerası paketteki güneydoğu yerine tam karşıdan, kuzeybatıdan bakar (yarım tur).
const HERO_AZIMUTH_OFFSET = Math.PI;
// Hero kamerasının hedefe uzaklığı, paketteki değere göre (1 = paketteki konum). Aynı açıdan şehre biraz daha yakın.
const HERO_DISTANCE_SCALE = 0.8;

/** 16:9 poster görseliyle aynı kadrajı (object-fit: cover) her ekran oranında veren dikey görüş açısı. */
function coverFov(baseFov: number, aspect: number): number {
  if (aspect <= POSTER_ASPECT) return baseFov;
  const horizontal = 2 * Math.atan(Math.tan((baseFov * DEG) / 2) * POSTER_ASPECT);
  return (2 * Math.atan(Math.tan(horizontal / 2) / aspect)) / DEG;
}

// Prosedürel shader'ların ortak uniform'ları.
const cityUniforms = {
  uWin: { value: 1.0 }, // pencere ışığı şiddeti
  uWarm: { value: new THREE.Color('#ffb25c') },
  uLitShare: { value: 0.22 }, // güçlü yanan binaların payı
  uContour: { value: 0.3 }, // arazi kontur çizgileri yalnızca ima edilir, harita gibi okunmaz
  uTime: { value: 0 }, // su dalgaları için saniye
};

// Gün batımı (0) ile mavi saat (1) arasındaki ara değerler.
// Altın saat: alçak ve sıcak güneş, uzun gölgeler, gölge tarafları soğuk gökyüzü ışığıyla dolar, sokak lambaları neredeyse sönük.
const TIME_OF_DAY = {
  golden: { sun: '#ffc48a', sunI: 4.2, sunEl: 15, hemiSky: '#a7bddc', hemiGround: '#9a8566', hemiI: 0.7, env: 0.65, fog: '#e4d2b6', fogD: 0.00009, zenith: '#7d9cc4', horizon: '#f2d6ae', windows: 0.9, lamps: 1.0, exposure: 0.95 },
  blue: { sun: '#ff9a68', sunI: 0.5, sunEl: 2.5, hemiSky: '#506a9a', hemiGround: '#2a2c36', hemiI: 0.6, env: 0.4, fog: '#3e4a66', fogD: 0.0001, zenith: '#1c2a4a', horizon: '#8086a6', windows: 4.0, lamps: 6.0, exposure: 1.1 },
} as const;

function skyTexture(
  renderer: THREE.WebGLRenderer,
  zenith: THREE.Color,
  horizon: THREE.Color,
  sunDir: THREE.Vector3,
  sunColor: THREE.Color,
): THREE.Texture {
  const pmrem = new THREE.PMREMGenerator(renderer);
  const sky = new THREE.Scene();
  const material = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    uniforms: {
      zen: { value: zenith },
      hor: { value: horizon },
      sun: { value: sunDir.clone().normalize() },
      sunC: { value: sunColor },
      gnd: { value: new THREE.Color('#b9ab92') },
    },
    vertexShader: 'varying vec3 vDir; void main(){ vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
    fragmentShader: `varying vec3 vDir; uniform vec3 zen, hor, sun, sunC, gnd;
      void main(){ float h = vDir.y; vec3 c = mix(hor, zen, pow(clamp(h,0.0,1.0), 0.55));
        c = mix(c, gnd * (0.35 + 0.65 * hor), smoothstep(0.02, -0.3, h));
        float s = max(dot(normalize(vDir), sun), 0.0); c += sunC * (pow(s, 600.0) * 6.0 + pow(s, 10.0) * 0.5);
        gl_FragColor = vec4(c, 1.0); }`,
  });
  const geometry = new THREE.SphereGeometry(100, 32, 16);
  sky.add(new THREE.Mesh(geometry, material));
  const target = pmrem.fromScene(sky, 0.02);
  pmrem.dispose();
  material.dispose();
  geometry.dispose();
  return target.texture;
}

export interface Atmosphere {
  focusShadows: (target: THREE.Vector3, distance: number) => void;
  dispose: () => void;
}

/** Işıkları, gökyüzü ortam haritasını ve sisi kurar. */
export function createAtmosphere(
  renderer: THREE.WebGLRenderer,
  scene: THREE.Scene,
  cityRoot: THREE.Object3D,
  { quality, timeOfDay }: { quality: Quality; timeOfDay: number },
): Atmosphere {
  const sunNode = cityRoot.getObjectByName('Sun_Direction');
  const azimuth = sunNode ? Math.atan2(sunNode.position.x, sunNode.position.z) : -1.3;
  const sun = new THREE.DirectionalLight('#ffffff', 3);
  sun.name = 'Runtime_Sun';
  sun.castShadow = quality !== 'low';
  const shadowSize = quality === 'high' ? 4096 : 2048;
  sun.shadow.mapSize.set(shadowSize, shadowSize);
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.6;
  sun.shadow.radius = 3;
  sun.shadow.camera.near = 10;
  sun.shadow.camera.far = 9000;
  const hemi = new THREE.HemisphereLight('#ffffff', '#444444', 1);
  hemi.name = 'Runtime_Sky';
  const fog = new THREE.FogExp2('#dcc8aa', 0.00007);
  scene.add(sun, sun.target, hemi);
  scene.fog = fog;

  // Lambalar (Light_Warm, Light_Red) ışık şiddetini zamana göre alır.
  const lampMaterials = new Set<THREE.MeshStandardMaterial>();
  cityRoot.traverse((object) => {
    if (!(object instanceof THREE.Mesh)) return;
    const materials: THREE.Material[] = Array.isArray(object.material) ? object.material : [object.material];
    for (const material of materials) {
      if (material instanceof THREE.MeshStandardMaterial && /^Light_/.test(material.name)) lampMaterials.add(material);
    }
  });

  let envTexture: THREE.Texture | null = null;
  let lastEnvT = -1;
  const sunDir = new THREE.Vector3();
  const A = TIME_OF_DAY.golden;
  const B = TIME_OF_DAY.blue;

  function setTimeOfDay(value: number) {
    const t = clamp01(value);
    const eased = t * t;
    const elevation = lerp(A.sunEl, B.sunEl, t) * DEG;
    sunDir
      .set(Math.sin(azimuth) * Math.cos(elevation), Math.sin(elevation), Math.cos(azimuth) * Math.cos(elevation))
      .normalize();
    sun.color.copy(lerpColor(A.sun, B.sun, t));
    sun.intensity = lerp(A.sunI, B.sunI, t);
    hemi.color.copy(lerpColor(A.hemiSky, B.hemiSky, t));
    hemi.groundColor.copy(lerpColor(A.hemiGround, B.hemiGround, t));
    hemi.intensity = lerp(A.hemiI, B.hemiI, t);
    fog.color.copy(lerpColor(A.fog, B.fog, t));
    fog.density = lerp(A.fogD, B.fogD, t);
    scene.background = fog.color.clone();
    scene.environmentIntensity = lerp(A.env, B.env, t);
    renderer.toneMappingExposure = lerp(A.exposure, B.exposure, t);
    cityUniforms.uWin.value = lerp(A.windows, B.windows, eased);
    cityUniforms.uLitShare.value = lerp(0.2, 0.42, t);
    for (const material of lampMaterials) {
      material.emissiveIntensity = lerp(A.lamps, B.lamps, eased) * (material.name === 'Light_Red' ? 0.8 : 1);
    }
    if (Math.abs(t - lastEnvT) > 0.04 || !envTexture) {
      const previous = envTexture;
      envTexture = skyTexture(
        renderer,
        lerpColor(A.zenith, B.zenith, t),
        lerpColor(A.horizon, B.horizon, t),
        sunDir,
        lerpColor(A.sun, B.sun, t).multiplyScalar(1 - t * 0.8),
      );
      scene.environment = envTexture;
      lastEnvT = t;
      previous?.dispose();
    }
  }

  // Şehir durağandır, gölge haritası her karede değil yalnızca odak değişince yeniden çizilir (kare süresinde büyük kazanç).
  renderer.shadowMap.autoUpdate = false;
  renderer.shadowMap.needsUpdate = true;
  const shadowTarget = new THREE.Vector3();
  const lastFocus = new THREE.Vector4(NaN);
  function focusShadows(target: THREE.Vector3, distance: number) {
    const half = THREE.MathUtils.clamp(distance * 0.62, 260, 2600);
    if (lastFocus.x === target.x && lastFocus.y === target.z && lastFocus.z === half) return;
    lastFocus.set(target.x, target.z, half, 0);
    renderer.shadowMap.needsUpdate = true;
    shadowTarget.copy(target);
    shadowTarget.y = 0;
    sun.target.position.copy(shadowTarget);
    sun.position.copy(shadowTarget).addScaledVector(sunDir, 4000);
    const camera = sun.shadow.camera;
    if (camera.right !== half) {
      camera.left = -half;
      camera.right = half;
      camera.top = half;
      camera.bottom = -half;
      camera.updateProjectionMatrix();
    }
    sun.target.updateMatrixWorld();
  }

  setTimeOfDay(timeOfDay);

  return {
    focusShadows,
    dispose() {
      scene.remove(sun, sun.target, hemi);
      renderer.shadowMap.autoUpdate = true;
      scene.fog = null;
      scene.environment = null;
      envTexture?.dispose();
    },
  };
}

// ------------------------------------------------------------------ prosedürel shader'lar (pencere ışıltısı, kontur çizgileri)

const VERT_DECL = 'varying vec3 vWPos; varying vec3 vWNrm; varying float vKey;\n';
const VERT_BODY = `
  vec4 cwp = vec4(transformed, 1.0);
  #ifdef USE_INSTANCING
    cwp = instanceMatrix * cwp;
    vKey = fract(sin(dot(instanceMatrix[3].xz, vec2(12.9898, 78.233))) * 43758.5453);
    vWNrm = normalize(mat3(modelMatrix) * mat3(instanceMatrix) * objectNormal);
  #else
    vKey = -1.0; vWNrm = normalize(mat3(modelMatrix) * objectNormal);
  #endif
  vWPos = (modelMatrix * cwp).xyz;
`;
const FRAG_COMMON = `
varying vec3 vWPos; varying vec3 vWNrm; varying float vKey;
uniform float uWin; uniform vec3 uWarm; uniform float uLitShare; uniform float uContour; uniform float uTime;
float h12(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float vnoise(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f);
  return mix(mix(h12(i), h12(i+vec2(1,0)), f.x), mix(h12(i+vec2(0,1)), h12(i+vec2(1,1)), f.x), f.y); }
float fbm(vec2 p){ float s = 0.0, a = 0.5; for (int i = 0; i < 4; i++){ s += a * vnoise(p); p *= 2.03; a *= 0.5; } return s; }
`;

// Cephe: bina başına malzeme tonu ve cam oranı, camlar koyu ve parlak, yanan pencereler seyrek.
// Uzaktan pencere ızgarası seçilemez, cephe ızgaranın ortalama rengini alır (eskiden tüm duvar ışık kutusu gibi parlıyordu).
const FACADE_FRAGMENT = `#include <emissivemap_fragment>
  {
    float wall = 1.0 - smoothstep(0.35, 0.6, abs(vWNrm.y));
    vec2 tg = normalize(vec2(-vWNrm.z, vWNrm.x) + 1e-5);
    float u = dot(vWPos.xz, tg);
    vec2 cell = vec2(u / 3.1, (vWPos.y - 0.8) / 3.45);
    vec2 f = fract(cell), id = floor(cell);
    vec2 aa = max(fwidth(cell) * 1.2, vec2(1e-4));
    float wx = smoothstep(0.16 - aa.x, 0.16 + aa.x, f.x) * (1.0 - smoothstep(0.84 - aa.x, 0.84 + aa.x, f.x));
    float wy = smoothstep(0.24 - aa.y, 0.24 + aa.y, f.y) * (1.0 - smoothstep(0.86 - aa.y, 0.86 + aa.y, f.y));
    float above = step(1.6, vWPos.y);
    float win = wx * wy * wall * above;
    // Pencere en az ~5 piksel olmadan çizilmez, yoksa kamera kaydıkça ızgara yanıp söner (moiré).
    float detail = 1.0 - smoothstep(0.08, 0.2, max(fwidth(cell.x), fwidth(cell.y)));
    float bkey = vKey < 0.0 ? h12(floor(vWPos.xz / 34.0) + 3.1) : vKey;

    // Malzeme tonu: sıcak beyaz, açık taş, soğuk beton, açık kil.
    float tk = h12(vec2(bkey * 53.1, 7.3));
    vec3 tint = tk < 0.4 ? vec3(0.97, 0.95, 0.91) : tk < 0.65 ? vec3(0.9, 0.87, 0.82) : tk < 0.85 ? vec3(0.85, 0.87, 0.89) : vec3(0.94, 0.86, 0.78);
    diffuseColor.rgb *= tint;

    // Cam: bina başına farklı cam oranı, uzakta ızgaranın ortalaması.
    float glassShare = mix(0.25, 0.75, h12(vec2(bkey * 13.7, 1.9)));
    float glass = mix(0.42, win, detail) * wall * above * glassShare;
    diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.13, 0.16, 0.2), glass);
    roughnessFactor = mix(roughnessFactor, 0.14, glass);

    // Zemine yakın duvarlarda temas gölgesi.
    diffuseColor.rgb *= mix(1.0, mix(0.74, 1.0, smoothstep(0.8, 10.0, vWPos.y)), wall);

    float bright = step(1.0 - uLitShare, bkey);
    float share = mix(0.1, 0.55, bright);
    float lit = step(h12(id + bkey * 91.7), share);
    float glow = mix(share * 0.2, win * lit * (0.65 + 0.35 * h12(id * 1.7 + 4.0)), detail);
    float base = (1.0 - smoothstep(4.5, 7.5, vWPos.y)) * wall * (0.25 + 0.75 * bright);
    totalEmissiveRadiance += uWarm * uWin * (glow * wall + base * 0.3);
  }`;

// Arazi ve ağaçlar aynı malzemeyi paylaşır. Ağaçlar örnek başına ton alır, arazi büyük ölçekli toprak lekeleri ve çalı benekleri.
const TERRAIN_FRAGMENT = `#include <color_fragment>
  {
    vec2 p = vWPos.xz;
    if (vKey >= 0.0) {
      diffuseColor.rgb *= mix(vec3(0.8, 0.85, 0.78), vec3(1.08, 1.04, 0.9), vKey);
    } else {
      float h = vWPos.y * 0.9 + fbm(p * 0.0011) * 70.0 + fbm(p * 0.004) * 9.0;
      float k = h / 3.2;
      float d = abs(fract(k) - 0.5) / max(fwidth(k), 1e-4);
      float line = 1.0 - smoothstep(0.6, 1.6, d);
      float fade = 1.0 - smoothstep(0.35, 0.8, fwidth(k));
      diffuseColor.rgb *= 1.0 - line * fade * 0.16 * uContour;

      float n1 = fbm(p * 0.00045);
      float n2 = fbm(p * 0.0022 + 17.0);
      vec3 tint = mix(vec3(0.86, 0.82, 0.76), vec3(1.07, 1.03, 0.96), smoothstep(0.3, 0.7, n1));
      tint *= 0.92 + 0.14 * n2;
      // Benekler yumuşak kenarlı ve piksel boyutuna inmeden solar, yoksa kamera kıpırdadıkça yanıp söner.
      vec2 sp = p * 0.018;
      float speckFade = 1.0 - smoothstep(0.08, 0.3, length(fwidth(sp)));
      float speck = smoothstep(0.55, 0.85, fbm(sp)) * speckFade;
      tint = mix(tint, tint * vec3(0.62, 0.64, 0.5), speck * 0.5);
      diffuseColor.rgb *= tint;
    }
  }`;

// Ortak mat malzeme (parsel zeminleri, yollar, çatılar, araçlar): düz renk yerine hafif yıpranma, örneklerde ton farkı.
const MATTE_FRAGMENT = `#include <color_fragment>
  {
    vec2 p = vWPos.xz;
    float up = smoothstep(0.6, 0.9, vWNrm.y);
    float fine = 1.0 - smoothstep(0.2, 0.8, length(fwidth(p * 0.03)));
    float n = fbm(p * 0.006) * 0.6 + fbm(p * 0.03 + 5.0) * 0.4 * fine;
    diffuseColor.rgb *= 1.0 + up * (n - 0.5) * 0.16;
    if (vKey >= 0.0) diffuseColor.rgb *= 0.9 + 0.18 * vKey;
  }`;

// Su: iki katmanlı, yavaş akan dalga normali ve değişken pürüzlülük, gökyüzünü ve güneşi kırık kırık yansıtır.
const WATER_FRAGMENT = `#include <normal_fragment_maps>
  {
    vec2 p = vWPos.xz;
    vec2 q1 = p * 0.045 + vec2(uTime * 0.05, uTime * 0.03);
    vec2 q2 = p * 0.11 - vec2(uTime * 0.04, -uTime * 0.06);
    const float e = 0.6;
    float dx = (vnoise(q1 + vec2(e, 0.0)) - vnoise(q1 - vec2(e, 0.0))) + 0.5 * (vnoise(q2 + vec2(e, 0.0)) - vnoise(q2 - vec2(e, 0.0)));
    float dz = (vnoise(q1 + vec2(0.0, e)) - vnoise(q1 - vec2(0.0, e))) + 0.5 * (vnoise(q2 + vec2(0.0, e)) - vnoise(q2 - vec2(0.0, e)));
    // Dalga ancak birkaç piksele yayılıyorsa çizilir. Uzakta (ve küçük havuzlarda) alt piksel parlamalar
    // kamera kaydıkça yanıp sönüyordu, orada yüzey düzgün kalır, pürüzlülük yansımayı yumuşatır.
    float fade = 1.0 - smoothstep(0.03, 0.1, length(fwidth(q2)));
    vec3 wn = normalize(vec3(-dx * 0.08 * fade, 1.0, -dz * 0.08 * fade));
    normal = normalize((viewMatrix * vec4(wn, 0.0)).xyz);
    roughnessFactor = mix(0.3, 0.14 + 0.1 * fbm(p * 0.004 + uTime * 0.01), fade);
  }`;

/** Malzemenin shader'ına ortak uniform'ları, dünya konumu varying'lerini ve verilen fragment bloğunu ekler. */
function patchMaterial(material: THREE.MeshStandardMaterial, fragmentInclude: string, fragmentBlock: string, cacheKey: string) {
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, cityUniforms);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>\n${VERT_DECL}`)
      .replace('#include <worldpos_vertex>', `#include <worldpos_vertex>\n${VERT_BODY}`);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>\n${FRAG_COMMON}`)
      .replace(fragmentInclude, fragmentBlock);
  };
  material.customProgramCacheKey = () => cacheKey;
  material.needsUpdate = true;
}

// Düz yüzeylerde (parsel zeminleri, pist kenarı çim şeritleri, dairesel tarlalar, yollar) farklı renkli yamalar aynı mesh
// içinde, tam aynı yükseklikte üst üste çizilmiş. Derinlik testi aralarında karar veremez, kamera kıpırdadıkça yamalar
// yanıp söner. Her yama rengine ve büyüklüğüne göre birkaç milimetre-santim kaldırılır: önce renk sınıfı (döşeme < asfalt
// < toprak < çim), aynı sınıfta küçük yama büyüğün üstünde. Gözle seçilmez, katman sırası kesinleşir. Yalnızca tamamen düz,
// birden çok renkli mesh'lere uygulanır, diğerleri üretimde zaten katmanlı. En büyük kaldırma 4.2 cm: yollar kaldırımın
// (+4.5 cm), zeminler havuz ve oyun alanlarının, pist kenarı pist kaplamasının altında kalır.
const GROUND_LAYER_STEP = 0.012; // metre

function groundLayer(r: number, g: number, b: number): number {
  if (r + g + b < 0.45) return 1; // asfalt
  if (g > r * 1.1 && g > b * 2) return 3; // çim
  if (b < g * 0.8) return 2; // toprak, kuru çim
  return 0; // döşeme
}

function layerGround(mesh: THREE.Mesh) {
  const geometry = mesh.geometry;
  const position = geometry.getAttribute('position');
  const color = geometry.getAttribute('color');
  if (!position || !color || mesh.userData.groundLayered) return;
  // StrictMode hazırlığı iki kez çalıştırır, kaldırma üst üste binmesin.
  mesh.userData.groundLayered = true;
  let minY = Infinity;
  let maxY = -Infinity;
  for (let i = 0; i < position.count; i++) {
    minY = Math.min(minY, position.getY(i));
    maxY = Math.max(maxY, position.getY(i));
  }
  if (maxY - minY > 1e-4) return;
  const colors = new Set<string>();
  for (let i = 0; i < color.count && colors.size < 2; i++) {
    colors.add(`${color.getX(i).toFixed(3)},${color.getY(i).toFixed(3)},${color.getZ(i).toFixed(3)}`);
  }
  if (colors.size < 2) return;

  // Üçgen alanları (yerel xz). Köşe, bağlı olduğu en küçük üçgenin büyüklük payını alır.
  const index = geometry.index;
  const triCount = (index ? index.count : position.count) / 3;
  const vertexAt = (t: number, k: number) => (index ? index.getX(t * 3 + k) : t * 3 + k);
  const areas = new Float32Array(triCount);
  let maxArea = 0;
  for (let t = 0; t < triCount; t++) {
    const a = vertexAt(t, 0);
    const b = vertexAt(t, 1);
    const c = vertexAt(t, 2);
    const ax = position.getX(a);
    const az = position.getZ(a);
    areas[t] = Math.abs((position.getX(b) - ax) * (position.getZ(c) - az) - (position.getX(c) - ax) * (position.getZ(b) - az));
    maxArea = Math.max(maxArea, areas[t]);
  }
  const sizeLift = new Float32Array(position.count);
  for (let t = 0; t < triCount; t++) {
    const lift = 1 - Math.sqrt(areas[t] / (maxArea || 1));
    for (let k = 0; k < 3; k++) {
      const vertex = vertexAt(t, k);
      sizeLift[vertex] = Math.max(sizeLift[vertex], lift);
    }
  }

  const scaleY = mesh.getWorldScale(new THREE.Vector3()).y || 1;
  const lifted = new Float32Array(position.count * 3);
  for (let i = 0; i < position.count; i++) {
    // Büyüklük payı yarım adımla sınırlı: renk sınıfları arasında en az 6 mm kalır (dairesel tarlaların ince dilimleri).
    const layer = groundLayer(color.getX(i), color.getY(i), color.getZ(i)) + sizeLift[i] * 0.5;
    lifted[i * 3] = position.getX(i);
    lifted[i * 3 + 1] = position.getY(i) + (layer * GROUND_LAYER_STEP) / scaleY;
    lifted[i * 3 + 2] = position.getZ(i);
  }
  geometry.setAttribute('position', new THREE.BufferAttribute(lifted, 3));
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
}

export interface PreparedCity {
  update: (dt: number, cameraDistance: number) => void;
}

interface CityUserData {
  castShadow?: boolean;
  lodMaxDistance?: number;
  lodMinDistance?: number;
  thinnable?: boolean;
  baseCount?: number;
}

/** Yüklenen GLB'yi hazırlar: gölge, mesafe ve yoğunluk ayarı, shader'lar ve teleferik animasyonu. */
export function prepareCity(
  cityRoot: THREE.Object3D,
  config: CityConfig,
  { quality, timeOfDay }: { quality: Quality; timeOfDay: number },
): PreparedCity {
  // Gündüz trafik ışığı noktaları gizlenir: alt piksel boyutunda, parlak oldukları için kamera kaydıkça pırıldıyorlar.
  const daylight = timeOfDay < 0.3;
  const lodObjects: THREE.Object3D[] = [];
  const patched = new Set<THREE.Material>();
  const thin = quality === 'low' ? 0.35 : quality === 'medium' ? 0.6 : 1;

  cityRoot.updateMatrixWorld(true);
  cityRoot.traverse((object) => {
    if (object instanceof THREE.Mesh) {
      const data = object.userData as CityUserData;
      // Yollar ayrı mesh'lerde zaten santimlerle katmanlı (asfalt < refüj/kaldırım < çizgi), kaldırma sırayı bozardı.
      if (!(object instanceof THREE.InstancedMesh) && !object.name.startsWith('Roads_')) layerGround(object);
      object.castShadow =
        quality === 'low'
          ? false
          : data.castShadow !== false && !(quality === 'medium' && /Trees|Forest|Shrubs|Vehicles/.test(object.name));
      // Gölge haritası durağan, hareket eden gondollar gölge düşürmez.
      if (object.name === config.cableCar.instancedMesh) object.castShadow = false;
      object.receiveShadow = quality !== 'low';
      if (daylight && /^Roads_TrafficGlow/.test(object.name)) object.visible = false;
      else if (data.lodMaxDistance || data.lodMinDistance) lodObjects.push(object);
      if (object instanceof THREE.InstancedMesh && data.thinnable) {
        // Kalite değişirse veya StrictMode çift çalıştırırsa seyreltme üst üste binmesin diye ilk sayı saklanır.
        data.baseCount ??= object.count;
        object.count = Math.floor(data.baseCount * thin);
      }
      object.matrixAutoUpdate = false;
      object.updateMatrix();
      const materials: THREE.Material[] = Array.isArray(object.material) ? object.material : [object.material];
      for (const material of materials) {
        if (patched.has(material) || !(material instanceof THREE.MeshStandardMaterial)) continue;
        patched.add(material);
        if (material.name === 'Facade_Model') {
          patchMaterial(material, '#include <emissivemap_fragment>', FACADE_FRAGMENT, 'facade_model_v4');
        }
        if (material.name === 'Terrain_Sand') {
          patchMaterial(material, '#include <color_fragment>', TERRAIN_FRAGMENT, 'terrain_contour_v3');
        }
        if (material.name === 'Mat_Matte') {
          patchMaterial(material, '#include <color_fragment>', MATTE_FRAGMENT, 'matte_v1');
        }
        if (material.name === 'Water') {
          // Su kendi mavisini taşır, sıcak gökyüzü yansıması baskın olmaz.
          material.color.set('#2f6f96');
          material.metalness = 0;
          material.envMapIntensity = 0.7;
          patchMaterial(material, '#include <normal_fragment_maps>', WATER_FRAGMENT, 'water_v1');
        }
      }
    }
    if (object instanceof THREE.Camera) object.visible = false;
  });

  const found = cityRoot.getObjectByName(config.cableCar.instancedMesh);
  const gondolas = found instanceof THREE.InstancedMesh ? found : null;
  const tracks = config.cableCar.tracks.map((track) => {
    const points = track.points.map((point) => new THREE.Vector3().fromArray(point));
    const lengths = [0];
    for (let i = 1; i < points.length; i++) lengths.push(lengths[i - 1] + points[i].distanceTo(points[i - 1]));
    return { points, lengths, total: lengths[lengths.length - 1], count: track.gondolas };
  });

  let phase = 0;
  const matrix = new THREE.Matrix4();
  const quaternion = new THREE.Quaternion();
  const position = new THREE.Vector3();
  const unit = new THREE.Vector3(1, 1, 1);
  const yAxis = new THREE.Vector3(0, 1, 0);

  function animateGondolas(dt: number) {
    if (!gondolas) return;
    phase += dt * (config.cableCar.speed ?? 6);
    let index = 0;
    for (const track of tracks) {
      for (let g = 0; g < track.count; g++) {
        const distance = (((g + 0.5) / track.count) * track.total + phase) % track.total;
        let i = 1;
        while (i < track.lengths.length - 1 && track.lengths[i] < distance) i++;
        const a = track.points[i - 1];
        const b = track.points[i];
        const t = (distance - track.lengths[i - 1]) / Math.max(1e-6, track.lengths[i] - track.lengths[i - 1]);
        position.lerpVectors(a, b, t);
        quaternion.setFromAxisAngle(yAxis, -Math.atan2(b.z - a.z, b.x - a.x));
        gondolas.setMatrixAt(index++, matrix.compose(position, quaternion, unit));
      }
    }
    gondolas.instanceMatrix.needsUpdate = true;
  }

  return {
    update(dt, cameraDistance) {
      cityUniforms.uTime.value += Math.min(dt, 0.1);
      for (const object of lodObjects) {
        const data = object.userData as CityUserData;
        object.visible =
          (!data.lodMaxDistance || cameraDistance < data.lodMaxDistance) &&
          (!data.lodMinDistance || cameraDistance > data.lodMinDistance);
      }
      animateGondolas(Math.min(dt, 0.1));
    },
  };
}

// ------------------------------------------------------------------ kamera

interface Pose {
  target: THREE.Vector3;
  dist: number;
  el: number;
  az: number;
  fov: number;
}

function poseFrom(position: Vec3, target: Vec3, fov: number): Pose {
  const p = new THREE.Vector3().fromArray(position);
  const t = new THREE.Vector3().fromArray(target);
  const d = p.clone().sub(t);
  const dist = d.length();
  return { target: t, dist, el: Math.asin(d.y / dist), az: Math.atan2(d.x, d.z), fov };
}

/** Ana sayfa kamerası: hero konumunda durur, çok yavaş süzülür ve fareyle hafifçe kayar. */
export class CameraDirector {
  private readonly camera: THREE.PerspectiveCamera;
  private readonly current: Pose;
  private readonly pointer = new THREE.Vector2();
  private readonly pointerSmooth = new THREE.Vector2();
  private readonly idleOrbit: boolean;
  private readonly parallax: boolean;
  private drift = 0;
  private aspect = POSTER_ASPECT;

  constructor(camera: THREE.PerspectiveCamera, config: CityConfig, options: { idleOrbit: boolean; parallax: boolean }) {
    const hero = poseFrom(config.hero.position, config.hero.target, config.hero.fov);
    hero.az += HERO_AZIMUTH_OFFSET;
    hero.dist *= HERO_DISTANCE_SCALE;
    this.camera = camera;
    this.current = hero;
    this.idleOrbit = options.idleOrbit;
    this.parallax = options.parallax;
    this.apply();
  }

  get distance() {
    return this.current.dist;
  }

  get target() {
    return this.current.target;
  }

  setAspect(aspect: number) {
    this.aspect = aspect;
    this.apply();
  }

  /** x ve y -1 ile 1 arasındadır. */
  setPointer(x: number, y: number) {
    this.pointer.set(x, y);
  }

  update(delta: number) {
    const dt = Math.min(delta, 0.1);
    this.pointerSmooth.lerp(this.pointer, 1 - Math.exp(-dt * 2.5));
    if (this.idleOrbit) this.drift = Math.min(this.drift + dt * 0.0045, 0.06);
    this.apply();
  }

  private apply() {
    const { current, camera } = this;
    const px = this.parallax ? this.pointerSmooth.x * 0.018 : 0;
    const py = this.parallax ? this.pointerSmooth.y * 0.01 : 0;
    const az = current.az + this.drift + px;
    const el = current.el + py;
    camera.position.set(
      current.target.x + current.dist * Math.cos(el) * Math.sin(az),
      current.target.y + current.dist * Math.sin(el),
      current.target.z + current.dist * Math.cos(el) * Math.cos(az),
    );
    camera.fov = coverFov(current.fov, this.aspect);
    // Parsel zeminleri birbirinden yalnızca 2-5 cm yukarıda. Yakın düzlem kamerada en yakın geometriye (~0.7 x mesafe)
    // olabildiğince yaklaştırılır, derinlik hassasiyeti artar, zeminler kamera kıpırdadıkça birbirine geçip titremez.
    camera.near = Math.max(1, current.dist * 0.35);
    camera.far = current.dist + 14000;
    camera.lookAt(current.target);
    camera.updateProjectionMatrix();
  }
}
