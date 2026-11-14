// Askerî kampüsün yeniden düzenlenmesi (D-F × 4 blokları, alan x 217..866, z -53..156, zemin plakası x 220..863,
// z -50..153). Modelde tek ton haki-gri bir plakanın üstünde 80×40 m'lik düz bir karargâh kutusu, ne olduğu belli olmayan
// bir halka, kuralsız bir asfalt şerit, üç tonozlu hangar, düz bir asfalt dikdörtgende 46 kamyon, iki sıra otomobil ve
// basit bir çit vardı. Çitin içinde ağaç ve lamba yoktu. Model değişmeden açılışta yeniden kurulur:
// - Yerinde kalanlar: üç hangar (tonoz ve duvarlar), kamyonlar, otomobiller.
// - Bina: kuzeyde ortası öne çıkan, kanatları alçalan karargâh; hangarların arkasında iki koğuş ve yemekhane; doğuda
//   testere dişi çatılı bakım atölyesi; ana kapıda nöbetçi binası. Hepsi şehirle aynı kütle ve cephe sistemiyle.
// - Zemin (shader): bulvardan kuzey sokağa iç yol (iki kapı), karargâh önü, içtima (tören) alanı, tribün önü, subay
//   otoparkı, hangar önünde apron ve helikopter pistleri, motorlu birlik araç parkı, doğuda beton servis sahası, koğuş
//   avlusu, duvar boyunca çakıl devriye yolu, biçilmiş çim.
// - Parçalar (kırık tonlar): beton duvar ve tel örgü dikmeleri, gözetleme kuleleri, kapı saçağı, nöbetçi kulübesi ve
//   bariyerler, bayrak direkleri, şeref tribünü, akaryakıt saçağı ve pompalar, yıkama yeri, rüzgâr tulumu, banklar.
// İçtima (cityPeople.ts) PARADE_GROUND alanında kurulur: askerler güneydeki tribüne dönük durur.
// Yerleşim planı aşağıdaki sabitlerde tek yerde tanımlanır. GLSL ve TypeScript tarafı aynı ölçüleri kullanır.
import * as THREE from 'three';
import { MASS_VARIANTS, type MassVariant, PropBuilder } from './cityMass';
import { type TreeSpot, crownRadius, hash2, replantTrees } from './cityTrees';

interface Box {
  x0: number;
  x1: number;
  z0: number;
  z1: number;
}
type Building = Box & { height: number; variant: MassVariant };
interface Disc {
  x: number;
  z: number;
  r: number;
}

const SITE: Box = { x0: 217, x1: 866, z0: -53, z1: 156 };
// Kampüsün zemin plakası (modeldeki Military_Ground): çevresi kaldırım.
const LOT: Box = { x0: 220, x1: 863, z0: -50, z1: 153 };
// Zemin yüksekliği ve binaların oturduğu taban.
const GROUND_Y = 0.75;
const BASE_Y = 0.45;
// Çevre duvarının ekseni: plaka kenarından 2.5 m içeride.
const WALL: Box = { x0: LOT.x0 + 2.5, x1: LOT.x1 - 2.5, z0: LOT.z0 + 2.5, z1: LOT.z1 - 2.5 };

// ---- iç yol: bulvardaki ana kapıdan kuzey sokağındaki servis kapısına
const ROAD: Box = { x0: 446, x1: 460, z0: LOT.z0, z1: LOT.z1 };
const ROAD_X = (ROAD.x0 + ROAD.x1) / 2;
// Ana kapıda yolu ikiye ayıran ada (nöbetçi kulübesi ve bariyerler), kapı saçağı.
const GATE_ISLAND: Box = { x0: 451.6, x1: 454.4, z0: 135, z1: 147 };
const GATE_CANOPY: Box = { x0: 444, x1: 462, z0: 135, z1: 147 };

// ---- batı: karargâh, içtima alanı, tribün, otopark
const HQ: Building[] = [
  { x0: 318, x1: 354, z0: -42, z1: -8, height: 17, variant: 'penthouse' },
  { x0: 268, x1: 318, z0: -38, z1: -16, height: 13, variant: 'plain' },
  { x0: 354, x1: 404, z0: -38, z1: -16, height: 13, variant: 'plain' },
  { x0: 238, x1: 268, z0: -34, z1: -14, height: 9, variant: 'plain' },
  { x0: 404, x1: 434, z0: -34, z1: -14, height: 9, variant: 'plain' },
];
const HQ_X = 336;
const FORECOURT: Box = { x0: 236, x1: 436, z0: -8, z1: 4 };
/** İçtima (tören) alanı: nizam bu alanda kurulur (cityPeople.ts), askerler güneye, tribüne bakar. */
export const PARADE_GROUND: Box = { x0: 240, x1: 428, z0: 6, z1: 90 };
const TRIBUNE_COURT: Box = { x0: 240, x1: 428, z0: 90, z1: 102 };
const TRIBUNE: Box = { x0: 300, x1: 372, z0: 92, z1: 99 };
// Otopark: modeldeki araçların sırası (x 257.4'ten 2.8 m aralıkla, z 105.6 ve 121.6), ortada araç yolu, doğuda iç yola bağlantı.
const PARKING: Box = { x0: 254, x1: 378, z0: 102, z1: 125 };
const PARK_LANE: Box = { x0: 378, x1: ROAD.x0, z0: 108.6, z1: 118.6 };
const BAY = 2.8;
const BAY_X0 = 256;
const BAY_COUNT = 43;
const CAR_ROWS = [
  { z0: 102.6, z1: 108.4 },
  { z0: 118.8, z1: 124.6 },
];
// Nöbetçi binası (ana kapının batısında).
const GUARD: Building = { x0: 430, x1: 442, z0: 132, z1: 146, height: 4.2, variant: 'plain' };

// ---- orta: hangarlar, apron, koğuşlar
// Modeldeki hangarlar (tonoz 6.8-15.7 m, kapılar kuzey ve güney uçta).
const HANGARS: Box[] = [
  { x0: 476, x1: 532, z0: 10, z1: 110 },
  { x0: 546, x1: 602, z0: 10, z1: 110 },
  { x0: 616, x1: 672, z0: 10, z1: 110 },
];
const APRON: Box = { x0: 466, x1: 712, z0: 110, z1: 142 };
const NORTH_APRON: Box = { x0: 466, x1: 682, z0: 6, z1: 10 };
const NORTH_LANE: Box = { x0: ROAD.x1, x1: 712, z0: -4, z1: 6 };
// Helikopter pistleri: hangar kapılarının önünde.
const HELIPADS: Disc[] = HANGARS.map((h) => ({ x: (h.x0 + h.x1) / 2, z: 127, r: 10 }));
const BARRACKS: Building[] = [
  { x0: 470, x1: 550, z0: -43, z1: -22, height: 12.5, variant: 'penthouse' },
  { x0: 560, x1: 602, z0: -41, z1: -21, height: 7.5, variant: 'plain' },
  { x0: 612, x1: 692, z0: -43, z1: -22, height: 12.5, variant: 'penthouseB' },
];
const BARRACKS_COURT: Box = { x0: 466, x1: 696, z0: -20, z1: -4 };
const COURT_Z = -12;

// ---- doğu: motorlu birlik
// Araç parkı: modeldeki kamyon sıraları (x 724'ten 6 m aralıkla, z -0.4, 39.6, 79.6, 119.6; boy 9.8 m).
const MOTOR_POOL: Box = { x0: 712, x1: 812, z0: -12, z1: 132 };
const TRUCK_X0 = 721;
const TRUCK_BAY = 6;
const TRUCK_BAYS = 14;
const TRUCK_ROWS = [-0.4, 39.6, 79.6, 119.6];
const EAST_YARD: Box = { x0: 812, x1: 858, z0: -44, z1: 132 };
const WORKSHOP: Building = { x0: 826, x1: 856, z0: -40, z1: 22, height: 6, variant: 'plain' };
const FUEL: Box = { x0: 826, x1: 852, z0: 46, z1: 70 };
const WASH: Box = { x0: 826, x1: 852, z0: 88, z1: 108 };

const BUILDINGS: Building[] = [...HQ, GUARD, ...BARRACKS, WORKSHOP];

// Gözetleme kuleleri: duvarın dört köşesi ve iki kapının yanı.
const TOWERS: [number, number][] = [
  [WALL.x0 + 4, WALL.z0 + 4],
  [WALL.x1 - 4, WALL.z0 + 4],
  [WALL.x0 + 4, WALL.z1 - 4],
  [WALL.x1 - 4, WALL.z1 - 4],
  [ROAD.x1 + 6, WALL.z1 - 4],
  [ROAD.x0 - 6, WALL.z0 + 4],
];
const TOWER_HALF = 1.6;
const FLAG_MAIN = { x: HQ_X, z: -1, height: 20 };
const FLAG_GATE = { x: 437, z: 128, height: 12 };
const WINDSOCK = { x: 700, z: 139 };

const f = (value: number) => value.toFixed(2);
const v2 = (x: number, z: number) => `vec2(${f(x)}, ${f(z)})`;
const box = (b: Box) => `${v2((b.x0 + b.x1) / 2, (b.z0 + b.z1) / 2)}, ${v2((b.x1 - b.x0) / 2, (b.z1 - b.z0) / 2)}`;
const inBox = (b: Box, x: number, z: number, pad = 0) => x > b.x0 - pad && x < b.x1 + pad && z > b.z0 - pad && z < b.z1 + pad;
const minAll = (terms: string[]) => terms.reduce((a, b) => `min(${a}, ${b})`);

/** Askerî kampüs planının mesafe fonksiyonları (GLSL, global kapsamda). */
export const MILITARY_GLSL = `
// Köşeleri r yarıçapla yuvarlatılmış kutuya işaretli uzaklık (içeride negatif).
float mcBox(vec2 p, vec2 c, vec2 h, float r){ vec2 q = abs(p - c) - h + r; return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r; }
float mcIn(float d, float aa){ return 1.0 - smoothstep(-aa, aa, d); }
// Eşit aralıklı çizgiler (metre): çizgi seçilemeyecek kadar uzaksa ortalama yoğunluğuna söner.
float mcLines(float v, float period, float width, float aa){
  float d = abs(fract(v / period + 0.5) - 0.5) * period;
  float line = 1.0 - smoothstep(width * 0.5 - aa, width * 0.5 + aa, d);
  return mix(width / period, line, 1.0 - smoothstep(width * 0.6, width * 1.5, aa));
}
// Boya bandı: d = 0 eğrisi boyunca w genişliğinde, piksel altına inince ortalama yoğunluğa söner.
float mcStroke(float d, float w, float aa){ return (1.0 - smoothstep(w * 0.5 - aa, w * 0.5 + aa, abs(d))) * min(1.0, w / aa); }
`;

const carBays = CAR_ROWS.map(
  (r) =>
    `bays = max(bays, mcLines(p.x - ${f(BAY_X0)}, ${f(BAY)}, 0.15, aa) * step(${f(BAY_X0)}, p.x) * step(p.x, ${f(BAY_X0 + BAY * BAY_COUNT)}) * step(${f(r.z0)}, p.y) * step(p.y, ${f(r.z1)}));`,
).join('\n    ');
const truckBays = TRUCK_ROWS.map(
  (z) =>
    `bays = max(bays, mcLines(p.x - ${f(TRUCK_X0)}, ${f(TRUCK_BAY)}, 0.2, aa) * step(${f(TRUCK_X0)}, p.x) * step(p.x, ${f(TRUCK_X0 + TRUCK_BAY * TRUCK_BAYS)}) * step(abs(p.y - ${f(z)}), 5.5));
    bays = max(bays, mcStroke(abs(p.y - ${f(z)}) - 5.5, 0.2, aa) * step(${f(TRUCK_X0)}, p.x) * step(p.x, ${f(TRUCK_X0 + TRUCK_BAY * TRUCK_BAYS)}));`,
).join('\n    ');
// Bina çevresinde döşeme şeridi (temel kaldırımı); hangarlar dahil.
const buildingApron = minAll([...BUILDINGS, ...HANGARS].map((b) => `mcBox(p, ${box(b)}, 0.0)`));
// "H" işareti: iki dikme ve bir kiriş.
const helipadMarks = HELIPADS.map(
  (h) => `{
      float r = length(p - ${v2(h.x, h.z)});
      c = mix(c, paint, mcStroke(r - ${f(h.r)}, 0.8, aa));
      float hd = min(min(mcBox(p, ${v2(h.x - 2.6, h.z)}, vec2(0.55, 3.6), 0.0), mcBox(p, ${v2(h.x + 2.6, h.z)}, vec2(0.55, 3.6), 0.0)), mcBox(p, ${v2(h.x, h.z)}, vec2(2.6, 0.5), 0.0));
      c = mix(c, paint, mcIn(hd, aa));
      c = mix(c, yellow, mcStroke(p.x - ${f(h.x)}, 0.3, aa) * step(${f(APRON.z0)}, p.y) * step(p.y, ${f(h.z - h.r - 1)}));
    }`,
).join('\n    ');

/** Askerî kampüs zemini: Military_Ground'un rengi tamamen dünya konumundan çizilir (köşe renkleri yok sayılır). */
export const MILITARY_FRAGMENT = `#include <color_fragment>
  {
    vec2 p = vWPos.xz;
    float aa = max(fwidth(p.x), fwidth(p.y)) * 0.8 + 0.05;
    float fine = 1.0 - smoothstep(0.8, 2.5, aa);
    float n1 = fbm(p * 0.02);
    float n2 = fbm(p * 0.09 + 17.0);
    float grain = 0.94 + 0.12 * h12(floor(p * 3.0)) * fine;
    vec3 rimColor = vec3(0.55, 0.53, 0.5);
    vec3 paint = vec3(0.72, 0.7, 0.64);
    vec3 yellow = vec3(0.64, 0.5, 0.18);
    float mow = 1.0 - smoothstep(2.0, 5.0, aa);

    // Çim: biçme şeritleri ve geniş ton farkları.
    vec3 c = vec3(0.12, 0.18, 0.065) * (0.82 + 0.36 * n1);
    c *= 1.0 + (step(0.5, fract((p.x + p.y * 0.2) / 9.0)) - 0.5) * 0.12 * mow;

    vec3 gravel = vec3(0.4, 0.36, 0.28) * (0.88 + 0.24 * n2) * grain;
    float joint = max(mcLines(p.x, 1.2, 0.08, aa), mcLines(p.y, 1.2, 0.08, aa));
    vec3 stone = vec3(0.52, 0.49, 0.44) * grain * (0.94 + 0.12 * n2) * (1.0 - 0.1 * joint);
    vec3 granite = vec3(0.27, 0.26, 0.25) * grain;
    float slab = max(mcLines(p.x, 5.0, 0.12, aa), mcLines(p.y, 5.0, 0.12, aa));
    vec3 concrete = vec3(0.47, 0.46, 0.43) * grain * (0.92 + 0.16 * n2) * (1.0 - 0.12 * slab);
    vec3 asphalt = vec3(0.2, 0.195, 0.19) * (0.88 + 0.24 * n2);

    // Plaka kenarında çit bitkisi, duvarın iç yüzü boyunca çakıl devriye yolu (yollar sonra üstüne çizilir).
    float edge = min(min(p.x - ${f(LOT.x0)}, ${f(LOT.x1)} - p.x), min(p.y - ${f(LOT.z0)}, ${f(LOT.z1)} - p.y));
    c = mix(c, vec3(0.055, 0.095, 0.035) * (0.7 + 0.6 * fbm(p * 0.45)), mcIn(edge - 2.2 + (n2 - 0.5) * 0.6, aa));
    c = mix(c, gravel, mcIn(abs(edge - 3.9) - 1.1, aa));

    // Beton: apronlar ve doğu servis sahası.
    float hard = ${minAll([`mcBox(p, ${box(APRON)}, 1.0)`, `mcBox(p, ${box(NORTH_APRON)}, 0.0)`, `mcBox(p, ${box(EAST_YARD)}, 1.0)`])};
    c = mix(c, concrete, mcIn(hard, aa));
    c = mix(c, rimColor, mcIn(abs(hard) - 0.25, aa) * fine);
    // Yıkama yerinde ıslak, koyu beton; akaryakıt saçağının altında yağ lekeli beton.
    c = mix(c, concrete * 0.72, mcIn(mcBox(p, ${box(WASH)}, 0.0), aa));
    c = mix(c, concrete * (0.85 + 0.15 * fbm(p * 0.7)), mcIn(mcBox(p, ${box(FUEL)}, 0.0), aa));

    // Asfalt: iç yol, otopark ve bağlantısı, kuzey şeridi, araç parkı.
    float road = ${minAll([
      `mcBox(p, ${box(ROAD)}, 0.0)`,
      `mcBox(p, ${box(PARKING)}, 0.8)`,
      `mcBox(p, ${box(PARK_LANE)}, 0.0)`,
      `mcBox(p, ${box(NORTH_LANE)}, 0.0)`,
      `mcBox(p, ${box(MOTOR_POOL)}, 1.0)`,
    ])};
    c = mix(c, asphalt, mcIn(road, aa));
    c = mix(c, rimColor, mcIn(abs(road) - 0.25, aa) * fine * step(${f(LOT.z0 + 0.5)}, p.y) * step(p.y, ${f(LOT.z1 - 0.5)}));
    // İç yolun orta kesik çizgisi, kapıda dur çizgisi ve ada.
    c = mix(c, paint, mcStroke(p.x - ${f(ROAD_X)}, 0.15, aa) * step(0.5, fract(p.y / 6.0)) * step(${f(WALL.z0 + 4)}, p.y) * step(p.y, ${f(GATE_ISLAND.z0)}) * fine);
    c = mix(c, paint, mcStroke(p.y - ${f(GATE_ISLAND.z0 - 1)}, 0.4, aa) * step(${f(ROAD.x0)}, p.x) * step(p.x, ${f(ROAD.x1)}) * fine);
    {
      float island = mcBox(p, ${box(GATE_ISLAND)}, 0.8);
      c = mix(c, concrete, mcIn(island, aa));
      c = mix(c, yellow, mcIn(abs(island) - 0.2, aa) * fine);
    }
    float bays = 0.0;
    ${carBays}
    ${truckBays}
    c = mix(c, paint * 0.95, bays * fine);
    // Araç parkında sarı yürüme şeridi (batı kenarı) ve sıralar arası yön okları yerine kesik çizgi.
    c = mix(c, yellow, mcStroke(p.x - ${f(MOTOR_POOL.x0 + 3)}, 0.3, aa) * step(${f(MOTOR_POOL.z0)}, p.y) * step(p.y, ${f(MOTOR_POOL.z1)}) * fine);
    ${TRUCK_ROWS.slice(0, -1)
      .map((z, i) => `c = mix(c, paint, mcStroke(p.y - ${f((z + TRUCK_ROWS[i + 1]) / 2)}, 0.15, aa) * step(0.5, fract(p.x / 6.0)) * step(${f(TRUCK_X0)}, p.x) * step(p.x, ${f(TRUCK_X0 + TRUCK_BAY * TRUCK_BAYS)}) * fine);`)
      .join('\n    ')}

    // Helikopter pistleri ve hangar kapısından sarı yönlendirme çizgisi; hangar önlerinde kapı eşiği.
    ${helipadMarks}
    ${HANGARS.map((h) => `c = mix(c, yellow, mcStroke(p.y - ${f(h.z1 + 1.5)}, 0.3, aa) * step(${f(h.x0)}, p.x) * step(p.x, ${f(h.x1)}) * fine);`).join('\n    ')}

    // Taş döşemeler: bina çevresi, karargâh önü, tribün önü, koğuş avlusunun yolları.
    float paved = ${minAll([
      `mcBox(p, ${box(FORECOURT)}, 0.0)`,
      `mcBox(p, ${box(TRIBUNE_COURT)}, 0.0)`,
      `max(abs(p.y - ${f(COURT_Z)}) - 1.6, mcBox(p, ${box(BARRACKS_COURT)}, 0.0))`,
      ...BARRACKS.map((b) => `max(abs(p.x - ${f((b.x0 + b.x1) / 2)}) - 1.6, mcBox(p, ${box(BARRACKS_COURT)}, 0.0))`),
      `${buildingApron} - 2.4`,
    ])};
    c = mix(c, stone, mcIn(paved, aa));

    // İçtima alanı: açık taş, 6 m'lik granit derzler, kenarda granit bant, karargâhtan tribüne granit aks.
    {
      float pg = mcBox(p, ${box(PARADE_GROUND)}, 0.0);
      vec3 floorColor = vec3(0.53, 0.505, 0.455) * grain * (0.95 + 0.1 * n2);
      floorColor = mix(floorColor, granite, max(mcLines(p.x - ${f(HQ_X)}, 6.0, 0.25, aa), mcLines(p.y - ${f(PARADE_GROUND.z0)}, 6.0, 0.25, aa)) * 0.35);
      c = mix(c, floorColor, mcIn(pg, aa));
      c = mix(c, granite, mcIn(abs(pg + 1.0) - 1.0, aa));
      c = mix(c, granite, mcIn(abs(p.x - ${f(HQ_X)}) - 1.2, aa) * mcIn(mcBox(p, ${v2(HQ_X, (FORECOURT.z0 + TRIBUNE_COURT.z1) / 2)}, ${v2(10, (TRIBUNE_COURT.z1 - FORECOURT.z0) / 2)}, 0.0), aa));
    }

    diffuseColor.rgb = c;
  }`;

// ------------------------------------------------------------------ binalar

// Duvar ve çatı paleti (FACADE_FRAGMENT eşikleriyle): krem-kum sıva, açık çatı. Değer okul ve bilim merkezinin "civic"
// tonuyla aynı: aynı cephe programını paylaşır, açılışta ek cephe shader'ı derlenmez.
const PALETTE = 'vec2(0.4, 0.7)';

function blockMatrix(b: Box, height: number) {
  const hy = height / 2;
  return new THREE.Matrix4().compose(
    new THREE.Vector3((b.x0 + b.x1) / 2, BASE_Y + hy, (b.z0 + b.z1) / 2),
    new THREE.Quaternion(),
    new THREE.Vector3((b.x1 - b.x0) / 2, hy, (b.z1 - b.z0) / 2),
  );
}

function buildingMeshes(source: THREE.Material) {
  const material = source.clone();
  material.defines = { ...material.defines, CITY_PALETTE: PALETTE };
  // Aynı kütle tek örnekli mesh'te.
  const groups = new Map<MassVariant, Building[]>();
  for (const b of BUILDINGS) groups.set(b.variant, [...(groups.get(b.variant) ?? []), b]);
  return [...groups.entries()].map(([variant, list]) => {
    const mesh = new THREE.InstancedMesh(MASS_VARIANTS[variant]().build(), material, list.length);
    mesh.name = `Military_Mass_${variant}`;
    list.forEach((b, i) => mesh.setMatrixAt(i, blockMatrix(b, b.height)));
    mesh.instanceMatrix.needsUpdate = true;
    return mesh;
  });
}

// ------------------------------------------------------------------ parçalar

// Kırık tonlar: şehrin paletinden kopmayan, doygunluğu düşük renkler.
const TONE = {
  concrete: '#b3aea3',
  steel: '#8c8f92',
  dark: '#4a4d50',
  roof: '#a9aaa6',
  ridge: '#7c7e7d',
  olive: '#6f7352',
  wood: '#a88a68',
  white: '#e6e1d6',
  red: '#a8453a',
  ochre: '#c9a35e',
  glass: '#3c4650',
};

/** Gözetleme kulesi: dört ayak, camlı kabin, piramit çatı. */
function watchtower(props: PropBuilder, x: number, z: number) {
  const y = GROUND_Y;
  const h = TOWER_HALF;
  for (const [dx, dz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
    const lx = x + dx * (h - 0.2);
    const lz = z + dz * (h - 0.2);
    props.box(lx - 0.15, lx + 0.15, y, y + 6.2, lz - 0.15, lz + 0.15, TONE.steel);
  }
  props.box(x - h - 0.3, x + h + 0.3, y + 6.0, y + 6.3, z - h - 0.3, z + h + 0.3, TONE.concrete);
  props.box(x - h, x + h, y + 6.3, y + 7.2, z - h, z + h, TONE.olive);
  props.box(x - h + 0.05, x + h - 0.05, y + 7.2, y + 8.2, z - h + 0.05, z + h - 0.05, TONE.glass);
  props.box(x - h, x + h, y + 8.2, y + 8.5, z - h, z + h, TONE.olive);
  props.pyramid(x - h - 0.5, x + h + 0.5, y + 8.5, y + 9.6, z - h - 0.5, z + h + 0.5, TONE.ridge);
}

/** Bayrak direği: ince direk, tepede top, kırmızı bayrak (doğuya açılmış). */
function flagpole(props: PropBuilder, x: number, z: number, height: number) {
  const y = GROUND_Y;
  props.box(x - 0.9, x + 0.9, y, y + 0.5, z - 0.9, z + 0.9, TONE.concrete);
  props.cylinder(x, y + 0.5, z, height * 0.009, height, 'y', TONE.white, 8);
  props.cylinder(x, y + 0.5 + height, z, height * 0.018, height * 0.025, 'y', TONE.ochre, 8);
  const fw = height * 0.3;
  const fh = fw * 0.66;
  props.box(x + 0.15, x + 0.15 + fw, y + height - fh - 0.3, y + height - 0.3, z - 0.04, z + 0.04, TONE.red);
}

function bench(props: PropBuilder, x: number, z: number) {
  const y = GROUND_Y;
  props.box(x - 0.9, x + 0.9, y + 0.3, y + 0.45, z - 0.3, z + 0.3, TONE.wood);
  props.box(x - 0.75, x + 0.75, y, y + 0.3, z - 0.2, z + 0.2, TONE.steel);
}

/** Duvar parçası: alçak beton duvar, üstünde 5 m'de bir tel örgü dikmesi ve iki tel. */
function wallRun(props: PropBuilder, ax: number, az: number, bx: number, bz: number) {
  const y = GROUND_Y;
  const t = 0.2;
  const [x0, x1, z0, z1] = [Math.min(ax, bx) - t, Math.max(ax, bx) + t, Math.min(az, bz) - t, Math.max(az, bz) + t];
  props.box(x0, x1, y, y + 1.4, z0, z1, TONE.concrete);
  props.box(x0 - 0.05, x1 + 0.05, y + 1.4, y + 1.5, z0 - 0.05, z1 + 0.05, TONE.roof);
  const length = Math.hypot(bx - ax, bz - az);
  const steps = Math.max(1, Math.round(length / 5));
  for (let k = 0; k <= steps; k++) {
    const px = ax + ((bx - ax) * k) / steps;
    const pz = az + ((bz - az) * k) / steps;
    props.box(px - 0.06, px + 0.06, y + 1.5, y + 3.2, pz - 0.06, pz + 0.06, TONE.dark);
  }
  for (const h of [2.3, 3.1]) props.box(x0 + 0.15, x1 - 0.15, y + h, y + h + 0.05, z0 + 0.15, z1 - 0.15, TONE.dark);
}

function propsGeometry() {
  const props = new PropBuilder();
  const y = GROUND_Y;

  // Çevre duvarı: iç yolun iki ucunda kapı boşluğu.
  const gap0 = ROAD.x0 - 0.5;
  const gap1 = ROAD.x1 + 0.5;
  for (const z of [WALL.z0, WALL.z1]) {
    wallRun(props, WALL.x0, z, gap0, z);
    wallRun(props, gap1, z, WALL.x1, z);
  }
  for (const x of [WALL.x0, WALL.x1]) wallRun(props, x, WALL.z0, x, WALL.z1);
  // Kapı babaları.
  for (const z of [WALL.z0, WALL.z1]) {
    for (const x of [gap0, gap1]) props.box(x - 0.6, x + 0.6, y, y + 3.4, z - 0.6, z + 0.6, TONE.concrete);
  }
  // Kuzey kapısı: açık sürgülü kanat duvarın iç yüzüne çekilmiş.
  props.box(gap1 + 1, gap1 + 14, y + 0.2, y + 2.6, WALL.z0 + 0.5, WALL.z0 + 0.6, TONE.dark);
  props.box(gap1 + 1, gap1 + 14, y + 2.4, y + 2.6, WALL.z0 + 0.45, WALL.z0 + 0.65, TONE.olive);
  props.box(ROAD.x1 + 2, ROAD.x1 + 4.6, y, y + 2.8, WALL.z0 + 3, WALL.z0 + 5.6, TONE.olive);
  props.box(ROAD.x1 + 1.8, ROAD.x1 + 4.8, y + 2.8, y + 3.0, WALL.z0 + 2.8, WALL.z0 + 5.8, TONE.ridge);

  // Ana kapı: saçak, adada nöbetçi kulübesi, iki şeritte kırmızı-beyaz bariyer.
  const gc = GATE_CANOPY;
  props.box(gc.x0, gc.x1, y + 5.6, y + 6.1, gc.z0, gc.z1, TONE.roof);
  props.box(gc.x0, gc.x1, y + 5.2, y + 5.6, gc.z1 - 0.3, gc.z1, TONE.olive);
  for (const x of [gc.x0 + 0.4, gc.x1 - 0.4]) {
    for (const z of [gc.z0 + 0.5, gc.z1 - 0.5]) props.box(x - 0.25, x + 0.25, y, y + 5.6, z - 0.25, z + 0.25, TONE.steel);
  }
  const gi = GATE_ISLAND;
  props.box(gi.x0, gi.x1, y, y + 0.18, gi.z0, gi.z1, TONE.concrete);
  props.box(gi.x0 + 0.2, gi.x1 - 0.2, y + 0.18, y + 2.9, gi.z0 + 3, gi.z0 + 7, TONE.white);
  props.box(gi.x0 + 0.15, gi.x1 - 0.15, y + 1.6, y + 2.5, gi.z0 + 2.95, gi.z0 + 7.05, TONE.glass);
  props.box(gi.x0 - 0.2, gi.x1 + 0.2, y + 2.9, y + 3.1, gi.z0 + 2.6, gi.z0 + 7.4, TONE.ridge);
  const barrierZ = gi.z1 - 1;
  props.box(gi.x0 + 0.5, gi.x1 - 0.5, y + 0.18, y + 1.1, barrierZ - 0.3, barrierZ + 0.3, TONE.dark);
  for (const [from, to] of [[ROAD.x0 + 0.4, gi.x0], [gi.x1, ROAD.x1 - 0.4]]) {
    for (let x = from, k = 0; x < to - 0.05; x += 1, k++) {
      props.box(x, Math.min(to, x + 1), y + 0.95, y + 1.1, barrierZ - 0.06, barrierZ + 0.06, k % 2 ? TONE.white : TONE.red);
    }
  }

  // Gözetleme kuleleri, bayrak direkleri.
  for (const [x, z] of TOWERS) watchtower(props, x, z);
  flagpole(props, FLAG_MAIN.x, FLAG_MAIN.z, FLAG_MAIN.height);
  flagpole(props, FLAG_GATE.x, FLAG_GATE.z, FLAG_GATE.height);

  // Şeref tribünü: kuzeye (içtima alanına) bakan dört basamak, arkada duvar, saçak, önde selam kürsüsü.
  const tr = TRIBUNE;
  for (let i = 0; i < 4; i++) props.box(tr.x0, tr.x1, y, y + 0.45 * (i + 1), tr.z0 + i * 1.5, tr.z1, TONE.concrete);
  props.box(tr.x0, tr.x1, y, y + 4.4, tr.z1 - 0.4, tr.z1, TONE.olive);
  props.box(tr.x0 - 0.6, tr.x1 + 0.6, y + 4.4, y + 4.8, tr.z0 - 1.2, tr.z1 + 0.2, TONE.roof);
  for (let x = tr.x0 + 0.4; x <= tr.x1 - 0.3; x += (tr.x1 - tr.x0 - 0.8) / 4) props.box(x - 0.15, x + 0.15, y, y + 4.4, tr.z0 + 0.1, tr.z0 + 0.4, TONE.steel);
  props.box(HQ_X - 4, HQ_X + 4, y, y + 1.0, tr.z0 - 2, tr.z0, TONE.concrete);
  props.box(HQ_X - 0.6, HQ_X + 0.6, y + 1.0, y + 2.1, tr.z0 - 1.6, tr.z0 - 0.8, TONE.wood);

  // Bakım atölyesi: testere dişi çatı (dişler doğuya bakan camlı yüzle).
  const w = WORKSHOP;
  const top = BASE_Y + w.height;
  for (let x = w.x0; x < w.x1 - 0.1; x += 6) {
    props.ramp(x, top + 0.3, x + 5.8, top + 2.6, w.z0 + 0.5, w.z1 - 0.5, 0.3, TONE.roof);
    props.box(x + 5.8, x + 6, top, top + 2.6, w.z0 + 0.5, w.z1 - 0.5, TONE.glass);
  }
  // Atölye önünde iki kapı saçağı.
  for (const z of [w.z0 + 14, w.z1 - 14]) props.box(w.x0 - 3, w.x0, y + 4.6, y + 4.9, z - 5, z + 5, TONE.ridge);

  // Akaryakıt noktası: dört kolonlu saçak, iki pompa adası.
  const fu = FUEL;
  props.box(fu.x0, fu.x1, y + 5.4, y + 6.2, fu.z0, fu.z1, TONE.white);
  props.box(fu.x0, fu.x1, y + 5.4, y + 5.7, fu.z0 - 0.1, fu.z1 + 0.1, TONE.olive);
  for (const x of [fu.x0 + 6, fu.x1 - 6]) {
    for (const z of [fu.z0 + 6, fu.z1 - 6]) props.box(x - 0.3, x + 0.3, y, y + 5.4, z - 0.3, z + 0.3, TONE.steel);
    props.box(x - 1, x + 1, y, y + 0.2, fu.z0 + 5, fu.z1 - 5, TONE.concrete);
    for (const z of [fu.z0 + 9, fu.z1 - 9]) props.box(x - 0.4, x + 0.4, y + 0.2, y + 2.0, z - 0.6, z + 0.6, TONE.ochre);
  }

  // Yıkama yeri: iki yan duvar ve çatı.
  const wa = WASH;
  for (const x of [wa.x0, wa.x1 - 0.6]) props.box(x, x + 0.6, y, y + 5.6, wa.z0, wa.z1, TONE.concrete);
  props.box(wa.x0 - 0.4, wa.x1 + 0.4, y + 5.6, y + 6.0, wa.z0 - 0.4, wa.z1 + 0.4, TONE.ridge);

  // Rüzgâr tulumu (apron kenarı).
  props.box(WINDSOCK.x - 0.1, WINDSOCK.x + 0.1, y, y + 6.5, WINDSOCK.z - 0.1, WINDSOCK.z + 0.1, TONE.steel);
  props.box(WINDSOCK.x + 0.1, WINDSOCK.x + 2.6, y + 5.6, y + 6.3, WINDSOCK.z - 0.3, WINDSOCK.z + 0.3, TONE.ochre);

  // Koğuş avlusunda banklar.
  for (const x of [500, 530, 640, 670]) {
    bench(props, x, COURT_Z - 3);
    bench(props, x, COURT_Z + 3);
  }
  return props.build();
}

// ------------------------------------------------------------------ ağaçlar ve lambalar

// Ağaç dikilmeyen yerler: tepe bunların üstüne taşmaz.
const SOLID: Box[] = [
  ...BUILDINGS,
  ...HANGARS,
  ROAD,
  PARKING,
  PARK_LANE,
  PARADE_GROUND,
  TRIBUNE_COURT,
  FORECOURT,
  APRON,
  NORTH_APRON,
  NORTH_LANE,
  MOTOR_POOL,
  EAST_YARD,
  GATE_CANOPY,
];

/** Tepe yarıçapı `radius` olan ağaç buraya sığar mı: duvarın içinde, yapılardan, döşemelerden ve lambalardan uzak. */
function treeAllowed(x: number, z: number, radius: number, lamps: number[]) {
  if (!inBox(WALL, x, z, -radius - 0.8)) return false;
  if (SOLID.some((b) => inBox(b, x, z, radius + 0.5))) return false;
  if (TOWERS.some(([tx, tz]) => Math.abs(x - tx) < radius + 2.2 && Math.abs(z - tz) < radius + 2.2)) return false;
  for (const flag of [FLAG_MAIN, FLAG_GATE, WINDSOCK]) {
    if (Math.abs(x - flag.x) < radius + 7 && Math.abs(z - flag.z) < radius + 3) return false;
  }
  if (inBox(BARRACKS_COURT, x, z)) {
    if (Math.abs(z - COURT_Z) < radius + 1.8) return false;
    if (BARRACKS.some((b) => Math.abs(x - (b.x0 + b.x1) / 2) < radius + 1.8)) return false;
  }
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

  // İç yolun iki yanında dizi (kapı saçağı ve kavşaklar açık).
  for (let z = WALL.z0 + 12; z < GATE_CANOPY.z0 - 4; z += 10) {
    add(ROAD.x0 - 4, z, 8, [0.8, 0.62]);
    add(ROAD.x1 + 4, z, 8, [0.8, 0.62]);
  }
  // Bulvar tarafı kamuflaj şeridi: duvar boyunca iki sıra, sık.
  for (let x = WALL.x0 + 6; x < WALL.x1 - 4; x += 8) {
    add(x + jitter(x, 3) * 1.5, WALL.z1 - 6, 7);
    add(x + 4 + jitter(x, 4) * 1.5, WALL.z1 - 12, 7, [0.8, 0.62]);
  }
  // Diğer kenarlar: tek sıra.
  for (let x = WALL.x0 + 6; x < WALL.x1 - 4; x += 9) add(x + jitter(x, 5), WALL.z0 + 5.5, 8, [0.8, 0.62]);
  for (let z = WALL.z0 + 6; z < WALL.z1 - 4; z += 9) {
    add(WALL.x0 + 5.5, z + jitter(z, 6), 8, [0.8, 0.62]);
    add(WALL.x1 - 5.5, z + jitter(z, 7), 8, [0.8, 0.62]);
  }
  // Ön bahçe (otopark ile duvar arası), tribün önünün iki ucu.
  scatter({ x0: WALL.x0 + 4, x1: GUARD.x0 - 3, z0: PARKING.z1 + 3, z1: WALL.z1 - 4 }, 70, 7, 410);
  scatter({ x0: WALL.x0 + 4, x1: PARKING.x0 - 2, z0: TRIBUNE_COURT.z1 + 2, z1: WALL.z1 - 4 }, 12, 7, 420);
  // Karargâh kanatlarının çevresi ve iç yola kadar.
  scatter({ x0: WALL.x0 + 4, x1: ROAD.x0 - 2, z0: WALL.z0 + 4, z1: FORECOURT.z0 - 2 }, 50, 7, 430, [0.8, 0.62]);
  scatter({ x0: PARADE_GROUND.x1 + 2, x1: ROAD.x0 - 2, z0: FORECOURT.z1 + 2, z1: PARK_LANE.z0 - 2 }, 24, 7, 440, [0.8, 0.62]);
  scatter({ x0: WALL.x0 + 4, x1: PARADE_GROUND.x0 - 1, z0: FORECOURT.z1 + 2, z1: WALL.z1 - 4 }, 20, 6, 450, [0.62]);
  // Koğuş avlusunda küçük ağaçlar, hangarlar arası ve hangarlarla araç parkı arası şerit.
  for (let x = BARRACKS_COURT.x0 + 6; x < BARRACKS_COURT.x1 - 4; x += 11) {
    add(x, COURT_Z - 5, 7, [0.62]);
    add(x, COURT_Z + 5, 7, [0.62]);
  }
  for (const [x0, x1] of [[HANGARS[0].x1, HANGARS[1].x0], [HANGARS[1].x1, HANGARS[2].x0]]) {
    for (let z = HANGARS[0].z0 + 8; z < HANGARS[0].z1 - 4; z += 10) add((x0 + x1) / 2, z, 8, [0.8, 0.62]);
  }
  scatter({ x0: HANGARS[2].x1 + 2, x1: MOTOR_POOL.x0 - 2, z0: NORTH_LANE.z1 + 2, z1: APRON.z0 - 2 }, 60, 7, 460);
  scatter({ x0: ROAD.x1 + 2, x1: HANGARS[0].x0 - 2, z0: NORTH_LANE.z1 + 2, z1: APRON.z0 - 2 }, 30, 7, 470, [0.8, 0.62]);
  // Araç parkının kuzeyi, apronun güneyi.
  scatter({ x0: BARRACKS[2].x1 + 2, x1: EAST_YARD.x0 - 2, z0: WALL.z0 + 3, z1: MOTOR_POOL.z0 - 2 }, 60, 7, 480);
  scatter({ x0: APRON.x0, x1: WALL.x1 - 4, z0: APRON.z1 + 2, z1: WALL.z1 - 3 }, 50, 6, 490, [0.8, 0.62]);
  return trees;
}

/** Lambalar: iç yol, karargâh önü, içtima alanının köşeleri, tribün önü, apron, araç parkı, servis sahası, koğuş avlusu. */
function militaryLamps(): number[] {
  const lamps: number[] = [];
  const low = GROUND_Y + 4.5;
  const tall = GROUND_Y + 8;
  for (let z = WALL.z0 + 14; z < GATE_CANOPY.z0 - 4; z += 24) {
    if (z > NORTH_LANE.z0 - 3 && z < NORTH_LANE.z1 + 3) continue;
    if (z > PARK_LANE.z0 - 3 && z < PARK_LANE.z1 + 3) continue;
    lamps.push(ROAD.x0 - 1, tall, z, ROAD.x1 + 1, tall, z + 12);
  }
  for (let x = FORECOURT.x0 + 12; x < FORECOURT.x1; x += 34) {
    if (Math.abs(x - HQ_X) < 12) continue;
    lamps.push(x, low, FORECOURT.z1 - 0.8);
  }
  for (const x of [PARADE_GROUND.x0 + 1, PARADE_GROUND.x1 - 1]) {
    for (const z of [PARADE_GROUND.z0 + 1, (PARADE_GROUND.z0 + PARADE_GROUND.z1) / 2, PARADE_GROUND.z1 - 1]) lamps.push(x, tall, z);
  }
  for (const x of [262, 290, 382, 410]) lamps.push(x, low, TRIBUNE_COURT.z1 - 0.8);
  for (const x of [HANGARS[0].x0 - 4, 539, 609, 692]) lamps.push(x, tall, APRON.z1 - 1);
  for (let i = 0; i < TRUCK_ROWS.length - 1; i++) {
    const z = (TRUCK_ROWS[i] + TRUCK_ROWS[i + 1]) / 2;
    lamps.push(MOTOR_POOL.x0 + 1, tall, z, MOTOR_POOL.x1 - 1, tall, z);
  }
  for (const z of [-30, 36, 80, 120]) lamps.push(EAST_YARD.x1 - 1, tall, z);
  for (const x of [510, 581, 652]) lamps.push(x, low, COURT_Z + 1.2);
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

// Modeldeki eski karargâh kutusu (bina ve çatı mesh'lerinin bu sahadaki parçası; hangar duvarları ve G-H'deki eski kuzey
// kısmı kalır).
const OLD_HQ: Box = { x0: 240, x1: 330, z0: 35, z1: 85 };
const REPLACED = /^Military_(Ground|Perimeter_Fence)$/;
const OWN = /^Military_(Ground|Props|Mass_.+)$/;

/**
 * Askerî kampüsü yeniden düzenler: modeldeki zemin ve çit kaldırılır, eski karargâh bina ve çatı mesh'lerinden, araç parkı
 * asfaltı eğitim alanları mesh'inden silinir. Yerine tek zemin (Military_Ground, rengi MILITARY_FRAGMENT ile cityRuntime
 * çizer), binalar, parçalar ve ağaçlar gelir. Lamba konumlarını döndürür. Hazırlık ikinci kez çalışırsa (StrictMode) tekrar
 * etmez.
 */
export function landscapeMilitaryCampus(cityRoot: THREE.Object3D, treeScale: number): number[] {
  const done = cityRoot.userData.militaryLamps as number[] | undefined;
  if (done) return done;
  cityRoot.updateMatrixWorld(true);
  const ground = cityRoot.getObjectByName('Military_Ground');
  const hangars = cityRoot.getObjectByName('Military_Hangars');
  const buildings = cityRoot.getObjectByName('Military_Buildings');
  const roofs = cityRoot.getObjectByName('Military_Roofs');
  const training = cityRoot.getObjectByName('Military_TrainingGrounds');
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
    !(hangars instanceof THREE.Mesh) ||
    !(buildings instanceof THREE.Mesh) ||
    !(roofs instanceof THREE.Mesh) ||
    !facade ||
    Array.isArray(ground.material) ||
    Array.isArray(hangars.material)
  ) {
    return [];
  }

  const parent = ground.parent ?? cityRoot;
  for (const mesh of removed) {
    mesh.removeFromParent();
    mesh.geometry.dispose();
  }
  dropTriangles(buildings, [OLD_HQ]);
  dropTriangles(roofs, [OLD_HQ]);
  if (training instanceof THREE.Mesh) dropTriangles(training, [SITE]);
  // Zemin: aynı adla tek plaka (eski halka ve asfalt üçgenleri gider), LANDSCAPES malzemeyi klonlayıp yamar.
  const site = new THREE.Mesh(plane(LOT, GROUND_Y), ground.material);
  site.name = 'Military_Ground';
  site.userData = { groundLayered: true };
  // Parçalar hangarların satin malzemesini paylaşır (köşe renkli).
  const props = new THREE.Mesh(propsGeometry(), hangars.material);
  props.name = 'Military_Props';
  for (const mesh of [site, props, ...buildingMeshes(facade)]) parent.add(mesh);
  // Yeni parçalar dünya koordinatında kuruldu: ebeveynin dönüşümü birim olmalı.
  parent.updateMatrixWorld(true);
  if (!parent.matrixWorld.equals(new THREE.Matrix4())) {
    const inverse = parent.matrixWorld.clone().invert();
    for (const child of parent.children) {
      if (OWN.test(child.name)) child.applyMatrix4(inverse);
    }
  }

  const lamps = militaryLamps();
  replantTrees(cityRoot, {
    prefix: 'Military',
    inside: (x, z) => inBox(SITE, x, z),
    spots: plantTrees(crownRadius(cityRoot, treeScale), lamps),
    treeScale,
  });
  cityRoot.updateMatrixWorld(true);
  cityRoot.userData.militaryLamps = lamps;
  return lamps;
}
