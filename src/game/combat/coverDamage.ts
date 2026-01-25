import * as THREE from 'three';
import type { Cover } from '../arena/cover';
import type { Entity, TeamId } from '../entities/entityBase';
import { applyExplosion } from './areaDamage';

export function applyDamageToCover(
  scene: THREE.Scene,
  entities: Entity[],
  cover: Cover,
  amount: number,
  options?: { ignite?: boolean; attackerId?: string; attackerTeam?: TeamId }
): void {
  if (!cover.active) return;
  if (!cover.destructible) return;
  if (amount <= 0) return;

  cover.hp = Math.max(0, cover.hp - amount);

  if (options?.ignite && cover.burnable) {
    const burnSeconds = cover.burnSeconds ?? 6;
    cover.burnTimeLeftSeconds = Math.max(cover.burnTimeLeftSeconds ?? 0, burnSeconds);
  }

  if (cover.hp > 0) return;

  cover.active = false;
  scene.remove(cover.mesh);

  if (cover.onDestroyedExplosion) {
    applyExplosion(entities, cover.mesh.position, cover.onDestroyedExplosion.radiusMeters, cover.onDestroyedExplosion.damage, {
      attackerId: options?.attackerId,
      attackerTeam: options?.attackerTeam,
      knockbackDistance: cover.onDestroyedExplosion.knockbackDistance,
      statusEffects: cover.onDestroyedExplosion.statusEffects
    });
  }
}

