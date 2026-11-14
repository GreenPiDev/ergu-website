// Hastanenin yeniden düzenlenmesi (D-F × 5-6 blokları, alan x 217..866, z 184..610, zemin plakası x 220..863, z 187..607).
// Modelde tek ton bej-haki bir plakanın üstünde 8 üçgenlik kutular vardı: iki adet 40×240 m'lik kesintisiz yatak kanadı,
// aralarında yeşil çatılı podyum, poliklinik kutusu, köprüyle bağlı doğu blok, cam kule (çatısında helipad), katlı otopark
// kutusu ve güneydoğuda çizgisiz düz asfaltta 992 araç. Plaka doğudaki 40 m'lik şeridi örtmüyordu, acil saçağına giden yol
// yoktu, ağaçlar serpiştirilmiş, alanın içinde lamba yoktu. Model değişmeden açılışta yeniden kurulur:
// - Yerinde kalanlar: cam kule ve helipad, kuzey giriş saçağı, acil saçağı ve ambulanslar, köprü, otoparktaki araçlar
//   (ağaç adaları ve yaya yolundaki park yerleri boşaltılır).
// - Bina: kanatlar üçer kütleye bölünür (22, 27, 30 m; üst katlar geri çekilmiş, aralarında alçak bağlantılar), podyum,
//   poliklinik ve acil binası, L planlı doğu blok, açık katlı otopark (döşeme, kolon, korkuluk, merdiven kuleleri, çatıda
//   park etmiş araçlar). Hepsi şehirle aynı kütle ve cephe sistemiyle.
// - Zemin (shader): bulvardan kule saçağına yanaşma döngüsü ve giriş meydanı, güneyde yaya girişi meydanı ve şifa bahçesi
//   (yollar, yansıma havuzu, çiçek tarhları), batı sokağından acile ambulans yolu ve taramalı ambulans cebi, çizgili açık
//   otopark (ağaç adaları, yaya yolu, bariyerli girişler), katlı otoparka ve servis avlusuna doğu yolu, batıda
//   rehabilitasyon bahçesi (yürüyüş halkası), biçilmiş çim, kenarda çit bitkisi.
// - Parçalar (kırık tonlar): güney girişinde cam saçak, kule saçağının kolonları, pergola, kameriye, banklar, otobüs
//   durağı, oksijen tankları, jeneratör ve konteynerler, yükleme saçağı, otopark bariyerleri ve gişeler, yön totemleri,
//   podyum çatısında ışıklıklar. Haç işareti yok (modeldeki haçlar kullanıcı isteğiyle kaldırılmıştı).
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
type Palette = 'lab' | 'civic';
type Building = Box & { height: number; variant: MassVariant; palette: Palette; base?: number };

const SITE: Box = { x0: 217, x1: 866, z0: 184, z1: 610 };
// Hastanenin zemin plakası: çevresi kaldırım.
const LOT: Box = { x0: 220, x1: 863, z0: 187, z1: 607 };
const GROUND_Y = 0.75;
const BASE_Y = 0.45;

// ---- binalar
// Yatak kanatları: kuzey kütle 20 m + geri çekilmiş 7 m, orta kütle 22 m + 8 m, güney kütle 22 m (podyumun içinden yükselir).
// Üst katlar ayrı kütle: tek kütle 24 m'yi geçerse cephe programı onu rastgele cam kuleye çevirebilir.
function wing(x0: number, x1: number): Building[] {
  return [
    { x0, x1, z0: 260, z1: 336, height: 20, variant: 'plain', palette: 'lab' },
    { x0: x0 + 2, x1: x1 - 2, z0: 262, z1: 334, height: 7, base: 20, variant: 'penthouse', palette: 'lab' },
    { x0: x0 + 4, x1: x1 - 4, z0: 336, z1: 348, height: 17, variant: 'plain', palette: 'lab' },
    { x0, x1, z0: 348, z1: 426, height: 22, variant: 'plain', palette: 'lab' },
    { x0: x0 + 2, x1: x1 - 2, z0: 350, z1: 424, height: 8, base: 22, variant: 'penthouseB', palette: 'lab' },
    { x0: x0 + 4, x1: x1 - 4, z0: 426, z1: 434, height: 17, variant: 'plain', palette: 'lab' },
    { x0, x1, z0: 434, z1: 500, height: 22, variant: 'penthouse', palette: 'lab' },
  ];
}
const WINGS: Building[] = [...wing(324, 364), ...wing(484, 524)];
const PODIUM: Building = { x0: 304, x1: 544, z0: 435, z1: 505, height: 11, variant: 'plain', palette: 'lab' };
// Podyumla poliklinik arasında kapalı geçit.
const LINK: Building = { x0: 330, x1: 350, z0: 505, z1: 515, height: 5, variant: 'plain', palette: 'lab' };
const OUTPATIENT: Building = { x0: 269, x1: 379, z0: 515, z1: 555, height: 9, variant: 'penthouse', palette: 'lab' };
const EAST_BLOCK: Building = { x0: 604, x1: 704, z0: 250, z1: 330, height: 18, variant: 'ell', palette: 'civic' };
const BUILDINGS: Building[] = [...WINGS, PODIUM, LINK, OUTPATIENT, EAST_BLOCK];

// Modelde kalan yapılar: cam kule, kule saçağı, acil saçağı, köprü.
const TOWER: Box = { x0: 374, x1: 474, z0: 342, z1: 418 };
const TOWER_CANOPY: Box = { x0: 404, x1: 444, z0: 324, z1: 336 };
const ER_CANOPY: Box = { x0: 282, x1: 336, z0: 557, z1: 583 };
const SKYBRIDGE: Box = { x0: 524, x1: 604, z0: 286, z1: 294 };
// Açık katlı otopark (modeldeki kutunun yerinde): dört kat, çatı katı araçlı.
const GARAGE: Box = { x0: 729, x1: 819, z0: 195, z1: 285 };
const GARAGE_LEVELS = [3.6, 7.2, 10.8, 14.4];
const GARAGE_CORES: Box[] = [
  { x0: 729, x1: 737, z0: 195, z1: 203 },
  { x0: 811, x1: 819, z0: 277, z1: 285 },
];

// ---- kuzey: bulvardan ana giriş, kule saçağının önünde yanaşma döngüsü
const ENTRY_ROAD: Box = { x0: 417, x1: 431, z0: LOT.z0, z1: 294 };
const ENTRY_X = 424;
const ENTRY_WALKS: Box[] = [
  { x0: 413, x1: 417, z0: LOT.z0, z1: 292 },
  { x0: 431, x1: 435, z0: LOT.z0, z1: 292 },
];
const LOOP: Box = { x0: 384, x1: 464, z0: 292, z1: 336 };
const LOOP_ISLAND: Box = { x0: 396, x1: 452, z0: 304, z1: 325 };
const FORECOURT: Box = { x0: 364, x1: 484, z0: 280, z1: 342 };
const COURTYARD: Box = { x0: 364, x1: 484, z0: 418, z1: 435 };

// ---- batı: rehabilitasyon bahçesi (yürüyüş halkası), acil
const REHAB = { x: 272, z: 360, hx: 34, hz: 66, r: 18 };
const REHAB_PLAZA = 9;
const REHAB_SPURS: Box[] = [
  { x0: 306, x1: 324, z0: 358.5, z1: 361.5 },
  { x0: 270.5, x1: 273.5, z0: 426, z1: OUTPATIENT.z0 },
];
const ER_BAY: Box = { x0: 280, x1: 338, z0: 557, z1: 585 };
const ER_ROAD: Box = { x0: LOT.x0, x1: 352, z0: 585, z1: 597 };
const ER_EXIT: Box = { x0: 340, x1: 352, z0: 597, z1: LOT.z1 };
// Ambulans park yerlerinin sınırları (modeldeki ambulanslar x 290, 302, 314, 326).
const AMBULANCE_LINES = [284, 296, 308, 320, 332];

// ---- güney: yaya girişi meydanı ve şifa bahçesi
const SOUTH_PLAZA: Box = { x0: 384, x1: 574, z0: 505, z1: 528 };
const WEST_WALK: Box = { x0: 304, x1: 384, z0: 505, z1: 515 };
const SOUTH_CANOPY: Box = { x0: 404, x1: 444, z0: 505, z1: 515 };
const GARDEN: Box = { x0: 384, x1: 568, z0: 528, z1: 600 };
const AXIS: Box = { x0: 421, x1: 427, z0: 528, z1: LOT.z1 };
const CROSS: Box = { x0: 384, x1: 486, z0: 560, z1: 564 };
const POND: Box = { x0: 490, x1: 530, z0: 552, z1: 572 };
const POND_RIM = 1.2;
const POND_WALK: Box = { x0: 486, x1: 534, z0: 548, z1: 576 };
const GAZEBO = { x: 550, z: 588, half: 4.5 };
const GAZEBO_PATH: Box = { x0: 548, x1: 552, z0: 576, z1: 584 };
const BEDS: Box[] = [
  { x0: 394, x1: 414, z0: 538, z1: 552 },
  { x0: 435, x1: 470, z0: 538, z1: 552 },
  { x0: 394, x1: 414, z0: 572, z1: 590 },
  { x0: 435, x1: 470, z0: 572, z1: 590 },
];
const PERGOLA: Box = { x0: 440, x1: 476, z0: 558.8, z1: 565.2 };
const BUS_STOP: Box = { x0: 462, x1: 476, z0: 601.5, z1: 604.5 };

// ---- doğu: personel bahçesi, açık otopark, servis
const EAST_WALK: Box = { x0: 544, x1: 572, z0: 467, z1: 472 };
const EAST_FRONT: Box = { x0: 600, x1: 712, z0: 330, z1: 348 };
// Açık otopark: modeldeki araç sıraları (x 587.4'ten 2.8 m aralıkla 83 sütun, z 365.6'dan 16 m aralıkla 15 sıra).
const PARK: Box = { x0: 584, x1: 824, z0: 360, z1: 600 };
const BAY = 2.8;
const BAY_X0 = 586;
const BAY_COUNT = 83;
const ROW_Z0 = 365.6;
const ROW_STEP = 16;
const ROW_COUNT = 15;
const ROW_HALF = 2.9;
// Ağaç adaları: 14 sütunda bir iki park yeri, sıradan sıraya kaydırılarak (satranç tahtası). Yaya yolu: 34-35. sütunlar.
const ISLAND_PERIOD = 14;
const ISLAND_START = 6;
const WALK_COLUMN = 34;
// Adadaki ağacın boy çarpanı: en büyük tepe yarıçapı (~3.1 m) adanın yarı genişliği ile araç arasındaki boşluğa sığar.
const ISLAND_TREE = 0.4;
const LOT_WALK: Box = { x0: BAY_X0 + WALK_COLUMN * BAY, x1: BAY_X0 + (WALK_COLUMN + 2) * BAY, z0: PARK.z0, z1: PARK.z1 };
const NORTH_LANE: Box = { x0: 572, x1: PARK.x1, z0: 348, z1: 360 };
const WEST_LANE: Box = { x0: 572, x1: 584, z0: 348, z1: LOT.z1 };
const EAST_LANE: Box = { x0: 712, x1: 724, z0: LOT.z0, z1: 348 };
const EAST_ENTRY: Box = { x0: PARK.x1, x1: LOT.x1, z0: 449, z1: 458 };
const GARAGE_IN: Box = { x0: 724, x1: GARAGE.x0, z0: 228, z1: 244 };
const SERVICE_YARD: Box = { x0: 604, x1: 712, z0: 190, z1: 246 };
const TANKS: [number, number][] = [
  [688, 204],
  [698, 204],
];
const TANK_FENCE: Box = { x0: 682, x1: 704, z0: 197, z1: 211 };
const DOCK: Box = { x0: 620, x1: 680, z0: 244, z1: 250 };
// Yön totemleri: giriş yolunun başında, acil yolunda, otopark girişlerinde, güney meydanında.
const TOTEMS: [number, number][] = [
  [410, LOT.z0 + 6],
  [LOT.x0 + 8, ER_ROAD.z0 - 3],
  [EAST_ENTRY.x1 - 6, EAST_ENTRY.z1 + 3],
  [WEST_LANE.x0 - 3, LOT.z1 - 8],
  [ENTRY_X - 9, SOUTH_PLAZA.z1 + 3],
];

const f = (value: number) => value.toFixed(2);
const v2 = (x: number, z: number) => `vec2(${f(x)}, ${f(z)})`;
const box = (b: Box) => `${v2((b.x0 + b.x1) / 2, (b.z0 + b.z1) / 2)}, ${v2((b.x1 - b.x0) / 2, (b.z1 - b.z0) / 2)}`;
const inBox = (b: Box, x: number, z: number, pad = 0) => x > b.x0 - pad && x < b.x1 + pad && z > b.z0 - pad && z < b.z1 + pad;
const minAll = (terms: string[]) => terms.reduce((a, b) => `min(${a}, ${b})`);

/** Köşeleri r yarıçapla yuvarlatılmış kutuya işaretli uzaklık (GLSL'deki hpBox ile aynı). */
function roundBox(x: number, z: number, cx: number, cz: number, hx: number, hz: number, r: number) {
  const qx = Math.abs(x - cx) - hx + r;
  const qz = Math.abs(z - cz) - hz + r;
  return Math.hypot(Math.max(qx, 0), Math.max(qz, 0)) + Math.min(Math.max(qx, qz), 0) - r;
}

/** Otopark sırası ve sütunundaki park yeri ağaç adası mı (adalar bir sıra atlayarak, yaya yolu hariç). */
const islandBay = (row: number, col: number) => {
  const m = col % ISLAND_PERIOD;
  const group = Math.floor(col / ISLAND_PERIOD);
  return (m === ISLAND_START || m === ISLAND_START + 1) && (row + group) % 2 === 0 && col !== WALK_COLUMN && col !== WALK_COLUMN + 1;
};

/** Hastane planının mesafe fonksiyonları (GLSL, global kapsamda). */
export const HOSPITAL_GLSL = `
// Köşeleri r yarıçapla yuvarlatılmış kutuya işaretli uzaklık (içeride negatif).
float hpBox(vec2 p, vec2 c, vec2 h, float r){ vec2 q = abs(p - c) - h + r; return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r; }
float hpIn(float d, float aa){ return 1.0 - smoothstep(-aa, aa, d); }
// Eşit aralıklı çizgiler (metre): çizgi seçilemeyecek kadar uzaksa ortalama yoğunluğuna söner.
float hpLines(float v, float period, float width, float aa){
  float d = abs(fract(v / period + 0.5) - 0.5) * period;
  float line = 1.0 - smoothstep(width * 0.5 - aa, width * 0.5 + aa, d);
  return mix(width / period, line, 1.0 - smoothstep(width * 0.6, width * 1.5, aa));
}
// Boya bandı: d = 0 eğrisi boyunca w genişliğinde, piksel altına inince ortalama yoğunluğa söner.
float hpStroke(float d, float w, float aa){ return (1.0 - smoothstep(w * 0.5 - aa, w * 0.5 + aa, abs(d))) * min(1.0, w / aa); }
`;

// Bina çevresinde döşeme şeridi (temel kaldırımı).
const buildingApron = minAll(
  [...BUILDINGS, TOWER, { x0: GARAGE.x0, x1: GARAGE.x1, z0: GARAGE.z0, z1: GARAGE.z1 }].map((b) => `hpBox(p, ${box(b)}, 0.0)`),
);
const rehabRing = `hpBox(p, ${v2(REHAB.x, REHAB.z)}, ${v2(REHAB.hx, REHAB.hz)}, ${f(REHAB.r)})`;

/** Hastane zemini: Hospital_Ground'un rengi tamamen dünya konumundan çizilir (köşe renkleri yok sayılır). */
export const HOSPITAL_FRAGMENT = `#include <color_fragment>
  {
    vec2 p = vWPos.xz;
    float aa = max(fwidth(p.x), fwidth(p.y)) * 0.8 + 0.05;
    float fine = 1.0 - smoothstep(0.8, 2.5, aa);
    float n1 = fbm(p * 0.02);
    float n2 = fbm(p * 0.09 + 23.0);
    float grain = 0.94 + 0.12 * h12(floor(p * 3.0)) * fine;
    vec3 rimColor = vec3(0.55, 0.53, 0.5);
    vec3 paint = vec3(0.72, 0.7, 0.64);
    vec3 yellow = vec3(0.64, 0.5, 0.18);
    vec3 red = vec3(0.5, 0.16, 0.12);
    float mow = 1.0 - smoothstep(2.0, 5.0, aa);

    // Çim: biçme şeritleri ve geniş ton farkları.
    vec3 c = vec3(0.12, 0.18, 0.065) * (0.82 + 0.36 * n1);
    c *= 1.0 + (step(0.5, fract((p.x * 0.2 + p.y) / 9.0)) - 0.5) * 0.12 * mow;

    float joint = max(hpLines(p.x, 1.2, 0.08, aa), hpLines(p.y, 1.2, 0.08, aa));
    vec3 stone = vec3(0.56, 0.53, 0.48) * grain * (0.94 + 0.12 * n2) * (1.0 - 0.1 * joint);
    vec3 granite = vec3(0.3, 0.29, 0.28) * grain;
    float slab = max(hpLines(p.x, 5.0, 0.12, aa), hpLines(p.y, 5.0, 0.12, aa));
    vec3 concrete = vec3(0.47, 0.46, 0.43) * grain * (0.92 + 0.16 * n2) * (1.0 - 0.12 * slab);
    vec3 asphalt = vec3(0.2, 0.195, 0.19) * (0.88 + 0.24 * n2);
    vec3 hedge = vec3(0.055, 0.095, 0.035) * (0.7 + 0.6 * fbm(p * 0.45));

    // Plaka kenarında çit bitkisi (yollar sonra üstüne çizilir).
    float edge = min(min(p.x - ${f(LOT.x0)}, ${f(LOT.x1)} - p.x), min(p.y - ${f(LOT.z0)}, ${f(LOT.z1)} - p.y));
    c = mix(c, hedge, hpIn(edge - 2.2 + (n2 - 0.5) * 0.6, aa));

    // Taş döşemeler: giriş meydanları, avlu, bina çevresi, bahçe yolları, rehabilitasyon halkası.
    float paved = ${minAll([
      `hpBox(p, ${box(FORECOURT)}, 2.0)`,
      `hpBox(p, ${box(COURTYARD)}, 0.0)`,
      `hpBox(p, ${box(SOUTH_PLAZA)}, 1.0)`,
      `hpBox(p, ${box(WEST_WALK)}, 0.0)`,
      `hpBox(p, ${box(EAST_FRONT)}, 0.0)`,
      `hpBox(p, ${box(EAST_WALK)}, 0.0)`,
      `hpBox(p, ${box(AXIS)}, 0.0)`,
      `hpBox(p, ${box(CROSS)}, 0.0)`,
      `hpBox(p, ${box(POND_WALK)}, 2.0)`,
      `hpBox(p, ${box(GAZEBO_PATH)}, 0.0)`,
      `hpBox(p, ${v2(GAZEBO.x, GAZEBO.z)}, ${v2(GAZEBO.half + 2, GAZEBO.half + 2)}, 1.0)`,
      `hpBox(p, ${box(BUS_STOP)}, 0.0) - 1.5`,
      ...ENTRY_WALKS.map((w) => `hpBox(p, ${box(w)}, 0.0)`),
      ...REHAB_SPURS.map((w) => `hpBox(p, ${box(w)}, 0.0)`),
      `abs(${rehabRing}) - 1.5`,
      `length(p - ${v2(REHAB.x, REHAB.z)}) - ${f(REHAB_PLAZA)}`,
      `${buildingApron} - 2.4`,
    ])};
    c = mix(c, stone, hpIn(paved, aa));
    c = mix(c, rimColor, hpIn(abs(paved) - 0.2, aa) * fine * 0.6);
    // Meydanlarda tower eksenine hizalı 6 m'lik granit ızgara, eksende granit bant.
    {
      float plazas = min(hpBox(p, ${box(SOUTH_PLAZA)}, 1.0), hpBox(p, ${box(FORECOURT)}, 2.0));
      float grid = max(hpLines(p.x - ${f(ENTRY_X)}, 6.0, 0.3, aa), hpLines(p.y - ${f(SOUTH_PLAZA.z0)}, 6.0, 0.3, aa));
      c = mix(c, granite, grid * hpIn(plazas, aa) * 0.5);
      c = mix(c, granite, hpIn(abs(p.x - ${f(ENTRY_X)}) - 0.6, aa) * hpIn(hpBox(p, ${box({ ...SOUTH_PLAZA, z1: LOT.z1 })}, 0.0), aa));
      // Rehabilitasyon meydanında granit halka.
      c = mix(c, granite, hpIn(abs(length(p - ${v2(REHAB.x, REHAB.z)}) - ${f(REHAB_PLAZA - 1.5)}) - 0.4, aa));
    }

    // Beton: servis avlusu (yükleme rampası önü, tank çevresinde sarı çizgi).
    {
      float yard = hpBox(p, ${box(SERVICE_YARD)}, 1.0);
      c = mix(c, concrete, hpIn(yard, aa));
      c = mix(c, rimColor, hpIn(abs(yard) - 0.25, aa) * fine);
      c = mix(c, yellow, hpStroke(hpBox(p, ${box(TANK_FENCE)}, 0.0) - 1.0, 0.3, aa) * fine);
      c = mix(c, yellow, hpStroke(p.y - ${f(DOCK.z0 - 4)}, 0.3, aa) * step(${f(DOCK.x0)}, p.x) * step(p.x, ${f(DOCK.x1)}) * fine);
    }

    // Asfalt: giriş yolu ve yanaşma döngüsü, acil yolu ve cebi, otopark ve yolları, doğu yolu.
    float road = ${minAll([
      `hpBox(p, ${box(ENTRY_ROAD)}, 0.0)`,
      `hpBox(p, ${box(LOOP)}, 10.0)`,
      `hpBox(p, ${box(ER_BAY)}, 0.0)`,
      `hpBox(p, ${box(ER_ROAD)}, 0.0)`,
      `hpBox(p, ${box(ER_EXIT)}, 0.0)`,
      `hpBox(p, ${box(PARK)}, 2.0)`,
      `hpBox(p, ${box(NORTH_LANE)}, 0.0)`,
      `hpBox(p, ${box(WEST_LANE)}, 0.0)`,
      `hpBox(p, ${box(EAST_LANE)}, 0.0)`,
      `hpBox(p, ${box(EAST_ENTRY)}, 0.0)`,
      `hpBox(p, ${box(GARAGE_IN)}, 0.0)`,
    ])};
    float roadMask = hpIn(road, aa);
    c = mix(c, asphalt, roadMask);
    c = mix(c, rimColor, hpIn(abs(road) - 0.25, aa) * fine * step(${f(LOT.x0 + 0.5)}, p.x) * step(p.x, ${f(LOT.x1 - 0.5)}) * step(${f(LOT.z0 + 0.5)}, p.y) * step(p.y, ${f(LOT.z1 - 0.5)}));

    // Döngünün ortasında bitki adası (taş bordür).
    {
      float island = hpBox(p, ${box(LOOP_ISLAND)}, 5.0);
      c = mix(c, mix(hedge * 1.4, vec3(0.5, 0.36, 0.38), step(0.62, fbm(p * 0.6)) * 0.6), hpIn(island, aa));
      c = mix(c, stone, hpIn(abs(island) - 0.4, aa));
    }
    // Giriş yolunun orta kesik çizgisi, döngüde yön çizgisi, çıkışlarda dur çizgileri.
    c = mix(c, paint, hpStroke(p.x - ${f(ENTRY_X)}, 0.15, aa) * step(0.5, fract(p.y / 6.0)) * step(${f(LOT.z0 + 4)}, p.y) * step(p.y, ${f(LOOP.z0)}) * fine);
    c = mix(c, paint, hpStroke(p.y - ${f(LOT.z0 + 3)}, 0.4, aa) * step(${f(ENTRY_X)}, p.x) * step(p.x, ${f(ENTRY_ROAD.x1)}) * fine);
    c = mix(c, paint, hpStroke(p.x - ${f(LOT.x0 + 3)}, 0.4, aa) * step(${f(ER_ROAD.z0)}, p.y) * step(p.y, ${f(ER_ROAD.z1)}) * fine);
    c = mix(c, paint, hpStroke(p.y - ${f(LOT.z1 - 3)}, 0.4, aa) * step(${f(ER_EXIT.x0)}, p.x) * step(p.x, ${f(ER_EXIT.x1)}) * fine);

    // Acil: ambulans park yerleri, iki yanda kırmızı-beyaz tarama, cebin çevresinde sarı çizgi.
    {
      float bay = hpBox(p, ${box(ER_BAY)}, 0.0);
      float inBay = hpIn(bay, aa);
      float lines = 0.0;
      ${AMBULANCE_LINES.map((x) => `lines = max(lines, hpStroke(p.x - ${f(x)}, 0.2, aa));`).join('\n      ')}
      c = mix(c, paint, lines * inBay * step(${f(ER_BAY.z0 + 4)}, p.y) * step(p.y, ${f(ER_BAY.z1 - 4)}) * fine);
      float hatchZone = max(hpIn(hpBox(p, ${v2(ER_BAY.x0 + 2, (ER_BAY.z0 + ER_BAY.z1) / 2)}, ${v2(2, (ER_BAY.z1 - ER_BAY.z0) / 2 - 1)}, 0.0), aa),
        hpIn(hpBox(p, ${v2(ER_BAY.x1 - 3, (ER_BAY.z0 + ER_BAY.z1) / 2)}, ${v2(3, (ER_BAY.z1 - ER_BAY.z0) / 2 - 1)}, 0.0), aa));
      float hatch = step(0.5, fract((p.x + p.y) / 2.4));
      c = mix(c, mix(red, paint, hatch), hatchZone * mix(0.5, 1.0, fine));
      c = mix(c, yellow, hpStroke(bay + 0.6, 0.3, aa) * fine);
    }

    // Otopark: park çizgileri araçlara hizalı, sıra uçlarında çizgi, ağaç adaları, ortadan yaya yolu.
    {
      float inPark = step(${f(PARK.z0)}, p.y) * step(p.y, ${f(PARK.z1)}) * step(${f(BAY_X0)}, p.x) * step(p.x, ${f(BAY_X0 + BAY * BAY_COUNT)});
      float rz = p.y - ${f(ROW_Z0)};
      float rowIndex = clamp(floor(rz / ${f(ROW_STEP)} + 0.5), 0.0, ${f(ROW_COUNT - 1)});
      float rowZ = ${f(ROW_Z0)} + rowIndex * ${f(ROW_STEP)};
      float rowD = abs(p.y - rowZ);
      float col = floor((p.x - ${f(BAY_X0)}) / ${f(BAY)});
      float cm = mod(col, ${f(ISLAND_PERIOD)});
      float walkCol = step(${f(WALK_COLUMN - 0.5)}, col) * step(col, ${f(WALK_COLUMN + 1.5)});
      float isl = step(${f(ISLAND_START - 0.5)}, cm) * step(cm, ${f(ISLAND_START + 1.5)}) * (1.0 - walkCol)
        * step(mod(rowIndex + floor(col / ${f(ISLAND_PERIOD)}), 2.0), 0.5);
      float bays = hpLines(p.x - ${f(BAY_X0)}, ${f(BAY)}, 0.15, aa) * step(rowD, ${f(ROW_HALF)});
      bays = max(bays, hpStroke(rowD - ${f(ROW_HALF)}, 0.15, aa));
      c = mix(c, paint * 0.95, bays * inPark * (1.0 - walkCol) * fine);
      // Ağaç adası: iki park yeri genişliğinde, taş bordürlü çim.
      float islandX = ${f(BAY_X0)} + (col - cm + ${f(ISLAND_START + 1)}) * ${f(BAY)};
      float islandD = hpBox(p, vec2(islandX, rowZ), vec2(2.7, ${f(ROW_HALF + 0.2)}), 1.0);
      float islandMask = isl * hpIn(islandD, aa) * inPark;
      c = mix(c, vec3(0.1, 0.16, 0.055) * (0.85 + 0.3 * n2), islandMask);
      c = mix(c, stone, isl * hpIn(abs(islandD) - 0.25, aa) * inPark);
      // Yaya yolu: sıraların arasında taş, koridorlarda zebra.
      float walk = hpBox(p, ${box(LOT_WALK)}, 0.0);
      float zebra = step(0.5, fract(p.y / 1.2));
      float aisle = step(${f(ROW_HALF + 0.3)}, rowD);
      c = mix(c, mix(stone, mix(asphalt, paint, zebra * fine + 0.35 * (1.0 - fine)), aisle), hpIn(walk, aa));
    }
    // Yaya geçitleri: döngünün kuzey kolu, otoparkın kuzey ve batı yolları, doğu girişi.
    {
      float zx = step(0.5, fract(p.x / 1.2));
      float zz = step(0.5, fract(p.y / 1.2));
      float crossings = max(
        hpIn(hpBox(p, ${box({ x0: LOT_WALK.x0, x1: LOT_WALK.x1, z0: NORTH_LANE.z0, z1: NORTH_LANE.z1 })}, 0.0), aa) * zz,
        hpIn(hpBox(p, ${box({ x0: WEST_LANE.x0, x1: WEST_LANE.x1, z0: EAST_WALK.z0, z1: EAST_WALK.z1 })}, 0.0), aa) * zx);
      crossings = max(crossings, hpIn(hpBox(p, ${box({ x0: ENTRY_ROAD.x0, x1: ENTRY_ROAD.x1, z0: 282, z1: 288 })}, 0.0), aa) * zx);
      crossings = max(crossings, hpIn(hpBox(p, ${box({ x0: AXIS.x0, x1: AXIS.x1, z0: ER_ROAD.z0, z1: ER_ROAD.z1 })}, 0.0), aa) * zx * step(p.x, ${f(ER_ROAD.x1)}));
      c = mix(c, paint, crossings * mix(0.35, 1.0, fine));
    }

    // Şifa bahçesi: çiçek tarhları (taş bordür), yansıma havuzunun taş bordürü (su yüzeyi Hospital_Pond).
    {
      float beds = ${minAll(BEDS.map((b) => `hpBox(p, ${box(b)}, 3.0)`))};
      float clump = h12(floor(p * 0.9));
      vec3 bloom = clump < 0.3 ? vec3(0.55, 0.3, 0.38) : clump < 0.55 ? vec3(0.62, 0.55, 0.26) : clump < 0.75 ? vec3(0.4, 0.34, 0.52) : vec3(0.68, 0.64, 0.58);
      vec3 bedColor = mix(hedge * 1.3, bloom * (0.85 + 0.2 * n2), mix(0.55, smoothstep(0.35, 0.6, fbm(p * 0.7)), fine));
      c = mix(c, bedColor, hpIn(beds, aa));
      c = mix(c, stone, hpIn(abs(beds) - 0.3, aa));
      float pond = hpBox(p, ${box(POND)}, 1.0);
      c = mix(c, vec3(0.62, 0.59, 0.54) * grain, hpIn(abs(pond - ${f(POND_RIM / 2)}) - ${f(POND_RIM / 2)}, aa));
      c = mix(c, vec3(0.16, 0.24, 0.25), hpIn(pond, aa));
    }

    diffuseColor.rgb = c;
  }`;

// ------------------------------------------------------------------ binalar

// Duvar ve çatı paleti (FACADE_FRAGMENT eşikleriyle). Değerler okul ve bilim merkeziyle aynı: aynı değer aynı cephe
// programını paylaşır, açılışta ek cephe shader'ı derlenmez. Yatak kanatları, podyum ve poliklinik kırık beyaz duvar ve
// yeşil çatı (modeldeki podyumun yeşil çatısı gibi), doğu blok krem sıva ve açık çatı.
const PALETTES: Record<Palette, string> = { lab: 'vec2(0.1, 0.9)', civic: 'vec2(0.4, 0.7)' };

function blockMatrix(b: Building) {
  const hy = b.height / 2;
  return new THREE.Matrix4().compose(
    new THREE.Vector3((b.x0 + b.x1) / 2, BASE_Y + (b.base ?? 0) + hy, (b.z0 + b.z1) / 2),
    new THREE.Quaternion(),
    new THREE.Vector3((b.x1 - b.x0) / 2, hy, (b.z1 - b.z0) / 2),
  );
}

function buildingMeshes(source: THREE.Material) {
  const materials = new Map<Palette, THREE.Material>();
  const material = (palette: Palette) => {
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
    mesh.name = `Hospital_Mass_${key}`;
    list.forEach((b, i) => mesh.setMatrixAt(i, blockMatrix(b)));
    mesh.instanceMatrix.needsUpdate = true;
    return mesh;
  });
}

// ------------------------------------------------------------------ parçalar

// Kırık tonlar: şehrin paletinden kopmayan, doygunluğu düşük renkler.
const TONE = {
  concrete: '#b3aea3',
  deck: '#9c9a94',
  steel: '#8c8f92',
  dark: '#4a4d50',
  interior: '#35383b',
  roof: '#a9aaa6',
  white: '#e6e1d6',
  tank: '#d8d5ce',
  wood: '#a88a68',
  red: '#a8453a',
  teal: '#5f8a86',
  container: '#7d8a8c',
  glass: '#3c4650',
};

function bench(props: PropBuilder, x: number, z: number, alongX = true) {
  const y = GROUND_Y;
  const [hx, hz] = alongX ? [0.9, 0.3] : [0.3, 0.9];
  props.box(x - hx, x + hx, y + 0.3, y + 0.45, z - hz, z + hz, TONE.wood);
  props.box(x - hx + 0.15, x + hx - 0.15, y, y + 0.3, z - hz + 0.1, z + hz - 0.1, TONE.steel);
}

/** Yön totemi: ince beyaz pano, üstte deniz yeşili bant (hastanenin yön rengi). */
function totem(props: PropBuilder, x: number, z: number) {
  const y = GROUND_Y;
  props.box(x - 0.8, x + 0.8, y, y + 3.4, z - 0.25, z + 0.25, TONE.white);
  props.box(x - 0.82, x + 0.82, y + 2.7, y + 3.4, z - 0.27, z + 0.27, TONE.teal);
}

/** Bariyer: kutu ve kırmızı-beyaz kol (x veya z boyunca). */
function barrier(props: PropBuilder, x: number, z: number, length: number, alongX: boolean) {
  const y = GROUND_Y;
  props.box(x - 0.3, x + 0.3, y, y + 1.1, z - 0.3, z + 0.3, TONE.dark);
  const steps = Math.round(length);
  for (let k = 0; k < steps; k++) {
    const a = 0.3 + k;
    const b = Math.min(length, a + 1);
    const color = k % 2 ? TONE.white : TONE.red;
    if (alongX) props.box(x + a, x + b, y + 0.95, y + 1.08, z - 0.06, z + 0.06, color);
    else props.box(x - 0.06, x + 0.06, y + 0.95, y + 1.08, z + a, z + b, color);
  }
}

function booth(props: PropBuilder, b: Box) {
  const y = GROUND_Y;
  props.box(b.x0, b.x1, y, y + 2.6, b.z0, b.z1, TONE.white);
  props.box(b.x0 - 0.05, b.x1 + 0.05, y + 1.3, y + 2.2, b.z0 - 0.05, b.z1 + 0.05, TONE.glass);
  props.box(b.x0 - 0.4, b.x1 + 0.4, y + 2.6, y + 2.85, b.z0 - 0.4, b.z1 + 0.4, TONE.dark);
}

/** Açık katlı otopark: karanlık iç hacim, kat döşemeleri ve korkulukları, çevre kolonları, merdiven kuleleri. */
function garage(props: PropBuilder) {
  const y = GROUND_Y;
  const g = GARAGE;
  const top = y + GARAGE_LEVELS[GARAGE_LEVELS.length - 1];
  props.box(g.x0 + 1.4, g.x1 - 1.4, y, top - 0.45, g.z0 + 1.4, g.z1 - 1.4, TONE.interior);
  for (const level of GARAGE_LEVELS) {
    const ly = y + level;
    props.box(g.x0, g.x1, ly - 0.45, ly, g.z0, g.z1, TONE.deck);
    // Korkuluk bandı: dört kenar.
    props.box(g.x0, g.x1, ly, ly + 1.0, g.z0, g.z0 + 0.25, TONE.concrete);
    props.box(g.x0, g.x1, ly, ly + 1.0, g.z1 - 0.25, g.z1, TONE.concrete);
    props.box(g.x0, g.x0 + 0.25, ly, ly + 1.0, g.z0, g.z1, TONE.concrete);
    props.box(g.x1 - 0.25, g.x1, ly, ly + 1.0, g.z0, g.z1, TONE.concrete);
  }
  for (let x = g.x0 + 0.6; x <= g.x1 - 0.5; x += (g.x1 - g.x0 - 1.2) / 10) {
    for (const z of [g.z0 + 0.6, g.z1 - 0.6]) props.box(x - 0.3, x + 0.3, y, top - 0.45, z - 0.3, z + 0.3, TONE.concrete);
  }
  for (let z = g.z0 + 0.6; z <= g.z1 - 0.5; z += (g.z1 - g.z0 - 1.2) / 10) {
    for (const x of [g.x0 + 0.6, g.x1 - 0.6]) props.box(x - 0.3, x + 0.3, y, top - 0.45, z - 0.3, z + 0.3, TONE.concrete);
  }
  for (const c of GARAGE_CORES) {
    props.box(c.x0, c.x1, y, top + 3.6, c.z0, c.z1, TONE.white);
    props.box(c.x0 - 0.2, c.x1 + 0.2, top + 3.6, top + 3.9, c.z0 - 0.2, c.z1 + 0.2, TONE.dark);
    props.box(c.x0 + 2, c.x1 - 2, y + 1, top + 3.2, c.z0 - 0.05, c.z1 + 0.05, TONE.glass);
  }
  // Çatı katının park çizgileri.
  for (const z of GARAGE_ROWS) {
    for (let x = GARAGE_BAY_X0 - BAY / 2; x <= GARAGE_BAY_X0 + BAY * (GARAGE_BAYS - 0.5) + 0.01; x += BAY) {
      props.box(x - 0.07, x + 0.07, top, top + 0.03, z - ROW_HALF, z + ROW_HALF, TONE.white);
    }
  }
}

function propsGeometry() {
  const props = new PropBuilder();
  const y = GROUND_Y;

  // Kule saçağı: kuleye bağlanan saçak devamı ve adanın kenarında kolonlar.
  const tc = TOWER_CANOPY;
  props.box(tc.x0, tc.x1, y + 5.95, y + 6.85, tc.z1, TOWER.z0, TONE.white);
  for (let x = tc.x0 + 1; x <= tc.x1 - 0.9; x += (tc.x1 - tc.x0 - 2) / 3) props.box(x - 0.3, x + 0.3, y, y + 6, tc.z0 + 0.4, tc.z0 + 1, TONE.steel);

  // Güney girişi: cam saçak, ince kolonlar.
  const sc = SOUTH_CANOPY;
  props.box(sc.x0, sc.x1, y + 5.0, y + 5.25, sc.z0, sc.z1, TONE.glass);
  props.box(sc.x0, sc.x1, y + 5.25, y + 5.55, sc.z1 - 0.3, sc.z1, TONE.white);
  for (let x = sc.x0 + 1; x <= sc.x1 - 0.9; x += (sc.x1 - sc.x0 - 2) / 4) props.box(x - 0.15, x + 0.15, y, y + 5.0, sc.z1 - 0.6, sc.z1 - 0.3, TONE.steel);

  // Pergola: iki sıra direk, iki boyuna kiriş, sık ahşap çıtalar.
  const pg = PERGOLA;
  for (let x = pg.x0 + 0.5; x <= pg.x1 - 0.4; x += 4) {
    for (const z of [pg.z0, pg.z1]) props.box(x - 0.15, x + 0.15, y, y + 3.0, z - 0.15, z + 0.15, TONE.white);
  }
  for (const z of [pg.z0, pg.z1]) props.box(pg.x0, pg.x1, y + 3.0, y + 3.3, z - 0.15, z + 0.15, TONE.white);
  for (let x = pg.x0 + 0.3; x < pg.x1; x += 1.2) props.box(x - 0.08, x + 0.08, y + 3.3, y + 3.45, pg.z0 - 0.6, pg.z1 + 0.6, TONE.wood);

  // Kameriye: dört direk, piramit çatı, içinde iki bank.
  const gz = GAZEBO;
  for (const [dx, dz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
    const px = gz.x + dx * (gz.half - 0.4);
    const pz = gz.z + dz * (gz.half - 0.4);
    props.box(px - 0.15, px + 0.15, y, y + 2.8, pz - 0.15, pz + 0.15, TONE.white);
  }
  props.box(gz.x - gz.half, gz.x + gz.half, y + 2.8, y + 3.05, gz.z - gz.half, gz.z + gz.half, TONE.white);
  props.pyramid(gz.x - gz.half - 0.4, gz.x + gz.half + 0.4, y + 3.05, y + 4.8, gz.z - gz.half - 0.4, gz.z + gz.half + 0.4, TONE.roof);
  bench(props, gz.x, gz.z - 2);
  bench(props, gz.x, gz.z + 2);

  // Otobüs durağı: arka cam, yan duvar, çatı, bank.
  const bs = BUS_STOP;
  props.box(bs.x0, bs.x1, y, y + 2.6, bs.z0, bs.z0 + 0.1, TONE.glass);
  for (const x of [bs.x0 + 0.2, bs.x1 - 0.2]) props.box(x - 0.08, x + 0.08, y, y + 2.6, bs.z1 - 0.3, bs.z1 - 0.14, TONE.steel);
  props.box(bs.x0 - 0.3, bs.x1 + 0.3, y + 2.6, y + 2.8, bs.z0 - 0.3, bs.z1 + 0.2, TONE.dark);
  props.box(bs.x0 + 2, bs.x1 - 2, y + 0.4, y + 0.5, bs.z0 + 0.1, bs.z0 + 0.6, TONE.wood);

  // Banklar: rehabilitasyon halkası ve meydanı, bahçe yolları, güney meydanı, personel bahçesi.
  for (const z of [310, 340, 380, 410]) {
    bench(props, REHAB.x - REHAB.hx + 2.6, z, false);
    bench(props, REHAB.x + REHAB.hx - 2.6, z, false);
  }
  for (const [dx, dz] of [[-6, 0], [6, 0], [0, -6], [0, 6]]) bench(props, REHAB.x + dx, REHAB.z + dz, dx === 0);
  for (const z of [540, 552, 576, 590]) {
    bench(props, AXIS.x0 - 1.2, z, false);
    bench(props, AXIS.x1 + 1.2, z, false);
  }
  for (const x of [492, 504, 516, 528]) {
    bench(props, x, POND_WALK.z0 + 1.2);
    bench(props, x, POND_WALK.z1 - 1.2);
  }
  for (const x of [392, 470, 488, 548, 566]) bench(props, x, SOUTH_PLAZA.z1 - 1.5);
  for (const x of [550, 562]) bench(props, x, EAST_WALK.z1 + 1.4);

  for (const [x, z] of TOTEMS) totem(props, x, z);

  // Otopark girişleri: gişe ve bariyer (doğu girişi, güney çıkışı); doğu yolu servis avlusuna bariyerli.
  booth(props, { x0: 838, x1: 841, z0: 445, z1: 448 });
  barrier(props, 839.5, EAST_ENTRY.z0 - 0.6, EAST_ENTRY.z1 - EAST_ENTRY.z0 - 0.4, false);
  booth(props, { x0: 567, x1: 570, z0: 595, z1: 598 });
  barrier(props, WEST_LANE.x0 - 0.6, 599, WEST_LANE.x1 - WEST_LANE.x0 - 0.4, true);

  // Servis avlusu: oksijen tankları (çitli), jeneratörler, konteynerler, yükleme saçağı.
  for (const [x, z] of TANKS) {
    props.box(x - 2.8, x + 2.8, y, y + 0.4, z - 2.8, z + 2.8, TONE.concrete);
    props.cylinder(x, y + 0.4, z, 2.2, 11, 'y', TONE.tank, 14);
    props.cylinder(x, y + 11.4, z, 1.2, 0.6, 'y', TONE.steel, 10);
  }
  const tf = TANK_FENCE;
  props.box(tf.x0, tf.x1, y, y + 2.2, tf.z0, tf.z0 + 0.08, TONE.steel);
  props.box(tf.x0, tf.x1, y, y + 2.2, tf.z1 - 0.08, tf.z1, TONE.steel);
  props.box(tf.x0, tf.x0 + 0.08, y, y + 2.2, tf.z0, tf.z1, TONE.steel);
  props.box(tf.x1 - 0.08, tf.x1, y, y + 2.2, tf.z0, tf.z1, TONE.steel);
  for (const z of [196, 204]) {
    props.box(612, 626, y, y + 3.0, z, z + 4, TONE.container);
    props.box(613, 615, y + 3.0, y + 3.8, z + 1, z + 3, TONE.dark);
  }
  // Çöp barınağı: arka duvar ve çatı altında konteynerler (insanlar alçak konteynerlerin içinden geçmesin diye kapalı).
  for (let i = 0; i < 6; i++) props.box(640 + i * 2.6, 642 + i * 2.6, y, y + 1.4, 236, 238.4, i % 3 === 2 ? TONE.teal : TONE.container);
  props.box(638.5, 656.5, y, y + 2.6, 239, 239.3, TONE.concrete);
  props.box(638.2, 656.8, y + 2.6, y + 2.85, 235.2, 239.5, TONE.dark);
  for (const x of [638.6, 656.4]) props.box(x - 0.12, x + 0.12, y, y + 2.6, 235.4, 235.64, TONE.steel);
  const dk = DOCK;
  props.box(dk.x0, dk.x1, y, y + 1.2, dk.z0 + 2, dk.z1, TONE.concrete);
  props.box(dk.x0 - 1, dk.x1 + 1, y + 4.6, y + 4.9, dk.z0 - 3, dk.z1, TONE.dark);

  // Podyum çatısında ışıklıklar (kanatların arasındaki çatı).
  const ry = BASE_Y + PODIUM.height;
  for (let x = 370; x < 476; x += 14) {
    for (const z of [444, 458, 472, 486]) {
      props.box(x, x + 8, ry, ry + 0.9, z, z + 3.4, TONE.glass);
      props.box(x - 0.15, x + 8.15, ry, ry + 0.3, z - 0.15, z + 3.55, TONE.steel);
    }
  }

  garage(props);
  return props.build();
}

// ------------------------------------------------------------------ araçlar

// Katlı otoparkın çatı katı: kenarlarda tek, ortada sırt sırta çift sıra; sütunlar 2.8 m.
const GARAGE_ROWS = [205, 221, 237, 243, 259, 275];
const GARAGE_BAY_X0 = 733.4;
const GARAGE_BAYS = 29;

function vehicleMeshes(cityRoot: THREE.Object3D) {
  const colors = ['White', 'Silver', 'Graphite', 'Blue'];
  const spots: VehicleSpot[][] = colors.map(() => []);
  GARAGE_ROWS.forEach((z, row) => {
    for (let k = 0; k < GARAGE_BAYS; k++) {
      const x = GARAGE_BAY_X0 + k * BAY;
      if (GARAGE_CORES.some((c) => inBox(c, x, z, 3.2))) continue;
      if (hash2(x, z) > 0.72) continue;
      const pick = hash2(z, x);
      const color = pick < 0.35 ? 0 : pick < 0.65 ? 1 : pick < 0.88 ? 2 : 3;
      spots[color].push([x, z, row % 2 ? -Math.PI / 2 : Math.PI / 2]);
    }
  });
  const lift = GARAGE_LEVELS[GARAGE_LEVELS.length - 1];
  return colors
    .map((color, i) => {
      const mesh = parkedVehicles(cityRoot, `Cars_${color}`, 'Hospital', spots[i]);
      // Araçlar zeminde kurulur, çatı katına kaldırılır.
      if (mesh) mesh.position.y += lift;
      return mesh;
    })
    .filter((mesh) => mesh !== null);
}

/** Açık otoparkta ağaç adalarına ve yaya yoluna denk gelen park etmiş araçlar gizlenir. */
function clearParking(cityRoot: THREE.Object3D) {
  const matrix = new THREE.Matrix4();
  const position = new THREE.Vector3();
  const zero = new THREE.Matrix4().makeScale(0, 0, 0);
  cityRoot.traverse((object) => {
    if (!(object instanceof THREE.InstancedMesh) || !/^Traffic_Vehicles_.*_Parked$/.test(object.name)) return;
    let changed = false;
    for (let i = 0; i < object.count; i++) {
      object.getMatrixAt(i, matrix);
      position.setFromMatrixPosition(matrix).applyMatrix4(object.matrixWorld);
      if (!inBox(PARK, position.x, position.z)) continue;
      const col = Math.round((position.x - BAY_X0 - BAY / 2) / BAY);
      const row = Math.round((position.z - ROW_Z0) / ROW_STEP);
      if (!islandBay(row, col) && col !== WALK_COLUMN && col !== WALK_COLUMN + 1) continue;
      object.setMatrixAt(i, zero);
      changed = true;
    }
    if (changed) object.instanceMatrix.needsUpdate = true;
  });
}

// ------------------------------------------------------------------ ağaçlar ve lambalar

// Ağaç dikilmeyen yerler: tepe bunların üstüne taşmaz.
const SOLID: Box[] = [
  ...BUILDINGS,
  TOWER,
  TOWER_CANOPY,
  ER_CANOPY,
  SKYBRIDGE,
  GARAGE,
  FORECOURT,
  COURTYARD,
  ENTRY_ROAD,
  ...ENTRY_WALKS,
  LOOP,
  ER_BAY,
  ER_ROAD,
  ER_EXIT,
  SOUTH_PLAZA,
  WEST_WALK,
  AXIS,
  CROSS,
  POND_WALK,
  GAZEBO_PATH,
  { x0: GAZEBO.x - GAZEBO.half - 2, x1: GAZEBO.x + GAZEBO.half + 2, z0: GAZEBO.z - GAZEBO.half - 2, z1: GAZEBO.z + GAZEBO.half + 2 },
  ...BEDS,
  // Pergola çıtaları direklerin 0.6 m dışına taşar.
  { ...PERGOLA, z0: PERGOLA.z0 - 0.8, z1: PERGOLA.z1 + 0.8 },
  BUS_STOP,
  EAST_WALK,
  EAST_FRONT,
  PARK,
  NORTH_LANE,
  WEST_LANE,
  EAST_LANE,
  EAST_ENTRY,
  GARAGE_IN,
  SERVICE_YARD,
  ...REHAB_SPURS,
];

/** Tepe yarıçapı `radius` olan ağaç buraya sığar mı: plakanın içinde, yapılardan, yollardan ve lambalardan uzak. */
function treeAllowed(x: number, z: number, radius: number, lamps: number[]) {
  if (!inBox(LOT, x, z, -radius - 1.5)) return false;
  if (SOLID.some((b) => inBox(b, x, z, radius + 0.5))) return false;
  if (TOTEMS.some(([tx, tz]) => Math.abs(x - tx) < radius + 1.2 && Math.abs(z - tz) < radius + 0.8)) return false;
  // Rehabilitasyon halkası ve meydanı.
  if (Math.abs(roundBox(x, z, REHAB.x, REHAB.z, REHAB.hx, REHAB.hz, REHAB.r)) < radius + 2) return false;
  if (Math.hypot(x - REHAB.x, z - REHAB.z) < REHAB_PLAZA + radius + 1) return false;
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
  // Aralık denetimi için 10 m'lik ızgara (aralıklar 10 m'den küçük: komşu hücrelere bakmak yeter).
  const buckets = new Map<number, TreeSpot[]>();
  const key = (i: number, k: number) => i * 4096 + k;
  const plant = (spot: TreeSpot) => {
    trees.push(spot);
    const k = key(Math.floor(spot[0] / 10), Math.floor(spot[1] / 10));
    const bucket = buckets.get(k);
    if (bucket) bucket.push(spot);
    else buckets.set(k, [spot]);
  };
  const free = (x: number, z: number, spacing: number) => {
    const i0 = Math.floor(x / 10);
    const k0 = Math.floor(z / 10);
    for (let i = i0 - 1; i <= i0 + 1; i++) {
      for (let k = k0 - 1; k <= k0 + 1; k++) {
        for (const [tx, tz] of buckets.get(key(i, k)) ?? []) {
          if ((tx - x) * (tx - x) + (tz - z) * (tz - z) <= spacing * spacing) return false;
        }
      }
    }
    return true;
  };
  // Sığmazsa daha küçük boy denenir (dar şeritlerde küçük ağaç).
  const add = (x: number, z: number, spacing: number, sizes = [1, 0.8, 0.62]) => {
    if (!free(x, z, spacing)) return;
    for (const size of sizes) {
      const radius = crown * size * (0.75 + 0.55 * hash2(x, z));
      if (treeAllowed(x, z, radius, lamps)) {
        plant([x, z, size]);
        return;
      }
    }
  };
  const jitter = (a: number, b: number) => (hash2(a, b) - 0.5) * 2;
  const scatter = (b: Box, count: number, spacing: number, seed: number, sizes?: number[]) => {
    for (let k = 0; k < count; k++) add(b.x0 + hash2(k, seed) * (b.x1 - b.x0), b.z0 + hash2(k, seed + 1) * (b.z1 - b.z0), spacing, sizes);
  };

  // Otopark adaları (adanın ortasında küçük ağaç: tepesi yandaki araçlara taşmaz), avlu saksıları, döngü adası: plan gereği, denetimsiz.
  for (let row = 0; row < ROW_COUNT; row++) {
    for (let col = 0; col < BAY_COUNT - 1; col++) {
      if (col % ISLAND_PERIOD === ISLAND_START && islandBay(row, col)) plant([BAY_X0 + (col + 1) * BAY, ROW_Z0 + row * ROW_STEP, ISLAND_TREE]);
    }
  }
  for (const x of [384, 404, 444, 464]) plant([x, (COURTYARD.z0 + COURTYARD.z1) / 2, 0.55]);
  for (const x of [406, 424, 442]) plant([x, LOOP_ISLAND.z0 + 7, 0.55]);

  // Giriş yolunun iki yanında dizi, bulvar boyunca sıra.
  for (let z = LOT.z0 + 11; z < LOOP.z0 - 12; z += 11) {
    add(ENTRY_WALKS[0].x0 - 4, z, 8, [0.8, 0.62]);
    add(ENTRY_WALKS[1].x1 + 4, z, 8, [0.8, 0.62]);
  }
  for (let x = LOT.x0 + 8; x < EAST_LANE.x0 - 4; x += 11) add(x + jitter(x, 3) * 1.5, LOT.z0 + 7, 8, [0.8, 0.62]);
  // Bulvar önündeki çim, kanatların kuzeyi.
  scatter({ x0: LOT.x0 + 4, x1: SERVICE_YARD.x0 - 2, z0: LOT.z0 + 10, z1: 258 }, 140, 9, 510);
  scatter({ x0: FORECOURT.x0, x1: FORECOURT.x1, z0: 258, z1: FORECOURT.z0 }, 20, 7, 520, [0.62]);
  // Rehabilitasyon bahçesi ve poliklinik batısı.
  scatter({ x0: LOT.x0 + 3, x1: 322, z0: 258, z1: 512 }, 160, 8, 530);
  scatter({ x0: LOT.x0 + 3, x1: OUTPATIENT.x0 - 2, z0: 512, z1: ER_ROAD.z0 - 2 }, 30, 7, 540, [0.8, 0.62]);
  // Şifa bahçesi ve güney kenarı.
  scatter(GARDEN, 260, 7, 550, [0.8, 0.62, 0.5]);
  for (let x = ER_EXIT.x1 + 6; x < WEST_LANE.x0 - 4; x += 9) add(x + jitter(x, 9), LOT.z1 - 8, 8, [0.62, 0.5]);
  // Personel bahçesi, köprünün iki yanı.
  scatter({ x0: 524, x1: WEST_LANE.x0 - 1, z0: 336, z1: SOUTH_PLAZA.z0 }, 60, 8, 560, [0.8, 0.62]);
  scatter({ x0: 524, x1: EAST_BLOCK.x0 - 1, z0: 250, z1: 336 }, 30, 8, 570, [0.8, 0.62]);
  // Doğu şeridi (otoparkın doğusu), katlı otoparkın çevresi.
  for (let z = NORTH_LANE.z0; z < LOT.z1 - 4; z += 9) {
    add(PARK.x1 + 9 + jitter(z, 11), z, 8);
    add(PARK.x1 + 25 + jitter(z, 12), z + 4, 8);
  }
  scatter({ x0: GARAGE.x1 + 2, x1: LOT.x1 - 2, z0: LOT.z0 + 2, z1: NORTH_LANE.z0 }, 40, 8, 580);
  scatter({ x0: EAST_LANE.x1 + 2, x1: GARAGE.x1 + 2, z0: GARAGE.z1 + 2, z1: NORTH_LANE.z0 - 1 }, 40, 8, 590, [0.8, 0.62]);
  scatter({ x0: EAST_LANE.x1 + 2, x1: GARAGE.x0 - 1, z0: LOT.z0 + 2, z1: GARAGE.z1 }, 10, 7, 600, [0.62]);
  return trees;
}

/** Lambalar: giriş yolu ve döngü, acil yolu, meydanlar, bahçe yolları, rehabilitasyon halkası, otopark ve yolları. */
function hospitalLamps(): number[] {
  const lamps: number[] = [];
  const low = GROUND_Y + 4.5;
  const tall = GROUND_Y + 8;
  for (let z = LOT.z0 + 13; z < LOOP.z0 - 6; z += 24) lamps.push(ENTRY_WALKS[0].x0 + 1.2, tall, z, ENTRY_WALKS[1].x1 - 1.2, tall, z + 12);
  lamps.push(LOOP.x0 - 2, tall, 300, LOOP.x1 + 2, tall, 300);
  lamps.push(FORECOURT.x0 + 3, low, TOWER.z0 - 3, FORECOURT.x1 - 3, low, TOWER.z0 - 3);
  for (const x of [236, 266, 296, 326]) lamps.push(x, tall, ER_ROAD.z1 + 2.5);
  for (const x of [392, 456, 520, 566]) lamps.push(x, low, SOUTH_PLAZA.z1 - 0.8);
  lamps.push(AXIS.x1 + 1, low, 545, AXIS.x1 + 1, low, 582, 400, low, CROSS.z1 + 1);
  for (const z of [330, 390]) lamps.push(REHAB.x - REHAB.hx - 2, low, z, REHAB.x + REHAB.hx + 2, low, z);
  lamps.push(REHAB.x, low, REHAB.z - REHAB.hz - 2, REHAB.x, low, REHAB.z + REHAB.hz + 2);
  lamps.push(558, low, EAST_WALK.z0 - 1);
  for (let z = 200; z < 340; z += 30) lamps.push(EAST_LANE.x0 - 2, tall, z);
  for (let x = 590; x < PARK.x1; x += 30) lamps.push(x, tall, NORTH_LANE.z0 - 1.5);
  for (let k = 0; k < ROW_COUNT - 1; k += 2) {
    const z = ROW_Z0 + (k + 0.5) * ROW_STEP;
    lamps.push((LOT_WALK.x0 + LOT_WALK.x1) / 2, tall, z, PARK.x1 - 1, tall, z);
  }
  for (let z = 380; z < 600; z += 40) lamps.push(WEST_LANE.x0 - 2, tall, z);
  lamps.push(SERVICE_YARD.x0 + 3, tall, 222, 660, tall, SERVICE_YARD.z0 + 2);
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

/** Mesh'in bu alanlardaki üçgenlerini siler ve geometriyi sıkıştırır (sınır kutusu da küçülür). */
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

// Modelde yeniden kurulan kutular: kanatlar, podyum, poliklinik, doğu blok, katlı otopark (çatı mesh'indeki parçaları).
const OLD_BLOCKS: Box[] = [
  { x0: 324, x1: 364, z0: 260, z1: 500 },
  { x0: 484, x1: 524, z0: 260, z1: 500 },
  { x0: 304, x1: 544, z0: 435, z1: 505 },
  { x0: 269, x1: 379, z0: 515, z1: 555 },
  { x0: 604, x1: 704, z0: 250, z1: 330 },
  GARAGE,
];
const REPLACED = /^Hospital_(Ground|Facades|ParkingGarage)$/;
const OWN = /^Hospital_(Ground|Pond|Props|Mass_.+)$/;

/**
 * Hastaneyi yeniden düzenler: modeldeki zemin, kanat ve blok kutuları ve katlı otopark kaldırılır, çatı mesh'inden eski
 * kutuların çatıları silinir (kule ve köprü çatısı kalır). Yerine tek zemin (Hospital_Ground, rengi HOSPITAL_FRAGMENT ile
 * cityRuntime çizer), yansıma havuzu, kütleler, parçalar, çatı katındaki araçlar ve ağaçlar gelir. Açık otoparkta ağaç
 * adalarına ve yaya yoluna denk gelen araçlar gizlenir. Lamba konumlarını döndürür. Hazırlık ikinci kez çalışırsa
 * (StrictMode) tekrar etmez.
 */
export function landscapeHospital(cityRoot: THREE.Object3D, treeScale: number): number[] {
  const done = cityRoot.userData.hospitalLamps as number[] | undefined;
  if (done) return done;
  cityRoot.updateMatrixWorld(true);
  const ground = cityRoot.getObjectByName('Hospital_Ground');
  const roofs = cityRoot.getObjectByName('Hospital_Roofs');
  const canopy = cityRoot.getObjectByName('Hospital_Emergency_Canopy');
  let facade: THREE.Material | null = null;
  let water: THREE.Material | null = null;
  const removed: THREE.Mesh[] = [];
  cityRoot.traverse((object) => {
    if (!(object instanceof THREE.Mesh)) return;
    if (!facade && object instanceof THREE.InstancedMesh && object.name.startsWith('Residential_Buildings_')) {
      facade = object.material as THREE.Material;
    }
    if (!water && !Array.isArray(object.material) && object.material.name === 'Water') water = object.material;
    if (REPLACED.test(object.name)) removed.push(object);
  });
  if (
    !(ground instanceof THREE.Mesh) ||
    !(roofs instanceof THREE.Mesh) ||
    !(canopy instanceof THREE.Mesh) ||
    !facade ||
    !water ||
    Array.isArray(ground.material) ||
    Array.isArray(canopy.material)
  ) {
    return [];
  }

  const parent = ground.parent ?? cityRoot;
  for (const mesh of removed) {
    mesh.removeFromParent();
    mesh.geometry.dispose();
  }
  dropTriangles(roofs, OLD_BLOCKS);
  clearParking(cityRoot);
  // Zemin: aynı adla bütün plakayı kaplayan tek düzlem (doğudaki açık şerit dahil), LANDSCAPES malzemeyi klonlayıp yamar.
  const site = new THREE.Mesh(plane(LOT, GROUND_Y), ground.material);
  site.name = 'Hospital_Ground';
  site.userData = { groundLayered: true };
  // Yansıma havuzu: şehrin su malzemesiyle düz yüzey, taş bordürün içinde.
  const pond = new THREE.Mesh(
    plane({ x0: POND.x0 + POND_RIM, x1: POND.x1 - POND_RIM, z0: POND.z0 + POND_RIM, z1: POND.z1 - POND_RIM }, GROUND_Y + 0.12),
    water,
  );
  pond.name = 'Hospital_Pond';
  pond.userData = { castShadow: false, groundLayered: true };
  // Parçalar acil saçağının satin malzemesini paylaşır (köşe renkli).
  const props = new THREE.Mesh(propsGeometry(), canopy.material);
  props.name = 'Hospital_Props';
  for (const mesh of [site, pond, props, ...buildingMeshes(facade)]) parent.add(mesh);
  // Çatı katındaki araçlar şehrin park etmiş araçlarının yanına (Traffic_ adıyla: trafik, LOD ve insanlar onları öyle tanır).
  for (const mesh of vehicleMeshes(cityRoot)) parent.add(mesh);
  // Yeni parçalar dünya koordinatında kuruldu: ebeveynin dönüşümü birim olmalı.
  parent.updateMatrixWorld(true);
  if (!parent.matrixWorld.equals(new THREE.Matrix4())) {
    const inverse = parent.matrixWorld.clone().invert();
    for (const child of parent.children) {
      if (OWN.test(child.name) || child.name.startsWith('Traffic_Hospital_')) child.applyMatrix4(inverse);
    }
  }

  const lamps = hospitalLamps();
  replantTrees(cityRoot, {
    prefix: 'Hospital',
    inside: (x, z) => inBox(SITE, x, z),
    spots: plantTrees(crownRadius(cityRoot, treeScale), lamps),
    treeScale,
  });
  cityRoot.updateMatrixWorld(true);
  cityRoot.userData.hospitalLamps = lamps;
  return lamps;
}
