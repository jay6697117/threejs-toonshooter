import * as THREE from 'three';
import { MODE_CONFIGS } from '../config/modes';
import type { ModeId } from '../config/ids';
import type { World } from '../core/world';
import type { Entity, TeamId } from '../entities/entityBase';

const DEFAULT_RESPAWN_SECONDS = 2.5;

export type MatchPhase = 'playing' | 'ended';

export type DuelMatchState = {
  modeId: 'duel';
  phase: MatchPhase;
  roundIndex: number;
  wins: Record<string, number>;
  roundTimeLeft: number;
  intermissionLeft: number;
  winnerId: string | null;
};

export type FfaMatchState = {
  modeId: 'ffa';
  phase: MatchPhase;
  timeLeft: number;
  winnerId: string | null;
};

export type SiegeMatchState = {
  modeId: 'siege';
  phase: MatchPhase;
  timeLeft: number;
  captureProgress: number;
  defenderRespawnsLeft: number;
  winnerTeam: TeamId | null;
};

export type FlagState = {
  team: 'red' | 'blue';
  basePos: THREE.Vector3;
  pos: THREE.Vector3;
  carrierId: string | null;
  atBase: boolean;
  returnTimer: number;
};

export type CtfMatchState = {
  modeId: 'ctf';
  phase: MatchPhase;
  timeLeft: number;
  score: { red: number; blue: number };
  flags: { red: FlagState; blue: FlagState };
  winnerTeam: TeamId | null;
};

export type MatchState = DuelMatchState | FfaMatchState | SiegeMatchState | CtfMatchState;

export type MatchRuntime = {
  modeId: ModeId;
  humanId: string;
  state: MatchState;
};

export function createMatchRuntime(modeId: ModeId, humanId = 'p1'): MatchRuntime {
  if (modeId === 'duel') {
    return {
      modeId,
      humanId,
      state: {
        modeId: 'duel',
        phase: 'playing',
        roundIndex: 1,
        wins: {},
        roundTimeLeft: MODE_CONFIGS.duel.roundTimeSeconds,
        intermissionLeft: 0,
        winnerId: null
      }
    };
  }
  if (modeId === 'ffa') {
    return {
      modeId,
      humanId,
      state: { modeId: 'ffa', phase: 'playing', timeLeft: MODE_CONFIGS.ffa.matchTimeSeconds, winnerId: null }
    };
  }
  if (modeId === 'siege') {
    return {
      modeId,
      humanId,
      state: {
        modeId: 'siege',
        phase: 'playing',
        timeLeft: MODE_CONFIGS.siege.attackTimeSeconds,
        captureProgress: 0,
        defenderRespawnsLeft: MODE_CONFIGS.siege.defenderRespawns,
        winnerTeam: null
      }
    };
  }

  return {
    modeId,
    humanId,
    state: {
      modeId: 'ctf',
      phase: 'playing',
      timeLeft: MODE_CONFIGS.ctf.matchTimeSeconds,
      score: { red: 0, blue: 0 },
      flags: {
        red: { team: 'red', basePos: new THREE.Vector3(), pos: new THREE.Vector3(), carrierId: null, atBase: true, returnTimer: 0 },
        blue: { team: 'blue', basePos: new THREE.Vector3(), pos: new THREE.Vector3(), carrierId: null, atBase: true, returnTimer: 0 }
      },
      winnerTeam: null
    }
  };
}

export function initializeMatchPlayers(world: World, runtime: MatchRuntime): void {
  if (!world.arena) throw new Error('World arena is not loaded');

  for (const entity of world.entities) {
    entity.eliminated = false;
    entity.deathProcessed = false;
    entity.livesLeft = 0;
    entity.respawnTimer = 0;
    entity.kills = 0;
    entity.deaths = 0;
    entity.score = 0;
    entity.carryingFlag = null;
    entity.lastAttackerId = null;
    entity.lastAttackerTeam = null;
    entity.lastWeaponId = null;
    entity.hp = entity.maxHp;
    entity.statuses.clear();
  }

  if (runtime.modeId === 'ffa') {
    for (const entity of world.entities) entity.livesLeft = MODE_CONFIGS.ffa.livesPerPlayer;
  } else if (runtime.modeId === 'duel') {
    for (const entity of world.entities) entity.livesLeft = 1;
  } else {
    for (const entity of world.entities) entity.livesLeft = 9999;
  }
}

export function processDeaths(world: World, runtime: MatchRuntime): void {
  if (!world.arena) return;

  for (const entity of world.entities) {
    if (!entity.eliminated) continue;
    if (entity.deathProcessed) continue;

    entity.deathProcessed = true;
    entity.deaths += 1;

    const attacker = entity.lastAttackerId ? world.entities.find((e) => e.id === entity.lastAttackerId) : undefined;
    if (attacker && attacker.id !== entity.id) {
      attacker.kills += 1;
      attacker.score += 1;
    }

    if (runtime.state.modeId === 'duel') {
      entity.respawnTimer = 0;
      continue;
    }

    if (runtime.state.modeId === 'ffa') {
      entity.livesLeft = Math.max(0, entity.livesLeft - 1);
      entity.respawnTimer = entity.livesLeft > 0 ? DEFAULT_RESPAWN_SECONDS : 0;
      continue;
    }

    if (runtime.state.modeId === 'siege') {
      if (entity.team === 'blue') {
        if (runtime.state.defenderRespawnsLeft > 0) {
          runtime.state.defenderRespawnsLeft = Math.max(0, runtime.state.defenderRespawnsLeft - 1);
          entity.respawnTimer = DEFAULT_RESPAWN_SECONDS;
        } else {
          entity.respawnTimer = 0;
        }
      } else {
        entity.respawnTimer = DEFAULT_RESPAWN_SECONDS;
      }
      continue;
    }

    entity.respawnTimer = DEFAULT_RESPAWN_SECONDS;
  }
}

export function updateMatch(world: World, runtime: MatchRuntime, dt: number): void {
  if (!world.arena) return;
  if (runtime.state.phase !== 'playing') return;

  if (runtime.state.modeId === 'duel') {
    updateDuel(world, runtime.state, dt);
  } else if (runtime.state.modeId === 'ffa') {
    updateFfa(world, runtime.state, dt);
  } else if (runtime.state.modeId === 'siege') {
    updateSiege(world, runtime.state, dt);
  } else {
    updateCtf(world, runtime.state, dt);
  }
}

export function applyRespawns(world: World, runtime: MatchRuntime, dt: number): void {
  if (!world.arena) return;

  for (const entity of world.entities) {
    if (!entity.eliminated) continue;
    if (entity.respawnTimer <= 0) continue;

    entity.respawnTimer = Math.max(0, entity.respawnTimer - dt);
    if (entity.respawnTimer > 0) continue;

    if (entity.livesLeft <= 0) continue;
    respawnEntity(world, runtime, entity);
  }
}

export function respawnEntity(world: World, runtime: MatchRuntime, entity: Entity): void {
  if (!world.arena) return;

  entity.eliminated = false;
  entity.deathProcessed = false;
  entity.hp = entity.maxHp;
  entity.statuses.clear();
  entity.velocity.set(0, 0, 0);
  entity.dashTimer = 0;
  entity.dashCooldown = 0;
  entity.carryingFlag = null;
  entity.respawnTimer = 0;
  entity.lastAttackerId = null;
  entity.lastAttackerTeam = null;
  entity.lastWeaponId = null;

  const spawn = pickSpawn(world, runtime.modeId, entity);
  entity.position.copy(spawn);
  entity.mesh.position.copy(spawn);
}

function updateDuel(world: World, state: DuelMatchState, dt: number): void {
  const cfg = MODE_CONFIGS.duel;

  if (state.intermissionLeft > 0) {
    state.intermissionLeft = Math.max(0, state.intermissionLeft - dt);
    if (state.intermissionLeft === 0) {
      state.roundTimeLeft = cfg.roundTimeSeconds;
      state.winnerId = null;
      for (const e of world.entities) {
        if (e.livesLeft > 0) respawnEntity(world, { modeId: 'duel', humanId: 'p1', state }, e);
      }
    }
    return;
  }

  const alive = world.entities.filter((e) => !e.eliminated);
  if (alive.length <= 1) {
    const winner = alive[0];
    if (winner) {
      state.wins[winner.id] = (state.wins[winner.id] ?? 0) + 1;
      state.winnerId = winner.id;

      if (state.wins[winner.id] >= cfg.winsToWin) {
        state.phase = 'ended';
        return;
      }
    }

    state.roundIndex += 1;
    state.intermissionLeft = 2.5;
    return;
  }

  state.roundTimeLeft = Math.max(0, state.roundTimeLeft - dt);
  if (state.roundTimeLeft > 0) return;

  if (!cfg.suddenDeath) {
    const ranked = alive
      .slice()
      .sort((a, b) => b.hp - a.hp);
    state.winnerId = ranked[0]?.id ?? null;
    state.phase = 'ended';
    return;
  }

  state.roundTimeLeft = 0;
}

function updateFfa(world: World, state: FfaMatchState, dt: number): void {
  state.timeLeft = Math.max(0, state.timeLeft - dt);

  const inMatch = world.entities.filter((e) => e.livesLeft > 0);
  if (inMatch.length === 1) {
    state.winnerId = inMatch[0].id;
    state.phase = 'ended';
    return;
  }

  if (state.timeLeft > 0) return;

  const ranked = inMatch
    .slice()
    .sort((a, b) => b.score * 1000 + b.hp - (a.score * 1000 + a.hp));
  state.winnerId = ranked[0]?.id ?? null;
  state.phase = 'ended';
}

function updateSiege(world: World, state: SiegeMatchState, dt: number): void {
  const cfg = MODE_CONFIGS.siege;
  const capture = world.arena?.objectives?.siege;
  if (!capture) {
    state.phase = 'ended';
    state.winnerTeam = 'blue';
    return;
  }

  state.timeLeft = Math.max(0, state.timeLeft - dt);

  const attackers = world.entities.filter((e) => !e.eliminated && e.team === 'red');
  const defenders = world.entities.filter((e) => !e.eliminated && e.team === 'blue');

  const attackersIn = attackers.filter((e) => isInsideCircleXZ(e.position, capture.capturePoint, capture.captureRadius)).length;
  const defendersIn = defenders.filter((e) => isInsideCircleXZ(e.position, capture.capturePoint, capture.captureRadius)).length;

  const delta = attackersIn - defendersIn;
  if (delta > 0) state.captureProgress = Math.min(1, state.captureProgress + delta * 0.08 * dt);
  if (delta < 0) state.captureProgress = Math.max(0, state.captureProgress + delta * 0.1 * dt);

  if (state.captureProgress >= 1) {
    state.phase = 'ended';
    state.winnerTeam = 'red';
    return;
  }

  if (state.timeLeft <= 0) {
    state.phase = 'ended';
    state.winnerTeam = 'blue';
    return;
  }

  if (state.defenderRespawnsLeft <= 0 && defenders.length === 0) {
    state.phase = 'ended';
    state.winnerTeam = 'red';
  }
}

function updateCtf(world: World, state: CtfMatchState, dt: number): void {
  const cfg = MODE_CONFIGS.ctf;
  const obj = world.arena?.objectives?.ctf;
  if (!obj) {
    state.phase = 'ended';
    state.winnerTeam = 'red';
    return;
  }

  state.timeLeft = Math.max(0, state.timeLeft - dt);

  if (state.flags.red.basePos.lengthSq() === 0 && state.flags.blue.basePos.lengthSq() === 0) {
    state.flags.red.basePos.copy(obj.redFlagBase);
    state.flags.red.pos.copy(obj.redFlagBase);
    state.flags.blue.basePos.copy(obj.blueFlagBase);
    state.flags.blue.pos.copy(obj.blueFlagBase);
  }

  updateFlag(world, state.flags.red, dt);
  updateFlag(world, state.flags.blue, dt);

  for (const entity of world.entities) {
    if (entity.eliminated) continue;
    if (entity.team !== 'red' && entity.team !== 'blue') continue;

    const enemyTeam = entity.team === 'red' ? 'blue' : 'red';
    const enemyFlag = enemyTeam === 'red' ? state.flags.red : state.flags.blue;

    if (entity.carryingFlag === null && !enemyFlag.carrierId && isInsideCircleXZ(entity.position, enemyFlag.pos, 1.1)) {
      enemyFlag.carrierId = entity.id;
      enemyFlag.atBase = false;
      entity.carryingFlag = enemyFlag.team;
    }

    if (entity.carryingFlag !== null) {
      const ownBase = entity.team === 'red' ? obj.redBase : obj.blueBase;
      const ownFlag = entity.team === 'red' ? state.flags.red : state.flags.blue;
      if (ownFlag.atBase && isInsideCircleXZ(entity.position, ownBase, 1.2)) {
        if (entity.team === 'red') state.score.red += 1;
        else state.score.blue += 1;

        const carriedFlag = entity.carryingFlag === 'red' ? state.flags.red : state.flags.blue;
        carriedFlag.carrierId = null;
        carriedFlag.atBase = true;
        carriedFlag.pos.copy(carriedFlag.basePos);
        carriedFlag.returnTimer = 0;
        entity.carryingFlag = null;
      }
    }
  }

  if (state.score.red >= cfg.scoreToWin) {
    state.phase = 'ended';
    state.winnerTeam = 'red';
    return;
  }
  if (state.score.blue >= cfg.scoreToWin) {
    state.phase = 'ended';
    state.winnerTeam = 'blue';
    return;
  }

  if (state.timeLeft > 0) return;

  if (state.score.red > state.score.blue) state.winnerTeam = 'red';
  else if (state.score.blue > state.score.red) state.winnerTeam = 'blue';
  else state.winnerTeam = null;
  state.phase = 'ended';
}

function updateFlag(world: World, flag: FlagState, dt: number): void {
  if (flag.carrierId) {
    const carrier = world.entities.find((e) => e.id === flag.carrierId);
    if (!carrier || carrier.eliminated) {
      flag.carrierId = null;
      flag.atBase = false;
      flag.returnTimer = 18;
    } else {
      flag.pos.copy(carrier.position);
      flag.pos.y = 0;
      flag.atBase = false;
    }
  }

  if (!flag.carrierId && !flag.atBase && flag.returnTimer > 0) {
    flag.returnTimer = Math.max(0, flag.returnTimer - dt);
    if (flag.returnTimer === 0) {
      flag.atBase = true;
      flag.pos.copy(flag.basePos);
    }
  }

  if (!flag.carrierId && !flag.atBase) {
    for (const e of world.entities) {
      if (e.eliminated) continue;
      if (e.team !== flag.team) continue;
      if (isInsideCircleXZ(e.position, flag.pos, 1.1)) {
        flag.atBase = true;
        flag.pos.copy(flag.basePos);
        flag.returnTimer = 0;
        break;
      }
    }
  }
}

function pickSpawn(world: World, modeId: ModeId, entity: Entity): THREE.Vector3 {
  if (!world.arena) return new THREE.Vector3(0, 0.95, 0);
  const arena = world.arena;

  if (modeId === 'ffa') {
    const idx = parseInt(entity.id.replace('p', ''), 10) - 1;
    const sp = arena.ffaSpawns[idx % arena.ffaSpawns.length] ?? arena.ffaSpawns[0];
    return sp.clone();
  }

  if (modeId === 'duel') {
    return (entity.id === 'p1' ? arena.ffaSpawns[0] : arena.ffaSpawns[1] ?? arena.ffaSpawns[0]).clone();
  }

  if (entity.team === 'red') {
    const idx = entity.id === 'p1' ? 0 : 1;
    return (arena.redSpawns[idx % arena.redSpawns.length] ?? arena.redSpawns[0]).clone();
  }

  const idx = entity.id === 'p3' ? 0 : 1;
  return (arena.blueSpawns[idx % arena.blueSpawns.length] ?? arena.blueSpawns[0]).clone();
}

function isInsideCircleXZ(pos: THREE.Vector3, center: THREE.Vector3, radius: number): boolean {
  const dx = pos.x - center.x;
  const dz = pos.z - center.z;
  return dx * dx + dz * dz <= radius * radius;
}
