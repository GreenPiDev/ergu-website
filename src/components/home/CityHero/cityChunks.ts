// Şehre yayılmış büyük örnekli mesh'ler (orman, ağaçlar, yayalar, lambalar, park etmiş araçlar) ızgara hücrelerine
// bölünür. Tek parça mesh'in sınır küresi bütün şehri kaplar, kadraj dışındaki örnekleri de her karede çizilir. Hücre
// başına ayrı mesh'te three.js kadraj dışındaki hücreleri hem normal çizimde hem gölge çiziminde atlar. Görüntü aynıdır:
// aynı geometri, malzeme, örnek matrisleri ve renkleri.
import * as THREE from 'three';

/** Hücre kenarı (m): hero kadrajında üçgenin ~%40'ı düşer, çizim çağrısı az artar (Node ölçümü). */
const CELL = 1000;
/** Bundan az üçgenli mesh bölünmez: kazanç ek çizim çağrısını karşılamaz. */
const MIN_TRIANGLES = 20000;
/** Yaya sınırı: kişinin yarı genişliği ve boyu (m, ölçekli gövdeden geniş tutulur). */
const PERSON_REACH = 2;
const PERSON_HEIGHT = 4;

export interface ChunkUserData {
  /** Seyreltilebilir mesh'te parçadaki örneklerin kaynak sırası (artan) ve kaynak örnek sayısı. */
  thinRanks?: Uint32Array;
  thinTotal?: number;
}

/** Seyreltmede kaynağın ilk `keep` örneğinden bu parçaya düşen sayı (sıra korunduğu için parçanın başı). */
export function chunkThinCount(data: ChunkUserData, thin: number) {
  const { thinRanks, thinTotal } = data;
  if (!thinRanks || thinTotal === undefined) return null;
  const keep = Math.floor(thinTotal * thin);
  let count = 0;
  while (count < thinRanks.length && thinRanks[count] < keep) count++;
  return count;
}

const triangleCount = (geometry: THREE.BufferGeometry) =>
  (geometry.index ? geometry.index.count : geometry.getAttribute('position').count) / 3;

const isZero = (array: ArrayLike<number>, offset: number) =>
  array[offset] === 0 && array[offset + 5] === 0 && array[offset + 10] === 0;

/** Yaya yolunun (cityPeople.ts, aPath/aMotion) mesh uzayındaki sınırı: döngü dikdörtgeni, gidip gelme ucu, duruş noktası. */
function personBounds(path: THREE.BufferAttribute, motion: THREE.BufferAttribute, ground: THREE.BufferAttribute, i: number, box: THREE.Box3) {
  const x = path.getX(i);
  const z = path.getY(i);
  const kind = motion.getW(i);
  let x1 = x;
  let z1 = z;
  if (kind < 0.5) {
    x1 = x + path.getZ(i);
    z1 = z + path.getW(i);
  } else if (kind < 1.5) {
    x1 = path.getZ(i);
    z1 = path.getW(i);
  }
  const y = ground.getX(i);
  box.min.set(Math.min(x, x1) - PERSON_REACH, y - 0.5, Math.min(z, z1) - PERSON_REACH);
  box.max.set(Math.max(x, x1) + PERSON_REACH, y + PERSON_HEIGHT, Math.max(z, z1) + PERSON_REACH);
  return box;
}

interface Cell {
  indices: number[];
  /** Yalnızca yayalarda: hareket yolunu kapsayan kutu (örnek matrisi birim, konum shader'da). */
  box: THREE.Box3 | null;
}

function split(mesh: THREE.InstancedMesh) {
  const geometry = mesh.geometry;
  const path = geometry.getAttribute('aPath');
  const motion = geometry.getAttribute('aMotion');
  const ground = geometry.getAttribute('aGround');
  const people =
    path instanceof THREE.InstancedBufferAttribute &&
    motion instanceof THREE.InstancedBufferAttribute &&
    ground instanceof THREE.InstancedBufferAttribute;
  const thinnable = mesh.userData.thinnable === true;
  const matrices = mesh.instanceMatrix.array;
  const matrix = new THREE.Matrix4();
  const center = new THREE.Vector3();
  const box = new THREE.Box3();
  const cells = new Map<string, Cell>();
  let dropped = 0;

  for (let i = 0; i < mesh.count; i++) {
    if (people) {
      personBounds(path, motion, ground, i, box).getCenter(center).applyMatrix4(mesh.matrixWorld);
    } else {
      // Gizlenen örnekler (ölçeği sıfır: yeniden ağaçlanan alanlar) parçaya alınmaz, köşe işi de kalkar. Seyreltmede
      // kaynak sırası ayrıca saklandığı için (thinRanks) seyreltilen mesh'te de atılabilir.
      if (isZero(matrices, i * 16)) {
        dropped++;
        continue;
      }
      center.setFromMatrixPosition(matrix.fromArray(matrices, i * 16)).applyMatrix4(mesh.matrixWorld);
    }
    const key = `${Math.floor(center.x / CELL)},${Math.floor(center.z / CELL)}`;
    let cell = cells.get(key);
    if (!cell) {
      cell = { indices: [], box: people ? new THREE.Box3() : null };
      cells.set(key, cell);
    }
    cell.indices.push(i);
    if (people) cell.box?.union(personBounds(path, motion, ground, i, box));
  }
  if (cells.size <= 1 && dropped === 0) return null;

  // Yayaların yol öznitelikleri parçaya göre kesilir, diğer öznitelikler (köşe, normal, indeks) paylaşılır. Örnek
  // özniteliği olmayan geometri olduğu gibi paylaşılır (başka mesh'ler de kullanıyor olabilir, örn. yeniden dikilen ağaçlar).
  const instanced = Object.entries(geometry.attributes).filter(
    (entry): entry is [string, THREE.InstancedBufferAttribute] => entry[1] instanceof THREE.InstancedBufferAttribute,
  );
  return [...cells.values()].map(({ indices, box: bounds }) => {
    let chunkGeometry = geometry;
    if (instanced.length > 0) {
      chunkGeometry = new THREE.BufferGeometry();
      chunkGeometry.setIndex(geometry.index);
      for (const [name, attribute] of Object.entries(geometry.attributes)) {
        if (!(attribute instanceof THREE.InstancedBufferAttribute)) chunkGeometry.setAttribute(name, attribute);
      }
      for (const [name, attribute] of instanced) {
        const size = attribute.itemSize;
        const source = attribute.array;
        const array = new Float32Array(indices.length * size);
        indices.forEach((from, to) => {
          for (let k = 0; k < size; k++) array[to * size + k] = source[from * size + k];
        });
        chunkGeometry.setAttribute(name, new THREE.InstancedBufferAttribute(array, size, attribute.normalized, attribute.meshPerAttribute));
      }
      for (const group of geometry.groups) chunkGeometry.addGroup(group.start, group.count, group.materialIndex);
      chunkGeometry.boundingSphere = geometry.boundingSphere?.clone() ?? null;
      chunkGeometry.boundingBox = geometry.boundingBox?.clone() ?? null;
    }

    const chunk = new THREE.InstancedMesh(chunkGeometry, mesh.material, indices.length);
    chunk.name = mesh.name;
    chunk.userData = { ...mesh.userData };
    chunk.position.copy(mesh.position);
    chunk.quaternion.copy(mesh.quaternion);
    chunk.scale.copy(mesh.scale);
    chunk.matrixAutoUpdate = mesh.matrixAutoUpdate;
    chunk.matrix.copy(mesh.matrix);
    chunk.castShadow = mesh.castShadow;
    chunk.receiveShadow = mesh.receiveShadow;
    chunk.renderOrder = mesh.renderOrder;
    chunk.layers.mask = mesh.layers.mask;
    const target = chunk.instanceMatrix.array;
    const colors = mesh.instanceColor;
    if (colors) chunk.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(indices.length * 3), 3);
    indices.forEach((from, to) => {
      for (let k = 0; k < 16; k++) target[to * 16 + k] = matrices[from * 16 + k];
      if (colors && chunk.instanceColor) {
        for (let k = 0; k < 3; k++) chunk.instanceColor.array[to * 3 + k] = colors.array[from * 3 + k];
      }
    });
    if (bounds) {
      // Yayalar shader'da yürür, örnek matrisi birimdir: sınır yolların kutusundan verilir, kadraj ayıklaması açılır.
      chunk.boundingSphere = bounds.getBoundingSphere(new THREE.Sphere());
      chunk.boundingBox = bounds.clone();
    }
    chunk.frustumCulled = true;
    if (thinnable) {
      const data = chunk.userData as ChunkUserData & { baseCount?: number };
      delete data.baseCount;
      data.thinRanks = Uint32Array.from(indices);
      data.thinTotal = mesh.count;
    }
    return chunk;
  });
}

/**
 * Büyük örnekli mesh'leri hücrelere böler. Bütün yerleşim, dikim, seyreltme kaynakları ve ışık noktaları kurulduktan
 * sonra, bir kez çalışır (StrictMode'daki ikinci hazırlık parçaları yeniden bölmez). `skip`: her karede matrisi
 * değişen mesh'ler (trafik, gondollar) bölünmez.
 */
export function chunkInstances(cityRoot: THREE.Object3D, skip: (mesh: THREE.InstancedMesh) => boolean) {
  if (cityRoot.userData.chunked) return;
  cityRoot.userData.chunked = true;
  cityRoot.updateMatrixWorld(true);
  const candidates: THREE.InstancedMesh[] = [];
  cityRoot.traverse((object) => {
    if (!(object instanceof THREE.InstancedMesh) || !object.visible || skip(object)) return;
    if (object.count * triangleCount(object.geometry) < MIN_TRIANGLES) return;
    candidates.push(object);
  });
  for (const mesh of candidates) {
    const parent = mesh.parent;
    const chunks = parent ? split(mesh) : null;
    if (!parent || !chunks) continue;
    // Kaynak hiç çizilmedi (ekran kartında tamponu yok), geometri ve malzemesi parçalarda yaşar: dispose edilmez.
    parent.remove(mesh);
    parent.add(...chunks);
  }
}
