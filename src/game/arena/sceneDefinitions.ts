import * as THREE from 'three';
import type { ModeId, SceneId, ThrowableId, WeaponId } from '../config/ids';

export type ArenaBounds = { minX: number; maxX: number; minZ: number; maxZ: number };

export type ArenaZone =
  | { kind: 'rect'; id: string; minX: number; maxX: number; minZ: number; maxZ: number; effect: 'waterSlow' | 'dark' }
  | { kind: 'circle'; id: string; x: number; z: number; radius: number; effect: 'centerDamageBuff' };

export type ArenaCoverDef = {
  id: string;
  size: THREE.Vector3;
  pos: THREE.Vector3;
  color?: number;
  hp?: number;
  pushable?: boolean;
  toggleable?: boolean;
  blocksProjectiles?: boolean;
  burnable?: boolean;
  burnSeconds?: number;
  burnRadiusMeters?: number;
  burnDamagePerSecond?: number;
  onDestroyedExplosion?: {
    radiusMeters: number;
    damage: number;
    statusEffects?: Array<{ id: 'slow' | 'burn' | 'blind'; durationSeconds?: number }>;
    knockbackDistance?: number;
  };
  onDestroyedSpawnCover?: {
    size: THREE.Vector3;
    hp: number;
    color?: number;
    timeLeftSeconds?: number;
  };
};

export type ArenaPickupDef =
  | { kind: 'weapon'; id: string; weaponId: WeaponId; pos: THREE.Vector3 }
  | { kind: 'throwable'; id: string; throwableId: ThrowableId; pos: THREE.Vector3; count?: number }
  | { kind: 'health'; id: string; amount: number; pos: THREE.Vector3 };

export type ArenaObjectiveDef = {
  siege?: { capturePoint: THREE.Vector3; captureRadius: number };
  ctf?: { redFlagBase: THREE.Vector3; blueFlagBase: THREE.Vector3; redBase: THREE.Vector3; blueBase: THREE.Vector3 };
};

export type ArenaSceneDef = {
  id: SceneId;
  name: string;
  supportedModes: ModeId[];
  bounds: ArenaBounds;
  groundColor: number;
  ffaSpawns: THREE.Vector3[];
  redSpawns: THREE.Vector3[];
  blueSpawns: THREE.Vector3[];
  covers: ArenaCoverDef[];
  pickups: ArenaPickupDef[];
  zones?: ArenaZone[];
  objectives?: ArenaObjectiveDef;
};

const BASE_BOUNDS: ArenaBounds = { minX: -13, maxX: 13, minZ: -9, maxZ: 9 };

function v(x: number, y: number, z: number): THREE.Vector3 {
  return new THREE.Vector3(x, y, z);
}

function spawnRing(bounds: ArenaBounds, y: number): THREE.Vector3[] {
  const insetX = (bounds.maxX - bounds.minX) * 0.35;
  const insetZ = (bounds.maxZ - bounds.minZ) * 0.35;
  return [
    v(bounds.minX + insetX, y, bounds.minZ + insetZ),
    v(bounds.maxX - insetX, y, bounds.minZ + insetZ),
    v(bounds.minX + insetX, y, bounds.maxZ - insetZ),
    v(bounds.maxX - insetX, y, bounds.maxZ - insetZ),
    v(bounds.minX + insetX, y, 0),
    v(bounds.maxX - insetX, y, 0)
  ];
}

export const ARENA_SCENES: Record<SceneId, ArenaSceneDef> = {
  trainingGround: {
    id: 'trainingGround',
    name: 'Training Ground',
    supportedModes: ['duel', 'ffa', 'siege', 'ctf'],
    bounds: BASE_BOUNDS,
    groundColor: 0x263143,
    ffaSpawns: spawnRing(BASE_BOUNDS, 0.95),
    redSpawns: [v(-10, 0.95, -4), v(-10, 0.95, 4), v(-8, 0.95, 0)],
    blueSpawns: [v(10, 0.95, -4), v(10, 0.95, 4), v(8, 0.95, 0)],
    covers: [
      { id: 'tg_stage', size: new THREE.Vector3(3.2, 1.0, 2.0), pos: v(0, 0.5, 0), color: 0x6f7a86, hp: 9999 },
      { id: 'tg_tent_a', size: new THREE.Vector3(2.2, 1.2, 1.4), pos: v(-5.5, 0.6, -3.2), color: 0x4b5563, hp: 9999 },
      { id: 'tg_tent_b', size: new THREE.Vector3(2.0, 1.2, 1.2), pos: v(5.5, 0.6, 3.2), color: 0x4b5563, hp: 9999 },
      {
        id: 'tg_hay_a',
        size: new THREE.Vector3(1.4, 0.9, 1.0),
        pos: v(-2.2, 0.45, 4.6),
        color: 0xd9b66f,
        hp: 30,
        burnable: true,
        burnSeconds: 6,
        burnRadiusMeters: 3,
        burnDamagePerSecond: 8
      }
    ],
    pickups: [
      { kind: 'weapon', id: 'tg_weapon', weaponId: 'boomerangBlade', pos: v(-7, 0.2, 6) },
      { kind: 'throwable', id: 'tg_throw', throwableId: 'smokeBomb', pos: v(7, 0.2, -6) },
      { kind: 'health', id: 'tg_hp', amount: 35, pos: v(0, 0.2, -6) }
    ],
    objectives: {
      siege: { capturePoint: v(0, 0, 0), captureRadius: 3.2 },
      ctf: { redFlagBase: v(-11, 0, 0), blueFlagBase: v(11, 0, 0), redBase: v(-11, 0, 0), blueBase: v(11, 0, 0) }
    }
  },
  changbanRoad: {
    id: 'changbanRoad',
    name: 'Changban Road',
    supportedModes: ['duel', 'ffa', 'siege', 'ctf'],
    bounds: BASE_BOUNDS,
    groundColor: 0x2b2a2c,
    ffaSpawns: spawnRing(BASE_BOUNDS, 0.95),
    redSpawns: [v(-11, 0.95, -3), v(-11, 0.95, 3), v(-9, 0.95, 0)],
    blueSpawns: [v(11, 0.95, -3), v(11, 0.95, 3), v(9, 0.95, 0)],
    covers: [
      { id: 'cb_rock_a', size: new THREE.Vector3(2.8, 1.4, 2.0), pos: v(-4.6, 0.7, 0), color: 0x6b7280, hp: 9999 },
      { id: 'cb_rock_b', size: new THREE.Vector3(2.6, 1.3, 2.2), pos: v(4.6, 0.65, 0), color: 0x6b7280, hp: 9999 },
      {
        id: 'cb_bridge',
        size: new THREE.Vector3(1.6, 0.9, 4.0),
        pos: v(0, 0.45, 0),
        color: 0x8b5a2b,
        hp: 50,
        onDestroyedSpawnCover: { size: new THREE.Vector3(2.4, 1.1, 4.6), hp: 9999, color: 0x6b7280 }
      },
      {
        id: 'cb_tree',
        size: new THREE.Vector3(0.9, 1.4, 0.9),
        pos: v(0, 0.7, 6.2),
        color: 0x2f4f2f,
        hp: 20,
        onDestroyedSpawnCover: { size: new THREE.Vector3(4.2, 0.7, 0.9), hp: 9999, color: 0x8b5a2b, timeLeftSeconds: 7 }
      }
    ],
    pickups: [
      { kind: 'weapon', id: 'cb_weapon', weaponId: 'heavyCrossbow', pos: v(0, 0.2, -6) },
      { kind: 'throwable', id: 'cb_throw', throwableId: 'tripWire', pos: v(0, 0.2, 6) }
    ],
    objectives: {
      siege: { capturePoint: v(0, 0, 0), captureRadius: 3.0 },
      ctf: { redFlagBase: v(-11, 0, 0), blueFlagBase: v(11, 0, 0), redBase: v(-11, 0, 0), blueBase: v(11, 0, 0) }
    }
  },
  luoyangStreets: {
    id: 'luoyangStreets',
    name: 'Luoyang Streets',
    supportedModes: ['duel', 'ffa', 'siege', 'ctf'],
    bounds: BASE_BOUNDS,
    groundColor: 0x111827,
    ffaSpawns: spawnRing(BASE_BOUNDS, 0.95),
    redSpawns: [v(-11, 0.95, -4), v(-11, 0.95, 4), v(-9, 0.95, 0)],
    blueSpawns: [v(11, 0.95, -4), v(11, 0.95, 4), v(9, 0.95, 0)],
    covers: [
      { id: 'ly_wall_a', size: new THREE.Vector3(5.0, 1.2, 0.7), pos: v(0, 0.6, -2.8), color: 0x374151, hp: 9999 },
      { id: 'ly_wall_b', size: new THREE.Vector3(5.0, 1.2, 0.7), pos: v(0, 0.6, 2.8), color: 0x374151, hp: 9999 },
      {
        id: 'ly_jar_a',
        size: new THREE.Vector3(1.0, 0.9, 1.0),
        pos: v(-4.8, 0.45, 0),
        color: 0x9ca3af,
        hp: 25,
        onDestroyedExplosion: { radiusMeters: 3.2, damage: 10, statusEffects: [{ id: 'slow', durationSeconds: 2.0 }] }
      },
      { id: 'ly_cart', size: new THREE.Vector3(2.2, 1.0, 1.2), pos: v(4.8, 0.5, 0), color: 0x8b5a2b, hp: 60, pushable: true }
    ],
    pickups: [
      { kind: 'weapon', id: 'ly_weapon', weaponId: 'repeatingCrossbow', pos: v(0, 0.2, 0) },
      { kind: 'throwable', id: 'ly_throw', throwableId: 'gunpowderPack', pos: v(8, 0.2, 0) }
    ],
    objectives: {
      siege: { capturePoint: v(0, 0, 0), captureRadius: 3.0 },
      ctf: { redFlagBase: v(-11, 0, 0), blueFlagBase: v(11, 0, 0), redBase: v(-11, 0, 0), blueBase: v(11, 0, 0) }
    }
  },
  chibiShips: {
    id: 'chibiShips',
    name: 'Chibi Ships',
    supportedModes: ['duel', 'ffa', 'siege', 'ctf'],
    bounds: BASE_BOUNDS,
    groundColor: 0x0b1220,
    ffaSpawns: spawnRing(BASE_BOUNDS, 0.95),
    redSpawns: [v(-11, 0.95, -3), v(-11, 0.95, 3), v(-8, 0.95, 0)],
    blueSpawns: [v(11, 0.95, -3), v(11, 0.95, 3), v(8, 0.95, 0)],
    covers: [
      {
        id: 'cb_barrel_a',
        size: new THREE.Vector3(1.0, 1.0, 1.0),
        pos: v(-4.2, 0.5, -3.2),
        color: 0x6b7280,
        hp: 30,
        burnable: true,
        burnSeconds: 8,
        burnRadiusMeters: 4.2,
        burnDamagePerSecond: 8,
        onDestroyedExplosion: { radiusMeters: 3.4, damage: 18, statusEffects: [{ id: 'burn', durationSeconds: 3.0 }] }
      },
      {
        id: 'cb_barrel_b',
        size: new THREE.Vector3(1.0, 1.0, 1.0),
        pos: v(4.2, 0.5, 3.2),
        color: 0x6b7280,
        hp: 30,
        burnable: true,
        burnSeconds: 8,
        burnRadiusMeters: 4.2,
        burnDamagePerSecond: 8,
        onDestroyedExplosion: { radiusMeters: 3.4, damage: 18, statusEffects: [{ id: 'burn', durationSeconds: 3.0 }] }
      }
    ],
    pickups: [{ kind: 'weapon', id: 'cs_weapon', weaponId: 'fireArrow', pos: v(0, 0.2, 0) }],
    zones: [{ kind: 'rect', id: 'cs_water', minX: -3.2, maxX: 3.2, minZ: -9, maxZ: 9, effect: 'waterSlow' }],
    objectives: {
      siege: { capturePoint: v(0, 0, 0), captureRadius: 3.0 },
      ctf: { redFlagBase: v(-11, 0, 0), blueFlagBase: v(11, 0, 0), redBase: v(-11, 0, 0), blueBase: v(11, 0, 0) }
    }
  },
  hulaoPass: {
    id: 'hulaoPass',
    name: 'Hulao Pass',
    supportedModes: ['duel', 'ffa', 'siege', 'ctf'],
    bounds: BASE_BOUNDS,
    groundColor: 0x2a2420,
    ffaSpawns: spawnRing(BASE_BOUNDS, 0.95),
    redSpawns: [v(-11, 0.95, -4), v(-11, 0.95, 4), v(-9, 0.95, 0)],
    blueSpawns: [v(11, 0.95, -4), v(11, 0.95, 4), v(9, 0.95, 0)],
    covers: [
      { id: 'hp_gate', size: new THREE.Vector3(1.8, 1.6, 0.6), pos: v(0, 0.8, 0), color: 0x6b4f2a, hp: 80, toggleable: true },
      { id: 'hp_wall_a', size: new THREE.Vector3(3.6, 1.2, 0.7), pos: v(-4.2, 0.6, 0), color: 0x4b5563, hp: 9999 },
      { id: 'hp_wall_b', size: new THREE.Vector3(3.6, 1.2, 0.7), pos: v(4.2, 0.6, 0), color: 0x4b5563, hp: 9999 }
    ],
    pickups: [{ kind: 'throwable', id: 'hp_throw', throwableId: 'bearTrap', pos: v(0, 0.2, -6) }],
    objectives: {
      siege: { capturePoint: v(0, 0, 0), captureRadius: 3.2 },
      ctf: { redFlagBase: v(-11, 0, 0), blueFlagBase: v(11, 0, 0), redBase: v(-11, 0, 0), blueBase: v(11, 0, 0) }
    }
  },
  peachGarden: {
    id: 'peachGarden',
    name: 'Peach Garden',
    supportedModes: ['duel', 'ffa', 'siege', 'ctf'],
    bounds: BASE_BOUNDS,
    groundColor: 0x1b2b22,
    ffaSpawns: spawnRing(BASE_BOUNDS, 0.95),
    redSpawns: [v(-11, 0.95, -4), v(-11, 0.95, 4), v(-9, 0.95, 0)],
    blueSpawns: [v(11, 0.95, -4), v(11, 0.95, 4), v(9, 0.95, 0)],
    covers: [
      { id: 'pg_rock_a', size: new THREE.Vector3(2.4, 1.1, 1.8), pos: v(-4.5, 0.55, -1.5), color: 0x6b7280, hp: 9999 },
      {
        id: 'pg_hut',
        size: new THREE.Vector3(2.6, 1.4, 2.2),
        pos: v(4.5, 0.7, 1.5),
        color: 0x8b5a2b,
        hp: 35,
        burnable: true,
        burnSeconds: 6,
        burnRadiusMeters: 3.4,
        burnDamagePerSecond: 8
      }
    ],
    pickups: [{ kind: 'throwable', id: 'pg_throw', throwableId: 'limePowder', pos: v(0, 0.2, 0) }],
    zones: [{ kind: 'rect', id: 'pg_petals', minX: -2, maxX: 2, minZ: -2, maxZ: 2, effect: 'dark' }],
    objectives: {
      siege: { capturePoint: v(0, 0, 0), captureRadius: 3.0 },
      ctf: { redFlagBase: v(-11, 0, 0), blueFlagBase: v(11, 0, 0), redBase: v(-11, 0, 0), blueBase: v(11, 0, 0) }
    }
  },
  tongqueTerrace: {
    id: 'tongqueTerrace',
    name: 'Tongque Terrace',
    supportedModes: ['duel', 'ffa', 'siege', 'ctf'],
    bounds: BASE_BOUNDS,
    groundColor: 0x1a1b23,
    ffaSpawns: spawnRing(BASE_BOUNDS, 0.95),
    redSpawns: [v(-11, 0.95, -4), v(-11, 0.95, 4), v(-9, 0.95, 0)],
    blueSpawns: [v(11, 0.95, -4), v(11, 0.95, 4), v(9, 0.95, 0)],
    covers: [
      { id: 'tq_wall_a', size: new THREE.Vector3(6.0, 1.2, 0.7), pos: v(0, 0.6, 0), color: 0x374151, hp: 9999 },
      { id: 'tq_pillar_a', size: new THREE.Vector3(1.0, 1.6, 1.0), pos: v(-6.2, 0.8, -3.2), color: 0x6b7280, hp: 9999 },
      { id: 'tq_pillar_b', size: new THREE.Vector3(1.0, 1.6, 1.0), pos: v(6.2, 0.8, 3.2), color: 0x6b7280, hp: 9999 },
      { id: 'tq_screen', size: new THREE.Vector3(2.8, 1.2, 0.25), pos: v(0, 0.6, 4.0), color: 0x9aa5b4, hp: 9999, blocksProjectiles: false }
    ],
    pickups: [{ kind: 'weapon', id: 'tq_weapon', weaponId: 'poisonCrossbow', pos: v(0, 0.2, -6) }],
    zones: [
      { kind: 'rect', id: 'tq_dark_a', minX: -13, maxX: -3, minZ: -9, maxZ: 0, effect: 'dark' },
      { kind: 'rect', id: 'tq_dark_b', minX: 3, maxX: 13, minZ: 0, maxZ: 9, effect: 'dark' }
    ],
    objectives: {
      siege: { capturePoint: v(0, 0, 0), captureRadius: 3.0 },
      ctf: { redFlagBase: v(-11, 0, 0), blueFlagBase: v(11, 0, 0), redBase: v(-11, 0, 0), blueBase: v(11, 0, 0) }
    }
  },
  wuzhangyuanCamp: {
    id: 'wuzhangyuanCamp',
    name: 'Wuzhangyuan Camp',
    supportedModes: ['duel', 'ffa', 'siege', 'ctf'],
    bounds: BASE_BOUNDS,
    groundColor: 0x202423,
    ffaSpawns: spawnRing(BASE_BOUNDS, 0.95),
    redSpawns: [v(-11, 0.95, -4), v(-11, 0.95, 4), v(-9, 0.95, 0)],
    blueSpawns: [v(11, 0.95, -4), v(11, 0.95, 4), v(9, 0.95, 0)],
    covers: [
      { id: 'wz_tent_a', size: new THREE.Vector3(2.4, 1.1, 1.6), pos: v(-4.8, 0.55, 0), color: 0x4b5563, hp: 9999 },
      { id: 'wz_tent_b', size: new THREE.Vector3(2.4, 1.1, 1.6), pos: v(4.8, 0.55, 0), color: 0x4b5563, hp: 9999 }
    ],
    pickups: [{ kind: 'weapon', id: 'wz_weapon', weaponId: 'strongBow', pos: v(0, 0.2, 0) }],
    objectives: {
      siege: { capturePoint: v(0, 0, 0), captureRadius: 3.0 },
      ctf: { redFlagBase: v(-11, 0, 0), blueFlagBase: v(11, 0, 0), redBase: v(-11, 0, 0), blueBase: v(11, 0, 0) }
    }
  },
  baidicheng: {
    id: 'baidicheng',
    name: 'Baidicheng',
    supportedModes: ['duel', 'ffa', 'siege', 'ctf'],
    bounds: BASE_BOUNDS,
    groundColor: 0x1f2937,
    ffaSpawns: spawnRing(BASE_BOUNDS, 0.95),
    redSpawns: [v(-11, 0.95, -4), v(-11, 0.95, 4), v(-9, 0.95, 0)],
    blueSpawns: [v(11, 0.95, -4), v(11, 0.95, 4), v(9, 0.95, 0)],
    covers: [
      { id: 'bd_wall_a', size: new THREE.Vector3(4.0, 1.2, 0.7), pos: v(-3.8, 0.6, 0), color: 0x4b5563, hp: 9999 },
      { id: 'bd_wall_b', size: new THREE.Vector3(4.0, 1.2, 0.7), pos: v(3.8, 0.6, 0), color: 0x4b5563, hp: 9999 }
    ],
    pickups: [{ kind: 'throwable', id: 'bd_throw', throwableId: 'thunderGrenade', pos: v(0, 0.2, -6) }],
    objectives: {
      siege: { capturePoint: v(0, 0, 0), captureRadius: 3.0 },
      ctf: { redFlagBase: v(-11, 0, 0), blueFlagBase: v(11, 0, 0), redBase: v(-11, 0, 0), blueBase: v(11, 0, 0) }
    }
  },
  xuchangArena: {
    id: 'xuchangArena',
    name: 'Xuchang Arena',
    supportedModes: ['duel', 'ffa', 'siege', 'ctf'],
    bounds: BASE_BOUNDS,
    groundColor: 0x2b2f36,
    ffaSpawns: spawnRing(BASE_BOUNDS, 0.95),
    redSpawns: [v(-11, 0.95, -4), v(-11, 0.95, 4), v(-9, 0.95, 0)],
    blueSpawns: [v(11, 0.95, -4), v(11, 0.95, 4), v(9, 0.95, 0)],
    covers: [
      { id: 'xa_pillar_a', size: new THREE.Vector3(1.1, 1.2, 1.1), pos: v(-6.0, 0.6, 0), color: 0x6b7280, hp: 9999 },
      { id: 'xa_pillar_b', size: new THREE.Vector3(1.1, 1.2, 1.1), pos: v(6.0, 0.6, 0), color: 0x6b7280, hp: 9999 },
      {
        id: 'xa_gong',
        size: new THREE.Vector3(1.2, 1.0, 0.6),
        pos: v(0, 0.5, -6.8),
        color: 0xffd166,
        hp: 25,
        onDestroyedExplosion: { radiusMeters: 3.0, damage: 0, statusEffects: [{ id: 'blind', durationSeconds: 3.0 }] }
      }
    ],
    pickups: [{ kind: 'weapon', id: 'xa_weapon', weaponId: 'heavyCrossbow', pos: v(0, 0.2, 6) }],
    zones: [{ kind: 'circle', id: 'xa_center', x: 0, z: 0, radius: 3.2, effect: 'centerDamageBuff' }],
    objectives: {
      siege: { capturePoint: v(0, 0, 0), captureRadius: 3.0 },
      ctf: { redFlagBase: v(-11, 0, 0), blueFlagBase: v(11, 0, 0), redBase: v(-11, 0, 0), blueBase: v(11, 0, 0) }
    }
  }
};
