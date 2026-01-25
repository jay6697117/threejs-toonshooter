import * as THREE from 'three';

export type ParticleSystem = {
  spawnExplosion: (pos: THREE.Vector3, options?: { color?: number; radius?: number }) => void;
  spawnImpact: (pos: THREE.Vector3, options?: { color?: number }) => void;
  spawnSmoke: (pos: THREE.Vector3, options?: { radius?: number }) => void;
  spawnFire: (pos: THREE.Vector3, options?: { radius?: number }) => void;
  spawnPoison: (pos: THREE.Vector3, options?: { radius?: number }) => void;
  spawnPetals: (pos: THREE.Vector3, options?: { radius?: number }) => void;
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
  baseOpacity: number;
};

export function createParticleSystem(scene: THREE.Scene): ParticleSystem {
  const puffs: Puff[] = [];
  const MAX_PUFFS = 320;
  const MAX_POOL = 180;
  const pool: Array<Pick<Puff, 'mesh' | 'mat'>> = [];
  const sphereGeo = new THREE.SphereGeometry(1, 10, 10);

  const spawn = (pos: THREE.Vector3, opts: { color: number; durationSeconds: number; startScale: number; endScale: number; opacity: number }): void => {
    const pooled = pool.pop();
    const mat = pooled?.mat ?? new THREE.MeshBasicMaterial({ color: opts.color, transparent: true, opacity: opts.opacity });
    mat.color.setHex(opts.color);
    mat.opacity = opts.opacity;

    const mesh = pooled?.mesh ?? new THREE.Mesh(sphereGeo, mat);
    mesh.position.copy(pos);
    mesh.position.y = Math.max(mesh.position.y, 0.05);
    mesh.scale.setScalar(opts.startScale);
    scene.add(mesh);
    puffs.push({
      mesh,
      mat,
      timeLeft: opts.durationSeconds,
      duration: opts.durationSeconds,
      startScale: opts.startScale,
      endScale: opts.endScale,
      baseOpacity: opts.opacity
    });

    while (puffs.length > MAX_PUFFS) {
      const evicted = puffs.shift();
      if (!evicted) break;
      scene.remove(evicted.mesh);
      if (pool.length < MAX_POOL) {
        pool.push({ mesh: evicted.mesh, mat: evicted.mat });
      } else {
        evicted.mat.dispose();
      }
    }
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

  const spawnSmoke = (pos: THREE.Vector3, options?: { radius?: number }): void => {
    const r = options?.radius ?? 1.6;
    spawn(pos, { color: 0xffffff, durationSeconds: 0.9, startScale: r * 0.55, endScale: r, opacity: 0.12 });
    spawn(pos, { color: 0x9aa5b4, durationSeconds: 0.6, startScale: r * 0.35, endScale: r * 0.85, opacity: 0.16 });
  };

  const spawnFire = (pos: THREE.Vector3, options?: { radius?: number }): void => {
    const r = options?.radius ?? 1.2;
    spawn(pos, { color: 0xff6b2d, durationSeconds: 0.55, startScale: r * 0.25, endScale: r, opacity: 0.22 });
    spawn(pos, { color: 0xffc44d, durationSeconds: 0.32, startScale: r * 0.18, endScale: r * 0.7, opacity: 0.25 });
  };

  const spawnPoison = (pos: THREE.Vector3, options?: { radius?: number }): void => {
    const r = options?.radius ?? 1.4;
    spawn(pos, { color: 0x7bff79, durationSeconds: 0.75, startScale: r * 0.4, endScale: r, opacity: 0.18 });
  };

  const spawnPetals = (pos: THREE.Vector3, options?: { radius?: number }): void => {
    const r = options?.radius ?? 1.1;
    spawn(pos, { color: 0xff8cc6, durationSeconds: 0.6, startScale: r * 0.35, endScale: r, opacity: 0.18 });
    spawn(pos, { color: 0xffffff, durationSeconds: 0.4, startScale: r * 0.18, endScale: r * 0.65, opacity: 0.14 });
  };

  const update = (dt: number): void => {
    const remaining: Puff[] = [];
    for (const p of puffs) {
      p.timeLeft -= dt;
      if (p.timeLeft <= 0) {
        scene.remove(p.mesh);
        if (pool.length < MAX_POOL) {
          pool.push({ mesh: p.mesh, mat: p.mat });
        } else {
          p.mat.dispose();
        }
        continue;
      }
      const t = 1 - p.timeLeft / Math.max(1e-6, p.duration);
      const eased = 1 - (1 - t) * (1 - t);
      const scale = p.startScale + (p.endScale - p.startScale) * eased;
      p.mesh.scale.setScalar(scale);
      p.mat.opacity = p.baseOpacity * Math.max(0, 1 - t);
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
    for (const item of pool) {
      item.mat.dispose();
    }
    pool.length = 0;
    sphereGeo.dispose();
  };

  return { spawnExplosion, spawnImpact, spawnSmoke, spawnFire, spawnPoison, spawnPetals, update, dispose };
}
