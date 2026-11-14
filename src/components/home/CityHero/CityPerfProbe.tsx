// Geliştirmeye özel kare ölçümü (`?perf=1`): konsola iki saniyede bir tek satır yazar. Kare aralığı (tarayıcının gerçek
// kare hızı), ana iş parçacığında karenin süresi, ekran kartı süresi (tarayıcı destekliyorsa), çizim çağrısı ve üçgen.
import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useRef } from 'react';
import type * as THREE from 'three';

const REPORT_INTERVAL = 2000;

/** EXT_disjoint_timer_query_webgl2 sabitleri (lib.dom'da tür yok). */
interface TimerQueryExtension {
  TIME_ELAPSED_EXT: number;
  GPU_DISJOINT_EXT: number;
}

const percentile = (values: number[], p: number) => {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * p))];
};

class FrameMonitor {
  private readonly renderer: THREE.WebGLRenderer;
  private readonly webgl2: WebGL2RenderingContext | null;
  private readonly timer: TimerQueryExtension | null;
  private readonly channel = new MessageChannel();
  private active: WebGLQuery | null = null;
  private readonly pending: WebGLQuery[] = [];
  private readonly frames: number[] = [];
  private readonly cpu: number[] = [];
  private readonly gpu: number[] = [];
  private readonly calls: number[] = [];
  private readonly triangles: number[] = [];
  private last = 0;
  private reported = performance.now();
  private frameStart = 0;

  constructor(renderer: THREE.WebGLRenderer) {
    this.renderer = renderer;
    const context = renderer.getContext();
    this.webgl2 = typeof WebGL2RenderingContext !== 'undefined' && context instanceof WebGL2RenderingContext ? context : null;
    this.timer = this.webgl2 ? (this.webgl2.getExtension('EXT_disjoint_timer_query_webgl2') as TimerQueryExtension | null) : null;
    // Kare çağrısının sonunda gönderilen mesaj, ana iş parçacığı karenin işini bitirince işlenir: aradaki süre karenin
    // ana iş parçacığı maliyetidir (yaklaşık, çizim komutlarının gönderimi ve imlecin güncellenmesi dahil).
    this.channel.port1.onmessage = () => this.cpu.push(performance.now() - this.frameStart);
    // Sayılar karenin bütün çizimlerini (gölge, sahne, post-process geçişleri) toplasın.
    renderer.info.autoReset = false;
  }

  /** Karenin başında: önceki karenin sayılarını toplar, bu karenin ölçümünü başlatır. Ekran kartı sorgusu bir sonraki
   *  karenin başında kapanır, aradaki bütün çizim komutlarını kapsar. */
  frame() {
    const now = performance.now();
    const { renderer, webgl2, timer } = this;
    if (this.last > 0) {
      this.frames.push(now - this.last);
      this.calls.push(renderer.info.render.calls);
      this.triangles.push(renderer.info.render.triangles);
    }
    this.last = now;
    renderer.info.reset();

    if (webgl2 && timer) {
      if (this.active) {
        webgl2.endQuery(timer.TIME_ELAPSED_EXT);
        this.pending.push(this.active);
      }
      const disjoint = webgl2.getParameter(timer.GPU_DISJOINT_EXT) as boolean;
      while (this.pending.length > 0) {
        const query = this.pending[0];
        if (!webgl2.getQueryParameter(query, webgl2.QUERY_RESULT_AVAILABLE)) break;
        const elapsed = webgl2.getQueryParameter(query, webgl2.QUERY_RESULT) as number;
        if (!disjoint) this.gpu.push(elapsed / 1e6);
        webgl2.deleteQuery(query);
        this.pending.shift();
      }
      this.active = webgl2.createQuery();
      if (this.active) webgl2.beginQuery(timer.TIME_ELAPSED_EXT, this.active);
    }

    this.frameStart = now;
    this.channel.port2.postMessage(0);
    if (now - this.reported >= REPORT_INTERVAL && this.frames.length > 0) this.report(now);
  }

  private report(now: number) {
    this.reported = now;
    const fps = 1000 / (this.frames.reduce((sum, value) => sum + value, 0) / this.frames.length);
    const gpu =
      this.gpu.length > 0 ? `${percentile(this.gpu, 0.5).toFixed(1)} / ${percentile(this.gpu, 0.95).toFixed(1)} ms` : 'yok';
    console.info(
      `[perf] fps ${fps.toFixed(0)} | kare ${percentile(this.frames, 0.5).toFixed(1)} / p95 ${percentile(this.frames, 0.95).toFixed(1)} ms` +
        ` | ana iş ${percentile(this.cpu, 0.5).toFixed(1)} / ${percentile(this.cpu, 0.95).toFixed(1)} ms` +
        ` | GPU ${gpu} | çağrı ${percentile(this.calls, 0.5)} | üçgen ${Math.round(percentile(this.triangles, 0.5) / 1000)}k`,
    );
    for (const list of [this.frames, this.cpu, this.gpu, this.calls, this.triangles]) list.length = 0;
  }

  dispose() {
    this.channel.port1.onmessage = null;
    if (this.webgl2 && this.timer && this.active) this.webgl2.endQuery(this.timer.TIME_ELAPSED_EXT);
    this.active = null;
    for (const query of this.pending) this.webgl2?.deleteQuery(query);
    this.pending.length = 0;
    this.renderer.info.autoReset = true;
  }
}

export function CityPerfProbe() {
  const { gl } = useThree();
  const monitor = useRef<FrameMonitor | null>(null);
  useEffect(() => {
    const created = new FrameMonitor(gl);
    monitor.current = created;
    return () => {
      created.dispose();
      monitor.current = null;
    };
  }, [gl]);
  // En önce çalışır (negatif öncelik R3F'in çizimini devralmaz), çizim komutları bu çağrıdan sonra gelir.
  useFrame(() => monitor.current?.frame(), -1000);
  return null;
}
