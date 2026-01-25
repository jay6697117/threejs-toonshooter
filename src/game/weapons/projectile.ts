import * as THREE from 'three';
import type { WeaponId } from '../config/ids';
import type { Cover } from '../arena/cover';
import type { Entity, TeamId } from '../entities/entityBase';

export type ProjectileKind = 'linear' | 'ballistic' | 'returning' | 'bouncy' | 'grapple';

export type Projectile = {
  id: string;
  kind: ProjectileKind;
  weaponId: WeaponId;
  attackerId: string;
  attackerTeam: TeamId;

  position: THREE.Vector3;
  velocity: THREE.Vector3;
  speed: number;
  radius: number;
  damageAmount: number;

  timeLeft: number;
  bouncesLeft?: number;
  returningToAttacker?: boolean;
  origin?: THREE.Vector3;
  maxDistance?: number;
  maxHitsPerTarget?: number;
  hitCounts?: Record<string, number>;

  mesh: THREE.Object3D;
};

export type ProjectileHit =
  | { type: 'entity'; entity: Entity; point: THREE.Vector3 }
  | { type: 'cover'; cover: Cover; point: THREE.Vector3 }
  | { type: 'expired'; reason: 'timeout' | 'ground' | 'bounces' | 'catch' };

export type ProjectileUpdateResult = {
  projectile: Projectile;
  hit: ProjectileHit | null;
  remove: boolean;
};

const GRAVITY = -18;
const GROUND_Y = 0.05;

export function updateProjectiles(projectiles: Projectile[], entities: Entity[], covers: Cover[], dt: number): ProjectileUpdateResult[] {
  const results: ProjectileUpdateResult[] = [];

  for (const p of projectiles) {
    p.timeLeft -= dt;
    if (p.timeLeft <= 0) {
      results.push({ projectile: p, hit: { type: 'expired', reason: 'timeout' }, remove: true });
      continue;
    }

    if (p.kind === 'returning') {
      updateReturning(p, entities);
    }

    if (p.kind === 'ballistic' || p.kind === 'bouncy') {
      p.velocity.y += GRAVITY * dt;
    }

    p.position.addScaledVector(p.velocity, dt);
    p.mesh.position.copy(p.position);

    if (p.kind === 'bouncy') {
      if (p.position.y <= GROUND_Y) {
        p.position.y = GROUND_Y;
        p.velocity.y = Math.abs(p.velocity.y) * 0.6;
        p.velocity.x *= 0.82;
        p.velocity.z *= 0.82;
        p.bouncesLeft = (p.bouncesLeft ?? 0) - 1;
        if ((p.bouncesLeft ?? 0) < 0) {
          results.push({ projectile: p, hit: { type: 'expired', reason: 'bounces' }, remove: true });
          continue;
        }
      }
    } else {
      if (p.position.y <= GROUND_Y) {
        p.position.y = GROUND_Y;
        p.mesh.position.y = GROUND_Y;
        results.push({ projectile: p, hit: { type: 'expired', reason: 'ground' }, remove: true });
        continue;
      }
    }

    const hitCover = hitCovers(p, covers);
    if (hitCover) {
      if (p.kind === 'bouncy') {
        bounceOffCover(p, hitCover.cover);
        p.bouncesLeft = (p.bouncesLeft ?? 0) - 1;
        if ((p.bouncesLeft ?? 0) < 0) {
          results.push({ projectile: p, hit: { type: 'expired', reason: 'bounces' }, remove: true });
          continue;
        }
        results.push({ projectile: p, hit: null, remove: false });
        continue;
      }

      if (p.kind === 'returning') {
        p.returningToAttacker = true;
        bounceOffCover(p, hitCover.cover);
        results.push({ projectile: p, hit: null, remove: false });
        continue;
      }

      results.push({ projectile: p, hit: hitCover, remove: true });
      continue;
    }

    const hitEntity = hitEntities(p, entities);
    if (hitEntity) {
      if (p.kind === 'returning') {
        if (!shouldRegisterReturningHit(p, hitEntity.entity)) {
          results.push({ projectile: p, hit: null, remove: false });
          continue;
        }

        registerReturningHit(p, hitEntity.entity);
        p.returningToAttacker = true;

        const pushDir = p.velocity.clone();
        pushDir.y = 0;
        if (pushDir.lengthSq() > 1e-6) {
          pushDir.normalize();
          p.position.addScaledVector(pushDir, p.radius * 2);
          p.mesh.position.copy(p.position);
        }

        results.push({ projectile: p, hit: hitEntity, remove: false });
        continue;
      }

      results.push({ projectile: p, hit: hitEntity, remove: true });
      continue;
    }

    if (p.kind === 'returning' && p.returningToAttacker) {
      const attacker = entities.find((e) => e.id === p.attackerId);
      if (attacker) {
        const dx = attacker.position.x - p.position.x;
        const dz = attacker.position.z - p.position.z;
        if (dx * dx + dz * dz <= 0.7 * 0.7) {
          results.push({ projectile: p, hit: { type: 'expired', reason: 'catch' }, remove: true });
          continue;
        }
      }
    }

    results.push({ projectile: p, hit: null, remove: false });
  }

  return results;
}

function updateReturning(p: Projectile, entities: Entity[]): void {
  if (!p.origin || p.maxDistance === undefined) return;
  if (!p.returningToAttacker) {
    const dx = p.position.x - p.origin.x;
    const dz = p.position.z - p.origin.z;
    if (dx * dx + dz * dz >= p.maxDistance * p.maxDistance) {
      p.returningToAttacker = true;
    }
  }

  if (!p.returningToAttacker) return;
  const attacker = entities.find((e) => e.id === p.attackerId);
  if (!attacker) return;

  const dir = attacker.position.clone().sub(p.position);
  dir.y = 0;
  if (dir.lengthSq() <= 1e-6) return;
  dir.normalize();
  p.velocity.copy(dir).multiplyScalar(p.speed);
}

function hitEntities(p: Projectile, entities: Entity[]): ProjectileHit | null {
  for (const e of entities) {
    if (e.eliminated) continue;
    if (e.team === p.attackerTeam) continue;
    if (p.kind === 'returning' && !shouldRegisterReturningHit(p, e)) continue;
    const dx = e.position.x - p.position.x;
    const dy = (e.position.y + 0.6) - p.position.y;
    const dz = e.position.z - p.position.z;
    const r = e.hurtRadius + p.radius;
    if (dx * dx + dy * dy + dz * dz <= r * r) {
      return { type: 'entity', entity: e, point: p.position.clone() };
    }
  }
  return null;
}

function hitCovers(p: Projectile, covers: Cover[]): ProjectileHit | null {
  for (const c of covers) {
    if (!c.active) continue;
    const expanded = c.box.clone().expandByScalar(p.radius);
    if (expanded.containsPoint(p.position)) {
      return { type: 'cover', cover: c, point: p.position.clone() };
    }
  }
  return null;
}

function shouldRegisterReturningHit(p: Projectile, e: Entity): boolean {
  if (p.kind !== 'returning') return true;
  const max = p.maxHitsPerTarget ?? 0;
  if (max <= 0) return true;
  const hits = p.hitCounts?.[e.id] ?? 0;
  return hits < max;
}

function registerReturningHit(p: Projectile, e: Entity): void {
  if (p.kind !== 'returning') return;
  if (!p.hitCounts) p.hitCounts = {};
  p.hitCounts[e.id] = (p.hitCounts[e.id] ?? 0) + 1;
}

function bounceOffCover(p: Projectile, cover: Cover): void {
  const expanded = cover.box.clone().expandByScalar(p.radius);
  const dMinX = Math.abs(p.position.x - expanded.min.x);
  const dMaxX = Math.abs(expanded.max.x - p.position.x);
  const dMinZ = Math.abs(p.position.z - expanded.min.z);
  const dMaxZ = Math.abs(expanded.max.z - p.position.z);

  let axis: 'x' | 'z' = 'x';
  let sign = 1;
  let best = dMinX;
  axis = 'x';
  sign = -1;

  if (dMaxX < best) {
    best = dMaxX;
    axis = 'x';
    sign = 1;
  }
  if (dMinZ < best) {
    best = dMinZ;
    axis = 'z';
    sign = -1;
  }
  if (dMaxZ < best) {
    best = dMaxZ;
    axis = 'z';
    sign = 1;
  }

  if (axis === 'x') {
    p.velocity.x = -p.velocity.x * 0.8;
    p.position.x = sign < 0 ? expanded.min.x - p.radius : expanded.max.x + p.radius;
  } else {
    p.velocity.z = -p.velocity.z * 0.8;
    p.position.z = sign < 0 ? expanded.min.z - p.radius : expanded.max.z + p.radius;
  }

  p.velocity.y *= 0.85;
  p.mesh.position.copy(p.position);
}
