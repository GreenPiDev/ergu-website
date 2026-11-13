// Bilim merkezinin yeniden düzenlenmesi (E-F × 1-3 blokları, alan x 427..866, z -563..-67, zemin plakası x 430.5..862.5,
// z -559.5..-70.5). Modelde 432×489 m'lik tek ton bej bir plakanın üstünde iki ince yol, kubbenin çevresinde zeminle aynı
// renkte bir disk, 8 üçgenlik kutulardan üç adet 150 m'lik kesintisiz laboratuvar kanadı (aralarında ince beyaz köprüler),
// zemine hiçbir şeyle bağlanmayan 97 m'lik bir kule, çimin ortasında yolsuz bir uydu çanağı ve gözlemevi, çizgisiz bir
// otopark vardı. Ağaçlar güney yarıda serpiştirilmişti, kuzey yarı boştu, lamba yoktu. Model değişmeden açılışta yeniden kurulur:
// - Yerinde kalanlar: planetaryum kubbesi ve kaidesi, kule gövdesi ve tacı, uydu çanağı ve gözlemevi, teleferik istasyonu
//   (diğer istasyonlarla ortak mesh'ler), otopark araçları.
// - Bina: laboratuvar kanatları farklı yükseklikte kütlelere bölünür, batıda kanatları bağlayan cam omurga (köprülerin
//   yerine), çatılarda teknik katlar ve güneş panelleri. Planetaryuma giriş holü, kuleye lobi podyumu ve yanaşma saçağı,
//   gözlemevine kontrol binası, teleferik istasyonuna merdiven-asansör kulesi.
// - Zemin (shader): kubbenin çevresinde gezegen yörüngeli taş meydan, teleferik meydanından doğuya ölçekli güneş sistemi
//   yürüyüşü olan ağaçlı gezinti aksı, laboratuvarları güney sokağa bağlayan yürüyüş yolu, kule önünde araç yanaşma döngüsü,
//   araştırma avluları, deneme parselleri ve yağmur suyu göleti, gözlemevinin çakıl avlusu, kuzeyde servis yolu, otopark
//   çizgileri ve ağaç adaları, güneybatıda açık hava bilim parkı (güneş saati, sarkaç, teleskoplar), çim, çayır ve çit bitkisi.
// - Parçalar (kırık tonlar): güneş saati, sarkaç çerçevesi, teleskoplar, sarmal heykel, gezegen kaideleri, banklar, büfe ve
//   şemsiyeler, bisiklet istasyonları, otobüs durağı, yön totemleri, gözlemevi çiti, yükleme alanı ekipmanı.
// Yerleşim planı aşağıdaki sabitlerde tek yerde tanımlanır. GLSL ve TypeScript tarafı aynı ölçüleri kullanır.
import * as THREE from 'three';
import { MASS_VARIANTS, type MassVariant, PropBuilder, type VehicleSpot, parkedVehicles } from './cityMass';
import { type TreeSpot, crownRadius, hash2, replantTrees } from './cityTrees';

interface Box {
  x0: number;
  x1: number;
  z0: number;
  z1: number;
}
type Building = Box & { height: number; variant: MassVariant; palette: 'lab' | 'civic' };
interface Disc {
  x: number;
  z: number;
  r: number;
}

const SITE: Box = { x0: 427, x1: 866, z0: -563, z1: -67 };
// Bilim merkezinin zemin plakası (modeldeki Science_Ground): çevresi kaldırım.
const LOT: Box = { x0: 430.5, x1: 862.5, z0: -559.5, z1: -70.5 };
// Zemin yüksekliği (modeldeki Science_Ground ile aynı) ve binaların oturduğu taban.
const GROUND_Y = 0.75;
const BASE_Y = 0.45;

// ---- yerinde kalan yapılar
// Planetaryum kubbesi ve kaidesi (kaide yarıçapı 49 m), kule gövdesi.
const DOME = { x: 610, z: -165, r: 49 };
const TOWER: Box = { x0: 780, x1: 820, z0: -185, z1: -145 };
// Teleferik istasyonu (çatı izi) ve ayakları; hat z -335 ve -325'te batıdan gelir.
const STATION: Box = { x0: 496, x1: 544, z0: -343, z1: -317 };
// Uydu çanağı ve radom binası.
const DISH: Box = { x0: 466, x1: 494, z0: -527, z1: -505 };
const RADOME: Box = { x0: 459, x1: 481, z0: -471, z1: -449 };

// ---- binalar
// Laboratuvar kanatları modeldeki üç kanadın izinde (z aralıkları aynı), batı uçları cam omurgaya bağlanır.
const LAB_ROWS = [
  { z0: -534, z1: -506 },
  { z0: -464, z1: -436 },
  { z0: -394, z1: -366 },
];
const SPINE: Building = { x0: 640, x1: 656, z0: -534, z1: -366, height: 14, variant: 'plain', palette: 'lab' };
const LABS: Building[] = [
  { x0: 656, x1: 700, ...LAB_ROWS[0], height: 26, variant: 'penthouseB', palette: 'lab' },
  { x0: 700, x1: 795, ...LAB_ROWS[0], height: 19, variant: 'plain', palette: 'lab' },
  { x0: 656, x1: 712, ...LAB_ROWS[1], height: 22, variant: 'penthouse', palette: 'lab' },
  { x0: 712, x1: 770, ...LAB_ROWS[1], height: 15, variant: 'plain', palette: 'lab' },
  { x0: 770, x1: 795, ...LAB_ROWS[1], height: 19, variant: 'plain', palette: 'lab' },
  { x0: 656, x1: 700, ...LAB_ROWS[2], height: 26, variant: 'penthouseB', palette: 'lab' },
  { x0: 700, x1: 760, ...LAB_ROWS[2], height: 19, variant: 'plain', palette: 'lab' },
  { x0: 760, x1: 795, ...LAB_ROWS[2], height: 15, variant: 'plain', palette: 'lab' },
];
// Düz çatılı alçak kütlelerde güneş paneli dizileri (eski panel dizileri bu çatılara taşınır).
const PV_ROOFS = LABS.filter((b) => b.variant === 'plain');
// Planetaryum giriş holü (kubbenin kuzeyinde, aksa bakar), kule lobi podyumu, gözlemevi kontrol binası,
// teleferik merdiven-asansör kulesi.
const HALL: Building = { x0: 586, x1: 634, z0: -246, z1: -218, height: 8.4, variant: 'penthouse', palette: 'civic' };
const PODIUM: Building = { x0: 766, x1: 834, z0: -199, z1: -131, height: 9.6, variant: 'plain', palette: 'civic' };
const CONTROL: Building = { x0: 484, x1: 502, z0: -474, z1: -458, height: 6.6, variant: 'plain', palette: 'civic' };
const LIFT: Building = { x0: 546, x1: 554, z0: -334, z1: -326, height: 17, variant: 'plain', palette: 'civic' };
const BUILDINGS: Building[] = [SPINE, ...LABS, HALL, PODIUM, CONTROL, LIFT];

// ---- yollar ve meydanlar
// Gezinti aksı: teleferik meydanının güneyinden doğu sokağına, batıda sokaktan girilir.
const PROMENADE: Box = { x0: LOT.x0, x1: LOT.x1, z0: -306, z1: -294 };
const PROMENADE_Z = (PROMENADE.z0 + PROMENADE.z1) / 2;
// Laboratuvar girişinin önü ve oradan güney sokağa yürüyüş yolu (kubbe ile kule arasından).
const LAB_COURT: Box = { x0: 636, x1: 720, z0: -366, z1: -356 };
const WALK: Box = { x0: 695, x1: 705, z0: -356, z1: LOT.z1 };
// Teleferik meydanı ve araç yolu: batı sokağından otoparka.
const STATION_PLAZA: Box = { x0: 478, x1: 556, z0: -347.5, z1: PROMENADE.z0 };
const ACCESS: Box = { x0: LOT.x0, x1: 556, z0: -354.5, z1: -347.5 };
// Otopark: modeldeki araçların sırası (z -344.4 ve -328.4, 2.8 m aralıkla), kuzeyinde araç yolu.
const PARKING: Box = { x0: 556, x1: 664, z0: -354.5, z1: -322 };
const BAY = 2.8;
const BAY_X0 = 564.8;
const BAY_COUNT = 34;
const ROWS = [
  { z0: -347.2, z1: -341.6, islands: [2, 13, 26] },
  { z0: -331.2, z1: -325.6, islands: [22, 26, 30] },
];
// Planetaryum holünün önü ve kafe.
const HALL_COURT: Box = { x0: 586, x1: 634, z0: PROMENADE.z1, z1: HALL.z0 };
const KIOSK: Box = { x0: 588, x1: 594, z0: -286, z1: -279 };
// Kubbenin çevresinde yörünge meydanı: sekiz granit halka, her halkada bir gezegen işareti.
const ORBIT_R = 77;
const RINGS = Array.from({ length: 8 }, (_, k) => 53 + 2.6 * k);
// Kule önü: taş meydan, doğu sokağından yanaşma döngüsü (giriş kuzeyde, çıkış güneyde), ortası bitki adası.
const TOWER_COURT: Box = { x0: 760, x1: LOT.x1, z0: -215, z1: -115 };
const DROP_LOOP: Box = { x0: 838, x1: LOT.x1, z0: -212, z1: -118 };
const DROP_ISLAND: Box = { x0: 845, x1: LOT.x1, z0: -205, z1: -125 };
const DROP_CANOPY: Box = { x0: 834, x1: 846, z0: -176, z1: -154 };
// Kuzeyde servis yolu (doğu sokağından) ve laboratuvarların arkasında yükleme alanı.
const SERVICE: Box = { x0: 640, x1: LOT.x1, z0: -552, z1: -545 };
const LOADING: Box = { x0: 700, x1: 770, z0: -545, z1: -534 };
// Araştırma avluları (kanatlar arası) ve içlerindeki yollar.
const QUADS: Box[] = [
  { x0: 656, x1: 795, z0: -506, z1: -464 },
  { x0: 656, x1: 795, z0: -436, z1: -394 },
];
const QUAD_X = 726;
// Gözlemevi: çakıl avlu, çit, güneye çakıl yol.
const COMPOUND: Box = { x0: 452, x1: 528, z0: -534, z1: -442 };
const COMPOUND_GATE = { x0: 466, x1: 474 };
const COMPOUND_PATH: Box = { x0: 468, x1: 472, z0: COMPOUND.z1, z1: ACCESS.z0 };
// Deneme parselleri ve yağmur suyu göleti (çevresinde çakıl yol).
const PLOTS: Box = { x0: 536, x1: 626, z0: -526, z1: -440 };
const POND = { x: 580, z: -404, rx: 38, rz: 16 };

// ---- bilim parkı (güneybatı çimi)
const SUNDIAL: Disc = { x: 490, z: -200, r: 12 };
const PENDULUM: Disc = { x: 470, z: -130, r: 7 };
const SCOPES: Disc = { x: 515, z: -248, r: 7 };
const HELIX: Disc = { x: 520, z: -108, r: 5 };
const PADS: Disc[] = [SUNDIAL, PENDULUM, SCOPES, HELIX];
// Çakıl yollar (uçlar dünya koordinatında).
const GARDEN_PATHS: [number, number, number, number][] = [
  [490, PROMENADE.z1, 490, SUNDIAL.z - SUNDIAL.r],
  [SUNDIAL.x + SUNDIAL.r, SUNDIAL.z, DOME.x - ORBIT_R + 2, -183],
  [486, SUNDIAL.z + SUNDIAL.r - 1, PENDULUM.x + 2, PENDULUM.z - PENDULUM.r],
  [PENDULUM.x + PENDULUM.r, PENDULUM.z, DOME.x - ORBIT_R + 3, -142],
  [PENDULUM.x, PENDULUM.z + PENDULUM.r, PENDULUM.x, LOT.z1],
  [HELIX.x, HELIX.z - HELIX.r, HELIX.x, -136],
  [SCOPES.x - SCOPES.r, SCOPES.z, 490, SCOPES.z],
];
const GARDEN_PATH_HALF = 1.5;

// Çayırlar: biçilmemiş, kır çiçekli.
const MEADOWS: Box[] = [
  { x0: 720, x1: 860, z0: -292, z1: -222 },
  { x0: 432, x1: 530, z0: -440, z1: -360 },
  { x0: 800, x1: 860, z0: -540, z1: -360 },
];

// Güneş sistemi yürüyüşü: Güneş teleferik meydanının doğu kenarında, ölçek 10 m = 1 astronomik birim (yörünge yarı
// büyük eksenleri). Diskler ve küreler gezegenin boyuna göre değil, okunsun diye büyütülmüş.
const SUN_X = 556;
const AU = 10;
const PLANETS: { au: number; r: number; tone: string }[] = [
  { au: 0.387, r: 0.45, tone: '#9c958c' },
  { au: 0.723, r: 0.6, tone: '#cdb48a' },
  { au: 1, r: 0.62, tone: '#7f98a8' },
  { au: 1.524, r: 0.5, tone: '#b9775a' },
  { au: 5.203, r: 1.2, tone: '#c9a35e' },
  { au: 9.537, r: 1.05, tone: '#d4c08e' },
  { au: 19.19, r: 0.85, tone: '#9fb7bd' },
  { au: 30.07, r: 0.82, tone: '#6f87a6' },
];
const planetX = (au: number) => SUN_X + au * AU;

const f = (value: number) => value.toFixed(2);
const v2 = (x: number, z: number) => `vec2(${f(x)}, ${f(z)})`;
const box = (b: Box) => `${v2((b.x0 + b.x1) / 2, (b.z0 + b.z1) / 2)}, ${v2((b.x1 - b.x0) / 2, (b.z1 - b.z0) / 2)}`;
const inBox = (b: Box, x: number, z: number, pad = 0) => x > b.x0 - pad && x < b.x1 + pad && z > b.z0 - pad && z < b.z1 + pad;
const pad = (b: Box, d: number): Box => ({ x0: b.x0 - d, x1: b.x1 + d, z0: b.z0 - d, z1: b.z1 + d });
const minAll = (terms: string[]) => terms.reduce((a, b) => `min(${a}, ${b})`);

// Yörünge meydanındaki gezegen işaretleri: her halkada sabit bir açıda (kameradan görünsün diye halkalara dağılmış).
const orbitMarks = RINGS.map((r, k) => {
  const a = k * 2.39996 + 0.6;
  return { x: DOME.x + Math.cos(a) * r, z: DOME.z + Math.sin(a) * r, r: 0.7 + 0.12 * (k % 4) };
});
// Gezinti aksında ağaç havuzları (iki kenarda 10 m arayla, yürüyüş yolu kavşağı ve gezegen kaideleri açık).
const PIT_Z = [PROMENADE.z0 + 2.4, PROMENADE.z1 - 2.4];
const PEDESTAL_Z = PROMENADE.z1 - 2.4;
const promenadePits: [number, number][] = [];
for (let x = LOT.x0 + 10; x < LOT.x1 - 6; x += 10) {
  if (x > WALK.x0 - 4 && x < WALK.x1 + 4) continue;
  if (x > STATION_PLAZA.x0 - 2 && x < STATION_PLAZA.x1 + 2) continue;
  if (x > HALL_COURT.x0 && x < HALL_COURT.x1) continue;
  for (const z of PIT_Z) {
    if (z === PEDESTAL_Z && PLANETS.some((planet) => Math.abs(planetX(planet.au) - x) < 3)) continue;
    promenadePits.push([x, z]);
  }
}
// Otopark adacıkları: iki park yeri genişliğinde çim ve ağaç (araç olmayan yerlerde).
const islandBoxes: Box[] = ROWS.flatMap((row) =>
  row.islands.map((k) => ({ x0: BAY_X0 + BAY * k, x1: BAY_X0 + BAY * (k + 2), z0: row.z0, z1: row.z1 })),
);

/** Bilim merkezi planının mesafe fonksiyonları (GLSL, global kapsamda). */
export const SCIENCE_GLSL = `
// Köşeleri r yarıçapla yuvarlatılmış kutuya işaretli uzaklık (içeride negatif).
float snBox(vec2 p, vec2 c, vec2 h, float r){ vec2 q = abs(p - c) - h + r; return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r; }
float snIn(float d, float aa){ return 1.0 - smoothstep(-aa, aa, d); }
// Eşit aralıklı çizgiler (metre): çizgi seçilemeyecek kadar uzaksa ortalama yoğunluğuna söner.
float snLines(float v, float period, float width, float aa){
  float d = abs(fract(v / period + 0.5) - 0.5) * period;
  float line = 1.0 - smoothstep(width * 0.5 - aa, width * 0.5 + aa, d);
  return mix(width / period, line, 1.0 - smoothstep(width * 0.6, width * 1.5, aa));
}
// Boya veya taş bandı: d = 0 eğrisi boyunca w genişliğinde, piksel altına inince ortalama yoğunluğa söner.
float snStroke(float d, float w, float aa){ return (1.0 - smoothstep(w * 0.5 - aa, w * 0.5 + aa, abs(d))) * min(1.0, w / aa); }
// Doğru parçasına uzaklık.
float snSeg(vec2 p, vec2 a, vec2 b){ vec2 pa = p - a; vec2 ba = b - a; float h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0); return length(pa - ba * h); }
`;

const parkingBays = ROWS.map(
  (r) =>
    `bays = max(bays, snLines(p.x - ${f(BAY_X0)}, ${f(BAY)}, 0.15, aa) * step(${f(BAY_X0)}, p.x) * step(p.x, ${f(BAY_X0 + BAY * BAY_COUNT)}) * step(${f(r.z0)}, p.y) * step(p.y, ${f(r.z1)}));`,
).join('\n    ');
// Bina çevresinde döşeme şeridi (temel kaldırımı).
const buildingApron = minAll(BUILDINGS.map((b) => `snBox(p, ${box(b)}, 0.0)`));
const gardenPaths = minAll(GARDEN_PATHS.map(([ax, az, bx, bz]) => `snSeg(p, ${v2(ax, az)}, ${v2(bx, bz)})`));
const pondDistance = `((length((p - ${v2(POND.x, POND.z)}) / ${v2(POND.rx, POND.rz)}) - 1.0) * ${f(POND.rz)})`;

/** Bilim merkezi zemini: Science_Ground'un rengi tamamen dünya konumundan çizilir (köşe renkleri yok sayılır). */
export const SCIENCE_FRAGMENT = `#include <color_fragment>
  {
    vec2 p = vWPos.xz;
    float aa = max(fwidth(p.x), fwidth(p.y)) * 0.8 + 0.05;
    float fine = 1.0 - smoothstep(0.8, 2.5, aa);
    float n1 = fbm(p * 0.02);
    float n2 = fbm(p * 0.09 + 41.0);
    float grain = 0.94 + 0.12 * h12(floor(p * 3.0)) * fine;
    vec3 rimColor = vec3(0.55, 0.53, 0.5);
    vec3 paint = vec3(0.72, 0.7, 0.64);
    float mow = 1.0 - smoothstep(2.0, 5.0, aa);

    // Çim: okul ve parktaki gibi biçme şeritleri ve geniş ton farkları.
    vec3 c = vec3(0.12, 0.19, 0.065) * (0.82 + 0.36 * n1);
    c *= 1.0 + (step(0.5, fract((p.x * 0.2 + p.y) / 9.0)) - 0.5) * 0.12 * mow;
    // Çayırlar: biçilmemiş, kuru tonlu, kır çiçeği benekleri; kenarları dalgalı.
    float meadow = 0.0;
    ${MEADOWS.map((b) => `meadow = max(meadow, snIn(snBox(p, ${box(b)}, 6.0) + (n2 - 0.5) * 8.0, 2.0));`).join('\n    ')}
    vec3 wild = vec3(0.2, 0.22, 0.09) * (0.8 + 0.4 * fbm(p * 0.3));
    float bloom = step(0.965, h12(floor(p * 1.7))) * fine;
    wild = mix(wild, mix(vec3(0.5, 0.46, 0.34), vec3(0.42, 0.3, 0.34), h12(floor(p * 1.7) + 3.1)), bloom * 0.6);
    c = mix(c, wild, meadow);

    // Plaka kenarında çit bitkisi (yollar ve kapılar sonra üstüne çizilir).
    float edge = min(min(p.x - ${f(LOT.x0)}, ${f(LOT.x1)} - p.x), min(p.y - ${f(LOT.z0)}, ${f(LOT.z1)} - p.y));
    c = mix(c, vec3(0.055, 0.095, 0.035) * (0.7 + 0.6 * fbm(p * 0.45)), snIn(edge - 2.4 + (n2 - 0.5) * 0.8, aa));

    vec3 gravel = vec3(0.4, 0.34, 0.25) * (0.88 + 0.24 * n2) * grain;
    float joint = max(snLines(p.x, 1.2, 0.08, aa), snLines(p.y, 1.2, 0.08, aa));
    vec3 stone = vec3(0.52, 0.49, 0.44) * grain * (0.94 + 0.12 * n2) * (1.0 - 0.1 * joint);
    vec3 travertine = vec3(0.58, 0.53, 0.45) * grain * (0.94 + 0.12 * n2);
    vec3 granite = vec3(0.27, 0.26, 0.25) * grain;
    vec3 bronze = vec3(0.45, 0.33, 0.18) * grain;
    vec3 asphalt = vec3(0.2, 0.195, 0.19) * (0.88 + 0.24 * n2);
    vec3 soil = vec3(0.17, 0.11, 0.07) * (0.9 + 0.2 * n2);

    // Gözlemevi: çakıl avlu ve güneye çakıl yol.
    c = mix(c, gravel, snIn(snBox(p, ${box(COMPOUND)}, 2.0), aa));
    c = mix(c, gravel, snIn(snBox(p, ${box(COMPOUND_PATH)}, 0.5), aa));

    // Deneme parselleri: çakıl kenar, içinde sıra sıra ekin, 15 m'de bir çakıl geçit.
    {
      float bd = snBox(p, ${box(PLOTS)}, 1.0);
      float row = fract((p.y - ${f(PLOTS.z0)}) / 1.6);
      float rowHash = h12(vec2(floor((p.y - ${f(PLOTS.z0)}) / 9.6), floor((p.x - ${f(PLOTS.x0)}) / 15.0) + 4.7));
      vec3 crop = rowHash < 0.35 ? vec3(0.13, 0.2, 0.06) : rowHash < 0.65 ? vec3(0.24, 0.27, 0.1) : rowHash < 0.85 ? vec3(0.3, 0.26, 0.12) : vec3(0.2, 0.17, 0.2);
      crop *= 0.8 + 0.4 * n2;
      float rowAa = max(fwidth(row), 1e-4);
      float cropMask = mix(0.55, smoothstep(0.3 - rowAa, 0.3 + rowAa, row) * (1.0 - smoothstep(0.85 - rowAa, 0.85 + rowAa, row)), fine);
      float aisle = max(snLines(p.x - ${f(PLOTS.x0)}, 15.0, 1.4, aa), snLines(p.y - ${f(PLOTS.z0)}, 28.8, 1.4, aa));
      c = mix(c, gravel, snIn(bd, aa));
      c = mix(c, mix(mix(soil, crop, cropMask), gravel, aisle), snIn(bd + 1.4, aa));
    }

    // Yağmur suyu göleti: çevresinde çakıl yol, sazlık kenar, koyu su.
    {
      float pd = ${pondDistance};
      c = mix(c, gravel, snIn(abs(pd - 5.0) - 1.2, aa));
      c = mix(c, vec3(0.16, 0.2, 0.08) * (0.7 + 0.6 * fbm(p * 0.6)), snIn(pd - 1.2 + (n2 - 0.5) * 1.4, aa));
      c = mix(c, vec3(0.06, 0.1, 0.1) * (0.9 + 0.2 * n2) + vec3(0.04) * fbm(p * 0.15), snIn(pd + 1.5, aa));
    }

    // Asfalt: servis yolu ve yükleme alanı, araç yolu ve otopark, kule önünde yanaşma döngüsü.
    float road = ${minAll([
      `snBox(p, ${box(SERVICE)}, 0.0)`,
      `snBox(p, ${box(LOADING)}, 1.0)`,
      `snBox(p, ${box(ACCESS)}, 0.0)`,
      `snBox(p, ${box(PARKING)}, 0.8)`,
    ])};
    c = mix(c, asphalt, snIn(road, aa));
    float bays = 0.0;
    ${parkingBays}
    c = mix(c, rimColor, bays * fine);
    c = mix(c, rimColor, snIn(abs(snBox(p, ${box(PARKING)}, 0.8)) - 0.25, aa) * fine);
    ${islandBoxes.map((b) => `{ float d = snBox(p, ${box(b)}, 0.6); c = mix(c, vec3(0.1, 0.17, 0.06) * (0.85 + 0.3 * n2), snIn(d + 0.3, aa)); c = mix(c, rimColor, snIn(abs(d + 0.15) - 0.15, aa) * fine); }`).join('\n    ')}
    // Yükleme alanında sarı çizgiler.
    {
      float yard = snLines(p.x - ${f(LOADING.x0)}, 7.0, 0.15, aa) * step(${f(LOADING.z0 + 1)}, p.y) * step(p.y, ${f(LOADING.z1)}) * step(${f(LOADING.x0)}, p.x) * step(p.x, ${f(LOADING.x1)});
      c = mix(c, vec3(0.64, 0.5, 0.18), yard * fine * 0.8);
    }

    // Taş döşemeler: bina çevresi, laboratuvar önü, yürüyüş yolu, avlu yolları, hol önü, kule önü.
    float paved = ${minAll([
      `snBox(p, ${box(LAB_COURT)}, 0.0)`,
      `snBox(p, ${box(WALK)}, 0.0)`,
      `snBox(p, ${box(HALL_COURT)}, 0.0)`,
      `snBox(p, ${box(TOWER_COURT)}, 2.0)`,
      ...QUADS.map((q) => `max(abs(p.x - ${f(QUAD_X)}) - 2.0, snBox(p, ${box(q)}, 0.0))`),
      ...QUADS.map((q) => `max(abs(p.y - ${f((q.z0 + q.z1) / 2)}) - 1.5, snBox(p, ${box(q)}, 0.0))`),
      `${buildingApron} - 2.4`,
    ])};
    c = mix(c, stone, snIn(paved, aa));
    // Kule önünde 6 m granit ızgara, yanaşma döngüsü bunun üstünde kalır.
    {
      float court = snBox(p, ${box(TOWER_COURT)}, 2.0);
      float grid = max(snLines(p.x - 800.0, 6.0, 0.3, aa), snLines(p.y + 165.0, 6.0, 0.3, aa));
      c = mix(c, granite, grid * snIn(court, aa) * 0.45);
      float loop = snBox(p, ${box(DROP_LOOP)}, 3.0);
      c = mix(c, asphalt, snIn(loop, aa) * (1.0 - snIn(snBox(p, ${box(DROP_ISLAND)}, 1.5), aa)));
      c = mix(c, rimColor, snIn(abs(loop) - 0.25, aa) * fine * step(p.x, ${f(LOT.x1 - 0.5)}));
      // Döngünün ortası bitki adası, kenarında bordür.
      float island = snBox(p, ${box(DROP_ISLAND)}, 1.5);
      c = mix(c, vec3(0.08, 0.14, 0.05) * (0.8 + 0.4 * fbm(p * 0.5)), snIn(island, aa));
      c = mix(c, rimColor, snIn(abs(island) - 0.2, aa) * fine);
    }
    // Araştırma avlularında yağmur bahçeleri: yolların iki yanında koyu bitki şeritleri.
    ${QUADS.map((q) => `c = mix(c, vec3(0.07, 0.13, 0.05) * (0.75 + 0.5 * fbm(p * 0.5)), snIn(abs(abs(p.y - ${f((q.z0 + q.z1) / 2)}) - 6.0) - 2.2 + (n2 - 0.5) * 1.2, aa) * snIn(snBox(p, ${box(pad(q, -6))}, 0.0), aa) * step(4.0, abs(p.x - ${f(QUAD_X)})));`).join('\n    ')}

    // Bilim parkı: çakıl yollar ve taş meydancıklar.
    c = mix(c, gravel, snIn(${gardenPaths} - ${f(GARDEN_PATH_HALF)}, aa));
    ${PADS.map((d) => `{ float r = length(p - ${v2(d.x, d.z)}); c = mix(c, stone, snIn(r - ${f(d.r)}, aa)); c = mix(c, granite, snIn(abs(r - ${f(d.r - 0.6)}) - 0.35, aa)); }`).join('\n    ')}
    // Güneş saati: saat çizgileri (gölge çubuğunun dibinden, 15 derecede bir) ve granit uçlu kadran.
    {
      vec2 q = p - ${v2(SUNDIAL.x, SUNDIAL.z + 5)};
      float a = atan(q.x, q.y);
      float r = length(q);
      float hourLine = abs(fract(a / 0.2618 + 0.5) - 0.5) * 0.2618 * r;
      float dial = step(r, ${f(SUNDIAL.r + 3)}) * step(2.0, r) * step(abs(a), 1.6) * snIn(length(p - ${v2(SUNDIAL.x, SUNDIAL.z)}) - ${f(SUNDIAL.r - 1.2)}, aa);
      c = mix(c, granite, snStroke(hourLine, 0.18, aa) * dial);
    }

    // Teleferik meydanı: traverten, hat boyunca granit bantlar, istasyonun altı gölgeli taş.
    {
      float plaza = snBox(p, ${box(STATION_PLAZA)}, 0.0);
      float bands = snLines(p.y + 330.0, 5.0, 0.4, aa);
      vec3 floorColor = mix(travertine, granite, bands * 0.6);
      floorColor *= 1.0 - 0.18 * snIn(snBox(p, ${box(STATION)}, 1.0), aa);
      c = mix(c, floorColor, snIn(plaza, aa));
      c = mix(c, granite, snIn(abs(plaza + 0.6) - 0.6, aa) * snIn(plaza, aa));
    }

    // Gezinti aksı: taş, iki kenarda granit bant, ağaç havuzları, ortada güneş sistemi yürüyüşü.
    {
      float pr = snBox(p, ${box(PROMENADE)}, 0.0);
      c = mix(c, stone, snIn(pr, aa));
      c = mix(c, granite, snIn(abs(abs(p.y - ${f(PROMENADE_Z)}) - 5.4) - 0.3, aa) * snIn(pr, aa));
      float inner = snIn(pr, aa);
      ${promenadePits.map(([x, z]) => `{ float pit = snBox(p, ${v2(x, z)}, vec2(1.2), 0.2); c = mix(c, granite, snIn(pit - 0.3, aa) * inner); c = mix(c, vec3(0.1, 0.15, 0.06) * (0.8 + 0.4 * n2), snIn(pit, aa)); }`).join('\n      ')}
      // Güneş sistemi yürüyüşü: aksın ortasında ince bronz çizgi, Güneş ve gezegenler bronz diskler.
      c = mix(c, bronze, snStroke(p.y - ${f(PROMENADE_Z)}, 0.12, aa) * step(${f(SUN_X)}, p.x) * step(p.x, ${f(planetX(PLANETS[PLANETS.length - 1].au))}) * fine);
      c = mix(c, bronze * 1.25, snIn(length(p - ${v2(SUN_X, PROMENADE_Z)}) - 2.6, aa));
      ${PLANETS.map((planet) => `c = mix(c, bronze, snIn(length(p - ${v2(planetX(planet.au), PROMENADE_Z)}) - ${f(planet.r + 0.4)}, aa));`).join('\n      ')}
    }

    // Yörünge meydanı: açık taş, kaidenin çevresinde koyu bant, sekiz granit halka, gezegen işaretleri, kenarda granit.
    {
      float r = length(p - ${v2(DOME.x, DOME.z)});
      float plaza = r - ${f(ORBIT_R)};
      vec3 floorColor = travertine * (1.0 - 0.06 * snLines(atan(p.y - ${f(DOME.z)}, p.x - ${f(DOME.x)}) * r, 3.0, 0.1, aa));
      c = mix(c, floorColor, snIn(plaza, aa));
      c = mix(c, granite, snIn(abs(r - ${f(DOME.r + 1.4)}) - 1.4, aa));
      ${RINGS.map((radius) => `c = mix(c, granite, snStroke(r - ${f(radius)}, 0.35, aa));`).join('\n      ')}
      ${orbitMarks.map((m) => `c = mix(c, bronze, snIn(length(p - ${v2(m.x, m.z)}) - ${f(m.r)}, aa));`).join('\n      ')}
      c = mix(c, granite, snIn(abs(plaza + 0.8) - 0.8, aa));
    }

    diffuseColor.rgb = c;
  }`;

// ------------------------------------------------------------------ binalar

// Duvar ve çatı paleti (FACADE_FRAGMENT eşikleriyle). Değerler okul, kreş ve kültür merkeziyle aynı: aynı değer aynı cephe
// programını paylaşır, açılışta ek cephe shader'ı derlenmez. Laboratuvarlar kırık beyaz duvar ve açık çatı, hol, podyum,
// kontrol binası ve asansör kulesi krem sıva.
const PALETTES = { lab: 'vec2(0.1, 0.9)', civic: 'vec2(0.4, 0.7)' } as const;

function blockMatrix(b: Box, height: number) {
  const hy = height / 2;
  return new THREE.Matrix4().compose(
    new THREE.Vector3((b.x0 + b.x1) / 2, BASE_Y + hy, (b.z0 + b.z1) / 2),
    new THREE.Quaternion(),
    new THREE.Vector3((b.x1 - b.x0) / 2, hy, (b.z1 - b.z0) / 2),
  );
}

function buildingMeshes(source: THREE.Material) {
  const materials = new Map<Building['palette'], THREE.Material>();
  const material = (palette: Building['palette']) => {
    let clone = materials.get(palette);
    if (!clone) {
      clone = source.clone();
      clone.defines = { ...clone.defines, CITY_PALETTE: PALETTES[palette] };
      materials.set(palette, clone);
    }
    return clone;
  };
  // Aynı kütle ve palet tek örnekli mesh'te.
  const groups = new Map<string, Building[]>();
  for (const b of BUILDINGS) {
    const key = `${b.variant}_${b.palette}`;
    groups.set(key, [...(groups.get(key) ?? []), b]);
  }
  return [...groups.entries()].map(([key, list]) => {
    const mesh = new THREE.InstancedMesh(MASS_VARIANTS[list[0].variant]().build(), material(list[0].palette), list.length);
    mesh.name = `Science_Mass_${key}`;
    list.forEach((b, i) => mesh.setMatrixAt(i, blockMatrix(b, b.height)));
    mesh.instanceMatrix.needsUpdate = true;
    return mesh;
  });
}

// ------------------------------------------------------------------ parçalar

// Kırık tonlar: şehrin paletinden kopmayan, doygunluğu düşük renkler.
const TONE = {
  terracotta: '#b9775a',
  ochre: '#c9a35e',
  sage: '#8fa385',
  slate: '#7f98a8',
  wood: '#a88a68',
  white: '#e6e1d6',
  steel: '#8c8f92',
  roof: '#a9aaa6',
  ridge: '#7c7e7d',
  stone: '#b8b2a6',
  dark: '#4a4d50',
  pv: '#2f3842',
  bronze: '#8a6a42',
  crate: '#9c8466',
  container: '#8e6b5a',
};
const BIKE_TONES = [TONE.slate, TONE.ridge, TONE.terracotta, TONE.sage, TONE.white];
const UMBRELLA_TONES = [TONE.white, TONE.ochre, TONE.white, TONE.sage];

/** Yönsüz bank: alongX ise oturma x ekseninde. */
function bench(props: PropBuilder, x: number, z: number, alongX: boolean) {
  const y = GROUND_Y;
  const [hx, hz] = alongX ? [0.9, 0.3] : [0.3, 0.9];
  props.box(x - hx, x + hx, y + 0.3, y + 0.45, z - hz, z + hz, TONE.wood);
  props.box(x - hx * 0.85, x + hx * 0.85, y, y + 0.3, z - hz * 0.7, z + hz * 0.7, TONE.steel);
}

function totem(props: PropBuilder, x: number, z: number) {
  props.box(x - 0.35, x + 0.35, GROUND_Y, GROUND_Y + 2.8, z - 0.15, z + 0.15, TONE.dark);
  props.box(x - 0.36, x + 0.36, GROUND_Y + 2.2, GROUND_Y + 2.6, z - 0.16, z + 0.16, TONE.ochre);
}

function bikeStation(props: PropBuilder, b: Box) {
  const y = GROUND_Y;
  for (let x = b.x0 + 0.6, k = 0; x < b.x1 - 0.4; x += 0.9, k++) {
    if (hash2(x, b.z0) < 0.3) continue;
    props.box(x - 0.05, x + 0.05, y, y + 1.0, b.z0, b.z1, BIKE_TONES[k % BIKE_TONES.length]);
  }
  props.box(b.x0, b.x1, y, y + 0.9, b.z1 + 0.1, b.z1 + 0.4, TONE.slate);
  // Sundurma: arkada dikmeler, öne eğimli çatı.
  for (const x of [b.x0 + 0.3, (b.x0 + b.x1) / 2, b.x1 - 0.3]) props.box(x - 0.1, x + 0.1, y, y + 2.5, b.z1 + 0.1, b.z1 + 0.3, TONE.steel);
  props.box(b.x0 - 0.3, b.x1 + 0.3, y + 2.4, y + 2.55, b.z0 - 0.4, b.z1 + 0.4, TONE.roof);
}

// Gezinti aksında banklar (ağaç havuzlarının arasında), yörünge meydanının kenarında banklar.
const PROMENADE_BENCHES: [number, number, boolean][] = promenadePits
  .filter(([x], i) => i % 6 === 0 && x + 5 < LOT.x1 - 4)
  .map(([x, z]) => [x + 5, z, true]);
const ORBIT_BENCHES: [number, number, boolean][] = Array.from({ length: 16 }, (_, k) => {
  const a = (k / 16) * Math.PI * 2 + 0.2;
  const r = ORBIT_R - 2.4;
  return [DOME.x + Math.cos(a) * r, DOME.z + Math.sin(a) * r, Math.abs(Math.sin(a)) > 0.7] as [number, number, boolean];
}).filter(([x, z]) => !inBox(pad(HALL, 3), x, z) && Math.abs(x - (DOME.x - ORBIT_R)) > 3);

// Bisiklet istasyonları ve otobüs durağı.
const BIKES: Box[] = [
  { x0: 482, x1: 498, z0: -312, z1: -310 },
  { x0: 770, x1: 788, z0: -121, z1: -119 },
  { x0: 640, x1: 652, z0: -361, z1: -359 },
];
const BUS_STOP: Box = { x0: 712, x1: 726, z0: -74.6, z1: -72.6 };
const TOTEMS: [number, number][] = [
  [LOT.x0 + 3, PROMENADE.z0 - 1],
  [LOT.x1 - 3, PROMENADE.z0 - 1],
  [WALK.x0 - 1.2, LOT.z1 - 3],
  [STATION_PLAZA.x1 - 2, STATION_PLAZA.z0 + 2],
  [TOWER_COURT.x0 + 2, TOWER_COURT.z1 - 2],
];

function propsGeometry() {
  const props = new PropBuilder();
  const y = GROUND_Y;

  // Laboratuvar çatılarında güneş paneli dizileri (kenarlardan 2 m içeride, 3 m arayla).
  for (const b of PV_ROOFS) {
    const top = BASE_Y + b.height;
    for (let z = b.z0 + 2.4; z + 1.8 < b.z1 - 2; z += 3) props.box(b.x0 + 3, b.x1 - 3, top + 0.3, top + 0.7, z, z + 1.8, TONE.pv);
  }

  // Teleferik istasyonuna merdiven-asansör kulesinden köprü, kulenin dibinde saçak.
  props.box(STATION.x1 - 2, LIFT.x0, 13.4, 14.2, -331.6, -328.4, TONE.roof);
  props.box(STATION.x1 - 2, LIFT.x0, 14.2, 15.3, -331.6, -331.4, TONE.steel);
  props.box(STATION.x1 - 2, LIFT.x0, 14.2, 15.3, -328.6, -328.4, TONE.steel);
  props.box(LIFT.x0 - 2, LIFT.x1 + 3, y + 3.6, y + 3.9, LIFT.z1, LIFT.z1 + 3.5, TONE.ridge);
  for (const x of [LIFT.x0 - 1.6, LIFT.x1 + 2.6]) props.box(x - 0.12, x + 0.12, y, y + 3.6, LIFT.z1 + 3, LIFT.z1 + 3.24, TONE.steel);

  // Kule önünde yanaşma saçağı: podyuma yaslı, dikmeler döngünün iç kenarında.
  const dc = DROP_CANOPY;
  props.box(dc.x0, dc.x1, y + 5.4, y + 5.9, dc.z0, dc.z1, TONE.roof);
  for (const z of [dc.z0 + 1, dc.z1 - 1]) props.box(dc.x1 - 1, dc.x1 - 0.6, y, y + 5.4, z - 0.2, z + 0.2, TONE.steel);

  // Güneş saati: kadranın ortasında kuzeye doğru yükselen gölge çubuğu (basamaklı bronz levha), taş kaide.
  props.box(SUNDIAL.x - 1.2, SUNDIAL.x + 1.2, y, y + 0.4, SUNDIAL.z - 6, SUNDIAL.z + 5.5, TONE.stone);
  for (let i = 0; i < 8; i++) {
    const z1 = SUNDIAL.z + 5 - i * 1.3;
    props.box(SUNDIAL.x - 0.12, SUNDIAL.x + 0.12, y + 0.4, y + 0.4 + 1.1 * (i + 1), z1 - 1.3, z1, TONE.bronze);
  }

  // Sarkaç: iki dikme ve kiriş, ince tel, bronz top; çevresinde devrilecek taş pimler.
  const pd = PENDULUM;
  for (const dx of [-4.5, 4.5]) props.box(pd.x + dx - 0.25, pd.x + dx + 0.25, y, y + 9, pd.z - 0.25, pd.z + 0.25, TONE.steel);
  props.box(pd.x - 5, pd.x + 5, y + 9, y + 9.5, pd.z - 0.3, pd.z + 0.3, TONE.steel);
  props.box(pd.x + 0.6, pd.x + 0.66, y + 1.6, y + 9, pd.z - 0.03, pd.z + 0.03, TONE.dark);
  props.cylinder(pd.x + 0.63, y + 0.9, pd.z, 0.55, 0.8, 'y', TONE.bronze, 10);
  for (let k = 0; k < 12; k++) {
    const a = (k / 12) * Math.PI * 2;
    const px = pd.x + Math.cos(a) * 3.6;
    const pz = pd.z + Math.sin(a) * 3.6;
    props.box(px - 0.1, px + 0.1, y, y + 0.6, pz - 0.1, pz + 0.1, TONE.white);
  }

  // Teleskoplar: taş ayak üstünde kuzeye bakan tüp.
  for (const dx of [-3, 0, 3]) {
    const x = SCOPES.x + dx;
    props.cylinder(x, y, SCOPES.z, 0.3, 1.3, 'y', TONE.stone, 8);
    props.box(x - 0.18, x + 0.18, y + 1.3, y + 1.66, SCOPES.z - 1.4, SCOPES.z + 0.5, TONE.white);
    props.box(x - 0.24, x + 0.24, y + 1.24, y + 1.72, SCOPES.z - 1.5, SCOPES.z - 1.2, TONE.dark);
  }

  // Sarmal heykel: orta direk, iki bronz iplik ve aralarında basamaklar.
  const hx = HELIX;
  props.cylinder(hx.x, y, hx.z, 0.15, 11, 'y', TONE.steel, 6);
  for (let k = 0; k < 22; k++) {
    const a = k * 0.5;
    const h = y + 0.6 + k * 0.45;
    for (const phase of [0, Math.PI]) {
      const px = hx.x + Math.cos(a + phase) * 1.8;
      const pz = hx.z + Math.sin(a + phase) * 1.8;
      props.box(px - 0.22, px + 0.22, h, h + 0.44, pz - 0.22, pz + 0.22, phase ? TONE.slate : TONE.bronze);
    }
    if (k % 2 === 0) {
      const cx = Math.cos(a) * 1.6;
      const cz = Math.sin(a) * 1.6;
      props.box(hx.x - Math.abs(cx), hx.x + Math.abs(cx) + 0.06, h + 0.18, h + 0.26, hx.z - Math.abs(cz), hx.z + Math.abs(cz) + 0.06, TONE.white);
    }
  }

  // Güneş sistemi yürüyüşü: Güneş ve gezegenler aksın kenarında taş kaide üstünde küre.
  props.cylinder(SUN_X, y, PEDESTAL_Z, 0.5, 1.0, 'y', TONE.stone, 10);
  props.cylinder(SUN_X, y + 1.0, PEDESTAL_Z, 1.3, 1.6, 'y', TONE.ochre, 12);
  for (const planet of PLANETS) {
    const x = planetX(planet.au);
    props.box(x - 0.4, x + 0.4, y, y + 1.1, PEDESTAL_Z - 0.4, PEDESTAL_Z + 0.4, TONE.stone);
    const r = Math.min(planet.r, 0.9);
    props.cylinder(x, y + 1.1, PEDESTAL_Z, r, r * 1.6, 'y', planet.tone, 10);
  }

  // Banklar.
  for (const [x, z, along] of [...PROMENADE_BENCHES, ...ORBIT_BENCHES]) bench(props, x, z, along);
  for (const q of QUADS) {
    for (const dx of [-30, 30]) bench(props, QUAD_X + dx, (q.z0 + q.z1) / 2 + 3, true);
  }
  for (const [x, z] of [[SUNDIAL.x - 9, SUNDIAL.z + 8], [SUNDIAL.x + 9, SUNDIAL.z + 8], [PENDULUM.x + 7, PENDULUM.z + 6]]) bench(props, x, z, true);

  // Planetaryum holünün önünde büfe ve şemsiyeli masalar.
  const k = KIOSK;
  props.box(k.x0, k.x1, y, y + 3, k.z0, k.z1, TONE.wood);
  props.box(k.x0 - 0.6, k.x1 + 0.6, y + 3, y + 3.3, k.z0 - 0.6, k.z1 + 1.4, TONE.ridge);
  for (let i = 0; i < 6; i++) {
    const ux = 600 + (i % 3) * 7;
    const uz = -287 + Math.floor(i / 3) * 7;
    props.box(ux - 0.05, ux + 0.05, y, y + 2.4, uz - 0.05, uz + 0.05, TONE.steel);
    props.pyramid(ux - 1.4, ux + 1.4, y + 2.2, y + 2.8, uz - 1.4, uz + 1.4, UMBRELLA_TONES[i % UMBRELLA_TONES.length]);
    props.cylinder(ux, y, uz, 0.5, 0.75, 'y', TONE.white, 8);
  }

  // Bisiklet istasyonları, otobüs durağı, yön totemleri.
  for (const b of BIKES) bikeStation(props, b);
  const bs = BUS_STOP;
  props.box(bs.x0, bs.x1, y + 2.6, y + 2.8, bs.z0 - 0.4, bs.z1 + 0.2, TONE.roof);
  props.box(bs.x0 + 0.2, bs.x1 - 0.2, y, y + 2.6, bs.z0, bs.z0 + 0.1, TONE.slate);
  for (const x of [bs.x0 + 0.3, bs.x1 - 0.3]) props.box(x - 0.08, x + 0.08, y, y + 2.6, bs.z1 - 0.3, bs.z1 - 0.14, TONE.steel);
  props.box(bs.x0 + 2, bs.x1 - 2, y + 0.4, y + 0.5, bs.z0 + 0.1, bs.z0 + 0.6, TONE.wood);
  for (const [x, z] of TOTEMS) totem(props, x, z);

  // Gözlemevi çiti (güneyde kapı) ve kapı babaları.
  const c = COMPOUND;
  const fence = (x0: number, x1: number, z0: number, z1: number) => props.box(x0, x1, y, y + 2, z0, z1, TONE.steel);
  fence(c.x0, c.x1, c.z0, c.z0 + 0.08);
  fence(c.x0, c.x0 + 0.08, c.z0, c.z1);
  fence(c.x1 - 0.08, c.x1, c.z0, c.z1);
  fence(c.x0, COMPOUND_GATE.x0, c.z1 - 0.08, c.z1);
  fence(COMPOUND_GATE.x1, c.x1, c.z1 - 0.08, c.z1);
  for (const x of [COMPOUND_GATE.x0, COMPOUND_GATE.x1]) props.box(x - 0.3, x + 0.3, y, y + 2.4, c.z1 - 0.3, c.z1 + 0.3, TONE.stone);

  // Yükleme alanı: konteynerler, çöp konteynerleri, palet yığınları.
  const l = LOADING;
  props.box(l.x0 + 2, l.x0 + 14, y, y + 2.6, l.z0 + 2, l.z0 + 4.4, TONE.container);
  props.box(l.x0 + 2, l.x0 + 8, y, y + 2.6, l.z0 + 5.2, l.z0 + 7.6, TONE.slate);
  for (let i = 0; i < 3; i++) props.box(l.x0 + 18 + i * 2.2, l.x0 + 19.8 + i * 2.2, y, y + 1.3, l.z1 - 2.2, l.z1 - 0.8, TONE.sage);
  for (let i = 0; i < 4; i++) props.box(l.x0 + 28 + i * 1.6, l.x0 + 29.2 + i * 1.6, y, y + 0.3 * (4 - i), l.z1 - 2.4, l.z1 - 1.2, TONE.crate);
  return props.build();
}

// ------------------------------------------------------------------ araçlar

// Kule önünde yanaşmadaki taksiler, yükleme alanında servis araçları, gözlemevinde personel araçları.
const VEHICLES: [string, number, number, number][] = [
  ['White', 841.5, -170, Math.PI / 2],
  ['Graphite', 841.5, -160, Math.PI / 2],
  ['White', 748, -539.5, Math.PI / 2],
  ['Silver', 754, -539.5, Math.PI / 2],
  ['Blue', 512, -450, 0],
  ['Silver', 512, -446, 0],
];

function vehicleMeshes(cityRoot: THREE.Object3D) {
  const colors = ['White', 'Silver', 'Graphite', 'Blue'];
  return colors
    .map((color) => {
      const spots = VEHICLES.filter(([c]) => c === color).map(([, x, z, yaw]): VehicleSpot => [x, z, yaw]);
      return parkedVehicles(cityRoot, `Cars_${color}`, 'Science', spots);
    })
    .filter((mesh) => mesh !== null);
}

// ------------------------------------------------------------------ ağaçlar ve lambalar

// Ağaç dikilmeyen yerler: tepe bunların üstüne taşmaz.
const SOLID: Box[] = [
  ...BUILDINGS,
  TOWER,
  STATION,
  DISH,
  RADOME,
  COMPOUND,
  PARKING,
  LOADING,
  SERVICE,
  PLOTS,
  DROP_LOOP,
  KIOSK,
  pad(BUS_STOP, 0.5),
  ...BIKES.map((b) => pad(b, 0.6)),
  { x0: POND.x - POND.rx - 7, x1: POND.x + POND.rx + 7, z0: POND.z - POND.rz - 7, z1: POND.z + POND.rz + 7 },
];
// Döşemeler: gövde uzakta, tepe kenara biraz taşabilir.
const PAVED: Box[] = [PROMENADE, WALK, LAB_COURT, STATION_PLAZA, ACCESS, HALL_COURT, TOWER_COURT, COMPOUND_PATH];
const CIRCLES: Disc[] = [{ x: DOME.x, z: DOME.z, r: ORBIT_R }, ...PADS];

function pathDistance(x: number, z: number) {
  let best = Infinity;
  for (const [ax, az, bx, bz] of GARDEN_PATHS) {
    const dx = bx - ax;
    const dz = bz - az;
    const t = Math.min(1, Math.max(0, ((x - ax) * dx + (z - az) * dz) / (dx * dx + dz * dz)));
    best = Math.min(best, Math.hypot(x - ax - dx * t, z - az - dz * t));
  }
  return best;
}

/** Tepe yarıçapı `radius` olan ağaç buraya sığar mı: plakada (yola taşmaz), yapılardan, meydanlardan ve lambalardan uzak. */
function treeAllowed(x: number, z: number, radius: number, lamps: number[]) {
  if (!inBox(LOT, x, z, -radius)) return false;
  const island = islandBoxes.some((b) => inBox(b, x, z));
  if (SOLID.some((b) => (island && b === PARKING ? false : inBox(b, x, z, radius + 0.5)))) return false;
  if (!island && PAVED.some((b) => inBox(b, x, z, radius * 0.5 + 1))) return false;
  if (CIRCLES.some((d) => Math.hypot(x - d.x, z - d.z) < d.r + radius * 0.6 + 1)) return false;
  if (QUADS.some((q) => inBox(q, x, z) && (Math.abs(x - QUAD_X) < radius + 2 || Math.abs(z - (q.z0 + q.z1) / 2) < radius + 1.5))) return false;
  if (pathDistance(x, z) < radius * 0.5 + GARDEN_PATH_HALF + 0.5) return false;
  if (TOTEMS.some(([tx, tz]) => Math.hypot(x - tx, z - tz) < radius + 0.5)) return false;
  const reach = (radius + 1) * (radius + 1);
  for (let i = 0; i < lamps.length; i += 3) {
    const dx = x - lamps[i];
    const dz = z - lamps[i + 2];
    if (dx * dx + dz * dz < reach) return false;
  }
  return true;
}

/** Ağaç planı. `crown`: boy çarpanı 1 olan ağacın tepe yarıçapı (replantTrees'in boy dağılımıyla). */
function plantTrees(crown: number, lamps: number[]): TreeSpot[] {
  const trees: TreeSpot[] = [];
  // Kareli uzaklıkla (Math.hypot 360 ağaçlık listede yavaş kalıyordu).
  const free = (x: number, z: number, spacing: number) =>
    trees.every(([tx, tz]) => (tx - x) * (tx - x) + (tz - z) * (tz - z) > spacing * spacing);
  // Sığmazsa daha küçük boy denenir (dar şeritlerde küçük ağaç).
  const add = (x: number, z: number, spacing: number, sizes = [1, 0.8, 0.62]) => {
    if (!free(x, z, spacing)) return;
    for (const size of sizes) {
      const radius = crown * size * (0.75 + 0.55 * hash2(x, z));
      if (treeAllowed(x, z, radius, lamps)) {
        trees.push([x, z, size]);
        return;
      }
    }
  };
  const jitter = (a: number, b: number) => (hash2(a, b) - 0.5) * 2;
  const scatter = (b: Box, count: number, spacing: number, seed: number, sizes?: number[]) => {
    for (let k = 0; k < count; k++) add(b.x0 + hash2(k, seed) * (b.x1 - b.x0), b.z0 + hash2(k, seed + 1) * (b.z1 - b.z0), spacing, sizes);
  };

  // Gezinti aksının ağaç havuzları ve otopark adacıkları (döşemenin içinde, plan düzeninde).
  for (const [x, z] of promenadePits) trees.push([x, z, 0.62]);
  for (const b of islandBoxes) trees.push([(b.x0 + b.x1) / 2, (b.z0 + b.z1) / 2, 0.25]);
  // Kule önünde iki ağaç dizisi (meydanın kuzey ve güney kenarında, havuzlu).
  for (let x = TOWER_COURT.x0 + 6; x < DROP_LOOP.x0 - 4; x += 9) {
    for (const z of [TOWER_COURT.z0 + 5, TOWER_COURT.z1 - 5]) if (!BIKES.some((b) => inBox(b, x, z, 4.5))) trees.push([x, z, 0.62]);
  }
  // Yürüyüş yolunun iki yanında dizi.
  for (let z = LAB_COURT.z1 + 8; z < LOT.z1 - 4; z += 11) {
    add(WALK.x0 - 5, z, 8, [0.8, 0.62]);
    add(WALK.x1 + 5, z, 8, [0.8, 0.62]);
  }
  // Hol önünde iki dizi, otoparkla aks arasında dizi.
  for (let z = HALL_COURT.z0 + 5; z < HALL_COURT.z1 - 3; z += 9) {
    add(HALL_COURT.x0 - 4, z, 7, [0.8, 0.62]);
    add(HALL_COURT.x1 + 4, z, 7, [0.8, 0.62]);
  }
  for (let x = PARKING.x0 + 4; x < PARKING.x1; x += 10) add(x, (PARKING.z1 + PROMENADE.z0) / 2, 8, [0.8, 0.62]);
  // Araştırma avlularının kenarlarında küçük ağaçlar.
  for (const q of QUADS) {
    for (let x = q.x0 + 10; x < q.x1 - 4; x += 12) {
      add(x, q.z0 + 5, 7, [0.62]);
      add(x, q.z1 - 5, 7, [0.62]);
    }
  }
  // Bilim parkı: korular ve tek tük ağaçlar, güney sokağı boyunca dizi.
  scatter({ x0: LOT.x0 + 3, x1: 545, z0: PROMENADE.z1 + 4, z1: LOT.z1 - 3 }, 70, 11, 300);
  for (let x = LOT.x0 + 8; x < WALK.x0 - 4; x += 11) add(x + jitter(x, 5), LOT.z1 - 7, 8, [0.8, 0.62]);
  // Kule ile yürüyüş yolu arası ve güneyi, doğu çayırında koru.
  scatter({ x0: WALK.x1 + 3, x1: TOWER_COURT.x0 - 2, z0: -290, z1: LOT.z1 - 3 }, 30, 11, 310);
  scatter({ x0: TOWER_COURT.x0, x1: LOT.x1 - 3, z0: TOWER_COURT.z1 + 3, z1: LOT.z1 - 3 }, 14, 10, 320);
  scatter(MEADOWS[0], 26, 10, 330);
  // Kuzey: laboratuvarların doğusu, gözlemevinin çevresi, parsellerin ve göletin çevresi, batı şeridi.
  scatter(MEADOWS[2], 30, 9, 340);
  scatter({ x0: LOT.x0 + 3, x1: COMPOUND.x0 - 2, z0: LOT.z0 + 4, z1: ACCESS.z0 - 2 }, 18, 9, 350);
  scatter(MEADOWS[1], 16, 10, 360);
  scatter({ x0: 528, x1: 640, z0: -440, z1: -356 }, 26, 9, 370);
  for (let x = COMPOUND.x1 + 4; x < SPINE.x0 - 4; x += 10) add(x, LOT.z0 + 6, 8, [0.8, 0.62]);
  for (let z = PLOTS.z0 + 4; z < PLOTS.z1; z += 10) add(PLOTS.x1 + 7, z, 8, [0.8, 0.62]);
  // Teleferik meydanının batısında ve otopark yolunun iki yanında birkaç ağaç.
  scatter({ x0: LOT.x0 + 3, x1: STATION_PLAZA.x0 - 2, z0: ACCESS.z1 + 2, z1: PROMENADE.z0 - 2 }, 10, 9, 380);
  return trees;
}

/** Lambalar: aks, yürüyüş yolu, yörünge meydanı, otopark ve yollar, kule önü, avlular, bilim parkı. */
function scienceLamps(): number[] {
  const lamps: number[] = [];
  const low = GROUND_Y + 4.5;
  const tall = GROUND_Y + 8;
  for (let x = LOT.x0 + 15; x < LOT.x1 - 4; x += 20) {
    if (x > WALK.x0 - 3 && x < WALK.x1 + 3) continue;
    lamps.push(x, low, PROMENADE.z0 + 0.6, x, low, PROMENADE.z1 - 0.6);
  }
  for (let z = LAB_COURT.z1 + 14; z < LOT.z1 - 4; z += 22) {
    if (z > PROMENADE.z0 - 3 && z < PROMENADE.z1 + 3) continue;
    lamps.push(WALK.x0 + 0.6, low, z);
  }
  for (let k = 0; k < 12; k++) {
    const a = ((k + 0.5) / 12) * Math.PI * 2;
    const x = DOME.x + Math.cos(a) * (ORBIT_R - 0.8);
    const z = DOME.z + Math.sin(a) * (ORBIT_R - 0.8);
    if (!inBox(pad(HALL, 2), x, z)) lamps.push(x, low, z);
  }
  for (const x of [575, 610, 645]) lamps.push(x, tall, PARKING.z1 + 1);
  for (const x of [450, 490, 530]) lamps.push(x, tall, ACCESS.z0 - 1);
  for (let x = SERVICE.x0 + 20; x < SERVICE.x1; x += 55) lamps.push(x, tall, SERVICE.z0 - 1);
  for (const [x, z] of [[TOWER_COURT.x0 + 2, -205], [TOWER_COURT.x0 + 2, -125], [836, -205], [836, -125]]) lamps.push(x, low, z);
  for (const z of [-285, -262]) lamps.push(HALL_COURT.x0 + 0.6, low, z, HALL_COURT.x1 - 0.6, low, z);
  for (const q of QUADS) lamps.push(QUAD_X - 2.6, low, (q.z0 + q.z1) / 2 - 10, QUAD_X + 2.6, low, (q.z0 + q.z1) / 2 + 10);
  for (const [x, z] of [[STATION_PLAZA.x0 + 1, STATION_PLAZA.z0 + 1], [STATION_PLAZA.x0 + 1, STATION_PLAZA.z1 - 2]]) lamps.push(x, low, z);
  for (const [x, z] of [[COMPOUND.x0 + 2, COMPOUND.z1 - 2], [COMPOUND.x1 - 2, COMPOUND.z1 - 2]]) lamps.push(x, low, z);
  for (const x of [LAB_COURT.x0 + 1, LAB_COURT.x1 - 1]) lamps.push(x, low, LAB_COURT.z1 - 1);
  for (const [x, z] of [[GARDEN_PATHS[0][0] + 2.2, -270], [GARDEN_PATHS[0][0] + 2.2, -235], [PENDULUM.x + 2.2, -100]]) lamps.push(x, low, z);
  for (const d of [SUNDIAL, PENDULUM]) lamps.push(d.x + d.r * 0.7, low, d.z - d.r * 0.7);
  return lamps;
}

// ------------------------------------------------------------------ kurulum

/** Dünya koordinatında yatay düzlem (köşe renkleri beyaz). */
function plane(b: Box, y: number) {
  const geometry = new THREE.PlaneGeometry(b.x1 - b.x0, b.z1 - b.z0).rotateX(-Math.PI / 2);
  geometry.translate((b.x0 + b.x1) / 2, y, (b.z0 + b.z1) / 2);
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(new Array(geometry.getAttribute('position').count * 3).fill(1), 3));
  return geometry;
}

/**
 * Mesh'in bu alanlardaki üçgenlerini siler ve geometriyi sıkıştırır (sınır kutusu da küçülür, seçim kutuları eski kanatları
 * kapsamaz). Laboratuvar cephe ve çatı mesh'lerinde radom binası, ortak meydan mesh'inde diğer istasyonlar kalır.
 */
function dropTriangles(mesh: THREE.Mesh, areas: Box[]) {
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
    if (!areas.some((area) => inBox(area, x, z))) kept.push(vertex(k), vertex(k + 1), vertex(k + 2));
  }
  geometry.setIndex(kept);
  mesh.geometry = geometry.toNonIndexed();
  geometry.dispose();
}

// Eski laboratuvar kanatları ve köprüleri (radom binası bu alanın dışında).
const OLD_LABS: Box = { x0: 630, x1: 810, z0: -545, z1: -355 };
const REPLACED = /^Science_(Ground|Link_Bridges)$/;
const OWN = /^Science_(Ground|Props|Mass_.+)$/;

/**
 * Bilim merkezini yeniden düzenler: modeldeki zemin ve köprüler kaldırılır, laboratuvar kanatları cephe ve çatı mesh'lerinden,
 * bloktaki teleferik meydanı ortak meydan mesh'inden silinir, eski çatı panelleri gizlenir. Yerine tek zemin
 * (Science_Ground, rengi SCIENCE_FRAGMENT ile cityRuntime çizer), binalar, parçalar, araçlar ve ağaçlar gelir. Lamba
 * konumlarını döndürür. Hazırlık ikinci kez çalışırsa (StrictMode) tekrar etmez. Araçlar createTraffic'ten sonra kurulur.
 */
export function landscapeScienceCenter(cityRoot: THREE.Object3D, treeScale: number): number[] {
  const done = cityRoot.userData.scienceLamps as number[] | undefined;
  if (done) return done;
  cityRoot.updateMatrixWorld(true);
  const ground = cityRoot.getObjectByName('Science_Ground');
  const dish = cityRoot.getObjectByName('Science_SatelliteDish');
  const labs = cityRoot.getObjectByName('Science_Labs_Facade');
  const roofs = cityRoot.getObjectByName('Science_Roofs');
  const plazas = cityRoot.getObjectByName('CableCar_Plazas');
  const solar = cityRoot.getObjectByName('Energy_SolarRows');
  let facade: THREE.Material | null = null;
  const removed: THREE.Mesh[] = [];
  cityRoot.traverse((object) => {
    if (!(object instanceof THREE.Mesh)) return;
    if (!facade && object instanceof THREE.InstancedMesh && object.name.startsWith('Residential_Buildings_')) {
      facade = object.material as THREE.Material;
    }
    if (REPLACED.test(object.name)) removed.push(object);
  });
  if (
    !(ground instanceof THREE.Mesh) ||
    !(dish instanceof THREE.Mesh) ||
    !(labs instanceof THREE.Mesh) ||
    !(roofs instanceof THREE.Mesh) ||
    !facade ||
    Array.isArray(ground.material) ||
    Array.isArray(dish.material)
  ) {
    return [];
  }

  const parent = ground.parent ?? cityRoot;
  for (const mesh of removed) {
    mesh.removeFromParent();
    mesh.geometry.dispose();
  }
  dropTriangles(labs, [OLD_LABS]);
  dropTriangles(roofs, [OLD_LABS]);
  if (plazas instanceof THREE.Mesh) dropTriangles(plazas, [SITE]);
  // Eski kanatların çatısındaki panel dizileri gizlenir (ölçek sıfır), yerine yeni çatılarda paneller.
  if (solar instanceof THREE.InstancedMesh) {
    const matrix = new THREE.Matrix4();
    const position = new THREE.Vector3();
    const zero = new THREE.Matrix4().makeScale(0, 0, 0);
    for (let i = 0; i < solar.count; i++) {
      solar.getMatrixAt(i, matrix);
      position.setFromMatrixPosition(matrix).applyMatrix4(solar.matrixWorld);
      if (inBox(OLD_LABS, position.x, position.z)) solar.setMatrixAt(i, zero);
    }
    solar.instanceMatrix.needsUpdate = true;
    solar.computeBoundingBox();
    solar.computeBoundingSphere();
  }
  // Zemin: aynı yükseklikte tek plaka (eski yol ve disk üçgenleri gider), LANDSCAPES malzemeyi klonlayıp yamar.
  const site = new THREE.Mesh(plane(LOT, GROUND_Y), ground.material);
  site.name = 'Science_Ground';
  site.userData = { groundLayered: true };
  // Parçalar çanağın satin malzemesini paylaşır (köşe renkli).
  const props = new THREE.Mesh(propsGeometry(), dish.material);
  props.name = 'Science_Props';
  for (const mesh of [site, props, ...buildingMeshes(facade)]) parent.add(mesh);
  for (const mesh of vehicleMeshes(cityRoot)) parent.add(mesh);
  // Yeni parçalar dünya koordinatında kuruldu: ebeveynin dönüşümü birim olmalı.
  parent.updateMatrixWorld(true);
  if (!parent.matrixWorld.equals(new THREE.Matrix4())) {
    const inverse = parent.matrixWorld.clone().invert();
    for (const child of parent.children) {
      if (OWN.test(child.name) || child.name.startsWith('Traffic_Science_')) child.applyMatrix4(inverse);
    }
  }

  const lamps = scienceLamps();
  replantTrees(cityRoot, {
    prefix: 'Science',
    inside: (x, z) => inBox(SITE, x, z),
    spots: plantTrees(crownRadius(cityRoot, treeScale), lamps),
    treeScale,
  });
  cityRoot.updateMatrixWorld(true);
  cityRoot.userData.scienceLamps = lamps;
  return lamps;
}
