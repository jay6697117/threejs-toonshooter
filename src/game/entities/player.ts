import * as THREE from 'three';
import { GAME_CONFIG } from '../config/game';
import type { InputManager } from '../core/input';
import type { Entity, TeamId } from './entityBase';
import { updateCharacterMovement } from './movement';

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
    damageDealtMultiplier: 1,
    isInDark: false,
    isInWater: false,
    hp: GAME_CONFIG.player.hp,
    maxHp: GAME_CONFIG.player.hp,
    eliminated: false,
    respawnTimer: 0,
    livesLeft: 0,
    kills: 0,
    deaths: 0,
    score: 0,
    carryingFlag: null,
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
  const moveDir = getMoveDirection(input);
  updateCharacterMovement(entity, moveDir, aimPoint, dt, dashRequested);
}

function getMoveDirection(input: InputManager): THREE.Vector3 {
  const dir = new THREE.Vector3();
  if (input.isDown('moveForward')) dir.z -= 1;
  if (input.isDown('moveBackward')) dir.z += 1;
  if (input.isDown('moveLeft')) dir.x -= 1;
  if (input.isDown('moveRight')) dir.x += 1;
  return dir;
}
