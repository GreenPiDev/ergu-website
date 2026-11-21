// Doğu-batı bulvarında (z 156..184) tramvay hattı. Bulvar hero kadrajının ortasından şehri baştan sona keser. Modelde ortada
// 3 m'lik refüj ve her yönde iki şerit vardı. Model değişmeden açılışta yeniden düzenlenir:
// - Refüj ve iç şeritlerin çizgileri kalkar, yerine iki yanı bordürlü, çim kaplı ray yolu gelir (blok cepheleri boyunca,
//   kavşaklarda raylar asfaltın üstünden geçer). İç şeritlerdeki araçlar trafikten çıkarılır (createTraffic, cityRuntime),
//   araçlar dış şeritlerde akmaya devam eder. Yaya geçitleri kalır.
// - Çift hat: kuzey hat batıya, güney hat doğuya (sağdan akış). Hat uçlarında tramvay durur, makasla karşı hatta geçip geri
//   döner. Ara duraklarda bekler. Tramvaylar önden ve arkadan aynıdır (çift yönlü araç), dönüşte yön değişmez.
// - Tramvay üç modüllü, açık gövdeli, alt bandı marka turuncusu (--color-accent), maket ölçeğinde büyütülür (araçlar gibi).
// Rota açılışta bir kez örneklenir, her karede iki örnek arası yorumlanır. Koordinatlar dünya metresidir.
import * as THREE from 'three';
import { PropBuilder } from './cityMass';

interface Box {
  x0: number;
  x1: number;
  z0: number;
  z1: number;
}

// ---- hat
const AXIS_Z = 169.5;
// Hat ekseninden ray yolu kenarına (bordür dahil) ve hat eksenlerine uzaklık (metre).
const CORRIDOR_HALF = 4.2;
const TRACK_OFFSET = 2.1;
const NORTH_TRACK = AXIS_Z - TRACK_OFFSET;
const SOUTH_TRACK = AXIS_Z + TRACK_OFFSET;
// Hattın uçları (bulvarın şehir içi kısmı: batıda x -390, doğuda x 1503 kavşağı) ve tramvay merkezinin durduğu yerler.
const LINE = { x0: -390, x1: 1503 };
// Ray yolu çimi: blok cepheleri (aralarındaki kuzey-güney sokaklarda raylar asfaltta kalır).
const FACES: [number, number][] = [
  [-390, -177],
  [-163, 13],
  [27, 203],
  [217, 413],
  [427, 643],
  [657, 866],
  [894, 1193],
  [1207, 1503],
];
// Ara duraklar (tramvay merkezi) ve bekleme süreleri (saniye).
const STOPS = [115, 535, 1040];
const DWELL = 15;
const TERMINAL_DWELL = 20;
// Seyir hızı ve ivme (maket ölçeğinde biraz hızlı).
const CRUISE = 14;
const ACCEL = 1.2;
// Makas: hatlar arası geçiş bu uzunlukta.
const CROSSOVER = 60;

// ---- araç (gerçek ölçü, metre; örnek matrisi maket ölçeğine büyütür)
const MODULES = 3;
const MODULE_LENGTH = 10.6;
const JOINT = 0.4;
const HALF_WIDTH = 1.325;
const TRAM_SCALE = 1.4;
const TRAM_HALF = ((MODULES * MODULE_LENGTH + (MODULES - 1) * JOINT) / 2) * TRAM_SCALE;
const TRAMS = 2;
// Ray üstünün yüksekliği (asfalt 0.56) ve ray yolu yüksekliği.
const RAIL_TOP = 0.7;
const BED_TOP = 0.66;
const ASPHALT_Y = 0.56;
const STEP = 0.1;
const MESH_NAME = 'Traffic_Tram_Moving';

// Renkler: gövde kırık beyaz, alt bant marka turuncusu (tokens.css --color-accent ile aynı), cam koyu.
const COLOR = {
  body: '#e9ebe8',
  accent: '#da7e21',
  glass: '#26313b',
  skirt: '#3d4247',
  roof: '#c3c8cc',
  joint: '#2f3337',
  grass: '#5f7a45',
  curb: '#a9a69e',
  rail: '#6f7276',
};

const CORRIDOR: Box = { x0: LINE.x0 - 20, x1: LINE.x1 + 34, z0: AXIS_Z - CORRIDOR_HALF, z1: AXIS_Z + CORRIDOR_HALF };

/** Bulvarın ray yoluna verilen kısmı: iç şeritlerdeki araçlar ve şerit çizgileri burada kalmaz. */
export function inTramCorridor(x: number, z: number) {
  return x >= CORRIDOR.x0 && x <= CORRIDOR.x1 && z >= CORRIDOR.z0 && z <= CORRIDOR.z1;
}

/** Tramvay gövdesi: +x boyunca, merkezi ortada, tabanı ray üstünde (y 0). Önden ve arkadan aynı. */
function tramGeometry() {
  const builder = new PropBuilder();
  const total = MODULES * MODULE_LENGTH + (MODULES - 1) * JOINT;
  const w = HALF_WIDTH;
  for (let m = 0; m < MODULES; m++) {
    const a = -total / 2 + m * (MODULE_LENGTH + JOINT);
    const b = a + MODULE_LENGTH;
    builder
      .box(a + 0.6, b - 0.6, 0.3, 0.9, -w + 0.15, w - 0.15, COLOR.skirt)
      .box(a, b, 0.9, 1.35, -w, w, COLOR.accent)
      .box(a, b, 1.35, 1.65, -w, w, COLOR.body)
      .box(a, b, 1.65, 2.75, -w, w, COLOR.glass)
      .box(a, b, 2.75, 3.3, -w, w, COLOR.body)
      .box(a + 1.2, b - 1.2, 3.3, 3.6, -0.85, 0.85, COLOR.roof);
    if (m < MODULES - 1) builder.box(b, b + JOINT, 0.6, 3.1, -w + 0.2, w - 0.2, COLOR.joint);
  }
  // Pantograf: orta modülün üstünde.
  builder.box(-0.9, 0.9, 3.6, 3.7, -0.5, 0.5, COLOR.joint).box(-0.08, 0.08, 3.7, 4.5, -0.7, 0.7, COLOR.joint);
  return builder.build();
}

/** Ray yolu: blok cepheleri boyunca bordürlü çim, iki hattın rayları hat boyunca kesintisiz. */
function trackGeometry() {
  const builder = new PropBuilder();
  const z0 = AXIS_Z - CORRIDOR_HALF;
  const z1 = AXIS_Z + CORRIDOR_HALF;
  for (const [x0, x1] of FACES) {
    builder
      .box(x0, x1, ASPHALT_Y - 0.1, BED_TOP, z0 + 0.3, z1 - 0.3, COLOR.grass)
      .box(x0, x1, ASPHALT_Y - 0.1, BED_TOP + 0.06, z0, z0 + 0.3, COLOR.curb)
      .box(x0, x1, ASPHALT_Y - 0.1, BED_TOP + 0.06, z1 - 0.3, z1, COLOR.curb);
  }
  // Raylar (maket ölçeğinde kalın, yoksa seçilmez): her hatta iki ray, açıklık 1,435 m x 1,4.
  const gauge = (1.435 * TRAM_SCALE) / 2;
  for (const track of [NORTH_TRACK, SOUTH_TRACK]) {
    for (const side of [-1, 1]) {
      const z = track + side * gauge;
      builder.box(LINE.x0, LINE.x1, ASPHALT_Y - 0.05, RAIL_TOP, z - 0.12, z + 0.12, COLOR.rail);
    }
  }
  return builder.build();
}

/** Rotanın bir bacağı: başlangıç ve bitiş (x, z), giriş ve çıkış hızı. Duran bacağın süresi verilir. */
interface Leg {
  a: [number, number];
  b: [number, number];
  v0: number;
  v1: number;
  hold?: number;
  /** Makas: duruştan duruşa yavaş geçiş, z yumuşak S eğrisiyle değişir. */
  ease?: boolean;
}

/** Duraklar arası bir yolculuk: kalkış ivmesi, seyir, frenleme (kısa aralıkta tepe hızı düşer). */
function run(x0: number, x1: number, z: number, legs: Leg[]) {
  const distance = Math.abs(x1 - x0);
  const dir = Math.sign(x1 - x0);
  const ramp = Math.min((CRUISE * CRUISE) / (2 * ACCEL), distance / 2);
  const top = Math.sqrt(2 * ACCEL * ramp);
  const xa = x0 + dir * ramp;
  const xb = x1 - dir * ramp;
  legs.push({ a: [x0, z], b: [xa, z], v0: 0, v1: top });
  if (Math.abs(xb - xa) > 1e-3) legs.push({ a: [xa, z], b: [xb, z], v0: top, v1: top });
  legs.push({ a: [xb, z], b: [x1, z], v0: top, v1: 0 });
}

function route(): Leg[] {
  const west = LINE.x0 + TRAM_HALF + 4;
  const east = LINE.x1 - TRAM_HALF - 4;
  const legs: Leg[] = [];
  // Doğuya: güney hat, batı ucundan doğu ucuna, ara duraklarda bekleme.
  const eastStops = [west, ...STOPS, east];
  for (let i = 0; i < eastStops.length - 1; i++) {
    run(eastStops[i], eastStops[i + 1], SOUTH_TRACK, legs);
    const terminal = i === eastStops.length - 2;
    legs.push({ a: [eastStops[i + 1], SOUTH_TRACK], b: [eastStops[i + 1], SOUTH_TRACK], v0: 0, v1: 0, hold: terminal ? TERMINAL_DWELL : DWELL });
  }
  // Doğu ucunda makasla kuzey hatta, batıya.
  const westStops = [east - CROSSOVER, ...[...STOPS].reverse(), west + CROSSOVER];
  legs.push({ a: [east, SOUTH_TRACK], b: [westStops[0], NORTH_TRACK], v0: 0, v1: 0, ease: true });
  run(westStops[0], westStops[1], NORTH_TRACK, legs);
  for (let i = 1; i < westStops.length - 1; i++) {
    legs.push({ a: [westStops[i], NORTH_TRACK], b: [westStops[i], NORTH_TRACK], v0: 0, v1: 0, hold: DWELL });
    run(westStops[i], westStops[i + 1], NORTH_TRACK, legs);
  }
  // Batı ucu: makastan önce durur, makasla güney hatta geçip hat başında bekler.
  legs.push({ a: [west + CROSSOVER, NORTH_TRACK], b: [west, SOUTH_TRACK], v0: 0, v1: 0, ease: true });
  legs.push({ a: [west, SOUTH_TRACK], b: [west, SOUTH_TRACK], v0: 0, v1: 0, hold: TERMINAL_DWELL });
  return legs;
}

/** Rotayı sabit adımlarla örnekler: konum (x, z) ve yön açısı. Döngünün süresini döndürür. */
function bake(legs: Leg[]) {
  const timed = legs.map((leg) => {
    const length = Math.hypot(leg.b[0] - leg.a[0], leg.b[1] - leg.a[1]);
    // Makas duruştan duruşa ortalama 2,5 m/s ile geçilir.
    const mean = leg.ease ? 2.5 : (leg.v0 + leg.v1) / 2;
    return { ...leg, length, duration: leg.hold ?? length / mean };
  });
  const cycle = timed.reduce((sum, leg) => sum + leg.duration, 0);
  const count = Math.ceil(cycle / STEP);
  const step = cycle / count;
  const x = new Float32Array(count);
  const z = new Float32Array(count);
  let index = 0;
  let start = 0;
  for (let i = 0; i < count; i++) {
    const time = i * step;
    while (index < timed.length - 1 && time >= start + timed[index].duration) {
      start += timed[index].duration;
      index++;
    }
    const leg = timed[index];
    const t = Math.min(time - start, leg.duration);
    let k: number;
    if (leg.hold || leg.length < 1e-6) k = 0;
    else if (leg.ease) k = t / leg.duration;
    else k = (leg.v0 * t + ((leg.v1 - leg.v0) * t * t) / (2 * leg.duration)) / leg.length;
    k = Math.min(1, k);
    // Makasta hız yumuşak kalkıp yumuşak durur, z de S eğrisi çizer (iki uçta hatta paralel).
    const s = leg.ease ? k * k * (3 - 2 * k) : k;
    x[i] = leg.a[0] + (leg.b[0] - leg.a[0]) * s;
    z[i] = leg.a[1] + (leg.b[1] - leg.a[1]) * (leg.ease ? s * s * (3 - 2 * s) : s);
  }
  // Yön: çift yönlü araç, açı ±90° içinde tutulur (dönüşte araç dönmez). Durunca son açı korunur.
  const yaw = new Float32Array(count);
  let last = 0;
  for (let pass = 0; pass < 2; pass++) {
    for (let i = 0; i < count; i++) {
      const j = (i + 1) % count;
      const dx = x[j] - x[i];
      const dz = z[j] - z[i];
      if (Math.abs(dx) > 1e-4) last = Math.atan(-dz / dx);
      yaw[i] = last;
    }
  }
  return { x, z, yaw, count, step, cycle };
}

export interface Tram {
  update: (dt: number) => void;
}

/**
 * Tramvay hattını kurar: refüjü ve iç şerit çizgilerini kaldırır, ray yolunu ve tramvayları ekler. Malzeme sahnedeki
 * köşe renkli satin malzemedir (`Mat_Satin`). Hazırlık ikinci kez çalışırsa kurulan mesh'ler yeniden kullanılır. Tramvaylar
 * ilk `update(dt > 0)` gelene kadar duraklarda bekler (hareket azaltılmışsa öyle kalır).
 */
export function createTram(cityRoot: THREE.Object3D): Tram | null {
  let mesh = cityRoot.userData.tram as THREE.InstancedMesh | undefined;
  if (!mesh) {
    let material: THREE.Material | null = null;
    cityRoot.traverse((object) => {
      if (material || !(object instanceof THREE.Mesh) || Array.isArray(object.material)) return;
      if (object.material.name === 'Mat_Satin') material = object.material;
    });
    if (!material) return null;
    cityRoot.updateMatrixWorld(true);
    const medians = cityRoot.getObjectByName('Roads_Medians');
    if (medians instanceof THREE.Mesh) dropTriangles(medians, (cx, cz) => inTramCorridor(cx, cz));
    // Şerit çizgileri yalnızca çimli kısımda kalkar: kavşaklardaki yaya geçidi çizgileri yerinde kalır.
    const markings = cityRoot.getObjectByName('Roads_Markings');
    if (markings instanceof THREE.Mesh) {
      dropTriangles(markings, (cx, cz) => inTramCorridor(cx, cz) && FACES.some(([x0, x1]) => cx > x0 + 6 && cx < x1 - 6));
    }

    const track = new THREE.Mesh(trackGeometry(), material);
    track.name = 'Tram_Track';
    mesh = new THREE.InstancedMesh(tramGeometry(), material, TRAMS);
    mesh.name = MESH_NAME;
    // Gölge haritası durağan, hareket eden tramvay gölge düşürmez. Hat boyunca gezer: sınır küresi tutulmaz.
    mesh.userData = { castShadow: false };
    mesh.frustumCulled = false;
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    // Parçalar dünya koordinatında: sahne köküne eklenir (kökün dönüşümü geri alınır).
    const inverse = cityRoot.matrixWorld.clone().invert();
    for (const object of [track, mesh]) {
      object.applyMatrix4(inverse);
      cityRoot.add(object);
    }
    cityRoot.userData.tram = mesh;
  }

  const tram = mesh;
  const path = bake(route());
  tram.updateMatrixWorld(true);
  const toLocal = tram.matrixWorld.clone().invert();
  const position = new THREE.Vector3();
  const quaternion = new THREE.Quaternion();
  const unit = new THREE.Vector3(TRAM_SCALE, TRAM_SCALE, TRAM_SCALE);
  const yAxis = new THREE.Vector3(0, 1, 0);
  const matrix = new THREE.Matrix4();
  let time = 0;

  function place() {
    for (let n = 0; n < tram.count; n++) {
      const local = (time + (n * path.cycle) / tram.count) % path.cycle;
      const f = local / path.step;
      const i = Math.floor(f) % path.count;
      const j = (i + 1) % path.count;
      const k = f - Math.floor(f);
      position.set(path.x[i] + (path.x[j] - path.x[i]) * k, RAIL_TOP, path.z[i] + (path.z[j] - path.z[i]) * k);
      quaternion.setFromAxisAngle(yAxis, path.yaw[i] + (path.yaw[j] - path.yaw[i]) * k);
      tram.setMatrixAt(n, matrix.compose(position, quaternion, unit).premultiply(toLocal));
    }
    tram.instanceMatrix.needsUpdate = true;
  }
  place();

  return {
    update(dt) {
      if (dt <= 0) return;
      time = (time + dt) % path.cycle;
      place();
    },
  };
}

/** Mesh'in seçilen üçgenlerini siler (indekssiz kopya). Seçim üçgenin dünya sınır kutusunun merkezine bakar. */
function dropTriangles(mesh: THREE.Mesh, drop: (cx: number, cz: number) => boolean) {
  const geometry = mesh.geometry;
  const position = geometry.getAttribute('position');
  const index = geometry.index;
  const count = index ? index.count : position.count;
  const vertex = (k: number) => (index ? index.getX(k) : k);
  const kept: number[] = [];
  const a = new THREE.Vector3();
  const box = new THREE.Box3();
  for (let k = 0; k < count; k += 3) {
    box.makeEmpty();
    for (let j = 0; j < 3; j++) box.expandByPoint(a.fromBufferAttribute(position, vertex(k + j)).applyMatrix4(mesh.matrixWorld));
    const cx = (box.min.x + box.max.x) / 2;
    const cz = (box.min.z + box.max.z) / 2;
    if (!drop(cx, cz)) kept.push(vertex(k), vertex(k + 1), vertex(k + 2));
  }
  geometry.setIndex(kept);
  mesh.geometry = geometry.toNonIndexed();
  geometry.dispose();
}
