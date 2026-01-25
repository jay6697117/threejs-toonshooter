import * as THREE from 'three';
import { applyExplosion } from '../combat/areaDamage';
import { dealDamage } from '../combat/damage';
import { applyStatus, hasStatus } from '../combat/statusEffects';
import { THROWABLE_CONFIGS } from '../config/throwables';
import type { ThrowableId } from '../config/ids';
import type { Rng } from '../core/rng';
import { disposeObject3D } from '../core/dispose';
import type { Entity } from '../entities/entityBase';
import type { AreaEffect, SmokeVolume, ThrowableProjectile, TrapInstance } from './types';

export type ThrowablesWorld = {
  scene: THREE.Scene;
  entities: Entity[];
  throwableProjectiles: ThrowableProjectile[];
  smokes: SmokeVolume[];
  areas: AreaEffect[];
  traps: TrapInstance[];
  rng: Rng;
  emitFx?: (event: ThrowablesFxEvent) => void;
};

export type ThrowablesFxEvent =
  | { type: 'explosion'; throwableId: ThrowableId; pos: THREE.Vector3; radius: number }
  | { type: 'smoke'; throwableId: ThrowableId; pos: THREE.Vector3; radius: number; smokeType: 'normal' | 'poison' }
  | { type: 'area'; throwableId: ThrowableId; pos: THREE.Vector3; radius: number }
  | { type: 'areaIgnite'; throwableId: ThrowableId; pos: THREE.Vector3; radius: number }
  | { type: 'trapTrigger'; throwableId: ThrowableId; pos: THREE.Vector3 };

const GRAVITY = -18;
const GROUND_Y = 0.05;

export function cycleActiveThrowableSlot(entity: Entity): void {
  const count = entity.throwableSlots.length;
  if (count <= 0) return;
  entity.activeThrowableSlot = (entity.activeThrowableSlot + 1) % count;
}

export function tryUseActiveThrowable(entity: Entity, aimPoint: THREE.Vector3 | null, world: ThrowablesWorld): boolean {
  if (!aimPoint) return false;
  if (entity.eliminated) return false;

  const activeSlot = entity.throwableSlots[entity.activeThrowableSlot];
  let slotIdx = entity.activeThrowableSlot;
  let slot = activeSlot;

  if (!slot || slot.count <= 0) {
    const idx = entity.throwableSlots.findIndex((s) => (s?.count ?? 0) > 0);
    if (idx < 0) return false;
    slotIdx = idx;
    slot = entity.throwableSlots[idx];
    entity.activeThrowableSlot = idx;
  }

  if (!slot) return false;

  const throwableId = slot.id;
  const cfg = THROWABLE_CONFIGS[throwableId];
  const effect = cfg.effect;

  if (cfg.delivery === 'place') {
    const placedPos = new THREE.Vector3(aimPoint.x, GROUND_Y, aimPoint.z);
    if (effect.kind === 'trap') {
      spawnTrap(world, throwableId, entity, placedPos);
    } else if (effect.kind === 'area') {
      spawnArea(world, throwableId, entity, placedPos);
    } else if (effect.kind === 'smoke') {
      spawnSmoke(world, throwableId, entity, placedPos);
    } else if (effect.kind === 'explosion') {
      explode(world, throwableId, entity, placedPos);
    }
  } else {
    spawnProjectile(world, throwableId, entity, aimPoint);
  }

  slot.count -= 1;
  if (slot.count <= 0) {
    entity.throwableSlots[slotIdx] = null;
  } else {
    entity.throwableSlots[slotIdx] = slot;
  }

  return true;
}

export function updateThrowables(world: ThrowablesWorld, dt: number, timeSeconds: number): void {
  updateThrowableProjectiles(world, dt);
  updateSmokeVolumes(world, dt, timeSeconds);
  updateAreas(world, dt, timeSeconds);
  updateTraps(world, dt, timeSeconds);
}

function spawnProjectile(world: ThrowablesWorld, throwableId: ThrowableId, owner: Entity, aimPoint: THREE.Vector3): void {
  const cfg = THROWABLE_CONFIGS[throwableId];

  const start = owner.position.clone();
  start.y += 1.1;

  const dir = aimPoint.clone().sub(owner.position);
  dir.y = 0;
  if (dir.lengthSq() <= 1e-6) dir.set(Math.sin(owner.yaw), 0, Math.cos(owner.yaw));
  dir.normalize();

  const speed = 14;
  const velocity = dir.multiplyScalar(speed);
  velocity.y = speed * 0.6;

  const mesh = createProjectileMesh(cfg.category);
  mesh.position.copy(start);
  world.scene.add(mesh);

  const detonateTimer =
    cfg.effect.kind === 'explosion'
      ? cfg.effect.delaySeconds
      : cfg.effect.kind === 'smoke'
        ? cfg.effect.delaySeconds
        : 0;

  const projectile: ThrowableProjectile = {
    id: world.rng.nextId(`th_${throwableId}_${owner.id}`),
    throwableId,
    ownerId: owner.id,
    ownerTeam: owner.team,
    position: start.clone(),
    velocity,
    radius: 0.18,
    detonateTimer,
    mesh
  };

  world.throwableProjectiles.push(projectile);
}

function updateThrowableProjectiles(world: ThrowablesWorld, dt: number): void {
  const remaining: ThrowableProjectile[] = [];

  for (const p of world.throwableProjectiles) {
    const cfg = THROWABLE_CONFIGS[p.throwableId];
    const effect = cfg.effect;

    p.velocity.y += GRAVITY * dt;
    p.position.addScaledVector(p.velocity, dt);

    if (p.position.y <= GROUND_Y) {
      p.position.y = GROUND_Y;
      p.velocity.set(0, 0, 0);
    }

    p.mesh.position.copy(p.position);

    if (effect.kind === 'area') {
      if (p.position.y <= GROUND_Y + 1e-3) {
        spawnArea(world, p.throwableId, resolveOwner(world, p.ownerId), p.position);
        world.scene.remove(p.mesh);
        disposeObject3D(p.mesh);
        continue;
      }
      remaining.push(p);
      continue;
    }

    p.detonateTimer -= dt;
    if (p.detonateTimer > 0) {
      remaining.push(p);
      continue;
    }

    const owner = resolveOwner(world, p.ownerId);
    const pos = new THREE.Vector3(p.position.x, GROUND_Y, p.position.z);

    if (effect.kind === 'explosion') {
      explode(world, p.throwableId, owner, pos);
    } else if (effect.kind === 'smoke') {
      spawnSmoke(world, p.throwableId, owner, pos);
    } else if (effect.kind === 'trap') {
      spawnTrap(world, p.throwableId, owner, pos);
    }

    world.scene.remove(p.mesh);
    disposeObject3D(p.mesh);
  }

  world.throwableProjectiles = remaining;
}

function spawnSmoke(world: ThrowablesWorld, throwableId: ThrowableId, owner: Entity, pos: THREE.Vector3): void {
  const cfg = THROWABLE_CONFIGS[throwableId];
  if (cfg.effect.kind !== 'smoke') return;

  const mesh = createSmokeMesh(cfg.effect.smokeType, cfg.effect.radiusMeters);
  mesh.position.copy(pos);
  world.scene.add(mesh);

  const smoke: SmokeVolume = {
    id: world.rng.nextId(`sm_${throwableId}_${owner.id}`),
    throwableId,
    ownerId: owner.id,
    ownerTeam: owner.team,
    position: pos.clone(),
    radius: cfg.effect.radiusMeters,
    timeLeft: cfg.effect.durationSeconds,
    smokeType: cfg.effect.smokeType,
    damagePerSecond: cfg.effect.damagePerSecond,
    mesh
  };

  world.smokes.push(smoke);
  world.emitFx?.({ type: 'smoke', throwableId, pos: pos.clone(), radius: cfg.effect.radiusMeters, smokeType: cfg.effect.smokeType });
}

function updateSmokeVolumes(world: ThrowablesWorld, dt: number, timeSeconds: number): void {
  const remaining: SmokeVolume[] = [];

  for (const s of world.smokes) {
    s.timeLeft -= dt;
    if (s.timeLeft <= 0) {
      world.scene.remove(s.mesh);
      disposeObject3D(s.mesh);
      continue;
    }

    s.mesh.position.y = s.position.y + 0.25 + Math.sin(timeSeconds * 1.8) * 0.08;

    if (s.smokeType === 'poison') {
      const cfg = THROWABLE_CONFIGS[s.throwableId];
      if (cfg.effect.kind === 'smoke') {
        for (const entity of world.entities) {
          if (entity.eliminated) continue;
          const dist = entity.position.distanceTo(s.position);
          if (dist > s.radius) continue;
          if (s.damagePerSecond && s.damagePerSecond > 0) {
            dealDamage(entity, s.damagePerSecond * dt, { attackerId: s.ownerId, attackerTeam: s.ownerTeam, isDot: true });
          }
          for (const eff of cfg.effect.onTickEffects ?? []) {
            applyStatus(entity, eff.id, eff.durationSeconds);
          }
        }
      }
    }

    remaining.push(s);
  }

  world.smokes = remaining;
}

function spawnArea(world: ThrowablesWorld, throwableId: ThrowableId, owner: Entity, pos: THREE.Vector3): void {
  const cfg = THROWABLE_CONFIGS[throwableId];
  if (cfg.effect.kind !== 'area') return;

  const mesh = createAreaMesh(cfg.category, cfg.effect.radiusMeters);
  mesh.position.copy(pos);
  world.scene.add(mesh);

  const area: AreaEffect = {
    id: world.rng.nextId(`ar_${throwableId}_${owner.id}`),
    throwableId,
    ownerId: owner.id,
    ownerTeam: owner.team,
    position: pos.clone(),
    radius: cfg.effect.radiusMeters,
    timeLeft: cfg.effect.durationSeconds,
    damagePerSecond: cfg.effect.damagePerSecond,
    ignitable: cfg.effect.ignitable,
    ignited: false,
    burnDamagePerSecondOnIgnite: cfg.effect.burnDamagePerSecondOnIgnite,
    mesh
  };

  world.areas.push(area);
  world.emitFx?.({ type: 'area', throwableId, pos: pos.clone(), radius: cfg.effect.radiusMeters });
}

function updateAreas(world: ThrowablesWorld, dt: number, timeSeconds: number): void {
  const remaining: AreaEffect[] = [];

  for (const a of world.areas) {
    a.timeLeft -= dt;
    if (a.timeLeft <= 0) {
      world.scene.remove(a.mesh);
      disposeObject3D(a.mesh);
      continue;
    }

    a.mesh.rotation.z = timeSeconds * 0.15;

    const cfg = THROWABLE_CONFIGS[a.throwableId];
    if (cfg.effect.kind !== 'area') {
      remaining.push(a);
      continue;
    }

    if (a.ignitable && !a.ignited) {
      const wasIgnited = Boolean(a.ignited);
      for (const entity of world.entities) {
        if (entity.eliminated) continue;
        const dist = entity.position.distanceTo(a.position);
        if (dist > a.radius) continue;
        if (hasStatus(entity, 'burn')) {
          a.ignited = true;
          break;
        }
      }
      if (!wasIgnited && a.ignited) {
        world.emitFx?.({ type: 'areaIgnite', throwableId: a.throwableId, pos: a.position.clone(), radius: a.radius });
      }
    }

    for (const entity of world.entities) {
      if (entity.eliminated) continue;
      const dist = entity.position.distanceTo(a.position);
      if (dist > a.radius) continue;

      if (a.damagePerSecond && a.damagePerSecond > 0) {
        dealDamage(entity, a.damagePerSecond * dt, { attackerId: a.ownerId, attackerTeam: a.ownerTeam, isDot: true });
      }

      for (const eff of cfg.effect.onTickEffects ?? []) {
        applyStatus(entity, eff.id, eff.durationSeconds);
      }

      if (a.ignited && a.burnDamagePerSecondOnIgnite && a.burnDamagePerSecondOnIgnite > 0) {
        dealDamage(entity, a.burnDamagePerSecondOnIgnite * dt, { attackerId: a.ownerId, attackerTeam: a.ownerTeam, isDot: true });
        applyStatus(entity, 'burn', 0.5);
      }
    }

    remaining.push(a);
  }

  world.areas = remaining;
}

function spawnTrap(world: ThrowablesWorld, throwableId: ThrowableId, owner: Entity, pos: THREE.Vector3): void {
  const cfg = THROWABLE_CONFIGS[throwableId];
  if (cfg.effect.kind !== 'trap') return;

  const mesh = createTrapMesh(cfg.category);
  mesh.position.copy(pos);
  world.scene.add(mesh);

  const radius = cfg.effect.radiusMeters ?? 1.0;
  const trap: TrapInstance = {
    id: world.rng.nextId(`tp_${throwableId}_${owner.id}`),
    throwableId,
    ownerId: owner.id,
    ownerTeam: owner.team,
    position: pos.clone(),
    radius,
    timeLeft: cfg.effect.maxLifetimeSeconds,
    mesh
  };

  world.traps.push(trap);
}

function updateTraps(world: ThrowablesWorld, dt: number, timeSeconds: number): void {
  const remaining: TrapInstance[] = [];

  for (const t of world.traps) {
    const cfg = THROWABLE_CONFIGS[t.throwableId];
    if (cfg.effect.kind !== 'trap') continue;

    if (t.timeLeft !== undefined) {
      t.timeLeft -= dt;
      if (t.timeLeft <= 0) {
        world.scene.remove(t.mesh);
        disposeObject3D(t.mesh);
        continue;
      }
    }

    t.mesh.rotation.y = timeSeconds * 0.4;

    let triggered = false;
    for (const e of world.entities) {
      if (e.eliminated) continue;
      if (e.team === t.ownerTeam) continue;
      const dx = e.position.x - t.position.x;
      const dz = e.position.z - t.position.z;
      const r = e.radius + t.radius;
      if (dx * dx + dz * dz <= r * r) {
        dealDamage(e, cfg.effect.onTrigger.damage, { attackerId: t.ownerId, attackerTeam: t.ownerTeam, isDot: false });
        for (const eff of cfg.effect.onTrigger.onHitEffects ?? []) {
          applyStatus(e, eff.id, eff.durationSeconds);
        }
        triggered = true;
        break;
      }
    }

    if (triggered) {
      world.emitFx?.({ type: 'trapTrigger', throwableId: t.throwableId, pos: t.position.clone() });
      world.scene.remove(t.mesh);
      disposeObject3D(t.mesh);
      continue;
    }

    remaining.push(t);
  }

  world.traps = remaining;
}

function explode(world: ThrowablesWorld, throwableId: ThrowableId, owner: Entity, pos: THREE.Vector3): void {
  const cfg = THROWABLE_CONFIGS[throwableId];
  if (cfg.effect.kind !== 'explosion') return;

  const statusEffects =
    cfg.effect.onHitEffects
      ?.filter((eff) => eff.kind === 'status')
      .map((eff) => ({
        id: eff.id,
        durationSeconds:
          eff.durationSeconds === undefined
            ? undefined
            : typeof eff.durationSeconds === 'number'
              ? eff.durationSeconds
              : eff.durationSeconds.max
      })) ?? [];

  const knockbackDistance = Math.max(
    0,
    ...(cfg.effect.onHitEffects?.filter((eff) => eff.kind === 'impulse').map((eff) => eff.distance) ?? [0])
  );

  applyExplosion(world.entities, pos, cfg.effect.radiusMeters, cfg.effect.maxDamage, {
    attackerId: owner.id,
    attackerTeam: owner.team,
    knockbackDistance,
    statusEffects: statusEffects.length > 0 ? statusEffects : undefined
  });
  world.emitFx?.({ type: 'explosion', throwableId, pos: pos.clone(), radius: cfg.effect.radiusMeters });
}

function resolveOwner(world: ThrowablesWorld, ownerId: string): Entity {
  return world.entities.find((e) => e.id === ownerId) ?? world.entities[0];
}

function createProjectileMesh(category: string): THREE.Object3D {
  const color = category === 'explosive' ? 0xffc44d : category === 'trap' ? 0xff6b6b : 0x79d5ff;
  const geo = new THREE.SphereGeometry(0.18, 12, 12);
  const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.35, metalness: 0.1, emissive: new THREE.Color(color), emissiveIntensity: 0.15 });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.castShadow = true;
  return mesh;
}

function createSmokeMesh(smokeType: 'normal' | 'poison', radius: number): THREE.Object3D {
  const color = smokeType === 'poison' ? 0x7bff79 : 0xffffff;
  const geo = new THREE.SphereGeometry(radius, 18, 18);
  const mat = new THREE.MeshStandardMaterial({ color, roughness: 1.0, metalness: 0.0, transparent: true, opacity: 0.12 });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.castShadow = false;
  mesh.receiveShadow = false;
  return mesh;
}

function createAreaMesh(category: string, radius: number): THREE.Object3D {
  const color = category === 'trap' ? 0xff6b6b : category === 'utility' ? 0x79d5ff : 0xffc44d;
  const geo = new THREE.CircleGeometry(radius, 28);
  const mat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.22, depthWrite: false });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.y = GROUND_Y + 0.01;
  return mesh;
}

function createTrapMesh(category: string): THREE.Object3D {
  const color = category === 'trap' ? 0xff6b6b : 0x9aa5b4;
  const geo = new THREE.BoxGeometry(0.4, 0.2, 0.4);
  const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.8, metalness: 0.05 });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.castShadow = true;
  return mesh;
}
