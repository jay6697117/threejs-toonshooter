import * as THREE from 'three';
import type { ModeId, SceneId } from '../config/ids';
import { ARENA_SCENES, type ArenaGltfAssetRef, type ArenaSceneDef, type ArenaZone } from './sceneDefinitions';
import { createBoxCover, updateCoverAabb, type Cover } from './cover';
import { createHealthPickup, createThrowablePickup, createWeaponPickup, type Pickup } from './pickups';
import type { World } from '../core/world';
import { applyStatus } from '../combat/statusEffects';
import { dealDamage } from '../combat/damage';
import type { Assets } from '../core/assets';
import { disposeObject3D } from '../core/dispose';
import { createToonMaterial } from '../core/materialFactory';

const TRAP_CENTER = new THREE.Vector3(0, 0, 0);

export type ArenaRuntime = {
  def: ArenaSceneDef;
  modeId: ModeId;
  ground: THREE.Mesh;
  objects: THREE.Object3D[];
};

export function loadArena(
  scene: THREE.Scene,
  world: World,
  modeId: ModeId,
  sceneId: SceneId,
  options?: { arenaScale?: number; assets?: Assets }
): ArenaRuntime {
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

  if (options?.assets) {
    for (const group of def.preload ?? []) {
      void options.assets.preload(group.namespace, group.category, group.keys);
    }
  }

  for (const c of def.covers) {
    const cover = createBoxCover({
      id: c.id,
      size: c.size,
      pos: c.pos.clone().setY(c.pos.y),
      color: c.color,
      hp: c.hp
    });
    cover.burnable = c.burnable ?? false;
    cover.pushable = c.pushable ?? false;
    cover.climbable = c.climbable ?? false;
    cover.toggleable = c.toggleable ?? false;
    cover.blocksProjectiles = c.blocksProjectiles ?? true;
    cover.burnTimeLeftSeconds = 0;
    cover.burnSeconds = c.burnSeconds;
    cover.burnRadiusMeters = c.burnRadiusMeters;
    cover.burnDamagePerSecond = c.burnDamagePerSecond;
    cover.onDestroyedExplosion = c.onDestroyedExplosion;
    cover.onDestroyedSpawnCover = c.onDestroyedSpawnCover;

    scene.add(cover.mesh);
    world.covers.push(cover);
    objects.push(cover.mesh);

    if (options?.assets && c.gltf) {
      void applyCoverGltf(scene, options.assets, cover, c.size, c.gltf);
    }
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
    objectives: def.objectives,
    ffaSpawns: def.ffaSpawns.map((p) => scalePositionXZ(p, def.bounds, arenaScale)),
    redSpawns: def.redSpawns.map((p) => scalePositionXZ(p, def.bounds, arenaScale)),
    blueSpawns: def.blueSpawns.map((p) => scalePositionXZ(p, def.bounds, arenaScale)),
    runtimeObjects: objects,
    wind: new THREE.Vector3(),
    globalDarkTimeLeft: 0,
    globalDarkCooldown: 0,
    lightningCooldown: 0,
    trapCooldown: 0
  };

  if (sceneId === 'wuzhangyuanCamp') {
    world.arena.globalDarkCooldown = 14;
  }
  if (sceneId === 'baidicheng') {
    world.arena.lightningCooldown = 3;
  }
  if (sceneId === 'hulaoPass') {
    world.arena.trapCooldown = 6;
  }

  return { def, modeId, ground, objects };
}

export function updateArena(world: World, dt: number): void {
  if (!world.arena) return;

  updateSceneEvents(world, dt);
  applyZones(world, dt);
  updateBurningCovers(world, dt);
}

async function applyCoverGltf(
  scene: THREE.Scene,
  assets: Assets,
  cover: Cover,
  targetSize: THREE.Vector3,
  ref: ArenaGltfAssetRef
): Promise<void> {
  try {
    await assets.loadManifest();
  } catch {
    return;
  }

  const path = assets.getManifestPath(ref.namespace, ref.category, ref.key);
  if (!path) return;

  const placeholder = cover.mesh;
  const parent = placeholder.parent;
  if (!parent) return;

  try {
    const gltf = await assets.cloneGltf(path);
    const root = gltf.root;
    root.rotation.y = ref.rotationY ?? 0;

    root.traverse((obj) => {
      const mesh = obj as THREE.Mesh;
      if (!mesh.isMesh) return;
      mesh.castShadow = true;
      mesh.receiveShadow = true;
    });

    const box0 = new THREE.Box3().setFromObject(root);
    const size0 = new THREE.Vector3();
    box0.getSize(size0);

    const sx = size0.x > 1e-3 ? targetSize.x / size0.x : 1;
    const sy = size0.y > 1e-3 ? targetSize.y / size0.y : 1;
    const sz = size0.z > 1e-3 ? targetSize.z / size0.z : 1;
    root.scale.set(sx, sy, sz);
    root.updateWorldMatrix(true, true);

    const box1 = new THREE.Box3().setFromObject(root);
    const center = new THREE.Vector3();
    box1.getCenter(center);

    const targetCenter = placeholder.position.clone().add(ref.offset ? ref.offset.clone() : new THREE.Vector3());
    const delta = targetCenter.sub(center);
    root.position.add(delta);

    if (cover.mesh !== placeholder) {
      scene.remove(root);
      disposeObject3D(root);
      return;
    }
    if (!placeholder.parent) {
      scene.remove(root);
      disposeObject3D(root);
      return;
    }

    root.visible = placeholder.visible;
    parent.add(root);
    cover.mesh = root;
    updateCoverAabb(cover);

    parent.remove(placeholder);
    disposeObject3D(placeholder);
  } catch {
    // ignored
  }
}

export function clearArena(scene: THREE.Scene, world: World): void {
  const disposeQueue = new Set<THREE.Object3D>();

  for (const obj of world.arena?.runtimeObjects ?? []) {
    disposeQueue.add(obj);
  }

  for (const cover of world.covers) {
    disposeQueue.add(cover.mesh);
  }

  for (const pickup of world.pickups) {
    disposeQueue.add(pickup.mesh);
  }

  for (const proj of world.projectiles) {
    disposeQueue.add(proj.mesh);
  }
  for (const proj of world.throwableProjectiles) {
    disposeQueue.add(proj.mesh);
  }
  for (const s of world.smokes) {
    disposeQueue.add(s.mesh);
  }
  for (const a of world.areas) {
    disposeQueue.add(a.mesh);
  }
  for (const t of world.traps) {
    disposeQueue.add(t.mesh);
  }

  for (const obj of disposeQueue) {
    scene.remove(obj);
    disposeObject3D(obj);
  }

  world.covers.length = 0;
  world.pickups.length = 0;
  world.projectiles.length = 0;
  world.throwableProjectiles.length = 0;
  world.smokes.length = 0;
  world.areas.length = 0;
  world.traps.length = 0;
  world.arena = undefined;
}

function scaleBounds(bounds: { minX: number; maxX: number; minZ: number; maxZ: number }, scale: number): { minX: number; maxX: number; minZ: number; maxZ: number } {
  if (scale === 1) return bounds;
  const cx = (bounds.minX + bounds.maxX) / 2;
  const cz = (bounds.minZ + bounds.maxZ) / 2;
  const hx = ((bounds.maxX - bounds.minX) / 2) * scale;
  const hz = ((bounds.maxZ - bounds.minZ) / 2) * scale;
  return { minX: cx - hx, maxX: cx + hx, minZ: cz - hz, maxZ: cz + hz };
}

function scalePositionXZ(pos: THREE.Vector3, bounds: { minX: number; maxX: number; minZ: number; maxZ: number }, scale: number): THREE.Vector3 {
  if (scale === 1) return pos.clone();
  const cx = (bounds.minX + bounds.maxX) / 2;
  const cz = (bounds.minZ + bounds.maxZ) / 2;
  return new THREE.Vector3(cx + (pos.x - cx) * scale, pos.y, cz + (pos.z - cz) * scale);
}

function createGround(bounds: { minX: number; maxX: number; minZ: number; maxZ: number }, color: number): THREE.Mesh {
  const width = bounds.maxX - bounds.minX;
  const depth = bounds.maxZ - bounds.minZ;

  const geo = new THREE.PlaneGeometry(width, depth);
  const mat = createToonMaterial({ color });
  const ground = new THREE.Mesh(geo, mat);
  ground.rotation.x = -Math.PI / 2;
  ground.position.set((bounds.minX + bounds.maxX) / 2, 0, (bounds.minZ + bounds.maxZ) / 2);
  ground.receiveShadow = true;
  return ground;
}

function applyZones(world: World, dt: number): void {
  const zones = world.arena?.zones ?? [];
  const globalDark = (world.arena?.globalDarkTimeLeft ?? 0) > 0;

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

    if (globalDark) entity.isInDark = true;
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

    for (const other of world.covers) {
      if (!other.active) continue;
      if (!other.burnable) continue;
      if ((other.burnTimeLeftSeconds ?? 0) > 0) continue;
      const dist = other.mesh.position.distanceTo(cover.mesh.position);
      if (dist > radius * 0.9) continue;
      const burnSeconds = other.burnSeconds ?? 6;
      other.burnTimeLeftSeconds = Math.max(other.burnTimeLeftSeconds ?? 0, burnSeconds);
    }
  }
}

function updateSceneEvents(world: World, dt: number): void {
  const arena = world.arena;
  if (!arena) return;

  if (arena.sceneId === 'wuzhangyuanCamp') {
    const t = world.timeSeconds;
    arena.wind.set(Math.sin(t * 0.6) * 2.2, 0, Math.cos(t * 0.4) * 1.4);

    arena.globalDarkTimeLeft = Math.max(0, arena.globalDarkTimeLeft - dt);
    arena.globalDarkCooldown = Math.max(0, arena.globalDarkCooldown - dt);
    if (arena.globalDarkTimeLeft <= 0 && arena.globalDarkCooldown <= 0) {
      arena.globalDarkTimeLeft = 5;
      arena.globalDarkCooldown = 25;
    }
  } else {
    arena.wind.set(0, 0, 0);
    arena.globalDarkTimeLeft = 0;
    arena.globalDarkCooldown = 0;
  }

  if (arena.sceneId === 'baidicheng') {
    arena.lightningCooldown = arena.lightningCooldown - dt;
    if (arena.lightningCooldown <= 0) {
      arena.lightningCooldown = 6 + world.rng.nextFloat() * 4;

      const bounds = arena.bounds;
      const x = bounds.minX + 2 + world.rng.nextFloat() * (bounds.maxX - bounds.minX - 4);
      const z = bounds.minZ + 2 + world.rng.nextFloat() * (bounds.maxZ - bounds.minZ - 4);
      const radius = 3.0;

      for (const entity of world.entities) {
        if (entity.eliminated) continue;
        const dx = entity.position.x - x;
        const dz = entity.position.z - z;
        if (dx * dx + dz * dz > radius * radius) continue;
        dealDamage(entity, 28, { isDot: false });
        applyStatus(entity, 'stun', 0.6);
      }
    }
  } else {
    arena.lightningCooldown = 0;
  }

  if (arena.sceneId === 'hulaoPass') {
    arena.trapCooldown = arena.trapCooldown - dt;
    if (arena.trapCooldown <= 0) {
      arena.trapCooldown = 12;
      for (const entity of world.entities) {
        if (entity.eliminated) continue;
        if (entity.position.distanceToSquared(TRAP_CENTER) > 3.2 * 3.2) continue;
        dealDamage(entity, 10, { isDot: false });
        applyStatus(entity, 'knockdown', 1.2);
      }
    }
  } else {
    arena.trapCooldown = 0;
  }
}
