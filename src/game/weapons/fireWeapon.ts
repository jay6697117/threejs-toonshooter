import * as THREE from 'three';
import { WEAPON_CONFIGS } from '../config/weapons';
import type { WeaponId } from '../config/ids';
import type { Cover } from '../arena/cover';
import type { Entity } from '../entities/entityBase';
import { dealDamage } from '../combat/damage';
import { applyDamageToCover } from '../combat/coverDamage';
import { raycast, raycastAll } from '../combat/raycast';
import { applyStatus } from '../combat/statusEffects';
import type { Projectile } from './projectile';

export type FireContext = {
  scene: THREE.Scene;
  entities: Entity[];
  covers: Cover[];
  projectiles: Projectile[];
};

export type FireResult =
  | { type: 'hitscan'; hit: 'none' | 'entity' | 'cover'; ammoConsumed: number }
  | { type: 'projectile'; projectileId: string; ammoConsumed: number };

export function fireWeapon(
  attacker: Entity,
  weaponId: WeaponId,
  aimPoint: THREE.Vector3,
  context: FireContext,
  options?: { chargeRatio?: number }
): FireResult {
  const cfg = WEAPON_CONFIGS[weaponId];
  const chargeRatio = options?.chargeRatio ?? 1;

  const muzzle = attacker.position.clone();
  muzzle.y += 1.1;

  const aim = aimPoint.clone();
  aim.y = muzzle.y;
  const direction = aim.sub(muzzle).normalize();

  if (cfg.trajectory.kind === 'hitscan') {
    const range = resolveRangeMeters(cfg.rangeMeters, chargeRatio);
    const baseDamage = resolveDamage(cfg.damage, chargeRatio) * (attacker.damageDealtMultiplier ?? 1);

    const shotsPerTrigger = cfg.special.kind === 'doubleShot' ? 2 : 1;
    const ammoConsumed = cfg.special.kind === 'doubleShot' ? 2 : 1;
    const pellets = cfg.damage.kind === 'flat' ? (cfg.damage.pellets ?? 1) : 1;
    const spread = pellets > 1 ? 0.08 : 0.0;

    let overall: 'none' | 'entity' | 'cover' = 'none';

    for (let shot = 0; shot < shotsPerTrigger; shot += 1) {
      for (let pellet = 0; pellet < pellets; pellet += 1) {
        const dir = spread > 0 ? applySpread(direction, spread) : direction;

        if (cfg.special.kind === 'penetrate') {
          const maxEntityHits = 1 + cfg.special.maxPenetrations;
          const hits = raycastAll({
            origin: muzzle,
            direction: dir,
            maxDistance: range,
            entities: context.entities,
            covers: context.covers,
            ignoreTeam: attacker.team
          });

          let entityHits = 0;
          for (const hit of hits) {
            if (hit.type === 'cover') {
              applyDamageToCover(context.scene, context.entities, hit.cover, baseDamage, {
                ignite: weaponHasBurn(cfg),
                attackerId: attacker.id,
                attackerTeam: attacker.team
              });
              if (overall === 'none') overall = 'cover';
              break;
            }
            applyWeaponHitToEntity(attacker, cfg.id, hit.entity, dir, { damageAmount: baseDamage, chargeRatio });
            overall = 'entity';
            entityHits += 1;
            if (entityHits >= maxEntityHits) break;
          }

          continue;
        }

        const hit = raycast({
          origin: muzzle,
          direction: dir,
          maxDistance: range,
          entities: context.entities,
          covers: context.covers,
          ignoreTeam: attacker.team
        });

        if (!hit) continue;
        if (hit.type === 'entity') {
          applyWeaponHitToEntity(attacker, cfg.id, hit.entity, dir, { damageAmount: baseDamage, chargeRatio });
          overall = 'entity';
        } else if (overall === 'none') {
          applyDamageToCover(context.scene, context.entities, hit.cover, baseDamage, {
            ignite: weaponHasBurn(cfg),
            attackerId: attacker.id,
            attackerTeam: attacker.team
          });
          overall = 'cover';
        }
      }
    }

    return { type: 'hitscan', hit: overall, ammoConsumed };
  }

  const projectileId = `${attacker.id}_${weaponId}_${Math.floor(Math.random() * 1e9)}`;
  const { kind, motion, speed } = cfg.trajectory;
  void kind;

  const projKind = motion === 'ballistic' ? 'ballistic' : motion === 'bouncy' ? 'bouncy' : motion === 'returning' ? 'returning' : motion === 'grapple' ? 'grapple' : 'linear';
  const velocity = direction.clone().multiplyScalar(speed);

  if (projKind === 'ballistic') velocity.y += speed * 0.35;
  if (projKind === 'bouncy') velocity.y += speed * 0.45;
  if (projKind === 'returning') velocity.y = 0;
  if (projKind === 'grapple') velocity.y = 0;

  const mesh = createProjectileMesh(weaponId);
  mesh.position.copy(muzzle);
  context.scene.add(mesh);

  const projectile: Projectile = {
    id: projectileId,
    kind: projKind,
    weaponId,
    attackerId: attacker.id,
    attackerTeam: attacker.team,
    position: muzzle.clone(),
    velocity,
    speed,
    radius: 0.12,
    damageAmount: resolveDamage(cfg.damage, chargeRatio) * (attacker.damageDealtMultiplier ?? 1),
    timeLeft: 4.5,
    bouncesLeft: cfg.special.kind === 'bouncyExplosion' ? cfg.special.maxBounces : undefined,
    origin: projKind === 'returning' ? attacker.position.clone() : undefined,
    maxDistance: projKind === 'returning' ? resolveRangeMeters(cfg.rangeMeters, chargeRatio) : undefined,
    maxHitsPerTarget: cfg.special.kind === 'returning' ? cfg.special.maxHitsPerTarget : undefined,
    hitCounts: cfg.special.kind === 'returning' ? {} : undefined,
    mesh
  };

  context.projectiles.push(projectile);
  return { type: 'projectile', projectileId, ammoConsumed: 1 };
}

export function applyWeaponHitToEntity(
  attacker: Entity,
  weaponId: WeaponId,
  target: Entity,
  direction: THREE.Vector3,
  options?: { damageAmount?: number; chargeRatio?: number }
): void {
  const cfg = WEAPON_CONFIGS[weaponId];

  const dmg = options?.damageAmount ?? (cfg.damage.kind === 'flat' ? cfg.damage.amount : cfg.damage.max);
  dealDamage(target, dmg, { attackerId: attacker.id, attackerTeam: attacker.team, weaponId: cfg.id, isDot: false });

  for (const eff of cfg.onHitEffects ?? []) {
    if (eff.kind === 'status') {
      const dur = resolveOnHitDurationSeconds(eff.durationSeconds, options?.chargeRatio);
      applyStatus(target, eff.id, dur);
    } else if (eff.kind === 'impulse') {
      const dir = direction.clone();
      dir.y = 0;
      if (dir.lengthSq() > 1e-6) {
        dir.normalize();
        target.position.addScaledVector(dir, eff.distance);
      }
    }
  }

  if (cfg.special.kind === 'pullOnHit') {
    const dir = direction.clone();
    dir.y = 0;
    if (dir.lengthSq() > 1e-6) {
      dir.normalize();
      target.position.addScaledVector(dir, -cfg.special.distance);
    }
  }
}

function createProjectileMesh(weaponId: WeaponId): THREE.Object3D {
  const cfg = WEAPON_CONFIGS[weaponId];
  const color =
    cfg.category === 'melee'
      ? 0xbcc6d8
      : cfg.category === 'mid'
        ? 0x79d5ff
        : cfg.category === 'ranged'
          ? 0xffc44d
          : 0xff6b6b;

  const geo = new THREE.SphereGeometry(0.12, 12, 12);
  const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.35, metalness: 0.2, emissive: new THREE.Color(color), emissiveIntensity: 0.25 });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.castShadow = true;
  return mesh;
}

function resolveRangeMeters(rangeMeters: number | { min: number; max: number }, chargeRatio: number): number {
  if (typeof rangeMeters === 'number') return rangeMeters;
  const t = Math.max(0, Math.min(1, chargeRatio));
  return rangeMeters.min + (rangeMeters.max - rangeMeters.min) * t;
}

function resolveDamage(dmg: { kind: 'flat'; amount: number; pellets?: number } | { kind: 'charge'; min: number; max: number }, chargeRatio: number): number {
  if (dmg.kind === 'flat') return dmg.amount;
  const t = Math.max(0, Math.min(1, chargeRatio));
  return dmg.min + (dmg.max - dmg.min) * t;
}

function applySpread(direction: THREE.Vector3, spread: number): THREE.Vector3 {
  const d = direction.clone();
  d.x += (Math.random() - 0.5) * spread;
  d.z += (Math.random() - 0.5) * spread;
  if (d.lengthSq() > 1e-6) d.normalize();
  return d;
}

function weaponHasBurn(cfg: { onHitEffects?: Array<{ kind: string; id?: string }> }): boolean {
  return Boolean(cfg.onHitEffects?.some((eff) => eff.kind === 'status' && eff.id === 'burn'));
}

function resolveOnHitDurationSeconds(
  durationSeconds: undefined | number | { min: number; max: number },
  chargeRatio: number | undefined
): number | undefined {
  if (durationSeconds === undefined) return undefined;
  if (typeof durationSeconds === 'number') return durationSeconds;
  if (chargeRatio === undefined) return durationSeconds.max;
  const t = Math.max(0, Math.min(1, chargeRatio));
  return durationSeconds.min + (durationSeconds.max - durationSeconds.min) * t;
}
