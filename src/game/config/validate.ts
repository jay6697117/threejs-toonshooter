import { CHARACTER_CONFIGS } from './characters';
import { MODE_CONFIGS } from './modes';
import { SCENE_CONFIGS } from './scenes';
import { STATUS_EFFECTS } from './statusEffects';
import { THROWABLE_CONFIGS } from './throwables';
import { WEAPON_CONFIGS } from './weapons';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function assertPositiveNumber(value: number, label: string): void {
  assert(Number.isFinite(value), `${label} must be a finite number`);
  assert(value > 0, `${label} must be > 0`);
}

export function validateStaticConfigs(): void {
  for (const [id, cfg] of Object.entries(WEAPON_CONFIGS)) {
    assert(cfg.id === id, `WeaponConfig id mismatch: key=${id} cfg.id=${cfg.id}`);
    assertPositiveNumber(cfg.fireRatePerSecond, `WeaponConfig(${id}).fireRatePerSecond`);

    if (typeof cfg.rangeMeters === 'number') {
      assertPositiveNumber(cfg.rangeMeters, `WeaponConfig(${id}).rangeMeters`);
    } else {
      assertPositiveNumber(cfg.rangeMeters.min, `WeaponConfig(${id}).rangeMeters.min`);
      assertPositiveNumber(cfg.rangeMeters.max, `WeaponConfig(${id}).rangeMeters.max`);
      assert(cfg.rangeMeters.min <= cfg.rangeMeters.max, `WeaponConfig(${id}).rangeMeters min > max`);
    }

    if (cfg.damage.kind === 'flat') {
      assertPositiveNumber(cfg.damage.amount, `WeaponConfig(${id}).damage.amount`);
      if (cfg.damage.pellets !== undefined) {
        assertPositiveNumber(cfg.damage.pellets, `WeaponConfig(${id}).damage.pellets`);
      }
    } else {
      assertPositiveNumber(cfg.damage.min, `WeaponConfig(${id}).damage.min`);
      assertPositiveNumber(cfg.damage.max, `WeaponConfig(${id}).damage.max`);
      assert(cfg.damage.min <= cfg.damage.max, `WeaponConfig(${id}).damage min > max`);
    }

    if (cfg.ammo.kind === 'magazine') {
      assertPositiveNumber(cfg.ammo.magSize, `WeaponConfig(${id}).ammo.magSize`);
      assert(cfg.ammo.reserveStart >= 0, `WeaponConfig(${id}).ammo.reserveStart must be >= 0`);
      assert(cfg.ammo.reserveMax >= cfg.ammo.reserveStart, `WeaponConfig(${id}).ammo.reserveMax must be >= reserveStart`);
      assertPositiveNumber(cfg.ammo.reloadSeconds, `WeaponConfig(${id}).ammo.reloadSeconds`);
    } else if (cfg.ammo.kind === 'finite') {
      assertPositiveNumber(cfg.ammo.magSize, `WeaponConfig(${id}).ammo.magSize`);
      assertPositiveNumber(cfg.ammo.totalAmmo, `WeaponConfig(${id}).ammo.totalAmmo`);
      assert(cfg.ammo.totalAmmo >= cfg.ammo.magSize, `WeaponConfig(${id}).ammo.totalAmmo must be >= magSize`);
      if (cfg.ammo.reloadSeconds !== undefined) {
        assertPositiveNumber(cfg.ammo.reloadSeconds, `WeaponConfig(${id}).ammo.reloadSeconds`);
      }
    }

    if (cfg.charge) {
      assert(cfg.charge.minSeconds >= 0, `WeaponConfig(${id}).charge.minSeconds must be >= 0`);
      assertPositiveNumber(cfg.charge.maxSeconds, `WeaponConfig(${id}).charge.maxSeconds`);
      assert(cfg.charge.minSeconds <= cfg.charge.maxSeconds, `WeaponConfig(${id}).charge minSeconds > maxSeconds`);
    }

    if (cfg.trajectory.kind === 'projectile') {
      assertPositiveNumber(cfg.trajectory.speed, `WeaponConfig(${id}).trajectory.speed`);
    }

    if (cfg.splash) {
      assertPositiveNumber(cfg.splash.radiusMeters, `WeaponConfig(${id}).splash.radiusMeters`);
      assertPositiveNumber(cfg.splash.damage, `WeaponConfig(${id}).splash.damage`);
    }
  }

  for (const [id, cfg] of Object.entries(THROWABLE_CONFIGS)) {
    assert(cfg.id === id, `ThrowableConfig id mismatch: key=${id} cfg.id=${cfg.id}`);
    const effect = cfg.effect;

    if (effect.kind === 'explosion') {
      assert(effect.delaySeconds >= 0, `ThrowableConfig(${id}).effect.delaySeconds must be >= 0`);
      assertPositiveNumber(effect.radiusMeters, `ThrowableConfig(${id}).effect.radiusMeters`);
      assertPositiveNumber(effect.maxDamage, `ThrowableConfig(${id}).effect.maxDamage`);
    } else if (effect.kind === 'smoke') {
      assert(effect.delaySeconds >= 0, `ThrowableConfig(${id}).effect.delaySeconds must be >= 0`);
      assertPositiveNumber(effect.radiusMeters, `ThrowableConfig(${id}).effect.radiusMeters`);
      assertPositiveNumber(effect.durationSeconds, `ThrowableConfig(${id}).effect.durationSeconds`);
      if (effect.damagePerSecond !== undefined) {
        assertPositiveNumber(effect.damagePerSecond, `ThrowableConfig(${id}).effect.damagePerSecond`);
      }
    } else if (effect.kind === 'trap') {
      assertPositiveNumber(effect.onTrigger.damage, `ThrowableConfig(${id}).effect.onTrigger.damage`);
      if (effect.maxLifetimeSeconds !== undefined) {
        assertPositiveNumber(effect.maxLifetimeSeconds, `ThrowableConfig(${id}).effect.maxLifetimeSeconds`);
      }
    } else if (effect.kind === 'area') {
      assertPositiveNumber(effect.radiusMeters, `ThrowableConfig(${id}).effect.radiusMeters`);
      assertPositiveNumber(effect.durationSeconds, `ThrowableConfig(${id}).effect.durationSeconds`);
      if (effect.damagePerSecond !== undefined) {
        assertPositiveNumber(effect.damagePerSecond, `ThrowableConfig(${id}).effect.damagePerSecond`);
      }
      if (effect.slowMultiplier !== undefined) {
        assert(effect.slowMultiplier > 0 && effect.slowMultiplier <= 1, `ThrowableConfig(${id}).effect.slowMultiplier must be (0, 1]`);
      }
      if (effect.burnDamagePerSecondOnIgnite !== undefined) {
        assertPositiveNumber(effect.burnDamagePerSecondOnIgnite, `ThrowableConfig(${id}).effect.burnDamagePerSecondOnIgnite`);
      }
    }
  }

  for (const [id, cfg] of Object.entries(STATUS_EFFECTS)) {
    assert(cfg.id === id, `StatusEffectConfig id mismatch: key=${id} cfg.id=${cfg.id}`);
    if ('durationSeconds' in cfg) {
      if (typeof cfg.durationSeconds === 'number') {
        assertPositiveNumber(cfg.durationSeconds, `StatusEffectConfig(${id}).durationSeconds`);
      } else {
        assertPositiveNumber(cfg.durationSeconds.min, `StatusEffectConfig(${id}).durationSeconds.min`);
        assertPositiveNumber(cfg.durationSeconds.max, `StatusEffectConfig(${id}).durationSeconds.max`);
        assert(cfg.durationSeconds.min <= cfg.durationSeconds.max, `StatusEffectConfig(${id}).durationSeconds min > max`);
      }
    }
    if (cfg.kind === 'dot') {
      assertPositiveNumber(cfg.damagePerSecond, `StatusEffectConfig(${id}).damagePerSecond`);
    }
    if (cfg.kind === 'slow') {
      assert(cfg.speedMultiplier > 0 && cfg.speedMultiplier <= 1, `StatusEffectConfig(${id}).speedMultiplier must be (0, 1]`);
    }
  }

  for (const [id, cfg] of Object.entries(SCENE_CONFIGS)) {
    assert(cfg.id === id, `SceneConfig id mismatch: key=${id} cfg.id=${cfg.id}`);
    assert(cfg.supportedModes.length > 0, `SceneConfig(${id}).supportedModes must not be empty`);
  }

  for (const [id, cfg] of Object.entries(CHARACTER_CONFIGS)) {
    assert(cfg.id === id, `CharacterConfig id mismatch: key=${id} cfg.id=${cfg.id}`);
  }

  for (const [id, cfg] of Object.entries(MODE_CONFIGS)) {
    assert(cfg.id === id, `ModeConfig id mismatch: key=${id} cfg.id=${cfg.id}`);
  }
}

