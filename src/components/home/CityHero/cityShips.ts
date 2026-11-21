// Denizdeki gemiler. Modelde 6 gemi kıyıya paralel, hafif farklı açılarla duruyordu. Açılışta kendi mesh'lerine taşınır,
// her biri kendi şeridinde (modeldeki z) doğu ya da batı yönünde seyreder ve dalgada hafifçe yalpalar. Şeridin uçlarında
// (şehirden kilometrelerce uzakta) küçülerek kaybolur, karşı uçtan büyüyerek gelir. Konum ve yön her karede su shader'ına
// (uShips) verilir: kıçtan açılan köpük izi, V biçimli dalga kolları ve pruva köpüğü orada çizilir.
import * as THREE from 'three';

// Şeridin uçları (x, metre) ve uçlarda küçülme mesafesi.
const LANE_HALF = 6500;
const FADE = 400;
// Seyir hızları (m/s, maket ölçeğinde) ve yönler: model burnu yerel +x'te.
const SPEEDS = [7, 9, 6, 8, 7.5, 6.5];
const MESH_NAME = 'Infrastructure_Ships_Moving';
// Yalpa: yatış ve baş-kıç vurma (radyan), dalgalanma (metre), dönemler gemiye göre biraz farklı.
const ROLL = 0.012;
const PITCH = 0.006;
const HEAVE = 0.3;

/** Su shader'ının okuduğu gemi listesi: x, z, yön (+1 doğu, -1 batı), iz şiddeti (0 durgun veya kaybolmuş). */
export const SHIP_COUNT = 6;
// Gövde yarı boyu ve yarı genişliği (metre, modeldeki ölçekle): iz kıçtan, köpük gövde kenarından başlar.
export const SHIP_HALF_LENGTH = 83.5;
export const SHIP_HALF_BEAM = 12;
export const shipWakes = Array.from({ length: SHIP_COUNT }, () => new THREE.Vector4(0, 0, 1, 0));

export interface Ships {
  update: (dt: number) => void;
}

/**
 * Gemileri hareketli mesh'e taşır. Gemiler ilk `update(dt > 0)` gelene kadar modeldeki yerinde, izsiz durur (hareket
 * azaltılmışsa öyle kalır). Hazırlık ikinci kez çalışırsa kurulan mesh yeniden kullanılır.
 */
export function createShips(cityRoot: THREE.Object3D): Ships | null {
  const stored = cityRoot.userData.ships as { mesh: THREE.InstancedMesh; initial: THREE.Matrix4[] } | undefined;
  let setup = stored;
  if (!setup) {
    const source = cityRoot.getObjectByName('Infrastructure_Ships');
    if (!(source instanceof THREE.InstancedMesh) || !source.parent) return null;
    const initial: THREE.Matrix4[] = [];
    const matrix = new THREE.Matrix4();
    for (let i = 0; i < Math.min(source.count, SHIP_COUNT); i++) {
      source.getMatrixAt(i, matrix);
      initial.push(matrix.clone());
    }
    const mesh = new THREE.InstancedMesh(source.geometry, source.material, initial.length);
    mesh.name = MESH_NAME;
    // Gölge haritası durağan, hareket eden gemiler gölge düşürmez. Şerit boyunca gezer: sınır küresi tutulmaz.
    mesh.userData = { ...source.userData, castShadow: false };
    mesh.frustumCulled = false;
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    mesh.matrix.copy(source.matrix);
    mesh.matrix.decompose(mesh.position, mesh.quaternion, mesh.scale);
    source.parent.add(mesh);
    source.removeFromParent();
    setup = { mesh, initial };
    cityRoot.userData.ships = setup;
  }

  const { mesh, initial } = setup;
  initial.forEach((item, index) => mesh.setMatrixAt(index, item));
  mesh.instanceMatrix.needsUpdate = true;
  for (const wake of shipWakes) wake.w = 0;

  mesh.updateMatrixWorld(true);
  const toLocal = mesh.matrixWorld.clone().invert();
  // Modeldeki konum (dünya), ölçek ve yön: şeritte batıdan doğuya sırayla bir doğu, bir batı.
  const ships = initial.map((item, index) => {
    const world = item.clone().premultiply(mesh.matrixWorld);
    const position = new THREE.Vector3().setFromMatrixPosition(world);
    const scale = new THREE.Vector3().setFromMatrixScale(world);
    return { x0: position.x, y: position.y, z: position.z, scale, dir: index % 2 === 0 ? 1 : -1, speed: SPEEDS[index % SPEEDS.length] };
  });
  const position = new THREE.Vector3();
  const quaternion = new THREE.Quaternion();
  const euler = new THREE.Euler(0, 0, 0, 'YZX');
  const scale = new THREE.Vector3();
  const matrix = new THREE.Matrix4();
  let time = 0;

  return {
    update(dt) {
      if (dt <= 0) return;
      time += dt;
      ships.forEach((ship, index) => {
        const span = 2 * LANE_HALF;
        const travelled = ship.x0 + LANE_HALF + ship.dir * ship.speed * time;
        const x = travelled - Math.floor(travelled / span) * span - LANE_HALF;
        const fade = THREE.MathUtils.clamp(Math.min(x + LANE_HALF, LANE_HALF - x) / FADE, 0, 1);
        const phase = time * (0.7 + 0.08 * index) + index * 1.7;
        position.set(x, ship.y + Math.sin(phase * 0.9) * HEAVE, ship.z);
        euler.set(Math.sin(phase) * ROLL, ship.dir > 0 ? 0 : Math.PI, Math.sin(phase * 0.6 + 1) * PITCH);
        quaternion.setFromEuler(euler);
        scale.copy(ship.scale).multiplyScalar(Math.max(fade, 1e-3));
        mesh.setMatrixAt(index, matrix.compose(position, quaternion, scale).premultiply(toLocal));
        shipWakes[index].set(x, ship.z, ship.dir, fade);
      });
      mesh.instanceMatrix.needsUpdate = true;
    },
  };
}
