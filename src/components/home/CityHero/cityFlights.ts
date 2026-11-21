// Havalimanında iniş ve kalkış trafiği. Modeldeki 13 uçaktan ikisi apronda değil (biri taksi yolunda, biri pist başında),
// bunlar sabit örneklerden çıkarılıp aynı kapalı rotayı yarım tur arayla izleyen iki uçağa dönüşür. Böylece biri inerken
// diğeri tur atar, hiçbir uçak görünüp kaybolmaz. Rüzgâr batıdan, iki pist de batıya (27) kullanılır:
// - Doğudan 3° süzülüşle kuzey piste (27R) yaklaşma, burun kaldırma (flare), teker koyma, burnu indirme ve frenleme.
// - 650 bağlantısından çıkış, güney pistin bekleme çizgisinde kısa bekleme, pistten geçiş, taksi yolunda doğuya, 1050
//   bağlantısından güney piste (27L) giriş, pist başında bekleme.
// - Kalkış koşusu, burun kaldırma, tırmanış, deniz üstünde sağa 180° dönüş, kuzeyde doğuya rüzgâr altı bacağı, sağa 180°
//   dönüşle yeniden son yaklaşma.
// Rota ve hız profili açılışta bir kez örneklenir (konum, yön, yunuslama, yatış), her karede iki örnek arası yorumlanır.
// Koordinatlar dünya metresidir, pist ve taksi ölçüleri cityAirport.ts'deki planla aynıdır (x doğu, -z kuzey).
import * as THREE from 'three';

// Uçak merkezinin yerdeki yüksekliği (modeldeki park etmiş uçaklarla aynı) ve ölçeği (gövde yarı boyu, metre).
const GROUND = 8.04;
// Sabit örneklerden çıkarılacak uçaklar: apronların kuzeyinde (taksi yolu ve pistte) duranlar.
const ACTIVE_Z = -940;
// Pistler, taksi yolu ve bağlantılar (cityAirport.ts: RUNWAYS, TAXIWAY, CONNECTORS, TURN).
const RUNWAY_NORTH = -1180;
const RUNWAY_SOUTH = -1040;
const TAXIWAY_Z = -960;
const EXIT_X = 650;
const ENTRY_X = 1050;
const TURN = 30;
// Güney pistin kuzeydeki bekleme çizgisi (z -1085): burun çizginin önünde durur.
const HOLD_Z = -1085 - 23;
// 3° süzülüş, hedef noktası kuzey pistin doğu eşiğinden 300 m içeride.
const GLIDE = Math.tan((3 * Math.PI) / 180);
const AIM_X = 1150;
const glideY = (x: number) => GROUND + (x - AIM_X) * GLIDE;
// Trafik turu: dönüş yarıçapları, rüzgâr altı bacağının konumu ve yüksekliği.
const CLIMB_TURN = { x: -400, radius: 550 };
// Rüzgâr altında 300 m'den 200 m'ye alçalır, base dönüşünde süzülüş yüksekliğine iner (dalış olmasın).
const DOWNWIND = { z: RUNWAY_SOUTH - 2 * CLIMB_TURN.radius, y0: 300, y1: 200 };
const BASE_X = 2300;
const BASE_RADIUS = (RUNWAY_NORTH - DOWNWIND.z) / 2;
// Beklemeler (saniye) ve örnekleme adımı.
const HOLD_TIME = 3;
const LINEUP_TIME = 3;
const STEP = 0.1;
// Yatış: dönüş hızından hesaplanır, en çok 25°. Yön değişimi ve süzülüş açısı bu pencerede yumuşatılır (saniye).
const MAX_BANK = (25 * Math.PI) / 180;
const BANK_WINDOW = 1.5;
const PITCH_WINDOW = 1;
// İlk uçak açılışta teker koymaya bu kadar saniye kala son yaklaşmada başlar, ikincisi yarım tur geride.
const START_BEFORE_TOUCHDOWN = 9;
const MESH_NAME = 'Traffic_Airport_Aircraft_Moving';

const DEG = Math.PI / 180;

/** Yatay çember yayı: başlangıç ve bitiş açıları merkezden (x, z) düzleminde, yükseklik doğrusal değişir. */
class ArcCurve extends THREE.Curve<THREE.Vector3> {
  private readonly cx: number;
  private readonly cz: number;
  private readonly radius: number;
  private readonly a0: number;
  private readonly a1: number;
  private readonly y0: number;
  private readonly y1: number;

  constructor(cx: number, cz: number, radius: number, a0: number, a1: number, y0: number, y1: number) {
    super();
    this.cx = cx;
    this.cz = cz;
    this.radius = radius;
    this.a0 = a0;
    this.a1 = a1;
    this.y0 = y0;
    this.y1 = y1;
  }

  override getPoint(u: number, target = new THREE.Vector3()) {
    const angle = this.a0 + (this.a1 - this.a0) * u;
    return target.set(
      this.cx + Math.cos(angle) * this.radius,
      this.y0 + (this.y1 - this.y0) * u,
      this.cz + Math.sin(angle) * this.radius,
    );
  }
}

/**
 * Rotanın bir bacağı: eğri, giriş ve çıkış hızı (m/s, aralarında sabit ivme), hücum açısı (derece, burnun yörüngeden
 * yukarı payı) ve havada olma payı (0 yerde, 1 havada; yatış buna göre). Duran bacağın eğrisi tek noktadır, süresi verilir.
 */
interface Leg {
  curve: THREE.Curve<THREE.Vector3>;
  v0: number;
  v1: number;
  aoa0: number;
  aoa1: number;
  air0: number;
  air1: number;
  hold?: number;
}

const v = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
const line = (a: THREE.Vector3, b: THREE.Vector3) => new THREE.LineCurve3(a, b);
const ground = (x: number, z: number) => v(x, GROUND, z);

function leg(curve: THREE.Curve<THREE.Vector3>, v0: number, v1: number, extra: Partial<Leg> = {}): Leg {
  return { curve, v0, v1, aoa0: 0, aoa1: 0, air0: 0, air1: 0, ...extra };
}

function route(): Leg[] {
  const air = { aoa0: 3, aoa1: 3, air0: 1, air1: 1 };
  const flareX = 1400;
  const touchdownX = 1180;
  const derotateX = 1030;
  const rotateX = 250;
  const liftoffX = 130;
  const climbY = 100;
  const climbEnd = v(CLIMB_TURN.x, climbY, RUNWAY_SOUTH);
  const turnZ = RUNWAY_SOUTH - CLIMB_TURN.radius;
  const baseZ = RUNWAY_NORTH - BASE_RADIUS;
  // Açılar: 0 doğu (+x), π/2 güney (+z). Batıya giderken kuzeye dönüş ve doğuya giderken güneye dönüş sağa dönüştür.
  return [
    // Son yaklaşma ve burun kaldırma (flare)
    leg(line(v(BASE_X, glideY(BASE_X), RUNWAY_NORTH), v(flareX, glideY(flareX), RUNWAY_NORTH)), 80, 75, air),
    leg(
      new THREE.CubicBezierCurve3(
        v(flareX, glideY(flareX), RUNWAY_NORTH),
        v(flareX - 120, glideY(flareX - 120), RUNWAY_NORTH),
        v(touchdownX + 70, GROUND + 0.5, RUNWAY_NORTH),
        ground(touchdownX, RUNWAY_NORTH),
      ),
      75,
      70,
      { aoa0: 3, aoa1: 5, air0: 1, air1: 0 },
    ),
    // Burnu indirme ve frenleme
    leg(line(ground(touchdownX, RUNWAY_NORTH), ground(derotateX, RUNWAY_NORTH)), 70, 58, { aoa0: 5, aoa1: 0 }),
    leg(line(ground(derotateX, RUNWAY_NORTH), ground(EXIT_X + TURN, RUNWAY_NORTH)), 58, 12),
    // Pistten çıkış (sola, güneye), bekleme çizgisi, güney pistin geçişi
    leg(new ArcCurve(EXIT_X + TURN, RUNWAY_NORTH + TURN, TURN, -Math.PI / 2, -Math.PI, GROUND, GROUND), 12, 12),
    leg(line(ground(EXIT_X, RUNWAY_NORTH + TURN), ground(EXIT_X, HOLD_Z)), 12, 0),
    leg(line(ground(EXIT_X, HOLD_Z), ground(EXIT_X, HOLD_Z)), 0, 0, { hold: HOLD_TIME }),
    leg(line(ground(EXIT_X, HOLD_Z), ground(EXIT_X, TAXIWAY_Z - TURN)), 0, 16),
    // Taksi yolunda doğuya
    leg(new ArcCurve(EXIT_X + TURN, TAXIWAY_Z - TURN, TURN, Math.PI, Math.PI / 2, GROUND, GROUND), 16, 13),
    leg(line(ground(EXIT_X + TURN, TAXIWAY_Z), ground(850, TAXIWAY_Z)), 13, 22),
    leg(line(ground(850, TAXIWAY_Z), ground(ENTRY_X - TURN, TAXIWAY_Z)), 22, 12),
    // 1050 bağlantısından güney piste giriş (iki sola dönüş), pist başında bekleme
    leg(new ArcCurve(ENTRY_X - TURN, TAXIWAY_Z - TURN, TURN, Math.PI / 2, 0, GROUND, GROUND), 12, 11),
    leg(line(ground(ENTRY_X, TAXIWAY_Z - TURN), ground(ENTRY_X, RUNWAY_SOUTH + TURN)), 11, 10),
    leg(new ArcCurve(ENTRY_X - TURN, RUNWAY_SOUTH + TURN, TURN, 0, -Math.PI / 2, GROUND, GROUND), 10, 8),
    leg(line(ground(ENTRY_X - TURN, RUNWAY_SOUTH), ground(1000, RUNWAY_SOUTH)), 8, 0),
    leg(line(ground(1000, RUNWAY_SOUTH), ground(1000, RUNWAY_SOUTH)), 0, 0, { hold: LINEUP_TIME }),
    // Kalkış koşusu, burun kaldırma, tırmanış
    leg(line(ground(1000, RUNWAY_SOUTH), ground(rotateX, RUNWAY_SOUTH)), 0, 68),
    leg(line(ground(rotateX, RUNWAY_SOUTH), ground(liftoffX, RUNWAY_SOUTH)), 68, 75, { aoa1: 8 }),
    leg(
      new THREE.CubicBezierCurve3(
        ground(liftoffX, RUNWAY_SOUTH),
        v(0, GROUND + 5, RUNWAY_SOUTH),
        v(CLIMB_TURN.x + 150, climbY - 15, RUNWAY_SOUTH),
        climbEnd,
      ),
      75,
      80,
      { aoa0: 8, aoa1: 4, air0: 0, air1: 1 },
    ),
    // Deniz üstünde sağa 180°, rüzgâr altı, sağa 180° ile son yaklaşmaya
    leg(new ArcCurve(CLIMB_TURN.x, turnZ, CLIMB_TURN.radius, Math.PI / 2, (3 * Math.PI) / 2, climbY, DOWNWIND.y0), 80, 85, {
      ...air,
      aoa0: 4,
    }),
    leg(line(v(CLIMB_TURN.x, DOWNWIND.y0, DOWNWIND.z), v(BASE_X, DOWNWIND.y1, DOWNWIND.z)), 85, 85, air),
    leg(new ArcCurve(BASE_X, baseZ, BASE_RADIUS, -Math.PI / 2, Math.PI / 2, DOWNWIND.y1, glideY(BASE_X)), 85, 80, air),
  ];
}

/** Rotayı sabit adımlarla örnekler: konum, dünya yönü (dörtlük) ve döngü süresi. */
function bake(legs: Leg[]) {
  const timed = legs.map((item) => {
    const length = item.curve.getLength();
    const duration = item.hold ?? (2 * length) / Math.max(1e-6, item.v0 + item.v1);
    return { ...item, length, duration };
  });
  const cycle = timed.reduce((sum, item) => sum + item.duration, 0);
  const count = Math.ceil(cycle / STEP);
  const step = cycle / count;
  const x = new Float32Array(count);
  const y = new Float32Array(count);
  const z = new Float32Array(count);
  const aoa = new Float32Array(count);
  const air = new Float32Array(count);
  const speed = new Float32Array(count);
  const point = new THREE.Vector3();
  let legIndex = 0;
  let legStart = 0;
  for (let i = 0; i < count; i++) {
    const time = i * step;
    while (legIndex < timed.length - 1 && time >= legStart + timed[legIndex].duration) {
      legStart += timed[legIndex].duration;
      legIndex++;
    }
    const item = timed[legIndex];
    const t = Math.min(time - legStart, item.duration);
    const k = item.duration > 0 ? t / item.duration : 0;
    // Sabit ivme: kat edilen yol v0·t + (v1 - v0)·t² / 2T
    const travelled = item.hold ? 0 : item.v0 * t + ((item.v1 - item.v0) * t * t) / (2 * item.duration);
    if (item.length > 1e-6) item.curve.getPointAt(Math.min(1, travelled / item.length), point);
    else item.curve.getPoint(0, point);
    x[i] = point.x;
    y[i] = point.y;
    z[i] = point.z;
    aoa[i] = (item.aoa0 + (item.aoa1 - item.aoa0) * k) * DEG;
    air[i] = item.air0 + (item.air1 - item.air0) * k;
    speed[i] = item.hold ? 0 : item.v0 + (item.v1 - item.v0) * k;
  }

  // Yön: ileri farktan, durunca son yön korunur. Döngü başı rotanın sonundan devralınır (iki tur dolaşılır).
  const heading = new Float32Array(count);
  let last = Math.PI;
  for (let pass = 0; pass < 2; pass++) {
    for (let i = 0; i < count; i++) {
      const j = (i + 1) % count;
      const dx = x[j] - x[i];
      const dz = z[j] - z[i];
      if (dx * dx + dz * dz > 1e-6) last = Math.atan2(-dz, dx);
      heading[i] = last;
    }
  }
  const wrap = (angle: number) => angle - 2 * Math.PI * Math.round(angle / (2 * Math.PI));
  const at = (i: number) => ((i % count) + count) % count;
  const bankSpan = Math.round(BANK_WINDOW / step);
  const pitchSpan = Math.round(PITCH_WINDOW / step);
  const quaternions = new Float32Array(count * 4);
  const euler = new THREE.Euler(0, 0, 0, 'YZX');
  const quaternion = new THREE.Quaternion();
  for (let i = 0; i < count; i++) {
    // Dönüş hızı (rad/s) ve süzülüş açısı pencere içinde ortalanır: bacak geçişlerinde yatış ve yunuslama yumuşar.
    const a = at(i - bankSpan);
    const b = at(i + bankSpan);
    const turnRate = wrap(heading[b] - heading[a]) / (2 * bankSpan * step);
    const bank = THREE.MathUtils.clamp(Math.atan((speed[i] * -turnRate) / 9.81), -MAX_BANK, MAX_BANK) * air[i];
    const p = at(i - pitchSpan);
    const q = at(i + pitchSpan);
    const run = Math.hypot(x[q] - x[p], z[q] - z[p]);
    const path = run > 1 ? Math.atan2(y[q] - y[p], run) : 0;
    // Model burnu yerel +x'te, sağ kanadı +z'de: Y yön, Z yunuslama (burun yukarı +), X yatış (sağ kanat aşağı +).
    euler.set(bank, heading[i], path + aoa[i]);
    quaternion.setFromEuler(euler).toArray(quaternions, i * 4);
  }
  return { x, y, z, quaternions, count, step, cycle, touchdown: timed[0].duration + timed[1].duration };
}

export interface Flights {
  update: (dt: number) => void;
}

/**
 * Hareketli uçakları kurar. İlk çağrıda modeldeki aktif iki uçak `Airport_Aircraft`'tan çıkarılır ve kendi mesh'ine
 * taşınır, sonraki çağrılar (StrictMode, kalite değişimi) aynı mesh'i kullanır. Uçaklar ilk `update(dt > 0)` gelene kadar
 * modeldeki yerinde durur: hareket azaltılmışsa (dt hep 0) taksi yolunda ve pist başında bekler. Chunk bölmeden önce
 * çağrılmalıdır.
 */
export function createFlights(cityRoot: THREE.Object3D): Flights | null {
  const stored = cityRoot.userData.flights as { mesh: THREE.InstancedMesh; initial: THREE.Matrix4[] } | undefined;
  let setup = stored;
  if (!setup) {
    const source = cityRoot.getObjectByName('Airport_Aircraft');
    if (!(source instanceof THREE.InstancedMesh) || !source.parent) return null;
    source.updateMatrixWorld(true);
    const kept: THREE.Matrix4[] = [];
    const initial: THREE.Matrix4[] = [];
    const matrix = new THREE.Matrix4();
    for (let i = 0; i < source.count; i++) {
      source.getMatrixAt(i, matrix);
      const world = matrix.clone().premultiply(source.matrixWorld);
      (world.elements[14] < ACTIVE_Z ? initial : kept).push(matrix.clone());
    }
    if (!initial.length) return null;
    kept.forEach((item, index) => source.setMatrixAt(index, item));
    source.count = kept.length;
    source.instanceMatrix.needsUpdate = true;
    source.computeBoundingSphere();

    const mesh = new THREE.InstancedMesh(source.geometry, source.material, initial.length);
    mesh.name = MESH_NAME;
    // Gölge haritası durağan, hareket eden uçaklar gölge düşürmez. Örnekler çok uzağa uçar: sınır küresi tutulmaz.
    mesh.userData = { ...source.userData, castShadow: false, thinnable: false };
    mesh.frustumCulled = false;
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    mesh.matrix.copy(source.matrix);
    mesh.matrix.decompose(mesh.position, mesh.quaternion, mesh.scale);
    source.parent.add(mesh);
    setup = { mesh, initial };
    cityRoot.userData.flights = setup;
  }

  const { mesh, initial } = setup;
  initial.forEach((item, index) => mesh.setMatrixAt(index, item));
  mesh.instanceMatrix.needsUpdate = true;

  const path = bake(route());
  // Rota dünya koordinatında: ebeveynin dönüşümü (normalde birim) geri alınır. Ölçek modeldeki örneklerden okunur.
  mesh.updateMatrixWorld(true);
  const toLocal = mesh.matrixWorld.clone().invert();
  const scale = new THREE.Vector3().setFromMatrixColumn(initial[0], 0).length();
  const unit = new THREE.Vector3(scale, scale, scale);
  const position = new THREE.Vector3();
  const quaternion = new THREE.Quaternion();
  const next = new THREE.Quaternion();
  const matrix = new THREE.Matrix4();
  let time = path.touchdown - START_BEFORE_TOUCHDOWN;

  return {
    update(dt) {
      if (dt <= 0) return;
      time = (time + dt) % path.cycle;
      for (let n = 0; n < mesh.count; n++) {
        const local = (time + (n * path.cycle) / mesh.count) % path.cycle;
        const f = local / path.step;
        const i = Math.floor(f) % path.count;
        const j = (i + 1) % path.count;
        const k = f - Math.floor(f);
        position.set(
          path.x[i] + (path.x[j] - path.x[i]) * k,
          path.y[i] + (path.y[j] - path.y[i]) * k,
          path.z[i] + (path.z[j] - path.z[i]) * k,
        );
        quaternion.fromArray(path.quaternions, i * 4);
        next.fromArray(path.quaternions, j * 4);
        quaternion.slerp(next, k);
        mesh.setMatrixAt(n, matrix.compose(position, quaternion, unit).premultiply(toLocal));
      }
      mesh.instanceMatrix.needsUpdate = true;
    },
  };
}
