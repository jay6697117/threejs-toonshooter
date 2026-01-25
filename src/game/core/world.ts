import * as THREE from 'three';
import type { Cover } from '../arena/cover';
import type { Pickup } from '../arena/pickups';
import type { Entity } from '../entities/entityBase';
import type { Projectile } from '../weapons/projectile';
import type { AreaEffect, SmokeVolume, ThrowableProjectile, TrapInstance } from '../throwables/types';
import type { ModeId, SceneId } from '../config/ids';
import type { ArenaBounds, ArenaObjectiveDef, ArenaZone } from '../arena/sceneDefinitions';
import { createDefaultSeed, createRng, type Rng } from './rng';

export type World = {
  scene: THREE.Scene;
  timeSeconds: number;
  stepIndex: number;
  seed: number;
  rng: Rng;
  entities: Entity[];
  covers: Cover[];
  pickups: Pickup[];
  projectiles: Projectile[];
  throwableProjectiles: ThrowableProjectile[];
  smokes: SmokeVolume[];
  areas: AreaEffect[];
  traps: TrapInstance[];
  arena?: {
    sceneId: SceneId;
    modeId: ModeId;
    bounds: ArenaBounds;
    zones: ArenaZone[];
    objectives?: ArenaObjectiveDef;
    ffaSpawns: THREE.Vector3[];
    redSpawns: THREE.Vector3[];
    blueSpawns: THREE.Vector3[];
    runtimeObjects: THREE.Object3D[];
    wind: THREE.Vector3;
    globalDarkTimeLeft: number;
    globalDarkCooldown: number;
    lightningCooldown: number;
    trapCooldown: number;
  };
};

export function createWorld(scene: THREE.Scene, options?: { seed?: number }): World {
  const seed = options?.seed ?? createDefaultSeed();
  return {
    scene,
    timeSeconds: 0,
    stepIndex: 0,
    seed,
    rng: createRng(seed),
    entities: [],
    covers: [],
    pickups: [],
    projectiles: [],
    throwableProjectiles: [],
    smokes: [],
    areas: [],
    traps: [],
    arena: undefined
  };
}
