import * as THREE from 'three';
import type { ThrowableId, WeaponId } from '../config/ids';
import type { Entity } from '../entities/entityBase';

export type PickupKind = 'weapon' | 'throwable' | 'health';

export type Pickup = {
  id: string;
  kind: PickupKind;
  active: boolean;
  position: THREE.Vector3;
  radius: number;
  mesh: THREE.Object3D;

  weaponId?: WeaponId;
  throwableId?: ThrowableId;
  amount?: number;
};

export function createWeaponPickup(options: { id: string; weaponId: WeaponId; pos: THREE.Vector3; color?: number }): Pickup {
  const mesh = createPickupMesh(options.color ?? 0x79d5ff);
  mesh.position.copy(options.pos);
  return { id: options.id, kind: 'weapon', active: true, position: options.pos.clone(), radius: 0.7, mesh, weaponId: options.weaponId };
}

export function createThrowablePickup(options: { id: string; throwableId: ThrowableId; pos: THREE.Vector3; color?: number; count?: number }): Pickup {
  const mesh = createPickupMesh(options.color ?? 0xffc44d);
  mesh.position.copy(options.pos);
  return {
    id: options.id,
    kind: 'throwable',
    active: true,
    position: options.pos.clone(),
    radius: 0.7,
    mesh,
    throwableId: options.throwableId,
    amount: options.count ?? 1
  };
}

export function createHealthPickup(options: { id: string; amount: number; pos: THREE.Vector3; color?: number }): Pickup {
  const mesh = createPickupMesh(options.color ?? 0x8cff75);
  mesh.position.copy(options.pos);
  return {
    id: options.id,
    kind: 'health',
    active: true,
    position: options.pos.clone(),
    radius: 0.7,
    mesh,
    amount: options.amount
  };
}

export function updatePickups(pickups: Pickup[], entities: Entity[], dt: number, timeSeconds: number): void {
  for (const pickup of pickups) {
    if (!pickup.active) continue;

    pickup.mesh.rotation.y = timeSeconds * 1.2;
    pickup.mesh.position.y = pickup.position.y + 0.12 + Math.sin(timeSeconds * 3.0) * 0.06;

    for (const entity of entities) {
      if (entity.eliminated) continue;
      if (tryPickup(entity, pickup)) break;
    }
  }
}

function tryPickup(entity: Entity, pickup: Pickup): boolean {
  const dx = entity.position.x - pickup.position.x;
  const dz = entity.position.z - pickup.position.z;
  const distSq = dx * dx + dz * dz;
  const minDist = entity.radius + pickup.radius;
  if (distSq > minDist * minDist) return false;

  if (pickup.kind === 'weapon' && pickup.weaponId) {
    pickupWeapon(entity, pickup.weaponId);
  } else if (pickup.kind === 'throwable' && pickup.throwableId) {
    pickupThrowable(entity, pickup.throwableId, pickup.amount ?? 1);
  } else if (pickup.kind === 'health') {
    const amount = pickup.amount ?? 0;
    entity.hp = Math.min(entity.maxHp, entity.hp + amount);
  }

  pickup.active = false;
  pickup.mesh.visible = false;
  return true;
}

function pickupWeapon(entity: Entity, weaponId: WeaponId): void {
  const emptyIdx = entity.weaponSlots.findIndex((w) => w === null);
  if (emptyIdx >= 0) {
    entity.weaponSlots[emptyIdx] = weaponId;
    entity.activeWeaponSlot = emptyIdx;
    return;
  }

  entity.weaponSlots[entity.activeWeaponSlot] = weaponId;
}

function pickupThrowable(entity: Entity, throwableId: ThrowableId, count: number): void {
  const existingIdx = entity.throwableSlots.findIndex((s) => s?.id === throwableId);
  if (existingIdx >= 0) {
    const existing = entity.throwableSlots[existingIdx];
    if (existing) existing.count = Math.min(existing.count + count, 3);
    return;
  }

  const emptyIdx = entity.throwableSlots.findIndex((s) => s === null);
  if (emptyIdx >= 0) {
    entity.throwableSlots[emptyIdx] = { id: throwableId, count: Math.min(count, 3) };
    entity.activeThrowableSlot = emptyIdx;
    return;
  }

  entity.throwableSlots[entity.activeThrowableSlot] = { id: throwableId, count: Math.min(count, 3) };
}

function createPickupMesh(color: number): THREE.Object3D {
  const group = new THREE.Group();

  const baseGeo = new THREE.CylinderGeometry(0.35, 0.35, 0.12, 16);
  const baseMat = new THREE.MeshStandardMaterial({ color: 0x1b1f26, roughness: 0.9, metalness: 0.1 });
  const base = new THREE.Mesh(baseGeo, baseMat);
  base.receiveShadow = true;
  group.add(base);

  const coreGeo = new THREE.SphereGeometry(0.22, 16, 16);
  const coreMat = new THREE.MeshStandardMaterial({ color, roughness: 0.35, metalness: 0.2, emissive: new THREE.Color(color), emissiveIntensity: 0.35 });
  const core = new THREE.Mesh(coreGeo, coreMat);
  core.position.y = 0.24;
  core.castShadow = true;
  group.add(core);

  return group;
}

