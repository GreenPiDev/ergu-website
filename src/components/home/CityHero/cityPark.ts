// Şehir parkının peyzajı (modelde Park_Ground x 220..640, z 186..391, yerleşimde PARK_SHIFT_X kadar doğuya taşınır).
// Modeldeki park tek renkli bir çim dikdörtgeni, köşeden köşeye üç düz yol, kenarsız bir gölet ve rastgele serpiştirilmiş ağaçlardan oluşuyordu. Model değişmeden, açılışta ve
// shader'da yeniden düzenlenir: çevre gezinti yolu, göleti saran halka yol, kıvrılan patikalar, taş kenarlı ve sazlıklı
// gölet, pavyon önünde desenli meydan ve çiçek tarhları, biçme şeritli çim ve çayır lekeleri, çevre yolu boyunca ağaç
// dizisi ve çayırlarda korular, yollar boyunca park lambaları.
// Yerleşim planı aşağıdaki sabitlerle tek yerde tanımlanır. GLSL ve TypeScript tarafı aynı mesafe fonksiyonlarını kullanır,
// ağaçlar ve lambalar shader'ın çizdiği yollara göre yerleşir.
import * as THREE from 'three';
import { PARK_SHIFT_X } from './cityLayout';
import { hash2, replantTrees } from './cityTrees';

// Plan modeldeki konuma göre yazıldı, park yerleşimde hastanenin eski yerine taşınır (cityLayout.ts).
const sx = (x: number) => x + PARK_SHIFT_X;

const PARK = {
  center: [sx(430), 288.5],
  // Çevre yolunun merkez çizgisi: parkın kenarından 10 m içeride, köşeleri yuvarlatılmış dikdörtgen.
  loopHalf: [200, 92.5],
  loopRadius: 24,
  loopWidth: 4.8,
  pond: [sx(400), 300],
  pondRadius: [68, 39],
  // Halka yol kıyıdan bu kadar uzakta.
  ringOffset: 13,
  ringWidth: 4.4,
  plaza: [sx(270), 220],
  plazaRadius: 20,
  spokeWidth: 3.6,
  courts: [sx(560), sx(632), 200, 218],
  bounds: [sx(220), sx(640), 186, 391],
};

// Gölden çevre yoluna (ve pavyon meydanına) kıvrılarak giden patikalar: hedef nokta ve kavis payı.
const SPOKES: [number, number, number][] = (
  [
    [270, 220, 0.1],
    [237, 374, -0.12],
    [623, 374, 0.1],
    [548, 196, -0.1],
    [440, 381, 0.08],
  ] as [number, number, number][]
).map(([x, z, bend]) => [sx(x), z, bend]);

const f = (value: number) => value.toFixed(2);
const v2 = ([x, y]: number[]) => `vec2(${f(x)}, ${f(y)})`;

/** Parkın mesafe fonksiyonları (GLSL, global kapsamda). */
export const PARK_GLSL = `
const vec2 PK_C = ${v2(PARK.center)};
const vec2 PK_B = ${v2(PARK.loopHalf)};
const vec2 PD_C = ${v2(PARK.pond)};
const vec2 PD_R = ${v2(PARK.pondRadius)};
const vec2 PZ_C = ${v2(PARK.plaza)};
// Çevre yolunun merkez çizgisine işaretli uzaklık (içeride negatif).
float pkLoop(vec2 p){ vec2 q = abs(p - PK_C) - (PK_B - ${f(PARK.loopRadius)}); return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - ${f(PARK.loopRadius)}; }
// Gölet kıyısına yaklaşık metre cinsinden uzaklık (dışarıda pozitif).
float pkShore(vec2 p){ vec2 d = (p - PD_C) / PD_R; float k = length(d); vec2 g = (p - PD_C) / (PD_R * PD_R); return (k - 1.0) * k / max(length(g), 1e-4); }
float pkSpoke(vec2 p, vec2 b, float bend){
  vec2 ab = b - PD_C; float L = length(ab); vec2 u = ab / L; vec2 n = vec2(-u.y, u.x);
  vec2 ap = p - PD_C; float t = dot(ap, u) / L;
  float d = abs(dot(ap, n) - bend * L * sin(clamp(t, 0.0, 1.0) * 3.14159));
  return (t < 0.0 || t > 1.0) ? 1e4 : d;
}
// x: en yakın yolun kenarına uzaklık (yolun üstünde negatif), y: kıyıya uzaklık, z: meydan kenarına uzaklık, w: çevre yolu.
vec4 parkLayout(vec2 p){
  float loopD = pkLoop(p);
  float shore = pkShore(p);
  float path = abs(loopD) - ${f(PARK.loopWidth / 2)};
  path = min(path, abs(shore - ${f(PARK.ringOffset)}) - ${f(PARK.ringWidth / 2)});
  float sp = 1e4;
  ${SPOKES.map(([x, z, bend]) => `sp = min(sp, pkSpoke(p, vec2(${f(x)}, ${f(z)}), ${f(bend)}));`).join('\n  ')}
  if (shore > ${f(PARK.ringOffset)} && loopD < 0.0) path = min(path, sp - ${f(PARK.spokeWidth / 2)});
  return vec4(path, shore, length(p - PZ_C) - ${f(PARK.plazaRadius)}, loopD);
}
`;

/** Park zemini: Park_Ground'un rengi tamamen dünya konumundan çizilir (köşe renkleri yok sayılır). */
export const PARK_FRAGMENT = `#include <color_fragment>
  {
    vec2 p = vWPos.xz;
    vec4 pk = parkLayout(p);
    // Piksel başına metre: ince desenler piksel altına inince söner (titreme olmaz).
    float aa = max(fwidth(p.x), fwidth(p.y)) * 0.8 + 0.05;
    float fine = 1.0 - smoothstep(0.8, 2.5, aa);
    float n1 = fbm(p * 0.02);
    float n2 = fbm(p * 0.09 + 3.0);

    // Çim: biçme şeritleri ve geniş ton farkları.
    vec3 c = vec3(0.12, 0.19, 0.065) * (0.82 + 0.36 * n1);
    c *= 1.0 + (step(0.5, fract((p.x + p.y * 0.2) / 11.0)) - 0.5) * 0.12 * (1.0 - smoothstep(2.0, 5.0, aa));
    // Çayır: yollardan ve gölden uzak lekelerde uzun ot, üzerinde kır çiçekleri.
    float meadow = smoothstep(0.52, 0.62, fbm(p * 0.011 + 11.0)) * smoothstep(6.0, 12.0, pk.x) * smoothstep(9.0, 16.0, pk.y);
    vec3 mead = vec3(0.2, 0.2, 0.08) * (0.8 + 0.4 * n2);
    vec2 fc = floor(p * 0.8);
    float flower = step(0.8, h12(fc)) * fine;
    mead = mix(mead, mix(vec3(0.62, 0.3, 0.34), vec3(0.75, 0.68, 0.45), h12(fc + 7.0)), flower * 0.55);
    c = mix(c, mead, meadow);

    // Gölet kıyısı: taş kenar, ardından sazlık ve kıyı bitkileri.
    float rim = 1.0 - smoothstep(1.5 - aa, 1.5 + aa, pk.y);
    float reed = (1.0 - smoothstep(5.0 - aa, 5.0 + aa, pk.y + (n2 - 0.5) * 2.0)) * (1.0 - rim);
    c = mix(c, vec3(0.09, 0.13, 0.045) * (0.8 + 0.5 * n2), reed);
    c = mix(c, vec3(0.44, 0.42, 0.38) * (0.9 + 0.2 * n2), rim);

    // Yollar: açık renkli çakıl, kenarlarda koyu bordür.
    float path = 1.0 - smoothstep(-aa, aa, pk.x);
    float curb = (1.0 - smoothstep(0.35 - aa, 0.35 + aa, abs(pk.x))) * fine;
    vec3 gravel = vec3(0.5, 0.46, 0.38) * (0.9 + 0.2 * n2);
    c = mix(c, gravel, path);
    c = mix(c, vec3(0.3, 0.29, 0.27), curb * 0.7);

    // Pavyon meydanı: halka desenli taş döşeme, çevresinde dilimli çiçek tarhları.
    vec2 pz = p - PZ_C;
    float bedBand = smoothstep(2.0 - aa, 2.0 + aa, pk.z) * (1.0 - smoothstep(7.0 - aa, 7.0 + aa, pk.z));
    float slice = step(0.3, fract(atan(pz.y, pz.x) / 6.28318 * 18.0));
    vec3 bed = mix(vec3(0.11, 0.07, 0.05), mix(vec3(0.55, 0.16, 0.18), vec3(0.72, 0.58, 0.3), step(0.5, h12(fc + 3.0))), clamp(flower * 0.6 + 0.25, 0.0, 1.0));
    c = mix(c, bed, bedBand * slice);
    float plaza = 1.0 - smoothstep(-aa, aa, pk.z);
    // Derz halkaları: 4 m arayla ince koyu çizgiler.
    float rings = smoothstep(0.08, 0.16, abs(fract(length(pz) / 4.0) - 0.5) * 2.0 - 0.84) * fine;
    c = mix(c, vec3(0.56, 0.53, 0.47) * (1.0 - 0.12 * rings) * (0.94 + 0.12 * n2), plaza);

    diffuseColor.rgb = c;
  }`;

// ------------------------------------------------------------------ yerleşim (TypeScript tarafı, GLSL ile aynı plan)

const [CX, CZ] = PARK.center;
const [PX, PZ] = PARK.pond;
const [RX, RZ] = PARK.pondRadius;

function loopDistance(x: number, z: number) {
  const qx = Math.abs(x - CX) - (PARK.loopHalf[0] - PARK.loopRadius);
  const qz = Math.abs(z - CZ) - (PARK.loopHalf[1] - PARK.loopRadius);
  return Math.hypot(Math.max(qx, 0), Math.max(qz, 0)) + Math.min(Math.max(qx, qz), 0) - PARK.loopRadius;
}

function shoreDistance(x: number, z: number) {
  const dx = x - PX;
  const dz = z - PZ;
  const k = Math.hypot(dx / RX, dz / RZ);
  const g = Math.hypot(dx / (RX * RX), dz / (RZ * RZ));
  return ((k - 1) * k) / Math.max(g, 1e-4);
}

function spokeDistance(x: number, z: number, [bx, bz, bend]: [number, number, number]) {
  const abx = bx - PX;
  const abz = bz - PZ;
  const length = Math.hypot(abx, abz);
  const ux = abx / length;
  const uz = abz / length;
  const t = ((x - PX) * ux + (z - PZ) * uz) / length;
  if (t < 0 || t > 1) return 1e4;
  return Math.abs((x - PX) * -uz + (z - PZ) * ux - bend * length * Math.sin(t * Math.PI));
}

/** En yakın yol kenarına uzaklık (GLSL parkLayout().x ile aynı). */
function pathDistance(x: number, z: number) {
  const loop = loopDistance(x, z);
  const shore = shoreDistance(x, z);
  let path = Math.min(Math.abs(loop) - PARK.loopWidth / 2, Math.abs(shore - PARK.ringOffset) - PARK.ringWidth / 2);
  if (shore > PARK.ringOffset && loop < 0) {
    for (const spoke of SPOKES) path = Math.min(path, spokeDistance(x, z, spoke) - PARK.spokeWidth / 2);
  }
  return path;
}

/** Ağaç dikilebilir mi: yoldan, gölden, meydandan, spor sahasından ve park kenarından uzak. */
function treeAllowed(x: number, z: number, pathClearance: number) {
  const [x0, x1, z0, z1] = PARK.bounds;
  const [cx0, cx1, cz0, cz1] = PARK.courts;
  if (x < x0 + 3 || x > x1 - 3 || z < z0 + 3 || z > z1 - 3) return false;
  if (x > cx0 - 6 && x < cx1 + 6 && z > cz0 - 6 && z < cz1 + 6) return false;
  if (Math.hypot(x - PARK.plaza[0], z - PARK.plaza[1]) < PARK.plazaRadius + 9) return false;
  if (shoreDistance(x, z) < 7) return false;
  return pathDistance(x, z) > pathClearance;
}

const hash = hash2;

function inPark(x: number, z: number) {
  const [x0, x1, z0, z1] = PARK.bounds;
  return x > x0 && x < x1 && z > z0 && z < z1;
}

/** Ağaç konumları: çevre yolu boyunca dizi, çayırlarda korular ve tek tük ağaçlar. */
function plantTrees(): [number, number][] {
  const trees: [number, number][] = [];
  const free = (x: number, z: number, spacing: number) => trees.every(([tx, tz]) => Math.hypot(tx - x, tz - z) > spacing);
  const add = (x: number, z: number, clearance: number, spacing: number) => {
    if (treeAllowed(x, z, clearance) && free(x, z, spacing)) trees.push([x, z]);
  };

  // Ağaç dizisi: çevre yolunun iç kenarına paralel, ~12 m arayla (yolun üstüne gölge düşürür).
  const inset = 10 + PARK.loopWidth / 2 + 4;
  const [x0, x1, z0, z1] = PARK.bounds;
  for (let x = x0 + inset + 14; x < x1 - inset - 14; x += 12) {
    add(x + (hash(x, 1) - 0.5) * 2, z0 + inset, 2, 8);
    add(x + (hash(x, 2) - 0.5) * 2, z1 - inset, 2, 8);
  }
  for (let z = z0 + inset + 14; z < z1 - inset - 14; z += 12) {
    add(x0 + inset, z + (hash(z, 3) - 0.5) * 2, 2, 8);
    add(x1 - inset, z + (hash(z, 4) - 0.5) * 2, 2, 8);
  }

  // Korular: yollardan uzak yerlerde 8-16 ağaçlık kümeler (altın açı dağılımı, düzensiz).
  let groves = 0;
  for (let i = 0; i < 400 && groves < 11; i++) {
    const gx = x0 + 20 + hash(i, 10) * (x1 - x0 - 40);
    const gz = z0 + 20 + hash(i, 11) * (z1 - z0 - 40);
    if (!treeAllowed(gx, gz, 12)) continue;
    groves++;
    const count = 8 + Math.floor(hash(i, 12) * 9);
    const radius = 11 + hash(i, 13) * 9;
    for (let k = 0; k < count * 2; k++) {
      const r = radius * Math.sqrt((k + 0.5) / (count * 2)) * (0.8 + 0.4 * hash(i, k + 20));
      const a = k * 2.39996 + hash(i, 14) * 6.28;
      add(gx + Math.cos(a) * r, gz + Math.sin(a) * r, 2.5, 5.5);
    }
  }

  // Tek tük ağaçlar: çimin geri kalanında seyrek.
  for (let i = 0; i < 160; i++) add(x0 + hash(i, 30) * (x1 - x0), z0 + hash(i, 31) * (z1 - z0), 4, 16);
  return trees;
}

/** Park lambaları: çevre yolu ve halka yol boyunca, yolun kenarında. */
function parkLamps(): number[] {
  const lamps: number[] = [];
  const height = 4.5;
  const [x0, x1, z0, z1] = PARK.bounds;
  const edge = 10 - PARK.loopWidth / 2 - 0.8;
  for (let x = x0 + 24; x <= x1 - 24; x += 24) lamps.push(x, height, z0 + edge, x + 12, height, z1 - edge);
  for (let z = z0 + 30; z <= z1 - 30; z += 24) lamps.push(x0 + edge, height, z, x1 - edge, height, z + 12);
  const ring = PARK.ringOffset + PARK.ringWidth / 2 + 0.8;
  for (let i = 0; i < 18; i++) {
    const a = (i / 18) * Math.PI * 2;
    // Elips etrafında yaklaşık eşit aralık: kıyıya dik yönde halka yolun dış kenarı.
    const nx = Math.cos(a) / RX;
    const nz = Math.sin(a) / RZ;
    const n = Math.hypot(nx, nz);
    lamps.push(PX + Math.cos(a) * RX + (nx / n) * ring, height, PZ + Math.sin(a) * RZ + (nz / n) * ring);
  }
  // Pavyon meydanının çevresi.
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2 + 0.2;
    lamps.push(PARK.plaza[0] + Math.cos(a) * (PARK.plazaRadius + 1), height, PARK.plaza[1] + Math.sin(a) * (PARK.plazaRadius + 1));
  }
  return lamps;
}

/**
 * Parkı düzenler: parktaki eski ağaçlar gizlenir (ölçekleri sıfırlanır), plana göre yeni ağaçlar aynı ağaç geometrisi ve
 * malzemesiyle örneklenir. Park lambası konumlarını döndürür (ışık noktaları ve ışık havuzları için).
 * Hazırlık ikinci kez çalışırsa (StrictMode) tekrar etmez.
 */
export function landscapePark(cityRoot: THREE.Object3D, treeScale: number): number[] {
  const done = cityRoot.userData.parkLamps as number[] | undefined;
  if (done) return done;
  replantTrees(cityRoot, { prefix: 'Park', inside: inPark, spots: plantTrees(), treeScale });
  const lamps = parkLamps();
  cityRoot.userData.parkLamps = lamps;
  return lamps;
}
