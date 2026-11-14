// Geliştirmeye özel adres anahtarları. Varsayılan hal, imlecin diğer sayfalardaki kadar akıcı olduğu haldir (kullanıcı
// kararı, 2026-11-14): bloom yok, çözünürlük üst sınırı 1, yaya yok, hero'da imleç karışımsız. Anahtarlar kaldırılan
// parçaları karşılaştırma için geri açar, production'da hepsi kapalıdır. Birleştirilebilir: `?perf=1&fx=1`.
import * as THREE from 'three';

const params = import.meta.env.DEV ? new URLSearchParams(window.location.search) : null;
const flag = (name: string, value: string) => params?.get(name) === value;

export const CITY_DEBUG = {
  /** `?fx=1`: bloom ve renk düzeltme açık. */
  postFx: flag('fx', '1'),
  /** `?perf=1`: konsola kare ölçümü (CityPerfProbe). */
  perfProbe: flag('perf', '1'),
  /** `?dpr=1.25`: çözünürlük üst sınırı 1 yerine eski değer 1.25. */
  highDpr: flag('dpr', '1.25'),
  /** `?people=1`: yayalar kurulur. */
  people: flag('people', '1'),
  /** `?grounds=0`: tesis zeminleri (dünya konumundan çizilen peyzaj shader'ları) düz renk. */
  plainGrounds: flag('grounds', '0'),
};

/** Hazırlanmış şehre zemin anahtarını uygular (yalnızca geliştirmede bir şey yapar). */
export function applyCityDebug(cityRoot: THREE.Object3D) {
  if (!CITY_DEBUG.plainGrounds) return;
  const plain = new THREE.MeshStandardMaterial({ name: 'Debug_PlainGround', color: '#6f7a63', roughness: 0.95 });
  cityRoot.traverse((object) => {
    if (object instanceof THREE.Mesh && !Array.isArray(object.material) && object.material.name.endsWith('_Landscape')) {
      object.material = plain;
    }
  });
}
