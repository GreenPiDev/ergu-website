// Şehir yerleşimi: müşterinin çalışma alanları (hastane, okul, kreş, banka, teleferik, konut, sera, askerî kampüs, kültür
// merkezi, bilim merkezi, havalimanı) hero kamerasından görünecek şekilde yeniden düzenlenir. Kamera değişmez, GLB değişmez.
// Açılışta, diğer bütün hazırlıklardan önce bir kez çalışır:
//   1. Tesislerin yerleşeceği bloklardaki ara sokaklar kesilir (asfalt, çizgi, yol ışığı, yoldaki araç, sokak lambası).
//   2. Bölge takasları: iki bölgenin içeriği (binalar, ağaçlar, zeminler, tesis parçaları) birbirinin yerine geçer.
//   3. Sera şubesi: seradan bir cam hücre ve silolar boşaltılan bir bloğa taşınır.
//   4. Tesis zeminleri ve çit yeni alana oturtulur, tesis kameraları tesisle birlikte kayar.
// Bloklar ve yollar Roads_Asphalt dörtgenlerinden ölçüldü. Kontrol: ekran konumu ve kulelerin örtmesi Node'da gerçek
// modelle hesaplandı (1440-1920 genişlikte hepsi kadrajda, menü bandının altında).
import * as THREE from 'three';
import type { FacilityId } from '../../../content/facilities';

export interface Rect {
  x0: number;
  x1: number;
  z0: number;
  z1: number;
}

// Blok kenarları (metre). Sütunlar batıdan doğuya (x), sıralar kuzeyden güneye (z).
const COL = {
  A: [-390, -177],
  B: [-163, 13],
  C: [27, 203],
  D: [217, 413],
  E: [427, 643],
  F: [657, 866],
  G: [894, 1193],
  H: [1207, 1503],
} as const;
const ROW = {
  1: [-563, -417],
  2: [-403, -257],
  3: [-243, -67],
  4: [-53, 156],
  5: [184, 393],
  6: [407, 610],
  7: [630, 833],
  8: [847, 1068],
} as const;
type Col = keyof typeof COL;
type Row = keyof typeof ROW;

/** Sütun ve sıra aralığını kaplayan dikdörtgen (aradaki sokaklar dahil). */
function blocks(c0: Col, c1: Col, r0: Row, r1: Row): Rect {
  return { x0: COL[c0][0], x1: COL[c1][1], z0: ROW[r0][0], z1: ROW[r1][1] };
}

/** Hastane ile park ve askerî kampüsün güney şeridi ile ofis parkı aynı kaydırmayla yer değiştirir (G-H ↔ D-F). */
const COLUMN_SHIFT = COL.G[0] - COL.D[0] - 1; // 676 m: G-H'nin batı kenarı D'nin batı kenarına gelir

/** Park planı (cityPark.ts) bu kadar doğuya kayar: park hastanenin eski yerine geçer. */
export const PARK_SHIFT_X = COLUMN_SHIFT;

const SCHOOL_SITE = blocks('C', 'D', 1, 2);
const HOSPITAL_SITE = blocks('D', 'F', 5, 6);
const MILITARY_SITE = blocks('D', 'F', 4, 4);
const KINDERGARTEN_SITE = blocks('B', 'B', 5, 5);
const GREENHOUSE_SITE = blocks('A', 'A', 3, 3);

interface Swap {
  /** Taşınan tesisin bulunduğu bölge. */
  from: Rect;
  /** Tesisin geçeceği bölge. Buradaki içerik ters kaydırmayla `from` bölgesine gider. */
  to: Rect;
  dx: number;
  dz: number;
  /** Tesis kamerası düğümleri (Camera_X, Target_X) aynı kaydırmayla taşınır. */
  camera?: string;
  /** Tesisin yalnızca bir parçası taşındıysa kamera bu kaydırmayla yeni alanın ortasına bakar. */
  cameraShift?: [number, number];
}

const SWAPS: Swap[] = [
  // Okul (sınıflar 442..812 x 643..930) iş merkezindeki dört bloğun ortasına, kuleler okulun eski yerine.
  { from: blocks('E', 'F', 7, 8), to: SCHOOL_SITE, dx: -407, dz: -1196.5, camera: 'School' },
  // Kreş konut bölgesinde ön sıraya, oradaki evler kreşin eski bloğuna.
  { from: blocks('C', 'C', 7, 7), to: KINDERGARTEN_SITE, dx: -190, dz: -443, camera: 'Kindergarten' },
  // Hastane park ve evlerin yerine, park ve evler hastanenin eski yerine. Bulvar (z 156..184) yerinde kalır.
  { from: blocks('G', 'H', 5, 6), to: HOSPITAL_SITE, dx: -COLUMN_SHIFT, dz: 0, camera: 'Hospital' },
  // Askerî kampüsün güney şeridi (hangarlar, araçlar, iç yollar) ofis parkının yerine, ofisler kampüsün eski şeridine.
  // Kamera hedefi kampüsün ortasındaydı (1190, -230), yeni alanın ortasına (541, 51) kayar.
  {
    from: blocks('G', 'H', 4, 4),
    to: MILITARY_SITE,
    dx: -COLUMN_SHIFT,
    dz: 0,
    camera: 'MilitaryCampus',
    cameraShift: [-649, 281],
  },
];

// Ara sokakları kesilen bölgeler: tesis tek parça zemine oturur. Askerî şeridin içine uzanan kampüs içi yollar da kesilir.
// Kaldırım mesh'i eski bloklarıyla kalır, insanlar (cityPeople.ts) bu bölgelerde tek blok çevresinde yürür.
export const ROAD_CUTS: Rect[] = [SCHOOL_SITE, HOSPITAL_SITE, blocks('G', 'H', 4, 4)];

/** Sera şubesi: kaynak dikdörtgendeki sera parçaları kaydırılarak boşaltılan bloğa taşınır. */
const GREENHOUSE_PARTS: { from: Rect; dx: number; dz: number }[] = [
  // Kuzeybatıdaki cam hücre (14 tonoz, altında ürün sıraları).
  { from: { x0: -1034, x1: -892, z0: -547, z1: -393 }, dx: 648, dz: 315 },
  // Silolar.
  { from: { x0: -708, x1: -668, z0: -398, z1: -238 }, dx: 480, dz: 163 },
];

/** Yeni alana oturtulan zeminler (kenardan içeri pay, metre). `copy`: kaynak yerinde kalır, kopyası oturtulur. */
const FITS: { name: string; rect: Rect; inset: number; copy?: boolean }[] = [
  { name: 'School_Ground', rect: SCHOOL_SITE, inset: 3 },
  { name: 'Military_Ground', rect: MILITARY_SITE, inset: 3 },
  { name: 'Military_Perimeter_Fence', rect: MILITARY_SITE, inset: 6 },
  { name: 'Greenhouse_Ground', rect: GREENHOUSE_SITE, inset: 3, copy: true },
];

// Takasta yerinde kalanlar: yol ağı ve kaldırımlar, şehir dışındaki alanlar ve yalnızca kendi kuralıyla taşınan sera.
// Asfalt ise yalnızca tamamen bölgenin içindeki dörtgenleriyle (tesis içi yollar) taşınır.
const STATIC = new RegExp(
  '^(Roads_(Sidewalks|Medians|Markings|TrafficGlow)|Infrastructure_|Terrain_|Sea_|Coast_|River_|Bridge|Hill_|Riverside_|' +
    'Greens_Forest|Energy_|Airport_|Agriculture_|CableCar_|Greenhouse_)',
);
// Yol ağının parçaları: kesilen sokakla birlikte bunların sokak üstündeki örnekleri ve üçgenleri kaldırılır.
const ROAD_FURNITURE = /^(Roads_(Markings|TrafficGlow)|Vehicles_)/;
const STREET_LAMPS = /^Infrastructure_StreetLamp_/;
// Kesilen sokağın iki yanındaki kaldırımda duran lambalar (metre).
const LAMP_REACH = 8;
// Kesimden geriye bu uzunluktan kısa yol parçası kalırsa (kavşağa taşan uç) silinir.
const MIN_ROAD_PIECE = 20;

const inside = (r: Rect, x: number, z: number, pad = 0) =>
  x >= r.x0 - pad && x <= r.x1 + pad && z >= r.z0 - pad && z <= r.z1 + pad;
const boxInside = (r: Rect, box: THREE.Box3, pad = 1) =>
  box.min.x >= r.x0 - pad && box.max.x <= r.x1 + pad && box.min.z >= r.z0 - pad && box.max.z <= r.z1 + pad;
const boxTouches = (r: Rect, box: THREE.Box3) =>
  box.max.x > r.x0 && box.min.x < r.x1 && box.max.z > r.z0 && box.min.z < r.z1;

/** Sahne kökü dönüşümsüzdür, düğümler yalnızca öteleme ve ölçek taşır: dünya kaydırması yerel kaydırmaya böyle çevrilir. */
function localOffset(object: THREE.Object3D, dx: number, dz: number): THREE.Vector3 {
  const scale = object.getWorldScale(new THREE.Vector3());
  return new THREE.Vector3(dx / scale.x, 0, dz / scale.z);
}

// ------------------------------------------------------------------ üçgen düzeyinde düzenleme

type TriangleAction = 'keep' | 'remove' | { dx: number; dz: number };

/**
 * Birleştirilmiş mesh'lerde (zemin yamaları, kampüs binaları) üçgen başına karar verir: kalır, silinir veya kayar.
 * Geometri indekssiz ve Float32 konumlu hale getirilir (nicemlenmiş konumlar kaydırmayla aralık dışına çıkabilir).
 */
function editTriangles(mesh: THREE.Mesh, decide: (box: THREE.Box3) => TriangleAction) {
  mesh.updateWorldMatrix(true, false);
  const source = mesh.geometry.index ? mesh.geometry.toNonIndexed() : mesh.geometry.clone();
  const position = source.getAttribute('position');
  const count = position.count / 3;
  const world = new THREE.Vector3();
  const actions: TriangleAction[] = [];
  let changed = false;
  for (let t = 0; t < count; t++) {
    const box = new THREE.Box3();
    for (let k = 0; k < 3; k++) box.expandByPoint(world.fromBufferAttribute(position, t * 3 + k).applyMatrix4(mesh.matrixWorld));
    const action = decide(box);
    actions.push(action);
    if (action !== 'keep') changed = true;
  }
  if (!changed) {
    source.dispose();
    return;
  }
  const kept = actions.filter((action) => action !== 'remove').length;
  const geometry = new THREE.BufferGeometry();
  for (const [name, attribute] of Object.entries(source.attributes)) {
    if (!(attribute instanceof THREE.BufferAttribute)) continue;
    const isPosition = name === 'position';
    const size = attribute.itemSize;
    const ArrayType = isPosition ? Float32Array : (attribute.array.constructor as new (length: number) => THREE.TypedArray);
    const array = new ArrayType(kept * 3 * size);
    let out = 0;
    for (let t = 0; t < count; t++) {
      const action = actions[t];
      if (action === 'remove') continue;
      const move = action === 'keep' ? null : localOffset(mesh, action.dx, action.dz);
      for (let k = 0; k < 3; k++) {
        const v = t * 3 + k;
        if (isPosition) {
          array[out++] = attribute.getX(v) + (move?.x ?? 0);
          array[out++] = attribute.getY(v);
          array[out++] = attribute.getZ(v) + (move?.z ?? 0);
        } else {
          for (let c = 0; c < size; c++) array[out++] = attribute.array[v * size + c];
        }
      }
    }
    geometry.setAttribute(name, new THREE.BufferAttribute(array, size, isPosition ? false : attribute.normalized));
  }
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  source.dispose();
  mesh.geometry = geometry;
}

// ------------------------------------------------------------------ örnek düzeyinde düzenleme

type InstanceAction = 'keep' | 'remove' | { dx: number; dz: number };

/** Örnekli mesh'te örnek başına karar verir. Silinen örnekler diziden çıkarılır, sayı azalır. */
function editInstances(mesh: THREE.InstancedMesh, decide: (x: number, z: number, index: number) => InstanceAction) {
  mesh.updateWorldMatrix(true, false);
  const matrix = new THREE.Matrix4();
  const world = new THREE.Vector3();
  const kept: THREE.Matrix4[] = [];
  let changed = false;
  for (let i = 0; i < mesh.count; i++) {
    mesh.getMatrixAt(i, matrix);
    world.setFromMatrixPosition(matrix).applyMatrix4(mesh.matrixWorld);
    const action = decide(world.x, world.z, i);
    if (action === 'remove') {
      changed = true;
      continue;
    }
    const item = matrix.clone();
    if (action !== 'keep') {
      const move = localOffset(mesh, action.dx, action.dz);
      item.elements[12] += move.x;
      item.elements[14] += move.z;
      changed = true;
    }
    kept.push(item);
  }
  if (!changed) return;
  kept.forEach((item, index) => mesh.setMatrixAt(index, item));
  mesh.count = kept.length;
  mesh.instanceMatrix.needsUpdate = true;
  mesh.computeBoundingBox();
  mesh.computeBoundingSphere();
}

// ------------------------------------------------------------------ sokak kesme

interface RoadPiece {
  box: THREE.Box3;
  vertices: number[]; // geometrideki 6 köşe (indekssiz)
}

/**
 * Tesisin oturacağı bölgeden geçen sokaklar o aralıkta kesilir. Her sokak tek bir dörtgendir (iki üçgen): kesilen dörtgen
 * aynı köşe verisiyle (renk, normal) kalan parçalara bölünür. Sokağın üstündeki çizgiler, yol ışıkları ve araçlar ile iki
 * yanındaki lambalar kaldırılır. Bölgenin tamamen içinde kalan dörtgenler (tesis içi yollar) kesilmez, takasla taşınır.
 */
function cutRoads(cityRoot: THREE.Object3D, cuts: Rect[]) {
  const asphalt = cityRoot.getObjectByName('Roads_Asphalt');
  if (!(asphalt instanceof THREE.Mesh)) return;
  asphalt.updateWorldMatrix(true, false);
  const source = asphalt.geometry.index ? asphalt.geometry.toNonIndexed() : asphalt.geometry.clone();
  const position = source.getAttribute('position');
  const world = new THREE.Vector3();

  // Dörtgenler: ardışık iki üçgenin sınır kutusu aynıdır.
  const pieces: RoadPiece[] = [];
  for (let t = 0; t < position.count / 3; t++) {
    const box = new THREE.Box3();
    for (let k = 0; k < 3; k++) box.expandByPoint(world.fromBufferAttribute(position, t * 3 + k).applyMatrix4(asphalt.matrixWorld));
    const last = pieces[pieces.length - 1];
    if (last && last.vertices.length === 3 && last.box.equals(box)) last.vertices.push(t * 3, t * 3 + 1, t * 3 + 2);
    else pieces.push({ box, vertices: [t * 3, t * 3 + 1, t * 3 + 2] });
  }

  const removed: Rect[] = [];
  // Her parça: [kaynak parça, yeni uzunluk aralığı] ya da kesilmeden kalır.
  const output: { piece: RoadPiece; from: number; to: number; alongX: boolean }[] = [];
  for (const piece of pieces) {
    const { box } = piece;
    const alongX = box.max.x - box.min.x > box.max.z - box.min.z;
    const start = alongX ? box.min.x : box.min.z;
    const end = alongX ? box.max.x : box.max.z;
    let spans: [number, number][] = [[start, end]];
    for (const cut of cuts) {
      if (boxInside(cut, box, 0)) continue;
      // Sokağın eni bölgenin içindeyse, boyu bölgeyle kesiştiği aralıkta kesilir.
      const across = alongX ? [box.min.z, box.max.z] : [box.min.x, box.max.x];
      const cutAcross = alongX ? [cut.z0, cut.z1] : [cut.x0, cut.x1];
      if (across[0] < cutAcross[0] || across[1] > cutAcross[1]) continue;
      const [c0, c1] = alongX ? [cut.x0, cut.x1] : [cut.z0, cut.z1];
      const next: [number, number][] = [];
      for (const [a, b] of spans) {
        if (b <= c0 || a >= c1) {
          next.push([a, b]);
          continue;
        }
        const lo = Math.max(a, c0);
        const hi = Math.min(b, c1);
        removed.push(alongX ? { x0: lo, x1: hi, z0: box.min.z, z1: box.max.z } : { x0: box.min.x, x1: box.max.x, z0: lo, z1: hi });
        if (lo - a > 0) next.push([a, lo]);
        if (b - hi > 0) next.push([hi, b]);
      }
      spans = next;
    }
    for (const [a, b] of spans) {
      if (b - a < MIN_ROAD_PIECE && end - start >= MIN_ROAD_PIECE) {
        // Kavşağa taşan kısa uç: sokakla birlikte kalkar.
        removed.push(alongX ? { x0: a, x1: b, z0: box.min.z, z1: box.max.z } : { x0: box.min.x, x1: box.max.x, z0: a, z1: b });
        continue;
      }
      output.push({ piece, from: a, to: b, alongX });
    }
  }
  if (!removed.length) {
    source.dispose();
    return;
  }

  // Yeni geometri: her parça kaynak dörtgenin köşeleri, boyuna koordinat kalan aralığa sıkıştırılır.
  const toLocal = asphalt.matrixWorld.clone().invert();
  const vertexCount = output.reduce((sum, item) => sum + item.piece.vertices.length, 0);
  const geometry = new THREE.BufferGeometry();
  for (const [name, attribute] of Object.entries(source.attributes)) {
    if (!(attribute instanceof THREE.BufferAttribute)) continue;
    const isPosition = name === 'position';
    const size = attribute.itemSize;
    const ArrayType = isPosition ? Float32Array : (attribute.array.constructor as new (length: number) => THREE.TypedArray);
    const array = new ArrayType(vertexCount * size);
    let out = 0;
    for (const { piece, from, to, alongX } of output) {
      const start = alongX ? piece.box.min.x : piece.box.min.z;
      for (const v of piece.vertices) {
        if (isPosition) {
          world.fromBufferAttribute(attribute, v).applyMatrix4(asphalt.matrixWorld);
          const along = alongX ? world.x : world.z;
          const clamped = Math.abs(along - start) < 0.5 ? from : to;
          if (alongX) world.x = clamped;
          else world.z = clamped;
          world.applyMatrix4(toLocal);
          array[out++] = world.x;
          array[out++] = world.y;
          array[out++] = world.z;
        } else {
          for (let c = 0; c < size; c++) array[out++] = attribute.array[v * size + c];
        }
      }
    }
    geometry.setAttribute(name, new THREE.BufferAttribute(array, size, isPosition ? false : attribute.normalized));
  }
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  source.dispose();
  asphalt.geometry = geometry;

  // Kesilen sokağın üstündekiler ve kaldırımındaki lambalar.
  const onRemoved = (x: number, z: number, pad: number) => removed.some((r) => inside(r, x, z, pad));
  cityRoot.traverse((object) => {
    if (object instanceof THREE.InstancedMesh) {
      if (ROAD_FURNITURE.test(object.name)) editInstances(object, (x, z) => (onRemoved(x, z, 1) ? 'remove' : 'keep'));
      else if (STREET_LAMPS.test(object.name)) editInstances(object, (x, z) => (onRemoved(x, z, LAMP_REACH) ? 'remove' : 'keep'));
    } else if (object instanceof THREE.Mesh && object.name === 'Roads_Markings') {
      editTriangles(object, (box) => (removed.some((r) => boxInside(r, box, 1)) ? 'remove' : 'keep'));
    }
  });
}

// ------------------------------------------------------------------ bölge takası

/** Aracın üstünde durduğu yol dörtgeni (yoksa null): yoldaki araç trafiktir, yerinde kalır. Otoparktaki araç bloğuyla taşınır. */
type RoadLookup = (x: number, z: number) => THREE.Box3 | null;

function roadLookup(cityRoot: THREE.Object3D): RoadLookup {
  const asphalt = cityRoot.getObjectByName('Roads_Asphalt');
  const boxes: THREE.Box3[] = [];
  if (asphalt instanceof THREE.Mesh) {
    asphalt.updateWorldMatrix(true, false);
    const position = asphalt.geometry.getAttribute('position');
    const index = asphalt.geometry.index;
    const world = new THREE.Vector3();
    const triangles = (index ? index.count : position.count) / 3;
    for (let t = 0; t < triangles; t++) {
      const box = new THREE.Box3();
      for (let k = 0; k < 3; k++) {
        box.expandByPoint(world.fromBufferAttribute(position, index ? index.getX(t * 3 + k) : t * 3 + k).applyMatrix4(asphalt.matrixWorld));
      }
      boxes.push(box);
    }
  }
  return (x, z) => boxes.find((box) => x >= box.min.x && x <= box.max.x && z >= box.min.z && z <= box.max.z) ?? null;
}

/**
 * İki bölgenin içeriği aynı anda yer değiştirir: `from` içindekiler (dx, dz) kayar, `to` içindekiler ters yönde. Hedef
 * bölgeye sığmayan parça silinir (bölgeler aynı boyda değil). Tamamen bölgede kalan mesh düğümüyle, sınırı aşan birleşik
 * mesh üçgen üçgen, örnekli mesh örnek örnek taşınır. Kararlar önce toplanır, sonra uygulanır (iki yön karışmasın).
 */
function swapRegions(cityRoot: THREE.Object3D, swap: Swap, skip: Set<string>, roadAt: RoadLookup) {
  const { from, to, dx, dz } = swap;
  const target = (x: number, z: number): { dx: number; dz: number } | 'keep' | 'remove' => {
    if (inside(from, x, z)) return inside(to, x + dx, z + dz) ? { dx, dz } : 'remove';
    if (inside(to, x, z)) return inside(from, x - dx, z - dz) ? { dx: -dx, dz: -dz } : 'remove';
    return 'keep';
  };
  const boxTarget = (box: THREE.Box3): TriangleAction => {
    const inFrom = boxInside(from, box);
    const inTo = boxInside(to, box);
    if (!inFrom && !inTo) return 'keep';
    const [mx, mz] = inFrom ? [dx, dz] : [-dx, -dz];
    const landing = new THREE.Box3(box.min.clone().add(new THREE.Vector3(mx, 0, mz)), box.max.clone().add(new THREE.Vector3(mx, 0, mz)));
    return boxInside(inFrom ? to : from, landing, 3) ? { dx: mx, dz: mz } : 'remove';
  };

  const jobs: (() => void)[] = [];
  cityRoot.traverse((object) => {
    if (!(object instanceof THREE.Mesh) || skip.has(object.name)) return;
    const asphalt = object.name === 'Roads_Asphalt';
    if (STATIC.test(object.name) && !asphalt) return;
    if (object instanceof THREE.InstancedMesh) {
      const vehicles = /^Vehicles_/.test(object.name);
      // Tesis içi yoldaki araç (yol dörtgeni bölgenin içinde) yoluyla birlikte taşınır, sokaktaki araç kalır.
      const onStreet = (x: number, z: number) => {
        const road = roadAt(x, z);
        return road !== null && !boxInside(from, road) && !boxInside(to, road);
      };
      jobs.push(() => editInstances(object, (x, z) => (vehicles && onStreet(x, z) ? 'keep' : target(x, z))));
      return;
    }
    const box = new THREE.Box3().setFromObject(object);
    if (!boxTouches(from, box) && !boxTouches(to, box)) return;
    const whole = asphalt ? 'keep' : boxTarget(box);
    if (whole !== 'keep') {
      // Tesis parçası bütünüyle bölgede: düğüm kayar.
      jobs.push(() => {
        if (whole === 'remove') {
          object.visible = false;
          return;
        }
        object.position.add(localOffset(object.parent ?? cityRoot, whole.dx, whole.dz));
        object.updateMatrixWorld(true);
      });
      return;
    }
    jobs.push(() => editTriangles(object, boxTarget));
  });
  for (const job of jobs) job();
}

/** Yalnızca sera parçalarını kaynak dikdörtgenden kaydırır (sera geri kalanıyla yerinde kalır). */
function transplantGreenhouse(cityRoot: THREE.Object3D) {
  const jobs: (() => void)[] = [];
  cityRoot.traverse((object) => {
    if (!(object instanceof THREE.Mesh) || !/^Greenhouse_/.test(object.name) || object.name === 'Greenhouse_Ground') return;
    for (const part of GREENHOUSE_PARTS) {
      if (object instanceof THREE.InstancedMesh) {
        jobs.push(() => editInstances(object, (x, z) => (inside(part.from, x, z) ? { dx: part.dx, dz: part.dz } : 'keep')));
        continue;
      }
      const box = new THREE.Box3().setFromObject(object);
      if (!boxTouches(part.from, box)) continue;
      if (boxInside(part.from, box)) {
        jobs.push(() => {
          object.position.add(localOffset(object.parent ?? cityRoot, part.dx, part.dz));
          object.updateMatrixWorld(true);
        });
      } else {
        jobs.push(() => editTriangles(object, (tri) => (boxInside(part.from, tri) ? { dx: part.dx, dz: part.dz } : 'keep')));
      }
    }
  });
  for (const job of jobs) job();
}

/** Bölgedeki bütün taşınabilir içeriği siler (sera şubesine yer açmak için). */
function clearRegion(cityRoot: THREE.Object3D, rect: Rect, roadAt: RoadLookup) {
  const jobs: (() => void)[] = [];
  cityRoot.traverse((object) => {
    if (!(object instanceof THREE.Mesh) || STATIC.test(object.name) || object.name === 'Roads_Asphalt') return;
    if (object instanceof THREE.InstancedMesh) {
      const vehicles = /^Vehicles_/.test(object.name);
      jobs.push(() => editInstances(object, (x, z) => (inside(rect, x, z) && !(vehicles && roadAt(x, z)) ? 'remove' : 'keep')));
      return;
    }
    const box = new THREE.Box3().setFromObject(object);
    if (!boxTouches(rect, box)) return;
    if (boxInside(rect, box)) jobs.push(() => (object.visible = false));
    else jobs.push(() => editTriangles(object, (tri) => (boxInside(rect, tri) ? 'remove' : 'keep')));
  });
  for (const job of jobs) job();
}

/** Mesh'i yatayda ölçekleyip dikdörtgene oturtur (yükseklik aynı kalır). Kopya istenirse kaynak yerinde kalır. */
function fitToRect(cityRoot: THREE.Object3D, name: string, rect: Rect, inset: number, copy: boolean) {
  const source = cityRoot.getObjectByName(name);
  if (!(source instanceof THREE.Mesh) || !source.parent) return;
  let mesh = source;
  if (copy) {
    mesh = new THREE.Mesh(source.geometry, source.material);
    mesh.name = `${name}_Site`;
    mesh.position.copy(source.position);
    mesh.scale.copy(source.scale);
    mesh.userData = { ...source.userData };
    source.parent.add(mesh);
  }
  mesh.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(mesh);
  const parentScale = mesh.parent ? mesh.parent.getWorldScale(new THREE.Vector3()) : new THREE.Vector3(1, 1, 1);
  const sx = (rect.x1 - rect.x0 - inset * 2) / (box.max.x - box.min.x);
  const sz = (rect.z1 - rect.z0 - inset * 2) / (box.max.z - box.min.z);
  // Dünya x = konum + ölçek * yerel. Yeni ölçekte kutunun batı-kuzey köşesi dikdörtgenin içteki köşesine gelir.
  const localMinX = (box.min.x - mesh.getWorldPosition(new THREE.Vector3()).x) / (mesh.scale.x * parentScale.x);
  const localMinZ = (box.min.z - mesh.getWorldPosition(new THREE.Vector3()).z) / (mesh.scale.z * parentScale.z);
  mesh.scale.x *= sx;
  mesh.scale.z *= sz;
  mesh.position.x = (rect.x0 + inset) / parentScale.x - localMinX * mesh.scale.x;
  mesh.position.z = (rect.z0 + inset) / parentScale.z - localMinZ * mesh.scale.z;
  mesh.updateMatrixWorld(true);
}

/** Tesis kamerası ve hedef düğümü tesisle birlikte kayar (ileride tesise uçuş için). */
function moveFacilityCamera(cityRoot: THREE.Object3D, facility: string, dx: number, dz: number) {
  for (const prefix of ['Camera_', 'Target_']) {
    const node = cityRoot.getObjectByName(prefix + facility);
    if (!node) continue;
    node.position.add(localOffset(node.parent ?? cityRoot, dx, dz));
    node.updateMatrixWorld(true);
  }
}

/** Yerleşimi uygular. Hazırlık ikinci kez çalışırsa (StrictMode, kalite değişimi) tekrar etmez. */
export function arrangeCity(cityRoot: THREE.Object3D) {
  if (cityRoot.userData.arranged) return;
  cityRoot.userData.arranged = true;
  cityRoot.updateMatrixWorld(true);

  cutRoads(cityRoot, ROAD_CUTS);
  const roadAt = roadLookup(cityRoot);
  const fitted = new Set(FITS.map((fit) => fit.name));
  for (const swap of SWAPS) {
    swapRegions(cityRoot, swap, fitted, roadAt);
    const [cameraDx, cameraDz] = swap.cameraShift ?? [swap.dx, swap.dz];
    if (swap.camera) moveFacilityCamera(cityRoot, swap.camera, cameraDx, cameraDz);
  }
  clearRegion(cityRoot, GREENHOUSE_SITE, roadAt);
  transplantGreenhouse(cityRoot);
  // Sera kamerasının hedefi (-860, -260) şubenin ortasına (-283, -155) kayar.
  moveFacilityCamera(cityRoot, 'Greenhouse', 577, 105);
  for (const fit of FITS) fitToRect(cityRoot, fit.name, fit.rect, fit.inset, fit.copy ?? false);
  cityRoot.updateMatrixWorld(true);
}

/**
 * Tesislerin şehirdeki sınırları (yerleşimden sonraki dünya koordinatı, metre). Lokasyon butonları bu dikdörtgenlerin
 * çevresinde ışık perdesi açar. Havalimanında yalnızca terminal, apron ve otoparklar, konutta mahalle merkezinin sırası.
 */
export const FACILITY_RECTS: Record<FacilityId, Rect> = {
  hospital: HOSPITAL_SITE,
  school: SCHOOL_SITE,
  kindergarten: KINDERGARTEN_SITE,
  bank: blocks('C', 'C', 3, 3),
  cableCar: blocks('B', 'B', 2, 2),
  housing: blocks('B', 'C', 6, 6),
  greenhouse: GREENHOUSE_SITE,
  militaryCampus: MILITARY_SITE,
  culturalCenter: blocks('A', 'A', 4, 4),
  scienceCenter: blocks('E', 'F', 1, 3),
  airport: { x0: 430, x1: 1070, z0: -901, z1: -612 },
};

// Seçim kutuları perdeyle aynı payla (cityHighlight CURTAIN_OFFSET) sınırın dışına taşar.
const PICK_PAD = 4;
// Tesisin zemin kutusunun boyu bu aralıkta kalır, daha yüksek yapılar (banka kulesi, bilim kulesi) kendi dar kutusunu alır.
// Tek kutu bütün bloğu kulenin boyuna çıkarıyor, çevredeki kulelerin üstüne gelmek de tesisi seçiyordu.
const PICK_MIN_HEIGHT = 14;
const PICK_BASE_HEIGHT = 30;
// Boy hesabına girmeyenler: zemin ve yol katmanları, kablolar ve şehrin dışı. Havalimanı ve teleferik yapıları girer.
const PICK_SKIP = /^(Roads_|Runtime_|Terrain_|Sea_|Coast_|River_|Riverside_|Hill_|Greens_Forest|Energy_|CableCar_(Cables|Gondolas)|Bridge)/;

export interface FacilityPick {
  id: FacilityId;
  boxes: THREE.Box3[];
}

/**
 * Fareyle tesis seçmek için görünmez kutular: tesisin dikdörtgeninde alçak yapıları kapsayan bir zemin kutusu ve
 * yüksek her yapı için kendi (dikdörtgene kırpılmış) kutusu. Işın önce cepheye çarpar, kulenin tepesine gelmek de tesisi
 * seçer. Yerleşim ve bina bölme bittikten sonra bir kez hesaplanır.
 */
export function facilityPickBoxes(cityRoot: THREE.Object3D): FacilityPick[] {
  cityRoot.updateMatrixWorld(true);
  const entries = Object.entries(FACILITY_RECTS) as [FacilityId, Rect][];
  const picks = new Map<FacilityId, { base: number; towers: THREE.Box3[] }>(
    entries.map(([id]) => [id, { base: PICK_MIN_HEIGHT, towers: [] }]),
  );
  const add = (x: number, z: number, box: THREE.Box3) => {
    for (const [id, rect] of entries) {
      if (!inside(rect, x, z)) continue;
      const pick = picks.get(id);
      if (!pick) continue;
      if (box.max.y <= PICK_BASE_HEIGHT) {
        pick.base = Math.max(pick.base, box.max.y);
        continue;
      }
      pick.base = PICK_BASE_HEIGHT;
      const clipped = box.clone();
      clipped.min.set(Math.max(box.min.x, rect.x0), 0, Math.max(box.min.z, rect.z0));
      clipped.max.x = Math.min(box.max.x, rect.x1);
      clipped.max.z = Math.min(box.max.z, rect.z1);
      pick.towers.push(clipped.expandByScalar(2));
    }
  };
  const matrix = new THREE.Matrix4();
  const position = new THREE.Vector3();
  const quaternion = new THREE.Quaternion();
  const scale = new THREE.Vector3();
  cityRoot.traverse((object) => {
    if (!(object instanceof THREE.Mesh) || !object.visible || PICK_SKIP.test(object.name)) return;
    if (object instanceof THREE.InstancedMesh) {
      // Bina kütleleri birim küpün içinde: örnek kutusu merkez ± yarı ölçü.
      if (!/_Buildings_/.test(object.name)) return;
      for (let i = 0; i < object.count; i++) {
        object.getMatrixAt(i, matrix);
        matrix.premultiply(object.matrixWorld).decompose(position, quaternion, scale);
        add(position.x, position.z, new THREE.Box3(position.clone().sub(scale), position.clone().add(scale)));
      }
      return;
    }
    const box = new THREE.Box3().setFromObject(object);
    const center = box.getCenter(position);
    add(center.x, center.z, box);
  });
  return entries.map(([id, rect]) => {
    const pick = picks.get(id) ?? { base: PICK_MIN_HEIGHT, towers: [] };
    const base = new THREE.Box3(
      new THREE.Vector3(rect.x0 - PICK_PAD, 0, rect.z0 - PICK_PAD),
      new THREE.Vector3(rect.x1 + PICK_PAD, pick.base, rect.z1 + PICK_PAD),
    );
    return { id, boxes: [base, ...pick.towers] };
  });
}

/** Işının çarptığı en yakın tesis (yoksa null). */
export function pickFacility(ray: THREE.Ray, picks: FacilityPick[]): FacilityId | null {
  const hit = new THREE.Vector3();
  let nearest: FacilityId | null = null;
  let distance = Infinity;
  for (const { id, boxes } of picks) {
    for (const box of boxes) {
      if (!ray.intersectBox(box, hit)) continue;
      const d = hit.distanceTo(ray.origin);
      if (d < distance) {
        distance = d;
        nearest = id;
      }
    }
  }
  return nearest;
}
