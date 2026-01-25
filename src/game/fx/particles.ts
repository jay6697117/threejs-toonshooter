import * as THREE from 'three';

export type ParticleSystem = {
  spawnExplosion: (pos: THREE.Vector3, options?: { color?: number; radius?: number }) => void;
  spawnImpact: (pos: THREE.Vector3, options?: { color?: number }) => void;
  update: (dt: number) => void;
  dispose: () => void;
};

type Puff = {
  mesh: THREE.Mesh;
  mat: THREE.MeshBasicMaterial;
  timeLeft: number;
  duration: number;
  startScale: number;
  endScale: number;
};

export function createParticleSystem(scene: THREE.Scene): ParticleSystem {
  const puffs: Puff[] = [];
  const sphereGeo = new THREE.SphereGeometry(1, 10, 10);

  const spawn = (pos: THREE.Vector3, opts: { color: number; durationSeconds: number; startScale: number; endScale: number; opacity: number }): void => {
    const mat = new THREE.MeshBasicMaterial({ color: opts.color, transparent: true, opacity: opts.opacity });
    const mesh = new THREE.Mesh(sphereGeo, mat);
    mesh.position.copy(pos);
    mesh.position.y = Math.max(mesh.position.y, 0.05);
    mesh.scale.setScalar(opts.startScale);
    scene.add(mesh);
    puffs.push({ mesh, mat, timeLeft: opts.durationSeconds, duration: opts.durationSeconds, startScale: opts.startScale, endScale: opts.endScale });
  };

  const spawnExplosion = (pos: THREE.Vector3, options?: { color?: number; radius?: number }): void => {
    const color = options?.color ?? 0xffc44d;
    const r = options?.radius ?? 1.4;
    spawn(pos, { color, durationSeconds: 0.35, startScale: r * 0.4, endScale: r, opacity: 0.55 });
    spawn(pos, { color: 0xffffff, durationSeconds: 0.18, startScale: r * 0.15, endScale: r * 0.55, opacity: 0.75 });
  };

  const spawnImpact = (pos: THREE.Vector3, options?: { color?: number }): void => {
    const color = options?.color ?? 0x79d5ff;
    spawn(pos, { color, durationSeconds: 0.18, startScale: 0.12, endScale: 0.32, opacity: 0.65 });
  };

  const update = (dt: number): void => {
    const remaining: Puff[] = [];
    for (const p of puffs) {
      p.timeLeft -= dt;
      if (p.timeLeft <= 0) {
        scene.remove(p.mesh);
        p.mat.dispose();
        continue;
      }
      const t = 1 - p.timeLeft / Math.max(1e-6, p.duration);
      const eased = 1 - (1 - t) * (1 - t);
      const scale = p.startScale + (p.endScale - p.startScale) * eased;
      p.mesh.scale.setScalar(scale);
      p.mat.opacity = Math.max(0, 1 - t) * 0.7;
      remaining.push(p);
    }
    puffs.length = 0;
    puffs.push(...remaining);
  };

  const dispose = (): void => {
    for (const p of puffs) {
      scene.remove(p.mesh);
      p.mat.dispose();
    }
    puffs.length = 0;
    sphereGeo.dispose();
  };

  return { spawnExplosion, spawnImpact, update, dispose };
}

