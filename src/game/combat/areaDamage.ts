import * as THREE from 'three';
import type { StatusEffectId } from '../config/ids';
import type { Entity, TeamId } from '../entities/entityBase';
import { dealDamage, type DamageSource } from './damage';
import { applyStatus } from './statusEffects';

export type ExplosionOptions = {
  attackerId?: string;
  attackerTeam?: TeamId;
  falloff?: 'linear';
  friendlyFireMultiplier?: number;
  knockbackDistance?: number;
  statusEffects?: Array<{ id: StatusEffectId; durationSeconds?: number }>;
};

export function applyExplosion(
  entities: Entity[],
  center: THREE.Vector3,
  radius: number,
  maxDamage: number,
  options?: ExplosionOptions
): void {
  const friendlyMul = options?.friendlyFireMultiplier ?? 0.0;
  const knockback = options?.knockbackDistance ?? 0;

  for (const entity of entities) {
    if (entity.eliminated) continue;

    const dist = entity.position.distanceTo(center);
    if (dist > radius) continue;

    const falloff = 1 - dist / radius;
    const dmg = maxDamage * Math.max(0, Math.min(1, falloff));

    const isFriendly = options?.attackerTeam !== undefined && entity.team === options.attackerTeam;
    const finalDamage = dmg * (isFriendly ? friendlyMul : 1.0);

    const source: DamageSource = { attackerId: options?.attackerId, attackerTeam: options?.attackerTeam, isDot: false };
    if (finalDamage > 0) dealDamage(entity, finalDamage, source);

    if (options?.statusEffects) {
      for (const eff of options.statusEffects) {
        applyStatus(entity, eff.id, eff.durationSeconds);
      }
    }

    if (knockback > 0) {
      const dir = entity.position.clone().sub(center);
      dir.y = 0;
      if (dir.lengthSq() > 1e-6) {
        dir.normalize();
        entity.position.addScaledVector(dir, knockback * falloff);
      }
    }
  }
}
