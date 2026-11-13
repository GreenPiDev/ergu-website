// Havalimanı (bütün saha x -320..1500, z -1320..-598). Modelde düz bir çim plakası, üstünde iki pist, paralel taksi yolu ve
// bağlantıları, düz gri apronlar ve beyaz çizgi kutuları vardı. Çimin kuzeyinde 30 m'lik açık renk yamalar barkod gibi
// duruyordu, taksi yollarında sarı çizgi, apronda park yeri işareti yoktu. İtfaiye, kule, yakıt tankları ve hangarlar
// çimin ortasında hiçbir yola bağlı değildi, batıdaki kargo binası 280×50×16 m'lik düz bir bloktu. Model değişmeden
// açılışta yeniden düzenlenir:
// - Pistler, taksi yolları ve apronlar aynı yerde kalır (uçaklar ve pist ışıkları onlara hizalı). Zemin tek düzlem olur,
//   rengi shader'la çizilir: çim, pist emniyet şeridi ve drenaj, pist omuzları, eşik tuşları, pist numaraları (09L/27R,
//   09R/27L), eksen, temas bölgesi ve hedef noktası, uçlarda sarı oklu güvenlik alanı, taksi yollarında sarı eksen ve kenar
//   çizgileri, kavşaklarda yay ve bekleme çizgileri, apronda beton plaklar, park yerlerine yönlendirme çizgileri, durma
//   çubukları, kırmızı ekipman sınırı ve servis yolu. Hava tarafı servis yolları itfaiyeyi, kargoyu, kuleyi, hangarları ve
//   yakıt çiftliğini birbirine bağlar.
// - Kara tarafı (terminal önü ve otopark) eski düz plakanın yüksekliğinde: granit kaldırım, otopark çizgileri, yürüyüş
//   yolları, yeşil şeritler. Yollar ve 400 park etmiş araç yerinde kalır.
// - Terminal gövdesi, dalgalı çatı, iskeleler, hangar gövdeleri, kule, yakıt tankları ve katlı otoparklar korunur. Kargo
//   binası, itfaiye, kule tabanı ve batıdaki direk kaldırılıp yeniden kurulur. Körük köprüler yeniden yapılır.
// - Parçalar (kırık tonlar): yer araçları, itfaiye araçları, ULD arabaları, hangar kapıları, kule balkonu ve anteni, radar
//   kulesi, yakıt setleri ve dolum saçağı, terminal saçağı, yaya geçitleri, bekleme levhaları, rüzgâr tulumları, apron
//   projektör direkleri. Ağaçlar yalnızca kara tarafında (havacılık güvenliği), lambalar apron, terminal önü ve otoparkta.
// Yerleşim planı aşağıdaki sabitlerde tek yerde tanımlanır. GLSL ve TypeScript tarafı aynı ölçüleri kullanır.
import * as THREE from 'three';
import { MASS_VARIANTS, PropBuilder, type VehicleSpot, parkedVehicles } from './cityMass';
import { type TreeSpot, crownRadius, hash2, replantTrees } from './cityTrees';

interface Box {
  x0: number;
  x1: number;
  z0: number;
  z1: number;
}

const SITE: Box = { x0: -320, x1: 1500, z0: -1320, z1: -598 };
// Hava tarafının zemini (modeldeki pist kaplamasıyla aynı yükseklik), kara tarafı plakası (eski terminal önü ve otopark
// zemini), yolların hemen altında kalan servis yolları ve kargo avlusu. Binalar biraz aşağıdan başlar (zemine gömülür).
const FIELD_Y = 0.3;
const SLAB_Y = 0.76;
const LOW_Y = 0.5;
const BASE_Y = 0.25;

// ---- pistler ve taksi yolları (modeldeki kaplamalarla aynı)
// Harf ve rakam kimlikleri (apGlyph): 0 → '0', 1 → '2', 2 → '7', 3 → '9', 4 → 'L', 5 → 'R'. Pistler doğu-batı: batı ucu 09,
// doğu ucu 27. Kuzeydeki pist doğuya inen pilotun solunda (L), batıya inenin sağında (R).
interface Runway {
  x0: number;
  x1: number;
  z: number;
  half: number;
  west: [number, number, number];
  east: [number, number, number];
}
const RUNWAYS: Runway[] = [
  { x0: -250, x1: 1450, z: -1180, half: 30, west: [0, 3, 4], east: [1, 2, 5] },
  { x0: -150, x1: 1350, z: -1040, half: 25, west: [0, 3, 5], east: [1, 2, 4] },
];
const TAXIWAY = { x0: -150, x1: 1350, z: -960, half: 12 };
const CONNECTORS = [-150, 250, 650, 1050, 1350];
const CONNECTOR_HALF = 11;
// Bağlantılarda bekleme çizgileri: z ve pistin yönü (kesikli çizgiler o tarafta).
const HOLDS: [number, number][] = [
  [-990, -1],
  [-1085, 1],
  [-1130, -1],
];
// Kavşaklarda taksi ekseninin yarıçapı.
const TURN = 30;

// ---- apronlar ve servis alanları
const APRON: Box = { x0: 330, x1: 1160, z0: -950, z1: -796 };
const GA_APRON: Box = { x0: -130, x1: 230, z0: -950, z1: -880 };
const HANGAR_APRON: Box = { x0: 1160, x1: 1400, z0: -950, z1: -860 };
const FIRE_PAD: Box = { x0: 258, x1: 342, z0: -846, z1: -803 };
const TAXILANE_Z = -926;
// Terminalin hava tarafı yüzü boyunca servis yolu (7 m).
const SERVICE: Box = { x0: 342, x1: 1160, z0: -803, z1: -796 };
// Hava tarafı servis yolları: itfaiyeden kargoya ve genel havacılık apronuna, apron doğusundan kuleye ve yakıt çiftliğine.
const SERVICE_ROADS: Box[] = [
  { x0: 196, x1: 258, z0: -841.5, z1: -834.5 },
  { x0: 196, x1: 204, z0: -880, z1: -834.5 },
  { x0: 1160, x1: 1298, z0: -818.5, z1: -811.5 },
  { x0: 1290.5, x1: 1297.5, z0: -818.5, z1: -703.5 },
];
// Kara tarafından yakıt çiftliğine (terminal önü yolunun doğu ucundan), kule otoparkına ve radara giden yollar.
const FUEL_ROAD: Box = { x0: 1100, x1: 1302, z0: -703.5, z1: -696.5 };
const TOWER_SPUR: Box = { x0: 1189.5, x1: 1196.5, z0: -744, z1: -703.5 };
const TOWER_LOT: Box = { x0: 1170, x1: 1216, z0: -758, z1: -744 };
const RADAR_SPUR: Box = { x0: 80, x1: 94, z0: -773.5, z1: -766.5 };
const RADAR_PAD: Box = { x0: 40, x1: 80, z0: -790, z1: -750 };
const RADAR = { x: 60, z: -770 };
// Kargo avlusu: şehirden gelen yol (x 94..106) burada biter, kamyonlar binanın güney yüzündeki rampalara yanaşır.
const CARGO_YARD: Box = { x0: -90, x1: 196, z0: -848, z1: -812 };
const DOCK_X0 = -72;
const DOCK_STEP = 10;
const DOCKS = 24;
// Yakıt çiftliği: tankların çevresinde beton set, batısında pompa binası, yolun üstünde dolum saçağı.
const BUND: Box = { x0: 1302, x1: 1398, z0: -768, z1: -672 };
const PUMP: Box = { x0: 1262, x1: 1284, z0: -760, z1: -746 };
const LOADING: Box = { x0: 1228, x1: 1254, z0: -706, z1: -694 };

// ---- kara tarafı
const FORECOURT: Box = { x0: 430, x1: 1070, z0: -723, z1: -715 };
const SLAB: Box = { x0: 458, x1: 1071.5, z0: -695, z1: -599 };
const LOT: Box = { x0: 614, x1: 926, z0: -692, z1: -614 };
const WALKS: Box[] = [
  { x0: 602, x1: 614, z0: -695, z1: -612 },
  { x0: 926, x1: 934, z0: -695, z1: -612 },
];
const GARAGES: Box[] = [
  { x0: 470, x1: 590, z0: -689, z1: -615 },
  { x0: 940, x1: 1060, z0: -689, z1: -615 },
];
// Park etmiş araçların sıraları (z) ve x adımı: çizgiler araçların arasına düşer.
const BAY_ROWS = [-620.45, -636.45, -652.45, -668.45, -684.45];
const BAY_X0 = 641.6;
const BAY_STEP = 2.8;
const CROSSINGS = [608, 750, 930];
const CANOPY = { x0: 446, x1: 1054, z0: -723, z1: -712.6, y: 7 };

// ---- yeni ve yenilenen yapılar
const CARGO: Box = { x0: -80, x1: 170, z0: -878, z1: -848 };
const CARGO_OFFICE: Box = { x0: 170, x1: 194, z0: -880, z1: -842 };
const FIRE_BAYS: Box = { x0: 268, x1: 318, z0: -803, z1: -779 };
const FIRE_OFFICE: Box = { x0: 318, x1: 334, z0: -803, z1: -779 };
const HOSE_TOWER: Box = { x0: 324, x1: 331, z0: -798, z1: -791 };
const TOWER_BASE: Box = { x0: 1170, x1: 1214, z0: -792, z1: -758 };
const HANGARS: Box[] = [
  { x0: 1195, x1: 1285, z0: -940, z1: -870 },
  { x0: 1295, x1: 1385, z0: -940, z1: -870 },
];
const ANNEXES: Box[] = HANGARS.map((h) => ({ x0: h.x0 + 10, x1: h.x1 - 10, z0: h.z1, z1: h.z1 + 8 }));
// Modelden kaldırılan yapılar (üçgen merkezine göre): kargo, itfaiye, kule tabanı ve batıdaki direk.
const DROP_BUILDINGS: Box[] = [
  { x0: -91, x1: 191, z0: -876, z1: -824 },
  { x0: 274, x1: 326, z0: -806, z1: -774 },
  { x0: 1169, x1: 1211, z0: -785, z1: -759 },
];
const DROP_MAST: Box = { x0: 50, x1: 70, z0: -780, z1: -760 };

// ---- park yerleri: burun noktası, burnun yönü ve duvara uzaklık (körük köprü). Uçaklar modeldeki yerinde.
interface Stand {
  x: number;
  z: number;
  hx: number;
  hz: number;
  gap: number;
}
const STANDS: Stand[] = [
  ...[-818, -872].flatMap((z) => [
    { x: 553.4, z, hx: 1, hz: 0, gap: 6.6 },
    { x: 606.6, z, hx: -1, hz: 0, gap: 6.6 },
    { x: 873.4, z, hx: 1, hz: 0, gap: 6.6 },
    { x: 926.6, z, hx: -1, hz: 0, gap: 6.6 },
  ]),
  { x: 740, z: -826.6, hx: 0, hz: 1, gap: 33.6 },
];
// Genel havacılık apronundaki iki uçak (köprüsüz).
const GA_STANDS: Stand[] = [
  { x: -40.6, z: -912, hx: 1, hz: 0, gap: 0 },
  { x: 139.4, z: -912, hx: 1, hz: 0, gap: 0 },
];
const PLANE_HALF = 21.7;
const WING_HALF = 17;
// Apron projektör direkleri (park yerlerinin ve taksi hattının dışında).
const MASTS: [number, number][] = [
  [345, -806],
  [498, -806],
  [690, -806],
  [790, -806],
  [985, -806],
  [1150, -806],
  [580, -904],
  [900, -904],
  [-105, -883],
  [50, -883],
  [215, -883],
  [1180, -866],
  [1392, -866],
];
const MAST_HEIGHT = 25;

const f = (value: number) => value.toFixed(3);
const v2 = (x: number, z: number) => `vec2(${f(x)}, ${f(z)})`;
const box = (b: Box) => `${v2((b.x0 + b.x1) / 2, (b.z0 + b.z1) / 2)}, ${v2((b.x1 - b.x0) / 2, (b.z1 - b.z0) / 2)}`;
const inBox = (b: Box, x: number, z: number, pad = 0) => x > b.x0 - pad && x < b.x1 + pad && z > b.z0 - pad && z < b.z1 + pad;

// ---- apron çizgileri: doğru parçaları ve çeyrek yaylar (merkez, yarıçap, yayın iki ucuna giden yönler)
type Segment = [number, number, number, number];
type Arc = [number, number, number, number, number, number, number];
const APRON_SEGMENTS: Segment[] = [];
const APRON_ARCS: Arc[] = [];
const STOP_BARS: Segment[] = [];

/** Park yerine yönlendirme: burundan geriye düz, yayla dönüp taksi hattına iner. */
function leadIn(s: Stand, turn: number, toZ: number) {
  const r = 20;
  const xt = s.x - s.hx * turn;
  APRON_SEGMENTS.push([xt + s.hx * r, s.z, s.x, s.z], [xt, s.z - r, xt, toZ]);
  APRON_ARCS.push([xt + s.hx * r, s.z - r, r, 0, 1, -s.hx, 0]);
}
for (const s of STANDS) {
  if (s.hx !== 0) leadIn(s, 73.4, TAXILANE_Z);
  else APRON_SEGMENTS.push([s.x, s.z, s.x, TAXILANE_Z]);
}
for (const s of GA_STANDS) leadIn(s, 75.4, TAXIWAY.z);
for (const s of [...STANDS, ...GA_STANDS]) {
  const x = s.x + s.hx * 1.5;
  const z = s.z + s.hz * 1.5;
  STOP_BARS.push(s.hx !== 0 ? [x, z - 3, x, z + 3] : [x - 3, z, x + 3, z]);
}
APRON_SEGMENTS.push(
  [APRON.x0 + 10, TAXILANE_Z, APRON.x1 - 5, TAXILANE_Z],
  [450, TAXIWAY.z, 450, TAXILANE_Z],
  [1100, TAXIWAY.z, 1100, TAXILANE_Z],
  [1240, TAXIWAY.z, 1240, -941],
  [1340, TAXIWAY.z, 1340, -941],
);

/** Uçağın ekipman sınırı kutusu (merkez ve yarı ölçüler, kanat ucundan 4 m pay). */
function standBox(s: Stand): [number, number, number, number] {
  const cx = s.x - s.hx * PLANE_HALF;
  const cz = s.z - s.hz * PLANE_HALF;
  return s.hx !== 0 ? [cx, cz, PLANE_HALF + 4, WING_HALF + 4.5] : [cx, cz, WING_HALF + 4.5, PLANE_HALF + 4];
}

const segGlsl = (list: Segment[]) => list.map(([ax, az, bx, bz]) => `d = min(d, apSeg(p, ${v2(ax, az)}, ${v2(bx, bz)}));`).join('\n      ');
const arcGlsl = (list: Arc[]) =>
  list.map(([cx, cz, r, ax, az, bx, bz]) => `d = min(d, apArc(p, ${v2(cx, cz)}, ${f(r)}, ${v2(ax, az)}, ${v2(bx, bz)}));`).join('\n      ');
const eraGlsl = [...STANDS, ...GA_STANDS]
  .map((s) => {
    const [cx, cz, hx, hz] = standBox(s);
    return `e = min(e, abs(apBox(p, ${v2(cx, cz)}, ${v2(hx, hz)}, 0.0)));`;
  })
  .join('\n      ');

/** Havalimanı planının mesafe fonksiyonları ve pist çizimi (GLSL, global kapsamda). */
export const AIRPORT_GLSL = `
float apBox(vec2 p, vec2 c, vec2 h, float r){ vec2 q = abs(p - c) - h + r; return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r; }
float apIn(float d, float aa){ return 1.0 - smoothstep(-aa, aa, d); }
// w genişliğinde çizgi: çizgi pikselden inceyse kapladığı paya söner (uzakta bulanık kalın şerit olmaz).
float apStroke(float d, float w, float aa){ return (1.0 - smoothstep(w * 0.5 - aa, w * 0.5 + aa, abs(d))) * min(1.0, w / aa); }
// Eşit aralıklı çizgiler: seçilemeyecek kadar uzaksa ortalama yoğunluğuna söner.
float apLines(float v, float period, float width, float aa){
  float d = abs(fract(v / period + 0.5) - 0.5) * period;
  float line = 1.0 - smoothstep(width * 0.5 - aa, width * 0.5 + aa, d);
  return mix(width / period, line, 1.0 - smoothstep(width * 0.6, width * 1.5, aa));
}
float apSeg(vec2 p, vec2 a, vec2 b){ vec2 v = b - a; float k = clamp(dot(p - a, v) / dot(v, v), 0.0, 1.0); return length(p - a - v * k); }
// Çeyrek yay: merkezden yayın iki ucuna giden yönlerin arasında kalan bölgede halkaya uzaklık.
float apArc(vec2 p, vec2 c, float r, vec2 da, vec2 db){ vec2 v = p - c; return (dot(v, da) >= 0.0 && dot(v, db) >= 0.0) ? abs(length(v) - r) : 1e3; }
float apSmin(float a, float b, float k){ float h = clamp(0.5 + 0.5 * (b - a) / k, 0.0, 1.0); return mix(b, a, h) - k * h * (1.0 - h); }
// Pist harfleri ve rakamları: 2 × 4 birimlik hücrede çizgi parçaları (q.x pilotun sağına, q.y iniş yönüne).
float apGlyph(vec2 q, float id){
  if (id < 0.5) return min(min(apSeg(q, vec2(0.0, 0.0), vec2(2.0, 0.0)), apSeg(q, vec2(2.0, 0.0), vec2(2.0, 4.0))), min(apSeg(q, vec2(2.0, 4.0), vec2(0.0, 4.0)), apSeg(q, vec2(0.0, 4.0), vec2(0.0, 0.0))));
  if (id < 1.5) return min(min(min(apSeg(q, vec2(0.0, 4.0), vec2(2.0, 4.0)), apSeg(q, vec2(2.0, 4.0), vec2(2.0, 2.0))), min(apSeg(q, vec2(2.0, 2.0), vec2(0.0, 2.0)), apSeg(q, vec2(0.0, 2.0), vec2(0.0, 0.0)))), apSeg(q, vec2(0.0, 0.0), vec2(2.0, 0.0)));
  if (id < 2.5) return min(apSeg(q, vec2(0.0, 4.0), vec2(2.0, 4.0)), apSeg(q, vec2(2.0, 4.0), vec2(0.6, 0.0)));
  if (id < 3.5) return min(min(min(apSeg(q, vec2(0.0, 4.0), vec2(2.0, 4.0)), apSeg(q, vec2(2.0, 4.0), vec2(2.0, 0.0))), min(apSeg(q, vec2(0.0, 4.0), vec2(0.0, 2.0)), apSeg(q, vec2(0.0, 2.0), vec2(2.0, 2.0)))), apSeg(q, vec2(2.0, 0.0), vec2(0.0, 0.0)));
  if (id < 4.5) return min(apSeg(q, vec2(0.0, 4.0), vec2(0.0, 0.0)), apSeg(q, vec2(0.0, 0.0), vec2(2.0, 0.0)));
  return min(min(min(apSeg(q, vec2(0.0, 0.0), vec2(0.0, 4.0)), apSeg(q, vec2(0.0, 4.0), vec2(2.0, 4.0))), min(apSeg(q, vec2(2.0, 4.0), vec2(2.0, 2.0)), apSeg(q, vec2(2.0, 2.0), vec2(0.0, 2.0)))), apSeg(q, vec2(0.8, 2.0), vec2(2.0, 0.0)));
}
// Pist emniyet şeridi: pistin iki yanında 75 m sık biçilmiş çim, kenarında drenaj hendeği. rw: x0, x1, eksen z, yarı genişlik.
vec3 apStrip(vec2 p, vec3 c, vec4 rw, float aa){
  float az = abs(p.y - rw.z);
  float inX = smoothstep(rw.x - 90.0, rw.x - 60.0, p.x) * (1.0 - smoothstep(rw.y + 60.0, rw.y + 90.0, p.x));
  c = mix(c, c * vec3(0.86, 0.95, 0.84), (1.0 - smoothstep(72.0, 76.0, az)) * inX);
  return mix(c, c * 0.7, apStroke(az - 79.0, 1.6, aa) * inX);
}
// Pist: omuzlar, asfalt (boyuna aşınma, temas bölgesinde lastik izi), uçlarda sarı oklu güvenlik alanı ve beyaz işaretler.
// a pistin yakın ucundan içeri, cc pilotun sağına doğru metre; harf ve rakamlar iniş yönünde okunur.
vec3 apRunway(vec2 p, vec3 c, vec4 rw, vec3 idW, vec3 idE, float aa, float n2, float grain){
  float hw = rw.w;
  float dz = p.y - rw.z;
  float az = abs(dz);
  float sh = hw + 7.5;
  if (az > sh + 2.0 || p.x < rw.x - 62.0 || p.x > rw.y + 62.0) return c;
  float west = step(p.x, (rw.x + rw.y) * 0.5);
  float dir = west * 2.0 - 1.0;
  float a = dir * (p.x - mix(rw.y, rw.x, west));
  float cc = dir * dz;
  vec3 ids = mix(idE, idW, west);
  c = mix(c, vec3(0.27, 0.27, 0.26) * grain * (0.92 + 0.16 * n2), apIn(az - sh, aa) * apIn(-a, aa));
  vec3 asph = vec3(0.15, 0.15, 0.155) * grain * (0.9 + 0.2 * n2);
  asph *= 0.95 + 0.08 * fbm(vec2(p.x * 0.015, dz * 0.5));
  float rub = smoothstep(90.0, 180.0, a) * (1.0 - smoothstep(450.0, 750.0, a)) * (1.0 - smoothstep(5.0, 13.0, az));
  asph *= 1.0 - 0.32 * rub * (0.55 + 0.45 * fbm(vec2(p.x * 0.04, dz * 0.35)));
  float onRw = apIn(az - hw, aa) * apIn(-a, aa);
  float pad = apIn(az - hw, aa) * apIn(-(a + 60.0), aa) * apIn(a, aa);
  c = mix(c, asph, onRw);
  c = mix(c, asph * 1.12, pad);
  c = mix(c, vec3(0.6, 0.48, 0.17), pad * apLines(-a - az * 0.9, 15.0, 1.6, aa));
  if (onRw > 0.0) {
    float m = apStroke(az - (hw - 1.5), 0.9, aa);
    float keys = step(6.0, a) * step(a, 36.0) * step(3.0, az) * step(az, hw - 3.5);
    m = max(m, keys * apLines(az - 3.9, 3.6, 1.8, aa));
    vec2 g = vec2(cc, a);
    float gd = apGlyph((g - vec2(-4.5, 48.0)) / 4.5, ids.z);
    gd = min(gd, apGlyph((g - vec2(-11.0, 78.0)) / 4.5, ids.x));
    gd = min(gd, apGlyph((g - vec2(2.0, 78.0)) / 4.5, ids.y));
    m = max(m, apStroke(gd * 4.5, 1.8, aa));
    float cl = step(110.0, a) * step(rw.x + 110.0, p.x) * step(p.x, rw.y - 110.0) * step(fract((p.x - rw.x - 110.0) / 50.0), 0.6);
    m = max(m, cl * apStroke(az, 0.9, aa));
    float inner = hw * 0.3;
    m = max(m, apIn(apBox(vec2(a, az), vec2(322.5, inner * 1.5), vec2(22.5, inner * 0.5), 0.0), aa));
    float bars = a < 300.0 ? 3.0 : 2.0;
    float band = max(max(step(150.0, a) * step(a, 172.5), step(450.0, a) * step(a, 472.5)), step(600.0, a) * step(a, 622.5));
    m = max(m, band * step(inner, az) * step(az, inner + bars * 3.3 - 1.5) * apLines(az - inner - 0.9, 3.3, 1.8, aa));
    c = mix(c, vec3(0.74, 0.74, 0.71), clamp(m, 0.0, 1.0) * onRw * 0.92);
  }
  return c;
}
`;

const rw = (r: Runway) => `vec4(${f(r.x0)}, ${f(r.x1)}, ${f(r.z)}, ${f(r.half)})`;
const ids = (list: [number, number, number]) => `vec3(${list.map(f).join(', ')})`;
const connectorGlsl = CONNECTORS.map((cx) => {
  const lines = [
    `dTx = apSmin(dTx, apBox(p, ${v2(cx, (TAXIWAY.z + RUNWAYS[0].z - 10) / 2)}, ${v2(CONNECTOR_HALF, (TAXIWAY.z - RUNWAYS[0].z + 10) / 2)}, 0.0), 18.0);`,
  ];
  return lines.join('\n    ');
}).join('\n    ');
const centerGlsl = CONNECTORS.map((cx) => {
  const arcs: string[] = [`d = min(d, abs(p.x - ${f(cx)}) + 1e3 * step(p.y, ${f(RUNWAYS[0].z + RUNWAYS[0].half)}) + 1e3 * step(${f(TAXIWAY.z)}, p.y));`];
  if (cx < TAXIWAY.x1) arcs.push(`d = min(d, apArc(p, ${v2(cx + TURN, TAXIWAY.z - TURN)}, ${f(TURN)}, vec2(-1.0, 0.0), vec2(0.0, 1.0)));`);
  if (cx > TAXIWAY.x0) arcs.push(`d = min(d, apArc(p, ${v2(cx - TURN, TAXIWAY.z - TURN)}, ${f(TURN)}, vec2(1.0, 0.0), vec2(0.0, 1.0)));`);
  return arcs.join('\n      ');
}).join('\n      ');
const holdGlsl = HOLDS.map(
  ([z, side]) =>
    `{ float k = (p.y - ${f(z)}) * ${f(side)}; float idx = floor(k / 0.9 + 0.5); float dash = idx < 1.5 ? 1.0 : step(0.5, fract(p.x / 2.0));
        hold = max(hold, apStroke(k - idx * 0.9, 0.4, aa) * step(-0.5, idx) * step(idx, 3.5) * dash); }`,
).join('\n        ');
const bayGlsl = BAY_ROWS.map((z) => `bay = max(bay, step(abs(p.y - ${f(z)}), 2.9));`).join(' ');
const dockGlsl = `step(${f(DOCK_X0 - DOCK_STEP / 2)}, p.x) * step(p.x, ${f(DOCK_X0 + DOCK_STEP * (DOCKS - 0.5))})`;

/** Havalimanının zemini: Airport_Field'ın rengi tamamen dünya konumundan çizilir (köşe renkleri yok sayılır). */
export const AIRPORT_FRAGMENT = `#include <color_fragment>
  {
    vec2 p = vWPos.xz;
    float aa = max(fwidth(p.x), fwidth(p.y)) * 0.8 + 0.05;
    float fine = 1.0 - smoothstep(0.8, 2.5, aa);
    float n1 = fbm(p * 0.006) * 0.6 + fbm(p * 0.03 + 5.0) * 0.4;
    float n2 = fbm(p * 0.07 + 17.0);
    float grain = 0.94 + 0.12 * h12(floor(p * 2.0)) * fine;
    vec3 white = vec3(0.74, 0.74, 0.71);
    vec3 yellow = vec3(0.64, 0.46, 0.1);

    // Hava sahasının çimi: çevredeki kuru çimle aynı aile (büyük ölçekte koyu-açık bölgeler, sararmış yamalar), pist
    // yönünde geniş biçme şeritleri.
    vec3 c = vec3(0.32, 0.41, 0.2);
    c *= 1.0 + (fbm(p * 0.0035 + 9.0) - 0.5) * 0.7 + (n1 - 0.5) * 0.3;
    c = mix(c, c * vec3(1.3, 1.05, 0.62), smoothstep(0.45, 0.7, fbm(p * 0.0021 + 77.0)) * 0.65);
    c *= 1.0 + (step(0.5, fract(p.y / 18.0)) - 0.5) * 0.05 * (1.0 - smoothstep(3.0, 8.0, aa));
    ${RUNWAYS.map((r) => `c = apStrip(p, c, ${rw(r)}, aa);`).join('\n    ')}

    // Taksi yolları (kavşak köşeleri yuvarlatılmış), apronlar ve servis alanları.
    float dTx = apBox(p, ${v2((TAXIWAY.x0 + TAXIWAY.x1) / 2, TAXIWAY.z)}, ${v2((TAXIWAY.x1 - TAXIWAY.x0) / 2, TAXIWAY.half)}, 0.0);
    ${connectorGlsl}
    ${RUNWAYS.map((r) => `dTx = apSmin(dTx, apBox(p, ${v2((r.x0 + r.x1) / 2, r.z)}, ${v2((r.x1 - r.x0) / 2, r.half)}, 0.0), 14.0);`).join('\n    ')}
    float dAp = min(min(apBox(p, ${box(APRON)}, 2.0), apBox(p, ${box(GA_APRON)}, 2.0)), min(apBox(p, ${box(HANGAR_APRON)}, 2.0), apBox(p, ${box(FIRE_PAD)}, 2.0)));
    float dPave = apSmin(dTx, dAp, 10.0);
    if (dPave < 2.0) {
      vec3 taxi = vec3(0.21, 0.21, 0.205) * grain * (0.92 + 0.16 * n2);
      c = mix(c, taxi, apIn(dPave, aa));
      // Beton plaklar: 6 m'de bir derz, plak plak ton farkı, park yerlerinde yağ lekeleri.
      vec2 slab = floor(p / 6.0);
      vec3 concrete = vec3(0.46, 0.455, 0.43) * grain * (0.95 + 0.1 * n2) * (0.96 + 0.08 * h12(slab));
      concrete *= 1.0 - 0.12 * max(apLines(p.x, 6.0, 0.15, aa), apLines(p.y, 6.0, 0.15, aa));
      c = mix(c, concrete, apIn(dAp, aa));
      // Taksi yolu kenarında çift sarı çizgi (apronda yok).
      float edge = (apStroke(dTx + 1.0, 0.3, aa) + apStroke(dTx + 1.7, 0.3, aa)) * step(2.0, dAp);
      // Taksi ekseni: paralel yol, bağlantılar ve kavşak yayları.
      float d = abs(p.y - ${f(TAXIWAY.z)}) + 1e3 * (step(p.x, ${f(TAXIWAY.x0)}) + step(${f(TAXIWAY.x1)}, p.x));
      ${centerGlsl}
      float lines = max(edge, apStroke(d, 0.5, aa));
      // Bağlantılarda bekleme çizgileri: taksi tarafında iki düz, pist tarafında iki kesikli.
      float hold = 0.0;
      float near = 1e3;
      ${CONNECTORS.map((cx) => `near = min(near, abs(p.x - ${f(cx)}));`).join(' ')}
      if (near < ${f(CONNECTOR_HALF - 0.5)}) {
        ${holdGlsl}
      }
      lines = max(lines, hold);
      c = mix(c, yellow * grain, clamp(lines, 0.0, 1.0) * 0.9);
    }
    if (dAp < 2.0) {
      // Terminal önünde servis yolu: asfalt, beyaz kenar ve kesik eksen.
      float sv = apBox(p, ${box(SERVICE)}, 0.0);
      c = mix(c, vec3(0.2, 0.2, 0.2) * grain, apIn(sv, aa));
      float sl = apStroke(sv + 0.3, 0.25, aa) + apStroke(p.y - ${f((SERVICE.z0 + SERVICE.z1) / 2)}, 0.25, aa) * step(0.5, fract(p.x / 6.0)) * apIn(sv, aa);
      c = mix(c, white, clamp(sl, 0.0, 1.0) * 0.85);
      // Yönlendirme çizgileri, durma çubukları, taksi hattı.
      float d = 1e3;
      ${segGlsl(APRON_SEGMENTS)}
      ${arcGlsl(APRON_ARCS)}
      float lead = apStroke(d, 0.7, aa);
      d = 1e3;
      ${segGlsl(STOP_BARS)}
      lead = max(lead, apStroke(d, 0.9, aa));
      c = mix(c, yellow * grain, clamp(lead, 0.0, 1.0) * 0.9 * apIn(dAp, aa));
      // Ekipman sınırı: kırmızı.
      float e = 1e3;
      ${eraGlsl}
      c = mix(c, vec3(0.5, 0.15, 0.12) * grain, apStroke(e, 0.4, aa) * 0.85 * apIn(dAp, aa));
      // İtfaiye kapılarının önünde sarı taralı boş bırakılacak alan.
      float hatch = apIn(apBox(p, ${v2((FIRE_BAYS.x0 + FIRE_BAYS.x1) / 2, FIRE_BAYS.z0 - 4.5)}, ${v2((FIRE_BAYS.x1 - FIRE_BAYS.x0) / 2, 4.5)}, 0.0), aa);
      c = mix(c, yellow * grain, hatch * max(apLines(p.x + p.y, 3.0, 0.5, aa), apStroke(apBox(p, ${v2((FIRE_BAYS.x0 + FIRE_BAYS.x1) / 2, FIRE_BAYS.z0 - 4.5)}, ${v2((FIRE_BAYS.x1 - FIRE_BAYS.x0) / 2, 4.5)}, 0.0) + 0.3, 0.4, aa)) * 0.85);
    }

    // Pistler: taksi yollarının üstüne.
    ${RUNWAYS.map((r) => `c = apRunway(p, c, ${rw(r)}, ${ids(r.west)}, ${ids(r.east)}, aa, n2, grain);`).join('\n    ')}

    // Servis yolları, kargo avlusu, kule otoparkı, radar ve yakıt çiftliği.
    if (p.y > -890.0 && p.y < -660.0) {
      vec3 asphalt = vec3(0.2, 0.195, 0.19) * grain * (0.88 + 0.24 * n2);
      vec3 gravel = vec3(0.42, 0.39, 0.34) * grain * (0.88 + 0.24 * n2);
      float roads = min(min(apBox(p, ${box(FUEL_ROAD)}, 0.0), apBox(p, ${box(TOWER_SPUR)}, 0.0)), apBox(p, ${box(RADAR_SPUR)}, 0.0));
      ${SERVICE_ROADS.map((b) => `roads = min(roads, apBox(p, ${box(b)}, 0.0));`).join('\n      ')}
      float yards = min(apBox(p, ${box(CARGO_YARD)}, 1.0), apBox(p, ${box(TOWER_LOT)}, 1.0));
      c = mix(c, gravel, apIn(min(apBox(p, ${box(RADAR_PAD)}, 2.0), apBox(p, ${box(BUND)}, 0.0)), aa));
      c = mix(c, asphalt, apIn(min(roads, yards), aa));
      c = mix(c, vec3(0.44, 0.43, 0.4) * grain, apIn(apBox(p, ${box(PUMP)}, 0.0) - 2.0, aa));
      // Kargo rampalarında park çizgileri, kule otoparkında araç yerleri.
      float cargo = apIn(apBox(p, ${box(CARGO_YARD)}, 1.0), aa);
      float stalls = apLines(p.x - ${f(DOCK_X0 - DOCK_STEP / 2)}, ${f(DOCK_STEP)}, 0.25, aa) * step(p.y, ${f(CARGO_YARD.z0 + 18)}) * ${dockGlsl};
      float lot = apLines(p.x - ${f(TOWER_LOT.x0 + 1.5)}, 3.0, 0.15, aa) * apIn(apBox(p, ${v2((TOWER_LOT.x0 + TOWER_LOT.x1) / 2, TOWER_LOT.z0 + 5)}, ${v2((TOWER_LOT.x1 - TOWER_LOT.x0) / 2 - 1, 3)}, 0.0), aa);
      float mid = apStroke(p.y - ${f((FUEL_ROAD.z0 + FUEL_ROAD.z1) / 2)}, 0.2, aa) * step(0.5, fract(p.x / 6.0)) * apIn(apBox(p, ${box(FUEL_ROAD)}, 0.0), aa);
      c = mix(c, white, clamp(stalls * cargo + lot + mid, 0.0, 1.0) * 0.8);
    }

    // Kara tarafı: terminal önü kaldırımı, otopark, yürüyüş yolları ve yeşil şeritler.
    if (p.y > -724.0 && p.x > 428.0 && p.x < 1073.0) {
      vec3 lawn = vec3(0.12, 0.19, 0.065) * (0.82 + 0.36 * n1);
      lawn *= 1.0 + (step(0.5, fract((p.x * 0.2 + p.y) / 9.0)) - 0.5) * 0.12 * (1.0 - smoothstep(2.0, 5.0, aa));
      float slab = apIn(apBox(p, ${box(SLAB)}, 0.0), aa);
      c = mix(c, lawn, slab);
      float joint = max(apLines(p.x, 1.2, 0.08, aa), apLines(p.y, 1.2, 0.08, aa));
      vec3 stone = vec3(0.52, 0.49, 0.44) * grain * (0.94 + 0.12 * n2) * (1.0 - 0.1 * joint);
      vec3 granite = vec3(0.3, 0.29, 0.28) * grain;
      float fc = apIn(apBox(p, ${box(FORECOURT)}, 0.0), aa);
      c = mix(c, stone, fc);
      c = mix(c, granite, fc * apIn(abs(p.y - ${f(FORECOURT.z1 - 0.4)}) - 0.4, aa));
      // Hissedilebilir yüzey: kaldırım kenarından 1.2 m içeride aşı sarısı bant.
      c = mix(c, vec3(0.55, 0.45, 0.24) * grain, fc * apIn(abs(p.y - ${f(FORECOURT.z1 - 1.6)}) - 0.3, aa));
      float walks = min(apBox(p, ${box(WALKS[0])}, 0.0), apBox(p, ${box(WALKS[1])}, 0.0));
      c = mix(c, stone, apIn(walks, aa));
      // Otopark ve katlı otoparkların zemini: asfalt, araç sıralarında çizgiler, kenarda çit bitkisi.
      float lotD = apBox(p, ${box(LOT)}, 1.0);
      lotD = min(lotD, min(apBox(p, ${box(GARAGES[0])}, 0.0), apBox(p, ${box(GARAGES[1])}, 0.0)));
      c = mix(c, vec3(0.055, 0.095, 0.035) * (0.7 + 0.6 * fbm(p * 0.45)), apIn(lotD - 1.6, aa) * slab * (1.0 - apIn(walks, aa)));
      vec3 asphalt = vec3(0.2, 0.195, 0.19) * grain * (0.88 + 0.24 * n2);
      c = mix(c, asphalt, apIn(lotD, aa));
      float bay = 0.0;
      ${bayGlsl}
      float bays = bay * apLines(p.x - ${f(BAY_X0)}, ${f(BAY_STEP)}, 0.12, aa) * apIn(apBox(p, ${box(LOT)}, 1.0) + 2.0, aa);
      c = mix(c, white, bays * 0.8);
    }

    diffuseColor.rgb = c;
  }`;

// ------------------------------------------------------------------ zemin

/** Dünya koordinatında yatay dörtgen (köşe renkleri beyaz: renk shader'dan). */
function quad(b: Box, y: number) {
  const geometry = new THREE.PlaneGeometry(b.x1 - b.x0, b.z1 - b.z0).rotateX(-Math.PI / 2);
  geometry.translate((b.x0 + b.x1) / 2, y, (b.z0 + b.z1) / 2);
  return geometry;
}

/** Köşe renkli geometrileri tek geometride birleştirir (diziler doğrudan kopyalanır, rengi olmayan parça beyaz). */
function merge(parts: THREE.BufferGeometry[]) {
  const flats = parts.map((part) => (part.index ? part.toNonIndexed() : part));
  const total = flats.reduce((sum, part) => sum + part.getAttribute('position').count, 0);
  const geometry = new THREE.BufferGeometry();
  for (const name of ['position', 'normal', 'color']) {
    const array = new Float32Array(total * 3);
    let offset = 0;
    for (const part of flats) {
      const attribute = part.getAttribute(name);
      const count = part.getAttribute('position').count;
      if (attribute) array.set(attribute.array, offset);
      else array.fill(1, offset, offset + count * 3);
      offset += count * 3;
    }
    geometry.setAttribute(name, new THREE.BufferAttribute(array, 3));
  }
  return geometry;
}

/** Hava tarafı tek düzlem, kara tarafı plakası ve servis yolları (yolların hemen altında). */
function fieldGeometry() {
  return merge([
    quad(SITE, FIELD_Y),
    quad(FORECOURT, SLAB_Y),
    quad(SLAB, SLAB_Y),
    quad(CARGO_YARD, LOW_Y),
    quad(FUEL_ROAD, LOW_Y),
    quad(TOWER_SPUR, LOW_Y),
    quad(TOWER_LOT, LOW_Y),
    quad(RADAR_SPUR, LOW_Y),
  ]);
}

// ------------------------------------------------------------------ binalar

// Duvar ve çatı paleti: krem duvar, açık membran düz çatı (teleferik ve okulda kullanılan değer, aynı cephe programı).
const AIRPORT_PALETTE = 'vec2(0.4, 0.7)';

function boxMatrix(b: Box, height: number) {
  return new THREE.Matrix4().compose(
    new THREE.Vector3((b.x0 + b.x1) / 2, BASE_Y + height / 2, (b.z0 + b.z1) / 2),
    new THREE.Quaternion(),
    new THREE.Vector3((b.x1 - b.x0) / 2, height / 2, (b.z1 - b.z0) / 2),
  );
}

function buildingMeshes(source: THREE.Material) {
  const material = source.clone();
  material.defines = { ...material.defines, CITY_PALETTE: AIRPORT_PALETTE };
  const instanced = (name: string, geometry: THREE.BufferGeometry, matrices: THREE.Matrix4[]) => {
    const mesh = new THREE.InstancedMesh(geometry, material, matrices.length);
    mesh.name = name;
    matrices.forEach((m, i) => mesh.setMatrixAt(i, m));
    mesh.instanceMatrix.needsUpdate = true;
    return mesh;
  };
  return [
    instanced('Airport_Blocks', MASS_VARIANTS.plain().build(), [
      boxMatrix(CARGO, 11),
      boxMatrix(FIRE_BAYS, 8),
      boxMatrix(HOSE_TOWER, 17),
      boxMatrix(TOWER_BASE, 8),
      ...ANNEXES.map((b) => boxMatrix(b, 6)),
    ]),
    instanced('Airport_Heads', MASS_VARIANTS.penthouse().build(), [boxMatrix(CARGO_OFFICE, 15), boxMatrix(FIRE_OFFICE, 10)]),
  ];
}

// ------------------------------------------------------------------ parçalar

// Kırık tonlar: şehrin paletinden kopmayan, doygunluğu düşük renkler.
const TONE = {
  white: '#e6e1d6',
  steel: '#8c8f92',
  dark: '#4f5254',
  slate: '#7f98a8',
  ochre: '#c2a25a',
  red: '#a8473b',
  terracotta: '#b9775a',
  ridge: '#7c7e7d',
  roof: '#a9aaa6',
  cabin: '#c9c6bd',
  bridge: '#d4d6d8',
  glass: '#6d7f8c',
  door: '#6c7175',
  orange: '#c9773f',
  sign: '#c9a640',
  black: '#2b2b2e',
};
const ULD_TONES = [TONE.cabin, TONE.roof, TONE.steel];

/** Sıralaması önemsiz kutu (PropBuilder küçükten büyüğe ister). */
function block(props: PropBuilder, ax: number, bx: number, y0: number, y1: number, az: number, bz: number, color: string) {
  props.box(Math.min(ax, bx), Math.max(ax, bx), y0, y1, Math.min(az, bz), Math.max(az, bz), color);
}

/** Yerel çerçevede (x ileri, z sağa) kurulan parçayı dünyaya taşır. */
function framed(build: (props: PropBuilder) => void, x: number, z: number, fx: number, fz: number) {
  const props = new PropBuilder();
  build(props);
  const matrix = new THREE.Matrix4().makeBasis(new THREE.Vector3(fx, 0, fz), new THREE.Vector3(0, 1, 0), new THREE.Vector3(-fz, 0, fx));
  matrix.setPosition(x, 0, z);
  return props.build().applyMatrix4(matrix);
}

/**
 * Körük köprü: terminal ya da iskele duvarının dışında döner ayak (rotunda), uçağın sol ön kapısına uzanan tünel, kabin ve
 * körük, tünelin altında tekerlekli yürür ayak.
 */
function jetBridge(s: Stand) {
  const lx = s.hz;
  const lz = -s.hx;
  const side = s.gap > 20 ? 10 : 12;
  const rx = s.x + s.hx * (s.gap - 2.6) + lx * side;
  const rz = s.z + s.hz * (s.gap - 2.6) + lz * side;
  // Kabin yüzü kapının 1.6 m dışında (gövde yarı genişliği 2 m); terminalden gelen uzun köprü gövdeye neredeyse paralel,
  // kabinin köşesi gövdeye değmesin diye biraz daha dışarıda.
  const reach = s.gap > 20 ? 4.6 : 3.6;
  const ex = s.x - s.hx * 6 + lx * reach;
  const ez = s.z - s.hz * 6 + lz * reach;
  const length = Math.hypot(ex - rx, ez - rz);
  const y = FIELD_Y;
  return framed(
    (p) => {
      p.cylinder(0, y, 0, 2.2, 8, 'y', TONE.steel, 10);
      // Kapı eşiği gövde kesitinin ortasında (gövde 2.5..6.9 m): tünel 3.2..6.0 m.
      p.box(1.5, length - 3.2, y + 2.9, y + 5.7, -1.7, 1.7, TONE.bridge);
      p.box(1.5, length - 3.2, y + 4.3, y + 5.0, -1.75, 1.75, TONE.glass);
      p.box(length - 3.2, length - 0.5, y + 2.6, y + 6.0, -2.2, 2.2, TONE.cabin);
      p.box(length - 0.5, length, y + 2.9, y + 5.7, -1.9, 1.9, TONE.dark);
      const leg = length * 0.62;
      for (const k of [-1.2, 0.8]) p.box(leg - 0.25, leg + 0.25, y + 0.9, y + 2.9, k, k + 0.4, TONE.ridge);
      p.box(leg - 0.9, leg + 0.9, y, y + 0.9, -1.9, 1.9, TONE.dark);
    },
    rx,
    rz,
    (ex - rx) / length,
    (ez - rz) / length,
  );
}

/** Kapıdaki uçağın sağında yer araçları: bagaj traktörü ve vagonlar, yakıt kamyonu, ikram kamyonu; bazılarında itme traktörü. */
function groundService(s: Stand, index: number) {
  const y = FIELD_Y;
  return framed(
    (p) => {
      p.box(-31, -28.6, y, y + 1.5, 8.4, 9.9, TONE.ochre);
      for (let k = 0; k < 3; k++) {
        const a = -28 + k * 3;
        p.box(a, a + 2.6, y + 0.15, y + 0.5, 8.3, 10, TONE.dark);
        if (hash2(index, k) > 0.3) p.box(a + 0.1, a + 2.5, y + 0.5, y + 1.9, 8.4, 9.9, k % 2 ? TONE.slate : TONE.roof);
      }
      p.box(-27, -17.6, y + 0.4, y + 3.0, 13, 15.5, TONE.white);
      p.box(-17.6, -15.2, y + 0.3, y + 2.9, 13.1, 15.4, TONE.terracotta);
      p.box(-27, -15.2, y, y + 0.4, 13.2, 15.3, TONE.dark);
      p.box(-7.4, -4.8, y, y + 1.3, 4.5, 11.5, TONE.steel);
      for (const r of [5.2, 8.2]) p.box(-6.4, -5.8, y + 1.3, y + 4.2, r, r + 0.4, TONE.dark);
      p.box(-7.5, -4.7, y + 4.2, y + 6.8, 3.4, 8.8, TONE.white);
      if (index % 3 === 0) p.box(1.8, 5.8, y, y + 1.4, -1.4, 1.4, TONE.slate);
    },
    s.x,
    s.z,
    s.hx,
    s.hz,
  );
}

/** İtfaiye aracı: burnu kuzeye (apron), kapıların önünde. */
function fireTruck(p: PropBuilder, x: number, z: number) {
  const y = FIELD_Y;
  p.box(x - 1.25, x + 1.25, y + 0.3, y + 1.2, z, z + 9.5, TONE.dark);
  p.box(x - 1.25, x + 1.25, y + 1.2, y + 3.3, z + 2.6, z + 9.5, TONE.red);
  p.box(x - 1.25, x + 1.25, y + 1.0, y + 3.1, z, z + 2.6, TONE.red);
  p.box(x - 1.2, x + 1.2, y + 2.2, y + 2.9, z - 0.05, z + 0.4, TONE.black);
  p.box(x - 0.8, x + 0.8, y + 3.1, y + 3.35, z + 0.6, z + 1.0, TONE.white);
  p.box(x - 0.6, x + 0.6, y + 3.3, y + 3.6, z + 4, z + 8.5, TONE.steel);
}

function propsGeometry() {
  const p = new PropBuilder();
  const y = FIELD_Y;
  // İtfaiye: dört araç bölmesinin kapıları, önlerinde üç araç.
  const bayWidth = (FIRE_BAYS.x1 - FIRE_BAYS.x0) / 4;
  for (let k = 0; k < 4; k++) {
    const x = FIRE_BAYS.x0 + bayWidth * (k + 0.5);
    p.box(x - 4.5, x + 4.5, y, y + 5.6, FIRE_BAYS.z0 - 0.15, FIRE_BAYS.z0, TONE.red);
  }
  for (const k of [0, 1, 2]) fireTruck(p, FIRE_BAYS.x0 + bayWidth * (k + 0.5), FIRE_BAYS.z0 - 19);
  // Kargo: güney yüzünde rampa kapıları ve saçak; kuzeyde (genel havacılık apronu) ULD arabaları ve bir traktör.
  for (let k = 0; k < DOCKS; k++) {
    const x = DOCK_X0 + k * DOCK_STEP;
    p.box(x - 1.6, x + 1.6, y, y + 4.0, CARGO.z1, CARGO.z1 + 0.15, TONE.dark);
  }
  p.box(CARGO.x0, CARGO.x1, y + 4.6, y + 4.9, CARGO.z1, CARGO.z1 + 3, TONE.ridge);
  for (let x = -60, k = 0; x < 160; x += 7, k++) {
    if (hash2(x, 3.1) < 0.2) continue;
    p.box(x, x + 3.2, y + 0.3, y + 0.75, -886.4, -884, TONE.dark);
    if (hash2(x, 5.3) < 0.7) p.box(x + 0.1, x + 3.1, y + 0.75, y + 2.4, -886.3, -884.1, ULD_TONES[k % ULD_TONES.length]);
  }
  p.box(-66, -63.6, y, y + 1.5, -886, -884.4, TONE.ochre);
  // Hangarlar: kuzey yüzde büyük kapı, dikey derzler ve kapı kirişi.
  for (const h of HANGARS) {
    const z = h.z0;
    p.box(h.x0 + 4, h.x1 - 4, y, y + 13.2, z - 0.25, z, TONE.door);
    for (let x = h.x0 + 4; x <= h.x1 - 4 + 0.01; x += (h.x1 - h.x0 - 8) / 8) p.box(x - 0.2, x + 0.2, y, y + 13.2, z - 0.4, z - 0.25, TONE.roof);
    p.box(h.x0 + 3, h.x1 - 3, y + 13.2, y + 14.3, z - 0.5, z, TONE.steel);
  }
  // Kule: kabinin altında balkon, tepede anten direği.
  p.box(1176, 1204, 75.1, 75.75, -804, -776, TONE.cabin);
  p.box(1189.6, 1190.4, 99.7, 113, -790.4, -789.6, TONE.steel);
  p.box(1188.8, 1191.2, 104, 104.4, -791.2, -788.8, TONE.steel);
  // Radar kulesi: dört ayak, kuşaklar, platform, döner kaide ve anten; yanında cihaz kulübesi.
  const r = RADAR;
  for (const [dx, dz] of [
    [-2.5, -2.5],
    [2.5, -2.5],
    [-2.5, 2.5],
    [2.5, 2.5],
  ]) {
    p.box(r.x + dx - 0.18, r.x + dx + 0.18, y, y + 15.5, r.z + dz - 0.18, r.z + dz + 0.18, TONE.steel);
  }
  for (const h of [4, 8, 12]) {
    p.box(r.x - 2.7, r.x + 2.7, y + h, y + h + 0.25, r.z - 2.7, r.z - 2.45, TONE.steel);
    p.box(r.x - 2.7, r.x + 2.7, y + h, y + h + 0.25, r.z + 2.45, r.z + 2.7, TONE.steel);
    p.box(r.x - 2.7, r.x - 2.45, y + h, y + h + 0.25, r.z - 2.45, r.z + 2.45, TONE.steel);
    p.box(r.x + 2.45, r.x + 2.7, y + h, y + h + 0.25, r.z - 2.45, r.z + 2.45, TONE.steel);
  }
  p.box(r.x - 3.5, r.x + 3.5, y + 15.5, y + 15.9, r.z - 3.5, r.z + 3.5, TONE.ridge);
  p.cylinder(r.x, y + 15.9, r.z, 0.9, 1.3, 'y', TONE.dark, 8);
  p.box(r.x - 5, r.x + 5, y + 17.2, y + 20.2, r.z - 0.3, r.z + 0.3, TONE.white);
  p.box(r.x - 0.2, r.x + 0.2, y + 18.2, y + 18.6, r.z + 0.3, r.z + 2.6, TONE.steel);
  p.box(66, 74, y, y + 3.2, -787, -781, TONE.cabin);
  p.box(65.6, 74.4, y + 3.2, y + 3.5, -787.4, -780.6, TONE.ridge);
  // Yakıt çiftliği: beton set, pompa binası, sete giden borular, yolun üstünde dolum saçağı.
  const b = BUND;
  const wall = (x0: number, x1: number, z0: number, z1: number) => p.box(x0, x1, y, y + 1.2, z0, z1, TONE.roof);
  wall(b.x0, b.x1, b.z0, b.z0 + 0.6);
  wall(b.x0, b.x1, b.z1 - 0.6, b.z1);
  wall(b.x0, b.x0 + 0.6, b.z0 + 0.6, b.z1 - 0.6);
  wall(b.x1 - 0.6, b.x1, b.z0 + 0.6, b.z1 - 0.6);
  p.box(PUMP.x0, PUMP.x1, y, y + 5, PUMP.z0, PUMP.z1, TONE.cabin);
  p.box(PUMP.x0 - 0.4, PUMP.x1 + 0.4, y + 5, y + 5.4, PUMP.z0 - 0.4, PUMP.z1 + 0.4, TONE.ridge);
  for (const z of [-754.5, -752]) p.box(PUMP.x1, b.x0 + 14, y + 1.2, y + 1.8, z - 0.3, z + 0.3, TONE.steel);
  for (let x = PUMP.x1 + 4; x < b.x0; x += 6) p.box(x - 0.15, x + 0.15, y, y + 1.2, -755, -751.5, TONE.ridge);
  const l = LOADING;
  p.box(l.x0, l.x1, LOW_Y + 6.2, LOW_Y + 6.7, l.z0, l.z1, TONE.roof);
  for (const x of [l.x0 + 0.5, l.x1 - 0.5]) for (const z of [l.z0 + 0.3, l.z1 - 0.3]) block(p, x - 0.2, x + 0.2, LOW_Y, LOW_Y + 6.2, z - 0.2, z + 0.2, TONE.steel);
  // Terminal önünde kalkış saçağı: kaldırım kenarında dikmeler, ince çatı.
  const cn = CANOPY;
  p.box(cn.x0 - 2, cn.x1 + 2, SLAB_Y + cn.y, SLAB_Y + cn.y + 0.45, cn.z0, cn.z1, TONE.cabin);
  for (let x = cn.x0; x <= cn.x1 + 0.01; x += 32) p.box(x - 0.3, x + 0.3, SLAB_Y, SLAB_Y + cn.y, FORECOURT.z1 - 0.9, FORECOURT.z1 - 0.3, TONE.steel);
  // Terminal önü yolunda yaya geçitleri (yolun asfaltıyla çizgileri arasında).
  for (const x of CROSSINGS) for (let z = -714.4; z < -695.4; z += 1.2) p.box(x - 2, x + 2, 0.6, 0.625, z, z + 0.6, TONE.white);
  // Bekleme noktası levhaları: her bağlantının doğu kenarında, siyah ve sarı yüz.
  for (const cx of CONNECTORS) {
    for (const [z] of HOLDS) {
      const x = cx + CONNECTOR_HALF + 2;
      p.box(x, x + 1.6, y + 0.5, y + 1.5, z - 0.2, z + 0.2, TONE.black);
      p.box(x + 1.6, x + 3.2, y + 0.5, y + 1.5, z - 0.2, z + 0.2, TONE.sign);
      for (const lx of [x + 0.4, x + 2.8]) p.box(lx - 0.08, lx + 0.08, y, y + 0.5, z - 0.08, z + 0.08, TONE.steel);
    }
  }
  // Rüzgâr tulumları: kuzey pistin iki ucunda, emniyet şeridinin dışında.
  for (const x of [-200, 1400]) {
    const z = RUNWAYS[0].z - RUNWAYS[0].half - 52;
    p.cylinder(x, y, z, 0.12, 7, 'y', TONE.steel, 6);
    p.box(x, x + 1.6, y + 6.3, y + 7.0, z - 0.35, z + 0.35, TONE.orange);
    p.box(x + 1.6, x + 3.2, y + 6.4, y + 6.9, z - 0.25, z + 0.25, TONE.white);
  }
  // Apron projektör direkleri.
  for (const [x, z] of MASTS) {
    p.box(x - 0.35, x + 0.35, y, y + MAST_HEIGHT, z - 0.35, z + 0.35, TONE.steel);
    p.box(x - 1.6, x + 1.6, y + MAST_HEIGHT - 0.6, y + MAST_HEIGHT + 0.4, z - 0.5, z + 0.5, TONE.ridge);
  }
  return merge([
    p.build(),
    ...STANDS.map(jetBridge),
    ...STANDS.map((s, i) => groundService(s, i)),
  ]);
}

// ------------------------------------------------------------------ araçlar

// Kargo rampalarına yanaşmış kamyonlar (şehirden gelen yolun ucu boş kalır), dolum saçağında ve beklemede tankerler, kule
// otoparkında personel araçları.
const CARGO_TRUCKS: VehicleSpot[] = [2, 5, 9, 12, 20, 23].map((k) => [DOCK_X0 + k * DOCK_STEP, CARGO.z1 + 7.4, Math.PI / 2]);
const TANKERS: VehicleSpot[] = [
  [1241, -701.75, 0],
  [1206, -698.25, Math.PI],
];
const STAFF_CARS = [1175, 1178, 1181, 1184, 1187, 1199, 1202, 1205, 1208, 1211].map((x): VehicleSpot => [x, TOWER_LOT.z0 + 5, Math.PI / 2]);

function vehicleMeshes(cityRoot: THREE.Object3D) {
  const kinds = ['Cars_White', 'Cars_Silver', 'Cars_Graphite', 'Cars_Blue'];
  return [
    parkedVehicles(cityRoot, 'Trucks', 'Airport', [...CARGO_TRUCKS, ...TANKERS]),
    ...kinds.map((kind, k) =>
      parkedVehicles(
        cityRoot,
        kind,
        'Airport',
        STAFF_CARS.filter((_, i) => i % kinds.length === k),
      ),
    ),
  ].filter((mesh) => mesh !== null);
}

// ------------------------------------------------------------------ ağaçlar ve lambalar

// Ağaç dikilmeyen yerler: tepe bunların üstüne taşmaz.
const SOLID: Box[] = [
  LOT,
  ...WALKS,
  ...GARAGES,
  FORECOURT,
  CARGO_YARD,
  CARGO,
  CARGO_OFFICE,
  RADAR_PAD,
  RADAR_SPUR,
  FUEL_ROAD,
  TOWER_SPUR,
  TOWER_LOT,
  // Yollar: terminal önü ve iki yanından şehre çıkanlar, kargoya inen yol.
  { x0: 430, x1: 1100, z0: -715, z1: -695 },
  { x0: 441.7, x1: 457.8, z0: -705, z1: -580 },
  { x0: 1071.6, x1: 1087.7, z0: -705, z1: -580 },
  { x0: 93.8, x1: 106.2, z0: -840, z1: -580 },
];

/** Tepe yarıçapı `radius` olan ağaç buraya sığar mı: sahada, yapılardan, yollardan ve lambalardan uzak. */
function treeAllowed(x: number, z: number, radius: number, lamps: number[]) {
  if (!inBox(SITE, x, z, -radius * 0.5)) return false;
  if (SOLID.some((b) => inBox(b, x, z, radius * 0.6 + 0.5))) return false;
  for (let i = 0; i < lamps.length; i += 3) if (Math.hypot(x - lamps[i], z - lamps[i + 2]) < radius + 1) return false;
  return true;
}

function plantTrees(crown: number, lamps: number[]): TreeSpot[] {
  const trees: TreeSpot[] = [];
  const add = (x: number, z: number, sizes = [0.8, 0.62]) => {
    for (const size of sizes) {
      const radius = crown * size * (0.75 + 0.55 * hash2(x, z));
      if (treeAllowed(x, z, radius, lamps)) {
        trees.push([x, z, size]);
        return;
      }
    }
  };
  // Kara tarafı: plakanın kuzey şeridi, katlı otoparkların yanları, otoparkla otopark binası arası.
  for (let x = SLAB.x0 + 6; x < SLAB.x1 - 4; x += 11) add(x, -605.5);
  for (let z = -688; z < -618; z += 10) {
    add(464, z, [0.62]);
    add(1065.5, z, [0.62]);
    add(596, z + 5, [0.62]);
  }
  // Kargoya inen yolun iki yanı ve kargo avlusunun güneyi.
  for (let z = -806; z > -840 && z < -612; z += 12) {
    add(84, z);
    add(116, z);
  }
  for (let x = -80; x < 90; x += 12) add(x, CARGO_YARD.z1 + 7);
  // Yakıt yolunun güneyi (kule otoparkının dışında).
  for (let x = 1110; x < 1290; x += 14) add(x, FUEL_ROAD.z1 + 8);
  return trees;
}

/** Lambalar: apron direkleri, terminal saçağının altı, otopark, kargo avlusu, yakıt yolu, kule otoparkı, itfaiye, hangarlar. */
function airportLamps(): number[] {
  const lamps: number[] = [];
  const low = SLAB_Y + 6.5;
  for (const [x, z] of MASTS) lamps.push(x, FIELD_Y + MAST_HEIGHT - 0.2, z);
  for (let x = CANOPY.x0 + 16; x < CANOPY.x1; x += 32) lamps.push(x, SLAB_Y + CANOPY.y - 0.4, -718);
  for (let k = 0; k < BAY_ROWS.length - 1; k++) {
    const z = (BAY_ROWS[k] + BAY_ROWS[k + 1]) / 2;
    for (const x of [650, 710, 770, 830, 890]) lamps.push(x, low, z);
  }
  for (const x of [-60, 0, 60, 130, 180]) lamps.push(x, LOW_Y + 7, CARGO_YARD.z1 - 1);
  for (let x = 1120; x < 1290; x += 34) lamps.push(x, LOW_Y + 6.5, FUEL_ROAD.z0 - 1.2);
  lamps.push(TOWER_LOT.x0 + 2, LOW_Y + 6, TOWER_LOT.z1 + 1, TOWER_LOT.x1 - 2, LOW_Y + 6, TOWER_LOT.z1 + 1);
  lamps.push(FIRE_BAYS.x0 + 6, FIELD_Y + 6.5, FIRE_BAYS.z0 - 0.6, FIRE_BAYS.x1 - 6, FIELD_Y + 6.5, FIRE_BAYS.z0 - 0.6);
  for (const h of HANGARS) lamps.push((h.x0 + h.x1) / 2, FIELD_Y + 14.6, h.z0 - 0.8);
  lamps.push(RADAR.x + 3.2, FIELD_Y + 16.2, RADAR.z + 3.2);
  return lamps;
}

// ------------------------------------------------------------------ kurulum

/**
 * Mesh'in bu alanlardaki üçgenlerini siler ve geometriyi sıkıştırır (indekssiz kopya): sınır kutusu ve seçim kutuları
 * kalan yapılara göre hesaplanır.
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

const REPLACED = /^Airport_(Airfield|Pavements|Markings|Ground|JetBridges)$/;
const OWN = /^Airport_(Field|Props|Blocks|Heads)$/;

/**
 * Havalimanını yeniden düzenler: modeldeki çim, kaplama, işaret, terminal önü zemini ve körük köprüler kaldırılır, kargo,
 * itfaiye, kule tabanı ve batıdaki direk ortak mesh'lerinden silinir. Yerine tek zemin (Airport_Field, rengi
 * AIRPORT_FRAGMENT ile cityRuntime çizer), binalar, parçalar, araçlar ve kara tarafında ağaçlar gelir. Lamba konumlarını
 * döndürür. Hazırlık ikinci kez çalışırsa (StrictMode) tekrar etmez. Araçlar createTraffic'ten sonra kurulur.
 */
export function landscapeAirport(cityRoot: THREE.Object3D, treeScale: number): number[] {
  const done = cityRoot.userData.airportLamps as number[] | undefined;
  if (done) return done;
  cityRoot.updateMatrixWorld(true);
  const field = cityRoot.getObjectByName('Airport_Airfield');
  const hangars = cityRoot.getObjectByName('Airport_Hangars');
  const support = cityRoot.getObjectByName('Airport_Support_Buildings');
  const roofs = cityRoot.getObjectByName('Airport_Roofs');
  const tower = cityRoot.getObjectByName('Airport_ControlTower');
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
    !(field instanceof THREE.Mesh) ||
    !(hangars instanceof THREE.Mesh) ||
    !(support instanceof THREE.Mesh) ||
    !(roofs instanceof THREE.Mesh) ||
    !(tower instanceof THREE.Mesh) ||
    !facade ||
    Array.isArray(field.material) ||
    Array.isArray(hangars.material)
  ) {
    return [];
  }

  const parent = field.parent ?? cityRoot;
  const groundMaterial = field.material;
  for (const mesh of removed) {
    mesh.removeFromParent();
    mesh.geometry.dispose();
  }
  dropTriangles(support, DROP_BUILDINGS);
  dropTriangles(roofs, DROP_BUILDINGS);
  dropTriangles(tower, [DROP_MAST]);

  // Zemin: hava tarafı tek düzlem, kara tarafı plakası, servis yolları. LANDSCAPES malzemeyi klonlayıp yamar.
  const ground = new THREE.Mesh(fieldGeometry(), groundMaterial);
  ground.name = 'Airport_Field';
  ground.userData = { groundLayered: true };
  // Parçalar hangar çatısının satin malzemesini paylaşır (köşe renkli).
  const props = new THREE.Mesh(propsGeometry(), hangars.material);
  props.name = 'Airport_Props';
  for (const mesh of [ground, props, ...buildingMeshes(facade)]) parent.add(mesh);
  for (const mesh of vehicleMeshes(cityRoot)) parent.add(mesh);
  // Yeni parçalar dünya koordinatında kuruldu: ebeveynin dönüşümü birim olmalı.
  parent.updateMatrixWorld(true);
  if (!parent.matrixWorld.equals(new THREE.Matrix4())) {
    const inverse = parent.matrixWorld.clone().invert();
    for (const child of parent.children) {
      if (OWN.test(child.name) || child.name.startsWith('Traffic_Airport_')) child.applyMatrix4(inverse);
    }
  }

  const lamps = airportLamps();
  replantTrees(cityRoot, {
    prefix: 'Airport',
    inside: (x, z) => inBox(SITE, x, z),
    spots: plantTrees(crownRadius(cityRoot, treeScale), lamps),
    treeScale,
  });
  cityRoot.updateMatrixWorld(true);
  cityRoot.userData.airportLamps = lamps;
  return lamps;
}
