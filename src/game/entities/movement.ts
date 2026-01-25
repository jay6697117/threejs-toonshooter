import * as THREE from 'three';
import { GAME_CONFIG } from '../config/game';
import { computeStatusDerived } from '../combat/statusEffects';
import type { Entity } from './entityBase';
import { setYaw } from './entityBase';

export function updateCharacterMovement(
  entity: Entity,
  moveDir: THREE.Vector3,
  aimPoint: THREE.Vector3 | null,
  dt: number,
  dashRequested: boolean
): void {
  if (entity.eliminated) return;

  const derived = computeStatusDerived(entity);

  entity.dashCooldown = Math.max(0, entity.dashCooldown - dt);
  entity.dashTimer = Math.max(0, entity.dashTimer - dt);

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
  const baseSpeed = entity.dashTimer > 0 ? GAME_CONFIG.player.dashSpeedMetersPerSecond : GAME_CONFIG.player.speedMetersPerSecond;
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

