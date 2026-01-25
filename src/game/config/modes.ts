import type { ModeId } from './ids';

export type DuelModeConfig = {
  id: 'duel';
  name: string;
  playerCount: 2;
  rounds: number;
  winsToWin: number;
  roundTimeSeconds: number;
  suddenDeath: true;
};

export type FfaModeConfig = {
  id: 'ffa';
  name: string;
  playerCount: 4;
  livesPerPlayer: number;
  matchTimeSeconds: number;
  arenaScale: number;
};

export type SiegeModeConfig = {
  id: 'siege';
  name: string;
  teamSizes: number[];
  attackTimeSeconds: number;
  defenderRespawns: number;
};

export type CtfModeConfig = {
  id: 'ctf';
  name: string;
  teamSizes: number[];
  matchTimeSeconds: number;
  scoreToWin: number;
  carrierCanUseWeapons: false;
};

export type ModeConfig = DuelModeConfig | FfaModeConfig | SiegeModeConfig | CtfModeConfig;

export const MODE_CONFIGS = {
  duel: {
    id: 'duel',
    name: 'Duel',
    playerCount: 2,
    rounds: 5,
    winsToWin: 3,
    roundTimeSeconds: 105,
    suddenDeath: true
  },
  ffa: {
    id: 'ffa',
    name: 'Free For All',
    playerCount: 4,
    livesPerPlayer: 3,
    matchTimeSeconds: 180,
    arenaScale: 1.3
  },
  siege: {
    id: 'siege',
    name: 'Siege',
    teamSizes: [2, 3],
    attackTimeSeconds: 120,
    defenderRespawns: 3
  },
  ctf: {
    id: 'ctf',
    name: 'Capture The Flag',
    teamSizes: [2, 3],
    matchTimeSeconds: 300,
    scoreToWin: 3,
    carrierCanUseWeapons: false
  }
} as const satisfies Record<ModeId, ModeConfig>;
