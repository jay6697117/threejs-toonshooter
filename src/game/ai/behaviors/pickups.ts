import * as THREE from 'three';
import type { Entity } from '../../entities/entityBase';
import type { World } from '../../core/world';

export function pickHealthPickupGoal(self: Entity, world: World): THREE.Vector3 | null {
  if (self.eliminated) return null;
  if (self.maxHp <= 0) return null;
  if (self.hp / self.maxHp >= 0.55) return null;

  let best: THREE.Vector3 | null = null;
  let bestDistSq = Number.POSITIVE_INFINITY;

  for (const p of world.pickups) {
    if (!p.active) continue;
    if (p.kind !== 'health') continue;
    const dx = p.position.x - self.position.x;
    const dz = p.position.z - self.position.z;
    const distSq = dx * dx + dz * dz;
    if (distSq < bestDistSq) {
      bestDistSq = distSq;
      best = p.position;
    }
  }

  return best ? best.clone().setY(self.position.y) : null;
}

