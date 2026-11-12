import { Canvas, useFrame, useLoader, useThree } from '@react-three/fiber';
import { Suspense, useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import config from '../../../content/city-config.json';
import {
  type Atmosphere,
  type CityConfig,
  type Quality,
  CameraDirector,
  bakeHeightField,
  createAtmosphere,
  prepareCity,
} from './cityRuntime';

const CITY_CONFIG: CityConfig = config;
const HERO_POSITION = new THREE.Vector3().fromArray(CITY_CONFIG.hero.position);
const MODEL_URL = '/models/smart_city.glb';
// 0 başlangıç görünümü (cityRuntime içindeki BASE_LOOK: alacakaranlık maketi), 1 mavi saat.
const TIME_OF_DAY = 0;

interface CitySceneProps {
  quality: Quality;
  reducedMotion: boolean;
  onReady: () => void;
}

function CityScene({ quality, reducedMotion, onReady }: CitySceneProps) {
  const { gl, scene, camera, size } = useThree();
  const gltf = useLoader(GLTFLoader, MODEL_URL, (loader) => {
    loader.setMeshoptDecoder(MeshoptDecoder);
  });

  // Şehir ve kamera sahneye ışık eklemez, ışıklar efektte kurulup temizlenir (StrictMode çift çalıştırır).
  const { city, director } = useMemo(
    () => ({
      city: prepareCity(gltf.scene, CITY_CONFIG, { quality, timeOfDay: TIME_OF_DAY }),
      director: new CameraDirector(camera as THREE.PerspectiveCamera, CITY_CONFIG, {
        idleOrbit: !reducedMotion,
        parallax: !reducedMotion,
      }),
    }),
    [gltf, camera, quality, reducedMotion],
  );
  const atmosphereRef = useRef<Atmosphere | null>(null);

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
    // İlk gerçek kareler ekrandayken poster solar.
    if (++frames.current === 3) onReady();
  });

  return <primitive object={gltf.scene} />;
}

interface CityCanvasProps extends CitySceneProps {
  /** Sekme veya bölüm görünmüyorsa çizim durur. */
  active: boolean;
  ready: boolean;
  className: string;
}

export default function CityCanvas({ active, ready, className, quality, reducedMotion, onReady }: CityCanvasProps) {
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
        <CityScene quality={quality} reducedMotion={reducedMotion} onReady={onReady} />
      </Suspense>
    </Canvas>
  );
}
