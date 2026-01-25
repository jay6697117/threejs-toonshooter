import type { StatusEffectId, ThrowableId } from './ids';

export type ThrowableCategory = 'explosive' | 'trap' | 'utility';

export type ThrowableDelivery = 'throw' | 'place';

export type ThrowableEffect =
  | {
      kind: 'explosion';
      delaySeconds: number;
      radiusMeters: number;
      maxDamage: number;
      onHitEffects?: Array<
        | { kind: 'status'; id: StatusEffectId; durationSeconds?: number | { min: number; max: number } }
        | { kind: 'impulse'; id: 'knockback'; distance: number }
      >;
    }
  | {
      kind: 'smoke';
      delaySeconds: number;
      radiusMeters: number;
      durationSeconds: number;
      smokeType: 'normal' | 'poison';
      damagePerSecond?: number;
      onTickEffects?: Array<{ kind: 'status'; id: StatusEffectId; durationSeconds?: number }>;
    }
  | {
      kind: 'trap';
      trigger: 'contact';
      maxLifetimeSeconds?: number;
      radiusMeters?: number;
      onTrigger: {
        damage: number;
        onHitEffects?: Array<{ kind: 'status'; id: StatusEffectId; durationSeconds?: number }>;
      };
    }
  | {
      kind: 'area';
      radiusMeters: number;
      durationSeconds: number;
      damagePerSecond?: number;
      slowMultiplier?: number;
      ignitable?: boolean;
      burnDamagePerSecondOnIgnite?: number;
      onTickEffects?: Array<{ kind: 'status'; id: StatusEffectId; durationSeconds?: number }>;
    };

export type ThrowableConfig = {
  id: ThrowableId;
  name: string;
  category: ThrowableCategory;
  delivery: ThrowableDelivery;
  effect: ThrowableEffect;
};

export const THROWABLE_CONFIGS: Record<ThrowableId, ThrowableConfig> = {
  thunderGrenade: {
    id: 'thunderGrenade',
    name: 'Thunder Grenade',
    category: 'explosive',
    delivery: 'throw',
    effect: {
      kind: 'explosion',
      delaySeconds: 2,
      radiusMeters: 4,
      maxDamage: 50,
      onHitEffects: [{ kind: 'impulse', id: 'knockback', distance: 2 }]
    }
  },
  gunpowderPack: {
    id: 'gunpowderPack',
    name: 'Gunpowder Pack',
    category: 'explosive',
    delivery: 'throw',
    effect: {
      kind: 'explosion',
      delaySeconds: 3,
      radiusMeters: 5,
      maxDamage: 75,
      onHitEffects: [
        { kind: 'impulse', id: 'knockback', distance: 2 },
        { kind: 'status', id: 'burn', durationSeconds: 3 }
      ]
    }
  },
  smokeBomb: {
    id: 'smokeBomb',
    name: 'Smoke Bomb',
    category: 'explosive',
    delivery: 'throw',
    effect: {
      kind: 'smoke',
      delaySeconds: 0.5,
      radiusMeters: 6,
      durationSeconds: 5,
      smokeType: 'normal'
    }
  },
  tripWire: {
    id: 'tripWire',
    name: 'Trip Wire',
    category: 'trap',
    delivery: 'place',
    effect: {
      kind: 'trap',
      trigger: 'contact',
      onTrigger: {
        damage: 10,
        onHitEffects: [{ kind: 'status', id: 'knockdown', durationSeconds: 1.5 }]
      }
    }
  },
  caltrops: {
    id: 'caltrops',
    name: 'Caltrops',
    category: 'trap',
    delivery: 'throw',
    effect: {
      kind: 'area',
      radiusMeters: 3,
      durationSeconds: 10,
      damagePerSecond: 5,
      onTickEffects: [{ kind: 'status', id: 'slow', durationSeconds: 1.5 }]
    }
  },
  bearTrap: {
    id: 'bearTrap',
    name: 'Bear Trap',
    category: 'trap',
    delivery: 'place',
    effect: {
      kind: 'trap',
      trigger: 'contact',
      onTrigger: {
        damage: 20,
        onHitEffects: [{ kind: 'status', id: 'root', durationSeconds: 3 }]
      }
    }
  },
  limePowder: {
    id: 'limePowder',
    name: 'Lime Powder',
    category: 'utility',
    delivery: 'throw',
    effect: {
      kind: 'area',
      radiusMeters: 3,
      durationSeconds: 0.2,
      onTickEffects: [{ kind: 'status', id: 'blind', durationSeconds: 3 }]
    }
  },
  oilPot: {
    id: 'oilPot',
    name: 'Oil Pot',
    category: 'utility',
    delivery: 'throw',
    effect: {
      kind: 'area',
      radiusMeters: 4,
      durationSeconds: 8,
      slowMultiplier: 0.5,
      ignitable: true,
      burnDamagePerSecondOnIgnite: 15,
      onTickEffects: [{ kind: 'status', id: 'slow', durationSeconds: 1.5 }]
    }
  },
  poisonSmoke: {
    id: 'poisonSmoke',
    name: 'Poison Smoke',
    category: 'utility',
    delivery: 'throw',
    effect: {
      kind: 'smoke',
      delaySeconds: 0.5,
      radiusMeters: 4,
      durationSeconds: 6,
      smokeType: 'poison',
      damagePerSecond: 8,
      onTickEffects: [{ kind: 'status', id: 'poison', durationSeconds: 3 }]
    }
  }
};

