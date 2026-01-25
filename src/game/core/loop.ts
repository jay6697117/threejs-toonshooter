import * as THREE from 'three';

export type FixedLoopCallbacks = {
  onStep: (fixedDt: number) => void;
  onFrame: (alpha: number) => void;
};

export type FixedLoopOptions = {
  clock: THREE.Clock;
  fixedDt: number;
  maxFrameDt?: number;
};

export function startFixedLoop(options: FixedLoopOptions, callbacks: FixedLoopCallbacks): () => void {
  const maxFrameDt = options.maxFrameDt ?? 0.1;
  let accumulator = 0;
  let rafId = 0;

  const frame = (): void => {
    const frameDt = Math.min(options.clock.getDelta(), maxFrameDt);
    accumulator += frameDt;

    while (accumulator >= options.fixedDt) {
      callbacks.onStep(options.fixedDt);
      accumulator -= options.fixedDt;
    }

    const alpha = options.fixedDt > 0 ? accumulator / options.fixedDt : 1;
    callbacks.onFrame(alpha);
    rafId = window.requestAnimationFrame(frame);
  };

  rafId = window.requestAnimationFrame(frame);
  return () => window.cancelAnimationFrame(rafId);
}

