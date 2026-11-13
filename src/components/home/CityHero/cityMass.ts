// Bina kütleleri: birim küp ([-1, 1]) içinde kurulan kutu ve eğimli çatı geometrileri. Tesislerdeki küçük parçalar
// (oyun ekipmanı, palet, tank) için dünya koordinatında köşe renkli katılar (PropBuilder). Şehir binaları (diversifyBuildings)
// ve tesis yapıları (cityKindergarten.ts) aynı kütleleri kullanır, cephe shader'ı (CITY_FACE) hepsine aynı işçiliği verir.
import * as THREE from 'three';

type Triple = [number, number, number];

/** Birim küp ([-1, 1]) içinde bina kütlesi kurar. Örnek ölçeği bunu gerçek ölçüye taşır. */
export class MassBuilder {
  private readonly positions: number[] = [];
  private readonly normals: number[] = [];
  private readonly colors: number[] = [];
  private readonly faces: number[] = [];
  private readonly kinds: number[] = [];
  private readonly indices: number[] = [];

  /** Köşeler herhangi bir sırada verilebilir, yüz `outward` yönüne bakacak şekilde çevrilir. */
  private polygon(points: Triple[], outward: Triple, face: [number, number, number, number], kind: number, shade?: number) {
    const [a, b, c] = points.map((point) => new THREE.Vector3(...point));
    const normal = b.clone().sub(a).cross(c.clone().sub(a)).normalize();
    const ordered = normal.dot(new THREE.Vector3(...outward)) < 0 ? [...points].reverse() : points;
    if (ordered !== points) normal.negate();
    const start = this.positions.length / 3;
    for (const point of ordered) {
      this.positions.push(...point);
      this.normals.push(normal.x, normal.y, normal.z);
      // Modeldeki kutunun köşe renkleri: duvar dipte 0.58, tepede 1 (basit temas gölgesi), çatı 0.82.
      const tone = shade ?? 0.58 + 0.42 * ((point[1] + 1) / 2);
      this.colors.push(tone, tone, tone);
      this.faces.push(...face);
      this.kinds.push(kind);
    }
    for (let i = 1; i < ordered.length - 1; i++) this.indices.push(start, start + i, start + i + 1);
  }

  /** Dört duvar ve istenirse düz üst yüz. */
  box(x0: number, x1: number, y0: number, y1: number, z0: number, z1: number, top = true) {
    const face: [number, number, number, number] = [(x0 + x1) / 2, (z0 + z1) / 2, (x1 - x0) / 2, (z1 - z0) / 2];
    this.polygon([[x1, y0, z0], [x1, y0, z1], [x1, y1, z1], [x1, y1, z0]], [1, 0, 0], face, 0);
    this.polygon([[x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0]], [-1, 0, 0], face, 0);
    this.polygon([[x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1]], [0, 0, 1], face, 0);
    this.polygon([[x0, y0, z0], [x1, y0, z0], [x1, y1, z0], [x0, y1, z0]], [0, 0, -1], face, 0);
    if (top) this.polygon([[x0, y1, z0], [x1, y1, z0], [x1, y1, z1], [x0, y1, z1]], [0, 1, 0], face, 0, 0.82);
    return this;
  }

  /** Tam tabana oturan eğimli çatı. Mahya `alongX` ekseninde, yarı uzunluğu `ridge` (1: beşik çatı, küçükse kırma çatı). */
  pitchedRoof(y0: number, y1: number, alongX: boolean, ridge: number) {
    // Mahya x ekseninde kabul edilip kurulur, gerekirse x ve z yer değiştirir.
    const at = (x: number, y: number, z: number): Triple => (alongX ? [x, y, z] : [z, y, x]);
    const out = (x: number, y: number, z: number): Triple => (alongX ? [x, y, z] : [z, y, x]);
    const face: [number, number, number, number] = [0, 0, 1, 1];
    this.polygon([at(-1, y0, 1), at(1, y0, 1), at(ridge, y1, 0), at(-ridge, y1, 0)], out(0, 0.5, 1), face, 1, 0.82);
    this.polygon([at(-1, y0, -1), at(1, y0, -1), at(ridge, y1, 0), at(-ridge, y1, 0)], out(0, 0.5, -1), face, 1, 0.82);
    // Uçlar: kırma çatıda eğimli kiremit yüz, beşik çatıda düşey kalkan duvarı.
    const gable = ridge >= 1;
    this.polygon([at(1, y0, -1), at(1, y0, 1), at(ridge, y1, 0)], out(1, 0.5, 0), face, gable ? 0 : 1, gable ? 1 : 0.82);
    this.polygon([at(-1, y0, -1), at(-1, y0, 1), at(-ridge, y1, 0)], out(-1, 0.5, 0), face, gable ? 0 : 1, gable ? 1 : 0.82);
    return this;
  }

  build(): THREE.BufferGeometry {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(this.positions, 3));
    geometry.setAttribute('normal', new THREE.Float32BufferAttribute(this.normals, 3));
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(this.colors, 3));
    geometry.setAttribute('aFace', new THREE.Float32BufferAttribute(this.faces, 4));
    geometry.setAttribute('aKind', new THREE.Float32BufferAttribute(this.kinds, 1));
    geometry.setIndex(this.indices);
    return geometry;
  }
}

// Kütle çeşitleri. Hepsi birim küpün içinde kalır, yani binanın kapladığı alan ve yüksekliği değişmez.
export const MASS_VARIANTS = {
  plain: () => new MassBuilder().box(-1, 1, -1, 1, -1, 1),
  // Asansör ve tesisat kulesi olan düz çatı.
  penthouse: () => new MassBuilder().box(-1, 1, -1, 0.9, -1, 1).box(-0.5, 0.2, 0.9, 1, -0.35, 0.45),
  penthouseB: () => new MassBuilder().box(-1, 1, -1, 0.88, -1, 1).box(0.05, 0.6, 0.88, 1, -0.6, 0.1).box(-0.7, -0.3, 0.88, 0.95, 0.2, 0.7),
  // Yukarı doğru daralan kuleler.
  setback: () => new MassBuilder().box(-1, 1, -1, 0.3, -1, 1).box(-0.72, 0.72, 0.3, 1, -0.72, 0.72),
  setbackTriple: () =>
    new MassBuilder().box(-1, 1, -1, 0.05, -1, 1).box(-0.78, 0.78, 0.05, 0.62, -0.78, 0.78).box(-0.5, 0.5, 0.62, 1, -0.5, 0.5),
  // Geniş alçak taban üstünde kenara yaslı blok.
  podiumA: () => new MassBuilder().box(-1, 1, -1, -0.35, -1, 1).box(-0.9, 0.15, -0.35, 1, -0.9, 0.9),
  podiumB: () => new MassBuilder().box(-1, 1, -1, -0.45, -1, 1).box(-0.9, 0.9, -0.45, 1, -0.15, 0.9),
  // L planlı blok: iki kanat farklı yükseklikte.
  ell: () => new MassBuilder().box(-1, 0.1, -1, 1, -1, 1).box(0.1, 1, -1, 0.4, -1, 0.1),
  // Eğimli çatılı evler: kırma ve beşik çatı, mahya uzun kenar boyunca.
  hipX: () => new MassBuilder().box(-1, 1, -1, 0.4, -1, 1, false).pitchedRoof(0.4, 1, true, 0.4),
  hipZ: () => new MassBuilder().box(-1, 1, -1, 0.4, -1, 1, false).pitchedRoof(0.4, 1, false, 0.4),
  gableX: () => new MassBuilder().box(-1, 1, -1, 0.45, -1, 1, false).pitchedRoof(0.45, 1, true, 1),
  gableZ: () => new MassBuilder().box(-1, 1, -1, 0.45, -1, 1, false).pitchedRoof(0.45, 1, false, 1),
} as const;

export type MassVariant = keyof typeof MASS_VARIANTS;

// ------------------------------------------------------------------ küçük parçalar

/** Köşe renkli basit katı parçalar (kutu, piramit çatı, eğik plaka) tek geometride. */
export class PropBuilder {
  private readonly positions: number[] = [];
  private readonly normals: number[] = [];
  private readonly colors: number[] = [];

  /** Düzlemsel çokgen, köşeler dışarıdan bakınca saat yönünün tersine (`outward` verilirse sıra ona göre çevrilir). */
  private face(points: THREE.Vector3[], color: THREE.Color, outward?: THREE.Vector3) {
    let normal = points[1].clone().sub(points[0]).cross(points[2].clone().sub(points[0])).normalize();
    if (outward && normal.dot(outward) < 0) {
      points = [...points].reverse();
      normal = normal.negate();
    }
    for (let i = 1; i < points.length - 1; i++) {
      for (const point of [points[0], points[i], points[i + 1]]) {
        this.positions.push(point.x, point.y, point.z);
        this.normals.push(normal.x, normal.y, normal.z);
        this.colors.push(color.r, color.g, color.b);
      }
    }
  }

  /** Sekiz köşeli katı: alt dörtgen (a0..a3) ve üst dörtgen (b0..b3), ikisi de yukarıdan bakınca saat yönünün tersine. */
  private solid(bottom: THREE.Vector3[], top: THREE.Vector3[], color: THREE.Color) {
    this.face([...top], color);
    this.face([...bottom].reverse(), color);
    for (let i = 0; i < 4; i++) {
      const j = (i + 1) % 4;
      this.face([bottom[i], bottom[j], top[j], top[i]], color);
    }
  }

  box(x0: number, x1: number, y0: number, y1: number, z0: number, z1: number, color: string) {
    const ring = (y: number) => [
      new THREE.Vector3(x0, y, z1),
      new THREE.Vector3(x1, y, z1),
      new THREE.Vector3(x1, y, z0),
      new THREE.Vector3(x0, y, z0),
    ];
    this.solid(ring(y0), ring(y1), new THREE.Color(color));
    return this;
  }

  /** Dört yüzlü piramit çatı. */
  pyramid(x0: number, x1: number, y0: number, y1: number, z0: number, z1: number, color: string) {
    const c = new THREE.Color(color);
    const apex = new THREE.Vector3((x0 + x1) / 2, y1, (z0 + z1) / 2);
    const base = [
      new THREE.Vector3(x0, y0, z1),
      new THREE.Vector3(x1, y0, z1),
      new THREE.Vector3(x1, y0, z0),
      new THREE.Vector3(x0, y0, z0),
    ];
    for (let i = 0; i < 4; i++) this.face([base[i], base[(i + 1) % 4], apex], c);
    this.face([...base].reverse(), c);
    return this;
  }

  /** Eğik plaka (kaydırak): (x0, y0) ile (x1, y1) arasında, z0..z1 genişliğinde, kalınlık t. */
  ramp(x0: number, y0: number, x1: number, y1: number, z0: number, z1: number, t: number, color: string) {
    const v = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
    const flip = x1 < x0;
    const bottom = [v(x0, y0 - t, z1), v(x1, y1 - t, z1), v(x1, y1 - t, z0), v(x0, y0 - t, z0)];
    const top = [v(x0, y0, z1), v(x1, y1, z1), v(x1, y1, z0), v(x0, y0, z0)];
    // x azalan yönde kuruluyorsa köşe sırası tersine döner, yüzler dışa baksın diye çevrilir.
    this.solid(flip ? [...bottom].reverse() : bottom, flip ? [...top].reverse() : top, new THREE.Color(color));
    return this;
  }

  /** Silindir: y ekseninde dik (silo, direk) veya z ekseninde yatık (tank). (cx, cy, cz) taban veya uç merkezidir. */
  cylinder(cx: number, cy: number, cz: number, radius: number, length: number, axis: 'y' | 'z', color: string, segments = 12) {
    const c = new THREE.Color(color);
    const ring = (t: number) =>
      Array.from({ length: segments }, (_, i) => {
        const a = (i / segments) * Math.PI * 2;
        const u = Math.cos(a) * radius;
        const v = Math.sin(a) * radius;
        return axis === 'y' ? new THREE.Vector3(cx + u, cy + t, cz + v) : new THREE.Vector3(cx + u, cy + v, cz + t);
      });
    const a = ring(0);
    const b = ring(length);
    const center = (t: number) => (axis === 'y' ? new THREE.Vector3(cx, cy + t, cz) : new THREE.Vector3(cx, cy, cz + t));
    for (let i = 0; i < segments; i++) {
      const j = (i + 1) % segments;
      const mid = a[i].clone().add(a[j]).multiplyScalar(0.5).sub(center(0));
      this.face([a[i], a[j], b[j], b[i]], c, mid);
    }
    const axisVector = axis === 'y' ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(0, 0, 1);
    this.face(b, c, axisVector);
    this.face(a, c, axisVector.clone().negate());
    return this;
  }

  build() {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(this.positions, 3));
    geometry.setAttribute('normal', new THREE.Float32BufferAttribute(this.normals, 3));
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(this.colors, 3));
    return geometry;
  }
}
