// Şehir sahnesi için ucuz post-process: bloom ve hafif renk düzeltme. Tilt-shift (üst ve alt bantta bulanıklık) kullanıcı
// isteğiyle bilerek yok.
// Eski yaklaşım (4x MSAA'lı half-float hedef + tam çözünürlükte bloom zinciri) kare süresini ikiye katlıyordu. Burada sahne
// yine doğrudan tuvale, tarayıcının antialias'ıyla ve ton eşlemesiyle çizilir. Hazır kare tek bir kopyayla dokuya alınır,
// bloom yarım, çeyrek ve sekizde bir çözünürlükte çalışır. Tam çözünürlükte yalnızca kopya ve son
// birleştirme geçişi vardır. Bloom LDR (ton eşlenmiş) görüntüden eşikle çıkarılır: yalnızca neredeyse beyaza doymuş
// ışık kaynakları (lambalar, yanan pencereler) parlar.
import * as THREE from 'three';

const QUAD_VERTEX = 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }';

// Dört bilineer okumayla yarıya küçültme (16 texel ortalaması).
const DOWN_FRAGMENT = `varying vec2 vUv; uniform sampler2D tSrc; uniform vec2 uTexel;
  void main(){
    vec4 c = texture2D(tSrc, vUv + uTexel * vec2(-0.5, -0.5)) + texture2D(tSrc, vUv + uTexel * vec2(0.5, -0.5))
      + texture2D(tSrc, vUv + uTexel * vec2(-0.5, 0.5)) + texture2D(tSrc, vUv + uTexel * vec2(0.5, 0.5));
    gl_FragColor = c * 0.25;
  }`;

// Küçültürken yalnızca parlak pikselleri geçirir (yumuşak eşik).
const BRIGHT_FRAGMENT = `varying vec2 vUv; uniform sampler2D tSrc; uniform vec2 uTexel; uniform float uThreshold;
  void main(){
    vec3 c = (texture2D(tSrc, vUv + uTexel * vec2(-0.5, -0.5)).rgb + texture2D(tSrc, vUv + uTexel * vec2(0.5, -0.5)).rgb
      + texture2D(tSrc, vUv + uTexel * vec2(-0.5, 0.5)).rgb + texture2D(tSrc, vUv + uTexel * vec2(0.5, 0.5)).rgb) * 0.25;
    float b = max(c.r, max(c.g, c.b));
    gl_FragColor = vec4(c * smoothstep(uThreshold, uThreshold + 0.22, b), 1.0);
  }`;

// Ayrılabilir 9 dokunuşlu Gauss (5 bilineer okuma).
const BLUR_FRAGMENT = `varying vec2 vUv; uniform sampler2D tSrc; uniform vec2 uStep;
  void main(){
    vec4 c = texture2D(tSrc, vUv) * 0.2270270270;
    c += (texture2D(tSrc, vUv + uStep * 1.3846153846) + texture2D(tSrc, vUv - uStep * 1.3846153846)) * 0.3162162162;
    c += (texture2D(tSrc, vUv + uStep * 3.2307692308) + texture2D(tSrc, vUv - uStep * 3.2307692308)) * 0.0702702703;
    gl_FragColor = c;
  }`;

// Birleştirme: kareye bloom eklenir, sonra hafif kontrast ve doygunluk düzeltmesi. Değerler zaten sRGB'dir, yeniden kodlanmaz.
const COMPOSITE_FRAGMENT = `varying vec2 vUv;
  uniform sampler2D tSharp; uniform sampler2D tBloomA; uniform sampler2D tBloomB;
  uniform float uBloom; uniform float uSat; uniform float uContrast;
  void main(){
    vec3 c = texture2D(tSharp, vUv).rgb;
    c += (texture2D(tBloomA, vUv).rgb * 0.75 + texture2D(tBloomB, vUv).rgb * 0.65) * uBloom;
    c = (c - 0.42) * uContrast + 0.42;
    float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
    c = mix(vec3(l), c, uSat);
    gl_FragColor = vec4(clamp(c, 0.0, 1.0), 1.0);
  }`;

export interface PostFxOptions {
  bloom: number;
}

export class CityPostFx {
  private readonly renderer: THREE.WebGLRenderer;
  private frame: THREE.FramebufferTexture | null = null;
  private readonly targets: Record<'half' | 'bloomA' | 'bloomTmp' | 'bloomB' | 'eighthTmp', THREE.WebGLRenderTarget>;
  private readonly down = new THREE.ShaderMaterial({
    uniforms: { tSrc: { value: null }, uTexel: { value: new THREE.Vector2() } },
    vertexShader: QUAD_VERTEX,
    fragmentShader: DOWN_FRAGMENT,
  });
  private readonly bright = new THREE.ShaderMaterial({
    uniforms: { tSrc: { value: null }, uTexel: { value: new THREE.Vector2() }, uThreshold: { value: 0.68 } },
    vertexShader: QUAD_VERTEX,
    fragmentShader: BRIGHT_FRAGMENT,
  });
  private readonly blur = new THREE.ShaderMaterial({
    uniforms: { tSrc: { value: null }, uStep: { value: new THREE.Vector2() } },
    vertexShader: QUAD_VERTEX,
    fragmentShader: BLUR_FRAGMENT,
  });
  private readonly composite: THREE.ShaderMaterial;
  private readonly quad: THREE.Mesh;
  private readonly quadScene = new THREE.Scene();
  private readonly quadCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  private readonly size = new THREE.Vector2();

  constructor(renderer: THREE.WebGLRenderer, { bloom }: PostFxOptions) {
    this.renderer = renderer;
    const target = () =>
      new THREE.WebGLRenderTarget(1, 1, { depthBuffer: false, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter });
    this.targets = {
      half: target(),
      bloomA: target(),
      bloomTmp: target(),
      bloomB: target(),
      eighthTmp: target(),
    };
    this.composite = new THREE.ShaderMaterial({
      toneMapped: false,
      uniforms: {
        tSharp: { value: null },
        tBloomA: { value: this.targets.bloomA.texture },
        tBloomB: { value: this.targets.bloomB.texture },
        uBloom: { value: bloom },
        uSat: { value: 0.96 },
        uContrast: { value: 1.05 },
      },
      vertexShader: QUAD_VERTEX,
      fragmentShader: COMPOSITE_FRAGMENT,
    });
    for (const material of [this.down, this.bright, this.blur, this.composite]) {
      material.depthTest = false;
      material.depthWrite = false;
    }
    this.quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.down);
    this.quad.frustumCulled = false;
    this.quadScene.add(this.quad);
  }

  /** Çizim tamponu ölçüsü (piksel, dpr dahil). */
  setSize(width: number, height: number) {
    if (this.size.x === width && this.size.y === height) return;
    this.size.set(width, height);
    this.frame?.dispose();
    this.frame = new THREE.FramebufferTexture(width, height);
    this.frame.minFilter = THREE.LinearFilter;
    this.frame.magFilter = THREE.LinearFilter;
    this.composite.uniforms.tSharp.value = this.frame;
    const half = [Math.max(1, Math.round(width / 2)), Math.max(1, Math.round(height / 2))] as const;
    const quarter = [Math.max(1, Math.round(width / 4)), Math.max(1, Math.round(height / 4))] as const;
    const eighth = [Math.max(1, Math.round(width / 8)), Math.max(1, Math.round(height / 8))] as const;
    const { targets } = this;
    targets.half.setSize(...half);
    for (const key of ['bloomA', 'bloomTmp'] as const) targets[key].setSize(...quarter);
    for (const key of ['bloomB', 'eighthTmp'] as const) targets[key].setSize(...eighth);
  }

  private pass(material: THREE.ShaderMaterial, target: THREE.WebGLRenderTarget | null) {
    this.quad.material = material;
    this.renderer.setRenderTarget(target);
    this.renderer.render(this.quadScene, this.quadCamera);
  }

  private downsample(source: THREE.Texture, sourceSize: { x: number; y: number }, target: THREE.WebGLRenderTarget, material = this.down) {
    material.uniforms.tSrc.value = source;
    material.uniforms.uTexel.value.set(1 / sourceSize.x, 1 / sourceSize.y);
    this.pass(material, target);
  }

  private gaussian(target: THREE.WebGLRenderTarget, temp: THREE.WebGLRenderTarget, spread: number) {
    const { blur } = this;
    blur.uniforms.tSrc.value = target.texture;
    blur.uniforms.uStep.value.set(spread / target.width, 0);
    this.pass(blur, temp);
    blur.uniforms.tSrc.value = temp.texture;
    blur.uniforms.uStep.value.set(0, spread / target.height);
    this.pass(blur, target);
  }

  render(scene: THREE.Scene, camera: THREE.Camera) {
    const { renderer, targets, frame } = this;
    renderer.setRenderTarget(null);
    renderer.render(scene, camera);
    if (!frame) return;
    renderer.copyFramebufferToTexture(frame);

    const half = { x: targets.half.width, y: targets.half.height };
    this.downsample(frame, this.size, targets.half);
    // Bloom: çeyrekte dar, sekizde birde geniş hale.
    this.downsample(targets.half.texture, half, targets.bloomA, this.bright);
    this.gaussian(targets.bloomA, targets.bloomTmp, 1.0);
    this.downsample(targets.bloomA.texture, { x: targets.bloomA.width, y: targets.bloomA.height }, targets.bloomB);
    this.gaussian(targets.bloomB, targets.eighthTmp, 1.2);

    this.pass(this.composite, null);
  }

  dispose() {
    this.frame?.dispose();
    for (const target of Object.values(this.targets)) target.dispose();
    for (const material of [this.down, this.bright, this.blur, this.composite]) material.dispose();
    this.quad.geometry.dispose();
  }
}
