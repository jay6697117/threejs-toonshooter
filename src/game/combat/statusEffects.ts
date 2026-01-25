import { STATUS_EFFECTS } from '../config/statusEffects';
import type { StatusEffectId } from '../config/ids';
import type { Entity } from '../entities/entityBase';

export type StatusDerived = {
  speedMultiplier: number;
  damageTakenMultiplier: number;
  isStunned: boolean;
  isRooted: boolean;
  isKnockedDown: boolean;
  blocksHealing: boolean;
  isBlinded: boolean;
};

export function applyStatus(entity: Entity, id: StatusEffectId, durationOverrideSeconds?: number): void {
  const cfg = STATUS_EFFECTS[id];

  if (cfg.kind === 'impulse' || cfg.kind === 'armorIgnoreFraction') {
    return;
  }

  const durationSeconds =
    durationOverrideSeconds ??
    (typeof cfg.durationSeconds === 'number' ? cfg.durationSeconds : cfg.durationSeconds.max);

  const existing = entity.statuses.get(id);
  const stacking = 'stacking' in cfg ? cfg.stacking : undefined;

  if (existing) {
    if (stacking === 'none') return;
    existing.timeLeft = durationSeconds;
    return;
  }

  entity.statuses.set(id, { id, timeLeft: durationSeconds });
}

export function hasStatus(entity: Entity, id: StatusEffectId): boolean {
  const s = entity.statuses.get(id);
  return Boolean(s && s.timeLeft > 0);
}

export function updateStatusEffects(entity: Entity, dt: number, applyDamage: (amount: number) => void): StatusDerived {
  for (const [id, status] of entity.statuses) {
    const cfg = STATUS_EFFECTS[id];
    if (cfg.kind === 'dot') {
      const dmg = cfg.damagePerSecond * dt;
      if (dmg > 0) applyDamage(dmg);
    }

    status.timeLeft -= dt;
    if (status.timeLeft <= 0) {
      entity.statuses.delete(id);
    }
  }

  return computeStatusDerived(entity);
}

export function computeStatusDerived(entity: Entity): StatusDerived {
  let speedMultiplier = 1;
  let damageTakenMultiplier = 1;
  let isStunned = false;
  let isRooted = false;
  let isKnockedDown = false;
  let blocksHealing = false;
  let isBlinded = false;

  for (const [id, status] of entity.statuses) {
    if (status.timeLeft <= 0) continue;
    const cfg = STATUS_EFFECTS[id];
    if (cfg.kind === 'slow') {
      speedMultiplier = Math.min(speedMultiplier, cfg.speedMultiplier);
    } else if (cfg.kind === 'damageTakenMultiplier') {
      damageTakenMultiplier *= cfg.multiplier;
    } else if (cfg.kind === 'stun') {
      isStunned = true;
    } else if (cfg.kind === 'root') {
      isRooted = true;
    } else if (cfg.kind === 'knockdown') {
      isKnockedDown = true;
    } else if (cfg.kind === 'dot' && id === 'poison') {
      blocksHealing = true;
    } else if (cfg.kind === 'blind') {
      isBlinded = true;
    }
  }

  return { speedMultiplier, damageTakenMultiplier, isStunned, isRooted, isKnockedDown, blocksHealing, isBlinded };
}

