import type { ModeId, SceneId } from './ids';

export type SceneMechanics = {
  burnable?: boolean;
  breakableBridge?: boolean;
  fallingTree?: boolean;
  pushableCart?: boolean;
  explosiveJars?: boolean;
  waterSlow?: boolean;
  fireSpread?: boolean;
  gateToggle?: boolean;
  ladders?: boolean;
  traps?: boolean;
  petalsCover?: boolean;
  burnableHut?: boolean;
  lightDarkZones?: boolean;
  windBallistics?: boolean;
  globalDarkEvent?: boolean;
  lightningEvent?: boolean;
  cliffFall?: boolean;
  centerDamageBuff?: boolean;
  flashBlind?: boolean;
};

export type SceneConfig = {
  id: SceneId;
  name: string;
  mechanics: SceneMechanics;
  supportedModes: ModeId[];
};

export const SCENE_CONFIGS: Record<SceneId, SceneConfig> = {
  trainingGround: {
    id: 'trainingGround',
    name: 'Training Ground',
    mechanics: { burnable: true },
    supportedModes: ['duel', 'ffa', 'siege', 'ctf']
  },
  changbanRoad: {
    id: 'changbanRoad',
    name: 'Changban Road',
    mechanics: { breakableBridge: true, fallingTree: true },
    supportedModes: ['duel', 'ffa', 'siege', 'ctf']
  },
  luoyangStreets: {
    id: 'luoyangStreets',
    name: 'Luoyang Streets',
    mechanics: { pushableCart: true, explosiveJars: true },
    supportedModes: ['duel', 'ffa', 'siege', 'ctf']
  },
  chibiShips: {
    id: 'chibiShips',
    name: 'Chibi Ships',
    mechanics: { waterSlow: true, fireSpread: true },
    supportedModes: ['duel', 'ffa', 'siege', 'ctf']
  },
  hulaoPass: {
    id: 'hulaoPass',
    name: 'Hulao Pass',
    mechanics: { gateToggle: true, ladders: true, traps: true },
    supportedModes: ['duel', 'ffa', 'siege', 'ctf']
  },
  peachGarden: {
    id: 'peachGarden',
    name: 'Peach Garden',
    mechanics: { petalsCover: true, burnableHut: true, burnable: true },
    supportedModes: ['duel', 'ffa', 'siege', 'ctf']
  },
  tongqueTerrace: {
    id: 'tongqueTerrace',
    name: 'Tongque Terrace',
    mechanics: { lightDarkZones: true },
    supportedModes: ['duel', 'ffa', 'siege', 'ctf']
  },
  wuzhangyuanCamp: {
    id: 'wuzhangyuanCamp',
    name: 'Wuzhangyuan Camp',
    mechanics: { windBallistics: true, globalDarkEvent: true, burnable: true },
    supportedModes: ['duel', 'ffa', 'siege', 'ctf']
  },
  baidicheng: {
    id: 'baidicheng',
    name: 'Baidicheng',
    mechanics: { lightningEvent: true, cliffFall: true },
    supportedModes: ['duel', 'ffa', 'siege', 'ctf']
  },
  xuchangArena: {
    id: 'xuchangArena',
    name: 'Xuchang Arena',
    mechanics: { centerDamageBuff: true, flashBlind: true },
    supportedModes: ['duel', 'ffa', 'siege', 'ctf']
  }
};

