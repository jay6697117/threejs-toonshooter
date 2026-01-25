export const WEAPON_IDS = [
  'flyingKnife',
  'flyingDart',
  'sleeveArrow',
  'boomerangBlade',
  'huntingBow',
  'repeatingCrossbow',
  'fireArrow',
  'ironMace',
  'strongBow',
  'heavyCrossbow',
  'siegeCrossbow',
  'poisonCrossbow',
  'zhugeRepeater',
  'grapplingHook',
  'thunderBomb'
] as const;

export type WeaponId = (typeof WEAPON_IDS)[number];

export const THROWABLE_IDS = [
  'thunderGrenade',
  'gunpowderPack',
  'smokeBomb',
  'tripWire',
  'caltrops',
  'bearTrap',
  'limePowder',
  'oilPot',
  'poisonSmoke'
] as const;

export type ThrowableId = (typeof THROWABLE_IDS)[number];

export const SCENE_IDS = [
  'trainingGround',
  'changbanRoad',
  'luoyangStreets',
  'chibiShips',
  'hulaoPass',
  'peachGarden',
  'tongqueTerrace',
  'wuzhangyuanCamp',
  'baidicheng',
  'xuchangArena'
] as const;

export type SceneId = (typeof SCENE_IDS)[number];

export const CHARACTER_IDS = [
  'liuBei',
  'guanYu',
  'zhangFei',
  'zhugeLiang',
  'xiahouDun',
  'zhangLiao',
  'caoCao',
  'dianWei',
  'ganNing',
  'sunShangxiang',
  'zhouYu',
  'taiShiCi'
] as const;

export type CharacterId = (typeof CHARACTER_IDS)[number];

export const MODE_IDS = ['duel', 'ffa', 'siege', 'ctf'] as const;
export type ModeId = (typeof MODE_IDS)[number];

export const STATUS_EFFECT_IDS = [
  'burn',
  'poison',
  'slow',
  'stun',
  'knockback',
  'bleed',
  'armorBreak',
  'blind',
  'root',
  'knockdown'
] as const;

export type StatusEffectId = (typeof STATUS_EFFECT_IDS)[number];

