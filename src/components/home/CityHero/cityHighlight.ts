// Seçili tesisin sınırında, tesisin kendi renginde yükselen kuzey ışığı perdesi. Dikdörtgenin çevresinde bir perde:
// yukarı doğru kıvrımlanıp dalgalanır, kenar boyunca farklı boylarda ince düşey ışınlara ayrılır, üst kenarı tırtıklı ve
// yavaşça değişir, alt kenarı keskin ve parlak bir banttır, renk yukarı doğru hafifçe ton değiştirir. Toplamalı karışımla
// çizilir, bloom parlatır. Seçim değişince eski perde yere iner, yenisi yerden yükselir.
import * as THREE from 'three';
import type { Rect } from './cityLayout';

// Tek boyutlu değer gürültüsü: ışınlar, ışın boyları ve parıltı bundan türer.
const NOISE = `
  float auroraHash(float n){ return fract(sin(n) * 43758.5453); }
  float auroraNoise(float x){
    float i = floor(x); float f = fract(x); f = f * f * (3.0 - 2.0 * f);
    return mix(auroraHash(i), auroraHash(i + 1.0), f);
  }`;

const VERTEX = `
  attribute float aAlong;
  attribute vec2 aOut;
  attribute float aEnd;
  uniform float uRise;
  uniform float uTime;
  uniform float uFold;
  varying float vAlong;
  varying float vHeight;
  void main(){
    vAlong = aAlong;
    vHeight = position.y;
    vec3 p = position;
    // Kıvrımlar: perde yukarı çıktıkça dışa ve içe dalgalanır, dipte sınıra oturur. Köşelerde iki duvar ayrılmasın diye söner.
    float fold = sin(aAlong * 0.042 + uTime * 0.45) * 0.6 + sin(aAlong * 0.097 - uTime * 0.7 + 1.7) * 0.4;
    p.xz += aOut * fold * uFold * pow(position.y, 0.85) * smoothstep(0.0, 28.0, aEnd);
    // Perde yerden büyür: yükseklik payı açılırken 0'dan 1'e çıkar.
    p.y *= uRise;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
  }`;

const FRAGMENT = `
  uniform vec3 uColor;
  uniform vec3 uColorTop;
  uniform float uTime;
  uniform float uRise;
  uniform float uIntensity;
  varying float vAlong;
  varying float vHeight;
  ${NOISE}
  void main(){
    float u = vAlong;
    float v = vHeight;
    float t = uTime;
    // İnce düşey ışınlar: üç ölçekte gürültü, kenar boyunca kayar.
    float rays = auroraNoise(u * 0.55 + t * 0.22) * 0.5 + auroraNoise(u * 1.8 - t * 0.5) * 0.3
      + auroraNoise(u * 0.12 + t * 0.07) * 0.4;
    rays = pow(rays, 1.7);
    // Işın boyu kenar boyunca yavaşça değişir: üst kenar tırtıklı, düz bir tavan yok.
    float top = 0.35 + 0.65 * auroraNoise(u * 0.04 + t * 0.06 + 3.0);
    float upper = 1.0 - smoothstep(top * 0.3, top, v);
    // Alt kenar: keskin ve parlak bant, üstünde sönen gövde.
    float lower = smoothstep(0.0, 0.03, v);
    float band = exp(-v * 6.0) * 1.3;
    float body = (0.3 + band) * rays * upper * lower;
    // Zeminde ince sınır çizgisi: perdenin nereye ait olduğu okunur.
    float foot = (1.0 - smoothstep(0.0, 0.02, v)) * 0.5;
    // Işınlar yavaşça parıldar.
    float shimmer = 0.75 + 0.25 * sin(t * 2.6 + u * 0.7 + auroraNoise(u * 0.2) * 6.0);
    vec3 color = mix(uColor, uColorTop, smoothstep(0.1, 0.85, v));
    float glow = (body * shimmer * 1.7 + foot) * uIntensity * smoothstep(0.0, 0.25, uRise);
    gl_FragColor = vec4(color * glow, 1.0);
    #include <colorspace_fragment>
  }`;

/** Perdenin yüksekliği tesisin büyüklüğüyle orantılı (metre). Işınlar bunun %35-100'ü boyunda. */
function curtainHeight(rect: Rect) {
  const size = Math.max(rect.x1 - rect.x0, rect.z1 - rect.z0);
  return THREE.MathUtils.clamp(size * 0.34, 70, 160);
}

// Genel parlaklık çarpanı (1: ilk ayar, kullanıcı biraz düşürülmesini istedi).
const INTENSITY = 0.7;
// Kıvrımların en büyük genliği (metre).
const FOLD = 9;
// Perdenin yatay çözünürlüğü (metre) ve düşey dilim sayısı: kıvrım için gerekli.
const STEP = 4;
const ROWS = 10;

// Perde tesis sınırından bu kadar dışarıda durur (metre). Sınırla aynı düzlemdeki cepheler (havalimanı terminalinin batı
// yüzü x 430) perdeyle üst üste gelince derinlik çakışmasından titriyordu. 4 m bu mesafede kaldırımın üstü, ayrı görünmez.
// Kıvrım dipte sıfır olduğundan perdenin zemine değdiği yer yine sınırın 4 m dışında kalır.
const CURTAIN_OFFSET = 4;

/**
 * Dikdörtgenin çevresinde, yüksekliği 1 olan dört duvar, kıvrım için sık ızgara. aAlong: çevre boyunca metre (ışınlar
 * köşede kopmaz), aOut: duvarın dışa bakan yönü, aEnd: duvarın en yakın ucuna uzaklık (köşede kıvrım söner).
 */
function curtainGeometry(rect: Rect) {
  const o = CURTAIN_OFFSET;
  const corners = [
    [rect.x0 - o, rect.z0 - o],
    [rect.x1 + o, rect.z0 - o],
    [rect.x1 + o, rect.z1 + o],
    [rect.x0 - o, rect.z1 + o],
  ];
  const positions: number[] = [];
  const along: number[] = [];
  const out: number[] = [];
  const ends: number[] = [];
  const indices: number[] = [];
  let distance = 0;
  for (let i = 0; i < 4; i++) {
    const [ax, az] = corners[i];
    const [bx, bz] = corners[(i + 1) % 4];
    const length = Math.hypot(bx - ax, bz - az);
    const dirX = (bx - ax) / length;
    const dirZ = (bz - az) / length;
    // Köşeler saat yönünde (x, z düzleminde): dış normal (dirZ, -dirX).
    const outX = dirZ;
    const outZ = -dirX;
    const columns = Math.max(2, Math.ceil(length / STEP));
    const start = positions.length / 3;
    for (let c = 0; c <= columns; c++) {
      const s = (c / columns) * length;
      for (let r = 0; r <= ROWS; r++) {
        positions.push(ax + dirX * s, r / ROWS, az + dirZ * s);
        along.push(distance + s);
        out.push(outX, outZ);
        ends.push(Math.min(s, length - s));
      }
    }
    for (let c = 0; c < columns; c++) {
      for (let r = 0; r < ROWS; r++) {
        const a = start + c * (ROWS + 1) + r;
        const b = a + ROWS + 1;
        indices.push(a, b, b + 1, a, b + 1, a + 1);
      }
    }
    distance += length;
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('aAlong', new THREE.Float32BufferAttribute(along, 1));
  geometry.setAttribute('aOut', new THREE.Float32BufferAttribute(out, 2));
  geometry.setAttribute('aEnd', new THREE.Float32BufferAttribute(ends, 1));
  geometry.setIndex(indices);
  return geometry;
}

/** Işınların tepesindeki renk: tesis renginden biraz kaymış ve açılmış ton (kuzey ışığındaki yeşilden mora geçiş gibi). */
function topColor(color: THREE.Color) {
  return color.clone().offsetHSL(0.09, 0, 0.06);
}

interface Curtain {
  mesh: THREE.Mesh<THREE.BufferGeometry, THREE.ShaderMaterial>;
  rise: number;
  target: number;
}

// Açılış ve kapanış hızı (saniye başına pay): yükselme ~0.9 sn, iniş ~0.35 sn.
const RISE_SPEED = 1.1;
const FALL_SPEED = 2.8;
const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);

export class FacilityHighlight {
  readonly object = new THREE.Group();
  private readonly curtains = new Map<string, Curtain>();
  private readonly time = { value: 0 };

  constructor() {
    this.object.name = 'Runtime_Highlight';
  }

  /**
   * Açık perdeleri belirler: listedekiler yükselir, diğerleri iner. Aynı anda birden çok perde açık olabilir (tıklanan ve
   * fareyle üstünde durulan). Renk perde ilk açıldığında işlenir.
   */
  show(active: { key: string; rect: Rect; color: THREE.Color }[]) {
    const keys = new Set(active.map((item) => item.key));
    for (const [id, curtain] of this.curtains) curtain.target = keys.has(id) ? 1 : 0;
    for (const { key, rect, color } of active) {
      if (!this.curtains.has(key)) this.curtains.set(key, this.create(key, rect, color));
    }
  }

  private create(key: string, rect: Rect, color: THREE.Color): Curtain {
    const material = new THREE.ShaderMaterial({
      uniforms: {
        uColor: { value: color },
        uColorTop: { value: topColor(color) },
        uTime: this.time,
        uRise: { value: 0 },
        uFold: { value: FOLD },
        uIntensity: { value: INTENSITY },
      },
      vertexShader: VERTEX,
      fragmentShader: FRAGMENT,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
      toneMapped: false,
    });
    const mesh = new THREE.Mesh(curtainGeometry(rect), material);
    mesh.name = `Runtime_Highlight_${key}`;
    mesh.scale.y = curtainHeight(rect);
    mesh.position.y = 0.9; // zemin yamalarının hemen üstü
    mesh.renderOrder = 3;
    mesh.frustumCulled = false;
    mesh.visible = false;
    this.object.add(mesh);
    return { mesh, rise: 0, target: 1 };
  }

  /** reducedMotion: perde anında açılıp kapanır, tarama durur. */
  update(dt: number, reducedMotion: boolean) {
    if (!reducedMotion) this.time.value += dt;
    for (const curtain of this.curtains.values()) {
      const speed = curtain.target > curtain.rise ? RISE_SPEED : FALL_SPEED;
      curtain.rise = reducedMotion
        ? curtain.target
        : THREE.MathUtils.clamp(curtain.rise + Math.sign(curtain.target - curtain.rise) * speed * dt, 0, 1);
      curtain.mesh.visible = curtain.rise > 0.001;
      curtain.mesh.material.uniforms.uRise.value = easeOut(curtain.rise);
    }
  }

  dispose() {
    for (const { mesh } of this.curtains.values()) {
      mesh.geometry.dispose();
      mesh.material.dispose();
    }
    this.curtains.clear();
    this.object.clear();
  }
}
