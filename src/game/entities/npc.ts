import * as THREE from 'three';
import { GAME_CONFIG } from '../config/game';
import type { Entity, TeamId } from './entityBase';
import { setYaw } from './entityBase';

export type CreateNpcOptions = {
  id: string;
  team: TeamId;
  color: number;
  startPos: THREE.Vector3;
  mesh: THREE.Object3D;
};

export function createNpcEntity(options: CreateNpcOptions): Entity {
  const entity: Entity = {
    id: options.id,
    team: options.team,
    isAI: true,
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
  setYaw(entity, Math.PI);
  return entity;
}
