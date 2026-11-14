// Akıllı şehir GLB'sinin (v2, beyaz maket) çalışma zamanı: atmosfer, shader'lar ve kamera.
// Post-process (MSAA'lı HDR hedef + bloom) kaldırıldı: kare süresini ikiye katlayıp fare hareketinde kasma yapıyordu.
// Çizim doğrudan tuvale, tarayıcının kendi antialias'ıyla yapılır, vinyet CSS ile verilir.
import * as THREE from 'three';
import { arrangeCity } from './cityLayout';
import { MASS_VARIANTS, type MassVariant } from './cityMass';
import { type VertexPatch, createPeople } from './cityPeople';
import { AIRPORT_FRAGMENT, AIRPORT_GLSL, landscapeAirport } from './cityAirport';
import { CABLECAR_FRAGMENT, CABLECAR_GLSL, landscapeCableCar } from './cityCableCar';
import { CULTURAL_FRAGMENT, CULTURAL_GLSL, landscapeCulturalCenter } from './cityCulturalCenter';
import { GREENHOUSE_FRAGMENT, GREENHOUSE_GLSL, landscapeGreenhouse } from './cityGreenhouse';
import { HOSPITAL_FRAGMENT, HOSPITAL_GLSL, landscapeHospital } from './cityHospital';
import { TECHNOPARK_FRAGMENT, TECHNOPARK_GLSL, landscapeTechnopark } from './cityTechnopark';
import { HOUSING_FRAGMENT, HOUSING_GLSL, landscapeHousing } from './cityHousing';
import { chunkInstances, chunkThinCount } from './cityChunks';
import { KINDERGARTEN_FRAGMENT, KINDERGARTEN_GLSL, landscapeKindergarten } from './cityKindergarten';
import { MILITARY_FRAGMENT, MILITARY_GLSL, landscapeMilitaryCampus } from './cityMilitaryCampus';
import { PARK_FRAGMENT, PARK_GLSL, landscapePark } from './cityPark';
import { SCHOOL_FRAGMENT, SCHOOL_GLSL, landscapeSchool } from './citySchool';
import { SCIENCE_FRAGMENT, SCIENCE_GLSL, landscapeScienceCenter } from './cityScienceCenter';

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

// Hero kamerası paketteki açıdan 270° döndürülmüş, şehre yandan bakar (havalimanı sol üstte, deniz solda kalır).
const HERO_AZIMUTH_OFFSET = Math.PI * 1.5;
// Hero kamerasının hedefe uzaklığı, paketteki değere göre (1 = paketteki konum, ~3500 m). 0.58 ile ~2030 m.
// Uzun odakla birlikte: kamera uzakta, görüş açısı dar. Perspektif sıkışır (ön ve arka binalar yakın boyda, düşey
// kenarlar paralele yakın), maket hissi buradan gelir. Yaklaşmak yerine açıyı daraltmak kadrajdaki bina sayısını korur.
const HERO_DISTANCE_SCALE = 0.58;
// Dikey görüş açısı (derece, 16:9 için). Paketteki 30° geniş açılı, perspektifi abartıyordu.
const HERO_FOV = 22;
// Kameranın ufuktan yüksekliği (derece). Paketteki 34° harita gibi tepeden bakıyordu. 30° ile binaların cepheleri ve
// arkadaki sisli derinlik görünür, kadrajın üst kenarı ufkun ~7° altında kalır (gökyüzü kadraja girmez).
const HERO_ELEVATION = 30 * DEG;
// Dik ekranda yatay görüş daralır, kamera en-boy oranı düştükçe geri çekilir (0.46 oranında ~1.3 kat). Daha fazlası
// telefonda şehri küçültüp ön plana boş nehir şeridini sokuyordu.
const PORTRAIT_PULLBACK = 0.6;
// Hedefin kameranın sağına kayma payı, hero mesafesinin oranı olarak.
const HERO_SIDE_SHIFT = 0.14;

/** 16:9 poster görseliyle aynı kadrajı (object-fit: cover) her ekran oranında veren dikey görüş açısı. */
function coverFov(baseFov: number, aspect: number): number {
  if (aspect <= POSTER_ASPECT) return baseFov;
  const horizontal = 2 * Math.atan(Math.tan((baseFov * DEG) / 2) * POSTER_ASPECT);
  return (2 * Math.atan(Math.tan(horizontal / 2) / aspect)) / DEG;
}

// Yükseklik haritasının kapsadığı alan (dünya xz, metre): binaların ve yakın ağaçların tamamı.
const HEIGHT_RECT = { minX: -1700, minZ: -1500, sizeX: 3600, sizeZ: 2800 };
// Haritada 0 değeri bu yüksekliğe denk gelir (deniz tabanı kabulü), değerler buna göre saklanır.
const HEIGHT_BASE = -12;
const HEIGHT_MAX = 400;

// Prosedürel shader'ların ortak uniform'ları.
const cityUniforms = {
  uWin: { value: 1.0 }, // pencere ışığı şiddeti
  uWarm: { value: new THREE.Color('#ffb868') },
  uLitShare: { value: 0.22 }, // güçlü yanan binaların payı
  uNight: { value: 0 }, // 0 gün ışığı, 1 mavi saat: zemin kat ışıması yalnızca akşam görünür
  uTime: { value: 0 }, // su dalgaları ve bulut gölgeleri için saniye
  uAo: { value: 0 }, // yükseklik haritası hazır olunca 1
  uCloud: { value: 0.42 }, // bulut gölgesinin güneş ışığını kısma payı
  uGrade: { value: 0 }, // malzeme renklerinin doygunluğundan alınan pay (renk uyumu)
  uFogD: { value: 0.0002 }, // sis yoğunluğu (ışık noktaları kendi sislerini hesaplar)
  uDpr: { value: 1 }, // ışık noktalarının piksel ölçüsü için
  uHeightTex: { value: null as THREE.Texture | null },
  uHeightRect: { value: new THREE.Vector4(HEIGHT_RECT.minX, HEIGHT_RECT.minZ, 1 / HEIGHT_RECT.sizeX, 1 / HEIGHT_RECT.sizeZ) },
  uCloudTex: { value: null as THREE.Texture | null },
};

// Gün batımı (0) ile mavi saat (1) arasındaki ara değerler.
// Altın saat: alçak ve sıcak güneş, uzun gölgeler, gölge tarafları mavi gökyüzü ışığıyla dolar, sokak lambaları neredeyse sönük.
// Güneş rengi bilerek az doygun: koyu turuncu güneş bütün sahneyi tek bir bej tona boyuyordu, sıcak-soğuk ayrımı kayboluyordu.
// fogK: sis yoğunluğu x kameranın hedefe uzaklığı. Alacakaranlıkta sis ve pus bilerek yok (kullanıcı tercihi), `fog`
// rengi yalnızca arka plandır. Yoğunluk mesafeye bölünür, hedefteki pus her ekran oranında aynı
// kalır (dik ekranda kamera geri çekildiğinde sabit yoğunluk görüntüyü süt gibi griye gömüyordu).
// ground: ortam haritasının ufuk altı yarısı (gölge yüzlerin dolgusu). grade: malzeme renklerinin doygunluğundan alınan pay.
const TIME_OF_DAY = {
  golden: { sun: '#ffe1bd', sunI: 4.2, sunEl: 15, hemiSky: '#8fb4ea', hemiGround: '#8f8676', hemiI: 0.9, env: 0.7, fog: '#cfd6dd', fogK: 0.22, zenith: '#5f8fd0', horizon: '#e9dcc8', ground: '#b9ab92', windows: 0.5, exposure: 1.08, night: 0, cloud: 0.42, grade: 0 },
  // Alacakaranlık: güneş zayıf ve nötr, ışık neredeyse yönsüz. Hacmi yükseklik haritasından gelen ortam gölgesi verir.
  // Ortam serin, sıcak olan yalnızca yapay ışıklar (pencere, vitrin, sokak lambaları ve ışık havuzları). Renkler korunur,
  // doygunlukları aynı ışığın altında duracak kadar kısılır. Sıcak dolgu (ufuk ve zemin) bilerek nötr tutulur: önceki
  // sürümde güneş, ufuk, zemin ve tek ton katmanı birlikte bütün ekranı sarı-turuncuya çekiyordu.
  dusk: { sun: '#ffe2c8', sunI: 1.25, sunEl: 26, hemiSky: '#a9a8a6', hemiGround: '#46423e', hemiI: 0.85, env: 0.45, fog: '#64666d', fogK: 0, zenith: '#5a6886', horizon: '#a49e9a', ground: '#605d5a', windows: 2.6, exposure: 0.92, night: 0.8, cloud: 0, grade: 0.18 },
  blue: { sun: '#ff9a68', sunI: 0.5, sunEl: 2.5, hemiSky: '#506a9a', hemiGround: '#2a2c36', hemiI: 0.6, env: 0.4, fog: '#3e4a66', fogK: 0.16, zenith: '#1c2a4a', horizon: '#8086a6', ground: '#3a3c46', windows: 4.0, exposure: 1.1, night: 1, cloud: 0.1, grade: 0.18 },
} as const;

// Sahnenin başlangıç görünümü (timeOfDay 0). `golden` renkli gündüz, `dusk` alacakaranlık. timeOfDay 1 her ikisinde mavi saattir.
const BASE_LOOK = TIME_OF_DAY.dusk;

function skyTexture(
  renderer: THREE.WebGLRenderer,
  zenith: THREE.Color,
  horizon: THREE.Color,
  ground: THREE.Color,
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
      gnd: { value: ground },
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
  let fogK = 0;
  let lastEnvT = -1;
  const sunDir = new THREE.Vector3();
  const A = BASE_LOOK;
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
    fogK = lerp(A.fogK, B.fogK, t);
    // Gerçek yoğunluk her karede focusShadows içinde kamera mesafesine göre kurulur.
    fog.density = fogK / 2000;
    scene.background = fog.color.clone();
    scene.environmentIntensity = lerp(A.env, B.env, t);
    renderer.toneMappingExposure = lerp(A.exposure, B.exposure, t);
    cityUniforms.uWin.value = lerp(A.windows, B.windows, eased);
    cityUniforms.uLitShare.value = lerp(0.2, 0.42, t);
    cityUniforms.uNight.value = lerp(A.night, B.night, t);
    cityUniforms.uGrade.value = lerp(A.grade, B.grade, t);
    cityUniforms.uCloud.value = lerp(A.cloud, B.cloud, t);
    // Kalan ışık mesh'leri (havalimanı ışıkları, kule tepesi). Sokak lambaları ve yol ışıkları nokta olarak çizilir.
    const night = cityUniforms.uNight.value;
    for (const material of lampMaterials) {
      material.emissiveIntensity = (0.6 + 2.4 * night) * (material.name === 'Light_Red' ? 0.8 : 1);
    }
    if (Math.abs(t - lastEnvT) > 0.04 || !envTexture) {
      const previous = envTexture;
      envTexture = skyTexture(
        renderer,
        lerpColor(A.zenith, B.zenith, t),
        lerpColor(A.horizon, B.horizon, t),
        lerpColor(A.ground, B.ground, t),
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
    cityUniforms.uDpr.value = renderer.getPixelRatio();
    fog.density = fogK / distance;
    cityUniforms.uFogD.value = fog.density;
    // Alçak kamerada kadraj hedefin çok ötesine uzanır, gölge alanı buna göre geniş tutulur.
    const half = THREE.MathUtils.clamp(distance * 0.95, 260, 2600);
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

// ------------------------------------------------------------------ yükseklik haritası (ortam gölgesi) ve bulut dokusu

const QUAD_VERTEX = 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }';

// Yükseklik haritasına girmeyenler: çalışma anında eklenenler (ışık perdesi), su, ışıklar, cam, kablolar, hareket edenler ve mesafeyle gizlenen ince nesneler.
const HEIGHT_SKIP_NAME =
  /^(Runtime_|Vehicles_|Traffic_|Roads_TrafficGlow|Infrastructure_|Energy_(WindTurbines|Pylons|PowerLines|Busbars)|CableCar_(Gondolas|Cables)|Bridge_StayCables|Military_UtilityTrucks|Greens_Shrubs)/;
const HEIGHT_SKIP_MATERIAL = /^(Water|Light_|Glass_|Cable_)/;

// Sokak lambasının zemine düşürdüğü ışık havuzunun yarıçapı (metre).
const LAMP_POOL_RADIUS = 17;

interface LightPointData {
  positions: Float32Array;
  pools: Float32Array; // nokta başına zemin ışığı payı
}

/**
 * Lamba ve yol ışığı konumlarını yükseklik haritasının mavi kanalına yumuşak lekeler olarak toplar. Shader'lar zemine
 * yakın yüzeylerde bunu sıcak ışık olarak ekler: sokaklar boyunca ışık havuzları. Açılışta bir kez çizilir.
 */
function drawLightPools(
  renderer: THREE.WebGLRenderer,
  target: THREE.WebGLRenderTarget,
  cityRoot: THREE.Object3D,
  camera: THREE.Camera,
  width: number,
) {
  const data = cityRoot.userData.lightPoints as LightPointData | undefined;
  if (!data) return;
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(data.positions, 3));
  geometry.setAttribute('aPool', new THREE.BufferAttribute(data.pools, 1));
  const material = new THREE.ShaderMaterial({
    blending: THREE.AdditiveBlending,
    transparent: true,
    depthTest: false,
    depthWrite: false,
    uniforms: {
      uRect: { value: cityUniforms.uHeightRect.value },
      uPx: { value: (LAMP_POOL_RADIUS * 2 * width) / HEIGHT_RECT.sizeX },
    },
    vertexShader: `uniform vec4 uRect; uniform float uPx; attribute float aPool; varying float vPool;
      void main(){
        vec2 uv = (position.xz - uRect.xy) * uRect.zw;
        vPool = aPool;
        gl_Position = vec4(uv * 2.0 - 1.0, 0.0, 1.0);
        gl_PointSize = uPx;
      }`,
    fragmentShader: `varying float vPool;
      void main(){
        vec2 c = gl_PointCoord * 2.0 - 1.0;
        float r2 = dot(c, c);
        gl_FragColor = vec4(0.0, 0.0, vPool * exp(-r2 * 3.0) * step(r2, 1.0), 1.0);
      }`,
  });
  const points = new THREE.Points(geometry, material);
  points.frustumCulled = false;
  const scene = new THREE.Scene();
  scene.add(points);
  const autoClear = renderer.autoClear;
  renderer.autoClear = false;
  renderer.setRenderTarget(target);
  renderer.render(scene, camera);
  renderer.autoClear = autoClear;
  geometry.dispose();
  material.dispose();
}

export interface HeightField {
  dispose: () => void;
}

/**
 * Şehri bir kez tepeden çizip yükseklik haritası çıkarır, iki farklı genişlikte bulanıklaştırır.
 * Shader'lar bir noktanın çevresindeki ortalama yüksekliği buradan okur: çevresi kendinden yüksekse orası gökyüzünü
 * az görür ve kararır. Binaların dibi, sokak araları ve ağaç altları yumuşak bir gölge alır, binalar zemine oturur.
 * Ekran uzayı AO'nun (GTAO) kare başı maliyeti ve gürültüsü yoktur: maliyet kare başına tek doku okumasıdır.
 * Işıklar kurulmadan önce çağrılır.
 */
export function bakeHeightField(
  renderer: THREE.WebGLRenderer,
  scene: THREE.Scene,
  cityRoot: THREE.Object3D,
  quality: Quality,
): HeightField {
  const width = quality === 'high' ? 2048 : 1024;
  const height = Math.round((width * HEIGHT_RECT.sizeZ) / HEIGHT_RECT.sizeX);
  const createTarget = (depthBuffer: boolean) =>
    new THREE.WebGLRenderTarget(width, height, {
      type: THREE.HalfFloatType,
      format: THREE.RGBAFormat,
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
      generateMipmaps: false,
      depthBuffer,
    });
  const raw = createTarget(true);
  const tempA = createTarget(false);
  const tempB = createTarget(false);
  const narrow = createTarget(false);
  const result = createTarget(false);

  // Kamera matrisi kullanılmaz: dünya xz doğrudan doku koordinatına, yükseklik derinliğe yazılır (yüksek olan kazanır).
  const heightMaterial = new THREE.ShaderMaterial({
    side: THREE.DoubleSide,
    uniforms: {
      uRect: { value: cityUniforms.uHeightRect.value },
      uRange: { value: new THREE.Vector2(HEIGHT_BASE, HEIGHT_MAX) },
    },
    vertexShader: `uniform vec4 uRect; uniform vec2 uRange; varying float vH;
      void main(){
        vec4 p = vec4(position, 1.0);
        #ifdef USE_INSTANCING
          p = instanceMatrix * p;
        #endif
        vec4 w = modelMatrix * p;
        vH = max(w.y - uRange.x, 0.0);
        vec2 uv = (w.xz - uRect.xy) * uRect.zw;
        gl_Position = vec4(uv * 2.0 - 1.0, 1.0 - 2.0 * clamp(vH / (uRange.y - uRange.x), 0.0, 1.0), 1.0);
      }`,
    fragmentShader: 'varying float vH; void main(){ gl_FragColor = vec4(vH, vH, vH, 1.0); }',
  });
  const blurMaterial = new THREE.ShaderMaterial({
    depthTest: false,
    depthWrite: false,
    uniforms: { tSrc: { value: null as THREE.Texture | null }, uStep: { value: new THREE.Vector2() } },
    vertexShader: QUAD_VERTEX,
    fragmentShader: `varying vec2 vUv; uniform sampler2D tSrc; uniform vec2 uStep;
      void main(){
        vec4 c = texture2D(tSrc, vUv) * 0.2270270270;
        c += (texture2D(tSrc, vUv + uStep * 1.3846153846) + texture2D(tSrc, vUv - uStep * 1.3846153846)) * 0.3162162162;
        c += (texture2D(tSrc, vUv + uStep * 3.2307692308) + texture2D(tSrc, vUv - uStep * 3.2307692308)) * 0.0702702703;
        gl_FragColor = c;
      }`,
  });
  const combineMaterial = new THREE.ShaderMaterial({
    depthTest: false,
    depthWrite: false,
    uniforms: { tNarrow: { value: narrow.texture }, tWide: { value: raw.texture } },
    vertexShader: QUAD_VERTEX,
    fragmentShader: `varying vec2 vUv; uniform sampler2D tNarrow; uniform sampler2D tWide;
      void main(){ gl_FragColor = vec4(texture2D(tNarrow, vUv).r, texture2D(tWide, vUv).r, 0.0, 1.0); }`,
  });

  // Görüş alanı her şeyi kapsar, hiçbir nesne kırpılmaz.
  const camera = new THREE.OrthographicCamera(-1e5, 1e5, 1e5, -1e5, -1e5, 1e5);
  const quadGeometry = new THREE.PlaneGeometry(2, 2);
  const quad = new THREE.Mesh(quadGeometry, blurMaterial);
  quad.frustumCulled = false;
  const quadScene = new THREE.Scene();
  quadScene.add(quad);

  const hidden: THREE.Object3D[] = [];
  const shown: THREE.Object3D[] = [];
  cityRoot.traverse((object) => {
    // Işık noktaları yükseklik sayılmaz.
    if (object instanceof THREE.Points && object.visible) {
      object.visible = false;
      hidden.push(object);
      return;
    }
    if (!(object instanceof THREE.Mesh)) return;
    const material: THREE.Material = Array.isArray(object.material) ? object.material[0] : object.material;
    const skip = HEIGHT_SKIP_NAME.test(object.name) || HEIGHT_SKIP_MATERIAL.test(material.name);
    if (skip && object.visible) {
      object.visible = false;
      hidden.push(object);
    } else if (!skip && !object.visible) {
      object.visible = true;
      shown.push(object);
    }
  });

  const previous = {
    target: renderer.getRenderTarget(),
    clearColor: renderer.getClearColor(new THREE.Color()),
    clearAlpha: renderer.getClearAlpha(),
    autoClear: renderer.autoClear,
    shadowAutoUpdate: renderer.shadowMap.autoUpdate,
    shadowNeedsUpdate: renderer.shadowMap.needsUpdate,
    overrideMaterial: scene.overrideMaterial,
    background: scene.background,
  };
  renderer.shadowMap.autoUpdate = false;
  renderer.shadowMap.needsUpdate = false;
  renderer.autoClear = true;
  renderer.setClearColor(0x000000, 1);
  scene.overrideMaterial = heightMaterial;
  scene.background = null;
  renderer.setRenderTarget(raw);
  renderer.render(scene, camera);
  scene.overrideMaterial = previous.overrideMaterial;
  scene.background = previous.background;
  for (const object of hidden) object.visible = true;
  for (const object of shown) object.visible = false;

  // Ayrılabilir Gauss: adım metre cinsinden, standart sapma adımın yaklaşık iki katı.
  const blur = (source: THREE.WebGLRenderTarget, target: THREE.WebGLRenderTarget, stepMeters: number) => {
    quad.material = blurMaterial;
    blurMaterial.uniforms.tSrc.value = source.texture;
    blurMaterial.uniforms.uStep.value.set(stepMeters / HEIGHT_RECT.sizeX, 0);
    renderer.setRenderTarget(tempA);
    renderer.render(quadScene, camera);
    blurMaterial.uniforms.tSrc.value = tempA.texture;
    blurMaterial.uniforms.uStep.value.set(0, stepMeters / HEIGHT_RECT.sizeZ);
    renderer.setRenderTarget(target);
    renderer.render(quadScene, camera);
  };
  blur(raw, narrow, 2.6); // ~5 m: bina dibi, ağaç altı
  blur(narrow, tempB, 4.5);
  blur(tempB, raw, 8); // toplam ~19 m: sokak araları, yoğun dokunun genel kararması
  quad.material = combineMaterial;
  renderer.setRenderTarget(result);
  renderer.render(quadScene, camera);
  drawLightPools(renderer, result, cityRoot, camera, width);

  renderer.setRenderTarget(previous.target);
  renderer.setClearColor(previous.clearColor, previous.clearAlpha);
  renderer.autoClear = previous.autoClear;
  renderer.shadowMap.autoUpdate = previous.shadowAutoUpdate;
  renderer.shadowMap.needsUpdate = previous.shadowNeedsUpdate;

  for (const target of [raw, tempA, tempB, narrow]) target.dispose();
  heightMaterial.dispose();
  blurMaterial.dispose();
  combineMaterial.dispose();
  quadGeometry.dispose();

  cityUniforms.uHeightTex.value = result.texture;
  cityUniforms.uAo.value = 1;

  return {
    dispose() {
      if (cityUniforms.uHeightTex.value === result.texture) {
        cityUniforms.uHeightTex.value = null;
        cityUniforms.uAo.value = 0;
      }
      result.dispose();
    },
  };
}

/** Bulut gölgeleri için döşenebilir gürültü dokusu (işlemcide bir kez üretilir, shader'da tek okuma). */
function cloudTexture(): THREE.Texture {
  const size = 256;
  let seed = 20261112;
  const random = () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const values = new Float32Array(size * size);
  let amplitude = 0.5;
  for (const period of [4, 8, 16, 32]) {
    const lattice = new Float32Array(period * period);
    for (let i = 0; i < lattice.length; i++) lattice[i] = random();
    const at = (x: number, y: number) => lattice[(y % period) * period + (x % period)];
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const fx = (x / size) * period;
        const fy = (y / size) * period;
        const ix = Math.floor(fx);
        const iy = Math.floor(fy);
        const tx = fx - ix;
        const ty = fy - iy;
        const sx = tx * tx * (3 - 2 * tx);
        const sy = ty * ty * (3 - 2 * ty);
        const top = lerp(at(ix, iy), at(ix + 1, iy), sx);
        const bottom = lerp(at(ix, iy + 1), at(ix + 1, iy + 1), sx);
        values[y * size + x] += lerp(top, bottom, sy) * amplitude;
      }
    }
    amplitude *= 0.5;
  }
  const data = new Uint8Array(size * size);
  // Genlik toplamı 0.9375, 0-1 aralığına yayılır.
  for (let i = 0; i < data.length; i++) data[i] = Math.round(clamp01(values[i] / 0.9375) * 255);
  const texture = new THREE.DataTexture(data, size, size, THREE.RedFormat, THREE.UnsignedByteType);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.magFilter = THREE.LinearFilter;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.generateMipmaps = true;
  texture.needsUpdate = true;
  return texture;
}

// ------------------------------------------------------------------ prosedürel shader'lar

const VERT_DECL = `varying vec3 vWPos; varying vec3 vWNrm; varying float vKey; varying vec3 vLocal; varying vec3 vHalf; varying float vKind;
#ifdef CITY_FACE
  attribute vec4 aFace; attribute float aKind;
#endif
`;
// vHalf: örneğin yarı ölçüleri (metre). Binalarda (CITY_FACE) xz bileşenleri köşenin ait olduğu çatı yüzünün yarı ölçüleridir,
// vLocal o yüzün merkezine göre metre cinsinden konumdur (parapet ve ekipman için). vKind: 1 kiremitli eğimli çatı yüzü.
const VERT_BODY = `
  vec4 cwp = vec4(transformed, 1.0);
  #ifdef USE_INSTANCING
    cwp = instanceMatrix * cwp;
    vKey = fract(sin(dot(instanceMatrix[3].xz, vec2(12.9898, 78.233))) * 43758.5453);
    vHalf = vec3(length(instanceMatrix[0].xyz), length(instanceMatrix[1].xyz), length(instanceMatrix[2].xyz));
    // Ölçek eksenlere göre farklı olduğundan normal ters ölçekle düzeltilir (eğimli çatı yüzleri için).
    vWNrm = normalize(mat3(modelMatrix) * (mat3(instanceMatrix) * (objectNormal / (vHalf * vHalf))));
    vLocal = position * vHalf;
    vKind = 0.0;
    #ifdef CITY_FACE
      vLocal.xz = (position.xz - aFace.xy) * vHalf.xz;
      vHalf.xz *= aFace.zw;
      vKind = aKind;
    #endif
  #else
    vKey = -1.0; vWNrm = normalize(mat3(modelMatrix) * objectNormal);
    vHalf = vec3(0.0); vLocal = vec3(0.0); vKind = 0.0;
  #endif
  vWPos = (modelMatrix * cwp).xyz;
`;
const FRAG_COMMON = `
varying vec3 vWPos; varying vec3 vWNrm; varying float vKey; varying vec3 vLocal; varying vec3 vHalf; varying float vKind;
uniform float uWin; uniform vec3 uWarm; uniform float uLitShare; uniform float uNight; uniform float uTime;
uniform float uAo; uniform float uCloud; uniform float uGrade; uniform sampler2D uHeightTex; uniform vec4 uHeightRect; uniform sampler2D uCloudTex;
float h12(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float vnoise(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f);
  return mix(mix(h12(i), h12(i+vec2(1,0)), f.x), mix(h12(i+vec2(0,1)), h12(i+vec2(1,1)), f.x), f.y); }
float fbm(vec2 p){ float s = 0.0, a = 0.5; for (int i = 0; i < 4; i++){ s += a * vnoise(p); p *= 2.03; a *= 0.5; } return s; }
// x: yakın çevrenin, y: geniş çevrenin ortalama yüksekliği (metre). z: sokak lambalarının zemine düşürdüğü ışık.
// w: nokta haritanın içindeyse 1, kenarda 0'a iner.
vec4 cityHeights(vec2 p){
  vec2 uv = (p - uHeightRect.xy) * uHeightRect.zw;
  vec2 e = min(uv, 1.0 - uv);
  float inside = smoothstep(0.0, 0.05, min(e.x, e.y));
  vec3 t = texture2D(uHeightTex, uv).rgb;
  return vec4(t.rg + ${HEIGHT_BASE.toFixed(1)}, t.b, inside);
}
`;

// Bütün malzemelerde ortak ışık düzeltmesi: yükseklik haritasından ortam gölgesi ve yavaşça kayan bulut gölgeleri.
// Ortam gölgesi gökyüzü ışığını keser, güneşi yalnızca hafifçe. Bulut yalnızca güneşi keser, gökyüzü ışığı kalır.
// Işık yumuşak ve neredeyse yönsüz olduğundan hacmi bu ortam gölgesi taşır: güneş de büyük ölçüde kısılır.
const LIGHT_FRAGMENT = `#include <aomap_fragment>
  {
    vec4 ch = cityHeights(vWPos.xz);
    float d1 = max(ch.x - vWPos.y - 0.35, 0.0);
    float d2 = max(ch.y - vWPos.y - 0.35, 0.0);
    float cao = 1.0 - (0.62 * (1.0 - exp(-d1 / 9.0)) + 0.38 * (1.0 - exp(-d2 / 26.0))) * ch.w * uAo;
    vec2 cuv = vWPos.xz / 2600.0 + uTime * vec2(0.0035, 0.0012);
    float cl = texture2D(uCloudTex, cuv).r * 0.65 + texture2D(uCloudTex, cuv * 2.3 + 0.37).r * 0.35;
    float csun = 1.0 - uCloud * smoothstep(0.52, 0.74, cl);
    reflectedLight.indirectDiffuse *= cao;
    reflectedLight.indirectSpecular *= cao;
    reflectedLight.directDiffuse *= mix(1.0, cao, 0.55) * csun;
    reflectedLight.directSpecular *= csun;
    // Akşam: bina diplerindeki zemin vitrin ışığından, sokaklar lambalardan sıcak bir ışık havuzu alır. Lamba ışığı
    // açılışta yükseklik haritasının mavi kanalına bir kez çizilir (ek doku okuması yok), zemine yakın yüzeyleri aydınlatır.
    float spill = (1.0 - exp(-d1 / 7.0)) * ch.w * uAo * uNight;
    // Lamba ışığı yalnızca zemine değil alt cephelere de vurur: düşey yüzler daha çok alır (kaldırım kenarları şeritlenmez).
    float facing = 1.0 - abs(vWNrm.y);
    float pool = ch.z * ch.w * uAo * uNight * (1.0 - smoothstep(1.0, mix(10.0, 18.0, facing), vWPos.y));
    reflectedLight.indirectDiffuse += material.diffuseColor * uWarm * (spill * 0.15 + pool * mix(0.6, 1.5, facing));
  }`;

// Renk uyumu: malzeme renkleri hesaplandıktan sonra, ışıklandırmadan hemen önce doygunluk biraz kısılır ve çok açık
// yüzeyler hafifçe bastırılır. Renkler kalır, aynı alacakaranlık ışığının altında duruyormuş gibi tek bir aileye oturur.
// (Önceki tek ton katmanı renkleri sıcak gri bir maket tonuna çekiyordu, kaldırıldı.)
const GRADE_FRAGMENT = `
  {
    float gy = dot(diffuseColor.rgb, vec3(0.3, 0.59, 0.11));
    diffuseColor.rgb = mix(diffuseColor.rgb, vec3(gy), uGrade);
    diffuseColor.rgb *= mix(1.0, 1.0 - 0.25 * smoothstep(0.5, 0.85, gy), uGrade / 0.18);
  }
  #include <lights_physical_fragment>`;

// Cephe: bina başına malzeme tonu ve cam oranı, camlar koyu ve parlak, yanan pencereler seyrek.
// Uzaktan pencere ızgarası seçilemez, cephe ızgaranın ortalama rengini alır (eskiden tüm duvar ışık kutusu gibi parlıyordu).
// Örnekli binaların kütlesi diversifyBuildings ile çeşitlenir. Eğimli çatı yüzleri kiremit, düz üst yüzler parapetli düz
// çatıdır (çakıl, bitüm, membran, yeşil) ve büyük olanlarda çatı üstü ekipman taşır.
const FACADE_FRAGMENT = `#include <emissivemap_fragment>
  {
    // Dik eğimli çatı yüzleri duvar sayılmaz (pencere ve cam almaz).
    float wall = (1.0 - smoothstep(0.35, 0.6, abs(vWNrm.y))) * (1.0 - step(0.5, vKind));
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
    bool inst = vKey >= 0.0;
    float bkey = inst ? vKey : h12(floor(vWPos.xz / 34.0) + 3.1);

    // Malzeme rengi. Alçak binalar (konut) pastel sıvalı: kırık beyaz, krem, kiremit pembesi, adaçayı, gri mavi, aşı sarısı.
    // Yüksek binalar taş ve beton tonlarında, bir bölümü tamamen cam giydirme kule. Adı olan (örneksiz) yapılar modeldeki
    // kendi rengini korur, mavimsi olanlar cam sayılır.
    float tk = h12(vec2(bkey * 53.1, 7.3));
    // Tesis yapıları (cityKindergarten.ts) duvar ve çatı rengini kendisi seçer: bütün kanatlar aynı binanın parçası gibi
    // okunur. x: duvar paleti, y: çatı paleti (aşağıdaki eşiklerle aynı ölçek).
    #ifdef CITY_PALETTE
      tk = CITY_PALETTE.x;
    #endif
    float tall = inst ? smoothstep(18.0, 30.0, vHalf.y * 2.0) : 0.0;
    vec3 low = tk < 0.3 ? vec3(0.8, 0.77, 0.71) : tk < 0.48 ? vec3(0.82, 0.7, 0.5) : tk < 0.62 ? vec3(0.76, 0.5, 0.4)
      : tk < 0.75 ? vec3(0.58, 0.68, 0.54) : tk < 0.88 ? vec3(0.56, 0.66, 0.78) : vec3(0.8, 0.6, 0.32);
    vec3 high = tk < 0.4 ? vec3(0.8, 0.78, 0.74) : tk < 0.7 ? vec3(0.68, 0.71, 0.75) : vec3(0.78, 0.69, 0.58);
    float glassTower = inst
      ? step(0.5, tall) * step(h12(vec2(bkey * 37.7, 5.5)), 0.5)
      : step(diffuseColor.r * 1.08, diffuseColor.b);
    vec3 wallColor = diffuseColor.rgb * (inst ? mix(low, high, tall) : vec3(0.85));
    diffuseColor.rgb = wallColor;

    // Pencereli cephe: bina başına farklı cam oranı, uzakta ızgaranın ortalaması.
    float glassShare = mix(0.25, 0.75, h12(vec2(bkey * 13.7, 1.9)));
    // Pencere tek tek seçilemeyecek kadar uzaksa kat hizasında şerit pencere, o da seçilemiyorsa ortalama ton.
    float ribbon = 1.0 - smoothstep(0.22, 0.45, fwidth(cell.y));
    float glass = mix(mix(0.3, wy * 0.6, ribbon), win, detail) * wall * above * glassShare * (1.0 - glassTower);
    diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.08, 0.14, 0.24), glass);
    roughnessFactor = mix(roughnessFactor, 0.14, glass);

    // Cam kule: mavi-turkuaz cam, kat hizalarında açık renkli şeritler (birkaç piksele yayılıyorsa çizilir).
    float gk = h12(vec2(bkey * 9.1, 3.3));
    vec3 glassColor = mix(vec3(0.1, 0.26, 0.46), vec3(0.1, 0.36, 0.42), gk) * (0.8 + 0.5 * h12(vec2(bkey * 3.7, 9.9)));
    float bandAa = max(fwidth(cell.y), 1e-4);
    float band = 1.0 - smoothstep(0.2 - bandAa, 0.2 + bandAa, f.y);
    band = mix(0.2, band, 1.0 - smoothstep(0.25, 0.5, bandAa));
    vec3 curtain = mix(glassColor, vec3(0.5, 0.56, 0.6), band * 0.7) * mix(0.75, 1.0, smoothstep(0.0, 1.0, diffuseColor.g));
    float gt = glassTower * wall;
    diffuseColor.rgb = mix(diffuseColor.rgb, curtain, gt);
    roughnessFactor = mix(roughnessFactor, 0.12, gt * (1.0 - band * 0.6));

    // Zemine yakın duvarlarda hafif kirlenme (asıl temas gölgesi yükseklik haritasından gelir).
    diffuseColor.rgb *= mix(1.0, mix(0.86, 1.0, smoothstep(0.8, 10.0, vWPos.y)), wall);

    // ---- çatı (türevler dallanmanın dışında hesaplanır)
    vec2 e2 = vHalf.xz - abs(vLocal.xz);
    float edge = min(e2.x, e2.y);
    float px = max(max(fwidth(vLocal.x), fwidth(vLocal.z)), 1e-3);
    float span = min(vHalf.x, vHalf.z);
    vec2 rcell = vLocal.xz / 6.5 + bkey * 17.0;
    vec2 rf = fract(rcell), ri = floor(rcell);
    float ra = max(max(fwidth(rcell.x), fwidth(rcell.y)), 1e-4);
    float mottling = vnoise(vWPos.xz * 0.11);
    float rk2 = h12(vec2(bkey * 19.9, 8.1));
    #ifdef CITY_PALETTE
      rk2 = CITY_PALETTE.y;
    #endif
    if (inst && vKind > 0.5) {
      // Eğimli çatı yüzü (gerçek geometri): kiremit veya arduvaz.
      vec3 rc = rk2 < 0.5 ? vec3(0.52, 0.19, 0.1) : rk2 < 0.86 ? vec3(0.42, 0.19, 0.12) : vec3(0.22, 0.24, 0.28);
      diffuseColor.rgb = rc * (0.86 + 0.2 * h12(vec2(bkey * 5.3, 0.7)) + 0.12 * mottling);
    } else if (inst && vWNrm.y > 0.9) {
      // Düz çatı: çakıl, bitüm, açık membran veya yeşil çatı.
      vec3 rc = rk2 < 0.35 ? vec3(0.5, 0.49, 0.47) : rk2 < 0.6 ? vec3(0.24, 0.25, 0.28) : rk2 < 0.8 ? vec3(0.7, 0.71, 0.72) : vec3(0.2, 0.36, 0.13);
      rc *= 0.88 + 0.24 * mottling;
      // Çatı üstü ekipman: yalnızca büyük çatılarda, kenardan içeride, birkaç piksele yayılıyorsa.
      float ebox = smoothstep(0.2 - ra, 0.2 + ra, rf.x) * (1.0 - smoothstep(0.8 - ra, 0.8 + ra, rf.x))
        * smoothstep(0.25 - ra, 0.25 + ra, rf.y) * (1.0 - smoothstep(0.75 - ra, 0.75 + ra, rf.y));
      float eq = ebox * step(0.7, h12(ri + bkey * 31.0)) * smoothstep(2.0, 3.5, edge) * (1.0 - smoothstep(0.3, 0.5, ra)) * step(7.0, span);
      rc = mix(rc, mix(vec3(0.17), vec3(0.6), step(0.6, h12(ri * 3.1 + bkey))), eq * 0.9);
      // Parapet: en az bir piksel genişliğinde, duvar renginde ince kenar.
      float pw = max(0.7, px);
      float rim = (1.0 - smoothstep(pw - 0.5 * px, pw + 0.5 * px, edge)) * clamp(0.9 / px, 0.4, 1.0);
      diffuseColor.rgb = mix(rc, wallColor * 1.05, rim);
    }

    // Yapay ışık. Uzaktan tek tek pencere seçilemediği için cephenin tamamına ortalama bir ışıma vermek bütün ekranı
    // turuncu bir örtüyle boyuyordu. Bunun yerine ışık kaynakları ayrık tutulur:
    // 1) Yanan pencere grupları: iki pencere genişliğinde, bir kat yüksekliğinde hücrelerin bir bölümü yanar. Hücre bu
    //    mesafede birkaç piksel olduğundan seçilir, ancak bir pikselin altına inerse söner (titreme olmaz).
    float bright = step(1.0 - uLitShare, bkey);
    float share = mix(0.1, 0.45, bright) * uNight;
    vec2 lcell = vec2(u / 6.2, (vWPos.y - 0.8) / 3.45);
    vec2 lf = fract(lcell), lid = floor(lcell);
    vec2 la = max(fwidth(lcell) * 0.8, vec2(1e-4));
    float lrect = smoothstep(0.06 - la.x, 0.06 + la.x, lf.x) * (1.0 - smoothstep(0.94 - la.x, 0.94 + la.x, lf.x))
      * smoothstep(0.3 - la.y, 0.3 + la.y, lf.y) * (1.0 - smoothstep(0.82 - la.y, 0.82 + la.y, lf.y));
    float lvis = 1.0 - smoothstep(0.45, 0.9, max(la.x, la.y));
    // Karar hücre başına değil, katın üç hücrelik bölümü başına verilir: yanan pencereler kat boyunca kümelenir,
    // puantiye desen gibi okunmaz. Parlaklık bölüm başına değişir.
    // Yaşayan şehir: her bölümün kendi saati vardır (25-90 sn, rastgele başlangıç). Süre dolunca yanıp yanmayacağına
    // yeniden karar verilir, 0.3 sn'de solarak geçer. Saatler bağımsız olduğundan şehrin bir yerinde birkaç saniyede bir
    // ışık yanar veya söner, toplam yanan pay sabit kalır. Hareket azaltma açıkken uTime durur, ışıklar sabit kalır.
    vec2 lseg = vec2(floor(lid.x / 3.0), lid.y);
    float lper = mix(25.0, 90.0, h12(lseg * 3.1 + bkey * 7.3));
    float ltt = uTime / lper + h12(lseg * 5.7 + bkey * 13.1);
    float lep = floor(ltt);
    float lkey = h12(lseg + bkey * 91.7 + lep * 17.13);
    float lprev = h12(lseg + bkey * 91.7 + (lep - 1.0) * 17.13);
    float lon = mix(step(lprev, share), step(lkey, share), smoothstep(0.0, 0.3 / lper, fract(ltt)));
    float lit = lon * (0.4 + 0.6 * h12(lseg * 1.7 + 4.0));
    float windowsLit = lrect * lit * lvis * step(4.6, vWPos.y) * wall;
    // 2) Vitrin: zemin katta parlak bir şerit (sokak seviyesinin canlılığı).
    float shop = (1.0 - smoothstep(3.6, 4.4, vWPos.y)) * step(0.6, vWPos.y) * wall * bright * uNight;
    // 3) Cephe aydınlatması: binaların bir bölümünün cephesi dipten yukarı sönen sıcak ışıkla yıkanır (ışık havuzu).
    float wash = step(h12(vec2(bkey * 7.7, 2.2)), 0.2) * exp(-max(vWPos.y - 1.0, 0.0) / 9.0) * wall * uNight;
    // Pencere ışığı ton eşlemede beyaza doymasın diye orta şiddette: kehribar okunur, bloom'u yalnızca en parlakları alır.
    totalEmissiveRadiance += uWarm * uWin * (windowsLit * 1.1 + shop * 0.7);
    totalEmissiveRadiance += wallColor * uWarm * wash * 0.75;
  }`;

// Arazi ve ağaçlar aynı malzemeyi paylaşır. Ağaçlar örnek başına ton alır. Arazi kum rengi tek düze değildir:
// toprak lekeleri, kuru ot ve yeşil örtü yamaları, çalı benekleri. Plaj (açık renk) kum kalır.
const TERRAIN_FRAGMENT = `#include <color_fragment>
  {
    vec2 p = vWPos.xz;
    if (vKey >= 0.0) {
      // Koyu zeytin yeşili: ağaçlar alacakaranlıkta parlak yeşil leke değil, dokuyu taşıyan koyu kütlelerdir.
      diffuseColor.rgb *= mix(vec3(0.62, 0.86, 0.5), vec3(0.82, 0.9, 0.48), vKey);
    } else {
      float sandy = smoothstep(0.66, 0.74, diffuseColor.r);
      float n1 = fbm(p * 0.00045);
      float n2 = fbm(p * 0.0022 + 17.0);
      vec3 tint = mix(vec3(0.86, 0.82, 0.76), vec3(1.07, 1.03, 0.96), smoothstep(0.3, 0.7, n1));
      tint *= 0.92 + 0.14 * n2;
      vec3 c = diffuseColor.rgb * tint;
      float veg = smoothstep(0.3, 0.55, fbm(p * 0.0016 + 41.0)) * (1.0 - sandy);
      c = mix(c, vec3(0.2, 0.32, 0.1) * (0.85 + 0.3 * n2), 0.25 + veg * 0.55);
      // Benekler yumuşak kenarlı ve piksel boyutuna inmeden solar, yoksa kamera kıpırdadıkça yanıp söner.
      vec2 sp = p * 0.018;
      float speckFade = 1.0 - smoothstep(0.08, 0.3, length(fwidth(sp)));
      float speck = smoothstep(0.55, 0.85, fbm(sp)) * speckFade;
      diffuseColor.rgb = mix(c, c * vec3(0.62, 0.64, 0.5), speck * 0.5);
    }
  }`;

// Ortak mat malzeme (parsel zeminleri, yollar, çatılar, araçlar): düz renk yerine hafif yıpranma, örneklerde ton farkı.
// Kıyı dolgusu ve rıhtım duvarları su hizasına doğru ıslanıp koyulaşır, su çizgisinde yavaşça oynayan köpük şeridi vardır.
const MATTE_FRAGMENT = `#include <color_fragment>
  {
    vec2 p = vWPos.xz;
    float up = smoothstep(0.6, 0.9, vWNrm.y);
    float fine = 1.0 - smoothstep(0.2, 0.8, length(fwidth(p * 0.03)));
    float n = fbm(p * 0.006) * 0.6 + fbm(p * 0.03 + 5.0) * 0.4 * fine;
    diffuseColor.rgb *= 1.0 + up * (n - 0.5) * 0.3;
    if (vKey >= 0.0) diffuseColor.rgb *= 0.9 + 0.18 * vKey;
    vec3 mc = diffuseColor.rgb;
    float grass = smoothstep(1.05, 1.2, mc.g / max(mc.r, 1e-3)) * step(mc.b * 1.6, mc.g);
    float dry = step(mc.b, mc.g * 0.75) * step(mc.r, mc.g * 1.12) * smoothstep(0.25, 0.38, mc.g) * (1.0 - grass);
    mc *= mix(vec3(1.0), vec3(0.86, 1.08, 0.8), grass);
    mc *= mix(vec3(1.0), vec3(0.62, 0.92, 0.58), dry * (0.45 + 0.55 * smoothstep(0.35, 0.65, n)));
    // Yeşil alan tek renk halı değildir: büyük ölçekte koyu-açık bölgeler ve sararmış yamalar.
    float green = clamp(grass + dry, 0.0, 1.0);
    float g1 = fbm(p * 0.0035 + 9.0);
    float g2 = fbm(p * 0.0021 + 77.0);
    mc *= 1.0 + green * ((g1 - 0.5) * 0.7 + (n - 0.5) * 0.3);
    mc = mix(mc, mc * vec3(1.3, 1.05, 0.62), green * smoothstep(0.45, 0.7, g2) * 0.65);
    float lum = dot(mc, vec3(0.3, 0.6, 0.1));
    // Asfalt simsiyah değil, zeminle akraba koyu gri: yol ızgarası görüntünün en baskın öğesi olmaz.
    mc = mix(vec3(0.2, 0.195, 0.19) * (0.85 + 0.3 * n), mc, smoothstep(0.05, 0.14, lum));
    diffuseColor.rgb = mc;
    float wet = 1.0 - smoothstep(-1.7, -0.7, vWPos.y);
    diffuseColor.rgb *= mix(1.0, 0.6, wet);
    float lap = -1.95 + 0.14 * sin(uTime * 0.5 + vnoise(p * 0.02) * 6.2832);
    diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.8), (1.0 - smoothstep(lap, lap + 0.22, vWPos.y)) * 0.65);
  }`;

// Su: iki katmanlı, yavaş akan dalga normali ve değişken pürüzlülük, gökyüzünü ve güneşi kırık kırık yansıtır.
// Kıyıya yakın yerde (çevre yüksekliği su yüzeyine yaklaştıkça) renk turkuaza açılır, açıkta derin maviye döner.
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
    // Rüzgâr lekeleri: geniş, yavaş gezen bölgelerde yüzey kırışır (mat ve açık), aralarda ayna gibi durgun ve koyu kalır.
    // Büyük ölçekli olduğu için uzaktan da görünür, düz mavi şerit hissini kırar.
    float gust = smoothstep(0.35, 0.7, fbm(p * 0.006 + vec2(uTime * 0.015, uTime * 0.009)));
    roughnessFactor = mix(roughnessFactor * 0.6, 0.5, gust);
    vec2 swell = vec2(vnoise(p * 0.017 + uTime * 0.03) - 0.5, vnoise(p * 0.017 + 31.0 - uTime * 0.025) - 0.5);
    // Akış: nehirde akıntı yönünde uzamış çizgiler denize doğru (-z) ~3 m/sn kayar, denizde kıyıya paralel dalga sırtları
    // kıyıya doğru (+z) ~2 m/sn yürür. Dalga boyu onlarca metre olduğundan bu mesafeden de seçilir.
    float sea = step(vWPos.z, -1390.0);
    vec2 fp = mix(vec2(p.x * 0.07, p.y * 0.016 + uTime * 0.05), vec2(p.x * 0.006 + 13.0, p.y * 0.035 - uTime * 0.07), sea);
    float flow = vnoise(fp) * 0.6 + vnoise(fp * 2.1 + 7.0) * 0.4;
    vec2 flowGrad = vec2(vnoise(fp + vec2(0.4, 0.0)) - vnoise(fp - vec2(0.4, 0.0)), vnoise(fp + vec2(0.0, 0.4)) - vnoise(fp - vec2(0.0, 0.4)));
    vec3 ripple = vec3(swell.x * 0.05 + flowGrad.x * mix(0.1, 0.02, sea), 0.0, swell.y * 0.05 + flowGrad.y * mix(0.03, 0.1, sea));
    normal = normalize((viewMatrix * vec4(normalize(wn + ripple), 0.0)).xyz);
    diffuseColor.rgb *= mix(0.75, 1.2, gust) * (0.82 + 0.4 * flow);
    roughnessFactor = clamp(roughnessFactor + (flow - 0.5) * 0.25, 0.05, 1.0);
    vec4 ch = cityHeights(p);
    float shallow = (1.0 - smoothstep(1.5, 9.0, vWPos.y - ch.y)) * ch.w * uAo;
    diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.09, 0.3, 0.33), shallow * 0.6);
    diffuseColor.rgb *= 0.88 + 0.24 * fbm(p * 0.0012 + 3.0);
  }`;

/** Malzemenin shader'ına ortak uniform'ları, dünya konumu varying'lerini, ortak ışık düzeltmesini ve verilen bloğu ekler. */
function patchMaterial(
  material: THREE.MeshStandardMaterial,
  cacheKey: string,
  block?: { include: string; code: string; header?: string },
  grade = true,
) {
  // Kendi köşe hareketini taşıyan malzemeler (insanlar, cityPeople.ts) ortak yamaya bunu ekler, program ayrı önbelleklenir.
  const vertexPatch = material.userData.vertexPatch as VertexPatch | undefined;
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, cityUniforms);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>\n${VERT_DECL}${vertexPatch?.header ?? ''}`)
      .replace('#include <worldpos_vertex>', `#include <worldpos_vertex>\n${VERT_BODY}`);
    if (vertexPatch) {
      shader.vertexShader = shader.vertexShader
        .replace('#include <beginnormal_vertex>', vertexPatch.normal)
        .replace('#include <begin_vertex>', vertexPatch.position);
    }
    let fragment = shader.fragmentShader
      .replace('#include <common>', `#include <common>\n${FRAG_COMMON}${block?.header ?? ''}`)
      .replace('#include <aomap_fragment>', LIGHT_FRAGMENT);
    if (block) fragment = fragment.replace(block.include, block.code);
    if (grade) fragment = fragment.replace('#include <lights_physical_fragment>', GRADE_FRAGMENT);
    shader.fragmentShader = fragment;
  };
  material.customProgramCacheKey = () => (vertexPatch ? `${cacheKey}_${vertexPatch.key}` : cacheKey);
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

// ------------------------------------------------------------------ bina kütleleri

const massGeometries = new Map<MassVariant, THREE.BufferGeometry>();

function pickVariant(halfX: number, halfY: number, halfZ: number, a: number, b: number, allowPitched = true): MassVariant {
  const alongX = halfX >= halfZ;
  // Eğimli çatı yalnızca küçük, alçak ve eninden çok uzun olmayan binalarda (yoksa sivri kule gibi durur).
  if (allowPitched && Math.min(halfX, halfZ) < 8.5 && halfY < 10 && halfY < Math.min(halfX, halfZ) * 1.8) {
    if (a < 0.45) return alongX ? 'hipX' : 'hipZ';
    if (a < 0.85) return alongX ? 'gableX' : 'gableZ';
    return 'plain';
  }
  if (halfY * 2 > 34) {
    if (a < 0.3) return 'setback';
    if (a < 0.5) return 'setbackTriple';
    if (a < 0.75) return b < 0.5 ? 'penthouse' : 'penthouseB';
    return 'plain';
  }
  if (a < 0.3) return b < 0.5 ? 'penthouse' : 'penthouseB';
  if (a < 0.5) return b < 0.5 ? 'podiumA' : 'podiumB';
  if (a < 0.65) return 'ell';
  return 'plain';
}

// Parsel bölme: iri bloklar küçük binalara ayrılır. lot: hedef parsel genişliği (metre), gap: aradaki geçit genişliği.
// Bu yükseklikten uzun kuleler silüeti taşıdığı için bölünmez.
const SUBDIVIDE = {
  business: { lot: 12.5, minEdge: 24, gap: 2.4 },
  residential: { lot: 10, minEdge: 19, gap: 2 },
  maxHeight: 55,
  maxCells: 3,
};

interface Lot {
  matrix: THREE.Matrix4;
  allowPitched: boolean;
}

/**
 * Model ölçeği örnekteki maket şehirlere göre iri: iş merkezinde 35-40 m'lik tek parça bloklar var. Bunlar parsellere
 * bölünür, her parsel kendi yüksekliğini alır, aralarında dar geçitler kalır. Sokak cephesi korunur (dış kenarlar aynı),
 * bloğun en yüksek parseli özgün yükseklikte kalır, böylece silüet değişmez. Az sayıda parsel boş bırakılır (avlu).
 */
function subdivideLot(
  matrix: THREE.Matrix4,
  business: boolean,
  hash: (x: number, z: number, seed: number) => number,
): Lot[] {
  const position = new THREE.Vector3();
  const quaternion = new THREE.Quaternion();
  const scale = new THREE.Vector3();
  matrix.decompose(position, quaternion, scale);
  const rule = business ? SUBDIVIDE.business : SUBDIVIDE.residential;
  const width = scale.x * 2;
  const depth = scale.z * 2;
  const height = scale.y * 2;
  const whole = [{ matrix, allowPitched: true }];
  if (height > SUBDIVIDE.maxHeight || Math.max(width, depth) < rule.minEdge) return whole;
  const cells = (edge: number, seed: number) =>
    // Bazı bloklar yalnızca tek yönde bölünür, ızgara düzeni tekrar etmez.
    edge < rule.minEdge || hash(position.x, position.z, seed) < 0.25
      ? 1
      : Math.min(SUBDIVIDE.maxCells, Math.max(2, Math.round(edge / rule.lot)));
  const nx = cells(width, 11);
  const nz = cells(depth, 12);
  if (nx * nz < 2) return whole;

  // Parsel sınırları eşit değil: her kesim çizgisi biraz kayar.
  const cuts = (n: number, seed: number) => {
    const edges = [0];
    for (let i = 1; i < n; i++) edges.push((i + (hash(position.x, position.z, seed + i) - 0.5) * 0.35) / n);
    edges.push(1);
    return edges;
  };
  const xs = cuts(nx, 20);
  const zs = cuts(nz, 30);
  const base = position.y - scale.y;
  const tallest = Math.floor(hash(position.x, position.z, 40) * nx * nz);
  const lots: Lot[] = [];
  const offset = new THREE.Vector3();
  for (let ix = 0; ix < nx; ix++) {
    for (let iz = 0; iz < nz; iz++) {
      const index = ix * nz + iz;
      const r = hash(position.x + ix * 7.1, position.z + iz * 5.3, 50);
      if (index !== tallest && nx * nz >= 4 && r < 0.08) continue;
      // Parsel kenarları: dış kenar blok kenarıdır, iç kenarlarda yarım geçit payı bırakılır.
      const x0 = -1 + 2 * xs[ix] + (ix > 0 ? rule.gap / 2 / scale.x : 0);
      const x1 = -1 + 2 * xs[ix + 1] - (ix < nx - 1 ? rule.gap / 2 / scale.x : 0);
      const z0 = -1 + 2 * zs[iz] + (iz > 0 ? rule.gap / 2 / scale.z : 0);
      const z1 = -1 + 2 * zs[iz + 1] - (iz < nz - 1 ? rule.gap / 2 / scale.z : 0);
      const hx = ((x1 - x0) / 2) * scale.x;
      const hz = ((z1 - z0) / 2) * scale.z;
      if (hx < 2.5 || hz < 2.5) continue;
      const factor = index === tallest ? 1 : business ? 0.35 + 0.75 * r : 0.55 + 0.6 * r;
      const hy = Math.max(1.8, Math.min(scale.y * factor, scale.y * 1.1));
      offset.set(((x0 + x1) / 2) * scale.x, 0, ((z0 + z1) / 2) * scale.z).applyQuaternion(quaternion);
      const center = new THREE.Vector3(position.x + offset.x, base + hy, position.z + offset.z);
      lots.push({
        matrix: new THREE.Matrix4().compose(center, quaternion, new THREE.Vector3(hx, hy, hz)),
        // İş merkezindeki küçük parseller eğimli çatılı ev olmaz.
        allowPitched: !business,
      });
    }
  }
  return lots.length ? lots : whole;
}

/**
 * Modeldeki binaların hepsi aynı düz kutudur, şehir bu yüzden blok yığını gibi okunur. Her örnek, ölçüsüne göre bir kütle
 * çeşidine atanır (eğimli çatılı ev, kademeli kule, çatı kuleli blok, tabanlı blok, L plan) ve örnekli mesh çeşit başına
 * bir mesh'e bölünür. Kapladıkları hacim aynı kalır, gölgeler ve yükseklik haritası yeni silüeti kendiliğinden izler.
 */
function diversifyBuildings(cityRoot: THREE.Object3D) {
  const sources: THREE.InstancedMesh[] = [];
  cityRoot.traverse((object) => {
    if (object instanceof THREE.InstancedMesh && /_Buildings$/.test(object.name)) sources.push(object);
  });
  const matrix = new THREE.Matrix4();
  const position = new THREE.Vector3();
  const quaternion = new THREE.Quaternion();
  const scale = new THREE.Vector3();
  const hash = (x: number, z: number, seed: number) => {
    const value = Math.sin(x * 12.9898 + z * 78.233 + seed * 37.719) * 43758.5453;
    return value - Math.floor(value);
  };
  for (const source of sources) {
    const parent = source.parent;
    if (!parent) continue;
    const groups = new Map<MassVariant, THREE.Matrix4[]>();
    const business = source.name.startsWith('Business');
    for (let i = 0; i < source.count; i++) {
      source.getMatrixAt(i, matrix);
      for (const lot of subdivideLot(matrix.clone(), business, hash)) {
        lot.matrix.decompose(position, quaternion, scale);
        const variant = pickVariant(
          scale.x,
          scale.y,
          scale.z,
          hash(position.x, position.z, 1),
          hash(position.x, position.z, 2),
          lot.allowPitched,
        );
        const list = groups.get(variant) ?? [];
        list.push(lot.matrix);
        groups.set(variant, list);
      }
    }
    for (const [variant, matrices] of groups) {
      let geometry = massGeometries.get(variant);
      if (!geometry) {
        geometry = MASS_VARIANTS[variant]().build();
        massGeometries.set(variant, geometry);
      }
      const mesh = new THREE.InstancedMesh(geometry, source.material, matrices.length);
      // Ad `_Buildings` ile bitmez, hazırlık ikinci kez çalışırsa (StrictMode) yeniden bölünmez.
      mesh.name = `${source.name}_${variant}`;
      mesh.userData = { ...source.userData };
      mesh.position.copy(source.position);
      mesh.quaternion.copy(source.quaternion);
      mesh.scale.copy(source.scale);
      matrices.forEach((item, index) => mesh.setMatrixAt(index, item));
      mesh.instanceMatrix.needsUpdate = true;
      parent.add(mesh);
    }
    parent.remove(source);
    source.dispose();
  }
}

// ------------------------------------------------------------------ trafik

interface Traffic {
  update: (dt: number) => void;
}

interface Lane {
  alongX: boolean;
  start: number;
  length: number;
}

const TREE_SCALE = 1.35;
// Araçların gerçek ölçüye göre büyütülmesi (otomobil ~4.4 m): yoldakiler ~6.2 m (hero mesafesinde ~9 piksel), otoparktakiler
// park yerlerine sığsın diye daha az. Gerçek ölçüde kullanıcıya fazla küçük geldi.
const VEHICLE_SCALE = { moving: 1.4, parked: 1.25 };

// Sokak lambası başlıkları ve yol ışıkları bu mesafeden piksel altında kalıp görünmüyordu. Örnekli kutular yerine sabit
// piksel boyutlu, yumuşak kenarlı noktalar olarak çizilir (bloom bunları parlatır). size: piksel, glow: parlaklık,
// pool: zemine düşen ışık payı. Kırmızı yol ışıkları (stop lambaları) alınmaz: yerinde asılı duran kırmızı noktalar
// hareketli trafikle çelişiyordu.
const LIGHT_POINT_SOURCES: Record<string, { size: number; glow: number; pool: number }> = {
  Infrastructure_StreetLamp_Heads: { size: 3.4, glow: 1, pool: 1 },
  Roads_TrafficGlow: { size: 2.3, glow: 0.55, pool: 0.05 },
};
// Rengi tamamen dünya konumundan çizilen zeminler: mesh adı → shader.
const LANDSCAPES: Record<string, { key: string; code: string; header: string }> = {
  Park_Ground: { key: 'city_park_v1', code: PARK_FRAGMENT, header: PARK_GLSL },
  Kindergarten_Ground: { key: 'city_kindergarten_v1', code: KINDERGARTEN_FRAGMENT, header: KINDERGARTEN_GLSL },
  Greenhouse_Ground_Site: { key: 'city_greenhouse_v1', code: GREENHOUSE_FRAGMENT, header: GREENHOUSE_GLSL },
  Cultural_Ground: { key: 'city_cultural_v1', code: CULTURAL_FRAGMENT, header: CULTURAL_GLSL },
  Housing_Ground: { key: 'city_housing_v1', code: HOUSING_FRAGMENT, header: HOUSING_GLSL },
  School_Ground: { key: 'city_school_v1', code: SCHOOL_FRAGMENT, header: SCHOOL_GLSL },
  CableCar_Ground: { key: 'city_cablecar_v1', code: CABLECAR_FRAGMENT, header: CABLECAR_GLSL },
  Airport_Field: { key: 'city_airport_v1', code: AIRPORT_FRAGMENT, header: AIRPORT_GLSL },
  Science_Ground: { key: 'city_science_v1', code: SCIENCE_FRAGMENT, header: SCIENCE_GLSL },
  Military_Ground: { key: 'city_military_v1', code: MILITARY_FRAGMENT, header: MILITARY_GLSL },
  Hospital_Ground: { key: 'city_hospital_v1', code: HOSPITAL_FRAGMENT, header: HOSPITAL_GLSL },
  Technopark_Ground: { key: 'city_technopark_v1', code: TECHNOPARK_FRAGMENT, header: TECHNOPARK_GLSL },
};

const LIGHT_POINT_HIDE = /^(Infrastructure_StreetLamp_Heads|Roads_TrafficGlow)/;

const LIGHT_POINT_VERTEX = `attribute float aSize; attribute float aGlow;
  uniform float uDpr; uniform float uNight; uniform float uFogD;
  varying float vGlow;
  void main(){
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mv;
    float d = -mv.z;
    // Sahnedeki FogExp2 ile aynı sönüm: uzaktaki noktalar pusun içinde kaybolur.
    float fogF = exp(-pow(uFogD * d, 2.0));
    vGlow = aGlow * uNight * fogF;
    gl_PointSize = aSize * uDpr * clamp(1800.0 / d, 0.75, 1.4);
  }`;
const LIGHT_POINT_FRAGMENT = `uniform vec3 uColor; varying float vGlow;
  void main(){
    vec2 c = gl_PointCoord * 2.0 - 1.0;
    float r2 = dot(c, c);
    if (r2 > 1.0) discard;
    gl_FragColor = vec4(uColor * vGlow * exp(-r2 * 4.0), 1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }`;

/** Lamba ve yol ışıklarını tek bir nokta bulutunda toplar, kaynak mesh'leri gizler. Konumlar ışık havuzu için saklanır. */
function createLightPoints(cityRoot: THREE.Object3D, thin: number, extraLamps: number[] = []) {
  if (cityRoot.userData.lightPoints) return;
  const positions: number[] = [];
  const sizes: number[] = [];
  const glows: number[] = [];
  const pools: number[] = [];
  const matrix = new THREE.Matrix4();
  const point = new THREE.Vector3();
  const hash = (i: number) => {
    const value = Math.sin(i * 12.9898 + 4.1) * 43758.5453;
    return value - Math.floor(value);
  };
  cityRoot.traverse((object) => {
    if (!(object instanceof THREE.InstancedMesh)) return;
    const source = LIGHT_POINT_SOURCES[object.name];
    if (!source) return;
    const keep = object.userData.thinnable ? thin : 1;
    for (let i = 0; i < object.count; i++) {
      if (hash(i) > keep) continue;
      object.getMatrixAt(i, matrix);
      point.setFromMatrixPosition(matrix).applyMatrix4(object.matrixWorld);
      positions.push(point.x, point.y, point.z);
      const jitter = hash(i + 0.5);
      sizes.push(source.size * (0.8 + 0.4 * jitter));
      glows.push(source.glow * (0.7 + 0.6 * hash(i + 0.25)));
      pools.push(source.pool);
    }
  });
  // Park lambaları: sokak lambasından küçük ve biraz sönük, zemine daha dar havuz bırakır.
  for (let i = 0; i < extraLamps.length; i += 3) {
    positions.push(extraLamps[i], extraLamps[i + 1], extraLamps[i + 2]);
    sizes.push(2.4 * (0.85 + 0.3 * hash(i + 0.7)));
    glows.push(0.75);
    pools.push(0.7);
  }
  if (!positions.length) return;
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('aSize', new THREE.Float32BufferAttribute(sizes, 1));
  geometry.setAttribute('aGlow', new THREE.Float32BufferAttribute(glows, 1));
  const material = new THREE.ShaderMaterial({
    blending: THREE.AdditiveBlending,
    transparent: true,
    depthWrite: false,
    uniforms: {
      uDpr: cityUniforms.uDpr,
      uNight: cityUniforms.uNight,
      uFogD: cityUniforms.uFogD,
      uColor: { value: new THREE.Color('#ffcf94').multiplyScalar(5) },
    },
    vertexShader: LIGHT_POINT_VERTEX,
    fragmentShader: LIGHT_POINT_FRAGMENT,
  });
  const cloud = new THREE.Points(geometry, material);
  cloud.name = 'Runtime_LightPoints';
  cloud.frustumCulled = false;
  cloud.renderOrder = 2;
  cityRoot.add(cloud);
  cityRoot.userData.lightPoints = {
    positions: new Float32Array(positions),
    pools: new Float32Array(pools),
  } satisfies LightPointData;
}
const TRAFFIC_FADE = 14; // metre: yolun iki ucunda araç bu mesafede küçülerek kaybolur ve belirir

/**
 * Modeldeki araçlar durağandır. Yol şeridinde duranlar (yol dörtgeninin içinde ve yola hizalı) ayrı mesh'lere alınıp
 * şeritleri boyunca ilerletilir, otoparktakiler yerinde kalır. Sağdan akan trafik: şerit yönünü aracın yol eksenine göre
 * hangi tarafta durduğu belirler. Araç yolun sonuna gelince başından yeniden girer, kavşakta dönmez.
 * Gölge haritası durağan olduğundan hareketli araçlar gölge düşürmez.
 */
function createTraffic(cityRoot: THREE.Object3D): Traffic {
  // İlk çalıştırmada kurulan trafik saklanır: hazırlık yeniden çalışırsa (StrictMode, kalite değişimi) mesh'ler zaten bölünmüştür.
  const cached = cityRoot.userData.traffic as Traffic | undefined;
  if (cached) return cached;

  const lanes: Lane[] = [];
  const roads: { x0: number; x1: number; z0: number; z1: number; lane: number }[] = [];
  const asphalt = cityRoot.getObjectByName('Roads_Asphalt');
  if (asphalt instanceof THREE.Mesh) {
    const position = asphalt.geometry.getAttribute('position');
    const index = asphalt.geometry.index;
    const vertex = new THREE.Vector3();
    const seen = new Set<string>();
    const triangles = (index ? index.count : position.count) / 3;
    for (let t = 0; t < triangles; t++) {
      const box = new THREE.Box3();
      for (let k = 0; k < 3; k++) {
        vertex.fromBufferAttribute(position, index ? index.getX(t * 3 + k) : t * 3 + k).applyMatrix4(asphalt.matrixWorld);
        box.expandByPoint(vertex);
      }
      // Her yol bir dörtgen (iki üçgen), ikisinin sınır kutusu aynıdır.
      const key = `${box.min.x.toFixed(0)},${box.max.x.toFixed(0)},${box.min.z.toFixed(0)},${box.max.z.toFixed(0)}`;
      const width = box.max.x - box.min.x;
      const depth = box.max.z - box.min.z;
      if (seen.has(key) || Math.min(width, depth) > 80) continue;
      seen.add(key);
      const alongX = width > depth;
      lanes.push({ alongX, start: alongX ? box.min.x : box.min.z, length: Math.max(width, depth) });
      roads.push({ x0: box.min.x, x1: box.max.x, z0: box.min.z, z1: box.max.z, lane: lanes.length - 1 });
    }
  }

  interface Mover {
    mesh: THREE.InstancedMesh;
    base: Float32Array; // örnek başına 16 eleman
    lane: Int32Array;
    offset: Float32Array; // şerit başından metre
    speed: Float32Array; // işaretli, metre/saniye
  }
  const movers: Mover[] = [];
  const sources: THREE.InstancedMesh[] = [];
  cityRoot.traverse((object) => {
    if (object instanceof THREE.InstancedMesh && /^Vehicles_/.test(object.name)) sources.push(object);
  });
  const matrix = new THREE.Matrix4();
  const xAxis = new THREE.Vector3();
  /**
   * Araçlar gerçek ölçüden büyütülür (maket gibi): yoldakiler daha çok, otoparktakiler park yerlerinde birbirine girmesin
   * diye daha az. Araç modelinin merkezi gövdenin ortasında, büyütülen araç büyüme payı kadar kaldırılır (yere gömülmez).
   */
  const enlarge = (source: THREE.InstancedMesh, base: THREE.Matrix4, factor: number) => {
    source.geometry.computeBoundingBox();
    const bottom = -(source.geometry.boundingBox?.min.y ?? 0);
    const result = base.clone();
    const height = bottom * new THREE.Vector3().setFromMatrixColumn(base, 1).length();
    result.multiply(new THREE.Matrix4().makeScale(factor, factor, factor));
    result.elements[13] += height * (factor - 1);
    return result;
  };
  const hash = (a: number, b: number) => {
    const value = Math.sin(a * 12.9898 + b * 78.233) * 43758.5453;
    return value - Math.floor(value);
  };
  for (const source of sources) {
    const parent = source.parent;
    if (!parent) continue;
    const truck = /Trucks/.test(source.name);
    const parked: THREE.Matrix4[] = [];
    const moving: { matrix: THREE.Matrix4; lane: number; offset: number; speed: number }[] = [];
    for (let i = 0; i < source.count; i++) {
      source.getMatrixAt(i, matrix);
      // Araç mesh'leri sahne kökünde dönüşümsüzdür, örnek matrisi dünya konumudur.
      const x = matrix.elements[12];
      const z = matrix.elements[14];
      xAxis.setFromMatrixColumn(matrix, 0);
      const headsX = Math.abs(xAxis.x) > Math.abs(xAxis.z);
      const road = roads.find((item) => x >= item.x0 && x <= item.x1 && z >= item.z0 && z <= item.z1 && lanes[item.lane].alongX === headsX);
      if (!road) {
        parked.push(enlarge(source, matrix, VEHICLE_SCALE.parked));
        continue;
      }
      const lane = lanes[road.lane];
      // Sağdan akan trafik: +x yönüne giden araç yol ekseninin +z tarafında, +z yönüne giden -x tarafındadır.
      const side = lane.alongX ? z - (road.z0 + road.z1) / 2 : (road.x0 + road.x1) / 2 - x;
      const direction = side >= 0 ? 1 : -1;
      // Aynı şeritteki araçlar aynı hızda gider, birbirinin içinden geçmez.
      const laneSpeed = 9 + 5 * hash(road.lane, Math.round(side));
      moving.push({
        matrix: enlarge(source, matrix, VEHICLE_SCALE.moving),
        lane: road.lane,
        offset: (lane.alongX ? x : z) - lane.start,
        speed: direction * laneSpeed * (truck ? 0.8 : 1),
      });
    }
    const build = (suffix: string, count: number) => {
      const mesh = new THREE.InstancedMesh(source.geometry, source.material, count);
      mesh.name = `Traffic_${source.name}_${suffix}`;
      mesh.userData = { ...source.userData };
      parent.add(mesh);
      return mesh;
    };
    if (parked.length) {
      const mesh = build('Parked', parked.length);
      parked.forEach((item, index) => mesh.setMatrixAt(index, item));
    }
    if (moving.length) {
      const mesh = build('Moving', moving.length);
      mesh.userData.castShadow = false;
      mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      const mover: Mover = {
        mesh,
        base: new Float32Array(moving.length * 16),
        lane: new Int32Array(moving.length),
        offset: new Float32Array(moving.length),
        speed: new Float32Array(moving.length),
      };
      moving.forEach((item, index) => {
        mesh.setMatrixAt(index, item.matrix);
        mover.base.set(item.matrix.elements, index * 16);
        mover.lane[index] = item.lane;
        mover.offset[index] = item.offset;
        mover.speed[index] = item.speed;
      });
      movers.push(mover);
    }
    parent.remove(source);
    source.dispose();
  }

  let time = 0;
  const traffic: Traffic = {
    update(dt) {
      if (dt <= 0) return;
      time += dt;
      for (const mover of movers) {
        if (!mover.mesh.visible) continue;
        const array = mover.mesh.instanceMatrix.array;
        for (let i = 0; i < mover.lane.length; i++) {
          const lane = lanes[mover.lane[i]];
          const travelled = mover.offset[i] + mover.speed[i] * time;
          const along = travelled - Math.floor(travelled / lane.length) * lane.length;
          const fade = Math.min(1, along / TRAFFIC_FADE, (lane.length - along) / TRAFFIC_FADE);
          const o = i * 16;
          for (let k = 0; k < 12; k++) array[o + k] = mover.base[o + k] * (k % 4 === 3 ? 1 : fade);
          array[o + 12] = lane.alongX ? lane.start + along : mover.base[o + 12];
          array[o + 13] = mover.base[o + 13];
          array[o + 14] = lane.alongX ? mover.base[o + 14] : lane.start + along;
          array[o + 15] = 1;
        }
        mover.mesh.instanceMatrix.needsUpdate = true;
      }
    },
  };
  cityRoot.userData.traffic = traffic;
  return traffic;
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
  { quality }: { quality: Quality },
): PreparedCity {
  const lodObjects: THREE.Object3D[] = [];
  const patched = new Set<THREE.Material>();
  const thin = quality === 'low' ? 0.35 : quality === 'medium' ? 0.6 : 1;

  cityUniforms.uCloudTex.value ??= cloudTexture();
  // Tesisler kameradan görünecek yerlere taşınır. Bina bölme, trafik, park ve ışıklar yeni yerleşimi okur, bu yüzden ilk adım.
  arrangeCity(cityRoot);
  diversifyBuildings(cityRoot);

  cityRoot.updateMatrixWorld(true);
  const traffic = createTraffic(cityRoot);
  // Park peyzajı: ağaçlar yeniden dikilir, park lambaları ışık noktalarına katılır.
  const parkLamps = landscapePark(cityRoot, TREE_SCALE);
  // Kreş yeniden kurulur: bina, oyun ekipmanları, ağaçlar ve lambalar (zemin rengi aşağıda LANDSCAPES ile).
  const kindergartenLamps = landscapeKindergarten(cityRoot, TREE_SCALE);
  // Sera şubesi yeniden kurulur: cam sera, binalar, araçlar (trafikten sonra, park etmiş araçlardan), ağaçlar ve lambalar.
  const greenhouseLamps = landscapeGreenhouse(cityRoot, TREE_SCALE);
  // Kültür merkezi yeniden kurulur: opera küçülüp kayar, müze, kütüphane, amfi, servis avlusu araçları, ağaçlar ve lambalar.
  const culturalLamps = landscapeCulturalCenter(cityRoot, TREE_SCALE);
  // Konut bölgesinin mahalle merkezi yeniden kurulur: konak, spor salonu, çarşılı konut, semt pazarı, otopark araçları,
  // ağaçlar ve lambalar (zemin rengi aşağıda LANDSCAPES ile).
  const housingLamps = landscapeHousing(cityRoot, TREE_SCALE);
  // Okul yeniden kurulur: derslik blokları, spor salonu, yemekhane, tribün, otopark araçları, ağaçlar ve lambalar (zemin
  // rengi aşağıda LANDSCAPES ile).
  const schoolLamps = landscapeSchool(cityRoot, TREE_SCALE);
  // Teleferik aktarma istasyonunun bloğu: istasyon altında bilet salonu ve kule, kabin garajı, otobüs cebi ve taksiler,
  // ağaçlar ve lambalar (zemin rengi aşağıda LANDSCAPES ile).
  const cableCarLamps = landscapeCableCar(cityRoot, TREE_SCALE);
  // Havalimanı: tek zemin (pistler, taksi yolları, apronlar, kara tarafı), kargo, itfaiye, kule tabanı, radar, körük
  // köprüler, yer araçları, kamyonlar, kara tarafında ağaçlar ve lambalar (zemin rengi aşağıda LANDSCAPES ile).
  const airportLamps = landscapeAirport(cityRoot, TREE_SCALE);
  // Bilim merkezi yeniden kurulur: laboratuvar kütleleri, hol, kule podyumu, bilim parkı parçaları, araçlar, ağaçlar ve
  // lambalar (zemin rengi aşağıda LANDSCAPES ile).
  const scienceLamps = landscapeScienceCenter(cityRoot, TREE_SCALE);
  // Askerî kampüs yeniden kurulur: karargâh, koğuşlar, atölye, duvar ve kuleler, kapılar, tribün, ağaçlar ve lambalar
  // (zemin rengi aşağıda LANDSCAPES ile).
  const militaryLamps = landscapeMilitaryCampus(cityRoot, TREE_SCALE);
  // Hastane yeniden kurulur: kanat kütleleri, podyum, poliklinik, doğu blok, açık katlı otopark, bahçe ve servis parçaları,
  // otopark adaları, ağaçlar ve lambalar (zemin rengi aşağıda LANDSCAPES ile).
  const hospitalLamps = landscapeHospital(cityRoot, TREE_SCALE);
  // Teknopark (bilim merkezinin doğusu, askerî kampüsün eski kuzey kısmı): Ar-Ge blokları, salonlar, veri merkezi,
  // kampüs çimi, otoparklar, kortlar, ağaçlar ve lambalar. Askerî kampüsten sonra (zemin rengi aşağıda LANDSCAPES ile).
  const technoparkLamps = landscapeTechnopark(cityRoot, TREE_SCALE);
  createLightPoints(cityRoot, thin, [
    ...parkLamps,
    ...kindergartenLamps,
    ...greenhouseLamps,
    ...culturalLamps,
    ...housingLamps,
    ...schoolLamps,
    ...cableCarLamps,
    ...airportLamps,
    ...scienceLamps,
    ...militaryLamps,
    ...hospitalLamps,
    ...technoparkLamps,
  ]);
  // İnsanlar: kaldırımlarda, blokların ve tesislerin boş alanlarında. Doluluk haritası yerleşim ve park bittikten sonra.
  // Hareketleri shader'da ortak saatle (uTime) yürür, burada güncellenmez.
  createPeople(cityRoot);
  // Şehir içi ağaçlar gerçek ölçüde bu mesafeden nokta gibi kalıyor, maketlerdeki gibi iri tutulur (orman aynı kalır).
  for (const name of ['Greens_Trees', 'Greens_Trees_Olive']) {
    const trees = cityRoot.getObjectByName(name);
    if (!(trees instanceof THREE.InstancedMesh) || trees.userData.enlarged) continue;
    trees.userData.enlarged = true;
    const treeMatrix = new THREE.Matrix4();
    const treeScale = new THREE.Matrix4().makeScale(TREE_SCALE, TREE_SCALE, TREE_SCALE);
    for (let i = 0; i < trees.count; i++) {
      trees.getMatrixAt(i, treeMatrix);
      trees.setMatrixAt(i, treeMatrix.multiply(treeScale));
    }
    trees.instanceMatrix.needsUpdate = true;
  }
  // Şehre yayılmış büyük örnekli mesh'ler hücrelere bölünür: kadraj dışındaki hücreler çizilmez (görüntü aynı). Bütün
  // dikim ve ışık noktalarından sonra, gölge ve seyreltme ayarından önce. Her karede matrisi değişenler bölünmez.
  chunkInstances(
    cityRoot,
    (mesh) =>
      mesh.name === config.cableCar.instancedMesh || mesh.name.endsWith('_Moving') || LIGHT_POINT_HIDE.test(mesh.name),
  );
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
      if (LIGHT_POINT_HIDE.test(object.name)) object.visible = false;
      else if (data.lodMaxDistance || data.lodMinDistance) lodObjects.push(object);
      if (object instanceof THREE.InstancedMesh && data.thinnable) {
        // Kalite değişirse veya StrictMode çift çalıştırırsa seyreltme üst üste binmesin diye ilk sayı saklanır.
        // Hücrelere bölünen mesh'te kaynak sırasıyla seyreltilir (bölünmeden önceki örneklerin aynısı kalır).
        const chunkCount = chunkThinCount(object.userData, thin);
        if (chunkCount !== null) {
          object.count = chunkCount;
        } else {
          data.baseCount ??= object.count;
          object.count = Math.floor(data.baseCount * thin);
        }
      }
      object.matrixAutoUpdate = false;
      object.updateMatrix();
      const materials: THREE.Material[] = Array.isArray(object.material) ? object.material : [object.material];
      for (const material of materials) {
        const landscape = LANDSCAPES[object.name];
        if (landscape && material instanceof THREE.MeshStandardMaterial) {
          // Peyzajı yeniden çizilen zeminler (park, kreş, sera) kendi malzemesini alır, ortak mat malzeme (başka mesh'te zaten
          // yamanmış olabilir) diğer zeminlerde değişmeden kalır. İkinci hazırlıkta (StrictMode) klon yeniden klonlanmaz.
          const name = `${object.name}_Landscape`;
          const ground = material.name === name ? material : material.clone();
          ground.name = name;
          object.material = ground;
          if (!patched.has(ground)) {
            patched.add(ground);
            patchMaterial(ground, landscape.key, { include: '#include <color_fragment>', code: landscape.code, header: landscape.header });
          }
          continue;
        }
        if (patched.has(material) || !(material instanceof THREE.MeshStandardMaterial)) continue;
        patched.add(material);
        // Işık, cam ve kablo malzemeleri olduğu gibi kalır, diğer hepsi ortak ışık düzeltmesini alır.
        if (/^(Light_|Glass_|Cable_)/.test(material.name)) continue;
        if (material.name === 'Facade_Model') {
          material.defines = { ...material.defines, CITY_FACE: '' };
          patchMaterial(material, 'city_facade_v11', { include: '#include <emissivemap_fragment>', code: FACADE_FRAGMENT });
        } else if (material.name === 'Terrain_Sand') {
          patchMaterial(material, 'city_terrain_v9', { include: '#include <color_fragment>', code: TERRAIN_FRAGMENT });
        } else if (material.name === 'Mat_Matte') {
          patchMaterial(material, 'city_matte_v7', { include: '#include <color_fragment>', code: MATTE_FRAGMENT });
        } else if (material.name === 'Water') {
          // Su kendi mavisini taşır, sıcak gökyüzü yansıması baskın olmaz.
          material.color.set('#1b5878');
          // Hafif metalik: yüzey rengini boyadan çok gökyüzü yansımasından alır.
          material.metalness = 0.3;
          material.envMapIntensity = 1.3;
          patchMaterial(material, 'city_water_v6', { include: '#include <normal_fragment_maps>', code: WATER_FRAGMENT }, false);
        } else {
          patchMaterial(material, 'city_light_v5');
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
      traffic.update(Math.min(dt, 0.1));
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

/** Kameranın yakın çekimde odaklanacağı tesis: zemin sınırı ve kadraja girmesi gereken yükseklik (metre). */
export interface CameraFocus {
  x0: number;
  x1: number;
  z0: number;
  z1: number;
  /** En yüksek yapı veya ışık perdesi, hangisi yüksekse. */
  height: number;
}

// Boşta yörünge hızı (radyan/sn): şehrin çevresinde ~4 dakikada bir tur, dron gibi usul usul. 2.5 katı denendi,
// kullanıcı eski hıza döndürttü.
const ORBIT_SPEED = 0.026;
// Tesisin çevresinde dönüş daha sık: ~2.5 dakikada bir tur (açı hızı yüksek, yakın olduğundan çizgisel hız düşük).
const FOCUS_ORBIT_SPEED = 0.042;
// Yörünge açılışta durgun başlar, birkaç saniyede hızlanır: ilk kareler sabit kadraj gibi görünür.
const ORBIT_EASE_IN = 0.25;
// Uçuşun yumuşaklığı (sn): hedef, mesafe ve açı yaylı sönümle yeni değerlerine ~3 sn içinde oturur.
const FLIGHT_SMOOTH = 0.85;
// Yakın çekimde tesis, hangi açıdan bakılırsa bakılsın kadrajın bu payına sığar (1: kenardan kenara). Mesafe buna göre
// hesaplanır. Kamera daha yukarıdan bakar, çevredeki kulelerin üstünde kalır.
const FOCUS_FILL = 0.78;
// Mesafe sınırları (yatay ekran). Üst sınır hero mesafesinin (~2030 m) altında: büyük tesislerde de kamera yaklaşır,
// en kötü açıda perdenin tepesi kadraj kenarına değebilir.
const FOCUS_MIN_DISTANCE = 560;
const FOCUS_MAX_DISTANCE = 1650;
const FOCUS_ELEVATION = 38 * DEG;
// Fare tekerleğiyle yakınlaşma: mesafe çarpanı ZOOM_MAX (en uzak) ile ZOOM_MIN (en yakın) arasında, 1 başlangıç
// kadrajıdır. Kamera hedefe ZOOM_FLOOR metreden fazla yaklaşmaz. Eski sabit yakın düzlemle (0.22 x mesafe) 410 m'de
// okulun ve teleferiğin çevresindeki binalar yakın düzlemin önüne giriyordu. Yakın düzlem artık NEAR_FADE_DISTANCE'ın
// altında mesafeyle birlikte küçülür, bu yüzden taban 360 m'ye indi. Uzaklaşma ZOOM_MAX ile sınırlı: daha ötesinde
// gölge kutusu (focusShadows, en fazla 2600 m) şehri kaplamaz. Tekerleğin bir çentiği (~100 px) mesafeyi ~%14
// değiştirir, yakınlaşma yaylı sönümle oturur.
const ZOOM_MIN = 0.18;
const ZOOM_MAX = 1.4;
const ZOOM_FLOOR = 360;
// Yakın düzlem oranı (x mesafe) ve oranın küçülmeye başladığı mesafe.
const NEAR_RATIO = 0.22;
const NEAR_FADE_DISTANCE = 480;
const ZOOM_SENSITIVITY = 0.0015;
const ZOOM_SMOOTH = 0.3;
// İmlece yakınlaşma: yakınlaşırken imlecin altındaki zemin noktası ekranda yerinde kalır, kamera o noktaya doğru
// kayar. Ufka yakın bakışta ışın çok uzağa düşer, nokta bakış merkezinden en fazla ZOOM_PAN_REACH x mesafe uzakta
// sayılır. Uzaklaşırken kayma, yakınlaşma çarpanı 1'e dönerken aynı oranda söner: kamera merkeze doğru geri çekilir.
const ZOOM_PAN_REACH = 0.9;
// Sürükleyerek döndürme: piksel başına açı (radyan). Yatay sürükleme yörünge açısını, dikey sürükleme bakış yüksekliğini
// değiştirir. Yükseklik DRAG_MIN_ELEVATION ile DRAG_MAX_ELEVATION arasında: altında kadrajın üst kenarı ufka yaklaşır ve
// yakın çekimde çevredeki binalar kameraya girer. Bırakınca dönüş ataletle (DRAG_INERTIA, 1/sn) söner.
const DRAG_AZIMUTH_SPEED = 0.0035;
const DRAG_ELEVATION_SPEED = 0.0025;
const DRAG_MIN_ELEVATION = 22 * DEG;
const DRAG_MAX_ELEVATION = 70 * DEG;
const DRAG_INERTIA = 3.5;
// Mesafe hesabında denenen yörünge açıları: tesis dönüşün her anında kadrajda kalır.
const FOCUS_SAMPLES = 8;

/** Tesis kadrajında bakış noktası: zemin merkezi, yüksek tesislerde (banka kulesi) biraz yukarıda. */
function focusTarget(focus: CameraFocus) {
  return { x: (focus.x0 + focus.x1) / 2, y: focus.height * 0.3, z: (focus.z0 + focus.z1) / 2 };
}

/** Yaylı sönümle ilerleyen değer ve hızı. */
interface DampState {
  value: number;
  velocity: number;
}

/** Yaylı sönüm (kritik sönümlü): uçuş yarıda değişse de hız korunur, kamera sıçramaz. */
function smoothDamp(state: { value: number; velocity: number }, goal: number, smooth: number, dt: number) {
  const omega = 2 / smooth;
  const x = omega * dt;
  const decay = 1 / (1 + x + 0.48 * x * x + 0.235 * x * x * x);
  const change = state.value - goal;
  const temp = (state.velocity + omega * change) * dt;
  state.velocity = (state.velocity - omega * temp) * decay;
  state.value = goal + (change + temp) * decay;
}

/**
 * Ana sayfa kamerası. Boşta şehrin çevresinde dron gibi yavaşça döner, fareyle hafifçe kayar. Bir tesis seçilince
 * bulunduğu açıdan o tesise uçar ve çevresinde dönmeye devam eder, seçim kalkınca aynı açıdan şehre geri açılır.
 */
export class CameraDirector {
  private readonly camera: THREE.PerspectiveCamera;
  private readonly hero: Pose;
  private readonly pointer = new THREE.Vector2();
  private readonly pointerSmooth = new THREE.Vector2();
  private readonly idleOrbit: boolean;
  private readonly parallax: boolean;
  // Yörünge açısı hero açısına eklenir (sürekli artar), hız seçime göre yumuşakça değişir.
  private az = 0;
  private orbitSpeed = 0;
  private elapsed = 0;
  // Uçuşla değişen değerler: hedef (x, y, z), mesafe ve yükseklik açısı.
  private readonly tx = { value: 0, velocity: 0 };
  private readonly ty = { value: 0, velocity: 0 };
  private readonly tz = { value: 0, velocity: 0 };
  private readonly dist = { value: 0, velocity: 0 };
  private readonly el = { value: 0, velocity: 0 };
  private focus: CameraFocus | null = null;
  // Tekerlekle yakınlaşma çarpanı (1: yakınlaşma yok) ve ulaşmak istediği değer.
  private readonly zoom = { value: 1, velocity: 0 };
  private zoomGoal = 1;
  // İmlece yakınlaşmanın bakış noktasına eklediği kayma (dünya, metre). Yakınlaşmayla aynı yumuşaklıkta oturur,
  // böylece animasyon boyunca imlecin altındaki nokta yerinde kalır.
  private readonly pan: readonly [DampState, DampState, DampState] = [
    { value: 0, velocity: 0 },
    { value: 0, velocity: 0 },
    { value: 0, velocity: 0 },
  ];
  private readonly panGoal = new THREE.Vector3();
  private readonly zoomRay = new THREE.Raycaster();
  private readonly groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  private readonly zoomPoint = new THREE.Vector3();
  private readonly zoomCenter = new THREE.Vector3();
  // Sürükleme: bu kare biriken açı, bırakıldıktan sonra süren dönüş hızı (radyan/sn), kullanıcının yükseklik payı.
  private dragging = false;
  private dragPending = 0;
  private dragVelocity = 0;
  private elevationOffset = 0;
  // Görünümü sıfırlarken yörünge açısının döndüğü hedef (hero açısının en yakın turu) ve dönüş hızı.
  private azimuthReturn: { goal: number; velocity: number } | null = null;
  // Tesis kadrajının mesafesi ekran oranına bağlı: odak ya da oran değişince yeniden hesaplanır.
  private focusDistance = 0;
  private readonly probe = new THREE.PerspectiveCamera();
  private readonly targetVector = new THREE.Vector3();
  private aspect = POSTER_ASPECT;

  constructor(camera: THREE.PerspectiveCamera, config: CityConfig, options: { idleOrbit: boolean; parallax: boolean }) {
    const hero = poseFrom(config.hero.position, config.hero.target, config.hero.fov);
    hero.az += HERO_AZIMUTH_OFFSET;
    hero.dist *= HERO_DISTANCE_SCALE;
    hero.el = HERO_ELEVATION;
    hero.fov = HERO_FOV;
    // Kamerayı sağa çevir: hedef kameranın sağ vektörü yönünde kayar, sahne ekranda sola kayar, sol üstteki boşluk azalır.
    const side = hero.dist * HERO_SIDE_SHIFT;
    hero.target.x += Math.cos(hero.az) * side;
    hero.target.z -= Math.sin(hero.az) * side;
    this.camera = camera;
    this.hero = hero;
    this.az = hero.az;
    this.tx.value = hero.target.x;
    this.ty.value = hero.target.y;
    this.tz.value = hero.target.z;
    this.dist.value = hero.dist;
    this.el.value = hero.el;
    this.idleOrbit = options.idleOrbit;
    this.parallax = options.parallax;
    this.apply();
  }

  /** Hedefe gerçek uzaklık (dik ekranda geri çekilme dahil). */
  get distance() {
    return this.dist.value * this.zoom.value * this.pullback;
  }

  get target() {
    return this.targetVector;
  }

  /** Dik ekranda geri çekilme çarpanı. */
  private get pullback() {
    return this.aspect < 1 ? 1 + (1 - this.aspect) * PORTRAIT_PULLBACK : 1;
  }

  setAspect(aspect: number) {
    this.aspect = aspect;
    if (this.focus) this.focusDistance = this.fitDistance(this.focus);
    this.apply();
  }

  /** x ve y -1 ile 1 arasındadır. */
  setPointer(x: number, y: number) {
    this.pointer.set(x, y);
  }

  /**
   * Yakın çekim yapılacak tesis (null: şehrin geneli). Hareket azaltılmışsa kamera uçmaz, yeni kadraja geçer.
   * instant: uçuş olmadan geçiş.
   */
  setFocus(focus: CameraFocus | null, instant = false) {
    this.focus = focus;
    // Yeni kadraj hesaplanan mesafesiyle gelir, tekerlekle yakınlaşma ve imlece kayma sıfırlanır.
    this.zoomGoal = 1;
    this.panGoal.set(0, 0, 0);
    if (focus) this.focusDistance = this.fitDistance(focus);
    if (instant) {
      const goal = this.goal();
      for (const [state, value] of [
        [this.tx, goal.x],
        [this.ty, goal.y],
        [this.tz, goal.z],
        [this.dist, goal.dist],
        [this.el, goal.el],
        [this.zoom, 1],
        ...this.pan.map((state) => [state, 0] as const),
      ] as const) {
        state.value = value;
        state.velocity = 0;
      }
      this.apply();
    }
  }

  /**
   * Tekerlek hareketi (piksel, aşağı pozitif): aşağı yakınlaştırır, yukarı uzaklaştırır (kullanıcı isteğiyle ilk halinin
   * tersi). Başlangıç kadrajından ZOOM_MAX'a kadar uzaklaşılabilir. Sınıra dayanınca hareket kullanılmaz (false döner):
   * en yakındayken aşağı hareket sayfayı kaydırır, ziyaretçi hero'da takılmaz.
   * ndc: imlecin ekran konumu (-1..1). Verilirse yakınlaşma imlecin altındaki noktaya doğru yapılır.
   */
  zoomBy(deltaY: number, ndc?: THREE.Vector2) {
    const goal = this.goal();
    const floor = Math.max(ZOOM_MIN, ZOOM_FLOOR / Math.max(ZOOM_FLOOR, goal.dist));
    if (deltaY > 0 && this.zoomGoal <= floor + 1e-3) return false;
    if (deltaY < 0 && this.zoomGoal >= ZOOM_MAX - 1e-3) return false;
    const previous = this.zoomGoal;
    const next = THREE.MathUtils.clamp(previous * Math.exp(-deltaY * ZOOM_SENSITIVITY), floor, ZOOM_MAX);
    this.zoomGoal = next;
    if (next < previous) {
      if (ndc) this.panToward(ndc, goal, next / previous);
    } else if (next >= 1 || previous >= 1) {
      this.panGoal.set(0, 0, 0);
    } else {
      // Uzaklaşma: kayma, logaritmik yakınlaşma ölçeğinde 1'e kalan yol oranında küçülür (1'de sıfır).
      this.panGoal.multiplyScalar(Math.log(next) / Math.log(previous));
    }
    return true;
  }

  /**
   * Bakış noktasını imlecin altındaki zemin noktasına doğru kaydırır. Kamera ve bakış noktası birlikte o nokta
   * etrafında k oranında ölçeklenince nokta ekranda yerinde kalır: yeni merkez = P + (merkez - P) x k.
   */
  private panToward(ndc: THREE.Vector2, goal: { x: number; y: number; z: number; dist: number }, k: number) {
    this.zoomRay.setFromCamera(ndc, this.camera);
    const point = this.zoomRay.ray.intersectPlane(this.groundPlane, this.zoomPoint);
    if (!point) return;
    const center = this.zoomCenter.set(goal.x, goal.y, goal.z).add(this.panGoal);
    // Ufka yakın ışınlar çok uzağa düşer: nokta merkezden belirli bir uzaklıkla sınırlanır.
    const reach = goal.dist * this.zoomGoal * this.pullback * ZOOM_PAN_REACH;
    const offset = point.sub(center);
    if (offset.length() > reach) offset.setLength(reach);
    // Yeni merkez = P + (merkez - P) x k = merkez + (P - merkez) x (1 - k)
    this.panGoal.addScaledVector(offset, 1 - k);
  }

  /** Sürükleme başlar: otomatik dönüş durur, önceki sürüklemenin ataleti ve görünüm sıfırlama dönüşü kesilir. */
  beginDrag() {
    this.dragging = true;
    this.dragVelocity = 0;
    this.azimuthReturn = null;
  }

  /**
   * İlk kadraja dönüş: yakınlaşma ve bakış yüksekliği sıfırlanır, kamera en kısa yönden hero açısına süzülür, sonra
   * otomatik dönüş yeniden yavaşça başlar. Odak (seçili tesis) ayrıca kaldırılır (setFocus). instant: süzülmeden.
   */
  resetView(instant = false) {
    this.zoomGoal = 1;
    this.panGoal.set(0, 0, 0);
    this.elevationOffset = 0;
    this.dragVelocity = 0;
    this.dragPending = 0;
    this.orbitSpeed = 0;
    this.elapsed = 0;
    const turn = Math.PI * 2;
    const goal = this.hero.az + Math.round((this.az - this.hero.az) / turn) * turn;
    if (instant) {
      this.az = goal;
      this.azimuthReturn = null;
      this.zoom.value = 1;
      this.zoom.velocity = 0;
      for (const state of this.pan) {
        state.value = 0;
        state.velocity = 0;
      }
      this.apply();
    } else {
      this.azimuthReturn = { goal, velocity: 0 };
    }
  }

  /** Sürükleme hareketi (piksel). Sağa sürüklemek şehri sağa, aşağı sürüklemek kamerayı yukarı taşır (dünyayı tutup çevirmek gibi). */
  dragBy(dx: number, dy: number) {
    this.dragPending -= dx * DRAG_AZIMUTH_SPEED;
    const base = this.focus ? FOCUS_ELEVATION : this.hero.el;
    this.elevationOffset = THREE.MathUtils.clamp(
      this.elevationOffset + dy * DRAG_ELEVATION_SPEED,
      DRAG_MIN_ELEVATION - base,
      DRAG_MAX_ELEVATION - base,
    );
  }

  /** Sürükleme biter: dönüş ataletle yavaşlar, otomatik dönüş yumuşakça geri gelir. */
  endDrag() {
    this.dragging = false;
    if (!this.idleOrbit) this.dragVelocity = 0;
  }

  private goal() {
    const { focus, hero } = this;
    const el = (base: number) =>
      THREE.MathUtils.clamp(base + this.elevationOffset, DRAG_MIN_ELEVATION, DRAG_MAX_ELEVATION);
    if (!focus) return { x: hero.target.x, y: hero.target.y, z: hero.target.z, dist: hero.dist, el: el(hero.el) };
    return { ...focusTarget(focus), dist: this.focusDistance, el: el(FOCUS_ELEVATION) };
  }

  /**
   * Tesisin (zemini ve yüksekliğiyle kutu) yörüngenin her açısında kadrajın FOCUS_FILL payına sığdığı en kısa mesafe.
   * İkili arama, örnek açılarda kutunun köşeleri ekrana izdüşürülür. Dik ekrandaki geri çekilme sonradan eklendiği
   * için mesafe ondan arındırılmış döner.
   */
  private fitDistance(focus: CameraFocus) {
    const { probe } = this;
    probe.fov = coverFov(this.hero.fov, this.aspect);
    probe.aspect = this.aspect;
    probe.near = 1;
    probe.far = 30000;
    probe.updateProjectionMatrix();
    const target = focusTarget(focus);
    const lookAt = new THREE.Vector3(target.x, target.y, target.z);
    const corner = new THREE.Vector3();
    const extent = (dist: number) => {
      let worst = 0;
      for (let i = 0; i < FOCUS_SAMPLES; i++) {
        const az = (i / FOCUS_SAMPLES) * Math.PI * 2;
        probe.position.set(
          lookAt.x + dist * Math.cos(FOCUS_ELEVATION) * Math.sin(az),
          lookAt.y + dist * Math.sin(FOCUS_ELEVATION),
          lookAt.z + dist * Math.cos(FOCUS_ELEVATION) * Math.cos(az),
        );
        probe.lookAt(lookAt);
        probe.updateMatrixWorld();
        for (const x of [focus.x0, focus.x1])
          for (const z of [focus.z0, focus.z1])
            for (const y of [0, focus.height]) {
              corner.set(x, y, z).project(probe);
              worst = Math.max(worst, Math.abs(corner.x), Math.abs(corner.y));
            }
      }
      return worst;
    };
    // Dik ekranda sınırlar da geri çekilmeyle büyür (telefonda büyük tesisler yine de kadrajdan taşabilir).
    let near = FOCUS_MIN_DISTANCE * this.pullback;
    let far = FOCUS_MAX_DISTANCE * this.pullback;
    if (extent(near) <= FOCUS_FILL) return near / this.pullback;
    for (let step = 0; step < 18; step++) {
      const mid = (near + far) / 2;
      if (extent(mid) > FOCUS_FILL) near = mid;
      else far = mid;
    }
    return far / this.pullback;
  }

  update(delta: number) {
    const dt = Math.min(delta, 0.1);
    this.pointerSmooth.lerp(this.pointer, 1 - Math.exp(-dt * 2.5));
    // Görünüm sıfırlanırken açı yaylı sönümle hero açısına döner, otomatik dönüş beklemede.
    if (this.azimuthReturn) {
      const state = { value: this.az, velocity: this.azimuthReturn.velocity };
      smoothDamp(state, this.azimuthReturn.goal, FLIGHT_SMOOTH, dt);
      this.az = state.value;
      this.azimuthReturn.velocity = state.velocity;
      if (Math.abs(this.azimuthReturn.goal - this.az) < 1e-3 && Math.abs(state.velocity) < 1e-3) {
        this.azimuthReturn = null;
        this.elapsed = 0;
      }
    }
    // Sürüklenirken açı doğrudan elle değişir, hız son karelerden ölçülür. Bırakınca o hızla sönerek döner.
    if (this.dragging) {
      this.az += this.dragPending;
      if (dt > 0) this.dragVelocity += (this.dragPending / dt - this.dragVelocity) * 0.5;
    } else if (this.dragVelocity !== 0) {
      this.az += this.dragVelocity * dt;
      this.dragVelocity *= Math.exp(-dt * DRAG_INERTIA);
      if (Math.abs(this.dragVelocity) < 1e-4) this.dragVelocity = 0;
    }
    this.dragPending = 0;
    if (this.idleOrbit) {
      this.elapsed += dt;
      const auto = this.dragging || this.azimuthReturn ? 0 : this.focus ? FOCUS_ORBIT_SPEED : ORBIT_SPEED;
      const speed = auto * Math.min(1, this.elapsed * ORBIT_EASE_IN);
      this.orbitSpeed += (speed - this.orbitSpeed) * (1 - Math.exp(-dt * 1.5));
      this.az += this.orbitSpeed * dt;
    }
    const goal = this.goal();
    smoothDamp(this.tx, goal.x, FLIGHT_SMOOTH, dt);
    smoothDamp(this.ty, goal.y, FLIGHT_SMOOTH, dt);
    smoothDamp(this.tz, goal.z, FLIGHT_SMOOTH, dt);
    smoothDamp(this.dist, goal.dist, FLIGHT_SMOOTH * 1.15, dt);
    smoothDamp(this.el, goal.el, FLIGHT_SMOOTH * 1.15, dt);
    smoothDamp(this.zoom, this.zoomGoal, ZOOM_SMOOTH, dt);
    smoothDamp(this.pan[0], this.panGoal.x, ZOOM_SMOOTH, dt);
    smoothDamp(this.pan[1], this.panGoal.y, ZOOM_SMOOTH, dt);
    smoothDamp(this.pan[2], this.panGoal.z, ZOOM_SMOOTH, dt);
    this.apply();
  }

  private apply() {
    const { camera } = this;
    const dist = this.distance;
    const px = this.parallax ? this.pointerSmooth.x * 0.018 : 0;
    const py = this.parallax ? this.pointerSmooth.y * 0.01 : 0;
    const az = this.az + px;
    const el = this.el.value + py;
    const target = this.targetVector.set(
      this.tx.value + this.pan[0].value,
      this.ty.value + this.pan[1].value,
      this.tz.value + this.pan[2].value,
    );
    camera.position.set(
      target.x + dist * Math.cos(el) * Math.sin(az),
      target.y + dist * Math.sin(el),
      target.z + dist * Math.cos(el) * Math.cos(az),
    );
    camera.fov = coverFov(this.hero.fov, this.aspect);
    // Parsel zeminleri birbirinden yalnızca 2-5 cm yukarıda: yakın düzlem olabildiğince uzakta tutulur, derinlik
    // hassasiyeti artar. 0.22 x mesafe 2 km'de ~1 mm hassasiyet verir. NEAR_FADE_DISTANCE'ın altında oran mesafeyle
    // küçülür (360 m'de ~0.165): yakın çekimde çevredeki kuleler kesilmez.
    camera.near = Math.max(1, dist * NEAR_RATIO * Math.min(1, dist / NEAR_FADE_DISTANCE));
    camera.far = dist + 14000;
    camera.lookAt(target);
    camera.updateProjectionMatrix();
  }
}
