import * as THREE from 'three';
import { createBoxCover, type Cover } from '../arena/cover';
import type { Entity, TeamId } from '../entities/entityBase';
import type { Rng } from '../core/rng';
import { applyExplosion } from './areaDamage';

export function applyDamageToCover(
  scene: THREE.Scene,
  entities: Entity[],
  covers: Cover[],
  cover: Cover,
  amount: number,
  options?: { ignite?: boolean; attackerId?: string; attackerTeam?: TeamId; rng?: Rng }
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

  if (cover.onDestroyedSpawnCover) {
    const idSuffix = options?.rng ? options.rng.nextUint32().toString(36) : String(Math.floor(Math.random() * 1e9));
    const spawned = createBoxCover({
      id: `${cover.id}_spawn_${idSuffix}`,
      size: cover.onDestroyedSpawnCover.size,
      pos: cover.mesh.position.clone(),
      color: cover.onDestroyedSpawnCover.color,
      hp: cover.onDestroyedSpawnCover.hp
    });
    spawned.timeLeftSeconds = cover.onDestroyedSpawnCover.timeLeftSeconds;
    scene.add(spawned.mesh);
    covers.push(spawned);
  }
}
