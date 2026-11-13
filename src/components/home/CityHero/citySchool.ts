// Okulun yeniden düzenlenmesi (C-D × 1-2 blokları, alan x 27..413, z -563..-257, zemin plakası x 30..410, z -560..-260).
// Modelde 380×300 m'lik tek ton bej bir plakanın üstünde 8 üçgenlik kutulardan U planlı bir derslik bloğu (200 m boyunca
// kesintisiz), kameradan uzak köşede saklı bir giriş kutusu, tonoz çatılı bir salon, avluda 162×142 m bej bir plaka üstünde
// mavi bir disk, doygun yeşil bir futbol sahası ve mavi kortlar vardı. Ağaçlar kuzey kenarında yola taşan tek bir dizi ve
// avluda serpiştirilmişti, lamba ve otopark yoktu. Model değişmeden açılışta yeniden kurulur:
// - Bina: dört katlı ana derslik bloğu (iki bar ve ortada tören alanına çıkıntı yapan giriş holü), ana bloktan kuzeye uzanan
//   üç katlı üç derslik kanadı (aralarında bahçe ve oyun avlusu), örtülü geçitle bağlı spor salonu, yemekhane.
// - Zemin (shader): tören alanı (granit ızgara, bayrak direği), güney kapısından girişe aks, bahçe avlusu, oyun avlusu,
//   atletizm pisti ve futbol sahası, üç kort, personel otoparkı, okul bostanı, çim ve çit bitkisi.
// - Parçalar: bayrak direği ve kürsü, tribün, kale direkleri, potalar ve fileler, bisiklet parkı, projektör direkleri.
// - Teleferik hattı okulun üstünden geçer: direkler (118, -330) ve (316, -330) yerinde kalır, çevreleri boş tutulur.
// Yerleşim planı aşağıdaki sabitlerde tek yerde tanımlanır. GLSL ve TypeScript tarafı aynı ölçüleri kullanır.
import * as THREE from 'three';
import { MASS_VARIANTS, MassBuilder, PropBuilder, type VehicleSpot, parkedVehicles } from './cityMass';
import { type TreeSpot, crownRadius, hash2, replantTrees } from './cityTrees';

interface Box {
  x0: number;
  x1: number;
  z0: number;
  z1: number;
}
type Building = Box & { height: number };

const SITE: Box = { x0: 27, x1: 413, z0: -563, z1: -257 };
// Okulun zemin plakası (cityLayout School_Ground'u bu alana oturtur): çevresi kaldırım.
const LOT: Box = { x0: 30, x1: 410, z0: -560, z1: -260 };
// Zemin yüksekliği (modeldeki School_Ground ile aynı) ve binaların oturduğu taban.
const GROUND_Y = 0.75;
const BASE_Y = 0.45;

// ---- binalar
const MAIN_W: Building = { x0: 48, x1: 126, z0: -468, z1: -450, height: 15.2 };
const HALL: Building = { x0: 126, x1: 150, z0: -474, z1: -444, height: 12.4 };
const MAIN_E: Building = { x0: 150, x1: 238, z0: -468, z1: -450, height: 15.2 };
// Derslik kanatları: ortadaki holün arkasından başlar.
const WINGS: Building[] = [
  { x0: 52, x1: 68, z0: -546, z1: -468, height: 11.8 },
  { x0: 130, x1: 146, z0: -546, z1: -474, height: 11.8 },
  { x0: 214, x1: 230, z0: -546, z1: -468, height: 11.8 },
];
const GYM = { x0: 258, x1: 294, z0: -472, z1: -424, wall: 9, ridge: 12.5 };
const CANTEEN: Building = { x0: 252, x1: 294, z0: -546, z1: -508, height: 8.3 };
const BUILDINGS: Box[] = [MAIN_W, HALL, MAIN_E, ...WINGS, GYM, CANTEEN];
// Ana blokla spor salonu arasında örtülü geçit.
const WALKWAY: Box = { x0: 238, x1: 258, z0: -460, z1: -456 };

// ---- tören alanı ve giriş aksı
const CEREMONY: Box = { x0: 52, x1: 240, z0: -444, z1: -384 };
const FLAG = { x: 138, z: -404 };
// Tören alanının iki ucunda granit ağaç havuzlu koru (9 m ızgara), ortası tören için açık.
const PIT = 9;
const PIT_GROVES: Box[] = [
  { x0: 56, x1: 92, z0: -438, z1: -393 },
  { x0: 190, x1: 235, z0: -438, z1: -393 },
];
// Giriş holünün önünde kürsü.
const STAGE: Box = { x0: 128, x1: 148, z0: -444, z1: -439 };
// Güney kapısından girişe aks.
const AXIS: Box = { x0: 132, x1: 144, z0: -384, z1: LOT.z1 };
// Spor salonunun önü (tribüne ve kortlara bağlanır), salonla yemekhane arasında yol, kortlara yol, otoparktan aksa yol.
const APRON: Box = { x0: 240, x1: 300, z0: -424, z1: -384 };
const PATH_N: Box = { x0: 240, x1: 250, z0: -540, z1: -424 };
const PATH_C: Box = { x0: 292, x1: 300, z0: -384, z1: -320 };
const PATH_P: Box = { x0: 100, x1: 132, z0: -300, z1: -296 };
// Doğu çiminden güney sokağına çakıl yol.
const PATH_S: Box = { x0: 228, x1: 232, z0: -384, z1: LOT.z1 };
const BIKES: Box = { x0: 150, x1: 170, z0: -380, z1: -376 };

// ---- avlular
const GARDEN: Box = { x0: 68, x1: 130, z0: -546, z1: -468 };
const GARDEN_C = { x: 99, z: -507, radius: 6 };
const PLAYYARD: Box = { x0: 152, x1: 208, z0: -540, z1: -474 };
const HOOP_COURT = { x: 180, z: -507, halfX: 7.5, halfZ: 14 };

// ---- personel otoparkı (batı), dört sıra, aralarında iki koridor; güney sokağına çıkış
const PARKING: Box = { x0: 40, x1: 100, z0: -316, z1: -278 };
const BAY = 2.6;
const ROWS = [
  { z0: -315, z1: -309.5, facing: 1 },
  { z0: -302.5, z1: -297, facing: -1 },
  { z0: -297, z1: -291.5, facing: 1 },
  { z0: -284.5, z1: -279, facing: -1 },
];
const DRIVE: Box = { x0: 90, x1: 97, z0: -284.5, z1: LOT.z1 };
// Ağaç adacıkları: bu park yerinden başlayan iki park yeri genişliğinde çim ve ağaç.
const ISLANDS = [6, 15];
const inIsland = (k: number) => ISLANDS.some((s) => k === s || k === s + 1);

// ---- spor alanları (modeldeki pist ve kortlarla aynı yerde)
// Pist: düzlükleri kuzey-güney, uçları yarım daire (dış kenar), 8 kulvar.
const TRACK = { x: 358, z: -428.5, halfX: 46, halfZ: 88, width: 9.8, lane: 1.22 };
const FIELD = { halfX: 32, halfZ: 50 };
const STAND: Box = { x0: 302, x1: 310.4, z0: -470, z1: -386 };
const COURT_PAD: Box = { x0: 289, x1: 409, z0: -320, z1: -292 };
const COURT_Z = -306;
// Basketbol, voleybol, tenis.
const COURTS = [309, 349, 389];

// ---- kuzeydoğu: okul bostanı ve koru
const BOSTAN: Box = { x0: 300, x1: 350, z0: -554, z1: -524 };
const TOOL_SHED: Box = { x0: 301.5, x1: 305.5, z0: -553, z1: -549.5 };
const GROVE_NE: Box = { x0: 354, x1: 406, z0: -556, z1: -520 };

// Teleferik direkleri: çevreleri çakıl, ağaç ve yapı yok.
const TOWERS: [number, number][] = [
  [118, -330],
  [316, -330],
];
const TOWER_PAD = 4;

const f = (value: number) => value.toFixed(2);
const box = (b: Box) => `vec2(${f((b.x0 + b.x1) / 2)}, ${f((b.z0 + b.z1) / 2)}), vec2(${f((b.x1 - b.x0) / 2)}, ${f((b.z1 - b.z0) / 2)})`;
const inBox = (b: Box, x: number, z: number, pad = 0) => x > b.x0 - pad && x < b.x1 + pad && z > b.z0 - pad && z < b.z1 + pad;
const pad = (b: Box, d: number): Box => ({ x0: b.x0 - d, x1: b.x1 + d, z0: b.z0 - d, z1: b.z1 + d });

/** Okul planının mesafe fonksiyonları (GLSL, global kapsamda). */
export const SCHOOL_GLSL = `
// Köşeleri r yarıçapla yuvarlatılmış kutuya işaretli uzaklık (içeride negatif).
float scBox(vec2 p, vec2 c, vec2 h, float r){ vec2 q = abs(p - c) - h + r; return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r; }
float scIn(float d, float aa){ return 1.0 - smoothstep(-aa, aa, d); }
// Eşit aralıklı çizgiler (metre): çizgi seçilemeyecek kadar uzaksa ortalama yoğunluğuna söner.
float scLines(float v, float period, float width, float aa){
  float d = abs(fract(v / period + 0.5) - 0.5) * period;
  float line = 1.0 - smoothstep(width * 0.5 - aa, width * 0.5 + aa, d);
  return mix(width / period, line, 1.0 - smoothstep(width * 0.6, width * 1.5, aa));
}
// Boya çizgisi: d = 0 eğrisi boyunca w genişliğinde, piksel altına inince ortalama yoğunluğa söner.
float scStroke(float d, float w, float aa){ return (1.0 - smoothstep(w * 0.5 - aa, w * 0.5 + aa, abs(d))) * min(1.0, w / aa); }
`;

const parkingBays = ROWS.map(
  (r) =>
    `bays = max(bays, scLines(p.x - ${f(PARKING.x0)}, ${f(BAY)}, 0.15, aa) * step(${f(PARKING.x0)}, p.x) * step(p.x, ${f(PARKING.x1)}) * step(${f(r.z0)}, p.y) * step(p.y, ${f(r.z1)}));`,
).join('\n    ');
const islandBoxes: Box[] = ROWS.flatMap((r) =>
  ISLANDS.map((k) => ({ x0: PARKING.x0 + BAY * k, x1: PARKING.x0 + BAY * (k + 2), z0: r.z0, z1: r.z1 })),
);
// Bina çevresinde döşeme şeridi (temel kaldırımı).
const buildingApron = BUILDINGS.map((b) => `scBox(p, ${box(b)}, 0.0)`).reduce((a, b) => `min(${a}, ${b})`);

/** Okul zemini: School_Ground'un rengi tamamen dünya konumundan çizilir (köşe renkleri yok sayılır). */
export const SCHOOL_FRAGMENT = `#include <color_fragment>
  {
    vec2 p = vWPos.xz;
    float aa = max(fwidth(p.x), fwidth(p.y)) * 0.8 + 0.05;
    float fine = 1.0 - smoothstep(0.8, 2.5, aa);
    float n1 = fbm(p * 0.02);
    float n2 = fbm(p * 0.09 + 23.0);
    // Taş, beton ve kauçukta ince benek (piksel altına inince söner).
    float grain = 0.94 + 0.12 * h12(floor(p * 3.0)) * fine;
    vec3 rimColor = vec3(0.55, 0.53, 0.5);
    vec3 paint = vec3(0.72, 0.7, 0.64);
    float mow = 1.0 - smoothstep(2.0, 5.0, aa);

    // Çim: parktaki gibi biçme şeritleri ve geniş ton farkları.
    vec3 c = vec3(0.12, 0.19, 0.065) * (0.82 + 0.36 * n1);
    c *= 1.0 + (step(0.5, fract((p.x * 0.2 + p.y) / 9.0)) - 0.5) * 0.12 * mow;

    // Plaka kenarında çit bitkisi; kapılarda (aks, otopark çıkışı, çakıl yol) kesilir.
    float edge = min(min(p.x - ${f(LOT.x0)}, ${f(LOT.x1)} - p.x), min(p.y - ${f(LOT.z0)}, ${f(LOT.z1)} - p.y));
    float hedge = scIn(edge - 2.4 + (n2 - 0.5) * 0.8, aa);
    c = mix(c, vec3(0.055, 0.095, 0.035) * (0.7 + 0.6 * fbm(p * 0.45)), hedge);

    vec3 gravel = vec3(0.4, 0.34, 0.25) * (0.88 + 0.24 * n2) * grain;
    float joint = max(scLines(p.x, 1.2, 0.08, aa), scLines(p.y, 1.2, 0.08, aa));
    vec3 stone = vec3(0.52, 0.49, 0.44) * grain * (0.94 + 0.12 * n2) * (1.0 - 0.1 * joint);
    vec3 granite = vec3(0.27, 0.26, 0.25) * grain;

    // Okul bostanı: çakıl kenar, içinde sıra sıra toprak ve ekin. Sıralar seçilemeyecek kadar uzaksa ortalama ton.
    float bd = scBox(p, ${box(BOSTAN)}, 1.0);
    float row = fract((p.y - ${f(BOSTAN.z0)}) / 1.6);
    float rowHash = h12(vec2(floor((p.y - ${f(BOSTAN.z0)}) / 1.6), floor((p.x - ${f(BOSTAN.x0)}) / 12.5) + 8.3));
    vec3 crop = rowHash < 0.4 ? vec3(0.13, 0.2, 0.06) : rowHash < 0.75 ? vec3(0.22, 0.29, 0.09) : vec3(0.24, 0.15, 0.12);
    crop *= 0.8 + 0.4 * n2;
    vec3 soil = vec3(0.17, 0.11, 0.07) * (0.9 + 0.2 * n2);
    float rowAa = max(fwidth(row), 1e-4);
    float cropMask = mix(0.55, smoothstep(0.3 - rowAa, 0.3 + rowAa, row) * (1.0 - smoothstep(0.85 - rowAa, 0.85 + rowAa, row)), fine);
    // Yataklar arasında 12.5 m'de bir çakıl geçit.
    float aisle = scLines(p.x - ${f(BOSTAN.x0)}, 12.5, 1.2, aa);
    c = mix(c, gravel, scIn(bd, aa));
    c = mix(c, mix(mix(soil, crop, cropMask), gravel, aisle), scIn(bd + 1.2, aa));

    // Teleferik direklerinin çevresi çakıl.
    ${TOWERS.map(([x, z]) => `c = mix(c, gravel * 0.92, scIn(scBox(p, vec2(${f(x)}, ${f(z)}), vec2(${f(TOWER_PAD)}), 0.8), aa));`).join('\n    ')}

    // Bahçe avlusu: çapraz çakıl yollar, ortada taş daire ve granit halka.
    vec2 gq = p - vec2(${f(GARDEN_C.x)}, ${f(GARDEN_C.z)});
    float inGarden = scIn(scBox(p, ${box(GARDEN)}, 0.0), aa);
    float gpath = max(scIn(abs(gq.x) - 1.5, aa), scIn(abs(gq.y) - 1.5, aa));
    c = mix(c, gravel, gpath * inGarden);
    float gr = length(gq);
    c = mix(c, stone, scIn(gr - ${f(GARDEN_C.radius)}, aa));
    c = mix(c, granite, scIn(abs(gr - ${f(GARDEN_C.radius - 0.6)}) - 0.35, aa));

    // Otopark: asfalt, park çizgileri, açık bordür, adacıklar çim.
    float pd = min(scBox(p, ${box(PARKING)}, 0.8), scBox(p, ${box(DRIVE)}, 0.0));
    c = mix(c, vec3(0.2, 0.195, 0.19) * (0.88 + 0.24 * n2), scIn(pd, aa));
    float bays = 0.0;
    ${parkingBays}
    c = mix(c, rimColor, bays);
    c = mix(c, rimColor, scIn(abs(scBox(p, ${box(PARKING)}, 0.8)) - 0.25, aa) * fine);
    ${islandBoxes.map((b) => `{ float d = scBox(p, ${box(b)}, 0.6); c = mix(c, vec3(0.1, 0.17, 0.06) * (0.85 + 0.3 * n2), scIn(d + 0.3, aa)); c = mix(c, rimColor, scIn(abs(d + 0.15) - 0.15, aa) * fine); }`).join('\n    ')}

    // Kortlar: koyu yeşil gri akrilik çevre; basketbol (kırık kiremit), voleybol (arduvaz), tenis (adaçayı).
    float cpd = scBox(p, ${box(COURT_PAD)}, 1.0);
    c = mix(c, vec3(0.16, 0.21, 0.18) * grain, scIn(cpd, aa));
    float lines = 0.0;
    {
      vec2 q = p - vec2(${f(COURTS[0])}, ${f(COURT_Z)});
      float court = scBox(p, vec2(${f(COURTS[0])}, ${f(COURT_Z)}), vec2(14.0, 7.5), 0.0);
      c = mix(c, vec3(0.38, 0.2, 0.14) * grain, scIn(court, aa));
      float key = scBox(vec2(abs(q.x), q.y), vec2(11.1, 0.0), vec2(2.9, 2.45), 0.0);
      c = mix(c, vec3(0.2, 0.27, 0.33) * grain, scIn(key, aa));
      vec2 hq = vec2(12.4 - abs(q.x), q.y);
      lines += scStroke(court, 0.08, aa) + scStroke(q.x, 0.08, aa) * scIn(court, aa) + scStroke(length(q) - 1.8, 0.08, aa) + scStroke(key, 0.08, aa);
      lines += scStroke(length(hq) - 6.75, 0.08, aa) * step(-1.6, hq.x) * step(hq.x, 6.0) * scIn(court, aa);
    }
    {
      vec2 q = p - vec2(${f(COURTS[1])}, ${f(COURT_Z)});
      c = mix(c, vec3(0.2, 0.27, 0.33) * grain, scIn(scBox(p, vec2(${f(COURTS[1])}, ${f(COURT_Z)}), vec2(13.0, 8.0), 0.5), aa));
      float court = scBox(p, vec2(${f(COURTS[1])}, ${f(COURT_Z)}), vec2(9.0, 4.5), 0.0);
      lines += scStroke(court, 0.08, aa) + (scStroke(q.x, 0.08, aa) + scStroke(abs(q.x) - 3.0, 0.08, aa)) * scIn(court, aa);
    }
    {
      vec2 q = p - vec2(${f(COURTS[2])}, ${f(COURT_Z)});
      c = mix(c, vec3(0.22, 0.3, 0.2) * grain, scIn(scBox(p, vec2(${f(COURTS[2])}, ${f(COURT_Z)}), vec2(16.0, 9.0), 0.5), aa));
      float doubles = scBox(p, vec2(${f(COURTS[2])}, ${f(COURT_Z)}), vec2(11.89, 5.49), 0.0);
      float singles = abs(abs(q.y) - 4.12) * step(abs(q.x), 11.89);
      float service = scBox(p, vec2(${f(COURTS[2])}, ${f(COURT_Z)}), vec2(6.4, 4.12), 0.0);
      lines += scStroke(doubles, 0.08, aa) + scStroke(singles, 0.08, aa) + scStroke(abs(q.x) - 6.4, 0.08, aa) * step(abs(q.y), 4.12);
      lines += scStroke(q.y, 0.08, aa) * scIn(service, aa) + scStroke(q.x, 0.08, aa) * scIn(doubles, aa);
    }
    c = mix(c, paint, clamp(lines, 0.0, 1.0) * fine);
    c = mix(c, rimColor, scIn(abs(cpd) - 0.25, aa) * fine);

    // Atletizm pisti: kırık tuğla kauçuk, kulvar çizgileri, açık renk bordür, bitiş çizgisi.
    vec2 tc = vec2(${f(TRACK.x)}, ${f(TRACK.z)});
    vec2 tq = p - tc;
    float outer = scBox(p, tc, vec2(${f(TRACK.halfX)}, ${f(TRACK.halfZ)}), ${f(TRACK.halfX)});
    float inner = outer + ${f(TRACK.width)};
    float onTrack = scIn(outer, aa) * (1.0 - scIn(inner, aa));
    c = mix(c, vec3(0.4, 0.17, 0.1) * grain * (0.94 + 0.12 * n2), scIn(outer, aa));
    float lanes = scLines(outer, ${f(TRACK.lane)}, 0.06, aa) * onTrack;
    float finish = scStroke(tq.y, 0.1, aa) * step(${f(TRACK.halfX - TRACK.width)}, tq.x) * step(tq.x, ${f(TRACK.halfX)});
    c = mix(c, paint, clamp(lanes + finish, 0.0, 1.0) * 0.85);

    // Futbol sahası ve iç saha: parktaki çim tonlarında, sahaya dik biçme şeritleri (5 m), çizgiler uzakta söner.
    vec3 turf = vec3(0.11, 0.19, 0.065) * (0.84 + 0.3 * n1);
    turf *= 1.0 + (step(0.5, fract(tq.y / 10.0)) - 0.5) * 0.14 * mow;
    c = mix(c, turf, scIn(inner, aa));
    c = mix(c, rimColor, scStroke(outer, 0.3, aa) + scStroke(inner, 0.3, aa));
    float fd = scBox(p, tc, vec2(${f(FIELD.halfX)}, ${f(FIELD.halfZ)}), 0.0);
    vec2 fq = vec2(tq.x, abs(tq.y));
    float box16 = scBox(fq, vec2(0.0, ${f(FIELD.halfZ - 8.25)}), vec2(20.15, 8.25), 0.0);
    float box5 = scBox(fq, vec2(0.0, ${f(FIELD.halfZ - 2.75)}), vec2(9.16, 2.75), 0.0);
    float fl = scStroke(fd, 0.12, aa) + scStroke(tq.y, 0.12, aa) * scIn(fd, aa) + scStroke(length(tq) - 9.15, 0.12, aa);
    fl += scStroke(box16, 0.12, aa) + scStroke(box5, 0.12, aa);
    c = mix(c, paint, clamp(fl, 0.0, 1.0) * 0.9);

    // Oyun avlusu: açık asfalt, basketbol sahası çizgileri, seksek kutuları.
    float yd = scBox(p, ${box(PLAYYARD)}, 2.0);
    c = mix(c, vec3(0.3, 0.29, 0.28) * grain * (0.92 + 0.16 * n2), scIn(yd, aa));
    {
      vec2 q = p - vec2(${f(HOOP_COURT.x)}, ${f(HOOP_COURT.z)});
      float court = scBox(p, vec2(${f(HOOP_COURT.x)}, ${f(HOOP_COURT.z)}), vec2(${f(HOOP_COURT.halfX)}, ${f(HOOP_COURT.halfZ)}), 0.0);
      c = mix(c, vec3(0.2, 0.27, 0.33) * grain, scIn(court, aa) * 0.6);
      float hl = scStroke(court, 0.08, aa) + scStroke(q.y, 0.08, aa) * scIn(court, aa) + scStroke(length(q) - 1.8, 0.08, aa);
      hl += scStroke(length(vec2(q.x, ${f(HOOP_COURT.halfZ - 1.6)} - abs(q.y))) - 6.0, 0.08, aa) * step(abs(q.y), ${f(HOOP_COURT.halfZ)}) * step(${f(HOOP_COURT.halfZ - 7.6)}, abs(q.y));
      vec2 sq = p - vec2(${f(PLAYYARD.x0 + 6)}, ${f(PLAYYARD.z1 - 14)});
      float hop = scBox(sq, vec2(0.0), vec2(0.6, 4.2), 0.0);
      hl += (scStroke(hop, 0.08, aa) + scStroke(fract(sq.y / 1.2 + 0.5) - 0.5, 0.06, aa) * scIn(hop, aa));
      c = mix(c, paint, clamp(hl, 0.0, 1.0) * fine);
    }
    c = mix(c, rimColor, scStroke(yd, 0.4, aa) * fine);

    // Döşemeler: bina çevresi, aks, salon önü ve yollar açık taş (1.2 m derz); doğudaki yol çakıl.
    c = mix(c, gravel, scIn(scBox(p, ${box(PATH_S)}, 0.3), aa));
    float paved = min(min(scBox(p, ${box(AXIS)}, 0.0), scBox(p, ${box(APRON)}, 1.0)), min(scBox(p, ${box(PATH_N)}, 0.3), min(scBox(p, ${box(PATH_C)}, 0.3), scBox(p, ${box(PATH_P)}, 0.3))));
    paved = min(paved, ${buildingApron} - 2.4);
    paved = min(paved, scBox(p, ${box(BIKES)}, 0.0) - 1.5);
    c = mix(c, stone, scIn(paved, aa));
    // Aksın iki kenarında granit bant.
    c = mix(c, granite, scStroke(abs(p.x - ${f((AXIS.x0 + AXIS.x1) / 2)}) - ${f((AXIS.x1 - AXIS.x0) / 2 - 0.5)}, 0.6, aa) * step(p.y, ${f(AXIS.z1)}) * step(${f(AXIS.z0)}, p.y));

    // Tören alanı: bayrak direğine hizalı 6 m granit ızgara, granit kenar bandı, direğin çevresinde granit halka.
    float cd = scBox(p, ${box(CEREMONY)}, 1.5);
    float grid = max(scLines(p.x - ${f(FLAG.x)}, 6.0, 0.3, aa), scLines(p.y - ${f(FLAG.z)}, 6.0, 0.3, aa));
    c = mix(c, stone, scIn(cd, aa));
    c = mix(c, granite, grid * scIn(cd, aa) * 0.5);
    c = mix(c, granite, scIn(abs(cd + 0.8) - 0.6, aa));
    float fr = length(p - vec2(${f(FLAG.x)}, ${f(FLAG.z)}));
    c = mix(c, granite * 1.1, scIn(abs(fr - 3.2) - 0.45, aa));
    c = mix(c, vec3(0.6, 0.57, 0.52) * grain, scIn(fr - 2.6, aa));
    // Korularda ağaç havuzları: granit çerçeveli, içi toprak ve çim.
    ${PIT_GROVES.map((b) => `{ vec2 q = mod(p - vec2(${f(b.x0)}, ${f(b.z0)}), ${f(PIT)}) - ${f(PIT / 2)}; float pit = scBox(q, vec2(0.0), vec2(1.3), 0.2) + 1e3 * (1.0 - scIn(scBox(p, ${box(b)}, 0.0), 0.01)); c = mix(c, granite, scIn(pit - 0.3, aa)); c = mix(c, vec3(0.1, 0.15, 0.06) * (0.8 + 0.4 * n2), scIn(pit, aa)); }`).join('\n    ')}

    diffuseColor.rgb = c;
  }`;

// ------------------------------------------------------------------ binalar

// Duvar ve çatı paleti (FACADE_FRAGMENT eşikleriyle). Değerler kreş, sera, kültür merkezi ve konutla aynı: aynı değer aynı
// cephe programını paylaşır, açılışta ek cephe shader'ı derlenmez. Ana blok, hol ve spor salonu kırık beyaz duvar, yeşil düz
// ve arduvaz beşik çatı; derslik kanatları ve yemekhane krem sıva ve açık membran.
const CIVIC_PALETTE = 'vec2(0.1, 0.9)';
const CLASS_PALETTE = 'vec2(0.4, 0.7)';

function blockMatrix(b: Box, height: number) {
  const hy = height / 2;
  return new THREE.Matrix4().compose(
    new THREE.Vector3((b.x0 + b.x1) / 2, BASE_Y + hy, (b.z0 + b.z1) / 2),
    new THREE.Quaternion(),
    new THREE.Vector3((b.x1 - b.x0) / 2, hy, (b.z1 - b.z0) / 2),
  );
}

function buildingMeshes(source: THREE.Material) {
  const material = (palette: string) => {
    const clone = source.clone();
    clone.defines = { ...clone.defines, CITY_PALETTE: palette };
    return clone;
  };
  const civic = material(CIVIC_PALETTE);
  const classes = material(CLASS_PALETTE);
  const instanced = (name: string, geometry: THREE.BufferGeometry, mat: THREE.Material, matrices: THREE.Matrix4[]) => {
    const mesh = new THREE.InstancedMesh(geometry, mat, matrices.length);
    mesh.name = name;
    matrices.forEach((m, i) => mesh.setMatrixAt(i, m));
    mesh.instanceMatrix.needsUpdate = true;
    return mesh;
  };
  // Düz çatıda tesisat kulesi (giriş holü, yemekhane).
  const plantRoom = new MassBuilder().box(-1, 1, -1, 0.88, -1, 1).box(-0.5, 0.1, 0.88, 1, -0.4, 0.3).build();
  // Spor salonu: duvar ve mahyası kuzey-güney beşik çatı (birim küpte duvar payı).
  const wall = -1 + (2 * GYM.wall) / GYM.ridge;
  const gym = new MassBuilder().box(-1, 1, -1, wall, -1, 1, false).pitchedRoof(wall, 1, false, 1).build();
  return [
    instanced('School_Main', MASS_VARIANTS.penthouseB().build(), civic, [MAIN_W, MAIN_E].map((b) => blockMatrix(b, b.height))),
    instanced('School_Hall', plantRoom, civic, [blockMatrix(HALL, HALL.height)]),
    instanced('School_Gym', gym, civic, [blockMatrix(GYM, GYM.ridge)]),
    instanced('School_Wings', MASS_VARIANTS.plain().build(), classes, WINGS.map((b) => blockMatrix(b, b.height))),
    instanced('School_Canteen', plantRoom.clone(), classes, [blockMatrix(CANTEEN, CANTEEN.height)]),
  ];
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
  seat: '#9fa3a0',
  flag: '#a4493b',
};
const BIKE_TONES = [TONE.slate, TONE.ridge, TONE.terracotta, TONE.sage, TONE.white];

// Projektör direkleri: pistin dört köşesi ve kortların iki yanı.
const FLOODLIGHTS: [number, number][] = [
  [318, -510],
  [398, -510],
  [318, -347],
  [398, -347],
  ...[COURT_PAD.x0 + 0.5, 329, 369, COURT_PAD.x1 - 0.5].flatMap((x): [number, number][] => [
    [x, COURT_PAD.z0 - 1],
    [x, COURT_PAD.z1 + 1],
  ]),
];
const FLOOD_HEIGHT = 16;

function hoop(props: PropBuilder, x: number, z: number, dir: number, alongX: boolean) {
  const y = GROUND_Y;
  props.box(x - 0.15, x + 0.15, y, y + 3.6, z - 0.15, z + 0.15, TONE.steel);
  if (alongX) {
    props.box(Math.min(x, x + dir * 1.1), Math.max(x, x + dir * 1.1), y + 3.4, y + 3.55, z - 0.1, z + 0.1, TONE.steel);
    props.box(x + dir * 1.1 - 0.06, x + dir * 1.1 + 0.06, y + 2.9, y + 4.0, z - 0.9, z + 0.9, TONE.white);
  } else {
    props.box(x - 0.1, x + 0.1, y + 3.4, y + 3.55, Math.min(z, z + dir * 1.1), Math.max(z, z + dir * 1.1), TONE.steel);
    props.box(x - 0.9, x + 0.9, y + 2.9, y + 4.0, z + dir * 1.1 - 0.06, z + dir * 1.1 + 0.06, TONE.white);
  }
}

function bench(props: PropBuilder, x: number, z: number, alongX: boolean) {
  const y = GROUND_Y;
  const [hx, hz] = alongX ? [0.9, 0.3] : [0.3, 0.9];
  props.box(x - hx, x + hx, y + 0.3, y + 0.45, z - hz, z + hz, TONE.wood);
  props.box(x - hx * 0.85, x + hx * 0.85, y, y + 0.3, z - hz * 0.7, z + hz * 0.7, TONE.steel);
}

const GARDEN_BENCHES: [number, number, boolean][] = [
  [GARDEN_C.x - 9, GARDEN_C.z - 4, false],
  [GARDEN_C.x + 9, GARDEN_C.z + 4, false],
  [GARDEN_C.x - 4, GARDEN_C.z + 9, true],
  [GARDEN_C.x + 4, GARDEN_C.z - 9, true],
];

function propsGeometry() {
  const props = new PropBuilder();
  const y = GROUND_Y;

  // Bayrak direği: taş kaide, beyaz direk, kırık kırmızı bayrak. Holün önünde kürsü.
  props.cylinder(FLAG.x, y, FLAG.z, 1.4, 0.4, 'y', TONE.stone, 10);
  props.cylinder(FLAG.x, y + 0.4, FLAG.z, 0.14, 15, 'y', TONE.white, 6);
  props.box(FLAG.x + 0.14, FLAG.x + 3.2, y + 13.2, y + 15.2, FLAG.z - 0.04, FLAG.z + 0.04, TONE.flag);
  props.box(STAGE.x0, STAGE.x1, y, y + 0.6, STAGE.z0, STAGE.z1, TONE.stone);
  props.box(STAGE.x0 + 6, STAGE.x1 - 6, y, y + 0.3, STAGE.z1, STAGE.z1 + 1.2, TONE.stone);

  // Ana blokla spor salonu arasında örtülü geçit.
  const w = WALKWAY;
  for (let x = w.x0 + 2; x < w.x1; x += 8) {
    for (const z of [w.z0 + 0.2, w.z1 - 0.2]) props.box(x - 0.12, x + 0.12, y, y + 3.2, z - 0.12, z + 0.12, TONE.steel);
  }
  props.box(w.x0, w.x1, y + 3.2, y + 3.45, w.z0 - 0.4, w.z1 + 0.4, TONE.ridge);

  // Bisiklet parkı: sundurma ve sıra sıra bisikletler.
  const b = BIKES;
  for (const x of [b.x0 + 0.3, (b.x0 + b.x1) / 2, b.x1 - 0.3]) props.box(x - 0.1, x + 0.1, y, y + 2.4, b.z0 + 0.1, b.z0 + 0.3, TONE.steel);
  props.ramp(b.x0 - 0.3, y + 2.4, b.x1 + 0.3, y + 2.4, b.z0 - 0.3, b.z1 + 0.2, 0.12, TONE.roof);
  for (let x = b.x0 + 0.8, k = 0; x < b.x1 - 0.5; x += 0.9, k++) {
    if (hash2(x, 3.1) < 0.25) continue;
    props.box(x - 0.05, x + 0.05, y, y + 1.0, b.z0 + 1.4, b.z0 + 3.1, BIKE_TONES[k % BIKE_TONES.length]);
  }

  // Bahçe avlusu banklar, oyun avlusunda potalar ve bank.
  for (const [x, z, along] of GARDEN_BENCHES) bench(props, x, z, along);
  hoop(props, HOOP_COURT.x, HOOP_COURT.z - HOOP_COURT.halfZ - 1.2, 1, false);
  hoop(props, HOOP_COURT.x, HOOP_COURT.z + HOOP_COURT.halfZ + 1.2, -1, false);
  for (const z of [HOOP_COURT.z - 6, HOOP_COURT.z + 6]) bench(props, PLAYYARD.x1 - 1.5, z, false);

  // Kortlar: basketbol potaları, voleybol filesi, tenis filesi.
  hoop(props, COURTS[0] - 15.2, COURT_Z, 1, true);
  hoop(props, COURTS[0] + 15.2, COURT_Z, -1, true);
  for (const dz of [-5.5, 5.5]) props.box(COURTS[1] - 0.1, COURTS[1] + 0.1, y, y + 2.6, COURT_Z + dz - 0.1, COURT_Z + dz + 0.1, TONE.steel);
  props.box(COURTS[1] - 0.03, COURTS[1] + 0.03, y + 1.6, y + 2.45, COURT_Z - 5.4, COURT_Z + 5.4, TONE.white);
  for (const dz of [-6.4, 6.4]) props.box(COURTS[2] - 0.08, COURTS[2] + 0.08, y, y + 1.07, COURT_Z + dz - 0.08, COURT_Z + dz + 0.08, TONE.steel);
  props.box(COURTS[2] - 0.03, COURTS[2] + 0.03, y + 0.15, y + 0.95, COURT_Z - 6.3, COURT_Z + 6.3, TONE.white);

  // Futbol kaleleri: direkler ve üst direk (7.3 × 2.4 m), arkada file çerçevesi.
  for (const dir of [-1, 1]) {
    const z = TRACK.z + dir * FIELD.halfZ;
    const back = z + dir * 1.8;
    for (const x of [TRACK.x - 3.66, TRACK.x + 3.66]) {
      props.box(x - 0.07, x + 0.07, y, y + 2.44, z - 0.07, z + 0.07, TONE.white);
      props.box(x - 0.04, x + 0.04, y + 0.05, y + 0.12, Math.min(z, back), Math.max(z, back), TONE.white);
    }
    props.box(TRACK.x - 3.73, TRACK.x + 3.73, y + 2.37, y + 2.51, z - 0.07, z + 0.07, TONE.white);
  }

  // Tribün: pistin batı düzlüğüne bakan 6 basamak, arkada dikmelere oturan konsol sundurma.
  const s = STAND;
  for (let i = 0; i < 6; i++) {
    props.box(s.x0, s.x1 - i * 1.4, y, y + 0.5 * (i + 1), s.z0, s.z1, i % 2 ? TONE.seat : TONE.roof);
  }
  for (let z = s.z0 + 1; z <= s.z1 - 1; z += 12) props.box(s.x0 + 0.1, s.x0 + 0.5, y, y + 6.6, z - 0.2, z + 0.2, TONE.steel);
  props.ramp(s.x0 - 0.3, y + 6.6, s.x1 + 0.6, y + 5.8, s.z0 - 0.3, s.z1 + 0.3, 0.2, TONE.roof);

  // Projektör direkleri.
  for (const [x, z] of FLOODLIGHTS) {
    props.box(x - 0.25, x + 0.25, y, y + FLOOD_HEIGHT, z - 0.25, z + 0.25, TONE.steel);
    props.box(x - 0.9, x + 0.9, y + FLOOD_HEIGHT, y + FLOOD_HEIGHT + 0.9, z - 0.25, z + 0.25, TONE.white);
  }

  // Bostanın köşesinde alet kulübesi, okul kapısında taş babalar.
  const t = TOOL_SHED;
  props.box(t.x0, t.x1, y, y + 2.4, t.z0, t.z1, TONE.wood);
  props.pyramid(t.x0 - 0.3, t.x1 + 0.3, y + 2.4, y + 3.3, t.z0 - 0.3, t.z1 + 0.3, TONE.terracotta);
  for (const x of [AXIS.x0 - 0.6, AXIS.x1 + 0.6]) props.box(x - 0.6, x + 0.6, y, y + 2.4, LOT.z1 - 1.4, LOT.z1 - 0.2, TONE.stone);
  return props.build();
}

// ------------------------------------------------------------------ araçlar

/** Personel otoparkında arabalar dik park (şehrin park etmiş araçlarından, parkedVehicles). */
function vehicleMeshes(cityRoot: THREE.Object3D) {
  const colors = ['White', 'Silver', 'Graphite', 'Blue'];
  const cars: VehicleSpot[][] = colors.map(() => []);
  ROWS.forEach((row, r) => {
    for (let k = 0; ; k++) {
      const x = PARKING.x0 + BAY * (k + 0.5);
      if (x > PARKING.x1 - BAY / 2) break;
      if (inIsland(k)) continue;
      if (row.z1 > DRIVE.z0 && x > DRIVE.x0 - 0.5 && x < DRIVE.x1 + 0.5) continue;
      if (hash2(x, r + 31) < 0.3) continue;
      const h = hash2(x * 1.3, r + 17);
      cars[h < 0.38 ? 0 : h < 0.72 ? 1 : h < 0.9 ? 2 : 3].push([x, (row.z0 + row.z1) / 2, (row.facing * Math.PI) / 2]);
    }
  });
  return colors.map((color, i) => parkedVehicles(cityRoot, `Cars_${color}`, 'School', cars[i])).filter((mesh) => mesh !== null);
}

// ------------------------------------------------------------------ ağaçlar ve lambalar

// Ağaç dikilmeyen yerler: tepe bunların üstüne taşmaz.
const SOLID: Box[] = [
  ...BUILDINGS,
  WALKWAY,
  pad(BIKES, 0.5),
  STAGE,
  STAND,
  PARKING,
  COURT_PAD,
  pad(PLAYYARD, 2),
  BOSTAN,
  ...TOWERS.map(([x, z]) => ({ x0: x - TOWER_PAD, x1: x + TOWER_PAD, z0: z - TOWER_PAD, z1: z + TOWER_PAD })),
];
// Döşemeler: gövde uzakta, tepe kenara biraz taşabilir.
const PAVED: Box[] = [CEREMONY, APRON, AXIS, PATH_N, PATH_C, PATH_P, PATH_S, DRIVE];

function trackDistance(x: number, z: number) {
  const r = TRACK.halfX;
  const qx = Math.abs(x - TRACK.x) - TRACK.halfX + r;
  const qz = Math.abs(z - TRACK.z) - TRACK.halfZ + r;
  return Math.hypot(Math.max(qx, 0), Math.max(qz, 0)) + Math.min(Math.max(qx, qz), 0) - r;
}

/** Tepe yarıçapı `radius` olan ağaç buraya sığar mı: plakada (yola taşmaz), yapılardan, sahalardan ve lambalardan uzak. */
function treeAllowed(x: number, z: number, radius: number, lamps: number[]) {
  if (!inBox(LOT, x, z, -radius)) return false;
  const island = islandBoxes.some((b) => inBox(b, x, z));
  if (SOLID.some((b) => (island && b === PARKING ? false : inBox(b, x, z, radius + 0.5)))) return false;
  if (!island && PAVED.some((b) => inBox(b, x, z, radius * 0.5 + 1))) return false;
  if (trackDistance(x, z) < radius + 1) return false;
  if (Math.hypot(x - FLAG.x, z - FLAG.z) < radius + 3) return false;
  if (Math.hypot(x - GARDEN_C.x, z - GARDEN_C.z) < GARDEN_C.radius + 2) return false;
  if (inBox(GARDEN, x, z) && (Math.abs(x - GARDEN_C.x) < 3 || Math.abs(z - GARDEN_C.z) < 3)) return false;
  if (GARDEN_BENCHES.some(([bx, bz]) => Math.hypot(x - bx, z - bz) < 2)) return false;
  if (FLOODLIGHTS.some(([fx, fz]) => Math.hypot(x - fx, z - fz) < radius + 1.5)) return false;
  for (let i = 0; i < lamps.length; i += 3) if (Math.hypot(x - lamps[i], z - lamps[i + 2]) < radius + 1) return false;
  return true;
}

/** Ağaç planı. `crown`: boy çarpanı 1 olan ağacın tepe yarıçapı (replantTrees'in boy dağılımıyla). */
function plantTrees(crown: number, lamps: number[]): TreeSpot[] {
  const trees: TreeSpot[] = [];
  const free = (x: number, z: number, spacing: number) => trees.every(([tx, tz]) => Math.hypot(tx - x, tz - z) > spacing);
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

  // Otopark adacıkları: küçük ağaç (tepe komşu arabalara taşmasın diye boy sınırlı).
  for (const b of islandBoxes) trees.push([(b.x0 + b.x1) / 2, (b.z0 + b.z1) / 2, 0.25]);
  // Tören alanının iki ucunda ağaç havuzları (döşemenin içinde, ızgara düzeninde).
  for (const b of PIT_GROVES) {
    for (let x = b.x0 + PIT / 2; x < b.x1; x += PIT) {
      for (let z = b.z0 + PIT / 2; z < b.z1; z += PIT) trees.push([x, z, 0.62]);
    }
  }
  // Giriş aksının iki yanında dizi.
  for (let z = AXIS.z0 + 6; z < AXIS.z1 - 4; z += 10) {
    add(AXIS.x0 - 5, z, 7, [0.8, 0.62]);
    add(AXIS.x1 + 5, z, 7, [0.8, 0.62]);
  }
  // Tören alanının güney kenarında dizi (binanın ve aksın önü açık).
  for (let x = CEREMONY.x0 + 6; x < CEREMONY.x1; x += 12) if (Math.abs(x - FLAG.x) > 14) add(x, CEREMONY.z0 + 6, 9, [0.8, 0.62]);
  // Kuzey kenarında ve batı kenarında dizi (plakanın içinde, yola taşmaz).
  for (let x = LOT.x0 + 6; x < LOT.x1 - 4; x += 10) add(x + jitter(x, 1), -553, 7, [0.8, 0.62]);
  for (let z = -540; z < -384; z += 10) add(40, z + jitter(z, 2), 7);
  // Bahçe avlusu: kenarları boyunca ve dairenin çevresinde.
  for (let x = GARDEN.x0 + 7; x < GARDEN.x1 - 4; x += 11) {
    add(x, GARDEN.z0 + 8, 8, [0.8, 0.62]);
    add(x, GARDEN.z1 - 8, 8, [0.8, 0.62]);
  }
  for (let z = GARDEN.z0 + 19; z < GARDEN.z1 - 15; z += 11) {
    add(GARDEN.x0 + 8, z, 8, [0.8, 0.62]);
    add(GARDEN.x1 - 8, z, 8, [0.8, 0.62]);
  }
  // Oyun avlusunun kuzey ucunda ve yemekhanenin önünde küçük ağaçlar.
  for (let x = PLAYYARD.x0 + 4; x < PLAYYARD.x1; x += 9) add(x, -543, 6, [0.62]);
  scatter({ x0: CANTEEN.x0, x1: CANTEEN.x1, z0: CANTEEN.z1, z1: GYM.z0 }, 16, 9, 60, [0.8, 0.62]);
  // Batı çimi (tören alanıyla otopark arası), otoparkın güneyi.
  scatter({ x0: LOT.x0, x1: AXIS.x0, z0: CEREMONY.z0, z1: PARKING.z0 }, 40, 12, 70);
  for (let x = LOT.x0 + 6; x < AXIS.x0 - 4; x += 10) add(x, LOT.z1 - 7, 8, [0.8, 0.62]);
  // Doğu çiminde koru ve tek tük ağaçlar, güney sokağı boyunca dizi.
  for (let k = 0; k < 18; k++) {
    const r = 22 * Math.sqrt((k + 0.5) / 18) * (0.8 + 0.4 * hash2(k, 90));
    const a = k * 2.39996;
    add(190 + Math.cos(a) * r, -330 + Math.sin(a) * r, 6.5);
  }
  scatter({ x0: AXIS.x1, x1: COURT_PAD.x0, z0: CEREMONY.z0, z1: LOT.z1 }, 40, 11, 80);
  for (let x = AXIS.x1 + 6; x < LOT.x1 - 4; x += 10) add(x, LOT.z1 - 7, 8, [0.8, 0.62]);
  // Pistle kortlar arası, kuzeydoğu korusu.
  for (let x = 330; x < LOT.x1 - 4; x += 12) add(x, -330, 9, [0.8, 0.62]);
  scatter(GROVE_NE, 30, 7, 100, [0.8, 0.62]);
  return trees;
}

/** Lambalar: aks, tören alanı, salon önü ve yollar, otopark, avlular; pist ve kortlarda projektörler. */
function schoolLamps(): number[] {
  const lamps: number[] = [];
  const low = GROUND_Y + 4.5;
  const tall = GROUND_Y + 8;
  for (let z = AXIS.z0 + 8; z < AXIS.z1; z += 20) lamps.push(AXIS.x0 - 0.8, low, z, AXIS.x1 + 0.8, low, z);
  for (let x = CEREMONY.x0 + 8; x < CEREMONY.x1; x += 24) if (Math.abs(x - FLAG.x) > 10) lamps.push(x, low, CEREMONY.z1 - 1);
  lamps.push(270, low, APRON.z1 - 1, APRON.x1 - 1, low, -404);
  for (let z = PATH_N.z0 + 10; z < PATH_N.z1 - 10; z += 24) if (!inBox(WALKWAY, PATH_N.x0, z, 3)) lamps.push(PATH_N.x0 - 0.8, low, z);
  for (const z of [-370, -345]) lamps.push(PATH_C.x0 - 0.8, low, z);
  for (const x of [52, 72]) lamps.push(x, tall, -306, x, tall, -288);
  for (const [dx, dz] of [[-7, -7], [7, -7], [-7, 7], [7, 7]]) lamps.push(GARDEN_C.x + dx, low, GARDEN_C.z + dz);
  for (const x of [PLAYYARD.x0 - 1, PLAYYARD.x1 + 1]) lamps.push(x, low, -520, x, low, -494);
  for (const [x, z] of FLOODLIGHTS) lamps.push(x, GROUND_Y + FLOOD_HEIGHT + 0.5, z);
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

const REPLACED = /^School_(Ground|Classrooms|Roofs|Entrance|SportsHall|Playground|Track)$/;
const OWN = /^School_(Ground|Props|Main|Hall|Gym|Wings|Canteen)$/;

/**
 * Okulu yeniden kurar: modeldeki zemin, derslik kutuları, çatılar, giriş, salon, avlu lekeleri ve pist kaldırılır. Yerine
 * tek düzlem zemin (School_Ground, rengi SCHOOL_FRAGMENT ile cityRuntime çizer), binalar, parçalar, otopark araçları ve
 * ağaçlar gelir. Lamba konumlarını döndürür. Hazırlık ikinci kez çalışırsa (StrictMode) tekrar etmez. Araçlar
 * createTraffic'ten sonra kurulur (park etmiş araç mesh'lerinden).
 */
export function landscapeSchool(cityRoot: THREE.Object3D, treeScale: number): number[] {
  const done = cityRoot.userData.schoolLamps as number[] | undefined;
  if (done) return done;
  cityRoot.updateMatrixWorld(true);
  const ground = cityRoot.getObjectByName('School_Ground');
  const hall = cityRoot.getObjectByName('School_SportsHall');
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
    !(hall instanceof THREE.Mesh) ||
    !facade ||
    Array.isArray(ground.material) ||
    Array.isArray(hall.material)
  ) {
    return [];
  }

  const parent = ground.parent ?? cityRoot;
  for (const mesh of removed) {
    mesh.removeFromParent();
    mesh.geometry.dispose();
  }
  // Zemin: aynı yükseklikte tek plaka (eski asfalt ve yol yamaları gider), LANDSCAPES malzemeyi klonlayıp yamar.
  const site = new THREE.Mesh(plane(LOT, GROUND_Y), ground.material);
  site.name = 'School_Ground';
  site.userData = { groundLayered: true };
  // Parçalar salonun satin malzemesini paylaşır (köşe renkli, kreşteki oyun ekipmanları gibi).
  const props = new THREE.Mesh(propsGeometry(), hall.material);
  props.name = 'School_Props';
  for (const mesh of [site, props, ...buildingMeshes(facade)]) parent.add(mesh);
  // Araçlar şehrin park etmiş araçlarının yanına (Traffic_ adıyla: trafik, LOD ve insanlar onları öyle tanır).
  for (const mesh of vehicleMeshes(cityRoot)) parent.add(mesh);
  // Yeni parçalar dünya koordinatında kuruldu: ebeveynin dönüşümü birim olmalı.
  parent.updateMatrixWorld(true);
  if (!parent.matrixWorld.equals(new THREE.Matrix4())) {
    const inverse = parent.matrixWorld.clone().invert();
    for (const child of parent.children) {
      if (OWN.test(child.name) || child.name.startsWith('Traffic_School_')) child.applyMatrix4(inverse);
    }
  }

  const lamps = schoolLamps();
  replantTrees(cityRoot, {
    prefix: 'School',
    inside: (x, z) => inBox(SITE, x, z),
    spots: plantTrees(crownRadius(cityRoot, treeScale), lamps),
    treeScale,
  });
  cityRoot.updateMatrixWorld(true);
  cityRoot.userData.schoolLamps = lamps;
  return lamps;
}
