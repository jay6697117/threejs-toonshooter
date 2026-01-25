import * as THREE from 'three';
import type { World } from '../core/world';
import { WEAPON_CONFIGS } from '../config/weapons';
import type { DifficultyConfig } from '../config/difficulty';
import type { Entity } from './entityBase';
import type { WeaponFrameInput } from '../weapons/weaponManager';
import type { MatchRuntime } from '../modes/modeManager';
import type { NavGrid } from '../arena/navGraph';
import { findPath } from '../arena/navGraph';
import { pickNearestEnemy } from '../ai/behaviors/targeting';
import { pickHealthPickupGoal } from '../ai/behaviors/pickups';
import { decideThrowableUse } from '../ai/behaviors/throwables';
import { pickSiegeGoal } from '../ai/modeObjectives/siege';
import { pickCtfGoal } from '../ai/modeObjectives/ctf';
import type { Rng } from '../core/rng';

export type AiControllerState = {
  nextDecisionTime: number;
  targetId: string | null;
  strafeSign: 1 | -1;
  fireDown: boolean;
  nextPathRecalcTime: number;
  path: THREE.Vector3[];
  pathIndex: number;
  throwableCooldown: number;
  cachedFrame: AiFrame | null;
  nextThinkStep: number;
};

export type AiFrame = {
  moveDir: THREE.Vector3;
  dashRequested: boolean;
  aimPoint: THREE.Vector3 | null;
  weaponInput: WeaponFrameInput;
  throwRequested: boolean;
  throwAimPoint: THREE.Vector3 | null;
};

export function ensureAiControllerState(map: Map<string, AiControllerState>, entityId: string, rng: Rng): AiControllerState {
  const existing = map.get(entityId);
  if (existing) return existing;
  const created: AiControllerState = {
    nextDecisionTime: 0,
    targetId: null,
    strafeSign: rng.nextSign(),
    fireDown: false,
    nextPathRecalcTime: 0,
    path: [],
    pathIndex: 0,
    throwableCooldown: 0,
    cachedFrame: null,
    nextThinkStep: 0
  };
  map.set(entityId, created);
  return created;
}

export function computeAiFrameThrottled(
  entity: Entity,
  ai: AiControllerState,
  world: World,
  match: MatchRuntime,
  difficulty: DifficultyConfig,
  dt: number,
  nav: NavGrid | null,
  rng: Rng,
  options: { stepIndex: number; thinkIntervalSteps: number }
): AiFrame {
  const thinkIntervalSteps = Math.max(1, Math.floor(options.thinkIntervalSteps));

  if (!ai.cachedFrame || thinkIntervalSteps <= 1 || options.stepIndex >= ai.nextThinkStep) {
    const frame = computeAiFrame(entity, ai, world, match, difficulty, dt, nav, rng);
    ai.cachedFrame = {
      moveDir: frame.moveDir.clone(),
      dashRequested: frame.dashRequested,
      aimPoint: frame.aimPoint ? frame.aimPoint.clone() : null,
      weaponInput: frame.weaponInput,
      throwRequested: frame.throwRequested,
      throwAimPoint: frame.throwAimPoint ? frame.throwAimPoint.clone() : null
    };
    ai.nextThinkStep = options.stepIndex + thinkIntervalSteps;
    return frame;
  }

  ai.throwableCooldown = Math.max(0, ai.throwableCooldown - dt);
  ai.nextPathRecalcTime = Math.max(0, ai.nextPathRecalcTime - dt);

  const cached = ai.cachedFrame;
  return {
    moveDir: cached.moveDir.clone(),
    dashRequested: cached.dashRequested,
    aimPoint: cached.aimPoint ? cached.aimPoint.clone() : null,
    weaponInput: cached.weaponInput,
    throwRequested: cached.throwRequested && ai.throwableCooldown <= 0,
    throwAimPoint: cached.throwAimPoint ? cached.throwAimPoint.clone() : null
  };
}

export function computeAiFrame(
  entity: Entity,
  ai: AiControllerState,
  world: World,
  match: MatchRuntime,
  difficulty: DifficultyConfig,
  dt: number,
  nav: NavGrid | null,
  rng: Rng
): AiFrame {
  const aimTarget = pickAimTarget(entity, ai, world);
  const goal = pickGoal(entity, world, match, aimTarget);

  ai.throwableCooldown = Math.max(0, ai.throwableCooldown - dt);
  ai.nextPathRecalcTime = Math.max(0, ai.nextPathRecalcTime - dt);

  const moveDir = new THREE.Vector3();
  let dashRequested = false;

  const moveGoal = resolveMoveGoal(entity, ai, nav, goal);

  if (moveGoal) {
    const dx = moveGoal.x - entity.position.x;
    const dz = moveGoal.z - entity.position.z;
    const distSq = dx * dx + dz * dz;
    if (distSq > 1.8 * 1.8) {
      moveDir.set(dx, 0, dz).normalize();
      if (entity.dashCooldown <= 0 && entity.dashTimer <= 0 && distSq > 6.5 * 6.5) {
        dashRequested = rng.nextFloat() < 0.02;
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

  const aimPoint = aimTarget ? new THREE.Vector3(aimTarget.position.x, entity.position.y, aimTarget.position.z) : moveGoal;
  if (aimPoint && aimTarget) {
    const visibility = computeVisibilityFactor(world, entity.position, aimTarget.position, entity.isInDark, aimTarget.isInDark);
    applyAimNoise(aimPoint, entity.position, visibility, aimTarget.position.distanceTo(entity.position), difficulty.aiAimErrorMultiplier, rng);
  }

  const weaponInput = computeWeaponInput(entity, ai, aimTarget, match, world, difficulty, dt, rng);

  const throwDecision = decideThrowableUse({ self: entity, world, match, target: aimTarget, goal, rng });
  const throwRequested = throwDecision.throwRequested && ai.throwableCooldown <= 0;
  const throwAimPoint = throwRequested ? throwDecision.aimPoint : null;
  if (throwRequested) ai.throwableCooldown = 6;

  return { moveDir, dashRequested, aimPoint, weaponInput, throwRequested, throwAimPoint };
}

function pickGoal(entity: Entity, world: World, match: MatchRuntime, aimTarget: Entity | null): THREE.Vector3 | null {
  const pickupGoal = pickHealthPickupGoal(entity, world);
  if (pickupGoal) return pickupGoal;

  if (match.state.modeId === 'siege') return pickSiegeGoal(entity, world);
  if (match.state.modeId === 'ctf') return pickCtfGoal(entity, world, match, aimTarget);
  return aimTarget ? aimTarget.position : null;
}

function pickAimTarget(entity: Entity, ai: AiControllerState, world: World): Entity | null {
  ai.nextDecisionTime = Math.max(0, ai.nextDecisionTime - 1);
  if (ai.nextDecisionTime <= 0) {
    ai.nextDecisionTime = 30;
    ai.strafeSign = ai.strafeSign === 1 ? -1 : 1;
  }

  const best = pickNearestEnemy(entity, world.entities);
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
  dt: number,
  rng: Rng
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
  const shouldFire = target ? rng.nextFloat() < confidence : false;

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
  aimErrorMultiplier: number,
  rng: Rng
): void {
  const t = Math.max(0, Math.min(1, distance / 30));
  const base = 0.08 + t * 0.45;
  const penalty = 1 - visibility;
  const error = base * (0.35 + penalty * 2.4) * aimErrorMultiplier;

  const nx = (rng.nextFloat() - 0.5) * 2 * error;
  const nz = (rng.nextFloat() - 0.5) * 2 * error;

  aimPoint.x += nx;
  aimPoint.z += nz;

  void shooterPos;
}

function resolveMoveGoal(entity: Entity, ai: AiControllerState, nav: NavGrid | null, goal: THREE.Vector3 | null): THREE.Vector3 | null {
  if (!goal) {
    ai.path = [];
    ai.pathIndex = 0;
    return null;
  }
  if (!nav) return goal;

  if (ai.nextPathRecalcTime <= 0 || ai.path.length === 0) {
    ai.path = findPath(nav, entity.position, goal);
    ai.pathIndex = 0;
    ai.nextPathRecalcTime = 0.65;
  }

  while (ai.pathIndex < ai.path.length - 1) {
    const p = ai.path[ai.pathIndex];
    const dx = p.x - entity.position.x;
    const dz = p.z - entity.position.z;
    if (dx * dx + dz * dz > 0.9 * 0.9) break;
    ai.pathIndex += 1;
  }

  return ai.path[Math.min(ai.pathIndex, ai.path.length - 1)] ?? goal;
}
