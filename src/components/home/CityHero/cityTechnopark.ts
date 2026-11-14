// Teknopark (G-H × 1-3 blokları, alan x 894..1503, z -563..-67, zemin plakası x 897..1500, z -560..-70). Tesis değildir:
// isimsiz kent dokusu, etiketi ve kamerası yok. Modelde burada askerî kampüsün takasta yerinde kalan kuzey kısmı vardı
// (kaldırım renginde tek ton plaka, kışlalar, tonozlu koğuşlar, karargâh, nizamiye ve bayraklar, tören alanı, engel parkuru);
// kampüsün asıl alanı D-F × 4'e taşındığı için burası ikinci, boş bir askerî bölge gibi duruyordu. Model değişmeden
// açılışta yeniden kurulur:
// - Kalanlar: çevre sokaklar ve kaldırımlar, spor sahası (yeşil zemin, kırmızı pist; çizgi ve kaleler eklenir).
// - Kaldırılanlar: bölgedeki bütün askerî parçalar ve alandaki ağaçlar (plana göre yeniden dikilir).
// - Bina: batıda üç, doğuda iki Ar-Ge bloğu (aralarında avlular ve alçak geçitler), güneyde kuluçka/sergi binası, kuzeyde
//   çatısı güneş panelli iki prototip salonu ve veri merkezi, kafe ve spor kulübü. Hepsi şehirle aynı kütle ve cephe
//   sistemiyle.
// - Zemin (shader): güney giriş meydanı (granit ızgara), kuzey-güney kampüs çimi ve yansıma havuzu, bahçe yolları ve çiçek
//   tarhları, iki ağaç adalı açık otopark, kuzeyde servis yolu ve avlu, tenis ve basketbol sahaları.
// - Parçalar (kırık tonlar): güneş panelleri, soğutma üniteleri ve jeneratörler, yükleme saçakları, konteynerler, giriş
//   saçağı, kafe şemsiyeleri, banklar, otobüs durağı, yön totemleri, bariyerler, tenis filesi ve çiti, potalar, kaleler.
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
type Building = Box & { height: number; variant: MassVariant; palette: Palette };

const SITE: Box = { x0: 894, x1: 1503, z0: -563, z1: -67 };
const LOT: Box = { x0: 897, x1: 1500, z0: -560, z1: -70 };
const GROUND_Y = 0.75;
const BASE_Y = 0.45;

// ---- binalar (24 m'yi geçen kütleyi cephe programı rastgele cam kuleye çevirebilir: hepsi altında kalır)
const HALL_A: Building = { x0: 935, x1: 1085, z0: -545, z1: -480, height: 12, variant: 'plain', palette: 'civic' };
const HALL_B: Building = { x0: 1215, x1: 1365, z0: -545, z1: -480, height: 12, variant: 'plain', palette: 'civic' };
const DATA_CENTER: Building = { x0: 1395, x1: 1485, z0: -545, z1: -480, height: 9, variant: 'plain', palette: 'civic' };
const LAB_WEST: Building[] = [
  { x0: 940, x1: 1090, z0: -430, z1: -394, height: 18, variant: 'penthouse', palette: 'lab' },
  { x0: 940, x1: 1090, z0: -350, z1: -314, height: 22, variant: 'penthouseB', palette: 'lab' },
  { x0: 940, x1: 1090, z0: -270, z1: -234, height: 16, variant: 'penthouse', palette: 'lab' },
];
const LAB_EAST: Building[] = [
  { x0: 1210, x1: 1350, z0: -430, z1: -394, height: 20, variant: 'penthouseB', palette: 'lab' },
  { x0: 1210, x1: 1350, z0: -350, z1: -314, height: 15, variant: 'penthouse', palette: 'lab' },
];
// Bloklar arasında kapalı geçitler.
const LINKS: Building[] = [
  { x0: 1009, x1: 1021, z0: -394, z1: -350, height: 5, variant: 'plain', palette: 'lab' },
  { x0: 1009, x1: 1021, z0: -314, z1: -270, height: 5, variant: 'plain', palette: 'lab' },
  { x0: 1274, x1: 1286, z0: -394, z1: -350, height: 5, variant: 'plain', palette: 'lab' },
];
// Kuluçka/sergi binası: geniş alçak taban üstünde kenara yaslı blok.
const HUB: Building = { x0: 1112, x1: 1188, z0: -190, z1: -135, height: 20, variant: 'podiumA', palette: 'civic' };
const CAFE: Building = { x0: 1250, x1: 1290, z0: -125, z1: -104, height: 5, variant: 'plain', palette: 'lab' };
const CLUB: Building = { x0: 1400, x1: 1450, z0: -385, z1: -362, height: 6, variant: 'penthouse', palette: 'civic' };
const BUILDINGS: Building[] = [HALL_A, HALL_B, DATA_CENTER, ...LAB_WEST, ...LAB_EAST, ...LINKS, HUB, CAFE, CLUB];

// ---- kuzey: servis yolu, avlu, yükleme rampaları, veri merkezinin jeneratörleri
const SERVICE_LANE: Box = { x0: LOT.x0, x1: 1485, z0: -474, z1: -462 };
const SERVICE_YARD: Box = { x0: 1091, x1: 1209, z0: -548, z1: -474 };
const DOCKS: Box[] = [
  { x0: HALL_A.x1, x1: HALL_A.x1 + 5, z0: -535, z1: -490 },
  { x0: HALL_B.x0 - 5, x1: HALL_B.x0, z0: -535, z1: -490 },
];
const GENERATORS: Box = { x0: 1398, x1: 1482, z0: -558, z1: -548 };

// ---- orta: kampüs çimi, yansıma havuzu, yollar
const AXIS_GREEN: Box = { x0: 1100, x1: 1200, z0: -462, z1: -190 };
const AXIS_X = 1150;
const AXIS_PATHS: Box[] = [
  { x0: 1104, x1: 1108, z0: -462, z1: -190 },
  { x0: 1192, x1: 1196, z0: -462, z1: -190 },
];
const POND: Box = { x0: 1138, x1: 1162, z0: -420, z1: -240 };
const POND_RIM = 1.2;
const POND_WALK: Box = { x0: 1132, x1: 1168, z0: -426, z1: -234 };
// Blokları eksene bağlayan yollar ve batıdaki boyuna yol.
const CROSS_WALKS: Box[] = [
  { x0: 1090, x1: 1104, z0: -414, z1: -410 },
  { x0: 1090, x1: 1104, z0: -334, z1: -330 },
  { x0: 1090, x1: 1104, z0: -254, z1: -250 },
  { x0: 1196, x1: 1210, z0: -414, z1: -410 },
  { x0: 1196, x1: 1210, z0: -334, z1: -330 },
  { x0: 1108, x1: 1132, z0: -332.5, z1: -331.5 },
  { x0: 1168, x1: 1192, z0: -332.5, z1: -331.5 },
];
const WEST_PATH: Box = { x0: 918, x1: 922, z0: SERVICE_LANE.z1, z1: -206 };
const BEDS: Box[] = [
  { x0: 1114, x1: 1136, z0: -226, z1: -202 },
  { x0: 1164, x1: 1186, z0: -226, z1: -202 },
  { x0: 1114, x1: 1136, z0: -456, z1: -436 },
  { x0: 1164, x1: 1186, z0: -456, z1: -436 },
];

// ---- güney: giriş meydanı, kuluçka binası, kafe bahçesi
const PLAZA: Box = { x0: 1090, x1: 1210, z0: -130, z1: LOT.z1 };
const HUB_WALKS: Box[] = [
  { x0: 1096, x1: 1108, z0: -190, z1: -130 },
  { x0: 1192, x1: 1204, z0: -190, z1: -130 },
];
const HUB_CANOPY: Box = { x0: 1128, x1: 1172, z0: -135, z1: -126 };
const BUS_STOP: Box = { x0: 1214, x1: 1228, z0: LOT.z1 - 5.5, z1: LOT.z1 - 2.5 };
const CAFE_TERRACE: Box = { x0: 1244, x1: 1296, z0: -131, z1: -94 };
const SOUTH_WALK: Box = { x0: PLAZA.x1, x1: 1350, z0: -92, z1: -88 };
const GARDEN_BEDS: Box[] = [
  { x0: 1220, x1: 1238, z0: -142, z1: -130 },
  { x0: 1306, x1: 1336, z0: -142, z1: -130 },
];

// ---- otoparklar (park yerleri 2.8 m, sıralar 16 m aralıkla; ağaç adaları sıradan sıraya kayarak)
interface Lot {
  area: Box;
  x0: number;
  bays: number;
  z0: number;
  rows: number;
  /** Yaya yolunun ilk sütunu (iki sütun genişliğinde). */
  walk: number;
}
const BAY = 2.8;
const ROW_STEP = 16;
const ROW_HALF = 2.9;
const ISLAND_PERIOD = 14;
const ISLAND_START = 6;
// Adadaki ağacın boy çarpanı: tepesi yandaki araçlara taşmaz (hastanedeki gibi).
const ISLAND_TREE = 0.4;
const LOTS: Lot[] = [
  { area: { x0: 908, x1: 1088, z0: -206, z1: -94 }, x0: 911, bays: 62, z0: -199, rows: 7, walk: 30 },
  { area: { x0: 1212, x1: 1350, z0: -262, z1: -152 }, x0: 1214, bays: 47, z0: -255, rows: 7, walk: 22 },
];
const lotWalk = (lot: Lot): Box => ({
  x0: lot.x0 + lot.walk * BAY,
  x1: lot.x0 + (lot.walk + 2) * BAY,
  z0: lot.area.z0,
  z1: lot.area.z1,
});
// Batı otoparkına batı sokağından giriş (iki sıranın arasındaki koridora), güney sokağına çıkış; doğu otoparkına doğu yolu.
const WEST_ENTRY: Box = { x0: LOT.x0, x1: 908, z0: -147, z1: -139 };
const SOUTH_EXIT: Box = { x0: 1060, x1: 1072, z0: -94, z1: LOT.z1 };
const EAST_LANE: Box = { x0: 1350, x1: 1362, z0: -262, z1: LOT.z1 };

// ---- doğu: spor sahası (modelde), tenis ve basketbol
const FIELD: Box = { x0: 1370, x1: 1480, z0: -295, z1: -85 };
const PITCH: Box = { x0: 1378, x1: 1472, z0: -287, z1: -93 };
const COURT_PAD: Box = { x0: 1384, x1: 1486, z0: -458, z1: -410 };
const TENNIS: [number, number][] = [
  [1399, -434],
  [1423, -434],
];
const BASKET = { x: 1461, z: -434 };
const TENNIS_FENCE: Box = { x0: 1386, x1: 1436, z0: -456, z1: -412 };

// Yön totemleri: girişlerde.
const TOTEMS: [number, number][] = [
  [WEST_ENTRY.x1 + 4, WEST_ENTRY.z0 - 4],
  [EAST_LANE.x0 - 3, LOT.z1 - 8],
  [PLAZA.x0 + 6, LOT.z1 - 6],
  [LOT.x0 + 6, SERVICE_LANE.z1 + 4],
];

const f = (value: number) => value.toFixed(2);
const v2 = (x: number, z: number) => `vec2(${f(x)}, ${f(z)})`;
const box = (b: Box) => `${v2((b.x0 + b.x1) / 2, (b.z0 + b.z1) / 2)}, ${v2((b.x1 - b.x0) / 2, (b.z1 - b.z0) / 2)}`;
const inBox = (b: Box, x: number, z: number, pad = 0) => x > b.x0 - pad && x < b.x1 + pad && z > b.z0 - pad && z < b.z1 + pad;
const minAll = (terms: string[]) => terms.reduce((a, b) => `min(${a}, ${b})`);

/** Otopark sırası ve sütunundaki park yeri ağaç adası mı (adalar bir sıra atlayarak, yaya yolu hariç). */
const islandBay = (lot: Lot, row: number, col: number) => {
  const m = col % ISLAND_PERIOD;
  const group = Math.floor(col / ISLAND_PERIOD);
  return (m === ISLAND_START || m === ISLAND_START + 1) && (row + group) % 2 === 0 && col !== lot.walk && col !== lot.walk + 1;
};

/** Teknopark planının mesafe fonksiyonları (GLSL, global kapsamda). */
export const TECHNOPARK_GLSL = `
// Köşeleri r yarıçapla yuvarlatılmış kutuya işaretli uzaklık (içeride negatif).
float tpBox(vec2 p, vec2 c, vec2 h, float r){ vec2 q = abs(p - c) - h + r; return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r; }
float tpIn(float d, float aa){ return 1.0 - smoothstep(-aa, aa, d); }
// Eşit aralıklı çizgiler (metre): çizgi seçilemeyecek kadar uzaksa ortalama yoğunluğuna söner.
float tpLines(float v, float period, float width, float aa){
  float d = abs(fract(v / period + 0.5) - 0.5) * period;
  float line = 1.0 - smoothstep(width * 0.5 - aa, width * 0.5 + aa, d);
  return mix(width / period, line, 1.0 - smoothstep(width * 0.6, width * 1.5, aa));
}
// Boya bandı: d = 0 eğrisi boyunca w genişliğinde, piksel altına inince ortalama yoğunluğa söner.
float tpStroke(float d, float w, float aa){ return (1.0 - smoothstep(w * 0.5 - aa, w * 0.5 + aa, abs(d))) * min(1.0, w / aa); }
// Kutu çerçevesi (çizgi kutunun kenarında).
float tpFrame(vec2 p, vec2 c, vec2 h, float w, float aa){ return tpStroke(tpBox(p, c, h, 0.0), w, aa); }
// Tenis kortu (uzun kenar z boyunca): çiftler ve tekler çizgileri, servis çizgileri, orta servis çizgisi.
float tpTennis(vec2 p, vec2 c, float aa){
  vec2 q = p - c;
  float m = tpFrame(p, c, vec2(5.485, 11.885), 0.1, aa);
  float inLen = step(abs(q.y), 11.885);
  m = max(m, tpStroke(abs(q.x) - 4.115, 0.1, aa) * inLen);
  m = max(m, tpStroke(abs(q.y) - 6.4, 0.1, aa) * step(abs(q.x), 4.115));
  m = max(m, tpStroke(q.x, 0.1, aa) * step(abs(q.y), 6.4));
  return m;
}
// Basketbol sahası (uzun kenar x boyunca): çerçeve, orta çizgi ve yuvarlak, boyalı alanlar, üç sayı yayları.
float tpBasket(vec2 p, vec2 c, float aa){
  vec2 q = p - c;
  float m = tpFrame(p, c, vec2(14.0, 7.5), 0.1, aa);
  m = max(m, tpStroke(q.x, 0.1, aa) * step(abs(q.y), 7.5));
  m = max(m, tpStroke(length(q) - 1.8, 0.1, aa));
  m = max(m, tpFrame(vec2(abs(q.x), q.y), vec2(14.0 - 2.9, 0.0), vec2(2.9, 2.45), 0.1, aa));
  vec2 hoop = vec2(abs(q.x) - (14.0 - 1.575), q.y);
  m = max(m, tpStroke(length(hoop) - 6.75, 0.1, aa) * step(hoop.x, 0.0) * step(abs(q.y), 6.6));
  m = max(m, tpStroke(abs(q.y) - 6.6, 0.1, aa) * step(0.0, hoop.x) * step(abs(q.x), 14.0));
  return m;
}
`;

/** Otoparkın park çizgileri, ağaç adaları ve yaya yolu (GLSL bloğu; c, stone, asphalt, paint, n2, aa, fine tanımlı). */
function lotGlsl(lot: Lot) {
  const walk = lotWalk(lot);
  const a = lot.area;
  return `{
      float inPark = step(${f(a.z0)}, p.y) * step(p.y, ${f(a.z1)}) * step(${f(lot.x0)}, p.x) * step(p.x, ${f(lot.x0 + BAY * lot.bays)});
      float rz = p.y - ${f(lot.z0)};
      float rowIndex = clamp(floor(rz / ${f(ROW_STEP)} + 0.5), 0.0, ${f(lot.rows - 1)});
      float rowZ = ${f(lot.z0)} + rowIndex * ${f(ROW_STEP)};
      float rowD = abs(p.y - rowZ);
      float col = floor((p.x - ${f(lot.x0)}) / ${f(BAY)});
      float cm = mod(col, ${f(ISLAND_PERIOD)});
      float walkCol = step(${f(lot.walk - 0.5)}, col) * step(col, ${f(lot.walk + 1.5)});
      float isl = step(${f(ISLAND_START - 0.5)}, cm) * step(cm, ${f(ISLAND_START + 1.5)}) * (1.0 - walkCol)
        * step(mod(rowIndex + floor(col / ${f(ISLAND_PERIOD)}), 2.0), 0.5);
      float bays = tpLines(p.x - ${f(lot.x0)}, ${f(BAY)}, 0.15, aa) * step(rowD, ${f(ROW_HALF)});
      bays = max(bays, tpStroke(rowD - ${f(ROW_HALF)}, 0.15, aa));
      c = mix(c, paint * 0.95, bays * inPark * (1.0 - walkCol) * fine);
      float islandX = ${f(lot.x0)} + (col - cm + ${f(ISLAND_START + 1)}) * ${f(BAY)};
      float islandD = tpBox(p, vec2(islandX, rowZ), vec2(2.7, ${f(ROW_HALF + 0.2)}), 1.0);
      c = mix(c, vec3(0.1, 0.16, 0.055) * (0.85 + 0.3 * n2), isl * tpIn(islandD, aa) * inPark);
      c = mix(c, stone, isl * tpIn(abs(islandD) - 0.25, aa) * inPark);
      float walk = tpBox(p, ${box(walk)}, 0.0);
      float zebra = step(0.5, fract(p.y / 1.2));
      float aisle = step(${f(ROW_HALF + 0.3)}, rowD);
      c = mix(c, mix(stone, mix(asphalt, paint, zebra * fine + 0.35 * (1.0 - fine)), aisle), tpIn(walk, aa));
    }`;
}

// Bina çevresinde döşeme şeridi.
const buildingApron = minAll(BUILDINGS.map((b) => `tpBox(p, ${box(b)}, 0.0)`));

/** Teknopark zemini: Technopark_Ground'un rengi tamamen dünya konumundan çizilir (köşe renkleri yok sayılır). */
export const TECHNOPARK_FRAGMENT = `#include <color_fragment>
  {
    vec2 p = vWPos.xz;
    float aa = max(fwidth(p.x), fwidth(p.y)) * 0.8 + 0.05;
    float fine = 1.0 - smoothstep(0.8, 2.5, aa);
    float n1 = fbm(p * 0.02);
    float n2 = fbm(p * 0.09 + 41.0);
    float grain = 0.94 + 0.12 * h12(floor(p * 3.0)) * fine;
    vec3 rimColor = vec3(0.55, 0.53, 0.5);
    vec3 paint = vec3(0.72, 0.7, 0.64);
    vec3 yellow = vec3(0.64, 0.5, 0.18);
    float mow = 1.0 - smoothstep(2.0, 5.0, aa);

    // Çim: biçme şeritleri ve geniş ton farkları.
    vec3 c = vec3(0.12, 0.18, 0.065) * (0.82 + 0.36 * n1);
    c *= 1.0 + (step(0.5, fract((p.y * 0.2 + p.x) / 9.0)) - 0.5) * 0.12 * mow;

    float joint = max(tpLines(p.x, 1.2, 0.08, aa), tpLines(p.y, 1.2, 0.08, aa));
    vec3 stone = vec3(0.56, 0.53, 0.48) * grain * (0.94 + 0.12 * n2) * (1.0 - 0.1 * joint);
    vec3 granite = vec3(0.3, 0.29, 0.28) * grain;
    float slab = max(tpLines(p.x, 5.0, 0.12, aa), tpLines(p.y, 5.0, 0.12, aa));
    vec3 concrete = vec3(0.47, 0.46, 0.43) * grain * (0.92 + 0.16 * n2) * (1.0 - 0.12 * slab);
    vec3 asphalt = vec3(0.2, 0.195, 0.19) * (0.88 + 0.24 * n2);
    vec3 hedge = vec3(0.055, 0.095, 0.035) * (0.7 + 0.6 * fbm(p * 0.45));

    // Plaka kenarında çit bitkisi (yollar sonra üstüne çizilir).
    float edge = min(min(p.x - ${f(LOT.x0)}, ${f(LOT.x1)} - p.x), min(p.y - ${f(LOT.z0)}, ${f(LOT.z1)} - p.y));
    c = mix(c, hedge, tpIn(edge - 2.2 + (n2 - 0.5) * 0.6, aa));

    // Taş döşemeler: meydan, bina çevresi, eksen ve bahçe yolları, havuz çevresi, kafe terası.
    float paved = ${minAll([
      `tpBox(p, ${box(PLAZA)}, 1.0)`,
      ...HUB_WALKS.map((w) => `tpBox(p, ${box(w)}, 0.0)`),
      ...AXIS_PATHS.map((w) => `tpBox(p, ${box(w)}, 0.0)`),
      ...CROSS_WALKS.map((w) => `tpBox(p, ${box(w)}, 0.0)`),
      `tpBox(p, ${box(WEST_PATH)}, 0.0)`,
      `tpBox(p, ${box(POND_WALK)}, 2.0)`,
      `tpBox(p, ${box(CAFE_TERRACE)}, 2.0)`,
      `tpBox(p, ${box(SOUTH_WALK)}, 0.0)`,
      `tpBox(p, ${box(BUS_STOP)}, 0.0) - 1.5`,
      `${buildingApron} - 2.4`,
    ])};
    c = mix(c, stone, tpIn(paved, aa));
    c = mix(c, rimColor, tpIn(abs(paved) - 0.2, aa) * fine * 0.6);
    // Meydanda eksene hizalı 6 m'lik granit ızgara, eksende granit bant.
    {
      float plaza = tpBox(p, ${box(PLAZA)}, 1.0);
      float grid = max(tpLines(p.x - ${f(AXIS_X)}, 6.0, 0.3, aa), tpLines(p.y - ${f(PLAZA.z0)}, 6.0, 0.3, aa));
      c = mix(c, granite, grid * tpIn(plaza, aa) * 0.5);
      c = mix(c, granite, tpIn(abs(p.x - ${f(AXIS_X)}) - 1.2, aa) * tpIn(plaza, aa));
    }

    // Beton: servis avlusu (yükleme rampalarının önünde sarı çizgi), jeneratör sahanlığı, kort zemini.
    {
      float yard = min(tpBox(p, ${box(SERVICE_YARD)}, 1.0), tpBox(p, ${box(GENERATORS)}, 0.5) - 1.5);
      c = mix(c, concrete, tpIn(yard, aa));
      c = mix(c, rimColor, tpIn(abs(yard) - 0.25, aa) * fine);
      ${DOCKS.map((d) => `c = mix(c, yellow, tpStroke(abs(p.x - ${f((d.x0 + d.x1) / 2)}) - ${f((d.x1 - d.x0) / 2 + 4)}, 0.3, aa) * step(${f(d.z0)}, p.y) * step(p.y, ${f(d.z1)}) * tpIn(yard, aa) * fine);`).join('\n      ')}
    }

    // Asfalt: servis yolu, otoparklar, girişler, doğu yolu.
    float road = ${minAll([
      `tpBox(p, ${box(SERVICE_LANE)}, 0.0)`,
      ...LOTS.map((l) => `tpBox(p, ${box(l.area)}, 2.0)`),
      `tpBox(p, ${box(WEST_ENTRY)}, 0.0)`,
      `tpBox(p, ${box(SOUTH_EXIT)}, 0.0)`,
      `tpBox(p, ${box(EAST_LANE)}, 0.0)`,
    ])};
    c = mix(c, asphalt, tpIn(road, aa));
    c = mix(c, rimColor, tpIn(abs(road) - 0.25, aa) * fine * step(${f(LOT.x0 + 0.5)}, p.x) * step(p.x, ${f(LOT.x1 - 0.5)}) * step(${f(LOT.z0 + 0.5)}, p.y) * step(p.y, ${f(LOT.z1 - 0.5)}));
    // Servis yolunun orta kesik çizgisi, çıkışlarda dur çizgileri.
    c = mix(c, paint, tpStroke(p.y - ${f((SERVICE_LANE.z0 + SERVICE_LANE.z1) / 2)}, 0.15, aa) * step(0.5, fract(p.x / 6.0)) * step(${f(LOT.x0 + 4)}, p.x) * step(p.x, ${f(SERVICE_LANE.x1 - 2)}) * fine);
    c = mix(c, paint, tpStroke(p.x - ${f(LOT.x0 + 3)}, 0.4, aa) * step(${f(SERVICE_LANE.z0)}, p.y) * step(p.y, ${f(SERVICE_LANE.z1)}) * fine);
    c = mix(c, paint, tpStroke(p.x - ${f(LOT.x0 + 3)}, 0.4, aa) * step(${f(WEST_ENTRY.z0)}, p.y) * step(p.y, ${f(WEST_ENTRY.z1)}) * fine);
    c = mix(c, paint, tpStroke(p.y - ${f(LOT.z1 - 3)}, 0.4, aa) * (step(${f(SOUTH_EXIT.x0)}, p.x) * step(p.x, ${f(SOUTH_EXIT.x1)}) + step(${f(EAST_LANE.x0)}, p.x) * step(p.x, ${f(EAST_LANE.x1)})) * fine);

    ${LOTS.map(lotGlsl).join('\n    ')}

    // Yaya geçitleri: eksen yolları servis yolunda, güney yolu doğu yolunda.
    {
      float zx = step(0.5, fract(p.x / 1.2));
      float zz = step(0.5, fract(p.y / 1.2));
      float crossings = 0.0;
      ${AXIS_PATHS.map((w) => `crossings = max(crossings, tpIn(tpBox(p, ${box({ x0: w.x0, x1: w.x1, z0: SERVICE_LANE.z0, z1: SERVICE_LANE.z1 })}, 0.0), aa) * zz);`).join('\n      ')}
      crossings = max(crossings, tpIn(tpBox(p, ${box({ x0: WEST_PATH.x0, x1: WEST_PATH.x1, z0: SERVICE_LANE.z0, z1: SERVICE_LANE.z1 })}, 0.0), aa) * zz);
      crossings = max(crossings, tpIn(tpBox(p, ${box({ x0: EAST_LANE.x0, x1: EAST_LANE.x1, z0: SOUTH_WALK.z0, z1: SOUTH_WALK.z1 })}, 0.0), aa) * zx);
      c = mix(c, paint, crossings * mix(0.35, 1.0, fine));
    }

    // Kortlar: koyu yeşil kenar payı, tenis kortları deniz yeşili, basketbol kiremit, beyaz çizgiler.
    {
      float pad = tpBox(p, ${box(COURT_PAD)}, 1.0);
      c = mix(c, vec3(0.13, 0.22, 0.18) * grain, tpIn(pad, aa));
      c = mix(c, rimColor, tpIn(abs(pad) - 0.25, aa) * fine);
      float lines = 0.0;
      ${TENNIS.map(([x, z]) => `c = mix(c, vec3(0.2, 0.34, 0.31) * grain, tpIn(tpBox(p, ${v2(x, z)}, vec2(8.0, 17.5), 0.0), aa));\n      lines = max(lines, tpTennis(p, ${v2(x, z)}, aa));`).join('\n      ')}
      c = mix(c, vec3(0.46, 0.23, 0.15) * grain, tpIn(tpBox(p, ${v2(BASKET.x, BASKET.z)}, vec2(16.0, 9.5), 0.0), aa));
      lines = max(lines, tpBasket(p, ${v2(BASKET.x, BASKET.z)}, aa));
      c = mix(c, vec3(0.86, 0.85, 0.8), lines * mix(0.4, 1.0, fine));
    }

    // Çiçek tarhları (taş bordür) ve yansıma havuzunun taş bordürü (su yüzeyi Technopark_Pond).
    {
      float beds = ${minAll([...BEDS, ...GARDEN_BEDS].map((b) => `tpBox(p, ${box(b)}, 3.0)`))};
      float clump = h12(floor(p * 0.9));
      vec3 bloom = clump < 0.3 ? vec3(0.55, 0.3, 0.38) : clump < 0.55 ? vec3(0.62, 0.55, 0.26) : clump < 0.75 ? vec3(0.4, 0.34, 0.52) : vec3(0.68, 0.64, 0.58);
      vec3 bedColor = mix(hedge * 1.3, bloom * (0.85 + 0.2 * n2), mix(0.55, smoothstep(0.35, 0.6, fbm(p * 0.7)), fine));
      c = mix(c, bedColor, tpIn(beds, aa));
      c = mix(c, stone, tpIn(abs(beds) - 0.3, aa));
      float pond = tpBox(p, ${box(POND)}, 1.0);
      c = mix(c, vec3(0.62, 0.59, 0.54) * grain, tpIn(abs(pond - ${f(POND_RIM / 2)}) - ${f(POND_RIM / 2)}, aa));
      c = mix(c, vec3(0.16, 0.24, 0.25), tpIn(pond, aa));
    }

    diffuseColor.rgb = c;
  }`;

// ------------------------------------------------------------------ binalar

// Duvar ve çatı paleti: hastane ve bilim merkeziyle aynı değerler (aynı cephe programı, ek shader derlenmez). Ar-Ge
// blokları, geçitler ve kafe kırık beyaz duvar ve yeşil çatı, salonlar, veri merkezi, kuluçka binası ve kulüp krem sıva.
const PALETTES: Record<Palette, string> = { lab: 'vec2(0.1, 0.9)', civic: 'vec2(0.4, 0.7)' };

function blockMatrix(b: Building) {
  const hy = b.height / 2;
  return new THREE.Matrix4().compose(
    new THREE.Vector3((b.x0 + b.x1) / 2, BASE_Y + hy, (b.z0 + b.z1) / 2),
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
    mesh.name = `Technopark_Mass_${key}`;
    list.forEach((b, i) => mesh.setMatrixAt(i, blockMatrix(b)));
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
  white: '#e6e1d6',
  wood: '#a88a68',
  red: '#a8453a',
  slate: '#5d7480',
  container: '#7d8a8c',
  rust: '#9a6a4c',
  glass: '#3c4650',
  solar: '#27313d',
  fence: '#3f4a44',
  canvas: '#ddd6c6',
};

function bench(props: PropBuilder, x: number, z: number, alongX = true) {
  const y = GROUND_Y;
  const [hx, hz] = alongX ? [0.9, 0.3] : [0.3, 0.9];
  props.box(x - hx, x + hx, y + 0.3, y + 0.45, z - hz, z + hz, TONE.wood);
  props.box(x - hx + 0.15, x + hx - 0.15, y, y + 0.3, z - hz + 0.1, z + hz - 0.1, TONE.steel);
}

/** Yön totemi: ince beyaz pano, üstte arduvaz bandı (yazısız). */
function totem(props: PropBuilder, x: number, z: number) {
  const y = GROUND_Y;
  props.box(x - 0.8, x + 0.8, y, y + 3.4, z - 0.25, z + 0.25, TONE.white);
  props.box(x - 0.82, x + 0.82, y + 2.7, y + 3.4, z - 0.27, z + 0.27, TONE.slate);
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

/** Dikdörtgen çit: dört kenar ince pano (tel çit yukarıdan koyu çizgi gibi okunur), kenarlarda direkler. */
function fence(props: PropBuilder, b: Box, height: number) {
  const y = GROUND_Y;
  const t = 0.06;
  props.box(b.x0, b.x1, y, y + height, b.z0, b.z0 + t, TONE.fence);
  props.box(b.x0, b.x1, y, y + height, b.z1 - t, b.z1, TONE.fence);
  props.box(b.x0, b.x0 + t, y, y + height, b.z0, b.z1, TONE.fence);
  props.box(b.x1 - t, b.x1, y, y + height, b.z0, b.z1, TONE.fence);
}

/** Saha çizgisi (spor sahasının yeşil zemininin hemen üstünde ince beyaz şerit). */
function pitchLine(props: PropBuilder, x0: number, x1: number, z0: number, z1: number) {
  props.box(x0, x1, 0.86, 0.9, z0, z1, TONE.white);
}

function propsGeometry() {
  const props = new PropBuilder();
  const y = GROUND_Y;

  // Prototip salonlarının çatısında güneş paneli sıraları (20 m'lik dizi parçaları, aralarında bakım yolu).
  for (const hall of [HALL_A, HALL_B]) {
    const ry = BASE_Y + hall.height;
    for (let z = hall.z0 + 4; z < hall.z1 - 5; z += 4.5) {
      for (let x = hall.x0 + 4; x + 18 <= hall.x1 - 4; x += 20.5) props.box(x, x + 18, ry, ry + 0.45, z, z + 2.4, TONE.solar);
    }
  }
  // Veri merkezi: çatıda soğutma üniteleri (fanlı), kuzeyinde jeneratörler ve egzoz bacaları.
  {
    const ry = BASE_Y + DATA_CENTER.height;
    for (let x = DATA_CENTER.x0 + 8; x < DATA_CENTER.x1 - 8; x += 12) {
      for (let z = DATA_CENTER.z0 + 9; z < DATA_CENTER.z1 - 8; z += 12) {
        props.box(x - 4, x + 4, ry, ry + 2.2, z - 3, z + 3, TONE.concrete);
        props.cylinder(x - 2, ry + 2.2, z, 1.4, 0.3, 'y', TONE.dark, 10);
        props.cylinder(x + 2, ry + 2.2, z, 1.4, 0.3, 'y', TONE.dark, 10);
      }
    }
    for (let x = GENERATORS.x0 + 2; x + 10 <= GENERATORS.x1; x += 14) {
      props.box(x, x + 10, y, y + 3.0, GENERATORS.z0 + 2, GENERATORS.z1 - 2, TONE.container);
      props.cylinder(x + 8, y + 3.0, GENERATORS.z0 + 5, 0.35, 2.4, 'y', TONE.steel, 8);
    }
  }
  // Yükleme rampaları ve saçakları; avluda konteynerler.
  for (const d of DOCKS) {
    props.box(d.x0, d.x1, y, y + 1.2, d.z0, d.z1, TONE.concrete);
    const out = d.x0 === HALL_A.x1 ? 1 : -1;
    const [cx0, cx1] = out > 0 ? [d.x0, d.x1 + 3] : [d.x0 - 3, d.x1];
    props.box(cx0, cx1, y + 5.2, y + 5.5, d.z0 - 2, d.z1 + 2, TONE.dark);
  }
  for (const [x, z, color] of [
    [1120, -540, TONE.container],
    [1120, -533, TONE.rust],
    [1150, -540, TONE.slate],
    [1176, -540, TONE.container],
  ] as const) {
    props.box(x, x + 12, y, y + 2.6, z, z + 2.5, color);
  }

  // Kuluçka binasının giriş saçağı: cam, ince kolonlar.
  const hc = HUB_CANOPY;
  props.box(hc.x0, hc.x1, y + 5.0, y + 5.25, hc.z0, hc.z1, TONE.glass);
  props.box(hc.x0, hc.x1, y + 5.25, y + 5.55, hc.z1 - 0.3, hc.z1, TONE.white);
  for (let x = hc.x0 + 1; x <= hc.x1 - 0.9; x += (hc.x1 - hc.x0 - 2) / 4) props.box(x - 0.15, x + 0.15, y, y + 5.0, hc.z1 - 0.6, hc.z1 - 0.3, TONE.steel);

  // Kafe terası: şemsiyeler (direk ve piramit tente).
  for (const x of [1256, 1270, 1284]) {
    for (const z of [-99, -128.5]) {
      props.box(x - 0.08, x + 0.08, y, y + 2.4, z - 0.08, z + 0.08, TONE.steel);
      props.pyramid(x - 1.6, x + 1.6, y + 2.3, y + 3.0, z - 1.6, z + 1.6, TONE.canvas);
    }
  }

  // Otobüs durağı: arka cam, yan direkler, çatı, bank.
  const bs = BUS_STOP;
  props.box(bs.x0, bs.x1, y, y + 2.6, bs.z0, bs.z0 + 0.1, TONE.glass);
  for (const x of [bs.x0 + 0.2, bs.x1 - 0.2]) props.box(x - 0.08, x + 0.08, y, y + 2.6, bs.z1 - 0.3, bs.z1 - 0.14, TONE.steel);
  props.box(bs.x0 - 0.3, bs.x1 + 0.3, y + 2.6, y + 2.8, bs.z0 - 0.3, bs.z1 + 0.2, TONE.dark);
  props.box(bs.x0 + 2, bs.x1 - 2, y + 0.4, y + 0.5, bs.z0 + 0.1, bs.z0 + 0.6, TONE.wood);

  // Banklar: eksen yolları, havuz çevresi, meydan, kafe bahçesi, sahanın doğu kenarı.
  for (let z = -440; z < -200; z += 40) {
    bench(props, AXIS_PATHS[0].x1 + 1.2, z, false);
    bench(props, AXIS_PATHS[1].x0 - 1.2, z, false);
  }
  for (let z = -400; z <= -260; z += 35) {
    bench(props, POND_WALK.x0 + 1.2, z, false);
    bench(props, POND_WALK.x1 - 1.2, z, false);
  }
  for (const x of [1098, 1118, 1182, 1202]) bench(props, x, PLAZA.z0 + 4);
  for (const x of [1226, 1236, 1312, 1322]) bench(props, x, SOUTH_WALK.z0 - 1.4);
  for (let z = -270; z <= -110; z += 40) bench(props, FIELD.x1 + 4, z, false);

  for (const [x, z] of TOTEMS) totem(props, x, z);

  // Girişler: batı otoparkı ve servis yolu bariyerli.
  barrier(props, WEST_ENTRY.x1 - 1, WEST_ENTRY.z0 + 0.3, WEST_ENTRY.z1 - WEST_ENTRY.z0 - 0.6, false);
  barrier(props, LOT.x0 + 8, SERVICE_LANE.z0 + 0.3, SERVICE_LANE.z1 - SERVICE_LANE.z0 - 0.6, false);

  // Tenis: çit, fileler ve direkleri. Basketbol: iki pota.
  fence(props, TENNIS_FENCE, 3);
  for (const [x, z] of TENNIS) {
    props.box(x - 6.4, x + 6.4, y, y + 0.95, z - 0.03, z + 0.03, TONE.dark);
    for (const px of [x - 6.4, x + 6.4]) props.box(px - 0.06, px + 0.06, y, y + 1.07, z - 0.06, z + 0.06, TONE.steel);
  }
  for (const side of [-1, 1]) {
    const px = BASKET.x + side * 15.2;
    props.box(px - 0.12, px + 0.12, y, y + 3.4, BASKET.z - 0.12, BASKET.z + 0.12, TONE.steel);
    props.box(px - side * 1.2 - 0.04, px - side * 1.2 + 0.04, y + 2.9, y + 3.95, BASKET.z - 0.9, BASKET.z + 0.9, TONE.white);
    props.box(Math.min(px, px - side * 1.2), Math.max(px, px - side * 1.2), y + 3.3, y + 3.4, BASKET.z - 0.08, BASKET.z + 0.08, TONE.steel);
  }

  // Spor sahası: çizgiler (kenar, orta, ceza alanları) ve kaleler (sahanın uzun kenarı z boyunca).
  {
    const w = 0.12;
    const s = { x0: PITCH.x0 + 4, x1: PITCH.x1 - 4, z0: PITCH.z0 + 5, z1: PITCH.z1 - 5 };
    const cx = (s.x0 + s.x1) / 2;
    const cz = (s.z0 + s.z1) / 2;
    pitchLine(props, s.x0, s.x1, s.z0, s.z0 + w);
    pitchLine(props, s.x0, s.x1, s.z1 - w, s.z1);
    pitchLine(props, s.x0, s.x0 + w, s.z0, s.z1);
    pitchLine(props, s.x1 - w, s.x1, s.z0, s.z1);
    pitchLine(props, s.x0, s.x1, cz - w / 2, cz + w / 2);
    for (const [zEdge, dir] of [[s.z0, 1], [s.z1, -1]] as const) {
      const depth = zEdge + dir * 16.5;
      pitchLine(props, cx - 20.15, cx + 20.15, Math.min(depth, depth + dir * w), Math.max(depth, depth + dir * w));
      for (const x of [cx - 20.15, cx + 20.15 - w]) pitchLine(props, x, x + w, Math.min(zEdge, depth), Math.max(zEdge, depth));
      const box6 = zEdge + dir * 5.5;
      pitchLine(props, cx - 9.16, cx + 9.16, Math.min(box6, box6 + dir * w), Math.max(box6, box6 + dir * w));
      for (const x of [cx - 9.16, cx + 9.16 - w]) pitchLine(props, x, x + w, Math.min(zEdge, box6), Math.max(zEdge, box6));
      // Kale: iki direk ve üst direk, arkada koyu ağ çerçevesi.
      const back = zEdge - dir * 2;
      for (const x of [cx - 3.66, cx + 3.66]) props.box(x - 0.06, x + 0.06, 0.86, 0.86 + 2.44, zEdge - 0.06, zEdge + 0.06, TONE.white);
      props.box(cx - 3.72, cx + 3.72, 0.86 + 2.38, 0.86 + 2.5, zEdge - 0.06, zEdge + 0.06, TONE.white);
      props.box(cx - 3.66, cx + 3.66, 0.86, 0.86 + 0.06, Math.min(zEdge, back), Math.max(zEdge, back), TONE.dark);
    }
    // Orta yuvarlak.
    props.sector(cx, cz, 9.15 - w / 2, 9.15 + w / 2, 0, Math.PI * 2, 0.86, 0.9, TONE.white, 24);
  }
  return props.build();
}

// ------------------------------------------------------------------ araçlar

/** Otoparklardaki park etmiş araçlar: ağaç adaları ve yaya yolu boş, park yerlerinin yaklaşık üçte ikisi dolu. */
function vehicleMeshes(cityRoot: THREE.Object3D) {
  const colors = ['White', 'Silver', 'Graphite', 'Blue'];
  const spots: VehicleSpot[][] = colors.map(() => []);
  for (const lot of LOTS) {
    for (let row = 0; row < lot.rows; row++) {
      const z = lot.z0 + row * ROW_STEP;
      for (let col = 0; col < lot.bays; col++) {
        if (islandBay(lot, row, col) || col === lot.walk || col === lot.walk + 1) continue;
        const x = lot.x0 + (col + 0.5) * BAY;
        if (hash2(x, z) > 0.66) continue;
        const pick = hash2(z, x);
        const color = pick < 0.35 ? 0 : pick < 0.65 ? 1 : pick < 0.88 ? 2 : 3;
        spots[color].push([x, z, row % 2 ? -Math.PI / 2 : Math.PI / 2]);
      }
    }
  }
  return colors.map((color, i) => parkedVehicles(cityRoot, `Cars_${color}`, 'Technopark', spots[i])).filter((mesh) => mesh !== null);
}

// ------------------------------------------------------------------ ağaçlar ve lambalar

// Ağaç dikilmeyen yerler: tepe bunların üstüne taşmaz.
const SOLID: Box[] = [
  ...BUILDINGS,
  SERVICE_LANE,
  SERVICE_YARD,
  ...DOCKS,
  GENERATORS,
  ...AXIS_PATHS,
  POND_WALK,
  ...CROSS_WALKS,
  WEST_PATH,
  ...BEDS,
  PLAZA,
  ...HUB_WALKS,
  HUB_CANOPY,
  BUS_STOP,
  CAFE_TERRACE,
  SOUTH_WALK,
  ...GARDEN_BEDS,
  ...LOTS.map((l) => l.area),
  WEST_ENTRY,
  SOUTH_EXIT,
  EAST_LANE,
  FIELD,
  COURT_PAD,
];

/** Tepe yarıçapı `radius` olan ağaç buraya sığar mı: plakanın içinde, yapılardan, yollardan ve lambalardan uzak. */
function treeAllowed(x: number, z: number, radius: number, lamps: number[]) {
  if (!inBox(LOT, x, z, -radius - 1.5)) return false;
  if (SOLID.some((b) => inBox(b, x, z, radius + 0.5))) return false;
  if (TOTEMS.some(([tx, tz]) => Math.abs(x - tx) < radius + 1.2 && Math.abs(z - tz) < radius + 0.8)) return false;
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

  // Otopark adaları: plan gereği, denetimsiz (adanın ortasında küçük ağaç).
  for (const lot of LOTS) {
    for (let row = 0; row < lot.rows; row++) {
      for (let col = 0; col < lot.bays - 1; col++) {
        if (col % ISLAND_PERIOD === ISLAND_START && islandBay(lot, row, col)) plant([lot.x0 + (col + 1) * BAY, lot.z0 + row * ROW_STEP, ISLAND_TREE]);
      }
    }
  }
  // Kampüs çimi: havuzun iki yanında dizi.
  for (let z = AXIS_GREEN.z0 + 8; z < AXIS_GREEN.z1 - 4; z += 10) {
    add(1120 + jitter(z, 1), z, 8, [0.8, 0.62]);
    add(1180 + jitter(z, 2), z + 5, 8, [0.8, 0.62]);
  }
  // Güney kenarı ve servis yolu boyunca sıra.
  for (let x = LOT.x0 + 8; x < LOT.x1 - 4; x += 10) add(x + jitter(x, 3) * 1.5, LOT.z1 - 7, 8, [0.62, 0.5]);
  for (let x = LOT.x0 + 14; x < DATA_CENTER.x0 - 4; x += 12) add(x + jitter(x, 4), SERVICE_LANE.z1 + 6, 9, [0.8, 0.62]);
  // Batı şeridi, avlular, otoparkların çevresi.
  scatter({ x0: LOT.x0 + 3, x1: 937, z0: SERVICE_LANE.z1, z1: -206 }, 60, 8, 710);
  scatter({ x0: 940, x1: 1090, z0: -394, z1: -350 }, 50, 8, 720, [0.8, 0.62]);
  scatter({ x0: 940, x1: 1090, z0: -314, z1: -270 }, 50, 8, 730, [0.8, 0.62]);
  scatter({ x0: 1210, x1: 1350, z0: -394, z1: -350 }, 50, 8, 740, [0.8, 0.62]);
  scatter({ x0: LOT.x0 + 3, x1: 1100, z0: -234, z1: -206 }, 40, 8, 750, [0.8, 0.62]);
  scatter({ x0: 1200, x1: 1352, z0: -314, z1: -262 }, 60, 8, 760);
  scatter({ x0: 1090, x1: 1104, z0: SERVICE_LANE.z1, z1: -190 }, 20, 7, 770, [0.62]);
  scatter({ x0: 1196, x1: 1210, z0: SERVICE_LANE.z1, z1: -262 }, 20, 7, 780, [0.62]);
  scatter({ x0: LOT.x0 + 3, x1: 1090, z0: SERVICE_LANE.z1, z1: -430 }, 30, 8, 790, [0.8, 0.62]);
  scatter({ x0: 1200, x1: 1384, z0: SERVICE_LANE.z1, z1: -430 }, 30, 8, 800, [0.8, 0.62]);
  // Kafe bahçesi, doğu bölgesi (kortlarla saha arası, kulüp çevresi), sahanın doğusu.
  scatter({ x0: 1210, x1: 1350, z0: -152, z1: LOT.z1 }, 80, 8, 810, [0.8, 0.62]);
  scatter({ x0: 1350, x1: LOT.x1, z0: -410, z1: -295 }, 70, 8, 820);
  scatter({ x0: 1362, x1: LOT.x1, z0: -295, z1: LOT.z1 }, 40, 8, 830, [0.62, 0.5]);
  scatter({ x0: 1088, x1: 1112, z0: -190, z1: -130 }, 6, 7, 840, [0.62]);
  scatter({ x0: 1188, x1: 1212, z0: -262, z1: -130 }, 12, 7, 850, [0.62]);
  // Salonların kuzeyi: dar şeritte küçük ağaçlar.
  for (let x = LOT.x0 + 10; x < GENERATORS.x0 - 4; x += 10) add(x + jitter(x, 5), LOT.z0 + 7.5, 8, [0.5]);
  return trees;
}

/** Lambalar: servis yolu, eksen yolları, meydan, otoparklar, doğu yolu, kortlar, batı yolu, kafe bahçesi. */
function technoparkLamps(): number[] {
  const lamps: number[] = [];
  const low = GROUND_Y + 4.5;
  const tall = GROUND_Y + 8;
  for (let x = LOT.x0 + 20; x < SERVICE_LANE.x1; x += 32) lamps.push(x, tall, SERVICE_LANE.z1 + 1.5);
  for (let z = -444; z < -200; z += 40) lamps.push(AXIS_PATHS[0].x0 - 1, low, z, AXIS_PATHS[1].x1 + 1, low, z + 20);
  for (const x of [1096, 1124, 1176, 1204]) lamps.push(x, low, LOT.z1 - 3);
  for (const lot of LOTS) {
    const walk = lotWalk(lot);
    for (let k = 0; k < lot.rows - 1; k += 2) {
      const z = lot.z0 + (k + 0.5) * ROW_STEP;
      lamps.push((walk.x0 + walk.x1) / 2, tall, z, lot.area.x1 - 1, tall, z);
    }
  }
  for (let z = -240; z < -80; z += 40) lamps.push(EAST_LANE.x1 + 2, tall, z);
  lamps.push(COURT_PAD.x0, tall, COURT_PAD.z0, COURT_PAD.x1, tall, COURT_PAD.z0, COURT_PAD.x0, tall, COURT_PAD.z1, COURT_PAD.x1, tall, COURT_PAD.z1);
  for (let z = -440; z < -220; z += 40) lamps.push(WEST_PATH.x1 + 1, low, z);
  lamps.push(1240, low, SOUTH_WALK.z1 + 1.5, 1300, low, SOUTH_WALK.z1 + 1.5);
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

/** Mesh'in `drop` dediği üçgenlerini (ağırlık merkezine göre) siler; mesh boş kalırsa sahneden kaldırılır. */
function dropTriangles(mesh: THREE.Mesh, drop: (x: number, z: number) => boolean) {
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
    if (!drop(x, z)) kept.push(vertex(k), vertex(k + 1), vertex(k + 2));
  }
  if (kept.length === count) return;
  if (!kept.length) {
    mesh.removeFromParent();
    geometry.dispose();
    return;
  }
  geometry.setIndex(kept);
  mesh.geometry = geometry.toNonIndexed();
  geometry.dispose();
}

// Bölgedeki askerî parçalar (eğitim alanlarından spor sahası kalır).
const MILITARY = /^Military_(Buildings|Roofs|Gatehouse|TrainingGrounds|TrainingEquipment)$/;
const FIELD_KEEP: Box = { x0: FIELD.x0 - 2, x1: FIELD.x1 + 2, z0: FIELD.z0 - 2, z1: FIELD.z1 + 2 };
const OWN = /^Technopark_(Ground|Pond|Props|Mass_.+)$/;

/** Ormandan alana taşan ağaçlar (batı kenarındaki dizi) gizlenir: alan plana göre yeniden dikilir. */
function hideForest(cityRoot: THREE.Object3D) {
  const forest = cityRoot.getObjectByName('Greens_Forest');
  if (!(forest instanceof THREE.InstancedMesh)) return;
  const matrix = new THREE.Matrix4();
  const position = new THREE.Vector3();
  const zero = new THREE.Matrix4().makeScale(0, 0, 0);
  let changed = false;
  for (let i = 0; i < forest.count; i++) {
    forest.getMatrixAt(i, matrix);
    position.setFromMatrixPosition(matrix).applyMatrix4(forest.matrixWorld);
    if (!inBox(LOT, position.x, position.z)) continue;
    forest.setMatrixAt(i, zero);
    changed = true;
  }
  if (changed) forest.instanceMatrix.needsUpdate = true;
}

/**
 * Teknoparkı kurar: bölgedeki askerî parçalar (spor sahası hariç) ve ağaçlar kaldırılır. Yerine tek zemin
 * (Technopark_Ground, rengi TECHNOPARK_FRAGMENT ile cityRuntime çizer), yansıma havuzu, kütleler, parçalar, otopark araçları
 * ve ağaçlar gelir. Askerî kampüsten sonra çalışır (zemin malzemesi onun zemininden alınır). Lamba konumlarını döndürür.
 * Hazırlık ikinci kez çalışırsa (StrictMode) tekrar etmez.
 */
export function landscapeTechnopark(cityRoot: THREE.Object3D, treeScale: number): number[] {
  const done = cityRoot.userData.technoparkLamps as number[] | undefined;
  if (done) return done;
  cityRoot.updateMatrixWorld(true);
  const ground = cityRoot.getObjectByName('Military_Ground');
  const hangars = cityRoot.getObjectByName('Military_Hangars');
  let facade: THREE.Material | null = null;
  let water: THREE.Material | null = null;
  const military: THREE.Mesh[] = [];
  cityRoot.traverse((object) => {
    if (!(object instanceof THREE.Mesh)) return;
    if (!facade && object instanceof THREE.InstancedMesh && object.name.startsWith('Residential_Buildings_')) {
      facade = object.material as THREE.Material;
    }
    if (!water && !Array.isArray(object.material) && object.material.name === 'Water') water = object.material;
    if (MILITARY.test(object.name) && !(object instanceof THREE.InstancedMesh)) military.push(object);
  });
  if (
    !(ground instanceof THREE.Mesh) ||
    !(hangars instanceof THREE.Mesh) ||
    !facade ||
    !water ||
    Array.isArray(ground.material) ||
    Array.isArray(hangars.material)
  ) {
    return [];
  }

  const parent = ground.parent ?? cityRoot;
  for (const mesh of military) {
    const keepField = mesh.name === 'Military_TrainingGrounds';
    dropTriangles(mesh, (x, z) => inBox(SITE, x, z) && !(keepField && inBox(FIELD_KEEP, x, z)));
  }
  hideForest(cityRoot);
  // Zemin: bütün plakayı kaplayan tek düzlem; LANDSCAPES askerî zeminin malzemesini klonlayıp yamar.
  const site = new THREE.Mesh(plane(LOT, GROUND_Y), ground.material);
  site.name = 'Technopark_Ground';
  site.userData = { groundLayered: true };
  // Yansıma havuzu: şehrin su malzemesiyle düz yüzey, taş bordürün içinde.
  const pond = new THREE.Mesh(
    plane({ x0: POND.x0 + POND_RIM, x1: POND.x1 - POND_RIM, z0: POND.z0 + POND_RIM, z1: POND.z1 - POND_RIM }, GROUND_Y + 0.12),
    water,
  );
  pond.name = 'Technopark_Pond';
  pond.userData = { castShadow: false, groundLayered: true };
  // Parçalar askerî hangarların satin malzemesini paylaşır (köşe renkli).
  const props = new THREE.Mesh(propsGeometry(), hangars.material);
  props.name = 'Technopark_Props';
  for (const mesh of [site, pond, props, ...buildingMeshes(facade)]) parent.add(mesh);
  // Otopark araçları şehrin park etmiş araçlarının yanına (Traffic_ adıyla: trafik, LOD ve insanlar onları öyle tanır).
  for (const mesh of vehicleMeshes(cityRoot)) parent.add(mesh);
  // Yeni parçalar dünya koordinatında kuruldu: ebeveynin dönüşümü birim olmalı.
  parent.updateMatrixWorld(true);
  if (!parent.matrixWorld.equals(new THREE.Matrix4())) {
    const inverse = parent.matrixWorld.clone().invert();
    for (const child of parent.children) {
      if (OWN.test(child.name) || child.name.startsWith('Traffic_Technopark_')) child.applyMatrix4(inverse);
    }
  }

  const lamps = technoparkLamps();
  replantTrees(cityRoot, {
    prefix: 'Technopark',
    inside: (x, z) => inBox(SITE, x, z),
    spots: plantTrees(crownRadius(cityRoot, treeScale), lamps),
    treeScale,
  });
  cityRoot.updateMatrixWorld(true);
  cityRoot.userData.technoparkLamps = lamps;
  return lamps;
}
