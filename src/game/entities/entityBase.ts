import * as THREE from 'three';
import type { StatusEffectId, ThrowableId, WeaponId } from '../config/ids';
import type { WeaponSlotState } from '../weapons/weaponState';

export type ActiveStatus = {
  id: StatusEffectId;
  timeLeft: number;
};

export type TeamId = 'p1' | 'p2' | 'p3' | 'p4';

export type EntityId = string;

export type Entity = {
  id: EntityId;
  team: TeamId;
  isAI: boolean;

  position: THREE.Vector3;
  velocity: THREE.Vector3;
  yaw: number;

  hp: number;
  maxHp: number;
  eliminated: boolean;

  radius: number;
  hurtRadius: number;

  dashTimer: number;
  dashCooldown: number;
  dashDir: THREE.Vector3;

  statuses: Map<StatusEffectId, ActiveStatus>;

  weaponSlots: Array<WeaponId | null>;
  activeWeaponSlot: number;
  weaponSlotStates: Array<WeaponSlotState | null>;

  throwableSlots: Array<{ id: ThrowableId; count: number } | null>;
  activeThrowableSlot: number;

  mesh: THREE.Object3D;
};

export function setYaw(entity: Entity, yaw: number): void {
  entity.yaw = yaw;
  entity.mesh.rotation.y = yaw;
}

export function syncVisual(entity: Entity): void {
  entity.mesh.position.copy(entity.position);
  entity.mesh.rotation.y = entity.yaw;
}
