// Sera şubesinin yeniden düzenlenmesi (A3 bloğu, alan x -390..-177, z -243..-67, çit x -385..-182, z -238..-72).
// Modeldeki şube 207×170 m'lik tek renk haki bir plakanın üstünde tek parça bir cam kutudan (14 tonoz, her biri 8 üçgen,
// uç kalkanı yok), içinde 150 m boyunca kesintisiz doygun yeşil şeritlerden ve bir sıra silodan oluşuyordu. Yol, bina,
// su, ağaç ve araç olmadığı için ölçek ipucu yoktu, kameraya en yakın tesis olarak maket parçası gibi okunuyordu.
// Model değişmeden açılışta yeniden kurulur (gerçek bir ticari sera işletmesi gibi):
// - Cam sera (Venlo tipi): 4 m'lik 28 sırt, batı bölmesi açık cam ve domates sıraları, doğu bölmesi kireçle gölgelenmiş
//   süt beyazı cam ve fide masaları, ortada beton koridor. İnce çelik oluk, mahya ve aşıklar.
// - Bina: seraya bitişik paketleme holü, köşede iki katlı idare binası, doğuda bacalı enerji binası. Şehir binalarıyla aynı
//   kütle ve cephe işçiliği (cityMass.ts, CITY_FACE, CITY_PALETTE).
// - Zemin (shader): güneyde servis avlusu ve yükleme rampası, personel otoparkı, idare önünde taş döşeme, serayı çevreleyen
//   servis yolları, yağmur suyu havuzu, saksı fidanlığı, silo ve tank plakaları, çit bitkisi.
// - Silolar ve tanklar korunur (ısı tamponu ve su deposu). Rampada kamyonlar, otoparkta arabalar, palet ve ürün arabaları,
//   substrat bölmeleri, pompa evi, CO2 tankı. Kuzey ve doğu kenarında rüzgâr kıran ağaçlar, avlu ve yollar boyunca lambalar.
// Yerleşim planı aşağıdaki sabitlerde tek yerde tanımlanır. GLSL ve TypeScript tarafı aynı ölçüleri kullanır.
import * as THREE from 'three';
import { MassBuilder, PropBuilder, type VehicleSpot, parkedVehicles } from './cityMass';
import { type TreeSpot, crownRadius, hash2, replantTrees } from './cityTrees';

interface Box {
  x0: number;
  x1: number;
  z0: number;
  z1: number;
}

const SITE: Box = { x0: -390, x1: -177, z0: -243, z1: -67 };
const FENCE: Box = { x0: -385, x1: -182, z0: -238, z1: -72 };
// Zemin yüksekliği (Greenhouse_Ground_Site) ve binaların oturduğu taban.
const GROUND_Y = 0.75;
const BASE_Y = 0.45;

// Cam sera: x boyunca 4 m'lik sırtlar (mahyalar kuzey-güney), batı yarısı açık, doğu yarısı gölgeli cam.
const GLASS: Box = { x0: -375, x1: -263, z0: -226, z1: -125 };
const SPAN = 4;
const SPLIT_X = -319;
const GUTTER = 6.0;
const RIDGE = 6.8;
// Seranın içinde doğu-batı beton koridor.
const CORRIDOR = { z: -175.5, half: 2 };

// Binalar.
const HALL: Box & { height: number } = { x0: -375, x1: -303, z0: -125, z1: -105, height: 9 };
const OFFICE: Box & { height: number } = { x0: -303, x1: -283, z0: -121, z1: -99, height: 8.6 };
const ENERGY: Box & { height: number } = { x0: -252, x1: -238, z0: -159, z1: -145, height: 7 };

// Zemin bölgeleri.
const YARD: Box = { x0: -382, x1: -303, z0: -105, z1: -74.5 };
const FORECOURT: Box = { x0: -303, x1: -280, z0: -99, z1: -74.5 };
const PARKING: Box = { x0: -277, x1: -235, z0: -94, z1: -75.5 };
const WEST_ROAD: Box = { x0: -382, x1: -377.5, z0: -230, z1: -105 };
const EAST_ROAD: Box = { x0: -260.5, x1: -256, z0: -230, z1: -94 };
const LINK_ROAD: Box = { x0: -256, x1: -230, z0: -168, z1: -163.5 };
const SILO_SLAB: Box = { x0: -230, x1: -209, z0: -237, z1: -144 };
const TANK_SLAB: Box = { x0: -212, x1: -188, z0: -129, z1: -75 };
const BASIN: Box = { x0: -252, x1: -234, z0: -226, z1: -172 };
const NURSERY: Box = { x0: -252, x1: -216, z0: -139, z1: -104 };
// Sokağa açılan girişler (çit bitkisinde boşluk, döşeme kaldırıma kadar uzanır).
const GATES: Box[] = [
  { x0: -352, x1: -332, z0: -76, z1: -69 },
  { x0: -298, x1: -288, z0: -76, z1: -69 },
  { x0: -262, x1: -250, z0: -77, z1: -69 },
];

// Yükleme rampası: kamyon merkezleri (x), rampa saçağı.
const DOCKS = [-359, -345, -331];
const CANOPY: Box = { x0: -369, x1: -309, z0: -105, z1: -99 };
// Otopark: x boyunca 2.6 m'lik yerler, iki sıra (kuzey sıra, ara yol, güney sıra).
const BAY = 2.6;
const ROWS = [
  { z0: -93.5, z1: -88, facing: 1 },
  { z0: -81.5, z1: -76, facing: -1 },
];

// Korunan silolar ve tanklar (modeldeki yerleri, ağaç ve lamba yerleşimi için).
const SILOS = [-227, -207, -187, -167].map((z) => ({ x: -220, z, r: 6.3 }));
const TANKS = [-117, -87].map((z) => ({ x: -200, z, r: 9.8 }));

const f = (value: number) => value.toFixed(2);
const box = (b: Box) => `vec2(${f((b.x0 + b.x1) / 2)}, ${f((b.z0 + b.z1) / 2)}), vec2(${f((b.x1 - b.x0) / 2)}, ${f((b.z1 - b.z0) / 2)})`;

/** Sera planının mesafe fonksiyonları (GLSL, global kapsamda). */
export const GREENHOUSE_GLSL = `
// Köşeleri r yarıçapla yuvarlatılmış kutuya işaretli uzaklık (içeride negatif).
float ghBox(vec2 p, vec2 c, vec2 h, float r){ vec2 q = abs(p - c) - h + r; return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r; }
float ghIn(float d, float aa){ return 1.0 - smoothstep(-aa, aa, d); }
// Çizgi deseni: periyodik ince şerit (genişlik w, periyot t), piksel altına inince ortalamaya söner.
float ghLines(float v, float t, float w){ float d = abs(fract(v / t) - 0.5) * t; float a = max(fwidth(v), 1e-4); return mix(w / t, 1.0 - smoothstep(w * 0.5 - a, w * 0.5 + a, d), 1.0 - smoothstep(0.15 * w, 0.5 * w, a)); }
`;

/** Sera zemini: Greenhouse_Ground_Site'ın rengi tamamen dünya konumundan çizilir (köşe renkleri yok sayılır). */
export const GREENHOUSE_FRAGMENT = `#include <color_fragment>
  {
    vec2 p = vWPos.xz;
    float aa = max(fwidth(p.x), fwidth(p.y)) * 0.8 + 0.05;
    float fine = 1.0 - smoothstep(0.8, 2.5, aa);
    float n1 = fbm(p * 0.02);
    float n2 = fbm(p * 0.09 + 3.0);
    float grain = 0.94 + 0.12 * h12(floor(p * 3.0)) * fine;
    vec3 concrete = vec3(0.47, 0.46, 0.43) * (0.9 + 0.2 * n2) * grain;
    vec3 asphalt = vec3(0.2, 0.195, 0.19) * (0.88 + 0.24 * n2);
    vec3 gravel = vec3(0.5, 0.46, 0.38) * (0.9 + 0.2 * n2) * grain;
    vec3 curb = vec3(0.55, 0.53, 0.5);

    // Çim: parktaki gibi biçme şeritleri ve geniş ton farkları.
    vec3 c = vec3(0.12, 0.19, 0.065) * (0.82 + 0.36 * n1);
    c *= 1.0 + (step(0.5, fract((p.x + p.y * 0.2) / 9.0)) - 0.5) * 0.12 * (1.0 - smoothstep(2.0, 5.0, aa));

    // Çit boyunca çit bitkisi, sokağa açılan girişlerde boşluk.
    float edge = min(min(p.x - ${f(FENCE.x0)}, ${f(FENCE.x1)} - p.x), min(p.y - ${f(FENCE.z0)}, ${f(FENCE.z1)} - p.y));
    float gate = 0.0;
    ${GATES.map((g) => `gate = max(gate, step(${f(g.x0)}, p.x) * step(p.x, ${f(g.x1)}) * step(${f(g.z0 - 2)}, p.y));`).join('\n    ')}
    float hedge = ghIn(edge - 2.4 + (n2 - 0.5) * 0.8, aa) * (1.0 - gate);
    c = mix(c, vec3(0.055, 0.095, 0.035) * (0.7 + 0.6 * fbm(p * 0.45)), hedge);

    // Seranın çevresinde beton şerit, içinde beyaz zemin örtüsü ve beton koridor.
    float gd = ghBox(p, ${box(GLASS)}, 0.0);
    c = mix(c, concrete, ghIn(gd - 1.2, aa));
    vec3 cover = vec3(0.6, 0.6, 0.57) * grain * (0.94 + 0.08 * n2);
    cover = mix(cover, concrete, ghIn(abs(p.y - ${f(CORRIDOR.z)}) - ${f(CORRIDOR.half)}, aa));
    c = mix(c, cover, ghIn(gd, aa));

    // Servis yolları: batıda çakıl, doğuda ve silolara giden kolda asfalt.
    c = mix(c, gravel, ghIn(ghBox(p, ${box(WEST_ROAD)}, 0.3), aa));
    float road = min(ghBox(p, ${box(EAST_ROAD)}, 0.3), ghBox(p, ${box(LINK_ROAD)}, 0.3));
    c = mix(c, asphalt, ghIn(road, aa));

    // Silo ve tank plakaları: 4 m derzli beton.
    vec2 jc = abs(fract(p / 4.0) - 0.5) * 2.0;
    float joint = smoothstep(0.9, 0.96, max(jc.x, jc.y)) * fine;
    float slab = min(ghBox(p, ${box(SILO_SLAB)}, 0.5), ghBox(p, ${box(TANK_SLAB)}, 0.5));
    c = mix(c, concrete * (1.0 - 0.15 * joint), ghIn(slab, aa));

    // Servis avlusu: asfalt, rampa önünde kamyon yerlerini ayıran açık çizgiler, girişlerde kaldırıma uzanan döşeme.
    float yard = min(ghBox(p, ${box(YARD)}, 0.5), ghBox(p, ${box(PARKING)}, 0.5));
    ${GATES.map((g) => `yard = min(yard, ghBox(p, ${box(g)}, 0.3));`).join('\n    ')}
    vec3 tar = asphalt * (1.0 - 0.08 * smoothstep(0.55, 0.8, fbm(p * 0.3)));
    float dockLine = 0.0;
    ${DOCKS.map((x) => `dockLine = max(dockLine, ghIn(abs(abs(p.x - ${f(x)}) - 2.6) - 0.08, aa) * step(${f(CANOPY.z1 - 6)}, p.y) * step(p.y, -84.0));`).join('\n    ')}
    tar = mix(tar, vec3(0.62, 0.57, 0.42), dockLine * fine);
    // Otopark yerleri: sıraların içinde 2.6 m arayla çizgiler.
    float bays = 0.0;
    ${ROWS.map((r) => `bays = max(bays, ghLines(p.x - ${f(PARKING.x0)}, ${f(BAY)}, 0.12) * step(${f(PARKING.x0)}, p.x) * step(p.x, ${f(PARKING.x1)}) * step(${f(r.z0)}, p.y) * step(p.y, ${f(r.z1)}));`).join('\n    ')}
    tar = mix(tar, vec3(0.7, 0.68, 0.64), bays * fine * 0.85);
    c = mix(c, tar, ghIn(yard, aa));
    c = mix(c, curb, ghIn(abs(yard) - 0.2, aa) * fine * 0.8);

    // İdare binasının önü: taş döşeme, 1.5 m derzler.
    vec2 sj = abs(fract(p / 1.5) - 0.5) * 2.0;
    float stone = smoothstep(0.86, 0.94, max(sj.x, sj.y)) * fine;
    c = mix(c, vec3(0.53, 0.5, 0.45) * grain * (1.0 - 0.12 * stone), ghIn(ghBox(p, ${box(FORECOURT)}, 1.0), aa));

    // Yağmur suyu havuzu: beton kenar, koyu kaplama (üstünde su yüzeyi ayrı mesh).
    float bd = ghBox(p, ${box(BASIN)}, 2.0);
    c = mix(c, vec3(0.07, 0.09, 0.09), ghIn(bd, aa));
    c = mix(c, concrete, ghIn(abs(bd) - 1.0, aa));

    // Saksı fidanlığı: çakıl üstünde 1.6 m'lik yataklar, her 6 m'lik parça kendi bitkisi. Uzakta ortalama ton.
    float nd = ghBox(p, ${box(NURSERY)}, 0.8);
    float bedRow = floor((p.y - ${f(NURSERY.z0)}) / 2.4);
    float bedV = fract((p.y - ${f(NURSERY.z0)}) / 2.4);
    float bedAa = max(fwidth(bedV), 1e-4);
    float bedMask = mix(0.66, smoothstep(0.17 - bedAa, 0.17 + bedAa, bedV) * (1.0 - smoothstep(0.83 - bedAa, 0.83 + bedAa, bedV)), fine);
    float bk = h12(vec2(bedRow, floor(p.x / 6.0)) + 2.3);
    vec3 plant = bk < 0.55 ? vec3(0.1, 0.17, 0.07) : bk < 0.75 ? vec3(0.18, 0.24, 0.09) : bk < 0.88 ? vec3(0.42, 0.26, 0.26) : vec3(0.5, 0.42, 0.2);
    // Saksılar tek tek: 0.6 m'lik benek (yakında seçilir).
    plant *= 0.8 + 0.4 * h12(floor(p / 0.6)) * fine + 0.2 * n2;
    vec3 nursery = mix(gravel, plant, bedMask * ghIn(nd + 1.2, aa));
    c = mix(c, nursery, ghIn(nd, aa));

    diffuseColor.rgb = c;
  }`;

// ------------------------------------------------------------------ cam sera

/** Saydam kabuk: çokgenler dış yüze göre çevrilir (tek yüzlü cam). */
class ShellBuilder {
  private readonly positions: number[] = [];
  private readonly normals: number[] = [];

  polygon(points: THREE.Vector3[], outward: THREE.Vector3) {
    let normal = points[1].clone().sub(points[0]).cross(points[2].clone().sub(points[0])).normalize();
    const ordered = normal.dot(outward) < 0 ? [...points].reverse() : points;
    if (ordered !== points) normal = normal.negate();
    for (let i = 1; i < ordered.length - 1; i++) {
      for (const point of [ordered[0], ordered[i], ordered[i + 1]]) {
        this.positions.push(point.x, point.y, point.z);
        this.normals.push(normal.x, normal.y, normal.z);
      }
    }
  }

  build() {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(this.positions, 3));
    geometry.setAttribute('normal', new THREE.Float32BufferAttribute(this.normals, 3));
    return geometry;
  }
}

const v3 = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
const SPANS = Math.round((GLASS.x1 - GLASS.x0) / SPAN);

/** Açık cam (duvarlar ve batı çatısı) ve gölgeli cam (doğu çatısı) kabukları. */
function glassGeometries() {
  const clear = new ShellBuilder();
  const shaded = new ShellBuilder();
  const g = GROUND_Y + GUTTER;
  const r = GROUND_Y + RIDGE;
  const wallBase = GROUND_Y + 0.5;
  const slope = (RIDGE - GUTTER) / (SPAN / 2);
  for (let i = 0; i < SPANS; i++) {
    const a = GLASS.x0 + i * SPAN;
    const m = a + SPAN / 2;
    const b = a + SPAN;
    const roof = m < SPLIT_X ? clear : shaded;
    roof.polygon([v3(a, g, GLASS.z0), v3(m, r, GLASS.z0), v3(m, r, GLASS.z1), v3(a, g, GLASS.z1)], v3(-slope, 1, 0));
    roof.polygon([v3(m, r, GLASS.z0), v3(b, g, GLASS.z0), v3(b, g, GLASS.z1), v3(m, r, GLASS.z1)], v3(slope, 1, 0));
    // Uç kalkanları (testere dişi). Güneyde paketleme holünün arkasında kalan kısım çizilmez.
    clear.polygon([v3(a, g, GLASS.z0), v3(b, g, GLASS.z0), v3(m, r, GLASS.z0)], v3(0, 0, -1));
    if (a >= HALL.x1) clear.polygon([v3(a, g, GLASS.z1), v3(b, g, GLASS.z1), v3(m, r, GLASS.z1)], v3(0, 0, 1));
  }
  // Yan duvarlar: alçak beton duvarın üstünden oluğa kadar.
  clear.polygon([v3(GLASS.x0, wallBase, GLASS.z0), v3(GLASS.x1, wallBase, GLASS.z0), v3(GLASS.x1, g, GLASS.z0), v3(GLASS.x0, g, GLASS.z0)], v3(0, 0, -1));
  clear.polygon([v3(HALL.x1, wallBase, GLASS.z1), v3(GLASS.x1, wallBase, GLASS.z1), v3(GLASS.x1, g, GLASS.z1), v3(HALL.x1, g, GLASS.z1)], v3(0, 0, 1));
  clear.polygon([v3(GLASS.x0, wallBase, GLASS.z0), v3(GLASS.x0, wallBase, GLASS.z1), v3(GLASS.x0, g, GLASS.z1), v3(GLASS.x0, g, GLASS.z0)], v3(-1, 0, 0));
  clear.polygon([v3(GLASS.x1, wallBase, GLASS.z0), v3(GLASS.x1, wallBase, GLASS.z1), v3(GLASS.x1, g, GLASS.z1), v3(GLASS.x1, g, GLASS.z0)], v3(1, 0, 0));
  return { clear: clear.build(), shaded: shaded.build() };
}

// Kırık tonlar: şehrin paletinden kopmayan, doygunluğu düşük renkler.
const TONE = {
  steel: '#c3c6c8',
  darkSteel: '#7d8184',
  plinth: '#aeaba4',
  tomato: '#4a6340',
  tomatoB: '#566e47',
  bench: '#7f9062',
  benchPink: '#a88684',
  benchOchre: '#b39f6a',
  wood: '#a88a68',
  sage: '#7d8f6e',
  white: '#e3dfd6',
  concrete: '#9d9a93',
  soot: '#3d3b39',
  peat: '#5a4636',
  compost: '#45372b',
  perlite: '#cbc5b6',
};

/** Seranın çelik iskeleti: oluklar, mahyalar, aşıklar, dikmeler ve alçak beton duvar. */
function frameGeometry() {
  const props = new PropBuilder();
  const g = GROUND_Y + GUTTER;
  const r = GROUND_Y + RIDGE;
  for (let i = 0; i <= SPANS; i++) {
    const x = GLASS.x0 + i * SPAN;
    props.box(x - 0.15, x + 0.15, g - 0.3, g + 0.04, GLASS.z0, GLASS.z1, TONE.steel);
    if (i < SPANS) props.box(x + SPAN / 2 - 0.06, x + SPAN / 2 + 0.06, r - 0.1, r + 0.03, GLASS.z0, GLASS.z1, TONE.steel);
  }
  // Aşıklar ve dikmeler ~5 m arayla.
  const bays = Math.round((GLASS.z1 - GLASS.z0) / 5);
  for (let k = 0; k <= bays; k++) {
    const z = GLASS.z0 + ((GLASS.z1 - GLASS.z0) * k) / bays;
    props.box(GLASS.x0, GLASS.x1, g - 0.65, g - 0.45, z - 0.08, z + 0.08, TONE.steel);
    for (const x of [GLASS.x0, GLASS.x1]) props.box(x - 0.12, x + 0.12, GROUND_Y, g, z - 0.12, z + 0.12, TONE.steel);
  }
  for (let i = 0; i <= SPANS; i++) {
    const x = GLASS.x0 + i * SPAN;
    props.box(x - 0.12, x + 0.12, GROUND_Y, g, GLASS.z0 - 0.12, GLASS.z0 + 0.12, TONE.steel);
    if (x >= HALL.x1) props.box(x - 0.12, x + 0.12, GROUND_Y, g, GLASS.z1 - 0.12, GLASS.z1 + 0.12, TONE.steel);
  }
  // Alçak beton duvar (camın altında).
  const w = 0.15;
  const top = GROUND_Y + 0.5;
  props.box(GLASS.x0 - w, GLASS.x1 + w, GROUND_Y - 0.1, top, GLASS.z0 - w, GLASS.z0 + w, TONE.plinth);
  props.box(HALL.x1, GLASS.x1 + w, GROUND_Y - 0.1, top, GLASS.z1 - w, GLASS.z1 + w, TONE.plinth);
  props.box(GLASS.x0 - w, GLASS.x0 + w, GROUND_Y - 0.1, top, GLASS.z0, GLASS.z1, TONE.plinth);
  props.box(GLASS.x1 - w, GLASS.x1 + w, GROUND_Y - 0.1, top, GLASS.z0, GLASS.z1, TONE.plinth);
  return props;
}

/** Ürün: batıda tel üstünde yükselen domates sıraları, doğuda fide masaları. Koridorda kesilir. */
function cropsGeometry() {
  const props = new PropBuilder();
  const y = GROUND_Y;
  const segments: [number, number][] = [
    [GLASS.z0 + 1.5, CORRIDOR.z - CORRIDOR.half - 0.6],
    [CORRIDOR.z + CORRIDOR.half + 0.6, GLASS.z1 - 1.5],
  ];
  for (let x = GLASS.x0 + 1.6; x < SPLIT_X - 0.8; x += 1.6) {
    const tone = hash2(x, 3) < 0.5 ? TONE.tomato : TONE.tomatoB;
    for (const [z0, z1] of segments) props.box(x - 0.3, x + 0.3, y, y + 2.6, z0, z1, tone);
  }
  // Fide masaları: her masa uzunluğunca birkaç parti (yeşil fide, soluk pembe ve aşı sarısı çiçekli saksılar).
  for (let x = SPLIT_X + 1.6; x < GLASS.x1 - 1.4; x += 2.5) {
    for (const [z0, z1] of segments) {
      const parts = 4;
      for (let k = 0; k < parts; k++) {
        const a = z0 + ((z1 - z0) * k) / parts;
        const b = z0 + ((z1 - z0) * (k + 1)) / parts - 0.4;
        const h = hash2(x * 0.7, k + z0);
        const tone = h < 0.62 ? TONE.bench : h < 0.82 ? TONE.benchPink : TONE.benchOchre;
        props.box(x - 0.9, x + 0.9, y, y + 0.95, a, b, tone);
      }
    }
  }
  return props;
}

/** Dış parçalar: yükleme saçağı, paletler, ürün arabaları, substrat bölmeleri, pompa evi, CO2 tankı, baca, havuz kenarı. */
function yardGeometry(props: PropBuilder) {
  const y = GROUND_Y;
  // Rampa saçağı: holün güney cephesinden çıkan ince çatı ve dikmeler.
  props.box(CANOPY.x0, CANOPY.x1, y + 5.8, y + 6.1, CANOPY.z0, CANOPY.z1, TONE.darkSteel);
  for (let x = CANOPY.x0 + 3; x <= CANOPY.x1 - 2; x += 14) {
    props.box(x - 0.15, x + 0.15, y, y + 5.8, CANOPY.z1 - 0.5, CANOPY.z1 - 0.2, TONE.darkSteel);
  }
  // Holün batı ucunda palet yığınları, doğu ucunda ürün arabaları.
  for (let i = 0; i < 4; i++) {
    const x = YARD.x0 + 3 + i * 1.9;
    const h = 0.9 + 0.7 * hash2(i, 7);
    props.box(x, x + 1.2, y, y + h, CANOPY.z0 + 1, CANOPY.z0 + 2, TONE.wood);
    props.box(x, x + 1.2, y, y + h * 0.7, CANOPY.z0 + 2.6, CANOPY.z0 + 3.6, TONE.wood);
  }
  for (let i = 0; i < 6; i++) {
    const x = CANOPY.x1 + 1 + (i % 3) * 1.8;
    const z = CANOPY.z0 + 1.2 + Math.floor(i / 3) * 2.2;
    props.box(x, x + 1.4, y, y + 1.9, z, z + 0.6, TONE.sage);
  }
  // Substrat ve kompost bölmeleri: silo plakasının güneyinde üç yanı duvarlı üç bölme, içlerinde yığın.
  const bayW = (SILO_SLAB.x1 - SILO_SLAB.x0 - 4) / 3;
  const z0 = -155;
  const z1 = -147;
  const fills = [TONE.peat, TONE.compost, TONE.perlite];
  for (let i = 0; i < 3; i++) {
    const a = SILO_SLAB.x0 + 2 + i * bayW;
    props.box(a, a + 0.4, y, y + 2.2, z0, z1, TONE.concrete);
    props.box(a, a + bayW, y, y + 2.2, z0, z0 + 0.4, TONE.concrete);
    props.box(a + 0.7, a + bayW - 0.5, y, y + 1.1 + 0.4 * hash2(i, 9), z0 + 0.8, z1 - 1.5, fills[i]);
  }
  const last = SILO_SLAB.x0 + 2 + 3 * bayW;
  props.box(last - 0.4, last, y, y + 2.2, z0, z1, TONE.concrete);
  // Pompa evi (havuzun kuzeyinde).
  props.box(-251, -246, y, y + 3.0, -235, -230, TONE.white);
  props.box(-251.3, -245.7, y + 3.0, y + 3.25, -235.3, -229.7, TONE.darkSteel);
  // Enerji binasının bacası ve yanında yatık CO2 tankı (beton kaideler üstünde).
  const chimney = { x: -237.5, z: -152 };
  props.cylinder(chimney.x, y, chimney.z, 0.75, 22, 'y', TONE.concrete, 10);
  props.cylinder(chimney.x, y + 22, chimney.z, 0.8, 1.6, 'y', TONE.soot, 10);
  for (const z of [-157, -151.5]) props.box(-234.6, -232.4, y, y + 0.9, z, z + 0.6, TONE.concrete);
  props.cylinder(-233.5, y + 2.0, -158, 1.25, 8, 'z', TONE.white, 12);
  // Havuzun beton kenarı (yüzey bu kenarın içinde).
  const b = BASIN;
  const t = 0.8;
  const ry = y + 0.3;
  props.box(b.x0 - t, b.x1 + t, y - 0.05, ry, b.z0 - t, b.z0, TONE.concrete);
  props.box(b.x0 - t, b.x1 + t, y - 0.05, ry, b.z1, b.z1 + t, TONE.concrete);
  props.box(b.x0 - t, b.x0, y - 0.05, ry, b.z0, b.z1, TONE.concrete);
  props.box(b.x1, b.x1 + t, y - 0.05, ry, b.z0, b.z1, TONE.concrete);
  return props;
}

// ------------------------------------------------------------------ binalar

// Duvar ve çatı paleti (FACADE_FRAGMENT eşikleriyle): hol ve enerji binası krem duvar ve açık membran çatı, idare kırık
// beyaz duvar ve yeşil çatı. Değerler kreşteki iki paletle aynı: her farklı değer ayrı bir cephe programı derletir, aynı
// değerler kreşin programını paylaşır (açılışta ek shader derlemesi yok).
const HALL_PALETTE = 'vec2(0.4, 0.7)';
const OFFICE_PALETTE = 'vec2(0.1, 0.9)';

function blockMatrix(b: Box, height: number) {
  const hy = height / 2;
  return new THREE.Matrix4().compose(
    new THREE.Vector3((b.x0 + b.x1) / 2, BASE_Y + hy, (b.z0 + b.z1) / 2),
    new THREE.Quaternion(),
    new THREE.Vector3((b.x1 - b.x0) / 2, hy, (b.z1 - b.z0) / 2),
  );
}

function buildingMeshes(source: THREE.Material) {
  const make = (name: string, geometry: THREE.BufferGeometry, palette: string, b: Box, height: number) => {
    const material = source.clone();
    material.defines = { ...material.defines, CITY_PALETTE: palette };
    const mesh = new THREE.InstancedMesh(geometry, material, 1);
    mesh.name = name;
    mesh.setMatrixAt(0, blockMatrix(b, height));
    return mesh;
  };
  // Hol: düz çatıda iki iklimlendirme kutusu.
  const hall = new MassBuilder().box(-1, 1, -1, 0.9, -1, 1).box(-0.7, -0.45, 0.9, 1, -0.5, 0.2).box(0.2, 0.45, 0.9, 1, -0.5, 0.2);
  // İdare: iki kat, çatıda tesisat kulesi.
  const office = new MassBuilder().box(-1, 1, -1, 0.88, -1, 1).box(-0.5, 0.1, 0.88, 1, -0.4, 0.3);
  const energy = new MassBuilder().box(-1, 1, -1, 1, -1, 1);
  return [
    make('Greenhouse_Hall', hall.build(), HALL_PALETTE, HALL, HALL.height),
    make('Greenhouse_Office', office.build(), OFFICE_PALETTE, OFFICE, OFFICE.height),
    make('Greenhouse_Energy', energy.build(), HALL_PALETTE, ENERGY, ENERGY.height),
  ];
}

// ------------------------------------------------------------------ araçlar

/** Otoparka arabalar, rampaya kamyonlar: şehrin park etmiş araçlarından örneklenir (parkedVehicles). */
function vehicleMeshes(cityRoot: THREE.Object3D) {
  const colors = ['White', 'Silver', 'Graphite', 'Blue'];
  const cars: VehicleSpot[][] = colors.map(() => []);
  ROWS.forEach((row, r) => {
    for (let k = 0; ; k++) {
      const x = PARKING.x0 + BAY * (k + 0.5);
      if (x > PARKING.x1 - BAY / 2) break;
      // Kuzey sırada doğu yolunun girdiği yer boş, otoparkın yaklaşık beşte biri boş.
      if (r === 0 && x > EAST_ROAD.x0 - 1.5 && x < EAST_ROAD.x1 + 1.5) continue;
      if (hash2(x, r + 11) < 0.22) continue;
      const h = hash2(x * 1.3, r + 5);
      const color = h < 0.38 ? 0 : h < 0.72 ? 1 : h < 0.9 ? 2 : 3;
      cars[color].push([x, (row.z0 + row.z1) / 2, (row.facing * Math.PI) / 2]);
    }
  });
  const meshes = colors.map((color, i) => parkedVehicles(cityRoot, `Cars_${color}`, 'Greenhouse', cars[i]));
  // Kamyonlar arkası rampaya dayalı, kasa uzunluğu ~12.3 m.
  meshes.push(parkedVehicles(cityRoot, 'Trucks', 'Greenhouse', DOCKS.map((x) => [x, CANOPY.z0 + 6.7, Math.PI / 2])));
  return meshes.filter((mesh) => mesh !== null);
}

// ------------------------------------------------------------------ ağaçlar ve lambalar

const inBox = (b: Box, x: number, z: number, pad = 0) => x > b.x0 - pad && x < b.x1 + pad && z > b.z0 - pad && z < b.z1 + pad;

// Ağaç dikilmeyen yerler. Yapılar, araçlar ve parçalar: ağacın tepesi üstlerine taşmaz. Yollar ve döşemeler: gövde
// uzakta, tepe kenara biraz taşabilir.
const SOLID: Box[] = [
  GLASS,
  HALL,
  OFFICE,
  ENERGY,
  YARD,
  PARKING,
  SILO_SLAB,
  TANK_SLAB,
  { x0: -251, x1: -246, z0: -235, z1: -230 },
  { x0: -235, x1: -232, z0: -158, z1: -150 },
];
const PAVED: Box[] = [FORECOURT, WEST_ROAD, EAST_ROAD, LINK_ROAD, BASIN, NURSERY, ...GATES];

/** Tepe yarıçapı `radius` olan ağaç buraya sığar mı: blok içinde (yola taşmaz), yapılardan, araçlardan ve lambalardan uzak. */
function treeAllowed(x: number, z: number, radius: number, lamps: number[]) {
  if (!inBox(SITE, x, z, -radius - 0.5)) return false;
  if (SOLID.some((b) => inBox(b, x, z, radius + 0.5))) return false;
  if (PAVED.some((b) => inBox(b, x, z, radius * 0.5 + 1))) return false;
  if ([...SILOS, ...TANKS].some((c) => Math.hypot(x - c.x, z - c.z) < c.r + radius + 0.5)) return false;
  for (let i = 0; i < lamps.length; i += 3) if (Math.hypot(x - lamps[i], z - lamps[i + 2]) < radius + 1) return false;
  return true;
}

/** Ağaç planı. `crown`: boy çarpanı 1 olan ağacın ortalama tepe yarıçapı (replantTrees'in boy dağılımıyla). */
function plantTrees(crown: number, lamps: number[]): TreeSpot[] {
  const trees: TreeSpot[] = [];
  const free = (x: number, z: number, spacing: number) => trees.every(([tx, tz]) => Math.hypot(tx - x, tz - z) > spacing);
  // Sığmazsa daha küçük boy denenir (dar şeritlerde küçük ağaç).
  const add = (x: number, z: number, spacing: number) => {
    if (!free(x, z, spacing)) return;
    for (const size of [1, 0.8, 0.62]) {
      const radius = crown * size * (0.75 + 0.55 * hash2(x, z));
      if (treeAllowed(x, z, radius, lamps)) {
        trees.push([x, z, size]);
        return;
      }
    }
  };
  const jitter = (a: number, b: number) => (hash2(a, b) - 0.5) * 2;
  // Rüzgâr kıran: kuzey kenarı ve doğu kenarı boyunca dizi (kameradan uzak taraflar, sera saklanmaz).
  for (let x = FENCE.x0 + 6; x < FENCE.x1 - 2; x += 9) add(x + jitter(x, 1), (FENCE.z0 + GLASS.z0) / 2 - 1, 7);
  for (let z = FENCE.z0 + 6; z < FENCE.z1 - 4; z += 9) add(FENCE.x1 - 4, z + jitter(z, 2), 7);
  // Silolarla doğu kenarı arasında koru.
  for (let k = 0; k < 30; k++) add(-207 + hash2(k, 30) * 18, -232 + hash2(k, 31) * 86, 8);
  // İdare binasıyla doğu yolu arasındaki çimde ağaçlar, otoparkın kuzeyinde dizi.
  for (let k = 0; k < 14; k++) add(-281 + hash2(k, 40) * 20, -121 + hash2(k, 41) * 26, 8);
  for (let x = PARKING.x0 + 2; x < PARKING.x1 + 4; x += 7) add(x + jitter(x, 3), (PARKING.z0 + NURSERY.z1) / 2, 6);
  // Otoparkın doğu ucu, idare önündeki döşemenin köşeleri.
  for (const z of [-92, -84, -77]) add(PARKING.x1 + 4, z, 6);
  for (const x of [FORECOURT.x0 + 3, FORECOURT.x1 - 3]) add(x, FORECOURT.z1 - 4, 5);
  // Fidanlığın, enerji binasının ve havuzun çevresindeki çimde tek tük.
  for (let k = 0; k < 24; k++) add(-254 + hash2(k, 50) * 46, -232 + hash2(k, 51) * 130, 9);
  return trees;
}

/** Lambalar: avlu, otopark, servis yolları ve idare önü. */
function greenhouseLamps(): number[] {
  const lamps: number[] = [];
  const low = GROUND_Y + 4.5;
  const tall = GROUND_Y + 8;
  // Avlunun güney kenarı (giriş boşluğu hariç) ve rampa saçağının altı.
  for (const x of [-378, -360, -326, -310]) lamps.push(x, tall, YARD.z1 - 1.5);
  for (const x of DOCKS) lamps.push(x - 7, GROUND_Y + 5.6, CANOPY.z0 + 1.5);
  // Otopark: kuzey ve güney kenarı.
  for (const x of [-273, -250, -238]) {
    lamps.push(x, tall, PARKING.z0 - 1);
    lamps.push(x, tall, PARKING.z1 + 0.5);
  }
  // Servis yolları ~24 m arayla.
  for (let z = EAST_ROAD.z0 + 4; z < EAST_ROAD.z1 - 6; z += 24) lamps.push(EAST_ROAD.x1 + 1.2, low, z);
  for (let z = WEST_ROAD.z0 + 4; z < WEST_ROAD.z1 - 6; z += 24) lamps.push(WEST_ROAD.x0 - 1.2, low, z);
  lamps.push(-244, low, LINK_ROAD.z0 - 1.2);
  // İdare önü.
  for (const x of [-299, -287]) lamps.push(x, low, FORECOURT.z1 - 1.5);
  return lamps;
}

// ------------------------------------------------------------------ kurulum

/** Mesh'in bu alandaki üçgenlerini siler (dizinden çıkarır). Ana serayla ortak mesh'ler (iskelet, ürün) için. */
function dropTriangles(mesh: THREE.Mesh, area: Box) {
  const geometry = mesh.geometry;
  const position = geometry.getAttribute('position');
  const index = geometry.index;
  const count = index ? index.count : position.count;
  const vertex = (k: number) => (index ? index.getX(k) : k);
  const kept: number[] = [];
  const a = new THREE.Vector3();
  for (let k = 0; k < count; k += 3) {
    let x = 0;
    let z = 0;
    for (let j = 0; j < 3; j++) {
      a.fromBufferAttribute(position, vertex(k + j)).applyMatrix4(mesh.matrixWorld);
      x += a.x / 3;
      z += a.z / 3;
    }
    if (!inBox(area, x, z)) kept.push(vertex(k), vertex(k + 1), vertex(k + 2));
  }
  geometry.setIndex(kept);
  geometry.computeBoundingSphere();
}

const OWN = /^Greenhouse_(Glass|GlassShade|Frame|CropRows|Yard|Basin|Hall|Office|Energy)$/;

/**
 * Sera şubesini yeniden kurar: şubedeki cam tonozlar gizlenir, iskelet ve ürün üçgenleri silinir, yeni sera, bina, araç,
 * parça ve ağaçlar eklenir. Silolar ve tanklar kalır. Zemin rengi GREENHOUSE_FRAGMENT ile çizilir (cityRuntime
 * Greenhouse_Ground_Site'a uygular). Lamba konumlarını döndürür. Hazırlık ikinci kez çalışırsa (StrictMode) tekrar etmez.
 * Araçlar createTraffic'ten sonra kurulur (park etmiş araç mesh'lerinden örneklenir).
 */
export function landscapeGreenhouse(cityRoot: THREE.Object3D, treeScale: number): number[] {
  const done = cityRoot.userData.greenhouseLamps as number[] | undefined;
  if (done) return done;
  cityRoot.updateMatrixWorld(true);
  const ground = cityRoot.getObjectByName('Greenhouse_Ground_Site');
  const spans = cityRoot.getObjectByName('Greenhouse_GlassSpans');
  const frames = cityRoot.getObjectByName('Greenhouse_Frames');
  const crops = cityRoot.getObjectByName('Greenhouse_Crops');
  let facade: THREE.Material | null = null;
  let water: THREE.Material | null = null;
  cityRoot.traverse((object) => {
    if (!(object instanceof THREE.Mesh) || Array.isArray(object.material)) return;
    if (!facade && object instanceof THREE.InstancedMesh && object.name.startsWith('Residential_Buildings_')) {
      facade = object.material;
    }
    if (!water && object.material.name === 'Water') water = object.material;
  });
  if (
    !ground ||
    !facade ||
    !water ||
    !(spans instanceof THREE.InstancedMesh) ||
    !(frames instanceof THREE.Mesh) ||
    !(crops instanceof THREE.Mesh) ||
    Array.isArray(spans.material) ||
    Array.isArray(frames.material) ||
    Array.isArray(crops.material)
  ) {
    return [];
  }

  // Eski parçalar: şubedeki cam tonoz örnekleri sıfır ölçek, iskelet ve ürün üçgenleri silinir (ana sera yerinde kalır).
  const matrix = new THREE.Matrix4();
  const point = new THREE.Vector3();
  const zero = new THREE.Matrix4().makeScale(0, 0, 0);
  for (let i = 0; i < spans.count; i++) {
    spans.getMatrixAt(i, matrix);
    point.setFromMatrixPosition(matrix).applyMatrix4(spans.matrixWorld);
    if (inBox(SITE, point.x, point.z)) spans.setMatrixAt(i, zero);
  }
  spans.instanceMatrix.needsUpdate = true;
  dropTriangles(frames, SITE);
  dropTriangles(crops, SITE);

  // Cam: açık ve gölgeli (kireç badanalı) iki malzeme, gölge düşürmez.
  const glassSource = spans.material;
  const clearGlass = glassSource.clone();
  clearGlass.name = 'Glass_Greenhouse_Clear';
  const shadeGlass = glassSource.clone();
  shadeGlass.name = 'Glass_Greenhouse_Shade';
  if (shadeGlass instanceof THREE.MeshStandardMaterial) {
    shadeGlass.color.set('#eceee9');
    shadeGlass.opacity = 0.7;
    shadeGlass.roughness = 0.5;
  }
  const glass = glassGeometries();
  const parts: THREE.Mesh[] = [
    new THREE.Mesh(glass.clear, clearGlass),
    new THREE.Mesh(glass.shaded, shadeGlass),
    new THREE.Mesh(frameGeometry().build(), frames.material),
    new THREE.Mesh(cropsGeometry().build(), crops.material),
    new THREE.Mesh(yardGeometry(new PropBuilder()).build(), crops.material),
  ];
  ['Greenhouse_Glass', 'Greenhouse_GlassShade', 'Greenhouse_Frame', 'Greenhouse_CropRows', 'Greenhouse_Yard'].forEach(
    (name, i) => (parts[i].name = name),
  );
  parts[0].userData = { castShadow: false };
  parts[1].userData = { castShadow: false };
  // Yeni parçalar zemin katmanlamasına girmez (layerGround yalnızca düz, çok renkli mesh'leri kaldırır).
  for (const part of parts.slice(2)) part.userData = { groundLayered: true };

  // Yağmur suyu havuzu: şehrin su malzemesiyle düz yüzey, beton kenarın içinde.
  const basin = new THREE.PlaneGeometry(BASIN.x1 - BASIN.x0, BASIN.z1 - BASIN.z0).rotateX(-Math.PI / 2);
  basin.translate((BASIN.x0 + BASIN.x1) / 2, GROUND_Y + 0.18, (BASIN.z0 + BASIN.z1) / 2);
  basin.setAttribute('color', new THREE.Float32BufferAttribute(new Array(basin.getAttribute('position').count * 3).fill(1), 3));
  const pond = new THREE.Mesh(basin, water);
  pond.name = 'Greenhouse_Basin';
  pond.userData = { castShadow: false, groundLayered: true };
  parts.push(pond);

  const parent = ground.parent ?? cityRoot;
  for (const mesh of buildingMeshes(facade)) {
    mesh.instanceMatrix.needsUpdate = true;
    parts.push(mesh);
  }
  for (const part of parts) parent.add(part);
  // Araçlar şehrin park etmiş araçlarının yanına (Traffic_ adıyla: trafik, LOD ve insanlar onları öyle tanır).
  for (const mesh of vehicleMeshes(cityRoot)) {
    mesh.instanceMatrix.needsUpdate = true;
    parent.add(mesh);
  }
  // Yeni parçalar dünya koordinatında kuruldu: ebeveynin dönüşümü birim olmalı.
  parent.updateMatrixWorld(true);
  if (!parent.matrixWorld.equals(new THREE.Matrix4())) {
    const inverse = parent.matrixWorld.clone().invert();
    for (const child of parent.children) {
      if (OWN.test(child.name) || child.name.startsWith('Traffic_Greenhouse_')) child.applyMatrix4(inverse);
    }
  }

  const lamps = greenhouseLamps();
  replantTrees(cityRoot, {
    prefix: 'Greenhouse',
    inside: (x, z) => inBox(SITE, x, z),
    spots: plantTrees(crownRadius(cityRoot, treeScale), lamps),
    treeScale,
  });
  cityRoot.updateMatrixWorld(true);
  cityRoot.userData.greenhouseLamps = lamps;
  return lamps;
}
