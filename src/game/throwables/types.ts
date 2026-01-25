import * as THREE from 'three';
import type { ThrowableId } from '../config/ids';
import type { TeamId } from '../entities/entityBase';

export type ThrowableProjectile = {
  id: string;
  throwableId: ThrowableId;
  ownerId: string;
  ownerTeam: TeamId;
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  radius: number;
  detonateTimer: number;
  mesh: THREE.Object3D;
};

export type SmokeVolume = {
  id: string;
  throwableId: ThrowableId;
  ownerId: string;
  ownerTeam: TeamId;
  position: THREE.Vector3;
  radius: number;
  timeLeft: number;
  smokeType: 'normal' | 'poison';
  damagePerSecond?: number;
  mesh: THREE.Object3D;
};

export type AreaEffect = {
  id: string;
  throwableId: ThrowableId;
  ownerId: string;
  ownerTeam: TeamId;
  position: THREE.Vector3;
  radius: number;
  timeLeft: number;
  damagePerSecond?: number;
  ignitable?: boolean;
  ignited?: boolean;
  burnDamagePerSecondOnIgnite?: number;
  mesh: THREE.Object3D;
};

export type TrapInstance = {
  id: string;
  throwableId: ThrowableId;
  ownerId: string;
  ownerTeam: TeamId;
  position: THREE.Vector3;
  radius: number;
  timeLeft?: number;
  mesh: THREE.Object3D;
};

