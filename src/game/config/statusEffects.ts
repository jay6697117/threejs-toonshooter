import type { StatusEffectId } from './ids';

export type StatusEffectStacking = 'refresh' | 'none';

export type StatusEffectConfig =
  | {
      id: 'burn';
      kind: 'dot';
      damagePerSecond: number;
      durationSeconds: number;
      stacking: 'refresh';
    }
  | {
      id: 'poison';
      kind: 'dot';
      damagePerSecond: number;
      durationSeconds: { min: number; max: number };
      stacking: 'refresh';
      blocksHealing: true;
    }
  | {
      id: 'slow';
      kind: 'slow';
      speedMultiplier: number;
      durationSeconds: number;
      stacking: 'refresh';
    }
  | {
      id: 'stun';
      kind: 'stun';
      durationSeconds: number;
      stacking: 'none';
    }
  | {
      id: 'knockback';
      kind: 'impulse';
      distance: number;
    }
  | {
      id: 'bleed';
      kind: 'damageTakenMultiplier';
      multiplier: number;
      durationSeconds: number;
      stacking: 'refresh';
    }
  | {
      id: 'armorBreak';
      kind: 'armorIgnoreFraction';
      fraction: number;
    }
  | {
      id: 'blind';
      kind: 'blind';
      durationSeconds: number;
      stacking: 'refresh';
    }
  | {
      id: 'root';
      kind: 'root';
      durationSeconds: number;
      stacking: 'refresh';
    }
  | {
      id: 'knockdown';
      kind: 'knockdown';
      durationSeconds: number;
      stacking: 'none';
    };

export const STATUS_EFFECTS: Record<StatusEffectId, StatusEffectConfig> = {
  burn: {
    id: 'burn',
    kind: 'dot',
    damagePerSecond: 8,
    durationSeconds: 3,
    stacking: 'refresh'
  },
  poison: {
    id: 'poison',
    kind: 'dot',
    damagePerSecond: 5,
    durationSeconds: { min: 3, max: 6 },
    stacking: 'refresh',
    blocksHealing: true
  },
  slow: {
    id: 'slow',
    kind: 'slow',
    speedMultiplier: 0.5,
    durationSeconds: 1.5,
    stacking: 'refresh'
  },
  stun: {
    id: 'stun',
    kind: 'stun',
    durationSeconds: 0.8,
    stacking: 'none'
  },
  knockback: {
    id: 'knockback',
    kind: 'impulse',
    distance: 2
  },
  bleed: {
    id: 'bleed',
    kind: 'damageTakenMultiplier',
    multiplier: 1.2,
    durationSeconds: 2,
    stacking: 'refresh'
  },
  armorBreak: {
    id: 'armorBreak',
    kind: 'armorIgnoreFraction',
    fraction: 0.2
  },
  blind: {
    id: 'blind',
    kind: 'blind',
    durationSeconds: 3,
    stacking: 'refresh'
  },
  root: {
    id: 'root',
    kind: 'root',
    durationSeconds: 3,
    stacking: 'refresh'
  },
  knockdown: {
    id: 'knockdown',
    kind: 'knockdown',
    durationSeconds: 1.5,
    stacking: 'none'
  }
};

