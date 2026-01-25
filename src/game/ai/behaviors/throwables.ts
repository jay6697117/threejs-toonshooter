import * as THREE from 'three';
import type { Entity } from '../../entities/entityBase';
import type { World } from '../../core/world';
import type { MatchRuntime } from '../../modes/modeManager';
import type { Rng } from '../../core/rng';

export function decideThrowableUse(options: {
  self: Entity;
  world: World;
  match: MatchRuntime;
  target: Entity | null;
  goal: THREE.Vector3 | null;
  rng: Rng;
}): { throwRequested: boolean; aimPoint: THREE.Vector3 | null } {
  const { self, target, goal } = options;
  if (self.eliminated) return { throwRequested: false, aimPoint: null };

  const hasThrowable = self.throwableSlots.some((s) => (s?.count ?? 0) > 0);
  if (!hasThrowable) return { throwRequested: false, aimPoint: null };

  if (options.match.state.modeId === 'ctf' && self.carryingFlag) {
    return { throwRequested: false, aimPoint: null };
  }

  if (!target) return { throwRequested: false, aimPoint: goal };

  const distSq = target.position.distanceToSquared(self.position);
  if (distSq > 11 * 11) return { throwRequested: false, aimPoint: goal };

  const throwRequested = options.rng.nextFloat() < 0.012;
  const aimPoint = new THREE.Vector3(target.position.x, 0.05, target.position.z);
  return { throwRequested, aimPoint };
}
