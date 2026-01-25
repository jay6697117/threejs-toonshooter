import * as THREE from 'three';
import type { World } from '../core/world';
import { WEAPON_CONFIGS } from '../config/weapons';
import type { DifficultyConfig } from '../config/difficulty';
import type { Entity } from './entityBase';
import type { WeaponFrameInput } from '../weapons/weaponManager';
import type { MatchRuntime } from '../modes/modeManager';

export type AiControllerState = {
  nextDecisionTime: number;
  targetId: string | null;
  strafeSign: 1 | -1;
  fireDown: boolean;
};

export function ensureAiControllerState(map: Map<string, AiControllerState>, entityId: string): AiControllerState {
  const existing = map.get(entityId);
  if (existing) return existing;
  const created: AiControllerState = { nextDecisionTime: 0, targetId: null, strafeSign: Math.random() > 0.5 ? 1 : -1, fireDown: false };
  map.set(entityId, created);
  return created;
}

export function computeAiFrame(
  entity: Entity,
  ai: AiControllerState,
  world: World,
  match: MatchRuntime,
  difficulty: DifficultyConfig,
  dt: number
): { moveDir: THREE.Vector3; dashRequested: boolean; aimPoint: THREE.Vector3 | null; weaponInput: WeaponFrameInput } {
  const aimTarget = pickAimTarget(entity, ai, world, match);
  const goal = pickGoal(entity, world, match, aimTarget);

  const moveDir = new THREE.Vector3();
  let dashRequested = false;

  if (goal) {
    const dx = goal.x - entity.position.x;
    const dz = goal.z - entity.position.z;
    const distSq = dx * dx + dz * dz;
    if (distSq > 1.8 * 1.8) {
      moveDir.set(dx, 0, dz).normalize();
      if (entity.dashCooldown <= 0 && entity.dashTimer <= 0 && distSq > 6.5 * 6.5) {
        dashRequested = Math.random() < 0.02;
      }
    } else if (aimTarget) {
      const ax = aimTarget.position.x - entity.position.x;
      const az = aimTarget.position.z - entity.position.z;
      if (ax * ax + az * az > 1e-6) {
        const perpX = -az;
        const perpZ = ax;
        moveDir.set(perpX, 0, perpZ).normalize().multiplyScalar(ai.strafeSign);
      }
    }
  }

  const aimPoint = aimTarget ? new THREE.Vector3(aimTarget.position.x, entity.position.y, aimTarget.position.z) : goal;
  if (aimPoint && aimTarget) {
    const visibility = computeVisibilityFactor(world, entity.position, aimTarget.position, entity.isInDark, aimTarget.isInDark);
    applyAimNoise(aimPoint, entity.position, visibility, aimTarget.position.distanceTo(entity.position), difficulty.aiAimErrorMultiplier);
  }

  const weaponInput = computeWeaponInput(entity, ai, aimTarget, match, world, difficulty, dt);
  return { moveDir, dashRequested, aimPoint, weaponInput };
}

function pickGoal(entity: Entity, world: World, match: MatchRuntime, aimTarget: Entity | null): THREE.Vector3 | null {
  const arenaObj = world.arena?.objectives;

  if (match.state.modeId === 'siege') {
    const cp = arenaObj?.siege?.capturePoint;
    if (cp) return new THREE.Vector3(cp.x, entity.position.y, cp.z);
  }

  if (match.state.modeId === 'ctf') {
    const ctf = arenaObj?.ctf;
    if (!ctf) return aimTarget?.position ?? null;

    if (entity.team !== 'red' && entity.team !== 'blue') return aimTarget?.position ?? null;

    if (entity.carryingFlag) {
      const base = entity.team === 'red' ? ctf.redBase : ctf.blueBase;
      return new THREE.Vector3(base.x, entity.position.y, base.z);
    }

    const enemyTeam = entity.team === 'red' ? 'blue' : 'red';
    const flags = match.state.flags;
    const enemyFlag = enemyTeam === 'red' ? flags.red : flags.blue;
    return new THREE.Vector3(enemyFlag.pos.x, entity.position.y, enemyFlag.pos.z);
  }

  return aimTarget ? aimTarget.position : null;
}

function pickAimTarget(entity: Entity, ai: AiControllerState, world: World, match: MatchRuntime): Entity | null {
  ai.nextDecisionTime = Math.max(0, ai.nextDecisionTime - 1);
  if (ai.nextDecisionTime <= 0) {
    ai.nextDecisionTime = 30;
    ai.strafeSign = ai.strafeSign === 1 ? -1 : 1;
  }

  const enemies = world.entities.filter((e) => !e.eliminated && e.team !== entity.team);
  if (enemies.length === 0) return null;

  let best: Entity | null = null;
  let bestDistSq = Number.POSITIVE_INFINITY;
  for (const e of enemies) {
    const dx = e.position.x - entity.position.x;
    const dz = e.position.z - entity.position.z;
    const distSq = dx * dx + dz * dz;
    if (distSq < bestDistSq) {
      bestDistSq = distSq;
      best = e;
    }
  }

  if (match.state.modeId === 'ctf' && entity.team !== 'red' && entity.team !== 'blue') return best;

  ai.targetId = best?.id ?? null;
  return best;
}

function computeWeaponInput(
  entity: Entity,
  ai: AiControllerState,
  target: Entity | null,
  match: MatchRuntime,
  world: World,
  difficulty: DifficultyConfig,
  dt: number
): WeaponFrameInput {
  void dt;

  const weaponId = entity.weaponSlots[entity.activeWeaponSlot];
  const state = entity.weaponSlotStates[entity.activeWeaponSlot];
  if (!weaponId || !state) return { fireDown: false, firePressed: false, fireReleased: false, reloadPressed: false };

  if (match.state.modeId === 'ctf' && entity.carryingFlag) {
    return { fireDown: false, firePressed: false, fireReleased: false, reloadPressed: false };
  }

  const cfg = WEAPON_CONFIGS[weaponId];
  const maxRange = typeof cfg.rangeMeters === 'number' ? cfg.rangeMeters : cfg.rangeMeters.max;

  const distSq = target ? target.position.distanceToSquared(entity.position) : Number.POSITIVE_INFINITY;
  const inRange = target ? distSq <= maxRange * maxRange : false;

  const reloadPressed = state.ammo === 0 && state.reserve > 0 && state.reloadTimer <= 0;

  const visibility = target
    ? computeVisibilityFactor(world, entity.position, target.position, entity.isInDark, target.isInDark)
    : 0;

  if (cfg.charge) {
    if (!inRange) {
      ai.fireDown = false;
      return { fireDown: false, firePressed: false, fireReleased: false, reloadPressed };
    }

    if (target && visibility < 0.25) {
      ai.fireDown = false;
      return { fireDown: false, firePressed: false, fireReleased: false, reloadPressed };
    }

    if (!ai.fireDown) {
      ai.fireDown = true;
      return { fireDown: true, firePressed: true, fireReleased: false, reloadPressed };
    }

    const required = cfg.charge.requiredFullCharge ? cfg.charge.maxSeconds : cfg.charge.minSeconds;
    if (state.chargeSeconds >= required - 1e-3) {
      ai.fireDown = false;
      return { fireDown: false, firePressed: false, fireReleased: true, reloadPressed };
    }

    return { fireDown: true, firePressed: false, fireReleased: false, reloadPressed };
  }

  if (!inRange) {
    ai.fireDown = false;
    return { fireDown: false, firePressed: false, fireReleased: false, reloadPressed };
  }

  const confidence = Math.max(0, Math.min(1, visibility * 1.1 * difficulty.aiFireConfidenceMultiplier));
  const shouldFire = target ? Math.random() < confidence : false;

  if (cfg.auto) {
    ai.fireDown = shouldFire;
    return { fireDown: ai.fireDown, firePressed: false, fireReleased: false, reloadPressed };
  }

  ai.fireDown = false;
  return { fireDown: false, firePressed: shouldFire, fireReleased: false, reloadPressed };
}

function computeVisibilityFactor(world: World, from: THREE.Vector3, to: THREE.Vector3, fromDark: boolean, toDark: boolean): number {
  let factor = 1;

  if (fromDark || toDark) factor *= 0.55;

  for (const s of world.smokes) {
    const distSq = distancePointToSegmentSqXZ(s.position, from, to);
    if (distSq > s.radius * s.radius) continue;
    factor *= s.smokeType === 'poison' ? 0.35 : 0.55;
  }

  return Math.max(0, Math.min(1, factor));
}

function distancePointToSegmentSqXZ(point: THREE.Vector3, a: THREE.Vector3, b: THREE.Vector3): number {
  const ax = a.x;
  const az = a.z;
  const bx = b.x;
  const bz = b.z;
  const px = point.x;
  const pz = point.z;

  const abx = bx - ax;
  const abz = bz - az;
  const apx = px - ax;
  const apz = pz - az;

  const denom = abx * abx + abz * abz;
  const t = denom <= 1e-6 ? 0 : Math.max(0, Math.min(1, (apx * abx + apz * abz) / denom));
  const cx = ax + abx * t;
  const cz = az + abz * t;
  const dx = px - cx;
  const dz = pz - cz;
  return dx * dx + dz * dz;
}

function applyAimNoise(
  aimPoint: THREE.Vector3,
  shooterPos: THREE.Vector3,
  visibility: number,
  distance: number,
  aimErrorMultiplier: number
): void {
  const t = Math.max(0, Math.min(1, distance / 30));
  const base = 0.08 + t * 0.45;
  const penalty = 1 - visibility;
  const error = base * (0.35 + penalty * 2.4) * aimErrorMultiplier;

  const nx = (Math.random() - 0.5) * 2 * error;
  const nz = (Math.random() - 0.5) * 2 * error;

  aimPoint.x += nx;
  aimPoint.z += nz;

  void shooterPos;
}
