import * as THREE from 'three';
import { GAME_CONFIG } from '../config/game';
import { computeStatusDerived } from '../combat/statusEffects';
import type { InputManager } from '../core/input';
import type { Entity, TeamId } from './entityBase';
import { setYaw } from './entityBase';

export type CreatePlayerOptions = {
  id: string;
  team: TeamId;
  color: number;
  startPos: THREE.Vector3;
  mesh: THREE.Object3D;
};

export function createPlayerEntity(options: CreatePlayerOptions): Entity {
  const entity: Entity = {
    id: options.id,
    team: options.team,
    isAI: false,
    position: options.startPos.clone(),
    velocity: new THREE.Vector3(),
    yaw: 0,
    hp: GAME_CONFIG.player.hp,
    maxHp: GAME_CONFIG.player.hp,
    eliminated: false,
    radius: GAME_CONFIG.player.radiusMeters,
    hurtRadius: GAME_CONFIG.player.hurtRadiusMeters,
    dashTimer: 0,
    dashCooldown: 0,
    dashDir: new THREE.Vector3(0, 0, 1),
    statuses: new Map(),
    weaponSlots: ['flyingKnife', 'huntingBow', 'heavyCrossbow'],
    activeWeaponSlot: 0,
    weaponSlotStates: [null, null, null],
    throwableSlots: [null, null],
    activeThrowableSlot: 0,
    mesh: options.mesh
  };

  entity.mesh.position.copy(entity.position);
  if ('castShadow' in entity.mesh) (entity.mesh as THREE.Mesh).castShadow = true;
  return entity;
}

export function updatePlayer(
  entity: Entity,
  input: InputManager,
  aimPoint: THREE.Vector3 | null,
  dt: number,
  dashRequested: boolean
): void {
  if (entity.eliminated) return;

  const derived = computeStatusDerived(entity);

  entity.dashCooldown = Math.max(0, entity.dashCooldown - dt);
  entity.dashTimer = Math.max(0, entity.dashTimer - dt);

  const moveDir = getMoveDirection(input);
  const wantsDash = dashRequested && !derived.isStunned && !derived.isKnockedDown;

  if (wantsDash && entity.dashCooldown <= 0) {
    entity.dashCooldown = GAME_CONFIG.player.dashCooldownSeconds;
    entity.dashTimer = GAME_CONFIG.player.dashDurationSeconds;
    if (moveDir.lengthSq() > 1e-6) {
      entity.dashDir.copy(moveDir).normalize();
    } else {
      entity.dashDir.set(Math.sin(entity.yaw), 0, Math.cos(entity.yaw));
    }
  }

  if (aimPoint) {
    const ax = aimPoint.x - entity.position.x;
    const az = aimPoint.z - entity.position.z;
    const lenSq = ax * ax + az * az;
    if (lenSq > 1e-6) {
      setYaw(entity, Math.atan2(ax, az));
    }
  }

  const speedMul = derived.isRooted || derived.isStunned || derived.isKnockedDown ? 0 : derived.speedMultiplier;
  const baseSpeed =
    entity.dashTimer > 0 ? GAME_CONFIG.player.dashSpeedMetersPerSecond : GAME_CONFIG.player.speedMetersPerSecond;
  const speed = baseSpeed * speedMul;

  if (entity.dashTimer > 0) {
    entity.velocity.copy(entity.dashDir).multiplyScalar(speed);
  } else if (moveDir.lengthSq() > 1e-6) {
    entity.velocity.copy(moveDir).normalize().multiplyScalar(speed);
  } else {
    entity.velocity.set(0, 0, 0);
  }

  entity.position.addScaledVector(entity.velocity, dt);
}

function getMoveDirection(input: InputManager): THREE.Vector3 {
  const dir = new THREE.Vector3();
  if (input.isDown('moveForward')) dir.z -= 1;
  if (input.isDown('moveBackward')) dir.z += 1;
  if (input.isDown('moveLeft')) dir.x -= 1;
  if (input.isDown('moveRight')) dir.x += 1;
  return dir;
}
