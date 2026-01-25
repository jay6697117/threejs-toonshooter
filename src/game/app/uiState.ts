import type { MatchState } from '../modes/modeManager';
import type { CharacterId, ModeId, SceneId, StatusEffectId, ThrowableId, WeaponId } from '../config/ids';
import type { TeamId } from '../entities/entityBase';

export type UiWeaponSlotState = {
  weaponId: WeaponId;
  ammo: number;
  reserve: number;
  reloadTimer: number;
  cooldownTimer: number;
  chargeSeconds: number;
  burstShotsRemaining: number;
};

export type UiEntityRow = {
  id: string;
  team: TeamId;
  isAI: boolean;
  hp: number;
  maxHp: number;
  eliminated: boolean;
  livesLeft: number;
  kills: number;
  deaths: number;
  score: number;
  carryingFlag: 'red' | 'blue' | null;
};

export type UiHumanState = UiEntityRow & {
  characterId: CharacterId | null;
  damageDealtMultiplier: number;
  isInDark: boolean;
  isInWater: boolean;
  dashTimer: number;
  dashCooldown: number;
  weaponSlots: Array<WeaponId | null>;
  activeWeaponSlot: number;
  activeWeaponId: WeaponId | null;
  activeWeaponState: UiWeaponSlotState | null;
  throwableSlots: Array<{ id: ThrowableId; count: number } | null>;
  activeThrowableSlot: number;
  activeThrowable: { id: ThrowableId; count: number } | null;
  statuses: Array<{ id: StatusEffectId; timeLeft: number }>;
};

export type SanguoShooterUiState = {
  modeId: ModeId;
  sceneId: SceneId;
  paused: boolean;
  scoreboardHeld: boolean;
  match: MatchState;
  timeSeconds: number;
  humanId: string;
  human: UiHumanState;
  entities: UiEntityRow[];
};
