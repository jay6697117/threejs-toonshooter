import * as THREE from 'three';
import type { Entity } from '../../entities/entityBase';
import type { World } from '../../core/world';
import type { MatchRuntime } from '../../modes/modeManager';

export function pickCtfGoal(self: Entity, world: World, match: MatchRuntime, targetFallback: Entity | null): THREE.Vector3 | null {
  const obj = world.arena?.objectives?.ctf;
  if (!obj) return targetFallback?.position ?? null;
  if (self.team !== 'red' && self.team !== 'blue') return targetFallback?.position ?? null;

  if (self.carryingFlag) {
    const base = self.team === 'red' ? obj.redBase : obj.blueBase;
    return new THREE.Vector3(base.x, self.position.y, base.z);
  }

  if (match.state.modeId !== 'ctf') return targetFallback?.position ?? null;

  const enemyTeam = self.team === 'red' ? 'blue' : 'red';
  const enemyFlag = enemyTeam === 'red' ? match.state.flags.red : match.state.flags.blue;
  return new THREE.Vector3(enemyFlag.pos.x, self.position.y, enemyFlag.pos.z);
}

