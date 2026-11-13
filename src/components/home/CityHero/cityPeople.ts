// Şehirdeki insanlar. Modelde hiç insan yok: kaldırımlarda blokların çevresinde yürüyenler ve blokların, tesislerin, meydan
// ve parkın boş alanlarında gezinip duraklayanlar burada kurulur. Bina, havuz ve gölet üstüne çıkmasınlar diye şehrin
// 2 m'lik doluluk haritası çıkarılır (çatılar ve tabanı geniş yapılar dolu sayılır). İnsanlar iki örneklenmiş mesh'tir
// (gövde: kıyafet rengi, baş: ten rengi), hareketleri shader'da, gölge düşürmez, kalite düşükse seyreltilir (`thinnable`).
import * as THREE from 'three';
import { FACILITY_RECTS, type Rect } from './cityLayout';

// Gerçek boy ~1.72 m. Maket gibi iri (~3.4 m): hero mesafesinde ~5, yakın çekimde ~15 piksel. 1.3 katında (~3 piksel)
// kullanıcıya fazla küçük geldi. Araçlar da aynı nedenle büyütülür (cityRuntime.ts, VEHICLE_SCALE).
const PEOPLE_SCALE = 2;
// Doluluk haritasının hücresi (metre) ve kapsadığı alan (şehir blokları ve tesisler).
const CELL = 2;
const GRID = { minX: -1500, minZ: -1450, sizeX: 3100, sizeZ: 2600 };
// Zeminin bu kadar üstüne çıkan yapı hücreyi doldurur (çit, bank gibi alçak şeyler yürünebilir sayılmaz ama zararsız).
const OBSTACLE_HEIGHT = 2.2;
// Kaldırımda bir yürüyen başına çevre uzunluğu ve boş alanda bir gezinen başına alan (yüksek kalite).
const SIDEWALK_SPACING = 24;
const BLOCK_AREA_PER_PERSON = 1500;
// Tesislerde daha kalabalık: lokasyonlar insanların olduğu yerler.
const FACILITY_AREA_PER_PERSON = 650;
// Kaldırımda yürüme şeridi: blok kenarından içeri (metre).
const SIDEWALK_INSET_MIN = 1.4;
const SIDEWALK_INSET_MAX = 3.4;

const SKIP = /^(Runtime_|Traffic_(?!.*_Parked$)|Vehicles_|Greens_|Roads_Asphalt|Roads_Markings|Roads_Medians|Roads_Traffic|Terrain_|Sea_|Coast_|River_|Riverside_|Bridges|Infrastructure_Ships|Infrastructure_StreetLamp|Airport_Lights|CableCar_(Cables|Gondolas))/;
const GROUND = /(Ground|Sidewalk|Plaza|Paving|Pavement|Airfield|Court|Promenade|Field)/;
// Düz ama üstünde yürünmeyen yüzeyler.
const WATER = /^(Park_Pond|Residential_Pools|Greenhouse_Basin|Cultural_Fountain)/;
// Park etmiş araçlar engel eşiğinden alçak (~2.2 m) ama üstlerinde insan durmaz: yükseklikten bağımsız dolu sayılır.
const PARKED = /^Traffic_.*_Parked$/;

// Kıyafet renkleri: koyu ve nötr ağırlıklı, aralarda canlı tonlar. Ten renkleri ayrı.
const CLOTHES = ['#1d2433', '#2b2b2e', '#e9e6df', '#c9b79a', '#7b2d2d', '#d6a531', '#2f6f73', '#4d5a3a', '#8a8f98', '#3c4f7a', '#b4472c', '#f1f1ee'];
const SKIN = ['#e9c4a4', '#c99a72', '#8d5d3d', '#f2d3b8', '#a8744f'];
// İçtimadaki askerler: haki üniforma, yukarıdan baş yerine miğfer görünür. Komutanın üniforması biraz daha koyu.
const UNIFORM = '#4a5233';
const HELMET = '#353b26';
const OFFICER = '#2f3524';

// İçtima nizamı (metre): bölük 8 sütun x 6 sıra, aralar omuz omuza ve kol boyu. Bölükler yan yana, aralarında boşluk.
// Komutan nizamın önündeki şeritte ağır ağır gidip gelir. Aralıklar insan ölçeğiyle orantılı (1.3 ölçekte 1.3 ve 1.6 m).
const PARADE_STEP = PEOPLE_SCALE / 1.3;
const PARADE = {
  columns: 8,
  rows: 6,
  columnStep: 1.3 * PARADE_STEP,
  rowStep: 1.6 * PARADE_STEP,
  companyGap: 5 * PARADE_STEP,
  maxCompanies: 8,
  margin: 4,
  frontLane: 9 * PARADE_STEP,
};

/** Tekrarlanabilir rastgele sayı: her yüklemede aynı kalabalık. */
function random(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

class OccupancyGrid {
  readonly width = Math.ceil(GRID.sizeX / CELL);
  readonly depth = Math.ceil(GRID.sizeZ / CELL);
  readonly ground = new Float32Array(this.width * this.depth).fill(Number.NaN);
  readonly blocked = new Uint8Array(this.width * this.depth);

  index(x: number, z: number) {
    const i = Math.floor((x - GRID.minX) / CELL);
    const k = Math.floor((z - GRID.minZ) / CELL);
    if (i < 0 || k < 0 || i >= this.width || k >= this.depth) return -1;
    return k * this.width + i;
  }

  /** xz kutusunun altındaki hücreler. */
  forEach(x0: number, x1: number, z0: number, z1: number, visit: (cell: number) => void) {
    const i0 = Math.max(0, Math.floor((x0 - GRID.minX) / CELL));
    const i1 = Math.min(this.width - 1, Math.floor((x1 - GRID.minX) / CELL));
    const k0 = Math.max(0, Math.floor((z0 - GRID.minZ) / CELL));
    const k1 = Math.min(this.depth - 1, Math.floor((z1 - GRID.minZ) / CELL));
    for (let k = k0; k <= k1; k++) for (let i = i0; i <= i1; i++) visit(k * this.width + i);
  }

  free(x: number, z: number) {
    const cell = this.index(x, z);
    return cell >= 0 && !this.blocked[cell] && !Number.isNaN(this.ground[cell]);
  }

  groundAt(x: number, z: number) {
    const cell = this.index(x, z);
    const y = cell >= 0 ? this.ground[cell] : Number.NaN;
    return Number.isNaN(y) ? 1 : y;
  }

  /** İki nokta arasındaki düz yol boş mu (hücre adımlarıyla). */
  clear(ax: number, az: number, bx: number, bz: number) {
    const steps = Math.ceil(Math.hypot(bx - ax, bz - az) / CELL);
    for (let s = 1; s <= steps; s++) {
      const t = s / steps;
      if (!this.free(ax + (bx - ax) * t, az + (bz - az) * t)) return false;
    }
    return true;
  }
}

/** Mesh'in üçgenleri dünya koordinatında. */
function forEachTriangle(mesh: THREE.Mesh, visit: (a: THREE.Vector3, b: THREE.Vector3, c: THREE.Vector3) => void) {
  const position = mesh.geometry.getAttribute('position');
  if (!position) return;
  const index = mesh.geometry.index;
  const count = (index ? index.count : position.count) / 3;
  const a = new THREE.Vector3();
  const b = new THREE.Vector3();
  const c = new THREE.Vector3();
  const vertex = (target: THREE.Vector3, k: number) =>
    target.fromBufferAttribute(position, index ? index.getX(k) : k).applyMatrix4(mesh.matrixWorld);
  for (let t = 0; t < count; t++) {
    vertex(a, t * 3);
    vertex(b, t * 3 + 1);
    vertex(c, t * 3 + 2);
    visit(a, b, c);
  }
}

/** Zemin yüksekliği (düz, yere yakın yüzeyler) ve dolu hücreler. */
function buildGrid(cityRoot: THREE.Object3D) {
  const grid = new OccupancyGrid();
  const meshes: THREE.Mesh[] = [];
  cityRoot.traverse((object) => {
    if (object instanceof THREE.Mesh && object.visible && !SKIP.test(object.name)) meshes.push(object);
  });
  const edge1 = new THREE.Vector3();
  const edge2 = new THREE.Vector3();
  const normal = new THREE.Vector3();

  // 1. Zemin: adı zemin olan mesh'lerin düz ve alçak üçgenleri, hücrenin en yüksek zemini.
  for (const mesh of meshes) {
    if (mesh instanceof THREE.InstancedMesh || !GROUND.test(mesh.name)) continue;
    forEachTriangle(mesh, (a, b, c) => {
      const top = Math.max(a.y, b.y, c.y);
      if (top > 6) return;
      normal.crossVectors(edge1.subVectors(b, a), edge2.subVectors(c, a)).normalize();
      if (Math.abs(normal.y) < 0.95) return;
      grid.forEach(Math.min(a.x, b.x, c.x), Math.max(a.x, b.x, c.x), Math.min(a.z, b.z, c.z), Math.max(a.z, b.z, c.z), (cell) => {
        if (Number.isNaN(grid.ground[cell]) || grid.ground[cell] < top) grid.ground[cell] = top;
      });
    });
  }

  // 2. Dolu hücreler: zeminin OBSTACLE_HEIGHT üstüne çıkan üçgenler (çatılar binanın içini kapatır), su yüzeyleri.
  const box = new THREE.Box3();
  const matrix = new THREE.Matrix4();
  for (const mesh of meshes) {
    if (GROUND.test(mesh.name) && !WATER.test(mesh.name)) continue;
    const water = WATER.test(mesh.name);
    const parked = PARKED.test(mesh.name);
    const mark = (x0: number, x1: number, z0: number, z1: number, top: number) =>
      grid.forEach(x0, x1, z0, z1, (cell) => {
        const ground = Number.isNaN(grid.ground[cell]) ? 1 : grid.ground[cell];
        if (water || parked || top > ground + OBSTACLE_HEIGHT) grid.blocked[cell] = 1;
      });
    if (mesh instanceof THREE.InstancedMesh) {
      // Örneklenmiş yapılar (bina parçaları, çatı ekipmanı): her örneğin sınır kutusu.
      if (!mesh.geometry.boundingBox) mesh.geometry.computeBoundingBox();
      const local = mesh.geometry.boundingBox;
      if (!local) continue;
      for (let i = 0; i < mesh.count; i++) {
        mesh.getMatrixAt(i, matrix);
        box.copy(local).applyMatrix4(matrix.premultiply(mesh.matrixWorld));
        mark(box.min.x, box.max.x, box.min.z, box.max.z, box.max.y);
      }
      continue;
    }
    forEachTriangle(mesh, (a, b, c) =>
      mark(Math.min(a.x, b.x, c.x), Math.max(a.x, b.x, c.x), Math.min(a.z, b.z, c.z), Math.max(a.z, b.z, c.z), Math.max(a.y, b.y, c.y)),
    );
  }
  return grid;
}

/** Kaldırım blokları: kaldırım mesh'indeki dörtgenler (her biri bir blok). */
function sidewalkBlocks(cityRoot: THREE.Object3D): Rect[] {
  const sidewalks = cityRoot.getObjectByName('Roads_Sidewalks');
  if (!(sidewalks instanceof THREE.Mesh)) return [];
  const blocks = new Map<string, Rect>();
  forEachTriangle(sidewalks, (a, b, c) => {
    const rect = {
      x0: Math.min(a.x, b.x, c.x),
      x1: Math.max(a.x, b.x, c.x),
      z0: Math.min(a.z, b.z, c.z),
      z1: Math.max(a.z, b.z, c.z),
    };
    if (rect.x1 - rect.x0 < 20 || rect.z1 - rect.z0 < 20) return;
    blocks.set(`${rect.x0.toFixed(0)},${rect.x1.toFixed(0)},${rect.z0.toFixed(0)},${rect.z1.toFixed(0)}`, rect);
  });
  return [...blocks.values()];
}

/** Basit insan: gövde (bacaklar ve gövde tek konik) ve baş. Taban y = 0, boy ~1.72 m. */
function personGeometry() {
  const body = new THREE.CylinderGeometry(0.21, 0.13, 1.45, 6, 1);
  body.translate(0, 0.725, 0);
  body.scale(1, 1, 0.62);
  const head = new THREE.SphereGeometry(0.125, 6, 4);
  head.translate(0, 1.6, 0);
  return { body, head };
}

// Hareket tamamen ekran kartında: her örneğin yolu öznitelikte, konum ve yön ortak saatten (uTime) hesaplanır. İşlemci
// her karede hiçbir şey yapmaz (binlerce kişiyi JS'te taşımak karede ~1.5 ms tutuyordu).
// aPath: döngüde (x0, z0, genişlik, derinlik), gidip gelmede (ax, az, bx, bz).
// aMotion: döngüde (başlangıç, işaretli hız, -, 0), gidip gelmede (faz, hız, bekleme, 1). aGround: zemin yüksekliği.
// Kıpırdamadan duranlar (içtimadaki askerler): aPath (x, z, ileri yön x, z), aMotion.w = 2.
const PEOPLE_VERTEX_HEADER = `
  attribute vec4 aPath;
  attribute vec4 aMotion;
  attribute float aGround;
  uniform float uTime;
  // Kişinin yerdeki konumu ve yüzünün döndüğü yön.
  void personPlace(out vec2 place, out vec2 forward) {
    if (aMotion.w > 1.5) {
      // Hazır olda duran: yeri ve baktığı yön sabit.
      place = aPath.xy;
      forward = aPath.zw;
    } else if (aMotion.w < 0.5) {
      // Blok çevresinde yürüyüş: dikdörtgen saat yönünde, hız işaretliyse ters yönde.
      float w = aPath.z;
      float d = aPath.w;
      float s = mod(aMotion.x + aMotion.y * uTime, 2.0 * (w + d));
      if (s < w) { place = vec2(aPath.x + s, aPath.y); forward = vec2(1.0, 0.0); }
      else if (s < w + d) { place = vec2(aPath.x + w, aPath.y + s - w); forward = vec2(0.0, 1.0); }
      else if (s < 2.0 * w + d) { place = vec2(aPath.x + w - (s - w - d), aPath.y + d); forward = vec2(-1.0, 0.0); }
      else { place = vec2(aPath.x, aPath.y + d - (s - 2.0 * w - d)); forward = vec2(0.0, -1.0); }
      if (aMotion.y < 0.0) forward = -forward;
    } else {
      // İki nokta arasında gidip gelme, iki uçta bekleyerek.
      vec2 a = aPath.xy;
      vec2 b = aPath.zw;
      float len = max(length(b - a), 0.001);
      vec2 dir = (b - a) / len;
      float travel = len / aMotion.y;
      float wait = aMotion.z;
      float t = mod(aMotion.x + uTime, 2.0 * (travel + wait));
      if (t < wait) { place = a; forward = dir; }
      else if (t < wait + travel) { place = mix(a, b, (t - wait) / travel); forward = dir; }
      else if (t < 2.0 * wait + travel) { place = b; forward = -dir; }
      else { place = mix(b, a, (t - 2.0 * wait - travel) / travel); forward = -dir; }
    }
  }
  // Yerel xz'yi yüzün döndüğü yöne çevirir (yerel +z ileri).
  vec3 personTurn(vec3 v, vec2 forward) {
    return vec3(v.x * forward.y + v.z * forward.x, v.y, -v.x * forward.x + v.z * forward.y);
  }
`;

const PEOPLE_VERTEX_NORMAL = `
  vec2 personPlaceXZ;
  vec2 personForward;
  personPlace(personPlaceXZ, personForward);
  vec3 objectNormal = personTurn(vec3(normal), personForward);
  #ifdef USE_TANGENT
    vec3 objectTangent = vec3(tangent.xyz);
  #endif
`;

const PEOPLE_VERTEX_POSITION = `
  vec3 transformed = personTurn(position * ${PEOPLE_SCALE.toFixed(2)}, personForward)
    + vec3(personPlaceXZ.x, aGround, personPlaceXZ.y);
`;

/** cityRuntime'daki ortak malzeme yaması bu köşe kodunu kendi yamasına ekler (`material.userData.vertexPatch`). */
export interface VertexPatch {
  key: string;
  header: string;
  normal: string;
  position: string;
}

/** Bölgedeki en büyük boş dikdörtgen (doluluk haritasında, histogram yöntemiyle). */
function largestFreeRect(grid: OccupancyGrid, zone: Rect): Rect | null {
  const columns = Math.floor((zone.x1 - zone.x0) / CELL);
  const rows = Math.floor((zone.z1 - zone.z0) / CELL);
  const heights = new Int32Array(columns);
  let best: Rect | null = null;
  let bestArea = 0;
  for (let r = 0; r < rows; r++) {
    const z = zone.z0 + (r + 0.5) * CELL;
    for (let c = 0; c < columns; c++) heights[c] = grid.free(zone.x0 + (c + 0.5) * CELL, z) ? heights[c] + 1 : 0;
    // Her sütun için o yükseklikte sola ve sağa ne kadar uzanılabildiği (yığınla).
    const stack: number[] = [];
    for (let c = 0; c <= columns; c++) {
      const h = c < columns ? heights[c] : 0;
      while (stack.length && heights[stack[stack.length - 1]] >= h) {
        const top = stack.pop() as number;
        const left = stack.length ? stack[stack.length - 1] + 1 : 0;
        const area = heights[top] * (c - left);
        if (area > bestArea) {
          bestArea = area;
          best = {
            x0: zone.x0 + left * CELL,
            x1: zone.x0 + c * CELL,
            z0: zone.z0 + (r + 1 - heights[top]) * CELL,
            z1: zone.z0 + (r + 1) * CELL,
          };
        }
      }
      stack.push(c);
    }
  }
  return best;
}

interface Placed {
  path: [number, number, number, number];
  motion: [number, number, number, number];
  ground: number;
  body?: string;
  head?: string;
}

/**
 * Askerî kampüste içtima: en büyük açık alana bölükler halinde nizam, önünde gidip gelen komutan. Alan doluluk haritasında
 * dolu işaretlenir, gezinenler nizamın içine girmez.
 */
function parade(grid: OccupancyGrid, zone: Rect): Placed[] {
  const field = largestFreeRect(grid, zone);
  if (!field) return [];
  const p = PARADE;
  // Nizam uzun kenar boyunca dizilir, askerler kısa kenar yönüne (önlerindeki komutan şeridine) bakar.
  const alongX = field.x1 - field.x0 >= field.z1 - field.z0;
  const length = (alongX ? field.x1 - field.x0 : field.z1 - field.z0) - p.margin * 2;
  const depth = (alongX ? field.z1 - field.z0 : field.x1 - field.x0) - p.margin * 2;
  const companyWidth = (p.columns - 1) * p.columnStep;
  const rows = Math.min(p.rows, Math.floor((depth - p.frontLane) / p.rowStep) + 1);
  const companies = Math.min(p.maxCompanies, Math.floor((length + p.companyGap) / (companyWidth + p.companyGap)));
  if (rows < 2 || companies < 1) return [];
  const span = companies * companyWidth + (companies - 1) * p.companyGap;
  const blockDepth = (rows - 1) * p.rowStep + p.frontLane;
  // Yerel eksenler: u nizam boyunca, v öne doğru (askerlerin baktığı yön). Nizam alanın ortasında.
  const centerX = (field.x0 + field.x1) / 2;
  const centerZ = (field.z0 + field.z1) / 2;
  const toWorld = (u: number, v: number): [number, number] => (alongX ? [centerX + u, centerZ + v] : [centerX + v, centerZ + u]);
  const forward: [number, number] = alongX ? [0, 1] : [1, 0];
  const placed: Placed[] = [];
  const backV = -blockDepth / 2;
  for (let company = 0; company < companies; company++) {
    const u0 = -span / 2 + company * (companyWidth + p.companyGap);
    for (let row = 0; row < rows; row++) {
      for (let column = 0; column < p.columns; column++) {
        const [x, z] = toWorld(u0 + column * p.columnStep, backV + row * p.rowStep);
        placed.push({ path: [x, z, forward[0], forward[1]], motion: [0, 0, 0, 2], ground: grid.groundAt(x, z), body: UNIFORM, head: HELMET });
      }
    }
  }
  // Komutan: nizamın önündeki şeridin ortasında, bir uçtan öbür uca ağır ağır yürür, uçlarda durur.
  const frontV = backV + (rows - 1) * p.rowStep + p.frontLane * 0.6;
  const [ax, az] = toWorld(-span / 2, frontV);
  const [bx, bz] = toWorld(span / 2, frontV);
  placed.push({ path: [ax, az, bx, bz], motion: [0, 0.9, 6, 1], ground: grid.groundAt(ax, az), body: OFFICER, head: HELMET });
  // Nizam alanı dolu sayılır: gezinenler içinden geçmez.
  const [fx0, fz0] = toWorld(-span / 2 - 2, backV - 2);
  const [fx1, fz1] = toWorld(span / 2 + 2, frontV + 2);
  grid.forEach(Math.min(fx0, fx1), Math.max(fx0, fx1), Math.min(fz0, fz1), Math.max(fz0, fz1), (cell) => {
    grid.blocked[cell] = 1;
  });
  return placed;
}

export function createPeople(cityRoot: THREE.Object3D) {
  // Hazırlık yeniden çalışırsa (StrictMode, kalite değişimi) kalabalık bir kez kurulur.
  if (cityRoot.getObjectByName('Runtime_People_Bodies')) return;

  cityRoot.updateMatrixWorld(true);
  const grid = buildGrid(cityRoot);
  const rand = random(20261113);
  const blocks = sidewalkBlocks(cityRoot);
  // İçtima önce kurulur. Sonra kampüsün tamamı gezinenlere kapatılır: çitin içinde sivil olmaz (kullanıcı isteği).
  // Kaldırımda yürüyenler çitin dışında kalır (blok kenarından en çok 3.4 m içeride, çit 6 m içeride).
  const military = FACILITY_RECTS.militaryCampus;
  const soldiers = parade(grid, military);
  grid.forEach(military.x0, military.x1, military.z0, military.z1, (cell) => {
    grid.blocked[cell] = 1;
  });
  // Örnek başına: yol (4), hareket (4), zemin (1).
  const paths: number[] = [];
  const motions: number[] = [];
  const grounds: number[] = [];

  // Kaldırımda yürüyenler: blok kenarından biraz içeride, iki yönde.
  for (const block of blocks) {
    const perimeter = 2 * (block.x1 - block.x0 + block.z1 - block.z0);
    const count = Math.round(perimeter / SIDEWALK_SPACING);
    for (let n = 0; n < count; n++) {
      const inset = SIDEWALK_INSET_MIN + rand() * (SIDEWALK_INSET_MAX - SIDEWALK_INSET_MIN);
      const w = block.x1 - block.x0 - inset * 2;
      const d = block.z1 - block.z0 - inset * 2;
      const direction = rand() < 0.5 ? -1 : 1;
      paths.push(block.x0 + inset, block.z0 + inset, w, d);
      motions.push(rand() * 2 * (w + d), direction * (1.1 + rand() * 0.6), 0, 0);
      grounds.push(grid.groundAt(block.x0 + inset, block.z0 + inset));
    }
  }

  // Boş alanlarda gezinenler: bloklar ve tesisler (daha kalabalık). Her biri yakındaki, düz yolu boş bir noktayla
  // arasında gidip gelir. Bir kısmı uzun duraklar (bekleyen, sohbet eden), yerinden pek ayrılmaz.
  const zones = [
    ...blocks.map((rect) => ({ rect, areaPerPerson: BLOCK_AREA_PER_PERSON })),
    ...Object.values(FACILITY_RECTS).map((rect) => ({ rect, areaPerPerson: FACILITY_AREA_PER_PERSON })),
  ];
  for (const { rect, areaPerPerson } of zones) {
    const free: number[] = [];
    for (let x = rect.x0 + CELL / 2; x < rect.x1; x += CELL) {
      for (let z = rect.z0 + CELL / 2; z < rect.z1; z += CELL) if (grid.free(x, z)) free.push(x, z);
    }
    const count = Math.round(((free.length / 2) * CELL * CELL) / areaPerPerson);
    for (let n = 0; n < count; n++) {
      const pick = Math.floor(rand() * (free.length / 2)) * 2;
      const ax = free[pick] + (rand() - 0.5) * CELL;
      const az = free[pick + 1] + (rand() - 0.5) * CELL;
      const idler = rand() < 0.35;
      let bx = ax + Math.cos(rand() * Math.PI * 2) * 0.01;
      let bz = az + Math.sin(rand() * Math.PI * 2) * 0.01;
      for (let attempt = 0; !idler && attempt < 8; attempt++) {
        const angle = rand() * Math.PI * 2;
        const reach = 6 + rand() * 26;
        const x = ax + Math.cos(angle) * reach;
        const z = az + Math.sin(angle) * reach;
        if (x < rect.x0 || x > rect.x1 || z < rect.z0 || z > rect.z1 || !grid.clear(ax, az, x, z)) continue;
        bx = x;
        bz = z;
        break;
      }
      const speed = 0.8 + rand() * 0.6;
      const wait = idler ? 8 + rand() * 25 : 1 + rand() * 5;
      const cycle = 2 * (Math.hypot(bx - ax, bz - az) / speed + wait);
      paths.push(ax, az, bx, bz);
      motions.push(rand() * cycle, speed, wait, 1);
      grounds.push(grid.groundAt(ax, az));
    }
  }

  // Seyreltme (düşük kalite) ilk örnekleri bırakır: askerler başta (nizam eksiksiz kalır), diğerlerinin sırası
  // karıştırılır ki yürüyenler de gezinenler de kalsın.
  const crowd = grounds.length;
  const order = Array.from({ length: crowd }, (_, i) => i);
  for (let i = crowd - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }
  const people: Placed[] = [
    ...soldiers,
    ...order.map((from) => ({
      path: paths.slice(from * 4, from * 4 + 4) as Placed['path'],
      motion: motions.slice(from * 4, from * 4 + 4) as Placed['motion'],
      ground: grounds[from],
    })),
  ];
  const total = people.length;
  const path = new Float32Array(total * 4);
  const motion = new Float32Array(total * 4);
  const ground = new Float32Array(total);
  people.forEach((person, slot) => {
    path.set(person.path, slot * 4);
    motion.set(person.motion, slot * 4);
    ground[slot] = person.ground;
  });
  const attributes = {
    aPath: new THREE.InstancedBufferAttribute(path, 4),
    aMotion: new THREE.InstancedBufferAttribute(motion, 4),
    aGround: new THREE.InstancedBufferAttribute(ground, 1),
  };

  const vertexPatch: VertexPatch = {
    key: 'people_v2',
    header: PEOPLE_VERTEX_HEADER,
    normal: PEOPLE_VERTEX_NORMAL,
    position: PEOPLE_VERTEX_POSITION,
  };
  const { body, head } = personGeometry();
  const color = new THREE.Color();
  const identity = new THREE.Matrix4();
  for (const [geometry, palette, name, part] of [
    [body, CLOTHES, 'Runtime_People_Bodies', 'body'],
    [head, SKIN, 'Runtime_People_Heads', 'head'],
  ] as const) {
    for (const [key, attribute] of Object.entries(attributes)) geometry.setAttribute(key, attribute);
    const material = new THREE.MeshStandardMaterial({ name: `People_${name}`, roughness: 0.85, metalness: 0 });
    material.userData.vertexPatch = vertexPatch;
    const mesh = new THREE.InstancedMesh(geometry, material, total);
    mesh.name = name;
    mesh.userData = { castShadow: false, thinnable: true };
    // Konum shader'da: örnek matrisi birim, sınır kutusu bilinmez.
    mesh.frustumCulled = false;
    for (let i = 0; i < total; i++) {
      mesh.setMatrixAt(i, identity);
      mesh.setColorAt(i, color.set(people[i][part] ?? palette[Math.floor(rand() * palette.length)]));
    }
    cityRoot.add(mesh);
  }
}
