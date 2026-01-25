import { WEAPON_CONFIGS } from '../config/weapons';
import type { WeaponId } from '../config/ids';

export type WeaponSlotState = {
  weaponId: WeaponId;
  ammo: number;
  reserve: number;
  reloadTimer: number;
  cooldownTimer: number;
  chargeSeconds: number;
  burstShotsRemaining: number;
};

export function createInitialWeaponSlotState(weaponId: WeaponId): WeaponSlotState {
  const cfg = WEAPON_CONFIGS[weaponId];

  if (cfg.ammo.kind === 'infinite') {
    return { weaponId, ammo: -1, reserve: -1, reloadTimer: 0, cooldownTimer: 0, chargeSeconds: 0, burstShotsRemaining: 0 };
  }

  if (cfg.ammo.kind === 'magazine') {
    return {
      weaponId,
      ammo: cfg.ammo.magSize,
      reserve: cfg.ammo.reserveStart,
      reloadTimer: 0,
      cooldownTimer: 0,
      chargeSeconds: 0,
      burstShotsRemaining: 0
    };
  }

  const ammo = cfg.ammo.magSize;
  const reserve = Math.max(0, cfg.ammo.totalAmmo - ammo);
  return { weaponId, ammo, reserve, reloadTimer: 0, cooldownTimer: 0, chargeSeconds: 0, burstShotsRemaining: 0 };
}

export function ensureWeaponSlotState(state: WeaponSlotState | null, weaponId: WeaponId): WeaponSlotState {
  if (state && state.weaponId === weaponId) return state;
  return createInitialWeaponSlotState(weaponId);
}
