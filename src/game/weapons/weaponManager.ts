import * as THREE from 'three';
import { WEAPON_CONFIGS } from '../config/weapons';
import type { WeaponId } from '../config/ids';
import type { Entity } from '../entities/entityBase';
import type { Cover } from '../arena/cover';
import type { Projectile } from './projectile';
import { fireWeapon } from './fireWeapon';
import { ensureWeaponSlotState } from './weaponState';

export type WeaponFrameInput = {
  fireDown: boolean;
  firePressed: boolean;
  fireReleased: boolean;
  reloadPressed: boolean;
};

export type WeaponManagerContext = {
  scene: THREE.Scene;
  entities: Entity[];
  covers: Cover[];
  projectiles: Projectile[];
};

export function ensureEntityWeaponSlotStates(entity: Entity): void {
  if (entity.weaponSlotStates.length !== entity.weaponSlots.length) {
    entity.weaponSlotStates = entity.weaponSlots.map((w) => (w ? ensureWeaponSlotState(null, w) : null));
    return;
  }

  for (let i = 0; i < entity.weaponSlots.length; i += 1) {
    const weaponId = entity.weaponSlots[i];
    entity.weaponSlotStates[i] = weaponId ? ensureWeaponSlotState(entity.weaponSlotStates[i], weaponId) : null;
  }
}

export function updateWeapons(
  entity: Entity,
  input: WeaponFrameInput,
  aimPoint: THREE.Vector3 | null,
  dt: number,
  context: WeaponManagerContext
): { shotsFired: number } {
  ensureEntityWeaponSlotStates(entity);

  for (const state of entity.weaponSlotStates) {
    if (!state) continue;
    state.cooldownTimer = Math.max(0, state.cooldownTimer - dt);

    if (state.reloadTimer > 0) {
      state.reloadTimer = Math.max(0, state.reloadTimer - dt);
      if (state.reloadTimer === 0) {
        finishReload(state.weaponId, state);
      }
    }
  }

  if (entity.eliminated) return { shotsFired: 0 };

  const weaponId = entity.weaponSlots[entity.activeWeaponSlot];
  if (!weaponId) return { shotsFired: 0 };
  const state = entity.weaponSlotStates[entity.activeWeaponSlot];
  if (!state) return { shotsFired: 0 };

  if (input.reloadPressed) {
    tryStartReload(weaponId, state);
  }

  if (!aimPoint) return { shotsFired: 0 };
  if (state.reloadTimer > 0) return { shotsFired: 0 };

  const cfg = WEAPON_CONFIGS[weaponId];

  if (cfg.special.kind === 'burstAll') {
    if (input.firePressed && state.burstShotsRemaining <= 0) {
      if (!hasAmmo(weaponId, state, 1) && tryStartReload(weaponId, state)) return { shotsFired: 0 };
      if (state.ammo > 0) state.burstShotsRemaining = state.ammo;
    }

    if (state.burstShotsRemaining > 0) {
      const fired = tryFireWeapon(entity, weaponId, state, aimPoint, context, 1);
      if (fired.shotsFired > 0) {
        state.burstShotsRemaining = Math.max(0, state.burstShotsRemaining - 1);
      }
      return fired;
    }

    return { shotsFired: 0 };
  }

  if (cfg.charge) {
    if (input.fireDown) {
      state.chargeSeconds = Math.min(cfg.charge.maxSeconds, state.chargeSeconds + dt);
    }

    if (input.fireReleased) {
      const chargeRatio = resolveChargeRatio(cfg.charge.minSeconds, cfg.charge.maxSeconds, state.chargeSeconds, Boolean(cfg.charge.requiredFullCharge));
      const requiredOk = cfg.charge.requiredFullCharge ? state.chargeSeconds >= cfg.charge.maxSeconds - 1e-3 : true;
      const minOk = state.chargeSeconds >= cfg.charge.minSeconds - 1e-3;
      state.chargeSeconds = 0;
      if (!requiredOk || !minOk) return { shotsFired: 0 };
      return tryFireWeapon(entity, weaponId, state, aimPoint, context, chargeRatio);
    }

    return { shotsFired: 0 };
  }

  state.chargeSeconds = 0;
  if (cfg.auto ? input.fireDown : input.firePressed) {
    return tryFireWeapon(entity, weaponId, state, aimPoint, context, 1);
  }

  return { shotsFired: 0 };
}

function tryFireWeapon(
  entity: Entity,
  weaponId: WeaponId,
  state: { ammo: number; reserve: number; cooldownTimer: number },
  aimPoint: THREE.Vector3,
  context: WeaponManagerContext,
  chargeRatio: number
): { shotsFired: number } {
  const cfg = WEAPON_CONFIGS[weaponId];
  const requiredAmmo = cfg.special.kind === 'doubleShot' ? 2 : 1;

  if (state.cooldownTimer > 0) return { shotsFired: 0 };

  if (!hasAmmo(weaponId, state, requiredAmmo)) {
    if (tryStartReload(weaponId, state)) return { shotsFired: 0 };
    return { shotsFired: 0 };
  }

  const result = fireWeapon(entity, weaponId, aimPoint, context, { chargeRatio });
  state.cooldownTimer = 1 / cfg.fireRatePerSecond;
  consumeAmmo(weaponId, state, result.ammoConsumed);
  return { shotsFired: 1 };
}

function hasAmmo(weaponId: WeaponId, state: { ammo: number }, requiredAmmo: number): boolean {
  const cfg = WEAPON_CONFIGS[weaponId];
  if (cfg.ammo.kind === 'infinite') return true;
  return state.ammo >= requiredAmmo;
}

function consumeAmmo(weaponId: WeaponId, state: { ammo: number }, amount: number): void {
  const cfg = WEAPON_CONFIGS[weaponId];
  if (cfg.ammo.kind === 'infinite') return;
  state.ammo = Math.max(0, state.ammo - amount);
}

function canReload(weaponId: WeaponId, state: { ammo: number; reserve: number; reloadTimer: number }): boolean {
  const cfg = WEAPON_CONFIGS[weaponId];
  if (cfg.ammo.kind === 'infinite') return false;
  if (state.reloadTimer > 0) return false;

  const magSize = cfg.ammo.magSize;
  if (state.ammo >= magSize) return false;
  if (state.reserve <= 0) return false;

  if (cfg.ammo.kind === 'magazine') return true;
  if (cfg.ammo.reloadType === undefined || cfg.ammo.reloadType === 'none') return false;
  if (cfg.ammo.reloadSeconds === undefined) return false;
  return true;
}

function tryStartReload(weaponId: WeaponId, state: { ammo: number; reserve: number; reloadTimer: number }): boolean {
  if (!canReload(weaponId, state)) return false;

  const cfg = WEAPON_CONFIGS[weaponId];
  const seconds = cfg.ammo.kind === 'magazine' ? cfg.ammo.reloadSeconds : (cfg.ammo.reloadSeconds ?? 0);
  if (seconds <= 0) return false;
  state.reloadTimer = seconds;
  return true;
}

function finishReload(weaponId: WeaponId, state: { ammo: number; reserve: number }): void {
  const cfg = WEAPON_CONFIGS[weaponId];
  if (cfg.ammo.kind === 'infinite') return;

  const magSize = cfg.ammo.magSize;
  const missing = magSize - state.ammo;
  if (missing <= 0) return;

  const moved = Math.max(0, Math.min(missing, state.reserve));
  state.ammo += moved;
  state.reserve -= moved;
}

function resolveChargeRatio(minSeconds: number, maxSeconds: number, chargeSeconds: number, requiredFullCharge: boolean): number {
  if (requiredFullCharge) return 1;
  const denom = maxSeconds - minSeconds;
  if (denom <= 1e-6) return 1;
  const t = (chargeSeconds - minSeconds) / denom;
  return Math.max(0, Math.min(1, t));
}
