// Konut bölgesinin mahalle merkezinin yeniden düzenlenmesi (B6 bloğu, alan x -163..13, z 407..610, zemin plakası
// x -159.5..9.5, z 410.5..606.5). Modelde 169×196 m'lik tek ton bej bir plakanın üstünde 8 üçgenlik iki kutu (80×40 m
// alçak bir merkez ve 150 m boyunca kesintisiz bir konut bloğu), düz turkuaz bir disk havuz ve serpiştirilmiş 14 ağaç
// vardı. Yanındaki sık dokulu konut bloklarının yanında boş bir maket tablası gibi okunuyordu. Model değişmeden açılışta
// yeniden kurulur:
// - Mahalle konağı (iki katlı L plan, yeşil çatı) ve spor salonu (arduvaz beşik çatı), aralarında giriş holü.
// - Güneyde çarşılı konut: tek katlı dükkân tabanı (meydana bakan tenteler), üstünde farklı boylarda üç blok.
// - Doğuda semt pazarı: beş sundurma, altında tezgâh sıraları, kuzey ucunda pazarcı kamyonları.
// - Zemin (shader): granit ızgaralı meydan ve dikdörtgen yansıma havuzu, konak önü, gezinti yolu, otopark, basketbol
//   sahası, çocuk oyun alanı, mahalle bostanı, koru, konut bahçeleri, köşe meydanı, çit bitkisi.
// - Otoparkta arabalar, ağaç dizileri ve koru, meydan ve yollar boyunca lambalar.
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

const SITE: Box = { x0: -163, x1: 13, z0: 407, z1: 610 };
// Bloğun zemin plakası: çevresi kaldırım.
const LOT: Box = { x0: -159.5, x1: 9.5, z0: 410.5, z1: 606.5 };
// Zemin yüksekliği (modeldeki Residential_Ground ile aynı) ve binaların oturduğu taban.
const GROUND_Y = 0.78;
const BASE_Y = 0.5;

// ---- kuzey şeridi: otopark, basketbol sahası, çocuk oyun alanı
const PARKING: Box = { x0: -155, x1: -97, z0: 415, z1: 433 };
const BAY = 2.6;
const ROWS = [
  { z0: 415, z1: 420.5, facing: 1 },
  { z0: 427.5, z1: 433, facing: -1 },
];
// Otopark girişi kuzey sokağından (kuzey sıra bu aralıkta boş).
const DRIVE: Box = { x0: -131, x1: -124, z0: LOT.z0, z1: 420.5 };
// Ağaç adacıkları: bu park yerinden başlayan iki park yeri genişliğinde çim ve ağaç.
const ISLANDS = [5, 16];
const inIsland = (k: number) => ISLANDS.some((s) => k === s || k === s + 1);
const COURT_PAD: Box = { x0: -90, x1: -56, z0: 414, z1: 437 };
const COURT = { x: -73, z: 425.5, halfX: 14, halfZ: 7.5 };
const PLAY = { x: -37.5, z: 426, halfX: 12.5, halfZ: 12, radius: 6 };
// Parkla konak arasında doğu-batı gezinti yolu (batı sokağından pazara).
const PROMENADE: Box = { x0: LOT.x0, x1: -21, z0: 441, z1: 447 };

// ---- semt pazarı
const MARKET: Box = { x0: -21, x1: 7, z0: 413, z1: 556 };
// Kamyonların girdiği kuzey kapısı.
const MARKET_GATE: Box = { x0: -18, x1: 4, z0: LOT.z0, z1: 414 };
const TRUCKS = [-13, -5, 3].map((x) => [x, 423] as const);
const SHED = { x0: -17, x1: 3, z0: 434, length: 20, gap: 4.5, count: 5, eave: 4.6, ridge: 6.6 };
const SHEDS: Box[] = Array.from({ length: SHED.count }, (_, i) => {
  const z0 = SHED.z0 + i * (SHED.length + SHED.gap);
  return { x0: SHED.x0, x1: SHED.x1, z0, z1: z0 + SHED.length };
});
// Tezgâh sıraları (x aralıkları): batı, ortada sırt sırta çift sıra, doğu.
const STALL_ROWS: [number, number][] = [
  [-16, -13.6],
  [-9.4, -7],
  [-7, -4.6],
  [-0.4, 2],
];

// ---- mahalle konağı ve spor salonu
const HALL: Box & { height: number } = { x0: -120, x1: -78, z0: 452, z1: 474, height: 8.6 };
const LIBRARY: Box & { height: number } = { x0: -120, x1: -102, z0: 474, z1: 490, height: 7.4 };
const FOYER: Box & { height: number } = { x0: -78, x1: -66, z0: 456, z1: 470, height: 4.6 };
const GYM = { x0: -66, x1: -36, z0: 450, z1: 488, wall: 9, ridge: 12.5 };
const FORECOURT: Box = { x0: -102, x1: -36, z0: 474, z1: 494 };

// ---- meydan
const SQUARE: Box = { x0: -124, x1: -26, z0: 494, z1: 556 };
const POOL: Box = { x0: -96, x1: -62, z0: 513, z1: 529 };
const POOL_KERB = 1.1;
const CAFE: Box = { x0: -44, x1: -36, z0: 506, z1: 514 };
const UMBRELLAS: [number, number][] = [-48, -39.5, -31].flatMap((x) => [523, 532, 541].map((z): [number, number] => [x, z]));
const BENCHES: [number, number][] = [-90, -79, -68].flatMap((x): [number, number][] => [
  [x + 0.5, POOL.z0 - 3.5],
  [x + 0.5, POOL.z1 + 3.5],
]);

// ---- batı: mahalle bostanı ve koru
const BOSTAN: Box = { x0: -156, x1: -128, z0: 451, z1: 514 };
const BEDS = { cols: [-154, -145, -136], width: 6, depth: 2.2, step: 4.4, z0: 459, z1: 512 };
const TOOL_SHED: Box = { x0: -155, x1: -150.5, z0: 452, z1: 456 };
const PERGOLA: Box = { x0: -142, x1: -130, z0: 452, z1: 457 };
const PATH_W: Box = { x0: LOT.x0, x1: SQUARE.x0, z0: 519, z1: 524 };
const GROVE: Box = { x0: -156, x1: -128, z0: 527, z1: 554 };

// ---- güney: çarşılı konut, konut bahçeleri, köşe meydanı
const PODIUM: Box & { height: number } = { x0: -150, x1: -12, z0: 562, z1: 580, height: 5 };
const BLOCKS: (Box & { height: number; variant: 'penthouse' | 'penthouseB' })[] = [
  { x0: -148, x1: -110, z0: 563.5, z1: 578.5, height: 17.3, variant: 'penthouse' },
  { x0: -100, x1: -64, z0: 564, z1: 578, height: 13.8, variant: 'penthouseB' },
  { x0: -54, x1: -14, z0: 563.5, z1: 578.5, height: 20.7, variant: 'penthouse' },
];
const ARCADE: Box = { x0: LOT.x0, x1: -10, z0: 556, z1: 562 };
const GARDENS: Box = { x0: LOT.x0, x1: -10, z0: 580, z1: LOT.z1 };
const CORNER: Box = { x0: -10, x1: LOT.x1, z0: 556, z1: LOT.z1 };

const f = (value: number) => value.toFixed(2);
const box = (b: Box) => `vec2(${f((b.x0 + b.x1) / 2)}, ${f((b.z0 + b.z1) / 2)}), vec2(${f((b.x1 - b.x0) / 2)}, ${f((b.z1 - b.z0) / 2)})`;
const inBox = (b: Box, x: number, z: number, pad = 0) => x > b.x0 - pad && x < b.x1 + pad && z > b.z0 - pad && z < b.z1 + pad;

/** Mahalle merkezi planının mesafe fonksiyonları (GLSL, global kapsamda). */
export const HOUSING_GLSL = `
// Köşeleri r yarıçapla yuvarlatılmış kutuya işaretli uzaklık (içeride negatif).
float hsBox(vec2 p, vec2 c, vec2 h, float r){ vec2 q = abs(p - c) - h + r; return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r; }
float hsIn(float d, float aa){ return 1.0 - smoothstep(-aa, aa, d); }
// Eşit aralıklı çizgiler (metre): çizgi seçilemeyecek kadar uzaksa ortalama yoğunluğuna söner.
float hsLines(float v, float period, float width, float aa){
  float d = abs(fract(v / period + 0.5) - 0.5) * period;
  float line = 1.0 - smoothstep(width * 0.5 - aa, width * 0.5 + aa, d);
  return mix(width / period, line, 1.0 - smoothstep(width * 0.6, width * 1.5, aa));
}
`;

const parkingBays = ROWS.map(
  (r) =>
    `bays = max(bays, hsLines(p.x - ${f(PARKING.x0)}, ${f(BAY)}, 0.15, aa) * step(${f(PARKING.x0)}, p.x) * step(p.x, ${f(PARKING.x1)}) * step(${f(r.z0)}, p.y) * step(p.y, ${f(r.z1)}));`,
).join('\n    ');
const islandBoxes: Box[] = ROWS.flatMap((r) =>
  ISLANDS.map((k) => ({ x0: PARKING.x0 + BAY * k, x1: PARKING.x0 + BAY * (k + 2), z0: r.z0, z1: r.z1 })),
);

/** Mahalle merkezi zemini: Housing_Ground'un rengi tamamen dünya konumundan çizilir (köşe renkleri yok sayılır). */
export const HOUSING_FRAGMENT = `#include <color_fragment>
  {
    vec2 p = vWPos.xz;
    float aa = max(fwidth(p.x), fwidth(p.y)) * 0.8 + 0.05;
    float fine = 1.0 - smoothstep(0.8, 2.5, aa);
    float n1 = fbm(p * 0.02);
    float n2 = fbm(p * 0.09 + 11.0);
    // Taş, beton ve kauçukta ince benek (piksel altına inince söner).
    float grain = 0.94 + 0.12 * h12(floor(p * 3.0)) * fine;
    vec3 rimColor = vec3(0.55, 0.53, 0.5);

    // Çim: parktaki gibi biçme şeritleri ve geniş ton farkları.
    vec3 c = vec3(0.12, 0.19, 0.065) * (0.82 + 0.36 * n1);
    c *= 1.0 + (step(0.5, fract((p.x * 0.2 + p.y) / 9.0)) - 0.5) * 0.12 * (1.0 - smoothstep(2.0, 5.0, aa));

    // Blok kenarında çit bitkisi (döşeli girişler aşağıda üstüne çizilir).
    float edge = min(min(p.x - ${f(LOT.x0)}, ${f(LOT.x1)} - p.x), min(p.y - ${f(LOT.z0)}, ${f(LOT.z1)} - p.y));
    float hedge = hsIn(edge - 2.4 + (n2 - 0.5) * 0.8, aa);
    c = mix(c, vec3(0.055, 0.095, 0.035) * (0.7 + 0.6 * fbm(p * 0.45)), hedge);

    vec3 gravel = vec3(0.4, 0.34, 0.25) * (0.88 + 0.24 * n2) * grain;
    float joint = max(hsLines(p.x, 1.2, 0.08, aa), hsLines(p.y, 1.2, 0.08, aa));
    vec3 stone = vec3(0.52, 0.49, 0.44) * grain * (0.94 + 0.12 * n2) * (1.0 - 0.1 * joint);
    vec3 granite = vec3(0.27, 0.26, 0.25) * grain;

    // Mahalle bostanı: yataklar arasında sıcak tonlu çakıl (yataklar ayrı parça).
    c = mix(c, gravel, hsIn(hsBox(p, ${box(BOSTAN)}, 1.0), aa));
    // Koruda çakıl yol, batı sokağından meydana yol.
    c = mix(c, gravel, hsIn(abs(p.x - ${f((GROVE.x0 + GROVE.x1) / 2)} + (p.y - ${f(GROVE.z0)}) * 0.35) - 1.2, aa) * step(${f(GROVE.z0)}, p.y) * step(p.y, ${f(GROVE.z1)}));
    c = mix(c, gravel, hsIn(hsBox(p, ${box(PATH_W)}, 0.3), aa));

    // Otopark: asfalt, park çizgileri, açık bordür, adacıklar çim.
    float pd = min(hsBox(p, ${box(PARKING)}, 0.8), hsBox(p, ${box(DRIVE)}, 0.0));
    c = mix(c, vec3(0.2, 0.195, 0.19) * (0.88 + 0.24 * n2), hsIn(pd, aa));
    float bays = 0.0;
    ${parkingBays}
    c = mix(c, rimColor, bays);
    c = mix(c, rimColor, hsIn(abs(hsBox(p, ${box(PARKING)}, 0.8)) - 0.25, aa) * fine);
    ${islandBoxes.map((b) => `{ float d = hsBox(p, ${box(b)}, 0.6); c = mix(c, vec3(0.1, 0.17, 0.06) * (0.85 + 0.3 * n2), hsIn(d + 0.3, aa)); c = mix(c, rimColor, hsIn(abs(d + 0.15) - 0.15, aa) * fine); }`).join('\n    ')}

    // Basketbol sahası: koyu yeşil gri akrilik çevre, kırık kiremit saha, açık çizgiler.
    float cp = hsBox(p, ${box(COURT_PAD)}, 1.0);
    c = mix(c, vec3(0.16, 0.21, 0.18) * grain, hsIn(cp, aa));
    vec2 cq = p - vec2(${f(COURT.x)}, ${f(COURT.z)});
    float court = hsBox(p, vec2(${f(COURT.x)}, ${f(COURT.z)}), vec2(${f(COURT.halfX)}, ${f(COURT.halfZ)}), 0.0);
    c = mix(c, vec3(0.38, 0.2, 0.14) * grain, hsIn(court, aa));
    float lines = hsIn(abs(court) - 0.08, aa) + hsIn(abs(cq.x) - 0.08, aa) * hsIn(court, aa) + hsIn(abs(length(cq) - 1.8) - 0.08, aa);
    // Üç sayı yayları ve boyalı alanlar (iki potada).
    vec2 hq = vec2(${f(COURT.halfX)} - abs(cq.x) - 1.6, cq.y);
    lines += hsIn(abs(length(hq) - 6.75) - 0.08, aa) * step(0.0, hq.x + 1.6) * step(hq.x, 6.0) * hsIn(court, aa);
    float key = hsBox(vec2(abs(cq.x), cq.y), vec2(${f(COURT.halfX - 2.9)}, 0.0), vec2(2.9, 2.45), 0.0);
    c = mix(c, vec3(0.2, 0.27, 0.33) * grain, hsIn(key, aa));
    lines += hsIn(abs(key) - 0.08, aa);
    c = mix(c, vec3(0.72, 0.7, 0.64), clamp(lines, 0.0, 1.0) * fine);
    c = mix(c, rimColor, hsIn(abs(cp) - 0.25, aa) * fine);

    // Çocuk oyun alanı: kum renkli kauçuk üstünde renkli adacıklar.
    vec2 pc = vec2(${f(PLAY.x)}, ${f(PLAY.z)});
    float pl = hsBox(p, pc, vec2(${f(PLAY.halfX)}, ${f(PLAY.halfZ)}), ${f(PLAY.radius)});
    vec3 soft = vec3(0.42, 0.32, 0.22) * grain;
    soft = mix(soft, vec3(0.22, 0.3, 0.2) * grain, hsIn(length(p - pc - vec2(-5.0, -4.0)) - 5.0, aa));
    soft = mix(soft, vec3(0.2, 0.27, 0.33) * grain, hsIn(length(p - pc - vec2(5.0, 5.0)) - 4.5, aa));
    c = mix(c, soft, hsIn(pl, aa));
    c = mix(c, rimColor, hsIn(abs(pl) - 0.25, aa) * fine);

    // Semt pazarı: derzli beton (6 m), tezgâh önlerinde boyalı şerit, kuzey kapısı.
    float md = min(hsBox(p, ${box(MARKET)}, 0.6), hsBox(p, ${box(MARKET_GATE)}, 0.0));
    float mj = max(hsLines(p.x, 6.0, 0.1, aa), hsLines(p.y, 6.0, 0.1, aa));
    c = mix(c, vec3(0.42, 0.41, 0.39) * grain * (0.94 + 0.12 * n2) * (1.0 - 0.15 * mj), hsIn(md, aa));
    float stall = 0.0;
    ${STALL_ROWS.map(([x0, x1]) => `stall += hsIn(abs(abs(p.x - ${f((x0 + x1) / 2)}) - ${f((x1 - x0) / 2 + 0.3)}) - 0.06, aa);`).join('\n    ')}
    stall *= step(${f(SHED.z0)}, p.y) * step(p.y, ${f(SHEDS[SHEDS.length - 1].z1)});
    c = mix(c, vec3(0.6, 0.55, 0.42), clamp(stall, 0.0, 1.0) * fine * 0.7);

    // Gezinti yolu, konak önü, meydan, dükkân önü, köşe meydanı: açık taş (1.2 m derz).
    float paved = min(min(hsBox(p, ${box(PROMENADE)}, 0.3), hsBox(p, ${box(FORECOURT)}, 1.0)), min(hsBox(p, ${box(SQUARE)}, 1.5), min(hsBox(p, ${box(ARCADE)}, 0.3), hsBox(p, ${box(CORNER)}, 0.3))));
    c = mix(c, stone, hsIn(paved, aa));
    // Meydanda havuzun eksenine hizalı 10 m'lik granit ızgara.
    float grid = max(hsLines(p.x - ${f((POOL.x0 + POOL.x1) / 2)}, 10.0, 0.4, aa), hsLines(p.y - ${f((POOL.z0 + POOL.z1) / 2)}, 10.0, 0.4, aa));
    c = mix(c, granite, grid * hsIn(hsBox(p, ${box(SQUARE)}, 1.5), aa) * 0.55);
    // Köşe meydanında çapraz granit bant (sokak köşesinden meydana giriş).
    c = mix(c, granite * (1.0 + 0.15 * n2), hsIn(abs((p.x - ${f(CORNER.x1)}) + (p.y - ${f(CORNER.z1)}) * 0.9 + 6.0) - 1.4, aa) * hsIn(hsBox(p, ${box(CORNER)}, 0.3), aa) * 0.8);
    // Dükkân önünde granit bordür.
    c = mix(c, granite, hsIn(abs(p.y - ${f(ARCADE.z0 + 0.4)}) - 0.3, aa) * step(${f(ARCADE.x0)}, p.x) * step(p.x, ${f(ARCADE.x1)}));

    // Havuzun taş bordürü (su yüzeyi bordürün içinde, Housing_Pool).
    float pool = hsBox(p, ${box(POOL)}, 0.8);
    c = mix(c, vec3(0.6, 0.57, 0.52) * grain, hsIn(abs(pool - ${f(POOL_KERB / 2)}) - ${f(POOL_KERB / 2)}, aa));
    c = mix(c, vec3(0.2, 0.3, 0.32), hsIn(pool, aa));

    diffuseColor.rgb = c;
  }`;

// ------------------------------------------------------------------ binalar

// Duvar ve çatı paleti (FACADE_FRAGMENT eşikleriyle). Değerler kreş, sera ve kültür merkeziyle aynı: aynı değer aynı cephe
// programını paylaşır, açılışta ek cephe shader'ı derlenmez. Konak ve spor salonu kırık beyaz duvar, yeşil düz ve arduvaz
// beşik çatı; çarşılı konut krem sıva ve açık membran (yüksek bloklar cephe shader'ında betona doğru karışır).
const CIVIC_PALETTE = 'vec2(0.1, 0.9)';
const HOUSING_PALETTE = 'vec2(0.4, 0.7)';

function blockMatrix(b: Box, height: number, base = BASE_Y) {
  const hy = height / 2;
  return new THREE.Matrix4().compose(
    new THREE.Vector3((b.x0 + b.x1) / 2, base + hy, (b.z0 + b.z1) / 2),
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
  const housing = material(HOUSING_PALETTE);
  const instanced = (name: string, geometry: THREE.BufferGeometry, mat: THREE.Material, matrices: THREE.Matrix4[]) => {
    const mesh = new THREE.InstancedMesh(geometry, mat, matrices.length);
    mesh.name = name;
    matrices.forEach((m, i) => mesh.setMatrixAt(i, m));
    mesh.instanceMatrix.needsUpdate = true;
    return mesh;
  };
  // Düz çatıda tesisat kulesi (konak ve kütüphane kanadı).
  const plantRoom = new MassBuilder().box(-1, 1, -1, 0.88, -1, 1).box(-0.5, 0.1, 0.88, 1, -0.4, 0.3).build();
  // Spor salonu: duvar ve mahyası kuzey-güney beşik çatı (birim küpte duvar payı).
  const wall = -1 + (2 * GYM.wall) / GYM.ridge;
  const gym = new MassBuilder().box(-1, 1, -1, wall, -1, 1, false).pitchedRoof(wall, 1, false, 1).build();
  const podiumTop = BASE_Y + PODIUM.height;
  const meshes = [
    instanced('Housing_Hall', plantRoom, civic, [blockMatrix(HALL, HALL.height), blockMatrix(LIBRARY, LIBRARY.height)]),
    instanced('Housing_Foyer', MASS_VARIANTS.plain().build(), civic, [blockMatrix(FOYER, FOYER.height)]),
    instanced('Housing_Gym', gym, civic, [blockMatrix(GYM, GYM.ridge)]),
    instanced('Housing_Podium', MASS_VARIANTS.plain().build(), housing, [blockMatrix(PODIUM, PODIUM.height)]),
  ];
  for (const variant of ['penthouse', 'penthouseB'] as const) {
    const blocks = BLOCKS.filter((b) => b.variant === variant);
    meshes.push(
      instanced(
        `Housing_Blocks_${variant}`,
        MASS_VARIANTS[variant]().build(),
        housing,
        blocks.map((b) => blockMatrix(b, b.height, podiumTop - 0.1)),
      ),
    );
  }
  return meshes;
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
  canvas: '#ddd6c8',
  soil: '#4a3828',
  leaf: '#5d6e45',
  crate: '#9a7a55',
};
const AWNINGS = [TONE.terracotta, TONE.canvas, TONE.sage, TONE.ochre, TONE.slate, TONE.canvas];
const PRODUCE = ['#6f7d48', '#a9784a', '#8e4f3f', '#b59a55', '#5f7044', '#a0663f'];

/** Semt pazarı: sundurmalar (ince çelik dikmeler, açık gri beşik çatı, mahyada havalandırma) ve tezgâhlar. */
function marketProps(props: PropBuilder) {
  const y = GROUND_Y;
  const mid = (SHED.x0 + SHED.x1) / 2;
  for (const [s, shed] of SHEDS.entries()) {
    // Dikmeler: uzun kenarlarda ~5 m arayla.
    const n = Math.round(SHED.length / 5);
    for (let i = 0; i <= n; i++) {
      const z = shed.z0 + 0.3 + ((shed.z1 - shed.z0 - 0.6) * i) / n;
      for (const x of [shed.x0 + 0.4, shed.x1 - 0.4]) props.box(x - 0.15, x + 0.15, y, y + SHED.eave, z - 0.15, z + 0.15, TONE.steel);
    }
    props.ramp(shed.x0 - 0.6, y + SHED.eave - 0.1, mid, y + SHED.ridge, shed.z0 - 0.4, shed.z1 + 0.4, 0.18, TONE.roof);
    props.ramp(shed.x1 + 0.6, y + SHED.eave - 0.1, mid, y + SHED.ridge, shed.z0 - 0.4, shed.z1 + 0.4, 0.18, TONE.roof);
    props.box(mid - 0.9, mid + 0.9, y + SHED.ridge - 0.05, y + SHED.ridge + 0.5, shed.z0 + 1, shed.z1 - 1, TONE.ridge);
    // Tezgâhlar: masa, üstünde ürün kasaları, bir kısmının üstünde tente.
    for (const [r, [x0, x1]] of STALL_ROWS.entries()) {
      for (let z = shed.z0 + 1; z + 2.4 <= shed.z1 - 0.8; z += 2.7) {
        const h = hash2(s * 7 + r, z);
        if (h < 0.12) continue;
        props.box(x0, x1, y, y + 0.85, z, z + 2.4, TONE.wood);
        props.box(x0 + 0.15, x1 - 0.15, y + 0.85, y + 1.05, z + 0.15, z + 2.25, PRODUCE[Math.floor(hash2(z, r + s) * PRODUCE.length)]);
        if (h > 0.55) {
          const out = r === 0 || r === 2 ? 1 : -1;
          const ax = out > 0 ? x1 : x0;
          props.ramp(ax - out * 2.6, y + 2.6, ax + out * 0.4, y + 2.1, z + 0.1, z + 2.3, 0.06, AWNINGS[Math.floor(h * 97) % AWNINGS.length]);
        }
      }
    }
  }
  // Kamyonların yanında kasa yığınları.
  for (const [i, [tx, tz]] of TRUCKS.entries()) {
    const x = tx + 2.4;
    for (let k = 0; k < 3; k++) {
      const z = tz - 4 + k * 1.3 + (i % 2) * 0.4;
      props.box(x - 0.5, x + 0.5, y, y + 0.6 * (1 + (k % 2)), z - 0.5, z + 0.5, TONE.crate);
    }
  }
}

function playTower(props: PropBuilder, x: number, z: number, roof: string) {
  const y = GROUND_Y;
  props.box(x - 1.3, x + 1.3, y, y + 3.0, z - 1.3, z + 1.3, TONE.wood);
  props.pyramid(x - 1.6, x + 1.6, y + 3.0, y + 4.6, z - 1.6, z + 1.6, roof);
}

/** Basketbol potası: direk, kol ve pano (sahanın içine bakar). */
function hoop(props: PropBuilder, x: number, z: number, dir: number) {
  const y = GROUND_Y;
  props.box(x - 0.15, x + 0.15, y, y + 3.6, z - 0.15, z + 0.15, TONE.steel);
  props.box(Math.min(x, x + dir * 1.1), Math.max(x, x + dir * 1.1), y + 3.4, y + 3.55, z - 0.1, z + 0.1, TONE.steel);
  props.box(x + dir * 1.1 - 0.06, x + dir * 1.1 + 0.06, y + 2.9, y + 4.0, z - 0.9, z + 0.9, TONE.white);
}

function bench(props: PropBuilder, x: number, z: number, alongX: boolean) {
  const y = GROUND_Y;
  const [hx, hz] = alongX ? [0.9, 0.3] : [0.3, 0.9];
  props.box(x - hx, x + hx, y + 0.3, y + 0.45, z - hz, z + hz, TONE.wood);
  props.box(x - hx * 0.85, x + hx * 0.85, y, y + 0.3, z - hz * 0.7, z + hz * 0.7, TONE.steel);
}

function propsGeometry() {
  const props = new PropBuilder();
  const y = GROUND_Y;
  marketProps(props);

  // Basketbol sahası: iki pota, saha boyunca bank.
  hoop(props, COURT.x - COURT.halfX - 1.2, COURT.z, 1);
  hoop(props, COURT.x + COURT.halfX + 1.2, COURT.z, -1);
  for (const x of [COURT.x - 6, COURT.x + 6]) bench(props, x, COURT_PAD.z1 - 1.2, true);

  // Çocuk oyun alanı: köprülü iki kule, kaydırak, salıncak, tahterevalli.
  playTower(props, PLAY.x - 5, PLAY.z - 4, TONE.terracotta);
  playTower(props, PLAY.x + 1, PLAY.z - 4, TONE.ochre);
  props.box(PLAY.x - 3.7, PLAY.x - 0.3, y + 2.6, y + 3.0, PLAY.z - 4.6, PLAY.z - 3.4, TONE.wood);
  props.ramp(PLAY.x + 2.3, y + 2.8, PLAY.x + 6.5, y + 0.4, PLAY.z - 4.5, PLAY.z - 3.5, 0.2, TONE.slate);
  for (const x of [PLAY.x + 2, PLAY.x + 8]) {
    props.box(x - 0.15, x + 0.15, y, y + 3.0, PLAY.z + 3.6, PLAY.z + 3.9, TONE.steel);
    props.box(x - 0.15, x + 0.15, y, y + 3.0, PLAY.z + 6.1, PLAY.z + 6.4, TONE.steel);
  }
  props.box(PLAY.x + 1.85, PLAY.x + 8.15, y + 2.8, y + 3.1, PLAY.z + 4.85, PLAY.z + 5.15, TONE.steel);
  props.box(PLAY.x - 6.5, PLAY.x - 6.1, y, y + 0.6, PLAY.z + 5.8, PLAY.z + 6.2, TONE.steel);
  props.box(PLAY.x - 8.5, PLAY.x - 4.1, y + 0.6, y + 0.8, PLAY.z + 5.75, PLAY.z + 6.25, TONE.sage);
  for (const x of [PLAY.x - 9, PLAY.x + 9]) bench(props, x, PLAY.z - PLAY.halfZ + 1.5, true);

  // Meydan: havuz kenarında banklar, çay ocağı köşkü (geniş saçaklı), şemsiyeli masalar.
  for (const [x, z] of BENCHES) bench(props, x, z, true);
  props.box(CAFE.x0, CAFE.x1, y, y + 3.2, CAFE.z0, CAFE.z1, TONE.white);
  props.box(CAFE.x0 - 1.5, CAFE.x1 + 1.5, y + 3.2, y + 3.5, CAFE.z0 - 1.5, CAFE.z1 + 1.5, TONE.ridge);
  for (const [i, [x, z]] of UMBRELLAS.entries()) {
    props.box(x - 0.6, x + 0.6, y, y + 0.75, z - 0.6, z + 0.6, TONE.white);
    props.box(x - 0.06, x + 0.06, y + 0.75, y + 2.4, z - 0.06, z + 0.06, TONE.steel);
    props.pyramid(x - 1.6, x + 1.6, y + 2.3, y + 2.9, z - 1.6, z + 1.6, [TONE.terracotta, TONE.sage, TONE.slate, TONE.canvas][Math.floor(hash2(x, z + i) * 4)]);
  }

  // Mahalle bostanı: alet kulübesi ve pergola (yataklar ayrı mesh, bedsGeometry).
  const t = TOOL_SHED;
  props.box(t.x0, t.x1, y, y + 2.4, t.z0, t.z1, TONE.wood);
  props.pyramid(t.x0 - 0.3, t.x1 + 0.3, y + 2.4, y + 3.3, t.z0 - 0.3, t.z1 + 0.3, TONE.terracotta);
  const g = PERGOLA;
  for (const x of [g.x0 + 0.3, (g.x0 + g.x1) / 2, g.x1 - 0.3]) {
    for (const z of [g.z0 + 0.3, g.z1 - 0.3]) props.box(x - 0.15, x + 0.15, y, y + 2.8, z - 0.15, z + 0.15, TONE.wood);
  }
  for (let x = g.x0; x <= g.x1; x += 1.2) props.box(x - 0.08, x + 0.08, y + 2.8, y + 3.0, g.z0 - 0.3, g.z1 + 0.3, TONE.wood);
  for (const x of [g.x0 + 3, g.x1 - 3]) bench(props, x, (g.z0 + g.z1) / 2, true);

  // Koruda banklar, dükkânların önünde tenteler (dükkân başına ~8 m, aralarda boşluk).
  for (const [x, z] of [[-150, 536], [-136, 546], [-146, 550]] as const) bench(props, x, z, false);
  for (let x = PODIUM.x0 + 1, k = 0; x + 7 <= PODIUM.x1 - 1; x += 8.5, k++) {
    props.ramp(x, y + 3.4, x + 7, y + 3.4, PODIUM.z0 - 2.2, PODIUM.z0, 0.12, AWNINGS[k % AWNINGS.length]);
  }
  // Köşe meydanında banklar.
  for (const [x, z] of [[-4, 566], [-4, 586]] as const) bench(props, x, z, false);
  return props.build();
}

/** Mahalle bostanı: ahşap çerçeveli yükseltilmiş yataklar (toprak veya ekin). İnsanlar üstüne çıkmaz (cityPeople WATER). */
function bedsGeometry() {
  const props = new PropBuilder();
  const y = GROUND_Y;
  for (const [c, x0] of BEDS.cols.entries()) {
    for (let z = BEDS.z0, r = 0; z + BEDS.depth <= BEDS.z1; z += BEDS.step, r++) {
      props.box(x0, x0 + BEDS.width, y, y + 0.4, z, z + BEDS.depth, TONE.wood);
      const top = hash2(c, r) < 0.3 ? TONE.soil : hash2(r, c) < 0.5 ? TONE.leaf : PRODUCE[(c + r) % PRODUCE.length];
      props.box(x0 + 0.15, x0 + BEDS.width - 0.15, y + 0.4, y + 0.5, z + 0.15, z + BEDS.depth - 0.15, top);
    }
  }
  return props.build();
}

// ------------------------------------------------------------------ araçlar

/** Otoparkta arabalar dik park, pazarın kuzey ucunda kamyonlar (şehrin park etmiş araçlarından, parkedVehicles). */
function vehicleMeshes(cityRoot: THREE.Object3D) {
  const colors = ['White', 'Silver', 'Graphite', 'Blue'];
  const cars: VehicleSpot[][] = colors.map(() => []);
  ROWS.forEach((row, r) => {
    for (let k = 0; ; k++) {
      const x = PARKING.x0 + BAY * (k + 0.5);
      if (x > PARKING.x1 - BAY / 2) break;
      if (inIsland(k)) continue;
      if (r === 0 && x > DRIVE.x0 - 0.5 && x < DRIVE.x1 + 0.5) continue;
      if (hash2(x, r + 23) < 0.25) continue;
      const h = hash2(x * 1.3, r + 7);
      cars[h < 0.38 ? 0 : h < 0.72 ? 1 : h < 0.9 ? 2 : 3].push([x, (row.z0 + row.z1) / 2, (row.facing * Math.PI) / 2]);
    }
  });
  const meshes = colors.map((color, i) => parkedVehicles(cityRoot, `Cars_${color}`, 'Housing', cars[i]));
  meshes.push(parkedVehicles(cityRoot, 'Trucks', 'Housing', TRUCKS.map(([x, z]) => [x, z, Math.PI / 2])));
  return meshes.filter((mesh) => mesh !== null);
}

// ------------------------------------------------------------------ ağaçlar ve lambalar

const pad = (b: Box, d: number): Box => ({ x0: b.x0 - d, x1: b.x1 + d, z0: b.z0 - d, z1: b.z1 + d });
// Ağaç dikilmeyen yerler: tepe bunların üstüne taşmaz.
const SOLID: Box[] = [
  HALL,
  LIBRARY,
  FOYER,
  GYM,
  PODIUM,
  pad(PODIUM, 2.4),
  { x0: SHED.x0 - 0.6, x1: SHED.x1 + 0.6, z0: SHED.z0 - 0.4, z1: SHEDS[SHEDS.length - 1].z1 + 0.4 },
  { x0: TRUCKS[0][0] - 2, x1: TRUCKS[TRUCKS.length - 1][0] + 3.5, z0: TRUCKS[0][1] - 6.5, z1: TRUCKS[0][1] + 6.5 },
  pad(CAFE, 1.5),
  pad(POOL, POOL_KERB),
  PARKING,
  COURT_PAD,
  { x0: PLAY.x - PLAY.halfX, x1: PLAY.x + PLAY.halfX, z0: PLAY.z - PLAY.halfZ, z1: PLAY.z + PLAY.halfZ },
  BOSTAN,
  PERGOLA,
  TOOL_SHED,
];
// Yollar: gövde uzakta, tepe kenara biraz taşabilir.
const PAVED: Box[] = [PROMENADE, PATH_W, DRIVE, MARKET];

/** Tepe yarıçapı `radius` olan ağaç buraya sığar mı: zemin plakasında (yola taşmaz), yapılardan, parçalardan ve lambalardan uzak. */
function treeAllowed(x: number, z: number, radius: number, lamps: number[], islands: Box[]) {
  if (!inBox(LOT, x, z, -radius)) return false;
  const island = islands.some((b) => inBox(b, x, z));
  if (SOLID.some((b) => (island && b === PARKING ? false : inBox(b, x, z, radius + 0.5)))) return false;
  if (!island && PAVED.some((b) => inBox(b, x, z, radius * 0.5 + 1))) return false;
  if (UMBRELLAS.some(([ux, uz]) => Math.hypot(x - ux, z - uz) < radius + 1.8)) return false;
  if (BENCHES.some(([bx, bz]) => Math.hypot(x - bx, z - bz) < 2)) return false;
  for (let i = 0; i < lamps.length; i += 3) if (Math.hypot(x - lamps[i], z - lamps[i + 2]) < radius + 1) return false;
  return true;
}

/** Ağaç planı. `crown`: boy çarpanı 1 olan ağacın ortalama tepe yarıçapı (replantTrees'in boy dağılımıyla). */
function plantTrees(crown: number, lamps: number[]): TreeSpot[] {
  const trees: TreeSpot[] = [];
  // Otopark adacıkları: ağacın tepesi park yerlerine taşabilir (araçlar tepenin altında kalır), komşu araçlara değil.
  const islands = islandBoxes;
  const free = (x: number, z: number, spacing: number) => trees.every(([tx, tz]) => Math.hypot(tx - x, tz - z) > spacing);
  // Sığmazsa daha küçük boy denenir (dar şeritlerde küçük ağaç).
  const add = (x: number, z: number, spacing: number, sizes = [1, 0.8, 0.62]) => {
    if (!free(x, z, spacing)) return;
    for (const size of sizes) {
      const radius = crown * size * (0.75 + 0.55 * hash2(x, z));
      if (treeAllowed(x, z, radius, lamps, islands)) {
        trees.push([x, z, size]);
        return;
      }
    }
  };
  const jitter = (a: number, b: number) => (hash2(a, b) - 0.5) * 2;
  // Otopark adacıkları: küçük ağaç (tepe komşu arabalara taşmasın diye boy sınırlı).
  for (const b of islands) trees.push([(b.x0 + b.x1) / 2, (b.z0 + b.z1) / 2, 0.25]);
  // Meydan: havuzu kuzeyden ve güneyden çerçeveleyen iki dizi, ortası (havuzun önü) açık.
  for (let x = SQUARE.x0 + 6; x < SQUARE.x1 - 4; x += 10) {
    add(x, SQUARE.z0 + 7, 8, [0.8, 0.62]);
    add(x, SQUARE.z1 - 7, 8, [0.8, 0.62]);
  }
  // Bostanla meydan arasında dizi, koruda küme.
  for (let z = BOSTAN.z0 + 2; z < BOSTAN.z1; z += 9) add(BOSTAN.x1 + 1.5, z, 7, [0.62]);
  for (let k = 0; k < 40; k++) add(GROVE.x0 + hash2(k, 80) * (GROVE.x1 - GROVE.x0), GROVE.z0 + hash2(k, 81) * (GROVE.z1 - GROVE.z0), 6.5, [0.8, 0.62]);
  // Konut bahçeleri: sokak boyunca dizi ve bloklar arasında tek tük.
  for (let x = GARDENS.x0 + 6; x < GARDENS.x1; x += 10) add(x + jitter(x, 2), (PODIUM.z1 + 2.4 + LOT.z1) / 2 + 1, 8);
  for (let x = LOT.x0 + 4; x < PODIUM.x0; x += 4) add(x, (ARCADE.z1 + GARDENS.z1) / 2, 7);
  // Köşe meydanı, gezinti yolunun kuzeyi, oyun alanı ve konak çevresi.
  // Köşe meydanı: iki sıra ağaç, çapraz giriş bandının çevresi.
  for (let z = CORNER.z0 + 6; z < CORNER.z1 - 3; z += 9) {
    add(CORNER.x0 + 5, z, 7, [0.8, 0.62]);
    add(CORNER.x1 - 5, z + 4.5, 7, [0.8, 0.62]);
  }
  // Konak önü: kütüphane kanadıyla spor salonu arasındaki döşemede ağaç karesi (girişin önü açık).
  for (const x of [FORECOURT.x0 + 7, FORECOURT.x0 + 17, FORECOURT.x0 + 27]) add(x, FORECOURT.z1 - 8, 7, [0.8, 0.62]);
  for (let x = PROMENADE.x0 + 4; x < PROMENADE.x1; x += 8) add(x + jitter(x, 3), PROMENADE.z0 - 3.5, 7);
  for (let z = HALL.z0; z < LIBRARY.z1; z += 9) add(HALL.x0 - 2, z, 7);
  for (const [x, z] of [[PLAY.x + PLAY.halfX + 3, PLAY.z], [GYM.x1 + 6, 460], [GYM.x1 + 6, 478]] as const) add(x, z, 7);
  return trees;
}

/** Lambalar: meydan çevresi ve havuz, gezinti yolu, otopark, pazar aralıkları, dükkân önü, köşe meydanı ve yollar. */
function housingLamps(): number[] {
  const lamps: number[] = [];
  const low = GROUND_Y + 4.5;
  const tall = GROUND_Y + 8;
  for (let x = SQUARE.x0 + 1; x <= SQUARE.x1 - 1; x += 16) {
    lamps.push(x, low, SQUARE.z0 + 1);
    lamps.push(x, low, SQUARE.z1 - 1);
  }
  for (const z of [512, 538]) lamps.push(SQUARE.x0 + 1, low, z);
  for (const [x, z] of [[POOL.x0 - 2.5, POOL.z0 - 2.5], [POOL.x1 + 2.5, POOL.z0 - 2.5], [POOL.x0 - 2.5, POOL.z1 + 2.5], [POOL.x1 + 2.5, POOL.z1 + 2.5]]) {
    lamps.push(x, low, z);
  }
  for (let x = PROMENADE.x0 + 10; x < PROMENADE.x1; x += 20) lamps.push(x, low, PROMENADE.z1 + 0.8);
  for (const x of [-148, -134, -112]) lamps.push(x, tall, (ROWS[0].z1 + ROWS[1].z0) / 2);
  for (let i = 0; i < SHEDS.length - 1; i++) {
    const z = (SHEDS[i].z1 + SHEDS[i + 1].z0) / 2;
    lamps.push(SHED.x0 + 0.5, low, z, SHED.x1 - 0.5, low, z);
  }
  lamps.push(-19, tall, MARKET.z0 + 2, 5, tall, MARKET.z0 + 2);
  for (let x = ARCADE.x0 + 12; x < ARCADE.x1; x += 22) lamps.push(x, low, ARCADE.z0 + 1);
  lamps.push(CORNER.x1 - 4, low, 562, CORNER.x0 + 3, low, 600);
  lamps.push(LOT.x0 + 6, low, PATH_W.z0 - 0.8, -134, low, PATH_W.z0 - 0.8);
  return lamps;
}

// ------------------------------------------------------------------ kurulum

/** Mesh'in bu alandaki üçgenlerini siler (dizinden çıkarır). Şehirle ortak mesh'ler (konut zemini, havuzlar) için. */
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

/** Dünya koordinatında yatay düzlem (köşe renkleri beyaz). */
function plane(b: Box, y: number) {
  const geometry = new THREE.PlaneGeometry(b.x1 - b.x0, b.z1 - b.z0).rotateX(-Math.PI / 2);
  geometry.translate((b.x0 + b.x1) / 2, y, (b.z0 + b.z1) / 2);
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(new Array(geometry.getAttribute('position').count * 3).fill(1), 3));
  return geometry;
}

const REPLACED = /^Residential_(CommunityCentre_(Facades|Roofs|RoofEquipment)|Facades|Roofs)$/;
const OWN = /^Housing_(Ground|Pool|Props|Beds|Hall|Foyer|Gym|Podium|Blocks_.+)$/;

/**
 * Mahalle merkezini yeniden kurar: modeldeki merkez kutusu, çatı ekipmanı ve uzun konut bloğu kaldırılır, ortak konut
 * zemininden ve havuz mesh'inden bu bloğun üçgenleri silinir. Yerine yeni zemin (Housing_Ground, rengi HOUSING_FRAGMENT
 * ile cityRuntime çizer), havuz, binalar, parçalar, araçlar ve ağaçlar gelir. Lamba konumlarını döndürür. Hazırlık ikinci
 * kez çalışırsa (StrictMode) tekrar etmez. Araçlar createTraffic'ten sonra kurulur (park etmiş araç mesh'lerinden).
 */
export function landscapeHousing(cityRoot: THREE.Object3D, treeScale: number): number[] {
  const done = cityRoot.userData.housingLamps as number[] | undefined;
  if (done) return done;
  cityRoot.updateMatrixWorld(true);
  const ground = cityRoot.getObjectByName('Residential_Ground');
  const pools = cityRoot.getObjectByName('Residential_Pools');
  let facade: THREE.Material | null = null;
  let water: THREE.Material | null = null;
  const removed: THREE.Mesh[] = [];
  cityRoot.traverse((object) => {
    if (!(object instanceof THREE.Mesh) || Array.isArray(object.material)) return;
    if (!facade && object instanceof THREE.InstancedMesh && object.name.startsWith('Residential_Buildings_')) {
      facade = object.material;
    }
    if (!water && object.material.name === 'Water') water = object.material;
    if (REPLACED.test(object.name)) removed.push(object);
  });
  if (
    !(ground instanceof THREE.Mesh) ||
    !(pools instanceof THREE.Mesh) ||
    !facade ||
    !water ||
    Array.isArray(ground.material) ||
    Array.isArray(pools.material)
  ) {
    return [];
  }

  for (const mesh of removed) {
    mesh.removeFromParent();
    mesh.geometry.dispose();
  }
  // Ortak mesh'lerde yalnızca bu bloğun üçgenleri silinir (diğer konut blokları ve havuzlar yerinde kalır).
  dropTriangles(ground, LOT);
  dropTriangles(pools, LOT);

  const parent = ground.parent ?? cityRoot;
  // Zemin: aynı yükseklikte tek plaka, LANDSCAPES malzemeyi klonlayıp yamar.
  const site = new THREE.Mesh(plane(LOT, GROUND_Y), ground.material);
  site.name = 'Housing_Ground';
  site.userData = { groundLayered: true };
  // Yansıma havuzu: şehrin su malzemesiyle düz yüzey, taş bordürün içinde.
  const pond = new THREE.Mesh(plane(POOL, GROUND_Y + 0.12), water);
  pond.name = 'Housing_Pool';
  pond.userData = { castShadow: false, groundLayered: true };
  // Parçalar havuzların satin malzemesini paylaşır (köşe renkli, kreşteki oyun ekipmanları gibi).
  const props = new THREE.Mesh(propsGeometry(), pools.material);
  props.name = 'Housing_Props';
  props.userData = { groundLayered: true };
  const beds = new THREE.Mesh(bedsGeometry(), pools.material);
  beds.name = 'Housing_Beds';
  beds.userData = { groundLayered: true };
  for (const mesh of [site, pond, props, beds, ...buildingMeshes(facade)]) parent.add(mesh);
  // Araçlar şehrin park etmiş araçlarının yanına (Traffic_ adıyla: trafik, LOD ve insanlar onları öyle tanır).
  for (const mesh of vehicleMeshes(cityRoot)) parent.add(mesh);
  // Yeni parçalar dünya koordinatında kuruldu: ebeveynin dönüşümü birim olmalı.
  parent.updateMatrixWorld(true);
  if (!parent.matrixWorld.equals(new THREE.Matrix4())) {
    const inverse = parent.matrixWorld.clone().invert();
    for (const child of parent.children) {
      if (OWN.test(child.name) || child.name.startsWith('Traffic_Housing_')) child.applyMatrix4(inverse);
    }
  }

  const lamps = housingLamps();
  replantTrees(cityRoot, {
    prefix: 'Housing',
    inside: (x, z) => inBox(SITE, x, z),
    spots: plantTrees(crownRadius(cityRoot, treeScale), lamps),
    treeScale,
  });
  cityRoot.updateMatrixWorld(true);
  cityRoot.userData.housingLamps = lamps;
  return lamps;
}
