import * as THREE from 'three';

export type TracerStyle = {
  color: number;
  width: number;
  durationSeconds: number;
};

export type TracerSystem = {
  spawn: (from: THREE.Vector3, to: THREE.Vector3, style: TracerStyle) => void;
  update: (dt: number) => void;
  dispose: () => void;
};

type Tracer = {
  line: THREE.Line;
  mat: THREE.LineBasicMaterial;
  timeLeft: number;
  duration: number;
};

export function createTracerSystem(scene: THREE.Scene): TracerSystem {
  const tracers: Tracer[] = [];

  const spawn = (from: THREE.Vector3, to: THREE.Vector3, style: TracerStyle): void => {
    const geo = new THREE.BufferGeometry().setFromPoints([from.clone(), to.clone()]);
    const mat = new THREE.LineBasicMaterial({ color: style.color, transparent: true, opacity: 0.9 });
    const line = new THREE.Line(geo, mat);
    scene.add(line);
    tracers.push({ line, mat, timeLeft: style.durationSeconds, duration: style.durationSeconds });
  };

  const update = (dt: number): void => {
    const remaining: Tracer[] = [];
    for (const t of tracers) {
      t.timeLeft -= dt;
      if (t.timeLeft <= 0) {
        scene.remove(t.line);
        t.line.geometry.dispose();
        t.mat.dispose();
        continue;
      }
      const alpha = Math.max(0, Math.min(1, t.timeLeft / Math.max(1e-6, t.duration)));
      t.mat.opacity = 0.15 + alpha * 0.75;
      remaining.push(t);
    }
    tracers.length = 0;
    tracers.push(...remaining);
  };

  const dispose = (): void => {
    for (const t of tracers) {
      scene.remove(t.line);
      t.line.geometry.dispose();
      t.mat.dispose();
    }
    tracers.length = 0;
  };

  return { spawn, update, dispose };
}

