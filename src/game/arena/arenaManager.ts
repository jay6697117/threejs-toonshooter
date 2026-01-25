import * as THREE from 'three';
import type { ModeId, SceneId } from '../config/ids';
import { ARENA_SCENES, type ArenaSceneDef, type ArenaZone } from './sceneDefinitions';
import { createBoxCover, type Cover } from './cover';
import { createHealthPickup, createThrowablePickup, createWeaponPickup, type Pickup } from './pickups';
import type { World } from '../core/world';
import { applyExplosion } from '../combat/areaDamage';
import { applyStatus } from '../combat/statusEffects';
import { dealDamage } from '../combat/damage';

export type ArenaRuntime = {
  def: ArenaSceneDef;
  modeId: ModeId;
  ground: THREE.Mesh;
  objects: THREE.Object3D[];
};

export function loadArena(scene: THREE.Scene, world: World, modeId: ModeId, sceneId: SceneId, options?: { arenaScale?: number }): ArenaRuntime {
  const def = ARENA_SCENES[sceneId];
  if (!def.supportedModes.includes(modeId)) {
    throw new Error(`Arena scene ${sceneId} does not support mode ${modeId}`);
  }

  clearArena(scene, world);

  const arenaScale = options?.arenaScale ?? 1;
  const bounds = scaleBounds(def.bounds, arenaScale);

  const ground = createGround(bounds, def.groundColor);
  scene.add(ground);

  const objects: THREE.Object3D[] = [ground];

  for (const c of def.covers) {
    const cover = createBoxCover({
      id: c.id,
      size: c.size,
      pos: c.pos.clone().setY(c.pos.y),
      color: c.color,
      hp: c.hp
    });
    cover.burnable = c.burnable ?? false;
    cover.burnTimeLeftSeconds = 0;
    cover.burnSeconds = c.burnSeconds;
    cover.burnRadiusMeters = c.burnRadiusMeters;
    cover.burnDamagePerSecond = c.burnDamagePerSecond;
    cover.onDestroyedExplosion = c.onDestroyedExplosion;

    scene.add(cover.mesh);
    world.covers.push(cover);
    objects.push(cover.mesh);
  }

  for (const p of def.pickups) {
    let pickup: Pickup;
    if (p.kind === 'weapon') {
      pickup = createWeaponPickup({ id: p.id, weaponId: p.weaponId, pos: p.pos.clone() });
    } else if (p.kind === 'throwable') {
      pickup = createThrowablePickup({ id: p.id, throwableId: p.throwableId, pos: p.pos.clone(), count: p.count });
    } else {
      pickup = createHealthPickup({ id: p.id, amount: p.amount, pos: p.pos.clone() });
    }
    scene.add(pickup.mesh);
    world.pickups.push(pickup);
    objects.push(pickup.mesh);
  }

  world.arena = {
    sceneId,
    modeId,
    bounds,
    zones: def.zones ?? [],
    objectives: def.objectives
  };

  return { def, modeId, ground, objects };
}

export function updateArena(world: World, dt: number): void {
  if (!world.arena) return;

  applyZones(world, dt);
  updateBurningCovers(world, dt);
}

export function clearArena(scene: THREE.Scene, world: World): void {
  for (const cover of world.covers) {
    scene.remove(cover.mesh);
  }
  for (const pickup of world.pickups) {
    scene.remove(pickup.mesh);
  }
  for (const proj of world.projectiles) {
    scene.remove(proj.mesh);
  }
  for (const proj of world.throwableProjectiles) {
    scene.remove(proj.mesh);
  }
  for (const s of world.smokes) {
    scene.remove(s.mesh);
  }
  for (const a of world.areas) {
    scene.remove(a.mesh);
  }
  for (const t of world.traps) {
    scene.remove(t.mesh);
  }

  world.covers.length = 0;
  world.pickups.length = 0;
  world.projectiles.length = 0;
  world.throwableProjectiles.length = 0;
  world.smokes.length = 0;
  world.areas.length = 0;
  world.traps.length = 0;
}

function scaleBounds(bounds: { minX: number; maxX: number; minZ: number; maxZ: number }, scale: number): { minX: number; maxX: number; minZ: number; maxZ: number } {
  if (scale === 1) return bounds;
  const cx = (bounds.minX + bounds.maxX) / 2;
  const cz = (bounds.minZ + bounds.maxZ) / 2;
  const hx = ((bounds.maxX - bounds.minX) / 2) * scale;
  const hz = ((bounds.maxZ - bounds.minZ) / 2) * scale;
  return { minX: cx - hx, maxX: cx + hx, minZ: cz - hz, maxZ: cz + hz };
}

function createGround(bounds: { minX: number; maxX: number; minZ: number; maxZ: number }, color: number): THREE.Mesh {
  const width = bounds.maxX - bounds.minX;
  const depth = bounds.maxZ - bounds.minZ;

  const geo = new THREE.PlaneGeometry(width, depth);
  const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.95, metalness: 0.0 });
  const ground = new THREE.Mesh(geo, mat);
  ground.rotation.x = -Math.PI / 2;
  ground.position.set((bounds.minX + bounds.maxX) / 2, 0, (bounds.minZ + bounds.maxZ) / 2);
  ground.receiveShadow = true;
  return ground;
}

function applyZones(world: World, dt: number): void {
  const zones = world.arena?.zones ?? [];

  for (const entity of world.entities) {
    entity.damageDealtMultiplier = 1;
    entity.isInDark = false;
    entity.isInWater = false;
    if (entity.eliminated) continue;

    for (const zone of zones) {
      if (isInsideZone(entity.position, zone)) {
        if (zone.effect === 'waterSlow') {
          entity.isInWater = true;
          applyStatus(entity, 'slow', 0.2);
        } else if (zone.effect === 'dark') {
          entity.isInDark = true;
        } else if (zone.effect === 'centerDamageBuff') {
          entity.damageDealtMultiplier = Math.max(entity.damageDealtMultiplier, 1.2);
        }
      }
    }

    void dt;
  }
}

function isInsideZone(pos: THREE.Vector3, zone: ArenaZone): boolean {
  if (zone.kind === 'rect') {
    return pos.x >= zone.minX && pos.x <= zone.maxX && pos.z >= zone.minZ && pos.z <= zone.maxZ;
  }
  const dx = pos.x - zone.x;
  const dz = pos.z - zone.z;
  return dx * dx + dz * dz <= zone.radius * zone.radius;
}

function updateBurningCovers(world: World, dt: number): void {
  for (const cover of world.covers) {
    if (!cover.active) continue;
    if (!cover.burnable) continue;
    if ((cover.burnTimeLeftSeconds ?? 0) <= 0) continue;

    cover.burnTimeLeftSeconds = Math.max(0, (cover.burnTimeLeftSeconds ?? 0) - dt);
    const radius = cover.burnRadiusMeters ?? 0;
    const dps = cover.burnDamagePerSecond ?? 0;
    if (radius <= 0 || dps <= 0) continue;

    for (const entity of world.entities) {
      if (entity.eliminated) continue;
      const dist = entity.position.distanceTo(cover.mesh.position);
      if (dist > radius) continue;
      dealDamage(entity, dps * dt, { isDot: true });
      applyStatus(entity, 'burn', 0.2);
    }
  }
}

export function applyDamageToCover(scene: THREE.Scene, world: World, cover: Cover, amount: number, options?: { ignite?: boolean; attackerId?: string; attackerTeam?: string }): void {
  if (!cover.active) return;
  if (!cover.destructible) return;
  if (amount <= 0) return;

  cover.hp = Math.max(0, cover.hp - amount);
  if (options?.ignite && cover.burnable) {
    const burnSeconds = cover.burnSeconds ?? 6;
    cover.burnTimeLeftSeconds = Math.max(cover.burnTimeLeftSeconds ?? 0, burnSeconds);
  }

  if (cover.hp > 0) return;

  cover.active = false;
  scene.remove(cover.mesh);

  if (cover.onDestroyedExplosion) {
    applyExplosion(world.entities, cover.mesh.position, cover.onDestroyedExplosion.radiusMeters, cover.onDestroyedExplosion.damage, {
      attackerId: options?.attackerId,
      attackerTeam: options?.attackerTeam as any,
      knockbackDistance: cover.onDestroyedExplosion.knockbackDistance,
      statusEffects: cover.onDestroyedExplosion.statusEffects
    });
  }
}

