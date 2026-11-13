// Kültür merkezinin yeniden düzenlenmesi (A4 bloğu, alan x -390..-177, z -53..156, zemin plakası x -386.5..-180.5,
// z -49.5..152.5). Modeldeki tesis 206×202 m'lik tek renk açık bej bir plakanın üstünde bloğun yarısını kaplayan beyaz bir
// kabuk çatıdan, 8 üçgenlik bir sergi holünden, bütün bloğu kaplayan 202 m'lik paralel döşeme şeritlerinden, ters kurulmuş
// (yukarı daralan) bir amfiden ve kenarda bir havuzdan oluşuyordu. Ölçek ipucu yoktu, maket parçası gibi okunuyordu.
// Model değişmeden açılışta yeniden kurulur (opera, müze ve kütüphane, önünde kültür meydanı):
// - Opera: modeldeki kabuk, cam lobi ve oval salon korunur, bloğu boğmasın diye 0.76 ölçeğe iner ve kuzeybatıya kayar.
//   Cam lobi cam giydirme olarak işlenir, kabuk saf beyazdan sıcak taş beyazına iner.
// - Müze: üç beşik çatılı galeri, alçak bağlantı ve yeşil çatılı geçici sergi holü. Kütüphane: avlu bahçeli L plan.
//   Şehir binalarıyla aynı kütle ve cephe işçiliği (cityMass.ts, CITY_FACE, CITY_PALETTE).
// - Zemin (shader): traverten meydan ve granit ızgara, opera önünde ana aks, kabuk altında revak, sanat sokağı, heykel
//   bahçesinde çakıl, servis avlusu ve personel otoparkı, yer altı otoparkı rampası, kafe terası, havuzun taş bordürü,
//   kütüphane avlusu, çim ve çit bitkisi.
// - Havuz meydanın ortasına taşınır. Açık hava amfisi, sahne ve gölge yelkeni, heykeller, banklar, kafe köşkü ve şemsiyeler.
// - Servis avlusunda personel arabaları ve yükleme kapısında kamyonlar, ağaç dizileri ve koru, meydan ve yollar boyunca
//   lambalar.
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

const SITE: Box = { x0: -390, x1: -177, z0: -53, z1: 156 };
// Tesisin zemin plakası (Cultural_Ground): çevresi kaldırım.
const LOT: Box = { x0: -386.5, x1: -180.5, z0: -49.5, z1: 152.5 };
// Zemin yüksekliği ve binaların oturduğu taban.
const GROUND_Y = 0.75;
const BASE_Y = 0.45;

// Opera: modeldeki kabuk, cam lobi ve salon bu merkezden bu merkeze, bu ölçekle taşınır (taban yüksekliği sabit).
const OPERA = { from: [-307, 44], to: [-322, 22], scale: 0.76 } as const;
const placeOpera = (x: number, z: number): [number, number] => [
  OPERA.to[0] + (x - OPERA.from[0]) * OPERA.scale,
  OPERA.to[1] + (z - OPERA.from[1]) * OPERA.scale,
];
const operaBox = (b: Box): Box => {
  const [x0, z0] = placeOpera(b.x0, b.z0);
  const [x1, z1] = placeOpera(b.x1, b.z1);
  return { x0, x1, z0, z1 };
};
// Modeldeki ölçüler: kabuk ve cam lobi.
const SHELL = operaBox({ x0: -378, x1: -236, z0: -24, z1: 112 });
const LOBBY = operaBox({ x0: -370, x1: -244, z0: -16, z1: 104 });
// Kabuğun çevresinde revak döşemesi, operanın ana girişi güney cephenin ortasında (salonun ekseninde).
const ARCADE: Box = { x0: SHELL.x0 - 3, x1: SHELL.x1 + 3, z0: SHELL.z0 - 1.5, z1: SHELL.z1 + 3 };
const AXIS = { x: placeOpera(-300, 0)[0], half: 8 };

// Müze: üç beşik çatılı galeri (mahyalar kuzey-güney), bağlantı ve geçici sergi holü.
const GALLERY = { centers: [-243, -223, -203], half: 10, z0: -44, z1: 4, wall: 9, ridge: 13 };
const LINK: Box & { height: number } = { x0: -248, x1: -198, z0: 4, z1: 12, height: 6 };
const TEMP_HALL: Box & { height: number } = { x0: -250, x1: -196, z0: 12, z1: 46, height: 10 };
const MUSEUM: Box = { x0: -253, x1: -193, z0: -44, z1: 46 };
// Kütüphane ve atölyeler: L plan, avlu meydana bakar.
const LIBRARY_SOUTH: Box & { height: number } = { x0: -382, x1: -346, z0: 120, z1: 148, height: 15 };
const LIBRARY_WEST: Box & { height: number } = { x0: -382, x1: -364, z0: 90, z1: 120, height: 11.5 };
const COURTYARD: Box = { x0: -364, x1: -346, z0: 90, z1: 120 };

// Zemin bölgeleri.
const YARD: Box = { x0: -384, x1: -292, z0: LOT.z0, z1: -33 };
const NORTH_GARDEN: Box = { x0: -290, x1: -255, z0: -47, z1: -31 };
const LANE: Box = { x0: SHELL.x1, x1: MUSEUM.x0, z0: -40, z1: 60 };
const MUSEUM_FRONT: Box = { x0: -262, x1: -186, z0: 46, z1: 52 };
const PLAZA: Box = { x0: -342, x1: -232, z0: SHELL.z1, z1: LOT.z1 };
const GROVE: Box = { x0: -228, x1: -184, z0: 52, z1: 97 };
const RAMP: Box = { x0: LOT.x0, x1: -356, z0: 77, z1: 85 };
// Rampanın yer altına inen kısmı (üstü örtülü).
const RAMP_COVER_X = -366;
const DECK: Box = { x0: -258, x1: -246, z0: 96, z1: 112 };
const CAFE: Box = { x0: -246, x1: -236, z0: 98, z1: 110 };
// Havuz (Cultural_Fountain: 32×18 m elips) meydanın ortasında.
const FOUNTAIN = { x: -287, z: 112, rx: 16, rz: 9 };
// Açık hava amfisi: yarım daire basamaklar güneye doğru yükselir, sahne kuzeyde (seyirci operaya bakar).
const AMPHI = { x: -206, z: 112, r0: 9, step: 2.1, rise: 0.45, tiers: 6 };
const AMPHI_PAD: Box = { x0: -230, x1: -182, z0: 98, z1: 136 };
const STAGE: Box = { x0: -216, x1: -196, z0: 101, z1: 111 };
// Heykel bahçesinde döşeli yollar (bahçeyi doğu-batı ve sahneye doğru kuzey-güney keser).
const GROVE_PATHS: Box[] = [
  { x0: GROVE.x0, x1: GROVE.x1, z0: 73, z1: 77 },
  { x0: -208, x1: -204, z0: GROVE.z0, z1: GROVE.z1 },
];
// Sokağa açılan girişler (çit bitkisinde boşluk): servis girişi, sanat sokağı, kütüphane avlusu.
const GATES: Box[] = [
  { x0: -306, x1: -294, z0: LOT.z0, z1: -40 },
  { x0: LANE.x0, x1: LANE.x1, z0: LOT.z0, z1: -40 },
  { x0: LOT.x1 - 6, x1: LOT.x1, z0: 46, z1: 52 },
];

// Servis avlusu: kuzey kenarda dik park yerleri (x boyunca 2.6 m), güneyde yükleme kapısına yanaşmış kamyonlar.
const BAY = 2.6;
const STAFF_ROW = { x0: -383, x1: -342, z: -44.5 };
const TRUCKS = [-331, -314];
const TRUCK_Z = -36;

// Heykeller ve banklar (ağaç ve lamba yerleşimi de bunları okur).
const SCULPTURES: [number, number, number][] = [
  [-302, 88, 0],
  [-262, 90, 1],
  [-264, 140, 2],
  [-216, 86, 1],
  [-196, 64, 0],
  [-190, 88, 2],
];
const BENCHES: [number, number, boolean][] = [
  // [x, z, uzun kenar x boyunca mı]
  [FOUNTAIN.x - 21, FOUNTAIN.z, false],
  [FOUNTAIN.x + 21, FOUNTAIN.z, false],
  [FOUNTAIN.x, FOUNTAIN.z - 13, true],
  [FOUNTAIN.x, FOUNTAIN.z + 13, true],
  [AXIS.x - AXIS.half - 3, 94, false],
  [AXIS.x - AXIS.half - 3, 134, false],
  [AXIS.x + AXIS.half + 3, 94, false],
  [AXIS.x + AXIS.half + 3, 134, false],
  [-220, 71, true],
  [-192, 71, true],
  [-220, 79, true],
  [-192, 79, true],
];
const UMBRELLAS: [number, number][] = [
  [-254.5, 99.5],
  [-249.5, 99.5],
  [-254.5, 108.5],
  [-249.5, 108.5],
];

const f = (value: number) => value.toFixed(2);
const box = (b: Box) => `vec2(${f((b.x0 + b.x1) / 2)}, ${f((b.z0 + b.z1) / 2)}), vec2(${f((b.x1 - b.x0) / 2)}, ${f((b.z1 - b.z0) / 2)})`;

/** Kültür merkezi planının mesafe fonksiyonları (GLSL, global kapsamda). */
export const CULTURAL_GLSL = `
// Köşeleri r yarıçapla yuvarlatılmış kutuya işaretli uzaklık (içeride negatif).
float ccBox(vec2 p, vec2 c, vec2 h, float r){ vec2 q = abs(p - c) - h + r; return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r; }
float ccIn(float d, float aa){ return 1.0 - smoothstep(-aa, aa, d); }
// Eşit aralıklı çizgiler (metre): çizgi seçilemeyecek kadar uzaksa ortalama yoğunluğuna söner.
float ccLines(float v, float period, float width, float aa){
  float d = abs(fract(v / period + 0.5) - 0.5) * period;
  float line = 1.0 - smoothstep(width * 0.5 - aa, width * 0.5 + aa, d);
  return mix(width / period, line, 1.0 - smoothstep(width * 0.6, width * 1.5, aa));
}
`;

/** Kültür merkezi zemini: Cultural_Ground'un rengi tamamen dünya konumundan çizilir (köşe renkleri yok sayılır). */
export const CULTURAL_FRAGMENT = `#include <color_fragment>
  {
    vec2 p = vWPos.xz;
    float aa = max(fwidth(p.x), fwidth(p.y)) * 0.8 + 0.05;
    float fine = 1.0 - smoothstep(0.8, 2.5, aa);
    float n1 = fbm(p * 0.02);
    float n2 = fbm(p * 0.09 + 7.0);
    // Taş ve çakılda ince benek (piksel altına inince söner).
    float grain = 0.94 + 0.12 * h12(floor(p * 3.0)) * fine;
    vec3 rimColor = vec3(0.55, 0.53, 0.5);

    // Çim: parktaki gibi biçme şeritleri ve geniş ton farkları.
    vec3 c = vec3(0.12, 0.19, 0.065) * (0.82 + 0.36 * n1);
    c *= 1.0 + (step(0.5, fract((p.x + p.y * 0.2) / 9.0)) - 0.5) * 0.12 * (1.0 - smoothstep(2.0, 5.0, aa));

    // Blok kenarında çit bitkisi: meydanın sokak cephesi, servis avlusu, rampa ve girişler açık.
    float edge = min(min(p.x - ${f(LOT.x0)}, ${f(LOT.x1)} - p.x), min(p.y - ${f(LOT.z0)}, ${f(LOT.z1)} - p.y));
    float open = ccIn(ccBox(p, ${box(PLAZA)}, 0.0), aa) + ccIn(ccBox(p, ${box(YARD)}, 0.0), aa)
      + ccIn(ccBox(p, ${box(RAMP)}, 0.0), aa) + ccIn(ccBox(p, ${box(AMPHI_PAD)}, 0.0), aa);
    ${GATES.map((g) => `open += ccIn(ccBox(p, ${box(g)}, 0.0), aa);`).join('\n    ')}
    float hedge = ccIn(edge - 2.4 + (n2 - 0.5) * 0.8, aa) * (1.0 - clamp(open, 0.0, 1.0));
    c = mix(c, vec3(0.055, 0.095, 0.035) * (0.7 + 0.6 * fbm(p * 0.45)), hedge);

    // Servis avlusu: asfalt, personel park yerleri, yükleme kapısı önünde taralı alan.
    float yd = ccBox(p, ${box(YARD)}, 0.5);
    c = mix(c, vec3(0.2, 0.195, 0.19) * (0.88 + 0.24 * n2), ccIn(yd, aa));
    float bays = ccLines(p.x - ${f(STAFF_ROW.x0)}, ${f(BAY)}, 0.15, aa)
      * step(${f(STAFF_ROW.x0)}, p.x) * step(p.x, ${f(STAFF_ROW.x1)})
      * step(${f(STAFF_ROW.z - 2.8)}, p.y) * step(p.y, ${f(STAFF_ROW.z + 2.8)});
    c = mix(c, rimColor, bays);
    float hatch = ccLines(p.x + p.y, 2.0, 0.3, aa) * step(${f(TRUCKS[0] - 8)}, p.x) * step(p.x, ${f(TRUCKS[1] + 8)})
      * step(${f(TRUCK_Z - 2.5)}, p.y) * step(p.y, ${f(YARD.z1)}) * 0.6;
    c = mix(c, vec3(0.48, 0.42, 0.28), hatch);

    // Yer altı otoparkı rampası: koyu asfalt, inerken kararır, kenarda sarı şerit.
    float rd = ccBox(p, ${box(RAMP)}, 0.2);
    float down = smoothstep(${f(RAMP_COVER_X - 8)}, ${f(RAMP.x1)}, p.x);
    c = mix(c, vec3(0.17, 0.165, 0.16) * (0.9 + 0.2 * n2) * (1.0 - 0.7 * down), ccIn(rd, aa));
    c = mix(c, vec3(0.5, 0.42, 0.2) * (1.0 - 0.7 * down), ccIn(abs(rd + 0.6) - 0.15, aa) * fine);

    // Kabuğun altında ve çevresinde revak: büyük açık taş levhalar (3 m).
    float slab = max(ccLines(p.x, 3.0, 0.12, aa), ccLines(p.y, 3.0, 0.12, aa));
    float arcade = ccIn(ccBox(p, ${box(ARCADE)}, 4.0), aa);
    c = mix(c, vec3(0.56, 0.53, 0.48) * grain * (1.0 - 0.12 * slab), arcade);

    // Meydan, sanat sokağı ve müze önü: traverten (1.2 m derz), meydanda 12 m'lik granit ızgara.
    float joint = max(ccLines(p.x, 1.2, 0.08, aa), ccLines(p.y, 1.2, 0.08, aa));
    vec3 travertine = vec3(0.52, 0.49, 0.44) * grain * (0.94 + 0.12 * n2) * (1.0 - 0.1 * joint);
    float paved = ccIn(min(min(ccBox(p, ${box(PLAZA)}, 1.0), ccBox(p, ${box(LANE)}, 1.0)), ccBox(p, ${box(MUSEUM_FRONT)}, 1.0)), aa);
    c = mix(c, travertine, paved);
    float grid = max(ccLines(p.x - ${f(AXIS.x)}, 12.0, 0.45, aa), ccLines(p.y - ${f(PLAZA.z0)}, 12.0, 0.45, aa));
    float plaza = ccIn(ccBox(p, ${box(PLAZA)}, 1.0), aa);
    vec3 granite = vec3(0.27, 0.26, 0.25) * grain;
    c = mix(c, granite, grid * plaza * 0.55);

    // Ana aks: operanın girişinden sokağa granit bant, ortasında açık taş şerit.
    float ad = ccBox(p, vec2(${f(AXIS.x)}, ${f((ARCADE.z1 - 6 + LOT.z1) / 2)}), vec2(${f(AXIS.half)}, ${f((LOT.z1 - ARCADE.z1 + 6) / 2)}), 0.0);
    c = mix(c, granite * (1.0 + 0.15 * n2), ccIn(ad, aa));
    c = mix(c, travertine, ccIn(abs(p.x - ${f(AXIS.x)}) - 2.0, aa) * ccIn(ad, aa));

    // Heykel bahçesi: sıcak tonlu çakıl, döşeli yollar.
    vec3 gravel = vec3(0.4, 0.34, 0.25) * (0.88 + 0.24 * n2) * grain;
    c = mix(c, gravel, ccIn(ccBox(p, ${box(GROVE)}, 2.0), aa));
    ${GROVE_PATHS.map((b) => `c = mix(c, travertine, ccIn(ccBox(p, ${box(b)}, 0.3), aa));`).join('\n    ')}

    // Amfinin çevresi döşeme, açık kenar.
    float am = ccBox(p, ${box(AMPHI_PAD)}, 3.0);
    c = mix(c, travertine, ccIn(am, aa));
    c = mix(c, rimColor, ccIn(abs(am) - 0.25, aa) * fine);

    // Kütüphane avlusu: çim, çapraz çakıl yollar.
    vec2 cc = vec2(${f((COURTYARD.x0 + COURTYARD.x1) / 2)}, ${f((COURTYARD.z0 + COURTYARD.z1) / 2)});
    float court = ccIn(ccBox(p, ${box(COURTYARD)}, 0.0), aa);
    float cross = ccIn(min(abs(p.x - cc.x), abs(p.y - cc.y)) - 1.2, aa);
    c = mix(c, gravel, court * cross);

    // Kafe terası: x boyunca ahşap tahtalar.
    float plank = ccLines(p.y, 0.6, 0.08, aa);
    c = mix(c, vec3(0.34, 0.25, 0.17) * (0.9 + 0.2 * n2) * (1.0 - 0.18 * plank), ccIn(ccBox(p, ${box(DECK)}, 0.4), aa));

    // Havuzun taş bordürü (su yüzeyi bordürün içinde, Cultural_Fountain).
    vec2 fq = (p - vec2(${f(FOUNTAIN.x)}, ${f(FOUNTAIN.z)})) / vec2(${f(FOUNTAIN.rx)}, ${f(FOUNTAIN.rz)});
    float fd = (length(fq) - 1.0) * ${f(FOUNTAIN.rz)};
    c = mix(c, vec3(0.6, 0.57, 0.52) * grain, ccIn(abs(fd - 0.4) - 0.8, aa));

    diffuseColor.rgb = c;
  }`;

// ------------------------------------------------------------------ binalar

// Duvar ve çatı paleti (FACADE_FRAGMENT eşikleriyle). Değerler kreş ve serayla aynı: aynı değer aynı cephe programını
// paylaşır, açılışta ek cephe shader'ı derlenmez. Müze kırık beyaz duvar, arduvaz beşik ve yeşil düz çatı; kütüphane
// krem sıva ve açık membran.
const MUSEUM_PALETTE = 'vec2(0.1, 0.9)';
const LIBRARY_PALETTE = 'vec2(0.4, 0.7)';

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
  const museum = material(MUSEUM_PALETTE);
  const library = material(LIBRARY_PALETTE);
  const instanced = (name: string, geometry: THREE.BufferGeometry, mat: THREE.Material, matrices: THREE.Matrix4[]) => {
    const mesh = new THREE.InstancedMesh(geometry, mat, matrices.length);
    mesh.name = name;
    matrices.forEach((m, i) => mesh.setMatrixAt(i, m));
    mesh.instanceMatrix.needsUpdate = true;
    return mesh;
  };
  // Galeri: duvar ve mahyası kuzey-güney beşik çatı (birim küpte duvar payı).
  const wall = -1 + (2 * GALLERY.wall) / GALLERY.ridge;
  const gallery = new MassBuilder().box(-1, 1, -1, wall, -1, 1, false).pitchedRoof(wall, 1, false, 1).build();
  // Düz çatıda tesisat kulesi (geçici sergi holü ve kütüphane).
  const plantRoom = () => new MassBuilder().box(-1, 1, -1, 0.88, -1, 1).box(-0.5, 0.1, 0.88, 1, -0.4, 0.3).build();
  return [
    instanced(
      'Cultural_Galleries',
      gallery,
      museum,
      GALLERY.centers.map((x) =>
        blockMatrix({ x0: x - GALLERY.half, x1: x + GALLERY.half, z0: GALLERY.z0, z1: GALLERY.z1 }, GALLERY.ridge),
      ),
    ),
    instanced('Cultural_MuseumLink', new MassBuilder().box(-1, 1, -1, 1, -1, 1).build(), museum, [blockMatrix(LINK, LINK.height)]),
    instanced('Cultural_TempHall', plantRoom(), museum, [blockMatrix(TEMP_HALL, TEMP_HALL.height)]),
    instanced('Cultural_Library', plantRoom(), library, [
      blockMatrix(LIBRARY_SOUTH, LIBRARY_SOUTH.height),
      blockMatrix(LIBRARY_WEST, LIBRARY_WEST.height),
    ]),
  ];
}

// ------------------------------------------------------------------ parçalar

// Kırık tonlar: taş, beton, bronz, pas, ahşap, kırık beyaz.
const TONE = {
  stone: '#b8b0a2',
  concrete: '#9a978f',
  bronze: '#7a6248',
  corten: '#8a5a3e',
  wood: '#a88a68',
  white: '#e6e1d6',
  steel: '#8c8f92',
  charcoal: '#3c3d3f',
  glass: '#4a5a66',
  canvas: '#ddd6c8',
};

/** Kaideli soyut heykeller: üç çeşit. */
function sculpture(props: PropBuilder, x: number, z: number, kind: number) {
  const y = GROUND_Y;
  props.box(x - 1, x + 1, y, y + 0.6, z - 1, z + 1, TONE.stone);
  if (kind === 0) {
    // Bronz gövde ve yana taşan kol.
    props.cylinder(x, y + 0.6, z, 0.55, 2.6, 'y', TONE.bronze, 10);
    props.box(x - 0.2, x + 1.4, y + 2.4, y + 2.9, z - 0.3, z + 0.3, TONE.bronze);
  } else if (kind === 1) {
    // Çapraz duran iki pas rengi levha.
    props.box(x - 0.15, x + 0.15, y + 0.6, y + 4.6, z - 0.9, z + 0.9, TONE.corten);
    props.box(x - 0.9, x + 0.9, y + 0.6, y + 3.4, z - 0.15, z + 0.15, TONE.corten);
  } else {
    // Üst üste kaydırılmış taş bloklar.
    props.box(x - 0.8, x + 0.6, y + 0.6, y + 1.5, z - 0.7, z + 0.7, TONE.white);
    props.box(x - 0.4, x + 0.9, y + 1.5, y + 2.3, z - 0.6, z + 0.5, TONE.white);
    props.box(x - 0.6, x + 0.4, y + 2.3, y + 3.0, z - 0.4, z + 0.6, TONE.white);
  }
}

function propsGeometry() {
  const props = new PropBuilder();
  const y = GROUND_Y;

  // Açık hava amfisi: üç dilim (aralarında merdiven boşluğu), her basamak yerden yükselir.
  const wedges: [number, number][] = [
    [0.04, 1.0],
    [1.07, 2.07],
    [2.14, Math.PI - 0.04],
  ];
  for (let t = 0; t < AMPHI.tiers; t++) {
    const r0 = AMPHI.r0 + t * AMPHI.step;
    for (const [a0, a1] of wedges) {
      props.sector(AMPHI.x, AMPHI.z, r0, r0 + AMPHI.step, a0, a1, y, y + AMPHI.rise * (t + 1), t % 2 ? TONE.stone : TONE.concrete, 6);
    }
  }
  // Sahne: ahşap döşeme, arkada beton fon duvarı, köşelerde direkler ve gölge yelkeni.
  props.box(STAGE.x0, STAGE.x1, y, y + 1.0, STAGE.z0, STAGE.z1, TONE.wood);
  props.box(STAGE.x0 - 1, STAGE.x1 + 1, y, y + 5, STAGE.z0 - 1.4, STAGE.z0 - 0.8, TONE.concrete);
  for (const x of [STAGE.x0 - 0.6, STAGE.x1 + 0.6]) {
    for (const z of [STAGE.z0 - 0.4, STAGE.z1 + 0.4]) props.box(x - 0.15, x + 0.15, y, y + 7, z - 0.15, z + 0.15, TONE.steel);
  }
  props.box(STAGE.x0 - 1.2, STAGE.x1 + 1.2, y + 7, y + 7.12, STAGE.z0 - 1, STAGE.z1 + 1, TONE.canvas);

  // Heykeller ve banklar.
  for (const [x, z, kind] of SCULPTURES) sculpture(props, x, z, kind);
  for (const [x, z, alongX] of BENCHES) {
    const hx = alongX ? 1.4 : 0.35;
    const hz = alongX ? 0.35 : 1.4;
    props.box(x - hx, x + hx, y, y + 0.48, z - hz, z + hz, TONE.wood);
  }

  // Kafe köşkü: taş duvar, terasa bakan cam cephe, taşan koyu çatı. Terasta şemsiyeler.
  props.box(CAFE.x0, CAFE.x1, y, y + 4.2, CAFE.z0, CAFE.z1, TONE.white);
  props.box(CAFE.x0 - 0.12, CAFE.x0, y + 0.3, y + 3.6, CAFE.z0 + 1, CAFE.z1 - 1, TONE.glass);
  props.box(CAFE.x0 - 1.5, CAFE.x1 + 0.5, y + 4.2, y + 4.6, CAFE.z0 - 1, CAFE.z1 + 1, TONE.charcoal);
  for (const [x, z] of UMBRELLAS) {
    props.cylinder(x, y, z, 0.08, 2.5, 'y', TONE.steel, 6);
    props.pyramid(x - 1.6, x + 1.6, y + 2.4, y + 3.0, z - 1.6, z + 1.6, TONE.canvas);
  }

  // Otopark rampası: açık kısımda alçak, örtülü kısımda yüksek beton duvarlar ve çatı.
  for (const [z0, z1] of [
    [RAMP.z0 - 0.3, RAMP.z0],
    [RAMP.z1, RAMP.z1 + 0.3],
  ]) {
    props.box(RAMP.x0 + 10, RAMP_COVER_X, y, y + 1.1, z0, z1, TONE.concrete);
    props.box(RAMP_COVER_X, RAMP.x1, y, y + 3.2, z0, z1, TONE.concrete);
  }
  props.box(RAMP.x1, RAMP.x1 + 0.3, y, y + 3.2, RAMP.z0 - 0.3, RAMP.z1 + 0.3, TONE.concrete);
  props.box(RAMP_COVER_X, RAMP.x1 + 0.3, y + 3.2, y + 3.55, RAMP.z0 - 0.5, RAMP.z1 + 0.5, TONE.concrete);
  return props.build();
}

// ------------------------------------------------------------------ araçlar

/** Servis avlusu: personel arabaları dik park, kamyonlar yükleme kapısına paralel. */
function vehicleMeshes(cityRoot: THREE.Object3D) {
  const colors = ['White', 'Silver', 'Graphite', 'Blue'];
  const cars: VehicleSpot[][] = colors.map(() => []);
  for (let x = STAFF_ROW.x0 + BAY / 2; x < STAFF_ROW.x1 - BAY / 2; x += BAY) {
    if (hash2(x, 61) < 0.25) continue;
    const h = hash2(x * 1.7, 63);
    cars[h < 0.38 ? 0 : h < 0.72 ? 1 : h < 0.9 ? 2 : 3].push([x, STAFF_ROW.z, -Math.PI / 2]);
  }
  const meshes = colors.map((color, i) => parkedVehicles(cityRoot, `Cars_${color}`, 'Cultural', cars[i]));
  meshes.push(parkedVehicles(cityRoot, 'Trucks', 'Cultural', TRUCKS.map((x) => [x, TRUCK_Z, 0])));
  return meshes.filter((mesh) => mesh !== null);
}

// ------------------------------------------------------------------ ağaçlar ve lambalar

const inBox = (b: Box, x: number, z: number, pad = 0) => x > b.x0 - pad && x < b.x1 + pad && z > b.z0 - pad && z < b.z1 + pad;

// Ağaç dikilmeyen yerler: tepe bunların üstüne taşmaz.
const SOLID: Box[] = [
  SHELL,
  MUSEUM,
  LIBRARY_SOUTH,
  LIBRARY_WEST,
  YARD,
  RAMP,
  AMPHI_PAD,
  DECK,
  CAFE,
  { x0: FOUNTAIN.x - FOUNTAIN.rx - 1.2, x1: FOUNTAIN.x + FOUNTAIN.rx + 1.2, z0: FOUNTAIN.z - FOUNTAIN.rz - 1.2, z1: FOUNTAIN.z + FOUNTAIN.rz + 1.2 },
  // Ana aks ve opera girişinin önü açık kalır.
  { x0: AXIS.x - AXIS.half, x1: AXIS.x + AXIS.half, z0: ARCADE.z1 - 6, z1: LOT.z1 },
];

/** Tepe yarıçapı `radius` olan ağaç buraya sığar mı: zemin plakasında (yola taşmaz), yapılardan, parçalardan ve lambalardan uzak. */
function treeAllowed(x: number, z: number, radius: number, lamps: number[]) {
  if (!inBox(LOT, x, z, -radius)) return false;
  if (SOLID.some((b) => inBox(b, x, z, radius + 0.5))) return false;
  if (SCULPTURES.some(([sx, sz]) => Math.hypot(x - sx, z - sz) < radius + 1.5)) return false;
  if (BENCHES.some(([bx, bz]) => Math.hypot(x - bx, z - bz) < 2)) return false;
  if (GROVE_PATHS.some((b) => inBox(b, x, z, 1))) return false;
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
  // Batı gezinti yolu ve sanat sokağı boyunca dizi.
  for (let z = SHELL.z0 + 2; z < RAMP.z0 - 2; z += 9) add((LOT.x0 + SHELL.x0) / 2, z, 7);
  for (let z = LANE.z0 + 4; z < MUSEUM_FRONT.z0; z += 10) add(LANE.x0 + 4.5, z, 7);
  // Müzenin doğusunda sokak kenarı dizisi.
  for (let z = MUSEUM.z0 + 2; z < MUSEUM.z1; z += 9) add((MUSEUM.x1 + LOT.x1) / 2, z, 7);
  // Kuzey bahçesi: servis avlusuyla müze arasında küme.
  for (let k = 0; k < 16; k++) add(NORTH_GARDEN.x0 + hash2(k, 70) * (NORTH_GARDEN.x1 - NORTH_GARDEN.x0), NORTH_GARDEN.z0 + hash2(k, 71) * 16, 8);
  // Heykel bahçesi: ızgara koru.
  for (const x of [-222, -213, -197, -188]) {
    for (const z of [57, 67, 84, 93]) add(x + jitter(x, z) * 0.8, z + jitter(z, x) * 0.8, 6);
  }
  // Amfinin arkası ve güney kenar.
  for (let x = AMPHI_PAD.x0 + 2; x < LOT.x1; x += 9) add(x + jitter(x, 9), (AMPHI_PAD.z1 + LOT.z1) / 2 + 1, 7);
  // Meydanı iki yandan çerçeveleyen diziler: batıda kütüphane tarafı, doğuda kafe ile amfi arası (ortası açık).
  for (let z = PLAZA.z0 + 6; z < LOT.z1; z += 10) {
    add(PLAZA.x0 + 4, z, 7);
    add(PLAZA.x1 - 4, z, 7);
  }
  // Kütüphane avlusu, avlu ile rampa arasındaki çim.
  for (const [x, z] of [
    [COURTYARD.x0 + 5, COURTYARD.z0 + 5],
    [COURTYARD.x1 - 5, COURTYARD.z1 - 5],
    [COURTYARD.x1 - 5, COURTYARD.z0 + 5],
  ]) {
    add(x, z, 6);
  }
  return trees;
}

/** Lambalar: meydan ve aks, havuz çevresi, sanat sokağı, batı gezinti yolu, heykel bahçesi, amfi, servis avlusu. */
function culturalLamps(): number[] {
  const lamps: number[] = [];
  const low = GROUND_Y + 4.5;
  const tall = GROUND_Y + 8;
  // Aksın iki yanında ~20 m arayla (banklarla dönüşümlü).
  for (const z of [84, 104, 124, 144]) {
    lamps.push(AXIS.x - AXIS.half - 3, low, z);
    lamps.push(AXIS.x + AXIS.half + 3, low, z);
  }
  // Havuzun çevresi.
  for (const [dx, dz] of [
    [-15, -12],
    [15, -12],
    [-15, 12],
    [15, 12],
  ]) {
    lamps.push(FOUNTAIN.x + dx, low, FOUNTAIN.z + dz);
  }
  // Sanat sokağı, batı gezinti yolu.
  for (let z = LANE.z0 + 9; z < MUSEUM_FRONT.z1; z += 20) lamps.push(LANE.x1 - 2.5, low, z);
  for (let z = SHELL.z0 + 7; z < RAMP.z0; z += 18) lamps.push(SHELL.x0 - 1.5, low, z);
  // Heykel bahçesinin yolları, amfinin iki yanı, müze önü.
  for (const x of [-224, -214, -194, -186]) lamps.push(x, low, 75);
  lamps.push(AMPHI_PAD.x0 + 1.5, low, AMPHI.z, AMPHI_PAD.x1 - 1.5, low, AMPHI.z);
  lamps.push(-258, low, MUSEUM_FRONT.z0 + 3, -238, low, MUSEUM_FRONT.z0 + 3);
  // Servis avlusu: kuzey kenarda yüksek direkler.
  for (const x of [-372, -352, -300]) lamps.push(x, tall, YARD.z0 + 1);
  return lamps;
}

// ------------------------------------------------------------------ kurulum

/** Mesh'in `drop` koşulunu sağlayan üçgenlerini siler (dizinden çıkarır). Dünya koordinatında üçgen ağırlık merkezine bakar. */
function dropTriangles(mesh: THREE.Mesh, drop: (center: THREE.Vector3) => boolean) {
  const geometry = mesh.geometry;
  const position = geometry.getAttribute('position');
  const index = geometry.index;
  const count = index ? index.count : position.count;
  const vertex = (k: number) => (index ? index.getX(k) : k);
  const kept: number[] = [];
  const a = new THREE.Vector3();
  const center = new THREE.Vector3();
  for (let k = 0; k < count; k += 3) {
    center.set(0, 0, 0);
    for (let j = 0; j < 3; j++) center.add(a.fromBufferAttribute(position, vertex(k + j)).applyMatrix4(mesh.matrixWorld));
    center.divideScalar(3);
    if (!drop(center)) kept.push(vertex(k), vertex(k + 1), vertex(k + 2));
  }
  geometry.setIndex(kept);
  geometry.computeBoundingSphere();
}

/** Köşe renklerini çarpanla değiştirir (kabuğun tonu, lobinin camı). */
function tint(mesh: THREE.Mesh, color: (r: number, g: number, b: number) => [number, number, number]) {
  const colors = mesh.geometry.getAttribute('color');
  if (!colors) return;
  for (let i = 0; i < colors.count; i++) {
    const [r, g, b] = color(colors.getX(i), colors.getY(i), colors.getZ(i));
    colors.setXYZ(i, r, g, b);
  }
  colors.needsUpdate = true;
}

const REPLACED = /^Cultural_(Plaza_Paving|Exhibition_Halls|Roofs|Skylights)$/;
const OWN = /^Cultural_(Galleries|MuseumLink|TempHall|Library|Props)$/;

/**
 * Kültür merkezini yeniden kurar: zebra döşeme, sergi holü, çatısı ve tepe pencereleri kaldırılır, ters amfinin basamakları
 * silinir (aynı mesh'teki blok tabanı kalır). Opera küçülüp kuzeybatıya kayar, havuz meydana taşınır. Yeni binalar, amfi,
 * parçalar, araçlar ve ağaçlar eklenir. Zemin rengi CULTURAL_FRAGMENT ile çizilir (cityRuntime Cultural_Ground'a uygular).
 * Lamba konumlarını döndürür. Hazırlık ikinci kez çalışırsa (StrictMode) tekrar etmez. Araçlar createTraffic'ten sonra
 * kurulur (park etmiş araç mesh'lerinden örneklenir).
 */
export function landscapeCulturalCenter(cityRoot: THREE.Object3D, treeScale: number): number[] {
  const done = cityRoot.userData.culturalLamps as number[] | undefined;
  if (done) return done;
  cityRoot.updateMatrixWorld(true);
  const ground = cityRoot.getObjectByName('Cultural_Ground');
  const shell = cityRoot.getObjectByName('Cultural_ShellRoof');
  const lobby = cityRoot.getObjectByName('Cultural_GlassWalls');
  const hall = cityRoot.getObjectByName('Cultural_Auditorium');
  const fountain = cityRoot.getObjectByName('Cultural_Fountain');
  const amphitheatre = cityRoot.getObjectByName('Cultural_Amphitheatre');
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
    !ground ||
    !facade ||
    !(shell instanceof THREE.Mesh) ||
    !(lobby instanceof THREE.Mesh) ||
    !(hall instanceof THREE.Mesh) ||
    !fountain ||
    !(amphitheatre instanceof THREE.Mesh) ||
    Array.isArray(hall.material)
  ) {
    return [];
  }

  for (const mesh of removed) {
    mesh.removeFromParent();
    mesh.geometry.dispose();
  }
  // Ters amfinin basamakları silinir, aynı mesh'teki blok tabanı (y 0.6) kalır.
  dropTriangles(amphitheatre, (center) => center.y > 0.65);

  // Opera: kabuk, lobi ve salon birlikte küçülüp kayar (ebeveyn birim dönüşüm, konumlar dünya koordinatı).
  for (const part of [shell, lobby, hall]) {
    const [x, z] = placeOpera(part.position.x, part.position.z);
    part.position.set(x, GROUND_Y + (part.position.y - GROUND_Y) * OPERA.scale, z);
    part.scale.multiplyScalar(OPERA.scale);
  }
  // Kabuk saf beyazdan sıcak taş beyazına. Lobi mavimsi köşe rengiyle cam giydirme olarak işlenir (FACADE_FRAGMENT).
  tint(shell, (r, g, b) => [r * 0.9, g * 0.87, b * 0.82]);
  tint(lobby, () => [0.55, 0.66, 0.78]);
  fountain.position.set(FOUNTAIN.x, fountain.position.y, FOUNTAIN.z);

  const parent = ground.parent ?? cityRoot;
  // Parçalar salonun satin malzemesini paylaşır (köşe renkli, kreşteki oyun ekipmanları gibi).
  const props = new THREE.Mesh(propsGeometry(), hall.material);
  props.name = 'Cultural_Props';
  // Yeni parçalar zemin katmanlamasına girmez (layerGround yalnızca düz, çok renkli mesh'leri kaldırır).
  props.userData = { groundLayered: true };
  parent.add(props);
  for (const mesh of buildingMeshes(facade)) parent.add(mesh);
  // Araçlar şehrin park etmiş araçlarının yanına (Traffic_ adıyla: trafik, LOD ve insanlar onları öyle tanır).
  for (const mesh of vehicleMeshes(cityRoot)) parent.add(mesh);
  // Yeni parçalar dünya koordinatında kuruldu: ebeveynin dönüşümü birim olmalı.
  parent.updateMatrixWorld(true);
  if (!parent.matrixWorld.equals(new THREE.Matrix4())) {
    const inverse = parent.matrixWorld.clone().invert();
    for (const child of parent.children) {
      if (OWN.test(child.name) || child.name.startsWith('Traffic_Cultural_')) child.applyMatrix4(inverse);
    }
  }

  const lamps = culturalLamps();
  replantTrees(cityRoot, {
    prefix: 'Cultural',
    inside: (x, z) => inBox(SITE, x, z),
    spots: plantTrees(crownRadius(cityRoot, treeScale), lamps),
    treeScale,
  });
  cityRoot.updateMatrixWorld(true);
  cityRoot.userData.culturalLamps = lamps;
  return lamps;
}
