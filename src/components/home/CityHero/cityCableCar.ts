// Teleferik aktarma istasyonunun bloğu (B2, alan x -163..13, z -403..-257, zemin plakası x -159.5..9.5, z -399.5..-260.5).
// Modelde 169×139 m'lik tek renk bej bir plakanın ortasında, 14 m'lik ince ayaklar üstünde döndürülmüş bir cam kutu ve tonoz
// çatı vardı. Meydan zeminle aynı renkte olduğu için seçilmiyordu, ayakların arasında giriş yoktu, iki kenarda düz ağaç
// dizisinden başka bir şey yoktu. Buradan iki hat çıkar: tepe hattı batı-kuzeybatıya, bilim merkezi hattı z -335..-325
// boyunca doğuya. Model değişmeden açılışta yeniden düzenlenir:
// - İstasyon (cam gövde, çatı, ayaklar, kablolar, gondollar) olduğu gibi kalır: bu mesh'ler diğer iki istasyonla ortak.
//   Altına istasyon ekseninde bilet salonu ve platforma çıkan merdiven-asansör kulesi, girişe saçak eklenir.
// - Kuzeydoğu köşede kabin bakım garajı ve servis avlusu.
// - Zemin (shader): istasyon eksenine hizalı traverten meydan ve granit bantlar, istasyonun altında gölgeli taş, girişten
//   ön meydana hissedilebilir yüzey, iki hattın altında hattı izleyen bitki tarhları ve çakıl yol, kameraya bakan ön meydan
//   (ağaç havuzları), kuzeyde otobüs cebi, taksi şeridi ve bekleme bandı, çim ve çit bitkisi.
// - Parçalar (kırık tonlar): otobüs durağı, bilet otomatları ve turnikeler, büfe ve şemsiyeler, banklar, bisiklet
//   istasyonu, garajın önünde yedek kabin ve palet yığını. Taksiler ve servis kamyonları, ağaçlar ve lambalar.
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

const SITE: Box = { x0: -163, x1: 13, z0: -403, z1: -257 };
const LOT: Box = { x0: -159.5, x1: 9.5, z0: -399.5, z1: -260.5 };
// Zemin yüksekliği (modeldeki CableCar_Ground ile aynı) ve binaların oturduğu taban.
const GROUND_Y = 0.75;
const BASE_Y = 0.45;

// ---- istasyon ekseni: s eksen boyunca (batı-kuzeybatıya, tepe hattı yönü), t eksene dik (+t kuzeydoğu)
const STATION = { x: -80, z: -330 };
const ANGLE = (149.3 * Math.PI) / 180;
// Yerel x ekseni dünyada U'ya, yerel z ekseni N'ye döner (y ekseni etrafında ANGLE).
const U: [number, number] = [Math.cos(ANGLE), -Math.sin(ANGLE)];
const N: [number, number] = [Math.sin(ANGLE), Math.cos(ANGLE)];
const toLocal = (x: number, z: number): [number, number] => {
  const dx = x - STATION.x;
  const dz = z - STATION.z;
  return [dx * U[0] + dz * U[1], dx * N[0] + dz * N[1]];
};
const toWorld = (s: number, t: number): [number, number] => [STATION.x + s * U[0] + t * N[0], STATION.z + s * U[1] + t * N[1]];

/** İstasyon eksenindeki dikdörtgen (yerel s, t). */
interface LocalBox {
  s0: number;
  s1: number;
  t0: number;
  t1: number;
}
// Modeldeki istasyon çatısının izdüşümü (ayaklar s ±16, t ±7).
const STATION_ROOF: LocalBox = { s0: -24, s1: 24, t0: -13, t1: 13 };
// Zemin katında bilet salonu (merkez çekirdeği içine alır, ayakların arasında kalır) ve doğu ucunda merdiven-asansör kulesi.
const TICKET_HALL: LocalBox & { height: number } = { s0: -13, s1: 13, t0: -8.5, t1: 8.5, height: 5 };
const LIFT: LocalBox & { height: number } = { s0: -21.5, s1: -17.5, t0: -4, t1: 4, height: 13.5 };
// Güney girişinde saçak, altında bilet otomatları ve turnikeler.
const CANOPY: LocalBox = { s0: -10, s1: 10, t0: -13, t1: -8.5 };
// İstasyon meydanı (eksene hizalı traverten, 6 m'de bir granit bant).
const PLAZA = { halfS: 40, halfT: 24 };
// Tepe hattının altındaki bahçe: hat çifti t ±5'te, meydanın ucundan blok kenarına.
const HILL_GARDEN = { s0: 38, s1: 110, half: 9 };

// ---- dünya ekseninde parçalar
// Doğu hattının altındaki bahçe (kablolar z -325 ve -335).
const EAST_GARDEN = { x0: -62, x1: LOT.x1, z: -330, half: 9 };
// Kameraya bakan ön meydan: iki yanında ağaç havuzları, ortası istasyona açık.
const FRONT: Box = { x0: -120, x1: -30, z0: -298, z1: LOT.z1 };
const PIT = 8;
const PIT_GROVES: Box[] = [
  { x0: -120, x1: -96, z0: -294, z1: -262 },
  { x0: -54, x1: -30, z0: -294, z1: -262 },
];
// Kuzey sokağında otobüs cebi ve taksi şeridi, arkasında bekleme bandı; bekleme bandından istasyona yol.
const BAY: Box = { x0: -140, x1: -60, z0: LOT.z0, z1: -392 };
const BAY_WALK: Box = { x0: -142, x1: -30, z0: -392, z1: -388 };
const NORTH_PATH: Box = { x0: -90, x1: -82, z0: -388, z1: -362 };
const SHELTER: Box = { x0: -126, x1: -114, z0: -391.6, z1: -389.6 };
const BIKES: Box = { x0: -56, x1: -38, z0: -391.6, z1: -389.6 };
const TAXIS = [-92, -85, -78, -71, -64].map((x): VehicleSpot => [x, -395.6, 0]);
// Kuzeydoğu köşede kabin bakım garajı ve servis avlusu.
const GARAGE = { x0: -22, x1: 4, z0: -396, z1: -378, wall: 5.5, ridge: 7.6 };
const YARD: Box = { x0: -42, x1: 6, z0: LOT.z0, z1: -372 };
const TRUCKS: VehicleSpot[] = [
  [-36, -385, Math.PI / 2],
  [-27, -385, Math.PI / 2],
];
// Batı sokağından istasyon meydanına çakıl yol.
const WEST_PATH = { ax: LOT.x0, az: -304, bx: -110, bz: -322, half: 1.6 };
// Ön meydanda büfe ve şemsiyeler.
const KIOSK: Box = { x0: -94, x1: -88, z0: -272, z1: -266 };
const UMBRELLAS: [number, number][] = [
  [-83, -268],
  [-83, -276],
  [-99, -277],
];

const f = (value: number) => value.toFixed(3);
const box = (b: Box) => `vec2(${f((b.x0 + b.x1) / 2)}, ${f((b.z0 + b.z1) / 2)}), vec2(${f((b.x1 - b.x0) / 2)}, ${f((b.z1 - b.z0) / 2)})`;
const lbox = (b: LocalBox) => `vec2(${f((b.s0 + b.s1) / 2)}, ${f((b.t0 + b.t1) / 2)}), vec2(${f((b.s1 - b.s0) / 2)}, ${f((b.t1 - b.t0) / 2)})`;
const inBox = (b: Box, x: number, z: number, pad = 0) => x > b.x0 - pad && x < b.x1 + pad && z > b.z0 - pad && z < b.z1 + pad;
function segmentDistance(x: number, z: number, p: typeof WEST_PATH) {
  const vx = p.bx - p.ax;
  const vz = p.bz - p.az;
  const k = Math.max(0, Math.min(1, ((x - p.ax) * vx + (z - p.az) * vz) / (vx * vx + vz * vz)));
  return Math.hypot(x - p.ax - vx * k, z - p.az - vz * k);
}

/** Teleferik bloğu planının mesafe fonksiyonları (GLSL, global kapsamda). */
export const CABLECAR_GLSL = `
// Köşeleri r yarıçapla yuvarlatılmış kutuya işaretli uzaklık (içeride negatif).
float ccBox(vec2 p, vec2 c, vec2 h, float r){ vec2 q = abs(p - c) - h + r; return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r; }
float ccIn(float d, float aa){ return 1.0 - smoothstep(-aa, aa, d); }
// Eşit aralıklı çizgiler (metre): çizgi seçilemeyecek kadar uzaksa ortalama yoğunluğuna söner.
float ccLines(float v, float period, float width, float aa){
  float d = abs(fract(v / period + 0.5) - 0.5) * period;
  float line = 1.0 - smoothstep(width * 0.5 - aa, width * 0.5 + aa, d);
  return mix(width / period, line, 1.0 - smoothstep(width * 0.6, width * 1.5, aa));
}
float ccSeg(vec2 p, vec2 a, vec2 b){ vec2 v = b - a; float k = clamp(dot(p - a, v) / dot(v, v), 0.0, 1.0); return length(p - a - v * k); }
// Hat altı bitki tarhları: u hat boyunca, w hatta dik uzaklık. Hat boyunca ~7 m'de bir tür değişir (kırık lavanta, süs otu,
// adaçayı, toprak rengi malç; tür sınırları dalgalı, tonlar çime biraz yaklaşır), ortada çakıl yol, kenarda taş bordür.
vec3 ccBeds(float u, float w, float hw, vec3 lawn, vec3 gravel, float n2, float aa){
  float id = floor(u / 7.0 + 0.35 * sin(w * 0.9 + u * 0.05)) + step(0.0, w) * 17.0;
  float k = fract(sin(id * 12.9898) * 43758.5453);
  vec3 plant = k < 0.3 ? vec3(0.25, 0.22, 0.27) : k < 0.55 ? vec3(0.3, 0.27, 0.15) : k < 0.8 ? vec3(0.15, 0.2, 0.12) : vec3(0.2, 0.15, 0.1);
  plant = mix(plant * (0.82 + 0.36 * n2), lawn, 0.25);
  vec3 c = mix(lawn, plant, ccIn(abs(w) - hw, aa));
  c = mix(c, vec3(0.5, 0.48, 0.44), ccIn(abs(abs(w) - hw) - 0.25, aa) * step(0.5, hw));
  return mix(c, gravel, ccIn(abs(w) - 1.6, aa));
}
`;

const pitGlsl = PIT_GROVES.map(
  (b) =>
    `{ vec2 q = mod(p - vec2(${f(b.x0)}, ${f(b.z0)}), ${f(PIT)}) - ${f(PIT / 2)}; float pit = ccBox(q, vec2(0.0), vec2(1.2), 0.2) + 1e3 * (1.0 - ccIn(ccBox(p, ${box(b)}, 0.0), 0.01)); c = mix(c, granite, ccIn(pit - 0.3, aa)); c = mix(c, vec3(0.1, 0.15, 0.06) * (0.8 + 0.4 * n2), ccIn(pit, aa)); }`,
).join('\n    ');

/** Teleferik bloğunun zemini: CableCar_Ground'un rengi tamamen dünya konumundan çizilir (köşe renkleri yok sayılır). */
export const CABLECAR_FRAGMENT = `#include <color_fragment>
  {
    vec2 p = vWPos.xz;
    float aa = max(fwidth(p.x), fwidth(p.y)) * 0.8 + 0.05;
    float fine = 1.0 - smoothstep(0.8, 2.5, aa);
    float n1 = fbm(p * 0.02);
    float n2 = fbm(p * 0.09 + 41.0);
    float grain = 0.94 + 0.12 * h12(floor(p * 3.0)) * fine;
    vec3 rimColor = vec3(0.55, 0.53, 0.5);
    // İstasyon ekseninde yerel koordinat (s, t).
    vec2 d = p - vec2(${f(STATION.x)}, ${f(STATION.z)});
    vec2 st = vec2(dot(d, vec2(${f(U[0])}, ${f(U[1])})), dot(d, vec2(${f(N[0])}, ${f(N[1])})));

    // Çim: parktaki gibi biçme şeritleri ve geniş ton farkları.
    vec3 lawn = vec3(0.12, 0.19, 0.065) * (0.82 + 0.36 * n1);
    lawn *= 1.0 + (step(0.5, fract((p.x * 0.2 + p.y) / 9.0)) - 0.5) * 0.12 * (1.0 - smoothstep(2.0, 5.0, aa));
    vec3 c = lawn;

    // Plaka kenarında çit bitkisi (girişler, yollar ve otobüs cebi aşağıda üstüne çizilir).
    float edge = min(min(p.x - ${f(LOT.x0)}, ${f(LOT.x1)} - p.x), min(p.y - ${f(LOT.z0)}, ${f(LOT.z1)} - p.y));
    c = mix(c, vec3(0.055, 0.095, 0.035) * (0.7 + 0.6 * fbm(p * 0.45)), ccIn(edge - 2.4 + (n2 - 0.5) * 0.8, aa));

    vec3 gravel = vec3(0.4, 0.34, 0.25) * (0.88 + 0.24 * n2) * grain;
    float joint = max(ccLines(p.x, 1.2, 0.08, aa), ccLines(p.y, 1.2, 0.08, aa));
    vec3 stone = vec3(0.52, 0.49, 0.44) * grain * (0.94 + 0.12 * n2) * (1.0 - 0.1 * joint);
    vec3 granite = vec3(0.27, 0.26, 0.25) * grain;
    vec3 asphalt = vec3(0.2, 0.195, 0.19) * (0.88 + 0.24 * n2);

    // Hat altı bahçeleri: tepe hattı istasyon ekseninde, doğu hattı z ekseninde.
    float hill = step(${f(HILL_GARDEN.s0)}, st.x) * ccIn(abs(st.y) - ${f(HILL_GARDEN.half)}, aa);
    c = mix(c, ccBeds(st.x, st.y, ${f(HILL_GARDEN.half - 1)}, c, gravel, n2, aa), hill);
    float east = step(${f(EAST_GARDEN.x0)}, p.x) * ccIn(abs(p.y - ${f(EAST_GARDEN.z)}) - ${f(EAST_GARDEN.half)}, aa);
    c = mix(c, ccBeds(p.x, p.y - ${f(EAST_GARDEN.z)}, ${f(EAST_GARDEN.half - 1)}, c, gravel, n2, aa), east);

    // Batı sokağından meydana çakıl yol.
    c = mix(c, gravel, ccIn(ccSeg(p, vec2(${f(WEST_PATH.ax)}, ${f(WEST_PATH.az)}), vec2(${f(WEST_PATH.bx)}, ${f(WEST_PATH.bz)})) - ${f(WEST_PATH.half)}, aa));

    // Otobüs cebi ve taksi şeridi: asfalt, cebin kenarında kesik çizgi, taksi yerleri; servis avlusu asfalt.
    float bay = ccBox(p, ${box(BAY)}, 0.0);
    c = mix(c, asphalt, ccIn(bay, aa));
    float dash = step(0.5, fract(p.x / 3.0));
    c = mix(c, vec3(0.6, 0.53, 0.33), ccIn(abs(p.y - ${f(BAY.z1 - 0.4)}) - 0.08, aa) * dash * fine * step(p.x, -96.0));
    c = mix(c, rimColor, ccLines(p.x - ${f(TAXIS[0][0] - 3.5)}, 7.0, 0.12, aa) * step(-96.0, p.x) * step(p.y, ${f(BAY.z1)}) * step(${f(BAY.z1 - 3.6)}, p.y));
    float yard = ccBox(p, ${box(YARD)}, 0.6);
    c = mix(c, asphalt * 1.08, ccIn(yard, aa));
    c = mix(c, rimColor, ccIn(abs(yard) - 0.2, aa) * fine);

    // Bekleme bandı, kuzey yolu, ön meydan: açık taş.
    float paved = min(min(ccBox(p, ${box(BAY_WALK)}, 0.0), ccBox(p, ${box(NORTH_PATH)}, 0.3)), ccBox(p, ${box(FRONT)}, 0.0));
    c = mix(c, stone, ccIn(paved, aa));
    c = mix(c, granite, ccIn(abs(p.y - ${f(BAY_WALK.z0 + 0.3)}) - 0.3, aa) * step(${f(BAY_WALK.x0)}, p.x) * step(p.x, ${f(BAY_WALK.x1)}));
    ${pitGlsl}

    // İstasyon meydanı: eksene hizalı traverten, 6 m'de bir granit bant, granit kenar.
    float pd = ccBox(st, vec2(0.0), vec2(${f(PLAZA.halfS)}, ${f(PLAZA.halfT)}), 3.0);
    vec3 travertine = vec3(0.58, 0.55, 0.49) * grain * (0.94 + 0.12 * n2);
    travertine = mix(travertine, granite, ccLines(st.x, 6.0, 0.45, aa) * 0.6);
    c = mix(c, travertine, ccIn(pd, aa));
    c = mix(c, granite, ccIn(abs(pd + 0.7) - 0.5, aa));
    // İstasyonun altı: koyu taş (çatının gölgesinde, ışık havuzu ayrıca düşer).
    float under = ccBox(st, ${lbox(STATION_ROOF)}, 1.0);
    c = mix(c, vec3(0.34, 0.33, 0.31) * grain, ccIn(under, aa));
    // Saçağın altında bekleme çizgileri, girişten ön meydanın ortasına hissedilebilir yüzey (aşı sarısı).
    float queue = ccLines(st.x, 2.4, 0.1, aa) * ccIn(ccBox(st, ${lbox(CANOPY)}, 0.0), aa);
    c = mix(c, vec3(0.62, 0.6, 0.55), queue * fine);
    float guide = ccSeg(p, vec2(${toWorld(0, CANOPY.t0).map(f).join(', ')}), vec2(-80.0, ${f(LOT.z1)}));
    c = mix(c, vec3(0.55, 0.45, 0.24) * grain, ccIn(guide - 0.4, aa));

    diffuseColor.rgb = c;
  }`;

// ------------------------------------------------------------------ binalar

// Duvar ve çatı paleti: kreş ve okuldaki kırık beyaz duvar, yeşil düz ve arduvaz beşik çatı (aynı değer, aynı cephe programı).
const CIVIC_PALETTE = 'vec2(0.1, 0.9)';
const ROTATION = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), ANGLE);

function localMatrix(b: LocalBox, height: number) {
  const [x, z] = toWorld((b.s0 + b.s1) / 2, (b.t0 + b.t1) / 2);
  return new THREE.Matrix4().compose(
    new THREE.Vector3(x, BASE_Y + height / 2, z),
    ROTATION,
    new THREE.Vector3((b.s1 - b.s0) / 2, height / 2, (b.t1 - b.t0) / 2),
  );
}

function buildingMeshes(source: THREE.Material) {
  const civic = source.clone();
  civic.defines = { ...civic.defines, CITY_PALETTE: CIVIC_PALETTE };
  const instanced = (name: string, geometry: THREE.BufferGeometry, matrices: THREE.Matrix4[]) => {
    const mesh = new THREE.InstancedMesh(geometry, civic, matrices.length);
    mesh.name = name;
    matrices.forEach((m, i) => mesh.setMatrixAt(i, m));
    mesh.instanceMatrix.needsUpdate = true;
    return mesh;
  };
  // Garaj: duvar ve mahyası doğu-batı beşik çatı.
  const wall = -1 + (2 * GARAGE.wall) / GARAGE.ridge;
  const garage = new MassBuilder().box(-1, 1, -1, wall, -1, 1, false).pitchedRoof(wall, 1, true, 1).build();
  const g = GARAGE;
  return [
    instanced('CableCar_TicketHall', MASS_VARIANTS.plain().build(), [localMatrix(TICKET_HALL, TICKET_HALL.height)]),
    instanced('CableCar_Lift', MASS_VARIANTS.plain().build(), [localMatrix(LIFT, LIFT.height)]),
    instanced('CableCar_Garage', garage, [
      new THREE.Matrix4().compose(
        new THREE.Vector3((g.x0 + g.x1) / 2, BASE_Y + g.ridge / 2, (g.z0 + g.z1) / 2),
        new THREE.Quaternion(),
        new THREE.Vector3((g.x1 - g.x0) / 2, g.ridge / 2, (g.z1 - g.z0) / 2),
      ),
    ]),
  ];
}

// ------------------------------------------------------------------ parçalar

// Kırık tonlar: şehrin paletinden kopmayan, doygunluğu düşük renkler.
const TONE = {
  terracotta: '#b9775a',
  sage: '#8fa385',
  slate: '#7f98a8',
  wood: '#a88a68',
  white: '#e6e1d6',
  steel: '#8c8f92',
  roof: '#a9aaa6',
  ridge: '#7c7e7d',
  canvas: '#ddd6c8',
  crate: '#9a7a55',
  cabin: '#c9c6bd',
};
const BIKE_TONES = [TONE.slate, TONE.ridge, TONE.terracotta, TONE.sage, TONE.white];

function bench(props: PropBuilder, x: number, z: number, alongX: boolean) {
  const y = GROUND_Y;
  const [hx, hz] = alongX ? [0.9, 0.3] : [0.3, 0.9];
  props.box(x - hx, x + hx, y + 0.3, y + 0.45, z - hz, z + hz, TONE.wood);
  props.box(x - hx * 0.85, x + hx * 0.85, y, y + 0.3, z - hz * 0.7, z + hz * 0.7, TONE.steel);
}

// Banklar: ön meydanda ağaç havuzlarının kenarında, hat altı yollarının iki yanında.
const BENCHES: [number, number, boolean][] = [
  [-92, -290, true],
  [-68, -290, true],
  ...[-40, -20, 0].map((x): [number, number, boolean] => [x, EAST_GARDEN.z + 2.6, true]),
  ...[56, 72].map((s): [number, number, boolean] => [...toWorld(s, 2.6), true]),
];

/** İstasyon ekseninde kurulan parçalar (yerel s, t; sonra dünyaya döndürülür). */
function stationProps() {
  const props = new PropBuilder();
  const y = GROUND_Y;
  const c = CANOPY;
  // Saçak: dış kenarda dikmeler, ince çatı. Altında bilet otomatları ve turnike sırası.
  for (let s = c.s0 + 0.5; s <= c.s1 - 0.5; s += (c.s1 - c.s0 - 1) / 4) props.box(s - 0.12, s + 0.12, y, y + 4.2, c.t0 + 0.2, c.t0 + 0.44, TONE.steel);
  props.box(c.s0 - 0.5, c.s1 + 0.5, y + 4.2, y + 4.45, c.t0 - 0.3, c.t1, TONE.ridge);
  for (let s = -8; s <= -3; s += 1.25) props.box(s - 0.35, s + 0.35, y, y + 1.7, -9.4, -8.8, TONE.slate);
  for (let s = 1; s <= 8; s += 1.4) props.box(s - 0.08, s + 0.08, y, y + 1.0, -11.2, -9.6, TONE.steel);
  return props.build().applyMatrix4(new THREE.Matrix4().compose(new THREE.Vector3(STATION.x, 0, STATION.z), ROTATION, new THREE.Vector3(1, 1, 1)));
}

function propsGeometry() {
  const props = new PropBuilder();
  const y = GROUND_Y;
  // Otobüs durağı: arkası ve yanları kapalı sundurma, altında bank.
  const sh = SHELTER;
  props.box(sh.x0, sh.x1, y, y + 2.6, sh.z0, sh.z0 + 0.15, TONE.canvas);
  for (const x of [sh.x0, sh.x1 - 0.15]) props.box(x, x + 0.15, y, y + 2.6, sh.z0, sh.z1, TONE.steel);
  props.box(sh.x0 - 0.3, sh.x1 + 0.3, y + 2.6, y + 2.8, sh.z0 - 0.2, sh.z1 + 0.4, TONE.ridge);
  bench(props, (sh.x0 + sh.x1) / 2 - 2.5, sh.z0 + 0.7, true);
  bench(props, (sh.x0 + sh.x1) / 2 + 2.5, sh.z0 + 0.7, true);
  // Bisiklet istasyonu: yuva rayı ve sıra sıra bisikletler.
  const b = BIKES;
  props.box(b.x0, b.x1, y, y + 0.9, b.z0, b.z0 + 0.3, TONE.ridge);
  for (let x = b.x0 + 0.5, k = 0; x < b.x1; x += 0.9, k++) {
    if (hash2(x, 7.7) < 0.3) continue;
    props.box(x - 0.05, x + 0.05, y, y + 1.0, b.z0 + 0.3, b.z1 + 0.3, BIKE_TONES[k % BIKE_TONES.length]);
  }
  // Büfe (geniş saçaklı) ve şemsiyeli masalar.
  const k = KIOSK;
  props.box(k.x0, k.x1, y, y + 3.0, k.z0, k.z1, TONE.white);
  props.box(k.x0 - 1.4, k.x1 + 1.4, y + 3.0, y + 3.3, k.z0 - 1.4, k.z1 + 1.4, TONE.ridge);
  for (const [i, [x, z]] of UMBRELLAS.entries()) {
    props.box(x - 0.6, x + 0.6, y, y + 0.75, z - 0.6, z + 0.6, TONE.white);
    props.box(x - 0.06, x + 0.06, y + 0.75, y + 2.4, z - 0.06, z + 0.06, TONE.steel);
    props.pyramid(x - 1.6, x + 1.6, y + 2.3, y + 2.9, z - 1.6, z + 1.6, [TONE.terracotta, TONE.sage, TONE.canvas][i % 3]);
  }
  for (const [x, z, along] of BENCHES) bench(props, x, z, along);
  // Garajın batısında yedek kabin (palet üstünde) ve palet yığını.
  props.box(-25.4, -22.6, y, y + 0.25, -394, -391.2, TONE.crate);
  props.box(-25.2, -22.8, y + 0.25, y + 2.75, -393.8, -391.4, TONE.cabin);
  props.box(-25.1, -22.9, y + 1.4, y + 2.3, -393.85, -391.35, TONE.slate);
  for (let i = 0; i < 3; i++) props.box(-25.2, -23.2, y, y + 0.5 * (3 - i), -389 + i * 1.6, -387.8 + i * 1.6, TONE.crate);
  return props.build();
}

// ------------------------------------------------------------------ araçlar

function vehicleMeshes(cityRoot: THREE.Object3D) {
  return [parkedVehicles(cityRoot, 'Cars_White', 'CableCar', TAXIS), parkedVehicles(cityRoot, 'Trucks', 'CableCar', TRUCKS)].filter(
    (mesh) => mesh !== null,
  );
}

// ------------------------------------------------------------------ ağaçlar ve lambalar

const pad = (b: Box, d: number): Box => ({ x0: b.x0 - d, x1: b.x1 + d, z0: b.z0 - d, z1: b.z1 + d });
// Ağaç dikilmeyen yerler: tepe bunların üstüne taşmaz.
const SOLID: Box[] = [BAY, YARD, GARAGE, pad(SHELTER, 0.5), pad(BIKES, 0.5), pad(KIOSK, 1.4)];
const PAVED: Box[] = [BAY_WALK, NORTH_PATH, FRONT];

/** Tepe yarıçapı `radius` olan ağaç buraya sığar mı: plakada, yapılardan, döşemelerden, hat bahçelerinden ve lambalardan uzak. */
function treeAllowed(x: number, z: number, radius: number, lamps: number[]) {
  if (!inBox(LOT, x, z, -radius)) return false;
  if (SOLID.some((b) => inBox(b, x, z, radius + 0.5))) return false;
  if (PAVED.some((b) => inBox(b, x, z, radius * 0.5 + 1))) return false;
  const [s, t] = toLocal(x, z);
  // İstasyon meydanı (döndürülmüş, kenarına biraz taşabilir) ve hat altı bahçeleri (hattın altı açık kalır).
  if (Math.abs(s) < PLAZA.halfS + radius * 0.5 + 1 && Math.abs(t) < PLAZA.halfT + radius * 0.5 + 1) return false;
  if (s > HILL_GARDEN.s0 - radius && Math.abs(t) < HILL_GARDEN.half + radius * 0.5) return false;
  if (x > EAST_GARDEN.x0 - radius && Math.abs(z - EAST_GARDEN.z) < EAST_GARDEN.half + radius * 0.5) return false;
  if (segmentDistance(x, z, WEST_PATH) < WEST_PATH.half + radius * 0.5 + 0.5) return false;
  if (UMBRELLAS.some(([ux, uz]) => Math.hypot(x - ux, z - uz) < radius + 1.8)) return false;
  if (BENCHES.some(([bx, bz]) => Math.hypot(x - bx, z - bz) < 2)) return false;
  for (let i = 0; i < lamps.length; i += 3) if (Math.hypot(x - lamps[i], z - lamps[i + 2]) < radius + 1) return false;
  return true;
}

function plantTrees(crown: number, lamps: number[]): TreeSpot[] {
  const trees: TreeSpot[] = [];
  const free = (x: number, z: number, spacing: number) => trees.every(([tx, tz]) => Math.hypot(tx - x, tz - z) > spacing);
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
  const scatter = (b: Box, count: number, spacing: number, seed: number, sizes?: number[]) => {
    for (let k = 0; k < count; k++) add(b.x0 + hash2(k, seed) * (b.x1 - b.x0), b.z0 + hash2(k, seed + 1) * (b.z1 - b.z0), spacing, sizes);
  };
  // Ön meydanın ağaç havuzları (döşemenin içinde, ızgara düzeninde).
  for (const b of PIT_GROVES) {
    for (let x = b.x0 + PIT / 2; x < b.x1; x += PIT) {
      for (let z = b.z0 + PIT / 2; z < b.z1; z += PIT) {
        if (!UMBRELLAS.some(([ux, uz]) => Math.hypot(x - ux, z - uz) < 5) && !inBox(KIOSK, x, z, 4)) trees.push([x, z, 0.62]);
      }
    }
  }
  // Kenar dizileri (plakanın içinde, kaldırıma taşmaz) ve köşe koruları.
  for (let x = LOT.x0 + 6; x < LOT.x1 - 4; x += 10) add(x, LOT.z1 - 6, 8, [0.8, 0.62]);
  for (let z = LOT.z0 + 8; z < LOT.z1 - 4; z += 10) {
    add(LOT.x0 + 6, z, 8, [0.8, 0.62]);
    add(LOT.x1 - 6, z, 8, [0.8, 0.62]);
  }
  scatter({ x0: LOT.x0, x1: -96, z0: -330, z1: LOT.z1 }, 30, 10, 200);
  scatter({ x0: LOT.x0, x1: -110, z0: LOT.z0, z1: -362 }, 20, 9, 210);
  scatter({ x0: -30, x1: LOT.x1, z0: -320, z1: LOT.z1 }, 24, 10, 220);
  scatter({ x0: -60, x1: LOT.x1, z0: -371, z1: -340 }, 20, 9, 230);
  // Hat altı bahçelerinin kenarında küçük ağaçlar (gondollar ~16 m'nin üstünde, ağaç ~8 m).
  for (let x = EAST_GARDEN.x0 + 8; x < LOT.x1 - 4; x += 12) {
    add(x, EAST_GARDEN.z - EAST_GARDEN.half - 4, 8, [0.62]);
    add(x + 6, EAST_GARDEN.z + EAST_GARDEN.half + 4, 8, [0.62]);
  }
  for (let s = HILL_GARDEN.s0 + 8; s < HILL_GARDEN.s1; s += 12) {
    add(...toWorld(s, HILL_GARDEN.half + 4), 8, [0.62]);
    add(...toWorld(s + 6, -HILL_GARDEN.half - 4), 8, [0.62]);
  }
  return trees;
}

/** Lambalar: istasyon meydanı çevresi, ön meydan, hat altı yolları, bekleme bandı, kuzey yolu, servis avlusu. */
function cableCarLamps(): number[] {
  const lamps: number[] = [];
  const low = GROUND_Y + 4.5;
  const tall = GROUND_Y + 8;
  const rim = (s: number, t: number) => {
    const [x, z] = toWorld(s, t);
    lamps.push(x, low, z);
  };
  for (let s = -PLAZA.halfS + 6; s <= PLAZA.halfS - 6; s += 17) {
    rim(s, PLAZA.halfT - 1.5);
    if (s < CANOPY.s0 - 4 || s > CANOPY.s1 + 4) rim(s, -PLAZA.halfT + 1.5);
  }
  for (const x of [-116, -100, -60, -44]) lamps.push(x, low, FRONT.z0 + 1.5);
  for (let x = EAST_GARDEN.x0 + 26; x < LOT.x1 - 4; x += 18) lamps.push(x, low, EAST_GARDEN.z - 2.2);
  for (let s = HILL_GARDEN.s0 + 10; s < 95; s += 18) rim(s, -2.2);
  for (let x = BAY_WALK.x0 + 10; x < BAY_WALK.x1; x += 22) lamps.push(x, low, BAY_WALK.z1 - 0.6);
  lamps.push(NORTH_PATH.x1 + 0.8, low, -372, -10, tall, YARD.z1 - 1.5, -38, tall, YARD.z1 - 1.5);
  return lamps;
}

// ------------------------------------------------------------------ kurulum

/** Mesh'in bu alandaki üçgenlerini siler (dizinden çıkarır). Diğer istasyonlarla ortak meydan mesh'i için. */
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

const OWN = /^CableCar_(TicketHall|Lift|Garage|Props|StationProps)$/;

/**
 * Teleferik bloğunu yeniden düzenler: ortak meydan mesh'inden bu bloğun üçgenleri silinir, zemin rengi CABLECAR_FRAGMENT ile
 * çizilir (cityRuntime CableCar_Ground'a uygular). İstasyonun altına bilet salonu ve kule, köşeye garaj, parçalar, araçlar
 * ve ağaçlar eklenir. Lamba konumlarını döndürür. Hazırlık ikinci kez çalışırsa (StrictMode) tekrar etmez. Araçlar
 * createTraffic'ten sonra kurulur (park etmiş araç mesh'lerinden).
 */
export function landscapeCableCar(cityRoot: THREE.Object3D, treeScale: number): number[] {
  const done = cityRoot.userData.cableCarLamps as number[] | undefined;
  if (done) return done;
  cityRoot.updateMatrixWorld(true);
  const ground = cityRoot.getObjectByName('CableCar_Ground');
  const plazas = cityRoot.getObjectByName('CableCar_Plazas');
  const roofs = cityRoot.getObjectByName('CableCar_Station_Roofs');
  let facade: THREE.Material | null = null;
  cityRoot.traverse((object) => {
    if (!facade && object instanceof THREE.InstancedMesh && object.name.startsWith('Residential_Buildings_')) {
      facade = object.material as THREE.Material;
    }
  });
  if (!(ground instanceof THREE.Mesh) || !(plazas instanceof THREE.Mesh) || !(roofs instanceof THREE.Mesh) || !facade) return [];
  if (Array.isArray(roofs.material)) return [];

  dropTriangles(plazas, LOT);
  const parent = ground.parent ?? cityRoot;
  // Parçalar istasyon çatısının satin malzemesini paylaşır (köşe renkli).
  const props = new THREE.Mesh(propsGeometry(), roofs.material);
  props.name = 'CableCar_Props';
  const stationPart = new THREE.Mesh(stationProps(), roofs.material);
  stationPart.name = 'CableCar_StationProps';
  for (const mesh of [props, stationPart, ...buildingMeshes(facade)]) parent.add(mesh);
  for (const mesh of vehicleMeshes(cityRoot)) parent.add(mesh);
  // Yeni parçalar dünya koordinatında kuruldu: ebeveynin dönüşümü birim olmalı.
  parent.updateMatrixWorld(true);
  if (!parent.matrixWorld.equals(new THREE.Matrix4())) {
    const inverse = parent.matrixWorld.clone().invert();
    for (const child of parent.children) {
      if (OWN.test(child.name) || child.name.startsWith('Traffic_CableCar_')) child.applyMatrix4(inverse);
    }
  }

  const lamps = cableCarLamps();
  replantTrees(cityRoot, {
    prefix: 'CableCar',
    inside: (x, z) => inBox(SITE, x, z),
    spots: plantTrees(crownRadius(cityRoot, treeScale), lamps),
    treeScale,
  });
  cityRoot.updateMatrixWorld(true);
  cityRoot.userData.cableCarLamps = lamps;
  return lamps;
}
