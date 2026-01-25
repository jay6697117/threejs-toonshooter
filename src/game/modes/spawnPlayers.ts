import * as THREE from 'three';
import type { CharacterId, ModeId } from '../config/ids';
import type { Assets } from '../core/assets';
import type { World } from '../core/world';
import { CHARACTER_CONFIGS } from '../config/characters';
import { createNpcEntity } from '../entities/npc';
import { createPlayerEntity } from '../entities/player';
import type { Entity, TeamId } from '../entities/entityBase';
import { syncVisual } from '../entities/entityBase';

const COLORS: Record<string, number> = {
  p1: 0x45d16e,
  p2: 0xe84c4c,
  p3: 0x79d5ff,
  p4: 0xffc44d,
  red: 0xff6b6b,
  blue: 0x79d5ff
};

const DEFAULT_CHARACTER_BY_ID: Record<string, CharacterId> = {
  p1: 'liuBei',
  p2: 'guanYu',
  p3: 'caoCao',
  p4: 'sunShangxiang'
};

export function spawnPlayersForMode(
  scene: THREE.Scene,
  world: World,
  assets: Assets,
  modeId: ModeId,
  options?: { humanId?: string; humanCharacterId?: CharacterId }
): { human: Entity; entities: Entity[] } {
  const humanId = options?.humanId ?? 'p1';
  const humanCharacterId = options?.humanCharacterId;
  if (!world.arena) throw new Error('World arena is not loaded');

  for (const entity of world.entities) {
    scene.remove(entity.mesh);
  }
  world.entities.length = 0;

  const entities: Entity[] = [];

  if (modeId === 'duel') {
    entities.push(createHuman(humanId, 'p1', world, assets, humanCharacterId));
    entities.push(createBot('p2', 'p2', world, assets));
  } else if (modeId === 'ffa') {
    entities.push(createHuman(humanId, 'p1', world, assets, humanCharacterId));
    entities.push(createBot('p2', 'p2', world, assets));
    entities.push(createBot('p3', 'p3', world, assets));
    entities.push(createBot('p4', 'p4', world, assets));
  } else {
    entities.push(createHuman(humanId, 'red', world, assets, humanCharacterId));
    entities.push(createBot('p2', 'red', world, assets));
    entities.push(createBot('p3', 'blue', world, assets));
    entities.push(createBot('p4', 'blue', world, assets));
  }

  for (const e of entities) {
    scene.add(e.mesh);
    world.entities.push(e);
  }

  const human = entities.find((e) => e.id === humanId) ?? entities[0];
  for (const e of entities) {
    const desiredCharacterId = resolveCharacterIdForEntity(e.id, humanId, humanCharacterId);
    void applyCharacterMesh(e, assets, desiredCharacterId);
  }
  return { human, entities };
}

function createHuman(id: string, team: TeamId, world: World, assets: Assets, characterId?: CharacterId): Entity {
  const startPos = pickSpawn(world, id, team);
  const charColor = characterId ? CHARACTER_CONFIGS[characterId].primaryColor : undefined;
  return createPlayerEntity({
    id,
    team,
    color: charColor ?? COLORS[team] ?? COLORS[id] ?? 0xffffff,
    startPos,
    mesh: assets.createPlaceholderMesh({ color: charColor ?? COLORS[team] ?? COLORS[id] ?? 0xffffff })
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

function resolveCharacterIdForEntity(entityId: string, humanId: string, humanCharacterId?: CharacterId): CharacterId {
  if (entityId === humanId && humanCharacterId) return humanCharacterId;
  return DEFAULT_CHARACTER_BY_ID[entityId] ?? 'liuBei';
}

async function applyCharacterMesh(entity: Entity, assets: Assets, characterId: CharacterId): Promise<void> {
  try {
    await assets.loadManifest();
  } catch {
    return;
  }

  const path = assets.getManifestPath('sanguoShooter', 'characters', characterId);
  if (!path) return;

  const placeholder = entity.mesh;
  const parent = placeholder.parent;
  if (!parent) return;

  try {
    const gltf = await assets.cloneGltf(path);
    const root = gltf.root;
    const tintColor = CHARACTER_CONFIGS[characterId].primaryColor;
    (root.userData as { animationClips?: THREE.AnimationClip[] }).animationClips = gltf.animations;

    root.traverse((obj) => {
      const mesh = obj as THREE.Mesh;
      if (!mesh.isMesh) return;
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mesh.material = cloneAndTintMaterial(mesh.material, tintColor);
    });

    const box = new THREE.Box3().setFromObject(root);
    const size = new THREE.Vector3();
    box.getSize(size);
    const height = size.y;
    if (height > 1e-3) {
      const targetHeight = 1.35;
      root.scale.setScalar(targetHeight / height);
    }

    if (entity.mesh !== placeholder) return;
    if (!placeholder.parent) return;

    parent.add(root);
    entity.mesh = root;
    syncVisual(entity);

    parent.remove(placeholder);
  } catch {
    // ignored
  }
}

function cloneAndTintMaterial(material: THREE.Material | THREE.Material[], colorHex: number): THREE.Material | THREE.Material[] {
  if (Array.isArray(material)) {
    return material.map((m) => cloneAndTintMaterial(m, colorHex) as THREE.Material);
  }

  const asStandard = material as THREE.MeshStandardMaterial;
  if (asStandard.isMeshStandardMaterial) {
    const cloned = asStandard.clone();
    cloned.color.setHex(colorHex);
    cloned.emissive.setHex(colorHex);
    cloned.emissiveIntensity = Math.max(cloned.emissiveIntensity, 0.15);
    return cloned;
  }

  return material;
}
