import * as THREE from 'three';
import type { ModeId, StatusEffectId, WeaponId } from '../src/game/config/ids';
import type { World } from '../src/game/core/world';
import { createWorld } from '../src/game/core/world';
import type { ActiveStatus, Entity, TeamId } from '../src/game/entities/entityBase';

export function createTestEntity(options: { id: string; team: TeamId; isAI: boolean; pos?: THREE.Vector3 }): Entity {
  const position = options.pos?.clone() ?? new THREE.Vector3();

  const statuses = new Map<StatusEffectId, ActiveStatus>();
  const weaponSlots: Array<WeaponId | null> = ['flyingKnife', 'huntingBow', 'heavyCrossbow'];

  return {
    id: options.id,
    team: options.team,
    isAI: options.isAI,

    position,
    velocity: new THREE.Vector3(),
    yaw: 0,

    damageDealtMultiplier: 1,
    isInDark: false,
    isInWater: false,

    hp: 100,
    maxHp: 100,
    eliminated: false,
    deathProcessed: false,
    respawnTimer: 0,
    livesLeft: 3,
    kills: 0,
    deaths: 0,
    score: 0,
    carryingFlag: null,

    lastAttackerId: null,
    lastAttackerTeam: null,
    lastWeaponId: null,

    radius: 0.5,
    hurtRadius: 0.6,

    dashTimer: 0,
    dashCooldown: 0,
    dashDir: new THREE.Vector3(0, 0, 1),

    statuses,

    weaponSlots,
    activeWeaponSlot: 0,
    weaponSlotStates: [null, null, null],

    throwableSlots: [null, null],
    activeThrowableSlot: 0,

    mesh: new THREE.Object3D()
  };
}

export function createWorldWithArena(modeId: ModeId): World {
  const world = createWorld(new THREE.Scene(), { seed: 123 });
  world.arena = {
    sceneId: 'trainingGround',
    modeId,
    bounds: { minX: -13, maxX: 13, minZ: -9, maxZ: 9 },
    zones: [],
    objectives: {
      siege: { capturePoint: new THREE.Vector3(0, 0, 0), captureRadius: 3 },
      ctf: {
        redFlagBase: new THREE.Vector3(-11, 0, 0),
        blueFlagBase: new THREE.Vector3(11, 0, 0),
        redBase: new THREE.Vector3(-11, 0, 0),
        blueBase: new THREE.Vector3(11, 0, 0)
      }
    },
    ffaSpawns: [new THREE.Vector3(-8, 0.95, 0), new THREE.Vector3(8, 0.95, 0)],
    redSpawns: [new THREE.Vector3(-10, 0.95, -4), new THREE.Vector3(-10, 0.95, 4)],
    blueSpawns: [new THREE.Vector3(10, 0.95, -4), new THREE.Vector3(10, 0.95, 4)],
    runtimeObjects: [],
    wind: new THREE.Vector3(),
    globalDarkTimeLeft: 0,
    globalDarkCooldown: 0,
    lightningCooldown: 0,
    trapCooldown: 0
  };
  return world;
}
