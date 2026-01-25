import * as THREE from 'three';
import type { WeaponId } from '../config/ids';
import { WEAPON_CONFIGS } from '../config/weapons';

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
  mesh: THREE.Mesh;
  mat: THREE.MeshBasicMaterial;
  timeLeft: number;
  duration: number;
};

export function getTracerStyleForWeapon(weaponId: WeaponId): TracerStyle {
  const cfg = WEAPON_CONFIGS[weaponId];
  const pellets = cfg.damage.kind === 'flat' ? (cfg.damage.pellets ?? 1) : 1;

  const base =
    cfg.category === 'melee'
      ? { color: 0xbcc6d8, width: 0.026, durationSeconds: 0.075 }
      : cfg.category === 'mid'
        ? { color: 0x79d5ff, width: 0.03, durationSeconds: 0.085 }
        : cfg.category === 'ranged'
          ? { color: 0xffc44d, width: 0.034, durationSeconds: 0.095 }
          : { color: 0xff6b6b, width: 0.038, durationSeconds: 0.105 };

  const pelletFactor = pellets > 1 ? 0.78 : 1;
  return {
    color: base.color,
    width: base.width * pelletFactor,
    durationSeconds: base.durationSeconds * pelletFactor
  };
}

export function createTracerSystem(scene: THREE.Scene): TracerSystem {
  const tracers: Tracer[] = [];
  const MAX_TRACERS = 220;
  const MAX_POOL = 120;
  const pool: Array<Pick<Tracer, 'mesh' | 'mat'>> = [];
  const geo = new THREE.CylinderGeometry(1, 1, 1, 6, 1, true);
  const up = new THREE.Vector3(0, 1, 0);

  const spawn = (from: THREE.Vector3, to: THREE.Vector3, style: TracerStyle): void => {
    const delta = to.clone().sub(from);
    const len = delta.length();
    if (!Number.isFinite(len) || len <= 1e-4) return;

    const mid = from.clone().add(to).multiplyScalar(0.5);
    const pooled = pool.pop();
    const mat = pooled?.mat ?? new THREE.MeshBasicMaterial({ color: style.color, transparent: true, opacity: 0.9, depthWrite: false });
    mat.color.setHex(style.color);
    mat.opacity = 0.9;

    const mesh = pooled?.mesh ?? new THREE.Mesh(geo, mat);
    mesh.position.copy(mid);
    mesh.scale.set(style.width, len, style.width);
    mesh.quaternion.setFromUnitVectors(up, delta.normalize());
    mesh.frustumCulled = false;
    scene.add(mesh);
    tracers.push({ mesh, mat, timeLeft: style.durationSeconds, duration: style.durationSeconds });

    while (tracers.length > MAX_TRACERS) {
      const evicted = tracers.shift();
      if (!evicted) break;
      scene.remove(evicted.mesh);
      if (pool.length < MAX_POOL) {
        pool.push({ mesh: evicted.mesh, mat: evicted.mat });
      } else {
        evicted.mat.dispose();
      }
    }
  };

  const update = (dt: number): void => {
    const remaining: Tracer[] = [];
    for (const t of tracers) {
      t.timeLeft -= dt;
      if (t.timeLeft <= 0) {
        scene.remove(t.mesh);
        if (pool.length < MAX_POOL) {
          pool.push({ mesh: t.mesh, mat: t.mat });
        } else {
          t.mat.dispose();
        }
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
      scene.remove(t.mesh);
      t.mat.dispose();
    }
    tracers.length = 0;
    for (const item of pool) {
      item.mat.dispose();
    }
    pool.length = 0;
    geo.dispose();
  };

  return { spawn, update, dispose };
}
