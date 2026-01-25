import type { WeaponId } from '../config/ids';
import type { Entity, TeamId } from '../entities/entityBase';
import { computeStatusDerived } from './statusEffects';

export type DamageSource = {
  attackerId?: string;
  attackerTeam?: TeamId;
  weaponId?: WeaponId;
  isDot?: boolean;
};

export function dealDamage(target: Entity, baseAmount: number, source?: DamageSource): number {
  if (target.eliminated) return 0;
  if (baseAmount <= 0) return 0;

  const derived = computeStatusDerived(target);
  const amount = baseAmount * derived.damageTakenMultiplier;

  target.hp = Math.max(0, target.hp - amount);
  if (target.hp === 0) {
    target.eliminated = true;
  }

  // TODO: hook killfeed, hit flash, screen shake, score events.
  void source;
  return amount;
}

