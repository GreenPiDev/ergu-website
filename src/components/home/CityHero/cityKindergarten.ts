// Kreşin yeniden düzenlenmesi (alan x -163..13, z 184..393, çit x -158.5..8.5, z 191.5..385.5).
// Modeldeki kreş 176×209 m'lik tek renk bir çimin üstüne serpiştirilmiş sekiz küçük kutu pavyon, düz bir gölgelik ve doygun
// renkli zemin lekelerinden oluşuyordu. Şehrin geri kalanı ince taneli ve işlenmiş olduğundan kreş maket parçası gibi
// okunuyordu. Model değişmeden açılışta yeniden kurulur:
// - Bina: girişte iki katlı idare holü, arkasında tek katlı koridor (sırt), sırttan bahçeye uzanan dört beşik çatılı sınıf
//   kanadı. Şehir binalarıyla aynı kütle ve cephe işçiliği (cityMass.ts, CITY_FACE), bütün kanatlar aynı duvar ve çatı
//   rengini alır (CITY_PALETTE).
// - Zemin (shader): kanatlar arasında kauçuk zeminli avlular ve kum havuzu, kanatların ucunda ahşap teras, bahçede bisiklet
//   parkuru, ortada oyun meydanı, kuzeyde küçükler oyun alanı, güneyde sebze bahçesi ve meyve bahçesi, giriş meydanı,
//   otopark ve çit boyunca çit bitkisi.
// - Oyun ekipmanları (kule, kaydırak, salıncak, gölgelik), çit boyunca ve bahçede ağaçlar, parkur ve meydan boyunca lambalar.
// Yerleşim planı aşağıdaki sabitlerde tek yerde tanımlanır. GLSL ve TypeScript tarafı aynı ölçüleri kullanır.
import * as THREE from 'three';
import { MassBuilder, PropBuilder } from './cityMass';
import { type TreeSpot, hash2, replantTrees } from './cityTrees';

interface Box {
  x0: number;
  x1: number;
  z0: number;
  z1: number;
}

const FENCE: Box = { x0: -158.5, x1: 8.5, z0: 191.5, z1: 385.5 };
const SITE: Box = { x0: -163, x1: 13, z0: 184, z1: 393 };
// Modeldeki otopark ve üstündeki araçlar yerinde kalır.
const PARKING: Box = { x0: -157.5, x1: -129.5, z0: 237, z1: 337 };
// Binanın önünde, otoparkla bina arasında taş döşeli giriş meydanı. Kuzeyde oyun alanına, güneyde sebze bahçesine bağlanır.
const FORECOURT: Box = { x0: -129.5, x1: -118, z0: 224, z1: 350 };
// Zemin yüksekliği (Kindergarten_Ground) ve binaların oturduğu taban.
const GROUND_Y = 0.8;
const BASE_Y = 0.5;

// Bina: sırt koridoru, idare holü ve sınıf kanatları (metre).
const SPINE: Box & { height: number } = { x0: -118, x1: -106, z0: 238.5, z1: 338.5, height: 4.6 };
const HALL: Box & { height: number } = { x0: -123, x1: -103, z0: 276, z1: 301, height: 8.6 };
const WING = { x0: -106, x1: -78, halfWidth: 6.5, wall: 4.2, ridge: 7.4, centers: [245, 271, 306, 332] };
// Kanatların ucunda ahşap teras.
const TERRACE: Box = { x0: -78, x1: -71, z0: 236, z1: 341 };

// Kanatlar arasındaki avlular: kauçuk zemin (renk GLSL'de), ortadakinde kum havuzu.
const COURTS: Box[] = [
  { x0: -105, x1: -80, z0: 253, z1: 263 },
  { x0: -105, x1: -80, z0: 279.5, z1: 297.5 },
  { x0: -105, x1: -80, z0: 314, z1: 324 },
];
const SANDPIT = { x: -92, z: 288.5, radius: 5 };

// Bisiklet parkuru: köşeleri yuvarlatılmış dikdörtgen (merkez çizgisi), içinde çim ve oyun meydanı.
const LOOP = { x: -33, z: 288.5, halfX: 27, halfZ: 78, radius: 20, width: 3.2 };
const PLAZA = { x: -33, z: 288.5, radius: 11 };
// Terastan parkura giden yollar (z), genişlik.
const LINKS = [258, 288.5, 319];
const LINK_WIDTH = 3;
// Kuzeyde küçükler oyun alanı.
const NURSERY = { x: -118, z: 213, halfX: 30, halfZ: 13, radius: 7 };
// Güneyde sebze bahçesi ve meyve bahçesi.
const GARDEN: Box = { x0: -152, x1: -112, z0: 351, z1: 376 };
const ORCHARD: Box = { x0: -104, x1: -68, z0: 349, z1: 379 };

const f = (value: number) => value.toFixed(2);
const box = (b: Box) => `vec2(${f((b.x0 + b.x1) / 2)}, ${f((b.z0 + b.z1) / 2)}), vec2(${f((b.x1 - b.x0) / 2)}, ${f((b.z1 - b.z0) / 2)})`;

/** Kreş planının mesafe fonksiyonları (GLSL, global kapsamda). */
export const KINDERGARTEN_GLSL = `
// Köşeleri r yarıçapla yuvarlatılmış kutuya işaretli uzaklık (içeride negatif).
float kgBox(vec2 p, vec2 c, vec2 h, float r){ vec2 q = abs(p - c) - h + r; return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r; }
float kgIn(float d, float aa){ return 1.0 - smoothstep(-aa, aa, d); }
`;

const COURT_COLORS = ['vec3(0.4, 0.17, 0.1)', 'vec3(0.22, 0.3, 0.2)', 'vec3(0.48, 0.32, 0.12)'];

/** Kreş zemini: Kindergarten_Ground'un rengi tamamen dünya konumundan çizilir (köşe renkleri yok sayılır). */
export const KINDERGARTEN_FRAGMENT = `#include <color_fragment>
  {
    vec2 p = vWPos.xz;
    float aa = max(fwidth(p.x), fwidth(p.y)) * 0.8 + 0.05;
    float fine = 1.0 - smoothstep(0.8, 2.5, aa);
    float n1 = fbm(p * 0.02);
    float n2 = fbm(p * 0.09 + 3.0);
    // Kauçuk ve taş yüzeylerde ince benek (piksel altına inince söner).
    float grain = 0.94 + 0.12 * h12(floor(p * 3.0)) * fine;

    // Çim: parktaki gibi biçme şeritleri ve geniş ton farkları.
    vec3 c = vec3(0.12, 0.19, 0.065) * (0.82 + 0.36 * n1);
    c *= 1.0 + (step(0.5, fract((p.x * 0.2 + p.y) / 9.0)) - 0.5) * 0.12 * (1.0 - smoothstep(2.0, 5.0, aa));

    // Meyve bahçesi: biçilmemiş uzun ot.
    float orchard = kgIn(kgBox(p, ${box(ORCHARD)}, 3.0), aa);
    c = mix(c, vec3(0.17, 0.19, 0.07) * (0.8 + 0.4 * n2), orchard);

    // Çit boyunca çit bitkisi (otopark ve giriş meydanı tarafı hariç).
    float edge = min(min(p.x - ${f(FENCE.x0)}, ${f(FENCE.x1)} - p.x), min(p.y - ${f(FENCE.z0)}, ${f(FENCE.z1)} - p.y));
    float front = step(p.x, ${f(FORECOURT.x1)}) * step(${f(FORECOURT.z0)}, p.y) * step(p.y, ${f(FORECOURT.z1)});
    float hedge = kgIn(edge - 2.4 + (n2 - 0.5) * 0.8, aa) * (1.0 - front);
    c = mix(c, vec3(0.055, 0.095, 0.035) * (0.7 + 0.6 * fbm(p * 0.45)), hedge);

    // Otopark: asfalt ve açık renkli bordür.
    float pd = kgBox(p, ${box(PARKING)}, 0.5);
    c = mix(c, vec3(0.2, 0.195, 0.19) * (0.88 + 0.24 * n2), kgIn(pd, aa));
    c = mix(c, vec3(0.5, 0.48, 0.45), kgIn(abs(pd) - 0.3, aa) * fine);

    // Giriş meydanı: taş döşeme, 1.5 m derzler.
    vec2 jc = abs(fract(p / 1.5) - 0.5) * 2.0;
    float joint = smoothstep(0.86, 0.94, max(jc.x, jc.y)) * fine;
    float court = kgIn(kgBox(p, ${box(FORECOURT)}, 1.0), aa);
    c = mix(c, vec3(0.52, 0.49, 0.44) * grain * (1.0 - 0.12 * joint), court);

    // Kanatların ucundaki ahşap teras: z boyunca uzanan tahtalar.
    float plank = smoothstep(0.8, 0.95, abs(fract(p.y / 0.6) - 0.5) * 2.0) * fine;
    float deck = kgIn(kgBox(p, ${box(TERRACE)}, 0.4), aa);
    c = mix(c, vec3(0.34, 0.25, 0.17) * (0.9 + 0.2 * n2) * (1.0 - 0.18 * plank), deck);

    // Terastan parkura giden çakıl yollar.
    float link = 1e4;
    ${LINKS.map((z) => `link = min(link, kgBox(p, vec2(${f((TERRACE.x1 + LOOP.x - LOOP.halfX) / 2)}, ${f(z)}), vec2(${f((LOOP.x - LOOP.halfX - TERRACE.x1) / 2 + 0.5)}, ${f(LINK_WIDTH / 2)}), 0.2));`).join('\n    ')}
    c = mix(c, vec3(0.5, 0.46, 0.38) * (0.9 + 0.2 * n2), kgIn(link, aa));

    // Bisiklet parkuru: koyu kauçuk asfalt, kenarlarda açık bordür, ortada kesik çizgi.
    float loopLine = kgBox(p, vec2(${f(LOOP.x)}, ${f(LOOP.z)}), vec2(${f(LOOP.halfX)}, ${f(LOOP.halfZ)}), ${f(LOOP.radius)});
    float track = abs(loopLine) - ${f(LOOP.width / 2)};
    c = mix(c, vec3(0.27, 0.26, 0.26) * (0.9 + 0.2 * n2), kgIn(track, aa));
    c = mix(c, vec3(0.55, 0.53, 0.5), kgIn(abs(track) - 0.2, aa) * fine * 0.8);
    float dash = step(0.5, fract((p.x + p.y) / 4.0));
    c = mix(c, vec3(0.75, 0.72, 0.66), kgIn(abs(loopLine) - 0.15, aa) * dash * fine);

    // Ortadaki oyun meydanı: arduvaz mavisi kauçuk, aşı sarısı halka.
    float pr = length(p - vec2(${f(PLAZA.x)}, ${f(PLAZA.z)}));
    vec3 rubber = vec3(0.2, 0.27, 0.33) * grain;
    rubber = mix(rubber, vec3(0.48, 0.32, 0.12) * grain, kgIn(abs(pr - 7.5) - 0.9, aa));
    c = mix(c, rubber, kgIn(pr - ${f(PLAZA.radius)}, aa));
    c = mix(c, vec3(0.5, 0.48, 0.45), kgIn(abs(pr - ${f(PLAZA.radius)}) - 0.25, aa) * fine);

    // Kanatlar arasındaki avlular: her biri kendi renginde kauçuk, açık renkli kenar.
    ${COURTS.map((b, i) => `{ float d = kgBox(p, ${box(b)}, 1.5); c = mix(c, ${COURT_COLORS[i]} * grain, kgIn(d, aa)); c = mix(c, vec3(0.55, 0.53, 0.5), kgIn(abs(d) - 0.25, aa) * fine); }`).join('\n    ')}

    // Küçükler oyun alanı: kum renkli kauçuk üstünde renkli adacıklar ve kum havuzu.
    vec2 nc = vec2(${f(NURSERY.x)}, ${f(NURSERY.z)});
    float nd = kgBox(p, nc, vec2(${f(NURSERY.halfX)}, ${f(NURSERY.halfZ)}), ${f(NURSERY.radius)});
    vec3 soft = vec3(0.42, 0.32, 0.22) * grain;
    soft = mix(soft, vec3(0.22, 0.3, 0.2) * grain, kgIn(length(p - nc - vec2(-14.0, -2.0)) - 6.0, aa));
    soft = mix(soft, vec3(0.2, 0.27, 0.33) * grain, kgIn(length(p - nc - vec2(2.0, 4.0)) - 5.0, aa));
    soft = mix(soft, vec3(0.62, 0.52, 0.36) * grain, kgIn(length(p - nc - vec2(18.0, -1.0)) - 5.0, aa));
    c = mix(c, soft, kgIn(nd, aa));
    c = mix(c, vec3(0.55, 0.53, 0.5), kgIn(abs(nd) - 0.25, aa) * fine);

    // Kum havuzu: taş kenarlı.
    float sd = length(p - vec2(${f(SANDPIT.x)}, ${f(SANDPIT.z)})) - ${f(SANDPIT.radius)};
    c = mix(c, vec3(0.62, 0.52, 0.36) * (0.92 + 0.16 * n2), kgIn(sd, aa));
    c = mix(c, vec3(0.44, 0.42, 0.38), kgIn(abs(sd) - 0.35, aa));

    // Sebze bahçesi: çakıl kenar, içinde sıra sıra toprak ve ekin. Sıralar seçilemeyecek kadar uzaksa ortalama ton.
    float gd = kgBox(p, ${box(GARDEN)}, 1.0);
    float row = fract((p.y - ${f(GARDEN.z0)}) / 1.6);
    float rowId = floor((p.y - ${f(GARDEN.z0)}) / 1.6);
    float rowHash = h12(vec2(rowId, 4.7));
    vec3 crop = rowHash < 0.4 ? vec3(0.13, 0.2, 0.06) : rowHash < 0.75 ? vec3(0.22, 0.29, 0.09) : vec3(0.24, 0.15, 0.12);
    crop *= 0.8 + 0.4 * n2;
    vec3 soil = vec3(0.17, 0.11, 0.07) * (0.9 + 0.2 * n2);
    float rowAa = max(fwidth(row), 1e-4);
    float cropMask = mix(0.55, smoothstep(0.3 - rowAa, 0.3 + rowAa, row) * (1.0 - smoothstep(0.85 - rowAa, 0.85 + rowAa, row)), fine);
    vec3 bed = mix(soil, crop, cropMask);
    c = mix(c, vec3(0.5, 0.46, 0.38) * (0.9 + 0.2 * n2), kgIn(gd, aa));
    c = mix(c, bed, kgIn(gd + 1.2, aa));

    diffuseColor.rgb = c;
  }`;

// ------------------------------------------------------------------ bina

// Duvar ve çatı paleti (FACADE_FRAGMENT eşikleriyle): kanatlar krem sıva ve koyu kiremit, sırt ve hol kırık beyaz ve yeşil
// çatı.
const WING_PALETTE = 'vec2(0.4, 0.7)';
const CORE_PALETTE = 'vec2(0.1, 0.9)';

/** Kanat: tek katlık duvar ve sırtı uzun kenar boyunca beşik çatı (birim küpte duvar payı). */
function wingGeometry() {
  const wall = -1 + (2 * WING.wall) / WING.ridge;
  return new MassBuilder().box(-1, 1, -1, wall, -1, 1, false).pitchedRoof(wall, 1, true, 1).build();
}

/** İdare holü: iki kat, çatıda tesisat kulesi. */
function hallGeometry() {
  return new MassBuilder().box(-1, 1, -1, 0.88, -1, 1).box(-0.5, 0.1, 0.88, 1, -0.4, 0.3).build();
}

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
  const core = material(CORE_PALETTE);
  const wings = new THREE.InstancedMesh(wingGeometry(), material(WING_PALETTE), WING.centers.length);
  wings.name = 'Kindergarten_Wings';
  WING.centers.forEach((z, index) =>
    wings.setMatrixAt(
      index,
      blockMatrix({ x0: WING.x0, x1: WING.x1, z0: z - WING.halfWidth, z1: z + WING.halfWidth }, WING.ridge),
    ),
  );
  const spine = new THREE.InstancedMesh(new MassBuilder().box(-1, 1, -1, 1, -1, 1).build(), core, 1);
  spine.name = 'Kindergarten_Spine';
  spine.setMatrixAt(0, blockMatrix(SPINE, SPINE.height));
  const hall = new THREE.InstancedMesh(hallGeometry(), core, 1);
  hall.name = 'Kindergarten_Hall';
  hall.setMatrixAt(0, blockMatrix(HALL, HALL.height));
  return [wings, spine, hall];
}

// ------------------------------------------------------------------ oyun ekipmanları

// Kırık tonlar: şehrin paletinden kopmayan, doygunluğu düşük çocuk renkleri.
const PROP = {
  terracotta: '#b9775a',
  ochre: '#c9a35e',
  sage: '#8fa385',
  slate: '#7f98a8',
  wood: '#a88a68',
  white: '#e6e1d6',
  steel: '#8c8f92',
};

function playTower(props: PropBuilder, x: number, z: number, roof: string) {
  const y = GROUND_Y;
  props.box(x - 1.3, x + 1.3, y, y + 3.0, z - 1.3, z + 1.3, PROP.wood);
  props.pyramid(x - 1.6, x + 1.6, y + 3.0, y + 4.6, z - 1.6, z + 1.6, roof);
}

function swing(props: PropBuilder, x0: number, x1: number, z: number) {
  const y = GROUND_Y;
  for (const x of [x0, x1]) {
    props.box(x - 0.15, x + 0.15, y, y + 3.0, z - 1.4, z - 1.1, PROP.steel);
    props.box(x - 0.15, x + 0.15, y, y + 3.0, z + 1.1, z + 1.4, PROP.steel);
  }
  props.box(x0 - 0.15, x1 + 0.15, y + 2.8, y + 3.1, z - 0.15, z + 0.15, PROP.steel);
}

function propsGeometry() {
  const props = new PropBuilder();
  const y = GROUND_Y;
  // Oyun meydanı: köprüyle bağlı iki kule ve kaydırak.
  playTower(props, PLAZA.x - 4, PLAZA.z - 3, PROP.terracotta);
  playTower(props, PLAZA.x + 4, PLAZA.z + 3, PROP.ochre);
  props.box(PLAZA.x - 2.7, PLAZA.x + 2.7, y + 2.6, y + 3.0, PLAZA.z - 0.6, PLAZA.z + 0.6, PROP.wood);
  props.ramp(PLAZA.x + 5.3, y + 2.8, PLAZA.x + 9.5, y + 0.4, PLAZA.z + 2.5, PLAZA.z + 3.5, 0.2, PROP.slate);
  // Küçükler oyun alanı: kule ve kaydırak, salıncak.
  playTower(props, NURSERY.x - 14, NURSERY.z - 2, PROP.sage);
  props.ramp(NURSERY.x - 12.7, y + 2.8, NURSERY.x - 8.5, y + 0.4, NURSERY.z - 2.5, NURSERY.z - 1.5, 0.2, PROP.terracotta);
  swing(props, NURSERY.x + 1, NURSERY.x + 7, NURSERY.z + 4);
  playTower(props, NURSERY.x + 18, NURSERY.z + 6, PROP.slate);
  // Kum renkli adacığın üstünde gölge yelkeni ve iki tahterevalli.
  const sail = { x: NURSERY.x + 18, z: NURSERY.z - 1 };
  for (const [dx, dz] of [[-3, -3], [3, -3], [3, 3], [-3, 3]]) {
    props.box(sail.x + dx - 0.12, sail.x + dx + 0.12, y, y + 3.0, sail.z + dz - 0.12, sail.z + dz + 0.12, PROP.steel);
  }
  props.box(sail.x - 3.2, sail.x + 3.2, y + 3.0, y + 3.12, sail.z - 3.2, sail.z + 3.2, PROP.white);
  for (const dz of [-6, -9]) {
    props.box(NURSERY.x + 4, NURSERY.x + 4.4, y, y + 0.6, NURSERY.z + dz - 0.2, NURSERY.z + dz + 0.2, PROP.steel);
    props.box(NURSERY.x + 2, NURSERY.x + 6.4, y + 0.6, y + 0.8, NURSERY.z + dz - 0.25, NURSERY.z + dz + 0.25, PROP.terracotta);
  }
  // Avlular: birinde kule, birinde salıncak. Kum havuzunun üstünde gölgelik.
  playTower(props, -93, (COURTS[0].z0 + COURTS[0].z1) / 2, PROP.ochre);
  swing(props, -98, -92, (COURTS[2].z0 + COURTS[2].z1) / 2);
  const s = SANDPIT;
  for (const [dx, dz] of [[-3.4, -3.4], [3.4, -3.4], [3.4, 3.4], [-3.4, 3.4]]) {
    props.box(s.x + dx - 0.12, s.x + dx + 0.12, y, y + 3.2, s.z + dz - 0.12, s.z + dz + 0.12, PROP.steel);
  }
  props.box(s.x - 3.6, s.x + 3.6, y + 3.2, y + 3.35, s.z - 3.6, s.z + 3.6, PROP.white);
  // Sebze bahçesinin köşesinde alet kulübesi.
  props.box(GARDEN.x0 + 1.5, GARDEN.x0 + 5.5, y, y + 2.4, GARDEN.z1 - 4.5, GARDEN.z1 - 1.5, PROP.wood);
  props.pyramid(GARDEN.x0 + 1.2, GARDEN.x0 + 5.8, y + 2.4, y + 3.4, GARDEN.z1 - 4.8, GARDEN.z1 - 1.2, PROP.terracotta);
  return props.build();
}

// ------------------------------------------------------------------ ağaçlar ve lambalar

const inBox = (b: Box, x: number, z: number, pad = 0) => x > b.x0 - pad && x < b.x1 + pad && z > b.z0 - pad && z < b.z1 + pad;

function loopDistance(x: number, z: number) {
  const qx = Math.abs(x - LOOP.x) - LOOP.halfX + LOOP.radius;
  const qz = Math.abs(z - LOOP.z) - LOOP.halfZ + LOOP.radius;
  return Math.hypot(Math.max(qx, 0), Math.max(qz, 0)) + Math.min(Math.max(qx, qz), 0) - LOOP.radius;
}

const BUILDING: Box = { x0: HALL.x0, x1: WING.x1, z0: SPINE.z0, z1: SPINE.z1 };

/** Ağaç dikilebilir mi: binadan, parkurdan, oyun alanlarından, otoparktan ve bahçe yataklarından uzak. */
function treeAllowed(x: number, z: number) {
  if (!inBox(FENCE, x, z, -3)) return false;
  if (inBox(BUILDING, x, z, 3) || inBox(PARKING, x, z, 1) || inBox(GARDEN, x, z, 2) || inBox(TERRACE, x, z, 2)) return false;
  if (Math.abs(loopDistance(x, z)) < LOOP.width / 2 + 2.5) return false;
  if (Math.hypot(x - PLAZA.x, z - PLAZA.z) < PLAZA.radius + 3) return false;
  if (Math.hypot(x - SANDPIT.x, z - SANDPIT.z) < SANDPIT.radius + 4) return false;
  if (LINKS.some((lz) => Math.abs(z - lz) < 4 && x > TERRACE.x1 && x < LOOP.x - LOOP.halfX)) return false;
  const nx = Math.abs(x - NURSERY.x) - NURSERY.halfX;
  const nz = Math.abs(z - NURSERY.z) - NURSERY.halfZ;
  return !(nx < 1 && nz < 1);
}

function plantTrees(): TreeSpot[] {
  const trees: TreeSpot[] = [];
  const free = (x: number, z: number, spacing: number) => trees.every(([tx, tz]) => Math.hypot(tx - x, tz - z) > spacing);
  const add = (x: number, z: number, spacing: number, size = 1) => {
    if (treeAllowed(x, z) && free(x, z, spacing)) trees.push([x, z, size]);
  };
  const jitter = (a: number, b: number) => (hash2(a, b) - 0.5) * 2;

  // Çit boyunca ağaç dizisi (çit bitkisinin hemen içinde), giriş meydanı ve otopark tarafı hariç.
  const inset = 5;
  for (let x = FENCE.x0 + 6; x < FENCE.x1 - 4; x += 10) {
    add(x + jitter(x, 1), FENCE.z0 + inset, 7);
    add(x + jitter(x, 2), FENCE.z1 - inset, 7);
  }
  for (let z = FENCE.z0 + 14; z < FENCE.z1 - 12; z += 10) {
    add(FENCE.x1 - inset, z + jitter(z, 3), 7);
    if (z < FORECOURT.z0 - 4 || z > FORECOURT.z1 + 4) add(FENCE.x0 + inset, z + jitter(z, 4), 7);
  }
  // Giriş meydanının otopark kenarında gölge ağaçları (girişin önü açık).
  for (let z = FORECOURT.z0 + 8; z < FORECOURT.z1 - 4; z += 11) {
    if (z < HALL.z0 - 6 || z > HALL.z1 + 6) trees.push([FORECOURT.x0 + 2, z, 0.9]);
  }
  // Teras ile parkur arasında dizi.
  for (let z = TERRACE.z0; z <= TERRACE.z1; z += 11) add((TERRACE.x1 + LOOP.x - LOOP.halfX) / 2, z + jitter(z, 5), 7);
  // Korular: parkurun içinde iki uçta, küçükler oyun alanının doğusunda.
  const groves: [number, number, number][] = [
    [LOOP.x, LOOP.z - 52, 10],
    [LOOP.x, LOOP.z + 52, 10],
    [(NURSERY.x + NURSERY.halfX + LOOP.x - LOOP.halfX) / 2, NURSERY.z + 2, 9],
  ];
  groves.forEach(([gx, gz, radius], g) => {
    for (let k = 0; k < 16; k++) {
      const r = radius * Math.sqrt((k + 0.5) / 16) * (0.8 + 0.4 * hash2(g, k + 20));
      const a = k * 2.39996 + hash2(g, 14) * 6.28;
      add(gx + Math.cos(a) * r, gz + Math.sin(a) * r, 5.5);
    }
  });
  // Parkurun içi: korularla oyun meydanı arasındaki çimde tek tük ağaçlar (büyük boş çim kalmasın).
  for (let i = 0; i < 40; i++) {
    const x = LOOP.x + (hash2(i, 40) - 0.5) * (LOOP.halfX - 6) * 2;
    const z = LOOP.z + (hash2(i, 41) - 0.5) * (LOOP.halfZ - 8) * 2;
    add(x, z, 13);
  }
  // Meyve bahçesi: düzenli sıralar, küçük ağaçlar.
  for (let x = ORCHARD.x0 + 4; x <= ORCHARD.x1 - 3; x += 7) {
    for (let z = ORCHARD.z0 + 5; z <= ORCHARD.z1 - 3; z += 7) add(x, z, 4, 0.62);
  }
  return trees;
}

/** Lambalar: parkurun dış kenarı ve giriş meydanı boyunca. */
function kindergartenLamps(): number[] {
  const lamps: number[] = [];
  const height = 4.5;
  const offset = LOOP.width / 2 + 0.8;
  // Parkurun merkez çizgisi boyunca ~24 m arayla, dış kenarda: düz kenarlar ve köşe yayları.
  const hx = LOOP.halfX - LOOP.radius;
  const hz = LOOP.halfZ - LOOP.radius;
  const r = LOOP.radius + offset;
  const segments: [number, number, number, number][] = [
    [-hx, -hz - r, hx, -hz - r],
    [hx + r, -hz, hx + r, hz],
    [hx, hz + r, -hx, hz + r],
    [-hx - r, hz, -hx - r, -hz],
  ];
  for (const [ax, az, bx, bz] of segments) {
    const length = Math.hypot(bx - ax, bz - az);
    const count = Math.max(1, Math.round(length / 24));
    for (let i = 0; i <= count; i++) {
      lamps.push(LOOP.x + ax + ((bx - ax) * i) / count, height, LOOP.z + az + ((bz - az) * i) / count);
    }
  }
  for (const [cx, cz, start] of [[hx, -hz, -Math.PI / 2], [hx, hz, 0], [-hx, hz, Math.PI / 2], [-hx, -hz, Math.PI]]) {
    const a = start + Math.PI / 4;
    lamps.push(LOOP.x + cx + Math.cos(a) * r, height, LOOP.z + cz + Math.sin(a) * r);
  }
  for (let z = FORECOURT.z0 + 4; z <= FORECOURT.z1 - 4; z += 20) lamps.push(FORECOURT.x1 - 1, height, z);
  return lamps;
}

// ------------------------------------------------------------------ kurulum

const REPLACED = /^Kindergarten_(Pavilions|Roofs|Canopy|PlayGarden|PlayStructures)$/;

/**
 * Kreşi yeniden kurar: modeldeki pavyonlar, gölgelik, oyun lekeleri ve ekipmanlar kaldırılır, yeni bina, ekipman ve ağaçlar
 * eklenir. Zemin rengi KINDERGARTEN_FRAGMENT ile çizilir (cityRuntime Kindergarten_Ground'a uygular). Lamba konumlarını
 * döndürür (ışık noktaları ve ışık havuzları için). Hazırlık ikinci kez çalışırsa (StrictMode) tekrar etmez.
 */
export function landscapeKindergarten(cityRoot: THREE.Object3D, treeScale: number): number[] {
  const done = cityRoot.userData.kindergartenLamps as number[] | undefined;
  if (done) return done;
  const ground = cityRoot.getObjectByName('Kindergarten_Ground');
  let facade: THREE.Material | null = null;
  let satin: THREE.Material | null = null;
  const removed: THREE.Mesh[] = [];
  cityRoot.traverse((object) => {
    if (!(object instanceof THREE.Mesh)) return;
    if (!facade && object instanceof THREE.InstancedMesh && object.name.startsWith('Residential_Buildings_')) {
      facade = object.material as THREE.Material;
    }
    if (REPLACED.test(object.name)) {
      removed.push(object);
      if (object.name === 'Kindergarten_PlayStructures') satin = object.material as THREE.Material;
    }
  });
  if (!ground || !facade || !satin) return [];

  const parent = ground.parent ?? cityRoot;
  for (const mesh of removed) {
    mesh.removeFromParent();
    mesh.geometry.dispose();
  }
  for (const mesh of buildingMeshes(facade)) {
    mesh.instanceMatrix.needsUpdate = true;
    parent.add(mesh);
  }
  const props = new THREE.Mesh(propsGeometry(), satin);
  props.name = 'Kindergarten_Play';
  parent.add(props);
  // Yeni parçalar dünya koordinatında kuruldu: ebeveynin dönüşümü birim olmalı.
  parent.updateMatrixWorld(true);
  if (!parent.matrixWorld.equals(new THREE.Matrix4())) {
    const inverse = parent.matrixWorld.clone().invert();
    for (const child of parent.children) {
      if (/^Kindergarten_(Wings|Spine|Hall|Play)$/.test(child.name)) child.applyMatrix4(inverse);
    }
  }

  replantTrees(cityRoot, { prefix: 'Kindergarten', inside: (x, z) => inBox(SITE, x, z), spots: plantTrees(), treeScale });
  cityRoot.updateMatrixWorld(true);
  const lamps = kindergartenLamps();
  cityRoot.userData.kindergartenLamps = lamps;
  return lamps;
}
