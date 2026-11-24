import * as THREE from 'three';
import type { Device } from '../../hooks/useDevice';

/** Silindirin cihaza göre ayarları. Ölçüler oran cinsindendir, kamera her ekranda bunlara göre yerleşir. */
export interface CylinderLayout {
  /** Silindirin çevresindeki panel sayısı. Fotoğraf daha çoksa paneller döndükçe arkada yenilenir. */
  slots: number;
  /** Panelin en/boy oranı. Fotoğraflar panele kırpılır, tam hali tam ekran görünümdedir. */
  panelAspect: number;
  /** Öndeki panelin en fazla tuval genişliğine oranı. */
  frontWidth: number;
  /** Öndeki panelin üstünden arkadaki halkanın altına kadar en fazla tuval yüksekliğine oranı. */
  maxSpan: number;
  /**
   * Kameranın en küçük yukarı bakış açısı (derece). Kamera silindirin altındadır: öndeki panel üstte, arkadaki halka
   * altta görünür. Asıl açı her ekranda hesaplanır (fitCamera): arkadaki halkanın öndeki panellerin altında tamamen
   * görüneceği en küçük açı. Açı büyüdükçe silindirin burnu kalkar ve öndeki panel küçülür.
   */
  minPitch: number;
  /** Dikey görüş açısı (derece). Küçüldükçe perspektif yumuşar. */
  fov: number;
}

export const LAYOUTS: Record<Device, CylinderLayout> = {
  desktop: { slots: 22, panelAspect: 3 / 2, frontWidth: 0.38, maxSpan: 0.9, minPitch: 6, fov: 32 },
  tabletLandscape: { slots: 20, panelAspect: 3 / 2, frontWidth: 0.44, maxSpan: 0.9, minPitch: 6, fov: 32 },
  tabletPortrait: { slots: 18, panelAspect: 4 / 5, frontWidth: 0.52, maxSpan: 0.9, minPitch: 6, fov: 34 },
  mobile: { slots: 16, panelAspect: 4 / 5, frontWidth: 0.64, maxSpan: 0.92, minPitch: 6, fov: 36 },
};

export const RADIUS = 10;
// Panel, kendisine düşen yayın bu kadarını kaplar, kalanı paneller arasındaki boşluktur.
const PANEL_FILL = 0.88;
// Silindir tuvalde ortalanmaz, üste yaslanır: öndeki panelin üst kenarı bu NDC yüksekliğinde durur (1 = tuvalin üstü).
const TOP_EDGE = 0.97;
// Arkadaki halkanın üst kenarı ile öndeki panelin alt kenarı arasında, arka panel yüksekliğinin bu kadarı boşluk kalır.
const BACK_GAP = 0.12;
// Arkadaki halkayı göstermek için açı en fazla bu kadar (derece) büyür.
const MAX_PITCH = 40;

export interface PanelSize {
  /** Panelin yay uzunluğu (silindir yüzeyinde genişliği). */
  arc: number;
  height: number;
  /** İki panel arasındaki açı (radyan). */
  step: number;
  /** Panelin yarı açısal genişliği (radyan). */
  halfAngle: number;
}

export function getPanelSize(layout: CylinderLayout): PanelSize {
  const step = (Math.PI * 2) / layout.slots;
  const arc = RADIUS * step * PANEL_FILL;
  return { arc, height: arc / layout.panelAspect, step, halfAngle: arc / RADIUS / 2 };
}

const point = new THREE.Vector3();

/** Silindir yüzeyindeki bir noktanın NDC (-1..1) koordinatı. θ = 0 kameraya bakan öndür. */
function project(camera: THREE.PerspectiveCamera, theta: number, y: number) {
  point.set(Math.sin(theta) * RADIUS, y, Math.cos(theta) * RADIUS).project(camera);
  return point;
}

function placeCamera(camera: THREE.PerspectiveCamera, y: number, z: number, pitch: number) {
  camera.position.set(0, y, z);
  camera.rotation.set(pitch, 0, 0);
  camera.updateMatrixWorld();
  camera.matrixWorldInverse.copy(camera.matrixWorld).invert();
}

interface Measure {
  /** Öndeki panelin üst kenarı (NDC y). */
  top: number;
  frontWidth: number;
  span: number;
  /** Arkadaki halkanın öndeki panelin altında kalan boşluğu, arka panel yüksekliği cinsinden. Negatifse arkasına girer. */
  backClearance: number;
}

function measure(camera: THREE.PerspectiveCamera, panel: PanelSize): Measure {
  const half = panel.height / 2;
  const frontTop = project(camera, 0, half).y;
  const frontBottom = project(camera, 0, -half).y;
  const backTop = project(camera, Math.PI, half).y;
  const backBottom = project(camera, Math.PI, -half).y;
  const left = project(camera, -panel.halfAngle, 0).x;
  const right = project(camera, panel.halfAngle, 0).x;
  return {
    top: frontTop,
    frontWidth: (right - left) / 2,
    span: (frontTop - backBottom) / 2,
    backClearance: (frontBottom - backTop) / Math.max(backTop - backBottom, 1e-6),
  };
}

/**
 * Kamerayı, öndeki panel ayarlanan genişliği geçmeyecek ve arkadaki halka dahil bütün silindir tuvale sığacak
 * biçimde yerleştirir. Kamera ne kadar yakınsa perspektif o kadar güçlüdür, bu yüzden sığan en yakın konum seçilir.
 * Açı, arkadaki halka öndeki panellerin altında tamamen görünene kadar en küçük değerinden büyütülür.
 */
export function fitCamera(camera: THREE.PerspectiveCamera, layout: CylinderLayout, aspect: number) {
  const panel = getPanelSize(layout);
  camera.fov = layout.fov;
  camera.aspect = aspect;
  camera.near = 0.1;
  camera.far = RADIUS * 20;
  camera.updateProjectionMatrix();

  // Verilen uzaklıkta, silindiri tuvalin üstüne yaslayan yükseklik. Kamera yükseldikçe sahne ekranda aşağı iner.
  const placeAt = (z: number, pitch: number) => {
    let low = -RADIUS * 4;
    let high = RADIUS;
    for (let i = 0; i < 32; i += 1) {
      const y = (low + high) / 2;
      placeCamera(camera, y, z, pitch);
      if (measure(camera, panel).top > TOP_EDGE) low = y;
      else high = y;
    }
    return measure(camera, panel);
  };

  // Verilen açıda sığan en yakın konum.
  const fitAt = (pitch: number) => {
    let near = RADIUS * 1.15;
    let far = RADIUS * 14;
    for (let i = 0; i < 32; i += 1) {
      const z = (near + far) / 2;
      const { frontWidth, span } = placeAt(z, pitch);
      if (frontWidth > layout.frontWidth || span > layout.maxSpan) near = z;
      else far = z;
    }
    return placeAt(far, pitch);
  };

  let low = THREE.MathUtils.degToRad(layout.minPitch);
  if (fitAt(low).backClearance >= BACK_GAP) return;
  let high = THREE.MathUtils.degToRad(MAX_PITCH);
  for (let i = 0; i < 16; i += 1) {
    const pitch = (low + high) / 2;
    if (fitAt(pitch).backClearance >= BACK_GAP) high = pitch;
    else low = pitch;
  }
  fitAt(high);
}

export interface ScreenRect {
  left: number;
  top: number;
  width: number;
  height: number;
}

/** Panelin tuvaldeki dikdörtgeni (piksel). Panel kavisli olduğu için kenarlar ve orta birlikte ölçülür. */
export function getPanelRect(
  camera: THREE.PerspectiveCamera,
  panel: PanelSize,
  theta: number,
  canvasWidth: number,
  canvasHeight: number,
): ScreenRect {
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  for (const angle of [theta - panel.halfAngle, theta, theta + panel.halfAngle]) {
    for (const y of [-panel.height / 2, panel.height / 2]) {
      const { x, y: ndcY } = project(camera, angle, y);
      minX = Math.min(minX, x);
      maxX = Math.max(maxX, x);
      minY = Math.min(minY, ndcY);
      maxY = Math.max(maxY, ndcY);
    }
  }
  return {
    left: ((minX + 1) / 2) * canvasWidth,
    top: ((1 - maxY) / 2) * canvasHeight,
    width: ((maxX - minX) / 2) * canvasWidth,
    height: ((maxY - minY) / 2) * canvasHeight,
  };
}
