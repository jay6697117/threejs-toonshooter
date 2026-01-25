import * as THREE from 'three';
import type { Entity } from '../../entities/entityBase';
import type { World } from '../../core/world';

export function pickSiegeGoal(self: Entity, world: World): THREE.Vector3 | null {
  const cp = world.arena?.objectives?.siege?.capturePoint;
  if (!cp) return null;
  return new THREE.Vector3(cp.x, self.position.y, cp.z);
}

