import * as THREE from 'three';

export type ArenaBounds = {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
};

export type Aabb2 = {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
};

export function clampToBounds(pos: THREE.Vector3, bounds: ArenaBounds, radius: number): void {
  pos.x = Math.max(bounds.minX + radius, Math.min(bounds.maxX - radius, pos.x));
  pos.z = Math.max(bounds.minZ + radius, Math.min(bounds.maxZ - radius, pos.z));
}

export function resolveCircleVsAabb(pos: THREE.Vector3, radius: number, box: Aabb2): boolean {
  const closestX = clamp(pos.x, box.minX, box.maxX);
  const closestZ = clamp(pos.z, box.minZ, box.maxZ);
  const dx = pos.x - closestX;
  const dz = pos.z - closestZ;
  const distSq = dx * dx + dz * dz;
  if (distSq >= radius * radius) return false;

  const dist = Math.sqrt(Math.max(1e-8, distSq));
  const push = radius - dist;
  pos.x += (dx / dist) * push;
  pos.z += (dz / dist) * push;
  return true;
}

export function resolveCircleVsCircle(aPos: THREE.Vector3, aRadius: number, bPos: THREE.Vector3, bRadius: number): boolean {
  const dx = aPos.x - bPos.x;
  const dz = aPos.z - bPos.z;
  const minDist = aRadius + bRadius;
  const distSq = dx * dx + dz * dz;
  if (distSq >= minDist * minDist) return false;

  const dist = Math.sqrt(Math.max(1e-8, distSq));
  const push = (minDist - dist) * 0.5;
  const nx = dx / dist;
  const nz = dz / dist;

  aPos.x += nx * push;
  aPos.z += nz * push;
  bPos.x -= nx * push;
  bPos.z -= nz * push;
  return true;
}

export function computeAabbFromBox3(box: THREE.Box3): Aabb2 {
  return {
    minX: box.min.x,
    maxX: box.max.x,
    minZ: box.min.z,
    maxZ: box.max.z
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

