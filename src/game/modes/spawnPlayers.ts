import * as THREE from 'three';
import type { ModeId } from '../config/ids';
import type { Assets } from '../core/assets';
import type { World } from '../core/world';
import { createNpcEntity } from '../entities/npc';
import { createPlayerEntity } from '../entities/player';
import type { Entity, TeamId } from '../entities/entityBase';

const COLORS: Record<string, number> = {
  p1: 0x45d16e,
  p2: 0xe84c4c,
  p3: 0x79d5ff,
  p4: 0xffc44d,
  red: 0xff6b6b,
  blue: 0x79d5ff
};

export function spawnPlayersForMode(
  scene: THREE.Scene,
  world: World,
  assets: Assets,
  modeId: ModeId,
  options?: { humanId?: string }
): { human: Entity; entities: Entity[] } {
  const humanId = options?.humanId ?? 'p1';
  if (!world.arena) throw new Error('World arena is not loaded');

  for (const entity of world.entities) {
    scene.remove(entity.mesh);
  }
  world.entities.length = 0;

  const entities: Entity[] = [];

  if (modeId === 'duel') {
    entities.push(createHuman(humanId, 'p1', world, assets));
    entities.push(createBot('p2', 'p2', world, assets));
  } else if (modeId === 'ffa') {
    entities.push(createHuman(humanId, 'p1', world, assets));
    entities.push(createBot('p2', 'p2', world, assets));
    entities.push(createBot('p3', 'p3', world, assets));
    entities.push(createBot('p4', 'p4', world, assets));
  } else {
    entities.push(createHuman(humanId, 'red', world, assets));
    entities.push(createBot('p2', 'red', world, assets));
    entities.push(createBot('p3', 'blue', world, assets));
    entities.push(createBot('p4', 'blue', world, assets));
  }

  for (const e of entities) {
    scene.add(e.mesh);
    world.entities.push(e);
  }

  const human = entities.find((e) => e.id === humanId) ?? entities[0];
  return { human, entities };
}

function createHuman(id: string, team: TeamId, world: World, assets: Assets): Entity {
  const startPos = pickSpawn(world, id, team);
  return createPlayerEntity({
    id,
    team,
    color: COLORS[team] ?? COLORS[id] ?? 0xffffff,
    startPos,
    mesh: assets.createPlaceholderMesh({ color: COLORS[team] ?? COLORS[id] ?? 0xffffff })
  });
}

function createBot(id: string, team: TeamId, world: World, assets: Assets): Entity {
  const startPos = pickSpawn(world, id, team);
  return createNpcEntity({
    id,
    team,
    color: COLORS[team] ?? COLORS[id] ?? 0xffffff,
    startPos,
    mesh: assets.createPlaceholderMesh({ color: COLORS[team] ?? COLORS[id] ?? 0xffffff })
  });
}

function pickSpawn(world: World, id: string, team: TeamId): THREE.Vector3 {
  if (!world.arena) return new THREE.Vector3(0, 0.95, 0);

  const arena = world.arena;
  if (team === 'red') {
    const idx = id === 'p2' ? 1 : 0;
    return (arena.redSpawns[idx % arena.redSpawns.length] ?? arena.redSpawns[0]).clone();
  }
  if (team === 'blue') {
    const idx = id === 'p4' ? 1 : 0;
    return (arena.blueSpawns[idx % arena.blueSpawns.length] ?? arena.blueSpawns[0]).clone();
  }

  const idx = parseInt(id.replace('p', ''), 10) - 1;
  return (arena.ffaSpawns[idx % arena.ffaSpawns.length] ?? arena.ffaSpawns[0]).clone();
}

