import type { StatusEffectId, WeaponId } from './ids';

export type WeaponCategory = 'melee' | 'mid' | 'ranged' | 'special';

export type ReloadType = 'mag' | 'shell' | 'none';

export type AmmoConfig =
  | { kind: 'infinite' }
  | {
      kind: 'magazine';
      magSize: number;
      reserveStart: number;
      reserveMax: number;
      reloadSeconds: number;
      reloadType: Exclude<ReloadType, 'none'>;
    }
  | {
      kind: 'finite';
      magSize: number;
      totalAmmo: number;
      reloadSeconds?: number;
      reloadType?: ReloadType;
    };

export type ChargeConfig = {
  minSeconds: number;
  maxSeconds: number;
  requiredFullCharge?: boolean;
};

export type DamageConfig =
  | { kind: 'flat'; amount: number; pellets?: number }
  | { kind: 'charge'; min: number; max: number };

export type RangeConfig = number | { min: number; max: number };

export type TrajectoryConfig =
  | { kind: 'hitscan' }
  | {
      kind: 'projectile';
      motion: 'linear' | 'ballistic' | 'returning' | 'bouncy' | 'grapple';
      speed: number;
    };

export type OnHitEffect =
  | { kind: 'status'; id: StatusEffectId; durationSeconds?: number | { min: number; max: number } }
  | { kind: 'impulse'; id: 'knockback'; distance: number }
  | { kind: 'armorIgnoreFraction'; id: 'armorBreak'; fraction: number };

export type WeaponSpecial =
  | { kind: 'none' }
  | { kind: 'doubleShot' }
  | { kind: 'returning'; maxHitsPerTarget: number }
  | { kind: 'pullOnHit'; distance: number }
  | { kind: 'penetrate'; maxPenetrations: number }
  | { kind: 'spawnObstacleOnImpact'; durationSeconds: number }
  | { kind: 'burstAll' }
  | { kind: 'mobilityGrapple' }
  | { kind: 'bouncyExplosion'; maxBounces: number };

export type WeaponConfig = {
  id: WeaponId;
  name: string;
  category: WeaponCategory;
  fireRatePerSecond: number;
  rangeMeters: RangeConfig;
  damage: DamageConfig;
  ammo: AmmoConfig;
  auto: boolean;
  charge?: ChargeConfig;
  trajectory: TrajectoryConfig;
  splash?: { radiusMeters: number; damage: number };
  onHitEffects?: OnHitEffect[];
  special: WeaponSpecial;
};

export const WEAPON_CONFIGS: Record<WeaponId, WeaponConfig> = {
  flyingKnife: {
    id: 'flyingKnife',
    name: 'Flying Knife',
    category: 'melee',
    fireRatePerSecond: 2.5,
    rangeMeters: 12,
    damage: { kind: 'flat', amount: 18 },
    ammo: { kind: 'magazine', magSize: 6, reserveStart: 24, reserveMax: 24, reloadSeconds: 0.8, reloadType: 'mag' },
    auto: false,
    trajectory: { kind: 'hitscan' },
    special: { kind: 'none' }
  },
  flyingDart: {
    id: 'flyingDart',
    name: 'Flying Dart',
    category: 'melee',
    fireRatePerSecond: 1.5,
    rangeMeters: 14,
    damage: { kind: 'flat', amount: 12, pellets: 3 },
    ammo: { kind: 'magazine', magSize: 8, reserveStart: 32, reserveMax: 32, reloadSeconds: 1.0, reloadType: 'mag' },
    auto: false,
    charge: { minSeconds: 0, maxSeconds: 0.8 },
    trajectory: { kind: 'hitscan' },
    onHitEffects: [{ kind: 'status', id: 'slow', durationSeconds: 1.5 }],
    special: { kind: 'none' }
  },
  sleeveArrow: {
    id: 'sleeveArrow',
    name: 'Sleeve Arrow',
    category: 'melee',
    fireRatePerSecond: 3.0,
    rangeMeters: 10,
    damage: { kind: 'flat', amount: 14, pellets: 2 },
    ammo: { kind: 'magazine', magSize: 4, reserveStart: 16, reserveMax: 16, reloadSeconds: 0.6, reloadType: 'mag' },
    auto: false,
    trajectory: { kind: 'hitscan' },
    onHitEffects: [{ kind: 'status', id: 'poison', durationSeconds: 3 }],
    special: { kind: 'doubleShot' }
  },
  boomerangBlade: {
    id: 'boomerangBlade',
    name: 'Boomerang Blade',
    category: 'melee',
    fireRatePerSecond: 1.2,
    rangeMeters: 15,
    damage: { kind: 'flat', amount: 22 },
    ammo: { kind: 'magazine', magSize: 1, reserveStart: 8, reserveMax: 8, reloadSeconds: 0.5, reloadType: 'mag' },
    auto: false,
    trajectory: { kind: 'projectile', motion: 'returning', speed: 22 },
    onHitEffects: [{ kind: 'status', id: 'bleed', durationSeconds: 2 }],
    special: { kind: 'returning', maxHitsPerTarget: 2 }
  },
  huntingBow: {
    id: 'huntingBow',
    name: 'Hunting Bow',
    category: 'mid',
    fireRatePerSecond: 1.0,
    rangeMeters: { min: 20, max: 35 },
    damage: { kind: 'charge', min: 25, max: 45 },
    ammo: { kind: 'infinite' },
    auto: false,
    charge: { minSeconds: 0, maxSeconds: 2.0 },
    trajectory: { kind: 'projectile', motion: 'ballistic', speed: 28 },
    special: { kind: 'none' }
  },
  repeatingCrossbow: {
    id: 'repeatingCrossbow',
    name: 'Repeating Crossbow',
    category: 'mid',
    fireRatePerSecond: 8.0,
    rangeMeters: 22,
    damage: { kind: 'flat', amount: 8 },
    ammo: { kind: 'magazine', magSize: 6, reserveStart: 30, reserveMax: 30, reloadSeconds: 1.2, reloadType: 'mag' },
    auto: true,
    trajectory: { kind: 'hitscan' },
    special: { kind: 'none' }
  },
  fireArrow: {
    id: 'fireArrow',
    name: 'Fire Arrow',
    category: 'mid',
    fireRatePerSecond: 0.8,
    rangeMeters: 28,
    damage: { kind: 'flat', amount: 20 },
    ammo: { kind: 'magazine', magSize: 4, reserveStart: 16, reserveMax: 16, reloadSeconds: 1.5, reloadType: 'mag' },
    auto: false,
    charge: { minSeconds: 0, maxSeconds: 1.5 },
    trajectory: { kind: 'projectile', motion: 'ballistic', speed: 26 },
    splash: { radiusMeters: 2.5, damage: 15 },
    onHitEffects: [{ kind: 'status', id: 'burn', durationSeconds: 3 }],
    special: { kind: 'none' }
  },
  ironMace: {
    id: 'ironMace',
    name: 'Iron Mace',
    category: 'mid',
    fireRatePerSecond: 1.0,
    rangeMeters: 18,
    damage: { kind: 'flat', amount: 28 },
    ammo: { kind: 'magazine', magSize: 1, reserveStart: 10, reserveMax: 10, reloadSeconds: 0.8, reloadType: 'mag' },
    auto: false,
    trajectory: { kind: 'projectile', motion: 'linear', speed: 24 },
    onHitEffects: [{ kind: 'status', id: 'stun', durationSeconds: 0.8 }],
    special: { kind: 'pullOnHit', distance: 0.5 }
  },
  strongBow: {
    id: 'strongBow',
    name: 'Strong Bow',
    category: 'ranged',
    fireRatePerSecond: 0.5,
    rangeMeters: 50,
    damage: { kind: 'flat', amount: 70 },
    ammo: { kind: 'infinite' },
    auto: false,
    charge: { minSeconds: 1.5, maxSeconds: 1.5, requiredFullCharge: true },
    trajectory: { kind: 'projectile', motion: 'ballistic', speed: 34 },
    onHitEffects: [{ kind: 'impulse', id: 'knockback', distance: 2 }],
    special: { kind: 'none' }
  },
  heavyCrossbow: {
    id: 'heavyCrossbow',
    name: 'Heavy Crossbow',
    category: 'ranged',
    fireRatePerSecond: 0.6,
    rangeMeters: 55,
    damage: { kind: 'flat', amount: 45 },
    ammo: { kind: 'magazine', magSize: 1, reserveStart: 8, reserveMax: 8, reloadSeconds: 2.0, reloadType: 'mag' },
    auto: false,
    trajectory: { kind: 'hitscan' },
    onHitEffects: [{ kind: 'armorIgnoreFraction', id: 'armorBreak', fraction: 0.2 }],
    special: { kind: 'penetrate', maxPenetrations: 1 }
  },
  siegeCrossbow: {
    id: 'siegeCrossbow',
    name: 'Siege Crossbow',
    category: 'ranged',
    fireRatePerSecond: 0.3,
    rangeMeters: 60,
    damage: { kind: 'flat', amount: 55 },
    ammo: { kind: 'magazine', magSize: 1, reserveStart: 4, reserveMax: 4, reloadSeconds: 3.0, reloadType: 'mag' },
    auto: false,
    charge: { minSeconds: 2.0, maxSeconds: 2.0, requiredFullCharge: true },
    trajectory: { kind: 'projectile', motion: 'linear', speed: 30 },
    splash: { radiusMeters: 2.8, damage: 25 },
    onHitEffects: [{ kind: 'status', id: 'root', durationSeconds: 1.2 }],
    special: { kind: 'spawnObstacleOnImpact', durationSeconds: 3 }
  },
  poisonCrossbow: {
    id: 'poisonCrossbow',
    name: 'Poison Crossbow',
    category: 'ranged',
    fireRatePerSecond: 0.7,
    rangeMeters: 45,
    damage: { kind: 'flat', amount: 30 },
    ammo: { kind: 'magazine', magSize: 3, reserveStart: 12, reserveMax: 12, reloadSeconds: 2.5, reloadType: 'mag' },
    auto: false,
    charge: { minSeconds: 0, maxSeconds: 2.0 },
    trajectory: { kind: 'hitscan' },
    onHitEffects: [{ kind: 'status', id: 'poison', durationSeconds: { min: 3, max: 6 } }],
    special: { kind: 'none' }
  },
  zhugeRepeater: {
    id: 'zhugeRepeater',
    name: 'Zhuge Repeater',
    category: 'special',
    fireRatePerSecond: 12.0,
    rangeMeters: 20,
    damage: { kind: 'flat', amount: 10 },
    ammo: { kind: 'finite', magSize: 10, totalAmmo: 30, reloadSeconds: 4, reloadType: 'mag' },
    auto: true,
    trajectory: { kind: 'hitscan' },
    special: { kind: 'burstAll' }
  },
  grapplingHook: {
    id: 'grapplingHook',
    name: 'Grappling Hook',
    category: 'special',
    fireRatePerSecond: 0.8,
    rangeMeters: 25,
    damage: { kind: 'flat', amount: 15 },
    ammo: { kind: 'infinite' },
    auto: false,
    trajectory: { kind: 'projectile', motion: 'grapple', speed: 36 },
    special: { kind: 'mobilityGrapple' }
  },
  thunderBomb: {
    id: 'thunderBomb',
    name: 'Thunder Bomb',
    category: 'special',
    fireRatePerSecond: 0.5,
    rangeMeters: 22,
    damage: { kind: 'flat', amount: 40 },
    ammo: { kind: 'finite', magSize: 2, totalAmmo: 2, reloadType: 'none' },
    auto: false,
    trajectory: { kind: 'projectile', motion: 'bouncy', speed: 18 },
    splash: { radiusMeters: 3.2, damage: 30 },
    onHitEffects: [
      { kind: 'status', id: 'burn', durationSeconds: 3 },
      { kind: 'status', id: 'stun', durationSeconds: 0.8 }
    ],
    special: { kind: 'bouncyExplosion', maxBounces: 2 }
  }
};

