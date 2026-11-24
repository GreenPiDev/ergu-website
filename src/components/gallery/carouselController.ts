import { gsap } from '../../animations/gsap';

/** Negatif sayılarda da 0..n-1 aralığında kalan mod. */
export function wrapIndex(value: number, count: number): number {
  return ((value % count) + count) % count;
}

// Tekerlek bırakıldıktan bu kadar sonra silindir en yakın fotoğrafa oturur.
const SETTLE_DELAY_MS = 160;
// Takip yumuşaklığı (1/sn): büyüdükçe silindir hedefe daha sıkı bağlanır. Sürüklerken parmağın altında durmalı.
const FOLLOW_RATE = 8;
const DRAG_FOLLOW_RATE = 24;
// Bırakılan sürüklemenin savrulması: hız (fotoğraf/sn) × bu süre kadar ileri gider.
const FLING_TIME = 0.32;
const MAX_FLING = 12;
// Thumbnail ile uzak bir fotoğrafa giderken süre mesafeyle büyür ama sınırlıdır.
const SLIDE_MIN = 0.6;
const SLIDE_MAX = 2.2;
const SLIDE_PER_SQRT_ITEM = 0.3;

/**
 * Silindirin konumu. `position` sürekli bir sayıdır (fotoğraf cinsinden, sonsuz döngü için sınırsız),
 * tam sayıya denk geldiğinde o fotoğraf tam öndedir. Kare döngüsü (`update`) WebGL tarafında çalışır.
 */
export class CarouselController {
  position = 0;
  target = 0;
  private reducedMotion = false;

  private count: number;
  private tween: gsap.core.Tween | null = null;
  private slideDestination = 0;
  private dragging = false;
  private dragOrigin = 0;
  private settleTimer = 0;
  private activeRaw = 0;
  private readonly onActiveChange: (index: number) => void;

  constructor(count: number, onActiveChange: (index: number) => void) {
    this.count = Math.max(1, count);
    this.onActiveChange = onActiveChange;
  }

  setReducedMotion(reduced: boolean) {
    this.reducedMotion = reduced;
  }

  /** Öndeki fotoğrafın sonsuz dizideki sırası. */
  get activeRawIndex(): number {
    return this.activeRaw;
  }

  get isDragging(): boolean {
    return this.dragging;
  }

  update(delta: number) {
    if (!this.tween) {
      const rate = this.dragging ? DRAG_FOLLOW_RATE : FOLLOW_RATE;
      const distance = this.target - this.position;
      this.position = Math.abs(distance) < 1e-4 ? this.target : this.position + distance * (1 - Math.exp(-delta * rate));
    }

    const raw = Math.round(this.position);
    if (raw !== this.activeRaw) {
      this.activeRaw = raw;
      this.onActiveChange(wrapIndex(raw, this.count));
    }
  }

  /** Tekerlek veya trackpad: silindir serbestçe döner, durunca en yakın fotoğrafa oturur. */
  nudge(items: number) {
    this.stopSlide();
    this.target += items;
    window.clearTimeout(this.settleTimer);
    this.settleTimer = window.setTimeout(() => {
      this.target = Math.round(this.target);
    }, SETTLE_DELAY_MS);
  }

  dragStart() {
    this.stopSlide();
    window.clearTimeout(this.settleTimer);
    this.dragging = true;
    this.dragOrigin = this.position;
    this.target = this.position;
  }

  /** offset: sürükleme başından beri kaç fotoğraf kaydırıldığı. */
  dragMove(offset: number) {
    if (this.dragging) this.target = this.dragOrigin + offset;
  }

  /** velocity: bırakma anındaki hız (fotoğraf/sn). */
  dragEnd(velocity: number) {
    if (!this.dragging) return;
    this.dragging = false;
    const fling = gsap.utils.clamp(-MAX_FLING, MAX_FLING, velocity * FLING_TIME);
    this.target = Math.round(this.target + (this.reducedMotion ? 0 : fling));
  }

  /** Oklar: art arda basışlar birikir, her biri bir fotoğraf ilerletir. */
  step(direction: 1 | -1) {
    const base = this.tween ? this.slideDestination : Math.round(this.target);
    this.slideTo(base + direction);
  }

  /** Sıradaki bir fotoğrafa en kısa yönden kayarak gider (thumbnail). */
  goTo(index: number) {
    const base = Math.round(this.target);
    let diff = wrapIndex(index - wrapIndex(base, this.count), this.count);
    if (diff > this.count / 2) diff -= this.count;
    this.slideTo(base + diff);
  }

  /** Sonsuz dizideki bir sıraya kayarak gider (silindirde yan fotoğrafa tıklama). */
  goToRaw(raw: number) {
    this.slideTo(raw);
  }

  /** Kaymadan, anında konumlanır (tam ekran görünümde gezinirken silindir arkada aynı fotoğrafa geçer). */
  jumpTo(index: number) {
    this.stopSlide();
    const base = Math.round(this.target);
    let diff = wrapIndex(index - wrapIndex(base, this.count), this.count);
    if (diff > this.count / 2) diff -= this.count;
    this.position = this.target = base + diff;
  }

  destroy() {
    this.stopSlide();
    window.clearTimeout(this.settleTimer);
  }

  private slideTo(destination: number) {
    this.stopSlide();
    window.clearTimeout(this.settleTimer);
    this.target = destination;
    this.slideDestination = destination;
    const distance = Math.abs(destination - this.position);
    if (distance < 1e-3) return;
    if (this.reducedMotion) {
      this.position = destination;
      return;
    }

    const duration = gsap.utils.clamp(SLIDE_MIN, SLIDE_MAX, SLIDE_MIN + SLIDE_PER_SQRT_ITEM * (Math.sqrt(distance) - 1));
    this.tween = gsap.to(this, {
      position: destination,
      duration,
      ease: 'power3.inOut',
      onComplete: () => {
        this.tween = null;
      },
    });
  }

  private stopSlide() {
    if (!this.tween) return;
    this.tween.kill();
    this.tween = null;
    this.target = this.position;
  }
}
