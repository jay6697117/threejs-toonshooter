import * as THREE from 'three';

export type FixedLoopCallbacks = {
  onBeginFrame?: (frameDt: number) => void;
  onStep: (fixedDt: number) => void;
  onFrame: (alpha: number) => void;
};

export type FixedLoopOptions = {
  clock: THREE.Clock;
  fixedDt: number;
  maxFrameDt?: number;
  getTimeScale?: () => number;
};

export function startFixedLoop(options: FixedLoopOptions, callbacks: FixedLoopCallbacks): () => void {
  const maxFrameDt = options.maxFrameDt ?? 0.1;
  let accumulator = 0;
  let rafId = 0;

  const frame = (): void => {
    const rawFrameDt = Math.min(options.clock.getDelta(), maxFrameDt);
    callbacks.onBeginFrame?.(rawFrameDt);
    accumulator += rawFrameDt;

    while (accumulator >= options.fixedDt) {
      const timeScaleRaw = options.getTimeScale?.() ?? 1;
      const timeScale = Number.isFinite(timeScaleRaw) ? Math.max(0, Math.min(3, timeScaleRaw)) : 1;
      callbacks.onStep(options.fixedDt * timeScale);
      accumulator -= options.fixedDt;
    }

    const alpha = options.fixedDt > 0 ? accumulator / options.fixedDt : 1;
    callbacks.onFrame(alpha);
    rafId = window.requestAnimationFrame(frame);
  };

  rafId = window.requestAnimationFrame(frame);
  return () => window.cancelAnimationFrame(rafId);
}
