import { Canvas, useFrame, useLoader, useThree } from '@react-three/fiber';
import { Suspense, useCallback, useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import config from '../../../content/city-config.json';
import { type FacilityId, facilityColorToken } from '../../../content/facilities';
import {
  type Atmosphere,
  type CityConfig,
  type Quality,
  CameraDirector,
  bakeHeightField,
  createAtmosphere,
  prepareCity,
} from './cityRuntime';
import { CityPostFx } from './cityPostFx';
import { FacilityHighlight } from './cityHighlight';
import { setCursorInteractive } from '../../ui/CustomCursor/cursorEvents';
import { FACILITY_RECTS, facilityPickBoxes, pickFacility } from './cityLayout';

const CITY_CONFIG: CityConfig = config;
const HERO_POSITION = new THREE.Vector3().fromArray(CITY_CONFIG.hero.position);
const MODEL_URL = '/models/smart_city.glb';
// 0 başlangıç görünümü (cityRuntime içindeki BASE_LOOK: alacakaranlık), 1 mavi saat.
const TIME_OF_DAY = 0;
// Geliştirmede `?fx=0` post-process'i kapatır (kare süresini karşılaştırmak için).
const FX_DISABLED = import.meta.env.DEV && new URLSearchParams(window.location.search).get('fx') === '0';

/** Bloom ve renk düzeltme. Öncelikli useFrame çizimi R3F'ten devralır: sahneyi çizer, sonra efektleri uygular. */
function PostFx({ quality }: { quality: Quality }) {
  const { gl, scene, camera, size, viewport } = useThree();
  const fx = useMemo(() => new CityPostFx(gl, { bloom: quality === 'high' ? 1.3 : 1.1 }), [gl, quality]);
  useEffect(() => () => fx.dispose(), [fx]);
  useEffect(() => {
    const buffer = gl.getDrawingBufferSize(new THREE.Vector2());
    fx.setSize(buffer.x, buffer.y);
  }, [fx, gl, size, viewport.dpr]);
  useFrame(() => fx.render(scene, camera), 1);
  return null;
}

interface CitySceneProps {
  quality: Quality;
  reducedMotion: boolean;
  onReady: () => void;
  /** Işık perdesiyle sınırları gösterilen tesisler (seçili ve fareyle üstünde durulan). */
  facilities: readonly FacilityId[];
  /** Fare şehirde bir tesisin üstüne gelince tesis, ayrılınca null (yalnızca fare). */
  onHoverFacility: (facility: FacilityId | null) => void;
  /** Şehre tıklanınca (dokunma dahil) altındaki tesis, boş yere tıklanınca null. */
  onPickFacility: (facility: FacilityId | null) => void;
}

/** Perde rengi tesisin tasarım token'ından okunur (--color-facility-*). */
function facilityColor(id: FacilityId) {
  const value = getComputedStyle(document.documentElement).getPropertyValue(facilityColorToken(id)).trim();
  return new THREE.Color(value || '#ffffff');
}

function CityScene({ quality, reducedMotion, onReady, facilities, onHoverFacility, onPickFacility }: CitySceneProps) {
  const { gl, scene, camera, size } = useThree();
  const gltf = useLoader(GLTFLoader, MODEL_URL, (loader) => {
    loader.setMeshoptDecoder(MeshoptDecoder);
  });

  // Şehir ve kamera sahneye ışık eklemez, ışıklar efektte kurulup temizlenir (StrictMode çift çalıştırır).
  const { city, director } = useMemo(
    () => ({
      city: prepareCity(gltf.scene, CITY_CONFIG, { quality }),
      director: new CameraDirector(camera as THREE.PerspectiveCamera, CITY_CONFIG, {
        idleOrbit: !reducedMotion,
        parallax: !reducedMotion,
      }),
    }),
    [gltf, camera, quality, reducedMotion],
  );
  const atmosphereRef = useRef<Atmosphere | null>(null);
  const highlight = useMemo(() => new FacilityHighlight(), []);
  useEffect(() => () => highlight.dispose(), [highlight]);
  useEffect(() => {
    highlight.show(facilities.map((id) => ({ key: id, rect: FACILITY_RECTS[id], color: facilityColor(id) })));
  }, [highlight, facilities]);

  useEffect(() => {
    // Yükseklik haritası (ortam gölgesi) ışıklar kurulmadan önce, şehir sahneye eklendikten sonra bir kez çizilir.
    const heightField = bakeHeightField(gl, scene, gltf.scene, quality);
    const atmosphere = createAtmosphere(gl, scene, gltf.scene, { quality, timeOfDay: TIME_OF_DAY });
    atmosphereRef.current = atmosphere;
    return () => {
      atmosphere.dispose();
      heightField.dispose();
      atmosphereRef.current = null;
    };
  }, [gl, scene, gltf, quality, city]);

  useEffect(() => {
    director.setAspect(size.width / size.height);
  }, [director, size]);

  // Şehirde tesis seçme: her tesisin görünmez kutularına ışın atılır (şehir hazırlandıktan sonra bir kez kurulur).
  // `city` bağımlılığı sırayı garanti eder: kutular yerleşim ve bina bölmeden sonra hesaplanır.
  const picks = useMemo(() => (city ? facilityPickBoxes(gltf.scene) : []), [gltf, city]);
  const raycaster = useMemo(() => new THREE.Raycaster(), []);
  const pointer = useRef({ ndc: new THREE.Vector2(), inside: false, mouse: false });
  const hovered = useRef<FacilityId | null>(null);
  const handlers = useRef({ onHoverFacility, onPickFacility });
  useEffect(() => {
    handlers.current = { onHoverFacility, onPickFacility };
  }, [onHoverFacility, onPickFacility]);

  const pickAt = useCallback(
    (ndc: THREE.Vector2) => {
      raycaster.setFromCamera(ndc, camera);
      return pickFacility(raycaster.ray, picks);
    },
    [raycaster, camera, picks],
  );
  const setHovered = useCallback(
    (facility: FacilityId | null) => {
      if (hovered.current === facility) return;
      hovered.current = facility;
      handlers.current.onHoverFacility(facility);
      // Fare olan cihazlarda yerel imleç gizli, sitenin imleci tıklanabilir haline geçer.
      setCursorInteractive(facility !== null);
    },
    [],
  );

  useEffect(() => {
    const element = gl.domElement;
    const toNdc = (event: PointerEvent | MouseEvent, target: THREE.Vector2) => {
      const rect = element.getBoundingClientRect();
      return target.set(((event.clientX - rect.left) / rect.width) * 2 - 1, -((event.clientY - rect.top) / rect.height) * 2 + 1);
    };
    const onMove = (event: PointerEvent) => {
      toNdc(event, pointer.current.ndc);
      pointer.current.inside = true;
      pointer.current.mouse = event.pointerType === 'mouse';
    };
    const onLeave = () => {
      pointer.current.inside = false;
      setHovered(null);
    };
    const onClick = (event: MouseEvent) => handlers.current.onPickFacility(pickAt(toNdc(event, new THREE.Vector2())));
    element.addEventListener('pointermove', onMove, { passive: true });
    element.addEventListener('pointerleave', onLeave);
    element.addEventListener('click', onClick);
    return () => {
      element.removeEventListener('pointermove', onMove);
      element.removeEventListener('pointerleave', onLeave);
      element.removeEventListener('click', onClick);
      setHovered(null);
    };
  }, [gl, pickAt, setHovered]);

  useEffect(() => {
    if (reducedMotion) return;
    const onMove = (event: PointerEvent) =>
      director.setPointer((event.clientX / window.innerWidth) * 2 - 1, (event.clientY / window.innerHeight) * 2 - 1);
    window.addEventListener('pointermove', onMove, { passive: true });
    return () => window.removeEventListener('pointermove', onMove);
  }, [director, reducedMotion]);

  const frames = useRef(0);
  // Öncelik verilmez: çizimi R3F yapar, burada yalnızca kamera ve sahne güncellenir.
  useFrame((_, delta) => {
    const atmosphere = atmosphereRef.current;
    if (!atmosphere) return;
    director.update(delta);
    atmosphere.focusShadows(director.target, director.distance);
    city.update(reducedMotion ? 0 : delta, director.distance);
    highlight.update(Math.min(delta, 0.1), reducedMotion);
    // Kamera süzülürken fare dursa da altındaki tesis değişebilir: her karede yeniden bakılır (11 tesis, birkaç kutu).
    if (pointer.current.inside && pointer.current.mouse) setHovered(pickAt(pointer.current.ndc));
    // İlk gerçek kareler ekrandayken poster solar.
    if (++frames.current === 3) onReady();
  });

  return (
    <>
      <primitive object={gltf.scene} />
      <primitive object={highlight.object} />
      {quality !== 'low' && !FX_DISABLED && <PostFx quality={quality} />}
    </>
  );
}

interface CityCanvasProps extends CitySceneProps {
  /** Sekme veya bölüm görünmüyorsa çizim durur. */
  active: boolean;
  ready: boolean;
  className: string;
}

export default function CityCanvas({
  active,
  ready,
  className,
  quality,
  reducedMotion,
  onReady,
  facilities,
  onHoverFacility,
  onPickFacility,
}: CityCanvasProps) {
  return (
    <Canvas
      className={className}
      data-ready={ready}
      frameloop={active ? 'always' : 'never'}
      // Retina'da 1.75 piksel sayısını 2.6 katına çıkarıp kare süresini 30 ms üstüne taşıyordu, MSAA ile 1.25 yeterli.
      dpr={[1, 1.25]}
      shadows={quality !== 'low' ? 'soft' : false}
      gl={{
        antialias: quality !== 'low',
        powerPreference: 'high-performance',
        // Neutral: ACES beyaz cepheleri kremrengine kaydırıp patlatıyordu, Neutral beyazı beyaz bırakır.
        toneMapping: THREE.NeutralToneMapping,
        outputColorSpace: THREE.SRGBColorSpace,
      }}
      camera={{ fov: CITY_CONFIG.hero.fov, near: 5, far: 20000, position: HERO_POSITION }}
      aria-hidden="true"
    >
      <Suspense fallback={null}>
        <CityScene
          quality={quality}
          reducedMotion={reducedMotion}
          onReady={onReady}
          facilities={facilities}
          onHoverFacility={onHoverFacility}
          onPickFacility={onPickFacility}
        />
      </Suspense>
    </Canvas>
  );
}
