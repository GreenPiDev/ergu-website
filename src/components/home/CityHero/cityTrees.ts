// Peyzajı yeniden düzenlenen alanlarda (park, kreş, sera, kültür merkezi) ağaçlar plana göre yeniden dikilir: alandaki
// rastgele ağaçlar gizlenir (ölçekleri sıfırlanır), yeni ağaçlar aynı ağaç geometrisi ve malzemesiyle örneklenir.
import * as THREE from 'three';

export const hash2 = (a: number, b: number) => {
  const value = Math.sin(a * 12.9898 + b * 78.233) * 43758.5453;
  return value - Math.floor(value);
};

/** Ağaç konumu (dünya x, z) ve isteğe bağlı boy çarpanı (meyve bahçesi gibi küçük ağaçlar için). */
export type TreeSpot = [number, number, number?];

interface Replant {
  /** Yeni ağaç mesh'lerinin adı `${prefix}_${kaynak}` olur (Park_Greens_Trees gibi). */
  prefix: string;
  /** Bu alandaki eski ağaçlar gizlenir. */
  inside: (x: number, z: number) => boolean;
  spots: TreeSpot[];
  treeScale: number;
}

export function replantTrees(cityRoot: THREE.Object3D, { prefix, inside, spots, treeScale }: Replant) {
  const matrix = new THREE.Matrix4();
  const position = new THREE.Vector3();
  const quaternion = new THREE.Quaternion();
  const scale = new THREE.Vector3();
  const zero = new THREE.Matrix4().makeScale(0, 0, 0);
  // Örnek matrisleri mesh'in yerel uzayındadır, plan dünya koordinatındadır (cityRoot.updateMatrixWorld önceden çağrılır).
  // Örnek ağaç (boy ve taban yüksekliği) şehrin herhangi bir ağacından alınır: alanda hiç ağaç olmasa da dikim yapılır.
  const sources: { mesh: THREE.InstancedMesh; sample: THREE.Matrix4 | null }[] = [];
  for (const name of ['Greens_Trees', 'Greens_Trees_Olive']) {
    const mesh = cityRoot.getObjectByName(name);
    if (!(mesh instanceof THREE.InstancedMesh)) continue;
    let sample: THREE.Matrix4 | null = null;
    for (let i = 0; i < mesh.count; i++) {
      mesh.getMatrixAt(i, matrix);
      position.setFromMatrixPosition(matrix).applyMatrix4(mesh.matrixWorld);
      if (!inside(position.x, position.z)) continue;
      sample ??= matrix.clone();
      mesh.setMatrixAt(i, zero);
    }
    // Alanda ağaç yoksa şehrin ilk ağacı örnek olur (crownRadius da onu ölçer). Önceki bir tesis onu gizlediyse (ölçek
    // sıfır) örnek aşağıda öbür kaynaktan alınır: gizli bir örnek bütün yeni ağaçları görünmez yapardı.
    if (!sample && mesh.count > 0) {
      mesh.getMatrixAt(0, matrix);
      if (matrix.determinant() !== 0) sample = matrix.clone();
    }
    mesh.instanceMatrix.needsUpdate = true;
    sources.push({ mesh, sample });
  }
  const fallback = sources.find((source) => source.sample)?.sample ?? null;
  for (const source of sources) source.sample ??= fallback;

  sources.forEach(({ mesh, sample }, sourceIndex) => {
    if (!sample) return;
    sample.decompose(position, quaternion, scale);
    const baseY = position.y;
    const toLocal = mesh.matrixWorld.clone().invert();
    const local = new THREE.Vector3();
    const mine = spots.filter((_, index) => index % sources.length === sourceIndex);
    const trees = new THREE.InstancedMesh(mesh.geometry, mesh.material, mine.length);
    trees.name = `${prefix}_${mesh.name}`;
    trees.userData = { castShadow: mesh.userData.castShadow };
    trees.position.copy(mesh.position);
    trees.quaternion.copy(mesh.quaternion);
    trees.scale.copy(mesh.scale);
    mine.forEach(([x, z, factor = 1], index) => {
      const size = treeScale * factor * (0.75 + 0.55 * hash2(x, z));
      local.set(x, 0, z).applyMatrix4(toLocal);
      local.y = baseY;
      quaternion.setFromAxisAngle(new THREE.Vector3(0, 1, 0), hash2(z, x) * Math.PI * 2);
      trees.setMatrixAt(index, matrix.compose(local, quaternion, scale.clone().multiplyScalar(size)));
    });
    trees.instanceMatrix.needsUpdate = true;
    (mesh.parent ?? cityRoot).add(trees);
  });
}

/** Boy çarpanı 1 olan ağacın tepe yarıçapı (replantTrees'te 0.75-1.3 ile çarpılır): şehrin ağaç geometrisi ve örnek ölçeği. */
export function crownRadius(cityRoot: THREE.Object3D, treeScale: number) {
  let radius = 0;
  for (const name of ['Greens_Trees', 'Greens_Trees_Olive']) {
    const mesh = cityRoot.getObjectByName(name);
    if (!(mesh instanceof THREE.InstancedMesh) || mesh.count === 0) continue;
    // Örnekler y ekseninde rastgele döner: tepe yarıçapı köşelerin eksene en büyük yatay uzaklığıdır.
    const position = mesh.geometry.getAttribute('position');
    let reach = 0;
    for (let i = 0; i < position.count; i++) reach = Math.max(reach, Math.hypot(position.getX(i), position.getZ(i)));
    const matrix = new THREE.Matrix4();
    mesh.getMatrixAt(0, matrix);
    const scale = new THREE.Vector3().setFromMatrixScale(matrix.premultiply(mesh.matrixWorld));
    radius = Math.max(radius, reach * scale.x * treeScale);
  }
  return radius || 6.5;
}
