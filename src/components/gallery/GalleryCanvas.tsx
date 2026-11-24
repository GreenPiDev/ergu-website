import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { type RefObject, useEffect, useImperativeHandle, useMemo } from 'react';
import * as THREE from 'three';
import { type CarouselController, wrapIndex } from './carouselController';
import {
  type CylinderLayout,
  fitCamera,
  getPanelRect,
  getPanelSize,
  type PanelSize,
  RADIUS,
  type ScreenRect,
} from './cylinderLayout';
import type { GalleryImage } from './galleryApi';
import { GalleryTextures } from './galleryTextures';

/** Tuvalin DOM tarafına açtığı ölçümler: tıklama, imleç ve tam ekran görünümün çıkış noktası için. */
export interface GalleryCanvasHandle {
  /** Tuval içindeki noktanın altındaki panelin sonsuz dizideki sırası, panel yoksa null. */
  hitTest: (x: number, y: number) => number | null;
  /** Öndeki panelin tuval içindeki dikdörtgeni (piksel). */
  getActiveRect: () => ScreenRect | null;
}

export interface GalleryColors {
  /** Bölümün zemini: arkadaki paneller bu renge doğru solar. */
  background: string;
  /** Dokusu henüz inmemiş panelin rengi. */
  placeholder: string;
}

interface GalleryCanvasProps {
  className: string;
  images: readonly GalleryImage[];
  controller: CarouselController;
  layout: CylinderLayout;
  colors: GalleryColors;
  /** Bölüm veya sekme görünmüyorsa çizim durur. */
  active: boolean;
  reducedMotion: boolean;
  handleRef: RefObject<GalleryCanvasHandle | null>;
  /** Öndeki fotoğraflar inince (veya en geç birkaç saniye sonra) bir kez çağrılır. */
  onReady: () => void;
}

// Panel yatayda bu kadar parçaya bölünür, kavis bunlarla çizilir.
const PANEL_SEGMENTS = 32;
// Arkadaki paneller zemine doğru solar: en arkada rengin bu kadarı kalır.
const BACK_VISIBILITY = 0.42;
// Doku inince panel bu sürede (sn) belirir.
const REVEAL_TIME = 0.5;
// Silindir bu hızdan (fotoğraf/sn) hızlı dönerken yalnızca varış noktasının çevresindeki dokular istenir.
const FAST_SPEED = 6;
// Perde, öndeki fotoğraflar inmese de en geç bu kadar (sn) bekler.
const READY_TIMEOUT = 4;

const vertexShader = /* glsl */ `
  uniform float uTheta;
  uniform float uRadius;
  varying vec2 vUv;
  varying float vFacing;

  void main() {
    // Düz panel silindir yüzeyine sarılır: x yay uzunluğudur.
    float angle = uTheta + position.x / uRadius;
    vec3 curved = vec3(sin(angle) * uRadius, position.y, cos(angle) * uRadius);
    vUv = uv;
    vFacing = cos(angle);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(curved, 1.0);
  }
`;

const fragmentShader = /* glsl */ `
  uniform sampler2D uMap;
  uniform vec2 uCover;
  uniform float uReveal;
  uniform vec3 uBackground;
  uniform vec3 uPlaceholder;
  uniform float uBackVisibility;
  varying vec2 vUv;
  varying float vFacing;

  void main() {
    vec2 uv = vUv;
    // Arkadaki panellerin içi görünür: fotoğraf ayna görüntüsü olmasın diye çevrilir.
    if (!gl_FrontFacing) uv.x = 1.0 - uv.x;
    // object-fit: cover
    uv = (uv - 0.5) * uCover + 0.5;
    vec3 color = mix(uPlaceholder, texture2D(uMap, uv).rgb, uReveal);
    float front = smoothstep(-1.0, 1.0, vFacing);
    color = mix(uBackground, color, mix(uBackVisibility, 1.0, front));
    gl_FragColor = vec4(color, 1.0);
    #include <colorspace_fragment>
  }
`;

interface Slot {
  material: THREE.ShaderMaterial;
  imageIndex: number;
  texture: THREE.Texture | null;
  reveal: number;
}

const emptyTexture = new THREE.DataTexture(new Uint8Array([0, 0, 0, 255]), 1, 1);
emptyTexture.needsUpdate = true;

/** Silindirin panelleri. Panel sayısı sabittir; döndükçe arkaya geçen panel sıradaki fotoğrafı alır. */
class CylinderScene {
  readonly group = new THREE.Group();
  private readonly geometry: THREE.PlaneGeometry;
  private readonly slots: Slot[];
  private readonly textures: GalleryTextures;
  private readonly images: readonly GalleryImage[];
  private readonly layout: CylinderLayout;
  private readonly panel: PanelSize;
  private previousPosition = 0;
  private elapsed = 0;
  private readySent = false;

  constructor(images: readonly GalleryImage[], layout: CylinderLayout, colors: GalleryColors, anisotropy: number) {
    this.images = images;
    this.layout = layout;
    this.panel = getPanelSize(layout);
    this.textures = new GalleryTextures(images, anisotropy);
    this.geometry = new THREE.PlaneGeometry(this.panel.arc, this.panel.height, PANEL_SEGMENTS, 1);
    this.slots = Array.from({ length: layout.slots }, () => {
      const material = new THREE.ShaderMaterial({
        vertexShader,
        fragmentShader,
        side: THREE.DoubleSide,
        uniforms: {
          uTheta: { value: 0 },
          uRadius: { value: RADIUS },
          uMap: { value: emptyTexture },
          uCover: { value: new THREE.Vector2(1, 1) },
          uReveal: { value: 0 },
          uBackground: { value: new THREE.Color(colors.background) },
          uPlaceholder: { value: new THREE.Color(colors.placeholder) },
          uBackVisibility: { value: BACK_VISIBILITY },
        },
      });
      const mesh = new THREE.Mesh(this.geometry, material);
      // Köşeler shader'da yer değiştirdiği için three.js'in kutu hesabı geçersizdir.
      mesh.frustumCulled = false;
      this.group.add(mesh);
      return { material, imageIndex: -1, texture: null, reveal: 0 };
    });
  }

  /** Bir kare: panelleri konumlar, gereken dokuları ister. Öndeki fotoğraflar inince true döner (bir kez). */
  update(delta: number, controller: CarouselController, reducedMotion: boolean): boolean {
    const { slots, layout, panel, textures, images } = this;
    const count = images.length;
    const position = controller.position;
    const speed = Math.abs(position - this.previousPosition) / Math.max(delta, 1e-3);
    this.previousPosition = position;
    const target = controller.target;

    const half = Math.floor(layout.slots / 2);
    const base = Math.round(position);
    for (let offset = -half; offset < layout.slots - half; offset += 1) {
      const raw = base + offset;
      const slot = slots[wrapIndex(raw, layout.slots)];
      const index = wrapIndex(raw, count);
      const uniforms = slot.material.uniforms;
      uniforms.uTheta.value = (raw - position) * panel.step;

      if (slot.imageIndex !== index) {
        slot.imageIndex = index;
        slot.texture = null;
        slot.reveal = 0;
      }

      // Hızlı dönerken önünden geçilen her fotoğraf indirilmez, yalnızca varılacak yerin çevresi.
      if (speed < FAST_SPEED || Math.abs(raw - target) <= 2) textures.request(index);

      const texture = textures.get(index);
      if (texture !== slot.texture) {
        slot.texture = texture;
        slot.reveal = 0;
        uniforms.uMap.value = texture ?? emptyTexture;
        if (texture) {
          const imageAspect = images[index].width / images[index].height;
          const cover = uniforms.uCover.value as THREE.Vector2;
          if (imageAspect > layout.panelAspect) cover.set(layout.panelAspect / imageAspect, 1);
          else cover.set(1, imageAspect / layout.panelAspect);
        }
      }
      if (slot.texture) slot.reveal = reducedMotion ? 1 : Math.min(1, slot.reveal + delta / REVEAL_TIME);
      uniforms.uReveal.value = slot.reveal;
    }

    const activeIndex = wrapIndex(controller.activeRawIndex, count);
    textures.evict(activeIndex);

    if (this.readySent) return false;
    this.elapsed += delta;
    const frontSettled = [-1, 0, 1].every((step) => textures.isSettled(wrapIndex(activeIndex + step, count)));
    if (!frontSettled && this.elapsed < READY_TIMEOUT) return false;
    this.readySent = true;
    return true;
  }

  dispose() {
    this.textures.dispose();
    this.slots.forEach((slot) => slot.material.dispose());
    this.geometry.dispose();
  }
}

type CylinderProps = Omit<GalleryCanvasProps, 'className' | 'active'>;

function Cylinder({ images, controller, layout, colors, reducedMotion, handleRef, onReady }: CylinderProps) {
  const { gl, camera, size } = useThree();
  const perspective = camera as THREE.PerspectiveCamera;
  const panel = useMemo(() => getPanelSize(layout), [layout]);

  const scene = useMemo(
    () => new CylinderScene(images, layout, colors, Math.min(8, gl.capabilities.getMaxAnisotropy())),
    [images, layout, colors, gl],
  );
  useEffect(() => () => scene.dispose(), [scene]);

  useEffect(() => {
    fitCamera(perspective, layout, size.width / size.height);
  }, [perspective, layout, size.width, size.height]);

  useImperativeHandle(
    handleRef,
    () => ({
      hitTest: (x, y) => {
        const position = controller.position;
        const base = Math.round(position);
        // Öndekinden başlayarak bakılır: öndeki panel arkadakini örter.
        for (const offset of [0, -1, 1, -2, 2, -3, 3]) {
          const raw = base + offset;
          const theta = (raw - position) * panel.step;
          if (Math.cos(theta) < 0.2) continue;
          const rect = getPanelRect(perspective, panel, theta, size.width, size.height);
          if (x >= rect.left && x <= rect.left + rect.width && y >= rect.top && y <= rect.top + rect.height) return raw;
        }
        return null;
      },
      getActiveRect: () => {
        const theta = (controller.activeRawIndex - controller.position) * panel.step;
        return getPanelRect(perspective, panel, theta, size.width, size.height);
      },
    }),
    [controller, panel, perspective, size.width, size.height],
  );

  useFrame((_, delta) => {
    const step = Math.min(delta, 0.1);
    controller.update(step);
    if (scene.update(step, controller, reducedMotion)) onReady();
  });

  return <primitive object={scene.group} />;
}

/**
 * Fotoğrafların sarıldığı silindir. three.js ana pakete girmez, bu dosya ayrı parça olarak iner.
 * Sürükleme, tekerlek ve tıklama DOM tarafında yapılır (GalleryCarousel), three.js olaylarıyla değil.
 */
export default function GalleryCanvas({ className, active, ...props }: GalleryCanvasProps) {
  return (
    <Canvas
      className={className}
      frameloop={active ? 'always' : 'never'}
      dpr={[1, 2]}
      flat
      gl={{ antialias: true, alpha: true, powerPreference: 'high-performance' }}
      camera={{ fov: props.layout.fov, near: 0.1, far: RADIUS * 20, position: [0, 0, RADIUS * 2] }}
    >
      <Cylinder {...props} />
    </Canvas>
  );
}
